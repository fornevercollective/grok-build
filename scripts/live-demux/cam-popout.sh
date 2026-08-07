#!/usr/bin/env bash
# fornevercollective · camera pop-out (Zoom-style OS windows)
# fc-live-demux-v1 · companion to /watch camera (TTY PiP)
#
# Usage:
#   bash scripts/live-demux/cam-popout.sh              # list devices
#   bash scripts/live-demux/cam-popout.sh 0            # FaceTime (index)
#   bash scripts/live-demux/cam-popout.sh all          # every real camera, own window
#   bash scripts/live-demux/cam-popout.sh mosaic       # one gallery window (xstack)
#   bash scripts/live-demux/cam-popout.sh 0 1          # selected indices
#   bash scripts/live-demux/cam-popout.sh FaceTime     # name fragment
#
# Env:
#   LIVE_DEMUX_CAM_CAPTURE=640x480   native mode (FaceTime-safe)
#   LIVE_DEMUX_CAM_FPS=15
#   LIVE_DEMUX_CAM_MIRROR=1          selfie hflip (default on for single)
#   LIVE_DEMUX_CAM_MIRROR_MOSAIC=0   mirror each tile in mosaic (default off)
#   LIVE_DEMUX_CAM_SIZE=960x540      display size per window / mosaic cell
#
# Note: AVFoundation usually exclusive-locks a device. Turn off TTY /watch
# cam (`c`) before popping the same index, or pick a different camera.

set -euo pipefail

CAPTURE="${LIVE_DEMUX_CAM_CAPTURE:-640x480}"
FPS="${LIVE_DEMUX_CAM_FPS:-15}"
SIZE="${LIVE_DEMUX_CAM_SIZE:-960x540}"
MIRROR="${LIVE_DEMUX_CAM_MIRROR:-1}"
MIRROR_MOSAIC="${LIVE_DEMUX_CAM_MIRROR_MOSAIC:-0}"

list_video_devices() {
  # stdout: "index<TAB>name" for real cameras only
  # BSD awk (macOS /usr/bin/awk) has no match(..., array); use portable split.
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
        if (name ~ /^Capture screen /) next
        printf "%s\t%s\n", idx, name
      }
    '
}

print_list() {
  echo "AVFoundation cameras (webcams / Continuity only):"
  echo "  idx  name"
  local n=0
  while IFS=$'\t' read -r idx name; do
    printf "  [%s]  %s\n" "$idx" "$name"
    n=$((n + 1))
  done < <(list_video_devices)
  if [[ "$n" -eq 0 ]]; then
    echo "  (none found — Continuity / privacy?)"
    return 1
  fi
  echo ""
  echo "Pop-out like Zoom:"
  echo "  $0 all          # one ffplay window per camera"
  echo "  $0 mosaic       # single gallery grid"
  echo "  $0 0            # FaceTime only"
  echo "  $0 0 1          # FaceTime + Brick"
}

