#!/usr/bin/env bash
# Sync source hotpipe → Memory Glass.app Resources, then hot-reload menus (no app quit).
#
# Usage:
#   bash experiments/memory-glass/scripts/mg-hotpipe-sync.sh
#   bash experiments/memory-glass/scripts/mg-hotpipe-sync.sh --no-reload   # copy only
#   MG_APP="$HOME/Applications/Memory Glass.app" bash scripts/mg-hotpipe-sync.sh
#
# After sync: app picks up files on next ⌘⇧R (Hard Reload Hot-pipe) or TOOLS → HOT.
# Prefer: leave Memory Glass open, run this script, then ⌘⇧R in the browser window.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/hotpipe"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
DEST="$APP/Contents/Resources/hotpipe"
RELOAD=1
for a in "$@"; do
  case "$a" in
    --no-reload|-n) RELOAD=0 ;;
  esac
done

[[ -d "$SRC" ]] || { echo "missing source hotpipe: $SRC" >&2; exit 1; }
[[ -d "$APP" ]] || { echo "missing app: $APP" >&2; exit 1; }

mkdir -p "$DEST"
# rsync if available, else cp -R
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude '.DS_Store' \
    --exclude '*.bak*' \
    "$SRC/" "$DEST/"
else
  # shellcopy without deleting extra dest files
  cp -R "$SRC/." "$DEST/"
fi

