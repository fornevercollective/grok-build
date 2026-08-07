#!/usr/bin/env bash
# Memory Glass wrapper — same as grok-build scripts/live-demux/glyph-watch-popout.sh
# Prefer calling that path; this entry exists so MG tooling finds it under scripts/.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
GB_SCRIPT="/Volumes/qbitOS/00.dev/projects/grok-build/scripts/live-demux/glyph-watch-popout.sh"
if [[ -f "$GB_SCRIPT" ]]; then
  exec bash "$GB_SCRIPT" "$@"
fi
# Fallback: local quantum-lift + arena
LIFT="$HERE/mg-quantum-video-lift.sh"
ARENA_URL="${LIVE_DEMUX_GLYPH_ARENA:-http://127.0.0.1:8787/ugrad-arena.html?mode=glyph}"
URL="${1:-}"
if [[ -n "$URL" && -f "$LIFT" && "$URL" != --* ]]; then
  bash "$LIFT" lift "$URL" &
  sleep 0.35
fi
if command -v open >/dev/null 2>&1; then
  open "$ARENA_URL" >/dev/null 2>&1 || true
fi
echo "glyph-watch-popout · arena $ARENA_URL"
