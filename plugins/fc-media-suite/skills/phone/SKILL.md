---
name: phone
description: >
  Tether phone PWA (Memory Glass inspect-style) into Grok /cam still-pipe.
  Triggers: /phone, tethered phone, still-pipe, phone PWA, MG phone, live.jpg,
  inspect cam from phone.
---

# Phone tether · Memory Glass → Grok

Phone is the **camera + talk body**. Grok Terminal is the **inspect desk**.

```text
phone Safari / PWA (HTTPS :9878)
        │  getUserMedia → JPEG
        ▼
still-server  POST /upload
        │
        ▼
~/.panda/vision/live.jpg
        │  ffmpeg image2 loop
        ▼
Grok /cam phone  half-block tile + wave/talk
```

## Launch hub

```bash
bash scripts/live-demux/phone-tether.sh start     # hub + URLs (+ QR if qrencode)
bash scripts/live-demux/phone-tether.sh inspect   # open live.jpg in browser
bash scripts/live-demux/phone-tether.sh cam       # hub + Grok /cam phone
bash scripts/live-demux/phone-tether.sh status
bash scripts/live-demux/phone-tether.sh stop
```

## In Grok (main `grok` after deploy-fc-grok)

```text
/phone                 # ensure hub + open large cam on still-pipe
/phone hub             # start hub only
/phone urls            # LAN phone PWA links
/phone inspect         # open live.jpg
/cam phone             # same still-pipe source
/cam tether            # alias
```

While watch is open: **h** toggle phone ↔ local · **a** mic · **t** talk · **c** cam.

## Phone (iOS)

1. Same Wi‑Fi as the Mac running still-server  
2. Safari → `https://<LAN-IP>:9878/phone-setup.html` → trust cert once  
3. Open `https://<LAN-IP>:9878/phone.html` → Allow Camera  
4. Optional: Share → **Add to Home Screen** (MG Phone PWA)  
5. Frames hit `/upload` → `live.jpg` → Grok tile paints  

## Env

| Var | Role |
|-----|------|
| `MG_STILL_BIND=0.0.0.0` | LAN phones (default in phone-tether.sh) |
| `MG_STILL_PORT=9877` | HTTP inspect / API |
| `MG_STILL_HTTPS_PORT=9878` | phone cam (secure context) |
| `LIVE_DEMUX_CAM_SOURCE=phone` | still-pipe instead of FaceTime |
| `LIVE_DEMUX_CAM_STILL=~/.panda/vision/live.jpg` | JPEG path |
| `GY_VISION_DIR` | override vision root |

## Related

- Memory Glass: `experiments/memory-glass/docs/FLEET-PHONE-LINK.md`  
- Plan: `docs/fornever-ledger/CAM-TALK-WAVEFORM-PLAN.md`  
- `/cam` skill · `scripts/deploy-fc-grok.sh`
