# Persona · Tensor scaffold · Memory Glass × grok-build

**Product owner:** Memory Glass + fornevercollective/grok-build  
**Not:** qbitos marketing pages as source of truth (optional moniker shell only)

## Canonical paths

| What | Path |
|------|------|
| Hub HTML + JSON | `experiments/memory-glass/docs/persona-tensor/` |
| Loopback for MG DATA drawer | `http://127.0.0.1:8765/persona-tensor-scaffold.html` (serve `uvspeed/web` or symlink) |
| Strategy | `docs/fornever-ledger/PERSONA_TENSOR_PATH.md` |
| Fork GO/NOGO | `docs/fornever-ledger/FORK_CENSUS_GONOGO.md` |
| Growth brief | `experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md` |

## Metaphor stack

| Story | Role | Surface |
|-------|------|---------|
| Iron Man | Suit | Memory Glass + hotpipe |
| JARVIS | Ops | Grok TUI + Lab playpen |
| Ender | Arena | WebGrid + `/goal` |
| Blade Runner | Trust | Privacy patterns · worktrees |
| Personas | Cast | αβγ · subagents |
| Tensor | Score | BPS · contrail · KBatch · ugrad |

## Layers (useful only)

- **L0** Trust — worktree · privacy hard-off patterns  
- **L1** Harness — path-checkout shell 0.2.111+ · `/goal`  
- **L2** Day terminal — playpen · goal-engineering · oh-my loops  
- **L3** Browser body — MG · v32 contrails · still-pipe  
- **L4** Personas — panda αβγ · verifier roles  
- **L5** Tensor — WebGrid truth · contrail · KBatch · train bus  

## Open from Memory Glass

1. Serve tools host:  
   `cd /Volumes/qbitOS/00.dev/uvspeed/web && python3 -m http.server 8765 --bind 127.0.0.1`  
2. In MG: open `http://127.0.0.1:8765/persona-tensor-scaffold.html`  
   (DATA bench / right drawer local tools — same :8765 pattern as hexbench)  
3. Or open file:  
   `experiments/memory-glass/docs/persona-tensor/persona-tensor-scaffold.html`

## Day loop

Boot still-server + verify upstream → Grok worktree → `/goal` → hotpipe edits → WebGrid `mg_lab_full=1` → verify/resign → log BPS/contrail trial → handoff.

## Sync script

```bash
# Push canonical MG docs → uvspeed/web for :8765 MG iframe
bash experiments/memory-glass/docs/persona-tensor/sync-to-uvspeed-web.sh
```
