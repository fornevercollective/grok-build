#!/usr/bin/env bash
# Launch Grok TUI for /language multi-stream keyboard translation.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export GROK_NEW_SESSION_AT_STARTUP=1
export HALFBLOCK_PAINT_TIMINGS="${HALFBLOCK_PAINT_TIMINGS:-1}"
MODE="all"
POPOUT=0
for a in "$@"; do
  case "$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')" in
    layout|translate|codec|all) MODE="$a" ;;
    popout|out|--popout|-o) POPOUT=1 ;;
  esac
done
export FC_LANGUAGE_MODE="$MODE"
if [[ "$POPOUT" -eq 1 ]]; then
  URL="${LIVE_DEMUX_LANGUAGE_URL:-http://127.0.0.1:8790/webgrid-ugrad.html?mg_kb=1&lang=all}"
  echo "language pop-out · $URL"
  open "$URL" 2>/dev/null || true
  [[ -d "$HOME/Applications/Memory Glass.app" ]] && open -a "Memory Glass" "$URL" 2>/dev/null || true
  exit 0
fi
pick() {
  for c in "$ROOT/target/debug/xai-grok-pager" "$ROOT/target/release/xai-grok-pager" "$(command -v grok-fc 2>/dev/null)" "$(command -v grok 2>/dev/null)"; do
    [[ -n "$c" && -x "$c" ]] && { echo "$c"; return; }
  done
  return 1
}
BIN="$(pick || true)"
[[ -n "${BIN:-}" ]] || { echo "error: no pager binary"; exit 1; }
if [[ ! -t 0 || ! -t 1 ]]; then
  echo "error: needs real TTY — use: bash scripts/launch-language.sh popout"
  exit 6
fi
echo "==> /language · fc-language-stream-v1 · mode=$MODE"
echo "    binary: $BIN"
exec env GROK_NEW_SESSION_AT_STARTUP=1 FC_LANGUAGE_MODE="$MODE" "$BIN" --fullscreen
