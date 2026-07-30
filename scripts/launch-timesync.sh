#!/usr/bin/env bash
# Launch Grok Build TUI for /timesync (fornevercollective · fc-timesync-v1).
# Same class as launch-watch / launch-gboom: real Terminal + type slash in Grok.
#
#   bash scripts/launch-timesync.sh
#   # then type:  /timesync
#
# Standalone Python (resize-safe alt-screen, not in-Grok modal):
#   bash scripts/launch-timesync.sh --standalone
#   bash scripts/launch-timesync.sh --once
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HALFBLOCK_PAINT_TIMINGS="${HALFBLOCK_PAINT_TIMINGS:-1}"
export HALFBLOCK_PAINT_STAMP_PATH="${HALFBLOCK_PAINT_STAMP_PATH:-$HOME/.panda/packs/halfblock-paint-timings.json}"
PIPE_DEFAULT="${TIMESYNC_PIPE:-$HOME/.panda/packs/timesync.jsonl}"
mkdir -p "$(dirname "$HALFBLOCK_PAINT_STAMP_PATH")" "$(dirname "$PIPE_DEFAULT")" 2>/dev/null || true

usage() {
  cat <<EOF
timesync · launch (in-Grok modal preferred)

  $0                  open Grok TUI; type /timesync
  $0 --standalone     Python TUI only (alt-screen; resize-safe)
  $0 --once / --json  agent-safe one-shot (standalone)

In Grok agent composer (not dashboard):
  /timesync
  aliases: /clock /zulu /worldclock /epoch

Keys: Esc close · m layout · r reset-drift · n ntp
Stretch the Grok window — modal reflows every paint (no ghost paint).
EOF
}

STANDALONE=0
PASSTHRU=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --standalone|--python) STANDALONE=1; shift ;;
    --once|--json|--pretty|--full|--compact|--no-pipe)
      STANDALONE=1
      PASSTHRU+=("$1")
      shift
      ;;
    --pipe|--mode|--cols|--rows|--interval|--pipe-interval)
      STANDALONE=1
      PASSTHRU+=("$1")
      shift
      if [[ $# -gt 0 && "$1" != -* ]]; then
        PASSTHRU+=("$1")
        shift
      fi
      ;;
    *) PASSTHRU+=("$1"); shift ;;
  esac
done

if [[ "$STANDALONE" -eq 1 ]]; then
  MODE_ARGS=(--mode auto)
  PIPE_ARGS=(--pipe "$PIPE_DEFAULT")
  for a in "${PASSTHRU[@]+"${PASSTHRU[@]}"}"; do
    case "$a" in
      --full) MODE_ARGS=(--mode full) ;;
      --compact) MODE_ARGS=(--mode compact) ;;
      --no-pipe) PIPE_ARGS=() ;;
    esac
  done
  # filter mode flags already handled
  CLEAN=()
  skip_next=0
  for a in "${PASSTHRU[@]+"${PASSTHRU[@]}"}"; do
    if [[ $skip_next -eq 1 ]]; then skip_next=0; continue; fi
    case "$a" in
      --full|--compact|--no-pipe) ;;
      --pipe|--mode) skip_next=1 ;;
      *) CLEAN+=("$a") ;;
    esac
  done
  exec python3 "$ROOT/scripts/timesync-world-clock.py" \
    "${MODE_ARGS[@]}" "${PIPE_ARGS[@]+"${PIPE_ARGS[@]}"}" "${CLEAN[@]+"${CLEAN[@]}"}"
fi

has_feature() {
  local bin="$1" needle="$2"
  [[ -x "$bin" ]] || return 1
  python3 - "$bin" "$needle" <<'PY' 2>/dev/null
import sys
path, needle = sys.argv[1], sys.argv[2].encode()
with open(path, "rb") as f:
    sys.exit(0 if needle in f.read() else 1)
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
    if has_feature "$c" "fc-timesync-v1"; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

BIN="$(pick_bin || true)"
USE_CARGO=0
if [[ -z "${BIN:-}" ]]; then
  USE_CARGO=1
fi

open_macos() {
  local cmd="$1"
  osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "cd $(printf %q "$ROOT") && export GROK_NEW_SESSION_AT_STARTUP=1 GROK_OPEN_TIMESYNC=1 HALFBLOCK_PAINT_TIMINGS=1 && echo 'CLOCK · auto /timesync' && ${cmd}"
  set custom title of front window to "CLOCK · /timesync"
end tell
APPLESCRIPT
  echo "opened Terminal.app — auto /timesync (GROK_OPEN_TIMESYNC=1)"
}

# Always auto-open clock when launching the TUI path.
export GROK_NEW_SESSION_AT_STARTUP=1
export GROK_OPEN_TIMESYNC=1

if [[ ! -t 0 || ! -t 1 ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if [[ "$USE_CARGO" -eq 1 ]]; then
      open_macos "cargo run -p xai-grok-pager-bin"
    else
      open_macos "$(printf %q "$BIN")"
    fi
    exit 0
  fi
  echo "error: non-TTY — open a real terminal and run:" >&2
  echo "  $ROOT/scripts/launch-timesync.sh" >&2
  exit 6
fi

echo "timesync · fornevercollective · fc-timesync-v1"
echo "  auto-open: /timesync  (GROK_OPEN_TIMESYNC=1)"
echo "  aliases: /clock /zulu · Esc close · m layout · r reset · n ntp"
echo ""

if [[ "$USE_CARGO" -eq 1 ]]; then
  echo "no fc-timesync-v1 binary → cargo run -p xai-grok-pager-bin"
  exec cargo run -p xai-grok-pager-bin
fi
echo "binary: $BIN"
exec "$BIN"
