#!/usr/bin/env bash
# Memory Glass · overnight sandboxed soak
# Usage: bash scripts/overnight-soak.sh [--hours 8] [--url URL]
#
# Offline LLM morning brief (optional):
#   MG_LOCAL_LLM=1 bash scripts/overnight-soak.sh --hours 8
# Models (Ollama): MG_OLLAMA_MODEL=qwen3:8b  MG_OLLAMA_REASON_MODEL=deepseek-r1:7b
set -u
HOURS="${MG_SOAK_HOURS:-8}"
URL="${MG_SOAK_URL:-https://www.spacex.com/}"
SOAK_ROOT="${MG_SOAK_DIR:-$HOME/.panda/mg-soak}"
STILL="${MG_STILL_URL:-http://127.0.0.1:9877}"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOTPIPE="${MG_HOTPIPE:-}"
if [[ -z "$HOTPIPE" ]]; then
  if [[ -d "$APP/Contents/Resources/hotpipe" ]]; then
    HOTPIPE="$APP/Contents/Resources/hotpipe"
  else
    HOTPIPE="$(cd "$SCRIPT_DIR/.." && pwd)/hotpipe"
  fi
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours) HOURS="${2:-8}"; shift 2 ;;
    --url) URL="${2:-}"; shift 2 ;;
    --dir) SOAK_ROOT="${2:-}"; shift 2 ;;
    --local-llm) export MG_LOCAL_LLM=1; shift ;;
    *) shift ;;
  esac
done

EPOCH=$(date +%s)
RUN="$SOAK_ROOT/run-$EPOCH"
mkdir -p "$RUN/screenshots"
LOG="$RUN/soak.jsonl"
SUMMARY="$RUN/summary.md"
# support fractional hours (e.g. 0.05 ≈ 3 min)
END=$(python3 -c "print(int($EPOCH + float('$HOURS') * 3600))" 2>/dev/null || echo $((EPOCH + 3600)))
# minimum 90s for smoke runs
if [[ $END -le $((EPOCH + 89)) ]]; then END=$((EPOCH + 90)); fi
START_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

log() {
  local kind="$1"; shift
  printf '{"ts":"%s","kind":"%s","msg":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$kind" \
    "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$*")" \
    >>"$LOG"
}

rss_mb() {
  local p
  p=$(pgrep -f 'Memory Glass.app/Contents/MacOS/memory-glass' 2>/dev/null | head -1 || true)
  if [[ -z "$p" ]]; then echo 0; return; fi
  ps -o rss= -p "$p" 2>/dev/null | awk '{printf "%.1f", $1/1024}'
}

alive() {
  pgrep -f 'Memory Glass.app/Contents/MacOS/memory-glass' >/dev/null 2>&1
}

health() {
  curl -sS -m 2 "$STILL/health" 2>/dev/null || echo '{"ok":false}'
}

launch_mg() {
  if alive; then return 0; fi
  open -n "$APP" --args "$URL" 2>/dev/null || open "$APP" --args "$URL"
  sleep 2
  if alive; then log launch "ok rss=$(rss_mb)"; else log launch "FAIL"; fi
}

kill_mg() {
  pgrep -f 'Memory Glass.app/Contents/MacOS/memory-glass' 2>/dev/null | while read -r p; do
    kill "$p" 2>/dev/null || true
  done
  sleep 1
  pgrep -f 'Memory Glass.app/Contents/MacOS/memory-glass' 2>/dev/null | while read -r p; do
    kill -9 "$p" 2>/dev/null || true
  done
}

# ensure still-server if possible
if ! curl -sS -m 1 "$STILL/health" >/dev/null 2>&1; then
  if [[ -x "$HOME/.panda/vision/still-server.py" ]]; then
    MG_STILL_BIND="${MG_STILL_BIND:-127.0.0.1}" nohup python3 "$HOME/.panda/vision/still-server.py" \
      >>"$RUN/still-server.log" 2>&1 &
    sleep 1
    log still "started"
  else
    log still "not available"
  fi
fi

log start "hours=$HOURS url=$URL app=$APP"
launch_mg

