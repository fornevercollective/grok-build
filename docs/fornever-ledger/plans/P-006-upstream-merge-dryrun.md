# P-006 · Upstream grok-build merge dry-run

## Why
Fork drift from `xai-org/grok-build` (GB-001). Experiments must stay merge-safe under `experiments/`.

## α
- `git fetch upstream`
- List commits ahead/behind
- Conflict forecast for crates/* vs experiments/*

## β
- Dry-run merge on throwaway branch `sync/upstream-dryrun` only
- Never force-push main
- Document conflict map in ledger notes

## γ
- Branch deleted or kept as report; main untouched unless human ships

## Success
Written conflict report; no history rewrite; no deleted fornever work.
