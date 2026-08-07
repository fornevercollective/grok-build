#!/usr/bin/env bash
# Memory Glass · SPEED STACK launcher
#
# Offline L0 instruments (not in click loop):
#   zig · bun · uv · ruff · tokio · satori · wasm · repel · tauri
#   + kbatch-live (rust) keyboard GEO bench
#
# Online timing instrument (one hot path):
#   Memory Glass race-shell → Neuralink WebGrid @ hyper
#   sleep_ms ≥ 1  (0 starves WK paint)
#   paint ceiling ~588 BPS / ~60 Hz
#
# Headless/game-dev styling:
#   mg_gamedev=1  dark instrument chrome · canvas still visible
#   mg_headless=1 metrics disclosure HUD · no black void
#
# Usage:
#   bash scripts/launch-speed-stack.sh
#   bash scripts/launch-speed-stack.sh --rounds 1 --gamedev
#   bash scripts/launch-speed-stack.sh --headless --no-bench
#   bash scripts/launch-speed-stack.sh --offline-only   # kbatch-live bench only
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
[[ -d "$APP" ]] || APP="$ROOT/Memory Glass.app"
WATCH="$HOME/.panda/mg-soak/watch"
mkdir -p "$WATCH" "$HOME/Library/Logs/MemoryGlass"

ROUNDS=1
SLEEP_MS=1
WAIT_LOOPS=5
GAMEDEV=1
HEADLESS=0
OFFLINE_ONLY=0
RUN_BENCH=1
MONITOR=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rounds|-r) ROUNDS="${2:-1}"; shift 2 ;;
    --sleep|-s)
      SLEEP_MS="${2:-1}"
      # clamp: never 0
      if [[ "$SLEEP_MS" -lt 1 ]]; then SLEEP_MS=1; fi
      shift 2
      ;;
    --wait|-w) WAIT_LOOPS="${2:-5}"; shift 2 ;;
    --gamedev) GAMEDEV=1; shift ;;
    --no-gamedev) GAMEDEV=0; shift ;;
    --headless) HEADLESS=1; GAMEDEV=1; shift ;;
    --offline-only) OFFLINE_ONLY=1; shift ;;
    --no-bench) RUN_BENCH=0; shift ;;
    --no-monitor) MONITOR=0; shift ;;
    *) shift ;;
  esac
done

echo "==> SPEED STACK"
echo "    offline: zig·bun·uv·ruff·tokio·satori·wasm·repel·tauri + kbatch-live"
echo "    online : race-shell hyper · sleep=${SLEEP_MS}ms wait=${WAIT_LOOPS}"
echo "    style  : gamedev=${GAMEDEV} headless=${HEADLESS}"

# ── pace file (must never be sleep 0) ───────────────────────────────────────
if [[ "$SLEEP_MS" -lt 1 ]]; then SLEEP_MS=1; fi
cat >"$WATCH/pace.json" <<PACE
{
  "sleep_ms": ${SLEEP_MS},
  "wait_loops": ${WAIT_LOOPS},
  "mode": "m4-hyper",
  "source": "speed-stack-hyper",
  "target_bps": 588.4,
  "prior_record": 483.58,
  "stack": "zig,bun,uv,ruff,tokio,satori,wasm,repel,tauri,kbatch-live-rs",
  "gamedev": ${GAMEDEV},
  "headless": ${HEADLESS},
  "note": "sleep>=1; paint ceiling ~60Hz; offline stack not in click loop"
}
PACE
echo "==> pace → $WATCH/pace.json (sleep=${SLEEP_MS} wait=${WAIT_LOOPS})"

# ── offline L0: kbatch-live rust bench ──────────────────────────────────────
if [[ "$RUN_BENCH" == "1" ]]; then
  KBATCH_LIVE="${KBATCH_LIVE:-$HOME/.local/bin/kbatch-live}"
  if [[ -x "$KBATCH_LIVE" ]]; then
    echo "==> offline kbatch-live --bench water (8s cap)"
    # timeout so a stuck TUI binary can't block the race launch
    if command -v gtimeout >/dev/null 2>&1; then
      gtimeout 8 "$KBATCH_LIVE" --bench water >"$WATCH/LATEST-speed-stack-kbatch.txt" 2>&1 || true
    elif command -v timeout >/dev/null 2>&1; then
      timeout 8 "$KBATCH_LIVE" --bench water >"$WATCH/LATEST-speed-stack-kbatch.txt" 2>&1 || true
    else
      "$KBATCH_LIVE" --bench water >"$WATCH/LATEST-speed-stack-kbatch.txt" 2>&1 &
      _kb=$!
      ( sleep 8; kill "$_kb" 2>/dev/null ) &
      wait "$_kb" 2>/dev/null || true
    fi
    tail -8 "$WATCH/LATEST-speed-stack-kbatch.txt" 2>/dev/null || true
  else
    echo "==> kbatch-live not found (skip offline bench)"
  fi
  # optional toolchain probes (presence only — not click path)
  {
    echo "ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    for t in zig bun uv ruff cargo wasmtime tauri; do
      if command -v "$t" >/dev/null 2>&1; then
        echo "ok $t $($t --version 2>/dev/null | head -1)"
      else
        echo "missing $t"
      fi
    done
    command -v python3 >/dev/null && echo "ok python3 $(python3 --version 2>&1)"
    command -v node >/dev/null && echo "ok node $(node --version 2>&1)"
  } >"$WATCH/LATEST-speed-stack-tools.txt"
  echo "==> tools → $WATCH/LATEST-speed-stack-tools.txt"
