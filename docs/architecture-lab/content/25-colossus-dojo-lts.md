# Colossus / Dojo LTS path (GOJO · DOLOSUS)

**LTS** here means the **long-term-support launch path**: stable local orchestration for Lab + media generate + train templates — **not** an xAI product SKU.

Typo map: **GOJO/DOLOSUS** → **Colossus / Dojo** (training + performance lanes).

**Cherry-pick rule:** patterns and paths only · ship as Lab / plugins / StageForge · **no monorepo vendor** · **no PRs to `xai-org`** ([CONTRIBUTING.md](https://github.com/xai-org/grok-build/blob/main/CONTRIBUTING.md)).

---

## End-to-end pipe

```text
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────────┐
│ grok-public-    │ →  │ DaVinci Resolve 4K   │ →  │ grok-repo-template      │
│ folder          │    │ (export timeline)    │    │ Colossus / Dojo train   │
│ Imagine presets │    │                      │    │ scripts/colossus-launch │
│ · generate      │    │                      │    │ examples/rust-dojo      │
└────────┬────────┘    └──────────────────────┘    └───────────┬─────────────┘
         │                                                      │
         └──────────── Lab LTS (this folder) ───────────────────┘
              stageforge up  ·  ./serve.sh  ·  native Multi αβγ
              workbench.html ·  Browser ·  handoff bus
```

| Repo | URL | Role |
|------|-----|------|
| **grok-public-folder** | [fornevercollective/grok-public-folder](https://github.com/fornevercollective/grok-public-folder) | Imagine → generate → Resolve Media Pool |
| **grok-repo-template** | [fornevercollective/grok-repo-template](https://github.com/fornevercollective/grok-repo-template) | Colossus/Dojo assembly · DVC · train/infer |
| **stageforge** | local `~/dev/stageforge` | Iterative multi-service launch / port bump |
| **This lab** | `docs/architecture-lab` | Control shell · PTY · Agent · Browser |

---

## Commands (LTS)

```bash
cd docs/architecture-lab

# Status: resolve checkouts + health probes
./scripts/colossus-dojo-lts.sh status

# Bring up lab-serve via StageForge (or serve.sh fallback)
./scripts/colossus-dojo-lts.sh up

# Upstream gap (path-checkout only — histories unrelated)
./scripts/colossus-dojo-lts.sh upstream

# Optional clones
./scripts/colossus-dojo-lts.sh clone
```

StageForge manifest: [`stageforge.yaml`](../stageforge.yaml)  
Ecosystem routing: [`metadata.yaml`](../metadata.yaml)

If StageForge is installed:

```bash
cd docs/architecture-lab
stageforge up      # boots lab-serve with conflict:bump
stageforge graph
```

---

## How Lab participates (A / B / C)

| Option | LTS role |
|--------|----------|
| **A** | Native Lab + Multi αβγ terminals · Arrange clusters · handoff file for fleet |
| **B** | `serve.sh` / StageForge → **workbench** live PTYs + agent tool cards |
| **C** | Later: Panda/Mu host loads Lab URL; train still via repo-template |

Media exports from **public-folder** land in Resolve; **training** uses **repo-template** (`configs/colossus.yaml`, `examples/rust-dojo`, `examples/jax-colossus`). Lab does **not** run Colossus jobs in-process — it **routes** and **stages**.

---

## Upstream `xai-org/grok-build`

GitHub compare
[fornevercollective/main…xai-org/main](https://github.com/fornevercollective/grok-build/compare/main...xai-org%3Agrok-build%3Amain)
usually reports **entirely different commit histories** — UI compare is not usable for merge.

Local reality (re-check anytime):

```bash
./scripts/colossus-dojo-lts.sh upstream
# or:
git fetch upstream
git log --oneline main..upstream/main   # commits we don't have (e.g. monorepo sync)
git log --oneline upstream/main..main   # lab/fork commits (native, workbench, LTS…)
```

**Policy:** path-checkout of `crates/` when needed · keep `docs/architecture-lab` + `experiments/` · **never** force-merge entire trees · **no external PRs**.

Recent upstream tips seen on fetch: monorepo sync / harness + TUI publish — re-fetch for current SHAs.

---

## Lab UI surfaces

| Surface | What it does for LTS |
|---------|----------------------|
| **Launch Pad** | LTS status card · links to public-folder / repo-template / upstream Δ · copy `up` cmd |
| **Ship deck** | Feature pin “Colossus / Dojo LTS” |
| **`GET /api/lts`** | JSON path resolution (native + serve) |
| **StageForge** | `stageforge.yaml` boots `lab-serve` with `conflict: bump` |

---

## public-folder quick pipe

```text
imagine preset slug → grok-public-folder/video|image → Resolve Media Pool (4K)
                                                          ↓
                                          exports → Colossus / Dojo (repo-template)
```

```bash
git clone https://github.com/fornevercollective/grok-public-folder.git ~/projects/grok-public-folder
cd ~/projects/grok-public-folder
./install-resolve.sh
export XAI_API_KEY=…   # never commit
./bin/startup --create-project
```

## repo-template train stubs

```bash
git clone https://github.com/fornevercollective/grok-repo-template.git ~/projects/grok-repo-template
cd ~/projects/grok-repo-template
# uv sync · configs/colossus.yaml · scripts/colossus-launch.sh
# examples/rust-dojo · examples/jax-colossus
```

---

## Env vars (optional)

| Var | Meaning |
|-----|---------|
| `GROK_PUBLIC_FOLDER` | Override path to public-folder clone |
| `GROK_REPO_TEMPLATE` | Override path to repo-template clone |
| `STAGEFORGE_HOME` | Override `~/dev/stageforge` |
| `XAI_API_KEY` | public-folder generate (never commit) |

---

## Related

- [A·B·C path](#/24-abc-path)
- [Dev-off · grok-cli · overview · xai-org](#/26-dev-off-grok-cli-overview)
- [Fleet funnel](#/23-fleet-funnel)
- [Dev build · forks](#/14-dev-build-and-forks)
- [Panda shell](#/22-panda-shell)
