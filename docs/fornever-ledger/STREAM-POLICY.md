# Stream policy · scaled feeds · TV-native offload

Keep the **control Mac** light. Put multi-feed decode on the **TV** (Google TV WebView / future native PWA). Desk only sends minor tweak commands.

## Problem

18× news tiles at full resolution on the hub machine will thrash CPU/GPU/network. Mosaic cells are ~320×360 CSS pixels on a 6×3 @ 1080p panel — they never need 720p/1080p decode.

## Roles

| Role | Default mode | Who decodes |
|------|----------------|-------------|
| **control** (Mac / phone desk) | `economy` | Max **1** live embed (PGM). Rest = posters. |
| **tv** (DashCast / `/tv` PWA) | `tv-native` | TV WebView decodes up to budget (default **6** live at tile-capped height). |

## Modes (`stream-policy.json`)

| Mode | max_live | PGM height | Use |
|------|----------|------------|-----|
| `economy` | 1 | 360p | Mac safe default |
| `balanced` | 3 | 480p | Light multi-view |
| `tv-native` | 6 | 720p cap | **Offload to TV** |
| `studio` | 9 | 720p | Explicit desk-heavy (warn) |

Heights are **capped by tile size** (`panel / grid`). A 6×3 cell cannot request 720p.

## Plan API

```text
GET  /api/stream/policy          # full policy + live overrides
GET  /api/stream/plan?role=tv    # per-feed decode + height + budget
POST /api/stream/cmd             # light control → TV
POST /api/stream/policy          # set mode_control / mode_tv / paused / quality_delta
```

Example plan feed row:

```json
{
  "id": "cnn",
  "role": "pgm",
  "decode": "embed",
  "height": 360,
  "width": 640,
  "fps": 24,
  "bitrate_kbps": 800,
  "tile": { "w": 320, "h": 360 }
}
```

`decode`: `embed` | `lite` | `poster`

## Control commands (desk → TV)

No recast required for these:

| cmd | Effect |
|-----|--------|
| `set_mode` | `economy` / `balanced` / `tv-native` / `studio` |
| `set_pgm` / `set_iso` | Program / isolate channel |
| `set_budget` | Override `max_live` |
| `pause_all` / `resume` | Tear down / restore live embeds |
| `bump_quality` / `drop_quality` | Shift height one ladder step |
| `layout` | cols/rows (recomputes tile caps) |
| `duck` | Audio duck flag |
| `reload` | Soft reload token |

```bash
# desk: economy
curl -sX POST http://LAN:8765/api/stream/cmd \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"set_mode","mode":"economy","role":"control"}'

# TV: native wall
curl -sX POST http://LAN:8765/api/tv/recast \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://LAN:8765/tv?tv=1&pwa=1"}'

# tweak without recast
curl -sX POST http://LAN:8765/api/stream/cmd \
  -d '{"cmd":"set_pgm","program":"bbc"}'
curl -sX POST http://LAN:8765/api/stream/cmd -d '{"cmd":"drop_quality"}'
curl -sX POST http://LAN:8765/api/stream/cmd -d '{"cmd":"pause_all"}'
```

## TV PWA scaffold

| URL | Role |
|-----|------|
| `/tv?tv=1&pwa=1` | TV-native shell (hosts news wall, polls cmds) |
| `/news?tv=1` | News wall directly on TV |
| `/news` (control) | Desk UI — economy by default |
| HTTPS `:8766` + SW | Installable shell (trust cert once via `/setup.html`) |

Manifest shortcut: **TV native wall**. Service worker caches `/tv` shell; never caches `/api/*`.

### Target architecture (next)

```
┌──────────── control Mac ────────────┐     light JSON cmds
│  economy UI · timesync · L3 inject  │ ──────────────────► ┌──────────────────┐
│  NO multi-1080p decode              │                     │  Google TV PWA   │
└─────────────────────────────────────┘                     │  tv-native plan  │
                                                            │  HW decode tiles │
        future: yt-dlp → ffmpeg ladder 144/240/360/480      │  scaled by cell  │
        only for PGM if embed blocked                       └──────────────────┘
```

## News control chrome

- **stream mode** select · **LQ/HQ** · **Pause feeds** · **TV native** (recast `/tv`)
- Tile badge: `poster` | `lite · 240p` | `embed · 360p@24`
- Meta line: `live 1/1 · ~0.8Mbps · economy · control`

## Honest limits (v1)

- YouTube **@handle** live URLs need `channel_id` / `video_id` in catalog for real embeds; without them tiles stay **poster** (still correct for budget).
- CSS scaling alone does **not** reduce decode cost — the plan **refuses** embeds beyond `max_live` and caps height by tile.
- True multi-HLS ladder is future (`future.hls_proxy` in policy JSON).
- Google TV “install PWA” varies by build; DashCast `cast_site` remains the reliable cast path until sideload/store shell.

## Files

- `scripts/live-demux/cast-align/stream-policy.json`
- `scripts/live-demux/cast-align/tv-shell.html`
- `align-hub.py` → `/api/stream/*` · `/tv`
- `news-wall.html` → plan-aware tiles
- `devices/tcl-google-uhd.json` → encode envelope (compose path)
