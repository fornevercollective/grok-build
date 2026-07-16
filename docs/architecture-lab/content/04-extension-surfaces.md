# Extension surfaces

Everything you can bolt on without forking the pager.

## Plugin as the unit of install

A **plugin** bundles any combination of:

| Component | Directory / file | Effect |
|-----------|------------------|--------|
| Skills | `skills/*/SKILL.md` | On-demand prompt packages |
| Commands | `commands/*.md` | Slash commands (`/foo`) |
| Agents | `agents/*.md` | Subagent types |
| Hooks | `hooks/hooks.json` | Lifecycle shell/HTTP |
| MCP | `.mcp.json` | External tools |
| LSP | `.lsp.json` | Language servers |
| Manifest | `.grok-plugin/plugin.json` | Metadata + path overrides |

## Loose (non-plugin) locations

| Kind | User | Project |
|------|------|---------|
| Skills | `~/.grok/skills/` | `.grok/skills/` |
| Commands | `~/.grok/commands/` | `.grok/commands/` |
| Hooks | `~/.grok/hooks/` | `.grok/hooks/` |
| Agents | `~/.grok/agents/` | `.grok/agents/` |
| Plugins | `~/.grok/plugins/` | `.grok/plugins/` |
| Config | `~/.grok/config.toml` | `.grok/config.toml` (subset) |
| Rules | — | `AGENTS.md` |

## Plugin discovery priority

1. Session `_meta.pluginDirs` / SDK  
2. `--plugin-dir` (agent process)  
3. `.grok/plugins/` (project — needs trust)  
4. `~/.grok/plugins/` (user — trusted)  
5. `[plugins].paths` in config  

## Hook events (summary)

| Event | Blocking? |
|-------|-----------|
| `SessionStart` / `SessionEnd` | No |
| `UserPromptSubmit` | No |
| `PreToolUse` | **Yes — can deny** |
| `PostToolUse` / `PostToolUseFailure` | No |
| `Stop` / `StopFailure` | No |
| `SubagentStart` / `SubagentStop` | No |
| `PreCompact` / `PostCompact` | No |
| `PermissionDenied` / `Notification` | No |

Plugin hooks get `GROK_PLUGIN_ROOT` and `GROK_PLUGIN_DATA`.

## Skills vs AGENTS.md vs Commands

| | AGENTS.md | Skill | Command |
|--|-----------|-------|---------|
| Always loaded | Yes | No (on demand) | No (user `/`) |
| Best for | Repo law | Procedures | Invokable recipes |

## MCP vs built-in tools

- **Built-in tools** — shell, edit, search, web, subagents (core crates)  
- **MCP tools** — anything with an API you don't want in core  

Prefer MCP for SaaS and internal services; keep core lean.

## Manage in TUI

`Ctrl+L` or `/plugins` → tabs: **Hooks · Plugins · Marketplace · Skills · MCP**
