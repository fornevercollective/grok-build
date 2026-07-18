#!/usr/bin/env bash
# Verify product tree matches xai-org/grok-build tip (or REV).
# Exit 0 = content OK (GitHub "behind" badge may still show — ignore it).
#
#   ./scripts/verify-upstream-sync.sh
#   ./scripts/verify-upstream-sync.sh upstream/main
#
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
REV="${1:-upstream/main}"

if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "ERR: no upstream remote — add https://github.com/xai-org/grok-build.git" >&2
  exit 2
fi
git fetch upstream --quiet 2>/dev/null || git fetch upstream

if ! git rev-parse "$REV" >/dev/null 2>&1; then
  echo "ERR: unknown rev $REV" >&2
  exit 2
fi

LOCAL_REV="$(cat SOURCE_REV 2>/dev/null || echo '')"
UP_REV="$(git show "$REV:SOURCE_REV" 2>/dev/null || echo '')"
UP_TIP="$(git rev-parse --short "$REV")"

echo "verify-upstream-sync"
echo "  fork HEAD     : $(git rev-parse --short HEAD)"
echo "  upstream ref  : $UP_TIP ($REV)"
echo "  SOURCE_REV    : $LOCAL_REV"
echo "  upstream SR   : $UP_REV"
echo "  note          : GitHub behind-count is normal; trust SOURCE_REV + path-checkout"

PATHS=(
  crates
  Cargo.toml
  Cargo.lock
  SOURCE_REV
  bin
  third_party
  rust-toolchain.toml
  clippy.toml
  rustfmt.toml
  SECURITY.md
  CONTRIBUTING.md
  LICENSE
  THIRD-PARTY-NOTICES
  .cargo
  prod
  .gitignore
)

drift=0
for p in "${PATHS[@]}"; do
  if ! git cat-file -e "$REV:$p" 2>/dev/null; then
    echo "  skip (missing on upstream): $p"
    continue
  fi
  if git diff --quiet "$REV" HEAD -- "$p" 2>/dev/null; then
    echo "  OK   $p"
  else
    echo "  DRIFT $p"
    git diff --stat "$REV" HEAD -- "$p" | tail -2 | sed 's/^/        /'
    drift=1
  fi
done

if [[ "$LOCAL_REV" != "$UP_REV" ]]; then
  echo "  DRIFT SOURCE_REV file content"
  drift=1
fi

echo ""
if [[ "$drift" -eq 0 ]]; then
  echo "RESULT: product tree matches $REV — tools are content-current."
  echo "  Leveraged via workspace: cargo check -p xai-grok-pager-bin  (etc.)"
  echo "  Memory Glass: experiments/memory-glass (standalone; not monorepo member)"
  exit 0
else
  echo "RESULT: DRIFT — run: ./scripts/sync-upstream-path-checkout.sh $REV"
  exit 1
fi
