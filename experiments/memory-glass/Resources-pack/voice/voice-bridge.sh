#!/bin/bash
# Hands-free: record short clips → whisper-cli → ~/.panda/voice/inbox.jsonl
# Prints USER_SAID lines for Grok Build monitor events (no typing).
# Dial-in v2 — tightened from sessions/latest.md false positives.
set -u
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
[[ -f "$DIR/env.sh" ]] && source "$DIR/env.sh"
MODEL="${WHISPER_MODEL:-$HOME/models/audio/whisper/ggml/ggml-small.en.bin}"
BIN="${WHISPER_BIN:-whisper-cli}"
CLIP_SEC="${GY_VOICE_CLIP_SEC:-3.5}"
MIC="${GY_MIC_INDEX:-0}"
INBOX="$DIR/inbox.jsonl"
LAST="$DIR/last.txt"
LOG="$DIR/bridge.log"
mkdir -p "$DIR"
touch "$INBOX"

if ! command -v "$BIN" >/dev/null 2>&1; then
  echo "ERR whisper-cli missing" | tee -a "$LOG"
  exit 1
fi
if [[ ! -f "$MODEL" ]]; then
  for m in \
    "$HOME/models/audio/whisper/ggml/ggml-large-v3-turbo-q5_0.bin" \
    "$HOME/models/audio/whisper/ggml/ggml-small.en.bin" \
    "$HOME/models/audio/whisper/ggml/ggml-base.en.bin" \
    "$HOME/models/whisper/ggml-base.en.bin"
  do
    if [[ -f "$m" ]]; then
      MODEL="$m"
      break
    fi
  done
fi

echo "voice-bridge start · clip=${CLIP_SEC}s mic=$MIC model=$(basename "$MODEL") dial-in=v2" | tee -a "$LOG"

