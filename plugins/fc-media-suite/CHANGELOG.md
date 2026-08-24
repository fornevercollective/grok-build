# Changelog · fc-media-suite

All notable releases of the **installable plugin pack** + coordinated fork binary stamps.

Format: Keep a Changelog · versioning: SemVer (`MAJOR.MINOR.PATCH`).

## 0.2.4 — 2026-08-24

### Preserve (`fc-preserve-etcher-v1`)

- First-class **`fcs preserve`** / **`/preserve`** — Etcher-shaped device backup / gated flash
- Inspired by Etcher UX, Phosphor `Manifest.db`, OpenExtract export, IntuneBrew per-app JSON — **not a fork**
- Default vault: `/Volumes/MacBookPro - Data/FC-Preserve` (never `~/Documents`)
- Aliases: **GrokBotBaby** (iPhone 7 Plus `iPhone9,4` D111AP / UDID `4ea7e05b…` / serial `FCDTR1N8HFY7` — linux-test, preserve then gated flash) · **Brick** (daily iPhone 14 class / Continuity — preserve only, never flash)
- Pipeline: backup → extract → catalog → SHA-256 chain of custody → `linux-gate.json`
- `ready: true` only when `backup_ok`, Manifest.db (or linux os-release), required domains, and hashes are all true
- Live line-based progress (`percent + MB/s + last file`); `idevicebackup2` `\r` flushed for `tail -F`
- Mini production: Personal Hotspot / USB-NCM (`en9` 169.254) diagnosis; backup2 `-4` / 255 resume into the same stamp; parallel AFC DCIM; iCloud Optimize Storage honesty
- Encrypted iOS backup via `FC_PRESERVE_BACKUP_PASSWORD` (unset = unencrypted)
- TTY: 3-step `fcs preserve` / `etcher` (no curses). Non-TTY: `fcs preserve all GrokBotBaby`
- Does not start Elffin, embed WebKit, or add a second GPU host

## 0.2.2 — 2026-08-08

### Glyph engine (`fc-glyph-engine-v1` · arena v1.7 color update)

- First-class **`/glyph`** · **`fcs glyph`** for every terminal CLI AI (Arena-mapped packs)
- `scripts/launch-glyph.sh` — arena · **color** · peel · popout/lift · broadcast · encode/decode · translate · webgrid · **soak** · stack · doctor
- **Color update:** modes `hybrid|luma|rgb|chroma|anaglyph|hsv` · heat `fc|turbo|viridis|magma` · URL `?color=&heat=` · BC `color_update`
- **Soak:** `fcs glyph soak 30` → `~/.panda/packs/glyph-soak-latest.json`
- Agent contracts: `scripts/glyph/llms-glyph.txt` · `data/glyph/manifest.json` on :8790
- Bridges: lang-chat-desk live translation · layered optical broadcast · webgrid chase
- Shell slash rewrite: `/glyph` in zsh/bash hooks
- Nested path retained: `/watch glyph` · `glyph-watch-popout.sh`

## [0.2.1] — 2026-08-08

### Added

- **Arena-mapped multi-CLI skill install** (`agent-packs/cli-registry.tsv` + `scripts/install-agents.sh`)
  - Terminal CLIs: claude, codex, cursor, grok, continue, openclaw, opencode, qwen, factory, hermes, pi, junie, kilocode, roo, trae, gemini, aider, goose, windsurf, amp, + any tool dir present on machine
  - Single hub: `~/.local/share/fc-media-suite/skills/fc-media-suite` → symlink into grok-build `agent-packs/generic`
  - Optional CLIs only installed when `~/.<tool>` already exists (no home pollution)
- **`fcs update`** / **`fcs agents status|list|install`** — pull/refresh all agent skills from grok-build
- `update.sh` re-links every CLI skill after git pull
- Arena reference: https://arena.ai/leaderboard/agent

## [0.2.0] — 2026-08-08

### Added

- **Universal CLI `fcs`** — same slash surfaces outside Grok:
  - any standard terminal (Terminal.app, iTerm, tmux, …)
  - any AI agent (Grok, Claude, Codex, Cursor, Aider, …) via shell
- Shell hooks (`scripts/shell/fcs.zsh` · `fcs.bash`): type `/watch bloomberg` in zsh/bash
- Multi-AI agent packs (`agent-packs/`):
  - `~/.agents` · `~/.claude/skills` + commands · `~/.codex` · `~/.cursor/rules`
  - generic `SKILL.md` + `AGENTS.media-suite.md`
- `fcs install [all|cli|shell|agents]` · install.sh step wires universal layer
- Agent-safe defaults: non-TTY → pop-out / `--standalone` / `--once`

### Commands

`fcs watch|cam|clock|map|webgrid|optical|lens|phone|cast|tiles|gboom|media|doctor|install`

## [0.1.0] — 2026-07-29

### Added

- Marketplace plugin `fc-media-suite` with skills + slash command docs for:
  - `/watch` · `/gmux` · `/tv` · `/live` (`fc-live-demux-v1`)
  - `/cam` PiP + OS pop-out (`cam-popout`)
  - `/timesync` · `/clock` · `/zulu` (`fc-timesync-v1`)
  - `/map` · `/maptrace` (`fc-maptrace-v1`)
- Half-block TTY video path (`fc-halfblock-tty-video`) documented for `/gboom` + watch.
- One-liner install + doctor + update scripts.
- Credits, version file, fornevercollective marketplace catalog.
- Discovery keywords for SpaceXAI / x.com / SpaceX / Tesla / Neuralink / Grok.

### Binary coordination

Requires fornevercollective `xai-grok-pager` (or `grok`) with feature strings:

`fc-live-demux-v1` · `fc-timesync-v1` · `fc-maptrace-v1` · `fc-halfblock`

Doctor: `plugins/fc-media-suite/scripts/doctor.sh`
