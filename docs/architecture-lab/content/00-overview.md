# Overview

**Grok Build** (`grok` / `xai-grok-pager`) is SpaceXAI's **terminal-based AI coding agent**.  
This lab maps its architecture, extension surfaces, plugin ideas, and how to leverage it further — including the **GrokYtalkY** companion stack.

## One-sentence model

> **Grok Build = TUI + agent shell + tools/workspace + extension bus**  
> (plugins · skills · hooks · MCP · ACP).  
> You extend it by packaging behavior and external tools — not by rewriting the pager.

## What it is / isn't

| It is | It is not |
|-------|-----------|
| Native **Rust** TUI agent (ratatui) | Tauri / Electron / WASM app |
| Runs **inside** your terminal | A new OS terminal emulator |
| Headless + ACP embeddable | Only interactive chat |
| Plugin / skill / hook / MCP extensible | Closed single binary with no seams |

## Lab goals

1. **Map** crate layers and request flow  
2. **Catalog** plugins you can build (and already have)  
3. **Leverage** companions (GY pins), headless, ACP, marketplace  
4. **Riff** — markdown sources you can edit and grow  
5. **Brand** — official SpaceXAI / Grok marks only as provided  

## Quick links

- [System architecture](#/01-architecture)
- [**Ship everything · x.ai/cli matrix**](#/17-ship-everything) — plan · skills · plugins · Q&A · subagents
- [**Triple shell · looped handoffs**](#/21-triple-shell) — α plan · β build · γ verify + upstream crates
- [**Official xAI · legal · models · use cases**](#/18-official-xai) — subprocessors · brand · pricing · use-case map
- [Plugin catalog](#/05-plugin-catalog) — **lab-ship** + gy-glyph-pins
- [Leverage further](#/07-leverage)
- [**Lab shells · native vs Electron**](#/15-lab-shells) — speed, footprint, control API
- [**Fork leverage map**](#/19-fork-leverage) — community trees with real tools
- [GrokYtalkY companion](#/10-gy-companion)
- [SpaceXAI / Grok brand](#/12-brand)
- [**Dev build · versions · forks · compliance**](#/14-dev-build-and-forks)
- [**X / xAI · HackerOne bounty**](#/16-hackerone-x) — rewards, scope, our prize scorecard
- [Riffing on docs](#/99-contributing-docs)

**Interactive:** open the **Ship** tab (`#/tool/ship`) or say “open ship”.

## Brand note · SpaceXAI family

**SpaceXAI** is the org brand; **Grok** / **Grok Build** are products under it. Related surfaces include (non-exhaustive): Grok, [x.com](https://x.com), Grokipedia, and other SpaceXAI / xAI properties. Official CLI: **[x.ai/cli](https://x.ai/cli)**.

This **Grok Build Lab** is a **local engineering map** of Grok Build — **not** an official product page and does **not** imply endorsement.

| Name | Role |
|------|------|
| **Grok Build Lab** | Product-facing name of this docs + float shell |
| `docs/architecture-lab/` | **Historical folder path** on disk (do not rename casually — breaks CI/Pages) |
| Bundle id `dev.fornevercollective.*` | Technical packaging only (not user-facing) |

Official logos: `docs/SpaceXAI_Grok_Assets/` · guidelines: [x.ai/legal/brand-guidelines](https://x.ai/legal/brand-guidelines).

## Go / no-go · status.x.ai

**Before any big push or Pages deploy**, check SpaceXAI service health:

```bash
# from repo
npm run status --prefix docs/architecture-lab
# or
bash docs/architecture-lab/scripts/status-xai-check.sh --strict

# install git pre-push hook (recommended)
npm run install-pre-push --prefix docs/architecture-lab
```

Live board: **[status.x.ai](https://status.x.ai)** · NO-GO if incidents / outages; UNKNOWN (CF block) also blocks strict big-push mode until you confirm manually.

## Guidelines we track

| Area | Detail |
|------|--------|
| Contributing | Upstream `CONTRIBUTING.md` — **no** external PRs to SpaceXAI tree |
| Plugins | Anatomy + validate — see [plugin anatomy](#/06-plugin-anatomy) |
| Forks | Lab + GY live outside core; map on [dev build page](#/14-dev-build-and-forks) |
| Versions | Lab `0.2.0` ≠ Grok CLI release; Pages uses git SHA |

## Repo pointers

| Path | Role |
|------|------|
| `crates/codegen/xai-grok-pager-bin` | Binary composition root |
| `crates/codegen/xai-grok-pager` | TUI |
| `crates/codegen/xai-grok-shell` | Agent runtime |
| `crates/codegen/xai-grok-tools` | Tool implementations |
| `crates/codegen/xai-grok-workspace` | Host FS / VCS / exec |
| `crates/codegen/xai-grok-pager/docs/user-guide/` | Official user guide |
| `docs/architecture-lab/` | This lab (docs + native shell) |
| `docs/architecture-lab/native/` | Standalone Rust float app (not workspace member) |

**Note:** Upstream external PRs are not accepted. Local experiments, plugins, and this lab live outside that constraint — on `fornevercollective/grok-build` (or your fork), not as contributions to `xai-org/grok-build`.
