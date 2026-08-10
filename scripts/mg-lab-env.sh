#!/usr/bin/env bash
# Memory Glass / fornever lab environment — one doctor for all planes
#
#   bash scripts/mg-lab-env.sh doctor|status|onboard|sync|web|xr|fcs|hands|voice
#
# Integrates: Memory Glass hotpipe · /web hygiene · XR glasses · fcs suite ·
#             desktop-harness (xfreeze2) · Quill (xfreeze2) · upstream pin
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAB="$ROOT"
MG="$ROOT/experiments/memory-glass"
STATE="${MG_LAB_STATE:-$HOME/.panda/lab-env}"
VENDOR="${MG_VENDOR_DIR:-$HOME/.panda/vendor}"
CMD="${1:-doctor}"
shift || true

mkdir -p "$STATE" "$VENDOR"

info() { echo "==> $*"; }
ok() { echo "  OK   $*"; }
warn() { echo "  WARN $*"; }
fail() { echo "  FAIL $*"; }

cmd_doctor() {
  info "lab env doctor · $ROOT"
  local bad=0
  check() {
    if [[ "$2" == "1" ]]; then ok "$1"
    else fail "$1 — $3"; bad=1; fi
  }

  check "grok-build root" "$([[ -f $ROOT/Cargo.toml || -f $ROOT/SOURCE_REV ]] && echo 1 || echo 0)" "missing monorepo"
  check "memory-glass" "$([[ -d $MG/hotpipe ]] && echo 1 || echo 0)" "missing experiments/memory-glass"
  check "job-hygiene.js" "$([[ -f $MG/hotpipe/job-hygiene.js ]] && echo 1 || echo 0)" "missing"
  check "web-inspect.js" "$([[ -f $MG/hotpipe/web-inspect.js ]] && echo 1 || echo 0)" "missing"
  check "mg-xr-glasses.js" "$([[ -f $MG/hotpipe/mg-xr-glasses.js ]] && echo 1 || echo 0)" "missing"
  check "mg-web.sh" "$([[ -x $MG/scripts/mg-web.sh ]] && echo 1 || echo 0)" "chmod +x"
  check "mg-xr-dev.sh" "$([[ -x $MG/scripts/mg-xr-dev.sh ]] && echo 1 || echo 0)" "chmod +x"
  check "fcs CLI" "$([[ -x $ROOT/plugins/fc-media-suite/scripts/fcs ]] && echo 1 || echo 0)" "missing plugin"
  check "fcs hub source" "$([[ -d $MG/pwa/fcs ]] && echo 1 || echo 0)" "missing pwa/fcs"
  check "Memory Glass.app" "$([[ -d ${MG_APP:-$HOME/Applications/Memory Glass.app} ]] && echo 1 || echo 0)" "install/build app"
  check "SOURCE_REV pin" "$([[ -f $ROOT/SOURCE_REV ]] && echo 1 || echo 0)" "missing pin"

  if command -v desktop-harness >/dev/null 2>&1; then
    ok "desktop-harness on PATH ($(desktop-harness --version 2>/dev/null | head -1 || echo present))"
  elif [[ -x "$VENDOR/desktop-harness/desktop-harness" ]]; then
    warn "desktop-harness vendored — add $VENDOR/desktop-harness to PATH or reinstall"
  else
    warn "desktop-harness missing — bash scripts/install-desktop-harness.sh"
  fi

  if [[ -d "$HOME/Applications/Quill.app" ]]; then
    ok "Quill.app installed"
  else
    warn "Quill missing — bash scripts/install-quill.sh"
  fi

  if command -v fcs >/dev/null 2>&1 || [[ -x $ROOT/plugins/fc-media-suite/scripts/fcs ]]; then
    ok "fcs reachable"
  else
    warn "fcs not on PATH — use plugins/fc-media-suite/scripts/fcs or fcs install"
  fi

  # buses
  if [[ -f "$HOME/.panda/mg-session/web-cmd.json" ]]; then
    ok "web-cmd bus exists"
  else
    warn "web-cmd bus idle (fcs web will create)"
  fi
  if curl -sf --max-time 1 http://127.0.0.1:8787/api/xr/status >/dev/null 2>&1; then
    ok "XR room API :8787"
  else
    warn "XR serve down — mg-xr-dev.sh serve"
  fi
  if curl -sf --max-time 2 https://fcs.ugrad.ai/version.json >/dev/null 2>&1; then
    ok "fcs.ugrad.ai live"
  else
    warn "fcs.ugrad.ai unreachable (network/DNS)"
  fi

  if [[ -f "$ROOT/SOURCE_REV" ]]; then
    echo "  pin  SOURCE_REV=$(cat "$ROOT/SOURCE_REV" | tr -d '\n' | head -c 12)…"
  fi

  write_latest
  if [[ "$bad" == "1" ]]; then
    echo "==> doctor found failures"
    return 1
  fi
  echo "==> doctor green"
}

