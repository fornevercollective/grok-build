#!/bin/bash
# Continuous face still-pipe — keeps AVFoundation open (no snapshot thrash / LED blink).
# Install: cp to ~/.panda/vision/capture-stream.sh && chmod +x
set -u
VISION="${GY_VISION_DIR:-$HOME/.panda/vision}"
OUT="${GY_VISION_STILL:-$VISION/live.jpg}"
DEV="${GY_CAM_INDEX:-0}"
FPS="${GY_STREAM_FPS:-4}"
SIZE="${GY_CAM_SIZE:-1280x720}"
mkdir -p "$VISION"
LOG="$VISION/capture-stream.log"
PIDF="$VISION/capture-stream.pid"

if [[ -f "$VISION/snap-loop.pid" ]]; then
  kill "$(cat "$VISION/snap-loop.pid")" 2>/dev/null || true
  rm -f "$VISION/snap-loop.pid"
fi

echo $$ > "$PIDF"
echo "capture-stream start · device=$DEV fps=$FPS size=$SIZE → $OUT" | tee -a "$LOG"

cleanup() {
  rm -f "$PIDF"
  echo "capture-stream stop $(date -u +%H:%M:%SZ)" >> "$LOG"
}
trap cleanup EXIT

while true; do
  rm -f "$VISION/live.tmp.jpg" 2>/dev/null || true
  ffmpeg -y -hide_banner -loglevel error \
    -f avfoundation \
    -framerate 30 \
    -video_size "$SIZE" \
    -i "$DEV" \
    -vf "fps=${FPS}" \
    -q:v 5 \
    -update 1 \
    "$OUT" >>"$LOG" 2>&1
  code=$?
  echo "capture-stream ffmpeg exit=$code · retry in 2s" >> "$LOG"
  sleep 2
done