fi

if [[ "$OFFLINE_ONLY" == "1" ]]; then
  echo "==> offline-only done"
  exit 0
fi

[[ -d "$APP" ]] || { echo "Memory Glass.app not found"; exit 1; }

# Prefer env / defaults — system_profiler can hang on some sessions
if [[ -n "${MG_DISP_W:-}" && -n "${MG_DISP_H:-}" ]]; then
  DISP_W="$MG_DISP_W"; DISP_H="$MG_DISP_H"
else
  DISP_W=2560; DISP_H=1440
  # quick non-blocking probe via python Quartz if available (<1s)
  read -r DISP_W DISP_H <<<"$(python3 - <<'PY' 2>/dev/null || echo "2560 1440"
try:
    import Quartz
    for mid in Quartz.CGGetActiveDisplayList(16, None, None)[1]:
        if Quartz.CGDisplayIsMain(mid):
            b = Quartz.CGDisplayBounds(mid)
            print(int(b.size.width), int(b.size.height))
            break
    else:
        print("2560 1440")
except Exception:
    print("2560 1440")
PY
)"
fi
W=$(( DISP_W > 100 ? DISP_W - 48 : 2400 ))
H=$(( DISP_H > 100 ? DISP_H - 80 : 1350 ))
[[ "$W" -lt 1280 ]] && W=1280
[[ "$H" -lt 780 ]] && H=780

EXTRA="&mg_gamedev=${GAMEDEV}&mg_headless=${HEADLESS}"
URL="https://neuralink.com/webgrid/?mg_autoplay=${ROUNDS}&mg_display=${DISP_W}x${DISP_H}&mg_pace=hyper&mg_race=1&mg_lab_full=0${EXTRA}"

# collector seat (avoid pgrep -f self-match traps)
if ! ps -axo command= | grep -q 'webgrid-collector\.py'; then
  python3 "$ROOT/scripts/webgrid-collector.py" >>"$WATCH/collector.log" 2>&1 &
  echo "==> collector :9880 pid $!"
else
  echo "==> collector already up"
fi

# one hot path: do not start optical mix/fuzz here
echo "==> one hot path: race only (no optical mix/fuzz in this launcher)"

# lean hotpipe copy (no full sync — keeps launch snappy)
HP_SRC="$ROOT/hotpipe"
HP_DST="$APP/Contents/Resources/hotpipe"
if [[ -d "$HP_SRC" && -d "$HP_DST" ]]; then
  cp -f "$HP_SRC/race-shell.js" "$HP_DST/race-shell.js"
  cp -f "$HP_SRC/webgrid-play.js" "$HP_DST/webgrid-play.js"
  echo "==> hotpipe race-shell + webgrid-play copied"
fi

export MG_WEBGRID_W="$W" MG_WEBGRID_H="$H"
export MG_WEBGRID_SCALE=large
export MG_HOTPIPE_LEAN=race-shell
export MG_RACE_SHELL=1
export MG_LAB_FULL=0
export MG_GAMEDEV="$GAMEDEV"
export MG_HEADLESS="$HEADLESS"
unset MG_FORCE_INTEL_PACE MG_LOCAL_LLM 2>/dev/null || true

if [[ "$MONITOR" == "1" ]]; then
  python3 "$ROOT/scripts/mg-race-perf-monitor.py" --seconds $(( ROUNDS * 85 + 25 )) --interval 1 \
    >>"$WATCH/perf-monitor.log" 2>&1 &
  echo "==> perf monitor pid $!"
fi

# topology note
python3 - <<PY
import json, time
from pathlib import Path
p = Path.home() / ".panda/mg-soak/watch/topology.json"
p.write_text(json.dumps({
  "kind": "speed-stack",
  "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "offline": ["zig","bun","uv","ruff","tokio","satori","wasm","repel","tauri","kbatch-live-rs"],
  "online": "memory-glass race-shell webgrid",
  "sleep_ms": ${SLEEP_MS},
  "wait_loops": ${WAIT_LOOPS},
  "gamedev": ${GAMEDEV},
  "headless": ${HEADLESS},
  "paint_ceiling_bps": 588.4,
  "url": """${URL}""",
}, indent=2) + "\n")
print("==> topology →", p)
PY

echo "==> url=$URL"
pkill -x memory-glass 2>/dev/null || true
sleep 0.35

BIN="$APP/Contents/MacOS/memory-glass"
if [[ -x "$BIN" ]]; then
  (
    cd "$HOME" && \
    MG_WEBGRID_SCALE=large \
    MG_WEBGRID_W="$W" MG_WEBGRID_H="$H" \
    MG_HOTPIPE_LEAN=race-shell \
    MG_RACE_SHELL=1 \
    MG_LAB_FULL=0 \
    MG_GAMEDEV="$GAMEDEV" \
    MG_HEADLESS="$HEADLESS" \
    "$BIN" "$URL" >>"$HOME/Library/Logs/MemoryGlass/launch.log" 2>&1
  ) &
  echo "==> SPEED STACK race launched pid $!"
else
  open -n "$APP" --args "$URL"
fi

echo "==> agent ≠ implant · ceiling ~588 BPS @ 60 Hz"
echo "==> live: cat $WATCH/live-summary.json"
echo "==> pace: cat $WATCH/pace.json"
echo "==> kbatch: cat $WATCH/LATEST-keyboards-instant.json"
