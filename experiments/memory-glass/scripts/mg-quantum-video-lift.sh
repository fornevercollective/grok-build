#!/usr/bin/env bash
# Memory Glass · Quantum video lift (Colossus / Dojo / yt-dlp / ffmpeg / ffplay)
#
# Fast path: resolve stream → probe → optional hwaccel decode path → ffplay
# Qbit lift: emit session JSON with multiplex targets (rubik / bloch / glyph dense)
#
# Usage:
#   bash scripts/mg-quantum-video-lift.sh tools
#   bash scripts/mg-quantum-video-lift.sh lift  "https://youtube.com/..."
#   bash scripts/mg-quantum-video-lift.sh probe "URL"
#   bash scripts/mg-quantum-video-lift.sh ytdlp "URL"
#   bash scripts/mg-quantum-video-lift.sh ffplay "URL"
#   bash scripts/mg-quantum-video-lift.sh pipe  "URL"   # ffmpeg nullsink stress (no UI)
#
# Env:
#   MG_VIDEO_OUT   default ~/.panda/mg-soak/video-feed
#   MG_HWACCEL     auto|videotoolbox|none  (macOS: videotoolbox)
#   MG_LIFT_MUX    comma list: rubik,bloch,glyph_dense,tensor_lane
set -euo pipefail

OP="${1:-tools}"
URL="${2:-}"
OUT_DIR="${MG_VIDEO_OUT:-$HOME/.panda/mg-soak/video-feed}"
mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/quantum-lift.log"
LIFT_JSON="$OUT_DIR/last-lift.json"
MUX="${MG_LIFT_MUX:-rubik,bloch,glyph_dense,tensor_lane}"
HW="${MG_HWACCEL:-auto}"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$LOG"; }
have() { command -v "$1" >/dev/null 2>&1; }

# Prefer hardware decode on Apple Silicon for "fastest" path
hw_flags() {
  if [[ "$HW" == "none" ]]; then
    echo ""
    return
  fi
  if [[ "$HW" == "videotoolbox" ]] || [[ "$HW" == "auto" && "$(uname -s)" == "Darwin" ]]; then
    # ffplay/ffmpeg videotoolbox when available
    echo "-hwaccel videotoolbox"
  else
    echo ""
  fi
}

resolve_stream() {
  local u="$1"
  if have yt-dlp; then
    # Prefer progressive single-file or merged mp4 (avoids stripe/noise from
    # raw fragment / audio-only / broken DASH demux in ffplay).
    # 1) best progressive ≤720  2) mp4 video+audio  3) generic best
    yt-dlp -g -f \
      "b[ext=mp4][height<=720]/best[ext=mp4][height<=720]/bv*[height<=720]+ba/b/best" \
      --no-playlist --no-warnings "$u" 2>/dev/null | head -1 || true
  fi
}

write_lift_meta() {
  local target="$1"
  local op="$2"
  cat >"$LIFT_JSON" <<JSON
{
  "schema": "fc-quantum-video-lift-v1",
  "t": $(date +%s)000,
  "op": "$op",
  "url": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$URL"),
  "resolved": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$target"),
  "tools": {
    "ytdlp": $(have yt-dlp && echo true || echo false),
    "ffmpeg": $(have ffmpeg && echo true || echo false),
    "ffplay": $(have ffplay && echo true || echo false),
    "ffprobe": $(have ffprobe && echo true || echo false)
  },
  "hwaccel": "$HW",
  "multiplex": $(python3 -c 'import json,os; print(json.dumps(os.environ.get("MG_LIFT_MUX","rubik,bloch,glyph_dense,tensor_lane").split(",")))'),
  "qbit_lift": true,
  "seats": {
    "rubik": "ugrad-rubik-lang",
    "bloch": "bloch-solve-bus / qbit waveform",
    "glyph_dense": "ugrad-glyph-dense",
    "tensor_lane": "ugrad-tensor-lane"
  },
  "honesty": {
    "one_hot_path": "race XOR dense peel",
    "not_arc_score": true,
    "plain_video_lifted": "tags/metadata + BC envelope; not full DINOv3 weights"
  },
  "cmd_note": "Colossus/Dojo: keep decode on HW path; peel agent owns dense map seat separately"
}
JSON
  log "lift meta → $LIFT_JSON"
  # optional: copy qbit-ish envelope for agents
  if [[ -f "$OUT_DIR/last-probe.txt" ]]; then
    {
      echo "n: quantum-video-lift"
      echo "0: op $op"
      echo "+3: mux $MUX"
      echo "+1: $(head -3 "$OUT_DIR/last-probe.txt" | tr '\n' ' ' | cut -c1-200)"
    } >"$OUT_DIR/last-lift.qbit.txt"
  fi
}

