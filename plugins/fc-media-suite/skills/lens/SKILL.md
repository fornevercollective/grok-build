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
| **planet** | **tiny planet** stereographic (`v360 flat→sg` on bare FaceTime; **not** stretch-smear) |
| **optic** | **clip-on optical glass** — keep circular FOV + HDRI grade |
| **optic planet / rabbit / both** | stereographic polar + liquid rim |
| **optic glass** | liquid-glass dome (chromatic + fresnel) |
| **optic cymatic** | Chladni / standing-wave ink on glass |
| **optic orb / star** | starfield glass sphere (agent-orb spirit) |
| **optic bubble / crystal / wave** | soap beads · facets · water ripples |

Panel: **mirror + h-rot°**, **LUT presets**, **chat → terminal** (`optic-pipe.jsonl` / `optic-chat-in.txt`).

> Clip-on black ring → no `v360 fisheye`. GPU: `optic-tinyworld.py` (moderngl).
| **rabbit** | inverted planet / rabbit-hole tunnel (sky center) |
| **360** | dual-fisheye compound eye (`v360` when input is equirect / 360 cam) |
| **anamorphic** | 2× cinema squeeze plate |
| **tiny** | tilt-shift miniature / diorama (not stereographic) |
| **hdri** | tone map · lush sat · soft vignette |

**Bare FaceTime vs clip-on glass:** without glass, use `planet` / `bug`. With a physical fisheye/wide attachable on the laptop cam, use `optic` (circle) or `optic planet` (globe). Old planet path stretched flat frames into fake equirect → vertical color bands.

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
/lens planet              # software tiny planet (bare FaceTime · flat→sg)
/lens optic               # clip-on glass · keep circular FOV
/lens optic planet        # HDRI → tiny planet (ground)
/lens optic rabbit        # HDRI → rabbit hole (other way)
/lens optic both          # planet | rabbit in one window
/lens optic hdri          # equirect HDRI map
/lens planet dual
/lens rabbit              # rabbit hole (invert)
/lens planet equirect     # true 360 equirect source
/lens bug dual
/lens 360
/lens anamorphic phone
/lens tiny
/lens hdri
```

Still from a panorama file (explicit OpenCV path, same math):

```bash
python3 scripts/live-demux/tiny-planet.py panorama.jpg -o planet.jpg
python3 scripts/live-demux/tiny-planet.py panorama.jpg --invert -o rabbit.jpg
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
bash scripts/live-demux/lens-popout.sh planet          # bare cam software planet
bash scripts/live-demux/lens-popout.sh optic           # clip-on glass circle
bash scripts/live-demux/lens-popout.sh optic planet    # OpenCV polar planet
bash scripts/live-demux/lens-popout.sh optic rabbit    # OpenCV polar rabbit
bash scripts/live-demux/lens-popout.sh optic both      # planet | rabbit
# GPU workspace (preview left · hot pipe / chat right)
python3 scripts/live-demux/optic-tinyworld.py star    # x.ai voice-bubble anim + stars
python3 scripts/live-demux/optic-tinyworld.py glass
python3 scripts/live-demux/optic-tinyworld.py bubble

# /cam devices (panel combo or):
#   FaceTime [0] · Brick Continuity [1] · Brick Desk [2]
#   writes ~/.panda/vision/cast/cam-device.json + cam-device.env

# Imagine video overlay (optional loop):
#   ~/.panda/vision/optic-overlay.mp4  → panel "video overlay" slider

# hot pipe / terminal chat
#   ~/.panda/vision/cast/optic-pipe.jsonl
#   ~/.panda/vision/cast/optic-chat-in.txt
# Panel: voice pulse · bubble anim · /cam device · LUT mix

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
