# AGENTS · fc-media-suite (fornevercollective)

Media wall slash tools work **outside Grok** via the universal CLI **`fcs`**.

Hub: https://fcs.ugrad.ai · Download: https://fcs.ugrad.ai/download · Lang: https://lang.ugrad.ai · Offline models: https://lang.ugrad.ai/data/language/models-offline.html

## When the user says /watch, /web, /inspect, /glyph, /cam, /clock, /map, …

Run shell (do not reimplement):

```bash
fcs watch [args…]      # or: fcs /watch …
fcs web                # /web inspect · multi-browser DevTools · MG job hygiene
fcs web browsers --json
fcs web hygiene
fcs web open safari    # peer browser + inspect keys
fcs web onramps        # every terminal/code entry
fcs inspect            # alias → fcs web inspect
fcs hygiene            # alias → fcs web hygiene
fcs glyph              # arena · peel · broadcast · translate · webgrid
fcs glyph popout
fcs glyph translate from en to es,fr,ja
fcs glyph broadcast bloomberg
fcs glyph stack
fcs cam
fcs clock --once       # agent-safe one-shot
fcs map popout [host]
fcs webgrid popout
fcs language
fcs optical
fcs lens [bug|360|…]
fcs phone start
fcs cast list|url|…
fcs tiles list|load|…
fcs preserve                 # non-TTY → all GrokBotBaby
fcs preserve probe
fcs preserve backup Brick    # daily iPhone 14 — never flash
fcs doctor
```

### Glyph (fc-glyph-engine-v1)

| Surface | URL |
|---------|-----|
| Arena | http://127.0.0.1:8790/ugrad-arena.html?mode=glyph |
| Translation | http://127.0.0.1:8790/lang-chat-desk.html?from=en&to=es,fr,ja&v=22vis |
| Contract | http://127.0.0.1:8790/llms-glyph.txt |

Honesty: lab BPS ≠ ARC % · Soft Path owns **8765/8766**.

## Modes

- **Agent / non-TTY:** `fcs` defaults to pop-out / standalone (no hung TUI).
- **Interactive Terminal + FC binary:** `fcs watch` / `fcs glyph peel` can open Grok TUI half-block.
- Force: `fcs watch --tui …` · `fcs watch popout …` · `FCS_MODE=popout`

## Install if missing

```bash
bash /Volumes/qbitOS/00.dev/projects/grok-build/plugins/fc-media-suite/scripts/fcs install
# or: bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install
```

PATH: `~/.local/bin/fcs`  
Shell slash: source `~/.local/share/fc-media-suite/shell/fcs.zsh`  
(then `/watch` · `/web` · `/inspect` · `/hygiene` · `/glyph` work in zsh).

## Ports

Soft Path owns **8765/8766**. Paper/lab glyph+lang+webgrid **:8790**. Layered preview **:8791**. Do not steal Soft Path ports.
