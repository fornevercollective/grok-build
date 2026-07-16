# Triple shell · simultaneous + looped handoffs

How **Grok Build Lab** orchestrates **three concurrent shells** that hand activities in a loop — without forking `xai-grok-pager`.  
Upstream crates stay inside the **`grok` / headless / subagent** processes; the lab is the **control plane + activity bus**.

Interactive UI: **Ship** → Triple shell · API: `/api/shells` · Plugin: `lab-ship` skills/agents.

---

## The three shells

| Shell | Code | Role | Mutates product code? | Upstream leverage |
|-------|------|------|----------------------|-------------------|
| **α Plan** | `plan` | Explore, design, Q&A, write `plan.md` | **No** (read + plan file) | `explore` / `plan` subagents · codebase search via tools · memory read |
| **β Build** | `build` | Implement approved plan in isolation | **Yes** (prefer worktree) | tools · workspace · hunk-tracker · **fast-worktree** · ptyctl |
| **γ Verify** | `verify` | Test, review, sandbox smoke | Prefer **no** product edits | **sandbox** · tools (test) · hooks · review skill |

Lab windows map:

| Lab surface | Shell affinity |
|-------------|----------------|
| **Chat** float | α Plan (voice/text intent · Q&A) |
| **Lab** workspace + multi-term | β Build (summon TUI / headless) |
| **Stream** + terminal footer | γ Verify (ops, processes, logs) |

All three can be **live at once**. Work moves as **activities** on a shared bus, not by merging agent contexts.

---

## Handoff loop

```text
        ┌──────────────┐
        │  α PLAN      │  explore · plan mode · Q&A
        │  approve?    │
        └──────┬───────┘
               │ handoff(plan→build) + plan artifact
               ▼
        ┌──────────────┐
        │  β BUILD     │  worktree · tools · workspace
        │  implement   │
        └──────┬───────┘
               │ handoff(build→verify) + diff/summary
               ▼
        ┌──────────────┐
     ┌─▶│  γ VERIFY    │  sandbox · test · review
     │  └──────┬───────┘
     │         │
     │    pass │ fail ──handoff(verify→build|plan)──┐
     │         ▼                                     │
     │      SHIP / done                              │
     └──────── loop+1 ◀──────────────────────────────┘
```

| Transition | Trigger | Payload |
|------------|---------|---------|
| plan → build | Plan approved (TUI `a` or lab Approve) | plan summary, file list, constraints |
| build → verify | Build claims done / Stop | commit-ish, files touched, test cmds |
| verify → build | Tests fail | failure log, failing paths |
| verify → plan | Design wrong | revision notes |
| verify → done | Green | ship checklist |

Each hop increments `loop` so you can see thrash.

---

## How lab **spins out** upstream crates

**Do not link** lab native code to pager crates. **Spawn** `grok` processes that already depend on them.

| Crate / surface | Who loads it | How the lab uses it |
|-----------------|--------------|---------------------|
| `xai-grok-tools` | Every `grok` session | Build/Verify shells call tools via agent turns |
| `xai-grok-workspace` | Same | FS/VCS/exec for β |
| `xai-grok-sandbox` | When sandbox enabled | γ: `grok -p … --sandbox <profile>` |
| `xai-codebase-graph` | Via tools / indexer | α explore navigation |
| `xai-hunk-tracker` | Edit path in tools | β multi-file edits |
| `xai-fast-worktree` | Subagent isolation | β: `spawn_subagent` + `isolation: worktree` |
| `ptyctl` / `panda-shell` | Terminal tool stack | Live streaming shell in TUI |
| config / auth / models | Session start | All shells inherit `~/.grok` + project |
| skills / plugins / hooks | Agent load | lab-ship + project plugins |
| MCP | MCP client | Optional per shell via config |
| memory | Memory store | α reads decisions; β/γ write outcomes |
| subagent resolution | Parent agent | α/β/γ can each spawn children |
| ACP | `grok agent` | Optional 4th client — not required for triple shell |
| telemetry / crash / update | Binary | Each process has its own |

### Capability matrix (upstream TUI vs lab)

| Capability | In upstream TUI / headless? | Lab role |
|------------|----------------------------|----------|
| Plan mode | **Yes** | Rehearse + handoff gate |
| Subagents + worktrees | **Yes** | β isolation recipe |
| Skills / plugins / hooks / MCP | **Yes** | lab-ship packs orchestration |
| Memory | **Yes** | Persist handoff notes |
| Sandbox | **Yes** | γ default |
| Multi-window companion | **No** | Lab native triple surface |
| Activity bus | **No** | Lab `/api/shells` |

---

