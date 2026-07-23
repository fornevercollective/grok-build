#!/usr/bin/env bash
# Always macOS say → Mini default output (headphones).
# Also: still-server /reply (phone chat + TTS m4a for phone loud speaker).
#
# Usage:
#   speak-local.sh "hello"
#   speak-local.sh --snap "here's what I see"
#   speak-local.sh --link URL "check this"
#   speak-local.sh --no-tts "text only, no phone audio file"
set -u
SNAP=0
LINK=""
TTS=1
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --snap|--snapshot|-s) SNAP=1; shift ;;
    --link) LINK="${2:-}"; shift 2 ;;
    --no-tts) TTS=0; shift ;;
    --) shift; ARGS+=("$@"); break ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
TEXT="${ARGS[*]:-}"
[[ -z "$TEXT" && "$SNAP" -eq 0 && -z "$LINK" ]] && exit 0
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
mkdir -p "$DIR" "$DIR/tts"
CLEAN=$(printf '%s' "$TEXT" | sed 's/`//g; s/\*\*//g' | head -c 900)
[[ -z "$CLEAN" && "$SNAP" -eq 1 ]] && CLEAN="snapshot"
python3 -c "import time; open('$DIR/tts.mute','w').write(str(time.time()+max(3,0.4*len('''$CLEAN'''.split())+1.5)))" 2>/dev/null || true
printf '%s\n' "$CLEAN" >> "$DIR/spoken.log"
# Prefer headphones if SwitchAudioSource exists
if command -v SwitchAudioSource >/dev/null 2>&1; then
  SwitchAudioSource -t output -s "External Headphones" 2>/dev/null || true
fi
# Log assistant turn for phone chat + server-side TTS (phone loud play)
python3 - "$CLEAN" "$SNAP" "$LINK" "$TTS" <<'PY' 2>/dev/null || true
import json, sys, urllib.request
text, snap, link, tts = sys.argv[1], sys.argv[2] == "1", (sys.argv[3] or "").strip(), sys.argv[4] != "0"
payload = {"text": text, "src": "speak-local", "tts": tts, "speak": tts}
if snap:
    payload["snapshot"] = True
if link:
    payload["link"] = link
req = urllib.request.Request(
    "http://127.0.0.1:9877/reply",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    urllib.request.urlopen(req, timeout=60).read()
except Exception:
    from pathlib import Path
    import time
    p = Path.home() / ".panda/voice/conversation.jsonl"
    row = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "epoch": int(time.time()),
        "role": "assistant",
        "text": text,
        "src": "speak-local",
        "kind": "snapshot" if snap else ("link" if link else "text"),
        "speak": True,
        "phone_loud": True,
    }
    if link:
        row["link"] = link
    with p.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
PY
# Local Mini loud speaker (headphones)
if [[ -n "$CLEAN" ]]; then
  say -v "${GY_SAY_VOICE:-Samantha}" "$CLEAN" 2>/dev/null || say "$CLEAN"
fi
echo "SPOKE_LOCAL $(date -u +%H:%M:%SZ) ${#CLEAN}c snap=$SNAP tts=$TTS"
