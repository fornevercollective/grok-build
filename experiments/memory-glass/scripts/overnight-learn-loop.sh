#!/usr/bin/env bash
# Overnight live learn loop until morning:
#   1) WebGrid agent play (truth scrape) → play.jsonl
#   2) Crossover rows.json (existing snapshot; optional refresh hook)
#   3) flip-train-bridge → trials.jsonl
#   4) train-trial-bus → model.json + metrics.jsonl
#   5) iterate until END
#
# Usage:
#   bash scripts/overnight-learn-loop.sh --hours 4.5
#   bash scripts/overnight-learn-loop.sh --until 07:00
#
# Env:
#   MG_LOCAL_LLM=1          pace advisor + morning brief at end
#   MG_APP                  Memory Glass.app path
#   CROSSOVER_ROWS          path to rows.json
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd 2>/dev/null || echo "$ROOT")"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
SOAK_ROOT="${MG_SOAK_DIR:-$HOME/.panda/mg-soak}"
ROWS="${CROSSOVER_ROWS:-/Volumes/qbitOS/00.dev/cursor/crossover/data/rows.json}"
HOURS="${MG_LEARN_HOURS:-}"
UNTIL="${MG_LEARN_UNTIL:-}"
CYCLE_SEC="${MG_LEARN_CYCLE_SEC:-900}"  # 15 min default cycle

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hours) HOURS="${2:-}"; shift 2 ;;
    --until) UNTIL="${2:-}"; shift 2 ;;
    --cycle) CYCLE_SEC="${2:-900}"; shift 2 ;;
    --rows) ROWS="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