## Spawn recipes (commands the bus records)

### α Plan (interactive or headless)

```bash
# Interactive plan mode (human approve)
grok   # then /plan  or Shift+Tab → Plan

# Headless explore-heavy (read-ish tools)
grok -p "Explore and write an implementation plan for: $TASK" \
  --disallowed-tools "search_replace" \
  --max-turns 40
```

### β Build (prefer worktree via agent tools)

```bash
grok -p "Implement the approved plan below. Use worktree isolation for risky edits.
PLAN:
$PLAN_TEXT" \
  --cwd "$REPO" \
  --yolo   # only in trusted CI / local sandbox machines
```

Inside the agent: `spawn_subagent` with `isolation: worktree` for parallel implementers.

### γ Verify (sandbox)

```bash
grok -p "Run tests and review the diff for regressions. Do not expand scope.
CONTEXT:
$BUILD_SUMMARY" \
  --sandbox workspace-write \
  --disallowed-tools "Agent" \
  --max-turns 25
```

Tune `--sandbox` / permission flags to your safety guide (`user-guide/18-sandbox`, `22-permissions`).

---

## Lab control plane API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/shells` | Three shell statuses + activity queue |
| `POST /api/shells` | Update shell state (`idle` / `running` / `blocked`) |
| `POST /api/shells/handoff` | Enqueue activity hop (`from`, `to`, `summary`, `payload`) |
| `POST /api/shells/advance` | Mark current hop done; optional auto-next |
| `POST /api/shells/spawn` | Record spawn recipe + optionally open Terminal panes |
| `POST /api/shells/reset` | Clear queue (demo/reset) |

State file (local): `docs/architecture-lab/.lab-shells.json` (gitignored) or in-memory when not writable.

---

## Plugin / agent wiring (lab-ship)

| Piece | Name | Shell |
|-------|------|-------|
| Agent | `lab-explorer` | α |
| Agent | `lab-tester` | γ |
| Skill | `plan-loop` | α → gate |
| Skill | `lab-review` | γ |
| Skill | `ship-checklist` | post-verify |
| Skill | `triple-handoff` | bus protocol for the TUI agent |

When the **parent** `grok` runs in β, it can spawn α-style explore children and γ-style verify children — that is **in-process** triple fan-out.  
The lab bus is for **cross-process** and **human-visible** handoffs across windows.

---

## Simultaneous operation patterns

### Pattern A — Lab-orchestrated (recommended)

1. Lab native: Lab + Chat + Stream windows up.  
2. Chat (α): refine task → Ship Q&A → handoff to build.  
3. Multi-term / Terminal: interactive `grok` (β).  
4. Headless or second pane: verify prompt (γ).  
5. Lab API shows loop counters; chat announces next hop.

### Pattern B — Single TUI, subagent triple

One `grok` session:

1. Parent plans (or `/plan`).  
2. Spawns explore subagents (α).  
3. Spawns general-purpose worktree subagents (β).  
4. Spawns review/test path (γ).  

Lab only **visualizes** (Ship subagent cards + process watch).

### Pattern C — Headless CI loop

```bash
# sketch — wire in CI after handoff JSON is written
while true; do
  case $(jq -r .next .lab-handoff.json) in
    plan)   grok -p "$(jq -r .prompt .lab-handoff.json)" … ;;
    build)  grok -p "…" --yolo … ;;
    verify) grok -p "…" --sandbox … ;;
    done)   break ;;
  esac
done
```

---

## Safety

| Risk | Mitigation |
|------|------------|
| Three writers collide | Only **β** mutates product tree; use **worktree** |
| Infinite fail loop | Cap `loop` (lab default **5**); force plan revise |
| YOLO on laptop | Never default `--yolo` in α/γ; β only when trusted |
| Secret leakage in handoff payload | Strip env/secrets; store paths not contents |
| Upstream fork temptation | Plugins + spawn only |

---

## Verification

```bash
# lab server
./serve.sh
curl -s http://127.0.0.1:8765/api/shells | jq .
curl -s -X POST http://127.0.0.1:8765/api/shells/handoff \
  -H 'Content-Type: application/json' \
  -d '{"from":"plan","to":"build","summary":"JWT auth plan approved"}' | jq .
```

Ship tab → **Triple shell** panel should show α → β → γ hop.

---

## Related

- [Runtime modes](#/02-runtime-modes) · [Crate layers](#/03-crate-layers)  
- [Ship everything](#/17-ship-everything) · [Extension surfaces](#/04-extension-surfaces)  
- Upstream: `user-guide/14-headless` · `16-subagents` · `18-sandbox` · `19-plan-mode`
