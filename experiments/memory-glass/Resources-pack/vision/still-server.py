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
SHARES = ROOT / "shares"
SHARES.mkdir(parents=True, exist_ok=True)
SNAPS = ROOT / "snaps"
SNAPS.mkdir(parents=True, exist_ok=True)
VOICE = Path(os.environ.get("GY_VOICE_DIR", os.path.expanduser("~/.panda/voice"))).resolve()
VOICE.mkdir(parents=True, exist_ok=True)
CONV = VOICE / "conversation.jsonl"
PORT = int(os.environ.get("MG_STILL_PORT", "9877"))
BIND = os.environ.get("MG_STILL_BIND", "127.0.0.1")

_active_batch: dict | None = None


def _append_conv(
    role: str,
    text: str,
    src: str = "",
    *,
    kind: str = "text",
    image: str | None = None,
    link: str | None = None,
    extra: dict | None = None,
) -> dict:
    """Shared chat log: phone UI + terminal agent + speak-local.

    kind: text | photo | link | snapshot
    image: web path under vision root, e.g. /shares/foo.jpg or /snaps/bar.jpg
    link: shared URL
    """
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    epoch = int(time.time())
    row = {
        "ts": ts,
        "epoch": epoch,
        "role": role,  # user | assistant | system
        "text": text or "",
        "src": src or role,
        "kind": kind or "text",
    }
    if image:
        row["image"] = image
    if link:
        row["link"] = link
    if extra:
        row.update(extra)
    with CONV.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return row


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
    # Unique tmp avoids races when two uploads land together
    tmp = ROOT / f"live.jpg.{uuid.uuid4().hex[:8]}.tmp"
    try:
        tmp.write_bytes(data)
        tmp.replace(live)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
    (ROOT / "live.stamp").write_text(str(time.time()))


def _save_bytes(folder: Path, data: bytes, prefix: str, ext: str = "jpg") -> str:
    """Write media under vision root; return web path like /shares/name.jpg."""
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{prefix}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}.{ext}"
    path = folder / name
    path.write_bytes(data)
    return f"/{folder.name}/{name}"


def _snapshot_live(prefix: str = "snap") -> str | None:
    """Copy current live.jpg into snaps/; return web path or None."""
    live = ROOT / "live.jpg"
    if not live.is_file() or live.stat().st_size < 32:
        return None
    try:
        data = live.read_bytes()
    except OSError:
        return None
    return _save_bytes(SNAPS, data, prefix, "jpg")


