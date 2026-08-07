---
name: webgrid
description: >
  /webgrid offline ugrad chase on TTY half-block (our webgrid-ugrad build).
  Triggers: /webgrid, /wg, webgrid-ugrad, grid-chase, fc-webgrid-tty.
  Not nested under /watch or /gboom.
---

# /webgrid · fc-webgrid-tty-v1

Own slash — offline **webgrid-ugrad** chase (same BPS formula as `pwa/webgrid-ugrad.html`).  
Not Neuralink.com · not a `/watch` channel · not a `/gboom` mode.

```bash
bash scripts/launch-webgrid.sh
bash scripts/launch-webgrid.sh human 16
bash scripts/launch-webgrid.sh popout
/webgrid
/webgrid human 16
/webgrid turbo
/webgrid popout
/webgrid help
```

| Action | What happens |
|--------|----------------|
| `/webgrid` | TTY N×N blue-cell chase · agent ON · BPS HUD |
| `/webgrid human [N]` | human cursor |
| `/webgrid turbo` | lab uncap agent batch |
| **arrows / hjkl** | move cursor |
| **space / enter** | hit cell |
| **a** | toggle perfect agent |
| **r** | restart round |
| **`o`** / `/webgrid popout` | browser + Memory Glass → webgrid-ugrad.html |
| Page | `http://127.0.0.1:8790/webgrid-ugrad.html` (`:8787` fallback) |

## Toolchain

Agents / scripts open the same surface without the slash name:

```text
Action::OpenLiveWatch { url: "webgrid://agent" }
Action::OpenLiveWatch { url: "webgrid human 16" }
```

`webgrid://…` is resolved inside live-demux; bare `/watch webgrid` is **not** a channel.

Env: `LIVE_DEMUX_WEBGRID_N` · `_DUR` · `_URL` · `_FPS` · `_SEED`
