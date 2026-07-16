# lab-ship plugin

Ship pack for **Grok Build Lab** + fork workflows: plan loop, Q&A discipline, subagent recipes, review, and status.x.ai go/no-go.

## Install

```bash
# from grok-build repo root
ln -sfn "$(pwd)/docs/architecture-lab/plugin/lab-ship" ~/.grok/plugins/lab-ship
grok plugin validate ~/.grok/plugins/lab-ship
```

Enable in TUI: `Ctrl+L` → Plugins → Space on **lab-ship**.

```toml
# ~/.grok/config.toml
[plugins]
enabled = ["lab-ship"]
```

## Contents

| Kind | Name | Role |
|------|------|------|
| Skill | `plan-loop` | Plan mode discipline |
| Skill | `lab-review` | Lab/plugin review rubric |
| Skill | `ship-checklist` | Pre-push go/no-go |
| Command | `/plan-loop` | Slash entry to plan skill |
| Command | `/ship-check` | Slash entry to checklist |
| Agent | `lab-explorer` | Read-only lab research |
| Agent | `lab-tester` | Smoke checks |
| Hook | SessionStart | Orientation banner |

## Not a pager fork

This plugin extends Grok via official surfaces only. Lab UI lives under `docs/architecture-lab/`.
