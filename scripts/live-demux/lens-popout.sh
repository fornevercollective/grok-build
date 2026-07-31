#!/usr/bin/env bash
# fornevercollective · live lens pop-out (tiny bug world / HDRI anamorphic)
# fc-lens-bug-v1 · companion to /lens · L key in /watch
#
# Usage:
#   bash scripts/live-demux/lens-popout.sh              # bug world · webcam
#   bash scripts/live-demux/lens-popout.sh bug
#   bash scripts/live-demux/lens-popout.sh planet       # tiny planet (flat FaceTime → sg)
#   bash scripts/live-demux/lens-popout.sh optic        # clip-on fisheye glass → keep circle
#   bash scripts/live-demux/lens-popout.sh optic planet # glass → HDRI latlong → tiny planet
#   bash scripts/live-demux/lens-popout.sh optic rabbit # glass → HDRI latlong → rabbit hole (other way)
#   bash scripts/live-demux/lens-popout.sh optic both   # planet | rabbit side-by-side (one cam)
#   bash scripts/live-demux/lens-popout.sh optic hdri   # glass → equirect HDRI map only
#   bash scripts/live-demux/lens-popout.sh rabbit dual  # inverted rabbit hole
#   bash scripts/live-demux/lens-popout.sh 360          # compound barrel (flat cams)
#   bash scripts/live-demux/lens-popout.sh 360 dual     # you + phone, compound both
#   bash scripts/live-demux/lens-popout.sh equirect     # true v360 equirect path
#   bash scripts/live-demux/lens-popout.sh anamorphic
#   bash scripts/live-demux/lens-popout.sh tiny
#   bash scripts/live-demux/lens-popout.sh hdri
#   bash scripts/live-demux/lens-popout.sh bug phone    # phone still-pipe
#   bash scripts/live-demux/lens-popout.sh bug dual     # you + phone
#
# Without optical glass: use planet / bug (software). With clip-on fisheye: use optic.
# Bare FaceTime must NOT be stretch→fake equirect (that yields color smear strips).
#
# Still photo (OpenCV polar, same math as planet profile):
#   python3 scripts/live-demux/tiny-planet.py panorama.jpg -o out.jpg
#   python3 scripts/live-demux/tiny-planet.py pano.jpg --invert -o rabbit.jpg
#
# Env:
#   LIVE_DEMUX_CAM_DEVICE=0
#   LIVE_DEMUX_CAM_CAPTURE=640x480
#   LIVE_DEMUX_CAM_STILL=~/.panda/vision/live.jpg
#   LIVE_DEMUX_LENS_SIZE=1280x720
#   LIVE_DEMUX_LENS_PLANET_SIZE=1000   square planet/rabbit size
#   LIVE_DEMUX_LENS_FPS=24
#   LIVE_DEMUX_LENS_STILL_FPS=12   re-open live.jpg N×/s
#   LIVE_DEMUX_LENS_VF=...     full ffmpeg -vf override
#   LIVE_DEMUX_LENS_360=1      force equirect v360 path (real 360 cams)
#   LIVE_DEMUX_LENS_NO_V360=1  skip v360 (flat barrel only)
#   LIVE_DEMUX_LENS_OPTIC=1    treat cam as clip-on fisheye (ih_fov ~170)
#   LIVE_DEMUX_LENS_IH_FOV / LIVE_DEMUX_LENS_IV_FOV  override input FOV
#
# 360 cameras: export LIVE_DEMUX_LENS_360=1 and point LIVE_DEMUX_CAM_DEVICE at
# the 360 device (or feed equirect into still-pipe). Profile `360` on flat
# FaceTime/phone uses hard barrel compound (stable). True equirect uses v360.

set -euo pipefail

PROFILE="${1:-bug}"
INPUT="${2:-auto}"
# Optional 3rd token: e.g. `optic planet`  or  `planet optic`
ARG3="${3:-}"
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

# Allow: optic planet | optic rabbit | optic both | optic hdri | planet optic
OPTIC=0
[[ "${LIVE_DEMUX_LENS_OPTIC:-0}" == "1" ]] && OPTIC=1
case "$PROFILE" in
  optic|optical|clip|clipon|clip-on|glass|attach|fisheye-glass|lensglass) OPTIC=1 ;;
