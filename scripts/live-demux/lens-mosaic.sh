#!/usr/bin/env bash
# fornevercollective · single-window lens mosaic (all cams + phone still)
# fc-lens-bug-v1 companion · one ffplay for you | brick | desk | phone
#
# Usage:
#   bash scripts/live-demux/lens-mosaic.sh              # ALL cams + phone (one window)
#   bash scripts/live-demux/lens-mosaic.sh all          # same
#   bash scripts/live-demux/lens-mosaic.sh dual         # FaceTime + phone only
#   bash scripts/live-demux/lens-mosaic.sh 0 1 2 phone  # pick indices + phone still
#   bash scripts/live-demux/lens-mosaic.sh list         # list devices
#   bash scripts/live-demux/lens-mosaic.sh clean dual   # plain (no bug grade)
#
# Env:
#   LIVE_DEMUX_CAM_STILL=~/.panda/vision/live.jpg
#   LIVE_DEMUX_LENS_MOSAIC_CELL=480x360
#   LIVE_DEMUX_LENS_MOSAIC_FPS=30
#   LIVE_DEMUX_LENS_STILL_FPS=10
#   LIVE_DEMUX_LENS_MOSAIC_BUG=1     # insect grade per tile (default on)
#   LIVE_DEMUX_CAM0_SIZE=1280x720   # FaceTime laptop webcam
#   LIVE_DEMUX_CAM1_SIZE=640x480    # Brick Continuity Camera

set -euo pipefail

STILL="${LIVE_DEMUX_CAM_STILL:-$HOME/.panda/vision/live.jpg}"
CELL="${LIVE_DEMUX_LENS_MOSAIC_CELL:-480x360}"
FPS="${LIVE_DEMUX_LENS_MOSAIC_FPS:-30}"
STILL_FPS="${LIVE_DEMUX_LENS_STILL_FPS:-10}"
BUG="${LIVE_DEMUX_LENS_MOSAIC_BUG:-1}"
LOG_DIR="${LIVE_DEMUX_LENS_LOG_DIR:-$HOME/.panda/vision/logs}"
LOG="$LOG_DIR/lens-mosaic.log"
mkdir -p "$LOG_DIR" "$(dirname "$STILL")"

need() { command -v "$1" >/dev/null 2>&1 || { echo "need $1"; exit 1; }; }
need ffmpeg
need ffplay

CW="${CELL%x*}"; CH="${CELL#*x}"
CW="${CW:-720}"; CH="${CH:-405}"

list_video_devices() {
  # Real cameras only — skip non-camera AVFoundation entries.
  ffmpeg -f avfoundation -list_devices true -i "" 2>&1 \
    | awk '
      /AVFoundation video devices:/ { v=1; next }
      /AVFoundation audio devices:/ { v=0 }
      v && /\[[0-9]+\]/ {
        line=$0
        sub(/^[^[]*\[/, "", line)
        idx=line; sub(/\].*/, "", idx)
        name=line; sub(/^[0-9]+\][[:space:]]*/, "", name)
        gsub(/\r/, "", name)
        if (name ~ /[Cc]apture [Ss]creen/) next
        printf "%s\t%s\n", idx, name
      }
    '
}

print_list() {
  echo "AVFoundation cameras (webcams / Continuity only):"
  while IFS=$'\t' read -r idx name; do
    printf "  [%s]  %s\n" "$idx" "$name"
  done < <(list_video_devices)
  echo ""
  echo "Phone still-pipe: $STILL"
  [[ -s "$STILL" ]] && echo "  live.jpg present" || echo "  (missing — start phone-tether + phone PWA)"
  echo ""
  echo "Usage:"
  echo "  $0 dual          # FaceTime [0] | phone  (one window)"
  echo "  $0 all           # every cam + phone grid"
  echo "  $0 0 1 phone     # pick devices + phone"
  echo "  $0 list"
}

tile_vf() {
  local mirror="${1:-0}"
  # cover-crop always fills the cell (pad fails after lenscorrection expands
  # geometry, and portrait phone stills break decrease+pad on some builds).
  local base="scale=${CW}:${CH}:force_original_aspect_ratio=increase,crop=${CW}:${CH}"
  if [[ "$BUG" == "1" || "$BUG" == "true" ]]; then
    base="${base},lenscorrection=k1=0.28:k2=0.10:cx=0.5:cy=0.5,eq=contrast=1.1:brightness=0.02:saturation=1.35:gamma=1.05,colorbalance=rs=-0.03:gs=0.05:bs=-0.02,vignette=PI/4"
  fi
  # re-crop after barrel so xstack/hstack sizes match exactly
  base="${base},scale=${CW}:${CH}:force_original_aspect_ratio=increase,crop=${CW}:${CH},setsar=1,format=yuv420p"
  if [[ "$mirror" == "1" ]]; then
    echo "hflip,${base}"
  else
    echo "$base"
  fi
}

# Probe cam open quickly (returns 0 if one frame ok).
probe_cam() {
  local idx="$1"
  # short open — Continuity cams may hang; hard kill after 2.5s
  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout 2.5 ffmpeg -hide_banner -loglevel error -f avfoundation -framerate "$FPS" \
      -i "${idx}:none" -frames:v 1 -f null - >/dev/null 2>&1
  elif command -v timeout >/dev/null 2>&1; then
    timeout 2.5 ffmpeg -hide_banner -loglevel error -f avfoundation -framerate "$FPS" \
      -i "${idx}:none" -frames:v 1 -f null - >/dev/null 2>&1
  else
    # no timeout binary — assume ok (macOS often lacks timeout)
    return 0
  fi
}

