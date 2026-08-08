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

# 4. Universal CLI + multi-CLI AI skills (Arena-mapped terminal agents)
# Hub symlinks into grok-build agent-packs/generic so all CLIs track the repo.
if [[ -f "$ROOT/scripts/fcs" ]]; then
  echo "==> fcs CLI refresh"
  export FC_MEDIA_DIR="${FC_MEDIA_DIR:-$REPO}"
  export FCS_ROOT="${FCS_ROOT:-$REPO}"
  export GROK_PLUGIN_ROOT="$ROOT"
  bash "$ROOT/scripts/fcs" install cli 2>/dev/null || true
fi
if [[ -f "$ROOT/scripts/install-agents.sh" ]]; then
  echo "==> multi-CLI AI skills (claude codex cursor grok qwen …)"
  bash "$ROOT/scripts/install-agents.sh" update
fi

# 5. Doctor
bash "$ROOT/scripts/doctor.sh" || true
if [[ -x "$HOME/.local/bin/fcs" ]]; then
  bash "$HOME/.local/bin/fcs" agents status 2>/dev/null || true
fi

NEW_V="$(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
echo "==> now v${NEW_V}"
echo "    changelog: $ROOT/CHANGELOG.md"
echo "    agents:    fcs agents status | fcs update"
