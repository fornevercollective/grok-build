#!/usr/bin/env python3
"""WebGrid playthrough collector + pace file server.

  python3 scripts/webgrid-collector.py

POST samples → ~/.panda/mg-soak/watch/play.jsonl
GET  /pace    → pace.json (from webgrid-pace-advisor.py)
GET  /summary → live-summary.json
GET  /tail    → last 30 lines
"""
from __future__ import annotations

import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

OUT = Path.home() / ".panda/mg-soak/watch"
OUT.mkdir(parents=True, exist_ok=True)
JSONL = OUT / "play.jsonl"
SUMMARY = OUT / "live-summary.json"
PACE = OUT / "pace.json"
PORT = int(__import__("os").environ.get("MG_WATCH_PORT", "9880"))


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/summary"):
            body = SUMMARY.read_bytes() if SUMMARY.exists() else b"{}"
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return
        if path.startswith("/pace"):
            if PACE.exists():
                body = PACE.read_bytes()
            else:
                body = json.dumps(
                    {
                        "sleep_ms": 10,
                        "wait_loops": 16,
                        "mode": "steady",
                        "note": "no advisor yet",
                        "source": "default",
                    }
                ).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if path.startswith("/tail"):
            lines = []
            if JSONL.exists():
                lines = JSONL.read_text().splitlines()[-30:]
            body = ("\n".join(lines) + "\n").encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"mg-watch ok\n")

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            obj = json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            obj = {"raw": raw.decode("utf-8", "replace")[:500]}
        obj["_recv"] = time.time()
        with JSONL.open("a") as f:
            f.write(json.dumps(obj, separators=(",", ":")) + "\n")
        try:
            summ = {
                "updated": time.time(),
                "kind": obj.get("kind"),
                "bps": obj.get("bps"),
                "ntpm": obj.get("ntpm"),
                "timer": obj.get("timer"),
                "grid": obj.get("grid"),
                "phase": obj.get("phase"),
                "blues": obj.get("blues"),
                "clicks": obj.get("clicks"),
                "hits": obj.get("hits"),
                "misses": obj.get("misses"),
                "note": obj.get("note"),
            }
            SUMMARY.write_text(json.dumps(summ, indent=2))
        except Exception:
            pass
        k = obj.get("kind", "?")
        print(
            f"MG_WATCH {k} phase={obj.get('phase')} bps={obj.get('bps')} "
            f"ntpm={obj.get('ntpm')} t={obj.get('timer')} grid={obj.get('grid')}",
            flush=True,
        )
        self.send_response(204)
        self._cors()
        self.end_headers()


if __name__ == "__main__":
    (OUT / "session.stamp").write_text(str(time.time()))
    if not JSONL.exists():
        JSONL.write_text("")
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"MG_WATCH_COLLECTOR ready :{PORT} → {JSONL}", flush=True)
    httpd.serve_forever()
