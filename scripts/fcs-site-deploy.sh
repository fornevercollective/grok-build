#!/usr/bin/env bash
# Deploy fcs.ugrad.ai hub → paper site (:8790) + fcs-dist for CF Pages
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PWA="$ROOT/experiments/memory-glass/pwa"
SRC="$PWA/fcs"
SITE="${FCS_SITE:-$HOME/.panda/vision/cast/paper/site}"
DIST="$PWA/fcs-dist"

echo "fcs.ugrad.ai deploy"
echo "  src:  $SRC"
echo "  site: $SITE/fcs"
echo "  dist: $DIST"

if [[ ! -d "$SRC" ]]; then
  echo "error: missing $SRC" >&2
  exit 1
fi

mkdir -p "$SITE/fcs" "$DIST" "$DIST/download" "$DIST/models" "$SITE/fcs/download"

# core assets (root of Pages project)
for f in index.html sitemap.html \
  fcs.css fcs.js skills.json sitemap.json version.json llms.txt CNAME DEPLOY.md \
  icon-mg.png icon-mg-128.png icon-192.png
do
  if [[ -f "$SRC/$f" ]]; then
    cp -f "$SRC/$f" "$SITE/fcs/$f"
    cp -f "$SRC/$f" "$DIST/$f"
  fi
done

# /download/ and /models/ as directory indexes (no root .html ↔ slash loops)
cp -f "$SRC/download.html" "$DIST/download/index.html"
cp -f "$SRC/download.html" "$SITE/fcs/download.html"
cp -f "$SRC/models.html" "$DIST/models/index.html"
# never ship root download.html/models.html on Pages
rm -f "$DIST/download.html" "$DIST/models.html"

if [[ -f "$SRC/download/latest.json" ]]; then
  cp -f "$SRC/download/latest.json" "$SITE/fcs/download/latest.json"
  cp -f "$SRC/download/latest.json" "$DIST/download/latest.json"
fi

# minimal redirects — pretty paths only
cat >"$DIST/_redirects" <<'EOF'
/download  /download/   301
/models    /models/     301
/sitemap   /sitemap.html 200
EOF

cat >"$SITE/fcs.html" <<'EOF'
<!DOCTYPE html><meta http-equiv="refresh" content="0;url=/fcs/">
<title>fcs</title><a href="/fcs/">fcs.ugrad.ai hub</a>
EOF

echo "OK  paper  http://127.0.0.1:8790/fcs/"
echo "OK  dist   $DIST"
echo "    wrangler pages deploy $DIST --project-name=fcs-ugrad"
echo "    custom domain: fcs.ugrad.ai"
