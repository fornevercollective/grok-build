#!/usr/bin/env bash
# deploy-fc-grok.sh — main Terminal deploy for fornevercollective Grok
#
# NOT the stock x.ai `grok` release and NOT a bare `cargo run -p xai-grok-pager-bin`
# workflow. Builds the fork TUI once, installs it as the **main `grok` command**
# for new Terminal windows, and optionally opens one.
#
#   bash scripts/deploy-fc-grok.sh              # build + install main grok
#   bash scripts/deploy-fc-grok.sh --open       # + open new Terminal.app
#   bash scripts/deploy-fc-grok.sh --open /cam  # + auto /cam wave·talk·track
#   bash scripts/deploy-fc-grok.sh --debug      # faster debug build
#   bash scripts/deploy-fc-grok.sh --restore    # put official x.ai grok back
#
# What it installs (PATH order on this machine: ~/.grok/bin first):
#   ~/.grok/bin/grok              → fork binary (main entry for new terminals)
#   ~/.grok/bin/grok-stable       → previous official binary (backup)
#   ~/.local/bin/grok             → same fork (belt-and-suspenders)
#   ~/.local/bin/grok-fc          → same fork (explicit alias)
#
# Feature stamps required: fc-live-demux · fc-cam-talk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROFILE=release
OPEN=0
RESTORE=0
SKIP_BUILD=0
AUTO_CAM=0
EXTRA_ENV=()
OPEN_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --debug|-d) PROFILE=debug ;;
    --release|-r) PROFILE=release ;;
    --open|-o) OPEN=1 ;;
    --restore) RESTORE=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    /cam|cam|--cam)
      OPEN=1
      AUTO_CAM=1
      ;;
    --help|-h)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      OPEN_ARGS+=("$arg")
      ;;
  esac
done

GROK_HOME="${GROK_HOME:-$HOME/.grok}"
BIN_DIR="$GROK_HOME/bin"
LOCAL_BIN="${HOME}/.local/bin"
DOWNLOADS="${GROK_HOME}/downloads"
STAMP_LIVE="fc-live-demux"
STAMP_CAM="fc-cam-talk"

