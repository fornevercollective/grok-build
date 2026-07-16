---
name: triple-handoff
description: >
  Orchestrate three concurrent Grok shells (α plan · β build · γ verify) with
  fat handoff packs and looped activity via Grok Build Lab /api/shells +
  /api/agent/chain. Use when the user says triple shell, rocket chain, handoff
  loop, simultaneous shells, or /triple-handoff.
---

# Triple handoff skill (rocket fuel)

The lab is the **control plane**. Upstream crates load **inside** `grok`
processes — do not fork the pager.

## Shells

| Shell | Mutates code? | Upstream |
|-------|---------------|----------|
| **α plan** | No | explore/plan · read tools · memory |
| **β build** | Yes (worktree preferred) | tools · workspace · hunk-tracker · fast-worktree · ptyctl |
| **γ verify** | Prefer no | sandbox · tests · hooks · lab-review |

## Context bus

| Path | Role |
|------|------|
| `~/.panda/lab-handoff.json` | queue · active · shells · last_pack |
| `~/.panda/packs/last.json` | fat pack (prompt · iterate_text · files · tests · messages) |
| `~/.panda/profiles/{plan,build,verify}.env` | role env |
| `~/.panda/pane-{plan,build,verify}.sh` | **auto-role** Terminal entry (no manual `source`) |

Fat pack is secret-stripped (`api_key`, `token`, … never stored).

## Rocket chain (preferred)

One shot from Agent Console **🚀 Chain** or API:

```bash
curl -s -X POST http://127.0.0.1:8765/api/agent/chain \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Plan JWT auth, then implement",
    "role": "plan",
    "from": "plan",
    "to": "build",
    "open_fleet": true
  }' | jq .
```

Flow:

1. `POST /api/agent/iterate` → `grok -p` (host hook · no client keys)
2. Write fat pack → `packs/last.json` + `lab-handoff.json`
3. Handoff `plan → build` with pack
4. Open Terminal **α / β / γ auto-role** panes (+ Panda multi when available)

## Manual loop

1. **Plan** — explore, Q&A, write plan; stop before product edits.
2. Fat handoff `plan → build` with plan summary + iterate text.
3. **Build** — implement; worktree isolation when parallelizing.
4. Fat handoff `build → verify` with files/tests.
5. **Verify** — sandbox tests + review.
   - pass → ship-checklist
   - fail → `verify → build` or `verify → plan` (loop++)
6. Cap loops at **5** then force plan revise / `POST /api/shells/reset`.

```bash
curl -s http://127.0.0.1:8765/api/shells | jq .
curl -s http://127.0.0.1:8765/api/shells/pack | jq .
curl -s -X POST http://127.0.0.1:8765/api/shells/handoff \
  -H 'Content-Type: application/json' \
  -d '{
    "from":"plan","to":"build",
    "summary":"JWT plan approved",
    "prompt":"…",
    "iterate_text":"…",
    "files":["crates/…"],
    "tests":["cargo test -p …"]
  }'
curl -s -X POST http://127.0.0.1:8765/api/panda/open \
  -H 'Content-Type: application/json' \
  -d '{"splits":3}'
```

## In-TUI alternative (single process)

One interactive `grok` can fan out:

- explore/plan subagents (α)
- general-purpose worktree subagents (β)
- review/test turns (γ)

Still post handoff events to the lab bus so Ship / Agent feeds stay in sync.

## Safety

- Only β mutates product tree.
- Never default YOLO on α/γ.
- Strip secrets from handoff payloads (server also drops common secret keys).
