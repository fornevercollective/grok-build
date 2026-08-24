# fc-media-suite · zsh hook
# Source from ~/.zshrc (fcs install shell):
#   source ~/.local/share/fc-media-suite/shell/fcs.zsh
#
# Enables:
#   fcs watch bloomberg
#   /watch bloomberg          # accept-line rewrite → fcs watch …
#   /cam · /clock · /map · /webgrid · /glyph · /optical · /lens · /phone · /cast · /tiles · /media

# Ensure ~/.local/bin on PATH (fcs install target)
if [[ -d "$HOME/.local/bin" ]]; then
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) path=("$HOME/.local/bin" $path) ;;
  esac
fi

_fcs_bin() {
  if command -v fcs >/dev/null 2>&1; then
    command fcs "$@"
    return $?
  fi
  if [[ -x "$HOME/.local/share/fc-media-suite/fcs" ]]; then
    "$HOME/.local/share/fc-media-suite/fcs" "$@"
    return $?
  fi
  if [[ -n "${FC_MEDIA_DIR:-}" && -x "$FC_MEDIA_DIR/plugins/fc-media-suite/scripts/fcs" ]]; then
    bash "$FC_MEDIA_DIR/plugins/fc-media-suite/scripts/fcs" "$@"
    return $?
  fi
  if [[ -x "$HOME/Projects/grok-build/plugins/fc-media-suite/scripts/fcs" ]]; then
    bash "$HOME/Projects/grok-build/plugins/fc-media-suite/scripts/fcs" "$@"
    return $?
  fi
  print -u2 "fcs not installed — run:"
  print -u2 "  bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install"
  return 127
}

# Convenience when not yet on PATH
if ! command -v fcs >/dev/null 2>&1; then
  fcs() { _fcs_bin "$@"; }
fi

# Slash names are absolute paths to the shell (/watch → path lookup).
# Rewrite interactive lines that start with a known slash tool → fcs <cmd> …
_fcs_slash_cmds='watch|gmux|tv|live|cam|camera|clock|timesync|zulu|map|maptrace|geomap|webgrid|wg|glyph|glyphs|peel|optical|optic|lens|phone|cast|share|tiles|gboom|media|doctor|language|lang|drone|web|webi|inspect|devtools|hygiene|preserve|etcher'

_fcs_rewrite_slash_line() {
  # $1 = full buffer; print rewritten command line or empty if no match
  local buf="$1"
  # trim leading spaces
  buf="${buf#"${buf%%[![:space:]]*}"}"
  [[ "$buf" == /* ]] || return 1
  local rest="${buf#/}"
  local head="${rest%%[[:space:]]*}"
  head="${head%%/*}"  # no nested paths
  if [[ ! "$head" =~ ^(${_fcs_slash_cmds})$ ]]; then
    return 1
  fi
  local args="${rest#"$head"}"
  # preserve args (may be empty)
  print -r -- "fcs ${head}${args}"
  return 0
}

# Interactive: intercept Enter on /watch … lines
if [[ -o interactive ]] && (( $+functions[zle] || 1 )) && [[ -n ${ZSH_VERSION:-} ]]; then
  _fcs_accept_line() {
    local rewritten
    if rewritten="$(_fcs_rewrite_slash_line "$BUFFER")"; then
      BUFFER="$rewritten"
    fi
    zle .accept-line
  }
  zle -N accept-line _fcs_accept_line 2>/dev/null || true
fi

# Non-interactive / scripts: also try command_not_found for relative names only
# (absolute /watch never hits this in zsh — accept-line covers interactive).
if typeset -f command_not_found_handler >/dev/null 2>&1; then
  functions -c command_not_found_handler _fcs_prev_cnf_handler
else
  _fcs_prev_cnf_handler() {
    print -u2 "zsh: command not found: $1"
    return 127
  }
fi

command_not_found_handler() {
  local cmd="$1"
  # bare names only (watch without slash) if someone uses hash miss
  case "$cmd" in
    watch|gmux|cam|clock|timesync|map|maptrace|webgrid|glyph|peel|optical|lens|phone|cast|tiles|gboom|language|lang|drone|preserve|etcher)
      # Do not steal system `watch` if present as absolute — only when not found
      shift
      _fcs_bin "$cmd" "$@"
      return $?
      ;;
  esac
  _fcs_prev_cnf_handler "$@"
}
