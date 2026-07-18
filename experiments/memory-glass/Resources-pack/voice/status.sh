#!/bin/bash
# Voice stack status
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
NOW=$(date +%s)
echo "voice dir: $DIR"
if [ -f "$DIR/bridge.pid" ] && kill -0 "$(cat "$DIR/bridge.pid")" 2>/dev/null; then
  echo "bridge: RUNNING pid=$(cat "$DIR/bridge.pid")"
else
  echo "bridge: STOPPED"
fi
if [ -f "$DIR/user.mute" ]; then
  END=$(cat "$DIR/user.mute" | cut -d. -f1)
  if [ "$NOW" -lt "${END:-0}" ]; then
    echo "user mute: ON (until $END)"
  else
    echo "user mute: expired file present"
  fi
else
  echo "user mute: OFF"
fi
if [ -f "$DIR/tts.mute" ]; then
  END=$(cat "$DIR/tts.mute" | cut -d. -f1)
  if [ "$NOW" -lt "${END:-0}" ]; then
    echo "tts mute window: ON (until $END)"
  else
    echo "tts mute window: idle"
  fi
fi
echo "inbox lines: $(wc -l < "$DIR/inbox.jsonl" 2>/dev/null || echo 0)"
echo "spoken lines: $(wc -l < "$DIR/spoken.log" 2>/dev/null || echo 0)"
echo "last heard: $(cat "$DIR/last.txt" 2>/dev/null || echo —)"
echo "model default: ggml-small.en (see voice-bridge.sh)"
