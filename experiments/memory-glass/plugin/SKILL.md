---
name: memory-glass
description: >
  Native macOS droplet browser (tao+wry WKWebView) with ofx/daito face track,
  inspect float, hot-pipe live.js, still-pipe phone cam, voice mute bridge,
  WebGrid agent, offline Ollama soak brief. Use for Memory Glass, glass HUD,
  WebGrid, codesign launch fails, or Mini cam-less bringup.
---

# Memory Glass · Grok Build plugin pack

## Absolute rules

1. **Never delete** user repos, model trees, or soak history.
2. After any `.app` binary or `Resources/` edit → `bash scripts/resign-app.sh`.
3. Prefer **hotpipe JS** for UX; **Rust** for window/IPC/native only.
4. Log breakage into `docs/fornever-ledger/BUG_BOUNTY_LEDGER.md` (append notes JSONL).
5. WebGrid BPS from **agent ≠ BCI implant** — label honestly.

## Ground running

```bash
cd experiments/memory-glass
bash build-mac-app.sh
open -n "$HOME/Applications/Memory Glass.app" --args "https://neuralink.com/webgrid/"

# still-pipe
python3 "$HOME/.panda/vision/still-server.py" &

# offline morning brief after soak
MG_LOCAL_LLM=1 bash scripts/overnight-soak.sh --hours 8

# WebGrid small (12×12) + local pace
python3 scripts/webgrid-collector.py &
MG_LOCAL_LLM=1 python3 scripts/webgrid-pace-advisor.py &
open -n "$HOME/Applications/Memory Glass.app" --args \
  "https://neuralink.com/webgrid/?mg_scale=small&mg_autoplay=1&mg_local_llm=1"
```

## Surfaces

| Surface | Role |
|---------|------|
| Main | WKWebView browser + LabViewRay lean |
| Inspect | Face mesh · meters RAM/GPU/Spool/FPS |
| Hotpipe | `hotpipe/*.js` mtime inject (~1s) |
| WebGrid | `webgrid-play.js` v19 · 12/30 scale · agent |
| Ledger | `docs/fornever-ledger/*` |

## Known ship-blockers (see ledger)

| ID | Issue |
|----|--------|
| MG-001 | Codesign SIGKILL without resign |
| MG-002 | Glass reassert storm (debounced) |
| MG-004 | Multi camera writers |
| MG-006 | Score scrape marketing pollution |

## Canonical docs

- `hotpipe/GOALS.md` · `SESSION_HANDOFF.md` · `ARCHITECTURE.md`
- `hotpipe/plans/OVERNIGHT_BROWSER.md` · `COMPETITIVE_HARD_TRUTH.md`
- `../../docs/fornever-ledger/ECOSYSTEM_MAP.md`
- `../../docs/fornever-ledger/BUG_BOUNTY_LEDGER.md`

## Year context

This app sits in a year-long fornevercollective stack: ugrad, qbitos-*, Mu, charm, blank, freya, GrokYtalkY, grok-build fork of xai-org. Agents should **learn and extend**, not replace or delete that history.
