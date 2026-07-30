#!/usr/bin/env bash
# fornevercollective · cast to TCL Google TV / Chromecast built-in
# fc-cast-tv-v1 · explicit only (NO-AUTO-LAUNCH)
#
# Usage:
#   bash scripts/live-demux/cast-tv.sh list
#   bash scripts/live-demux/cast-tv.sh status
#   bash scripts/live-demux/cast-tv.sh doctor
#   bash scripts/live-demux/cast-tv.sh url 'https://…' [device-name]
#   bash scripts/live-demux/cast-tv.sh file ./clip.mp4 [device]
#   bash scripts/live-demux/cast-tv.sh hls ./out.m3u8 [device]
#   bash scripts/live-demux/cast-tv.sh encode-url 'https://…'   # re-encode → local → cast
#   bash scripts/live-demux/cast-tv.sh desk [device]            # dual still layout if live.jpg+cam
#   bash scripts/live-demux/cast-tv.sh mosaic [device]          # 2×2 wall layout
#   bash scripts/live-demux/cast-tv.sh align [device]           # interactive HTML surface (cast_site)
#   bash scripts/live-demux/cast-tv.sh align-mp4 [device]       # static MP4 chart (legacy)
#   bash scripts/live-demux/cast-tv.sh align-ui                 # hub + phone control + TV surface
#   bash scripts/live-demux/cast-tv.sh box [device]             # BOX depth + forest + center loop
#   bash scripts/live-demux/cast-tv.sh gpu [device]             # WebGL GPU env TV stream test
#   bash scripts/live-demux/cast-tv.sh news [device]            # news wall multi-feed
#   bash scripts/live-demux/cast-tv.sh stop [device]
#   bash scripts/live-demux/cast-tv.sh profile                  # print TCL profile
#
# Requires: ffmpeg. Optional: catt (pipx install catt) for Cast control.
# Env: see docs/fornever-ledger/CAST-TV-WALL-PLAN.md
set -euo pipefail

# pipx / user local bins (catt)
export PATH="${HOME}/.local/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROFILE_ID="${LIVE_DEMUX_CAST_TV_MODEL:-tcl-google-uhd}"
PROFILE_JSON="${LIVE_DEMUX_CAST_PROFILE:-$ROOT/scripts/live-demux/devices/${PROFILE_ID}.json}"
# Default to discovered TCL friendly name when env unset
DEFAULT_DEVICE="Smart TV"
BIND="${LIVE_DEMUX_CAST_BIND:-0.0.0.0}"
PORT="${LIVE_DEMUX_CAST_PORT:-8765}"
FPS="${LIVE_DEMUX_CAST_FPS:-30}"
W="${LIVE_DEMUX_CAST_W:-1920}"
H="${LIVE_DEMUX_CAST_H:-1080}"
if [[ "${LIVE_DEMUX_CAST_UHD:-0}" == "1" ]]; then
  W=3840; H=2160
fi
SERVE_DIR="${LIVE_DEMUX_CAST_DIR:-$HOME/.panda/vision/cast}"
PID_FILE="${SERVE_DIR}/http.pid"
LOG="${SERVE_DIR}/cast.log"
mkdir -p "$SERVE_DIR"

CMD="${1:-help}"
shift || true

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: need $1 on PATH"; exit 1; }; }

lan_ip() {
  ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo "127.0.0.1"
}

resolve_device() {
  # arg override → env → profile catt_device → DEFAULT_DEVICE
  local arg="${1:-}"
  if [[ -n "$arg" ]]; then
    echo "$arg"
    return
  fi
  if [[ -n "${LIVE_DEMUX_CAST_DEVICE:-}" ]]; then
    echo "$LIVE_DEMUX_CAST_DEVICE"
    return
  fi
  if [[ -f "$PROFILE_JSON" ]] && command -v python3 >/dev/null 2>&1; then
    local from_prof
    from_prof="$(python3 -c "import json; print(json.load(open('$PROFILE_JSON')).get('cast',{}).get('catt_device',''))" 2>/dev/null || true)"
    if [[ -n "$from_prof" ]]; then
      echo "$from_prof"
      return
    fi
  fi
  echo "$DEFAULT_DEVICE"
}

