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
- [Plugin catalog](#/05-plugin-catalog)
- [Leverage further](#/07-leverage)
- [**Lab shells · native vs Electron**](#/15-lab-shells) — speed, footprint, control API
- [GrokYtalkY companion](#/10-gy-companion)
- [SpaceXAI / Grok brand](#/12-brand)
- [**Dev build · versions · forks · compliance**](#/14-dev-build-and-forks)
- [Riffing on docs](#/99-contributing-docs)

## Brand note

Official logos: `docs/SpaceXAI_Grok_Assets/` · guidelines: [x.ai/legal/brand-guidelines](https://x.ai/legal/brand-guidelines).  
This lab is **local engineering docs**, not an official xAI page. Use marks only to refer to Grok / SpaceXAI accurately — no alteration, no implied endorsement.

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
