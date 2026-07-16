#!/usr/bin/env bash
# Launch Grok Build Lab as a native Rust shell (WKWebView / WebView2).
# Not Electron. Not a browser tab.
# Note: folder path docs/architecture-lab is historical; product name is Grok Build Lab.
set -euo pipefail

NATIVE="$(cd "$(dirname "$0")" && pwd)"
LAB="$(cd "$NATIVE/.." && pwd)"
export ARCH_LAB_ROOT="$LAB"

MODE="${1:-float}"
case "$MODE" in
  float|lab|tui) ;;
  --float) MODE=float ;;
  --lab) MODE=lab ;;
  --tui) MODE=tui ;;
  -h|--help)
    echo "Usage: $0 [float|lab|tui]"
    echo "  float  frameless always-on-top pod (default)"
    echo "  lab    full workspace window"
    echo "  tui    ratatui control plane (no webview)"
    exit 0
    ;;
  *) echo "unknown mode: $MODE" >&2; exit 1 ;;
esac

# Prefer new binary name; fall back to legacy architecture-lab if present
BIN=""
for cand in "$NATIVE/target/release/grok-build-lab" "$NATIVE/target/release/architecture-lab"; do
  if [[ -x "$cand" ]]; then
    BIN="$cand"
    break
  fi
done

if [[ -z "$BIN" ]]; then
  echo "Building grok-build-lab (release)…"
  (cd "$NATIVE" && cargo build --release)
  BIN="$NATIVE/target/release/grok-build-lab"
fi

echo "Grok Build Lab · native · mode=$MODE"
echo "  lab: $LAB"
echo "  bin: $BIN"
# --port 0 picks a free port (survives when ./serve.sh holds :8765)
exec "$BIN" --mode "$MODE" --root "$LAB" --port 0
