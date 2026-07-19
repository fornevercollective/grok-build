#!/usr/bin/env bash
# term-snap → truss handoff packet (read LATEST.md into agent context)
# Usage:
#   tsnap                 # capture + pin + ship
#   bash scripts/term-snap-to-truss.sh   # print handoff block for Grok / lab-handoff
set -euo pipefail
LATEST="${HOME}/.panda/term-annotate/LATEST.md"
PNG="${HOME}/.panda/term-annotate/LATEST.png"
echo "=== term-snap → truss ==="
if [[ ! -f "$LATEST" ]]; then
  echo "no LATEST.md — run: term-snap  (or tsnap)"
  exit 1
fi
echo "fix:  $LATEST"
[[ -f "$PNG" ]] && echo "png:  $PNG"
echo "--- FIX.md ---"
cat "$LATEST"
echo "---"
echo "Paste image with Ctrl+V in Grok if clipboard still holds snap-annotated.png"
echo "Truss (in MG console after ⌘⇧R):"
echo '  __mgQbitTruss.claim({ product:"memory-glass", title:"term-snap fix", files:["~/.panda/term-annotate/LATEST.md"] })'
echo '  __mgQbitTruss.handoff({ product:"memory-glass", to:"build", summary:"term-snap FIX packet" })'