build_and_play() {
  # args: space-separated cam indices; trailing "phone" optional but default on
  local -a cams=()
  local want_phone=0
  local a
  for a in "$@"; do
    case "$a" in
      phone|still|live) want_phone=1 ;;
      clean|plain) BUG=0 ;;
      *)
        if [[ "$a" =~ ^[0-9]+$ ]]; then cams+=("$a"); fi
        ;;
    esac
  done
  # default include phone when any cams
  if [[ $want_phone -eq 0 ]]; then want_phone=1; fi

  if [[ ${#cams[@]} -eq 0 ]]; then
    echo "error: no camera indices" >&2
    exit 1
  fi
  if [[ $want_phone -eq 1 && ! -s "$STILL" ]]; then
    printf '\xff\xd8\xff\xd9' >"$STILL" 2>/dev/null || true
  fi

  local -a in_args=()
  local -a filter_parts=()
  local stack_in=""
  local labels=()
  local i=0
  local idx

  for idx in "${cams[@]}"; do
    # Per-device AVFoundation modes (Continuity Brick/DeskView are picky).
    # FaceTime: 1280x720@30 · Brick: 640x480@30 · DeskView: 1920x1440@30
    local size="${LIVE_DEMUX_CAM_CAPTURE:-1280x720}"
    case "$idx" in
      0) size="${LIVE_DEMUX_CAM0_SIZE:-1280x720}" ;;
      1) size="${LIVE_DEMUX_CAM1_SIZE:-640x480}" ;;
      2) size="${LIVE_DEMUX_CAM2_SIZE:-1920x1440}" ;;
    esac
    in_args+=(
      -f avfoundation -framerate "$FPS"
      -video_size "$size" -pixel_format uyvy422
      -i "${idx}:none"
    )
    local mir=0
    # mirror FaceTime-ish index 0
    [[ "$idx" == "0" ]] && mir=1
    local tv
    tv=$(tile_vf "$mir")
    filter_parts+=("[${i}:v]${tv}[v${i}]")
    stack_in+="[v${i}]"
    labels+=("cam${idx}")
    i=$((i + 1))
  done

  if [[ $want_phone -eq 1 ]]; then
    in_args+=(-f image2 -loop 1 -framerate "$STILL_FPS" -i "$STILL")
    local tv
    tv=$(tile_vf 0)
    filter_parts+=("[${i}:v]${tv}[v${i}]")
    stack_in+="[v${i}]"
    labels+=("phone")
    i=$((i + 1))
  fi

  local n=$i
  if [[ $n -lt 1 ]]; then
    echo "error: nothing to mosaic" >&2
    exit 1
  fi

  # layout: 1 = single, 2 = hstack, else xstack grid
  local fc
  printf -v fc '%s;' "${filter_parts[@]}"
  fc="${fc%;}"
  if [[ $n -eq 1 ]]; then
    fc+=";[v0]copy[out]"
  elif [[ $n -eq 2 ]]; then
    fc+=";[v0][v1]hstack=inputs=2[out]"
  else
    local cols=2
    [[ $n -ge 5 ]] && cols=3
    local rows=$(( (n + cols - 1) / cols ))
    local layout="" r c x y j
    for ((j = 0; j < n; j++)); do
      r=$((j / cols)); c=$((j % cols))
      x=$((c * CW)); y=$((r * CH))
      [[ -n "$layout" ]] && layout+="|"
      layout+="${x}_${y}"
    done
    fc+=";${stack_in}xstack=inputs=${n}:layout=${layout}[out]"
  fi

  local title="lens · mosaic · ${labels[*]}"
  title="${title:0:96}"
  : >"$LOG"

  echo "==> $title"
  echo "    tiles: ${labels[*]}  cell ${CW}x${CH}  bug=$BUG"
  echo "    log: $LOG"

  nohup bash -c "
    exec ffmpeg -hide_banner -loglevel warning \
      $(printf '%q ' "${in_args[@]}") \
      -filter_complex $(printf '%q' "$fc") -map '[out]' -an -pix_fmt yuv420p \
      -f yuv4mpegpipe - 2>>$(printf '%q' "$LOG") \
    | ffplay -hide_banner -loglevel warning -fflags nobuffer -flags low_delay -framedrop \
        -window_title $(printf '%q' "$title") -f yuv4mpegpipe -i - \
        >>$(printf '%q' "$LOG") 2>&1
  " </dev/null >/dev/null 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null || true
  echo "    wrap pid $pid · close the ffplay window to stop"
  echo ""
  echo "Streams available on this Mac:"
  while IFS=$'\t' read -r idx name; do
    printf "  [%s]  %s\n" "$idx" "$name"
  done < <(list_video_devices)
  echo "  [phone]  still-pipe $STILL"
}

case "${1:-auto}" in
  list|ls|-h|--help|help)
    print_list
    ;;
  dual|you+phone|pair)
    build_and_play 0 phone
    ;;
  clean|plain)
    BUG=0
    shift || true
    if [[ $# -eq 0 ]]; then
      build_and_play 0 phone
    else
      build_and_play "$@"
    fi
    ;;
  all|desk|gallery|mosaic)
    # Every real cam + phone still in one window.
    mapfile -t idxs < <(list_video_devices | cut -f1)
    if [[ ${#idxs[@]} -eq 0 ]]; then
      idxs=(0)
    fi
    build_and_play "${idxs[@]}" phone
    ;;
  auto|"")
    # Max feeds by default: all AVFoundation cams + phone still-pipe.
    mapfile -t idxs < <(list_video_devices | cut -f1)
    if [[ ${#idxs[@]} -eq 0 ]]; then
      idxs=(0)
    fi
    build_and_play "${idxs[@]}" phone
    ;;
  *)
    build_and_play "$@"
    ;;
esac
