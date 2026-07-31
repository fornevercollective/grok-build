#!/usr/bin/env python3
"""HTTP MJPEG mix server + ffmpeg reader (+ optional ffplay).

Env:
  MIX_PORT, MIX_SNAP, MIX_STREAM_URL, MIX_CHANNEL, MIX_PAGE, MIX_STATE,
  MIX_LOG, MIX_FFPLAY, MIX_TITLE
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("MIX_PORT", "8790"))
SNAP = Path(os.environ.get("MIX_SNAP", str(Path.home() / ".panda/vision/cast/mix-latest.jpg")))
STREAM = os.environ["MIX_STREAM_URL"]
CHANNEL = os.environ.get("MIX_CHANNEL", "live")
PAGE = os.environ.get("MIX_PAGE", "")
STATE = Path(os.environ.get("MIX_STATE", str(Path.home() / ".panda/vision/cast/mix-pipe.json")))
MASK = Path(os.environ.get("MIX_MASK", str(SNAP.parent / "mix-mask.png")))
REGIONS = Path(os.environ.get("MIX_REGIONS", str(SNAP.parent / "mix-regions.json")))
FFPLAY = os.environ.get("MIX_FFPLAY", "1").lower() not in ("0", "false", "no")
TITLE = os.environ.get("MIX_TITLE", f"pop-out · /watch · {CHANNEL} · mix-pipe")
# Update occlusion mask every N mix frames (person/SAM is slower than 15 fps).
MASK_EVERY = max(1, int(os.environ.get("MIX_MASK_EVERY", "8")))

latest: dict = {
    "jpeg": None,
    "t": 0.0,
    "frames": 0,
    "err": "",
    "mask_meta": {},
}
lock = threading.Lock()
stop = threading.Event()
children: list[subprocess.Popen] = []

# Import layout helper (same directory)
import sys

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
try:
    from broadcast_layout import update_masks_from_jpeg  # type: ignore
except Exception:
    update_masks_from_jpeg = None  # type: ignore


def write_state(**extra) -> None:
    body = {
        "schema": "fc-mix-pipe-v1",
        "ok": True,
        "channel": CHANNEL,
        "page": PAGE,
        "port": PORT,
        "mix_mjpg": f"http://127.0.0.1:{PORT}/mix.mjpg",
        "mix_jpg": f"http://127.0.0.1:{PORT}/mix.jpg",
        "mask_png": f"http://127.0.0.1:{PORT}/mask.png",
        "regions_json": f"http://127.0.0.1:{PORT}/regions.json",
        "ffplay": FFPLAY,
        "frames": latest["frames"],
        "t": time.time(),
        "mask_meta": latest.get("mask_meta") or {},
        **extra,
    }
    try:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(body, indent=2) + "\n")
    except OSError:
        pass


def spawn_ffmpeg() -> subprocess.Popen:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "2",
        "-i",
        STREAM,
        "-an",
        "-vf",
        "fps=15,scale=960:-2:flags=fast_bilinear",
        "-q:v",
        "7",
        "-f",
        "mjpeg",
        "pipe:1",
    ]
    p = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.DEVNULL,
    )
    children.append(p)
    return p


def spawn_ffplay() -> subprocess.Popen | None:
    if not FFPLAY:
        return None
    cmd = [
        "ffplay",
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-framedrop",
        "-window_title",
        TITLE,
        "-x",
        "960",
        "-y",
        "540",
        STREAM,
    ]
    p = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    children.append(p)
    return p


def reader(p: subprocess.Popen) -> None:
    assert p.stdout is not None
    buf = b""
    soi, eoi = b"\xff\xd8", b"\xff\xd9"
    while not stop.is_set():
        chunk = p.stdout.read(65536)
        if not chunk:
            if p.poll() is not None:
                err = b""
                if p.stderr:
                    err = p.stderr.read() or b""
                latest["err"] = f"ffmpeg exit {p.returncode} {err[:200]!r}"
                break
            time.sleep(0.01)
            continue
        buf += chunk
        while True:
            i = buf.find(soi)
            if i < 0:
                buf = buf[-2:]
                break
            j = buf.find(eoi, i + 2)
            if j < 0:
                buf = buf[i:]
                break
            jpeg = buf[i : j + 2]
            buf = buf[j + 2 :]
            n = 0
            with lock:
                latest["jpeg"] = jpeg
                latest["t"] = time.time()
                latest["frames"] = int(latest["frames"]) + 1
                n = int(latest["frames"])
            try:
                SNAP.parent.mkdir(parents=True, exist_ok=True)
                SNAP.write_bytes(jpeg)
            except OSError:
                pass
            # Person / layout mask every N frames (broadcast occlusion)
            if update_masks_from_jpeg and n % MASK_EVERY == 1:
                try:
                    meta = update_masks_from_jpeg(
                        jpeg, SNAP, MASK, REGIONS, w=960, h=540
                    )
                    with lock:
                        latest["mask_meta"] = meta
                except Exception as e:
                    with lock:
                        latest["mask_meta"] = {"err": str(e)}
    write_state(err=str(latest.get("err") or ""))


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):  # noqa: ARG002
        return

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_HEAD(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in (
            "/mix.jpg",
            "/mix.jpeg",
            "/snapshot.jpg",
            "/mix.mjpg",
            "/status.json",
            "/",
            "/mask.png",
            "/regions.json",
        ):
            self.send_response(200)
            self._cors()
            if "mix.jpg" in path or path.endswith(".jpeg"):
                self.send_header("Content-Type", "image/jpeg")
            elif path.endswith(".png"):
                self.send_header("Content-Type", "image/png")
            elif path.endswith(".json"):
                self.send_header("Content-Type", "application/json")
            self.end_headers()
            return
        self.send_response(404)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/", "/status", "/status.json"):
            write_state()
            body = STATE.read_bytes() if STATE.is_file() else b"{}"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path in ("/mix.jpg", "/mix.jpeg", "/snapshot.jpg"):
            with lock:
                jpeg = latest["jpeg"]
            if not jpeg and SNAP.is_file():
                jpeg = SNAP.read_bytes()
            if not jpeg:
                self.send_response(503)
                self._cors()
                self.end_headers()
                self.wfile.write(b"no frame yet")
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self._cors()
            self.send_header("Content-Length", str(len(jpeg)))
            self.end_headers()
            self.wfile.write(jpeg)
            return
        if path in ("/mask.png", "/mask"):
            if not MASK.is_file():
                self.send_response(503)
                self._cors()
                self.end_headers()
                self.wfile.write(b"no mask yet")
                return
            body = MASK.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path in ("/regions.json", "/regions"):
            if not REGIONS.is_file():
                # always synthesize defaults
                try:
                    from broadcast_layout import write_regions  # type: ignore

                    write_regions(REGIONS, 960, 540)
                except Exception:
                    self.send_response(503)
                    self._cors()
                    self.end_headers()
                    return
            body = REGIONS.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path in ("/mix.mjpg", "/mix.mjpeg", "/stream.mjpg"):
            self.send_response(200)
            self.send_header(
                "Content-Type", "multipart/x-mixed-replace; boundary=frame"
            )
            self._cors()
            self.end_headers()
            try:
                last = 0
                while not stop.is_set():
                    with lock:
                        jpeg = latest["jpeg"]
                        n = int(latest["frames"])
                    if jpeg and n != last:
                        last = n
                        header = (
                            b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                            + str(len(jpeg)).encode()
                            + b"\r\n\r\n"
                        )
                        self.wfile.write(header + jpeg + b"\r\n")
                        self.wfile.flush()
                    else:
                        time.sleep(0.03)
            except (BrokenPipeError, ConnectionResetError):
                return
            return
        self.send_response(404)
        self.end_headers()


def main() -> None:
    SNAP.parent.mkdir(parents=True, exist_ok=True)
    ff = spawn_ffmpeg()
    threading.Thread(target=reader, args=(ff,), daemon=True).start()
    fp = spawn_ffplay()
    write_state(
        ffmpeg_pid=ff.pid,
        ffplay_pid=(fp.pid if fp else None),
        stream_head=STREAM[:96],
    )

    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), H)

    def shutdown(*_a) -> None:
        stop.set()
        for c in children:
            try:
                c.terminate()
            except Exception:
                pass
        try:
            httpd.shutdown()
        except Exception:
            pass

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    print(
        f"mix-pipe listening http://127.0.0.1:{PORT}/mix.mjpg channel={CHANNEL}",
        flush=True,
    )
    try:
        httpd.serve_forever()
    finally:
        shutdown()
        for c in children:
            try:
                c.wait(timeout=2)
            except Exception:
                try:
                    c.kill()
                except Exception:
                    pass


if __name__ == "__main__":
    main()
