# FC Broadcast · Tile Plane (independent ffplay + wall + news + later chrome)

| | |
|--|--|
| **Owner** | fornevercollective |
| **Feature** | `fc-tile-plane-v1` |
| **Depends** | live-demux · x-media-feed · cast-tv · align-chart · GrokYtalkY livenews |
| **Not yet** | PIXERA-class media server · full Lark TV switcher · SAM/gsplat XR |

## The problem (one sentence)

We need **many** live surfaces (X media, news, cams, streams) that **move, load, close, and crash independently** of the Grok TUI / main bg, so mosaics can be rearranged live — then **compose** those tiles onto TCL cast walls and eventually **broadcast chrome** (lower thirds, bumpers, cut-to).

## What we already proved

| Layer | Status |
|-------|--------|
| X `/user/media` → GraphQL → status playlist → yt-dlp → ffplay | **works** (`x-media-feed.py`, watch popout) |
| Independent cam OS windows | **works** (`cam-popout.sh`) |
| Align numbered placement chart | **works** (`cast-align/`, `/cast align`) |
| TCL Chromecast wall encode | **works** (`cast-tv.sh`, profile `tcl-google-uhd`) |
| News theme cluster (captions / vision-take) | **partial** (GrokYtalkY `news-theme.js` + livenews) |
| Tour-scale LED mental model (Crash ~1008×576 @ 24fps cinematic) | **documented concept** (not product path) |

## Stack (leveled to Grok Web Build / status.x.ai posture)

Think **media server light**, not monorepo merge. Explicit launch only (NO-AUTO-LAUNCH).

```text
 ┌─────────────────────────────────────────────────────────────────┐
 │  L6  Spatial later · SAM / depth / gsplat / glass shaders       │
 │      (aito · ultralytics · graphcon-deck references)            │
 └─────────────────────────────▲───────────────────────────────────┘
 ┌─────────────────────────────┴───────────────────────────────────┐
 │  L5  News intelligence · caption/transcript · theme graph       │
 │      GrokYtalkY livenews · ECharts-style cluster (open)         │
 │      amCharts-class polish = paid later, not a v1 block         │
 └─────────────────────────────▲───────────────────────────────────┘
 ┌─────────────────────────────┴───────────────────────────────────┐
 │  L4  Broadcast chrome · lower thirds · bumpers · interstitials  │
 │      cut-to / spliced segments · Lark-TV switcher concept       │
 │      (graphcon-deck energy · later; not blocking tiles)         │
 └─────────────────────────────▲───────────────────────────────────┘
 ┌─────────────────────────────┴───────────────────────────────────┐
 │  L3  Cast / TV sink · TCL Google Smart TV · Rec.709 1080p30     │
 │      /cast · mosaic compose · align chart                       │
 └─────────────────────────────▲───────────────────────────────────┘
 ┌─────────────────────────────┴───────────────────────────────────┐
 │  L2  Composer · xstack stills/frames OR multi-window desktop    │
 │      desk dual · 2×2 mosaic · selection_bbox from align JSON    │
 └─────────────────────────────▲───────────────────────────────────┘
 ┌─────────────────────────────┴───────────────────────────────────┐
 │  L1  TILE PLANE  ←  fc-tile-plane-v1 (this feature)             │
 │      independent ffplay (or null) processes                     │
 │      load · place(cell) · move · close · crash-isolate · reap   │
 │      sources: url · x-media · cam · file · null                 │
 └─────────────────────────────▲───────────────────────────────────┘
 ┌─────────────────────────────┴───────────────────────────────────┐
 │  L0  Placement grid · align-chart numbers / chess / bbox        │
 │      people call out “stream on 12, Zane on A3”                 │
 └─────────────────────────────────────────────────────────────────┘
```

### Independence rules (hard)

1. **Main Grok bg / TTY demux never owns tile PIDs** — tiles are siblings, not children of the pager session when possible (`nohup` + registry).
2. **One tile crash ≠ wall crash** — each tile: own process group, log, workdir; reaper marks `dead` without killing others.
3. **Rearrange live** — `place id cell` moves window (`ffplay -left/-top` restart or osascript later); source keeps playing if same URL restart is acceptable v1.
4. **Explicit only** — no tile auto-spawn on Grok boot.

## Tour broadcast analogy (design, not hardware)

Charli **Crash** wall ~1008×576 @ **24 fps** cinematic is a useful **encode budget** for “billboard IMAG,” not sports sideboards:

| Tour idea | Our mapping |
|-----------|-------------|
| LED wall native res | Align frame 1920×1080 (cast) or UHD opt-in |
| 24 fps cinematic | `LIVE_DEMUX_CAST_FPS=24` or tile fps 12–24 |
| PIXERA multi-user layers | Tile plane registry + later L4 chrome |
| Dual LED + projection | Multi-device cast (`Smart TV` + Hisense sibling) |
| IMAG as design surface | Feed tiles into mosaic, not full-screen only |

