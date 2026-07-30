#!/usr/bin/env bash
# fornevercollective · live lens pop-out (tiny bug world / HDRI anamorphic)
# fc-lens-bug-v1 · companion to /lens · L key in /watch
#
# Usage:
#   bash scripts/live-demux/lens-popout.sh              # bug world · webcam
#   bash scripts/live-demux/lens-popout.sh bug
#   bash scripts/live-demux/lens-popout.sh 360          # compound barrel (flat cams)
#   bash scripts/live-demux/lens-popout.sh 360 dual     # you + phone, compound both
#   bash scripts/live-demux/lens-popout.sh equirect     # true v360 equirect path
#   bash scripts/live-demux/lens-popout.sh anamorphic
#   bash scripts/live-demux/lens-popout.sh tiny
#   bash scripts/live-demux/lens-popout.sh hdri
#   bash scripts/live-demux/lens-popout.sh bug phone    # phone still-pipe
#   bash scripts/live-demux/lens-popout.sh bug dual     # you + phone
#
# Env:
#   LIVE_DEMUX_CAM_DEVICE=0
#   LIVE_DEMUX_CAM_CAPTURE=640x480
#   LIVE_DEMUX_CAM_STILL=~/.panda/vision/live.jpg
#   LIVE_DEMUX_LENS_SIZE=1280x720
#   LIVE_DEMUX_LENS_FPS=24
#   LIVE_DEMUX_LENS_STILL_FPS=12   re-open live.jpg N×/s
#   LIVE_DEMUX_LENS_VF=...     full ffmpeg -vf override
#   LIVE_DEMUX_LENS_360=1      force equirect v360 path (real 360 cams)
#   LIVE_DEMUX_LENS_NO_V360=1  skip v360 (flat barrel only)
#
# 360 cameras: export LIVE_DEMUX_LENS_360=1 and point LIVE_DEMUX_CAM_DEVICE at
# the 360 device (or feed equirect into still-pipe). Profile `360` on flat
# FaceTime/phone uses hard barrel compound (stable). True equirect uses v360.

set -euo pipefail

PROFILE="${1:-bug}"
INPUT="${2:-auto}"
SIZE="${LIVE_DEMUX_LENS_SIZE:-1280x720}"
FPS="${LIVE_DEMUX_LENS_FPS:-24}"
STILL_FPS="${LIVE_DEMUX_LENS_STILL_FPS:-12}"
CAPTURE="${LIVE_DEMUX_CAM_CAPTURE:-640x480}"
DEVICE="${LIVE_DEMUX_CAM_DEVICE:-0}"
STILL="${LIVE_DEMUX_CAM_STILL:-$HOME/.panda/vision/live.jpg}"
W="${SIZE%x*}"; H="${SIZE#*x}"
W="${W:-1280}"; H="${H:-720}"
LOG_DIR="${LIVE_DEMUX_LENS_LOG_DIR:-$HOME/.panda/vision/logs}"
mkdir -p "$LOG_DIR" 2>/dev/null || true

need() { command -v "$1" >/dev/null 2>&1 || { echo "need $1"; exit 1; }; }
need ffplay
need ffmpeg

# --- filter graphs (match crates/.../lens.rs) ---
grade="eq=contrast=1.12:brightness=0.03:saturation=1.45:gamma=1.05,colorbalance=rs=-0.04:gs=0.06:bs=-0.03:rm=0.02:gm=0.04:bm=-0.02,unsharp=5:5:0.6:5:5:0.0"
barrel="lenscorrection=k1=0.28:k2=0.12:cx=0.5:cy=0.5"
barrel_hard="lenscorrection=k1=0.42:k2=0.18:cx=0.5:cy=0.5"
tiny="crop=iw*0.92:ih*0.92,scale=iw*1.08:ih*1.08,crop=iw:ih,vignette=PI/5"
ana="scale=iw*0.52:ih,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x05080c"
ana2="scale=iw*0.42:ih,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x05080c"
base="scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2"
v360_bug="v360=input=e:output=dfisheye:h_fov=190:v_fov=190,scale=${W}:${H}"
v360_flat="v360=input=e:output=flat:yaw=0:pitch=-18:roll=0:h_fov=110:v_fov=70,scale=${W}:${H}"

# True equirect only when forced or input is equirect — NOT merely profile "360".
# Flat FaceTime + phone still crash or thrash under v360+image2 on some builds.
USE360=0
[[ "${LIVE_DEMUX_LENS_360:-0}" == "1" ]] && USE360=1
[[ "$INPUT" == "360" || "$INPUT" == "equirect" || "$INPUT" == "equirectangular" || "$INPUT" == "pano" ]] && USE360=1
[[ "$PROFILE" == "equirect" || "$PROFILE" == "equirectangular" ]] && USE360=1
if [[ "${LIVE_DEMUX_LENS_NO_V360:-0}" == "1" ]]; then
  USE360=0
fi

if [[ -n "${LIVE_DEMUX_LENS_VF:-}" ]]; then
  VF="$LIVE_DEMUX_LENS_VF"
fi

