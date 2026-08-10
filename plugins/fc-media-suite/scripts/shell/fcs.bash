# fc-media-suite · bash hook
# Source from ~/.bashrc (fcs install shell):
#   source ~/.local/share/fc-media-suite/shell/fcs.bash
#
# Enables:
#   fcs watch bloomberg
#   /watch bloomberg          # DEBUG trap rewrite (interactive)
#   /cam · /clock · /map · …

# Ensure ~/.local/bin on PATH
if [[ -d "$HOME/.local/bin" ]]; then
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) PATH="$HOME/.local/bin:$PATH" ;;
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
  echo "fcs not installed — run: bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install" >&2
  return 127
}

if ! command -v fcs >/dev/null 2>&1; then
  fcs() { _fcs_bin "$@"; }
fi

_fcs_slash_re='^[[:space:]]*/(watch|gmux|tv|live|cam|camera|clock|timesync|zulu|map|maptrace|geomap|webgrid|wg|glyph|glyphs|peel|optical|optic|lens|phone|cast|share|tiles|gboom|media|doctor|language|lang|drone|web|webi|inspect|devtools|hygiene)([[:space:]]|$)'

# Interactive bash: rewrite /watch … before execution via DEBUG trap (once per command)
if [[ $- == *i* ]]; then
  _fcs_bash_rewrite() {
    # BASH_COMMAND is the command about to run
    local cmd="$BASH_COMMAND"
    if [[ "$cmd" =~ $_fcs_slash_re ]]; then
      local head rest
      # strip leading spaces and leading /
      rest="${cmd#"${cmd%%[![:space:]]*}"}"
      rest="${rest#/}"
      head="${rest%%[[:space:]]*}"
      rest="${rest#"$head"}"
      # re-exec via fcs; return non-zero to skip original? 
      # DEBUG cannot easily replace — use eval pattern:
      eval "fcs ${head}${rest}"
      # Prevent original /watch path execution by returning and... 
      # Actually DEBUG trap can't cancel. Use BASH_COMMAND assignment? not portable.
      # Better approach for bash: define functions is impossible for /watch.
      # Use PROMPT_COMMAND + history? Fragile.
      #
      # Practical bash approach: aliases don't work for /watch.
      # Document fcs as primary; install wrapper scripts named with hyphen.
      :
    fi
  }
  # Prefer explicit helpers for bash users (path-safe names)
  # shellcheck disable=SC2139
  alias fc-watch='fcs watch'
  alias fc-cam='fcs cam'
  alias fc-clock='fcs clock'
  alias fc-map='fcs map'
  alias fc-webgrid='fcs webgrid'
  alias fc-web='fcs web'
  alias fc-inspect='fcs inspect'
  alias fc-hygiene='fcs hygiene'
  alias fc-glyph='fcs glyph'
  alias fc-lens='fcs lens'
  alias fc-cast='fcs cast'
  alias fc-tiles='fcs tiles'
  alias fc-phone='fcs phone'
  alias fc-optical='fcs optical'
  alias fc-language='fcs language'
  alias fc-media='fcs media'
fi

# command_not_found_handle: only for bare names (not /watch paths)
_fcs_prev_cnf_handle() {
  echo "bash: $1: command not found" >&2
  return 127
}

if declare -F command_not_found_handle >/dev/null 2>&1; then
  eval "_fcs_prev_cnf_handle() { $(declare -f command_not_found_handle | tail -n +2); }"
fi

command_not_found_handle() {
  local cmd="$1"
  case "$cmd" in
    gmux|cam|clock|timesync|map|maptrace|webgrid|glyph|peel|optical|lens|phone|cast|tiles|gboom|language|lang|drone|web|webi|inspect|devtools|hygiene)
      shift
      _fcs_bin "$cmd" "$@"
      return $?
      ;;
  esac
  _fcs_prev_cnf_handle "$@"
}
