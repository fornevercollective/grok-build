---
name: cam
description: >
  /cam self-view, dual desk (laptop | phone), and OS pop-out camera windows
  for Grok media suite. Triggers: /cam, /cam phone, webcam, FaceTime, PiP,
  Continuity dual desk.
---

# /cam

```bash
/cam                 # large side self-view + default stream
# After `/cam ` the dropdown lists:
#   phone · dual · tether · large · xl · max · pip · lean
#   popout · cameras · mosaic · bloomberg · vevo · trailers · …
#   keys · mic · talk · hub  (in-modal tips)
/cam xl · /cam pip
/cam phone           # DESK: fullscreen laptop | phone (NO yt-dlp / VEVO)
/cam dual            # same as phone
/cam tether          # alias of phone
/cam phone bloomberg # dual cam rail + news stream (desk off)
/cam bloomberg       # large local cam + news stream
/cam popout          # primary webcam → OS ffplay window
/phone               # Continuity helpers + desk dual you|phone
```

Shell:

```bash
bash scripts/live-demux/cam-popout.sh          # primary webcam
bash scripts/live-demux/cam-popout.sh all      # all real cameras (webcams only)
bash scripts/live-demux/cam-popout.sh mosaic
bash scripts/live-demux/continuity-phone.sh dual
bash scripts/live-demux/phone-tether.sh start  # optional still-pipe hub only
```

While `/watch` / desk open: **c** cam · **m** mirror · **a** mic · **t** talk · **H** cycle local→dual→phone · **Y** dual pop-out · **L** lens · **O** all webcams.  

Lens (tiny bug world · 360 webcam): `/lens` · `/lens bug dual` · `bash scripts/live-demux/lens-popout.sh`  

AVFoundation exclusive lock: turn off TTY cam before OS pop-out on the **same webcam** device.

Phone half uses Continuity Camera (preferred) or optional still-pipe `live.jpg` when `LIVE_DEMUX_CAM_PHONE_STILL=1`.

## Main Terminal deploy (not stock x.ai-only)

```bash
bash scripts/deploy-fc-grok.sh           # build + install ~/.grok/bin/grok
bash scripts/deploy-fc-grok.sh --open /cam
bash scripts/deploy-fc-grok.sh --restore
```

Keys once cam is up: **a** mic bars · **t** talk (Enter post · Esc unfocus) · motion `%` under tile.

Optional levels hub: `export MG_WAVE_URL=http://127.0.0.1:9877/wave`
