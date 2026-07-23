#!/usr/bin/env bash
# Memory Glass · live visual monitor loop
# Captures the MG window + smoke probe JSON so agents can "see" what the user sees.
#
# Usage:
#   bash scripts/mg-live-monitor.sh           # one shot
#   bash scripts/mg-live-monitor.sh --loop 5  # every 5s
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${MG_MONITOR_DIR:-$HOME/.panda/mg-monitor}"
mkdir -p "$OUT"
LOOP=0
INTERVAL=5
for a in "$@"; do
  case "$a" in
    --loop) LOOP=1 ;;
    [0-9]*) INTERVAL="$a" ;;
  esac
done

capture_once() {
  local ts
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  local img="$OUT/mg-$ts.png"
  local latest="$OUT/LATEST.png"
  local meta="$OUT/LATEST.json"

  # Window capture of memory-glass if possible
  local wid=""
  wid="$(osascript 2>/dev/null <<'AS' || true
tell application "System Events"
  if not (exists process "memory-glass") then return ""
  try
    set w to first window of process "memory-glass"
    return id of w as string
  end try
end tell
return ""
AS
)"
  if [[ -n "$wid" && "$wid" != "" ]]; then
    screencapture -x -l "$wid" "$img" 2>/dev/null || screencapture -x "$img" 2>/dev/null || true
  else
    screencapture -x "$img" 2>/dev/null || true
  fi
  if [[ -f "$img" ]]; then
    cp -f "$img" "$latest"
  fi

  # Smoke probe written by product-core inject
  local probe="$HOME/.panda/mg-smoke-probe.json"
  if [[ -f "$probe" ]]; then
    cp -f "$probe" "$OUT/probe-$ts.json"
    cp -f "$probe" "$OUT/LATEST-probe.json"
  fi

  # Process stats
  local cpu mem
  cpu="$(ps -axo pid,%cpu,%mem,command 2>/dev/null | grep -F 'Contents/MacOS/memory-glass' | grep -v grep | head -1 || true)"
  {
    echo "{"
    echo "  \"ts\": \"$ts\","
    echo "  \"img\": \"$img\","
    echo "  \"wid\": \"$wid\","
    echo "  \"proc\": $(echo "$cpu" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '""'),"
    if [[ -f "$probe" ]]; then
      echo "  \"probe\": $(cat "$probe"),"
    else
      echo "  \"probe\": null,"
    fi
    echo "  \"note\": \"open LATEST.png + LATEST-probe.json\""
    echo "}"
  } >"$meta"

  echo "==> monitor $ts"
  echo "    img:  $latest"
  echo "    meta: $meta"
  if [[ -f "$probe" ]]; then
    echo "    probe: $(head -c 280 "$probe")"
  else
    echo "    probe: (none yet — ⌘⇧R after product-core rebuild)"
  fi
  if [[ -n "$cpu" ]]; then
    echo "    proc: $cpu"
  fi
}

if [[ "$LOOP" == "1" ]]; then
  echo "live monitor loop every ${INTERVAL}s → $OUT (Ctrl+C stop)"
  while true; do
    capture_once || true
    sleep "$INTERVAL"
  done
else
  capture_once
fi
