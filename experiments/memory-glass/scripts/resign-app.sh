#!/usr/bin/env bash
# Re-ad-hoc-sign Memory Glass after binary or Resources (hotpipe) edits.
# Without this, macOS taskgated kills launch: SIGKILL (Code Signature Invalid).
set -euo pipefail
APP="${1:-$HOME/Applications/Memory Glass.app}"
ID="dev.fornevercollective.memory-glass"
[[ -d "$APP" ]] || { echo "missing app: $APP" >&2; exit 1; }

# Extra files in MacOS/ break deep verify
rm -f "$APP/Contents/MacOS/BUILD_STAMP" 2>/dev/null || true

xattr -cr "$APP" 2>/dev/null || true
if [[ -x "$APP/Contents/MacOS/memory-glass" ]]; then
  codesign --force --sign - --identifier "$ID" "$APP/Contents/MacOS/memory-glass"
fi
if [[ -x "$APP/Contents/MacOS/Memory Glass" ]]; then
  codesign --force --sign - --identifier "$ID" "$APP/Contents/MacOS/Memory Glass"
fi
codesign --force --deep --sign - --identifier "$ID" "$APP"
codesign --verify --deep --strict "$APP"
echo "re-signed OK: $APP"