print_profile() {
  if [[ -f "$PROFILE_JSON" ]]; then
    echo "==> device profile · $PROFILE_ID"
    if command -v python3 >/dev/null 2>&1; then
      python3 - "$PROFILE_JSON" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
ce=p.get("cast_encode",{})
disc=p.get("discovered",{})
panel=p.get("panel",{})
print(f"  label:     {p.get('label')}")
print(f"  mfr:       {p.get('manufacturer', p.get('manufacturer_class',''))}")
print(f"  cast:      {p.get('cast',{}).get('protocol')}")
print(f"  device:    {p.get('cast',{}).get('catt_device')}  ({disc.get('ip','?')})")
print(f"  model:     {disc.get('catt_model') or disc.get('mdns_model') or '(confirm on TV About)'}")
print(f"  encode:    {ce.get('width')}x{ce.get('height')} @{ce.get('fps')} {ce.get('video_codec')} {ce.get('color')}")
print(f"  uhd opt:   {ce.get('uhd_width')}x{ce.get('uhd_height')} @{ce.get('uhd_fps')}  (LIVE_DEMUX_CAST_UHD=1)")
print(f"  hdr:       cast_hdr={ce.get('hdr_cast')} panel={panel.get('hdr_typical')}")
print(f"  view:      {panel.get('viewing_angle_note','')[:100]}")
print(f"  lut:       {panel.get('lut_path','apply at encode')[:80]}")
err=p.get("error_handling",{})
print("  errors:")
for k,v in err.items():
    print(f"    · {k}: {v}")
layouts=p.get("layouts",{})
if layouts:
    print("  layouts:")
    for k,v in layouts.items():
        print(f"    · {k}: {v}")
sib=p.get("sibling_devices_lan") or []
if sib:
    print("  siblings on LAN:")
    for s in sib:
        print(f"    · {s.get('name')} · {s.get('model')} · {s.get('ip')}")
PY
    else
      cat "$PROFILE_JSON"
    fi
  else
    echo "warn: no profile at $PROFILE_JSON — using defaults ${W}x${H}@${FPS}"
  fi
  echo "  active encode: ${W}x${H} @ ${FPS}  serve ${BIND}:${PORT}"
  echo "  default device: $(resolve_device)"
  echo "  LAN IP: $(lan_ip)"
}

list_devices() {
  echo "==> Cast devices (Chromecast / Google TV)"
  if command -v catt >/dev/null 2>&1; then
    catt scan 2>/dev/null || catt scan
    echo ""
    echo "  tip: export LIVE_DEMUX_CAST_DEVICE='Smart TV'   # TCL primary"
    echo "       export LIVE_DEMUX_CAST_DEVICE='GoogleTV3065'  # Hisense sibling"
  else
    echo "  catt not installed — discovery limited"
    echo "  install:  pipx install catt   # or: brew install pipx && pipx install catt"
    echo ""
    echo "  Manual: Google Home app → device name → same Wi‑Fi as this Mac"
    echo "  Then:   LIVE_DEMUX_CAST_DEVICE='Smart TV' $0 url URL"
    if command -v dns-sd >/dev/null 2>&1; then
      echo ""
      echo "  dns-sd browse (3s)…"
      (dns-sd -B _googlecast._tcp local. 2>/dev/null & SP=$!; sleep 3; kill $SP 2>/dev/null) | head -20 || true
    fi
  fi
}

doctor() {
  echo "==> cast doctor"
  local ok=0
  if command -v ffmpeg >/dev/null 2>&1; then
    echo "  ✓ ffmpeg  $(ffmpeg -version 2>/dev/null | head -1)"
  else
    echo "  ✗ ffmpeg missing"; ok=1
  fi
  if command -v catt >/dev/null 2>&1; then
    echo "  ✓ catt    $(catt --version 2>/dev/null || echo present)  ($HOME/.local/bin)"
  else
    echo "  ✗ catt missing — pipx install catt"; ok=1
  fi
  if command -v python3 >/dev/null 2>&1; then
    echo "  ✓ python3"
  else
    echo "  ✗ python3 missing (HTTP serve)"; ok=1
  fi
  if [[ -f "$PROFILE_JSON" ]]; then
    echo "  ✓ profile $PROFILE_JSON"
  else
    echo "  ✗ profile missing $PROFILE_JSON"; ok=1
  fi
  local lip; lip="$(lan_ip)"
  if [[ "$lip" == "127.0.0.1" ]]; then
    echo "  ✗ LAN IP is 127.0.0.1 — TV cannot fetch media"; ok=1
  else
    echo "  ✓ LAN IP $lip (serve will use this, not localhost)"
  fi
  mkdir -p "$SERVE_DIR"
  echo "  · serve dir $SERVE_DIR"
  echo "  · default device: $(resolve_device)"
  if command -v catt >/dev/null 2>&1; then
    echo ""
    list_devices
  fi
  if [[ $ok -ne 0 ]]; then
    echo ""
    echo "doctor: fix ✗ items then re-run"
    return 1
  fi
  echo ""
  echo "doctor: ok — try: $0 profile · $0 desk · $0 mosaic"
  return 0
}

http_start() {
  need python3
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "http serve already up · pid $(cat "$PID_FILE") · http://$(lan_ip):${PORT}/"
    return 0
  fi
  # Bind 0.0.0.0 so TV can reach files — never advertise 127.0.0.1 to Cast
  (
    cd "$SERVE_DIR"
    nohup python3 -m http.server "$PORT" --bind "$BIND" >>"$LOG" 2>&1 &
    echo $! >"$PID_FILE"
  )
  sleep 0.3
  echo "http serve · pid $(cat "$PID_FILE") · base http://$(lan_ip):${PORT}/"
}

