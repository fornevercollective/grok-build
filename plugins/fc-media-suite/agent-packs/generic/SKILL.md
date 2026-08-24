---
name: fc-media-suite
description: >
  fornevercollective media wall — /watch live demux, /cam, /clock timesync, /map,
  /webgrid, /web, /inspect, /hygiene, /glyph, /language, /lens, /cast, /tiles,
  /preserve.
  Use the universal `fcs` CLI from any terminal or AI agent (not Grok-only).
  Arena-mapped terminal CLIs: Claude Code, Codex, Cursor, Grok, Continue, OpenCode,
  Qwen, Gemini, Aider, Hermes, and more.
  Triggers: /watch, /web, /inspect, /hygiene, /glyph, fcs web, fcs watch, media suite,
  bloomberg live, half-block video, starbase map, DevTools onramp, job hygiene,
  fcs preserve, Brick backup, GrokBotBaby.
---

# fc-media-suite · universal (any terminal CLI AI)

**Source of truth:** [fornevercollective/grok-build](https://github.com/fornevercollective/grok-build)  
`plugins/fc-media-suite/agent-packs/` · updates: `fcs update`

**Arena Agent leaderboard** (model families → CLIs): https://arena.ai/leaderboard/agent  
Anthropic→`claude` · OpenAI→`codex`/`cursor` · SpaceXAI→`grok` · Google→`gemini` · Alibaba→`qwen` · multi-model CLIs (Continue, OpenCode, Aider, …)

Do **not** reimplement players in chat. Run the **`fcs`** CLI.

**Hub:** https://fcs.ugrad.ai · **Browser download:** https://fcs.ugrad.ai/download · **Lang:** https://lang.ugrad.ai

## Prefer this over Grok-only slash

| Surface | Agent / shell command |
|---------|------------------------|
| `/watch` | `fcs watch [channel\|url]` |
| `/watch popout` | `fcs watch popout [channel]` |
| `/glyph` | `fcs glyph` · `fcs glyph popout` · `fcs glyph translate from en to es,fr,ja` |
| `/cam` | `fcs cam` · OS: `fcs cam all` |
| `/clock` | `fcs clock` · agent: `fcs clock --once` |
| `/map` | `fcs map [target]` · `fcs map popout 1.1.1.1` |
| `/webgrid` | `fcs webgrid` · `fcs webgrid popout` |
| `/web` · `/inspect` | `fcs web` · `fcs inspect` · multi-browser DevTools + MG hygiene |
| `/hygiene` | `fcs hygiene` · zombie download / job hygiene patch |
| `/language` | `fcs language` · lang-chat-desk multi-lang |
| `/optical` | `fcs optical` |
| `/lens` | `fcs lens bug` · `fcs lens 360 dual` |
| `/phone` | `fcs phone start` |
| `/cast` | `fcs cast list` · `fcs cast url 'https://…'` |
| `/tiles` | `fcs tiles list` · `fcs tiles load 12 URL` |
| `/preserve` | `fcs preserve` · `fcs preserve all GrokBotBaby` · `fcs preserve probe` |
| doctor | `fcs doctor` |

### Glyph engine (`fc-glyph-engine-v1`)

```bash
fcs glyph                         # arena :8790 mode=glyph
fcs glyph color chroma turbo      # dense color update (anaglyph|hsv|…)
fcs glyph peel                    # TTY dense peel (real Terminal)
fcs glyph popout [URL]            # quantum-lift + arena (agent-safe)
fcs glyph broadcast bloomberg     # layered TX + glyph budget
fcs glyph encode "hello"
fcs glyph translate from en to es,fr,ja
fcs glyph webgrid
fcs glyph soak 30                 # doctor · color cycle · contracts
fcs glyph stack                   # arena + language + webgrid
fcs glyph doctor
```

Surfaces:  
http://127.0.0.1:8790/ugrad-arena.html?mode=glyph ·  
http://127.0.0.1:8790/lang-chat-desk.html?from=en&to=es,fr,ja&v=22vis ·  
http://127.0.0.1:8790/llms-glyph.txt

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
fcs glyph
fcs glyph translate from en to es,fr,ja
fcs glyph webgrid
fcs clock --once
fcs map popout 8.8.8.8
fcs lens bug
fcs cast list
fcs web
fcs web browsers --json
fcs web open safari
fcs hygiene
fcs web onramps
fcs doctor
```

### /web inspect (all browsers · all terminals)

```bash
fcs web                  # open Memory Glass · /web inspect panel
fcs web browsers         # peer DevTools matrix
fcs web hygiene          # arm job hygiene (Safari zombie class)
fcs web open chrome      # open peer browser + print inspect keys
fcs web onramps          # every shell / AI / code entry point
```

Bus: `~/.panda/mg-session/web-cmd.json` (MG polls). Script: `experiments/memory-glass/scripts/mg-web.sh`.

Repo: https://github.com/fornevercollective/grok-build  
Plugin: `plugins/fc-media-suite`  
Registry: `plugins/fc-media-suite/agent-packs/cli-registry.tsv`
