---
name: watch
description: >
  /watch live demux half-block TTY video (news, VEVO, trailers shuffle, X broadcasts).
  Triggers: /watch, /gmux, live demux, movie trailers, bloomberg, vevo, cam side pane,
  pop-out ffplay, x.com live, golive, glyph plant path, quantum-lift.
---

# /watch · fc-live-demux-v1

In-Grok: yt-dlp + ffmpeg RGB24 → half-block (or Kitty).  
Pop-out: **`o`** or `/watch popout …` → external ffplay.

```bash
bash scripts/launch-watch.sh
/watch
/watch bloomberg
/watch trailers      # shuffle movie trailers · s random · S toggle
/watch popout cnn
/watch optical       # optical blur TX as main surface (jawta + embed)
/watch optical light sos
/watch popout optical  # /watch optical + OS browser display
/optical             # same as /watch optical blur
/watch glyph         # plant glyph control plane (fc-glyph-watch-v1)
/watch glyph peel
/watch glyph https://…   # stream + glyph channel
/watch popout glyph      # quantum-lift ffplay + open arena Glyph form
/watch popout glyph 'https://…'
/watch q-lift URL        # alias
bash scripts/live-demux/glyph-watch-popout.sh [URL]
/watch https://x.com/zanelowe/media          # X profile Media tab (video playlist)
/watch popout https://x.com/zanelowe/media  # same → external ffplay
/cam                 # large self-view + stream
```

**Not a /watch channel:** offline webgrid chase is **`/webgrid`** (own slash · `scripts/launch-webgrid.sh`).

## Glyph plant path (`fc-glyph-watch-v1`)

Not optical TX (`/watch optical glyph` = fountain grid TX).  
`/watch glyph` = plant control plane · debate handoff · dense peel seat.

| Action | What happens |
|--------|----------------|
| `/watch glyph` | TTY dense grid · status HUD |
| **`o`** in modal | `glyph-watch-popout.sh` → quantum-lift ffplay + open `:8765` Glyph tools |
| `/watch popout glyph [URL]` | same without TTY |
| Path | yt-dlp → ffmpeg/ffplay (HW) → `last-lift.json` → multiplex Rubik/Bloch/glyph_dense/tensor |
| Arena | `http://127.0.0.1:8787/ugrad-arena.html?mode=glyph` (MG PWA · Soft Path owns **:8765**) |

Honesty: lab BPS ≠ ARC % · lift = control plane · peel owns dense map · race XOR peel.

Keys: Space pause · n/p next · **s** shuffle · g guide · / search · c cam · o pop-out (optical → OS browser · **glyph → quantum-lift+arena**) · U X go-live · Esc quit.

Deps: `yt-dlp`, `ffmpeg` (+ `ffplay` for pop-out). Cookies: `YTDLP_COOKIES_FROM_BROWSER=safari`  
X `/user/media` feeds: GraphQL expand via `scripts/live-demux/x-media-feed.py` (needs x.com login cookies).
