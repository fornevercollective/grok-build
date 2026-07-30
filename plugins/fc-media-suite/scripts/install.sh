#!/usr/bin/env bash
# fc-media-suite one-liner installer — fornevercollective
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash
#   bash plugins/fc-media-suite/scripts/install.sh
# Env:
#   FC_MEDIA_DIR     clone/build dir (default: ~/Projects/grok-build)
#   FC_MEDIA_SKIP_BUILD=1  plugin only, skip cargo
#   FC_MEDIA_RELEASE=1     cargo build --release
set -euo pipefail

REPO_URL="${FC_MEDIA_REPO:-https://github.com/fornevercollective/grok-build.git}"
DIR="${FC_MEDIA_DIR:-$HOME/Projects/grok-build}"
PLUGIN_REL="plugins/fc-media-suite"
VERSION="0.1.0"

echo "==> fc-media-suite v${VERSION} · fornevercollective"
echo "    repo: $REPO_URL"
echo "    dir:  $DIR"

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: need $1 on PATH"; exit 1; }; }
need git

# --- 1. Clone or update fork ---
if [[ -d "$DIR/.git" ]]; then
  echo "==> updating existing clone"
  git -C "$DIR" fetch origin --tags 2>/dev/null || true
  # Prefer ff-only; if dirty, leave tree alone and install plugin from current tree
  if git -C "$DIR" status --porcelain | grep -q .; then
    echo "    note: working tree dirty — leaving git state, installing plugin from current files"
  else
    git -C "$DIR" pull --ff-only origin main 2>/dev/null \
      || git -C "$DIR" pull --ff-only origin master 2>/dev/null \
      || echo "    note: pull skipped (offline or diverged)"
  fi
else
  need git
  mkdir -p "$(dirname "$DIR")"
  echo "==> cloning fornevercollective/grok-build"
  git clone --depth 1 "$REPO_URL" "$DIR"
fi

PLUGIN="$DIR/$PLUGIN_REL"
if [[ ! -d "$PLUGIN" ]]; then
  echo "error: plugin not found at $PLUGIN"
  echo "       is this the fornevercollective fork with plugins/fc-media-suite?"
  exit 1
fi

# --- 2. Install plugin into Grok ---
if command -v grok >/dev/null 2>&1; then
  echo "==> grok plugin install (trusted)"
  grok plugin install "$PLUGIN" --trust 2>/dev/null \
    || grok plugin install "fornevercollective/grok-build#${PLUGIN_REL}" --trust 2>/dev/null \
    || {
      echo "    CLI install failed — copying to ~/.grok/plugins/fc-media-suite"
      mkdir -p "$HOME/.grok/plugins"
      rm -rf "$HOME/.grok/plugins/fc-media-suite"
      cp -R "$PLUGIN" "$HOME/.grok/plugins/fc-media-suite"
    }
  grok plugin enable fc-media-suite 2>/dev/null || true
else
  echo "==> grok CLI not found — installing plugin to ~/.grok/plugins/"
  mkdir -p "$HOME/.grok/plugins"
  rm -rf "$HOME/.grok/plugins/fc-media-suite"
  cp -R "$PLUGIN" "$HOME/.grok/plugins/fc-media-suite"
fi

# --- 3. Main Terminal deploy (fork as `grok`, not stock x.ai only) ---
# Prefer scripts/deploy-fc-grok.sh: installs ~/.grok/bin/grok with cam-talk stamps
# so *new* Terminal windows get /cam wave·talk·track without cargo-run.
if [[ "${FC_MEDIA_SKIP_BUILD:-0}" != "1" ]]; then
  if [[ -x "$DIR/scripts/deploy-fc-grok.sh" ]]; then
    echo "==> main Terminal deploy (deploy-fc-grok · not stock x.ai-only)"
    DEPLOY_FLAGS=()
    if [[ "${FC_MEDIA_RELEASE:-0}" == "1" ]]; then
      DEPLOY_FLAGS+=(--release)
    else
      DEPLOY_FLAGS+=(--debug)
    fi
    bash "$DIR/scripts/deploy-fc-grok.sh" "${DEPLOY_FLAGS[@]}" \
      || echo "    warn: deploy-fc-grok failed — falling back to local link only"
  elif command -v cargo >/dev/null 2>&1 && [[ -f "$DIR/Cargo.toml" ]]; then
    echo "==> building xai-grok-pager (feature stamps for /watch /cam /clock /map)"
    PROFILE=debug
    ARGS=(-p xai-grok-pager-bin)
    if [[ "${FC_MEDIA_RELEASE:-0}" == "1" ]]; then
      ARGS+=(--release)
      PROFILE=release
    fi
    (cd "$DIR" && cargo build "${ARGS[@]}") || echo "    warn: cargo build failed — plugin docs still installed"
    BIN="$DIR/target/$PROFILE/xai-grok-pager"
    if [[ -x "$BIN" ]]; then
      mkdir -p "$HOME/.local/bin" "$HOME/.grok/bin"
      ln -sfn "$BIN" "$HOME/.local/bin/grok-fc" 2>/dev/null || true
      # Main entry when deploy script missing — still prefer fork for new terminals.
      if [[ ! -e "$HOME/.grok/bin/grok-stable" && -e "$HOME/.grok/bin/grok" ]]; then
        cp -f "$(readlink "$HOME/.grok/bin/grok" 2>/dev/null || echo "$HOME/.grok/bin/grok")" \
          "$HOME/.grok/bin/grok-stable" 2>/dev/null || true
      fi
      ln -sfn "$BIN" "$HOME/.grok/bin/grok" 2>/dev/null || true
      ln -sfn "$BIN" "$HOME/.local/bin/grok" 2>/dev/null || true
      echo "    binary: $BIN"
      echo "    main:   ~/.grok/bin/grok  (fork · restore stock via deploy-fc-grok.sh --restore)"
    fi
  else
    echo "==> skip binary build (no cargo or not a full checkout)"
    echo "    set FC_MEDIA_SKIP_BUILD=0 and install rust to build feature stamps"
  fi
else
  echo "==> FC_MEDIA_SKIP_BUILD=1 — plugin only"
fi

# --- 4. Runtime deps hint ---
echo "==> runtime deps (for live demux / cam / clock)"
for t in yt-dlp ffmpeg ffplay; do
  if command -v "$t" >/dev/null 2>&1; then
    echo "    OK  $t"
  else
    echo "    --  $t  (install for /watch · /cam pop-out)"
  fi
done

# --- 5. Doctor ---
if [[ -x "$PLUGIN/scripts/doctor.sh" ]]; then
  echo "==> doctor"
  bash "$PLUGIN/scripts/doctor.sh" || true
fi

echo ""
echo "==> done · fc-media-suite v${VERSION}"
echo "    credits: $PLUGIN/CREDITS.md"
echo "    launch (real Terminal):"
echo "      cd $DIR && bash scripts/launch-watch.sh"
echo "      /watch bloomberg · /cam · /clock · /map starbase"
echo "    update:"
echo "      bash $PLUGIN/scripts/update.sh"
