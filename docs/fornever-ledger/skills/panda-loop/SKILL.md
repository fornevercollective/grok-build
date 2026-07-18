---
name: panda-loop
description: >
  Finish the Panda α plan → β build → γ verify loop: lab handoff bus, panda panes,
  Memory Glass soak/resign, bug-bounty ledger, offline Ollama brief. Use when user
  says panda loop, fleet loop, plan-build-verify, lab-handoff, triple shell, or
  wants multi-pane agent loops without deleting repos.
---

# Panda loop skill (finished product)

**Stance:** Panda owns **shell UX** (`~/.panda`). Grok owns **agent brain**. Lab is **control plane**.  
**Never delete** repos, models, or soak history.

## The loop (one cycle)

```
α PLAN (read-only)  →  handoff pack  →  β BUILD (mutate)  →  handoff  →  γ VERIFY
         ↑                                                                    │
         └──────────── fail: loop++ (cap 5) then force re-plan ←──────────────┘
```

| Phase | Role | Mutates code? | Profile |
|-------|------|---------------|---------|
| **α** | Explore · plan · ledger read | **No** | `~/.panda/profiles/plan.env` |
| **β** | Implement · worktree preferred | **Yes** | `~/.panda/profiles/build.env` |
| **γ** | Tests · resign · soak smoke · review | Prefer no product edits | `~/.panda/profiles/verify.env` |

## Files (source of truth)

| Path | Role |
|------|------|
| `~/.panda/lab-handoff.json` | queue · active · shells · loop count |
| `~/.panda/packs/last.json` | fat pack (prompt · files · tests · iterate_text) |
| `~/.panda/profiles/{plan,build,verify}.env` | role env |
| `~/.panda/fleet.env` | `LAB_REPO` · models |
| `~/.panda/fleet-shell.sh` | pane entry |
| `docs/fornever-ledger/BUG_BOUNTY_LEDGER.md` | breakage IDs |
| `experiments/memory-glass/` | primary product experiment |
| `experiments/panda-shell/` | Panda binary |

## Start a fleet (operator)

```bash
# From grok-build root
export LAB_REPO="/Volumes/qbitOS/00.dev/projects/grok-build"
export PANDA_HOME="$HOME/.panda"
source "$PANDA_HOME/fleet.env"

# Panda multi-pane (if installed)
cargo build -p panda-shell --release
./target/release/panda new fleet --splits 3   # or: panda new lab --splits 3
# In each pane:
#   source ~/.panda/profiles/plan.env    # α
#   source ~/.panda/profiles/build.env   # β
#   source ~/.panda/profiles/verify.env  # γ

# Or offline driver (no lab HTTP required)
bash experiments/memory-glass/scripts/panda-loop.sh status
bash experiments/memory-glass/scripts/panda-loop.sh next --summary "…" --prompt "…"
```

## Lab bus (when Lab Ship / :8765 is up)

```bash
curl -s http://127.0.0.1:8765/api/shells | jq .
curl -s -X POST http://127.0.0.1:8765/api/shells/handoff \
  -H 'Content-Type: application/json' \
  -d '{"from":"plan","to":"build","summary":"…","prompt":"…","files":[],"tests":[]}'
curl -s -X POST http://127.0.0.1:8765/api/panda/open \
  -H 'Content-Type: application/json' -d '{"splits":3}'
```

## What each phase must do

### α Plan
1. Read `ECOSYSTEM_MAP.md` + `BUG_BOUNTY_LEDGER.md` + relevant SESSION_HANDOFF.
2. Prefer plan mode for ambiguous multi-file work (`plan-loop` skill).
3. Write plan paths + verification; **no product edits**.
4. Handoff → β with summary + files list + success criteria.

### β Build
1. Implement only listed files (worktree if parallel).
2. Memory Glass: hotpipe first; Rust only for window/IPC.
3. After `.app` or Resources change → `scripts/resign-app.sh`.
4. Handoff → γ with files + test commands.

### γ Verify
1. Run listed tests / smoke (open app, codesign verify, soak smoke).
2. Append ledger notes on new breakage.
3. Pass → ship note; Fail → handoff back to β or α (`loop++`, cap **5**).

## Memory Glass integrate (common product loop)

```bash
# β
cd "$LAB_REPO/experiments/memory-glass"
# edit hotpipe… then:
bash scripts/resign-app.sh
# γ
codesign --verify --deep --strict "$HOME/Applications/Memory Glass.app"
MG_LOCAL_LLM=1 bash scripts/overnight-soak.sh --hours 0.05   # short smoke
# or full night:
# MG_LOCAL_LLM=1 bash scripts/overnight-soak.sh --hours 8
```

## Offline LLM in the loop

| When | Command |
|------|---------|
| After soak | `MG_LOCAL_LLM=1 python3 scripts/soak-morning-brief.py` |
| WebGrid pace | `webgrid-collector.py` + `webgrid-pace-advisor.py` |
| Deep fail | `soak-morning-brief.py --reason` (deepseek-r1) |

## Cap / anti-doom

- Max **5** full α→β→γ cycles on the same ticket, then **re-plan** (new problem statement).
- Do not spawn duplicate fixed loops.
- α and γ: never default YOLO; β may use always-approve for local grind only.
- Secrets never in handoff JSON (`api_key`, `token`, …).

## Related skills

| Skill | Use |
|-------|-----|
| plan-loop | Design-first before β |
| triple-handoff | Lab HTTP rocket chain |
| memory-glass | MG paths + resign rules |
| bug-bounty-ledger | Append breakage IDs |
| check-work | γ verification agent |

## Plans catalog

See `docs/fornever-ledger/plans/` — run tickets through this loop.
