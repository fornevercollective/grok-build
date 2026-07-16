---
name: triple-handoff
description: >
  Orchestrate three concurrent Grok shells (α plan · β build · γ verify) with
  looped activity handoffs via Grok Build Lab /api/shells. Use when the user
  says triple shell, handoff loop, simultaneous shells, or /triple-handoff.
---

# Triple handoff skill

The lab is the **control plane**. Upstream crates load **inside** `grok` processes — do not fork the pager.

## Shells

| Shell | Mutates code? | Upstream |
|-------|---------------|----------|
| **α plan** | No | explore/plan · read tools · memory |
| **β build** | Yes (worktree preferred) | tools · workspace · hunk-tracker · fast-worktree · ptyctl |
| **γ verify** | Prefer no | sandbox · tests · hooks · lab-review |

## Loop

1. **Plan** — explore, Q&A, write plan; stop before product edits.  
2. Handoff `plan → build` with plan summary.  
3. **Build** — implement; use `spawn_subagent` + worktree isolation when parallelizing.  
4. Handoff `build → verify` with files/tests.  
5. **Verify** — sandbox tests + review.  
   - pass → ship-checklist  
   - fail → `verify → build` or `verify → plan` (loop++)  
6. Cap loops at **5** then force plan revise.

## Lab API (when serve.sh is up)

```bash
curl -s http://127.0.0.1:8765/api/shells | jq .
curl -s -X POST http://127.0.0.1:8765/api/shells/handoff \
  -H 'Content-Type: application/json' \
  -d '{"from":"plan","to":"build","summary":"…"}'
curl -s -X POST http://127.0.0.1:8765/api/shells/spawn \
  -H 'Content-Type: application/json' \
  -d '{"triple":true,"task":"…"}'
```

## In-TUI alternative (single process)

One interactive `grok` can fan out:

- explore/plan subagents (α)  
- general-purpose worktree subagents (β)  
- review/test turns (γ)  

Still post handoff events to the lab bus when available so the Ship panel stays in sync.

## Safety

- Only β mutates product tree.  
- Never default YOLO on α/γ.  
- Strip secrets from handoff payloads.
