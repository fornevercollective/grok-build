#!/usr/bin/env bash
# fc-media-suite doctor — verify binary feature stamps + runtime tools
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
FAIL=0

echo "fc-media-suite doctor · v${VERSION}"
echo "plugin: $ROOT"

need_feat() {
  local bin="$1" feat="$2"
  if [[ ! -x "$bin" ]]; then
    return 1
  fi
  # strings may be huge; use python scan of path
  python3 - "$bin" "$feat" <<'PY' 2>/dev/null
import sys
path, needle = sys.argv[1], sys.argv[2].encode()
with open(path, "rb") as f:
    data = f.read()
sys.exit(0 if needle in data else 1)
PY
}

pick_bin() {
  local c
  for c in \
    "${FC_MEDIA_BIN:-}" \
    "$HOME/Projects/grok-build/target/release/xai-grok-pager" \
    "$HOME/Projects/grok-build/target/debug/xai-grok-pager" \
    "$(command -v grok-fc 2>/dev/null || true)" \
    "$(command -v grok 2>/dev/null || true)" \
    "$(command -v xai-grok-pager 2>/dev/null || true)"
  do
    [[ -n "$c" && -x "$c" ]] && { echo "$c"; return 0; }
  done
  return 1
}

BIN="$(pick_bin || true)"
if [[ -z "${BIN:-}" ]]; then
  echo "FAIL  no grok / xai-grok-pager binary found"
  echo "      build: cargo build -p xai-grok-pager-bin"
  FAIL=1
else
  echo "bin   $BIN"
  for feat in fc-live-demux-v1 fc-timesync-v1 fc-maptrace-v1 fc-halfblock; do
    if need_feat "$BIN" "$feat"; then
      echo "OK    $feat"
    else
      echo "FAIL  $feat missing — not the fornevercollective media binary"
      FAIL=1
    fi
  done
fi

echo "--- tools ---"
for t in yt-dlp ffmpeg; do
  if command -v "$t" >/dev/null 2>&1; then
    echo "OK    $t"
  else
    echo "WARN  $t missing (needed for /watch demux)"
  fi
done
if command -v ffplay >/dev/null 2>&1; then
  echo "OK    ffplay (pop-out)"
else
  echo "WARN  ffplay missing (OS pop-out windows)"
fi
if command -v sntp >/dev/null 2>&1; then
  echo "OK    sntp (clock NTP tier)"
else
  echo "WARN  sntp missing (clock falls back to free-run tier)"
fi

echo "--- credits ---"
echo "fornevercollective media suite · see CREDITS.md"
echo "upstream harness: xAI grok-build"

if [[ "$FAIL" -ne 0 ]]; then
  echo ""
  echo "doctor: NOT READY — install fornevercollective binary with feature stamps"
  exit 1
fi
echo ""
echo "doctor: READY · real Terminal → bash scripts/launch-watch.sh"
exit 0
