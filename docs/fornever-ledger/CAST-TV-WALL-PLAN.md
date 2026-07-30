# Cast · mirror · share → TV wall (TCL Google TV)

| | |
|--|--|
| **Owner** | fornevercollective |
| **Feature** | `fc-cast-tv-v1` |
| **Slash** | `/cast` · aliases `/share` · `/mirror` (mirror = soft alias; **not** OS Screen Sharing) |
| **Refs** | Chromecast built-in · Google TV · desk dual · lens mosaics · XR phone/VR later |

## Problem

We can play custom feeds, dual cams, and lens mosaics **on the Mac**. There is no first-class path to put those optimized layouts on the living-room **TCL Google Smart TV** (or other Cast devices) as a content wall.

## Goals

1. **Discover** Cast devices on LAN (explicit command only).
2. **Cast** a resolved stream URL, local HLS/file, or layout recipe to a named device.
3. **Device profiles** (TCL Google TV first): resolution, fps caps, color, viewing angle notes, error handling.
4. **Layouts** for a multi-panel wall (stream | you | phone | lens) encoded as HLS for the TV.
5. **XR later**: phone / VR as additional sinks or sources — same cast pipeline, different profiles.

## Non-goals (v1)

- Silent cast on session start.
- macOS AirPlay / Miracast / Screen Sharing as the phone path.
- Controlling arbitrary Google TV apps (YouTube cast API remains app-owned).
- Buying a specific TCL SKU — profile is **class-based** until model is confirmed.

## TCL Google Smart TV — capability class (fill model when known)

TCL Google TVs ship **Google TV** with **Chromecast built-in**. Exact panel specs vary by series (S/C/QM/…). Use this as the **cast envelope** until `LIVE_DEMUX_CAST_TV_MODEL` is set.

### Resolution & layout envelope

| Class | Panel (typical) | Safe cast encode | Notes |
|-------|-----------------|------------------|-------|
| **HD** | 1920×1080 | 1920×1080 @ 30 | Older / small TCL |
| **UHD** (default) | 3840×2160 | **1920×1080 @ 30** or **3840×2160 @ 30** | Cast often downscales; start 1080p for reliability |
| **UHD 120** | 3840×2160 @ 120 (panel) | Cast path usually **≤60 fps** | Game mode / HDMI 2.1 ≠ Cast pipeline |
| **8K** (rare) | 7680×4320 | treat as UHD for cast | Encode 4K max |

**Default profile (`tcl-google-uhd`):**
- Encode: **1920×1080**, **30 fps**, H.264 High, yuv420p, AAC 128k  
- Alternate: **3840×2160 @ 30** when LAN + TV accept it (`LIVE_DEMUX_CAST_UHD=1`)  
- Aspect: 16:9 wall; letterbox custom mosaics  

### FPS

| Path | Typical max | Cast practical |
|------|-------------|----------------|
| Panel (HDMI/Game) | 60 / 120 | N/A for Cast |
| Chromecast built-in video | ~30–60 | **30 default**, 60 opt-in |
| Live dual cam mosaic | source-limited | 24–30 encode |

### Color / LUT / HDR

| Capability | TCL Google class (typical) | Cast implication |
|------------|----------------------------|------------------|
| SDR Rec.709 | yes | **default cast grade** |
| HDR10 / HLG | many UHD models | Cast HDR is **app/device dependent** — v1 **SDR only** |
| Dolby Vision | higher SKUs | not assumed |
| Custom 3D LUT | usually **pro/PC pipeline**, not Google TV consumer UI | apply LUTs **on encode** (ffmpeg `lut3d`) before cast |
| Wide color gamut | model-dependent | stay Rec.709 for cast reliability |

**v1 grade:** same SDR HDRI-ish curves as lens (optional) → **Rec.709 SDR** for TV.

### Viewing angle (panel)

| Tech (typical TCL) | Horizontal | Vertical | Cast layout note |
|--------------------|------------|----------|------------------|
| VA | ~178° marketed, contrast drops off-axis | similar | Prefer **center seating**; multi-viewer walls use larger type / high contrast UI chrome |
| IPS (some lines) | better off-axis color | better | freer wall placement |

Cast cannot change panel physics — layout recipes should **avoid fine 1px UI** and prefer high-contrast dual tiles.

### Error handling (Chromecast / Google TV)

