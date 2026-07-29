#!/usr/bin/env bash
# Launch Grok Build TUI for /gboom easter egg (fornevercollective half-block).
# Requires a real interactive Terminal window (not a pipe / agent non-TTY).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HALFBLOCK_PAINT_TIMINGS="${HALFBLOCK_PAINT_TIMINGS:-1}"
export HALFBLOCK_PAINT_STAMP_PATH="${HALFBLOCK_PAINT_STAMP_PATH:-$HOME/.panda/packs/halfblock-paint-timings.json}"
mkdir -p "$(dirname "$HALFBLOCK_PAINT_STAMP_PATH")"

# Prefer a binary that ships half-block fallback (fc-halfblock-tty-video).
# Stale release builds often have /gboom but only the Kitty path — on
# Terminal.app that looks like "opened but won't load".
has_halfblock() {
  local bin="$1"
  [[ -x "$bin" ]] || return 1
  # Small bounded scan: feature id is ASCII and unique to the fork path.
  python3 - "$bin" <<'PY' 2>/dev/null
import sys
path = sys.argv[1]
needle = b"fc-halfblock"
with open(path, "rb") as f:
    # mmap whole file is fine; exit as soon as found
    data = f.read()
sys.exit(0 if needle in data else 1)
PY
}

pick_bin() {
  local c
  # Order: debug (dev half-block work) → release → PATH installs
  for c in \
    "$ROOT/target/debug/xai-grok-pager" \
    "$ROOT/target/release/xai-grok-pager" \
    "$(command -v grok 2>/dev/null || true)" \
    "$(command -v xai-grok-pager 2>/dev/null || true)"
  do
    if has_halfblock "$c"; then
      echo "$c"
      return 0
    fi
  done
  # Fallback: any executable (Kitty-only /gboom may still work in Kitty/iTerm)
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
  echo "   or:  cargo build -p xai-grok-pager-bin --release"
  exit 1
fi

if ! has_halfblock "$BIN"; then
  echo "warning: selected binary lacks half-block fallback (fc-halfblock)."
  echo "  binary: $BIN"
  echo "  On Terminal.app / plain truecolor TTY, /gboom may open with no paint."
  echo "  Rebuild the fork build: cargo build -p xai-grok-pager-bin"
  echo ""
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  echo "error: Device not configured / non-TTY"
  echo "Grok TUI needs a real terminal. Open Terminal.app and run:"
  echo "  $ROOT/scripts/launch-gboom.sh"
  exit 6
fi

echo "binary: $BIN"
echo "paint stamp: $HALFBLOCK_PAINT_STAMP_PATH"
echo ""
echo "How to play:"
echo "  1. Wait until you are on an *agent* chat (composer at bottom), not the dashboard."
echo "     If you land on the session list / welcome, open or start a chat first."
echo "  2. Type exactly:  /gboom   (no arguments) and Enter"
echo "  3. Controls: WASD move · Space/Enter fire · Esc/q quit"
echo "  Expect toast if no Kitty: fornevercollective half-block …"
echo ""

exec "$BIN" "$@"
