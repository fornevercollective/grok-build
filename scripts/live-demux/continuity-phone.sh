#!/usr/bin/env bash
# fornevercollective · Continuity Camera phone desk (camera only)
#
# Uses Apple Continuity Camera (iPhone as a Mac webcam) via AVFoundation.
# Phone may stay locked / face-down after unlock once. Real camera devices only
# (FaceTime built-in + Brick / iPhone Continuity). Optional still-pipe is separate.
#
# Usage:
#   bash scripts/live-demux/continuity-phone.sh list
#   bash scripts/live-demux/continuity-phone.sh wait     # poll until Brick appears
#   bash scripts/live-demux/continuity-phone.sh dual     # FaceTime + Continuity LIVE windows
#   bash scripts/live-demux/continuity-phone.sh desk     # Continuity cams + FaceTime mosaic
#   bash scripts/live-demux/continuity-phone.sh env      # print env for Grok /cam phone
#
# iPhone setup (once):
#   Settings → General → AirPlay & Handoff → Continuity Camera → ON
#   Same Apple ID, Wi‑Fi + Bluetooth on, phone nearby (can be locked after unlock once)
#   Mac: Continuity shows as "iPhone" / Brick under camera device lists
#
# Explicit only: this script never opens FaceTime.app / Camera.app / browsers.
# `dual` / `desk` spawn ffplay only when you pass those subcommands.

set -euo pipefail

LOG_DIR="${LIVE_DEMUX_LENS_LOG_DIR:-$HOME/.panda/vision/logs}"
mkdir -p "$LOG_DIR"

need() { command -v "$1" >/dev/null 2>&1 || { echo "need $1"; exit 1; }; }
need ffmpeg
need ffplay

