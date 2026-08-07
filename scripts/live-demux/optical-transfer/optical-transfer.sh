#!/usr/bin/env bash
# optical-transfer.sh — jawta light + Decimen fountain + optical blur tool
#
#   bash optical-transfer.sh blur "hello"
#   bash optical-transfer.sh light timesync
#   bash optical-transfer.sh serve
#   bash optical-transfer.sh test
#   bash optical-transfer.sh rx light
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PY="${PYTHON:-python3}"
cmd="${1:-blur}"
shift || true

case "$cmd" in
  help|-h|--help)
    cat <<'EOF'
fc-optical-blur / optical-transfer

  blur [text]     Optical blur tool (jawta OOK + corner glyph embed)
  light [pulse]   Jawta full-screen light pulse (timesync|sos=zulu|cq|… or free text)
  glyph [file]    Glyph-grid fountain TX (stdlib modules)
  qr              **Decimen** load-tested browser fountain QR (BashAlarmist)
  decimen [dev]   same · vendor/decimen-optical-transfer (HTTPS for phone RX)
  rx [mode]       Receive (light|glyph|qr)
  serve           HTTP TX/RX pages (port 8767 · fc blur UI)
  test            Fountain round-trip
  open            serve + open blur TX

Env:
  LIVE_DEMUX_OPTICAL_DIR    default ~/.panda/vision/cast
  LIVE_DEMUX_OPTICAL_PORT   default 8767 (fc) / 5173 (decimen)
  LIVE_DEMUX_DECIMEN_PORT   decimen Vite port (default 5173)

Upstream QR: https://github.com/bashalarmistalt/decimen-optical-transfer (MIT)
EOF
    ;;
  blur)
    text="${1:-FC OPTICAL BLUR}"
    exec "$PY" "$ROOT/optical_blur.py" blur --text "$text" --loop --open --serve-inline \
      --port "${LIVE_DEMUX_OPTICAL_PORT:-8767}"
    ;;
  light)
    # default + sos alias → live timesync (Zulu / unix) jawta feed
    pulse_or_text="${1:-timesync}"
    if [[ "$pulse_or_text" =~ ^(sos|timesync|zulu|clock|utc|cq|qth|qsl|73|88|qrz|rst|beacon|sync|ack|nack|ping|heartbeat)$ ]]; then
      exec "$PY" "$ROOT/optical_blur.py" light --pulse "$pulse_or_text" --ffplay --loop
    else
      exec "$PY" "$ROOT/optical_blur.py" light --text "$pulse_or_text" --ffplay --loop
    fi
    ;;
  glyph)
    if [[ -n "${1:-}" && -f "${1:-}" ]]; then
      exec "$PY" "$ROOT/optical_blur.py" glyph --file "$1" --ffplay --loop
    else
      exec "$PY" "$ROOT/optical_blur.py" glyph --text "${1:-glyph}" --ffplay --loop
    fi
    ;;
  qr|decimen)
    # Load-tested browser app (BashAlarmist) — not the simplified glyph stub.
    sub="${1:-send}"
    case "$sub" in
      dev|preview|build|receive|rx|send|tx|urls|help) exec bash "$ROOT/decimen.sh" "$sub" ;;
      *) exec bash "$ROOT/decimen.sh" send ;;
    esac
    ;;
  bloomberg|mix|watch-pipe)
    # Same stream as /watch bloomberg → ffplay + mix.jpg for Decimen
    ch="${1:-bloomberg}"
    bash "$ROOT/mix-pipe.sh" "$ch"
    # open Decimen send on watch mix if possible
    if curl -skf "https://127.0.0.1:5173/send/" >/dev/null 2>&1; then
      open "https://127.0.0.1:5173/send/?mix=watch" 2>/dev/null || true
    else
      echo "start Decimen: bash $ROOT/decimen.sh dev"
      echo "then open:     https://127.0.0.1:5173/send/?mix=watch"
    fi
    ;;
  mix-stop)
    exec bash "$ROOT/mix-pipe.sh" stop
    ;;
  rx)
    exec "$PY" "$ROOT/optical_blur.py" rx --mode "${1:-light}" --open --serve-inline \
      --port "${LIVE_DEMUX_OPTICAL_PORT:-8767}"
    ;;
  serve|open)
    exec "$PY" "$ROOT/optical_blur.py" serve --port "${LIVE_DEMUX_OPTICAL_PORT:-8767}" --open \
      --path "${1:-/send.html?mode=blur}"
    ;;
  test)
    exec "$PY" "$ROOT/optical_blur.py" test
    ;;
  *)
    # pass-through to python CLI
    exec "$PY" "$ROOT/optical_blur.py" "$cmd" "$@"
    ;;
esac
