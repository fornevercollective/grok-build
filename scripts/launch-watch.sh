#!/usr/bin/env bash
# Launch Grok Build TUI for /watch · /gmux live demux (fornevercollective half-block).
#
# Skips the welcome menu: lands on an agent prompt so you can type
#   /watch   /gmux   /watch bloomberg   /watch vevo
# immediately. Optional first arg auto-opens that channel/URL.
#
# Requires a real interactive Terminal window (not a pipe / agent non-TTY).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HALFBLOCK_PAINT_TIMINGS="${HALFBLOCK_PAINT_TIMINGS:-1}"
export HALFBLOCK_PAINT_STAMP_PATH="${HALFBLOCK_PAINT_STAMP_PATH:-$HOME/.panda/packs/halfblock-paint-timings.json}"
export LIVE_DEMUX_W="${LIVE_DEMUX_W:-160}"
export LIVE_DEMUX_H="${LIVE_DEMUX_H:-90}"
export LIVE_DEMUX_FPS="${LIVE_DEMUX_FPS:-12}"
mkdir -p "$(dirname "$HALFBLOCK_PAINT_STAMP_PATH")"

# First arg: channel name, URL, or empty.
#   launch-watch.sh              → agent prompt (type /watch yourself)
#   launch-watch.sh bloomberg    → auto-open Bloomberg live (TTY half-block)
#   launch-watch.sh popout bloomberg → external ffplay window only (no TUI modal)
#   launch-watch.sh vevo         → auto-open VEVO Friday music TV
#   launch-watch.sh --auto       → auto-open default VEVO
# Remaining args go to the pager binary.
CHANNEL=""
AUTO_OPEN=0
POPOUT=0
CAMERA=0
CAM_PROFILE=""
PAGER_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --auto|-a)
      AUTO_OPEN=1
      ;;
    popout|pop-out|out|--popout|--pop-out|-o|external|ffplay)
      POPOUT=1
      AUTO_OPEN=1
      ;;
    camera|cam|--camera|--cam|-c)
      CAMERA=1
      AUTO_OPEN=1
      # Default `/cam` profile: large side tile (override with large|xl|max|pip).
      CAM_PROFILE="${CAM_PROFILE:-large}"
      ;;
    large|big|lg|xl|huge|max|pip)
      CAMERA=1
      AUTO_OPEN=1
      CAM_PROFILE="$arg"
      ;;
    --help|-h)
      cat <<'EOF'
Usage: launch-watch.sh [camera] [popout] [channel|url|--auto] [-- pager-args...]

  (no args)          Start Grok on agent prompt — type /watch or /gmux
  bloomberg          Auto-open Bloomberg live after session starts (TTY)
  camera bloomberg   /watch with local camera side pane (left) + stream (right)
  camera | cam       large side cam + default VEVO  (same as /cam)
  large | xl | max   cam size presets (implies camera on)
  pip                large PiP overlay instead of side column
  popout bloomberg   External ffplay window only (first-class pop-out)
  vevo | friday      Auto-open VEVO Friday music TV
  --auto             Auto-open default VEVO playlist
  https://...        Auto-open that URL/playlist

  Zoom-style camera OS windows (no TUI required):
    bash scripts/live-demux/cam-popout.sh all      # every cam, own window
    bash scripts/live-demux/cam-popout.sh mosaic   # one gallery grid
    bash scripts/live-demux/cam-popout.sh 0 1      # FaceTime + Brick
  Slash (in Grok): /watch camout · /watch cameras · /watch mosaic

  Inside /watch modal:
    c cam PiP · m mirror · o stream pop-out · Y you-cam · O all cams
    Space pause · n/p skip · Esc quit
  Slash: /watch popout bloomberg   /watch out cnn   /watch camout

Env:
  GROK_LIVE_WATCH=...        same as channel arg (auto-open TTY)
  GROK_LIVE_WATCH_POPOUT=1   force pop-out path for auto-open
  LIVE_DEMUX_CAM_ON=1        auto-enable camera pane (set by camera flag)
  LIVE_DEMUX_CAM_DEVICE=0    AVFoundation index (0=FaceTime, 1=Brick, …)
  LIVE_DEMUX_CAM_CAPTURE=640x480  native capture mode (FaceTime-safe default)
  LIVE_DEMUX_CAM_SIZE=960x540     cam pop-out display size
  GROK_NEW_SESSION_AT_STARTUP=1  (always set by this script)
