---
name: cast
description: >
  Cast desk dual, streams, and mosaics to TCL Google Smart TV (Chromecast built-in).
  Triggers: /cast, /share, /mirror, Chromecast, Google TV, TCL TV, cast wall.
---

# /cast · TCL Google TV wall

**Explicit only** — never auto-casts. Aliases: `/share` · `/mirror` (not OS Screen Sharing).

## LAN devices (discovered)

| Name | Model (catt) | IP | Role |
|------|--------------|-----|------|
| **Smart TV** | TCL Smart TV | 192.168.0.5 | **primary wall** |
| GoogleTV3065 | Hisense SmartTV 4K FFM | 192.168.0.61 | sibling |
| Nest Minis | speakers | — | audio only |

```bash
export LIVE_DEMUX_CAST_DEVICE='Smart TV'   # default in cast-tv.sh
# export LIVE_DEMUX_CAST_DEVICE='GoogleTV3065'  # Hisense instead
```

Confirm exact TCL retail SKU: **Settings → System → About → Model**.

## TCL Google Smart TV — cast envelope

| Spec | Value |
|------|--------|
| OS | Google TV + **Chromecast built-in** |
| Cast protocol | v12 (eureka build 446070) |
| Panel class | **UHD** (typical 3840×2160; confirm SKU) |
| Safe encode | **1920×1080 @ 30** H.264 High + AAC Rec.709 |
| UHD opt-in | `LIVE_DEMUX_CAST_UHD=1` → 3840×2160 @ 30 |
| FPS | Cast path **30 default** (60 via `LIVE_DEMUX_CAST_FPS`); panel 60/120 is HDMI/Game Mode only |
| Color / LUT | **Rec.709 SDR** on cast; HDR10/HLG on panel **not** used on cast path |
| LUT | `LIVE_DEMUX_CAST_LUT=/path/to.cube` applied at **encode** (TV UI has no custom 3D LUT) |
| Viewing angle | VA/IPS by series · marketed ~178° · **center seating** for dual walls (VA contrast drops off-axis) |
| Errors | same LAN · no `127.0.0.1` · H.264 fallback · re-`/cast` if session stolen · set device name if wrong TV |

Profile: `scripts/live-demux/devices/tcl-google-uhd.json`  
Sibling: `scripts/live-demux/devices/hisense-google-uhd.json`  
Plan: `docs/fornever-ledger/CAST-TV-WALL-PLAN.md`

## Commands

```text
/cast list              # catt scan
/cast profile           # TCL encode + panel class
/cast doctor            # ffmpeg · catt · LAN · profile
/cast status
/cast desk              # you | phone → TV
/cast mosaic            # 2×2 wall (you/phone/stream/lens)
/cast align             # numbered pixel chart (placement grid)
/cast align-ui          # interactive chart on LAN + cast_site
/cast https://…         # cast URL if TV can fetch
/cast stop
```

### Align chart (placement)

```bash
# static numbered chart → TV
bash scripts/live-demux/cast-tv.sh align
LIVE_DEMUX_CAST_ALIGN_SELECT='1,2,5-8,A3' bash scripts/live-demux/cast-tv.sh align

# interactive: click/drag regions, export JSON · people call out numbers
bash scripts/live-demux/cast-tv.sh align-ui
# http://<LAN>:8765/align-chart.html
```

See `scripts/live-demux/cast-align/README.md`.

```bash
pipx install catt
export PATH="$HOME/.local/bin:$PATH"
export LIVE_DEMUX_CAST_DEVICE='Smart TV'
bash scripts/live-demux/cast-tv.sh doctor
bash scripts/live-demux/cast-tv.sh list
bash scripts/live-demux/cast-tv.sh profile
bash scripts/live-demux/cast-tv.sh desk
bash scripts/live-demux/cast-tv.sh mosaic
bash scripts/live-demux/cast-tv.sh encode-url 'https://…'
```

## Layout recipes (wall)

| Recipe | Source |
|--------|--------|
| single | one stream full 16:9 |
| desk | you \| phone side-by-side then scale |
| mosaic | 2×2 xstack: you, phone, stream, lens stills |
| XR | later: Quest / phone browser as source into same encode |

Stills (optional env overrides):

| Tile | Default path |
|------|----------------|
| phone | `~/.panda/vision/live.jpg` |
| you | `~/.panda/vision/you.jpg` |
| stream | `~/.panda/vision/stream.jpg` |
| lens | `~/.panda/vision/lens.jpg` |

## Mixed XR (later)

Phones (Continuity / still-pipe) and VR headsets join as **sources** into the same encode wall, then **one** Cast session to the TCL. No automatic headset launch.

## Explicit only

See `scripts/live-demux/NO-AUTO-LAUNCH.md`. Cast never starts on Grok boot.
