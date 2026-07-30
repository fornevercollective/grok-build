#!/usr/bin/env bash
# fornevercollective · camera relay for cast BOX / tile plane
# Captures AVFoundation cams → JPEG stills the hub can serve to TCL.
# Explicit only (NO-AUTO-LAUNCH).
#
# Usage:
#   bash scripts/live-demux/cam-relay.sh list
#   bash scripts/live-demux/cam-relay.sh start          # all real cams
#   bash scripts/live-demux/cam-relay.sh start 0 1      # FaceTime + Brick
#   bash scripts/live-demux/cam-relay.sh stop
#   bash scripts/live-demux/cam-relay.sh status
#
# Env:
#   LIVE_DEMUX_CAM_RELAY_DIR   default ~/.panda/vision/cast/media/cams
#   LIVE_DEMUX_CAM_RELAY_W/H   default 640x360
#   LIVE_DEMUX_CAM_RELAY_FPS   default 8
#   LIVE_DEMUX_CAM_CAPTURE     native capture size default 640x480
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

OUT_DIR="${LIVE_DEMUX_CAM_RELAY_DIR:-$HOME/.panda/vision/cast/media/cams}"
PID_DIR="${OUT_DIR}/.pids"
W="${LIVE_DEMUX_CAM_RELAY_W:-640}"
H="${LIVE_DEMUX_CAM_RELAY_H:-360}"
FPS="${LIVE_DEMUX_CAM_RELAY_FPS:-8}"
CAPTURE="${LIVE_DEMUX_CAM_CAPTURE:-640x480}"
LOG="${OUT_DIR}/relay.log"

mkdir -p "$OUT_DIR" "$PID_DIR"

need() { command -v "$1" >/dev/null 2>&1 || { echo "need $1"; exit 1; }; }

list_cams() {
  ffmpeg -f avfoundation -list_devices true -i "" 2>&1 \
    | awk '
      /AVFoundation video devices:/ { v=1; next }
      /AVFoundation audio devices:/ { v=0 }
      v && /\[[0-9]+\]/ {
        if (match($0, /\[([0-9]+)\][[:space:]]*(.*)/, a)) {
          idx=a[1]; name=a[2]
          gsub(/\r/, "", name)
          if (name ~ /[Cc]apture [Ss]creen/) next
          printf "%s\t%s\n", idx, name
        }
      }
    '
}

cmd_list() {
  echo "AVFoundation cameras (no screen capture):"
  local n=0
  while IFS=$'\t' read -r idx name; do
    local tag="cam"
    echo "$name" | grep -qiE 'brick|continuity|iphone|desk view' && tag="phone/continuity"
    echo "$name" | grep -qiE 'facetime|built-in' && tag="you/mac"
    printf "  [%s]  %-16s  %s\n" "$idx" "$tag" "$name"
    n=$((n + 1))
  done < <(list_cams)
  [[ "$n" -eq 0 ]] && echo "  (none)"
  echo ""
  echo "relay out: $OUT_DIR/cam{N}.jpg"
}

name_for() {
  local want="$1"
  while IFS=$'\t' read -r idx name; do
    [[ "$idx" == "$want" ]] && { echo "$name"; return; }
  done < <(list_cams)
  echo "cam$want"
}

slug_for() {
  # stable file slug by index
  echo "cam$1"
}

