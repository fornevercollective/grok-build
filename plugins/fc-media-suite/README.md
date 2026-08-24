# fc-media-suite · fornevercollective

**Version:** `0.2.4` · **Feature pack:** watch · cam · clock · map · preserve · universal `fcs`

Installable Grok plugin + **universal CLI** for the fornevercollective **media wall**.
Slash surfaces work in the **fork binary**, in **any standard terminal**, and from
**any AI agent** via `fcs` (not Grok-only).

| | |
|--|--|
| **Git** | https://github.com/fornevercollective/grok-build |
| **Plugin path** | `plugins/fc-media-suite` |
| **Install** | one-liner below |
| **Credits** | [CREDITS.md](./CREDITS.md) |
| **Changelog** | [CHANGELOG.md](./CHANGELOG.md) |

## Install (fast)

```bash
# A · one-liner (plugin + binary doctor + optional build)
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash

# B · Grok CLI (plugin only; binary must already be the FC fork)
grok plugin marketplace add fornevercollective/grok-build
grok plugin install fornevercollective/grok-build#plugins/fc-media-suite --trust
grok plugin enable fc-media-suite

# C · direct path (this repo checked out)
grok plugin install ./plugins/fc-media-suite --trust
```

## Up in under a minute (after install)

```bash
# universal — any terminal, any AI agent shell
fcs watch bloomberg
fcs watch popout cnn
fcs cam
fcs clock
fcs map starbase
fcs preserve probe
fcs doctor

# after shell hook (source ~/.zshrc): same slash names outside Grok
/watch bloomberg
/cam
/clock
/map starbase

# optional: Grok TUI half-block (real Terminal + FC binary)
cd ~/Projects/grok-build
bash scripts/launch-watch.sh
```

## Update (dev-team style)

```bash
# plugin pack + skills
grok plugin update fc-media-suite

# fork binary (feature stamps)
cd ~/Projects/grok-build && git pull --ff-only origin main
cargo build -p xai-grok-pager-bin --release
# or: bash plugins/fc-media-suite/scripts/update.sh
```

Pinned installs (ops / require_sha):

```bash
grok plugin install fornevercollective/grok-build#plugins/fc-media-suite@v0.1.0 --trust
```

## What you get

| Slash | `fcs` | Feature id | In-TTY | Pop-out |
|-------|-------|------------|--------|---------|
| `/watch` | `fcs watch` | `fc-live-demux-v1` | half-block live demux | `o` · ffplay |
| `/cam` | `fcs cam` | same | PiP / large self-view | cam-popout |
| `/clock` | `fcs clock` | `fc-timesync-v1` | Zulu · markets · NTP | standalone Python |
| `/map` | `fcs map` | `fc-maptrace-v1` | ASCII map + hops | maptrace TUI/web |
| `/webgrid` | `fcs webgrid` | `fc-webgrid-tty-v1` | ugrad chase | browser |
| `/lens` | `fcs lens` | `fc-lens-bug-v1` | — | lens-popout |
| `/cast` | `fcs cast` | `fc-cast-tv-v1` | — | Chromecast / TCL |
| `/gboom` | `fcs gboom` | `fc-halfblock-tty-video` | half-block game | — |
| `/preserve` | `fcs preserve` | `fc-preserve-etcher-v1` | Etcher 3-step / CLI backup | vault + linux-gate |

**Multi-CLI AI (Arena-mapped):** `fcs install agents` / `fcs update` installs one skill hub and **symlinks** it into every terminal CLI skill dir (Claude, Codex, Cursor, Grok, Qwen, Gemini, Continue, OpenCode, Aider, Hermes, …).  

- Registry: `agent-packs/cli-registry.tsv`  
- Arena models: https://arena.ai/leaderboard/agent  
- Hub (live from repo): `~/.local/share/fc-media-suite/skills/fc-media-suite` → `agent-packs/generic`  
- Refresh after `git pull`: **`fcs update`**

## Doctor

```bash
bash plugins/fc-media-suite/scripts/doctor.sh
# or after install:
bash ~/.grok/plugins/*/scripts/doctor.sh 2>/dev/null || true
```

Exits non-zero if the active `grok` / `xai-grok-pager` binary lacks FC feature stamps.

## Ecosystem keywords (marketplace discovery)

`spacexai` · `xai` · `grok` · `spacex` · `x.com` · `tesla` · `neuralink` · `starbase` · `sbx` · `elon`

## License / credits

See [CREDITS.md](./CREDITS.md). Base harness: xAI. Media suite: fornevercollective.
