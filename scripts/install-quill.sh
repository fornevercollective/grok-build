#!/usr/bin/env bash
# Install xfreeze2/Quill (Grok-backed dictation) into ~/Applications.
# https://github.com/xfreeze2/quill
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="${MG_VENDOR_DIR:-$HOME/.panda/vendor}"
DEST="$VENDOR/quill"
REPO_URL="${QUILL_REPO:-https://github.com/xfreeze2/quill.git}"

mkdir -p "$VENDOR" "$ROOT/.grok/skills/quill"
echo "==> Quill → $DEST"

if [[ "${1:-}" == "--curl" ]]; then
  curl -fsSL https://raw.githubusercontent.com/xfreeze2/quill/main/install.sh | bash
else
  if [[ -d "$DEST/.git" ]]; then
    git -C "$DEST" pull --ff-only || true
  else
    git clone --depth 1 "$REPO_URL" "$DEST"
  fi
  if [[ -x "$DEST/install.sh" ]]; then
    bash "$DEST/install.sh"
  elif [[ -x "$DEST/build.sh" ]]; then
    (cd "$DEST" && bash ./signing/install-identity.sh 2>/dev/null || true
     bash ./build.sh
     open -a Quill 2>/dev/null || open "$HOME/Applications/Quill.app" 2>/dev/null || true)
  else
    curl -fsSL https://raw.githubusercontent.com/xfreeze2/quill/main/install.sh | bash
  fi
fi

cat > "$ROOT/.grok/skills/quill/SKILL.md" <<'EOF'
---
name: quill
description: >
  Quill macOS dictation — speak anywhere, text lands in focused field via Grok STT.
  Use when user wants voice input, dictate into MG or any app, or "open Quill".
  Triggers: /quill, dictation, voice type, speak to type.
---

# Quill (xfreeze2)

Upstream: https://github.com/xfreeze2/quill

```bash
bash scripts/install-quill.sh
open -a Quill
```

- Trigger: Control tap (configurable)
- Uses existing Grok login / xAI key
- Mid-dictation: say "open Grok Build" to launch session
- Does not touch clipboard for AX text fields

Pairs with **desktop-harness** (hands) and **Memory Glass** (browser shell).
EOF

echo "==> Quill install attempted"
[[ -d "$HOME/Applications/Quill.app" ]] && echo "    app: ~/Applications/Quill.app" || echo "    open Quill from Releases if missing"
