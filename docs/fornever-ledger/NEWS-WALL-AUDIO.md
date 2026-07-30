# News wall · audio mix · DashCast latency · maptrace

## DashCast latency (refined)

| Problem | Mitigation |
|---------|------------|
| Heavy BOX 3D + cams every frame | **News wall** is a separate light surface (`/news`) |
| Multi-feed overtax on Mac | **Stream policy** — economy on control, `tv-native` offload on panel ([STREAM-POLICY.md](./STREAM-POLICY.md)) |
| Pose poll lag | `/api/viewer` 50ms + SSE `/api/viewer/stream` + `pose_seq` |
| Full-page recast expensive | Prefer **Refresh TV** / `POST /api/stream/cmd` tweaks over recast |
| Vendor WebView quirks | Status pipe records device profile for matrix later |

### Scaled feeds (quick)

```bash
# desk stays economy (1 live)
# TV does the wall:
bash scripts/live-demux/cast-tv.sh news   # or recast /tv?tv=1&pwa=1
curl -sX POST http://LAN:8765/api/stream/cmd -d '{"cmd":"set_mode","mode":"tv-native","role":"tv"}'
```

Phone control can stay on `/box` for vantage; program wall on `/news?tv=1`.

## Launch

```bash
export LIVE_DEMUX_CAST_DEVICE='Smart TV'
bash scripts/live-demux/cast-tv.sh news
# phone: http://LAN:8765/news
# TV:    http://LAN:8765/news?tv=1
```

## Spacing / organization

- Default grid **6×3** (18 feeds) from `news-catalog.json`
- Sort: region · cell · kind · A–Z
- Layout toggle: 6×3 → 4×3 → 3×3
- Tap tile = **program (PGM)** · long-press = **isolate (ISO)** channel

YouTube live URLs are cataloged; full HLS demux via yt-dlp/ffmpeg is the next hop for true multi-decode (ffplay tiles / encode compose). Wall first sets **look + spacing + control**.

## Audio waveform · EQ · ducking

Bottom strip:

| Control | Role |
|---------|------|
| **pgm** | Program / news emphasis |
| **lofi** | Background lofi bed (procedural for test) |
| **bed** | Soft news-style pad |
| **iso** | Isolated channel gain |
| **Duck** | Commercial / break duck — drops pgm, lifts lofi |
| **Lofi bed** | Toggle bed on/off |

Waveform = Web Audio `AnalyserNode` time-domain.

Later: real HLS audio taps per channel, commercial silence detection, NEWS stinger bed file.

## Maptrace / fleet pipe

```text
POST /api/status/pipe  →  ~/.panda/packs/cast-status.jsonl
                       →  ~/.panda/packs/maptrace-cast.jsonl
GET  /api/status       →  full snapshot (vantage, news, audio, devices)
```

`/map` and fleet tools can tail these for hops + cast surface state.

## Big version (next)

Room **point cloud / LiDAR** (phone / desk scan) + chat furniture measures → auto:

- TV height / center
- Seat distances
- Multi-user eyelines (you / partner / kid / dog)

Until then: house vantage cal (62" / 60.5") + per-phone Zero.

## Explicit only

No auto news launch on Grok boot — `cast-tv.sh news` or phone **Start wall** only.
