#!/usr/bin/env bash
# Colossus / Dojo LTS path for Grok Build Lab
# Aliases: GOJO/DOLOSUS (Colossus/Dojo) · long-term-support launch via StageForge
#
# Usage:
#   ./scripts/colossus-dojo-lts.sh status
#   ./scripts/colossus-dojo-lts.sh up          # stageforge up (or serve fallback)
#   ./scripts/colossus-dojo-lts.sh upstream    # show xai-org gap (no merge)
#   ./scripts/colossus-dojo-lts.sh paths       # resolve ecosystem checkouts
#
# Does NOT PR to xai-org. Does NOT vendor monorepos.

set -euo pipefail
LAB="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$LAB/../.." && pwd)"
CMD="${1:-status}"

# LTS path candidates (first existing wins)
PUBLIC_CANDIDATES=(
  "${GROK_PUBLIC_FOLDER:-}"
  "$HOME/projects/grok-public-folder"
  "$HOME/dev/projects/grok-public-folder"
  "/Volumes/qbitOS/00.dev/projects/grok-public-folder"
  "/Volumes/qbitOS/github/grok-public-folder"
)
TEMPLATE_CANDIDATES=(
  "${GROK_REPO_TEMPLATE:-}"
  "$HOME/projects/grok-repo-template"
  "$HOME/dev/projects/grok-repo-template"
  "/Volumes/qbitOS/00.dev/projects/grok-repo-template"
  "/Volumes/qbitOS/github/grok-repo-template"
)
STAGEFORGE_CANDIDATES=(
  "${STAGEFORGE_HOME:-}"
  "$HOME/dev/stageforge"
  "$HOME/Dev/stageforge"
)

first_dir() {
  local c
  for c in "$@"; do
    [[ -n "$c" && -d "$c" ]] && { echo "$c"; return 0; }
  done
  return 1
}

find_bin() {
  local name="$1" dir="$2"
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  if [[ -n "$dir" && -x "$dir/bin/$name" ]]; then
    echo "$dir/bin/$name"
    return 0
  fi
  return 1
}

PUBLIC="$(first_dir "${PUBLIC_CANDIDATES[@]}" || true)"
TEMPLATE="$(first_dir "${TEMPLATE_CANDIDATES[@]}" || true)"
STAGEFORGE_HOME="$(first_dir "${STAGEFORGE_CANDIDATES[@]}" || true)"
STAGEFORGE_BIN="$(find_bin stageforge "${STAGEFORGE_HOME:-}" || true)"
GROK_BIN="$(command -v grok 2>/dev/null || command -v xai-grok-pager 2>/dev/null || true)"
PANDA_BIN="$(command -v panda 2>/dev/null || true)"
[[ -z "$PANDA_BIN" && -x "$REPO/target/release/panda" ]] && PANDA_BIN="$REPO/target/release/panda"

print_paths() {
  echo "Colossus/Dojo LTS · path resolution"
  echo "  lab:            $LAB"
  echo "  monorepo:       $REPO"
  echo "  public-folder:  ${PUBLIC:-MISSING — git clone https://github.com/fornevercollective/grok-public-folder}"
  echo "  repo-template:  ${TEMPLATE:-MISSING — git clone https://github.com/fornevercollective/grok-repo-template}"
  echo "  stageforge:     ${STAGEFORGE_HOME:-MISSING — ~/dev/stageforge}"
  echo "  stageforge bin: ${STAGEFORGE_BIN:-not on PATH}"
  echo "  grok:           ${GROK_BIN:-not found}"
  echo "  panda:          ${PANDA_BIN:-not found}"
  echo ""
  echo "Pipe (cherry-pick, no monorepo merge):"
  echo "  imagine preset → public-folder (generate) → Resolve 4K"
  echo "       → repo-template (train / colossus-launch / rust-dojo)"
  echo "  Lab: serve PTY + workbench · native Multi αβγ · Browser"
}

print_status() {
  print_paths
  echo ""
  echo "Health probes:"
  for url in \
    "http://127.0.0.1:8765/api/health" \
    "http://127.0.0.1:8766/api/health" \
    "http://127.0.0.1:8767/api/health"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 0.4 "$url" 2>/dev/null || echo 000)"
    if [[ "$code" == "200" ]]; then
      echo "  OK  $url"
      curl -s "$url" 2>/dev/null | head -c 180
      echo
    else
      echo "  —   $url ($code)"
    fi
  done
}

print_upstream() {
  echo "Upstream xai-org/grok-build vs origin/main"
  echo "  (GitHub compare often fails: unrelated histories)"
  cd "$REPO"
  if git remote get-url upstream >/dev/null 2>&1; then
    git fetch upstream --quiet 2>/dev/null || true
    echo "  ahead of us (upstream commits not in main):"
    git log --oneline main..upstream/main 2>/dev/null | head -15 || echo "    (none / fetch failed)"
    echo "  our lab commits not in upstream:"
    git log --oneline upstream/main..main 2>/dev/null | head -10 || echo "    (n/a)"
    echo ""
    echo "  Policy: path-checkout crates/ only · never force-merge · no PRs to xai-org"
    echo "  See: docs/architecture-lab/content/14-dev-build-and-forks.md"
  else
    echo "  no 'upstream' remote — add: git remote add upstream https://github.com/xai-org/grok-build.git"
  fi
}

cmd_up() {
  cd "$LAB"
  if [[ -n "$STAGEFORGE_BIN" && -f "$LAB/stageforge.yaml" ]]; then
    echo "Starting LTS via StageForge…"
    exec "$STAGEFORGE_BIN" up
  fi
  echo "StageForge not available — fallback: ./serve.sh (PTY hub + workbench)"
  exec bash "$LAB/serve.sh"
}

