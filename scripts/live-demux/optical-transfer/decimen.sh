#!/usr/bin/env bash
# decimen.sh — run BashAlarmist's load-tested fountain QR app (vendored).
#
# Upstream: https://github.com/bashalarmistalt/decimen-optical-transfer (MIT)
# This is the browser path that was load-tested (~128 KB/s parent experiment;
# PoC ships 512 KB / 2 MB image payloads at comfortable rates).
#
#   bash decimen.sh dev       # Vite HTTPS (camera works on LAN phones)
#   bash decimen.sh preview   # serve production dist (http — localhost OK)
#   bash decimen.sh send      # open send page after ensuring server
#   bash decimen.sh receive   # open receive page
#   bash decimen.sh build     # rebuild dist/
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
VENDOR="$ROOT/vendor/decimen-optical-transfer"
PORT="${LIVE_DEMUX_DECIMEN_PORT:-${LIVE_DEMUX_OPTICAL_PORT:-5173}}"
cmd="${1:-dev}"
shift || true

if [[ ! -d "$VENDOR" ]]; then
  echo "decimen vendor missing: $VENDOR" >&2
  echo "expected scripts/live-demux/optical-transfer/vendor/decimen-optical-transfer" >&2
  exit 1
fi

cd "$VENDOR"

ensure_deps() {
  if [[ ! -d node_modules ]]; then
    echo "==> npm install (decimen)"
    npm install
  fi
}

ensure_dist() {
  if [[ ! -f dist/send/index.html ]]; then
    echo "==> npm run build (decimen)"
    ensure_deps
    npm run build
  fi
}

lan_ip() {
  # best-effort LAN address for phone RX URL
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1"
  else
    hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
  fi
}

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" || true
  else
    echo "open: $url"
  fi
}

case "$cmd" in
  help|-h|--help)
    cat <<EOF
decimen (vendored BashAlarmist fountain QR — load-tested browser PoC)

  dev       Vite HTTPS on 0.0.0.0:${PORT}  (phone camera needs https)
  preview   vite preview of dist/ on ${PORT}
  build     npm run build → dist/
  send      ensure server + open /send/
  receive   ensure server + open /receive/ (print LAN URL)
  urls      print send/receive URLs only

Env:
  LIVE_DEMUX_DECIMEN_PORT   default 5173
  LIVE_DEMUX_OPTICAL_PORT   fallback port

Upstream: https://github.com/bashalarmistalt/decimen-optical-transfer
License:  MIT · BashAlarmist 2026 · see vendor/.../LICENSE
EOF
    ;;
  build)
    ensure_deps
    npm run build
    echo "dist ready: $VENDOR/dist"
    ;;
  dev)
    ensure_deps
    echo "==> decimen Vite HTTPS (self-signed — accept once on phone)"
    echo "    send:    https://127.0.0.1:${PORT}/send/"
    echo "    receive: https://$(lan_ip):${PORT}/receive/"
    echo "    (phone: tap through cert warning once; getUserMedia needs secure context)"
    exec npx vite --host --port "$PORT"
    ;;
  preview)
    ensure_dist
    echo "==> decimen preview dist on :${PORT}"
    echo "    send:    http://127.0.0.1:${PORT}/send/"
    echo "    receive: http://$(lan_ip):${PORT}/receive/"
    echo "    note: phone cam may require 'dev' (HTTPS) not preview"
    exec npx vite preview --host --port "$PORT"
    ;;
  send|tx)
    # Prefer already-running vite; otherwise start preview in background
    ensure_dist
    if ! curl -skf "http://127.0.0.1:${PORT}/send/" >/dev/null 2>&1 \
      && ! curl -skf "https://127.0.0.1:${PORT}/send/" >/dev/null 2>&1; then
      echo "==> starting decimen preview on :${PORT}"
      npx vite preview --host --port "$PORT" >/tmp/decimen-preview.log 2>&1 &
      echo $! > /tmp/decimen-preview.pid
      sleep 1.2
    fi
    if curl -skf "https://127.0.0.1:${PORT}/send/" >/dev/null 2>&1; then
      open_url "https://127.0.0.1:${PORT}/send/"
      echo "TX https://127.0.0.1:${PORT}/send/"
    else
      open_url "http://127.0.0.1:${PORT}/send/"
      echo "TX http://127.0.0.1:${PORT}/send/"
    fi
    echo "RX phone → https://$(lan_ip):${PORT}/receive/  (use 'dev' for HTTPS if cam blocked)"
    ;;
  receive|rx)
    ensure_dist
    if ! curl -skf "http://127.0.0.1:${PORT}/receive/" >/dev/null 2>&1 \
      && ! curl -skf "https://127.0.0.1:${PORT}/receive/" >/dev/null 2>&1; then
      npx vite preview --host --port "$PORT" >/tmp/decimen-preview.log 2>&1 &
      echo $! > /tmp/decimen-preview.pid
      sleep 1.2
    fi
    local_ip="$(lan_ip)"
    echo "RX on this machine: http://127.0.0.1:${PORT}/receive/"
    echo "RX on phone (LAN):  https://${local_ip}:${PORT}/receive/  ← prefer: bash decimen.sh dev"
    open_url "http://127.0.0.1:${PORT}/receive/"
    ;;
  urls)
    local_ip="$(lan_ip)"
    echo "send:    http://127.0.0.1:${PORT}/send/   (or https with 'dev')"
    echo "receive: https://${local_ip}:${PORT}/receive/"
    echo "vendor:  $VENDOR"
    echo "dist:    $VENDOR/dist"
    ;;
  *)
    echo "unknown: $cmd (try help)" >&2
    exit 2
    ;;
esac
