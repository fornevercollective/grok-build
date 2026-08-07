# Multi-agent Memory Glass fleet (root level)

## One command

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
./scripts/mg-fleet.sh status
./scripts/mg-fleet.sh monitor start   # /monitor instance
./scripts/mg-fleet.sh run once        # /run growth turn
./scripts/mg-fleet.sh terminals       # MG-MONITOR + MG-RUN panes
```

## Why root

Cursor and Grok agents must open **grok-build root**, not only `experiments/memory-glass`, so harness + ledger + MG + scripts stay one workspace.

## Roles

| Pane | Role |
|------|------|
| Grok / Cursor | BRAIN — edit, plan, skills |
| MG-MONITOR | observe-only alive log |
| MG-RUN | growth (ugrad colossus every interval) |
| dispatch | hands Cmd+L / term |

## Never

- pkill Memory Glass  
- dual RUN + thrash drive  
- put XAI keys in browser  