esac
# reorder: `optic planet|rabbit|both|hdri|ways|dual-world` → PROFILE=… OPTIC=1
if [[ "$OPTIC" == "1" ]]; then
  look=""
  case "$INPUT" in
    planet|tinyplanet|tiny-planet|globe|sg) look=planet ;;
    rabbit|rabbithole|rabbit-hole|invert|hole|tunnel) look=rabbit ;;
    both|ways|dual-world|dualworld|pair|sbs|planet-rabbit) look=both ;;
    hdri|hdr|equirect|latlong|pano|map) look=hdri ;;
    circle|keep|raw) look=circle ;;
  esac
  case "$ARG3" in
    planet|rabbit|both|hdri|circle) look="$ARG3" ;;
  esac
  if [[ -n "$look" ]]; then
    PROFILE="optic-$look"
    # remaining tokens may be dual/phone/you
    if [[ "$INPUT" == "dual" || "$INPUT" == "phone" || "$INPUT" == "you" || "$INPUT" == "both" && "$look" != "both" ]]; then
      :
    elif [[ "$INPUT" == "dual" || "$INPUT" == "phone" || "$INPUT" == "you" ]]; then
      :
    else
      case "$INPUT" in
        planet|rabbit|both|ways|hdri|circle|tinyplanet*|globe|sg|rabbithole*|invert|hole|tunnel|equirect|latlong|pano|map|dual-world*|pair|sbs)
          INPUT="${ARG3:-auto}"
          ;;
      esac
    fi
  fi
fi
# bare `optic` → keep circular FOV
if [[ "$PROFILE" == "optic" || "$PROFILE" == "optical" || "$PROFILE" == "clip" || "$PROFILE" == "clipon" || "$PROFILE" == "clip-on" || "$PROFILE" == "glass" || "$PROFILE" == "attach" || "$PROFILE" == "fisheye-glass" || "$PROFILE" == "lensglass" ]]; then
  if [[ "$INPUT" == "auto" || "$INPUT" == "you" || "$INPUT" == "local" || "$INPUT" == "webcam" || -z "$INPUT" || "$INPUT" == "" ]]; then
    PROFILE="optic-circle"
  fi
  OPTIC=1
fi

need() { command -v "$1" >/dev/null 2>&1 || { echo "need $1"; exit 1; }; }
need ffplay
need ffmpeg

# --- filter graphs (match crates/.../lens.rs) ---
grade="eq=contrast=1.12:brightness=0.03:saturation=1.45:gamma=1.05,colorbalance=rs=-0.04:gs=0.06:bs=-0.03:rm=0.02:gm=0.04:bm=-0.02,unsharp=5:5:0.6:5:5:0.0"
grade_planet="eq=contrast=1.14:brightness=0.02:saturation=1.5:gamma=1.04,colorbalance=rs=-0.03:gs=0.05:bs=0.02:rm=0.01:gm=0.03:bm=0.04,unsharp=5:5:0.55:5:5:0.0,curves=all='0/0 0.2/0.18 0.5/0.52 0.8/0.85 1/1'"
# Stronger HDRI-on-latlong grade (applied after fisheye→equirect, before planet/rabbit)
grade_hdri="eq=contrast=1.18:brightness=0.015:saturation=1.62:gamma=1.02,colorbalance=rs=-0.05:gs=0.08:bs=-0.02:rm=0.02:gm=0.05:bm=0.01,curves=all='0/0 0.15/0.12 0.4/0.42 0.65/0.72 0.85/0.92 1/1',unsharp=5:5:0.65:5:5:0.0"
barrel="lenscorrection=k1=0.28:k2=0.12:cx=0.5:cy=0.5"
barrel_hard="lenscorrection=k1=0.42:k2=0.18:cx=0.5:cy=0.5"
tiny="crop=iw*0.92:ih*0.92,scale=iw*1.08:ih*1.08,crop=iw:ih,vignette=PI/5"
ana="scale=iw*0.52:ih,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x05080c"
ana2="scale=iw*0.42:ih,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x05080c"
base="scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2"
v360_bug="v360=input=e:output=dfisheye:h_fov=190:v_fov=190,scale=${W}:${H}"
v360_flat="v360=input=e:output=flat:yaw=0:pitch=-18:roll=0:h_fov=110:v_fov=70,scale=${W}:${H}"
PLANET_SIZE="${LIVE_DEMUX_LENS_PLANET_SIZE:-1000}"
HALF_P=$(( PLANET_SIZE / 2 ))
if [[ "$HALF_P" -lt 360 ]]; then HALF_P=360; fi
# FaceTime / laptop ~70–80° rectilinear. Clip-on fisheye glass ~160–180°.
IH_FLAT="${LIVE_DEMUX_LENS_IH_FOV:-78}"
IV_FLAT="${LIVE_DEMUX_LENS_IV_FOV:-55}"
IH_OPTIC="${LIVE_DEMUX_LENS_OPTIC_IH_FOV:-170}"
IV_OPTIC="${LIVE_DEMUX_LENS_OPTIC_IV_FOV:-170}"