has_stamp() {
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

restore_official() {
  echo "==> restore official x.ai grok"
  if [[ -x "$BIN_DIR/grok-stable" ]]; then
    ln -sfn "$(readlink "$BIN_DIR/grok-stable" 2>/dev/null || echo "$BIN_DIR/grok-stable")" \
      "$BIN_DIR/grok" 2>/dev/null \
      || cp -f "$BIN_DIR/grok-stable" "$BIN_DIR/grok"
    # Prefer re-pointing to last official download if present.
    local official
    official="$(/bin/ls -t "$DOWNLOADS"/grok-* 2>/dev/null | /usr/bin/head -1 || true)"
    if [[ -n "${official:-}" && -x "$official" ]]; then
      ln -sfn "$official" "$BIN_DIR/grok"
      ln -sfn "$BIN_DIR/grok" "$LOCAL_BIN/grok" 2>/dev/null || true
    fi
    echo "    restored: $($BIN_DIR/grok --version 2>&1 | head -1)"
    exit 0
  fi
  local official
  official="$(/bin/ls -t "$DOWNLOADS"/grok-* 2>/dev/null | /usr/bin/head -1 || true)"
  if [[ -n "${official:-}" && -x "$official" ]]; then
    ln -sfn "$official" "$BIN_DIR/grok"
    echo "    restored from downloads: $($BIN_DIR/grok --version 2>&1 | head -1)"
    exit 0
  fi
  echo "error: no grok-stable or downloads/grok-* to restore" >&2
  exit 1
}

if [[ "$RESTORE" -eq 1 ]]; then
  restore_official
fi

echo "==> deploy-fc-grok · main Terminal Grok (fornevercollective)"
echo "    root:    $ROOT"
echo "    profile: $PROFILE"

BUILT="$ROOT/target/$PROFILE/xai-grok-pager"

if [[ "$SKIP_BUILD" -ne 1 ]]; then
  echo "==> building xai-grok-pager-bin ($PROFILE) with cam-talk"
  if [[ "$PROFILE" == "release" ]]; then
    cargo build -p xai-grok-pager-bin --release
  else
    cargo build -p xai-grok-pager-bin
  fi
else
  echo "==> skip build (using existing $BUILT)"
fi

if [[ ! -x "$BUILT" ]]; then
  echo "error: missing binary $BUILT" >&2
  exit 1
fi

if ! has_stamp "$BUILT" "$STAMP_LIVE"; then
  echo "error: binary lacks $STAMP_LIVE — wrong tree or build failed" >&2
  exit 1
fi
if ! has_stamp "$BUILT" "$STAMP_CAM"; then
  echo "error: binary lacks $STAMP_CAM — rebuild after cam-talk land" >&2
  echo "  expected: mic.rs FEATURE_ID + live_demux FEATURE_CAM_TALK" >&2
  exit 1
fi

echo "==> stamps OK · $STAMP_LIVE · $STAMP_CAM"

# Install under ~/.grok/downloads as a versioned fork artifact, then point main grok at it.
mkdir -p "$DOWNLOADS" "$BIN_DIR" "$LOCAL_BIN"
REV="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$DOWNLOADS/grok-fc-${REV}-${STAMP}"
cp -f "$BUILT" "$DEST"
chmod +x "$DEST"

# Preserve official binary once (before first fc deploy).
if [[ -e "$BIN_DIR/grok" && ! -e "$BIN_DIR/grok-stable" ]]; then
  if [[ -L "$BIN_DIR/grok" ]]; then
    target="$(readlink "$BIN_DIR/grok")"
    # Only backup if it does not already look like our fc deploy.
    if [[ "$target" != *grok-fc-* ]]; then
      ln -sfn "$target" "$BIN_DIR/grok-stable"
      echo "    backed up official → grok-stable"
    fi
  else
    cp -f "$BIN_DIR/grok" "$BIN_DIR/grok-stable"
    echo "    backed up official binary → grok-stable"
  fi
fi

# Main entry: what `grok` resolves to in new terminals (~/.grok/bin first on PATH).
ln -sfn "$DEST" "$BIN_DIR/grok"
# Explicit aliases
ln -sfn "$DEST" "$BIN_DIR/grok-fc"
ln -sfn "$DEST" "$LOCAL_BIN/grok-fc"
# Keep ~/.local/bin/grok on the fork too (PATH may put local before/after).
ln -sfn "$DEST" "$LOCAL_BIN/grok"

echo "==> installed main grok"
echo "    binary:  $DEST"
echo "    link:    $BIN_DIR/grok"
echo "    version: $($BIN_DIR/grok --version 2>&1 | head -1 || echo unknown)"
echo "    stamps:  $STAMP_LIVE YES · $STAMP_CAM YES"
echo "    restore: bash $ROOT/scripts/deploy-fc-grok.sh --restore"

# Env for cam talk in new sessions (harmless if unused).
export LIVE_DEMUX_MIC="${LIVE_DEMUX_MIC:-1}"
export LIVE_DEMUX_CAM_CAPTURE="${LIVE_DEMUX_CAM_CAPTURE:-640x480}"

if [[ "$OPEN" -eq 1 ]]; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "note: --open is macOS Terminal.app only; run: grok"
    exit 0
  fi
  RUNNER="${TMPDIR:-/tmp}/fc-grok-main-$$.sh"
  {
    echo '#!/usr/bin/env bash'
    echo "cd $(printf %q "$ROOT") || true"
    echo "export PATH=$(printf %q "$BIN_DIR"):$(printf %q "$LOCAL_BIN"):\"\$PATH\""
    echo "export GROK_NEW_SESSION_AT_STARTUP=1"
    echo "export LIVE_DEMUX_MIC=${LIVE_DEMUX_MIC:-1}"
    echo "export LIVE_DEMUX_CAM_CAPTURE=${LIVE_DEMUX_CAM_CAPTURE:-640x480}"
    if [[ "$AUTO_CAM" -eq 1 ]]; then
      echo "export LIVE_DEMUX_CAM_ON=1"
      echo "export GROK_LIVE_WATCH_CAM=1"
      echo "export GROK_LIVE_WATCH=\"\${GROK_LIVE_WATCH:-vevo}\""
      echo "export LIVE_DEMUX_CAM_TILE=\"\${LIVE_DEMUX_CAM_TILE:-large}\""
      echo "export LIVE_DEMUX_CAM_LAYOUT=\"\${LIVE_DEMUX_CAM_LAYOUT:-side}\""
      echo "export LIVE_DEMUX_CAM_MIRROR=\"\${LIVE_DEMUX_CAM_MIRROR:-1}\""
    fi
    echo "echo 'fc-grok · main Terminal · a mic · t talk · c cam'"
    echo "echo \"binary: $DEST\""
    echo "exec $(printf %q "$DEST") ${OPEN_ARGS[*]:+${OPEN_ARGS[*]}}"
  } >"$RUNNER"
  chmod +x "$RUNNER"
  TITLE="Grok · fc-cam-talk"
  [[ "$AUTO_CAM" -eq 1 ]] && TITLE="Grok · /cam wave·talk·track"
  osascript \
    -e 'tell application "Terminal" to activate' \
    -e "tell application \"Terminal\" to do script \"bash $(printf %q "$RUNNER")\"" \
    -e 'delay 0.25' \
    -e "tell application \"Terminal\" to set custom title of front window to \"$TITLE\"" \
    >/dev/null
  echo "==> opened Terminal: $TITLE"
  echo "    keys: c cam · a mic wave · t talk · Esc unfocus/close"
fi

echo "==> done · new terminals: type  grok  (or re-run with --open /cam)"
