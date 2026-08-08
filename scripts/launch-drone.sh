#!/usr/bin/env bash
# Launch standalone /drone HUD (multi-unit FPV · path/RTH · maint).
#
# Pure pop-out by default (browser + Memory Glass). Optional TUI shell:
#   bash scripts/launch-drone.sh --tui
#
# Usage:
#   bash scripts/launch-drone.sh
#   bash scripts/launch-drone.sh units 6
#   bash scripts/launch-drone.sh ugrad
#   bash scripts/launch-drone.sh mavlink
#   bash scripts/launch-drone.sh mixed
#   bash scripts/launch-drone.sh help
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARGS=("$@")
TUI=0
HELP=0
UNITS="${LIVE_DEMUX_DRONE_UNITS:-4}"
BACKEND="${LIVE_DEMUX_DRONE_BACKEND:-sim}"

for a in "${ARGS[@]+"${ARGS[@]}"}"; do
  case "$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')" in
    help|h|-h|--help) HELP=1 ;;
    --tui|tui|tty) TUI=1 ;;
    sim) BACKEND=sim ;;
    ugrad|viewer) BACKEND=ugrad ;;
    mavlink|mav) BACKEND=mavlink ;;
    elrs|decktx|crsf) BACKEND=elrs ;;
    wifi|swm|mixed) BACKEND=mixed ;;
  esac
done

# units N
prev=""
for a in "${ARGS[@]+"${ARGS[@]}"}"; do
  low="$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')"
  if [[ "$prev" == "units" || "$prev" == "n" || "$prev" == "fleet" ]]; then
    if [[ "$a" =~ ^[0-9]+$ ]]; then
      UNITS="$a"
    fi
  elif [[ "$low" =~ ^[1-8]$ ]]; then
    UNITS="$low"
  fi
  prev="$low"
done
# clamp 1–8
if [[ "$UNITS" -lt 1 ]]; then UNITS=1; fi
if [[ "$UNITS" -gt 8 ]]; then UNITS=8; fi

if [[ "$HELP" -eq 1 ]]; then
  cat <<EOF
/drone · standalone multi-unit drone HUD (fc-webgrid-drone-hud-v1)

  bash scripts/launch-drone.sh
  bash scripts/launch-drone.sh units 6
  bash scripts/launch-drone.sh ugrad
  bash scripts/launch-drone.sh mavlink | elrs | mixed
  bash scripts/launch-drone.sh --tui          # open Grok TUI on /drone

  In Grok:  /drone   /drone help   /drone ugrad   /drone units 4

  page: http://127.0.0.1:8790/webgrid-drone-hud.html
  viewer: https://drone.ugrad.ai/viewer/viewer?media=mixed&demo=rows
  env: LIVE_DEMUX_WEBGRID_DRONE_URL · LIVE_DEMUX_DRONE_UNITS · LIVE_DEMUX_DRONE_BACKEND
EOF
  exit 0
fi

export LIVE_DEMUX_WEBGRID_DRONE_URL="${LIVE_DEMUX_WEBGRID_DRONE_URL:-http://127.0.0.1:8790/webgrid-drone-hud.html?backend=${BACKEND}&units=${UNITS}&demo=rows}"

# Prefer dedicated drone pop-out path (also used by /webgrid drone).
if [[ "$TUI" -eq 0 ]]; then
  exec bash "$ROOT/scripts/launch-webgrid.sh" drone
fi

# TUI path: open Grok with /drone intent via live-watch env if supported.
export GROK_NEW_SESSION_AT_STARTUP=1
export GROK_LIVE_WATCH="${GROK_LIVE_WATCH:-}"

pick_bin() {
  local c
  for c in \
    "$ROOT/target/debug/xai-grok-pager" \
    "$ROOT/target/release/xai-grok-pager" \
    "$(command -v grok 2>/dev/null || true)" \
    "$(command -v xai-grok-pager 2>/dev/null || true)"
  do
    if [[ -n "$c" && -x "$c" ]]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

BIN="$(pick_bin || true)"
if [[ -z "${BIN:-}" ]]; then
  echo "error: no xai-grok-pager binary — falling back to pop-out only"
  exec bash "$ROOT/scripts/launch-webgrid.sh" drone
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  echo "non-TTY · pop-out only"
  exec bash "$ROOT/scripts/launch-webgrid.sh" drone
fi

echo "==> /drone · fc-webgrid-drone-hud-v1 · standalone HUD"
echo "    binary: $BIN"
echo "    page:   $LIVE_DEMUX_WEBGRID_DRONE_URL"
echo ""
echo "  type:  /drone"
echo "  help:  /drone help"
echo ""

# Also fire pop-out so the surface is up immediately.
bash "$ROOT/scripts/launch-webgrid.sh" drone || true

exec "$BIN" --fullscreen