# Stereographic tiny planet (OpenCV polar remap equivalent via v360 sg)
# TRUE equirect → sg
planet_eq="v360=input=e:output=sg:yaw=0:pitch=-90:roll=0:h_fov=360:v_fov=180,scale=${PLANET_SIZE}:${PLANET_SIZE},${grade_planet}"
rabbit_eq="v360=input=e:output=sg:yaw=0:pitch=90:roll=0:h_fov=360:v_fov=180,scale=${PLANET_SIZE}:${PLANET_SIZE},${grade_planet}"
# Bare FaceTime (NO optical glass): rectilinear → stereographic.
# NEVER stretch→fake equirect (that produces vertical color smear bands).
planet_flat="v360=input=flat:ih_fov=${IH_FLAT}:iv_fov=${IV_FLAT}:output=sg:yaw=0:pitch=-90:roll=0:h_fov=360:v_fov=180,scale=${PLANET_SIZE}:${PLANET_SIZE},${grade_planet}"
rabbit_flat="v360=input=flat:ih_fov=${IH_FLAT}:iv_fov=${IV_FLAT}:output=sg:yaw=0:pitch=90:roll=0:h_fov=360:v_fov=180,scale=${PLANET_SIZE}:${PLANET_SIZE},${grade_planet}"

# ═══ Clip-on glass ═══
# v360 input=fisheye FAILS when glass sits in a black ring on FaceTime (stripe smear).
# Planet/rabbit/both use OpenCV polar live: scripts/live-demux/optic-tinyworld.py
# Circle path stays ffmpeg (works — preserves optical FOV).
ZOOM_OPTIC="${LIVE_DEMUX_LENS_OPTIC_ZOOM:-0.70}"
# Keep circular FOV + HDRI grade (live bug-eye plate) — proven working with glass
optic_circle="scale=${PLANET_SIZE}:${PLANET_SIZE}:force_original_aspect_ratio=increase,crop=${PLANET_SIZE}:${PLANET_SIZE},crop=iw*${ZOOM_OPTIC}:ih*${ZOOM_OPTIC},scale=${PLANET_SIZE}:${PLANET_SIZE},${grade_hdri},vignette=PI/2.05"
# Placeholder VF for optic planet paths — play_webcam routes to Python polar instead
planet_optic="OPENCV_POLAR_PLANET"
rabbit_optic="OPENCV_POLAR_RABBIT"
optic_both="OPENCV_POLAR_BOTH"
optic_triple="OPENCV_POLAR_BOTH"
# HDRI latlong preview: zoom fill only (no broken fisheye v360)
optic_hdri_map="scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,crop=iw*${ZOOM_OPTIC}:ih*${ZOOM_OPTIC},scale=1280:640,${grade_hdri}"
OPTIC_PY="$(cd "$(dirname "$0")" && pwd)/optic-tinyworld.py"

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
    planet|tinyplanet|tiny-planet|littleplanet|globe|sg|stereographic)
      if [[ "$USE360" == "1" ]]; then
        VF="${planet_eq}"
      elif [[ "$OPTIC" == "1" ]]; then
        VF="${planet_optic}"
      else
        VF="${planet_flat}"
      fi
      ;;
    rabbit|rabbithole|rabbit-hole|invert|inverted|tunnel|hole)
      if [[ "$USE360" == "1" ]]; then
        VF="${rabbit_eq}"
      elif [[ "$OPTIC" == "1" ]]; then
        VF="${rabbit_optic}"
      else
        VF="${rabbit_flat}"
      fi
      ;;
    optic-circle|circle|keep|raw-circle)
      VF="${optic_circle}"
      ;;
    optic-planet)
      VF="${planet_optic}"
      OPTIC=1
      ;;
    optic-rabbit)
      VF="${rabbit_optic}"
      OPTIC=1
      ;;
    optic-both|optic-ways|optic-dual-world)
      VF="${optic_both}"
      OPTIC=1
      ;;
    optic-triple|optic-all)
      VF="${optic_triple}"
      OPTIC=1
      ;;
    optic-hdri|optic-map|optic-equirect)
      VF="${optic_hdri_map}"
      OPTIC=1
      ;;
    360|compound|fisheye|equirect|equirectangular|vr)
      if [[ "$USE360" == "1" ]]; then
        VF="${v360_bug},${grade},vignette=PI/3.2"
      elif [[ "$OPTIC" == "1" ]]; then
        VF="${optic_circle}"
      else
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
      if [[ "$OPTIC" == "1" ]]; then
        # glass on → HDRI latlong map
        VF="${optic_hdri_map}"
      elif [[ "$USE360" == "1" ]]; then
        VF="${v360_flat},${grade},curves=all='0/0 0.25/0.2 0.5/0.55 0.75/0.82 1/1',vignette=PI/6"
      else
        VF="${base},${grade},curves=all='0/0 0.25/0.2 0.5/0.55 0.75/0.82 1/1',vignette=PI/6"
      fi
      ;;
    bug|bugworld|insect|default|*)
      if [[ "$USE360" == "1" ]]; then
        VF="${v360_bug},${tiny},${grade},${ana},vignette=PI/3.5,hue=h=22:s=1.15"
      elif [[ "$OPTIC" == "1" ]]; then
        VF="${optic_circle},hue=h=14:s=1.12"
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

