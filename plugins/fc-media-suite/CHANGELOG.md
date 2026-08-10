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

# Changelog · fc-media-suite

All notable releases of the **installable plugin pack** + coordinated fork binary stamps.

Format: Keep a Changelog · versioning: SemVer (`MAJOR.MINOR.PATCH`).

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
