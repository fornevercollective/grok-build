#!/usr/bin/env bash
# Phone transcript → Grok chat → speak on Mini default output (headphones).
# Usage: bash ~/.panda/voice/chat-voice.sh
set -u
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
mkdir -p "$DIR"
INBOX="$DIR/inbox.jsonl"
OFFSET="$DIR/chat-offset"
LOG="$DIR/chat-voice.log"
HIST="$DIR/chat-history.jsonl"
touch "$INBOX" "$LOG" "$HIST"
[[ -f "$OFFSET" ]] || echo 0 > "$OFFSET"

# Load keys
XAI_KEY="${XAI_API_KEY:-}"
if [[ -z "$XAI_KEY" && -f "$HOME/.xai_api_key" ]]; then XAI_KEY=$(tr -d ' \n' < "$HOME/.xai_api_key"); fi
if [[ -z "$XAI_KEY" && -f "$HOME/.grok/xai_api_key" ]]; then XAI_KEY=$(tr -d ' \n' < "$HOME/.grok/xai_api_key"); fi
if [[ -z "$XAI_KEY" && -f "$HOME/.config/xai/api_key" ]]; then XAI_KEY=$(tr -d ' \n' < "$HOME/.config/xai/api_key"); fi
if [[ -z "$XAI_KEY" && -f "$DIR/env.sh" ]]; then
  # shellcheck disable=SC1090
  source "$DIR/env.sh" 2>/dev/null || true
  XAI_KEY="${XAI_API_KEY:-$XAI_KEY}"
fi

SPEAK="${DIR}/speak.sh"
if [[ ! -x "$SPEAK" ]]; then
  SPEAK="$HOME/Applications/Memory Glass.app/Contents/Resources/voice/speak.sh"
fi
if [[ ! -x "$SPEAK" ]]; then
  SPEAK="/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass/Resources-pack/voice/speak.sh"
fi

log() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$LOG"; }

# Ensure default output is headphones if available (macOS)
route_headphones() {
  if command -v SwitchAudioSource >/dev/null 2>&1; then
    SwitchAudioSource -t output -s "External Headphones" 2>/dev/null \
      || SwitchAudioSource -t output -s "Headphones" 2>/dev/null \
      || true
  fi
}

speak() {
  local text="$1"
  route_headphones
  if [[ -x "$SPEAK" ]]; then
    bash "$SPEAK" "$text" >>"$LOG" 2>&1 || true
  else
    # mute window for echo
    python3 -c "import time; open('$DIR/tts.mute','w').write(str(time.time()+6))" 2>/dev/null || true
    printf '%s\n' "$text" >> "$DIR/spoken.log"
    say "$text" 2>/dev/null || true
  fi
}

grok_reply() {
  local user="$1"
  if [[ -z "$XAI_KEY" ]]; then
    printf '%s' "I heard you say: ${user}. Plug an xAI API key for full Grok chat."
    return
  fi
  # Prefer current flagship; override with MG_CHAT_MODEL
  local model="${MG_CHAT_MODEL:-grok-4.5}"
  python3 - "$user" "$XAI_KEY" "$HIST" "$model" <<'PY'
import json, sys, urllib.request, urllib.error, pathlib
user, key, hist_path, model = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3]), sys.argv[4]
messages = [
    {"role": "system", "content": (
        "You are Grok on a Mac Mini in a Memory Glass lab. "
        "User speaks via phone; your voice plays on Mini headphones. "
        "Keep replies short (1-3 sentences) for speech."
    )}
]
if hist_path.exists():
    lines = hist_path.read_text(errors="replace").strip().splitlines()[-8:]
    for line in lines:
        try:
            messages.append(json.loads(line))
        except Exception:
            pass
messages.append({"role": "user", "content": user})
body = json.dumps({
    "model": model,
    "messages": messages,
    "temperature": 0.7,
    "max_tokens": 180,
}).encode()
req = urllib.request.Request(
    "https://api.x.ai/v1/chat/completions",
    data=body,
    headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=45) as r:
        data = json.loads(r.read().decode())
    text = data["choices"][0]["message"]["content"].strip()
except urllib.error.HTTPError as e:
    raw = e.read().decode("utf-8", errors="replace")
    try:
        err = json.loads(raw)
        msg = err.get("error") or err.get("code") or raw
    except Exception:
        msg = raw
    if e.code == 403 and ("credit" in msg.lower() or "spending" in msg.lower() or "permission" in msg.lower()):
        text = (
            "xAI credits are empty or monthly spend limit is hit. "
            "Top up at console.x.ai, then try again. "
            f"I still heard: {user}"
        )
    elif e.code == 404 or "not found" in msg.lower():
        text = f"Chat model {model} unavailable. Set MG_CHAT_MODEL. Detail: {msg[:120]}"
    else:
        text = f"Chat HTTP {e.code}: {msg[:160]}"
except Exception as e:
    text = f"Chat error: {e}"
with hist_path.open("a") as f:
    f.write(json.dumps({"role": "user", "content": user}) + "\n")
    f.write(json.dumps({"role": "assistant", "content": text}) + "\n")
print(text)
PY
}

MODEL="${MG_CHAT_MODEL:-grok-4.5}"
log "chat-voice start · inbox=$INBOX · key=$([[ -n $XAI_KEY ]] && echo yes || echo no) · model=$MODEL · speak=$SPEAK"
route_headphones
# Quiet boot: short beep via say only if MG_CHAT_ANNOUNCE=1
if [[ "${MG_CHAT_ANNOUNCE:-0}" == "1" ]]; then
  speak "Memory Glass voice is live on headphones. Talk on your phone."
fi

# Follow inbox from end (only new lines after start, unless MG_CHAT_REPLAY=1)
if [[ "${MG_CHAT_REPLAY:-0}" != "1" ]]; then
  wc -c < "$INBOX" | tr -d ' ' > "$OFFSET"
fi

while true; do
  # user mute
  if [[ -f "$DIR/user.mute" ]]; then
    END=$(cut -d. -f1 < "$DIR/user.mute" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    if [[ -n "$END" && "$NOW" -lt "$END" ]]; then
      sleep 0.5
      continue
    fi
  fi

  OFF=$(cat "$OFFSET" 2>/dev/null || echo 0)
  SIZE=$(wc -c < "$INBOX" | tr -d ' ')
  if [[ "$SIZE" -lt "$OFF" ]]; then
    OFF=0
  fi
  if [[ "$SIZE" -gt "$OFF" ]]; then
    # read new bytes as lines
    NEW=$(dd if="$INBOX" bs=1 skip="$OFF" 2>/dev/null || true)
    printf '%s' "$SIZE" > "$OFFSET"
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      TEXT=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("text",""))' "$line" 2>/dev/null || true)
      [[ -z "$TEXT" ]] && continue
      log "USER $TEXT"
      REPLY=$(grok_reply "$TEXT")
      log "GROK $REPLY"
      speak "$REPLY"
    done <<< "$NEW"
  fi
  sleep 0.35
done