http_stop() {
  if [[ -f "$PID_FILE" ]]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
  echo "http serve stopped"
}

catt_cast() {
  local media="$1"
  local device
  device="$(resolve_device "${2:-}")"
  need catt
  echo "==> catt -d $(printf %q "$device") cast $media"
  # Unmute optional (TV was discovered muted on TCL)
  if [[ "${LIVE_DEMUX_CAST_UNMUTE:-1}" == "1" ]]; then
    catt -d "$device" volume 40 2>>"$LOG" || true
  fi
  # Longer connect: Google TV sometimes slow to start Default Media Receiver
  if ! catt -d "$device" cast "$media" 2>>"$LOG"; then
    echo "cast attempt 1 failed — retry once (wake receiver)…"
    sleep 2
    catt -d "$device" cast "$media"
  fi
}

cast_url() {
  local url="${1:-}"
  local device="${2:-}"
  [[ -n "$url" ]] || { echo "usage: $0 url URL [device]"; exit 2; }
  # TV cannot fetch localhost
  if [[ "$url" == *127.0.0.1* || "$url" == *localhost* ]]; then
    echo "error: URL must be reachable from the TV (not 127.0.0.1/localhost)"
    echo "  re-encode: $0 encode-url URL"
    exit 1
  fi
  if command -v catt >/dev/null 2>&1; then
    catt_cast "$url" "$device"
  else
    echo "catt missing — open this on the TV browser or install catt:"
    echo "  $url"
    echo "  pipx install catt"
    exit 1
  fi
}

vf_scale() {
  # shared scale + optional LUT
  if [[ -n "${LIVE_DEMUX_CAST_LUT:-}" && -f "${LIVE_DEMUX_CAST_LUT}" ]]; then
    echo "lut3d=${LIVE_DEMUX_CAST_LUT},scale=${W}:${H}:flags=lanczos,format=yuv420p,fps=${FPS}"
  else
    echo "scale=${W}:${H}:flags=lanczos,format=yuv420p,fps=${FPS}"
  fi
}

cast_file() {
  local f="${1:-}"
  local device="${2:-}"
  [[ -f "$f" ]] || { echo "usage: $0 file PATH [device]"; exit 2; }
  need ffmpeg
  http_start
  local base name out
  base="$(basename "$f")"
  name="${base%.*}"
  out="$SERVE_DIR/${name}-cast.mp4"
  echo "==> encode for TV · ${W}x${H}@${FPS} H.264 → $out"
  local vf
  vf="$(vf_scale)"
  ffmpeg -y -hide_banner -loglevel error -i "$f" \
    -vf "$vf" \
    -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -movflags +faststart \
    "$out"
  cast_media_file "$out" "$device"
}

encode_url() {
  local url="${1:-}"
  local device="${2:-}"
  [[ -n "$url" ]] || { echo "usage: $0 encode-url URL [device]"; exit 2; }
  need ffmpeg
  http_start
  local out="$SERVE_DIR/stream-cast.mp4"
  echo "==> pull + encode · ${W}x${H}@${FPS}"
  if command -v yt-dlp >/dev/null 2>&1; then
    local tmp="$SERVE_DIR/src-tmp.mp4"
    rm -f "$tmp"
    yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o "$tmp" "$url" 2>>"$LOG" \
      || yt-dlp -o "$tmp" "$url" 2>>"$LOG"
    cast_file "$tmp" "$device"
  else
    local vf
    vf="$(vf_scale)"
    ffmpeg -y -hide_banner -loglevel error -i "$url" \
      -vf "$vf" \
      -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
      -c:a aac -b:a 128k -movflags +faststart \
      -t 3600 \
      "$out" || { echo "encode failed — see $LOG"; exit 1; }
    cast_url "http://$(lan_ip):${PORT}/$(basename "$out")" "$device"
  fi
}

# Desk: side-by-side still layout from live.jpg (+ optional you still)
cast_desk() {
  local device="${1:-}"
  need ffmpeg
  local still="${LIVE_DEMUX_CAM_STILL:-$HOME/.panda/vision/live.jpg}"
  local you="${LIVE_DEMUX_CAST_YOU_STILL:-$HOME/.panda/vision/you.jpg}"
  http_start
  local out="$SERVE_DIR/desk-cast.mp4"
  if [[ ! -s "$still" ]]; then
    echo "error: no phone still at $still — open Continuity / still-pipe first"
    exit 1
  fi
  echo "==> desk layout encode (you | phone) → TV · device=$(resolve_device "$device")"
  local half_w=$((W / 2))
  if [[ -s "$you" ]]; then
    ffmpeg -y -hide_banner -loglevel error \
      -loop 1 -t 30 -i "$you" -loop 1 -t 30 -i "$still" \
      -filter_complex "[0:v]scale=${half_w}:${H}:force_original_aspect_ratio=decrease,pad=${half_w}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1[l];\
[1:v]scale=${half_w}:${H}:force_original_aspect_ratio=decrease,pad=${half_w}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1[r];\
[l][r]hstack=inputs=2,format=yuv420p,fps=${FPS}[v]" \
      -map "[v]" -an -c:v libx264 -preset veryfast -crf 20 -t 30 \
      -movflags +faststart "$out"
  else
    # Phone only full-bleed (no fake second cam)
    ffmpeg -y -hide_banner -loglevel error \
      -loop 1 -t 30 -i "$still" \
      -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=${FPS}" \
      -an -c:v libx264 -preset veryfast -crf 20 -t 30 -movflags +faststart "$out"
  fi
  cast_media_file "$out" "$device"
}

