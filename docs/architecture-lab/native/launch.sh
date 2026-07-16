#!/usr/bin/env bash
# Launch Architecture Lab as a native Rust shell (WKWebView / WebView2).
# Not Electron. Not a browser tab.
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

BIN="$NATIVE/target/release/architecture-lab"
if [[ ! -x "$BIN" ]]; then
  echo "Building architecture-lab (release)…"
  (cd "$NATIVE" && cargo build --release)
fi

echo "architecture-lab · native · mode=$MODE"
echo "  lab: $LAB"
echo "  bin: $BIN"
exec "$BIN" --mode "$MODE"
