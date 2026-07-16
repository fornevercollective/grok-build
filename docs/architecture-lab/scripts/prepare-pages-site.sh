#!/usr/bin/env bash
# Prepare a clean static tree for GitHub Pages (no node_modules / target / .app).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${1:-/tmp/architecture-lab-site}"
SHA="${GITHUB_SHA:-local}"
REF="${GITHUB_REF_NAME:-local}"
RUN_ID="${GITHUB_RUN_ID:-0}"
OWNER="${GITHUB_REPOSITORY_OWNER:-fornevercollective}"
REPO_FULL="${GITHUB_REPOSITORY:-fornevercollective/grok-build}"
REPO_NAME="${REPO_FULL##*/}"
REPO_NAME="${REPO_NAME:-grok-build}"

rm -rf "$SITE"
mkdir -p "$SITE"
rsync -a \
  --exclude 'desktop/node_modules' \
  --exclude 'desktop/dist' \
  --exclude 'desktop/*.app' \
  --exclude 'native/target' \
  --exclude 'native/*.app' \
  --exclude '**/*.app' \
  --exclude '.git' \
  --exclude 'scripts' \
  "$ROOT/" "$SITE/"
touch "$SITE/.nojekyll"

SHORT="$(echo "$SHA" | cut -c1-7)"
BUILT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
URL="https://${OWNER}.github.io/${REPO_NAME}/"

python3 - "$SITE" "$SHA" "$SHORT" "$REF" "$BUILT" "$RUN_ID" "$URL" <<'PY'
import json, pathlib, re, sys
site, sha, short, ref, built, run_id, url = sys.argv[1:8]
site = pathlib.Path(site)
# Keep marketing semver in sync with docs/architecture-lab/package.json when bumping.
lab_semver = "0.4.0"
ver = {
    "ok": True,
    "sha": sha,
    "short": short,
    "ref": ref,
    "built_at": built,
    "source": "github-pages",
    "run_id": run_id,
    "url": url,
    "lab_semver": lab_semver,
}
(site / "version.json").write_text(json.dumps(ver, indent=2) + "\n")
sw = site / "sw.js"
if sw.is_file():
    text = sw.read_text()
    text2 = re.sub(
        r'const CACHE = "grok-lab-[^"]*"',
        f'const CACHE = "grok-lab-{short}"',
        text,
        count=1,
    )
    sw.write_text(text2)
assert (site / "index.html").is_file(), "missing index.html"
assert (site / "phone.html").is_file(), "missing phone.html (lab-ship PWA)"
assert (site / "manifest.webmanifest").is_file(), "missing manifest"
# Point version stamp at phone install surface
print("site ready", short, url)
print("phone", url.rstrip("/") + "/phone.html")
print((site / "version.json").read_text())
PY

du -sh "$SITE"
ls -la "$SITE" | head -25
