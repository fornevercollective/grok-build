# Plugin catalog

Ideas and real plugins mapped to Grok Build surfaces.

Compliance + install details: [Dev build · versions · forks](#/14-dev-build-and-forks) · [Plugin anatomy](#/06-plugin-anatomy).

## In play

| Plugin | Bundle | Role | Guideline status |
|--------|--------|------|------------------|
| **lab-ship** | skills · commands · agents · hooks | Plan loop · Q&A · `/ship-check` · lab-explorer / lab-tester · SessionStart | In-tree under `docs/architecture-lab/plugin/lab-ship/`. Install + validate below. |
| **gy-glyph-pins** | skills · commands · hooks | Multi-user mesh pins above Grok; `/glyph-pins`, `/with-grok` | Manifest valid (`grok plugin validate`). Enable in TUI if not listed. Source: **GrokYtalkY** (not monorepo). |
| **cloudflare** | marketplace skills | Workers / CF platform (official marketplace) | Marketplace install path |

### lab-ship install

```bash
# from grok-build repo root
ln -sfn "$(pwd)/docs/architecture-lab/plugin/lab-ship" ~/.grok/plugins/lab-ship
grok plugin validate ~/.grok/plugins/lab-ship
# TUI: Ctrl+L → Plugins → enable lab-ship
```

Skills: `plan-loop` · `lab-review` · `ship-checklist`  
Commands: `/plan-loop` · `/ship-check`  
Agents: `lab-explorer` · `lab-tester`

Interactive lab UI: **Ship** tab (`#/tool/ship`) · doc [Ship everything](#/17-ship-everything).

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

**Grok Build Lab is not a plugin.** It is a companion docs + float shell under `docs/architecture-lab/`. The **lab-ship** plugin is the installable Grok extension that pairs with the lab UI.

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
