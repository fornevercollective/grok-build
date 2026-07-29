---
name: cam
description: >
  /cam self-view and OS pop-out camera windows for Grok media suite.
  Triggers: /cam, camera popout, webcam, mosaic cams, FaceTime, PiP.
---

# /cam

```bash
/cam                 # large side self-view + default stream
/cam xl · /cam pip
/cam bloomberg       # cam + news
/cam popout          # Zoom-style OS window (ffplay)
```

Shell:

```bash
bash scripts/live-demux/cam-popout.sh          # primary
bash scripts/live-demux/cam-popout.sh all
bash scripts/live-demux/cam-popout.sh mosaic
```

While `/watch` open: **c** PiP · **m** mirror · **Y** cam pop-out.  
AVFoundation exclusive lock: turn off TTY PiP before OS pop-out on the same device.
