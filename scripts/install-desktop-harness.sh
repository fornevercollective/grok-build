#!/usr/bin/env bash
# Install xfreeze2/desktop-harness into lab env (Grok skill + CLI).
# https://github.com/xfreeze2/desktop-harness
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="${MG_VENDOR_DIR:-$HOME/.panda/vendor}"
DEST="$VENDOR/desktop-harness"
REPO_URL="${DH_REPO:-https://github.com/xfreeze2/desktop-harness.git}"

mkdir -p "$VENDOR"
echo "==> desktop-harness → $DEST"

if [[ -d "$DEST/.git" ]]; then
  git -C "$DEST" pull --ff-only || git -C "$DEST" fetch --depth 1 origin main
else
  git clone --depth 1 "$REPO_URL" "$DEST"
fi

chmod +x "$DEST/install.sh" 2>/dev/null || true
(
  cd "$DEST"
  if [[ -x ./install.sh ]]; then
    ./install.sh
  else
    # minimal: skill + path note
    echo "install.sh missing — manual: cd $DEST && pip install -e . or follow README"
  fi
)

# Ensure Grok skill present
mkdir -p "$HOME/.grok/skills/desktop-harness"
if [[ -f "$DEST/SKILL.md" ]]; then
  cp -f "$DEST/SKILL.md" "$HOME/.grok/skills/desktop-harness/SKILL.md"
elif command -v desktop-harness >/dev/null 2>&1; then
  desktop-harness skill > "$HOME/.grok/skills/desktop-harness/SKILL.md" 2>/dev/null || true
fi

# Repo-local pointer for agents
mkdir -p "$ROOT/.grok/skills/desktop-harness"
if [[ -f "$HOME/.grok/skills/desktop-harness/SKILL.md" ]]; then
  cp -f "$HOME/.grok/skills/desktop-harness/SKILL.md" "$ROOT/.grok/skills/desktop-harness/SKILL.md"
fi
cat > "$ROOT/.grok/skills/desktop-harness/INSTALL.md" <<EOF
# desktop-harness (lab)

Upstream: https://github.com/xfreeze2/desktop-harness

\`\`\`bash
bash scripts/install-desktop-harness.sh
desktop-harness --doctor
desktop-harness daemon start --bg
\`\`\`

Use for Mac GUI control (AX-first). Not MCP. Integrates with Memory Glass dispatch as **hands** when shell is not enough.
EOF

echo "==> desktop-harness install done"
command -v desktop-harness >/dev/null && desktop-harness --version || echo "    binary may need PATH (~/.local/bin)"
echo "    skill: ~/.grok/skills/desktop-harness/SKILL.md"