# Pre-rebuild companions: existing app binaries only re-inject files they already
# list. Append new modules onto a known inject target so ⌘⇧R picks them up.
# Source tree stays clean (standalone files remain authoritative).
bake_companion() {
  local host="$1" companion="$2" mark="$3" label="$4"
  if [[ -f "$DEST/$host" && -f "$DEST/$companion" ]]; then
    if ! grep -q "$mark" "$DEST/$host" 2>/dev/null; then
      {
        printf '\n/* === %s (sync bake · source is %s) === */\n' "$mark" "$companion"
        cat "$DEST/$companion"
      } >> "$DEST/$host"
      echo "==> baked $label companion into dest $host (hot-reload without rebuild)"
    fi
  fi
}
bake_companion "lark-governance.js" "gt-flow-plane.js" "COMPANION_GT_FLOW_PLANE" "gt-flow"
# quantum host gets tensor + qbit stack (order: tensor first, then stack)
bake_companion "quantum-webgrid.js" "ugrad-ladder.js" "COMPANION_UGRAD_LADDER" "ugrad-ladder"
bake_companion "quantum-webgrid.js" "ugrad-webgrid-tensor.js" "COMPANION_UGRAD_TENSOR" "ugrad-tensor"
bake_companion "quantum-webgrid.js" "qbit-stack-plane.js" "COMPANION_QBIT_STACK" "qbit-stack"
# keyboard-beats host gets staff lab (chromatic · transpose · playalong)
bake_companion "keyboard-beats.js" "staff-lab-plane.js" "COMPANION_STAFF_LAB" "staff-lab"
# qbit spine bake onto codec for pre-rebuild hot-reload (⌘⇧R without cargo build)
bake_companion "qbit-codec.js" "qbit-bus.js" "COMPANION_QBIT_BUS" "qbit-bus"
bake_companion "qbit-codec.js" "qbit-loop.js" "COMPANION_QBIT_LOOP" "qbit-loop"
bake_companion "qbit-codec.js" "qbit-dac.js" "COMPANION_QBIT_DAC" "qbit-dac"
bake_companion "qbit-codec.js" "qbit-router.js" "COMPANION_QBIT_ROUTER" "qbit-router"
bake_companion "qbit-codec.js" "qbit-adapters.js" "COMPANION_QBIT_ADAPTERS" "qbit-adapters"
bake_companion "qbit-codec.js" "qbit-native-bridge.js" "COMPANION_QBIT_NATIVE" "qbit-native"
bake_companion "qbit-codec.js" "qbit-truss.js" "COMPANION_QBIT_TRUSS" "qbit-truss"
bake_companion "qbit-codec.js" "qbit-term-plane.js" "COMPANION_QBIT_TERM" "qbit-term"
# Keep spine companions for lab mode only (product-core injects desk/rec cleanly).
# Do NOT bake annotate/desk/chrome into live/session-rec — that caused multi-MB parse lag.
bake_companion "qbit-codec.js" "mg-agent-desk.js" "COMPANION_AGENT_DESK" "agent-desk"
bake_companion "qbit-codec.js" "qbit-race-sitrep.js" "COMPANION_QBIT_RACE" "qbit-race"
bake_companion "qbit-codec.js" "qbit-l1-pilot.js" "COMPANION_QBIT_L1" "qbit-l1"
bake_companion "session-recorder.js" "mg-lazy-boot.js" "COMPANION_LAZY_BOOT" "lazy-boot→rec"
# Live DRAW→DESK + element PICK (Cursor-style) without full rebuild
bake_companion "session-recorder.js" "mg-live-collab.js" "COMPANION_LIVE_COLLAB" "live-collab→rec"
bake_companion "mg-agent-desk.js" "mg-live-collab.js" "COMPANION_LIVE_COLLAB" "live-collab→desk"
# 2019 MBP / low-power CSS + heuristics
bake_companion "session-recorder.js" "mg-compat.js" "COMPANION_COMPAT" "compat→rec"
# DATA drawer Bench (freya/hexbench/trades/pynote) hot-reload without rebuild
bake_companion "mg-right-drawer.js" "mg-data-bench.js" "COMPANION_DATA_BENCH" "data-bench→right"
# Bottom chrome: glass LAB strip + tabs readout (mirror top header)
bake_companion "session-recorder.js" "mg-bottom-chrome.js" "COMPANION_BOTTOM_CHROME" "bottom-chrome→rec"
bake_companion "mg-chrome-tokens.js" "mg-bottom-chrome.js" "COMPANION_BOTTOM_CHROME" "bottom-chrome→tokens"
# Full kbatch.ugrad.ai site hub (local :8899 + live) for collab sessions
bake_companion "mg-tools-drawer.js" "mg-kbatch-site.js" "COMPANION_KBATCH_SITE" "kbatch-site→tools"
bake_companion "kbatch-fleet-bridge.js" "mg-kbatch-site.js" "COMPANION_KBATCH_SITE" "kbatch-site→fleet"
bake_companion "search-comms.js" "site-atlas.js" "COMPANION_SITE_ATLAS" "site-atlas"
# harvest seeds (keyboard matrix atlas already in keyboard-atlas-seed.js inject)
bake_companion "float-keyboard.js" "key-popout-menus-seed.js" "COMPANION_KEY_POPOUT" "key-popout"

# ad-hoc re-sign (Resources change)
if [[ -x "$ROOT/scripts/resign-app.sh" ]]; then
  bash "$ROOT/scripts/resign-app.sh" "$APP" >/dev/null
fi

echo "==> hotpipe synced"
echo "    src:  $SRC"
echo "    dest: $DEST"
echo "    tip:  focus Memory Glass → ⌘⇧R  (Nav · Hard Reload Hot-pipe)"
echo "          or TOOLS → HOT"

if [[ "$RELOAD" == "1" ]]; then
  # Best-effort: activate app and send ⌘⇧R via System Events (may need Accessibility)
  if osascript >/dev/null 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  set procs to name of every process whose background only is false
end tell
if procs contains "memory-glass" or procs contains "Memory Glass" then
  tell application "System Events"
    set frontmost of process "memory-glass" to true
  end tell
  delay 0.25
  tell application "System Events"
    keystroke "r" using {command down, shift down}
  end tell
  return "sent"
else
  return "no-proc"
end if
APPLESCRIPT
  then
    echo "==> attempted ⌘⇧R via System Events (grant Accessibility if it no-ops)"
  else
    echo "==> press ⌘⇧R in Memory Glass to remount menus"
  fi
fi
