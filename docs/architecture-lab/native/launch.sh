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

# Binary selection:
# - Prefer release when up-to-date
# - Rebuild release if missing or older than native sources (avoids stale bar/buttons)
# - LAB_NATIVE_DEBUG=1 forces debug binary (fast iterate)
# - LAB_NATIVE_SKIP_BUILD=1 never rebuilds (use existing binary as-is)
BIN_RELEASE="$NATIVE/target/release/grok-build-lab"
BIN_DEBUG="$NATIVE/target/debug/grok-build-lab"
BIN_LEGACY="$NATIVE/target/release/architecture-lab"

need_release_build() {
  local bin="$1"
  [[ ! -x "$bin" ]] && return 0
  # Any newer source under src/ or Cargo.toml → rebuild
  if [[ -n "$(find "$NATIVE/src" "$NATIVE/Cargo.toml" -type f -newer "$bin" 2>/dev/null | head -1)" ]]; then
    return 0
  fi
  return 1
}

if [[ "${LAB_NATIVE_DEBUG:-}" == "1" || "${LAB_NATIVE_DEBUG:-}" == "true" ]]; then
  echo "Building grok-build-lab (debug)…"
  (cd "$NATIVE" && cargo build)
  BIN="$BIN_DEBUG"
elif [[ "${LAB_NATIVE_SKIP_BUILD:-}" == "1" ]]; then
  if [[ -x "$BIN_RELEASE" ]]; then
    BIN="$BIN_RELEASE"
  elif [[ -x "$BIN_DEBUG" ]]; then
    BIN="$BIN_DEBUG"
  elif [[ -x "$BIN_LEGACY" ]]; then
    BIN="$BIN_LEGACY"
  else
    echo "No binary found and LAB_NATIVE_SKIP_BUILD=1" >&2
    exit 1
  fi
else
  if need_release_build "$BIN_RELEASE"; then
    echo "Building grok-build-lab (release) — sources newer than binary…"
    (cd "$NATIVE" && cargo build --release)
  fi
  if [[ -x "$BIN_RELEASE" ]]; then
    BIN="$BIN_RELEASE"
  elif [[ -x "$BIN_DEBUG" ]]; then
    echo "warn: using debug binary (release missing)" >&2
    BIN="$BIN_DEBUG"
  elif [[ -x "$BIN_LEGACY" ]]; then
    BIN="$BIN_LEGACY"
  else
    echo "failed to produce grok-build-lab" >&2
    exit 1
  fi
fi

# Show embedded version if strings available (quick sanity)
VER_HINT=""
if command -v strings >/dev/null 2>&1; then
  VER_HINT="$(strings "$BIN" 2>/dev/null | grep -E '^0\.[0-9]+\.[0-9]+$' | head -1 || true)"
fi

echo "Grok Build Lab · native · mode=$MODE"
echo "  lab: $LAB"
echo "  bin: $BIN"
[[ -n "$VER_HINT" ]] && echo "  crate version (string scan): $VER_HINT"
# --port 0 picks a free port (survives when ./serve.sh holds :8765)
exec "$BIN" --mode "$MODE" --root "$LAB" --port 0
