#!/usr/bin/env bash
# Install a repo pre-push hook that runs status.x.ai go/no-go before big pushes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"
CHECK="docs/architecture-lab/scripts/status-xai-check.sh"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Not a git repo root: $ROOT" >&2
  exit 1
fi

mkdir -p "$ROOT/.git/hooks"
cat > "$HOOK" << 'HOOK'
#!/usr/bin/env bash
# Grok Build Lab — pre-push gate: status.x.ai go/no-go
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
CHECK="$ROOT/docs/architecture-lab/scripts/status-xai-check.sh"

# Skip for pure draft tags if desired: STATUS_XAI_SKIP=1 git push
if [[ "${STATUS_XAI_SKIP:-0}" == "1" ]]; then
  echo "[pre-push] STATUS_XAI_SKIP=1 — skipping status.x.ai check"
  exit 0
fi

if [[ ! -x "$CHECK" ]]; then
  chmod +x "$CHECK" 2>/dev/null || true
fi

echo "[pre-push] status.x.ai go/no-go (big push gate)…"
if ! bash "$CHECK" --strict; then
  echo ""
  echo "[pre-push] BLOCKED — fix status or override:"
  echo "  • Open https://status.x.ai"
  echo "  • STATUS_XAI_ALLOW_UNKNOWN=1 git push   # only if page unreachable but you verified manually"
  echo "  • STATUS_XAI_SKIP=1 git push            # emergency skip (log why)"
  exit 1
fi
exit 0
HOOK
chmod +x "$HOOK"
chmod +x "$ROOT/$CHECK" 2>/dev/null || true
echo "Installed: $HOOK"
echo "Runs: $CHECK before every git push"
echo "Emergency: STATUS_XAI_SKIP=1 git push"
