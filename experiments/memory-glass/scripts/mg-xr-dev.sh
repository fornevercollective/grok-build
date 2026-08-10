#!/usr/bin/env bash
# Memory Glass · XR / VR glasses quick-pipe · sync · multi-seat · AI
#
# Usage:
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh            # auto
#   bash …/mg-xr-dev.sh auto|sync|serve|hot|stop|status|list
#   bash …/mg-xr-dev.sh detect|doctor|onboard|quest|open [device]
#   bash …/mg-xr-dev.sh room [lab]     # print room + peers
#   bash …/mg-xr-dev.sh for-ai         # agent snapshot JSON
#   bash …/mg-xr-dev.sh restart        # stop + serve (room API)
#
# Ports: PWA 8787 only. Never 8765/8766 (Soft Path).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${MG_XR_PORT:-${MG_PWA_PORT:-8787}}"
HOST="${MG_XR_HOST:-127.0.0.1}"
PWA="$ROOT/pwa"
HP="$ROOT/hotpipe"
REG="$HP/data/xr-glasses-registry.json"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
STATE_DIR="${MG_XR_STATE:-$HOME/.panda/mg-xr}"
PID_FILE="$STATE_DIR/pwa.pid"
LOG_FILE="$STATE_DIR/pwa.log"
SERVE_PY="$ROOT/scripts/mg-xr-serve.py"
CMD="${1:-auto}"
shift || true

mkdir -p "$STATE_DIR"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

lan_ip() {
  if command -v ipconfig >/dev/null 2>&1; then
    local ip
    ip=$(ipconfig getifaddr en0 2>/dev/null || true)
    [[ -n "${ip:-}" ]] && { echo "$ip"; return; }
    ip=$(ipconfig getifaddr en1 2>/dev/null || true)
    [[ -n "${ip:-}" ]] && { echo "$ip"; return; }
  fi
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}' && return
  fi
  echo ""
}

xr_url() {
  local device="${1:-}"
  local h="${2:-$HOST}"
  local room="${3:-}"
  local q="mg_xr=1"
  [[ -n "$device" ]] && q="${q}&device=${device}"
  [[ -n "$room" ]] && q="${q}&room=${room}&join=1"
  echo "http://${h}:${PORT}/xr-dev.html?${q}"
}

api_ok() {
  curl -sf --max-time 2 "http://127.0.0.1:${PORT}/api/xr/status" >/dev/null 2>&1
}

write_latest() {
  local lan
  lan=$(lan_ip)
  python3 - "$PORT" "$ROOT" "$lan" "$STATE_DIR/LATEST.json" <<'PY'
import json, sys, time
port, root, lan, path = sys.argv[1:5]
snap = {
  "ver": "mg-xr-dev-v2",
  "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "port": int(port),
  "root": root,
  "urls": {
    "local": f"http://127.0.0.1:{port}/xr-dev.html?mg_xr=1",
    "lan": f"http://{lan}:{port}/xr-dev.html?mg_xr=1" if lan else None,
    "onboard": f"http://127.0.0.1:{port}/xr-onboard.html",
    "forAi": f"http://127.0.0.1:{port}/api/xr/for-ai",
    "room": f"http://127.0.0.1:{port}/api/xr/room?room=lab",
  },
  "agent": {
    "sync": "bash experiments/memory-glass/scripts/mg-xr-dev.sh auto",
    "hot": "bash experiments/memory-glass/scripts/mg-xr-dev.sh hot",
    "doctor": "bash experiments/memory-glass/scripts/mg-xr-dev.sh doctor",
    "console": ["__mgXr.auto()", "__mgXr.forAi()", "__mgXr.room.join('lab')"],
    "neverPorts": [8765, 8766],
  },
}
open(path, "w").write(json.dumps(snap, indent=2) + "\n")
print(path)
PY
}

