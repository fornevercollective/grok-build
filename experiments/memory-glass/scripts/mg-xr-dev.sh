#!/usr/bin/env bash
# Memory Glass · XR / VR glasses automatic quick-pipe · sync · dev
#
# Usage:
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh            # auto (sync + serve + status)
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh auto
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh sync        # hotpipe → app + pwa
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh serve       # PWA :8787
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh status
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh list
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh detect
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh quest       # adb reverse + open URL hint
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh open [device-id]
#   bash experiments/memory-glass/scripts/mg-xr-dev.sh hot         # sync + ⌘⇧R
#
# Ports: PWA 8787 only. Never 8765/8766 (Soft Path).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAB_REPO="$(cd "$ROOT/../.." 2>/dev/null && pwd || true)"
PORT="${MG_XR_PORT:-${MG_PWA_PORT:-8787}}"
HOST="${MG_XR_HOST:-127.0.0.1}"
PWA="$ROOT/pwa"
HP="$ROOT/hotpipe"
REG="$HP/data/xr-glasses-registry.json"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
STATE_DIR="${MG_XR_STATE:-$HOME/.panda/mg-xr}"
PID_FILE="$STATE_DIR/pwa.pid"
LOG_FILE="$STATE_DIR/pwa.log"
CMD="${1:-auto}"
shift || true

mkdir -p "$STATE_DIR"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

lan_ip() {
  # Best-effort LAN IP for headset browsers on same Wi‑Fi
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
  local q=""
  [[ -n "$device" ]] && q="?device=${device}&mg_xr=1"
  echo "http://${h}:${PORT}/xr-dev.html${q}"
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
    echo "registry: $REG"
    [[ -f "$REG" ]] || die "missing $REG"
    grep -E '"id"|"name"|"class"' "$REG" | head -80
  fi
}

cmd_detect() {
  info "host environment (desktop proxy unless Quest ADB seen)"
  local adb_dev=""
  if command -v adb >/dev/null 2>&1; then
    adb_dev=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device"{print $1; exit}')
  fi
  if [[ -n "$adb_dev" ]]; then
    echo "detected: quest-class (adb device=$adb_dev)"
    echo "profile:  quest-3 (apply on headset via ?device=quest-3)"
    echo "url:      $(xr_url quest-3 "$(lan_ip || echo $HOST)")"
  else
    echo "detected: desktop-proxy"
    echo "url:      $(xr_url desktop-proxy)"
  fi
  echo "registry: $REG"
  echo "pwa:      $PWA"
  echo "app:      $APP"
}

sync_pwa_hotpipe() {
  mkdir -p "$PWA/hotpipe/data"
  # Module + registry into PWA so glasses browser can fetch without native inject
  cp -f "$HP/mg-xr-glasses.js" "$PWA/hotpipe/mg-xr-glasses.js"
  cp -f "$REG" "$PWA/hotpipe/data/xr-glasses-registry.json"
  # Also flat paths used by loadRegistry fallbacks
  mkdir -p "$PWA/data"
  cp -f "$REG" "$PWA/data/xr-glasses-registry.json"
  info "pwa hotpipe xr module + registry"
}

cmd_sync() {
  [[ -d "$HP" ]] || die "missing hotpipe $HP"
  sync_pwa_hotpipe

  if [[ -x "$ROOT/scripts/mg-hotpipe-sync.sh" ]]; then
    info "mg-hotpipe-sync (full hotpipe → app)"
    # Always bake XR companion; then full sync
    bash "$ROOT/scripts/mg-hotpipe-sync.sh" --no-reload || bash "$ROOT/scripts/mg-hotpipe-sync.sh" -n || true
  elif [[ -d "$APP/Contents/Resources" ]]; then
    info "copy hotpipe → app Resources"
    mkdir -p "$APP/Contents/Resources/hotpipe/data"
    rsync -a --exclude '.DS_Store' "$HP/" "$APP/Contents/Resources/hotpipe/" 2>/dev/null \
      || cp -R "$HP/." "$APP/Contents/Resources/hotpipe/"
  else
    info "app missing at $APP — pwa-only sync"
  fi

  # Bake XR into live.js dest companions when app present
  local dest="$APP/Contents/Resources/hotpipe"
  if [[ -f "$dest/live.js" && -f "$dest/mg-xr-glasses.js" ]]; then
    if ! grep -q "COMPANION_MG_XR_GLASSES" "$dest/live.js" 2>/dev/null; then
      {
        printf '\n/* === COMPANION_MG_XR_GLASSES (sync bake · source is mg-xr-glasses.js) === */\n'
        cat "$dest/mg-xr-glasses.js"
      } >> "$dest/live.js"
      info "baked mg-xr-glasses → dest live.js"
    fi
  fi

  # State snapshot for agents
  {
    echo "{"
    echo "  \"ts\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"port\": $PORT,"
    echo "  \"url\": \"$(xr_url)\","
    echo "  \"lan\": \"$(lan_ip)\","
    echo "  \"root\": \"$ROOT\""
    echo "}"
  } > "$STATE_DIR/last-sync.json"

  info "sync ok"
  echo "    tip: focus Memory Glass → ⌘⇧R  (or: $0 hot)"
  echo "    pwa:  $(xr_url)"
}

