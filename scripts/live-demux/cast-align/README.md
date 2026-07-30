# Cast Align · numbered pixel chart

Test / placement grid for the TCL (or any Cast TV) wall.

## What you get

| Asset | Role |
|-------|------|
| **align-chart.html** | Interactive: change cols/rows/res, click or drag regions, export JSON/PNG |
| **gen-align.py** | Renders exact-resolution PNG + layout JSON (+ optional MP4) |
| **align-chart.json** | Cell map: `n`, chess label, `x,y,w,h` for item placement |

Features on the chart:

- Numbered cells (or **A1** chess / **r1c1**)
- Pixel rulers, center crosshair, red corner brackets (overscan check)
- Green **safe area** (~90% action)
- **Select** cells: click, shift-drag region, or type `1,2,5-8,A3`
- Export placement bbox + per-cell geometry for wall recipes

## Quick use — **interactive surface (default, not MP4)**

```bash
export LIVE_DEMUX_CAST_DEVICE='Smart TV'
export PATH="$HOME/.local/bin:$PATH"

# Interactive HTML via cast_site (DashCast) — phone controls TV selection
bash scripts/live-demux/cast-tv.sh align --select '1,2,5,8,12,A3'

# Phone/control surface (same hub):
#   http://<LAN>:8765/?control=1
# TV full-bleed surface:
#   http://<LAN>:8765/?tv=1

# Legacy static MP4 only if needed
bash scripts/live-demux/cast-tv.sh align-mp4
```

Hub: `align-hub.py` serves HTML + `/api/state` (phone push → TV long-poll).

### Devices · Chrome / Safari / Firefox

DevTools-style multi-browser support (not cam-relay):

| Surface | URL |
|---------|-----|
| **Devices lab** | `/devices` |
| **API** | `/api/devices` · `/api/devices/matrix` · `/api/devices/presets` |
| **Kit** | `/device-kit.js` (`FCDevice.detect()` / `applyEmulation`) |

```bash
# list presets (Chrome DevTools + Safari RDM + Firefox RDM + TCL/Hisense)
curl -s http://LAN:8765/api/devices/presets | jq '.presets[].id'

# emulate iPhone 14 Pro on news control
open 'http://LAN:8765/news?pwa=1&emulate=1&device=iphone-14-pro'
```

Also use real browser tooling:
- **Chrome** → DevTools → device toolbar (Ctrl/Cmd+Shift+M)
- **Safari** → Develop → Enter Responsive Design Mode
- **Firefox** → Responsive Design Mode (Ctrl/Cmd+Shift+M)

Engine gates (Safari gyro permission, HTTPS for getUserMedia) live in `devices/browser-matrix.json`.

### Stream budget · TV-native PWA

Do **not** multi-decode 18×1080p on the Mac. Use scaled plan + TV offload:

| Role | Default | Decode |
|------|---------|--------|
| Control `/news` | `economy` | 1× PGM max · rest posters |
| TV `/tv` or `/news?tv=1` | `tv-native` | Up to 6 live · height capped by tile |

```bash
# plan for TV
curl -s 'http://LAN:8765/api/stream/plan?role=tv' | jq '.budget,.feeds[0]'

# cast TV-native shell (panel decodes; desk only cmds)
curl -sX POST http://LAN:8765/api/tv/recast \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://LAN:8765/tv?tv=1&pwa=1"}'

# light tweaks (no recast)
curl -sX POST http://LAN:8765/api/stream/cmd -d '{"cmd":"set_pgm","program":"bbc"}'
curl -sX POST http://LAN:8765/api/stream/cmd -d '{"cmd":"drop_quality"}'
```

See [STREAM-POLICY.md](../../../docs/fornever-ledger/STREAM-POLICY.md).

### Lower thirds (L4 chrome) + live transcript

Timesync lives in the **lower-thirds broadcast info** strip (not the top edge) on `/box` and `/news`:

| Surface | L3 contents |
|---------|-------------|
| **BOX** | program bug · `fc-timesync-v1` · rolling caption lines · inject/demo (control) |
| **News wall** | PGM bug · timesync · last caption · above audio strip |

Live transcript bus (scaffold for blank captions · train themes · overview compare · vwall):

```bash
# inject a line
curl -sX POST http://LAN:8765/api/transcript \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello from desk","speaker":"PGM","project":"blank"}'

# demo seed (blank-style)
curl -sX POST http://LAN:8765/api/transcript/demo -d '{}'

# recent lines for L3
curl -s 'http://LAN:8765/api/transcript?limit=8'

# clear
curl -sX POST http://LAN:8765/api/transcript/clear -d '{}'
```

| Endpoint | Role |
|----------|------|
| `GET /api/transcript` | ring buffer · blank `captions[]` shape |
| `POST /api/transcript` | append / `action=demo|clear` · optional `project` |
| `GET /api/transcript/stream` | SSE for live L3 |
| pipe | `~/.panda/vision/cast/transcript.jsonl` (`CAST_TRANSCRIPT_PIPE`) |

Schema: `fc-transcript-v1` · fields `time`, `text`, `speaker`, `source`, `themes[]`, `project` (`blank` \| `train` \| `overview` \| `vwall` \| `grok-cli`).

Project hooks:
- [blank](https://github.com/fornevercollective/blank) — captions / scene intel
- [train](https://github.com/fornevercollective/train) — LFM2 transcript themes
- [overview](https://github.com/fornevercollective/overview) — whisper/caption compare columns
- [vwall](https://github.com/fornevercollective/vwall) — wall surface later
- [grok-cli](https://github.com/fornevercollective/grok-cli) — desk inject

Spatial research links (L6 later) in control chrome:
- [SuperMap](https://github.com/superxslam/SuperMap)
- [Parallel Stereo Visualization](https://csprofkgd.github.io/parallel-stereo-visualization/)
- [SHELLS](https://syntec-research.github.io/SHELLS/)

Grok slash (after deploy):

```text
/cast align
/cast align-ui
```

## Select syntax

| Token | Meaning |
|-------|---------|
| `7` | cell number 7 |
| `5-12` | inclusive range |
| `A3` | column A, row 3 (chess) |
| `r2c4` | row 2, column 4 |
| `1,2,A1,r3c3` | combine with commas |

## Placement JSON (excerpt)

```json
{
  "width": 1920,
  "height": 1080,
  "cols": 8,
  "rows": 4,
  "cells": [
    { "n": 1, "chess": "A1", "x": 28, "y": 28, "w": 233, "h": 256, "selected": true }
  ],
  "selected": [1, 2, 5],
  "selection_bbox": { "x": 28, "y": 28, "w": 466, "h": 256, "cells": [1, 2] }
}
```

Use `selection_bbox` or individual cells to place feeds/mosaic tiles.

## Env

| Var | Default | Role |
|-----|---------|------|
| `LIVE_DEMUX_CAST_ALIGN_COLS` | 8 | columns |
| `LIVE_DEMUX_CAST_ALIGN_ROWS` | 4 | rows |
| `LIVE_DEMUX_CAST_ALIGN_LABELS` | number | number \| chess \| rc \| both |
| `LIVE_DEMUX_CAST_ALIGN_SELECT` | | highlight cells |
| `LIVE_DEMUX_CAST_W` / `_H` | 1920×1080 | frame size |
| `LIVE_DEMUX_CAST_UHD=1` | | 3840×2160 |
| `LIVE_DEMUX_CAST_ALIGN_OPEN` | 1 | align-ui tries catt cast_site |
| `LIVE_DEMUX_CAST_ALIGN_BROWSER` | 1 | open local browser on align-ui |