cmd_list() {
  if [[ -f "$REG" ]] && command -v python3 >/dev/null 2>&1; then
    python3 - "$REG" <<'PY'
import json, sys
p = sys.argv[1]
with open(p) as f:
    reg = json.load(f)
print(f"registry {reg.get('ver','?')} · {len(reg.get('devices',[]))} devices\n")
print(f"{'ID':<22} {'CLASS':<16} {'BRAND':<16} NAME")
print("-" * 72)
for d in reg.get("devices", []):
    print(f"{d.get('id',''):<22} {d.get('class',''):<16} {d.get('brand',''):<16} {d.get('name','')}")
PY
  else
    [[ -f "$REG" ]] || die "missing $REG"
    grep -E '"id"|"name"|"class"' "$REG" | head -80
  fi
}

cmd_detect() {
  info "host environment"
  local adb_dev=""
  if command -v adb >/dev/null 2>&1; then
    adb_dev=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device"{print $1; exit}')
  fi
  if [[ -n "$adb_dev" ]]; then
    echo "detected: quest-class (adb device=$adb_dev)"
    echo "profile:  quest-3"
    echo "url:      $(xr_url quest-3 "$(lan_ip || echo $HOST)")"
  else
    echo "detected: desktop-proxy"
    echo "url:      $(xr_url desktop-proxy)"
  fi
  echo "registry: $REG"
  echo "pwa:      $PWA"
  echo "app:      $APP"
  if api_ok; then
    echo "room api: ok"
  else
    echo "room api: down (run: $0 serve)"
  fi
}

sync_pwa_hotpipe() {
  mkdir -p "$PWA/hotpipe/data" "$PWA/data"
  cp -f "$HP/mg-xr-glasses.js" "$PWA/hotpipe/mg-xr-glasses.js"
  cp -f "$REG" "$PWA/hotpipe/data/xr-glasses-registry.json"
  cp -f "$REG" "$PWA/data/xr-glasses-registry.json"
  # onboard page is source under pwa/
  info "pwa hotpipe xr module + registry"
}

cmd_sync() {
  [[ -d "$HP" ]] || die "missing hotpipe $HP"
  [[ -f "$HP/mg-xr-glasses.js" ]] || die "missing mg-xr-glasses.js"
  sync_pwa_hotpipe

  if [[ -x "$ROOT/scripts/mg-hotpipe-sync.sh" ]]; then
    info "mg-hotpipe-sync (full hotpipe → app)"
    bash "$ROOT/scripts/mg-hotpipe-sync.sh" --no-reload || bash "$ROOT/scripts/mg-hotpipe-sync.sh" -n || true
  elif [[ -d "$APP/Contents/Resources" ]]; then
    info "copy hotpipe → app Resources"
    mkdir -p "$APP/Contents/Resources/hotpipe/data"
    rsync -a --exclude '.DS_Store' "$HP/" "$APP/Contents/Resources/hotpipe/" 2>/dev/null \
      || cp -R "$HP/." "$APP/Contents/Resources/hotpipe/"
  else
    info "app missing at $APP — pwa-only sync"
  fi

  # Force re-bake XR companion when source is newer (v2 upgrades)
  local dest="$APP/Contents/Resources/hotpipe"
  if [[ -f "$dest/live.js" && -f "$dest/mg-xr-glasses.js" ]]; then
    if ! grep -q "mg-xr-glasses-v2" "$dest/live.js" 2>/dev/null; then
      # strip old companion marker block is hard; append fresh v2 mark
      {
        printf '\n/* === COMPANION_MG_XR_GLASSES (sync bake · source is mg-xr-glasses.js) === */\n'
        cat "$dest/mg-xr-glasses.js"
      } >> "$dest/live.js"
      info "baked mg-xr-glasses v2 → dest live.js"
    fi
  fi

  {
    echo "{"
    echo "  \"ts\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"port\": $PORT,"
    echo "  \"url\": \"$(xr_url)\","
    echo "  \"lan\": \"$(lan_ip)\","
    echo "  \"root\": \"$ROOT\","
    echo "  \"ver\": \"mg-xr-dev-v2\""
    echo "}"
  } > "$STATE_DIR/last-sync.json"
  write_latest >/dev/null || true

  info "sync ok"
  echo "    tip: focus Memory Glass → ⌘⇧R  (or: $0 hot)"
  echo "    pwa:  $(xr_url)"
  echo "    onboard: http://127.0.0.1:${PORT}/xr-onboard.html"
}

