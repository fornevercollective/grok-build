#!/usr/bin/env bash
# Memory Glass · stair relaunch (crash-safe, no delete)
# Usage:
#   bash mg-stair-relaunch.sh              # ugrad-r0
#   bash mg-stair-relaunch.sh letter-grid
#   bash mg-stair-relaunch.sh cage
#   bash mg-stair-relaunch.sh persona
#   bash mg-stair-relaunch.sh webgrid
#   bash mg-stair-relaunch.sh status
set -u
MG_APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
BIN="$MG_APP/Contents/MacOS/memory-glass"

url_for() {
  case "${1:-r0}" in
    r0|ugrad|tensor) echo "https://mueee.qbitos.ai/ugrad-r0.html" ;;
    letter-grid|lg) echo "https://kbatch.ugrad.ai/labs/declaration-digital-edition/letter-grid.html?v=pipe8" ;;
    cage) echo "https://kbatch.ugrad.ai/labs/declaration-digital-edition/cage-litmus.html" ;;
    persona) echo "http://127.0.0.1:8787/persona-tensor-scaffold.html" ;;
    webgrid|wg) echo "https://neuralink.com/webgrid/" ;;
    dojo) echo "https://kbatch.ugrad.ai/dojo/" ;;
    pipe) echo "https://kbatch.ugrad.ai/labs/declaration-digital-edition/letter-grid-pipe.html?mode=smoke" ;;
    *) echo "$1" ;;
  esac
}

cmd_status() {
  if pgrep -x memory-glass >/dev/null 2>&1; then
    ps -axo pid,pcpu,pmem,etime,command | grep -i '[m]emory-glass' | grep -v grep || true
  else
    echo "memory-glass: stopped"
  fi
}

cmd_launch() {
  local key="${1:-r0}"
  local url
  url=$(url_for "$key")
  if [[ ! -x "$BIN" ]]; then
    echo "missing binary: $BIN" >&2
    exit 1
  fi
  pkill -x memory-glass 2>/dev/null || true
  sleep 0.5
  pkill -9 -x memory-glass 2>/dev/null || true
  sleep 0.3
  open -na "$MG_APP" --args "$url"
  sleep 1.2
  cmd_status
  echo "url=$url"
}

case "${1:-launch}" in
  status) cmd_status ;;
  launch|"") cmd_launch "${2:-r0}" ;;
  *) cmd_launch "$1" ;;
esac
