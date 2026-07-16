#!/usr/bin/env bash
# Sync product tree from xai-org/grok-build WITHOUT wiping Lab.
# Path-checkout only — never force-merge unrelated histories.
#
#   ./scripts/sync-upstream-path-checkout.sh
#   ./scripts/sync-upstream-path-checkout.sh 8adf901
#
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
REV="${1:-upstream/main}"

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/xai-org/grok-build.git
fi
git fetch upstream --tags

echo "Path-checkout from $REV (keeps docs/ architecture-lab + experiments/)"
git checkout "$REV" -- \
  crates/ \
  Cargo.toml \
  Cargo.lock \
  SOURCE_REV \
  README.md \
  bin/ \
  third_party/ \
  rust-toolchain.toml \
  clippy.toml \
  rustfmt.toml \
  SECURITY.md \
  CONTRIBUTING.md \
  LICENSE \
  THIRD-PARTY-NOTICES \
  .cargo/ \
  prod/ \
  .gitignore

echo ""
echo "Staged monorepo product paths from $REV"
echo "  SOURCE_REV=$(cat SOURCE_REV 2>/dev/null || echo '?')"
echo "  Lab preserved: docs/architecture-lab · experiments/"
echo "Review: git status && git diff --cached --stat"
echo "Commit when ready — do NOT force-merge upstream/main into Lab history."
