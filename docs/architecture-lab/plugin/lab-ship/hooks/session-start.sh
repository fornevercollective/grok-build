#!/usr/bin/env bash
# lab-ship SessionStart — non-blocking orientation for lab / fork work
set -euo pipefail
ROOT="${GROK_PLUGIN_ROOT:-}"
echo "[lab-ship] SessionStart · plan · skills · plugins · Q&A · subagents"
echo "[lab-ship] Install path: ${ROOT}"
echo "[lab-ship] Lab docs: docs/architecture-lab/  · Ship tab: #/tool/ship"
echo "[lab-ship] Validate: grok plugin validate \"${ROOT}\""
echo "[lab-ship] Status: npm run status --prefix docs/architecture-lab"
echo "[lab-ship] Official: https://x.ai/cli · fork Pages: https://fornevercollective.github.io/grok-build/"
exit 0
