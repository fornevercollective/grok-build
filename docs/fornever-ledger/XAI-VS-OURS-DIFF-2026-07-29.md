# xai-org/grok-build vs fornevercollective (local active) — diff

**Generated:** 2026-07-29  
**Policy:** Trust `SOURCE_REV` + path-checkout (histories unrelated). Do **not** `git merge upstream/main`.

---

## Trees compared

| Tree | Path | Role | `SOURCE_REV` | Product versions (shell/pager) | Git tip |
|------|------|------|--------------|--------------------------------|---------|
| **xAI (updated)** | `/Users/qbit/Projects/xai-grok-build` | clean clone of `xai-org/grok-build` @ `main` | `6372e41d828b8a6ee82c29e01a69e27ec895cca9` | **0.2.114** | `500129c` (*Synced from monorepo*, 2026-07-29 17:17Z) |
| **xAI (Downloads)** | `/Users/qbit/Downloads/grok-build-main` | zip/export snapshot | `6372e41d…` **identical** to Projects/xai-grok-build | 0.2.114 | (no `.git`) |
| **Ours (active)** | `/Users/qbit/Projects/grok-build` | `fornevercollective/grok-build` + fork | `95d84f443eddcbed6cbfd6eed22e2eafe6b3939d` | **0.2.111** | `61d12dc` cast/devices on origin · lens/X-media/planet follow-up |

Remote: `origin` = fornevercollective · `upstream` = xai-org (fetched; `upstream/main` → `500129c`).

---

## One-line status

| Layer | Status |
|-------|--------|
| **Product harness** (`crates/`, `bin/`, `prod/`, `third_party/`, `Cargo.*`, `SOURCE_REV`) | **DRIFT** — ours behind tip monorepo by **≥3 shell versions** (0.2.111 → 0.2.114) |
| **File-level product** | **452** differ · **52** only-in-xAI · **9** only-in-ours · **2427** identical |
| **Line-level product** (unified diff, ours vs xAI) | **+13 848 / −27 338** (ours still has fewer lines; xAI grew) |
| **Fork-only (non-product)** | `docs/`, `experiments/`, `scripts/`, `.github/` — preserved |
| **Local uncommitted** | gboom halfblock, live-demux, `/watch`, hotpipe — **not** on origin yet |

---

## Version pin gap

| Pin | xAI tip | Ours |
|-----|---------|------|
| `SOURCE_REV` | `6372e41d828b8a6ee82c29e01a69e27ec895cca9` | `95d84f443eddcbed6cbfd6eed22e2eafe6b3939d` |
| `xai-grok-shell` | **0.2.114** | 0.2.111 |
| `xai-grok-pager` | **0.2.114** | 0.2.111 |
| `xai-grok-pager-bin` | **0.2.114** | 0.2.111 |
| `xai-grok-tools` | 0.1.220-alpha.4 | 0.1.220-alpha.4 (same string; content still drifts) |
| `xai-grok-workspace` | 0.1.220-alpha.4 | 0.1.220-alpha.4 |
| xAI changelogs only-in-tip | `0.2.112` · `0.2.113` · `0.2.114` | missing |

---

## Product drift by crate (file hits)

| Files touched | Crate / area |
|--------------:|--------------|
| ~158 | `crates/codegen/xai-grok-pager` |
| ~141 | `crates/codegen/xai-grok-shell` |
| ~75 | `crates/codegen/xai-grok-tools` |
| ~19 | `crates/codegen/xai-grok-workspace` |
| ~17 | `crates/codegen/xai-grok-pager-render` |
| ~9 | `crates/codegen/xai-grok-hooks` |
| ~7 | `xai-grok-config` · `xai-grok-telemetry` |
| smaller | agent, sampler, crash-handler, computer-hub-sdk, tty-utils, workflow, … |

**Line heat (unified, ours vs xAI):**

| Crate | Files | + (ours) | − (ours missing / xAI-only lines) |
|-------|------:|---------:|----------------------------------:|
| xai-grok-shell | 116 | 6201 | 9325 |
| xai-grok-pager | 145 | 4450 | 6967 |
| xai-grok-tools | 74 | 425 | 2415 |
| xai-grok-workspace | 18 | 420 | 2518 |
| xai-grok-hooks | 9 | 418 | 856 |
| xai-grok-pager-minimal | 5 | 918 | 290 |
| xai-grok-pager-render | 11 | 239 | 258 |
| xai-grok-config | 7 | 137 | 871 |

---

## Only-in-xAI product (tip has, we don't) — highlights

New / moved product surface on **0.2.112–0.2.114**:

- **Shell agent models module:** `xai-grok-shell/src/agent/models/{cache,endpoint,fetch,resolution,tests}.rs`
- **OTel gate / in-process leader:** `agent/otel_gate.rs`, `leader/in_process.rs`
- **Session testkit + synth replay:** `session/testkit/**`, soak/memory tests
- **Terminal:** `pager-render/src/terminal/{da2,kitty_keyboard,term_version}.rs`
- **Workspace:** `export_github.rs` (+ types RPC)
- **Slash:** `pager/.../slash/commands/delete.rs`
- **Changelogs:** `0.2.112`–`0.2.114` json/md
- **E2E:** nonblocking startup, sandbox confinement, session end hook, endline park **markerless** suite

