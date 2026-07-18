#!/usr/bin/env python3
"""Serve live.jpg for Memory Glass inspect PIP fallback."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

ROOT = Path(os.path.expanduser("~/.panda/vision")).resolve()
PORT = int(os.environ.get("MG_STILL_PORT", "9877"))

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()
    def log_message(self, fmt, *args):
        pass  # quiet

if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"still-server http://127.0.0.1:{PORT}/live.jpg", flush=True)
    httpd.serve_forever()
