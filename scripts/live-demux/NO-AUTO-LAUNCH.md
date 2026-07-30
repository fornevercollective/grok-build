# live-demux · no magic launches (dev progress)

Auditors can read filters and refuse-lists. **Runtime must stay explicit.**

## Default: do not spawn

| Action | When it happens |
|--------|-----------------|
| still-server / hub | `/phone hub` or `phone-tether.sh start` only |
| browser to live.jpg | `/phone inspect open` only |
| ffplay lens windows | `/lens …` or `lens-popout.sh …` only |
| ffplay dual Continuity | `continuity-phone.sh dual` only |
| Terminal.app windows | `deploy-fc-grok.sh --open` / launch-*.sh only |
| desk TUI you\|phone | `/cam phone` or `/phone` (TUI only) |
| MG `/wave` poll | only if `MG_WAVE_URL` is set |
| Cast to TCL / Chromecast | `/cast …` or `cast-tv.sh …` only |
| Independent ffplay tiles | `ffplay-tiles.sh load|place|close …` only |
| Camera relay (JPEG → hub/TV) | `cam-relay.sh start` or `cast-tv.sh box` (opt-out `LIVE_DEMUX_BOX_CAMS=0`) |
| News wall multi-feed + audio | `cast-tv.sh news` or phone **Start wall** only |

## Env guards

| Var | Meaning |
|-----|---------|
| `LIVE_DEMUX_AUTO_HUB=1` | bare `/phone` may start still-server (default **off**) |
| `LIVE_DEMUX_LENS_OPEN_DESK=1` | `/lens` also opens desk TUI (default **off**) |
| `LIVE_DEMUX_CAM_PHONE_STILL=1` | phone half uses HTTP still-pipe (default Continuity live) |
| `MG_WAVE_URL=…` | opt-in hub waveform poll |

## Never auto

- FaceTime.app / Camera.app / Photo Booth  
- Desktop capture devices  
- Screen Sharing sessions  
- Silent multi-window gallery on plugin load (session-start hook is banner-only)

Scripts that *do* launch (ffplay, hub) require a **subcommand or argv** — never a bare import or plugin install.
