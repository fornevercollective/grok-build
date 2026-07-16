# Merge · conflicts · update issues

**Living page for Mac Mini ↔ laptop ↔ fork ↔ upstream sync.**  
Use this to continue the conversation on any machine. Snapshot: **2026-07-16**.

| Remote | URL | Role |
|--------|-----|------|
| **origin** | https://github.com/fornevercollective/grok-build | Our fork · lab + packaging · **push here** |
| **upstream** | https://github.com/xai-org/grok-build | Official OSS harness · **no external PRs** |

Local path (Mini): `/Volumes/qbitOS/00.dev/projects/grok-build`

---

## Current state

| Item | Value |
|------|--------|
| **Remotes** | `origin` + `upstream` configured |
| **Pages** | Deploys lab from `docs/architecture-lab/**` on push to `main` |
| **Upstream sync (2026-07-16)** | Path-checkout of `upstream/main` into `crates/`, `third_party/`, `prod/`, root manifests — **lab `docs/` kept**. Verified `cargo check -p xai-grok-pager-bin`. |
| **Panda shell** | Rescued to **`experiments/panda-shell`** (not under `crates/`). After overwriting root `Cargo.toml` from upstream, re-add member `"experiments/panda-shell"`. See [Panda shell](#/22-panda-shell). |
| **Still no merge-base** | Histories remain unrelated; future updates use the same path-checkout recipe (B below). |

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build   # or your laptop clone
git fetch origin && git fetch upstream
git status -sb
git log --oneline -5
git remote -v
```

---

## Problem 1 · Unrelated histories

### Symptom

```text
gh compare main...xai-org:main
→ No common ancestor between main and xai-org:main (HTTP 404)

git merge upstream/main
→ fatal: refusing to merge unrelated histories
```

### Why

- `xai-org/grok-build` published as a **fresh OSS drop** (e.g. single commit *Publish harness and TUI open-source*).
- `fornevercollective/grok-build` was created/pushed with a **different commit graph** (lab commits + earlier history).
- Trees **look** similar (same crate layout, same `xai-grok-pager-bin` version string) but Git has **no merge-base**.

### What is *not* broken

| Area | On origin (fork) | On upstream (xAI) |
|------|------------------|-------------------|
| `crates/` (~75–76) | Yes | Yes |
| `docs/architecture-lab/` | **Yes (ours)** | **No** |
| `.github/` Pages lab workflow | Yes | Not our path |
| Official user-guide | Under pager crate | Same idea |

### Do **not**

- Force-push over `upstream` (you cannot / must not).
- Open PRs to `xai-org/grok-build` (see root `CONTRIBUTING.md`).
- `git merge --allow-unrelated-histories` blindly without a plan (huge noisy conflict surface).

---

## Problem 2 · Local tree without `.git` (Mac Mini history)

### Symptom (resolved on Mini)

```text
fatal: not a git repository (or any parent up to mount point /Volumes)
```

Copy lived on `/Volumes/qbitOS/...` with **no** `.git`. Laptop had the real fork remote.

### Fix applied (Mini)

```bash
git init -b main
git remote add origin https://github.com/fornevercollective/grok-build.git
git remote add upstream https://github.com/xai-org/grok-build.git
git fetch origin && git fetch upstream
git reset --mixed origin/main    # index = fork; keep local files
# commit lab work → push origin
git pull --ff-only origin main   # after laptop pushes
```

### Laptop loop

Always **pull Mini/origin first**, then edit, then push:

```bash
git pull --ff-only origin main
# … work …
git push origin main
```

On Mini after laptop push:

```bash
git pull --ff-only origin main
```

Prefer **ff-only** so you notice divergence early.

---

## Problem 3 · What collides if you force a full merge

If someone runs `merge --allow-unrelated-histories upstream/main` into origin:

| Path | Likely conflict / noise | Prefer |
|------|-------------------------|--------|
| `docs/**` | Upstream missing lab · origin has full lab | **Keep origin** |
| `.github/workflows/*` | Lab Pages vs none | **Keep origin** Pages workflow |
| `Cargo.toml` / `Cargo.lock` | Generated workspace; lockfile thrash | Take **upstream** then `cargo check -p xai-grok-pager-bin` |
| `crates/**` | Same names, different blobs/history | Prefer **upstream** file content after review |
| `README.md` | Branding / install notes | Merge carefully; keep fork lab links |
| `target/` | Never in git | gitignore only |

**Decision rule**

```text
crates/ + third_party/ + root Rust manifests  ←  refresh FROM upstream
docs/architecture-lab/ + lab Pages workflow   ←  always OURS (origin)
plugins / lab-ship                            ←  OURS
```

---

## Recommended update recipes

### A · Day-to-day (lab only) — **default**

```bash
git pull --ff-only origin main
# edit docs/architecture-lab/ …
git add docs/architecture-lab/
git commit -m "Lab: …"
git push origin main
```

### B · Refresh agent crates from upstream (path checkout)

Does **not** require a common ancestor:

```bash
git fetch upstream
# examples — pick paths you need:
git checkout upstream/main -- crates/codegen/xai-grok-tools
git checkout upstream/main -- crates/codegen/xai-grok-shell
# or broader (review status after):
# git checkout upstream/main -- crates Cargo.toml Cargo.lock rust-toolchain.toml

cargo check -p xai-grok-pager-bin
git status
git add crates Cargo.toml Cargo.lock   # only if intentional
git commit -m "Sync selected crates from upstream/main"
git push origin main
```

If checkout overwrites something lab-related, **restore**:

```bash
git checkout origin/main -- docs/architecture-lab
```

### C · Full dual-history merge (rare · planned only)

```bash
git fetch upstream
git checkout -b merge/upstream-$(date +%Y%m%d)
git merge upstream/main --allow-unrelated-histories -m "Merge upstream OSS drop (unrelated histories)"
# resolve conflicts with the decision rule above
cargo check -p xai-grok-pager-bin
# PR into main on origin — do not force-push main until green
```

Document resolutions in the PR body; link this page.

### D · Nuclear re-base lab onto fresh upstream clone (last resort)

1. Clone `xai-org/grok-build` clean.  
2. Copy `docs/architecture-lab/` + `.github/workflows/pages-*.yml` from origin.  
3. New history · force-push **only** if team agrees (rewrites fork main).  
4. Laptop + Mini must re-clone or hard-reset.

---

## Conflict checklist (when Git reports conflicts)

1. **Identify path class** — crate vs lab vs root meta.  
2. **Lab wins** for anything under `docs/architecture-lab/`.  
3. **Upstream wins** for agent behavior crates unless we have a documented fork patch.  
4. **Never commit** `target/`, `native/target/`, `.lab-shells.json`, secrets.  
5. **Verify**  
   ```bash
   cargo check -p xai-grok-pager-bin
   cd docs/architecture-lab && ./serve.sh   # smoke Ship + #/20-merge-and-conflicts
   grok plugin validate docs/architecture-lab/plugin/lab-ship
   ```  
6. **Push origin only** · Pages redeploy · open `#/20-merge-and-conflicts` on both machines.

---

## Known non-Git “merge” issues

| Issue | Notes | Page / fix |
|-------|--------|------------|
| Native first-launch abort (3× WKWebView) | Lazy chat/stream webviews | native 0.2.1 · window.rs |
| Multi-term not “3 real PTYs” | Browser needs PTY bridge | planned; log panes today |
| Unrelated histories vs GitHub Compare UI | Expected | this page |
| Lab semver ≠ Grok CLI version | Lab `package.json` 0.3.x vs installed `grok` 0.2.x | [14-dev-build](#/14-dev-build-and-forks) |
| Community forks ≠ merge targets | Patterns only | [19-fork-leverage](#/19-fork-leverage) |

---

## Conversation handoff block (copy to laptop chat)

```text
Repo: fornevercollective/grok-build (origin)
Upstream: xai-org/grok-build — unrelated histories; no merge-base
Local Mini: /Volumes/qbitOS/00.dev/projects/grok-build  remotes origin+upstream
Lab pages: 17-ship · 18-official-xai · 19-fork-leverage · 20-merge-and-conflicts · 21-triple-shell
Rule: crates from upstream path-checkout; docs/architecture-lab always ours
Do not PR xai-org. Push origin only. Prefer git pull --ff-only.
Doc: docs/architecture-lab/content/20-merge-and-conflicts.md  (#/20-merge-and-conflicts)
```

---

## Related

- [Dev build · versions · forks](#/14-dev-build-and-forks)  
- [Fork leverage map](#/19-fork-leverage)  
- [Ship everything](#/17-ship-everything)  
- [Triple shell](#/21-triple-shell)  
- [Official xAI](#/18-official-xai)  
- Root: `CONTRIBUTING.md` · `README.md`
