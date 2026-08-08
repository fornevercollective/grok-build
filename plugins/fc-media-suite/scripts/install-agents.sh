#!/usr/bin/env bash
# Install / refresh fc-media-suite skill into every terminal CLI AI.
# Single source of truth: grok-build plugins/fc-media-suite/agent-packs/
# Updates: fcs update | fcs install agents | this script
#
# Arena model families (https://arena.ai/leaderboard/agent) map to CLIs via
# agent-packs/cli-registry.tsv (Anthropic→claude, OpenAI→codex/cursor, SpaceXAI→grok, …).
set -euo pipefail

PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
PACKS="$PLUGIN/agent-packs"
REGISTRY="$PACKS/cli-registry.tsv"
GENERIC="$PACKS/generic"
SHARE="${FCS_SHARE:-$HOME/.local/share/fc-media-suite}"
HUB="$SHARE/skills/fc-media-suite"
REPO_FILE="$SHARE/ROOT"
MODE="${1:-install}"  # install | update | status | list

# Core CLIs always get skills (create dirs). Others only if parent tool dir exists.
ALWAYS_IDS="agents claude codex cursor grok continue openclaw opencode qwen factory hermes pi junie kilocode roo trae gemini aider copilot windsurf amp goose"

usage() {
  cat <<EOF
install-agents.sh · fc-media-suite multi-CLI skill install

  $0 install   # default — hub + symlink into every registered CLI
  $0 update    # same as install (refresh from grok-build plugin tree)
  $0 status    # which CLIs have the skill
  $0 list      # print registry

Hub (live from repo when possible):
  $HUB → agent-packs/generic (symlink) or copy

Update path from grok-build:
  fcs update
  bash plugins/fc-media-suite/scripts/update.sh
  bash plugins/fc-media-suite/scripts/install-agents.sh update
EOF
}

log() { printf '%s\n' "$*"; }

ensure_hub() {
  mkdir -p "$SHARE/skills" "$SHARE/agent-packs"
  # Prefer live symlink into checkout so git pull updates all agents
  if [[ -f "$GENERIC/SKILL.md" ]]; then
    if [[ -L "$HUB" ]] || [[ -d "$HUB" ]]; then
      rm -rf "$HUB"
    fi
    ln -sfn "$GENERIC" "$HUB"
    log "hub  symlink → $GENERIC"
  else
    mkdir -p "$HUB"
    [[ -f "$GENERIC/SKILL.md" ]] && cp -f "$GENERIC/SKILL.md" "$HUB/SKILL.md"
    [[ -f "$GENERIC/AGENTS.media-suite.md" ]] && cp -f "$GENERIC/AGENTS.media-suite.md" "$HUB/"
    log "hub  copy → $HUB"
  fi
  # Mirror agents md into share
  if [[ -f "$GENERIC/AGENTS.media-suite.md" ]]; then
    cp -f "$GENERIC/AGENTS.media-suite.md" "$SHARE/agent-packs/AGENTS.media-suite.md"
  fi
  # Version stamp for doctor
  {
    echo "version=$(cat "$PLUGIN/VERSION" 2>/dev/null || echo unknown)"
    echo "plugin=$PLUGIN"
    echo "hub=$HUB"
    echo "updated=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "arena=https://arena.ai/leaderboard/agent"
    echo "repo=https://github.com/fornevercollective/grok-build"
  } >"$SHARE/skills/HUB.meta"
}

link_skill_dir() {
  local dest="$1"
  local parent
  parent="$(dirname "$dest")"
  mkdir -p "$parent"
  if [[ -L "$dest" ]] || [[ -e "$dest" ]]; then
    rm -rf "$dest"
  fi
  ln -sfn "$HUB" "$dest"
}

install_file() {
  local dest="$1" src="$2"
  mkdir -p "$(dirname "$dest")"
  cp -f "$src" "$dest"
}

should_always() {
  local id="$1"
  [[ " $ALWAYS_IDS " == *" $id "* ]]
}

parent_tool_exists() {
  # e.g. .claude/skills/fc-media-suite → check ~/.claude
  local rel="$1"
  local top="${rel%%/*}"
  [[ -e "$HOME/$top" ]]
}