# Mosaic: 2×2 wall — you | phone / stream | lens
# (no drawtext — many ffmpeg builds lack libfreetype; placeholders are solid tiles)
cast_mosaic() {
  local device="${1:-}"
  need ffmpeg
  local still="${LIVE_DEMUX_CAM_STILL:-$HOME/.panda/vision/live.jpg}"
  local you="${LIVE_DEMUX_CAST_YOU_STILL:-$HOME/.panda/vision/you.jpg}"
  local stream_still="${LIVE_DEMUX_CAST_STREAM_STILL:-$HOME/.panda/vision/stream.jpg}"
  local lens_still="${LIVE_DEMUX_CAST_LENS_STILL:-$HOME/.panda/vision/lens.jpg}"
  http_start
  local out="$SERVE_DIR/mosaic-cast.mp4"
  local tw=$((W / 2))
  local th=$((H / 2))
  # Distinct placeholder colors if a tile is missing (YOU / PHONE / STREAM / LENS)
  local ph_colors=("0x442222" "0x224466" "0x223322" "0x332244")
  local paths=("$you" "$still" "$stream_still" "$lens_still")
  local inputs=()
  local i=0
  local fc=""

  echo "==> mosaic 2×2 wall · ${W}x${H}@${FPS} → TV"

  for i in 0 1 2 3; do
    local p="${paths[$i]}"
    if [[ -s "$p" ]]; then
      inputs+=(-loop 1 -t 30 -i "$p")
    else
      inputs+=(-f lavfi -t 30 -i "color=c=${ph_colors[$i]}:s=${tw}x${th}:r=${FPS}")
    fi
  done

  fc=""
  for i in 0 1 2 3; do
    local p="${paths[$i]}"
    if [[ -s "$p" ]]; then
      fc+="[${i}:v]scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2,setsar=1[t${i}];"
    else
      fc+="[${i}:v]scale=${tw}:${th},setsar=1[t${i}];"
    fi
  done
  fc+="[t0][t1][t2][t3]xstack=inputs=4:layout=0_0|${tw}_0|0_${th}|${tw}_${th},format=yuv420p,fps=${FPS}[v]"

  if ! ffmpeg -y -hide_banner -loglevel error \
    "${inputs[@]}" \
    -filter_complex "$fc" \
    -map "[v]" -an -c:v libx264 -preset veryfast -crf 20 -t 30 \
    -movflags +faststart "$out" 2>>"$LOG"; then
      echo "mosaic xstack failed — solid wall fallback (see $LOG)"
      ffmpeg -y -hide_banner -loglevel error \
        -f lavfi -t 30 -i "color=c=0x1a1a22:s=${W}x${H}:r=${FPS}" \
        -an -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -t 30 -movflags +faststart "$out"
  fi

  # Prefer catt local cast (it serves the file) then fall back to LAN HTTP URL
  cast_media_file "$out" "$device"
}

# Cast a local file: catt can host it; else encode already done → HTTP URL
cast_media_file() {
  local f="$1"
  local device
  device="$(resolve_device "${2:-}")"
  need catt
  echo "==> catt -d $(printf %q "$device") cast $f  (local file serve)"
  if [[ "${LIVE_DEMUX_CAST_UNMUTE:-1}" == "1" ]]; then
    catt -d "$device" volume 40 2>>"$LOG" || true
  fi
  if catt -d "$device" cast "$f" 2>>"$LOG"; then
    echo "cast ok · local file"
    return 0
  fi
  echo "local cast failed — trying LAN HTTP URL"
  http_start
  local base
  base="$(basename "$f")"
  # ensure file is under serve dir
  if [[ "$(cd "$(dirname "$f")" && pwd)" != "$(cd "$SERVE_DIR" && pwd)" ]]; then
    cp -f "$f" "$SERVE_DIR/$base"
  fi
  cast_url "http://$(lan_ip):${PORT}/$base" "$device"
}

cast_stop() {
  local device
  device="$(resolve_device "${1:-}")"
  if command -v catt >/dev/null 2>&1; then
    catt -d "$device" stop 2>/dev/null || true
    echo "cast stop requested · $device"
  else
    echo "catt not installed — stop from TV remote / Google Home"
  fi
}

