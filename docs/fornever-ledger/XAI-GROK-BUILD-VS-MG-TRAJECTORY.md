# xai-org/grok-build vs Memory Glass trajectory check

**Checked:** 2026-07-23 (local) · path-checkout to tip + orphan prune  
**Policy:** Trust **`SOURCE_REV` + path-checkout**, not GitHub “behind N commits.” Histories are **unrelated** (no merge-base).  
**Never** `git merge upstream/main` into this Lab fork.

---

## One-line status

| Layer | Status |
|-------|--------|
| **Product harness** (`crates/`, `Cargo.*`, `SOURCE_REV`, `prod/…`) | **MATCH** tip · shell **0.2.111** · `SOURCE_REV=95d84f4…` |
| **Memory Glass** (`experiments/memory-glass/`) | **Active** · hotpipe **v32-contrails-live** in repo + app |
| **Lab / ledger** (`docs/architecture-lab/`, `docs/fornever-ledger/`) | **Ours only** — preserved on every path-checkout |
| **origin push** | Push after commit (path-checkout + MG) |

**Verify command (exit 1 = drift):**

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
./scripts/verify-upstream-sync.sh
```

---

## Pin table (authoritative)

| Pin | Value | Note |
|-----|--------|------|
| Fork product tree | path-checkout of `upstream/main` @ `69f0ba8` | 2026-07-23 |
| Local `SOURCE_REV` | `95d84f443eddcbed6cbfd6eed22e2eafe6b3939d` | matches tip |
| `upstream/main` tip | `69f0ba8` · *Synced from monorepo* | 2026-07-23 17:12Z |
| Upstream `SOURCE_REV` | `95d84f443eddcbed6cbfd6eed22e2eafe6b3939d` | tip monorepo |
| Shell crate (local) | `xai-grok-shell` **0.2.111** | matched |
| Shell crate (upstream tip) | `xai-grok-shell` **0.2.111** | same |
| `origin` | `https://github.com/fornevercollective/grok-build.git` | |
| `upstream` | `https://github.com/xai-org/grok-build.git` | |
| Merge-base w/ upstream | **none** | expected |

---

## Upstream monorepo chain we are missing

Path-checkout was aligned with **`ba76b0a`** (`SOURCE_REV=ba69d70…`). Tip has advanced:

| Upstream commit | When | `SOURCE_REV` (monorepo) | Product Δ (crates+Cargo+prod) | Hot crates (file count) |
|-----------------|------|-------------------------|-------------------------------|-------------------------|
| `ba76b0a` | 2026-07-19 | `ba69d70…` | **our pin** | — |
| `a881e67` | 2026-07-20 | `c5c4ce0…` | 140 files · +6.7k / −2.4k | shell 54 · pager 41 · tools 13 |
| `3af4d5d` | 2026-07-21 | `0f4d7c9…` | 556 files · +56k / −22k | pager 244 · shell 166 · tools 25 · **workflow** 9 |
| `a5727c5` | 2026-07-22 | `30192d2…` | 482 files · +38k / −13k | pager 214 · shell 134 · workspace 26 · voice 13 |
| `69f0ba8` | 2026-07-23 | `95d84f4…` | 286 files · +23k / −9.6k | pager 100 · shell 85 · tools 33 · sandbox 8 |

**Aggregate content drift** (`git diff upstream/main HEAD -- crates Cargo.toml Cargo.lock SOURCE_REV prod`):  
**~889 paths · ~42k lines only-on-fork vs ~119k lines only-on-upstream** (we are net behind on product volume).

**Workspace member notable:** upstream tip adds `crates/codegen/xai-workflow` (not on our pin tree).

