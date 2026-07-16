# lab-ship phone · GrokYtalkY tether · Pages

## Phone PWA

| URL | Role |
|-----|------|
| **Local** | `http://127.0.0.1:8765/phone.html` |
| **GitHub Pages** | `https://fornevercollective.github.io/grok-build/phone.html` |
| Install | Add to Home Screen (manifest `start_url` = phone) |

Pages serves **static UI** (Chat shell · Docs · Agent/Stream iframes).  
**Live cam / STT / GY ingest** need a Lab host on your LAN (`native` app or `./serve.sh`) and/or **`gy serve`**.

---

## Tethered phone camera (Continuity + GY multi-stream)

Same ladder as HDRI multi-streams in GrokYtalkY facility ingest.

### 1. Continuity Camera (macOS + iPhone)

1. iPhone unlocked, same Apple ID, Continuity Camera on.  
2. Mac: **System Settings → General → AirDrop & Handoff → Continuity Camera** (or Camera list).  
3. iPhone appears as an AVFoundation device (often index `0` or `1`).

List devices:

```bash
ffmpeg -f avfoundation -list_devices true -i ""
# or
gy doctor cameras   # if available
curl -s http://127.0.0.1:9876/api/media/ingest | jq .
```

### 2. Start GY hub

```bash
gy serve
# hub :9876 · blank often :5173
```

### 3. Pipe into Lab Stream (multi-stream style)

**A — GY ingest → HLS (preferred for multi-cam / HDRI ladder)**

```bash
# start facility ingest for Continuity / UVC
curl -s 'http://127.0.0.1:9876/api/media/ingest/start?src=device:0' | jq .

# Lab Stream chip **GY cam** or:
# play URL: gy:device:0
```

In Stream window chips: **Phone** (`device:0`) · **GY cam** (`gy:device:0`).

**B — Lab local ffmpeg restream** (no GY hub)

Stream → Play → `device:0` (native restream → `/api/media/hls/…`).

**C — Multi HDRI / stereo**

```bash
# GY stereo → equirect (sphere / multi)
curl -s 'http://127.0.0.1:9876/api/media/ingest/start?src=stereo:sbs:device:0'
# Sphere / queue UI on GY site for multi-slot
open http://127.0.0.1:9876/   # or GrokYtalkY site sphere/queue
```

### 4. Phone PWA sees the pipe

1. Stream playing on Lab (or GY HLS).  
2. Stream publishes `/api/media/active`.  
3. **lab-ship phone** Chat tab → stream peek + Stream pin show **low-res live**.  
4. Full Stream tab = iframe player.

---

## GitHub Actions / Pages

Workflow: `.github/workflows/pages-architecture-lab.yml`  
Prep: `scripts/prepare-pages-site.sh` rsyncs **all** of `docs/architecture-lab` including `phone.html`.

After merge to `main`:

```text
https://fornevercollective.github.io/grok-build/
https://fornevercollective.github.io/grok-build/phone.html
```

| On Pages | Works? |
|----------|--------|
| Phone chrome · Docs · UI | Yes (static) |
| Agent/Stream iframes | UI shell yes; APIs no unless you point at a public host |
| Continuity / GY ingest | **Local only** (`gy serve` + Lab native) |
| STT / TTS | Needs `XAI_API_KEY` on a host you control |

**Pattern:** Pages = installable face. Laptop = GY + Lab host for tethered cam + voice.

---

## Lab button restore

`chat_orb` / `chat_full` **snapshots** which windows were open, then solos chat.  
**Lab** / `restore_workspace` / `show_lab` **re-opens** stream · agent · launch · browser as they were and re-snaps dock layout.

```bash
curl -s -X POST http://127.0.0.1:8765/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"restore_workspace"}'
```

---

## Related

- GY: [streams-capacity](https://fornevercollective.github.io/GrokYtalkY/docs.html#streams-scale) · `device:avfoundation:0` Continuity  
- Lab Stream chips · media active bus · phone shell  
