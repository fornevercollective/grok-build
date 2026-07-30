---
name: watch
description: >
  /watch live demux half-block TTY video (news, VEVO, trailers shuffle, X broadcasts).
  Triggers: /watch, /gmux, live demux, movie trailers, bloomberg, vevo, cam side pane,
  pop-out ffplay, x.com live, golive.
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
/watch https://x.com/zanelowe/media          # X profile Media tab (video playlist)
/watch popout https://x.com/zanelowe/media  # same → external ffplay
/cam                 # large self-view + stream
```

Keys: Space pause · n/p next · **s** shuffle · g guide · / search · c cam · o pop-out · U X go-live · Esc quit.

Deps: `yt-dlp`, `ffmpeg` (+ `ffplay` for pop-out). Cookies: `YTDLP_COOKIES_FROM_BROWSER=safari`  
X `/user/media` feeds: GraphQL expand via `scripts/live-demux/x-media-feed.py` (needs x.com login cookies).
