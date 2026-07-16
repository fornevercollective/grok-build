# Fork leverage map · community Grok Build trees

Scan of **[xai-org/grok-build forks](https://github.com/xai-org/grok-build/forks)** (~1.8k total) for **leverage tools and surfaces** — not an endorsement. Upstream **does not accept external PRs**; community trees are independent Apache-2.0 experiments.

> **Snapshot:** 2026-07-16 (GitHub API + READMEs / `FORK.md`). Re-check live repos before adopting code.  
> **Default path still wins:** plugins · skills · hooks · MCP · ACP without forking the pager — see [Extension surfaces](#/04-extension-surfaces) and [Leverage](#/07-leverage).

---

## Landscape

| Bucket | Reality |
|--------|---------|
| **Mirror forks** | Vast majority — stock README, no product delta |
| **Productized forks** | Handful — telemetry off, desktop UI, packaging, multi-provider plans |
| **This lab** | [fornevercollective/grok-build](https://github.com/fornevercollective/grok-build) · **Grok Build Lab** companion under `docs/architecture-lab/` |

**Rule of thumb:** steal **patterns and packaging**, not whole monorepos. Prefer small diffs and extension bus first.

---

## Highest-signal forks

| Fork | ★ (approx) | Leverage type | What to take |
|------|------------|---------------|--------------|
| [thedavidweng/gork-build](https://github.com/thedavidweng/gork-build) | ~21 | Privacy distro | **VSCodium-style** `gork` binary: Mixpanel/`events` hard-off, no remote re-enable, no `x.ai/cli` auto-update |
| [chriscase/GrokPtah](https://github.com/chriscase/GrokPtah) | ~1 | **Desktop agent** | **Tauri 2 + React**: tool cards, permissions, plan mode, git, multi-tab PTY, MCP/plugins, chat search, `~/.grokptah` |
| [Jane-o-O-o-O/grok-build-gui](https://github.com/Jane-o-O-o-O/grok-build-gui) | ~1 | **Electron desktop** | Desktop over native agent via **streaming-json** — workbench, settings, model picker |
| [open-grok/open-grok](https://github.com/open-grok/open-grok) | ~2 | Multi-provider **design** | Architecture dossier + `goals/open-grok-provider-platform/` (Pi-style providers, YAML custom models). Runtime multi-provider **not fully shipped** |
| [SurmountSystems/grok-oss](https://github.com/SurmountSystems/grok-oss) | ~1 | Community mainline | Accepts PRs; binary **`grok-oss`**; **OpenRouter** option; **AUR** + **Nix** + `sync-upstream.sh` |
| [rossnoah/grok-build-no-telemetry](https://github.com/rossnoah/grok-build-no-telemetry) | ~1 | Patch series | Quilt-style patches + releases; strip product telemetry; keep optional **external OTEL** |
| [jasonkneen/agent-tui](https://github.com/jasonkneen/agent-tui) | ~1 | Full rebrand | **`agent-tui`** binary · `~/.agent-tui` · docs which **wire contracts stay xAI-named** (auth headers, model ids) |
| [amanverasia/groky](https://github.com/amanverasia/groky) | ~2 | Telemetry / models | Claims no telemetry + open models — **verify** before relying |

---

## Leverage by category

### Desktop hosts

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| Tauri 2 + React agent UI | GrokPtah | Patterns for chat · tools · PTY · permissions vs native **Grok Build Lab** float |
| Electron + streaming-json | grok-build-gui | Alternate desktop bridge to same Rust agent |

### Privacy / telemetry

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| Product analytics hard-off | gork-build | Local product defaults |
| Patch-only telemetry strip | grok-build-no-telemetry | Small, reviewable diffs |
| Optional self-hosted OTEL | no-telemetry README | Ops observability without vendor Mixpanel |

### Packaging & dual install

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| AUR / Nix / justfile | grok-oss | Distro install for local users |
| Binary rename + branding | gork · grok-oss · agent-tui | Parallel install next to official `grok` |
| Config home split | agent-tui (`~/.agent-tui`) | Avoid clobbering `~/.grok` |

### Providers / models

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| OpenRouter Grok option | grok-oss | Extra model path when testing |
| Multi-provider plan / facts | open-grok goals | Design reference — not a drop-in yet |
| Official Grok OAuth / API | upstream | Keep as first-class path |

### Upstream sync process

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| `FORK.md` + merge checklist | grok-oss | Track `xai-org/grok-build` when PRs are closed |
| Isolated sync PRs / architecture pins | open-grok | Evidence-based import discipline |

---

## Official adjacent (not forks)

| Surface | Role |
|---------|------|
| [x.ai/cli](https://x.ai/cli) | Official install · product |
| [status.x.ai](https://status.x.ai) | Go/no-go before big pushes · [status script](../scripts/status-xai-check.sh) |
| [xai-org/plugin-marketplace](https://github.com/xai-org/plugin-marketplace) | Plugin catalog index |
| Upstream extension bus | plugins · skills · hooks · MCP · ACP · subagents |

---

## What *not* to do

1. **Do not** treat random star-forks as maintained tools — most are empty mirrors.  
2. **Do not** open PRs to `xai-org/grok-build` — see upstream `CONTRIBUTING.md`.  
3. **Do not** recolor official Grok / SpaceXAI marks when borrowing UI ideas — [brand page](#/12-brand).  
4. **Do not** assume multi-provider is done — open-grok is mostly **architecture + plan** today.  
5. Prefer **extension without forking pager** before adopting a full community monorepo.

---

## Decision rule

| Need | Prefer |
|------|--------|
| New behavior in agent | Plugin / skill / hook / MCP / ACP |
| Desktop UX ideas | GrokPtah (Tauri) or grok-build-gui (Electron) **as reference** |
| Privacy binary | gork-build or no-telemetry patches |
| Distro packages | grok-oss packaging |
| Multi-provider design | open-grok goals docs |
| Local docs + float shell | **This lab** · [Lab shells](#/15-lab-shells) |
| New multi-terminal host | **Panda** · [Panda shell](#/22-panda-shell) · `experiments/panda-shell` |

### Natural next build (fleet)

**Full execution funnel (staged tickets + exit demos):** [Fleet funnel · build order](#/23-fleet-funnel).

1. **Panda** multi-tab PTY host (this repo) + GrokPtah UX patterns — not Tauri wholesale  
2. Lab **Open in Panda** for α/β/γ triple shell  
3. gork / no-telemetry as optional child-process privacy later  
4. grok-oss-style `sync-upstream` discipline (already path-checkout)  
5. agent-tui-style dual home: `~/.panda` vs `~/.grok`  

---

## Related lab pages

- [Fleet funnel · build order](#/23-fleet-funnel)  
- [How to leverage further](#/07-leverage)  
- [Ship everything · x.ai/cli](#/17-ship-everything)  
- [Triple shell · handoffs](#/21-triple-shell)  
- [Panda shell · new terminal app](#/22-panda-shell)  
- [Official xAI · legal · models](#/18-official-xai)  
- [Dev build · versions · forks](#/14-dev-build-and-forks)  
- [Merge · conflicts · updates](#/20-merge-and-conflicts)  
- [Lab shells · native vs Electron](#/15-lab-shells)  
- [Extension surfaces](#/04-extension-surfaces)  
- [Plugin catalog](#/05-plugin-catalog)  
- [GrokYtalkY companion](#/10-gy-companion)  

---

## Living note

Update this page when a fork ships a **real** leverage delta (new host, packaging, provider, or privacy tool). Star counts rot; **feature tables** matter more.
