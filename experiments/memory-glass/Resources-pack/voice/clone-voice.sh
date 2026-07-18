#!/bin/bash
# Clone a custom xAI voice (~2 min natural speech WAV) → saves voice_id for speak.sh
# Usage:
#   bash ~/.panda/voice/clone-voice.sh /path/to/reference.wav [name]
set -euo pipefail
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
mkdir -p "$DIR"
WAV="${1:-}"
NAME="${2:-MemoryGlass-$(whoami)}"

if [[ -z "$WAV" || ! -f "$WAV" ]]; then
  echo "usage: clone-voice.sh /path/to/reference.wav [name]" >&2
  echo "  record ~30–120s natural speech as WAV, then run this." >&2
  exit 2
fi

XAI_KEY="${XAI_API_KEY:-}"
if [[ -z "$XAI_KEY" && -f "$HOME/.xai_api_key" ]]; then
  XAI_KEY=$(tr -d ' \n' < "$HOME/.xai_api_key")
fi
if [[ -z "$XAI_KEY" ]]; then
  echo "ERR: set XAI_API_KEY" >&2
  exit 1
fi

echo "Cloning voice name=$NAME file=$WAV …"
RESP=$(curl -sS -X POST "https://api.x.ai/v1/custom-voices" \
  -H "Authorization: Bearer $XAI_KEY" \
  -F "name=$NAME" \
  -F "language=en" \
  -F "file=@${WAV};type=audio/wav")
echo "$RESP" | tee "$DIR/clone-last.json"

VOICE_ID=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("voice_id") or d.get("id") or "")' <<<"$RESP")
if [[ -z "$VOICE_ID" ]]; then
  echo "ERR: no voice_id in response" >&2
  exit 1
fi
printf '%s\n' "$VOICE_ID" > "$DIR/voice_id"
echo "OK voice_id=$VOICE_ID → $DIR/voice_id"
echo "speak.sh will use this clone automatically when XAI_API_KEY is set."