ALIGN_DIR="$ROOT/scripts/live-demux/cast-align"
ALIGN_GEN="$ALIGN_DIR/gen-align.py"
ALIGN_HTML="$ALIGN_DIR/align-chart.html"
ALIGN_HUB="$ALIGN_DIR/align-hub.py"
HUB_PID_FILE="${SERVE_DIR}/align-hub.pid"

align_flags_parse() {
  # sets: ALIGN_COLS ALIGN_ROWS ALIGN_LABELS ALIGN_SELECT ALIGN_DEVICE
  ALIGN_COLS="${LIVE_DEMUX_CAST_ALIGN_COLS:-8}"
  ALIGN_ROWS="${LIVE_DEMUX_CAST_ALIGN_ROWS:-4}"
  ALIGN_LABELS="${LIVE_DEMUX_CAST_ALIGN_LABELS:-number}"
  ALIGN_SELECT="${LIVE_DEMUX_CAST_ALIGN_SELECT:-}"
  ALIGN_DEVICE=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --cols) ALIGN_COLS="$2"; shift 2 ;;
      --rows) ALIGN_ROWS="$2"; shift 2 ;;
      --labels) ALIGN_LABELS="$2"; shift 2 ;;
      --select|-s) ALIGN_SELECT="$2"; shift 2 ;;
      --w) W="$2"; shift 2 ;;
      --h) H="$2"; shift 2 ;;
      --no-cast) LIVE_DEMUX_CAST_ALIGN_NO_CAST=1; shift ;;
      --mp4) LIVE_DEMUX_CAST_ALIGN_FORCE_MP4=1; shift ;;
      --) shift; break ;;
      -*)
        echo "unknown align flag: $1"
        exit 2
        ;;
      *)
        ALIGN_DEVICE="$1"; shift
        break
        ;;
    esac
  done
  if [[ $# -gt 0 && -z "$ALIGN_DEVICE" ]]; then ALIGN_DEVICE="$1"; fi
}

# Start interactive align-hub (replaces static python -m http.server for align)
hub_start() {
  need python3
  [[ -f "$ALIGN_HUB" ]] || { echo "error: missing $ALIGN_HUB"; exit 1; }
  # stop plain static server if it owns the port — hub needs /api/*
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    http_stop
  fi
  if [[ -f "$HUB_PID_FILE" ]] && kill -0 "$(cat "$HUB_PID_FILE")" 2>/dev/null; then
    echo "align-hub already up · pid $(cat "$HUB_PID_FILE") · http://$(lan_ip):${PORT}/"
    return 0
  fi
  mkdir -p "$SERVE_DIR"
  (
    cd "$ALIGN_DIR"
    nohup python3 "$ALIGN_HUB" --bind "$BIND" --port "$PORT" >>"$LOG" 2>&1 &
    echo $! >"$HUB_PID_FILE"
  )
  sleep 0.4
  if ! kill -0 "$(cat "$HUB_PID_FILE")" 2>/dev/null; then
    echo "error: align-hub failed to start — see $LOG"
    return 1
  fi
  echo "align-hub · pid $(cat "$HUB_PID_FILE") · http://$(lan_ip):${PORT}/"
}

hub_stop() {
  if [[ -f "$HUB_PID_FILE" ]]; then
    kill "$(cat "$HUB_PID_FILE")" 2>/dev/null || true
    rm -f "$HUB_PID_FILE"
  fi
  echo "align-hub stopped"
}

# Seed hub selection state before cast
hub_seed_state() {
  local cols="$1" rows="$2" labels="$3" select="$4"
  need python3
  python3 - "$PORT" "$W" "$H" "$cols" "$rows" "$labels" "$select" <<'PY'
import json, os, sys, urllib.request
port, w, h, cols, rows, labels, select = sys.argv[1:8]
# parse select like gen-align
sel = []
import re
cols, rows = int(cols), int(rows)
for part in re.split(r"[\s,;]+", select or ""):
    if not part: continue
    m = re.fullmatch(r"(\d+)-(\d+)", part)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        sel.extend(range(min(a,b), max(a,b)+1)); continue
    m = re.fullmatch(r"([A-Za-z]+)(\d+)", part)
    if m:
        col = 0
        for ch in m.group(1).upper():
            col = col * 26 + (ord(ch) - 64)
        col -= 1
        r = int(m.group(2)) - 1
        if 0 <= col < cols and 0 <= r < rows:
            sel.append(r * cols + col + 1)
        continue
    if part.isdigit():
        sel.append(int(part))
sel = sorted(set(n for n in sel if 1 <= n <= cols * rows))
payload = {
    "w": int(w), "h": int(h), "cols": cols, "rows": rows,
    "labels": labels, "safe": 5, "selected": sel, "focus": sel[0] if sel else 1,
    "title": "CAST ALIGN · interactive", "controller": "seed",
}
req = urllib.request.Request(
    f"http://127.0.0.1:{port}/api/state",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=3) as r:
        print("hub state seeded · selected", sel or "[]")
except Exception as e:
    print("warn: hub seed failed:", e, file=sys.stderr)
PY
}

# DEFAULT align path: interactive HTML surface via cast_site (NOT mp4)
cast_align() {
  need python3
  align_flags_parse "$@"
  local cols="$ALIGN_COLS" rows="$ALIGN_ROWS" labels="$ALIGN_LABELS" select="$ALIGN_SELECT"
  local device="$ALIGN_DEVICE"

  if [[ "${LIVE_DEMUX_CAST_ALIGN_FORCE_MP4:-0}" == "1" ]]; then
    cast_align_mp4 "$@"
    return
  fi

  echo "==> align INTERACTIVE surface · ${W}x${H}  ${cols}×${rows}"
  [[ -n "$select" ]] && echo "    select: $select"
  hub_start || exit 1
  hub_seed_state "$cols" "$rows" "$labels" "$select"

  # also write layout JSON for tile plane
  if [[ -f "$ALIGN_GEN" ]]; then
    python3 "$ALIGN_GEN" \
      --w "$W" --h "$H" --cols "$cols" --rows "$rows" \
      --labels "$labels" --select "$select" \
      -o "$SERVE_DIR" --name align-chart 2>>"$LOG" || true
  fi

  local lan url tv_url ctrl_url
  lan="$(lan_ip)"
  url="http://${lan}:${PORT}/"
  tv_url="http://${lan}:${PORT}/?tv=1&w=${W}&h=${H}&cols=${cols}&rows=${rows}"
  ctrl_url="http://${lan}:${PORT}/?control=1&w=${W}&h=${H}&cols=${cols}&rows=${rows}"
  echo "  phone/control: $ctrl_url"
  echo "  TV surface:    $tv_url"
  echo "  refs: SuperMap · Parallel Stereo · SHELLS (in control chrome)"

  if [[ "${LIVE_DEMUX_CAST_ALIGN_NO_CAST:-0}" == "1" ]]; then
    echo "skip cast (--no-cast) · hub still serving"
    return 0
  fi

  need catt
  device="$(resolve_device "$device")"
  # stop previous media receiver / mp4
  catt -d "$device" stop 2>>"$LOG" || true
  sleep 0.5
  echo "==> catt cast_site (interactive HTML, not MP4) → $device"
  echo "    $tv_url"
  if catt -d "$device" cast_site "$tv_url" 2>>"$LOG"; then
    echo "cast_site ok · interactive align on TV — snap when ready"
  else
    echo "cast_site failed — open on TV browser:"
    echo "  $tv_url"
    echo "  log: $LOG"
    return 1
  fi
  if [[ "${LIVE_DEMUX_CAST_ALIGN_BROWSER:-1}" == "1" ]] && command -v open >/dev/null 2>&1; then
    open "$ctrl_url" 2>/dev/null || true
  fi
}

# Legacy static MP4 chart (fallback only)
cast_align_mp4() {
  need python3
  need ffmpeg
  [[ -f "$ALIGN_GEN" ]] || { echo "error: missing $ALIGN_GEN"; exit 1; }
  align_flags_parse "$@"
  local cols="$ALIGN_COLS" rows="$ALIGN_ROWS" labels="$ALIGN_LABELS" select="$ALIGN_SELECT"
  local device="$ALIGN_DEVICE"
  echo "==> align MP4 (legacy) · ${W}x${H}  ${cols}×${rows}"
  python3 "$ALIGN_GEN" \
    --w "$W" --h "$H" --cols "$cols" --rows "$rows" \
    --labels "$labels" --select "$select" \
    --mp4 -o "$SERVE_DIR" --name align-chart
  if [[ "${LIVE_DEMUX_CAST_ALIGN_NO_CAST:-0}" == "1" ]]; then
    echo "skip cast"; return 0
  fi
  cast_media_file "$SERVE_DIR/align-chart.mp4" "$device"
}

# Hub + optional cast_site (alias of interactive align with browser)
cast_align_ui() {
  LIVE_DEMUX_CAST_ALIGN_BROWSER="${LIVE_DEMUX_CAST_ALIGN_BROWSER:-1}"
  cast_align "$@"
}

case "$CMD" in
  list|ls|scan) list_devices ;;
  profile|spec|tv|tcl) print_profile ;;
  doctor|check) doctor ;;
  status)
    print_profile
    echo ""
    list_devices
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "http: UP  http://$(lan_ip):${PORT}/"
    else
      echo "http: DOWN"
    fi
    ;;
  url) cast_url "${1:-}" "${2:-}" ;;
  file) cast_file "${1:-}" "${2:-}" ;;
  hls)
    f="${1:-}"
    [[ -f "$f" ]] || { echo "usage: $0 hls PATH.m3u8 [device]"; exit 2; }
    http_start
    cp -f "$f" "$SERVE_DIR/" 2>/dev/null || true
    cast_url "http://$(lan_ip):${PORT}/$(basename "$f")" "${2:-}"
    ;;
  encode-url|encode) encode_url "${1:-}" "${2:-}" ;;
  desk) cast_desk "${1:-}" ;;
  mosaic|wall) cast_mosaic "${1:-}" ;;
  align|chart|grid)
    # interactive HTML surface (cast_site) — not MP4
    cast_align "$@"
    ;;
  align-mp4|chart-mp4)
    cast_align_mp4 "$@"
    ;;
  align-ui|chart-ui|align-serve)
    cast_align_ui "$@"
    ;;
  hub|align-hub)
    hub_start
    echo "  control http://$(lan_ip):${PORT}/?control=1"
    echo "  tv      http://$(lan_ip):${PORT}/?tv=1"
    echo "  parallax phone  http://$(lan_ip):${PORT}/parallax"
    echo "  parallax TV     http://$(lan_ip):${PORT}/parallax?tv=1"
    ;;
  parallax|window|infinite)
    # phone-driven infinite window (lightfield-lite parallax)
    hub_start || exit 1
    lan="$(lan_ip)"
    phone_url="http://${lan}:${PORT}/parallax"
    tv_url="http://${lan}:${PORT}/parallax?tv=1"
    echo "==> infinite window / parallax surface"
    echo "  phone (gyro/drag): $phone_url"
    echo "  TV surface:        $tv_url"
    if [[ "${LIVE_DEMUX_CAST_ALIGN_NO_CAST:-0}" != "1" ]] && command -v catt >/dev/null 2>&1; then
      device="$(resolve_device "${1:-}")"
      catt -d "$device" stop 2>>"$LOG" || true
      sleep 0.4
      echo "==> catt cast_site → $device"
      if catt -d "$device" cast_site "$tv_url" 2>>"$LOG"; then
        echo "cast_site ok · open phone URL and Enable phone gyro"
      else
        echo "cast_site failed — open TV browser: $tv_url"
      fi
    fi
    if [[ "${LIVE_DEMUX_CAST_ALIGN_BROWSER:-1}" == "1" ]] && command -v open >/dev/null 2>&1; then
      open "$phone_url" 2>/dev/null || true
    fi
    ;;
  gpu|gpu-env|webgl|gpu-test)
    # WebGL living environment — TV stream GPU test (no cam-relay)
    hub_start || exit 1
    lan="$(lan_ip)"
    # Grok Imagine promo feel by default (mode=4); override LIVE_DEMUX_GPU_MODE / _Q
    GPU_MODE="${LIVE_DEMUX_GPU_MODE:-4}"
    GPU_Q="${LIVE_DEMUX_GPU_Q:-1}"
    phone_url="http://${lan}:${PORT}/gpu?mode=${GPU_MODE}&q=${GPU_Q}&promo=1"
    tv_url="http://${lan}:${PORT}/gpu?tv=1&mode=${GPU_MODE}&q=${GPU_Q}&promo=1"
    echo "==> GPU ENV · Grok Imagine promo / impossible looks"
    echo "  phone:  $phone_url"
    echo "  TV:     $tv_url"
    echo "  modes:  4=imagine · 0=planet · 1=portal · 2=forest · 3=tunnel"
    echo "  no cam-relay (GPU-only stream test)"
    python3 - "$PORT" <<'PY' 2>/dev/null || true
