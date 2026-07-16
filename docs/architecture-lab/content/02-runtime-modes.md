# Runtime modes

How you **enter** Grok Build determines the surface, not the core agent loop.

```
                 xai-grok-pager-bin
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  Interactive TUI   Headless (-p)   Agent (ACP)
  full-screen       scripts / CI    IDE / stdio / WS
```

## Interactive TUI

```bash
grok
# or from this tree:
cargo run -p xai-grok-pager-bin
```

- Full-screen ratatui UI  
- Scrollback, prompt, modals (`Ctrl+L` plugins)  
- Binary artifact: `xai-grok-pager` (shipped as `grok`)

## Headless

```bash
grok -p "Explain this codebase"
grok -p "…" --json
```

Use for CI, scripts, one-shot automation. Skills/hooks/MCP still apply when configured.

## Agent mode (ACP)

```bash
grok agent stdio                 # IDE / custom clients
grok agent serve --bind 127.0.0.1:2419
```

[Agent Client Protocol](https://agentclientprotocol.com) JSON-RPC: sessions, streaming, tool visibility, permissions.

## Leader mode

Shared agent process for multi-client / multi-tab attachment (shell leader server). Useful when multiple UI clients talk to one agent.

## Companion mode (not a core mode)

```bash
gy grok    # tmux: GY pins-dock TOP + grok BOTTOM
```

GrokYtalkY is a **sibling process**, not a Grok Build runtime mode. Integration is via plugin + shell + tmux.

## Mode comparison

| Concern | TUI | Headless | ACP |
|---------|-----|----------|-----|
| Human in loop | Yes | Optional flags | Client UI |
| Streaming thoughts | Scrollback | stdout/JSON | Protocol events |
| Permissions | Interactive | flags / yolo | Client may mediate |
| Best for | Daily coding | CI / batch | Editors |
