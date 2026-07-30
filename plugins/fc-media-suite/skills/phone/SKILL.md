---
name: phone
description: >
  Phone camera into Grok /cam desk dual — Continuity Camera (preferred) or
  optional still-pipe. Triggers: /phone, /cam phone, tethered phone, Continuity,
  Brick, iPhone cam, live.jpg.
---

# Phone · Continuity Camera into Grok desk

Phone is the **camera body**. Grok Terminal is the **desk** (you | phone).

Supported inputs only:

| Path | What it is |
|------|------------|
| **Continuity Camera** (preferred) | iPhone as a Mac **webcam** via AVFoundation (`Brick` / `iPhone` device names) |
| **Still-pipe** (optional fallback) | JPEG stills → `~/.panda/vision/live.jpg` (HTTP hub) |

Do **not** use desktop capture devices, shared-desktop sessions, or third-party camera apps as the phone path.

## Preferred: Continuity Camera (live video)

```text
iPhone Continuity Camera
        │  AVFoundation device: Brick / iPhone
        ▼
ffmpeg live capture
        ▼
Grok /cam phone  ·  desk dual  you | phone
```

```bash
bash scripts/live-demux/continuity-phone.sh list   # list real cameras only
bash scripts/live-demux/continuity-phone.sh wait   # poll until Continuity appears
bash scripts/live-demux/continuity-phone.sh dual   # FaceTime + Continuity OS windows
bash scripts/live-demux/continuity-phone.sh env    # export for Grok
```

### iPhone / Mac (once)

1. iPhone: **Settings → General → AirPlay & Handoff → Continuity Camera → ON**  
2. Same Apple ID · Wi‑Fi · Bluetooth · phone near Mac  
3. Unlock iPhone once (then it can stay locked / face-down)  
4. On the Mac, select the **iPhone / Brick** entry in a camera device list (System Settings → Camera, or FaceTime → Video) to wake Continuity  
5. `continuity-phone.sh list` should show **Brick** / **iPhone** — only use those names  

## In Grok (explicit only — nothing else launches)

```text
/cam phone             # desk dual TUI: laptop | Continuity (no VEVO, no hub)
/cam dual              # same
/phone                 # same desk open — does NOT start still-server
/phone hub             # explicit: start still-server if you want still-pipe
/phone urls            # print LAN URLs only
/phone inspect open    # explicit: open browser to live.jpg
```

Dev progress: bare `/phone` / `/cam phone` only opens the **TUI desk**. No browser, no FaceTime.app, no still-server, no ffplay unless you run a command that names that action.

`LIVE_DEMUX_CAM_PHONE_STILL=1` only if you deliberately want the HTTP JPEG still path.  
`LIVE_DEMUX_AUTO_HUB=1` if bare `/phone` should also start still-server (default off).

While desk/watch is open: **H** cycle sources · **a** mic · **t** talk · **c** cam · **Y** pop dual · **L** lens.

## Env

| Var | Role |
|-----|------|
| `LIVE_DEMUX_CAM_PHONE_DEVICE` | Continuity index or name (`Brick`) — auto by name |
| `LIVE_DEMUX_CAM_PHONE_STILL=1` | opt-in HTTP still-pipe (off by default) |
| `LIVE_DEMUX_CAM_SOURCE=dual` | you + phone desk |
| `LIVE_DEMUX_CAM_DESK=1` | fullscreen dual, no VEVO |
| `GY_VISION_DIR` | vision root (still-pipe only if opted in) |

## Opt-in still-pipe (fallback)

```bash
LIVE_DEMUX_CAM_PHONE_STILL=1 bash scripts/live-demux/phone-tether.sh start
```

Only when Continuity is unavailable and JPEG slideshow latency is acceptable.

## Related

- `/cam` skill · `/lens` skill  
- `scripts/deploy-fc-grok.sh`  
- Plan: `docs/fornever-ledger/CAM-TALK-WAVEFORM-PLAN.md`  
