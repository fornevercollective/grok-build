#!/usr/bin/env bash
# status.x.ai go/no-go — run before big pushes / deploys / release builds.
#
# Exit codes:
#   0  GO   — no declared incidents / services look available
#   1  NO-GO — incidents / unavailable / degraded signals
#   2  UNKNOWN — page unreachable (Cloudflare, network); treat as NO-GO for big pushes
#                 unless STATUS_XAI_ALLOW_UNKNOWN=1
#
# Usage:
#   bash docs/architecture-lab/scripts/status-xai-check.sh
#   bash docs/architecture-lab/scripts/status-xai-check.sh --strict   # unknown → fail
#   STATUS_XAI_ALLOW_UNKNOWN=1 bash …/status-xai-check.sh            # unknown → warn only
#
# Source of truth: https://status.x.ai
# Product surface: https://x.ai/cli  (Grok Build / SpaceXAI)

set -euo pipefail

STATUS_URL="${STATUS_XAI_URL:-https://status.x.ai}"
STRICT=0
ALLOW_UNKNOWN="${STATUS_XAI_ALLOW_UNKNOWN:-0}"

for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --allow-unknown) ALLOW_UNKNOWN=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
  esac
done

if [[ "$STRICT" == "1" ]]; then
  ALLOW_UNKNOWN=0
fi

UA="${STATUS_XAI_UA:-Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36}"
TMP="$(mktemp -t status-xai.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

echo "status.x.ai go/no-go check"
echo "  url: $STATUS_URL"
echo "  time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

CODE=0
if command -v curl >/dev/null 2>&1; then
  CODE=$(curl -sS -L \
    -A "$UA" \
    -H 'Accept: text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' \
    -H 'Accept-Language: en-US,en;q=0.9' \
    --max-time 25 \
    -o "$TMP" \
    -w '%{http_code}' \
    "$STATUS_URL" 2>/dev/null || echo "000")
else
  echo "  ERROR: curl not found"
  exit 2
fi

echo "  http: $CODE"

BODY="$(tr '\n' ' ' <"$TMP" | tr -s ' ')"

# Cloudflare / block pages
if [[ "$CODE" == "403" ]] || [[ "$CODE" == "503" ]] || [[ "$CODE" == "000" ]]; then
  echo "  result: UNKNOWN (HTTP $CODE — may be Cloudflare or network)"
  echo "  action: open https://status.x.ai in a browser and re-check before big push"
  if [[ "$ALLOW_UNKNOWN" == "1" ]]; then
    echo "  policy: STATUS_XAI_ALLOW_UNKNOWN=1 → treat as WARN (not blocking)"
    exit 0
  fi
  echo "  policy: big push → NO-GO until status is confirmed (or pass --allow-unknown)"
  exit 2
fi

if [[ "$CODE" != "200" ]]; then
  echo "  result: UNKNOWN (unexpected HTTP $CODE)"
  [[ "$ALLOW_UNKNOWN" == "1" ]] && exit 0
  exit 2
fi

# HTML / JSON heuristics from status.x.ai content model
LOWER="$(printf '%s' "$BODY" | tr '[:upper:]' '[:lower:]')"

NO_GO=0
REASONS=()

if printf '%s' "$LOWER" | grep -qE 'cloudflare|attention required|you have been blocked'; then
  echo "  result: UNKNOWN (bot protection / block page body)"
  [[ "$ALLOW_UNKNOWN" == "1" ]] && exit 0
  exit 2
fi

# Explicit bad signals
if printf '%s' "$LOWER" | grep -qE 'major outage|partial outage|service disruption|actively mitigating|incident declared|investigating'; then
  NO_GO=1
  REASONS+=("incident/outage language present")
fi
if printf '%s' "$LOWER" | grep -qE 'unavailable|degraded|down'; then
  # "available" also matches unavailable substring carefully
  if printf '%s' "$LOWER" | grep -qE '(^|[^a-z])unavailable([^a-z]|$)|status[^a-z]{0,12}degraded|partially degraded'; then
    NO_GO=1
    REASONS+=("unavailable/degraded signal")
  fi
fi

# Good signals
GOOD=0
if printf '%s' "$LOWER" | grep -qE 'no incidents declared|not actively mitigating'; then
  GOOD=1
fi
if printf '%s' "$LOWER" | grep -qE '\[grok \(ios\)[[:space:]]*available|\[grok \(web\)[[:space:]]*available|all systems operational'; then
  GOOD=1
fi
# status page lists services as "available"
if printf '%s' "$LOWER" | grep -c 'available' | awk '{exit !($1>=5)}'; then
  GOOD=1
fi

if [[ "$NO_GO" -eq 1 ]]; then
  echo "  result: NO-GO"
  for r in "${REASONS[@]}"; do echo "    - $r"; done
  echo "  do not big-push / deploy until https://status.x.ai is green"
  exit 1
fi

if [[ "$GOOD" -eq 1 ]]; then
  echo "  result: GO"
  echo "  note: no incident signals detected (always double-check live page for model/API rows)"
  exit 0
fi

echo "  result: UNKNOWN (page fetched but health heuristics inconclusive)"
echo "  action: open https://status.x.ai manually"
if [[ "$ALLOW_UNKNOWN" == "1" ]]; then
  exit 0
fi
exit 2
