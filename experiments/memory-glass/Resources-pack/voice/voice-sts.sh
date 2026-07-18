#!/bin/bash
# Voice Agent STS scaffold — full-duplex xAI speech-to-speech (Phase D).
# Enable: GY_VOICE_STS=1 XAI_API_KEY=… bash ~/.panda/voice/voice-sts.sh
# Until fully wired, falls back to voice-bridge.sh (clip + whisper).
set -u
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
mkdir -p "$DIR"
LOG="$DIR/sts.log"
URL="${XAI_VOICE_AGENT_URL:-wss://api.x.ai/v1/realtime}"

log() { echo "$(date -u +%H:%M:%SZ) $*" | tee -a "$LOG"; }

if [[ "${GY_VOICE_STS:-0}" != "1" ]]; then
  log "STS scaffold idle (set GY_VOICE_STS=1). Starting clip bridge."
  exec bash "$DIR/voice-bridge.sh"
fi

if [[ -z "${XAI_API_KEY:-}" ]]; then
  log "ERR STS needs XAI_API_KEY — whisper bridge"
  exec bash "$DIR/voice-bridge.sh"
fi

export GY_VOICE_DIR="$DIR"
export XAI_VOICE_AGENT_URL="$URL"
export XAI_API_KEY

log "STS launching python scaffold → $URL"

python3 - "$DIR" "$URL" <<'PY'
import asyncio, json, os, sys, time, pathlib

DIR = pathlib.Path(sys.argv[1])
URL = sys.argv[2]
KEY = os.environ.get("XAI_API_KEY", "")
INBOX = DIR / "inbox.jsonl"
SPOKEN = DIR / "spoken.log"
LOG = DIR / "sts.log"

def log(msg: str) -> None:
    line = time.strftime("%H:%M:%SZ", time.gmtime()) + " " + msg
    print(line, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass

def muted() -> bool:
    p = DIR / "user.mute"
    if not p.exists():
        return False
    try:
        end = float((p.read_text().strip().split(".")[0] or "0"))
        return time.time() < end
    except Exception:
        return True

async def main() -> int:
    try:
        import websockets  # type: ignore
    except ImportError:
        log("STS_ERR: pip install websockets — falling back")
        return 2

    headers = [("Authorization", f"Bearer {KEY}")]
    voice = "default"
    vid = DIR / "voice_id"
    if vid.exists():
        voice = vid.read_text().strip() or voice

    log(f"STS connecting {URL}")
    try:
        async with websockets.connect(URL, additional_headers=headers, ping_interval=20) as ws:
            await ws.send(json.dumps({
                "type": "session.update",
                "session": {
                    "modalities": ["audio", "text"],
                    "voice": voice,
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                },
            }))
            log("STS session open (scaffold duplex loop)")
            while True:
                if muted():
                    await asyncio.sleep(0.5)
                    continue
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                if isinstance(msg, bytes):
                    continue
                try:
                    d = json.loads(msg)
                except Exception:
                    continue
                t = str(d.get("type") or "")
                text = d.get("transcript") or d.get("text") or ""
                if text and ("transcript" in t or t.endswith("transcription.completed")):
                    line = json.dumps({
                        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "epoch": int(time.time()),
                        "text": text,
                        "src": "voice-sts",
                    })
                    with open(INBOX, "a") as f:
                        f.write(line + "\n")
                    print(f"USER_SAID {text}", flush=True)
                if text and (t.endswith("response.audio_transcript.done") or d.get("role") == "assistant"):
                    with open(SPOKEN, "a") as f:
                        f.write(str(text).strip() + "\n")
                    print(f"STS_SPOKE {str(text)[:80]}", flush=True)
    except Exception as e:
        log(f"STS_ERR {e}")
        return 3
    return 0

rc = asyncio.run(main())
sys.exit(rc)
PY
RC=$?
if [[ "$RC" -ne 0 ]]; then
  log "STS exit $RC — starting whisper bridge"
  exec bash "$DIR/voice-bridge.sh"
fi
