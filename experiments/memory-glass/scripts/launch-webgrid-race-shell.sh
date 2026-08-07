#!/usr/bin/env bash
# Memory Glass · RACE SHELL — fast boot, one page, no bells/whistles.
#
# Topology (expected concurrent seats):
#   Terminal 1 — this launcher / Grok orchestrator
#   Terminal 2 — webgrid-collector :9880 (+ optional optical mix)
#   Terminal 3 — local research site :8765 (#agents multi-agent debate)
#   Browser A  — Memory Glass race-shell (WKWebView · neuralink webgrid only)
#   Browser B  — Safari/Chrome on http://127.0.0.1:8765/#agents (background R&D)
#
# Usage:
#   bash scripts/launch-webgrid-race-shell.sh
#   bash scripts/launch-webgrid-race-shell.sh --rounds 1 --sleep 1
#   bash scripts/launch-webgrid-race-shell.sh --no-monitor
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
[[ -d "$APP" ]] || APP="$ROOT/Memory Glass.app"
[[ -d "$APP" ]] || { echo "Memory Glass.app not found"; exit 1; }

ROUNDS=1
SLEEP_MS=1
WAIT_LOOPS=5
MONITOR=1
SCALE=large
GAMEDEV=1
HEADLESS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rounds|-r) ROUNDS="${2:-1}"; shift 2 ;;
    --sleep|-s)
      SLEEP_MS="${2:-1}"
      if [[ "$SLEEP_MS" -lt 1 ]]; then SLEEP_MS=1; fi
      shift 2
      ;;
    --wait|-w) WAIT_LOOPS="${2:-5}"; shift 2 ;;
    --no-monitor) MONITOR=0; shift ;;
    --small) SCALE=small; shift ;;
    --gamedev) GAMEDEV=1; shift ;;
    --headless) HEADLESS=1; GAMEDEV=1; shift ;;
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
echo "==> RACE-SHELL · display ${DISP_W}x${DISP_H}"

if [[ "$SCALE" == "small" ]]; then
  W=720; H=560
  export MG_WEBGRID_SCALE=small
  EXTRA="&mg_scale=small"
else
  W=$(( DISP_W > 100 ? DISP_W - 48 : 2400 ))
  H=$(( DISP_H > 100 ? DISP_H - 80 : 1350 ))
  [[ "$W" -lt 1280 ]] && W=1280
  [[ "$H" -lt 780 ]] && H=780
  export MG_WEBGRID_SCALE=large
  EXTRA=""
fi

URL="https://neuralink.com/webgrid/?mg_autoplay=${ROUNDS}&mg_display=${DISP_W}x${DISP_H}&mg_pace=hyper&mg_race=1&mg_lab_full=0&mg_gamedev=${GAMEDEV}&mg_headless=${HEADLESS}${EXTRA}"

mkdir -p "$HOME/.panda/mg-soak/watch" "$HOME/Library/Logs/MemoryGlass"
# sleep_ms must be ≥1 (0 starves WK paint / 1-click bug)
if [[ "$SLEEP_MS" -lt 1 ]]; then SLEEP_MS=1; fi
cat >"$HOME/.panda/mg-soak/watch/pace.json" <<PACE
{"sleep_ms":${SLEEP_MS},"wait_loops":${WAIT_LOOPS},"mode":"m4-hyper","source":"race-shell-hyper","target_bps":588.4,"prior_record":483.58,"gamedev":${GAMEDEV},"headless":${HEADLESS},"note":"sleep>=1; paint ceiling ~588 BPS @ 60Hz"}
PACE

# Seat 2: score collector
if ! pgrep -f 'webgrid-collector.py' >/dev/null 2>&1; then
  python3 "$ROOT/scripts/webgrid-collector.py" >>"$HOME/.panda/mg-soak/watch/collector.log" 2>&1 &
  echo "==> collector :9880 pid $!"