start_one() {
  local idx="$1"
  local slug name out pidfile
  slug="$(slug_for "$idx")"
  name="$(name_for "$idx")"
  out="$OUT_DIR/${slug}.jpg"
  pidfile="$PID_DIR/${slug}.pid"
  meta="$OUT_DIR/${slug}.json"

  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "already running $slug · pid $(cat "$pidfile") · $name"
    return 0
  fi

  # seed placeholder so hub always has a file
  if [[ ! -s "$out" ]]; then
    ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x1a2233:s=${W}x${H}" -frames:v 1 "$out" 2>/dev/null || true
  fi

  python3 -c "import json; json.dump({'index':$idx,'name':'''$name''','slug':'$slug','w':$W,'h':$H,'fps':$FPS}, open('$meta','w'))" 2>/dev/null || true

  echo "==> relay [$idx] $name → ${slug}.jpg  ${W}x${H}@${FPS}"
  # Continuous JPEG overwrite (-update 1). Detached process group.
  nohup bash -c '
    idx="$1"; out="$2"; capture="$3"; fps="$4"; w="$5"; h="$6"; log="$7"
    exec >>"$log" 2>&1
    echo "[start] cam $idx → $out"
    # loop restart if device drops
    while true; do
      ffmpeg -hide_banner -loglevel error \
        -f avfoundation -framerate "$fps" -video_size "$capture" \
        -i "${idx}:none" -an \
        -vf "scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,format=yuvj420p" \
        -q:v 5 -f image2 -update 1 -y "$out" || true
      echo "[restart] cam $idx after exit"
      sleep 1.2
    done
  ' _ "$idx" "$out" "$CAPTURE" "$FPS" "$W" "$H" "$LOG" >/dev/null 2>&1 &
  echo $! >"$pidfile"
  sleep 0.4
  if kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "  pid $(cat "$pidfile") · http://…/media/cams/${slug}.jpg"
  else
    echo "  warn: failed to start $slug — see $LOG"
  fi
}

cmd_start() {
  need ffmpeg
  local -a idxs=()
  if [[ $# -eq 0 ]]; then
    while IFS=$'\t' read -r idx _name; do
      idxs+=("$idx")
    done < <(list_cams)
  else
    idxs=("$@")
  fi
  if [[ "${#idxs[@]}" -eq 0 ]]; then
    echo "error: no cameras"
    exit 1
  fi
  # write manifest for hub
  {
    echo '{'
    echo '  "updated": '$(date +%s)','
    echo '  "cams": ['
    local i=0
    for idx in "${idxs[@]}"; do
      local name slug
      name="$(name_for "$idx")"
      slug="$(slug_for "$idx")"
      [[ $i -gt 0 ]] && echo ','
      printf '    {"index":%s,"slug":"%s","name":%s,"url":"/media/cams/%s.jpg"}' \
        "$idx" "$slug" "$(python3 -c "import json; print(json.dumps('''$name'''))")" "$slug"
      i=$((i + 1))
    done
    echo ''
    echo '  ]'
    echo '}'
  } >"$OUT_DIR/manifest.json"

  for idx in "${idxs[@]}"; do
    start_one "$idx"
  done
  echo ""
  echo "manifest: $OUT_DIR/manifest.json"
  echo "hub will list via GET /api/cams"
}

cmd_stop() {
  local f
  for f in "$PID_DIR"/*.pid; do
    [[ -f "$f" ]] || continue
    local pid
    pid="$(cat "$f" 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      # kill process group children (ffmpeg)
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$f"
  done
  # leftover ffmpeg image2 writers on our paths
  pkill -f "cast/media/cams/cam.*\.jpg" 2>/dev/null || true
  echo "cam-relay stopped"
}

cmd_status() {
  echo "relay dir: $OUT_DIR"
  local f slug pid
  for f in "$OUT_DIR"/cam*.jpg; do
    [[ -f "$f" ]] || continue
    slug="$(basename "$f" .jpg)"
    pid="—"
    if [[ -f "$PID_DIR/${slug}.pid" ]]; then
      pid="$(cat "$PID_DIR/${slug}.pid")"
      if kill -0 "$pid" 2>/dev/null; then pid="$pid live"; else pid="$pid dead"; fi
    fi
    local age sz
    sz="$(wc -c <"$f" | tr -d ' ')"
    age="$(python3 -c "import os,time; print(int(time.time()-os.path.getmtime('$f')))" 2>/dev/null || echo '?')"
    printf "  %s  %6sB  age %ss  pid %s\n" "$slug" "$sz" "$age" "$pid"
  done
  [[ -f "$OUT_DIR/manifest.json" ]] && echo "manifest: ok" || echo "manifest: missing"
}

CMD="${1:-list}"
shift || true
case "$CMD" in
  list|ls) cmd_list ;;
  start|on) cmd_start "$@" ;;
  stop|off) cmd_stop ;;
  status|st) cmd_status ;;
  help|-h|--help)
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "unknown: $CMD  (list|start|stop|status)"
    exit 2
    ;;
esac
