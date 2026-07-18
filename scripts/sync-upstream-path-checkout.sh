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

# Re-apply fork banner on root README (upstream README is path-checked out)
if [[ -f README.md ]] && ! grep -q 'docs/FORK_SYNC.md' README.md 2>/dev/null; then
  python3 - <<'PY'
from pathlib import Path
p = Path("README.md")
t = p.read_text()
needle = "for the version of the code present in this tree.\n"
banner = (
    needle
    + "\n"
    + "> **Fork note (fornevercollective):** GitHub may show this repo “N commits behind”\n"
    + "> `xai-org/grok-build`. That is **history only** (unrelated roots). **Trust\n"
    + "> `SOURCE_REV` + path-checkout** — see [`docs/FORK_SYNC.md`](docs/FORK_SYNC.md).\n"
    + "> Sync: `./scripts/sync-upstream-path-checkout.sh` · verify: `./scripts/verify-upstream-sync.sh`.\n"
)
if needle in t and "FORK_SYNC.md" not in t:
    p.write_text(t.replace(needle, banner, 1))
    print("  Re-applied fork note to README.md")
PY
  git add README.md 2>/dev/null || true
fi

echo ""
echo "Staged monorepo product paths from $REV"
echo "  SOURCE_REV=$(cat SOURCE_REV 2>/dev/null || echo '?')"
echo "  Lab preserved: docs/architecture-lab · experiments/"
echo "  Policy: GitHub 'behind' badge is normal — trust SOURCE_REV + path-checkout."
echo "  Docs: docs/FORK_SYNC.md"
echo "Review: git status && git diff --cached --stat"
echo "Verify: ./scripts/verify-upstream-sync.sh $REV   (after commit)"
echo "Commit when ready — do NOT force-merge upstream/main into Lab history."
