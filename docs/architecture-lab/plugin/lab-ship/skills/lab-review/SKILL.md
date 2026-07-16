---
name: lab-review
description: >
  Review Grok Build Lab or plugin changes for speed, robustness, and
  extension-surface fit. Use when the user asks for /lab-review, review
  of architecture-lab, chat, ship deck, or lab-ship plugin diffs.
---

# Lab review skill

## Scope

Review uncommitted or branch diffs focusing on:

| Axis | Look for |
|------|----------|
| **Speed** | Avoid blocking UI; lazy-load heavy tabs; short API timeouts; no large sync work on main thread |
| **Robustness** | Offline/Pages degrade; null checks; control API errors surfaced; no hard crash on missing `/api/*` |
| **Extension fit** | Prefer skills/hooks/MCP/plugins over pager forks |
| **Brand** | Unaltered official SpaceXAI/Grok marks only |
| **Security** | No secret dumps; PreToolUse denylist for destructive shell when hooks present |

## Steps

1. List changed files under `docs/architecture-lab/` and `plugin/lab-ship/`.
2. Smoke mentally: `./serve.sh` → Docs · Ship · Chat · History.
3. Check `nav.json` registration for new content pages.
4. Check cache-bust query params on changed JS/CSS in `index.html` / `chat.html`.
5. Report findings as:
   - **Blockers** (must fix)
   - **Should fix**
   - **Nits**
6. Suggest verification commands (serve, plugin validate, status.x.ai).

## Output format

- Summary (2–4 sentences)
- Findings table (severity · file · note)
- Suggested next actions
