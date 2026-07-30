#!/usr/bin/env bash
# phone-tether.sh — Memory Glass still-pipe hub + phone PWA for Grok /cam
#
# Same inspect/phone grammar as Memory Glass:
#   phone PWA (HTTPS) → POST /upload → ~/.panda/vision/live.jpg
#   Grok /cam phone     → ffmpeg still-pipe → half-block tile
#   wave/talk           → mic + optional MG hub
#
# Usage:
#   bash scripts/live-demux/phone-tether.sh              # start hub + print URLs
#   bash scripts/live-demux/phone-tether.sh start
#   bash scripts/live-demux/phone-tether.sh status
#   bash scripts/live-demux/phone-tether.sh urls
#   bash scripts/live-demux/phone-tether.sh inspect       # open live.jpg in browser
#   bash scripts/live-demux/phone-tether.sh stop
#   bash scripts/live-demux/phone-tether.sh cam           # start hub + open /cam phone Terminal
#   bash scripts/live-demux/phone-tether.sh sync          # copy PWA assets into vision dir
#
# Env:
#   MG_STILL_BIND=0.0.0.0     # LAN bind (required for real phones)
#   MG_STILL_PORT=9877
#   MG_STILL_HTTPS_PORT=9878
#   GY_VISION_DIR=~/.panda/vision
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VISION="${GY_VISION_DIR:-$HOME/.panda/vision}"
PACK="$ROOT/experiments/memory-glass/Resources-pack/vision"
BIND="${MG_STILL_BIND:-0.0.0.0}"
PORT="${MG_STILL_PORT:-9877}"
HTTPS_PORT="${MG_STILL_HTTPS_PORT:-9878}"
PID_FILE="$VISION/still-server.pid"
LOG_FILE="$VISION/still-server.log"
SERVER_PY="$VISION/still-server.py"

CMD="${1:-start}"
shift || true

mkdir -p "$VISION" "$VISION/certs" "$VISION/icons" 2>/dev/null || true

lan_ips() {
  # Prefer en0/en1 private IPv4; fall back to any non-loopback.
  if command -v ipconfig >/dev/null 2>&1; then
    for ifc in en0 en1 en2 bridge0; do
      ipconfig getifaddr "$ifc" 2>/dev/null || true
    done
  fi
  ifconfig 2>/dev/null \
    | awk '/inet / && $2 !~ /^127\./ {print $2}' \
    | head -6
}

primary_lan() {
  local ips
  ips="$(lan_ips | awk 'NF' | head -1)"
  echo "${ips:-127.0.0.1}"
}

health() {
  curl -fsS --max-time 1 "http://127.0.0.1:${PORT}/health" 2>/dev/null || return 1
}

is_running() {
  if health >/dev/null 2>&1; then return 0; fi
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

ensure_certs() {
  local cert="$VISION/certs/still.crt" key="$VISION/certs/still.key"
  mkdir -p "$VISION/certs"
  if [[ -f "$cert" && -f "$key" ]]; then
    return 0
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "warn: openssl missing — cannot mint still certs; iPhone getUserMedia needs HTTPS" >&2
    return 1
  fi
  local lan
  lan="$(primary_lan)"
  echo "==> minting self-signed still cert (SAN localhost + $lan)"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$key" \
    -out "$cert" \
    -days 825 \
    -subj "/CN=MemoryGlass Still/O=fornevercollective/C=US" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${lan}" \
    >/dev/null 2>&1 \
    && echo "    certs: $cert" \
    || echo "warn: cert mint failed" >&2
}

sync_assets() {
  echo "==> sync phone PWA assets → $VISION"
  if [[ -d "$PACK" ]]; then
    # Core still-server + phone shell (do not clobber live.jpg / certs)
    for f in still-server.py phone.html phone-talk.html phone-chat.html \
      phone-setup.html phone-speak.js phone-wave.js phone-pwa.js phone-mg.css \
      fleet.html manifest.webmanifest sw.js deploy.html relay.html PWA.md; do
      if [[ -f "$PACK/$f" ]]; then
        cp -f "$PACK/$f" "$VISION/$f"
      fi
    done
    if [[ -d "$PACK/icons" ]]; then
      cp -R "$PACK/icons/." "$VISION/icons/" 2>/dev/null || true
    fi
    for ic in apple-touch-icon.png favicon.png; do
      [[ -f "$PACK/$ic" ]] && cp -f "$PACK/$ic" "$VISION/$ic" || true
    done
    echo "    from: $PACK"
  else
    echo "    note: no Resources-pack at $PACK — using existing $VISION files"
  fi
  # Prefer panda still-server if pack missing server
  if [[ ! -f "$SERVER_PY" && -f "$HOME/.panda/vision/still-server.py" ]]; then
    SERVER_PY="$HOME/.panda/vision/still-server.py"
  fi
  if [[ ! -f "$SERVER_PY" ]]; then
    echo "error: still-server.py not found at $VISION or pack" >&2
    exit 1
  fi
  # Ensure phone.html present
  if [[ ! -f "$VISION/phone.html" ]]; then
    echo "warn: phone.html missing — phone PWA shell not available" >&2
  fi
  ensure_certs || true
  echo "    server: $SERVER_PY"
}

print_urls() {
  local lan
  lan="$(primary_lan)"
  echo ""
  echo "┌─ Memory Glass phone tether (inspect-style) ─────────────────"
  echo "│  Hub HTTP  (inspect / snap / API)"
  echo "│    http://127.0.0.1:${PORT}/health"
  echo "│    http://127.0.0.1:${PORT}/live.jpg"
  echo "│    http://127.0.0.1:${PORT}/phone-setup.html"
  echo "│"
  echo "│  Hub HTTPS (iPhone getUserMedia · Add to Home Screen)"
  echo "│    https://${lan}:${HTTPS_PORT}/phone.html"
  echo "│    https://${lan}:${HTTPS_PORT}/phone-talk.html"
  echo "│    https://${lan}:${HTTPS_PORT}/phone-chat.html"
  echo "│    https://${lan}:${HTTPS_PORT}/fleet.html"
  echo "│    https://${lan}:${HTTPS_PORT}/phone-setup.html   ← trust cert once"
  echo "│"
  echo "│  Grok"
  echo "│    /phone                 start hub + /cam phone still-pipe"
  echo "│    /cam phone · /cam tether"
  echo "│    bash $ROOT/scripts/live-demux/phone-tether.sh cam"
  echo "│"
  echo "│  Phone steps"
  echo "│    1. Same Wi‑Fi as this Mac"
  echo "│    2. Safari → phone-setup (trust cert)"
  echo "│    3. Open phone.html → Allow Camera"
  echo "│    4. Share → Add to Home Screen (optional PWA)"
  echo "│    5. In Grok: /cam phone  (tile shows live.jpg)"
  echo "└────────────────────────────────────────────────────────────"
  # Optional QR if qrencode present
  if command -v qrencode >/dev/null 2>&1; then
    echo ""
    echo "QR · phone cam (scan with phone Safari):"
    qrencode -t ANSIUTF8 "https://${lan}:${HTTPS_PORT}/phone.html" 2>/dev/null || true
  fi
}

start_hub() {
  sync_assets
  if is_running; then
    echo "==> still-server already up"
    health | python3 -m json.tool 2>/dev/null || health || true
    print_urls
    return 0
  fi
  echo "==> starting still-server bind=$BIND http=$PORT https=$HTTPS_PORT"
  export MG_STILL_BIND="$BIND"
  export MG_STILL_PORT="$PORT"
  export MG_STILL_HTTPS_PORT="$HTTPS_PORT"
  export GY_VISION_DIR="$VISION"
  # Detach fully so Terminal/Grok can exit without killing hub
  nohup python3 "$SERVER_PY" >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  sleep 0.4
  if health >/dev/null 2>&1; then
    echo "    OK health · pid $(cat "$PID_FILE")"
  else
    echo "    warn: health not ready yet — see $LOG_FILE"
    tail -20 "$LOG_FILE" 2>/dev/null || true
  fi
  print_urls
}

stop_hub() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]]; then
      kill "$pid" 2>/dev/null || true
      sleep 0.2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  # Best-effort: anything bound to still port
  if command -v lsof >/dev/null 2>&1; then
    local p
    p="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
    [[ -n "${p:-}" ]] && kill $p 2>/dev/null || true
  fi
  echo "==> still-server stopped"
}

