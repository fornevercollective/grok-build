#!/usr/bin/env bash
# mg-web.sh — universal /web inspect onramp (any terminal · any AI · any browser)
#
# Usage:
#   bash experiments/memory-glass/scripts/mg-web.sh [subcommand] [args…]
#   fcs web | fcs /web | fcs inspect | fcs hygiene
#
# Subcommands:
#   (default)|inspect   open MG + arm /web inspect panel
#   browsers|matrix     peer DevTools matrix (agent-safe text/JSON)
#   hygiene             arm job hygiene (zombie download patch)
#   learn|field         field-trigger log tab
#   pack|export         request export pack
#   soak                hygiene soakProbe
#   onramps             all code/terminal entry points
#   open <browser>      open peer browser + print DevTools keys
#   status              bus + MG + module paths
#   help
#
# Bus: ~/.panda/mg-session/web-cmd.json  (MG hotpipe polls & runs)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
# script is experiments/memory-glass/scripts → repo is ../../..
if [[ ! -f "$ROOT/Cargo.toml" ]]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  if [[ -f "$ROOT/../../Cargo.toml" ]]; then
    ROOT="$(cd "$ROOT/../.." && pwd)"
  fi
fi
MG_ROOT="$ROOT/experiments/memory-glass"
if [[ ! -d "$MG_ROOT/hotpipe" ]]; then
  for c in \
    "/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass" \
    "$HOME/Projects/grok-build/experiments/memory-glass"
  do
    if [[ -d "$c/hotpipe" ]]; then MG_ROOT="$c"; ROOT="$(cd "$c/../.." && pwd)"; break; fi
  done
fi

BUS_DIR="${MG_WEB_BUS_DIR:-$HOME/.panda/mg-session}"
BUS_FILE="$BUS_DIR/web-cmd.json"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$BUS_DIR"

usage() {
  cat <<EOF
mg-web · /web inspect onramp · Memory Glass + multi-browser DevTools

Usage:
  fcs web [subcommand]
  fcs /web …
  bash $MG_ROOT/scripts/mg-web.sh [subcommand]

Subcommands:
  inspect (default)   launch MG · queue open /web panel
  browsers | matrix   DevTools matrix (text; --json for agents)
  hygiene             arm job hygiene (Safari zombie class patch)
  learn | field       field-trigger learn tab
  pack | export       export inspect pack
  soak                soakProbe star/paste cases
  onramps             every terminal / code / AI entry
  open <browser>      safari|chrome|firefox|edge|arc|orion|brave|dia
  status              bus + paths
  help

Env:
  MG_APP              path to Memory Glass.app
  MG_WEB_BUS_DIR      bus dir (default ~/.panda/mg-session)
  FCS_AGENT=1         prefer text matrix, still queue bus

Examples:
  fcs web
  fcs web browsers --json
  fcs web open safari
  fcs hygiene
  /web inspect          # zsh after fcs install shell
EOF
}

# Peer browser DevTools onramps (same truth as web-inspect.js)
browser_matrix_text() {
  cat <<'EOF'
# Browser DevTools onramps (any machine)

| Browser        | Engine   | Open inspect                         | Keys        | Note |
|----------------|----------|--------------------------------------|-------------|------|
| Memory Glass   | WebKit   | fcs web · /web · Grok term /web      | dual float  | job hygiene · field triggers |
| Safari         | WebKit   | Settings→Advanced→Show Develop menu  | ⌥⌘I         | zombie * download → MG patches |
| Chrome         | Blink    | View→Developer→Developer Tools       | ⌥⌘I ⌥⌘J     | Performance · Coverage |
| Edge           | Blink    | same as Chromium                     | ⌥⌘I         | enterprise |
| Firefox        | Gecko    | Tools→Browser Tools→Web Dev Tools    | ⌥⌘I         | about:debugging |
| Arc            | Chromium | right-click Inspect                  | ⌥⌘I         | UX shell |
| Orion          | WebKit   | Develop menu                         | ⌥⌘I         | WebKit + extensions |
| Brave          | Blink    | same as Chromium                     | ⌥⌘I         | privacy defaults |
| Dia / others   | varies   | usually Chromium DevTools            | ⌥⌘I         | treat as Blink |

MG advantage: Preparing forever + * filename + dead cancel → job-hygiene (never leave zombie jobs).
EOF
}

