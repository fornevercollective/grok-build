#!/usr/bin/env python3
"""Memory Glass still-pipe + ego batch server.

Serves ~/.panda/vision (live.jpg, glass.jpg, ego/*).
POST /upload          — phone cam JPEG → live.jpg
POST /ego/frame       — append ego batch frame (JPEG body or multipart)
POST /ego/end         — finalize batch manifest
GET  /ego/latest.json — latest batch summary
GET  /health          — status JSON

Env:
  MG_STILL_PORT=9877
  MG_STILL_BIND=127.0.0.1  (use 0.0.0.0 on Mini for LAN phone cam)
  GY_VISION_DIR=~/.panda/vision
"""
from __future__ import annotations

import json
import os
import re
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(os.environ.get("GY_VISION_DIR", os.path.expanduser("~/.panda/vision"))).resolve()
ROOT.mkdir(parents=True, exist_ok=True)
EGO = ROOT / "ego"
EGO.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get("MG_STILL_PORT", "9877"))
BIND = os.environ.get("MG_STILL_BIND", "127.0.0.1")

_active_batch: dict | None = None


def _new_batch(meta: dict | None = None) -> dict:
    bid = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    bdir = EGO / bid
    bdir.mkdir(parents=True, exist_ok=True)
    batch = {
        "id": bid,
        "dir": str(bdir),
        "started": time.time(),
        "frames": 0,
        "meta": meta or {},
        "ended": None,
    }
    (bdir / "manifest.json").write_text(json.dumps(batch, indent=2))
    (ROOT / "ego-latest.json").write_text(json.dumps({"id": bid, "frames": 0, "dir": str(bdir)}))
    return batch


def _write_live(data: bytes) -> None:
    live = ROOT / "live.jpg"
    tmp = ROOT / "live.jpg.tmp"
    tmp.write_bytes(data)
    tmp.replace(live)
    (ROOT / "live.stamp").write_text(str(time.time()))


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-MG-Meta")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n > 0 else b""

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/health", "/ego/health"):
            live = ROOT / "live.jpg"
            age = None
            if live.exists():
                age = time.time() - live.stat().st_mtime
            self._json(
                200,
                {
                    "ok": True,
                    "root": str(ROOT),
                    "live": live.exists(),
                    "live_age_s": age,
                    "active_batch": _active_batch["id"] if _active_batch else None,
                    "frames": _active_batch["frames"] if _active_batch else 0,
                },
            )
            return
        if path in ("/ego/latest.json", "/ego/latest"):
            p = ROOT / "ego-latest.json"
            if p.exists():
                self._json(200, json.loads(p.read_text()))
            else:
                self._json(200, {"id": None, "frames": 0})
            return
        return super().do_GET()

    def do_POST(self):
        global _active_batch
        path = urlparse(self.path).path

        if path in ("/upload", "/cam", "/live"):
            data = self._read_multipart_or_raw()
            if not data:
                self._json(400, {"ok": False, "err": "empty body"})
                return
            _write_live(data)
            # also append to active ego batch if recording
            if _active_batch:
                self._append_ego_frame(data)
            self._json(200, {"ok": True, "bytes": len(data), "ego": bool(_active_batch)})
            return

        if path in ("/ego/start",):
            meta = {}
            try:
                raw = self._read_body()
                if raw:
                    meta = json.loads(raw.decode("utf-8", errors="replace"))
            except Exception:
                meta = {}
            _active_batch = _new_batch(meta)
            self._json(200, {"ok": True, "batch": _active_batch["id"]})
            return

        if path in ("/ego/frame", "/ego/append"):
            data = self._read_multipart_or_raw()
            if not data:
                self._json(400, {"ok": False, "err": "empty frame"})
                return
            if not _active_batch:
                _active_batch = _new_batch({"auto": True})
            _write_live(data)  # keep inspect feed warm
            info = self._append_ego_frame(data)
            self._json(200, {"ok": True, **info})
            return

        if path in ("/ego/end", "/ego/stop"):
            if not _active_batch:
                self._json(200, {"ok": True, "batch": None})
                return
            _active_batch["ended"] = time.time()
            bdir = Path(_active_batch["dir"])
            (bdir / "manifest.json").write_text(json.dumps(_active_batch, indent=2))
            (ROOT / "ego-latest.json").write_text(
                json.dumps(
                    {
                        "id": _active_batch["id"],
                        "frames": _active_batch["frames"],
                        "dir": _active_batch["dir"],
                        "ended": _active_batch["ended"],
                    }
                )
            )
            done = _active_batch
            _active_batch = None
            self._json(200, {"ok": True, "batch": done})
            return

        self._json(404, {"ok": False, "err": "unknown path"})

    def _append_ego_frame(self, data: bytes) -> dict:
        global _active_batch
        assert _active_batch
        bdir = Path(_active_batch["dir"])
        i = _active_batch["frames"]
        fp = bdir / f"frame_{i:05d}.jpg"
        fp.write_bytes(data)
        _active_batch["frames"] = i + 1
        # lightweight index line
        with (bdir / "frames.jsonl").open("a") as f:
            f.write(json.dumps({"i": i, "t": time.time(), "bytes": len(data), "file": fp.name}) + "\n")
        (bdir / "manifest.json").write_text(json.dumps(_active_batch, indent=2))
        (ROOT / "ego-latest.json").write_text(
            json.dumps(
                {
                    "id": _active_batch["id"],
                    "frames": _active_batch["frames"],
                    "dir": _active_batch["dir"],
                }
            )
        )
        return {"batch": _active_batch["id"], "frame": i, "bytes": len(data)}

    def _read_multipart_or_raw(self) -> bytes:
        """Raw body or naive multipart extract (no cgi — removed in Py3.13+)."""
        ctype = self.headers.get("Content-Type", "")
        raw = self._read_body()
        if not raw:
            return b""
        if "multipart/form-data" not in ctype:
            return raw
        # Extract first file part between boundaries (JPEG starts with FFD8)
        m = re.search(rb"\r\n\r\n", raw)
        if not m:
            # try find JPEG magic anywhere
            j = raw.find(b"\xff\xd8")
            return raw[j:] if j >= 0 else raw
        # walk parts
        j = raw.find(b"\xff\xd8")
        if j >= 0:
            k = raw.find(b"\xff\xd9", j)
            if k > j:
                return raw[j : k + 2]
            return raw[j:]
        return raw[m.end() :]


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((BIND, PORT), H)
    print(
        f"still-server http://{BIND}:{PORT}/live.jpg  ego=/ego/start|/ego/frame|/ego/end  upload=/upload",
        flush=True,
    )
    httpd.serve_forever()
