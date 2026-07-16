#!/usr/bin/env bash
# Prefer native Rust shell; Electron only if ARCH_LAB_FORCE_ELECTRON=1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAB="$(cd "$SCRIPT_DIR/.." && pwd)"
NATIVE="$LAB/native"

MODE="${1:-float}"
case "$MODE" in
  --lab|lab) MODE=lab ;;
  --float|float) MODE=float ;;
  --tui|tui) MODE=tui ;;
esac

if [[ "${ARCH_LAB_FORCE_ELECTRON:-}" != "1" ]] && [[ -x "$NATIVE/launch.sh" || -d "$NATIVE" ]]; then
  echo "→ native Rust shell (WKWebView) — set ARCH_LAB_FORCE_ELECTRON=1 for Electron"
  exec bash "$NATIVE/launch.sh" "$MODE"
fi

echo "→ Electron fallback"
export LAB_WINDOW_MODE="$MODE"
cd "$SCRIPT_DIR"
if [[ ! -x node_modules/.bin/electron ]]; then
  npm install --no-fund --no-audit
fi
exec ./node_modules/.bin/electron .
