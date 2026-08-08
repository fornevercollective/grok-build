---
name: media-suite
description: >
  fornevercollective media wall — /watch live demux, /cam, /clock timesync,
  /map traceroute (Starbase). Universal via `fcs` CLI for any terminal and any AI
  (Grok, Claude, Codex, Cursor). Triggers: media suite, fcs watch, install watch
  clock map, fc-media-suite, half-block video, SpaceXAI/x.com/Grok ops surfaces.
---

# fc-media-suite · fornevercollective media wall

**Version:** read `plugins/fc-media-suite/VERSION`  
**Repo:** https://github.com/fornevercollective/grok-build  
**Credits:** `plugins/fc-media-suite/CREDITS.md`

## Universal first (any terminal · every CLI AI)

Slash tools are **not Grok-only**. Prefer the **`fcs`** CLI.  
Skills install into **Arena-mapped terminal CLIs** (Claude/Codex/Cursor/Grok/Qwen/Gemini/…) and stay linked to this repo.

```bash
fcs install                 # PATH + shell + every terminal CLI skill
fcs update                  # git pull grok-build + refresh all CLI skills
fcs agents status           # which CLIs have the skill
fcs watch bloomberg
fcs watch popout cnn
fcs cam
fcs clock --once            # agent-safe
fcs map popout starbase
fcs webgrid popout
fcs lens bug
fcs cast list
fcs doctor
```

Arena: https://arena.ai/leaderboard/agent · registry: `agent-packs/cli-registry.tsv`

After shell install, plain terminals also accept:

```bash
/watch bloomberg
/cam
/clock
/map starbase
```

Agents (Claude / Codex / Cursor / Grok / …) should **run `fcs …` via shell**, not reimplement players.

## Install / update

```bash
# install (plugin + fcs + shell + agent packs + optional binary)
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash

# universal layer only
bash plugins/fc-media-suite/scripts/fcs install

# Grok plugin
grok plugin install fornevercollective/grok-build#plugins/fc-media-suite --trust
grok plugin enable fc-media-suite

# update
bash plugins/fc-media-suite/scripts/update.sh
```

## Feature ids (doctor)

| Id | Slash | `fcs` |
|----|-------|-------|
| `fc-live-demux-v1` | `/watch` `/gmux` `/cam` | `fcs watch` · `fcs cam` |
| `fc-timesync-v1` | `/timesync` `/clock` | `fcs clock` |
| `fc-maptrace-v1` | `/map` | `fcs map` |
| `fc-halfblock-tty-video` | paint + `/gboom` | `fcs gboom` |
| `fc-webgrid-tty-v1` | `/webgrid` | `fcs webgrid` |
| `fc-optical-transfer-v1` | `/optical` | `fcs optical` |

```bash
fcs doctor
bash plugins/fc-media-suite/scripts/doctor.sh
```

## Launch modes

| Mode | When |
|------|------|
| **pop-out / standalone** | Agents, non-TTY, `fcs watch popout`, no FC binary |
| **Grok TUI half-block** | Real Terminal + fornevercollective binary · `fcs watch` / `launch-watch.sh` |

```bash
bash scripts/launch-watch.sh     # TUI /watch · /cam
bash scripts/launch-timesync.sh  # TUI /clock
bash scripts/launch-map.sh       # TUI /map
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

1. Prefer **`fcs <cmd>`** (universal) over reimplementing players in chat.
2. Non-TTY agent shells: `fcs` auto-picks pop-out / `--once` — no hung TUI.
3. Half-block in-TTY paint still needs real Terminal + FC binary stamps.
4. Do not claim official xAI marketplace listing unless verified.
5. Never park lab servers on Soft Path ports.

## Ecosystem discovery keywords

spacexai · xai · grok · spacex · x.com · tesla · neuralink · starbase · sbx · elon · fornevercollective · fcs