We are **not** shipping ROE/PIXERA. We **are** shipping operator muscle memory: numbered cells + independent layers.

## L1 Tile plane API

```bash
bash scripts/live-demux/ffplay-tiles.sh list
bash scripts/live-demux/ffplay-tiles.sh load 12 'https://x.com/zanelowe/media'
bash scripts/live-demux/ffplay-tiles.sh load A3 'https://www.youtube.com/…'
bash scripts/live-demux/ffplay-tiles.sh place t1 7
bash scripts/live-demux/ffplay-tiles.sh move t1 100 80
bash scripts/live-demux/ffplay-tiles.sh close t1
bash scripts/live-demux/ffplay-tiles.sh close all
bash scripts/live-demux/ffplay-tiles.sh reap          # mark dead / clean pidfiles
bash scripts/live-demux/ffplay-tiles.sh status
bash scripts/live-demux/ffplay-tiles.sh from-select   # load slots for align selected cells
```

Registry: `~/.panda/vision/tiles/registry.json`

Each tile:

```json
{
  "id": "t12",
  "cell": 12,
  "source": "https://x.com/zanelowe/media",
  "kind": "x-media",
  "pid": 4242,
  "pgid": 4242,
  "x": 480, "y": 300, "w": 480, "h": 270,
  "status": "running",
  "started_at": 0,
  "log": "~/.panda/vision/tiles/t12/tile.log"
}
```

### Source kinds

| kind | Resolve |
|------|---------|
| `url` | yt-dlp `-g` → ffplay |
| `x-media` | `x-media-feed.py` expand → clip playlist walk |
| `cam` | avfoundation index (delegate cam-popout patterns) |
| `file` | local path |
| `null` | color generator (placeholder / crash test) |

## L5 News “all at once” + theme sort

**Already:** GrokYtalkY livenews + `news-theme.js` (keyword/vision-take themes).

**v1 test path (no amcharts license):**

1. Tile plane: spawn N news streams into cells (align 12×6 or 8×4).
2. Caption/transcript hooks → theme tags (existing hub types).
3. **Open viz:** Apache ECharts graph / treemap / radar in a **dashboard window** (browser) that **reads the same theme JSON** tiles emit — not embedded in ffplay.
4. **Paid viz later:** amcharts demos (sankey map, globe, sentence-cloud) only when budget says so; do not block tile plane.

Sort actions:

- `cluster theme` → reorder tile z-order / cell remap by theme
- `highlight theme=markets` → border/selection in align UI

## L4 Broadcast chrome (later, designed now)

| Asset | Role |
|-------|------|
| Lower third | Overlay PNG/WebVTT timed on compose |
| Bumper / interstitial | Short tile or full-frame takeover |
| Cut-to | Swap which tile is “program” vs “preview” |
| Splice | Playlist segments on one tile (watch n/p) |

**Program bus (future):** one “PGM” output (compose → cast) + many “PRV” tiles (desktop ffplay). Lark-TV / graphcon-deck inform the **control surface**, not the demux.

## L6 Spatial (later)

After SLAM / Segment Anything / depth (aito + ultralytics depth docs):

- Phone/VR as **sources into L1**, not magic launches
- gsplat panning as optional background plate under L2
- Glass shader look = compose grade, not tile isolation

## Explicit non-goals (v1)

- Killing main Grok when a tile dies
- Auto-launch of all news on session start
- Pixel-perfect tour LED emulation
- Replacing PIXERA
- amcharts paid dependency

## Ship checklist

- [x] Architecture (this doc)
- [x] `ffplay-tiles.sh` registry load/place/close/reap
- [x] Cell geometry from `align-chart.json`
- [x] X media as first-class tile kind (`x-media-feed.py`)
- [x] Skill + NO-AUTO-LAUNCH row
- [x] Smoke: two null tiles, close one, other survives
- [ ] Optional: emit theme JSON for livenews dashboard
- [x] L4 lower thirds scaffold: timesync in L3 + live transcript bus (`/api/transcript`, `fc-transcript-v1`)
- [ ] Later: full PGM bus + blank/train/overview auto-ingest into L3
- [ ] Later: multi-cast Hisense + TCL matrix

## Operator workflow (target)

1. `/cast align` — numbers on TCL / desk  
2. People call cells: “Zane media on **5**, CNN on **12**, you-cam on **A1**”  
3. `ffplay-tiles.sh load 5 'https://x.com/zanelowe/media'` …  
4. Rearrange: `place t5 9` without touching other tiles  
5. One tile crashes → `reap` + `load` again; wall continues  
6. `cast mosaic` / compose selected cells → TCL backdrop  
7. Later: lower third on PGM; news theme graph in browser beside wall  
