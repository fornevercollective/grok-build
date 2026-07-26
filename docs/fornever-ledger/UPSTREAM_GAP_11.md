# Upstream gap · 11 commits (xai-org/grok-build)

**As of:** 2026-07-26  
**Local pin (`SOURCE_REV`):** `95d84f443eddcbed6cbfd6eed22e2eafe6b3939d`  
**Policy:** path-checkout only · never wipe `experiments/memory-glass`

## Status

| Direction | Count | Meaning |
|-----------|------:|---------|
| Behind `upstream/main` | **11** | Monorepo sync publishes + open-source harness not path-checked |
| Ahead of upstream | **10k+** | Full MG / ledger / fornever product history |

## The 11 commits (newest first)

All but one are monorepo mirror snaps:

| SHA | When | Note |
|-----|------|------|
| `47348d1` | 2026-07-25 | Synced from monorepo · agent/hooks/config/MCP loader |
| `6e38642` | 2026-07-24 | Synced from monorepo |
| `69f0ba8` … `8adf901` | Jul 16–23 | Synced from monorepo |
| **`c68e39f`** | **2026-07-16** | **Publish harness and TUI open-source** (foundation dump) |

## What we’re missing (by area)

| Area | Why it matters for MG | Action |
|------|------------------------|--------|
| `xai-grok-hooks` / signed policy / managed_cache | Agent lifecycle, safer plugin policy | Path-checkout when TUI day-loop needs it |
| `xai-grok-config` / MCP config | Tool allowlists, OAuth issuer fixes | Cherry for MCP day |
| `xai-grok-pager-*` / PTY harness | Terminal float polish | Optional for Grok term in glass |
| `ptyctl` | Session control | Optional |
| Open-source **LICENSE / README / crates dump** (`c68e39f`) | Legal + full crate tree if local tree incomplete | Already largely present if path-checked once |

**Not missing for tensor path:** Letter-Grid, Cage litmus, Rubik bind, WebGrid BPS, ugrad-r0, persona scaffold — those are **ours**, not upstream.

## Safe recover procedure (when ready)

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
git fetch upstream
# dry-run only:
./scripts/verify-upstream-sync.sh
# path-checkout tip (does not delete experiments/):
./scripts/sync-upstream-path-checkout.sh upstream/main
# then rebuild SOURCE_REV pin + cargo check affected crates
```

See **P-006** · never force-push main · never merge if `experiments/` conflicts.

## For this growth hour

**Skip merge.** Stair growth does not depend on the 11. Revisit after a clean ugrad-r0 + WebGrid + KBatch demo for SpaceX tweet.
