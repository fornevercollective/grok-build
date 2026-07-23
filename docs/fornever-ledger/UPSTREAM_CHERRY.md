# Upstream xai-org/grok-build — careful cherry policy

**Full trajectory check:** [`XAI-GROK-BUILD-VS-MG-TRAJECTORY.md`](./XAI-GROK-BUILD-VS-MG-TRAJECTORY.md)  
**Sync policy:** [`../FORK_SYNC.md`](../FORK_SYNC.md)

## State (2026-07-23 · post path-checkout)

| Remote / pin | Value |
|--------------|--------|
| Product tree | **MATCH** `upstream/main` @ monorepo `95d84f4…` |
| `upstream/main` | `69f0ba8` · monorepo `95d84f4…` |
| Merge-base | **none** (unrelated roots) |
| Shell | **0.2.111** (matched) |
| GitHub behind badge | **Ignore** — history noise |

### Their monorepo syncs since our pin (`ba76b0a`)

1. `a881e67` — 2026-07-20 · shell/pager/tools  
2. `3af4d5d` — 2026-07-21 · large pager/shell + **xai-workflow**  
3. `a5727c5` — 2026-07-22 · pager/shell/workspace/voice  
4. `69f0ba8` — 2026-07-23 · pager/shell/tools/sandbox  

## Policy

1. **Never** `git pull upstream` / `git merge upstream/main` onto our product branch.
2. **Never** let monorepo sync clobber `experiments/memory-glass` or `docs/fornever-ledger`.
3. Prefer **path-checkout** for full product re-pin:

   ```bash
   git fetch upstream
   ./scripts/sync-upstream-path-checkout.sh upstream/main
   ./scripts/verify-upstream-sync.sh
   ```

4. When we want a single harness fix only: cherry-pick **crate-level** diffs into a throwaway worktree, review file list, then port surgically.
5. Prefer shipping MG LEAP + train bus first when device is mid-session; re-pin harness when quiet.

## Safe inspection commands

```bash
git fetch upstream
./scripts/verify-upstream-sync.sh
git log --oneline ba76b0a..upstream/main   # monorepo syncs we lack
# optional worktree:
# git worktree add /tmp/gb-up upstream/main
```

## Status

- **Path-checked to tip** 2026-07-23 (orphan prune included).
- Next: only re-run when `verify-upstream-sync.sh` reports DRIFT again.
