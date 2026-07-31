#!/usr/bin/env bash
# mix-pipe.sh — `/watch <channel>` stream → ffplay + local mix for Decimen
#
# Same resolve path as live demux pop-out (yt-dlp -g), then:
#   1) ffplay window (what you get from /watch bloomberg popout)
#   2) HTTP MJPEG mix for Decimen composite under fountain QR
#
#   bash mix-pipe.sh bloomberg
#   bash mix-pipe.sh bloomberg --no-ffplay
#   bash mix-pipe.sh stop
#   bash mix-pipe.sh status
#
# Decimen send → mix layer → "watch pipe (bloomberg)"
#   http://127.0.0.1:8790/mix.mjpg
#   http://127.0.0.1:8790/mix.jpg
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${LIVE_DEMUX_MIX_PORT:-8790}"
DIR="${LIVE_DEMUX_OPTICAL_DIR:-$HOME/.panda/vision/cast}"
PID_FILE="$DIR/mix-pipe.pid"
STATE_FILE="$DIR/mix-pipe.json"
LOG_FILE="$DIR/mix-pipe.log"
SNAP_FILE="$DIR/mix-latest.jpg"
SERVER_PY="$ROOT/mix_pipe_server.py"
FFPLAY="${LIVE_DEMUX_MIX_FFPLAY:-1}"

channel_url() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    bloomberg|bbg|bloom|bloomberg-tv|bloombergtv)
      echo "https://www.youtube.com/@business/live" ;;
    cnn)  echo "https://www.youtube.com/@CNN/live" ;;
    cnbc) echo "https://www.youtube.com/@CNBC/live" ;;
    nasa) echo "https://www.youtube.com/@NASA/live" ;;
    vevo|friday)
      echo "https://www.youtube.com/@business/live" ;; # fall back to live business if no list
    *)
      if [[ "$1" == http* ]]; then echo "$1"
      else echo "ytsearch1:${1} live"
      fi
      ;;
  esac
}

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: need $1" >&2; exit 1; }; }

stop_pipe() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      # kill tree
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      sleep 0.4
      kill -9 "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  pkill -f "mix_pipe_server.py" 2>/dev/null || true
  pkill -f "window_title.*mix-pipe" 2>/dev/null || true
  echo "mix-pipe stopped"
}

cmd="${1:-bloomberg}"
shift || true
for a in "$@"; do
  case "$a" in
    --no-ffplay) FFPLAY=0 ;;
    --ffplay) FFPLAY=1 ;;
    --port=*) PORT="${a#*=}" ;;
  esac
done

case "$cmd" in
  stop|kill) stop_pipe; exit 0 ;;
  status)
    [[ -f "$STATE_FILE" ]] && cat "$STATE_FILE" || echo '{"ok":false}'
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "running pid=$(cat "$PID_FILE")"
    else
      echo "not running"
    fi
    exit 0
    ;;
  help|-h|--help)
    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

need yt-dlp
need ffmpeg
need python3
[[ -f "$SERVER_PY" ]] || { echo "missing $SERVER_PY" >&2; exit 1; }
mkdir -p "$DIR"
: >"$LOG_FILE"
stop_pipe 2>/dev/null || true

PAGE_URL="$(channel_url "$cmd")"
CHANNEL_ID="$(echo "$cmd" | tr '[:upper:]' '[:lower:]')"
echo "==> mix-pipe · channel=$CHANNEL_ID  (same source as /watch $CHANNEL_ID)"
echo "    page: $PAGE_URL"

YTDLP_EXTRA=()
if [[ -n "${YTDLP_COOKIES:-}" && -f "${YTDLP_COOKIES}" ]]; then
  YTDLP_EXTRA+=(--cookies "$YTDLP_COOKIES")
elif [[ -n "${YTDLP_COOKIES_FROM_BROWSER:-}" ]]; then
  YTDLP_EXTRA+=(--cookies-from-browser "$YTDLP_COOKIES_FROM_BROWSER")
fi

echo "    resolving yt-dlp -g (pop-out style)…"
STREAM_URL="$(
  yt-dlp -g -f 'b[height<=720]/best[height<=720]/bv*[height<=720]+ba/b/best' \
    --no-playlist --no-warnings ${YTDLP_EXTRA[@]+"${YTDLP_EXTRA[@]}"} \
    "$PAGE_URL" 2>>"$LOG_FILE" | head -1
)" || true
if [[ -z "${STREAM_URL:-}" ]]; then
  STREAM_URL="$(
    yt-dlp -g -f 'b/best' --no-playlist --no-warnings \
      ${YTDLP_EXTRA[@]+"${YTDLP_EXTRA[@]}"} "$PAGE_URL" 2>>"$LOG_FILE" | head -1
  )" || true
fi
if [[ -z "${STREAM_URL:-}" ]]; then
  echo "error: could not resolve stream" >&2
  echo "  try: YTDLP_COOKIES_FROM_BROWSER=safari bash $0 $cmd" >&2
  tail -20 "$LOG_FILE" >&2 || true
  exit 2
fi
echo "    stream ok (${#STREAM_URL} chars)"

export MIX_PORT="$PORT"
export MIX_SNAP="$SNAP_FILE"
export MIX_STREAM_URL="$STREAM_URL"
export MIX_CHANNEL="$CHANNEL_ID"
export MIX_PAGE="$PAGE_URL"
export MIX_STATE="$STATE_FILE"
export MIX_LOG="$LOG_FILE"
export MIX_FFPLAY="$FFPLAY"
export MIX_TITLE="pop-out · /watch · $CHANNEL_ID · mix-pipe"

# start server detached
nohup python3 "$SERVER_PY" >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
echo "    server pid $(cat "$PID_FILE") · port $PORT"

echo "    waiting for first frame…"
ok=0
for _ in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:${PORT}/mix.jpg" -o /dev/null; then
    ok=1
    break
  fi
  # bail early if server died
  if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "error: mix server exited — log:" >&2
    tail -40 "$LOG_FILE" >&2 || true
    exit 3
  fi
  sleep 0.4
done

if [[ "$ok" -ne 1 ]]; then
  echo "error: no frames yet — check $LOG_FILE" >&2
  tail -40 "$LOG_FILE" >&2 || true
  exit 3
fi

echo "==> mix-pipe READY · /watch $CHANNEL_ID stream"
echo "    ffplay:   $([[ "$FFPLAY" == "1" ]] && echo ON || echo off)"
echo "    mix.mjpg: http://127.0.0.1:${PORT}/mix.mjpg"
echo "    mix.jpg:  http://127.0.0.1:${PORT}/mix.jpg"
echo "    Decimen:  https://127.0.0.1:5173/send/?mix=watch"
curl -s "http://127.0.0.1:${PORT}/status.json"
echo
