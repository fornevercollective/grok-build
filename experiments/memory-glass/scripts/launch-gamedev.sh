#!/usr/bin/env bash
# Memory Glass · GAMEDEV PURE launcher
#
# No inspect side menus · no lab drawers · no random auto-click thrash.
# WebGrid rules (BPS formula) + /clock-style chess/go turn clocks.
#
# Default surface: offline Lite Arena (webgrid / go / chess)
#   · agent OFF unless --agent
#   · race-shell v5 pure inject
#   · MG_NO_INSPECT=1 (native inspect hidden; ⌘⌥I to show)
#
# Usage:
#   bash scripts/launch-gamedev.sh
#   bash scripts/launch-gamedev.sh --mode go --clock 10 --inc 2
#   bash scripts/launch-gamedev.sh --mode chess --turns
#   bash scripts/launch-gamedev.sh --online          # Neuralink WebGrid race (agent on)
#   bash scripts/launch-gamedev.sh --ugrad            # webgrid-ugrad offline chase
#   bash scripts/launch-gamedev.sh --agent --auto     # arena + agent + auto start
#   bash scripts/launch-gamedev.sh --headless
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
[[ -d "$APP" ]] || APP="$ROOT/Memory Glass.app"
SITE="${MG_SITE:-$HOME/.panda/vision/cast/paper/site}"
WATCH="$HOME/.panda/mg-soak/watch"
mkdir -p "$WATCH" "$HOME/Library/Logs/MemoryGlass"

MODE="webgrid"          # webgrid | go | chess
CLOCK_MIN=5
INC_S=0
AGENT=0
AUTO=0
TURNS=0
ONLINE=0
UGRAD=0
HEADLESS=0
PORT=8790

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode|-m) MODE="${2:-webgrid}"; shift 2 ;;
    --clock|-c) CLOCK_MIN="${2:-5}"; shift 2 ;;
    --inc) INC_S="${2:-0}"; shift 2 ;;
    --agent) AGENT=1; shift ;;
    --auto) AUTO=1; shift ;;
    --turns) TURNS=1; AUTO=1; shift ;;
    --online) ONLINE=1; shift ;;
    --ugrad) UGRAD=1; shift ;;
    --headless) HEADLESS=1; shift ;;
    --port) PORT="${2:-8790}"; shift 2 ;;
    *) shift ;;
  esac
done

echo "==> GAMEDEV PURE"
echo "    no inspect · no drawers · no random click thrash"
echo "    mode=$MODE clock=${CLOCK_MIN}m inc=${INC_S}s agent=$AGENT"

# ── deploy arena / ugrad to site ───────────────────────────────────────────
if [[ -f "$ROOT/pwa/lite-arena.html" ]]; then
  cp -f "$ROOT/pwa/lite-arena.html" "$SITE/lite-arena.html"
fi
if [[ -f "$ROOT/pwa/webgrid-ugrad.html" ]]; then
  cp -f "$ROOT/pwa/webgrid-ugrad.html" "$SITE/webgrid-ugrad.html"
fi

# ── hotpipe sync (race-shell v5) ───────────────────────────────────────────
HP_SRC="$ROOT/hotpipe"
HP_DST="$APP/Contents/Resources/hotpipe"
if [[ -d "$HP_SRC" && -d "$HP_DST" ]]; then
  cp -f "$HP_SRC/race-shell.js" "$HP_DST/race-shell.js" 2>/dev/null || true
  cp -f "$HP_SRC/webgrid-play.js" "$HP_DST/webgrid-play.js" 2>/dev/null || true
  echo "==> hotpipe race-shell + webgrid-play synced"
fi

# ── local site ─────────────────────────────────────────────────────────────
if ! curl -sf -o /dev/null "http://127.0.0.1:${PORT}/" 2>/dev/null; then
  if [[ -d "$SITE" ]]; then
    (cd "$SITE" && python3 -m http.server "$PORT" >>"$WATCH/gamedev-site.log" 2>&1 &)
    sleep 0.4
    echo "==> started :$PORT site"
  fi
fi

