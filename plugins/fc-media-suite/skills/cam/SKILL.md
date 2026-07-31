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
#   star · glass · bubble · style   ← GPU optic styles (via /watch)
#   popout · cameras · mosaic · bloomberg · vevo · trailers · …
#   keys · mic · talk · hub  (in-modal tips)
/cam star            # /watch + GPU optic star (glass orb · voice rim)
/cam glass · /cam bubble
/cam style star      # same family
/cam xl · /cam pip
/cam phone           # DESK: fullscreen laptop | phone (NO yt-dlp / VEVO)
/cam dual            # same as phone
/cam popout          # primary webcam → OS ffplay window
/watch star          # same style from /watch
# In /watch:  S = star style · L = lens (or LIVE_DEMUX_CAM_STYLE)
```

Shell:

```bash
bash scripts/live-demux/cam-popout.sh          # primary webcam
bash scripts/live-demux/cam-popout.sh all      # all real cameras (webcams only)
bash scripts/live-demux/cam-popout.sh mosaic
bash scripts/live-demux/continuity-phone.sh dual
bash scripts/live-demux/phone-tether.sh start  # optional still-pipe hub only
```

While `/watch` / desk open: **c** cam · **m** mirror · **a** mic · **t** talk · **H** cycle local→dual→phone · **Y** dual pop-out · **L** lens · **S** star style · **O** all webcams.  

Lens: `/lens` · `/lens star` · `/lens glass` · `/lens bubble`  
GPU style: `python3 scripts/live-demux/optic-tinyworld.py star`  
Style registry: `~/.panda/vision/cast/cam-style.json` · device: `cam-device.json`  


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