cmd_stop() {
  if [[ -f "$PID_FILE" ]]; then
    local old
    old=$(cat "$PID_FILE" 2>/dev/null || true)
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      kill "$old" 2>/dev/null || true
      sleep 0.3
      kill -9 "$old" 2>/dev/null || true
      info "stopped pwa pid=$old"
    fi
    rm -f "$PID_FILE"
  else
    info "no pid file"
  fi
}

cmd_serve() {
  sync_pwa_hotpipe
  if [[ "$PORT" == "8765" || "$PORT" == "8766" ]]; then
    die "port $PORT is Soft Path exclusive — use 8787"
  fi
  [[ -f "$SERVE_PY" ]] || die "missing $SERVE_PY"
  [[ -d "$PWA" ]] || die "missing pwa $PWA"

  # If something already listens with room API, reuse
  if api_ok; then
    info "room API already up on :$PORT"
    echo "    $(xr_url)"
    write_latest >/dev/null || true
    return 0
  fi

  # Port busy without API → stop our old pid or fail with hint
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      if [[ -f "$PID_FILE" ]]; then
        info "replacing non-API server on :$PORT"
        cmd_stop
        sleep 0.4
      else
        die "port $PORT in use without XR room API — free it or: lsof -nP -iTCP:$PORT"
      fi
    fi
  fi

  info "serve room API + PWA on :$PORT"
  (
    export MG_XR_PORT="$PORT"
    export MG_XR_PWA="$PWA"
    export MG_XR_STATE="$STATE_DIR"
    exec python3 "$SERVE_PY"
  ) >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  sleep 0.5
  if ! api_ok; then
    echo "warn: room API not responding yet — see $LOG_FILE" >&2
  fi
  info "pid $(cat "$PID_FILE") · log $LOG_FILE"
  echo "    local   $(xr_url)"
  echo "    onboard http://127.0.0.1:${PORT}/xr-onboard.html"
  echo "    for-ai  http://127.0.0.1:${PORT}/api/xr/for-ai"
  local lan
  lan=$(lan_ip)
  if [[ -n "$lan" ]]; then
    echo "    lan     $(xr_url "" "$lan")"
    echo "    room    http://${lan}:${PORT}/xr-dev.html?mg_xr=1&room=lab&join=1"
  fi
  write_latest >/dev/null || true
}

cmd_restart() {
  cmd_stop
  sleep 0.3
  cmd_serve
}

