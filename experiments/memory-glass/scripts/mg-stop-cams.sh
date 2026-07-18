#!/usr/bin/env bash
# Stop still-server + capture-stream + snap-loop + related ffmpeg.
# Safe: kills by PID from ps, not pkill -f (avoids self-match).
set -u
python3 - <<'PY'
import os, signal, subprocess, time
out = subprocess.check_output(["ps", "-axo", "pid=,command="], text=True, errors="replace")
me = os.getpid()
killed = []
for line in out.splitlines():
    line = line.strip()
    if not line:
        continue
    parts = line.split(None, 1)
    if len(parts) < 2:
        continue
    try:
        pid = int(parts[0])
    except ValueError:
        continue
    cmd = parts[1]
    if pid == me:
        continue
    hit = any(
        x in cmd
        for x in (
            "still-server.py",
            "capture-stream.sh",
            "snap-loop",
            "snap-fast",
            "capture-gentle",
            "mjpeg-server",
        )
    )
    if "ffmpeg" in cmd and any(
        x in cmd for x in ("live.jpg", "avfoundation", "glass.jpg", "screen.jpg", "inspect.jpg")
    ):
        hit = True
    if not hit:
        continue
    try:
        os.kill(pid, signal.SIGTERM)
        killed.append(pid)
        print(f"SIGTERM {pid}")
    except ProcessLookupError:
        pass
time.sleep(0.5)
for pid in killed:
    try:
        os.kill(pid, signal.SIGKILL)
        print(f"SIGKILL {pid}")
    except ProcessLookupError:
        pass
print(f"done · signaled {len(killed)} pid(s)")
PY
rm -f "${GY_VISION_DIR:-$HOME/.panda/vision}/capture-stream.pid" \
  "${GY_VISION_DIR:-$HOME/.panda/vision}/snap-loop.pid" \
  "${GY_VISION_DIR:-$HOME/.panda/vision}/capture-gentle.pid" 2>/dev/null || true
echo "cam stop complete"