EPOCH=$(date +%s)
if [[ -n "$UNTIL" ]]; then
  # HH:MM local
  END=$(python3 -c "
from datetime import datetime, timedelta
now=datetime.now()
hh,mm=map(int,'$UNTIL'.split(':'))
end=now.replace(hour=hh,minute=mm,second=0,microsecond=0)
if end<=now: end+=timedelta(days=1)
print(int(end.timestamp()))
")
elif [[ -n "$HOURS" ]]; then
  END=$(python3 -c "print(int($EPOCH + float('$HOURS')*3600))")
else
  # default: until 07:00 local
  END=$(python3 -c "
from datetime import datetime, timedelta
now=datetime.now()
end=now.replace(hour=7,minute=0,second=0,microsecond=0)
if end<=now: end+=timedelta(days=1)
print(int(end.timestamp()))
")
fi

RUN="$SOAK_ROOT/learn-run-$EPOCH"
mkdir -p "$RUN" "$SOAK_ROOT/watch" "$SOAK_ROOT/train"
LOG="$RUN/learn.jsonl"
SUMMARY="$RUN/summary.md"
PIDFILE="$RUN/pids.txt"
: >"$PIDFILE"

log() {
  local kind="$1"; shift
  printf '{"ts":"%s","kind":"%s","msg":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$kind" \
    "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$*")" \
    >>"$LOG"
  echo "[$(date +%H:%M:%S)] $kind $*"
}

bg() {
  # bg name command...
  local name="$1"; shift
  nohup "$@" >>"$RUN/${name}.log" 2>&1 &
  echo $! >>"$PIDFILE"
  log bg "start $name pid=$!"
}

ensure_collector() {
  if ! curl -sS -m 1 http://127.0.0.1:9880/ >/dev/null 2>&1; then
    bg collector python3 "$SCRIPT_DIR/webgrid-collector.py"
    sleep 1
  else
    log collector "already up"
  fi
}

ensure_pace() {
  if [[ "${MG_LOCAL_LLM:-}" == "1" || "${MG_LOCAL_LLM:-}" == "true" ]]; then
    if ! pgrep -f 'webgrid-pace-advisor.py' >/dev/null 2>&1; then
      bg pace env MG_LOCAL_LLM=1 python3 "$SCRIPT_DIR/webgrid-pace-advisor.py" --force --interval 12
    fi
  fi
}

launch_webgrid() {
  local scale="${1:-small}"
  local rounds="${2:-2}"
  local url
  if [[ "$scale" == "small" ]]; then
    url="https://neuralink.com/webgrid/?mg_scale=small&mg_autoplay=${rounds}&mg_local_llm=1"
  else
    url="https://neuralink.com/webgrid/?mg_autoplay=${rounds}&mg_local_llm=1"
  fi
  # kill prior game binary only
  pkill -x memory-glass 2>/dev/null || true
  sleep 0.8
  open -n "$APP" --args "$url" 2>/dev/null || open "$APP" --args "$url"
  log webgrid "launch scale=$scale rounds=$rounds"
  sleep 4
}

cleanup() {
  log end "cleanup"
  if [[ -f "$PIDFILE" ]]; then
    while read -r p; do
      kill "$p" 2>/dev/null || true
    done <"$PIDFILE"
  fi
  # leave still-server / MG alone unless we started them with pidfile
}
trap cleanup EXIT

log start "until_epoch=$END cycle_sec=$CYCLE_SEC run=$RUN"
log policy "WebGrid=synthetic_pointer not BCI; flip=MACD/BB board; no repo deletes"

ensure_collector
ensure_pace

# warm ollama small model if local llm
if [[ "${MG_LOCAL_LLM:-}" == "1" ]]; then
  (ollama run llama3.2:1b "ok" >/dev/null 2>&1 &) || true
fi

CYCLE=0
ALT=0
while [[ $(date +%s) -lt $END ]]; do
  CYCLE=$((CYCLE + 1))
  NOW=$(date +%s)
  LEFT=$((END - NOW))
  log cycle "n=$CYCLE left_s=$LEFT"

  # 1) Play WebGrid alternating small/large
  if [[ $((ALT % 2)) -eq 0 ]]; then
    launch_webgrid small 2
  else
    launch_webgrid large 1
  fi
  ALT=$((ALT + 1))

  # Let a round breathe (cap wait by remaining time / cycle)
  WAIT=$CYCLE_SEC
  if [[ $WAIT -gt $LEFT ]]; then WAIT=$((LEFT > 60 ? LEFT - 30 : 30)); fi
  if [[ $WAIT -lt 60 ]]; then WAIT=60; fi
  log wait "play_collect_s=$WAIT"
  sleep "$WAIT"

  # 2) rows.json — use existing snapshot (full board rebuild is ~1h; log path)
  if [[ -f "$ROWS" ]]; then
    log rows "ok path=$ROWS mtime=$(stat -f '%Sm' -t '%Y-%m-%dT%H:%M' "$ROWS" 2>/dev/null || echo '?')"
  else
    log rows "MISSING $ROWS — flip trials will be empty until board rebuild"
  fi

  # 3) Bridge
  if python3 "$SCRIPT_DIR/flip-train-bridge.py" --rows "$ROWS" >>"$RUN/bridge.log" 2>&1; then
    log bridge "ok"
  else
    log bridge "FAIL see bridge.log"
  fi

  # 4) Train
  if python3 "$SCRIPT_DIR/train-trial-bus.py" --epochs 35 --lr 0.07 >>"$RUN/train.log" 2>&1; then
    # capture last metrics line
    MET=$(tail -1 "$SOAK_ROOT/train/metrics.jsonl" 2>/dev/null || echo '{}')
    log train "ok $MET"
  else
    log train "FAIL see train.log"
  fi

  # snapshot model into run dir
  cp -f "$SOAK_ROOT/train/model.json" "$RUN/model-cycle-$CYCLE.json" 2>/dev/null || true
  cp -f "$SOAK_ROOT/train/manifest.json" "$RUN/manifest-cycle-$CYCLE.json" 2>/dev/null || true

  # soft pace refresh
  if [[ "${MG_LOCAL_LLM:-}" == "1" ]]; then
    python3 "$SCRIPT_DIR/webgrid-pace-advisor.py" --once --force >>"$RUN/pace.log" 2>&1 || true
  fi
done

# Morning wrap
pkill -x memory-glass 2>/dev/null || true
END_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
START_ISO=$(date -u -r "$EPOCH" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

# final bridge + train
python3 "$SCRIPT_DIR/flip-train-bridge.py" --rows "$ROWS" >>"$RUN/bridge.log" 2>&1 || true
python3 "$SCRIPT_DIR/train-trial-bus.py" --epochs 50 --lr 0.05 >>"$RUN/train.log" 2>&1 || true

LAST_MET=$(tail -1 "$SOAK_ROOT/train/metrics.jsonl" 2>/dev/null || echo '{}')
STATS=$(python3 -c "import json;print(json.dumps(json.load(open('$SOAK_ROOT/train/manifest.json')).get('stats',{})))" 2>/dev/null || echo '{}')

cat >"$SUMMARY" <<EOF
# Overnight learn loop summary

| | |
|--|--|
| Start (epoch) | $EPOCH |
| End | $END_ISO |
| Cycles | $CYCLE |
| Run dir | \`$RUN\` |
| Trials stats | \`$STATS\` |
| Last train metrics | \`$LAST_MET\` |
| Model | \`~/.panda/mg-soak/train/model.json\` |
| Metrics log | \`~/.panda/mg-soak/train/metrics.jsonl\` |

## Pipeline
1. WebGrid play (truth scrape v20) → play.jsonl  
2. Crossover rows.json snapshot (no overnight full rebuild)  
3. flip-train-bridge → trials.jsonl  
4. train-trial-bus (logreg pure Python) → model.json  

## Honest labels
- WebGrid = synthetic pointer skill (not BCI implant)  
- Flip = MACD / Bollinger board timing  
- Both teach **timing under noise** on a shared feature bus  

## Morning checklist
- [ ] Read \`$SUMMARY\`
- [ ] \`cat ~/.panda/mg-soak/train/model.json | head\`
- [ ] \`tail -20 ~/.panda/mg-soak/train/metrics.jsonl\`
- [ ] Optional: \`MG_LOCAL_LLM=1 python3 scripts/soak-morning-brief.py $RUN --force\`
EOF

if [[ "${MG_LOCAL_LLM:-}" == "1" ]]; then
  # brief may use soak-style dir; point at learn run
  python3 "$SCRIPT_DIR/soak-morning-brief.py" "$RUN" --force >>"$RUN/brief.log" 2>&1 || true
fi

log end "cycles=$CYCLE summary=$SUMMARY"
echo "Learn loop complete → $SUMMARY"
cat "$SUMMARY"
# disable trap kill of long-running still-server: only kill pids we started
trap - EXIT
if [[ -f "$PIDFILE" ]]; then
  while read -r p; do
    # only kill our collector/pace if still ours
    kill "$p" 2>/dev/null || true
  done <"$PIDFILE"
fi
