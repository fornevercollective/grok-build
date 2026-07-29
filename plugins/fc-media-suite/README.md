# fc-media-suite · fornevercollective

**Version:** `0.1.0` · **Feature pack:** watch · cam · clock · map

Installable Grok plugin + doctor for the fornevercollective **media wall**.
The slash surfaces live in the **fork binary**; this pack makes them
discoverable, documentable, versioned, and updatable like a team plugin.

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
# real Terminal (not agent non-TTY)
cd ~/Projects/grok-build   # or wherever you cloned the fork
bash scripts/launch-watch.sh
# then:
/watch bloomberg
/cam
/clock
/map starbase
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

| Slash | Feature id | In-TTY | Pop-out |
|-------|------------|--------|---------|
| `/watch` | `fc-live-demux-v1` | half-block live demux | `o` · ffplay |
| `/cam` | same | PiP / large self-view | `/cam popout` |
| `/clock` | `fc-timesync-v1` | Zulu · markets · NTP | standalone Python |
| `/map` | `fc-maptrace-v1` | ASCII map + hops | maptrace TUI/web |
| `/gboom` | `fc-halfblock-tty-video` | half-block game | — |

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
