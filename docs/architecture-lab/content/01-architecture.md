# System architecture

## Big picture

```
┌─────────────────────────────────────────────────────────────┐
│                     HUMAN / CLIENT                          │
│  Terminal TUI · Headless CLI · IDE (ACP) · Companion (GY)   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  SURFACE — xai-grok-pager (+ render, ratatui-inline)        │
│  scrollback · prompt · modals · slash · plugins UI          │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  RUNTIME — xai-grok-shell                                   │
│  session · leader · headless · ACP · subagents · hooks      │
└────────────────────────────┬────────────────────────────────┘
                             │ tool_calls
┌────────────────────────────▼────────────────────────────────┐
│  TOOLS + HOST — tools · workspace · sandbox · graph         │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  PLATFORM — config · auth · MCP · models · memory · tele    │
└─────────────────────────────────────────────────────────────┘
```

## Data plane vs control plane

| Plane | Carries | Examples |
|-------|---------|----------|
| **Control** | Session lifecycle, permissions, plugins load | SessionStart hooks, folder trust, auth |
| **Data** | Prompts, streams, tool I/O, files | Sampler tokens, shell stdout, edits |
| **Extension** | Skills text, MCP tools, slash commands | Plugin components |

## Trust boundaries

```
User machine
├── Trusted: ~/.grok/plugins, ~/.grok/hooks, user MCP
├── Needs trust: .grok/plugins, project hooks, project MCP
├── Sandbox (optional): OS isolation around tool exec
└── Network: model API, MCP HTTP/SSE, marketplace git
```

## Related official docs

User guide under `crates/codegen/xai-grok-pager/docs/user-guide/`:

- `09-plugins.md` · `08-skills.md` · `10-hooks.md` · `07-mcp-servers.md`  
- `15-agent-mode.md` · `16-subagents.md` · `14-headless-mode.md`
