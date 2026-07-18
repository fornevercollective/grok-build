#!/usr/bin/env bash
# Collect latest research / ego artifacts into a single Grok-ready pack.
# Usage: bash scripts/mg-pack-to-grok.sh
set -euo pipefail
OUT="${HOME}/.panda/packs"
VISION="${GY_VISION_DIR:-$HOME/.panda/vision}"
mkdir -p "$OUT" "$HOME/.panda/research"
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="${OUT}/mg-grok-pack-${STAMP}.md"

{
  echo "# Memory Glass → Grok pack · ${STAMP}"
  echo ""
  echo "Machine: $(hostname) · $(uname -m)"
  echo ""
  echo "## Ego latest"
  if [[ -f "${VISION}/ego-latest.json" ]]; then
    echo '```json'
    cat "${VISION}/ego-latest.json"
    echo '```'
  else
    echo "_(no ego batch yet — use Inspect EGO REC)_"
  fi
  echo ""
  echo "## Research seed"
  SEED="$(cd "$(dirname "$0")/.." && pwd)/hotpipe/research-packs/cv-2026-gencaption-supermap-tennis-ego.md"
  if [[ -f "$SEED" ]]; then
    head -n 80 "$SEED"
  fi
  echo ""
  echo "## Queue tail"
  if [[ -f "${HOME}/.panda/research/queue.jsonl" ]]; then
    tail -n 15 "${HOME}/.panda/research/queue.jsonl"
  fi
  echo ""
  echo "---"
  echo "Grok: summarize, answer open questions, return JSON:"
  echo '{"next_urls":[],"open_questions":[],"notes":""}'
} >"$DEST"

# clipboard if available
if command -v pbcopy >/dev/null 2>&1; then
  pbcopy <"$DEST" || true
fi
cp "$DEST" "${OUT}/mg-grok-pack-latest.md"
echo "wrote $DEST"
echo "also ${OUT}/mg-grok-pack-latest.md"
