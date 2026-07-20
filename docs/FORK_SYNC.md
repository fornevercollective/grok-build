# Fork sync policy · fornevercollective/grok-build ↔ xai-org/grok-build

## GitHub “N commits behind” is normal

Trust **`SOURCE_REV` + path-checkout**, not the fork comparison badge.

| Signal | Meaning |
|--------|---------|
| GitHub “behind xai-org/grok-build” | **History graph only** — histories are **unrelated** (no merge-base) |
| Root `SOURCE_REV` | Monorepo SHA whose **product tree** we last path-checked out |
| `git diff upstream/main HEAD -- crates Cargo.toml SOURCE_REV …` | Real content drift |

**Do not** `git merge upstream/main` (or `--allow-unrelated-histories`) into this Lab fork — it can thrash root workspace files and fight `docs/architecture-lab` / `experiments/`.

## Stay current (product tools)

```bash
git fetch upstream
./scripts/sync-upstream-path-checkout.sh upstream/main
# review
git status && git diff --cached --stat
git commit -m "Sync product tree from xai-org/grok-build tip (path-checkout)."
git push origin main
```

Optional pin:

```bash
./scripts/sync-upstream-path-checkout.sh 98c3b24
```

## Verify content match

```bash
./scripts/verify-upstream-sync.sh
# or:
diff -u <(git show upstream/main:SOURCE_REV) SOURCE_REV
git diff --quiet upstream/main HEAD -- crates Cargo.toml Cargo.lock SOURCE_REV bin .cargo prod
```

## Leveraged in this build

Path-checkout brings the open-source harness into the **workspace** Lab and tools already use:

| Area | Crates (examples) | Use |
|------|-------------------|-----|
| TUI / pager | `xai-grok-pager-bin`, `xai-grok-pager`, `xai-grok-pager-render` | `cargo run -p xai-grok-pager-bin` |
| Agent / shell | `xai-grok-shell`, `xai-grok-agent`, `xai-grok-tools` | runtime + tools |
| Config / MCP / hooks | `xai-grok-config*`, `xai-grok-mcp`, `xai-grok-hooks` | plugins, MCP, hooks |
| Workspace / sandbox | `xai-grok-workspace`, `xai-grok-sandbox` | fs, VCS, sandbox |
| Voice / update | `xai-grok-voice`, `xai-grok-update` | voice, auto-update |
| Editor / PTY | `xai-ratatui-textarea`, `ptyctl` | input, headless PTY |

**Memory Glass** (`experiments/memory-glass`) is a **standalone** Cargo workspace (not a monorepo member). It coexists with the synced monorepo; Lab/Grok use monorepo crates via normal `cargo -p …` builds.

## Preserved on every sync

- `docs/architecture-lab/` (Lab → GitHub Pages)
- `experiments/` (including Memory Glass)
- `docs/fornever-ledger/`
- `scripts/` (including this sync tooling)

## Do not get “flagged” / clobbered

| Risk | Mitigation |
|------|------------|
| Merge upstream into `main` | **Never** — unrelated histories |
| Product tree drift | Path-checkout + `verify-upstream-sync.sh` only |
| Experiments wiped | Keep MG only under `experiments/memory-glass` (not `crates/`) |
| Pages vs monorepo | Pages = Lab only (`docs/architecture-lab`); not a second product tree |
| grokkybara “Synced from monorepo” | Expected on product commits; our tip can still carry `experiments/` |

**Memory Glass public surface:** Lab page **32** on https://fornevercollective.github.io/grok-build/ — not a separate monorepo site that fights xai-org.

## Last known good (update when you path-checkout)

| Pin | Value |
|-----|--------|
| Fork `main` tip (example) | check `git log -1 --oneline` |
| `SOURCE_REV` | `ba69d70c2f7d70a130a323b2becdf137af784c7f` |
| Upstream product tree | matches `upstream/main` via path-checkout content (verify exit 0) |
| Upstream remote | `https://github.com/xai-org/grok-build.git` |
| Origin remote | `https://github.com/fornevercollective/grok-build.git` |
| No merge-base with upstream | **expected** (unrelated histories) |

Verified: `./scripts/verify-upstream-sync.sh` → product tree **OK** (crates / Cargo / SOURCE_REV / …).  
Memory Glass + Lab live only under `experiments/` and `docs/` — never path-checkout those from upstream.