# is_noise: return 0 = DROP, 1 = keep
is_noise() {
  local raw t words
  raw=$(printf '%s' "$1" | xargs)
  t=$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 '"'"']//g' | xargs)
  if [[ -z "$t" ]]; then
    return 0
  fi

  # bracket / paren whisper tags: [BLANK_AUDIO] (dramatic music)
  if [[ "$raw" == \[*\] ]] || [[ "$raw" == \(*\) ]]; then
    return 0
  fi
  if printf '%s' "$raw" | grep -Eqi '^\[[[:alnum:] _.-]+\]$|^\([^)]+\)$'; then
    return 0
  fi

  # known whisper hallucinations / media tags (from latest.md dial-in)
  case "$t" in
    blankaudio|blank|silence|inaudible|music|applause|laughter|cough| \
    blank\ audio|dramatic\ music|dramaticmusic|subtitle|subtitles|transcript| \
    thank\ you\ for\ watching|please\ subscribe|thanks\ for\ watching)
      return 0
      ;;
  esac
  if printf '%s' "$t" | grep -Eqi 'blank.?audio|dramatic music|applause|laughter|subtitle|\[music\]|\(music\)'; then
    return 0
  fi

  # TTS echo / agent self-talk (heard back through speakers)
  if printf '%s' "$t" | grep -Eqi \
    'angry glasses|memory glass live|i hear you|hot pipe stable|what should we change|using local detection|mesh markers|splats should fill|i see you on camera|grabbing the screen'; then
    return 0
  fi
  # "Grock" mis-hear of Grok when echoing TTS
  if printf '%s' "$t" | grep -Eqi '^hey grock|^hey grok\.?$|grock in the|grock build'; then
    return 0
  fi

  # pure fillers / single tokens
  case "$t" in
    you|the|a|um|uh|mm|hmm|thanks|bye|okay|ok|yeah|yes|no|mhm|ah|oh| \
    indo|and|to|so|in|on|of|is|it|me|my|we|do|be)
      return 0
      ;;
  esac

  # very short
  if [[ ${#t} -lt 4 ]]; then
    return 0
  fi

  # single short word under 5 chars
  words=$(printf '%s' "$t" | wc -w | tr -d ' ')
  if [[ "$words" -eq 1 ]] && [[ ${#t} -lt 5 ]]; then
    return 0
  fi

  # 1–2 word noise that was common false positive
  case "$t" in
    "i dont know"|"i do not know"|"thank you"|"thanks you"|"mm hmm"|"uh huh")
      # keep "i don't know" as real speech sometimes — only drop if very short session spam
      if [[ "$t" == "thank you" || "$t" == "thanks you" || "$t" == "mm hmm" || "$t" == "uh huh" ]]; then
        return 0
      fi
      ;;
  esac

  return 1
}

# fuzzy echo vs spoken.log (token Jaccard-ish)
is_echo() {
  local text="$1"
  [[ -f "$DIR/spoken.log" ]] || return 1
  python3 - "$DIR/spoken.log" "$text" <<'PY' 2>/dev/null
import sys, re
from pathlib import Path
log = Path(sys.argv[1]).read_text(errors="replace").lower()
t = re.sub(r"[^a-z0-9 ]+", " ", sys.argv[2].lower()).strip()
if not t or len(t) < 8:
    raise SystemExit(1)
if t in log:
    raise SystemExit(0)
# partial: 12+ char substrings of recent lines
for line in log.splitlines():
    line = line.strip()
    if len(line) < 12:
        continue
    if line in t or t in line:
        raise SystemExit(0)
    # shared long words
    tw = set(w for w in t.split() if len(w) > 4)
    lw = set(w for w in line.split() if len(w) > 4)
    if tw and lw and len(tw & lw) >= max(2, min(len(tw), len(lw)) // 2):
        raise SystemExit(0)
raise SystemExit(1)
PY
}

while true; do
  # User mute first — save CPU while muted
  USER_MUTE="$DIR/user.mute"
  if [[ -f "$USER_MUTE" ]]; then
    NOW=$(date +%s)
    END=$(cat "$USER_MUTE" 2>/dev/null | cut -d. -f1)
    if [[ -n "${END:-}" ]] && [[ "$NOW" -lt "${END:-0}" ]]; then
      sleep 0.8
      continue
    fi
  fi
  # TTS mute window
  MUTE="$DIR/tts.mute"
  if [[ -f "$MUTE" ]]; then
    NOW=$(date +%s)
    END=$(cat "$MUTE" 2>/dev/null | cut -d. -f1)
    if [[ -n "${END:-}" ]] && [[ "$NOW" -lt "${END:-0}" ]]; then
      sleep 0.4
      continue
    fi
  fi

  WAV="$DIR/clip.wav"
  if ! ffmpeg -y -hide_banner -loglevel error \
    -f avfoundation -i ":$MIC" \
    -t "$CLIP_SEC" -ac 1 -ar 16000 -c:a pcm_s16le "$WAV" 2>>"$LOG"; then
    echo "VOICE_ERR ffmpeg mic=$MIC"
    sleep 1
    continue
  fi

  OUT_BASE="$DIR/clip"
  rm -f "$OUT_BASE.txt" "$OUT_BASE.json" 2>/dev/null || true
  "$BIN" -m "$MODEL" -f "$WAV" -otxt -of "$OUT_BASE" -nt -np 2>>"$LOG" || true
  TEXT=""
  if [[ -f "$OUT_BASE.txt" ]]; then
    TEXT=$(tr '\n' ' ' < "$OUT_BASE.txt" | sed 's/[[:space:]]\{1,\}/ /g; s/^ //; s/ $//')
  fi
  if is_noise "$TEXT"; then
    continue
  fi
  if is_echo "$TEXT"; then
    continue
  fi
  # re-check mute after STT (TTS may have started mid-clip)
  if [[ -f "$USER_MUTE" ]]; then
    NOW=$(date +%s)
    END=$(cat "$USER_MUTE" 2>/dev/null | cut -d. -f1)
    if [[ -n "${END:-}" ]] && [[ "$NOW" -lt "${END:-0}" ]]; then
      continue
    fi
  fi
  if [[ -f "$MUTE" ]]; then
    NOW=$(date +%s)
    END=$(cat "$MUTE" 2>/dev/null | cut -d. -f1)
    if [[ -n "${END:-}" ]] && [[ "$NOW" -lt "${END:-0}" ]]; then
      continue
    fi
  fi
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  EPOCH=$(date +%s)
  if [[ -f "$LAST" ]] && [[ "$(cat "$LAST")" == "$TEXT" ]]; then
    continue
  fi
  printf '%s\n' "$TEXT" > "$LAST"
  LINE=$(python3 -c 'import json,sys; print(json.dumps({"ts":sys.argv[1],"epoch":int(sys.argv[2]),"text":sys.argv[3],"src":"voice-bridge"}))' "$TS" "$EPOCH" "$TEXT")
  printf '%s\n' "$LINE" >> "$INBOX"
  echo "USER_SAID $TEXT"
  echo "USER_SAID $TEXT" >> "$LOG"
done