write_latest() {
  python3 - "$STATE/LATEST.json" "$ROOT" <<'PY' 2>/dev/null || true
import json,sys,time,os
path, root = sys.argv[1], sys.argv[2]
snap = {
  "ver": "mg-lab-env-v1",
  "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "root": root,
  "planes": {
    "web": "fcs web · mg-web.sh · job-hygiene · web-inspect",
    "xr": "mg-xr-dev.sh · :8787 room",
    "fcs": "plugins/fc-media-suite · fcs.ugrad.ai",
    "hands": "desktop-harness (xfreeze2)",
    "voice": "Quill (xfreeze2)",
    "upstream": "SOURCE_REV + path-checkout",
  },
  "commands": {
    "doctor": "bash scripts/mg-lab-env.sh doctor",
    "web": "fcs web",
    "xr": "bash experiments/memory-glass/scripts/mg-xr-dev.sh auto",
    "hands": "desktop-harness --doctor",
    "sync_hotpipe": "bash experiments/memory-glass/scripts/mg-hotpipe-sync.sh",
    "upstream": "./scripts/sync-upstream-path-checkout.sh upstream/main",
  },
}
open(path,"w").write(json.dumps(snap, indent=2)+"\n")
print(path)
PY
}

cmd_onboard() {
  cat <<EOF
fornever lab env · anyone (human + AI) onramp
=============================================

Repo: $ROOT
SOURCE_REV: $(cat "$ROOT/SOURCE_REV" 2>/dev/null || echo '?')

1. Product shell (Memory Glass)
   bash experiments/memory-glass/scripts/mg-hotpipe-sync.sh
   # or rebuild: cd experiments/memory-glass && bash build-mac-app.sh
   open -a "Memory Glass"   # never pkill

2. /web inspect + job hygiene (Safari zombie class)
   fcs web
   fcs hygiene
   fcs web browsers --json
   # in MG Grok term: /web · /hygiene · /web soak

3. XR glasses multi-seat
   bash experiments/memory-glass/scripts/mg-xr-dev.sh auto
   open http://127.0.0.1:8787/xr-onboard.html

4. Agent hands (desktop-harness · xfreeze2)
   bash scripts/install-desktop-harness.sh
   desktop-harness --doctor
   desktop-harness daemon start --bg

5. Voice into any field (Quill · xfreeze2)
   bash scripts/install-quill.sh
   open -a Quill

6. fcs suite hub
   https://fcs.ugrad.ai/
   bash scripts/fcs-site-deploy.sh   # local :8790/fcs/

7. Upstream xAI product tree (do NOT merge histories)
   git fetch upstream
   ./scripts/sync-upstream-path-checkout.sh upstream/main

Dispatch (second terminal hands, never kill MG):
   bash ~/.grok/skills/mg-dispatch/scripts/mg-dispatch.sh status
   mgd web | mgd hygiene | mgd xr   # after skill refresh

Agent rules:
   · edit hotpipe JS → mg-hotpipe-sync / ⌘⇧R
   · never bind 8765/8766 (Soft Path)
   · field glitch → __mgJobHygiene.learn → mitigation
EOF
}

cmd_sync() {
  info "hotpipe sync + lab snapshot"
  if [[ -x "$MG/scripts/mg-hotpipe-sync.sh" ]]; then
    bash "$MG/scripts/mg-hotpipe-sync.sh" --no-reload || true
  fi
  write_latest
  info "done · LATEST $STATE/LATEST.json"
}

cmd_web() {
  if [[ -x "$MG/scripts/mg-web.sh" ]]; then
    bash "$MG/scripts/mg-web.sh" "$@"
  else
    bash "$ROOT/plugins/fc-media-suite/scripts/fcs" web "$@"
  fi
}

cmd_xr() {
  bash "$MG/scripts/mg-xr-dev.sh" "${1:-auto}" "${@:2}"
}

cmd_fcs() {
  local fcs="$ROOT/plugins/fc-media-suite/scripts/fcs"
  [[ -x "$fcs" ]] || die_missing
  bash "$fcs" "$@"
}

die_missing() { echo "missing fcs" >&2; exit 1; }

cmd_hands() {
  if command -v desktop-harness >/dev/null 2>&1; then
    desktop-harness "$@"
  elif [[ -x "$VENDOR/desktop-harness/desktop-harness" ]]; then
    "$VENDOR/desktop-harness/desktop-harness" "$@"
  else
    info "installing desktop-harness…"
    bash "$ROOT/scripts/install-desktop-harness.sh"
    desktop-harness "$@"
  fi
}

cmd_voice() {
  if [[ -d "$HOME/Applications/Quill.app" ]]; then
    open -a Quill
  else
    bash "$ROOT/scripts/install-quill.sh"
  fi
}

case "$CMD" in
  doctor|doc|status|st) cmd_doctor ;;
  onboard|guide) cmd_onboard ;;
  sync) cmd_sync ;;
  web|inspect|hygiene) cmd_web "$CMD" "$@" ;;
  xr|glasses) cmd_xr "$@" ;;
  fcs) cmd_fcs "$@" ;;
  hands|harness|dh) cmd_hands "$@" ;;
  voice|quill) cmd_voice "$@" ;;
  help|-h|--help)
    sed -n '2,12p' "$0"
    ;;
  *)
    echo "unknown: $CMD (doctor|onboard|sync|web|xr|fcs|hands|voice)" >&2
    exit 2
    ;;
esac