Full list: [`diff-artifacts-2026-07-29/only_xai.txt`](./diff-artifacts-2026-07-29/only_xai.txt) (52 paths).

---

## Only-in-ours product (fork deltas we must re-apply after path-checkout)

| Path | Note |
|------|------|
| `xai-grok-pager/src/slash/commands/gy.rs` | GY slash / pin dock |
| `xai-grok-pager/src/slash/commands/watch.rs` | `/watch` (local WIP, untracked) |
| `xai-grok-pager-render/src/gy_tty/` | GY TTY bridge (committed on main) |
| `xai-grok-pager-render/src/live_demux/` | live demux (local WIP) |
| `xai-grok-pager-render/src/render/halfblock.rs` | gboom halfblock (local WIP) |
| `xai-grok-pager/tests/pty_e2e/endline_park_two_static_markers.rs` | older endline park semantics |
| `…/endline_wakeups_are_markerless.rs` | ours-named opposite of tip |
| `…/reparked_wait_repushes_buried_marker.rs` | ours-named opposite of tip |
| `xai-grok-shell/tests/team_managed_config.rs` | fork test |

**Conflict risk:** xAI tip renames/repositions endline-park **marker** tests (`endline_park_is_markerless`, `endline_wakeups_close_with_markers`, `reparked_wait_stays_markerless`). Our three endline e2e files are **not** drop-in — re-evaluate after path-checkout.

Full list: [`diff-artifacts-2026-07-29/only_ours.txt`](./diff-artifacts-2026-07-29/only_ours.txt).

---

## Local uncommitted (active terminal WIP) — not in origin

```
M  Cargo.lock
M  xai-grok-pager-render (gboom, halfblock, lib)
M  xai-grok-pager (agent_view, dispatch, actions, media, notices, …)
M  docs/fornever-ledger/GBOOM-HALFBLOCK-PATCH.md
M  experiments/memory-glass/hotpipe/live.js
?? live_demux/  ?? watch.rs  ?? LIVE-DEMUX-PIPELINE.md
?? scripts/launch-gboom.sh  launch-watch.sh  live-demux/
?? hotpipe/letter-grid-speed-agent.js
```

**Before any path-checkout:** stash or commit this WIP so `./scripts/sync-upstream-path-checkout.sh` does not thrash it.

---

## Fork-only trees (never path-check out from xAI)

| Path | Purpose |
|------|---------|
| `docs/` | `FORK_SYNC.md`, `architecture-lab/`, `fornever-ledger/` |
| `experiments/` | Memory Glass hotpipe, etc. |
| `scripts/` | `sync-upstream-path-checkout.sh`, `verify-upstream-sync.sh`, launch helpers |
| `.github/` | fork CI/workflows |

---

## How to absorb xAI tip (recommended)

```bash
cd /Users/qbit/Projects/grok-build

# 1) Save WIP
git stash push -u -m "wip: gboom halfblock + live-demux + watch"

# 2) Fetch + path-checkout product tree only
git fetch upstream
./scripts/sync-upstream-path-checkout.sh upstream/main

# 3) Re-apply fork product islands (gy_tty, gy slash, any kept tests)
#    Review: git status && git diff --stat

# 4) Verify
./scripts/verify-upstream-sync.sh
# expect SOURCE_REV == 6372e41d… and shell 0.2.114

# 5) Pop WIP and resolve conflicts in pager/render
git stash pop
```

**Do not** `git merge upstream/main` (unrelated histories).

---

## Artifacts

| File | Contents |
|------|----------|
| [`diff-artifacts-2026-07-29/differ.txt`](./diff-artifacts-2026-07-29/differ.txt) | 452 product paths with content change |
| [`diff-artifacts-2026-07-29/only_xai.txt`](./diff-artifacts-2026-07-29/only_xai.txt) | 52 only-in-xAI product paths |
| [`diff-artifacts-2026-07-29/only_ours.txt`](./diff-artifacts-2026-07-29/only_ours.txt) | 9 only-in-ours product paths |
| [`diff-artifacts-2026-07-29/product-all-rq.txt`](./diff-artifacts-2026-07-29/product-all-rq.txt) | raw `diff -rq` product inventory |

---

## Folder map (what to open)

```
/Users/qbit/Projects/xai-grok-build     ← UPDATED xAI tree (git, tip 500129c)
/Users/qbit/Downloads/grok-build-main   ← same bytes as above (no git)
/Users/qbit/Projects/grok-build         ← OUR active fork (dirty WIP)
```

Quick side-by-side:

```bash
diff -rq /Users/qbit/Projects/xai-grok-build/crates \
         /Users/qbit/Projects/grok-build/crates | less
```