cmd_serve() {
  sync_pwa_hotpipe
  # Refuse Soft Path ports
  if [[ "$PORT" == "8765" || "$PORT" == "8766" ]]; then
    die "port $PORT is Soft Path exclusive — use 8787"
  fi

  if [[ -f "$PID_FILE" ]]; then
    local old
    old=$(cat "$PID_FILE" 2>/dev/null || true)
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      info "PWA already serving pid=$old"
      echo "    $(xr_url)"
      return 0
    fi
  fi

  # Reuse existing listener on PORT if any
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      info "port $PORT already listening — reusing"
      echo "    $(xr_url)"
      return 0
    fi
  fi

  [[ -d "$PWA" ]] || die "missing pwa $PWA"
  info "serve $PWA on :$PORT"
  (
    cd "$PWA"
    if command -v python3 >/dev/null 2>&1; then
      exec python3 -m http.server "$PORT" --bind 0.0.0.0
    else
      exec python -m SimpleHTTPServer "$PORT"
    fi
  ) >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  sleep 0.35
  info "pid $(cat "$PID_FILE") · log $LOG_FILE"
  echo "    local  $(xr_url)"
  local lan
  lan=$(lan_ip)
  if [[ -n "$lan" ]]; then
    echo "    lan    $(xr_url "" "$lan")"
    echo "    quest  open that lan URL in Meta Browser after: $0 quest"
  fi
}

cmd_stop() {
  if [[ -f "$PID_FILE" ]]; then
    local old
    old=$(cat "$PID_FILE" 2>/dev/null || true)
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      kill "$old" 2>/dev/null || true
      info "stopped pwa pid=$old"
    fi
    rm -f "$PID_FILE"
  else
    info "no pid file"
  fi
}

cmd_status() {
  echo "Memory Glass XR dev"
  echo "  root     $ROOT"
  echo "  port     $PORT  (never 8765/8766)"
  echo "  url      $(xr_url)"
  local lan
  lan=$(lan_ip)
  [[ -n "$lan" ]] && echo "  lan      $(xr_url "" "$lan")"
  echo "  registry $([[ -f $REG ]] && echo ok || echo MISSING) $REG"
  echo "  module   $([[ -f $HP/mg-xr-glasses.js ]] && echo ok || echo MISSING)"
  echo "  pwa page $([[ -f $PWA/xr-dev.html ]] && echo ok || echo MISSING)"
  echo "  app      $([[ -d $APP ]] && echo ok || echo missing) $APP"
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "  serve    up pid=$(cat "$PID_FILE")"
  else
    echo "  serve    down"
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -3 || true
  fi
  if command -v adb >/dev/null 2>&1; then
    echo "  adb:"
    adb devices 2>/dev/null | sed 's/^/    /' || true
  else
    echo "  adb      not installed (Quest reverse unavailable)"
  fi
  cmd_detect
}

cmd_quest() {
  local lan
  lan=$(lan_ip)
  [[ -n "$lan" ]] || lan="$HOST"
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb not found — install platform-tools / Meta Quest Developer Hub"
    echo "manual: open on headset browser → http://${lan}:${PORT}/xr-dev.html?device=quest-3&mg_xr=1"
    return 1
  fi
  info "adb reverse tcp:${PORT} → host :${PORT}"
  adb reverse "tcp:${PORT}" "tcp:${PORT}" || true
  adb devices
  echo ""
  echo "On headset Meta Browser open:"
  echo "  http://127.0.0.1:${PORT}/xr-dev.html?device=quest-3&mg_xr=1"
  echo "  (or LAN) http://${lan}:${PORT}/xr-dev.html?device=quest-3&mg_xr=1"
  echo ""
  echo "HzOS MCP: get_adb_path · stream_device_logcat · take_screenshot"
  echo "          get_web_documentation_index for Quest WebXR docs"
}

cmd_hot() {
  cmd_sync
  if [[ -x "$ROOT/scripts/mg-hotpipe-sync.sh" ]]; then
    # trigger reload path only
    RELOAD_ONLY=1
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

cmd_auto() {
  info "XR auto · quick pipe + sync + serve + status"
  cmd_sync
  cmd_serve
  cmd_status
  echo ""
  info "in Memory Glass console: __mgXr.auto() · __mgXr.list() · __mgXr.status()"
  info "or nav: $(xr_url)"
}

case "$CMD" in
  auto|"") cmd_auto ;;
  sync) cmd_sync ;;
  serve|start) cmd_serve ;;
  stop) cmd_stop ;;
  status|st) cmd_status ;;
  list|ls) cmd_list ;;
  detect) cmd_detect ;;
  quest|adb) cmd_quest ;;
  hot|reload) cmd_hot ;;
  open) cmd_open "${1:-desktop-proxy}" ;;
  url) xr_url "${1:-}" ;;
  help|-h|--help)
    sed -n '2,20p' "$0"
    ;;
  *)
    die "unknown command: $CMD (try: auto|sync|serve|status|list|detect|quest|hot|open)"
    ;;
esac
