#!/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${GY_VOICE_DIR:-$HOME/.panda/voice}"
mkdir -p "$DEST"
for f in speak.sh voice-bridge.sh mute.sh status.sh session-export.sh clone-voice.sh voice-sts.sh; do
  if [[ -f "$HERE/$f" ]]; then
    cp -f "$HERE/$f" "$DEST/$f"
    chmod +x "$DEST/$f"
    echo "installed $DEST/$f"
  fi
done
[[ -f "$HERE/DIAL_IN.md" ]] && cp -f "$HERE/DIAL_IN.md" "$DEST/sessions/DIAL_IN.md" 2>/dev/null || true
mkdir -p "$DEST/sessions"
echo "OK · voice scripts → $DEST (state files preserved)"