EOF
      exit 0
      ;;
    --)
      shift || true
      PAGER_ARGS+=("$@")
      break
      ;;
    -*)
      PAGER_ARGS+=("$arg")
      ;;
    *)
      if [[ -z "$CHANNEL" ]]; then
        CHANNEL="$arg"
        AUTO_OPEN=1
      else
        PAGER_ARGS+=("$arg")
      fi
      ;;
  esac
done

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
  # Prefer a binary that ships live demux (fc-live-demux-v1).
  for c in \
    "$ROOT/target/debug/xai-grok-pager" \
    "$ROOT/target/release/xai-grok-pager" \
    "$(command -v grok 2>/dev/null || true)" \
    "$(command -v xai-grok-pager 2>/dev/null || true)"
  do
    if has_feature "$c" "fc-live-demux"; then
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
    if has_feature "$c" "fc-halfblock"; then
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

if ! has_feature "$BIN" "fc-live-demux"; then
  echo "error: selected binary lacks live demux (fc-live-demux)."
  echo "  binary: $BIN"
  echo "  rebuild: cargo build -p xai-grok-pager-bin"
  exit 1
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  echo "error: Device not configured / non-TTY"
  echo "Grok TUI needs a real terminal. Open Terminal.app and run:"
  echo "  $ROOT/scripts/launch-watch.sh"
  echo "  # or:  $ROOT/scripts/launch-watch.sh bloomberg"
  exit 6
fi

command -v yt-dlp >/dev/null || { echo "error: need yt-dlp on PATH"; exit 1; }
command -v ffmpeg >/dev/null || { echo "error: need ffmpeg on PATH"; exit 1; }

# Skip welcome menu → land on agent prompt so /watch and /gmux work.
export GROK_NEW_SESSION_AT_STARTUP=1
if [[ "$AUTO_OPEN" -eq 1 ]]; then
  # Empty string = VEVO default inside resolve_watch_source.
  export GROK_LIVE_WATCH="${CHANNEL:-}"
fi
if [[ "$POPOUT" -eq 1 ]]; then
  export GROK_LIVE_WATCH_POPOUT=1
fi
if [[ "$CAMERA" -eq 1 ]]; then
  export LIVE_DEMUX_CAM_ON=1
  export GROK_LIVE_WATCH_CAM=1
  # FaceTime HD / Continuity cams: 640x480 is universally listed; 640x360 is not.
  export LIVE_DEMUX_CAM_CAPTURE="${LIVE_DEMUX_CAM_CAPTURE:-640x480}"
  export LIVE_DEMUX_CAM_DEVICE="${LIVE_DEMUX_CAM_DEVICE:-0}"
  # Large `/cam` defaults (side column self-view). Override with large|xl|max|pip.
  case "${CAM_PROFILE:-large}" in
    xl|huge|xlarge)
      export LIVE_DEMUX_CAM_TILE="${LIVE_DEMUX_CAM_TILE:-xl}"
      export LIVE_DEMUX_CAM_LAYOUT="${LIVE_DEMUX_CAM_LAYOUT:-side}"
      ;;
    max|xxl|fill)
      export LIVE_DEMUX_CAM_TILE="${LIVE_DEMUX_CAM_TILE:-max}"
      export LIVE_DEMUX_CAM_LAYOUT="${LIVE_DEMUX_CAM_LAYOUT:-side}"
      ;;
    pip|overlay|inset)
      export LIVE_DEMUX_CAM_TILE="${LIVE_DEMUX_CAM_TILE:-40}"
      export LIVE_DEMUX_CAM_LAYOUT="${LIVE_DEMUX_CAM_LAYOUT:-pip}"
      ;;
    lean|small|mini)
      export LIVE_DEMUX_CAM_TILE="${LIVE_DEMUX_CAM_TILE:-lean}"
      export LIVE_DEMUX_CAM_LAYOUT="${LIVE_DEMUX_CAM_LAYOUT:-pip}"
      ;;
    *)
      export LIVE_DEMUX_CAM_TILE="${LIVE_DEMUX_CAM_TILE:-large}"
      export LIVE_DEMUX_CAM_LAYOUT="${LIVE_DEMUX_CAM_LAYOUT:-side}"
      ;;
  esac
  export LIVE_DEMUX_CAM_MIRROR="${LIVE_DEMUX_CAM_MIRROR:-1}"
