#!/usr/bin/env python3
"""Memory Glass XR PWA + multi-seat room API on :8787.

Static files from pwa/ plus:
  GET  /api/xr/status
  GET  /api/xr/room?room=lab
  POST /api/xr/room          JSON body {room, peer, action, payload}
  GET  /api/xr/for-ai
  GET  /api/xr/peers

Never bind Soft Path 8765/8766.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("MG_XR_PORT") or os.environ.get("MG_PWA_PORT") or "8787")
ROOT = Path(os.environ.get("MG_XR_PWA") or Path(__file__).resolve().parent.parent / "pwa")
STATE = Path(os.environ.get("MG_XR_STATE") or Path.home() / ".panda" / "mg-xr")
STATE.mkdir(parents=True, exist_ok=True)
ROOM_FILE = STATE / "rooms.json"
LATEST = STATE / "LATEST.json"
PEER_TTL = float(os.environ.get("MG_XR_PEER_TTL", "45"))
LOCK = threading.RLock()


def _now() -> float:
    return time.time()


def _load_rooms() -> dict:
    if ROOM_FILE.is_file():
        try:
            return json.loads(ROOM_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"rooms": {}}


def _save_rooms(data: dict) -> None:
    tmp = ROOM_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(ROOM_FILE)


def _gc(rooms: dict) -> None:
    cut = _now() - PEER_TTL
    for rid, room in list(rooms.get("rooms", {}).items()):
        peers = room.get("peers") or {}
        dead = [pid for pid, p in peers.items() if float(p.get("ts", 0)) < cut]
        for pid in dead:
            del peers[pid]
        if not peers and float(room.get("updated", 0)) < cut:
            del rooms["rooms"][rid]


def _room_snapshot(room_id: str) -> dict:
    with LOCK:
        data = _load_rooms()
        _gc(data)
        room = data.setdefault("rooms", {}).setdefault(
            room_id,
            {
                "id": room_id,
                "created": _now(),
                "updated": _now(),
                "peers": {},
                "optics": None,
                "device": None,
                "note": "",
                "handoff": None,
            },
        )
        _save_rooms(data)
        return json.loads(json.dumps(room))


def _room_post(body: dict) -> dict:
    room_id = str(body.get("room") or "lab")
    action = str(body.get("action") or "ping")
    peer = body.get("peer") or {}
    peer_id = str(peer.get("id") or body.get("peerId") or uuid.uuid4())
    with LOCK:
        data = _load_rooms()
        _gc(data)
        rooms = data.setdefault("rooms", {})
        room = rooms.setdefault(
            room_id,
            {
                "id": room_id,
                "created": _now(),
                "updated": _now(),
                "peers": {},
                "optics": None,
                "device": None,
                "note": "",
                "handoff": None,
            },
        )
        peers = room.setdefault("peers", {})
        if action == "leave":
            peers.pop(peer_id, None)
        else:
            peers[peer_id] = {
                "id": peer_id,
                "name": peer.get("name") or peer_id[:8],
                "role": peer.get("role") or "human",  # human | ai | glass | host
                "deviceId": peer.get("deviceId"),
                "class": peer.get("class"),
                "ua": (peer.get("ua") or "")[:120],
                "ts": _now(),
                "url": peer.get("url"),
            }
            if body.get("device") is not None:
                room["device"] = body["device"]
            if body.get("optics") is not None:
                room["optics"] = body["optics"]
            if body.get("note") is not None:
                room["note"] = str(body["note"])[:2000]
            if body.get("handoff") is not None:
                room["handoff"] = body["handoff"]
        room["updated"] = _now()
        _save_rooms(data)
        out = json.loads(json.dumps(room))
        out["you"] = peer_id
        return out


def _for_ai() -> dict:
    lan = ""
    try:
        import socket

        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    with LOCK:
        rooms = _load_rooms()
        _gc(rooms)
        snap = {
            "ver": "mg-xr-serve-v2",
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "port": PORT,
            "pwa": str(ROOT),
            "urls": {
                "local": f"http://127.0.0.1:{PORT}/xr-dev.html?mg_xr=1",
                "lan": f"http://{lan}:{PORT}/xr-dev.html?mg_xr=1" if lan else None,
                "onboard": f"http://127.0.0.1:{PORT}/xr-onboard.html",
                "forAi": f"http://127.0.0.1:{PORT}/api/xr/for-ai",
            },
            "rooms": rooms.get("rooms") or {},
            "agent": {
                "sync": "bash experiments/memory-glass/scripts/mg-xr-dev.sh auto",
                "hot": "bash experiments/memory-glass/scripts/mg-xr-dev.sh hot",
                "doctor": "bash experiments/memory-glass/scripts/mg-xr-dev.sh doctor",
                "quest": "bash experiments/memory-glass/scripts/mg-xr-dev.sh quest",
                "console": [
                    "__mgXr.auto()",
                    "__mgXr.forAi()",
                    "__mgXr.room.join('lab')",
                    "__mgXr.status()",
                ],
                "neverPorts": [8765, 8766],
                "edit": "experiments/memory-glass/hotpipe/*.js then mg-xr-dev.sh hot",
            },
        }
        try:
            LATEST.write_text(json.dumps(snap, indent=2), encoding="utf-8")
        except Exception:
            pass
        return snap


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def _json(self, code: int, obj: dict):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path.rstrip("/") or "/"
        if path == "/api/xr/status":
            return self._json(
                200,
                {
                    "ok": True,
                    "ver": "mg-xr-serve-v2",
                    "port": PORT,
                    "roomApi": True,
                    "root": str(ROOT),
                },
            )
        if path == "/api/xr/for-ai":
            return self._json(200, _for_ai())
        if path == "/api/xr/room":
            qs = parse_qs(u.query or "")
            rid = (qs.get("room") or ["lab"])[0]
            return self._json(200, _room_snapshot(rid))
        if path == "/api/xr/peers":
            qs = parse_qs(u.query or "")
            rid = (qs.get("room") or ["lab"])[0]
            room = _room_snapshot(rid)
            return self._json(
                200,
                {
                    "room": rid,
                    "peers": list((room.get("peers") or {}).values()),
                    "device": room.get("device"),
                    "optics": room.get("optics"),
                    "note": room.get("note"),
                },
            )
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        path = u.path.rstrip("/") or "/"
        if path != "/api/xr/room":
            self.send_error(404)
            return
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return self._json(400, {"ok": False, "error": "bad json"})
        return self._json(200, _room_post(body if isinstance(body, dict) else {}))


def main() -> int:
    if PORT in (8765, 8766):
        print("error: port %s is Soft Path exclusive" % PORT, file=sys.stderr)
        return 2
    if not ROOT.is_dir():
        print("error: missing pwa root %s" % ROOT, file=sys.stderr)
        return 2
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("mg-xr-serve v2 · %s · http://127.0.0.1:%s/xr-dev.html" % (ROOT, PORT), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
