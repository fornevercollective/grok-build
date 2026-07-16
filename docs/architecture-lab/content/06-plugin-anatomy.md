# Plugin anatomy

## Canonical tree

```text
my-plugin/
  .grok-plugin/plugin.json      # name, version, optional path overrides
  skills/
    my-skill/
      SKILL.md
  commands/
    my-cmd.md                   # → /my-cmd
  agents/
    my-agent.md
  hooks/
    hooks.json
    session-start.sh
  .mcp.json                     # optional
  .lsp.json                     # optional
```

## Minimal `plugin.json`

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "What it does for Grok Build",
  "keywords": ["example"]
}
```

Optional path overrides: `skills`, `commands`, `agents`, `hooks`, `mcp_servers`, `lsp_servers`.

## Skill skeleton

```markdown
---
name: my-skill
description: >
  When to load this skill. Triggers: keyword list.
---

# My skill

Steps the agent should follow…
```

## Command skeleton

```markdown
---
description: Short help for /my-cmd
argument-hint: "[arg]"
---

# My command

Instructions. User argument: $ARGUMENTS
```

## Hooks skeleton

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${GROK_PLUGIN_ROOT}/hooks/session-start.sh\""
          }
        ]
      }
    ]
  }
}
```

## Install & enable

```bash
# local path
grok plugin install ./my-plugin --trust

# or symlink into user plugins
ln -sfn "$(pwd)/my-plugin" ~/.grok/plugins/my-plugin

# list / enable
grok plugin list
# TUI: Ctrl+L → Plugins → Space
```

Config:

```toml
[plugins]
enabled = ["my-plugin", "gy-glyph-pins"]
```

## Validate

```bash
grok plugin validate ./my-plugin
grok plugin details my-plugin
```

## Riff checklist

- [ ] Manifest name matches folder  
- [ ] Skill descriptions include triggers  
- [ ] Hooks are non-blocking unless PreToolUse  
- [ ] SessionStart is cheap (no long network)  
- [ ] README or skill points at companion tools (gy, mcp)  
