# Upstream xai-org/grok-build — careful cherry policy

## State (do not mass-merge)

| Remote | Count |
|--------|-------|
| Our `main` vs `upstream/main` | **~64 ahead / 3 behind** |
| Merge-base | **none** (unrelated roots: different “Publish harness…” SHAs) |

## Their 3 commits (behind)

1. `c68e39f` — Publish harness and TUI open-source (initial monorepo dump)
2. `8adf901` — Synced from monorepo
3. `98c3b24` — Synced from monorepo (2026-07-17): MCP/config, memory, pager clipboard trust, plugins, sandbox, …

## Policy

1. **Never** `git pull upstream` / `git merge upstream/main` onto our product branch.
2. **Never** let monorepo sync clobber `experiments/memory-glass` or `docs/fornever-ledger`.
3. When we want harness fixes: cherry-pick **crate-level** diffs into a throwaway worktree, review file list, then port surgically.
4. Prefer shipping MG LEAP + train bus first; upstream fidelity is secondary.

## Safe inspection commands

```bash
git fetch upstream
git log --oneline HEAD..upstream/main   # their 3
git log --oneline upstream/main..HEAD | head  # our product
# optional worktree:
# git worktree add /tmp/gb-up upstream/main
```

## Status

- **Not applied** — documented only (2026-07-18).
- Revisit after MG resign + WebGrid laptop launch + filmstrip hydrate are stable on device.
