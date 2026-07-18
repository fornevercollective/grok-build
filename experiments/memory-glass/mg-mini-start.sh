#!/usr/bin/env bash
# Memory Glass · Mini / always-on start (research-friendly)
# Usage: bash mg-mini-start.sh [--with-still] [--with-cam]
set -euo pipefail

WITH_STILL=0
WITH_CAM=0
for a in "$@"; do
  case "$a" in
    --with-still) WITH_STILL=1 ;;
    --with-cam) WITH_CAM=1; WITH_STILL=1 ;;
  esac
done

APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
VISION="${GY_VISION_DIR:-$HOME/.panda/vision}"
VOICE="${HOME}/.panda/voice"

mkdir -p "$VISION" "$HOME/.panda/research" "$HOME/.panda/packs"

if [[ -x "$VOICE/mute.sh" ]]; then
  bash "$VOICE/mute.sh" on 2>/dev/null || true
fi

if [[ "$WITH_STILL" -eq 1 ]]; then
  if ! pgrep -f 'still-server.py' >/dev/null 2>&1; then
    STILL="${VISION}/still-server.py"
    if [[ ! -f "$STILL" && -f "$APP/Contents/Resources/vision/still-server.py" ]]; then
      STILL="$APP/Contents/Resources/vision/still-server.py"
    fi
    if [[ -f "$STILL" ]]; then
      MG_STILL_BIND="${MG_STILL_BIND:-0.0.0.0}" python3 "$STILL" >>"$VISION/still-server.log" 2>&1 &
      echo "still-server started (bind ${MG_STILL_BIND:-0.0.0.0})"
    fi
  else
    echo "still-server already running"
  fi
fi

if [[ "$WITH_CAM" -eq 1 ]]; then
  # single continuous writer only
  if pgrep -f 'snap-loop' >/dev/null 2>&1; then
    echo "WARN: snap-loop running — kill it to avoid LED thrash" >&2
  fi
  if ! pgrep -f 'capture-stream' >/dev/null 2>&1; then
    CS="${VISION}/capture-stream.sh"
    if [[ -x "$CS" ]]; then
      bash "$CS" >>"$VISION/capture-stream.log" 2>&1 &
      echo "capture-stream started"
    else
      echo "WARN: no capture-stream.sh at $CS" >&2
    fi
  fi
fi

if [[ -d "$APP" ]]; then
  open -n "$APP"
  echo "opened $APP"
else
  echo "ERROR: app missing — run: cd experiments/memory-glass && bash build-mac-app.sh" >&2
  exit 1
fi

echo "R1 tip: browse a page, set topic in inspect, ⌥⌘R to capture+export"
echo "queue: ~/.panda/research/queue.jsonl"
