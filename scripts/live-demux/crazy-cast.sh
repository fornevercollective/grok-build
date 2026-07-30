#!/usr/bin/env bash
# fornevercollective · CRAZY multi-device cast test
# Terminal → laptop GPU throttle → TV augmented perspective
# Phones + Quest browser drive pose; optional quality H.264 pipe
#
#   bash scripts/live-demux/crazy-cast.sh
#   bash scripts/live-demux/crazy-cast.sh --pipe      # also live pose VT segments
#   bash scripts/live-demux/crazy-cast.sh --webgl-only # DashCast interactive only
#
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEVICE="${LIVE_DEMUX_CAST_DEVICE:-Smart TV}"
PORT="${LIVE_DEMUX_CAST_PORT:-8765}"
HTTPS_PORT="${LIVE_DEMUX_CAST_HTTPS_PORT:-8766}"
PIPE_DIR="$ROOT/scripts/live-demux/gpu-pipe"
PIPE_BIN="$PIPE_DIR/target/release/fc-gpu-pipe"
HUB="$ROOT/scripts/live-demux/cast-align/align-hub.py"
SERVE="${LIVE_DEMUX_CAST_DIR:-$HOME/.panda/vision/cast}"
LOG="$SERVE/crazy-cast.log"
mkdir -p "$SERVE"

DO_PIPE=0
WEBGL_ONLY=0
for a in "$@"; do
  case "$a" in
    --pipe|--quality) DO_PIPE=1 ;;
    --webgl-only) WEBGL_ONLY=1 ;;
    --device=*) DEVICE="${a#--device=}" ;;
  esac
done

lan_ip() {
  ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || echo "127.0.0.1"
}
LAN="$(lan_ip)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  CRAZY CAST · multi-device augmented perspective             ║"
echo "║  terminal → hub → phones/quest → TV                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  LAN:     $LAN"
echo "  device:  $DEVICE"
echo "  hub:     http://${LAN}:${PORT}/  · https://${LAN}:${HTTPS_PORT}/"
echo ""

# ── 1. Hub ──────────────────────────────────────────────────────
if ! curl -sS -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "==> starting align-hub"
  (
    cd "$(dirname "$HUB")"
    nohup python3 "$(basename "$HUB")" --bind 0.0.0.0 --port "$PORT" --https-port "$HTTPS_PORT" \
      >>"$LOG" 2>&1 &
    echo $! >"$SERVE/align-hub.pid"
  )
  sleep 1.4
fi
curl -sS -m 3 "http://127.0.0.1:${PORT}/health" >/dev/null || {
  echo "error: hub failed — see $LOG"
  exit 1
}
echo "  ✓ hub"

# ── 2. Seed multi-user crazy state ──────────────────────────────
python3 - "$PORT" <<'PY'
import json, urllib.request, sys, time
port = sys.argv[1]
payload = {
  "surface": "crazy",
  "variation": "crazy-multi",
  "vantage": {
    "user": "you",
    "mode": "seat",
    "users": {
      "you": {"label": "You", "mode": "seat", "gain": 1.45, "smooth": 0.22},
      "partner": {"label": "Partner", "mode": "seat", "gain": 1.05, "smooth": 0.5},
      "quest": {"label": "Quest", "mode": "stand", "gain": 1.6, "smooth": 0.18, "note": "Oculus browser PWA"},
    },
  },
  "crazy_peers": {},
  "viewer": {"yaw": 0, "pitch": 0, "z": 1, "source": "crazy-seed", "user": "you", "t": time.time()},
}
# inject L3 transcript demo
req = urllib.request.Request(
  f"http://127.0.0.1:{port}/api/state",
  data=json.dumps(payload).encode(),
  headers={"Content-Type": "application/json"},
  method="POST",
)
urllib.request.urlopen(req, timeout=3).read()
# transcript seed
try:
  req2 = urllib.request.Request(
    f"http://127.0.0.1:{port}/api/transcript",
    data=json.dumps({
      "action": "demo",
      "program": "crazy-cast",
      "project": "grok-cli",
      "lines": [
        {"text": "CRAZY CAST online · multi-device perspective", "speaker": "SYS"},
        {"text": "Phone / Quest gyro steers the TV world", "speaker": "PGM"},
        {"text": "Laptop GPU pipe optional for 720p+ quality", "speaker": "HUB"},
      ],
    }).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
  )
  urllib.request.urlopen(req2, timeout=3).read()