status_hub() {
  if is_running; then
    echo "status: UP"
    health | python3 -m json.tool 2>/dev/null || health || true
    if [[ -f "$VISION/live.jpg" ]]; then
      local age sz
      sz=$(wc -c <"$VISION/live.jpg" | tr -d ' ')
      age=$(python3 -c "import os,time; print(f'{time.time()-os.path.getmtime(\"$VISION/live.jpg\"):.1f}s')" 2>/dev/null || echo "?")
      echo "live.jpg: ${sz} bytes · age ${age}"
    else
      echo "live.jpg: missing (phone not uploading yet)"
    fi
  else
    echo "status: DOWN"
    echo "start: bash $ROOT/scripts/live-demux/phone-tether.sh start"
  fi
}

open_inspect() {
  start_hub
  local url="http://127.0.0.1:${PORT}/live.jpg"
  echo "==> inspect still-pipe $url"
  if command -v open >/dev/null 2>&1; then
    open "$url" 2>/dev/null || true
    # Also open setup for phone copy-paste convenience on this Mac
    open "http://127.0.0.1:${PORT}/phone-setup.html" 2>/dev/null || true
  else
    echo "open: $url"
  fi
}

open_cam() {
  start_hub
  export LIVE_DEMUX_CAM_SOURCE=phone
  export LIVE_DEMUX_CAM_ON=1
  export GROK_LIVE_WATCH_CAM=1
  export LIVE_DEMUX_MIC="${LIVE_DEMUX_MIC:-1}"
  export LIVE_DEMUX_CAM_TILE="${LIVE_DEMUX_CAM_TILE:-large}"
  export LIVE_DEMUX_CAM_LAYOUT="${LIVE_DEMUX_CAM_LAYOUT:-side}"
  export LIVE_DEMUX_CAM_STILL="${LIVE_DEMUX_CAM_STILL:-$VISION/live.jpg}"
  export MG_STILL_URL="${MG_STILL_URL:-http://127.0.0.1:${PORT}}"
  export MG_WAVE_URL="${MG_WAVE_URL:-http://127.0.0.1:${PORT}/wave}"
  if [[ -x "$ROOT/scripts/launch-watch.sh" ]]; then
    echo "==> launch Grok /cam phone still-pipe"
    exec bash "$ROOT/scripts/launch-watch.sh" camera "${@:-}"
  fi
  if [[ -x "$ROOT/scripts/deploy-fc-grok.sh" ]]; then
    exec bash "$ROOT/scripts/deploy-fc-grok.sh" --skip-build --open /cam
  fi
  echo "run in Grok: /cam phone"
}

case "$CMD" in
  start|up|hub) start_hub ;;
  stop|down) stop_hub ;;
  status|st) status_hub ;;
  urls|url|qr) print_urls ;;
  sync) sync_assets ;;
  inspect|live) open_inspect ;;
  cam|phone|/cam)
    open_cam "$@"
    ;;
  help|-h|--help)
    sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "unknown: $CMD (try start|status|urls|inspect|cam|stop)" >&2
    exit 2
    ;;
esac
