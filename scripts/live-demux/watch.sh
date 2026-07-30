#!/usr/bin/env bash
# live-demux P0 — playlist-aware yt-dlp + ffmpeg pipe smoke (fornevercollective)
# fc-live-demux-v1
#
# Usage:
#   bash scripts/live-demux/watch.sh 'https://www.youtube.com/watch?v=…&list=…'
#   LIVE_DEMUX_MODE=ffplay bash scripts/live-demux/watch.sh URL   # external window
#   LIVE_DEMUX_MODE=null  bash scripts/live-demux/watch.sh URL   # demux only (bench)
#
# Keys (when LIVE_DEMUX_MODE=ffplay and ffplay is focused — use control process):
#   This script uses a control loop on stdin of *this* shell:
#     space = pause/resume · n = next · p = prev · < = -scrub · > = +scrub · q = quit
#
# Requires: yt-dlp, ffmpeg; optional ffplay for preview.
set -euo pipefail

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "usage: $0 <youtube-or-media-url>"
  echo "example: $0 'https://www.youtube.com/watch?v=jaCxgxTScjc&list=PLbAbqvKSxmj4'"
  echo ""
  echo "env:"
  echo "  LIVE_DEMUX_MODE=ffplay|null|raw|auto   (auto = null + walk playlist, no keys)"
  echo "  LIVE_DEMUX_AUTO_SEC=8                  seconds per track in auto mode"
  echo "  LIVE_DEMUX_AUTO_MAX=5                  max tracks to walk in auto mode"
  exit 1
fi

W="${LIVE_DEMUX_W:-160}"
H="${LIVE_DEMUX_H:-90}"
FPS="${LIVE_DEMUX_FPS:-12}"
# ffplay window size (upscale from demux WxH so the window is actually visible)
WIN_W="${LIVE_DEMUX_WIN_W:-640}"
WIN_H="${LIVE_DEMUX_WIN_H:-360}"
SCRUB="${LIVE_DEMUX_SCRUB_SEC:-10}"
MODE="${LIVE_DEMUX_MODE:-ffplay}" # ffplay | null | raw | auto
PLAYLIST_END="${LIVE_DEMUX_PLAYLIST_END:-40}"
AUTO_SEC="${LIVE_DEMUX_AUTO_SEC:-8}"
AUTO_MAX="${LIVE_DEMUX_AUTO_MAX:-5}"

# auto mode: non-interactive playlist walk (null sink) — safe for agents / CI
if [[ "$MODE" == "auto" ]]; then
  MODE=null
  AUTO_WALK=1
else
  AUTO_WALK=0
fi

# Guard: interactive modes need a real TTY. On /dev/null, bash `read -t`
# returns EOF immediately and the control loop spins at 100% CPU forever.
if [[ "$AUTO_WALK" -eq 0 && "$MODE" != "raw" && ( ! -t 0 || ! -t 1 ) ]]; then
  echo "error: non-TTY stdin/stdout — control loop would busy-spin"
  echo "  open a real Terminal, or run:"
  echo "    LIVE_DEMUX_MODE=auto bash $0 '$URL'"
  echo "  (auto walks up to LIVE_DEMUX_AUTO_MAX tracks into null sink)"
  exit 6
fi

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: need $1 on PATH"; exit 1; }; }
need yt-dlp
need ffmpeg

YTDLP_EXTRA=()
# X media / tweets often need a logged-in browser session.
if [[ -z "${YTDLP_COOKIES:-}" && -z "${YTDLP_COOKIES_FROM_BROWSER:-}" && -z "${X_COOKIES:-}" && -z "${X_COOKIES_FROM_BROWSER:-}" ]]; then
  case "$URL" in
    *://x.com/*|*://twitter.com/*|*://t.co/*) export YTDLP_COOKIES_FROM_BROWSER="${YTDLP_COOKIES_FROM_BROWSER:-safari}" ;;
  esac
fi
if [[ -n "${YTDLP_COOKIES:-}" && -f "${YTDLP_COOKIES}" ]]; then
  YTDLP_EXTRA+=(--cookies "$YTDLP_COOKIES")
elif [[ -n "${X_COOKIES:-}" && -f "${X_COOKIES}" ]]; then
  YTDLP_EXTRA+=(--cookies "$X_COOKIES")
elif [[ -n "${YTDLP_COOKIES_FROM_BROWSER:-}" ]]; then
  YTDLP_EXTRA+=(--cookies-from-browser "$YTDLP_COOKIES_FROM_BROWSER")
