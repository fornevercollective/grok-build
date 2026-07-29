# Social post · fc-media-suite 0.1.0

## Short (X / post)

```
fornevercollective media wall — inside Grok

/watch  live news · VEVO · X movie trailers → half-block TTY
/cam    PiP + Zoom-style pop-out
/clock  Zulu · markets · NTP
/map    traceroute world map · honest Starbase pin

In-TTY first. Pop-out second.

fc-live-demux-v1 · fc-timesync-v1 · fc-maptrace-v1 · fc-halfblock-tty-video

https://github.com/fornevercollective/grok-build
INSTALL: plugins/fc-media-suite · curl install in README
```

## Hashtag line (optional)

```
#live #news #VEVO #XMovieTrailers #Grok #SpaceXAI #Starbase #fornevercollective
```

## Table (README / Discord / GH)

| Surface | Feature id | What it does |
|---------|------------|--------------|
| `/watch` (`/gmux` `/tv` `/live`) | `fc-live-demux-v1` | yt-dlp + ffmpeg → half-block live player (news, VEVO, trailers) |
| `/cam` | same | Self-view PiP / large pane; `/cam popout` = Zoom-style OS window (ffplay) |
| `/timesync` (`/clock` `/zulu`) | `fc-timesync-v1` | Zulu · markets · NTP tier · unix/epoch/drift · JSONL pipe |
| `/map` (`/maptrace` `/geomap`) | `fc-maptrace-v1` | ASCII world map + traceroute · Starbase/SBX honesty · pop-out |
| half-block | `fc-halfblock-tty-video` | Portable TTY video paint for `/gboom` + watch (no Kitty required) |

## Install one-liner

```bash
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash
```
