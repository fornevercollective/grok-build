#!/bin/bash
# Mute / pause voice STT so terminal agents stop acting on mic / TTS echo.
# Usage:
#   mute.sh              # mute until unmute
#   mute.sh 60           # mute for 60 seconds
#   mute.sh off|unmute   # unmute now
set -u
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
mkdir -p "$DIR"
MUTE="$DIR/user.mute"
TTS_MUTE="$DIR/tts.mute"
ARG="${1:-on}"

case "$ARG" in
  off|unmute|0|false|no)
    rm -f "$MUTE"
    # clear TTS mute window too
    printf '0\n' > "$TTS_MUTE"
    echo "VOICE_UNMUTE $(date -u +%H:%M:%SZ)"
    echo "VOICE_UNMUTE $(date -u +%H:%M:%SZ)" >> "$DIR/bridge.log"
    ;;
  on|mute|true|yes)
    # far-future = mute forever until unmute
    echo "9999999999" > "$MUTE"
    echo "VOICE_MUTE indefinite $(date -u +%H:%M:%SZ)"
    echo "VOICE_MUTE indefinite" >> "$DIR/bridge.log"
    ;;
  *)
    # numeric seconds
    if printf '%s' "$ARG" | grep -Eq '^[0-9]+$'; then
      END=$(python3 -c "import time; print(int(time.time())+int('$ARG'))")
      echo "$END" > "$MUTE"
      echo "VOICE_MUTE ${ARG}s until $END ($(date -u -r "$END" +%H:%M:%SZ 2>/dev/null || echo epoch))"
      echo "VOICE_MUTE ${ARG}s end=$END" >> "$DIR/bridge.log"
    else
      echo "usage: mute.sh [on|off|SECONDS]" >&2
      exit 2
    fi
    ;;
esac
