#!/bin/bash
# Build a learnable session transcript from inbox + spoken + optional notes.
# Output: ~/.panda/voice/sessions/session-YYYYMMDD-HHMMSS.{jsonl,md}
set -u
DIR="${GY_VOICE_DIR:-$HOME/.panda/voice}"
OUT_DIR="$DIR/sessions"
mkdir -p "$OUT_DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
JSONL="$OUT_DIR/session-$STAMP.jsonl"
MD="$OUT_DIR/session-$STAMP.md"

python3 - <<'PY' "$DIR" "$JSONL" "$MD"
import json, sys, time
from pathlib import Path
from datetime import datetime, timezone

d = Path(sys.argv[1])
jsonl_path = Path(sys.argv[2])
md_path = Path(sys.argv[3])
inbox = d / "inbox.jsonl"
spoken = d / "spoken.log"

events = []
if inbox.exists():
    for line in inbox.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            o = json.loads(line)
        except Exception:
            o = {"text": line, "src": "inbox-raw"}
        events.append({
            "role": "user",
            "ts": o.get("ts"),
            "epoch": o.get("epoch"),
            "text": o.get("text", ""),
            "src": o.get("src", "voice-bridge"),
        })

if spoken.exists():
    # spoken log has no timestamps historically — attach mtime order index
    for i, line in enumerate(spoken.read_text(errors="replace").splitlines()):
        line = line.strip()
        if not line:
            continue
        events.append({
            "role": "assistant_tts",
            "ts": None,
            "epoch": None,
            "text": line,
            "src": "speak.sh",
            "order_hint": i,
        })

# sort: prefer epoch when present
def key(e):
    if e.get("epoch"):
        return (0, e["epoch"])
    return (1, e.get("order_hint") or 0)

events_sorted = sorted(events, key=key)

with jsonl_path.open("w") as f:
    for e in events_sorted:
        f.write(json.dumps(e, ensure_ascii=False) + "\n")

lines = [
    f"# Memory Glass · voice session export",
    f"- exported: {datetime.now(timezone.utc).isoformat()}",
    f"- user utterances: {sum(1 for e in events_sorted if e['role']=='user')}",
    f"- assistant tts lines: {sum(1 for e in events_sorted if e['role']=='assistant_tts')}",
    "",
    "## Dial-in notes (edit these)",
    "- [ ] False positives / TTS echoes:",
    "- [ ] Missed phrases:",
    "- [ ] Whisper model ok? (small.en vs large-v3-turbo)",
    "- [ ] Clip length ok? (default 3.5s)",
    "- [ ] Mute UX ok?",
    "",
    "## Transcript",
    "",
]
for e in events_sorted:
    role = "YOU" if e["role"] == "user" else "GROK(TTS)"
    ts = e.get("ts") or "—"
    lines.append(f"**{role}** · `{ts}`  \n{e.get('text','')}\n")

md_path.write_text("\n".join(lines) + "\n")
print(jsonl_path)
print(md_path)
print(f"events={len(events_sorted)}")
PY

echo "exported:"
ls -la "$JSONL" "$MD"
# also write "latest" pointers
cp -f "$JSONL" "$OUT_DIR/latest.jsonl"
cp -f "$MD" "$OUT_DIR/latest.md"
echo "latest → $OUT_DIR/latest.md"
