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

- `docs/architecture-lab/` (Lab)
- `experiments/` (including Memory Glass)
- `scripts/` (including this sync tooling)

## Last known good (update when you path-checkout)

See root `SOURCE_REV` and `git log -1 --oneline` on `main`.
