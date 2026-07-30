---
name: lens
description: >
  Live lens pop-out: tiny bug world, HDRI anamorphic, 360 compound-eye vision
  from laptop webcam / Continuity phone / dual. Triggers: /lens, bug world,
  insect vision, anamorphic, HDRI live, 360 fisheye, L key in /watch.
---

# /lens · tiny bug world vision

Live **OS window** via `ffplay` + ffmpeg filters (not TTY half-block).  
Grammar mirrors Memory Glass `lens.js` (FOV / anamorphic) with a bug-world grade.

Sources are **cameras only**: laptop FaceTime/webcam, Continuity Camera (iPhone as webcam), or optional still-pipe JPEG. Not desktop capture.

## Looks

| Profile | Feel |
|---------|------|
| **bug** (default) | fisheye barrel + anamorphic plate + tiny-world crop + HDRI tone + green cast |
| **360** | dual-fisheye compound eye (`v360` when input is equirect / 360 cam) |
| **anamorphic** | 2× cinema squeeze plate |
| **tiny** | tilt-shift miniature / diorama |
| **hdri** | tone map · lush sat · soft vignette |

## Inputs

| Arg | Source |
|-----|--------|
| (auto) | follows `/cam` source (dual if `/cam phone`) |
| **dual** | laptop webcam **and** phone Continuity/still — two lens windows |
| **phone** | phone Continuity device or still-pipe `live.jpg` |
| **you** | laptop webcam only |
| **360** | force equirect / `v360` path on a real 360 **camera** |

## In Grok

```text
/lens
/lens bug dual
/lens 360
/lens anamorphic phone
/lens tiny
/lens hdri
```

While `/watch` / desk open: **`L`** → bug lens **ffplay** windows only (explicit).  
**`Y`** clean dual cam pop-out.  

`/lens` does **not** auto-open desk TUI or still-server. Add `desk` if you want both:

```text
/lens bug dual desk
```

Or open desk first: `/cam phone`, then **L**.

## Shell

```bash
bash scripts/live-demux/lens-popout.sh
bash scripts/live-demux/lens-popout.sh bug dual
bash scripts/live-demux/lens-popout.sh 360
bash scripts/live-demux/lens-popout.sh anamorphic phone
```

### 360 cameras

1. Set device: `export LIVE_DEMUX_CAM_DEVICE=<avfoundation-index>` for the **360 camera**  
2. If the cam outputs equirectangular: `export LIVE_DEMUX_LENS_360=1`  
3. `/lens 360` or `bash scripts/live-demux/lens-popout.sh 360`  

If `v360` is missing in your ffmpeg build: `LIVE_DEMUX_LENS_NO_V360=1` falls back to flat barrel fisheye.

## Env

| Var | Role |
|-----|------|
| `LIVE_DEMUX_LENS_SIZE=1280x720` | window size |
| `LIVE_DEMUX_LENS_FPS=24` | capture rate |
| `LIVE_DEMUX_LENS_VF=…` | full `-vf` override |
| `LIVE_DEMUX_LENS_360=1` | force equirect path |
| `LIVE_DEMUX_LENS_NO_V360=1` | skip v360 |
| `LIVE_DEMUX_CAM_DEVICE` | laptop / 360 webcam index |
| `LIVE_DEMUX_CAM_STILL` | optional still-pipe path |

## Feature stamp

`fc-lens-bug-v1`
