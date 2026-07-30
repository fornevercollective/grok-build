#!/usr/bin/env bash
# Launch Grok Build TUI for /map maptrace (fornevercollective · fc-maptrace-v1).
#
#   bash scripts/launch-map.sh                 # TUI → type /map
#   bash scripts/launch-map.sh popout 1.1.1.1  # external maptrace only
#   bash scripts/launch-map.sh web example.com
#   bash scripts/launch-map.sh --auto 8.8.8.8  # open Grok and auto /map
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HALFBLOCK_PAINT_TIMINGS="${HALFBLOCK_PAINT_TIMINGS:-1}"
export MAPTRACE_BIN="${MAPTRACE_BIN:-}"
# Prefer known maptrace install
if [[ -z "$MAPTRACE_BIN" ]]; then
  for c in \
    "$HOME/dev/maptrace/bin/maptrace.js" \
    "$(command -v maptrace 2>/dev/null || true)"
  do
    if [[ -n "$c" && -e "$c" ]]; then
      export MAPTRACE_BIN="$c"
      break
    fi
  done
fi

POPOUT=0
WEB=0
AUTO=0
TARGET=""
PAGER_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    popout|pop-out|out|--popout|-o|external)
      POPOUT=1; shift ;;
    web|browser|--web|-w)
      POPOUT=1; WEB=1; shift ;;
    --auto|auto)
      AUTO=1; shift ;;
    --)
      shift; PAGER_ARGS+=("$@"); break ;;
    -h|--help)
      cat <<EOF
Usage: launch-map.sh [popout|web] [target|--auto] [-- pager-args...]

  (no args)           Start Grok — type /map
  --auto [target]     Start Grok and open /map (GROK_MAP_TARGET)
  popout 1.1.1.1      External maptrace TUI only
  web example.com     External maptrace web UI
  Inside /map modal: o pop-out · w web · t target · r re-trace · Esc quit
EOF
      exit 0 ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$1"; else PAGER_ARGS+=("$1"); fi
      shift ;;
  esac
done

TARGET="${TARGET:-1.1.1.1}"

BIN=""
for c in \
  "$ROOT/target/release/xai-grok-pager" \
  "$ROOT/target/debug/xai-grok-pager" \
  "$(command -v grok 2>/dev/null || true)" \
  "$(command -v xai-grok-pager 2>/dev/null || true)"
do
  if [[ -n "$c" && -x "$c" ]]; then
    BIN="$c"
    break
  fi
done

# Place aliases → network host (CDN ≠ physical site)
case "$(echo "$TARGET" | tr '[:upper:]' '[:lower:]' | tr '_ ' '--')" in
  starbase|sbx|boca|boca-chica|bocachica|spacex-base|spacex-texas|spacex-tx|base-texas|texas-base|spacex)
    echo "note: place alias → network host spacex.com (Cloudflare CDN, not Boca Chica)"
    echo "      SBX physical pin is in-Grok only  (25.997°N 97.157°W)"
    TARGET="spacex.com"
    ;;
esac

traceroute_fallback() {
  local t="$1"
  echo "map · pop-out · traceroute fallback · $t"
  echo "  (maptrace native/sqlite unavailable or arch mismatch)"
  if [[ "$(uname -s)" == "Darwin" ]] && [[ -t 1 ]]; then
    # Prefer a new Terminal window so it works even from non-TTY agents.
    osascript -e "tell application \"Terminal\" to do script \"clear; echo 'MAP pop-out · traceroute'; echo target: $t; traceroute -n -q 1 -m 18 $t; echo; echo done; read\"" \
      && return 0
  fi
  exec traceroute -n -q 1 -m 18 "$t"
}

if [[ "$POPOUT" -eq 1 ]]; then
  echo "map · pop-out · target=$TARGET · web=$WEB"
  if [[ -n "${MAPTRACE_BIN:-}" ]]; then
    # Probe sqlite3 native arch under this Node (arm64 .node + x64 node = fail).
    if [[ "$MAPTRACE_BIN" == *.js ]]; then
      MT_ROOT="$(cd "$(dirname "$MAPTRACE_BIN")/.." && pwd)"
      if ! (cd "$MT_ROOT" && node -e "require('sqlite3')" >/dev/null 2>&1); then
        echo "maptrace: native module load failed under node $(node -p process.arch 2>/dev/null || echo '?')"
        traceroute_fallback "$TARGET"
        exit 0
      fi
      if [[ "$WEB" -eq 1 ]]; then
        exec node "$MAPTRACE_BIN" "$TARGET" --web --port 3847
      else
        exec node "$MAPTRACE_BIN" "$TARGET"
      fi
    else
      if [[ "$WEB" -eq 1 ]]; then
        exec "$MAPTRACE_BIN" "$TARGET" --web --port 3847
      else
        exec "$MAPTRACE_BIN" "$TARGET"
      fi
    fi
  fi
  echo "maptrace not found (set MAPTRACE_BIN) — traceroute fallback"
  traceroute_fallback "$TARGET"
  exit 0
fi

if [[ -z "$BIN" ]]; then
  echo "error: no xai-grok-pager binary. build: cargo build -p xai-grok-pager-bin --release"
  exit 1
fi

export GROK_NEW_SESSION_AT_STARTUP=1
# Default auto-open /map so gallery/snapshot launches work without typing.
if [[ "$AUTO" -eq 1 ]] || [[ -n "${GROK_MAP_TARGET:-}" ]] || [[ ! -t 0 || ! -t 1 ]]; then
  export GROK_MAP_TARGET="${GROK_MAP_TARGET:-$TARGET}"
  AUTO=1
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "cd $(printf %q "$ROOT") && export GROK_NEW_SESSION_AT_STARTUP=1 GROK_MAP_TARGET=$(printf %q "${GROK_MAP_TARGET:-$TARGET}") HALFBLOCK_PAINT_TIMINGS=1 && echo 'MAP · auto /map' && $(printf %q "$BIN")"
  set custom title of front window to "MAP · /map"
end tell
APPLESCRIPT
    echo "opened Terminal.app — auto /map ${GROK_MAP_TARGET:-$TARGET}"
    exit 0
  fi
  echo "error: non-TTY — open Terminal.app and run:"
  echo "  $ROOT/scripts/launch-map.sh --auto"
  exit 6
fi

echo "binary: $BIN"
echo "maptrace: ${MAPTRACE_BIN:-not found (in-Grok map still works)}"
echo ""
if [[ "$AUTO" -eq 1 ]]; then
  export GROK_MAP_TARGET="$TARGET"
  echo "auto-map: /map $TARGET"
else
  echo "When TUI is up, type:"
  echo "  /map"
  echo "  /map $TARGET"
  echo "  /map popout $TARGET"
  echo "  /map web $TARGET"
fi
echo "  o pop-out · w web · t target · r re-trace · Esc quit"
echo ""

exec "$BIN" "${PAGER_ARGS[@]}"
