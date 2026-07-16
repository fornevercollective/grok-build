#!/usr/bin/env bash
# Option C — Panda/Mu hosts Lab (pattern pipe, not default product).
# Loads Lab workbench URL in browser or opens panda if available.
set -euo pipefail
LAB="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8765}"
URL="http://127.0.0.1:${PORT}/workbench.html"
echo "Option C · host Lab URL: $URL"
echo "  1) Ensure serve or native is up on :$PORT"
echo "  2) Prefer panda window with embedded webview when mugrok/ironraw ready"
echo "  3) Until then: open URL in system browser / Lab Browser window"
if command -v panda >/dev/null 2>&1; then
  echo "  panda found — open multi-term + note Lab URL (embedded host TBD)"
  panda --help 2>&1 | head -5 || true
fi
if command -v open >/dev/null 2>&1; then
  open "$URL" || true
fi
echo "Done · pattern only · see content/24-abc-path.md Option C"