import json, urllib.request, sys
port = sys.argv[1]
payload = {"surface": "gpu-env", "variation": "grok-imagine"}
req = urllib.request.Request(
  f"http://127.0.0.1:{port}/api/state",
  data=json.dumps(payload).encode(),
  headers={"Content-Type": "application/json"},
  method="POST",
)
urllib.request.urlopen(req, timeout=2).read()
print("  surface=gpu-env · grok-imagine seeded")
PY
    if [[ "${LIVE_DEMUX_CAST_ALIGN_NO_CAST:-0}" != "1" ]] && command -v catt >/dev/null 2>&1; then
      device="$(resolve_device "${1:-}")"
      catt -d "$device" stop 2>>"$LOG" || true
      sleep 0.4
      echo "==> catt cast_site → $device"
      if catt -d "$device" cast_site "$tv_url" 2>>"$LOG"; then
        echo "cast_site ok · Imagine promo on TV"
      else
        echo "cast_site failed — open: $tv_url"
      fi
    fi
    if [[ "${LIVE_DEMUX_CAST_ALIGN_BROWSER:-1}" == "1" ]] && command -v open >/dev/null 2>&1; then
      open "$phone_url" 2>/dev/null || true
    fi
    ;;
  box|depth|gmunk)
    # BOX-style: full grid + depth cube + forest plate + center video loop + cams + phone track
    hub_start || exit 1
    # start camera relay unless disabled (default OFF if LIVE_DEMUX_BOX_CAMS unset after spool thrash)
    if [[ "${LIVE_DEMUX_BOX_CAMS:-0}" == "1" ]]; then
      RELAY="$ROOT/scripts/live-demux/cam-relay.sh"
      if [[ -f "$RELAY" ]]; then
        bash "$RELAY" start 2>>"$LOG" || bash "$RELAY" start 0 1 2>>"$LOG" || true
        echo "  cams: relay started (see cam-relay.sh status)"
      fi
    else
      echo "  cams: skipped (LIVE_DEMUX_BOX_CAMS=0 · no spool thrash)"
    fi
    lan="$(lan_ip)"
    media="${LIVE_DEMUX_BOX_MEDIA:-/media/zane-center.mp4}"
    phone_url="http://${lan}:${PORT}/box"
    tv_url="http://${lan}:${PORT}/box?tv=1&src=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$media''', safe='/'))")"
    echo "==> BOX · grid · depth cube · center loop · user cams"
    echo "  media:  $media"
    echo "  phone:  $phone_url   (Phone gyro · Phone cam → TV · Enable cams)"
    echo "  TV:     $tv_url"
    echo "  cam stills: ~/.panda/vision/cast/media/cams/cam*.jpg"
    if [[ ! -f "$HOME/.panda/vision/cast/media/zane-center.mp4" && "$media" == *zane-center* ]]; then
      echo "warn: missing ~/.panda/vision/cast/media/zane-center.mp4"
      echo "  yt-dlp --cookies-from-browser safari -o ~/.panda/vision/cast/media/zane-center.mp4 'https://x.com/zanelowe/status/…'"
    fi
    # seed default cam_map on hub
    python3 - "$PORT" <<'PY' 2>/dev/null || true
