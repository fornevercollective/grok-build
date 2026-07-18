#!/bin/bash
# Memory Glass / GY speak — xAI TTS (voice_id + output_format) → headphones; fallback macOS say.
# Docs: https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
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
if [[ -z "$XAI_KEY" && -f "$HOME/.grok/xai_api_key" ]]; then
  XAI_KEY=$(tr -d ' \n' < "$HOME/.grok/xai_api_key")
fi
if [[ -z "$XAI_KEY" && -f "$HOME/.config/xai/api_key" ]]; then
  XAI_KEY=$(tr -d ' \n' < "$HOME/.config/xai/api_key")
fi

# voice_id: env > voice_id file > XAI_TTS_VOICE > Carina (user demo default)
VOICE_ID="${XAI_VOICE_ID:-}"
if [[ -z "$VOICE_ID" && -f "$DIR/voice_id" ]]; then
  VOICE_ID=$(tr -d ' \n' < "$DIR/voice_id")
fi
VOICE_ID="${VOICE_ID:-${XAI_TTS_VOICE:-Carina}}"
LANG="${XAI_TTS_LANG:-en}"
SAMPLE_RATE="${XAI_TTS_SAMPLE_RATE:-44100}"
BIT_RATE="${XAI_TTS_BIT_RATE:-128000}"

OUT="$DIR/tts-out.mp3"
ENGINE="say"
ok=0

if [[ -n "$XAI_KEY" ]]; then
  # Official payload shape (voice_id + output_format + language)
  PAYLOAD=$(python3 -c '
import json, sys
print(json.dumps({
  "text": sys.argv[1],
  "voice_id": sys.argv[2],
  "language": sys.argv[3],
  "output_format": {
    "codec": "mp3",
    "sample_rate": int(sys.argv[4]),
    "bit_rate": int(sys.argv[5]),
  },
}))
' "$CLEAN" "$VOICE_ID" "$LANG" "$SAMPLE_RATE" "$BIT_RATE")

  HTTP=$(curl -sS -o "$OUT" -w "%{http_code}" \
    -X POST "https://api.x.ai/v1/tts" \
    -H "Authorization: Bearer $XAI_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>"$DIR/tts.err" || echo "000")

  # Real MP3 starts with ID3 or 0xFFEx; JSON error bodies are "{"
  if [[ "$HTTP" == "200" ]] && [[ -s "$OUT" ]] && ! head -c 1 "$OUT" | grep -q '{'; then
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
    ERR_SNIP=$(head -c 180 "$OUT" 2>/dev/null | tr '\n' ' ')
    echo "TTS_FALLBACK http=${HTTP} voice=${VOICE_ID} ${ERR_SNIP}" >> "$DIR/bridge.log"
    # copy body to tts.err for debugging
    head -c 400 "$OUT" > "$DIR/tts.err" 2>/dev/null || true
  fi
fi

if [[ "$ok" -eq 0 ]]; then
  VOICE="${GY_SAY_VOICE:-Samantha}"
  say -v "$VOICE" "$CLEAN" 2>/dev/null || say "$CLEAN"
  ENGINE="say"
fi

echo "SPOKE $(date -u +%H:%M:%SZ) ${#CLEAN}c mute=${SECS}s engine=${ENGINE} voice=${VOICE_ID}"
