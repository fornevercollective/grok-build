#!/usr/bin/env bash
# Memory Glass · streaming video handler (under the hood for VID rail + Grok agent)
# Patterns: architecture-lab video-feed · GrokYtalkY blank/gy · grok-cli video stage
#
# Usage:
#   mg-video-feed.sh ffplay "https://..."
#   mg-video-feed.sh blank  "https://..."
#   mg-video-feed.sh gy     "https://..."
#   mg-video-feed.sh ytdlp  "https://..."
#   mg-video-feed.sh probe  "https://..."
#   mg-video-feed.sh tools
#
# Never auto-trades. Opens players / probes codecs only.
set -euo pipefail

OP="${1:-tools}"
URL="${2:-}"
OUT_DIR="${MG_VIDEO_OUT:-$HOME/.panda/mg-soak/video-feed}"
mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/feed.log"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }

have() { command -v "$1" >/dev/null 2>&1; }

resolve_stream() {
  local u="$1"
  if have yt-dlp; then
    # best effort single URL
    yt-dlp -g -f "bv*+ba/b" --no-playlist "$u" 2>/dev/null | head -1 || true
  fi
}

case "$OP" in
  tools)
    echo "yt-dlp=$(have yt-dlp && echo yes || echo no)"
    echo "ffmpeg=$(have ffmpeg && echo yes || echo no)"
    echo "ffplay=$(have ffplay && echo yes || echo no)"
    echo "gy=$(have gy && echo yes || echo no)"
    echo "open=$(have open && echo yes || echo no)"
    ;;
  probe)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    if have ffprobe; then
      if [[ "$URL" == http* ]]; then
        STREAM=$(resolve_stream "$URL" || true)
        TARGET="${STREAM:-$URL}"
        log "probe $TARGET"
        ffprobe -hide_banner -show_format -show_streams "$TARGET" 2>&1 | tee "$OUT_DIR/last-probe.txt" | tail -40
      else
        ffprobe -hide_banner -show_format -show_streams "$URL" 2>&1 | tee "$OUT_DIR/last-probe.txt" | tail -40
      fi
    else
      log "ffprobe missing — brew install ffmpeg"
      exit 1
    fi
    ;;
  ytdlp)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    if have yt-dlp; then
      log "ytdlp -F $URL"
      yt-dlp -F --no-playlist "$URL" 2>&1 | tee "$OUT_DIR/last-ytdlp.txt" | tail -30
      echo "---"
      yt-dlp -g -f "bv*+ba/b" --no-playlist "$URL" 2>&1 | head -3 | tee "$OUT_DIR/last-stream-url.txt"
    else
      log "yt-dlp missing — brew install yt-dlp"
      exit 1
    fi
    ;;
  ffplay)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    if ! have ffplay; then
      log "ffplay missing — brew install ffmpeg"
      exit 1
    fi
    STREAM=$(resolve_stream "$URL" || true)
    TARGET="${STREAM:-$URL}"
    log "ffplay pop-out $TARGET"
    # detached player window
    (ffplay -loglevel warning -window_title "MG Video Feed" -autoexit "$TARGET" >>"$LOG" 2>&1 &)
    echo "ok ffplay launched"
    ;;
  blank)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    # Prefer gy blank surface, else OS open, else ffplay
    if have gy; then
      log "gy blank/open $URL"
      (gy open "$URL" >>"$LOG" 2>&1 || gy "$URL" >>"$LOG" 2>&1 || open "$URL") &
      echo "ok blank/gy"
    elif have open; then
      log "open blank $URL"
      open "$URL"
      echo "ok open"
    else
      exec "$0" ffplay "$URL"
    fi
    ;;
  gy)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    if have gy; then
      log "gy $URL"
      (gy open "$URL" >>"$LOG" 2>&1 || gy watch "$URL" >>"$LOG" 2>&1 || open "$URL") &
      echo "ok gy"
    else
      log "gy missing — fallback open/ffplay"
      exec "$0" blank "$URL"
    fi
    ;;
  *)
    echo "usage: $0 tools|probe|ytdlp|ffplay|blank|gy [url]"
    exit 2
    ;;
esac
