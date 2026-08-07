#!/usr/bin/env bash
# Mac Mini · layered optical rebroadcast test
#
#   bash scripts/live-demux/optical-transfer/mini-layered-test.sh bloomberg
#   bash scripts/live-demux/optical-transfer/mini-layered-test.sh bloomberg --seconds 45
#   bash scripts/live-demux/optical-transfer/mini-layered-test.sh bloomberg --no-ffplay --decimen
#   bash …/mini-layered-test.sh stop
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
DIR="${LIVE_DEMUX_OPTICAL_DIR:-$HOME/.panda/vision/cast}"
VENV="$ROOT/.venv"
PY="${VENV}/bin/python"
CHANNEL="${1:-bloomberg}"
shift || true
RUN_SECS=45
FFPLAY_FLAG=()
START_DECIMEN=0
NO_LAYERED=0

for a in "$@"; do
  case "$a" in
    --seconds=*) RUN_SECS="${a#*=}" ;;
    --seconds) RUN_SECS=45 ;;
    --no-ffplay) FFPLAY_FLAG+=(--no-ffplay) ;;
    --decimen) START_DECIMEN=1 ;;
    --no-layered) NO_LAYERED=1 ;;
    stop|kill)
      bash "$ROOT/mix-pipe.sh" stop || true
      pkill -f "layered_fuzz.py" 2>/dev/null || true
      echo "stopped"
      exit 0
      ;;
  esac
done

mkdir -p "$DIR"
echo "==> mini-layered-test · channel=$CHANNEL · ${RUN_SECS}s"
echo "    host: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || uname -m)"
echo "    dir:  $DIR"

# venv
if [[ ! -x "$PY" ]]; then
  echo "==> creating venv + numpy/opencv"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q numpy opencv-python-headless
fi
"$PY" -c "import numpy,cv2; print('    vision:', numpy.__version__, cv2.__version__)"

# SAM hook for mix-pipe
export MIX_SAM_CMD="$PY $ROOT/sam_lite.py"
export MIX_MASK_EVERY="${MIX_MASK_EVERY:-6}"
export PATH="${HOME}/.local/bin:/opt/homebrew/bin:$PATH"

# whitespace matrix snapshot
echo "==> whitespace stego budget"
"$PY" "$ROOT/whitespace_steno.py" budget | tee "$DIR/whitespace-budget.json" | head -40
"$PY" "$ROOT/whitespace_steno.py" matrix | tee "$DIR/whitespace-matrix.md" >/dev/null
echo "    wrote $DIR/whitespace-matrix.md"

# mix-pipe bloomberg
echo "==> mix-pipe $CHANNEL"
bash "$ROOT/mix-pipe.sh" stop 2>/dev/null || true
bash "$ROOT/mix-pipe.sh" "$CHANNEL" "${FFPLAY_FLAG[@]+"${FFPLAY_FLAG[@]}"}" || {
  echo "mix-pipe failed — try YTDLP_COOKIES_FROM_BROWSER=safari"
  exit 2
}

# wait mask
echo "==> waiting for mask…"
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8790/mask.png" -o "$DIR/mix-mask-check.png" 2>/dev/null; then
    break
  fi
  # force sam_lite once
  export MIX_SNAP="$DIR/mix-latest.jpg"
  export MIX_MASK="$DIR/mix-mask.png"
  if [[ -f "$MIX_SNAP" ]]; then
    $MIX_SAM_CMD || true
  fi
  sleep 0.5
done
curl -s "http://127.0.0.1:8790/status.json" | tee "$DIR/mix-status-sample.json" || true
echo

if [[ "$NO_LAYERED" -eq 0 ]]; then
  echo "==> layered_fuzz compositor :8791"
  pkill -f "layered_fuzz.py" 2>/dev/null || true
  nohup "$PY" "$ROOT/layered_fuzz.py" \
    --payload "fc-alt-media-$CHANNEL-$(date -u +%H%M%S)" \
    --seconds "$RUN_SECS" \
    --port 8791 \
    >>"$DIR/layered_fuzz.log" 2>&1 &
  echo $! >"$DIR/layered_fuzz.pid"
  sleep 2
  echo "    preview: http://127.0.0.1:8791/preview.mjpg"
  echo "    budget:  http://127.0.0.1:8791/budget.json"
  # open preview if GUI
  if [[ -n "${DISPLAY:-}" || "$(uname)" == Darwin ]]; then
    open "http://127.0.0.1:8791/preview.mjpg" 2>/dev/null || true
  fi
fi

if [[ "$START_DECIMEN" -eq 1 ]]; then
  echo "==> Decimen (optional)"
  bash "$ROOT/decimen.sh" build 2>/dev/null || true
  echo "    run in another terminal: bash $ROOT/decimen.sh dev"
  echo "    then open https://127.0.0.1:5173/send/?mix=watch"
fi

echo "==> collecting ${RUN_SECS}s samples…"
for i in $(seq 1 "$RUN_SECS"); do
  if (( i % 5 == 0 )); then
    curl -s "http://127.0.0.1:8791/budget.json" 2>/dev/null | head -c 400 || true
    echo
  fi
  sleep 1
done

# final report
echo "==> FINAL REPORT"
{
  echo "# Layered optical Mini test · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Host"
  echo "- $(sysctl -n machdep.cpu.brand_string 2>/dev/null || true)"
  echo "- channel: $CHANNEL"
  echo
  echo "## mix-pipe"
  cat "$DIR/mix-status-sample.json" 2>/dev/null || true
  echo
  echo "## layered budget"
  cat "$DIR/layered-budget.json" 2>/dev/null || curl -s http://127.0.0.1:8791/budget.json || true
  echo
  echo "## whitespace (prompt practical)"
  "$PY" -c "import json;d=json.load(open('$DIR/whitespace-budget.json'));print(json.dumps(d.get('recommendation',d),indent=2))"
  echo
  echo "## docs"
  echo "- docs/fornever-ledger/LAYERED-OPTICAL-REBROADCAST.md"
  echo "- $DIR/whitespace-matrix.md"
} | tee "$DIR/LAYERED-TEST-REPORT.md"

echo
echo "done · report $DIR/LAYERED-TEST-REPORT.md"
echo "  ffplay: human bloomberg window"
echo "  layered preview: http://127.0.0.1:8791/preview.mjpg"
echo "  stop: bash $ROOT/mini-layered-test.sh stop"
