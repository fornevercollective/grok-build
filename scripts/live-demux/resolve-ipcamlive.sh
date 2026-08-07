#!/usr/bin/env bash
# Resolve an ipcamlive camera alias → public HLS .m3u8 URL.
#
# Usage:
#   bash scripts/live-demux/resolve-ipcamlive.sh thesquarelive
#   bash scripts/live-demux/resolve-ipcamlive.sh --alias thesquarelive
#
# Env:
#   IPCAMLIVE_ALIAS   default alias when no arg (thesquarelive)
#   IPCAMLIVE_API     override stream-state API base
set -euo pipefail

ALIAS="${IPCAMLIVE_ALIAS:-thesquarelive}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --alias|-a) ALIAS="${2:-}"; shift 2 || true ;;
    --help|-h)
      echo "usage: $0 [alias|thesquarelive]"
      exit 0
      ;;
    *)
      ALIAS="$1"
      shift
      ;;
  esac
done

API="${IPCAMLIVE_API:-https://g1.ipcamlive.com/player/getcamerastreamstate.php}"
UA="${IPCAMLIVE_UA:-Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36}"

json="$(curl -fsSL -A "$UA" -H "Referer: https://g1.ipcamlive.com/" \
  "${API}?alias=${ALIAS}" 2>/dev/null || true)"
if [[ -z "${json:-}" ]]; then
  echo "error: empty response for alias=$ALIAS" >&2
  exit 1
fi

STREAM_URL="$(python3 -c '
import json, sys
d = json.loads(sys.argv[1])
det = d.get("details") or d
sid = det.get("streamid") or ""
addr = (det.get("address") or "").rstrip("/")
avail = str(det.get("streamavailable", "0"))
if not sid or not addr:
    sys.stderr.write("error: missing streamid/address in response\n")
    sys.exit(2)
if avail not in ("1", "true", "True"):
    sys.stderr.write(f"warning: streamavailable={avail} (still emitting URL)\n")
if addr.startswith("http://") and "ipcamlive.com" in addr:
    addr = "https://" + addr[len("http://"):]
print(f"{addr}/streams/{sid}/stream.m3u8")
' "$json")"

if [[ -z "${STREAM_URL:-}" ]]; then
  echo "error: could not resolve HLS for alias=$ALIAS" >&2
  exit 3
fi

printf '%s\n' "$STREAM_URL"
