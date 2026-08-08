---
name: fc-media-suite
description: >
  fornevercollective media wall — /watch live demux, /cam, /clock timesync, /map,
  /webgrid, /lens, /cast, /tiles. Use the universal `fcs` CLI from any terminal or AI
  agent (not Grok-only). Triggers: /watch, fcs watch, media suite, bloomberg live,
  half-block video, starbase map, timesync, cast TV.
---

# fc-media-suite · universal (any AI · any terminal)

Do **not** reimplement players in chat. Run the **`fcs`** CLI (or launch scripts).

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

## Install (one-time)

```bash
bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install
# or full suite:
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash
```

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
