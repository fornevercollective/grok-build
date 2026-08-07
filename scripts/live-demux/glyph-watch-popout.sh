#!/usr/bin/env bash
# /watch glyph pop-out — custom ffmpeg/ffplay via quantum-lift + Glyph arena.
#
# fc-glyph-watch-v1 · plant path (not optical TX)
#
# Usage:
#   bash scripts/live-demux/glyph-watch-popout.sh
#   bash scripts/live-demux/glyph-watch-popout.sh "https://youtube.com/…"
#   bash scripts/live-demux/glyph-watch-popout.sh --arena-only
#   bash scripts/live-demux/glyph-watch-popout.sh --no-arena "URL"
#
# Path:
#   yt-dlp → ffmpeg/ffplay (videotoolbox) → last-lift.json multiplex
#   → open http://127.0.0.1:8790/ugrad-arena.html?mode=glyph  (MG PWA; Soft Path owns :8765)
#
# Honesty: lab BPS ≠ ARC % · lift = control plane · peel owns dense map.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MG_ROOT="${MG_ROOT:-}"
for cand in \
  "$ROOT/experiments/memory-glass" \
  "/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass" \
  "${FC_GROK_ROOT:-}/experiments/memory-glass" \
  "${HOME}/Projects/grok-build/experiments/memory-glass"
do
  if [[ -n "$cand" && -f "$cand/scripts/mg-quantum-video-lift.sh" ]]; then
    MG_ROOT="$cand"
    break
  fi
done

LIFT="${MG_ROOT:+$MG_ROOT/scripts/mg-quantum-video-lift.sh}"
ARENA_URL="${LIVE_DEMUX_GLYPH_ARENA:-http://127.0.0.1:8790/ugrad-arena.html?mode=glyph}"
OPEN_ARENA=1
URL=""
ARENA_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --arena-only|--arena|arena)
      ARENA_ONLY=1
      ;;
    --no-arena)
      OPEN_ARENA=0
      ;;
    --help|-h)
      cat <<'EOF'
Usage: glyph-watch-popout.sh [URL] [--arena-only] [--no-arena]

  URL            yt-dlp / file / stream → quantum-lift ffplay (HW)
  --arena-only   open Glyph tools tab only (no ffplay)
  --no-arena     ffplay only (no browser)

Env:
  LIVE_DEMUX_GLYPH_ARENA   arena URL (default :8790 MG PWA mode=glyph; Soft Path owns :8765)
  MG_HWACCEL               auto|videotoolbox|none
  MG_LIFT_MUX              rubik,bloch,glyph_dense,tensor_lane
  MG_ROOT                  memory-glass checkout
EOF
      exit 0
      ;;
    -*)
      echo "unknown flag: $arg" >&2
      exit 2
      ;;
    *)
      if [[ -z "$URL" ]]; then
        URL="$arg"
      fi
      ;;
  esac
done

open_arena() {
  [[ "$OPEN_ARENA" -eq 1 ]] || return 0
  if command -v open >/dev/null 2>&1; then
    open "$ARENA_URL" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$ARENA_URL" >/dev/null 2>&1 || true
  fi
  echo "arena: $ARENA_URL"
}

export MG_LIFT_MUX="${MG_LIFT_MUX:-rubik,bloch,glyph_dense,tensor_lane}"
export MG_HWACCEL="${MG_HWACCEL:-auto}"

echo "glyph-watch-popout · fc-glyph-watch-v1"
echo "  one_hot_path: race XOR dense peel"
echo "  lab_bps ≠ ARC %"

if [[ "$ARENA_ONLY" -eq 1 ]] || [[ -z "$URL" && ! -f "${LIFT:-}" ]]; then
  open_arena
  if [[ -z "$URL" ]]; then
    echo "ok · arena only (pass URL for quantum-lift ffplay)"
    exit 0
  fi
fi

if [[ -z "${LIFT:-}" || ! -f "$LIFT" ]]; then
  echo "error: mg-quantum-video-lift.sh not found"
  echo "  set MG_ROOT or install experiments/memory-glass/scripts/"
  # still open arena so glyph form is usable
  open_arena
  exit 1
fi

if [[ -n "$URL" ]]; then
  echo "lift: $LIFT"
  echo "url:  $URL"
  # lift launches ffplay detached + writes last-lift.json
  bash "$LIFT" lift "$URL" || {
    echo "warn: lift failed — trying plain ffplay" >&2
    if command -v yt-dlp >/dev/null && command -v ffplay >/dev/null; then
      STREAM="$(yt-dlp -g -f 'bv*+ba/b' --no-playlist "$URL" 2>/dev/null | head -1 || true)"
      TARGET="${STREAM:-$URL}"
      ffplay -hide_banner -loglevel warning \
        -fflags nobuffer -flags low_delay -framedrop \
        -window_title "glyph pop-out · /watch · quantum-lift" \
        -autoexit "$TARGET" >/dev/null 2>&1 &
      echo "ok plain ffplay pid $!"
    else
      open_arena
      exit 1
    fi
  }
  # give ffplay a beat, then open Glyph tools form
  sleep 0.35
  open_arena
  META="${MG_VIDEO_OUT:-$HOME/.panda/mg-soak/video-feed}/last-lift.json"
  echo "meta: $META"
  echo "multiplex seats: $MG_LIFT_MUX"
  echo "ok glyph pop-out"
else
  open_arena
  echo "ok · arena only"
fi
