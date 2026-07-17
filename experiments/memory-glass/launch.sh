#!/usr/bin/env bash
# Dev launch — release binary or .app if present.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
URL="${1:-https://www.spacex.com/}"

if [[ -d "$ROOT/Memory Glass.app" ]]; then
  open "$ROOT/Memory Glass.app" --args "$URL"
  exit 0
fi

if [[ ! -x "$ROOT/target/release/memory-glass" ]]; then
  (cd "$ROOT" && cargo build --release)
fi
exec "$ROOT/target/release/memory-glass" "$URL"
