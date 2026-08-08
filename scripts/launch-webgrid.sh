#!/usr/bin/env bash
# Launch Grok Build TUI for /webgrid (offline ugrad chase · half-block).
#
# Requires a real interactive Terminal window (not a pipe / agent non-TTY).
#
# Usage:
#   bash scripts/launch-webgrid.sh
#   bash scripts/launch-webgrid.sh human 16
#   bash scripts/launch-webgrid.sh turbo
#   bash scripts/launch-webgrid.sh popout
#   bash scripts/launch-webgrid.sh drone          # drone HUD pop-out
#   bash scripts/launch-webgrid.sh popout drone
#   bash scripts/launch-webgrid.sh hud            # alias · drone HUD
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HALFBLOCK_PAINT_TIMINGS="${HALFBLOCK_PAINT_TIMINGS:-1}"
export HALFBLOCK_PAINT_STAMP_PATH="${HALFBLOCK_PAINT_STAMP_PATH:-$HOME/.panda/packs/halfblock-paint-timings.json}"
export LIVE_DEMUX_W="${LIVE_DEMUX_W:-160}"
export LIVE_DEMUX_H="${LIVE_DEMUX_H:-90}"
export LIVE_DEMUX_FPS="${LIVE_DEMUX_FPS:-12}"
mkdir -p "$(dirname "$HALFBLOCK_PAINT_STAMP_PATH")"

ARGS=("$@")
POPOUT=0
DRONE=0
for a in "${ARGS[@]+"${ARGS[@]}"}"; do
  case "$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')" in
    popout|pop-out|out|--popout|-o|external)
      POPOUT=1
      ;;
    drone|hud|drone-hud|webgrid-drone|fleet|mavlink|elrs|rth)
      DRONE=1
      POPOUT=1
      ;;
  esac
done

# Pure pop-out: browser / MG only (no TUI).
if [[ "$POPOUT" -eq 1 ]]; then
  SITE="${MG_SITE:-$HOME/.panda/vision/cast/paper/site}"
  PWA="$ROOT/experiments/memory-glass/pwa"
  mkdir -p "$SITE"
  # Sync chase + drone HUD surfaces into paper/gamedev site.
  if [[ -f "$PWA/webgrid-ugrad.html" ]]; then
    cp -f "$PWA/webgrid-ugrad.html" "$SITE/webgrid-ugrad.html" 2>/dev/null || true
  fi
  if [[ -f "$PWA/webgrid-drone-hud.html" ]]; then
    cp -f "$PWA/webgrid-drone-hud.html" "$SITE/webgrid-drone-hud.html" 2>/dev/null || true
  fi
  # drone HUD modules + hotpipe bridge
  if [[ -d "$PWA/ugrad" ]]; then
    mkdir -p "$SITE/ugrad"
    cp -f "$PWA/ugrad"/drone-*.js "$SITE/ugrad/" 2>/dev/null || true
  fi
  if [[ -f "$ROOT/experiments/memory-glass/hotpipe/drone-hotpipe.js" ]]; then
    mkdir -p "$SITE/hotpipe"
    cp -f "$ROOT/experiments/memory-glass/hotpipe/drone-hotpipe.js" "$SITE/hotpipe/" 2>/dev/null || true
  fi
  if [[ "$DRONE" -eq 1 ]]; then
    WG_URL="${LIVE_DEMUX_WEBGRID_DRONE_URL:-http://127.0.0.1:8790/webgrid-drone-hud.html?backend=sim&units=4&demo=rows&track=motion}"
  else
    WG_URL="${LIVE_DEMUX_WEBGRID_URL:-http://127.0.0.1:8790/webgrid-ugrad.html?gamedev=1&tick=sim&N=30&dur=20&auto=1}"
  fi
  if ! curl -sf -o /dev/null --connect-timeout 1 "http://127.0.0.1:8790/" 2>/dev/null; then
    if [[ -d "$SITE" ]]; then
      (cd "$SITE" && python3 -m http.server 8790 >/dev/null 2>&1 &)
      sleep 0.4
    elif [[ -d "$PWA" ]]; then
      (cd "$PWA" && python3 -m http.server 8790 >/dev/null 2>&1 &)
      sleep 0.4
    fi
  fi
  echo "webgrid pop-out · $WG_URL"
  open "$WG_URL" 2>/dev/null || true
  if [[ -d "$HOME/Applications/Memory Glass.app" ]]; then
    open -a "Memory Glass" "$WG_URL" 2>/dev/null || true
  fi
  exit 0
fi

has_feature() {
  local bin="$1" needle="$2"
  [[ -x "$bin" ]] || return 1
  python3 - "$bin" "$needle" <<'PY' 2>/dev/null
import sys
path, needle = sys.argv[1], sys.argv[2].encode()
with open(path, "rb") as f:
    data = f.read()
sys.exit(0 if needle in data else 1)
PY
}

pick_bin() {
  local c
  for c in \
    "$ROOT/target/debug/xai-grok-pager" \
    "$ROOT/target/release/xai-grok-pager" \
    "$(command -v grok 2>/dev/null || true)" \
    "$(command -v xai-grok-pager 2>/dev/null || true)"
  do
    if has_feature "$c" "fc-webgrid-tty"; then
      echo "$c"
      return 0
    fi
  done
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
  echo "error: no xai-grok-pager binary found."
  echo "build:  cargo build -p xai-grok-pager-bin"
  exit 1
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  echo "error: Device not configured / non-TTY"
  echo "Grok TUI needs a real terminal. Open Terminal.app and run:"
  echo "  $ROOT/scripts/launch-webgrid.sh"
  exit 6
fi

export GROK_NEW_SESSION_AT_STARTUP=1
# Auto-open via live-watch env only if the pager supports it for webgrid://
# Prefer landing on agent prompt with a toast — user types /webgrid.
# When GROK_LIVE_WATCH is set, watch auto-open may still accept webgrid:// toolchain URL.
if [[ ${#ARGS[@]} -gt 0 ]]; then
  export GROK_LIVE_WATCH="webgrid ${ARGS[*]}"
else
  export GROK_LIVE_WATCH="webgrid://agent"
fi

echo "==> /webgrid · fc-webgrid-tty-v1 · half-block ugrad chase"
echo "    binary: $BIN"
echo "    auto:   ${GROK_LIVE_WATCH}"
echo ""
echo "  /webgrid                 # agent chase"
echo "  /webgrid human 16        # human · 16×16"
echo "  /webgrid turbo | popout"
echo "  /drone                   # standalone drone HUD (prefer over /webgrid drone)"
echo "  keys: arrows · space hit · a agent · r restart · o browser · Esc"
echo ""

exec "$BIN" --fullscreen
