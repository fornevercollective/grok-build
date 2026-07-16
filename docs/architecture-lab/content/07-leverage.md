# How to leverage further

## A. Same-terminal product

```
┌──────────── gy pins-dock (multi-user mesh) ────────────┐
│ pins · feed · @nick chat                               │
├──────────── grok (Grok Build TUI) ─────────────────────┤
│ agent · tools · plugins · MCP · subagents              │
└────────────────────────────────────────────────────────┘
```

```bash
gy grok
```

Keep **mesh in GY**, **code agent in Grok**. Plugin SessionStart = path/status only.

## B. Headless automation

```bash
grok -p "run tests and summarize failures"
grok -p "…" --json --permission-mode always-approve   # CI carefully
```

Plugins (skills/hooks/MCP) still load when enabled.

## C. IDE embedding (ACP)

```bash
grok agent stdio
grok agent serve --bind 127.0.0.1:2419 --secret …
```

Same plugins, second surface. Client handles permissions UI if desired.

## D. Subagent fan-out

| Type | Role |
|------|------|
| `explore` | Research, no edits |
| `plan` | Implementation plan, no edits |
| `general-purpose` | Full capability |
| custom `agents/*.md` | Domain specialists |

Personas (`[subagents.personas]`) layer tone without new agent types.

## E. Marketplace / team distro

```toml
[[marketplace.sources]]
name = "team"
git = "https://github.com/you/team-grok-plugins.git"
```

Publish `plugin-index.json` for rich `/marketplace` UI.

## F. Guardrails that scale

| Layer | Mechanism |
|-------|-----------|
| Policy | Hooks (PreToolUse deny) |
| Isolation | Sandbox feature |
| Trust | Folder trust for project MCP/hooks |
| Secrets | Sanitizer on tool output / logs |
| Permissions | modes + allow/deny rules |

## G. Memory + rules

- **AGENTS.md** — always-on team law  
- **Skills** — on-demand procedures  
- **Memory** — durable facts across sessions  

## H. External power via MCP

Anything with an API → MCP server in a plugin, not a core crate:

- tickets, cloud, trading, calendars  
- internal gRPC/HTTP gateways  
- browser automation  

## I. Companions outside the monorepo

| Product | Relation |
|---------|----------|
| GrokYtalkY | Pins, mesh, camera — plugin + tmux (**separate repo**) · [GY companion](#/10-gy-companion) |
| Grok Build Lab shells | Native (tao/wry) product path vs Electron fallback · [Lab shells analysis](#/15-lab-shells) |
| Grok Build Lab | Docs + native float shell under `docs/architecture-lab/` (not a core crate) |
| Community Grok Build forks | Desktop hosts, privacy distros, packaging, multi-provider plans · [Fork leverage map](#/19-fork-leverage) |
| ptyctl | Headless PTY (alacritty_terminal) |
| Custom MCP | Language-agnostic tools |

**Float app automation:** `POST /api/control` on the native shell (lab · chat · stream, dock/link, pin, eval JS, safe refresh). Full route + performance map: [Lab shells · native vs Electron](#/15-lab-shells).

**Fork tools (patterns, not wholesale adopt):** [Fork leverage map](#/19-fork-leverage) — Gork privacy binary, GrokPtah Tauri desktop, grok-oss packaging/OpenRouter, agent-tui dual-install, open-grok provider design.

Fork / version / compliance map: [Dev build · versions · forks](#/14-dev-build-and-forks).

## J. Practical roadmap

1. Harden **gy-glyph-pins** (multi-user + exit ffmpeg reap)  
2. **security-fence** plugin  
3. **repo-ship** PostToolUse fmt/test  
4. One **internal MCP** that matters  
5. **ACP** into primary editor  
6. **Headless CI** job with trusted plugins  
7. **Personas** for review/research  

Edit this page as priorities change — it's the living leverage backlog.
