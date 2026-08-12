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

### Current pins (re-fetch to refresh) · 2026-08-05

| Pin | Value |
|-----|--------|
| **This fork SOURCE_REV** | `95d84f443eddcbed6cbfd6eed22e2eafe6b3939d` |
| **This fork pager** | `0.2.111` (`xai-grok-pager`) — matches xAI public pin at `69f0ba8` |
| **xai-org tip** | `ed6d543` — *Synced from monorepo* · pager **0.2.120** · SOURCE_REV `d6937fe…` |
| **Gap** | monorepo syncs after `69f0ba8` → tip (`0.2.112` … `0.2.120` changelogs only on xAI) |
| **fork main** | see `git log -1 --oneline` (Lab + media + path-checkout commits) |
| **Lab semver** | `0.3.11`+ (native / package.json) |
| **Full 20-commit map** | [Fork leverage · xai-org vs us](#/19-fork-leverage) |

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
