# Field trigger loop · browser glitch → MG strength

**Rule:** random field findings (Safari zombie download, paste garbage, peer browser footguns) become **triggers** that arm product patches. Iterate forever; never only “file and forget.”

## Loop

```
observe (any browser)
  → name the failure class
  → add field trigger (learn)
  → patch in hotpipe (job-hygiene / mitigations / web-inspect)
  → soakProbe + overnight
  → competitive note (we excel here)
  → next glitch
```

## First trigger (shipped)

| Field | Safari symptom | MG product |
|-------|----------------|------------|
| **Zombie download** | `*` filename · **Preparing to download** forever · cancel/clear dead · linked to nothing | `job-hygiene.js` · mitigation `zombie_download` · `/web hygiene` |
| **Multi-line paste + buried URL** | Terminal paste with noise lines + URL mid-block | `sanitizePaste` → first URL · `extractUrls` |
| **Blob download storm** | Many blob: downloads in seconds | `blobSpool` rate-limit (6 / 3s) |
| **Reload mid-download** | Navigate away while preparing/transfer | `onReloadGuard` fails open jobs |
| **iframe download flood** | Nested frames spam downloads | `allowIframeDownload` rate-limit |

### Invariants MG enforces (advantage)

1. No UI job without `id` + `cancel_token`  
2. **Preparing** has hard TTL (default 8s) → fail + remove  
3. **Cancel always works** even if network handle is gone  
4. Filename `*` / empty / path junk **rejected** or sanitized  
5. Terminal paste into omnibox: strip ANSI/C0, reject lone `*`  

## Commands

| Command | Effect |
|---------|--------|
| `/web` or `/inspect` | Open `/web inspect` panel |
| `/web browsers` | Peer DevTools matrix (Safari·Chrome·FF·Arc·Orion·Edge·Ladybird) |
| `/web hygiene` | Arm job hygiene + job list |
| `/web learn` | Field trigger log |
| `/web pack` | Export markdown pack for Grok Build |
| `/web soak` | soakProbe (star paste cases) |

### Universal onramps (any terminal · any AI · any code)

```bash
fcs web
fcs /web
fcs inspect
fcs hygiene
fcs web browsers --json
fcs web open safari|chrome|firefox|edge|arc|orion|brave
fcs web onramps
bash experiments/memory-glass/scripts/mg-web.sh …
```

| Surface | Entry |
|---------|--------|
| zsh/bash slash | `/web` after `fcs install shell` |
| Claude Code | `/fc-web` or `fcs web $ARGS` |
| Codex · Cursor · Grok · … | `fcs install agents` then `fcs web` |
| MG Grok terminal | `/web` · `/inspect` · `/hygiene` |
| Bus | `~/.panda/mg-session/web-cmd.json` (MG polls ≤1.5s) |

Grok terminal float or:

```js
__mgLazy.need("webInspect", () => __mgWebInspect.open())
__mgLazy.need("hygiene", () => __mgJobHygiene.soakProbe())
```

## Files

| Path | Role |
|------|------|
| `hotpipe/job-hygiene.js` | Download/nav job state machine |
| `hotpipe/web-inspect.js` | Multi-browser inspect + learn UI |
| `hotpipe/mitigations/zombie_download.js` | Auto-arm on error text match |
| `src/main.rs` `mitigation_for_error` | matches preparing/zombie/`*` |

## Next triggers (queue)

- Double-download race on reload mid-transfer  
- Quarantine / open-after-download path (lab dir only)  
- Unbounded `a.download` blob storms → spool meter  
- Omnibox multi-line terminal paste with URLs buried in logs  
- iframe `allow-downloads` storms from data-bench  

Each gets: `learn({ kind })` → mitigation or hygiene rule → competitive one-liner.

## Grok Build / xai-grok-build

Use exported packs (`/web pack`) in agent sessions to speed diagnosis. Peer browser matrix teaches **how to open DevTools everywhere** while MG remains the instrumented training browser (IronLine budgets + hygiene).