if [[ -z "${VF:-}" ]]; then
  case "$PROFILE" in
    360|compound|fisheye|equirect|equirectangular|vr)
      if [[ "$USE360" == "1" ]]; then
        VF="${v360_bug},${grade},vignette=PI/3.2"
      else
        # Stable compound-eye on flat cams (dual desk / phone pipe)
        VF="${base},${barrel_hard},${grade},vignette=PI/3,${ana}"
      fi
      ;;
    ana|anamorphic|scope|2x)
      if [[ "$USE360" == "1" ]]; then
        VF="${v360_flat},${grade},${ana2}"
      else
        VF="${base},${barrel},${grade},${ana2}"
      fi
      ;;
    tiny|mini|miniature|tilt|tiltshift|diorama)
      if [[ "$USE360" == "1" ]]; then
        VF="${v360_flat},${tiny},${grade}"
      else
        VF="${base},${tiny},${grade},hue=h=18:s=1.1"
      fi
      ;;
    hdri|hdr|tone)
      if [[ "$USE360" == "1" ]]; then
        VF="${v360_flat},${grade},curves=all='0/0 0.25/0.2 0.5/0.55 0.75/0.82 1/1',vignette=PI/6"
      else
        VF="${base},${grade},curves=all='0/0 0.25/0.2 0.5/0.55 0.75/0.82 1/1',vignette=PI/6"
      fi
      ;;
    bug|bugworld|insect|default|*)
      if [[ "$USE360" == "1" ]]; then
        VF="${v360_bug},${tiny},${grade},${ana},vignette=PI/3.5,hue=h=22:s=1.15"
      else
        VF="${base},${barrel_hard},${tiny},${grade},${ana},vignette=PI/3.5,hue=h=22:s=1.15"
      fi
      ;;
  esac
fi

# Detach so windows outlive this script (SIGHUP was killing ffplay).
# macOS has no setsid — always prefer nohup; use setsid only when present.
detach_ffplay() {
  local log="$1"; shift
  if command -v setsid >/dev/null 2>&1 && [[ "$(uname -s)" != "Darwin" ]]; then
    setsid "$@" </dev/null >>"$log" 2>&1 &
  else
    nohup "$@" </dev/null >>"$log" 2>&1 &
  fi
  local pid=$!
  disown "$pid" 2>/dev/null || true
  echo "$pid"
}

play_webcam() {
  local title="lens · ${PROFILE} · [${DEVICE}]"
  local log="$LOG_DIR/lens-webcam.log"
  echo "==> lens webcam · $title"
  echo "    vf: $VF"
  echo "    log: $log"
  local pid
  if [[ "$(uname -s)" == "Darwin" ]]; then
    pid=$(detach_ffplay "$log" \
      ffplay -hide_banner -loglevel warning -fflags nobuffer -flags low_delay -framedrop \
        -window_title "$title" \
        -f avfoundation -framerate "$FPS" -video_size "$CAPTURE" -i "${DEVICE}:none" \
        -an -vf "hflip,${VF}")
  else
    pid=$(detach_ffplay "$log" \
      ffplay -hide_banner -loglevel warning -fflags nobuffer -flags low_delay -framedrop \
        -window_title "$title" \
        -f v4l2 -framerate "$FPS" -video_size "$CAPTURE" -i "/dev/video${DEVICE}" \
        -an -vf "$VF")
  fi
  echo "    pid $pid"
}

play_still() {
  local title="lens · ${PROFILE} · phone still"
  local log="$LOG_DIR/lens-still.log"
  mkdir -p "$(dirname "$STILL")"
  if [[ ! -s "$STILL" ]]; then
    # minimal seed so ffplay opens before phone posts
    printf '\xff\xd8\xff\xd9' >"$STILL" 2>/dev/null || true
  fi
  echo "==> lens still · $STILL"
  echo "    vf: $VF"
  echo "    log: $log"
  # ffmpeg image2 re-reads live.jpg each frame; ffplay consumes yuv4mpegpipe.
  # Direct ffplay-on-JPEG freezes/blacks on macOS when still-server atomically
  # replaces live.jpg (inode swap) — pipe path stays live.
  local pid
  # shell wrapper as process group parent
  nohup bash -c "
    exec ffmpeg -hide_banner -loglevel warning \
      -f image2 -loop 1 -framerate ${STILL_FPS} -i \"${STILL}\" \
      -an -vf \"${VF}\" -pix_fmt yuv420p \
      -f yuv4mpegpipe - 2>>\"${log}\" \
    | ffplay -hide_banner -loglevel warning -fflags nobuffer -flags low_delay -framedrop \
        -window_title \"${title}\" -f yuv4mpegpipe -i - \
        >>\"${log}\" 2>&1
  " </dev/null >/dev/null 2>&1 &
  pid=$!
  disown "$pid" 2>/dev/null || true
  echo "    pid $pid (ffmpeg|ffplay pipe)"
}

case "$INPUT" in
  phone|still|stillpipe|tether|pwa)
    play_still
    ;;
  dual|both|pair|sbs)
    play_webcam
    sleep 0.35
    play_still
    ;;
  360|equirect|equirectangular|pano)
    USE360=1
    # rebuild VF with equirect if profile case already ran without it
    if [[ -z "${LIVE_DEMUX_LENS_VF:-}" && "${LIVE_DEMUX_LENS_NO_V360:-0}" != "1" ]]; then
      VF="${v360_bug},${grade},vignette=PI/3.2"
    fi
    play_webcam
    ;;
  auto|you|local|webcam|laptop|desktop|"")
    src="${LIVE_DEMUX_CAM_SOURCE:-local}"
    case "$src" in
      dual|both|phone+local|local+phone) play_webcam; sleep 0.35; play_still ;;
      phone|still|phone-only) play_still ;;
      *) play_webcam ;;
    esac
    ;;
  *)
    play_webcam
    ;;
esac

echo ""
echo "Tiny bug world · HDRI anamorphic lens live."
echo "  profile=$PROFILE input=$INPUT use_v360=$USE360"
echo "  Grok: /lens · /lens 360 dual · /lens bug dual · L in /watch"
echo "  true equirect: LIVE_DEMUX_LENS_360=1 $0 360 equirect"
echo "  logs: $LOG_DIR/lens-*.log"
