#!/usr/bin/env bash
# Memory Glass · WebGrid RACE (Mac mini M4 / Apple Silicon max BPS)
#
# Agent-only: no maze/contrails, pace race (sleep_ms 2 floor), single focused round.
# Target: beat fleet seed 483.58 BPS on this mini (Mac16,10).
#
# Usage:
#   bash scripts/launch-webgrid-race-mini.sh
#   bash scripts/launch-webgrid-race-mini.sh --rounds 1
#   bash scripts/launch-webgrid-race-mini.sh --sleep 2 --rounds 2
#   bash scripts/launch-webgrid-race-mini.sh --with-lab   # theater (maze) — not for records
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
[[ -d "$APP" ]] || APP="$ROOT/Memory Glass.app"
[[ -d "$APP" ]] || { echo "Memory Glass.app not found"; exit 1; }

ROUNDS=1
SLEEP_MS=2
WAIT_LOOPS=20
WITH_LAB=0
SCALE=large

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rounds|-r) ROUNDS="${2:-1}"; shift 2 ;;
    --sleep|-s) SLEEP_MS="${2:-2}"; shift 2 ;;
    --wait|-w) WAIT_LOOPS="${2:-20}"; shift 2 ;;
    --with-lab) WITH_LAB=1; shift ;;
    --small) SCALE=small; shift ;;
    --large) SCALE=large; shift ;;
    *) shift ;;
  esac
done

detect_main() {
  python3 - <<'PY'
import re, subprocess
out = subprocess.check_output(["system_profiler", "SPDisplaysDataType"], text=True, errors="replace")
main = None
for b in re.split(r"\n(?=\s{8}\S)", out):
    if "Main Display: Yes" in b:
        m = re.search(r"Resolution:\s*(\d+)\s*x\s*(\d+)", b)
        if m:
            main = (int(m.group(1)), int(m.group(2)))
            break
if not main:
    for m in re.finditer(r"Resolution:\s*(\d+)\s*x\s*(\d+)", out):
        w, h = int(m.group(1)), int(m.group(2))
        if w >= h:
            main = (w, h)
            break
print(f"{main[0]} {main[1]}" if main else "2560 1440")
PY
}

read -r DISP_W DISP_H <<<"$(detect_main)"
echo "==> RACE · primary display ${DISP_W}x${DISP_H}"

if [[ "$SCALE" == "small" ]]; then
  W=720; H=560
  GRID_Q="mg_scale=small"
  export MG_WEBGRID_SCALE=small
else
  W=$(( DISP_W > 100 ? DISP_W - 48 : 2400 ))
  H=$(( DISP_H > 100 ? DISP_H - 80 : 1350 ))
  [[ "$W" -lt 1280 ]] && W=1280
  [[ "$H" -lt 780 ]] && H=780
  GRID_Q=""
  export MG_WEBGRID_SCALE=large
fi

# Race URL: explicit pace + race flag; lab off unless --with-lab
URL="https://neuralink.com/webgrid/?mg_autoplay=${ROUNDS}&mg_display=${DISP_W}x${DISP_H}&mg_pace=race&mg_race=1"
if [[ -n "$GRID_Q" ]]; then
  URL="${URL}&${GRID_Q}"
fi
if [[ "$WITH_LAB" == "1" ]]; then
  URL="${URL}&mg_lab_full=1"
  echo "==> WARN --with-lab: maze/contrails ON (not max BPS)"
else
  URL="${URL}&mg_lab_full=0"
fi

mkdir -p "$HOME/.panda/mg-soak/watch" "$HOME/Library/Logs/MemoryGlass"

# Pace file for local advisor (if polled) + human audit
cat >"$HOME/.panda/mg-soak/watch/pace.json" <<PACE
{"sleep_ms":${SLEEP_MS},"wait_loops":${WAIT_LOOPS},"mode":"m4-race","source":"race-mini-launch","target_bps":483.58}
PACE
echo "==> pace.json sleep_ms=${SLEEP_MS} wait_loops=${WAIT_LOOPS}"

# Score collector
if ! pgrep -f 'webgrid-collector.py' >/dev/null 2>&1; then
  python3 "$ROOT/scripts/webgrid-collector.py" >>"$HOME/.panda/mg-soak/watch/collector.log" 2>&1 &
  echo "==> collector started pid $!"
else
  echo "==> collector already up"
fi

# Sync hotpipe (JS race path is immediate; no cargo required for pace/maze)
if [[ -x "$ROOT/scripts/mg-hotpipe-sync.sh" ]]; then
  bash "$ROOT/scripts/mg-hotpipe-sync.sh" 2>&1 | tail -8
fi

export MG_WEBGRID_W="$W"
export MG_WEBGRID_H="$H"
# Agent-only inject: skip maze/contrail/ugrad floats (needs binary with v33 wiring)
export MG_HOTPIPE_LEAN="${MG_HOTPIPE_LEAN:-race}"
export MG_LAB_FULL=0
unset MG_FORCE_INTEL_PACE || true
unset MG_LOCAL_LLM || true

echo "==> scale=$SCALE window ${W}x${H} rounds=$ROUNDS lean=${MG_HOTPIPE_LEAN}"
echo "==> url=$URL"
echo "==> target beat 483.58 BPS · agent ≠ implant"

# Soft restart prior instance only (cold inject on first paint)
pkill -x memory-glass 2>/dev/null || true
sleep 0.5

BIN="$APP/Contents/MacOS/memory-glass"
if [[ -x "$BIN" ]]; then
  (
    cd "$HOME" && \
    MG_WEBGRID_SCALE="$MG_WEBGRID_SCALE" \
    MG_WEBGRID_W="$W" \
    MG_WEBGRID_H="$H" \
    MG_HOTPIPE_LEAN="$MG_HOTPIPE_LEAN" \
    MG_LAB_FULL=0 \
    "$BIN" "$URL" >>"$HOME/Library/Logs/MemoryGlass/launch.log" 2>&1
  ) &
  echo "==> launched race binary pid $!"
else
  open -n "$APP" --args "$URL"
  echo "==> launched via open"
fi

echo "==> WebGrid RACE · $([ "$SCALE" = small ] && echo 12×12 || echo 30×30) · no maze · sleep ${SLEEP_MS}ms"
echo "==> watch: tail -f ~/Library/Logs/MemoryGlass/launch.log | rg 'agent_|race chrome|peak'"
echo "==> live:  cat ~/.panda/mg-soak/watch/live-summary.json"