TICK=0
INJECT_EVERY=$((5 * 60)) # seconds
RELAUNCH_EVERY=$((20 * 60))
LAST_INJECT=0
LAST_RELAUNCH=$EPOCH
CRASHES=0
HEALTH_OK=0
HEALTH_N=0
RSS_MAX=0
RSS_MIN=999999

while [[ $(date +%s) -lt $END ]]; do
  NOW=$(date +%s)
  TICK=$((TICK + 1))
  if ! alive; then
    CRASHES=$((CRASHES + 1))
    log crash "unexpected dead; relaunch #$CRASHES"
    launch_mg
  fi
  R=$(rss_mb)
  # bash float compare via awk
  RSS_MAX=$(awk -v a="$RSS_MAX" -v b="$R" 'BEGIN{print (b+0>a+0)?b:a}')
  if [[ "$R" != "0" ]]; then
    RSS_MIN=$(awk -v a="$RSS_MIN" -v b="$R" 'BEGIN{print (b+0<a+0)?b:a}')
  fi
  H=$(health)
  HEALTH_N=$((HEALTH_N + 1))
  if echo "$H" | grep -q '"ok": true\|"ok":true'; then
    HEALTH_OK=$((HEALTH_OK + 1))
  fi
  log tick "rss_mb=$R health=$(echo "$H" | head -c 120)"

  # hot-pipe touch inject pressure
  if [[ $((NOW - LAST_INJECT)) -ge $INJECT_EVERY ]]; then
    if [[ -f "$HOTPIPE/live.js" ]]; then
      touch "$HOTPIPE/live.js"
      log inject "touched live.js"
    fi
    LAST_INJECT=$NOW
  fi

  # periodic relaunch thrash (after first 30m)
  if [[ $((NOW - EPOCH)) -gt 1800 && $((NOW - LAST_RELAUNCH)) -ge $RELAUNCH_EVERY ]]; then
    log relaunch "scheduled thrash"
    kill_mg
    sleep 2
    launch_mg
    LAST_RELAUNCH=$NOW
  fi

  sleep 30
done

kill_mg
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
HEALTH_PCT=0
if [[ $HEALTH_N -gt 0 ]]; then
  HEALTH_PCT=$(awk -v o="$HEALTH_OK" -v n="$HEALTH_N" 'BEGIN{printf "%.1f", 100*o/n}')
fi

cat >"$SUMMARY" <<EOF
# MG overnight soak summary

| | |
|--|--|
| Start | $START_ISO |
| End | $END_ISO |
| Hours | $HOURS |
| URL | $URL |
| Unexpected deaths / relaunches | $CRASHES |
| Health samples OK | $HEALTH_OK / $HEALTH_N ($HEALTH_PCT%) |
| RSS min / max (MB) | $RSS_MIN / $RSS_MAX |
| Log | \`$LOG\` |

## Morning checklist
- [ ] Read soak.jsonl for crash storms
- [ ] Compare RSS_MAX − RSS_MIN slope
- [ ] Confirm hot-pipe inject lines present
- [ ] Update plans/COMPETITIVE_HARD_TRUTH.md scoreboard if needed

## Honest note
This soak validates **shell + still-server + inject liveness**, not Speedometer or multiproc security.
EOF

log end "crashes=$CRASHES health_pct=$HEALTH_PCT rss_max=$RSS_MAX"
echo "Soak complete → $SUMMARY"
cat "$SUMMARY"

# Offline Ollama morning brief (no cloud)
if [[ "${MG_LOCAL_LLM:-}" == "1" || "${MG_LOCAL_LLM:-}" == "true" ]]; then
  BRIEF_PY="$SCRIPT_DIR/soak-morning-brief.py"
  if [[ -f "$BRIEF_PY" ]]; then
    log brief "running local LLM morning brief"
    if python3 "$BRIEF_PY" "$RUN" --force >>"$RUN/brief.log" 2>&1; then
      log brief "ok → $RUN/morning-brief.md"
      echo ""
      echo "── Local LLM morning brief ──"
      cat "$RUN/morning-brief.md" 2>/dev/null || true
    else
      log brief "FAIL see $RUN/brief.log"
      echo "Morning brief failed — see $RUN/brief.log"
    fi
  else
    log brief "soak-morning-brief.py missing"
  fi
else
  echo "(Set MG_LOCAL_LLM=1 for offline Ollama morning brief)"
fi