| Failure | Symptom | v1 handling |
|---------|---------|-------------|
| Device offline | discovery empty | message + `/cast list` retry |
| Wrong Wi-Fi / guest isolation | no `_googlecast._tcp` | document same LAN / disable client isolation |
| Unsupported codec | black / stop | re-encode H.264 + AAC progressive or HLS |
| URL not reachable from TV | loads then fails | bind `0.0.0.0`, use LAN IP not `127.0.0.1` |
| Exclusive cam lock | encode fails | release TTY cam / other ffplay |
| Cast session stolen | another phone cast | message; re-`/cast` |
| HLS segment 404 | stall | short playlist, low latency segments |
| HDCP / app path | rare for default receiver | stick to Default Media Receiver |

### Protocols (priority)

1. **Chromecast built-in** (Google Cast) — primary for TCL Google TV  
2. **Local HTTP + HLS/MP4** served from Mac on LAN  
3. Later: AirPlay receiver apps, DIY NDI/RTSP for XR headsets  

## Architecture

```
/watch · /cam desk · lens mosaic · URL
        │ resolve / encode
        ▼
cast encode (ffmpeg) → HLS or progressive on LAN
        │
        ▼ catt / Cast protocol  →  TCL Google TV (Chromecast built-in)
        │
        ▼ optional XR sinks (later): Quest browser / phone cast tab
```

## Slash

| Command | Action |
|---------|--------|
| `/cast list` | discover Cast devices (no spawn if none) |
| `/cast` · `/cast tv` | cast current/last stream to default device |
| `/cast <url>` | cast URL (after resolve if needed) |
| `/cast mosaic` · `/cast desk` | encode dual/mosaic layout → cast |
| `/cast stop` | stop session if tool supports |
| `/share` · `/mirror` | **aliases of `/cast`** (copy URL / cast; not OS Screen Sharing) |

## Env

| Var | Role |
|-----|------|
| `LIVE_DEMUX_CAST_DEVICE` | friendly name / UUID from discovery |
| `LIVE_DEMUX_CAST_TV_MODEL` | e.g. `tcl-google-uhd` profile id |
| `LIVE_DEMUX_CAST_UHD=1` | allow 4K encode attempt |
| `LIVE_DEMUX_CAST_FPS=30` | encode fps |
| `LIVE_DEMUX_CAST_BIND=0.0.0.0` | HTTP serve bind |
| `LIVE_DEMUX_CAST_PORT=8765` | local media port |
| `LIVE_DEMUX_CAST_LUT=` | optional .cube path applied on encode |

## Explicit only

Follow `scripts/live-demux/NO-AUTO-LAUNCH.md`:

- No cast on Grok start  
- No discovery spam unless `/cast list`  
- No opening Google Home / TV apps automatically  

## Ship checklist

- [x] Plan + TCL class specs  
- [x] `scripts/live-demux/cast-tv.sh` discover / serve / cast / desk / mosaic  
- [x] `/cast` slash + `/share` · `/mirror` aliases  
- [x] Device profile JSON (`tcl-google-uhd` + `hisense-google-uhd`)  
- [x] `cast-tv.sh doctor` (catt / ffmpeg / LAN / profile)  
- [x] LAN discovery: TCL Smart TV + Hisense sibling  
- [ ] Live motion mosaic (still-based mosaic works; live dual encode stretch)  
- [ ] XR headset profile (Quest browser cast)  
- [ ] Confirm exact TCL retail SKU from About screen  

## LAN discovery (2026-07-30)

| Name | catt model | IP | Notes |
|------|------------|-----|-------|
| **Smart TV** | **TCL Smart TV** | **192.168.0.5** | **primary** · Cast v12 · active input |
| GoogleTV3065 | Hisense SmartTV 4K FFM | 192.168.0.61 | sibling wall |
| Basement / Kitchen speakers | Nest Mini | — | audio |

```bash
export LIVE_DEMUX_CAST_DEVICE='Smart TV'
export LIVE_DEMUX_CAST_TV_MODEL=tcl-google-uhd
# optional: LIVE_DEMUX_CAST_UHD=1  LIVE_DEMUX_CAST_FPS=30  LIVE_DEMUX_CAST_LUT=/path.cube
```

Exact retail SKU still from the panel: **Settings → System → About → Model** → `LIVE_DEMUX_CAST_TV_SKU`.