else
  echo "==> collector already up"
fi

# Seat 3 note (do not kill research servers)
if pgrep -f 'http.server 8765' >/dev/null 2>&1; then
  echo "==> seat3 :8765 agents research site LIVE (do not thrash)"
else
  echo "==> seat3 :8765 not running (optional: optical multi-agent debate)"
fi

# Sync hotpipe + resign
if [[ -x "$ROOT/scripts/mg-hotpipe-sync.sh" ]]; then
  bash "$ROOT/scripts/mg-hotpipe-sync.sh" 2>&1 | tail -6
fi

# Rebuild if cargo present and race-shell source newer than binary
BIN_SRC="$ROOT/target/release/memory-glass"
if command -v cargo >/dev/null 2>&1; then
  if [[ ! -x "$BIN_SRC" ]] || [[ "$ROOT/src/main.rs" -nt "$BIN_SRC" ]] || [[ "$ROOT/hotpipe/race-shell.js" -nt "$APP/Contents/Resources/hotpipe/race-shell.js" ]]; then
    echo "==> cargo release build (race-shell inject)…"
    (cd "$ROOT" && cargo build --release 2>&1 | tail -8)
  fi
  if [[ -x "$BIN_SRC" ]]; then
    cp -f "$BIN_SRC" "$APP/Contents/MacOS/memory-glass"
    [[ -f "$APP/Contents/MacOS/Memory Glass" ]] && cp -f "$BIN_SRC" "$APP/Contents/MacOS/Memory Glass"
    if [[ -x "$ROOT/scripts/resign-app.sh" ]]; then
      bash "$ROOT/scripts/resign-app.sh" 2>&1 | tail -4
    else
      codesign --force --deep --sign - "$APP" 2>&1 | tail -3
    fi
  fi
fi

export MG_WEBGRID_W="$W" MG_WEBGRID_H="$H"
export MG_HOTPIPE_LEAN=race-shell
export MG_RACE_SHELL=1
export MG_LAB_FULL=0
unset MG_FORCE_INTEL_PACE MG_LOCAL_LLM 2>/dev/null || true

# Perf monitor seat
if [[ "$MONITOR" == "1" ]]; then
  python3 "$ROOT/scripts/mg-race-perf-monitor.py" --seconds $(( ROUNDS * 85 + 25 )) --interval 1 \
    >>"$HOME/.panda/mg-soak/watch/perf-monitor.log" 2>&1 &
  echo "==> perf monitor pid $! → ~/.panda/mg-soak/watch/perf-race.jsonl"
fi

echo "==> topology: MG race-shell | collector :9880 | optional :8765 agents | Grok orchestrator"
echo "==> url=$URL"
echo "==> lean=race-shell turbo sleep=${SLEEP_MS}ms wait=${WAIT_LOOPS}"

pkill -x memory-glass 2>/dev/null || true
sleep 0.4

BIN="$APP/Contents/MacOS/memory-glass"
if [[ -x "$BIN" ]]; then
  (
    cd "$HOME" && \
    MG_WEBGRID_SCALE="$MG_WEBGRID_SCALE" \
    MG_WEBGRID_W="$W" MG_WEBGRID_H="$H" \
    MG_HOTPIPE_LEAN=race-shell \
    MG_RACE_SHELL=1 \
    MG_LAB_FULL=0 \
    "$BIN" "$URL" >>"$HOME/Library/Logs/MemoryGlass/launch.log" 2>&1
  ) &
  echo "==> RACE-SHELL launched pid $!"
else
  open -n "$APP" --args "$URL"
fi

echo "==> agent ≠ implant · watch: rg 'RACE-SHELL|v34-turbo|agent_end' ~/Library/Logs/MemoryGlass/launch.log"
echo "==> live: cat ~/.panda/mg-soak/watch/live-summary.json"
echo "==> perf: cat ~/.panda/mg-soak/watch/perf-race-latest.json"
