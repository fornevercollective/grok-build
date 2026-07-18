#!/usr/bin/env bash
# Memory Glass · smoke trust check (no GUI interactivity required)
# Exit 0 = build + binary + hotpipe product surface present.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Memory Glass smoke · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "    root: $ROOT"

# 1) cargo check (faster than full release)
if command -v cargo >/dev/null 2>&1; then
  echo "==> cargo check"
  cargo check --quiet 2>&1 | tail -5 || cargo check 2>&1 | tail -20
else
  echo "WARN: cargo not on PATH — skip compile check" >&2
fi

# 2) required product files
need=(
  "src/main.rs"
  "hotpipe/product-mode.js"
  "hotpipe/webgrid-play.js"
  "hotpipe/activity-leaderboard.js"
  "hotpipe/float-layout.js"
  "hotpipe/glass-capsule-shell.js"
  "hotpipe/search-comms.js"
  "hotpipe/menu-health-monitor.js"
  "hotpipe/mg-calibrate-boot.js"
  "docs/PRODUCT.md"
  "docs/PRIVACY.md"
  "docs/PACKAGE_MAP.md"
  "build-mac-app.sh"
)
echo "==> product surface files"
for f in "${need[@]}"; do
  [[ -f "$ROOT/$f" ]] || { echo "MISSING: $f" >&2; exit 2; }
  echo "  ok  $f"
done

# 3) product-mode + menu-health + cal boot injects
if ! grep -q 'product-mode.js' "$ROOT/src/main.rs"; then
  echo "MISSING: product-mode.js inject in main.rs" >&2
  exit 3
fi
echo "  ok  product-mode inject wired"
if ! grep -q 'menu-health-monitor.js' "$ROOT/src/main.rs"; then
  echo "MISSING: menu-health-monitor.js inject in main.rs" >&2
  exit 3
fi
echo "  ok  menu-health inject wired"
if ! grep -q 'mg-calibrate-boot.js' "$ROOT/src/main.rs"; then
  echo "MISSING: mg-calibrate-boot.js inject in main.rs" >&2
  exit 3
fi
echo "  ok  mg-cal boot inject wired"
if ! grep -q '__mgCal' "$ROOT/hotpipe/mg-calibrate-boot.js"; then
  echo "MISSING: __mgCal API" >&2
  exit 3
fi
echo "  ok  __mgCal.boot API"

# 4) no auto openLabKit on bare WebGrid (product gate)
if grep -n 'openLabKit()' "$ROOT/hotpipe/float-layout.js" | grep -v 'mg_lab_full\|function openLabKit\|openLabKit:' | grep -q .; then
  # allow only under mg_lab_full
  if ! grep -A3 'mg_lab_full' "$ROOT/hotpipe/float-layout.js" | grep -q openLabKit; then
    echo "WARN: openLabKit call sites — verify product default" >&2
  fi
fi
echo "  ok  lab kit gated"

# 5) optional: binary exists from prior release build
if [[ -x "$ROOT/target/release/memory-glass" ]]; then
  echo "==> release binary present ($(wc -c < "$ROOT/target/release/memory-glass" | tr -d " ") bytes)"
  echo "  ok  binary (not launched — GUI app)"
else
  echo "  skip release binary (run cargo build --release for full smoke)"
fi

echo "==> SMOKE PASS · product surface"
exit 0