elif [[ -n "${X_COOKIES_FROM_BROWSER:-}" ]]; then
  YTDLP_EXTRA+=(--cookies-from-browser "$X_COOKIES_FROM_BROWSER")
fi

WORKDIR="${TMPDIR:-/tmp}/live-demux-$$"
mkdir -p "$WORKDIR"
cleanup() {
  [[ -n "${FF_PID:-}" ]] && kill -TERM "-${FF_PID}" 2>/dev/null || true
  [[ -n "${FF_PID:-}" ]] && kill -KILL "-${FF_PID}" 2>/dev/null || true
  [[ -n "${PLAY_PID:-}" ]] && kill -TERM "${PLAY_PID}" 2>/dev/null || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT INT TERM

echo "==> flat-playlist resolve (end=$PLAYLIST_END)"
# id|title|url  (url may be empty for flat entries — reconstruct from id)
# Bash 3.2 (macOS /bin/bash) has no mapfile — use a temp file + while-read.
ENTRIES=()
ENTRY_FILE="$WORKDIR/entries.tsv"
: >"$ENTRY_FILE"

# X profile Media tabs — yt-dlp Unsupported URL; expand via GraphQL helper.
is_x_media_feed() {
  case "$1" in
    *://x.com/*/media*|*://twitter.com/*/media*|*://x.com/*/videos*|*://x.com/*/photos*) return 0 ;;
    *://x.com/*/*) return 1 ;;
    *://x.com/*|*://twitter.com/*)
      # bare profile (no /status/ /i/)
      case "$1" in
        */status/*|*/i/*|*/broadcasts/*|*/spaces/*) return 1 ;;
        *) return 0 ;;
      esac
      ;;
    *) return 1 ;;
  esac
}

if is_x_media_feed "$URL"; then
  echo "==> X media feed — GraphQL expand (x-media-feed.py)"
  XFEED_PY="$(cd "$(dirname "$0")/../.." && pwd)/scripts/live-demux/x-media-feed.py"
  # Prefer yt-dlp's python (yt_dlp.cookies); else python3.
  XFEED_PYBIN="python3"
  for cand in \
    /usr/local/Cellar/yt-dlp/*/libexec/bin/python \
    /opt/homebrew/Cellar/yt-dlp/*/libexec/bin/python; do
    if [[ -x "$cand" ]]; then XFEED_PYBIN="$cand"; break; fi
  done
  # shellcheck disable=SC2086
  "$XFEED_PYBIN" "$XFEED_PY" --end "$PLAYLIST_END" --format tsv "$URL" 2>/dev/null \
    >>"$ENTRY_FILE" || true
else
  yt-dlp --flat-playlist -j --playlist-end "$PLAYLIST_END" --no-warnings \
    "${YTDLP_EXTRA[@]}" "$URL" 2>/dev/null \
  | python3 -c '
import sys, json
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    try: o=json.loads(line)
    except: continue
    eid=o.get("id") or o.get("url") or ""
    title=(o.get("title") or eid or "?").replace("|","/").replace("\n"," ")[:80]
    page=o.get("url") or o.get("webpage_url") or ""
    if eid and not page.startswith("http"):
        page=f"https://www.youtube.com/watch?v={eid}"
    if not page and eid:
        page=f"https://www.youtube.com/watch?v={eid}"
    if page:
        print(f"{eid}|{title}|{page}")
' >>"$ENTRY_FILE" || true
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue
  ENTRIES+=("$line")
done <"$ENTRY_FILE"

if [[ ${#ENTRIES[@]} -eq 0 ]]; then
  echo "==> flat playlist empty — treating URL as single item"
  ENTRIES=("single|$(yt-dlp --print '%(title)s' --no-playlist --no-warnings "${YTDLP_EXTRA[@]}" "$URL" 2>/dev/null || echo item)|$URL")
fi

echo "==> ${#ENTRIES[@]} entr(y/ies)"
IDX=0
SEEK=0
PAUSED=0
FF_PID=""
PLAY_PID=""

stop_demux() {
  if [[ -n "${FF_PID:-}" ]]; then
    kill -TERM "-${FF_PID}" 2>/dev/null || kill -TERM "$FF_PID" 2>/dev/null || true
    sleep 0.15
    kill -KILL "-${FF_PID}" 2>/dev/null || kill -KILL "$FF_PID" 2>/dev/null || true
    wait "$FF_PID" 2>/dev/null || true
    FF_PID=""
  fi
  if [[ -n "${PLAY_PID:-}" ]]; then
    kill -TERM "$PLAY_PID" 2>/dev/null || true
    wait "$PLAY_PID" 2>/dev/null || true
    PLAY_PID=""
  fi
}

resolve_stream() {
  local page="$1"
  yt-dlp -g -f "bv*[height<=480]+ba/b/bv*+ba/b" --no-playlist --no-warnings \
    "${YTDLP_EXTRA[@]}" "$page" 2>/dev/null | head -1
}

start_demux() {
  stop_demux
  local ent="${ENTRIES[$IDX]}"
  local eid title page
  IFS='|' read -r eid title page <<<"$ent"
  echo ""
  echo "==> [$IDX/$((${#ENTRIES[@]}-1))] $title"
  echo "    $page  seek=${SEEK}s  ${W}x${H}@${FPS}  mode=$MODE"
  local stream
  stream="$(resolve_stream "$page" || true)"
  if [[ -z "$stream" ]]; then
    echo "error: yt-dlp -g failed (cookies? bot wall?). try YTDLP_COOKIES=… or YTDLP_COOKIES_FROM_BROWSER=safari"
    return 1
  fi

  # optional input seek (skip -ss 0 — some googlevideo URLs error on seek)
  # Bash 3.2 + set -u cannot expand empty "${arr[@]}" — branch instead.
  local ss_pre=()
  if [[ "${SEEK:-0}" -gt 0 ]]; then
    ss_pre=(-ss "$SEEK")
  fi

  # process group so we can kill all children
  set -m
  case "$MODE" in
    ffplay)
      need ffplay
      # demux → ffplay window (preview; not half-block yet)
      # WIN_W/H upscale so the SDL window is visible (demux stays small for bench)
      if [[ ${#ss_pre[@]} -gt 0 ]]; then
        ffmpeg -hide_banner -loglevel error \
          -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 \
          "${ss_pre[@]}" -i "$stream" \
          -an -vf "scale=${W}:${H}" -r "$FPS" \
          -f rawvideo -pix_fmt rgb24 - \
          2>"$WORKDIR/ffmpeg.err" \
        | ffplay -hide_banner -loglevel error -autoexit \
            -fflags nobuffer -flags low_delay -framedrop \
            -f rawvideo -pixel_format rgb24 -video_size "${W}x${H}" -framerate "$FPS" \
            -vf "scale=${WIN_W}:${WIN_H}" \
            -window_title "live-demux · $title" -i pipe:0 \
            2>"$WORKDIR/ffplay.err" &
      else
        ffmpeg -hide_banner -loglevel error \
          -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 \
          -i "$stream" \
          -an -vf "scale=${W}:${H}" -r "$FPS" \
          -f rawvideo -pix_fmt rgb24 - \
          2>"$WORKDIR/ffmpeg.err" \
        | ffplay -hide_banner -loglevel error -autoexit \
            -fflags nobuffer -flags low_delay -framedrop \
            -f rawvideo -pixel_format rgb24 -video_size "${W}x${H}" -framerate "$FPS" \
            -vf "scale=${WIN_W}:${WIN_H}" \
            -window_title "live-demux · $title" -i pipe:0 \
            2>"$WORKDIR/ffplay.err" &
      fi
      FF_PID=$!
      ;;
    null)
      if [[ ${#ss_pre[@]} -gt 0 ]]; then
        ffmpeg -hide_banner -loglevel error \
          -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 \
          "${ss_pre[@]}" -i "$stream" \
          -an -vf "scale=${W}:${H}" -r "$FPS" -t 30 \
          -f null - 2>"$WORKDIR/ffmpeg.err" &
      else
        ffmpeg -hide_banner -loglevel error \
          -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5 \
          -i "$stream" \
          -an -vf "scale=${W}:${H}" -r "$FPS" -t 30 \
          -f null - 2>"$WORKDIR/ffmpeg.err" &
      fi
      FF_PID=$!
      ;;
    raw)
      if [[ ${#ss_pre[@]} -gt 0 ]]; then
        exec ffmpeg -hide_banner -loglevel error \
          -reconnect 1 -reconnect_streamed 1 \
          "${ss_pre[@]}" -i "$stream" \
          -an -vf "scale=${W}:${H}" -r "$FPS" \
          -f rawvideo -pix_fmt rgb24 -
      else
        exec ffmpeg -hide_banner -loglevel error \
          -reconnect 1 -reconnect_streamed 1 \
          -i "$stream" \
          -an -vf "scale=${W}:${H}" -r "$FPS" \
          -f rawvideo -pix_fmt rgb24 -
      fi
      ;;
    *)
      echo "unknown LIVE_DEMUX_MODE=$MODE"
      return 1
      ;;
  esac
  set +m
  echo "    demux pid $FF_PID · controls: [space]pause hint  n next  p prev  , -${SCRUB}s  . +${SCRUB}s  q quit"
  # surface early pipe/seek failures (ffplay often dies before first frame)
  sleep 0.4
  if [[ -n "${FF_PID:-}" ]] && ! kill -0 "$FF_PID" 2>/dev/null; then
    echo "error: demux/ffplay exited immediately"
    [[ -s "$WORKDIR/ffmpeg.err" ]] && echo "  ffmpeg: $(tr '\n' ' ' <"$WORKDIR/ffmpeg.err")"
    [[ -s "$WORKDIR/ffplay.err" ]] && echo "  ffplay: $(tr '\n' ' ' <"$WORKDIR/ffplay.err")"
    return 1
  fi
  if [[ -s "$WORKDIR/ffplay.err" ]]; then
    echo "    warn ffplay: $(tr '\n' ' ' <"$WORKDIR/ffplay.err")"
  fi
}

print_help() {
  cat <<EOF
controls (this terminal):
  n / ]     next track
  p / [     previous track
  ,         scrub -${SCRUB}s (restart demux)
  .         scrub +${SCRUB}s
  0         seek 0 (restart)
  r         re-resolve + restart
  h         help
  q         quit
  space     (ffplay: click window and press p for pause — shell space restarts)

status: idx=$IDX seek=${SEEK}s paused_flag=$PAUSED entries=${#ENTRIES[@]}
EOF
}

# ---- auto walk (agent / CI smoke) ----
if [[ "$AUTO_WALK" -eq 1 ]]; then
  local_max=$AUTO_MAX
  [[ $local_max -gt ${#ENTRIES[@]} ]] && local_max=${#ENTRIES[@]}
  echo "==> AUTO walk · ${local_max} track(s) · ${AUTO_SEC}s each · mode=null"
  for ((i = 0; i < local_max; i++)); do
    IDX=$i
    SEEK=0
    if ! start_demux; then
      echo "==> skip broken track $i"
      continue
    fi
    # wait up to AUTO_SEC or until demux exits
    end_ts=$((SECONDS + AUTO_SEC))
    while [[ $SECONDS -lt $end_ts ]]; do
      if [[ -n "${FF_PID:-}" ]] && ! kill -0 "$FF_PID" 2>/dev/null; then
        echo "==> demux ended early (track $i)"
        FF_PID=""
        break
      fi
      sleep 0.5
    done
    stop_demux
  done
  echo "==> AUTO walk done"
  exit 0
fi

start_demux || true
print_help

while true; do
  # nonblocking-ish read. On EOF (closed stdin) sleep — never busy-spin.
  if ! IFS= read -r -n 1 -t 1 key; then
    # if demux died, offer restart
    if [[ -n "${FF_PID:-}" ]] && ! kill -0 "$FF_PID" 2>/dev/null; then
      echo "==> demux exited · n next · r restart · q quit"
      FF_PID=""
    fi
    # read timed out or EOF: if stdin is gone, sleep to avoid 100% CPU
    if [[ ! -t 0 ]]; then
      sleep 1
    fi
    continue
  fi
  case "$key" in
    q|Q) echo "bye"; exit 0 ;;
    n|']')
      IDX=$(( (IDX + 1) % ${#ENTRIES[@]} ))
      SEEK=0
      start_demux || true
      ;;
    p|'[')
      IDX=$(( (IDX - 1 + ${#ENTRIES[@]}) % ${#ENTRIES[@]} ))
      SEEK=0
      start_demux || true
      ;;
    ,)
      SEEK=$(( SEEK - SCRUB ))
      [[ $SEEK -lt 0 ]] && SEEK=0
      start_demux || true
      ;;
    .)
      SEEK=$(( SEEK + SCRUB ))
      start_demux || true
      ;;
    0)
      SEEK=0
      start_demux || true
      ;;
    r|R)
      start_demux || true
      ;;
    h|H|'?')
      print_help
      ;;
    ' ')
      echo "==> space: focus ffplay window and press 'p' to pause (shell cannot pause remote pipe cleanly yet)"
      ;;
    *)
      ;;
  esac
done
