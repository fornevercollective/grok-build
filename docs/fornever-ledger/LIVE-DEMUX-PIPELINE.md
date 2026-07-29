# fornevercollective · Live demux pipeline (yt-dlp + ffmpeg → TTY / GY / blank)

| | |
|--|--|
| **Owner** | **fornevercollective** |
| **Feature id** | `fc-live-demux-v1` |
| **Repos** | [blank](https://github.com/fornevercollective/blank) · [GrokYtalkY](https://github.com/fornevercollective/GrokYtalkY) · grok-build half-block |
| **Not** | Full YouTube client · CDN broadcast · pre-extract whole VOD into RAM |

## Problem

Today:

| Surface | Behavior | Gap |
|---------|----------|-----|
| **Grok `VideoViewerState`** | Local file → **ffmpeg dump all frames** → play | No URL · no playlist · OOM on long media |
| **GBOOM / half-block** | Paint RGB/`▀` well | Not a demuxer |
| **blank** | Queue · yt-dlp resolve · HLS proxy · scrub intel | Browser player, not TTY ring |
| **GY `/watch` · stream-pub** | ffmpeg supervise · gyst · feeds | Not wired into Grok half-block player |

**Goal:** one **live demux handler** that can:

1. Resolve **YouTube playlist / watch URL** via yt-dlp (blank-style).  
2. **Pipe** current item through ffmpeg (not full extract).  
3. Feed a **ring buffer** of frames to half-block (or Kitty).  
4. Controls like a “music Friday stream” player:  
   - **Space** pause/resume  
   - **← / →** scrub (±N sec)  
   - **n / p** (or **↑ / ↓**) next / previous track in playlist  
5. Optionally fan-out to **GY stream-pub** / news-feed cards (metadata + caption), without reimplementing the mesh in Grok.

## Honesty boundary

| Is | Is not |
|----|--------|
| Local geometric TTY paint of **decoded** frames | Official YouTube embed API |
| Playlist index + seek via **restart demux at t=** | Perfect frame-accurate scrub on all CDNs |
| short ring (e.g. 2–4 s) + drop under load | Archive entire concert in memory |
| Spawn **external** yt-dlp/ffmpeg/gy | Grok hosts RTMP/CDN |

## Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│  PlaylistController                                              │
│  · entries[] from yt-dlp --flat-playlist -j                      │
│  · cursor, title, duration, id                                   │
│  · next/prev · open(index) · status line for HUD                 │
└───────────────────────────┬──────────────────────────────────────┘
                            │ current URL / id
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  StreamResolver  (blank ytdlp-api pattern)                       │
│  · yt-dlp -g / -f "bv*+ba/b"  (or -j for meta)                   │
│  · cookies optional: YTDLP_COOKIES / --cookies-from-browser      │
│  · cache resolved stream_url + expire_at                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │ direct / HLS URL
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  LiveDemux  (ffmpeg pipe · supervised child)                     │
│  · ffmpeg -ss SEEK -i URL -an -vf scale=W:H -r FPS               │
│          -f rawvideo -pix_fmt rgb24 pipe:1                       │
│  · OR mjpeg pipe for cheaper half-block decode                   │
│  · restart on seek / track change (kill process group)           │
│  · backpressure: if paint slow, drop oldest ring slots           │
└───────────────────────────┬──────────────────────────────────────┘
                            │ RGB24 frames + pts_ms
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  FrameRing  (N frames · known W×H)                               │
│  · push / pop / latest                                           │
│  · paint timing hooks → halfblock PaintTimings                   │
└───────────────────────────┬──────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   half-block ▀        Kitty PNG         GY stream-pub
   (Grok TUI)          (if protocol)     (optional fan-out)
```

### Control map (GBOOM-adjacent · “music Friday stream”)

| Key | Action |
|-----|--------|
| **Space** | Pause / resume demux (freeze paint; stop consuming or hold last frame) |
| **←** | Scrub **−** `SCRUB_SEC` (default 10) — restart demux at `max(0, t−S)` |
| **→** | Scrub **+** `SCRUB_SEC` — restart at `t+S` |
| **n** / **↑** | Next playlist entry |
| **p** / **↓** | Previous playlist entry |
| **q** / **Esc** | Stop demux · close viewer |
| **r** | Re-resolve stream (expired HLS) |

GBOOM keeps WASD/fire; **live demux** owns this map only while viewer is focused.

## Playlist example (your Friday stream)

```text
https://www.youtube.com/watch?v=jaCxgxTScjc&list=PLbAbqvKSxmj4
```

Resolve:

```bash
# flat playlist index
yt-dlp --flat-playlist -j --playlist-end 50 \
  'https://www.youtube.com/watch?v=jaCxgxTScjc&list=PLbAbqvKSxmj4'

# current item stream URL
yt-dlp -g -f 'bv*[height<=480]+ba/b' --no-playlist \
  'https://www.youtube.com/watch?v=jaCxgxTScjc'
```

Then demux:

```bash
# live RGB24 pipe (example — W/H even for half-block)
ffmpeg -hide_banner -loglevel error -reconnect 1 -reconnect_streamed 1 \
  -ss 0 -i "$(yt-dlp -g -f 'bv*[height<=480]/b' --no-playlist URL)" \
  -an -vf 'scale=160:90' -r 12 -f rawvideo -pix_fmt rgb24 pipe:1
```

## Leverage existing stacks

### blank ([fornevercollective/blank](https://github.com/fornevercollective/blank))

- `support/ytdlp-api.mjs` — resolve + HLS proxy  
- `support/video-ingest.js` — queue, auto-resolve, preview  
- `support/live-concerts.mjs` — `--flat-playlist` discovery  
- `feed-intel.js` — waveform scrub UI pattern  

**Reuse:** resolve envelope + playlist flat-list + cookies story.  
**Do not:** re-run blank’s browser video element inside Grok.

### GrokYtalkY

- `media_supervisor.go` — single registry · process groups · no orphan ffmpeg  
- `social.go` — yt-dlp + lazy flat playlist  
- `stream_playback.go` — pause/play · rate · packet frames  
- `stream-pub` / type:gyst — mesh fan-out  

**Reuse:** supervisor + playback state machine + optional gyst publish of downscaled frames.  
**Boundary:** Grok **spawns** `gy` for mesh; does not reimplement hub.

### grok-build half-block

- `render/halfblock.rs` — paint RGB24 + **paint timings stamp**  
- `VideoViewerState` — replace full-file extract with **LiveDemux → FrameRing**  

## Phased delivery

| Phase | Ship | Done when |
|-------|------|-----------|
| **P0** | CLI demux smoke + playlist next/prev (scripts) | `scripts/live-demux/watch.sh URL` plays RGB → dump or halfblock harness — **done** (ffplay smoke; not in-TTY). `LIVE_DEMUX_MODE=auto` walks N tracks into null sink (agent-safe, no busy-spin). |
| **P1** | Rust `LiveDemux` + frame ring in pager-render | open URL · pipe · paint half-block · Space pause — **done** (`/watch`) |
| **P2** | PlaylistController + scrub restart | n/p · ←/→ · status HUD — **done**. Auto-skip dead tracks · soft stream cache (90 min) · more channels (lofi/synthwave/jazz/nasa). |
| **P3** | GY fan-out opt-in | `GY_HUB` + stream-pub of latest frame / captions |
| **P4** | blank queue bridge | open same playlist id · shared resolve cache |

### Try it (in Grok TUI)

```bash
# real Terminal.app / iTerm window (not agent non-TTY):
bash scripts/launch-watch.sh
# then:
/watch                 # VEVO Friday music TV (default)
/watch vevo            # same — skip tracks with n/p like a TV channel
/watch bloomberg       # Bloomberg Originals live (@business/live)
/watch cnn
/watch list            # all built-in news + music stations
/watch 'https://www.youtube.com/watch?v=jaCxgxTScjc&list=PLbAbqvKSxmj4'

# Pop-out (first-class · external ffplay OS window, not TTY half-block):
/watch popout bloomberg
/watch out cnn
/watch vevo --popout
# inside the TTY modal: press o
bash scripts/launch-watch.sh popout bloomberg

# side pane · broadcast timesync world clock (unix/epoch/drift · USNO tiers · markets)
bash scripts/launch-timesync.sh
# → docs/fornever-ledger/TIMESYNC-WORLD-CLOCK.md  (JSONL pipe for maptrace/gboom)
```

Named channels:

| Group | ids |
|-------|-----|
| Music TV | `vevo` `lofi` `synthwave` `jazz` |
| Movie trailers (shuffle) | `trailers` `movies` `cinema` `newtrailers` · **`s`** random · **`S`** toggle shuffle |
| News | `bloomberg` `cnbc` `cnn` `fox` `msnbc` `abc` `nbc` `cbs` `sky` `bbc` `aljazeera` `france24` `dw` `euronews` `nhk` `reuters` `pbs` |
| Specialty | `nasa` `weather` |

Free text becomes `ytsearch1:<words> live`.

**Music TV keys:** Space pause · `n`/`p` (or `]`/`[` / ↑/↓) next/prev track ·
auto-advance when a song ends · auto-skip on resolve fail · `←`/`→` scrub ·
**`o` pop-out** (external ffplay · stream) · **`Y`** selfie cam OS window ·
**`O`** all cams as Zoom tiles · Esc quit.

### Camera pop-out (Zoom-style chat tiles)

Local cameras open as real OS `ffplay` windows (drag/resize like a call):

| Slash / shell | Effect |
|---------------|--------|
| `/watch camout` · **`Y`** | Primary cam (`LIVE_DEMUX_CAM_DEVICE`, default FaceTime) |
| `/watch cameras` · **`O`** | Every real cam → **one window each** |
| `/watch mosaic` | Single **gallery grid** (`xstack`) |
| `/watch popout camera` | Same as camout |
| `bash scripts/live-demux/cam-popout.sh all` | Shell path (no TUI) |
| `bash scripts/live-demux/cam-popout.sh mosaic` | Gallery without Grok |
| `bash scripts/live-demux/cam-popout.sh 0 1` | FaceTime + Brick only |

AVFoundation usually **exclusive-locks** a device — turn off TTY PiP (`c`)
before popping the same index, or use another camera.

**Camera (GrokYtalkY multi-chat + 80×24):** press **`c`** for a compact **PiP
tile** (bottom-left), not a full-height column that steals the main stream.

| Budget | Tile (cols×rows of ▀) | Notes |
|--------|------------------------|--------|
| lean ≤80 wide / short pane | **13×7** (◎13) | `term-lean` · GY dual on 80×24 |
| roomier | **25×13** (25² half-block) | pin-rail aesthetic |
| wide ≥100×14 | side column optional | `LIVE_DEMUX_CAM_LAYOUT=side` |

Paint order: **stream full-bleed → cam PiP on top** (cam never obscured).
Popup fills **100%** of the agent pane on 80×24 (no wasted 90% margins when
`gy grok` leaves only the bottom slice). **`m`** mirrors. Capture: ffmpeg
`avfoundation` / `v4l2`; native mode **640×480** (FaceTime-safe).

```bash
bash scripts/launch-watch.sh camera bloomberg   # LIVE_DEMUX_CAM_ON=1
# LIVE_DEMUX_CAM_TILE=13|25   LIVE_DEMUX_CAM_LAYOUT=pip|side
```

**In-modal search (no Esc to main):** press **`/`** or **`f`** to focus the
search bar **under the video**. Type a channel (`bloomberg`), URL, or free-text
words · **Enter** loads via `switch_source` without leaving `/watch` · **Tab**
completes a built-in id · **Esc** unfocuses (second Esc closes the player) ·
`list` / `guide` opens the channel guide.

### X.com live (from + to)

**From x.com** (watch in TTY — yt-dlp `twitter` / `twitter:broadcast`):

```bash
/watch x                                          # search bar ready for paste
/watch 'https://x.com/i/broadcasts/1…'
/watch 'https://x.com/user/status/123…'
/watch x:1ynJOZQeqXqGR
# while watching anything:
#   /  → paste broadcast URL → Enter
```

Gated streams often need cookies:

```bash
export YTDLP_COOKIES_FROM_BROWSER=safari   # or chrome
# or X_COOKIES_FROM_BROWSER / X_COOKIES
```

**To x.com** (go live via [X Media Studio HLS](https://studio.x.com/producer)):

```bash
/watch golive          # start ~/Projects/x-media-studio-hls pipeline + open Producer
# in player: Shift+U
# then: ./bin/tunnel.sh → paste public …/hls/stream.m3u8 as HLS source → Go Live
```

Requires `~/Projects/x-media-studio-hls` (or `X_HLS_ROOT`). This does **not**
bypass X Studio; it starts the local encoder and points you at Producer.

**Agent smoke (no TTY):**

```bash
LIVE_DEMUX_MODE=auto LIVE_DEMUX_AUTO_MAX=3 \
  bash scripts/live-demux/watch.sh 'https://www.youtube.com/watch?v=jaCxgxTScjc&list=PLbAbqvKSxmj4'
```

Paint path is the same ladder as `/gboom`: half-block ▀ on any truecolor TTY.

## Implementation notes (why current demux “feels bad”)

1. **Full extract** — loading 50–150 PNG frames for every short clip; playlists explode.  
2. **No process group kill** — seek/track change leaves orphan ffmpeg (GY already solved this).  
3. **No resolve cache** — HLS URLs expire; blank re-resolve pattern needed.  
4. **Scrub = restart** — honest; seeking mid-HLS without restart is hard and CDN-dependent.  
5. **Intel TTY paint** — keep scale ≤ ~160×90 / 12 fps on older laptops; stamp p50/p95.  

## Env

| Variable | Role |
|----------|------|
| `YTDLP_COOKIES` | cookies.txt path (YouTube bot walls) |
| `LIVE_DEMUX_W` / `LIVE_DEMUX_H` | frame size (default 160×90) |
| `LIVE_DEMUX_FPS` | default 12 |
| `LIVE_DEMUX_SCRUB_SEC` | default 10 |
| `LIVE_DEMUX_RING` | frame ring depth (default 24 ≈ 2s @ 12fps) |
| `GY_HUB` | optional stream-pub fan-out |
| `HALFBLOCK_PAINT_TIMINGS` | stamp paint path while watching |
| `LIVE_DEMUX_CAM_DEVICE` | capture device (`0` mac / `/dev/video0` linux) |
| `LIVE_DEMUX_CAM_W` / `_H` | camera RGB size (default 80×90) |
| `LIVE_DEMUX_CAM_FPS` | camera rate (default 12) |
| `LIVE_DEMUX_CAM_FRAC` | left-column width fraction (default 0.32) |
| `LIVE_DEMUX_CAM_MIRROR` | selfie hflip (`1` default) |

## Success criteria (honest)

- [ ] Open playlist URL → first track paints in TTY within ~5–15s (resolve + first frames).  
- [ ] n/p changes track without zombie ffmpeg (`pgrep -x ffmpeg` clean after quit).  
- [ ] ←/→ restarts within scrub budget; UI shows `t≈` and title.  
- [ ] Space freezes display; resume continues (best-effort live; may jump).  
- [ ] Paint stamp optional; public claim stays local geometric, not “streams YouTube HD”.  

## Related

- [GBOOM-HALFBLOCK-PATCH.md](./GBOOM-HALFBLOCK-PATCH.md)  
- [GY-TTY-PLACEHOLDERS.md](./GY-TTY-PLACEHOLDERS.md)  
- blank `support/ytdlp-api.mjs` · `video-ingest.js`  
- GY `media_supervisor.go` · `stream_playback.go` · `social.go`  
