---
name: cam
description: >
  /cam self-view and OS pop-out camera windows for Grok media suite.
  Triggers: /cam, camera popout, webcam, mosaic cams, FaceTime, PiP.
---

# /cam

```bash
/cam                 # large side self-view + default stream
# After `/cam ` the dropdown lists:
#   phone · tether · still · large · xl · max · pip · lean
#   popout · cameras · mosaic · bloomberg · vevo · trailers · …
#   keys · mic · talk · hub  (in-modal tips)
/cam xl · /cam pip
/cam phone           # tethered phone PWA still-pipe (Memory Glass inspect)
/cam tether          # alias of phone
/cam bloomberg       # cam + news
/cam popout          # Zoom-style OS window (ffplay)
/phone               # start hub + open /cam phone
```

Shell:

```bash
bash scripts/live-demux/cam-popout.sh          # primary
bash scripts/live-demux/cam-popout.sh all
bash scripts/live-demux/cam-popout.sh mosaic
bash scripts/live-demux/phone-tether.sh start  # still-server + phone PWA URLs
bash scripts/live-demux/phone-tether.sh cam   # hub + Grok phone tile
```

While `/watch` open: **c** PiP · **m** mirror · **a** mic waveform · **t** talk strip · **h** phone↔local · **Y** cam pop-out.  
AVFoundation exclusive lock: turn off TTY PiP before OS pop-out on the same device.  
Phone tile reads `~/.panda/vision/live.jpg` (phone → POST /upload).

## Main Terminal deploy (not stock x.ai-only)

Stock `curl | bash` Grok lacks `/cam` wave·talk. Deploy the fork as the **main** `grok` for new Terminal windows:

```bash
bash scripts/deploy-fc-grok.sh           # build + install ~/.grok/bin/grok
bash scripts/deploy-fc-grok.sh --open /cam   # + open Terminal with cam auto-on
bash scripts/deploy-fc-grok.sh --restore     # put official x.ai binary back
```

Keys once cam is up: **a** mic bars · **t** talk (Enter post · Esc unfocus) · motion `%` under tile.

Optional Memory Glass hub levels: `export MG_WAVE_URL=http://127.0.0.1:9877/wave`
