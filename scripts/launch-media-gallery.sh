#!/usr/bin/env bash
# Open each media surface in its own Terminal.app Grok pager window for snapshots.
# fornevercollective · fc-media-suite
#
#   bash scripts/launch-media-gallery.sh
#   bash scripts/launch-media-gallery.sh --news   # also one pager per news channel
#
# Each window is a full xai-grok-pager with auto-open slash surface.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NEWS=0
for a in "$@"; do
  case "$a" in
    --news|-n) NEWS=1 ;;
    -h|--help)
      cat <<EOF
Usage: launch-media-gallery.sh [--news]

Opens separate Terminal.app windows:
  · WATCH · bloomberg
  · WATCH · vevo
  · WATCH · trailers
  · CAM   · large self-view + stream
  · CLOCK · /timesync
  · MAP   · /map starbase
  · GBOOM · half-block game (if launch-gboom.sh exists)

  --news  also open one pager per LiveNews channel (ABC…Weather)

Requires macOS Terminal.app + built binary with fc-* stamps.
EOF
      exit 0 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: macOS Terminal.app gallery only"
  exit 1
fi

BIN=""
# Prefer newest build that has live demux (debug often newer during gallery work).
candidates=(
  "$ROOT/target/debug/xai-grok-pager"
  "$ROOT/target/release/xai-grok-pager"
  "$(command -v grok 2>/dev/null || true)"
)
newest=0
for c in "${candidates[@]}"; do
  [[ -n "$c" && -x "$c" ]] || continue
  python3 -c "import sys; d=open(sys.argv[1],'rb').read(); sys.exit(0 if b'fc-live-demux' in d else 1)" "$c" 2>/dev/null || continue
  m=$(python3 -c "import os,sys; print(int(os.path.getmtime(sys.argv[1])))" "$c" 2>/dev/null || echo 0)
  if [[ "${m:-0}" -ge "${newest:-0}" ]]; then
    newest=$m
    BIN="$c"
  fi
done
if [[ -z "$BIN" ]]; then
  echo "error: no fc-live-demux binary — cargo build -p xai-grok-pager-bin"
  exit 1
fi
# Restore release if we moved it aside earlier
[[ -x "$ROOT/target/release/xai-grok-pager.bak" && ! -x "$ROOT/target/release/xai-grok-pager" ]] \
  && mv "$ROOT/target/release/xai-grok-pager.bak" "$ROOT/target/release/xai-grok-pager" 2>/dev/null || true

GALLERY_DIR="${TMPDIR:-/tmp}/fc-media-gallery-$$"
mkdir -p "$GALLERY_DIR"

open_pager() {
  local title="$1"
  local exports="$2"   # e.g. GROK_LIVE_WATCH=bloomberg
  local slug runner
  slug=$(echo "$title" | tr -cs 'A-Za-z0-9._-' '_' | sed 's/__*/_/g;s/^_//;s/_$//')
  runner="$GALLERY_DIR/${slug}.sh"
  cat >"$runner" <<EOF
#!/usr/bin/env bash
cd $(printf %q "$ROOT") || exit 1
export HALFBLOCK_PAINT_TIMINGS=1
export GROK_NEW_SESSION_AT_STARTUP=1
# per-window env
$exports
echo "$title"
echo "binary: $BIN"
exec $(printf %q "$BIN")
EOF
  chmod +x "$runner"
  # AppleScript only gets a simple path — no nested quotes.
  osascript -e "tell application \"Terminal\" to activate" \
    -e "tell application \"Terminal\" to do script \"bash $(printf %q "$runner")\"" \
    -e "delay 0.2" \
    -e "tell application \"Terminal\" to set custom title of front window to \"$title\"" \
    >/dev/null
  echo "opened: $title"
  sleep 0.5
}

echo "==> media gallery · binary $BIN"
echo "    each line = one Terminal window with auto-open modal"
echo ""

# Core suite
open_pager "WATCH · bloomberg" "GROK_LIVE_WATCH=bloomberg"
open_pager "WATCH · vevo" "GROK_LIVE_WATCH=vevo"
open_pager "WATCH · trailers" "GROK_LIVE_WATCH=trailers"
open_pager "CAM · large" "GROK_LIVE_WATCH=vevo LIVE_DEMUX_CAM_ON=1 GROK_LIVE_WATCH_CAM=1 LIVE_DEMUX_CAM_CAPTURE=640x480"
open_pager "CLOCK · timesync" "GROK_OPEN_TIMESYNC=1"
open_pager "MAP · starbase" "GROK_MAP_TARGET=starbase"

if [[ -x "$ROOT/scripts/launch-gboom.sh" ]] || [[ -x "$BIN" ]]; then
  # gboom via env if present; otherwise just open pager (user types /gboom)
  if python3 -c "import sys; d=open(sys.argv[1],'rb').read(); sys.exit(0 if b'fc-halfblock' in d else 1)" "$BIN" 2>/dev/null; then
    open_pager "GBOOM · half-block" "GROK_NEW_SESSION_AT_STARTUP=1"
  fi
fi

if [[ "$NEWS" -eq 1 ]]; then
  echo ""
  echo "==> news pack (one pager each)"
  for ch in abc bloomberg cbs cnbc cnn fox msnbc nbc pbs reuters bbc dw euronews france24 sky aljazeera nhk nasa weather; do
    open_pager "NEWS · $ch" "GROK_LIVE_WATCH=$ch"
  done
fi

echo ""
echo "Done. Arrange windows and grab snapshots."
echo "Close a window with Esc in the modal, then quit the pager (or close the Terminal tab)."
echo "Re-run with --news for every news station in its own pager."