list_cams() {
  # Real cameras only — skip non-camera AVFoundation entries
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

is_continuity_name() {
  local n
  n=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  [[ "$n" == *brick* || "$n" == *continuity* || "$n" == *iphone* \
    || "$n" == *desk*view* || "$n" == *desk\ view* ]]
}

is_facetime_name() {
  local n
  n=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  [[ "$n" == *facetime* || "$n" == *built-in* ]]
}

print_list() {
  echo "AVFoundation cameras (webcams / Continuity only):"
  local n=0
  while IFS=$'\t' read -r idx name; do
    local tag="cam"
    is_continuity_name "$name" && tag="CONTINUITY"
    is_facetime_name "$name" && tag="mac"
    printf "  [%s]  %-12s  %s\n" "$idx" "$tag" "$name"
    n=$((n + 1))
  done < <(list_cams)
  if [[ "$n" -eq 0 ]]; then
    echo "  (none)"
  fi
  echo ""
  if ! list_cams | while IFS=$'\t' read -r _ name; do is_continuity_name "$name" && exit 0; done; then
    echo "Continuity Camera: NOT listed"
    echo ""
    echo "Wake Continuity Camera (phone as webcam):"
    echo "  1. iPhone: Settings → General → AirPlay & Handoff → Continuity Camera ON"
    echo "  2. Same Apple ID · Wi‑Fi · Bluetooth · phone near Mac"
    echo "  3. Unlock iPhone once, then lock / face-down is OK"
    echo "  4. On Mac, System Settings → Camera (or FaceTime → Video) → pick your iPhone"
    echo "  5. Re-run: $0 list"
    echo ""
    echo "This path is Continuity Camera (iPhone as webcam) only."
  else
    echo "Continuity Camera: present · use: $0 dual"
  fi
}

find_continuity() {
  # stdout: "idx\tname" for each Continuity cam
  while IFS=$'\t' read -r idx name; do
    if is_continuity_name "$name"; then
      printf "%s\t%s\n" "$idx" "$name"
    fi
  done < <(list_cams)
}

find_facetime() {
  while IFS=$'\t' read -r idx name; do
    if is_facetime_name "$name"; then
      printf "%s\t%s\n" "$idx" "$name"
      return 0
    fi
  done < <(list_cams)
  # fallback first cam
  list_cams | head -1
}

capture_for() {
  local name="$1"
  local nl
  nl=$(echo "$name" | tr '[:upper:]' '[:lower:]')
  if [[ "$nl" == *desk* ]]; then
    echo "1920x1440"
  else
    echo "640x480"
  fi
}

wait_continuity() {
  local secs="${1:-60}"
  echo "==> waiting up to ${secs}s for Continuity Camera (Brick / iPhone / Desk View)…"
  local i
  for ((i = 0; i < secs; i++)); do
    if find_continuity | grep -q .; then
      echo "found:"
      find_continuity | while IFS=$'\t' read -r idx name; do
        printf "  [%s]  %s\n" "$idx" "$name"
      done
      return 0
    fi
    sleep 1
    if (( i % 10 == 9 )); then
      echo "  … still waiting (${i}s) — unlock iPhone once, keep nearby"
    fi
  done
  echo "error: Continuity Camera never appeared" >&2
  print_list
  return 1
}

play_live() {
  local idx="$1" name="$2" title="$3" mirror="${4:-0}"
  local size fps=30
  size=$(capture_for "$name")
  local log="$LOG_DIR/continuity-${idx}.log"
  local vf="scale=960:540"
  [[ "$mirror" == "1" ]] && vf="hflip,${vf}"
  echo "==> LIVE Continuity · [$idx] $name"
  echo "    $title · $size@$fps · log $log"
  nohup ffplay -hide_banner -loglevel warning -fflags nobuffer -flags low_delay -framedrop \
    -window_title "$title" \
    -f avfoundation -framerate "$fps" -video_size "$size" -pixel_format uyvy422 \
    -i "${idx}:none" -an -vf "$vf" \
    </dev/null >>"$log" 2>&1 &
  disown $! 2>/dev/null || true
  echo "    pid $!"
}

print_env() {
  local first=""
  while IFS=$'\t' read -r idx name; do
    if [[ -z "$first" ]]; then
      first="$idx"
      echo "export LIVE_DEMUX_CAM_PHONE_DEVICE=$idx   # $name"
    fi
    echo "# also: [$idx] $name"
  done < <(find_continuity)
  if [[ -z "$first" ]]; then
    echo "# Continuity not listed — run: $0 wait"
    return 1
  fi
  echo "export LIVE_DEMUX_CAM_PHONE_STILL=0"
  echo "export LIVE_DEMUX_CAM_SOURCE=dual"
  echo "export LIVE_DEMUX_CAM_DESK=1"
  echo "# then in Grok: /cam phone   (Continuity live, not HTTP)"
}

cmd_dual() {
  wait_continuity 5 || wait_continuity 45 || exit 1
  local ft_idx ft_name
  IFS=$'\t' read -r ft_idx ft_name < <(find_facetime)
  play_live "$ft_idx" "$ft_name" "LIVE · you FaceTime" 1
  sleep 0.4
  local n=0
  while IFS=$'\t' read -r idx name; do
    n=$((n + 1))
    play_live "$idx" "$name" "LIVE · phone Continuity · $name" 0
    sleep 0.5
  done < <(find_continuity)
  echo ""
  echo "Opened FaceTime + $n Continuity LIVE window(s)."
  echo "Grok desk dual (after rebuild):"
  print_env || true
}

cmd_desk() {
  cmd_dual
}

case "${1:-list}" in
  list|ls) print_list ;;
  wait) wait_continuity "${2:-90}" ;;
  dual|you+phone) cmd_dual ;;
  desk|all|mosaic) cmd_desk ;;
  env) print_env ;;
  help|-h|--help)
    head -25 "$0" | tail -20
    ;;
  *)
    echo "usage: $0 list|wait|dual|desk|env"
    exit 1
    ;;
esac