**Still matching path-checkout OK paths:** `bin`, `third_party`, toolchain/fmt/clippy, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`, `THIRD-PARTY-NOTICES`, `.cargo`, `.gitignore`.

---

## Diff meaning (what to trust)

| Signal | Trust? | Meaning now |
|--------|--------|-------------|
| GitHub “N commits behind xai-org” | **No** | Unrelated histories · badge noise |
| `SOURCE_REV` equality | **Yes** | Ours `ba69d70…` ≠ tip `95d84f4…` → **out of pin** |
| `./scripts/verify-upstream-sync.sh` | **Yes** | **DRIFT** (2026-07-23 check) |
| `git log HEAD..upstream/main` | Weak | Shows their sync commits only; not a merge recipe |
| Path-checkout of `upstream/main` | **Yes** | Correct way to re-pin product tree |

---

## Memory Glass trajectory (ours — not in xai-org)

Upstream never ships MG. All product UI lives under **`experiments/memory-glass/`** (+ live install outside git).

### North star (from `~/.panda/vision/goals.json` · updated 2026-07-20)

> Native WKWebView lab droplet · still-pipe hub · phone fleet · dual-space train · collab mesh — **without Electron**.  
> **Loop product:** WebGrid · contrail / Bloch / Rubik / maze · KBatch · collab mesh  
> **Not:** Dia/Comet clone · auto-X · implant claims · Electron

### Pillars vs LEAP (condensed)

| Track | State | Notes |
|-------|-------|-------|
| Still-pipe hub (9877/9878) | done | protect while agents work |
| Phone PWA · loud TTS · fleet | done / shipped | Mini hub without own cam |
| Dual drawers · product chrome | shipped | tools / data · menu-health |
| WebGrid agent + score truth | active | P-001; peaks ~346.7 BPS (shy of ~351.77 best) |
| Contrails live mid-play | **mitigated 2026-07-21** | MG-016 · `webgrid-play-v32-contrails-live` |
| Maze / lab floats | active | scrim pe:none during play |
| MKT filmstrip · QBIT · LARK · VID | LEAP P-010 | dual-space rails |
| KBatch mesh / collab day | ongoing | handoff docs in ledger |
| App package | **0.3.0** | BUILD_STAMP ~2026-07-19 binary; hotpipe often live-patched |

### Repo vs live app (2026-07-23 check)

| Surface | Pin |
|---------|-----|
| `experiments/memory-glass/hotpipe/webgrid-play.js` | **v31-grid-freeze** (committed / dirty tree) |
| `~/Applications/Memory Glass.app/.../hotpipe/webgrid-play.js` | **v32-contrails-live** (live + resigned) |
| Dirty paths under `experiments/memory-glass` | **~99** (hotpipe + Resources-pack + docs) — **not committed** |
| Last MG commits on fork | `3eac15e` qbit bus / Agent Desk · `2f606ad` dual drawers · … |

**Implication:** trajectory **runs on the .app + `~/.panda`**, then lags back into git. Next MG commit should include v32 + scrim fixes + session desk.

### Recent MG agent peaks (evidence, not marketing)

| Peak BPS | NTPM | Grid | Note |
|----------|------|------|------|
| **346.7** | 2120 | 30×30 | best post-v32 (still shy of ~351.77 historical) |
| 342.9 | 2097 | 30×30 | `mg_pace=fast` · more misses |
| ~306 | — | 30×30 | pre-contrail-fix session high |

Ledger: **MG-016** (contrails + scrim) · score truth **MG-006**.

---

## Two trajectories (do not merge them)

```
xai-org/grok-build (upstream/main)
  · monorepo syncs → SOURCE_REV advances
  · shell 0.2.106 → 0.2.111
  · pager / tools / workspace / workflow / voice / sandbox churn
  · no Memory Glass · no experiments/

fornevercollective/grok-build (origin/main + local)
  · path-checkout product tree @ SOURCE_REV (currently ba69d70 — STALE vs tip)
  · + experiments/memory-glass  ← MG trajectory
  · + docs/architecture-lab · docs/fornever-ledger
  · + scripts/sync-upstream-path-checkout.sh · verify-upstream-sync.sh
```

**Leverage rule:** monorepo crates power Grok Build TUI/agent locally; MG stays a **standalone** Cargo workspace under `experiments/memory-glass` and coexists via hotpipe + still-pipe, not as a monorepo member.

---

## Recommended next actions (ordered)

1. **Commit / sync MG live hotpipe → repo** (v32, scrim, desk) so git matches the app.  
2. **Push** `dd343b4` (and MG commits) to `origin/main` when ready — currently **ahead 1**.  
3. **Path-checkout tip** when harness upgrades are wanted:

   ```bash
   git fetch upstream
   # clean or stash MG dirt first — path-checkout only touches product paths
   ./scripts/sync-upstream-path-checkout.sh upstream/main
   ./scripts/verify-upstream-sync.sh   # expect exit 0
   git commit -m "Sync product tree from xai-org/grok-build tip (path-checkout)."
   ```

4. **Do not** merge unrelated histories; **do not** path-checkout `experiments/` or `docs/fornever-ledger/`.  
5. Re-run this check after each path-checkout; update pin table + shell version.

---

## Related docs

| Doc | Role |
|-----|------|
| [`docs/FORK_SYNC.md`](../FORK_SYNC.md) | Sync policy · last known good pins |
| [`UPSTREAM_CHERRY.md`](./UPSTREAM_CHERRY.md) | Cherry policy (stale counts refreshed below) |
| [`LEAP_MAP.md`](./LEAP_MAP.md) | MG surface / LEAP inventory |
| [`MEMORY-GLASS-HANDOFF.md`](./MEMORY-GLASS-HANDOFF.md) | KBatch × MG handoff pointers |
| [`BUG_BOUNTY_LEDGER.md`](./BUG_BOUNTY_LEDGER.md) | MG-### / GB-### breakage |
| [`ECOSYSTEM_MAP.md`](./ECOSYSTEM_MAP.md) | Year portfolio map |
| `experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md` | Growth north star |

---

## Checklist for the next agent

- [ ] `verify-upstream-sync.sh` exit code recorded
- [ ] `SOURCE_REV` local == upstream tip after any sync
- [ ] `xai-grok-shell` version noted
- [ ] MG dirty file count + live `webgrid-play` VER noted
- [ ] origin ahead/behind recorded
- [ ] No merge of `upstream/main` attempted
)
