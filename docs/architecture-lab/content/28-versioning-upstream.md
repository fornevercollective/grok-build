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
| **SOURCE_REV** | `ea094a8c369475f97c85540d01730baec0dce5d6` |
| **upstream tip** | `e5fd4816` — *Synced from monorepo* |
| **prior fork pin** | `796754a8` (pre-2026-08-12 path-checkout) |
| **fork branch** | `main` + `sync/0.2.121-fc-media` |
| **Lab semver** | `0.3.11`+ (`version.json` / package.json) |

**Synced:** 2026-08-12 via `./scripts/sync-upstream-path-checkout.sh upstream/main`  
**Pages:** https://fornevercollective.github.io/grok-build/ · workflow `pages-architecture-lab.yml` on `main`


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
# or pin a SHA (current xAI tip):
./scripts/sync-upstream-path-checkout.sh ed6d543

git status   # docs/architecture-lab and experiments/ stay yours
git commit -m "chore: path-checkout upstream monorepo tools (SOURCE_REV=…)"
```

Checks out: `crates/` · `Cargo.*` · `SOURCE_REV` · `README.md` · `bin/` · `third_party/` · `prod/` · toolchain files.

**Never:** `git merge -X theirs upstream/main` · force-push rewrite of Lab history · delete/refork.  
GitHub compare often reports **no common ancestor** (monorepo squash dumps vs our history) — path-checkout is the supported path.

### What landed since our pin (`69f0ba8` / 0.2.111 → `ed6d543` / 0.2.120)

Headline only — full tables on [Fork leverage map](#/19-fork-leverage):

- **Security** — more bash/sandbox gates, protected `sandbox.toml`, reclaim/reap on session close  
- **ACP** — `session/list` · `session/resume` · `session/close` (+ earlier state/import)  
- **Auth** — refresh hardening · `GROK_EXTRA_CA_BUNDLE` · bearer fragment  
- **TUI** — doctor · tutorial · usage · plan Mermaid · remove project picker · cheap resize  
- **Tooling** — rustc **1.93.0** · doom-loop recovery default · workflow subagent cap 16  
- **Changelogs** — shell `0.2.112` … `0.2.120`

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
