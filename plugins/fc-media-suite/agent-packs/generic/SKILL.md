---
name: fc-media-suite
description: >
  fornevercollective media wall — /watch live demux, /cam, /clock timesync, /map,
  /webgrid, /lens, /cast, /tiles. Use the universal `fcs` CLI from any terminal or AI
  agent (not Grok-only). Arena-mapped terminal CLIs: Claude Code, Codex, Cursor, Grok,
  Continue, OpenCode, Qwen, Gemini, Aider, Hermes, and more. Triggers: /watch, fcs watch,
  media suite, bloomberg live, half-block video, starbase map, timesync, cast TV.
---

# fc-media-suite · universal (any terminal CLI AI)

**Source of truth:** [fornevercollective/grok-build](https://github.com/fornevercollective/grok-build)  
`plugins/fc-media-suite/agent-packs/` · updates: `fcs update`

**Arena Agent leaderboard** (model families → CLIs): https://arena.ai/leaderboard/agent  
Anthropic→`claude` · OpenAI→`codex`/`cursor` · SpaceXAI→`grok` · Google→`gemini` · Alibaba→`qwen` · multi-model CLIs (Continue, OpenCode, Aider, …)

Do **not** reimplement players in chat. Run the **`fcs`** CLI.

## Prefer this over Grok-only slash

| Surface | Agent / shell command |
|---------|------------------------|
| `/watch` | `fcs watch [channel\|url]` |
| `/watch popout` | `fcs watch popout [channel]` |
| `/cam` | `fcs cam` · OS: `fcs cam all` |
| `/clock` | `fcs clock` · agent: `fcs clock --once` |
| `/map` | `fcs map [target]` · `fcs map popout 1.1.1.1` |
| `/webgrid` | `fcs webgrid` · `fcs webgrid popout` |
| `/optical` | `fcs optical` |
| `/lens` | `fcs lens bug` · `fcs lens 360 dual` |
| `/phone` | `fcs phone start` |
| `/cast` | `fcs cast list` · `fcs cast url 'https://…'` |
| `/tiles` | `fcs tiles list` · `fcs tiles load 12 URL` |
| doctor | `fcs doctor` |

## Agent rules

1. **Non-TTY / agent shells:** `fcs` auto-picks pop-out / `--standalone` / `--once`. Set `FCS_AGENT=1` if needed.
2. **Real Terminal only for half-block TUI:** if user wants in-TTY paint, tell them to run in Terminal.app:
   ```bash
   fcs watch bloomberg          # TTY + FC binary → Grok TUI
   fcs watch popout bloomberg   # always OS ffplay
   ```
3. Never claim slash works only inside Grok — universal path is **`fcs`**.
4. Missing CLI: `bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install`
5. Soft Path owns ports **8765/8766** — do not bind cast/paper/MG there.

## Install / update (from grok-build)

```bash
# one-shot: CLI + shell + every terminal AI skill
bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install

# refresh all CLI skills after git pull (hub is a symlink into the repo)
fcs update
# or:
bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/update.sh
bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/install-agents.sh update

# status
fcs agents status
fcs agents list
```

Skill hub: `~/.local/share/fc-media-suite/skills/fc-media-suite` →  
`plugins/fc-media-suite/agent-packs/generic` (live from checkout).

## Examples agents should run

```bash
fcs watch popout bloomberg
fcs watch popout 'https://x.com/zanelowe/media'
fcs clock --once
fcs map popout 8.8.8.8
fcs lens bug
fcs cast list
fcs doctor
```

Repo: https://github.com/fornevercollective/grok-build  
Plugin: `plugins/fc-media-suite`  
Registry: `plugins/fc-media-suite/agent-packs/cli-registry.tsv`