except Exception:
  pass
print("  ✓ multi-user vantage + transcript seeded")
PY

# ── 3. Cast interactive crazy surface to TV ─────────────────────
TV_URL="http://${LAN}:${PORT}/crazy?tv=1"
PHONE_YOU="https://${LAN}:${HTTPS_PORT}/crazy?user=you&pwa=1"
PHONE_PARTNER="https://${LAN}:${HTTPS_PORT}/crazy?user=partner&pwa=1"
QUEST_URL="https://${LAN}:${HTTPS_PORT}/crazy?user=quest&pwa=1"
# fallback http if no cert
PHONE_YOU_HTTP="http://${LAN}:${PORT}/crazy?user=you&pwa=1"

echo ""
echo "==> CAST TARGETS"
echo "  TV (DashCast interactive):  $TV_URL"
echo "  Phone YOU (gyro):           $PHONE_YOU"
echo "  Phone PARTNER:              $PHONE_PARTNER"
echo "  Quest / Oculus browser:     $QUEST_URL"
echo "  (if HTTPS cert untrusted:   $PHONE_YOU_HTTP + /setup.html)"
echo ""

if [[ "$WEBGL_ONLY" -eq 0 ]] || [[ "$WEBGL_ONLY" -eq 1 ]]; then
  if command -v catt >/dev/null 2>&1; then
    echo "==> catt cast_site crazy → $DEVICE"
    catt -d "$DEVICE" stop 2>>"$LOG" || true
    sleep 0.4
    if catt -d "$DEVICE" cast_site "$TV_URL" 2>>"$LOG"; then
      echo "  ✓ TV interactive crazy surface"
    else
      echo "  ✗ cast_site failed — open on TV: $TV_URL"
    fi
  else
    echo "  warn: catt missing — open TV browser: $TV_URL"
  fi
fi

# ── 4. Optional live pose GPU pipe (quality path) ───────────────
if [[ "$DO_PIPE" -eq 1 && "$WEBGL_ONLY" -eq 0 ]]; then
  if [[ ! -x "$PIPE_BIN" ]]; then
    echo "==> building fc-gpu-pipe"
    (cd "$PIPE_DIR" && cargo build --release) || exit 1
  fi
  echo "==> GPU PIPE · live pose warp · continuous segments (Ctrl-C to stop)"
  echo "  (this re-casts H.264 every segment — higher res than WebView)"
  export LIVE_DEMUX_CAST_DEVICE="$DEVICE"
  exec "$PIPE_BIN" \
    --crazy \
    --tier "${LIVE_DEMUX_GPU_PIPE_TIER:-wow}" \
    --power auto \
    --secs 6 \
    --segments 0 \
    --mode crazy \
    --pose-url "http://127.0.0.1:${PORT}/api/viewer" \
    --cast-device "$DEVICE"
fi

# ── 5. Terminal status loop ─────────────────────────────────────
echo ""
echo "==> LIVE · open phones now"
echo "  1) Phone: open $PHONE_YOU  → allow motion"
echo "  2) Second phone: $PHONE_PARTNER"
echo "  3) Quest browser: $QUEST_URL  (same Wi‑Fi, trust cert once)"
echo "  4) Quality loop:  $0 --pipe"
echo ""
echo "  status poll (Ctrl-C exit)…"
echo ""

while true; do
  python3 - "$PORT" <<'PY' 2>/dev/null || true
import json, urllib.request, sys, time
port = sys.argv[1]
try:
  st = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/api/state", timeout=2))
except Exception as e:
  print(f"  hub? {e}")
  raise SystemExit
v = st.get("viewer") or {}
peers = st.get("crazy_peers") or {}
surf = st.get("surface")
print(
  f"  {time.strftime('%H:%M:%S')}  surface={surf}  "
  f"viewer@{v.get('user','?')} y={float(v.get('yaw') or 0):+.2f} p={float(v.get('pitch') or 0):+.2f}  "
  f"src={v.get('source')}  peers={list(peers.keys()) or '—'}"
)
PY
  sleep 1.2
done