class H(SimpleHTTPRequestHandler):
    # iOS profile + cert install (HTTP download — no click-through needed)
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, "extensions_map", {}),
        ".html": "text/html",
        ".htm": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".css": "text/css",
        ".crt": "application/x-x509-ca-cert",
        ".cer": "application/pkix-cert",
        ".mobileconfig": "application/x-apple-aspen-config",
        ".pem": "application/x-pem-file",
    }

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
            audio = VOICE / "phone-live.audio"
            aage = None
            if audio.exists():
                aage = time.time() - audio.stat().st_mtime
            inbox = VOICE / "inbox.jsonl"
            self._json(
                200,
                {
                    "ok": True,
                    "root": str(ROOT),
                    "live": live.exists(),
                    "live_age_s": age,
                    "audio": audio.exists(),
                    "audio_age_s": aage,
                    "inbox": inbox.exists(),
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
        # Conversation log for phone chat UI (user + assistant turns)
        if path in ("/conversation", "/chat", "/conv"):
            rows = []
            if CONV.exists():
                for line in CONV.read_text(errors="replace").splitlines()[-200:]:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rows.append(json.loads(line))
                    except Exception:
                        pass
            self._json(200, {"ok": True, "n": len(rows), "messages": rows})
            return
        # Friendly root → cert setup for phones (HTTP, no click-through)
        if path in ("/", "/index.html"):
            self.path = "/phone-setup.html"
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

        # Phone mic: raw audio blob (webm/mp4/wav) → voice dir for whisper / bridge
        if path in ("/audio", "/mic", "/upload-audio"):
            data = self._read_multipart_or_raw()
            if not data:
                self._json(400, {"ok": False, "err": "empty audio"})
                return
            ctype = (self.headers.get("Content-Type") or "").lower()
            ext = "webm"
            if "mp4" in ctype or "m4a" in ctype or "aac" in ctype:
                ext = "m4a"
            elif "wav" in ctype or "wave" in ctype:
                ext = "wav"
            elif "ogg" in ctype or "opus" in ctype:
                ext = "ogg"
            elif "mpeg" in ctype or "mp3" in ctype:
                ext = "mp3"
            live_a = VOICE / "phone-live.audio"
            tmp = VOICE / f"phone-live.audio.tmp"
            tmp.write_bytes(data)
            tmp.replace(live_a)
            named = VOICE / f"phone-live.{ext}"
            named.write_bytes(data)
            (VOICE / "phone-live.stamp").write_text(str(time.time()))
            # queue clip for bridge (rotating)
            clip = VOICE / f"phone-clip.{ext}"
            clip.write_bytes(data)
            self._json(200, {"ok": True, "bytes": len(data), "ext": ext, "path": str(clip)})
            return

        # Phone SpeechRecognition transcript → inbox (no whisper on Mini required)
        if path in ("/transcript", "/stt", "/say"):
            raw = self._read_body()
            text = ""
            try:
                if raw:
                    obj = json.loads(raw.decode("utf-8", errors="replace"))
                    if isinstance(obj, dict):
                        text = str(obj.get("text") or obj.get("transcript") or "").strip()
                    else:
                        text = str(obj).strip()
            except Exception:
                text = raw.decode("utf-8", errors="replace").strip()
            if not text:
                self._json(400, {"ok": False, "err": "empty text"})
                return
            # drop tiny noise
            if len(text) < 2:
                self._json(200, {"ok": True, "dropped": True})
                return
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            epoch = int(time.time())
            line = json.dumps(
                {"ts": ts, "epoch": epoch, "text": text, "src": "phone-transcript"},
                ensure_ascii=False,
            )
            inbox = VOICE / "inbox.jsonl"
            with inbox.open("a") as f:
                f.write(line + "\n")
            _append_conv("user", text, "phone-transcript")
            (VOICE / "last.txt").write_text(text + "\n")
            (VOICE / "phone-transcript.stamp").write_text(str(time.time()))
            print(f"USER_SAID {text}", flush=True)
            self._json(200, {"ok": True, "text": text, "inbox": str(inbox)})
            return

        # Assistant / terminal reply (spoken on Mini) → phone chat UI
        # JSON: { text, snapshot?: bool, image?: base64 or path, link?, src? }
        # Or raw image body with X-MG-Meta: {"text":"...","snapshot":false}
        if path in ("/reply", "/assistant", "/speak-log"):
            ctype = (self.headers.get("Content-Type") or "").lower()
            raw = self._read_body()
            text = ""
            src = "speak-local"
            want_snap = False
            link = None
            image_path = None
            kind = "text"
            obj: dict | None = None
            try:
                if raw and ("json" in ctype or (raw[:1] in (b"{", b"["))):
                    parsed = json.loads(raw.decode("utf-8", errors="replace"))
                    if isinstance(parsed, dict):
                        obj = parsed
                        text = str(obj.get("text") or obj.get("reply") or "").strip()
                        src = str(obj.get("src") or src)
                        want_snap = bool(obj.get("snapshot") or obj.get("snap") or obj.get("attach_live"))
                        link = (obj.get("link") or obj.get("url") or None)
                        if link:
                            link = str(link).strip() or None
                        if obj.get("image") and isinstance(obj["image"], str) and obj["image"].startswith("/"):
                            image_path = obj["image"]
                        # optional base64 jpeg
                        b64 = obj.get("image_b64") or obj.get("jpeg_b64")
                        if b64 and isinstance(b64, str):
                            import base64

                            try:
                                blob = base64.b64decode(b64.split(",")[-1])
                                image_path = _save_bytes(SNAPS, blob, "reply", "jpg")
                            except Exception:
                                pass
                    else:
                        text = str(parsed).strip()
                elif raw and ("image" in ctype or raw[:2] == b"\xff\xd8"):
                    data = raw
                    if "multipart" in ctype:
                        j = raw.find(b"\xff\xd8")
                        if j >= 0:
                            k = raw.find(b"\xff\xd9", j)
                            data = raw[j : k + 2] if k > j else raw[j:]
                    if data and data[:2] == b"\xff\xd8":
                        image_path = _save_bytes(SNAPS, data, "reply", "jpg")
                    meta_h = self.headers.get("X-MG-Meta") or ""
                    if meta_h:
                        try:
                            m = json.loads(meta_h)
                            text = str(m.get("text") or "").strip()
                            src = str(m.get("src") or src)
                            want_snap = bool(m.get("snapshot") or want_snap)
                        except Exception:
                            pass
                else:
                    text = raw.decode("utf-8", errors="replace").strip() if raw else ""
            except Exception:
                text = raw.decode("utf-8", errors="replace").strip() if raw else ""

            if want_snap and not image_path:
                image_path = _snapshot_live("mini")
            if link and not text:
                text = link
            if image_path and not text:
                text = "snapshot" if want_snap else "photo"
            if not text and not image_path and not link:
                self._json(400, {"ok": False, "err": "empty reply"})
                return
            if image_path and want_snap:
                kind = "snapshot"
            elif image_path:
                kind = "photo"
            elif link:
                kind = "link"
            else:
                kind = "text"

            row = _append_conv(
                "assistant",
                text or "",
                src,
                kind=kind,
                image=image_path,
                link=link,
            )
            self._json(200, {"ok": True, "message": row})
            return

        # Phone share: photo (multipart/raw jpeg) and/or link + caption
        # POST /share  JSON { text?, link? }  OR image body / multipart
        # Also accepts multipart with fields: file, text, link
        if path in ("/share", "/photo", "/upload-share"):
            ctype = (self.headers.get("Content-Type") or "").lower()
            raw = self._read_body()
            text = ""
            link = None
            image_path = None
            src = "phone-share"

            # Peek meta header
            meta_h = self.headers.get("X-MG-Meta") or ""
            if meta_h:
                try:
                    m = json.loads(meta_h)
                    text = str(m.get("text") or m.get("caption") or "").strip()
                    link = (m.get("link") or m.get("url") or None)
                    if link:
                        link = str(link).strip() or None
                    src = str(m.get("src") or src)
                except Exception:
                    pass

            if raw and "json" in ctype:
                try:
                    obj = json.loads(raw.decode("utf-8", errors="replace"))
                    if isinstance(obj, dict):
                        text = str(obj.get("text") or obj.get("caption") or text).strip()
                        link = obj.get("link") or obj.get("url") or link
                        if link:
                            link = str(link).strip() or None
                        src = str(obj.get("src") or src)
                        # optional data-url / b64
                        b64 = obj.get("image_b64") or obj.get("jpeg_b64")
                        if b64 and isinstance(b64, str):
                            import base64

                            try:
                                blob = base64.b64decode(b64.split(",")[-1])
                                image_path = _save_bytes(SHARES, blob, "share", "jpg")
                            except Exception:
                                pass
                except Exception:
                    pass
            elif raw:
                # image or multipart
                data = b""
                if "multipart/form-data" in ctype:
                    # extract jpeg + try to find text fields
                    j = raw.find(b"\xff\xd8")
                    if j >= 0:
                        k = raw.find(b"\xff\xd9", j)
                        data = raw[j : k + 2] if k > j else raw[j:]
                    # naive text field scrape
                    for key in (b'name="text"', b'name="caption"', b'name="link"', b'name="url"'):
                        idx = raw.find(key)
                        if idx < 0:
                            continue
                        m = re.search(rb"\r\n\r\n(.*?)\r\n--", raw[idx:], re.S)
                        if m:
                            val = m.group(1).decode("utf-8", errors="replace").strip()
                            if b"link" in key or b"url" in key:
                                link = val or link
                            else:
                                text = val or text
                elif raw[:2] == b"\xff\xd8" or "image" in ctype:
                    data = raw if raw[:2] == b"\xff\xd8" else raw
                if data and data[:2] == b"\xff\xd8":
                    image_path = _save_bytes(SHARES, data, "share", "jpg")
                    # also warm still-pipe so Mini/desktop sees it
                    try:
                        _write_live(data)
                    except Exception:
                        pass

            kind = "text"
            if image_path and link:
                kind = "photo"
            elif image_path:
                kind = "photo"
            elif link:
                kind = "link"
            if not text and link:
                text = link
            if not text and image_path:
                text = "photo"
            if not text and not image_path and not link:
                self._json(400, {"ok": False, "err": "empty share"})
                return

            # also push text shares into transcript inbox so agent monitor sees them
            if text and (kind in ("text", "link") or image_path):
                try:
                    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    epoch = int(time.time())
                    note = text
                    if image_path:
                        note = f"{text} [photo {image_path}]"
                    if link and link not in note:
                        note = f"{note} {link}".strip()
                    line = json.dumps(
                        {
                            "ts": ts,
                            "epoch": epoch,
                            "text": note,
                            "src": src,
                            "image": image_path,
                            "link": link,
                            "kind": kind,
                        },
                        ensure_ascii=False,
                    )
                    with (VOICE / "inbox.jsonl").open("a") as f:
                        f.write(line + "\n")
                    print(f"USER_SHARE {note}", flush=True)
                except Exception:
                    pass

            row = _append_conv(
                "user",
                text or "",
                src,
                kind=kind,
                image=image_path,
                link=link,
            )
            self._json(200, {"ok": True, "message": row})
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


def _maybe_ssl(httpd, port: int):
    """Wrap socket with TLS when certs exist (phone cam needs HTTPS for getUserMedia)."""
    cert = Path(os.environ.get("MG_STILL_CERT", str(ROOT / "certs" / "still.crt")))
    key = Path(os.environ.get("MG_STILL_KEY", str(ROOT / "certs" / "still.key")))
    if not (cert.is_file() and key.is_file()):
        return False
    import ssl

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cert), str(key))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"still-server HTTPS https://{BIND}:{port}/  cert={cert}", flush=True)
    return True


if __name__ == "__main__":
    import threading

    # HTTP (inspect on Mini + Snap fallback) — always
    httpd = ThreadingHTTPServer((BIND, PORT), H)
    print(
        f"still-server HTTP  http://{BIND}:{PORT}/  live.jpg · /upload · /phone.html",
        flush=True,
    )
    threading.Thread(target=httpd.serve_forever, daemon=True, name="still-http").start()

    # HTTPS (iPhone live cam — getUserMedia requires secure context)
    # Default 9878 so both can run; set MG_STILL_HTTPS_PORT=0 to disable
    https_port = int(os.environ.get("MG_STILL_HTTPS_PORT", "9878"))
    if https_port > 0:
        httpsd = ThreadingHTTPServer((BIND, https_port), H)
        if _maybe_ssl(httpsd, https_port):
            print(
                f"  phone live cam: https://<mini-lan>:{https_port}/phone.html  (trust self-signed once)",
                flush=True,
            )
            try:
                httpsd.serve_forever()
            except KeyboardInterrupt:
                pass
        else:
            print(
                "  WARN: no certs at ~/.panda/vision/certs/still.{crt,key} — iPhone live cam blocked on HTTP",
                flush=True,
            )
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass
    else:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
