#!/usr/bin/env bash
# Lightweight session banner — version + credits (no heavy work).
set -euo pipefail
ROOT="${GROK_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
V="$(cat "$ROOT/VERSION" 2>/dev/null || echo "?")"
# Emit a single line for session context (hooks may capture stdout).
echo "fc-media-suite v${V} · fornevercollective · /watch /cam /clock /map · credits: plugin CREDITS.md"
exit 0