play_opencv_optic() {
  # OpenCV polar tiny world for clip-on glass (avoids v360 stripe smear).
  local mode="$1"
  local log="$LOG_DIR/lens-optic-opencv.log"
  if [[ ! -f "$OPTIC_PY" ]]; then
    echo "error: missing $OPTIC_PY"
    return 1
  fi
  if ! python3 -c "import cv2" 2>/dev/null; then
    echo "error: need opencv  →  pip install --user opencv-python-headless"
    return 1
  fi
  echo "==> lens optic OpenCV polar · mode=$mode device=$DEVICE"
  echo "    py: $OPTIC_PY"
  echo "    log: $log"
  nohup env \
    PYTHONUNBUFFERED=1 \
    LIVE_DEMUX_CAM_DEVICE="$DEVICE" \
    LIVE_DEMUX_CAM_CAPTURE="$CAPTURE" \
    LIVE_DEMUX_LENS_PLANET_SIZE="$PLANET_SIZE" \
    LIVE_DEMUX_LENS_OPTIC_ZOOM="${LIVE_DEMUX_LENS_OPTIC_ZOOM:-0.68}" \
    LIVE_DEMUX_LENS_FPS="$FPS" \
    LIVE_DEMUX_LENS_MIRROR=1 \
    LIVE_DEMUX_LENS_SHADER="${LIVE_DEMUX_LENS_SHADER:-1}" \
    LIVE_DEMUX_LENS_GLASS="${LIVE_DEMUX_LENS_GLASS:-1.0}" \
    LIVE_DEMUX_LENS_CHROMA="${LIVE_DEMUX_LENS_CHROMA:-1.0}" \
    python3 "$OPTIC_PY" "$mode" >>"$log" 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null || true
  echo "    pid $pid"
}

play_webcam() {
  local title="lens · ${PROFILE} · [${DEVICE}]"
  local log="$LOG_DIR/lens-webcam.log"

  # Clip-on glass planet/rabbit/both → OpenCV polar (v360 stripes on black ring)
  case "$VF" in
    OPENCV_POLAR_PLANET) play_opencv_optic planet; return ;;
    OPENCV_POLAR_RABBIT) play_opencv_optic rabbit; return ;;
    OPENCV_POLAR_BOTH) play_opencv_optic both; return ;;
  esac
  case "$PROFILE" in
    optic-planet) play_opencv_optic planet; return ;;
    optic-rabbit) play_opencv_optic rabbit; return ;;
    optic-both|optic-ways|optic-dual-world|optic-triple|optic-all) play_opencv_optic both; return ;;
  esac

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
echo "  profile=$PROFILE input=$INPUT use_v360=$USE360 optic=$OPTIC"
echo "  glass: optic (circle) · optic planet · optic rabbit · optic both"
echo "  path:  OpenCV polar on zoomed glass fill (v360 fisheye smears on black ring)"
echo "  bare:  planet / rabbit (flat→sg) · no stretch-smear"
echo "  true equirect: LIVE_DEMUX_LENS_360=1 $0 360 equirect"
echo "  logs: $LOG_DIR/lens-*.log"
