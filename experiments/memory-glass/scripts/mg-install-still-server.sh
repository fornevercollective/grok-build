#!/usr/bin/env bash
# Install enhanced still-server (upload + ego batch) into ~/.panda/vision
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/Resources-pack/vision/still-server.py"
DEST_DIR="${GY_VISION_DIR:-$HOME/.panda/vision}"
mkdir -p "$DEST_DIR" "$DEST_DIR/ego"
cp "$SRC" "${DEST_DIR}/still-server.py"
chmod +x "${DEST_DIR}/still-server.py"
# also capture-stream if present
if [[ -f "${ROOT}/Resources-pack/vision/capture-stream.sh" ]]; then
  cp "${ROOT}/Resources-pack/vision/capture-stream.sh" "${DEST_DIR}/" || true
  chmod +x "${DEST_DIR}/capture-stream.sh" || true
fi
echo "installed ${DEST_DIR}/still-server.py"
echo "restart: pkill -f still-server.py; MG_STILL_BIND=0.0.0.0 python3 ${DEST_DIR}/still-server.py &"
