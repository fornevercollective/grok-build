# Versioning · DotSlash · xai-org sync

How this fork tracks **upstream monorepo commits**, **lab semver**, and **build tooling** (DotSlash).  
Policy: **path-checkout** · never force-merge · no PRs to `xai-org`.

---

## Three version layers

| Layer | Where | What it means |
|-------|--------|----------------|
| **Monorepo `SOURCE_REV`** | repo root `SOURCE_REV` | Full SHA of SpaceXAI monorepo snapshot published into `xai-org/grok-build` |
| **Upstream git tip** | `upstream/main` | Public open-source sync commits (e.g. `8adf901`) |
| **Lab product semver** | `docs/architecture-lab/version.json` → `lab_semver` · `package.json` · `native/Cargo.toml` | **Grok Build Lab** shell/docs (not the pager binary) |

### Current pins (re-fetch to refresh)

| Pin | Value |
|-----|--------|
| **SOURCE_REV** | `2ec0f0c8488842da03a71eeee3c61154957ca919` |
| **upstream tip** | `8adf901` — *Synced from monorepo* |
| **prior sync** | `c68e39f` — *Publish harness and TUI open-source* |
| **fork main** | see `git log -1 --oneline` (Lab + path-checkout commits) |
| **Lab semver** | `0.3.10`+ (native / package.json) |

```bash
cat SOURCE_REV
git fetch upstream
git log -3 --oneline upstream/main
git log -1 --oneline   # fornever main
```

---

## DotSlash (required for monorepo crate builds)

Upstream README now requires **[DotSlash](https://dotslash-cli.com)** so hermetic tools under `bin/` (notably `bin/protoc`) can download and run **before** `cargo build`.

```sh
cargo install dotslash
# or: https://dotslash-cli.com/docs/installation/
/usr/bin/env dotslash --help

# then build Grok CLI / tools
cargo build -p xai-grok-pager-bin --release
```

| Tool | Role |
|------|------|
| **DotSlash** | Runs `bin/protoc` and other hermetic launchers |
| **protoc** | Proto codegen via DotSlash or `$PROTOC` / PATH |
| **Rust** | Pinned by `rust-toolchain.toml` |

**Lab native shell** (`docs/architecture-lab/native`) is a **standalone** workspace and does **not** need DotSlash.

---

## Syncing xai-org without wiping Lab

```bash
# Preferred — path-checkout product tree only
./scripts/sync-upstream-path-checkout.sh
# or pin a SHA:
./scripts/sync-upstream-path-checkout.sh 8adf901

git status   # docs/architecture-lab and experiments/ stay yours
git commit -m "chore: path-checkout upstream monorepo tools (SOURCE_REV=…)"
```

Checks out: `crates/` · `Cargo.*` · `SOURCE_REV` · `README.md` · `bin/` · `third_party/` · `prod/` · toolchain files.

**Never:** `git merge -X theirs upstream/main` · force-push rewrite of Lab history · delete/refork.

### What landed in `8adf901` (summary)

- **hooks HTTP** — SSRF redirect fix  
- **headless** — drain `task_backgrounded` before no-wait exit  
- **skills** — name collision with client builtins  
- **shell / workspace / auth / voice** config updates  
- **settings_modal** split into directory module  
- **SOURCE_REV** + **DotSlash** docs  
- Full **xai-grok-tools** packs (see [Upstream tools sync](#/27-upstream-tools-sync))

---

## Lab versioning (0.3.x)

| File | Field |
|------|--------|
| `docs/architecture-lab/version.json` | `lab_semver` |
| `docs/architecture-lab/package.json` | `version` |
| `docs/architecture-lab/native/Cargo.toml` | package `version` |

Bump all three together when shipping Lab chrome/API changes.

---

## Related

- [Upstream tools sync · Lab 1–4+](#/27-upstream-tools-sync)
- [Dev-off · grok-cli · overview](#/26-dev-off-grok-cli-overview)
- [Dev build · forks](#/14-dev-build-and-forks)
- [Grok Voice · spheres](#/29-grok-voice-spheres)
- Official: [x.ai/cli](https://x.ai/cli) · [changelog](https://x.ai/build/changelog) · [DotSlash](https://dotslash-cli.com)
