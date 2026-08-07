---
name: media-suite
description: >
  fornevercollective media wall for Grok: /watch live demux, /cam, /clock timesync,
  /map traceroute (Starbase). Use when user says media suite, install watch clock map,
  fc-media-suite, fornevercollective media, half-block video, or wants SpaceXAI/x.com/Grok
  ops surfaces in the TUI. Versioned plugin pack with doctor + update.
---

# fc-media-suite · fornevercollective media wall

**Version:** read `plugins/fc-media-suite/VERSION`  
**Repo:** https://github.com/fornevercollective/grok-build  
**Credits:** `plugins/fc-media-suite/CREDITS.md`

## Install / update (agent should offer these)

```bash
# install
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash

# or
grok plugin install fornevercollective/grok-build#plugins/fc-media-suite --trust
grok plugin enable fc-media-suite

# update like a teammate
bash plugins/fc-media-suite/scripts/update.sh
# or: grok plugin update fc-media-suite && git pull && cargo build -p xai-grok-pager-bin
```

## Feature ids (doctor)

| Id | Slash |
|----|-------|
| `fc-live-demux-v1` | `/watch` `/gmux` `/cam` |
| `fc-timesync-v1` | `/timesync` `/clock` |
| `fc-maptrace-v1` | `/map` |
| `fc-halfblock-tty-video` | paint path for watch + `/gboom` |
| `fc-webgrid-tty-v1` | `/webgrid` offline ugrad chase (own slash) |
| `fc-optical-transfer-v1` | `/optical` · jawta light · blur fountain |

```bash
bash plugins/fc-media-suite/scripts/doctor.sh
```

## Launch (real TTY only)

```bash
bash scripts/launch-watch.sh     # /watch · /cam
bash scripts/launch-timesync.sh  # /clock
bash scripts/launch-map.sh       # /map starbase
```

## Ports (Soft Path owns 8765/8766)

| App | Port |
|-----|------|
| Soft Path (kid game) | **8765 + 8766 HTTPS** — exclusive |
| Memory Glass PWA / glyph arena | **8787** |
| Memory Glass webgrid | **9880** |
| Cast align / TV hub | **8791 + 8792** |
| Paper / lab experiments | **8790+** |

Do **not** bind 8765/8766 for cast, paper, or MG. See `docs/fornever-ledger/PORT-HANDOFF.md`.

## Agent rules

1. Prefer **in-Grok slash** over reimplementing players in chat.
2. Non-TTY agent shells cannot open the TUI — tell user to run launch scripts in Terminal.app.
3. Binary must be the **fornevercollective** build (feature stamps). Stock xAI binary will fail doctor.
4. Do not claim official xAI marketplace listing unless verified; third-party marketplace add is supported.
5. Never park lab servers on Soft Path ports.

## Ecosystem discovery keywords

spacexai · xai · grok · spacex · x.com · tesla · neuralink · starbase · sbx · elon · fornevercollective
