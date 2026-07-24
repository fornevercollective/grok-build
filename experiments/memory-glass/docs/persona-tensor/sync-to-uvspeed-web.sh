#!/usr/bin/env bash
# Sync Memory Glass persona-tensor hub → uvspeed/web for MG :8765 loopback.
# MG DATA tools already expect: python3 -m http.server 8765 --bind 127.0.0.1 (cwd=uvspeed/web)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="${UVSPEED_WEB:-/Volumes/qbitOS/00.dev/uvspeed/web}"
if [[ ! -d "$DEST" ]]; then
  echo "ERR: uvspeed web not found: $DEST" >&2
  exit 1
fi
mkdir -p "$DEST/data"
cp -f "$ROOT/persona-tensor-scaffold.html" "$DEST/persona-tensor-scaffold.html"
cp -f "$ROOT/persona-tensor-scaffold.json" "$DEST/data/persona-tensor-scaffold.json"
# also root-adjacent json for file:// / relative fetch from html in web/
cp -f "$ROOT/persona-tensor-scaffold.json" "$DEST/persona-tensor-scaffold.json"
# thin qhtml redirect
cat > "$DEST/persona-tensor-scaffold.qhtml" <<'EOF'
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0; url=persona-tensor-scaffold.html" />
<title>persona-tensor-scaffold (MG)</title>
</head><body>
<p>Memory Glass × grok-build → <a href="persona-tensor-scaffold.html">persona-tensor-scaffold.html</a></p>
<script>location.replace("persona-tensor-scaffold.html");</script>
</body></html>
EOF
echo "Synced MG persona-tensor → $DEST"
echo "  open: http://127.0.0.1:8765/persona-tensor-scaffold.html"
echo "  serve: cd $DEST && python3 -m http.server 8765 --bind 127.0.0.1"