browser_matrix_json() {
  cat <<'EOF'
{
  "schema": "mg.web-inspect/browsers/v1",
  "advantage": "job hygiene: no zombie Preparing, cancel always, reject * filenames",
  "browsers": [
    {"id":"memory-glass","engine":"WebKit","inspect":"fcs web|/web|__mgWebInspect.open()","keys":"dual inspect float","ours":true},
    {"id":"safari","engine":"WebKit","inspect":"Develop → Show Web Inspector","keys":"⌥⌘I","field":"zombie download *"},
    {"id":"chrome","engine":"Blink","inspect":"View → Developer → Developer Tools","keys":"⌥⌘I"},
    {"id":"edge","engine":"Blink","inspect":"Chromium DevTools","keys":"⌥⌘I"},
    {"id":"firefox","engine":"Gecko","inspect":"Tools → Web Developer Tools","keys":"⌥⌘I"},
    {"id":"arc","engine":"Chromium","inspect":"right-click Inspect","keys":"⌥⌘I"},
    {"id":"orion","engine":"WebKit","inspect":"Develop menu","keys":"⌥⌘I"},
    {"id":"brave","engine":"Blink","inspect":"Chromium DevTools","keys":"⌥⌘I"},
    {"id":"dia","engine":"varies","inspect":"usually Chromium","keys":"⌥⌘I"}
  ]
}
EOF
}

