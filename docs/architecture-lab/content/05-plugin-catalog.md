# Plugin catalog

Ideas and real plugins mapped to Grok Build surfaces.

Compliance + install details: [Dev build · versions · forks](#/14-dev-build-and-forks) · [Plugin anatomy](#/06-plugin-anatomy).

## In play

| Plugin | Bundle | Role | Readiness (honest) |
|--------|--------|------|--------------------|
| **lab-ship** | **chat orb** + skills · commands · agents · hooks | **Product face = orb** (`orb.html`). `/lab-ship` opens it. Also `/plan-loop` · `/ship-check` · `/triple-handoff` | **v0.2.1** — lab-ship **is** the chat orb + Grok pack. Control: `lab-ship` / `chat_orb`. |
| **gy-glyph-pins** | skills · commands · hooks | Multi-user mesh pins above Grok; `/glyph-pins`, `/with-grok` | Usually present under `~/.grok/plugins/`. Source: **GrokYtalkY** (not monorepo). Enable in TUI if missing. |
| **cloudflare** | marketplace skills | Workers / CF platform (official marketplace) | Marketplace install path (separate from lab-ship). |

### lab-ship install

```bash
# from grok-build repo root
ln -sfn "$(pwd)/docs/architecture-lab/plugin/lab-ship" ~/.grok/plugins/lab-ship
grok plugin validate ~/.grok/plugins/lab-ship
# TUI: Ctrl+L → Plugins → enable lab-ship
# or: grok plugin install ./docs/architecture-lab/plugin/lab-ship --trust
```

**lab-ship = chat orb + phone PWA**

| Surface | Path |
|---------|------|
| Phone | `phone.html` — Chat · Agent · Stream · Prompt · Docs |
| Mini orb | `orb.html` · control `lab-ship` / `chat_orb` |
| Full chat | `chat.html` |

Skills: `lab-ship-orb` · `plan-loop` · `lab-review` · `ship-checklist` · `triple-handoff`  
Commands: **`/lab-ship`** · `/plan-loop` · `/ship-check` · `/triple-handoff`  
Agents: `lab-explorer` · `lab-tester`  
Hook: SessionStart (*chat orb ready*)  

Plugin README: `plugin/lab-ship/README.md`.

### GY install

```text
~/.grok/plugins/gy-glyph-pins
# source of truth:
#   ~/Projects/GrokYtalkY/grok-plugin/gy-glyph-pins
# sync:
#   rsync -a ~/Projects/GrokYtalkY/grok-plugin/gy-glyph-pins/ ~/.grok/plugins/gy-glyph-pins/
# validate:
#   grok plugin validate ~/.grok/plugins/gy-glyph-pins
```

**Grok Build Lab.app** is the host (docs + stream + agent windows).  
**lab-ship** is the **chat orb product** (plus Grok plugin pack). Not the whole Lab shell; not gy-glyph-pins; not the stream window.

## Build next (high value)

| Plugin | Bundle | Why |
|--------|--------|-----|
| **gy-mesh-ops** | skills · commands · hooks | Hub doctor, room join, mesh allowlist |
| **security-fence** | hooks | Deny `rm -rf`, secret dumps, unscoped pipes |
| **repo-ship** | skills · hooks | `/ship`; PostToolUse fmt/test |
| **review-gate** | agents · hooks | Review subagent; Stop → ticket MCP |
| **dojo-colossus** | skills · agents · MCP | Cluster jobs, GPU queue, log tail |
| **design-loop** | skills · agents | `/design` + plan agent (pairs with plan-loop) |
| **mcp-browser-lab** | `.mcp.json` | Playwright verify after UI edits |
| **mcp-data** | `.mcp.json` | Postgres / Notion / Jira tools |
| **lsp-rust-suite** | `.lsp.json` | rust-analyzer (+ gopls, …) |
| **ci-babysit** | skills · commands | PR CI poll / restack notes |
| **voice-walkie** | skills · hooks | GY burst status into SessionStart |
| **theme-team** | commands | Shared config/theme snippets |

## Scoring rubric (riff here)

When evaluating a plugin idea, score 1–5:

| Axis | Question |
|------|----------|
| **ROI** | Saves repeated prompt/tool pain? |
| **Fit** | Uses existing surfaces (not a core fork)? |
| **Trust** | Safe as user vs project plugin? |
| **Ops** | Easy to install/update/document? |
| **Compose** | Plays with GY / MCP / subagents? |

## Anti-patterns

- Reimplementing mesh chat inside Grok (keep in GY)  
- Baking SaaS APIs into Rust core (use MCP)  
- Giant always-on skills that bloat every session (prefer on-demand)  
- Hooks that block everything without escape hatch  

## Catalog backlog (edit me)

- [ ] security-fence v0.1  
- [ ] repo-ship fmt hook  
- [ ] internal jobs MCP  
- [ ] team marketplace `plugin-index.json`  
