# Decision guide

Which extension type should I use?

```
Need the model to *know how* to do X repeatedly?
  → Skill (or Command if user should invoke /x)

Need to *block or react* to tool/session events?
  → Hook

Need *live external tools* (API, browser, DB)?
  → MCP (in plugin or config)

Need a *specialized child agent*?
  → agents/*.md (+ optional persona)

Need *editor-grade code intelligence*?
  → LSP in plugin

Need *always-on repo law*?
  → AGENTS.md

Need *UI above Grok in the same terminal*?
  → Companion process (gy) + thin plugin
     (not ratatui inside a plugin)
```

## Examples

| Goal | Choose |
|------|--------|
| Conventional commits | Skill `/commit` |
| Block force-push main | Hook PreToolUse |
| Create Linear issues | MCP |
| Read-only codebase tour | Subagent `explore` |
| Team coding standards | AGENTS.md |
| Multi-user walkie tiles | GY + gy-glyph-pins |

## When to change core crates

Only if:

- New **first-class tool** all users need, or  
- Performance/correctness in the harness itself  

Otherwise: **plugin · MCP · companion**.

## Riff: your decision log

| Date | Decision | Type | Notes |
|------|----------|------|-------|
| | | | |