cmd_status() {
  echo "Memory Glass XR dev v2"
  echo "  root     $ROOT"
  echo "  port     $PORT  (never 8765/8766)"
  echo "  url      $(xr_url)"
  local lan
  lan=$(lan_ip)
  [[ -n "$lan" ]] && echo "  lan      $(xr_url "" "$lan")"
  echo "  registry $([[ -f $REG ]] && echo ok || echo MISSING)"
  echo "  module   $([[ -f $HP/mg-xr-glasses.js ]] && echo ok || echo MISSING)"
  echo "  pwa page $([[ -f $PWA/xr-dev.html ]] && echo ok || echo MISSING)"
  echo "  onboard  $([[ -f $PWA/xr-onboard.html ]] && echo ok || echo MISSING)"
  echo "  serve.py $([[ -f $SERVE_PY ]] && echo ok || echo MISSING)"
  echo "  app      $([[ -d $APP ]] && echo ok || echo missing)"
  if api_ok; then
    echo "  room api up"
    curl -sf "http://127.0.0.1:${PORT}/api/xr/status" 2>/dev/null | head -c 200; echo
  elif [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "  serve    pid=$(cat "$PID_FILE") (no room API — run: $0 restart)"
  else
    echo "  serve    down"
  fi
  if command -v adb >/dev/null 2>&1; then
    echo "  adb:"
    adb devices 2>/dev/null | sed 's/^/    /' || true
  else
    echo "  adb      not installed"
  fi
  cmd_detect
}

cmd_doctor() {
  info "XR doctor"
  local fail=0
  check() {
    local name="$1" ok="$2" fix="$3"
    if [[ "$ok" == "1" ]]; then
      echo "  OK   $name"
    else
      echo "  FAIL $name — $fix"
      fail=1
    fi
  }
  check "registry" "$([[ -f $REG ]] && echo 1 || echo 0)" "missing $REG"
  check "module" "$([[ -f $HP/mg-xr-glasses.js ]] && echo 1 || echo 0)" "missing hotpipe module"
  check "serve.py" "$([[ -f $SERVE_PY ]] && echo 1 || echo 0)" "missing mg-xr-serve.py"
  check "xr-dev.html" "$([[ -f $PWA/xr-dev.html ]] && echo 1 || echo 0)" "missing pwa page"
  check "onboard" "$([[ -f $PWA/xr-onboard.html ]] && echo 1 || echo 0)" "missing xr-onboard.html"
  check "port not Soft Path" "$([[ $PORT != 8765 && $PORT != 8766 ]] && echo 1 || echo 0)" "use 8787"
  check "python3" "$(command -v python3 >/dev/null && echo 1 || echo 0)" "install python3"
  # module version
  if grep -q "mg-xr-glasses-v2" "$HP/mg-xr-glasses.js" 2>/dev/null; then
    echo "  OK   module v2"
  else
    echo "  FAIL module v2 mark — resync"
    fail=1
  fi
  if ! api_ok; then
    echo "  WARN room API down — run: $0 serve"
  else
    echo "  OK   room API"
  fi
  if [[ -d "$APP" ]]; then
    echo "  OK   Memory Glass.app"
  else
    echo "  WARN app missing at $APP (PWA-only still works)"
  fi
  if command -v adb >/dev/null 2>&1; then
    echo "  OK   adb present"
  else
    echo "  WARN adb missing (Quest reverse needs platform-tools / MQDH)"
  fi
  write_latest >/dev/null || true
  echo "  LATEST $STATE_DIR/LATEST.json"
  if [[ "$fail" == "1" ]]; then
    echo "==> doctor found problems"
    return 1
  fi
  echo "==> doctor green"
  return 0
}

cmd_onboard() {
  cat <<EOF
Memory Glass · XR glasses — anyone can sync and work
====================================================

Prereqs
  • This repo (fornevercollective/grok-build)
  • Mac host with Memory Glass.app (optional but best) OR any browser for PWA
  • Glasses kit: Quest (ADB) · XREAL/VITURE/Rokid (USB-C host) · Vision Pro · or desktop proxy
  • AI agent with shell + file edit (Grok / Claude / Cursor / …)

1. Clone / pull
   git clone https://github.com/fornevercollective/grok-build.git
   cd grok-build && git checkout sync/0.2.121-fc-media   # or main when merged

2. One command on host
   bash experiments/memory-glass/scripts/mg-xr-dev.sh auto

3. Host desk
   open http://127.0.0.1:${PORT}/xr-dev.html?mg_xr=1
   onboard: http://127.0.0.1:${PORT}/xr-onboard.html
   Memory Glass: TOOLS → XR  or  ⌘⇧R after hotpipe edits

4. Glasses join same room
   Quest:  bash …/mg-xr-dev.sh quest
           headset browser → http://127.0.0.1:${PORT}/xr-dev.html?device=quest-3&room=lab&join=1
   LAN:    http://$(lan_ip || echo YOUR_LAN_IP):${PORT}/xr-dev.html?mg_xr=1&room=lab&join=1
   Tethered AR: open LAN URL on host browser mirrored to glasses; apply xreal-one / viture-pro / rokid-max

5. AI agent loop
   curl -s http://127.0.0.1:${PORT}/api/xr/for-ai | jq .
   # or in page: __mgXr.forAi()
   Edit experiments/memory-glass/hotpipe/*.js
   bash experiments/memory-glass/scripts/mg-xr-dev.sh hot
   Peers in room=lab see shared device/optics via /api/xr/room

Rules
  • Port ${PORT} only — never 8765/8766 (Soft Path)
  • Never pkill Memory Glass — use hot / ⌘⇧R
  • WebXR needs secure context (localhost via adb reverse counts)

Doctor:  bash experiments/memory-glass/scripts/mg-xr-dev.sh doctor
Docs:    experiments/memory-glass/docs/XR-GLASSES-DEV.md
EOF
}

cmd_quest() {
  local lan
  lan=$(lan_ip)
  [[ -n "$lan" ]] || lan="$HOST"
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb not found — install platform-tools / Meta Quest Developer Hub"
    echo "manual: http://${lan}:${PORT}/xr-dev.html?device=quest-3&room=lab&join=1"
    return 1
  fi
  info "adb reverse tcp:${PORT} → host :${PORT}"
  adb reverse "tcp:${PORT}" "tcp:${PORT}" || true
  adb devices
  echo ""
  echo "On headset Meta Browser open:"
  echo "  http://127.0.0.1:${PORT}/xr-dev.html?device=quest-3&mg_xr=1&room=lab&join=1"
  echo "  (LAN) http://${lan}:${PORT}/xr-dev.html?device=quest-3&mg_xr=1&room=lab&join=1"
  echo ""
  echo "HzOS MCP: get_adb_path · stream_device_logcat · take_screenshot"
}

cmd_hot() {
  cmd_sync
  if osascript >/dev/null 2>&1 <<'APPLESCRIPT'
tell application "System Events"
  set procs to name of every process whose background only is false
end tell
if procs contains "memory-glass" or procs contains "Memory Glass" then
  tell application "System Events"
    try
      set frontmost of process "memory-glass" to true
    on error
      set frontmost of process "Memory Glass" to true
    end try
  end tell
  delay 0.2
  tell application "System Events"
    keystroke "r" using {command down, shift down}
  end tell
  return "sent"
else
  return "no-proc"
end if
APPLESCRIPT
  then
    info "⌘⇧R sent (Accessibility may be required)"
  else
    info "press ⌘⇧R in Memory Glass to remount XR pipe"
  fi
}

cmd_open() {
  local device="${1:-desktop-proxy}"
  cmd_serve
  local url
  url=$(xr_url "$device")
  info "open $url"
  if command -v open >/dev/null 2>&1; then
    open "$url"
  else
    echo "$url"
  fi
}

cmd_room() {
  local rid="${1:-lab}"
  cmd_serve
  echo "room: $rid"
  curl -sf "http://127.0.0.1:${PORT}/api/xr/room?room=${rid}" | python3 -m json.tool 2>/dev/null \
    || curl -sf "http://127.0.0.1:${PORT}/api/xr/room?room=${rid}"
  echo ""
  echo "join URL: $(xr_url "" "$HOST" "$rid")"
  local lan
  lan=$(lan_ip)
  [[ -n "$lan" ]] && echo "lan join:  $(xr_url "" "$lan" "$rid")"
}

cmd_for_ai() {
  cmd_serve
  if api_ok; then
    curl -sf "http://127.0.0.1:${PORT}/api/xr/for-ai" | python3 -m json.tool 2>/dev/null \
      || curl -sf "http://127.0.0.1:${PORT}/api/xr/for-ai"
  else
    write_latest
    cat "$STATE_DIR/LATEST.json"
  fi
}

cmd_auto() {
  info "XR auto v2 · sync + room serve + status"
  cmd_sync
  cmd_serve
  cmd_status
  echo ""
  info "onboard: http://127.0.0.1:${PORT}/xr-onboard.html"
  info "for-ai:  http://127.0.0.1:${PORT}/api/xr/for-ai"
  info "console: __mgXr.auto() · __mgXr.room.join('lab') · __mgXr.forAi()"
}

case "$CMD" in
  auto|"") cmd_auto ;;
  sync) cmd_sync ;;
  serve|start) cmd_serve ;;
  restart) cmd_restart ;;
  stop) cmd_stop ;;
  status|st) cmd_status ;;
  list|ls) cmd_list ;;
  detect) cmd_detect ;;
  doctor|doc) cmd_doctor ;;
  onboard|guide) cmd_onboard ;;
  quest|adb) cmd_quest ;;
  hot|reload) cmd_hot ;;
  open) cmd_open "${1:-desktop-proxy}" ;;
  room) cmd_room "${1:-lab}" ;;
  for-ai|forai|ai) cmd_for_ai ;;
  url) xr_url "${1:-}" ;;
  help|-h|--help)
    sed -n '2,18p' "$0"
    ;;
  *)
    die "unknown: $CMD (auto|sync|serve|restart|hot|doctor|onboard|quest|room|for-ai|…)"
    ;;
esac