case "$OP" in
  tools)
    echo "yt-dlp=$(have yt-dlp && echo yes || echo no)"
    echo "ffmpeg=$(have ffmpeg && echo yes || echo no)"
    echo "ffplay=$(have ffplay && echo yes || echo no)"
    echo "ffprobe=$(have ffprobe && echo yes || echo no)"
    echo "hwaccel=$HW"
    echo "out=$OUT_DIR"
    ;;
  ytdlp)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    have yt-dlp || { log "brew install yt-dlp"; exit 1; }
    log "ytdlp -F $URL"
    yt-dlp -F --no-playlist "$URL" 2>&1 | tee "$OUT_DIR/last-ytdlp.txt" | tail -40
    yt-dlp -g -f "bv*+ba/b" --no-playlist "$URL" 2>&1 | head -3 | tee "$OUT_DIR/last-stream-url.txt"
    ;;
  probe)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    have ffprobe || { log "brew install ffmpeg"; exit 1; }
    STREAM=$(resolve_stream "$URL" || true)
    TARGET="${STREAM:-$URL}"
    log "probe $TARGET"
    # shellcheck disable=SC2046
    ffprobe -hide_banner $(hw_flags) -show_format -show_streams "$TARGET" 2>&1 \
      | tee "$OUT_DIR/last-probe.txt" | tail -50
    write_lift_meta "$TARGET" "probe"
    ;;
  ffplay|lift)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    have ffplay || { log "brew install ffmpeg"; exit 1; }
    STREAM=$(resolve_stream "$URL" || true)
    TARGET="${STREAM:-$URL}"
    write_lift_meta "$TARGET" "lift"
    log "ffplay quantum-lift $TARGET"
    # genpts+discardcorrupt reduces vertical stripe garbage from bad packets
    # shellcheck disable=SC2046
    (
      ffplay -loglevel warning -window_title "MG Quantum Lift" \
        -fflags "+genpts+nobuffer+discardcorrupt" -flags low_delay -framedrop \
        -sync video \
        $(hw_flags) \
        -autoexit "$TARGET" >>"$LOG" 2>&1
    ) &
    echo "ok ffplay launched · lift meta $LIFT_JSON"
    echo "multiplex seats: $MUX"
    # paper keynote :8790 · MG PWA :8787 · Soft Path owns :8765
    ARENA="${LIVE_DEMUX_GLYPH_ARENA:-http://127.0.0.1:8790/ugrad-arena.html?mode=glyph}"
    echo "open arena glyph: $ARENA"
    echo "note: pure stripe field = demux fail / audio-only — not optical BER"
    ;;
  pipe)
    # Headless stress: decode as fast as possible to null (Dojo-style throughput)
    [[ -n "$URL" ]] || { echo "URL required"; exit 2; }
    have ffmpeg || { log "brew install ffmpeg"; exit 1; }
    STREAM=$(resolve_stream "$URL" || true)
    TARGET="${STREAM:-$URL}"
    write_lift_meta "$TARGET" "pipe"
    log "ffmpeg null pipe $TARGET"
    # shellcheck disable=SC2046
    ffmpeg -hide_banner -y $(hw_flags) -i "$TARGET" -f null - 2>&1 \
      | tee "$OUT_DIR/last-pipe.txt" | tail -20
    ;;
  *)
    echo "usage: $0 tools|lift|ffplay|probe|ytdlp|pipe [URL]"
    exit 2
    ;;
esac
