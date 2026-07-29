#!/usr/bin/env bash
# fc-media-suite update — plugin pack + optional binary rebuild (dev-team style)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Walk up from plugins/fc-media-suite → repo root when vendored in grok-build
REPO="$(cd "$ROOT/../.." 2>/dev/null && pwd)"
VERSION="$(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"

echo "==> fc-media-suite update · was v${VERSION}"

# 1. Plugin via grok CLI when available
if command -v grok >/dev/null 2>&1; then
  grok plugin update fc-media-suite 2>/dev/null \
    || grok plugin install "$ROOT" --trust 2>/dev/null \
    || true
fi

# 2. Git pull when we are inside the fork checkout
if [[ -d "$REPO/.git" ]]; then
  echo "==> git pull $REPO"
  if git -C "$REPO" status --porcelain | grep -q .; then
    echo "    dirty tree — pull skipped (commit or stash first)"
  else
    git -C "$REPO" pull --ff-only origin main 2>/dev/null \
      || git -C "$REPO" pull --ff-only 2>/dev/null \
      || echo "    pull failed (offline?)"
  fi
  # Refresh user plugin copy from tree
  if [[ -d "$HOME/.grok/plugins/fc-media-suite" ]]; then
    rm -rf "$HOME/.grok/plugins/fc-media-suite"
    cp -R "$ROOT" "$HOME/.grok/plugins/fc-media-suite"
    echo "    refreshed ~/.grok/plugins/fc-media-suite"
  fi
fi

# 3. Rebuild binary for feature stamps
if [[ "${FC_MEDIA_SKIP_BUILD:-0}" != "1" ]] && command -v cargo >/dev/null 2>&1 && [[ -f "$REPO/Cargo.toml" ]]; then
  echo "==> cargo build -p xai-grok-pager-bin"
  (cd "$REPO" && cargo build -p xai-grok-pager-bin ${FC_MEDIA_RELEASE:+--release}) || true
fi

# 4. Doctor
bash "$ROOT/scripts/doctor.sh" || true

NEW_V="$(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
echo "==> now v${NEW_V}"
echo "    changelog: $ROOT/CHANGELOG.md"