fi

# Pure pop-out path: no TUI required — resolve + ffplay, then exit.
if [[ "$POPOUT" -eq 1 && "${GROK_LIVE_WATCH_POPOUT_TTY:-0}" != "1" ]]; then
  echo "binary: $BIN (pop-out only · no TUI modal)"
  echo "auto-popout: '${CHANNEL:-vevo (default)}'"
  echo "resolving + launching ffplay…"
  # Prefer rust pop-out if the binary exports a helper; else shell path.
  ROOT_URL=""
  case "${CHANNEL:-}" in
    ""|vevo|friday|music) ROOT_URL="https://www.youtube.com/watch?v=jaCxgxTScjc&list=PLbAbqvKSxmj4" ;;
    bloomberg|bbg|bloom|business) ROOT_URL="https://www.youtube.com/@business/live" ;;
    *) ROOT_URL="${CHANNEL}" ;;
  esac
  if [[ "$ROOT_URL" != http* ]]; then
    # Named channel other than bloomberg/vevo — let yt-dlp search live.
    ROOT_URL="ytsearch1:${CHANNEL} live"
  fi
  STREAM="$(yt-dlp -g -f 'b[height<=720]/best[height<=720]/b/best' --no-playlist --no-warnings "$ROOT_URL" 2>/dev/null | head -1 || true)"
  if [[ -z "${STREAM:-}" ]]; then
    echo "error: yt-dlp resolve failed for $ROOT_URL"
    exit 1
  fi
  TITLE="$(yt-dlp --print '%(title)s' --no-playlist --no-warnings "$ROOT_URL" 2>/dev/null | head -1 || echo "$CHANNEL")"
  exec ffplay -hide_banner -loglevel error -autoexit \
    -fflags nobuffer -flags low_delay -framedrop \
    -window_title "pop-out · /watch · ${TITLE}" \
    "$STREAM"
fi

echo "binary: $BIN"
echo "paint stamp: $HALFBLOCK_PAINT_STAMP_PATH"
echo "startup: skip welcome → agent prompt (GROK_NEW_SESSION_AT_STARTUP=1)"
if [[ "$AUTO_OPEN" -eq 1 ]]; then
  echo "auto-watch: '${GROK_LIVE_WATCH:-vevo (default)}'"
else
  echo "auto-watch: off — type /watch or /gmux at the prompt"
fi
if [[ "$CAMERA" -eq 1 ]]; then
  echo "camera: ON (device=${LIVE_DEMUX_CAM_DEVICE} capture=${LIVE_DEMUX_CAM_CAPTURE}) left pane"
fi
echo ""
echo "Commands once at the agent prompt:"
echo "  /watch                 # VEVO Friday music TV (TTY half-block)"
echo "  /gmux                  # same"
echo "  /watch bloomberg       # Bloomberg live (TTY)"
echo "  /watch popout bloomberg  # external ffplay pop-out (stream)"
echo "  /watch camout | cameras | mosaic  # Zoom-style cam OS windows"
echo "  /watch out cnn | list | …"
echo "  c PiP · m mirror · o stream · Y you-cam · O all cams · Esc quit"
echo "  shell: bash scripts/live-demux/cam-popout.sh all|mosaic|0 1"
echo ""

# Fullscreen agent TUI (not minimal dashboard). Cwd = repo so paths resolve;
# plain-session startup skips worktree Ask regardless of git root.
exec "$BIN" --fullscreen "${PAGER_ARGS[@]+"${PAGER_ARGS[@]}"}"
