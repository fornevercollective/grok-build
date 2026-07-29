#!/usr/bin/env bash
# Summon Grok + companion panes: monitor fleet · optional clock/map side terminals.
# fornevercollective · pairs with /clock /map /monitor inside Grok.
#
#   bash scripts/launch-summon.sh
#   bash scripts/launch-summon.sh --with-clock --with-map
#   bash scripts/launch-summon.sh --map-original 1.1.1.1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WITH_CLOCK=0
WITH_MAP=0
MAP_ORIGINAL=0
MAP_TARGET="1.1.1.1"
MONITOR=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-clock|--clock) WITH_CLOCK=1; shift ;;
    --with-map|--map) WITH_MAP=1; shift ;;
    --map-original|--original)
      WITH_MAP=1; MAP_ORIGINAL=1
      shift
      if [[ "${1:-}" != -* && -n "${1:-}" ]]; then MAP_TARGET="$1"; shift; fi
      ;;
    --no-monitor) MONITOR=0; shift ;;
    -h|--help)
      cat <<EOF
Usage: launch-summon.sh [--with-clock] [--with-map] [--map-original [host]]

Opens Terminal.app panes:
  1) Grok TUI  → type /clock /map /monitor
  2) fleet monitor loop (terminal-fleet-status.py --watch 2)
  3) optional: standalone timesync clock
  4) optional: maptrace original (popout)

Inside Grok agent composer:
  /clock          timesync modal
  /map            maptrace in-Grok
  /map original   à la carte maptrace TUI
  /monitor        fleet board (this pane's data)
EOF
      exit 0 ;;
    *) echo "unknown: $1"; exit 2 ;;
  esac
done

pick_bin() {
  local c
  for c in \
    "$ROOT/target/debug/xai-grok-pager" \
    "$ROOT/target/release/xai-grok-pager" \
    "$(command -v grok 2>/dev/null || true)"
  do
    if [[ -n "$c" && -x "$c" ]]; then
      # prefer binary with timesync+map
      if python3 -c "import sys; d=open(sys.argv[1],'rb').read(); sys.exit(0 if b'fc-timesync-v1' in d and b'fc-maptrace-v1' in d else 1)" "$c" 2>/dev/null; then
        echo "$c"
        return 0
      fi
    fi
  done
  for c in \
    "$ROOT/target/debug/xai-grok-pager" \
    "$ROOT/target/release/xai-grok-pager" \
    "$(command -v grok 2>/dev/null || true)"
  do
    [[ -n "$c" && -x "$c" ]] && { echo "$c"; return 0; }
  done
  return 1
}

BIN="$(pick_bin || true)"
FLEET="$ROOT/scripts/terminal-fleet-status.py"
CLOCK_SH="$ROOT/scripts/timesync-world-clock.py"
MAP_SH="$ROOT/scripts/launch-map.sh"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS Terminal.app summon only — start manually:"
  echo "  ${BIN:-cargo run -p xai-grok-pager-bin}"
  echo "  python3 $FLEET --watch 2"
  exit 0
fi

GROK_CMD=""
if [[ -n "${BIN:-}" ]]; then
  GROK_CMD="$(printf %q "$BIN")"
else
  GROK_CMD="cargo run -p xai-grok-pager-bin"
fi

# Build AppleScript with optional panes
AS="tell application \"Terminal\"
  activate
  do script \"cd $(printf %q "$ROOT") && echo 'SUMMON · type /clock /map /monitor in agent composer' && $GROK_CMD\"
  set custom title of front window to \"Grok\"
  delay 0.3
"

if [[ "$MONITOR" -eq 1 ]]; then
  AS+="
  do script \"cd $(printf %q "$ROOT") && python3 $(printf %q "$FLEET") --watch 2\"
  set custom title of front window to \"Fleet monitor\"
  delay 0.2
"
fi

if [[ "$WITH_CLOCK" -eq 1 ]]; then
  AS+="
  do script \"cd $(printf %q "$ROOT") && python3 $(printf %q "$CLOCK_SH") --mode auto\"
  set custom title of front window to \"Clock\"
  delay 0.2
"
fi

if [[ "$WITH_MAP" -eq 1 ]]; then
  if [[ "$MAP_ORIGINAL" -eq 1 ]]; then
    AS+="
  do script \"cd $(printf %q "$ROOT") && bash $(printf %q "$MAP_SH") popout $(printf %q "$MAP_TARGET")\"
  set custom title of front window to \"Map original\"
  delay 0.2
"
  else
    AS+="
  do script \"cd $(printf %q "$ROOT") && echo 'type /map in Grok · or: bash scripts/launch-map.sh popout $MAP_TARGET' && sleep 3600\"
  set custom title of front window to \"Map hint\"
  delay 0.2
"
  fi
fi

AS+="
end tell"

osascript -e "$AS"
echo "summoned · Grok + monitor${WITH_CLOCK:+ + clock}${WITH_MAP:+ + map}"
echo "in Grok:  /clock   /map   /map original $MAP_TARGET   /monitor"
