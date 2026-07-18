#!/usr/bin/env bash
# Launch Memory Glass WebGrid play sized to the laptop's primary landscape display.
# Default: large → 30×30 on main QHD (e.g. 2560×1440). Use --small for 12×12.
#
# Usage:
#   bash scripts/launch-webgrid-laptop.sh
#   bash scripts/launch-webgrid-laptop.sh --small --rounds 2
#   bash scripts/launch-webgrid-laptop.sh --rounds 3 --local-llm
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${MG_APP:-$HOME/Applications/Memory Glass.app}"
[[ -d "$APP" ]] || APP="$ROOT/Memory Glass.app"
[[ -d "$APP" ]] || { echo "Memory Glass.app not found"; exit 1; }

SCALE=large   # large=30×30 · small=12×12
ROUNDS=2
LOCAL_LLM=0
EXTRA_W=""
EXTRA_H=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --small|-s) SCALE=small; shift ;;
    --large|-l) SCALE=large; shift ;;
    --rounds|-r) ROUNDS="${2:-2}"; shift 2 ;;
    --local-llm) LOCAL_LLM=1; shift ;;
    --w) EXTRA_W="${2:-}"; shift 2 ;;
    --h) EXTRA_H="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

# Detect primary display logical size (macOS system_profiler / displays)
detect_main() {
  python3 - <<'PY'
import re, subprocess
out = subprocess.check_output(["system_profiler", "SPDisplaysDataType"], text=True, errors="replace")
blocks = re.split(r"\n(?=\s{8}\S)", out)
main = None
for b in blocks:
    if "Main Display: Yes" in b:
        m = re.search(r"Resolution:\s*(\d+)\s*x\s*(\d+)", b)
        if m:
            main = (int(m.group(1)), int(m.group(2)))
            break
if not main:
    # first landscape resolution
    for m in re.finditer(r"Resolution:\s*(\d+)\s*x\s*(\d+)", out):
        w, h = int(m.group(1)), int(m.group(2))
        if w >= h:
            main = (w, h)
            break
if main:
    print(f"{main[0]} {main[1]}")
else:
    print("2560 1440")
PY
}

read -r DISP_W DISP_H <<<"$(detect_main)"
echo "==> primary display ${DISP_W}x${DISP_H}"

# Logical window target: nearly full main display for large; compact for small
if [[ "$SCALE" == "small" ]]; then
  W="${EXTRA_W:-720}"
  H="${EXTRA_H:-560}"
  URL="https://neuralink.com/webgrid/?mg_scale=small&mg_autoplay=${ROUNDS}&mg_display=${DISP_W}x${DISP_H}"
  export MG_WEBGRID_SCALE=small
else
  # leave chrome margins; place_for_webgrid_play will also size from monitor
  W="${EXTRA_W:-$(( DISP_W > 100 ? DISP_W - 48 : 2400 ))}"
  H="${EXTRA_H:-$(( DISP_H > 100 ? DISP_H - 80 : 1350 ))}"
  # clamp sanity
  [[ "$W" -lt 1280 ]] && W=1280
  [[ "$H" -lt 780 ]] && H=780
  URL="https://neuralink.com/webgrid/?mg_autoplay=${ROUNDS}&mg_display=${DISP_W}x${DISP_H}"
  export MG_WEBGRID_SCALE=large
  unset MG_WEBGRID_SMALL || true
fi

if [[ "$LOCAL_LLM" == "1" ]]; then
  URL="${URL}&mg_local_llm=1"
  export MG_LOCAL_LLM=1
  # start pace advisor if free
  if ! pgrep -f 'webgrid-pace-advisor.py' >/dev/null 2>&1; then
    (python3 "$ROOT/scripts/webgrid-pace-advisor.py" --force --interval 12 >>"$HOME/.panda/mg-soak/pace.log" 2>&1 &) || true
  fi
fi

# Intel laptop default pace (MacBookPro16,1 bench: sleep_ms 4 was too hot)
mkdir -p "$HOME/.panda/mg-soak/watch"
if [[ ! -f "$HOME/.panda/mg-soak/watch/pace.json" ]] || [[ "${MG_FORCE_INTEL_PACE:-1}" == "1" ]]; then
  cat >"$HOME/.panda/mg-soak/watch/pace.json" <<'PACE'
{"sleep_ms":14,"wait_loops":12,"mode":"intel-buffer","source":"laptop-launch"}
PACE
  echo "==> wrote intel pace → ~/.panda/mg-soak/watch/pace.json"
fi
# Force intel profile in page (webgrid-play auto-detect + URL)
URL="${URL}&mg_pace=intel"

export MG_WEBGRID_W="$W"
export MG_WEBGRID_H="$H"

# Lean hot-pipe on WebGrid (skip maze/rubik/beats/filmstrip — Intel thrash)
export MG_HOTPIPE_LEAN=1

echo "==> scale=$SCALE window ${W}x${H} rounds=$ROUNDS lean=1"
echo "==> url=$URL"
echo "==> app=$APP"

# Soft restart of prior game instance only
pkill -x memory-glass 2>/dev/null || true
sleep 0.6

# open -n new instance; env vars pass to process via launchctl? open --args only.
# Use open with env by launching binary directly when possible for MG_WEBGRID_*.
BIN="$APP/Contents/MacOS/memory-glass"
if [[ -x "$BIN" ]]; then
  # Prefer binary so MG_WEBGRID_W/H + SCALE env reach main.rs
  (
    cd "$HOME" && \
    MG_WEBGRID_SCALE="$MG_WEBGRID_SCALE" \
    MG_WEBGRID_W="$W" \
    MG_WEBGRID_H="$H" \
    MG_HOTPIPE_LEAN=1 \
    MG_LOCAL_LLM="${MG_LOCAL_LLM:-}" \
    "$BIN" "$URL" >>"$HOME/Library/Logs/MemoryGlass/launch.log" 2>&1
  ) &
  LAUNCH_PID=$!
  echo "==> launched binary pid ${LAUNCH_PID}"
else
  open -n "$APP" --args "$URL"
  echo "==> launched via open (env size may be default until rebuild)"
fi

echo "==> WebGrid play should open on landscape main display → $([ "$SCALE" = small ] && echo 12×12 || echo 30×30)"
