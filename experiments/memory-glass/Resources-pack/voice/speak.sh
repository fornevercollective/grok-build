#!/bin/bash
# Memory Glass / GY speak — prefer xAI TTS (+ optional clone), fall back to macOS say.
# Always sets tts.mute window + spoken.log for echo filtering.
set -u
TEXT="${*:-}"
[[ -z "$TEXT" ]] && exit 0

DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
mkdir -p "$DIR"
CLEAN=$(printf '%s' "$TEXT" | sed 's/`//g; s/\*\*//g; s/##* //g' | head -c 1200)

# Mute STT while speaking
MUTE="$DIR/tts.mute"
WORDS=$(printf '%s' "$CLEAN" | wc -w | tr -d ' ')
SECS=$(python3 -c "print(max(2.8, min(22, 0.42*float('$WORDS')+1.6)))" 2>/dev/null || echo 4)
END=$(python3 -c "import time; print(time.time()+float('$SECS'))" 2>/dev/null || echo 0)
printf '%s\n' "$END" > "$MUTE"

# Echo filter log
printf '%s\n' "$CLEAN" >> "$DIR/spoken.log"
tail -n 24 "$DIR/spoken.log" > "$DIR/spoken.log.tmp" 2>/dev/null || true
mv -f "$DIR/spoken.log.tmp" "$DIR/spoken.log" 2>/dev/null || true

# Resolve API key
XAI_KEY="${XAI_API_KEY:-}"
if [[ -z "$XAI_KEY" && -f "$HOME/.xai_api_key" ]]; then
  XAI_KEY=$(tr -d ' \n' < "$HOME/.xai_api_key")
fi
if [[ -z "$XAI_KEY" && -f "$HOME/.config/xai/api_key" ]]; then
  XAI_KEY=$(tr -d ' \n' < "$HOME/.config/xai/api_key")
fi

# Voice: clone id file > env > named default
VOICE_ID="${XAI_VOICE_ID:-}"
if [[ -z "$VOICE_ID" && -f "$DIR/voice_id" ]]; then
  VOICE_ID=$(tr -d ' \n' < "$DIR/voice_id")
fi
# Named xAI voices if no clone (API may accept voice name or id)
TTS_VOICE="${VOICE_ID:-${XAI_TTS_VOICE:-}}"

OUT="$DIR/tts-out.mp3"
ENGINE="say"
ok=0

if [[ -n "$XAI_KEY" ]]; then
  # Build JSON payload
  if [[ -n "$TTS_VOICE" ]]; then
    PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"text":sys.argv[1],"voice":sys.argv[2]}))' "$CLEAN" "$TTS_VOICE")
  else
    # Some deployments accept text-only with a default voice
    PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"text":sys.argv[1]}))' "$CLEAN")
  fi
  HTTP=$(curl -sS -o "$OUT" -w "%{http_code}" \
    -X POST "https://api.x.ai/v1/tts" \
    -H "Authorization: Bearer $XAI_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>"$DIR/tts.err" || echo "000")
  if [[ "$HTTP" == "200" ]] && [[ -s "$OUT" ]]; then
    # play without blocking forever
    if command -v afplay >/dev/null 2>&1; then
      afplay "$OUT" 2>/dev/null &
      ENGINE="xai-tts"
      ok=1
    elif command -v ffplay >/dev/null 2>&1; then
      ffplay -nodisp -autoexit -loglevel quiet "$OUT" 2>/dev/null &
      ENGINE="xai-tts"
      ok=1
    fi
  else
    echo "TTS_FALLBACK http=${HTTP} $(head -c 120 "$DIR/tts.err" 2>/dev/null)" >> "$DIR/bridge.log"
  fi
fi

if [[ "$ok" -eq 0 ]]; then
  VOICE="${GY_SAY_VOICE:-Samantha}"
  say -v "$VOICE" "$CLEAN" 2>/dev/null || say "$CLEAN"
  ENGINE="say"
fi

echo "SPOKE $(date -u +%H:%M:%SZ) ${#CLEAN}c mute=${SECS}s engine=${ENGINE} voice=${TTS_VOICE:-macOS}"