resolve_indices() {
  # args → space-separated device indices
  local -a out=()
  local arg
  if [[ $# -eq 0 ]]; then
    return 1
  fi
  if [[ $# -eq 1 && "$1" == "all" ]]; then
    while IFS=$'\t' read -r idx _name; do
      out+=("$idx")
    done < <(list_video_devices)
    printf '%s\n' "${out[*]}"
    return 0
  fi
  for arg in "$@"; do
    if [[ "$arg" =~ ^[0-9]+$ ]]; then
      out+=("$arg")
      continue
    fi
    # name fragment (case-insensitive)
    local hit=""
    while IFS=$'\t' read -r idx name; do
      if echo "$name" | grep -qi -- "$arg"; then
        hit="$idx"
        break
      fi
    done < <(list_video_devices)
    if [[ -z "$hit" ]]; then
      echo "error: no camera matching '$arg'" >&2
      print_list >&2
      return 1
    fi
    out+=("$hit")
  done
  printf '%s\n' "${out[*]}"
}

device_name() {
  local want="$1"
  while IFS=$'\t' read -r idx name; do
    if [[ "$idx" == "$want" ]]; then
      echo "$name"
      return 0
    fi
  done < <(list_video_devices)
  echo "cam $want"
}

vf_mirror() {
  local on="$1"
  if [[ "$on" == "1" || "$on" == "true" || "$on" == "yes" ]]; then
    echo "hflip,scale=${SIZE/x/:}"
  else
    echo "scale=${SIZE/x/:}"
  fi
}

# SIZE is WxH — ffmpeg scale wants W:H
scale_expr() {
  echo "${SIZE}" | awk -F x '{print $1":"$2}'
}

spawn_one() {
  local idx="$1"
  local mirror_on="${2:-$MIRROR}"
  local name
  name="$(device_name "$idx")"
  local title="cam · [$idx] ${name}"
  local vf
  if [[ "$mirror_on" == "1" || "$mirror_on" == "true" || "$mirror_on" == "yes" ]]; then
    vf="hflip,scale=$(scale_expr)"
  else
    vf="scale=$(scale_expr)"
  fi
  echo "pop-out cam [$idx] $name  →  ffplay ($SIZE @ ${FPS}fps, capture $CAPTURE)"
  # Detached: nohup + background so shell can launch many
  nohup ffplay -hide_banner -loglevel error \
    -fflags nobuffer -flags low_delay -framedrop \
    -window_title "$title" \
    -f avfoundation -framerate "$FPS" -video_size "$CAPTURE" \
    -i "${idx}:none" \
    -an -vf "$vf" \
    >/dev/null 2>&1 &
  echo "  pid $! · close the window to stop"
}

spawn_mosaic() {
  local -a idxs=("$@")
  local n="${#idxs[@]}"
  if [[ "$n" -eq 0 ]]; then
    echo "error: no cameras for mosaic" >&2
    return 1
  fi
  if [[ "$n" -eq 1 ]]; then
    spawn_one "${idxs[0]}" "$MIRROR"
    return 0
  fi

  # Grid: 2 → 1x2, 3–4 → 2x2, 5–6 → 2x3, else ceil sqrt
  local cols rows
  if [[ "$n" -eq 2 ]]; then cols=2; rows=1
  elif [[ "$n" -le 4 ]]; then cols=2; rows=2
  elif [[ "$n" -le 6 ]]; then cols=3; rows=2
  else
    cols=$(python3 -c "import math; print(math.ceil(math.sqrt($n)))")
    rows=$(python3 -c "import math; print(math.ceil($n/$cols))")
  fi

  local cell_w cell_h
  cell_w=$(echo "$SIZE" | cut -dx -f1)
  cell_h=$(echo "$SIZE" | cut -dx -f2)
  local out_w=$((cell_w * cols))
  local out_h=$((cell_h * rows))

  local -a args=(-hide_banner -loglevel error)
  local i=0
  local filter_parts=()
  local stack_inputs=""
  for idx in "${idxs[@]}"; do
    args+=(-f avfoundation -framerate "$FPS" -video_size "$CAPTURE" -i "${idx}:none")
    local cell_vf="[${i}:v]scale=${cell_w}:${cell_h}"
    if [[ "$MIRROR_MOSAIC" == "1" || "$MIRROR_MOSAIC" == "true" ]]; then
      cell_vf="${cell_vf},hflip"
    fi
    cell_vf="${cell_vf},setsar=1[v${i}]"
    filter_parts+=("$cell_vf")
    stack_inputs+="[v${i}]"
    i=$((i + 1))
  done

  # xstack layout string: 0_0|w0_0|0_h0|...
  local layout=""
  local r c x y
  for ((i = 0; i < n; i++)); do
    r=$((i / cols))
    c=$((i % cols))
    x=$((c * cell_w))
    y=$((r * cell_h))
    if [[ -n "$layout" ]]; then layout+="|"; fi
    layout+="${x}_${y}"
  done

  local fc
  # Join filter-graph steps with semicolons (no IFS quirks).
  printf -v fc '%s;' "${filter_parts[@]}"
  fc="${fc%;}"
  fc+=";${stack_inputs}xstack=inputs=${n}:layout=${layout}[out]"

  local names=""
  for idx in "${idxs[@]}"; do
    names+="[$(device_name "$idx")] "
  done
  local title="cam mosaic · ${n} cams · ${names}"
  title="${title:0:96}"

  echo "pop-out mosaic ${cols}x${rows} (${n} cams) → ${out_w}x${out_h}"
  echo "  ${names}"
  nohup ffplay -hide_banner -loglevel error \
    -fflags nobuffer -flags low_delay -framedrop \
    -window_title "$title" \
    "${args[@]}" \
    -filter_complex "$fc" -map "[out]" -an \
    >/dev/null 2>&1 &
  echo "  pid $! · close the window to stop"
}

main() {
  if [[ $# -eq 0 || "$1" == "list" || "$1" == "ls" || "$1" == "--help" || "$1" == "-h" ]]; then
    print_list
    exit 0
  fi

  command -v ffmpeg >/dev/null || { echo "error: need ffmpeg"; exit 1; }
  command -v ffplay >/dev/null || { echo "error: need ffplay (brew ffmpeg)"; exit 1; }

  if [[ "$1" == "mosaic" || "$1" == "grid" || "$1" == "zoom" || "$1" == "gallery" ]]; then
    shift || true
    local -a idxs
    if [[ $# -eq 0 ]]; then
      # all cameras
      read -r -a idxs <<< "$(resolve_indices all)"
    else
      read -r -a idxs <<< "$(resolve_indices "$@")"
    fi
    spawn_mosaic "${idxs[@]}"
    exit 0
  fi

  local -a idxs
  read -r -a idxs <<< "$(resolve_indices "$@")"
  if [[ "${#idxs[@]}" -eq 0 ]]; then
    echo "error: no cameras resolved" >&2
    exit 1
  fi
  for idx in "${idxs[@]}"; do
    spawn_one "$idx" "$MIRROR"
    # brief stagger so AVFoundation does not race open
    sleep 0.35
  done
  echo ""
  echo "Zoom-style tips:"
  echo "  · each window is independent — drag/resize like call tiles"
  echo "  · mosaic:  $0 mosaic"
  echo "  · TTY PiP: bash scripts/launch-watch.sh camera"
  echo "  · same device: turn off TTY cam (c) if open fails exclusive lock"
}

main "$@"