# ── pace floor ≥1 ──────────────────────────────────────────────────────────
cat >"$WATCH/pace.json" <<PACE
{
  "sleep_ms": 1,
  "wait_loops": 5,
  "mode": "gamedev-pure",
  "source": "launch-gamedev",
  "target_bps": 588.4,
  "gamedev": 1,
  "pure": 1,
  "headless": ${HEADLESS},
  "note": "no inspect thrash; agent opt-in; sleep>=1"
}
PACE

# ── URL ────────────────────────────────────────────────────────────────────
if [[ "$ONLINE" -eq 1 ]]; then
  EXTRA="&mg_gamedev=1&mg_pure=1&mg_lab_full=0&mg_race=1&mg_pace=hyper"
  [[ "$HEADLESS" -eq 1 ]] && EXTRA="${EXTRA}&mg_headless=1"
  [[ "$AGENT" -eq 1 || "$AUTO" -eq 1 ]] && EXTRA="${EXTRA}&mg_autoplay=1"
  URL="https://neuralink.com/webgrid/?mg_gamedev=1${EXTRA}"
elif [[ "$UGRAD" -eq 1 ]]; then
  Q="gamedev=1&tick=sim&N=30&dur=20"
  [[ "$AGENT" -eq 1 ]] && Q="${Q}&auto=1&mg_autoplay=1"
  URL="http://127.0.0.1:${PORT}/webgrid-ugrad.html?${Q}"
else
  Q="gamedev=1&mode=${MODE}&clock=${CLOCK_MIN}&inc=${INC_S}&agent=${AGENT}"
  [[ "$AUTO" -eq 1 ]] && Q="${Q}&auto=1"
  [[ "$TURNS" -eq 1 ]] && Q="${Q}&turns=1"
  URL="http://127.0.0.1:${PORT}/lite-arena.html?${Q}"
fi

echo "==> URL $URL"

export MG_HOTPIPE_LEAN=race-shell
export MG_RACE_SHELL=1
export MG_LAB_FULL=0
export MG_GAMEDEV=1
export MG_NO_INSPECT=1
export MG_HOTPIPE_LEAN
[[ "$HEADLESS" -eq 1 ]] && export MG_HEADLESS=1

# Prefer direct binary so env vars stick (open -n may drop some)
BIN="$APP/Contents/MacOS/Memory Glass"
if [[ ! -x "$BIN" ]]; then
  BIN="$APP/Contents/MacOS/memory-glass"
fi

if [[ -x "$BIN" ]]; then
  echo "==> launch binary (env MG_GAMEDEV=1 MG_NO_INSPECT=1 race-shell)"
  nohup env \
    MG_HOTPIPE_LEAN=race-shell \
    MG_RACE_SHELL=1 \
    MG_LAB_FULL=0 \
    MG_GAMEDEV=1 \
    MG_NO_INSPECT=1 \
    ${MG_HEADLESS:+MG_HEADLESS=1} \
    "$BIN" "$URL" \
    >>"$HOME/Library/Logs/MemoryGlass/gamedev.log" 2>&1 &
  echo "    PID $!"
else
  open -n "$APP" --args "$URL"
fi

echo ""
echo "┌──────────────────┬────────────────────────────────────────────┐"
echo "│ GAMEDEV PURE     │ inspect hidden · agent default OFF         │"
echo "├──────────────────┼────────────────────────────────────────────┤"
echo "│ Surface          │ WebGrid rules · Go/Chess /clock turns      │"
echo "│ Race-shell       │ v5 pure (no drawer / board thrash)         │"
echo "│ Opt-in agent     │ Arena: Agent ON button · --agent flag      │"
echo "│ Show inspect     │ ⌘⌥I (hidden at launch)                     │"
echo "│ Online race      │ --online (Neuralink, still gamedev chrome) │"
echo "└──────────────────┴────────────────────────────────────────────┘"
echo "Docs: docs/MG-RACE-SHELL.md · pwa/lite-arena.html"
echo "If binary lacks MG_NO_INSPECT (old build): rebuild + resign, or ⌘⌥I once."