print_json() {
  # Machine-readable for Launch Pad / Ship / agents (no clone side effects)
  LAB_JSON="$LAB" REPO_JSON="$REPO" python3 - <<'PY'
import json, os, shutil, time
from pathlib import Path

def first(cands):
    for c in cands:
        if not c:
            continue
        p = Path(str(c)).expanduser()
        if p.is_dir():
            return str(p.resolve())
    return None

home = Path.home()
public = first([
    os.environ.get("GROK_PUBLIC_FOLDER"),
    home / "projects/grok-public-folder",
    home / "dev/projects/grok-public-folder",
    "/Volumes/qbitOS/00.dev/projects/grok-public-folder",
    "/Volumes/qbitOS/github/grok-public-folder",
])
template = first([
    os.environ.get("GROK_REPO_TEMPLATE"),
    home / "projects/grok-repo-template",
    home / "dev/projects/grok-repo-template",
    "/Volumes/qbitOS/00.dev/projects/grok-repo-template",
    "/Volumes/qbitOS/github/grok-repo-template",
])
sf_home = first([
    os.environ.get("STAGEFORGE_HOME"),
    home / "dev/stageforge",
    home / "Dev/stageforge",
])
sf_bin = shutil.which("stageforge")
if not sf_bin and sf_home:
    p = Path(sf_home) / "bin/stageforge"
    if p.is_file():
        sf_bin = str(p)

lab = Path(os.environ["LAB_JSON"])
repo = Path(os.environ["REPO_JSON"])
print(json.dumps({
    "ok": True,
    "pipe": "colossus_dojo_lts",
    "alias": ["gojo", "dolosus", "colossus", "dojo"],
    "paths": {
        "lab": str(lab),
        "repo": str(repo),
        "public_folder": public,
        "repo_template": template,
        "stageforge": sf_home,
        "stageforge_bin": sf_bin,
        "script": str(lab / "scripts/colossus-dojo-lts.sh"),
        "manifest": str(lab / "stageforge.yaml") if (lab / "stageforge.yaml").is_file() else None,
        "metadata": str(lab / "metadata.yaml") if (lab / "metadata.yaml").is_file() else None,
    },
    "repos": {
        "public_folder": "https://github.com/fornevercollective/grok-public-folder",
        "repo_template": "https://github.com/fornevercollective/grok-repo-template",
        "upstream": "https://github.com/xai-org/grok-build",
        "upstream_compare": "https://github.com/fornevercollective/grok-build/compare/main...xai-org%3Agrok-build%3Amain",
    },
    "ready": {
        "public_folder": bool(public),
        "repo_template": bool(template),
        "stageforge": bool(sf_bin or sf_home),
        "lab_manifest": (lab / "stageforge.yaml").is_file(),
    },
    "ts": time.time(),
}, indent=2))
PY
}

cmd_clone_hints() {
  echo "Clone missing ecosystem pieces (optional):"
  echo "  git clone https://github.com/fornevercollective/grok-public-folder.git ~/projects/grok-public-folder"
  echo "  git clone https://github.com/fornevercollective/grok-repo-template.git ~/projects/grok-repo-template"
  echo "  # stageforge: already at ~/dev/stageforge — make build && make install"
}

cmd_clone() {
  # Optional real clone into ~/projects (ask via --yes flag for non-interactive)
  local dest_base="${CLONE_BASE:-$HOME/projects}"
  local force=0
  [[ "${2:-}" == "--yes" || "${2:-}" == "-y" ]] && force=1
  mkdir -p "$dest_base"
  if [[ -z "$PUBLIC" ]]; then
    if [[ $force -eq 1 ]]; then
      echo "Cloning grok-public-folder → $dest_base/grok-public-folder"
      git clone --depth 1 https://github.com/fornevercollective/grok-public-folder.git \
        "$dest_base/grok-public-folder"
    else
      echo "public-folder MISSING — re-run with: $0 clone --yes"
    fi
  else
    echo "public-folder already at $PUBLIC"
  fi
  if [[ -z "$TEMPLATE" ]]; then
    if [[ $force -eq 1 ]]; then
      echo "Cloning grok-repo-template → $dest_base/grok-repo-template"
      git clone --depth 1 https://github.com/fornevercollective/grok-repo-template.git \
        "$dest_base/grok-repo-template"
    else
      echo "repo-template MISSING — re-run with: $0 clone --yes"
    fi
  else
    echo "repo-template already at $TEMPLATE"
  fi
  if [[ -z "$STAGEFORGE_HOME" ]]; then
    echo "stageforge MISSING — expected ~/dev/stageforge (not auto-cloned)"
  else
    echo "stageforge at $STAGEFORGE_HOME · bin=${STAGEFORGE_BIN:-not on PATH}"
  fi
}

case "$CMD" in
  status|st) print_status ;;
  paths) print_paths ;;
  json|api) print_json ;;
  upstream|xai) print_upstream ;;
  up|start) cmd_up ;;
  hints) cmd_clone_hints ;;
  clone) cmd_clone "$@" ;;
  -h|--help|help)
    echo "Usage: $0 {status|paths|json|up|upstream|clone [--yes]|hints}"
    echo "  Colossus/Dojo LTS = long-term-support launch path for Lab + media + train templates"
    echo "  Aliases: GOJO / DOLOSUS"
    ;;
  *)
    echo "unknown: $CMD" >&2
    echo "Usage: $0 {status|paths|json|up|upstream|clone|hints}" >&2
    exit 1
    ;;
esac