onramps_text() {
  cat <<EOF
# /web onramps — all terminals · all code · all agents

## Shell (universal)
  fcs web
  fcs /web
  fcs web inspect|browsers|hygiene|learn|pack|soak|onramps|open <browser>
  fcs inspect
  fcs hygiene
  /web …                 # zsh accept-line after: fcs install shell
  /inspect · /hygiene
  bash $MG_ROOT/scripts/mg-web.sh …

## Memory Glass (in-app)
  Grok terminal:  /web  /inspect  /hygiene  /web browsers  /web pack
  JS:  __mgWebInspect.open()  ·  __mgLazy.need('webInspect', cb)
  JS:  __mgJobHygiene.arm() · soakProbe()
  Hot module:  {op:'hot_module',name:'web-inspect.js'}

## Grok Build / xAI Grok
  Skill: memory-glass · fc-media-suite
  Slash in TUI (when wired): /web
  Agent shell: fcs web

## Claude Code
  /fc-web  or  fcs web \$ARGUMENTS
  Command: ~/.claude/commands/fc-web.md

## Codex · Cursor · Continue · OpenCode · Gemini · Qwen · …
  fcs install agents   # skill → every CLI in agent-packs/cli-registry.tsv
  Then: run \`fcs web\` from agent terminal tool

## Dispatch / fleet
  bash $MG_ROOT/scripts/mg-web.sh inspect
  Bus file: $BUS_FILE

## Peer browsers (open + learn DevTools)
  fcs web open safari|chrome|firefox|edge|arc|orion|brave

## Sync after hotpipe edits
  bash $MG_ROOT/scripts/mg-hotpipe-sync.sh && focus MG → ⌘⇧R

Bus: $BUS_FILE
App:  $APP
EOF
}

write_bus() {
  local action="$1"
  local tab="${2:-mg}"
  local extra="${3:-}"
  # minimal JSON without jq dependency
  cat >"$BUS_FILE" <<EOF
{"schema":"mg.web-cmd/v1","ts":"$TS","action":"$action","tab":"$tab","extra":$(printf '%s' "$extra" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"$extra\""),"source":"mg-web.sh","pid":$$}
EOF
  echo "bus → $BUS_FILE  action=$action tab=$tab"
}

launch_mg() {
  if [[ -d "$APP" ]]; then
    open -a "$APP" 2>/dev/null || open "$APP" 2>/dev/null || true
    echo "opened Memory Glass"
  elif [[ -d "/Applications/Memory Glass.app" ]]; then
    open -a "Memory Glass" 2>/dev/null || true
    echo "opened Memory Glass (Applications)"
  else
    echo "WARN: Memory Glass.app not found at $APP — bus still written; open MG and ⌘⇧R" >&2
  fi
}

open_peer_browser() {
  local b
  b="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  local url="${2:-https://example.com}"
  case "$b" in
    safari|saf)
      open -a Safari "$url" 2>/dev/null || true
      echo "Safari · enable Develop menu · ⌥⌘I  · field: zombie * download → fcs web hygiene"
      ;;
    chrome|google-chrome|chromium)
      open -a "Google Chrome" "$url" 2>/dev/null || open -a Chromium "$url" 2>/dev/null || true
      echo "Chrome · ⌥⌘I DevTools · Performance panel for speed work"
      ;;
    firefox|ff)
      open -a Firefox "$url" 2>/dev/null || true
      echo "Firefox · ⌥⌘I · about:debugging for multiproc"
      ;;
    edge|msedge)
      open -a "Microsoft Edge" "$url" 2>/dev/null || true
      echo "Edge · ⌥⌘I Chromium DevTools"
      ;;
    arc)
      open -a Arc "$url" 2>/dev/null || true
      echo "Arc · ⌥⌘I Chromium DevTools"
      ;;
    orion)
      open -a Orion "$url" 2>/dev/null || true
      echo "Orion · Develop · ⌥⌘I WebKit inspector"
      ;;
    brave)
      open -a "Brave Browser" "$url" 2>/dev/null || true
      echo "Brave · ⌥⌘I Chromium DevTools"
      ;;
    dia)
      open -a Dia "$url" 2>/dev/null || true
      echo "Dia · usually ⌥⌘I if Chromium-based"
      ;;
    mg|memory-glass|glass)
      launch_mg
      write_bus "open" "mg"
      echo "Memory Glass · /web inspect queued"
      ;;
    *)
      echo "unknown browser: $b" >&2
      echo "try: safari chrome firefox edge arc orion brave dia mg" >&2
      return 2
      ;;
  esac
}

cmd_status() {
  echo "mg-web status · $TS"
  echo "ROOT    $ROOT"
  echo "MG      $MG_ROOT"
  echo "APP     $APP  $([ -d "$APP" ] && echo OK || echo MISSING)"
  echo "BUS     $BUS_FILE"
  if [[ -f "$BUS_FILE" ]]; then
    echo "bus body:"; cat "$BUS_FILE"; echo
  else
    echo "bus     (empty)"
  fi
  echo "hotpipe web-inspect.js  $([ -f "$MG_ROOT/hotpipe/web-inspect.js" ] && echo OK || echo MISSING)"
  echo "hotpipe job-hygiene.js  $([ -f "$MG_ROOT/hotpipe/job-hygiene.js" ] && echo OK || echo MISSING)"
  command -v fcs >/dev/null && echo "fcs     $(command -v fcs)" || echo "fcs     not on PATH"
}

main() {
  local sub="${1:-inspect}"
  shift || true
  # strip leading slash
  sub="${sub#/}"
  sub="$(printf '%s' "$sub" | tr '[:upper:]' '[:lower:]')"

  case "$sub" in
    help|h|-h|--help) usage ;;
    status|stat) cmd_status ;;
    onramps|onramp|ramps|entry|entries)
      onramps_text
      ;;
    browsers|matrix|browser|devtools)
      if [[ "${1:-}" == "--json" || "${1:-}" == "-j" || "${FCS_AGENT:-}" == "1" ]]; then
        browser_matrix_json
      else
        browser_matrix_text
      fi
      # still queue MG browsers tab when interactive
      if [[ -t 1 && "${FCS_AGENT:-}" != "1" ]]; then
        write_bus "open" "browsers"
        launch_mg
      fi
      ;;
    hygiene|jobs|job)
      write_bus "open" "hygiene"
      launch_mg
      echo "queued · arm job hygiene (zombie download patch)"
      ;;
    learn|field|triggers)
      write_bus "open" "field"
      launch_mg
      echo "queued · field trigger tab"
      ;;
    pack|export)
      write_bus "pack" "mg"
      launch_mg
      echo "queued · export inspect pack (in MG)"
      ;;
    soak)
      write_bus "soak" "hygiene"
      launch_mg
      echo "queued · hygiene soakProbe"
      ;;
    open)
      open_peer_browser "${1:-safari}" "${2:-https://example.com}"
      ;;
    inspect|web|webi|panel|""|mg)
      write_bus "open" "mg"
      launch_mg
      echo "queued · /web inspect (MG). In-app: Grok term /web · or wait for bus poll."
      if [[ "${FCS_AGENT:-}" == "1" ]]; then
        echo "--- agent matrix ---"
        browser_matrix_json
      fi
      ;;
    *)
      # unknown → treat as inspect with note, or open browser name
      case "$sub" in
        safari|chrome|firefox|edge|arc|orion|brave|dia)
          open_peer_browser "$sub" "${1:-https://example.com}"
          ;;
        *)
          echo "unknown subcommand: $sub" >&2
          usage >&2
          exit 2
          ;;
      esac
      ;;
  esac
}

main "$@"