install_from_registry() {
  local installed=0 skipped=0
  [[ -f "$REGISTRY" ]] || { log "error: missing $REGISTRY"; return 1; }

  while IFS=$'\t' read -r id kind labs path extra || [[ -n "${id:-}" ]]; do
    [[ -z "${id:-}" || "$id" == \#* ]] && continue
    # normalize path
    local dest="$HOME/$path"

    case "$kind" in
      skill)
        if should_always "$id" || parent_tool_exists "$path"; then
          link_skill_dir "$dest"
          log "OK   skill  $id  → $path  ($labs)"
          installed=$((installed + 1))
        else
          skipped=$((skipped + 1))
        fi
        ;;
      rule)
        if should_always "$id" || parent_tool_exists "$path"; then
          if [[ -f "$PACKS/cursor/fc-media-suite.mdc" ]]; then
            install_file "$dest" "$PACKS/cursor/fc-media-suite.mdc"
            log "OK   rule   $id  → $path"
            installed=$((installed + 1))
          fi
        else
          skipped=$((skipped + 1))
        fi
        ;;
      agents_md)
        if should_always "$id" || parent_tool_exists "$path"; then
          local src="$GENERIC/AGENTS.media-suite.md"
          [[ -f "$PACKS/codex/AGENTS.snippet.md" && "$id" == "codex" ]] && src="$PACKS/codex/AGENTS.snippet.md"
          if [[ -f "$src" ]]; then
            install_file "$dest" "$src"
            log "OK   agents $id  → $path"
            installed=$((installed + 1))
          fi
        else
          skipped=$((skipped + 1))
        fi
        ;;
      commands)
        if should_always "$id" || parent_tool_exists "$path"; then
          if [[ -d "$PACKS/claude/commands" ]]; then
            mkdir -p "$dest"
            cp -f "$PACKS/claude/commands/"*.md "$dest/" 2>/dev/null || true
            log "OK   cmds   $id  → $path (fc-*)"
            installed=$((installed + 1))
          fi
        else
          skipped=$((skipped + 1))
        fi
        ;;
      conf)
        skipped=$((skipped + 1))
        ;;
      *)
        log "skip unknown kind=$kind id=$id"
        skipped=$((skipped + 1))
        ;;
    esac
  done <"$REGISTRY"

  # Hub AGENTS for generic agents
  if [[ -f "$GENERIC/AGENTS.media-suite.md" ]]; then
    mkdir -p "$HOME/.agents"
    cp -f "$GENERIC/AGENTS.media-suite.md" "$HOME/.agents/AGENTS.media-suite.md"
  fi

  # Aider: also append read: hint if conf exists and not already present
  if [[ -f "$HOME/.aider.conf.yml" ]] && [[ -f "$HOME/.aider/fc-media-suite.md" ]]; then
    if ! grep -qF 'fc-media-suite.md' "$HOME/.aider.conf.yml" 2>/dev/null; then
      {
        echo ""
        echo "# fc-media-suite (fornevercollective) — auto by install-agents.sh"
        echo "read: $HOME/.aider/fc-media-suite.md"
      } >>"$HOME/.aider.conf.yml"
      log "OK   aider conf read: ~/.aider/fc-media-suite.md"
    fi
  fi

  log ""
  log "installed/refreshed: $installed  skipped(no tool dir): $skipped"
  log "hub: $HUB"
  log "update: fcs update   |   bash $PLUGIN/scripts/install-agents.sh update"
}

status_from_registry() {
  local ok=0 miss=0
  echo "fc-media-suite agent skill status"
  echo "hub: $HUB$([ -L "$HUB" ] && echo " → $(readlink "$HUB")" || true)"
  [[ -f "$SHARE/skills/HUB.meta" ]] && cat "$SHARE/skills/HUB.meta"
  echo "---"
  while IFS=$'\t' read -r id kind labs path extra || [[ -n "${id:-}" ]]; do
    [[ -z "${id:-}" || "$id" == \#* ]] && continue
    [[ "$kind" != "skill" ]] && continue
    local dest="$HOME/$path"
    if [[ -e "$dest" || -L "$dest" ]]; then
      echo "OK   $id	$path"
      ok=$((ok + 1))
    else
      if should_always "$id" || parent_tool_exists "$path"; then
        echo "--   $id	$path  (expected)"
        miss=$((miss + 1))
      fi
    fi
  done <"$REGISTRY"
  echo "---"
  echo "present=$ok missing=$miss"
}

list_registry() {
  echo "# id	kind	arena_labs	path"
  grep -v '^#' "$REGISTRY" | grep -v '^$' || true
  echo ""
  echo "Arena: https://arena.ai/leaderboard/agent"
  echo "Always-install CLIs: $ALWAYS_IDS"
}

case "$MODE" in
  -h|--help|help) usage; exit 0 ;;
  install|update|refresh)
    ensure_hub
    install_from_registry
    ;;
  status|doctor) status_from_registry ;;
  list) list_registry ;;
  *)
    usage
    exit 2
    ;;
esac
