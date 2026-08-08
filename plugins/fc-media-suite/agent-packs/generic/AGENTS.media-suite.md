# AGENTS · fc-media-suite (fornevercollective)

Media wall slash tools work **outside Grok** via the universal CLI **`fcs`**.

## When the user says /watch, /cam, /clock, /map, …

Run shell (do not reimplement):

```bash
fcs watch [args…]      # or: fcs /watch …
fcs cam
fcs clock --once       # agent-safe one-shot
fcs map popout [host]
fcs webgrid popout
fcs optical
fcs lens [bug|360|…]
fcs phone start
fcs cast list|url|…
fcs tiles list|load|…
fcs doctor
```

## Modes

- **Agent / non-TTY:** `fcs` defaults to pop-out / standalone (no hung TUI).
- **Interactive Terminal + FC binary:** `fcs watch` can open Grok TUI half-block.
- Force: `fcs watch --tui …` · `fcs watch popout …` · `FCS_MODE=popout`

## Install if missing

```bash
bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install
```

PATH: `~/.local/bin/fcs`  
Shell slash: source `~/.local/share/fc-media-suite/shell/fcs.zsh` (then `/watch` works in zsh).

## Ports

Soft Path owns **8765/8766**. Memory Glass arena **8787**. Do not steal Soft Path ports.