import json, urllib.request, sys
port = sys.argv[1]
payload = {
  "surface": "box",
  "cam_map": {"1": "cam0", "8": "cam1", "25": "phone"},
}
req = urllib.request.Request(
  f"http://127.0.0.1:{port}/api/state",
  data=json.dumps(payload).encode(),
  headers={"Content-Type": "application/json"},
  method="POST",
)
urllib.request.urlopen(req, timeout=2).read()
print("  cam_map seeded · cell1=cam0 cell8=cam1 cell25=phone")
PY
    if [[ "${LIVE_DEMUX_CAST_ALIGN_NO_CAST:-0}" != "1" ]] && command -v catt >/dev/null 2>&1; then
      device="$(resolve_device "${1:-}")"
      catt -d "$device" stop 2>>"$LOG" || true
      sleep 0.4
      echo "==> catt cast_site → $device"
      if catt -d "$device" cast_site "$tv_url" 2>>"$LOG"; then
        echo "cast_site ok · BOX + cams on TV"
      else
        echo "cast_site failed — open: $tv_url"
      fi
    fi
    if [[ "${LIVE_DEMUX_CAST_ALIGN_BROWSER:-1}" == "1" ]] && command -v open >/dev/null 2>&1; then
      open "$phone_url" 2>/dev/null || true
    fi
    ;;
  cams|cam-relay)
    bash "$ROOT/scripts/live-demux/cam-relay.sh" "${1:-status}" ${2:+"$2"} ${3:+"$3"} ${4:+"$4"}
    ;;
  news|news-wall|livenews)
    # Low-latency news wall for DashCast + audio mix strip
    hub_start || exit 1
    lan="$(lan_ip)"
    phone_url="http://${lan}:${PORT}/news"
    tv_url="http://${lan}:${PORT}/news?tv=1"
    echo "==> NEWS WALL · multi-feed · waveform EQ · ducking"
    echo "  phone:  $phone_url"
    echo "  TV:     $tv_url"
    echo "  pipe:   ~/.panda/packs/cast-status.jsonl  (maptrace)"
    echo "  catalog: scripts/live-demux/cast-align/news-catalog.json"
    if [[ "${LIVE_DEMUX_CAST_ALIGN_NO_CAST:-0}" != "1" ]] && command -v catt >/dev/null 2>&1; then
      device="$(resolve_device "${1:-}")"
      catt -d "$device" stop 2>>"$LOG" || true
      sleep 0.35
      if catt -d "$device" cast_site "$tv_url" 2>>"$LOG"; then
        echo "cast_site ok · news wall on TV"
      else
        echo "cast_site failed — open $tv_url"
      fi
    fi
    if [[ "${LIVE_DEMUX_CAST_ALIGN_BROWSER:-1}" == "1" ]] && command -v open >/dev/null 2>&1; then
      open "$phone_url" 2>/dev/null || true
    fi
    ;;
  hub-stop|align-hub-stop) hub_stop ;;
  serve|http) http_start ;;
  serve-stop|http-stop) http_stop; hub_stop 2>/dev/null || true ;;
  stop) cast_stop "${1:-}" ;;
  help|-h|--help)
    sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "unknown: $CMD  (list|profile|doctor|url|file|encode-url|desk|mosaic|align|align-mp4|align-ui|hub|stop|status)"
    exit 2
    ;;
esac
