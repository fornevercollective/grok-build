# Ship everything · x.ai/cli → Lab

Map of **Grok Build** capabilities from [x.ai/cli](https://x.ai/cli) to this lab, the official TUI, and the **lab-ship** plugin pack.

**Goal:** one surface for the whole workflow — plan · build · test · deploy — with Grok communication that is **fast**, **robust**, and **extensible**.

Official docs: [docs.x.ai/build](https://docs.x.ai/build/overview) · [models](https://docs.x.ai/developers/models) · [use cases](https://x.ai/grok/use-cases) · [brand](https://x.ai/legal/brand-guidelines) · [subprocessors](https://x.ai/legal/subprocessor-list).  
Lab iterate page: [Official xAI](#/18-official-xai). In-tree user guide: `crates/codegen/xai-grok-pager/docs/user-guide/`.  
Upstream: [xai-org/grok-build](https://github.com/xai-org/grok-build) · fork: [fornevercollective/grok-build](https://github.com/fornevercollective/grok-build) · live: [Pages](https://fornevercollective.github.io/grok-build/).

---

## Feature matrix

| Capability | Official TUI / CLI | Grok Build Lab | Extension path |
|------------|-------------------|----------------|----------------|
| **Plan mode** | `/plan` · Shift+Tab · `enter_plan_mode` | **Ship** tab · Plan rehearsal | plan agent · `lab-ship` skill `plan-loop` |
| **Subagents** | `spawn_subagent` · explore / plan / general-purpose | **Ship** tab · parallel cards | `agents/*.md` · personas |
| **Skills** | auto-invoke · `/skillify` · `SKILL.md` | **Ship** · skill cards · plugin pack | `skills/*/SKILL.md` |
| **Plugins** | Ctrl+L · marketplace · git install | **Ship** · install recipes | `.grok-plugin/plugin.json` |
| **Q&A** | `ask_user_question` multi-choice | **Ship** Q&A · chat text turns | plan mode + chat |
| **Hooks** | PreToolUse can deny · lifecycle | lab-ship hooks + docs | `hooks/hooks.json` |
| **MCP servers** | Linear · Sentry · Grafana · custom | docs + catalog · Ctrl+L MCP | `.mcp.json` |
| **AGENTS.md** | per-directory conventions | lab AGENTS.md · doc | repo / dir rules |
| **Memory** | cross-session decisions | notes + roadmap memory notes | `~/.grok` memory |
| **Code search** | grep / codebase tools | History + docs search | built-in tools |
| **Multi-file edits** | search_replace | (agent in TUI) | tools crate |
| **Git integration** | stage · commit · push | History tab · `/api/git-log` | hooks / skills |
| **Deep reasoning** | step-by-step model turns | chat · notes Ask rail | model config |
| **Web search** | terminal web tools | link-out · X desk | built-in + MCP |
| **Terminal execution** | live streaming shell | Terminal footer · multi-term | sandbox optional |
| **Headless mode** | CI/CD scripting | `status-xai-check` · scripts | `grok` headless |
| **Code review** | line feedback · `/review` | review skill · check-work | skills · agents |
| **Sandboxed execution** | isolated untrusted code | doc + sandbox guide | sandbox config |
| **Background tasks** | monitor long builds | multi-term · events API | monitor tool |
| **Theming** | colors · fonts · appearance | lab CSS tokens · brand page | themes |

Interactive playground: open the **Ship** tab (`#/tool/ship`) or say “open ship”.

---

## Plan mode (TUI truth)

1. Agent or user enters plan mode (`/plan` or Shift+Tab).  
2. Exploration is **read-only** except `plan.md` in the session dir.  
3. Optional **Q&A** via `ask_user_question`.  
4. `exit_plan_mode` → approve / comment / request changes / quit.  
5. Implementation only after **approve**.

Lab rehearsal: Ship → **Plan** panel walks the same stages without mutating the repo.

---

## Subagents

| Type | Role | Mutates code? |
|------|------|---------------|
| `explore` | Research, grep, read | No |
| `plan` | Structured approach | Plan file only |
| `general-purpose` | Full task | Yes (with perms) |
| Custom (`agents/*.md`) | Project-specific | Per definition |

Worktree isolation: spawn with isolated git worktree so children do not stomp the parent tree.

Lab: Ship → **Subagents** shows parallel cards (demo state machine). Real fan-out happens in the TUI.

---

## Skills · Plugins · Hooks · MCP

```text
Plugin (unit of install)
├── skills/*/SKILL.md     # on-demand procedures
├── commands/*.md         # /slash recipes
├── agents/*.md           # subagent types
├── hooks/hooks.json      # lifecycle (PreToolUse can deny)
├── .mcp.json             # external tools
└── .grok-plugin/plugin.json
```

**lab-ship** lives at:

```text
docs/architecture-lab/plugin/lab-ship/
```

Install:

```bash
ln -sfn "$(pwd)/docs/architecture-lab/plugin/lab-ship" ~/.grok/plugins/lab-ship
grok plugin validate ~/.grok/plugins/lab-ship
# TUI: Ctrl+L → Plugins → enable lab-ship
```

Or:

```bash
grok plugin install ./docs/architecture-lab/plugin/lab-ship --trust
```

---

## Q&A (nail the details)

When a task is ambiguous, Grok asks **multiple-choice** questions; answers feed the plan.

| Surface | Behavior |
|---------|----------|
| TUI | `ask_user_question` modal · Other free-text |
| Lab Ship | Local Q&A rehearsal · stores answers in `localStorage` |
| Lab Chat | Text + voice turns · intent routing |

---

## Communication stack (fast & robust)

| Layer | Path | Role |
|-------|------|------|
| **Chat float** | `chat.html` · native dual window | Voice hold-to-talk · text bar · control plane |
| **Lab shell** | `index.html` · docs + tools | Architecture · Ship · Notes · History |
| **Listen** | `grok-listen.js` | “hey grok” · tab intents · summon |
| **Control API** | `/api/control` · native axum | show/hide · dock · pin · stream |
| **Ops** | `/api/processes` · mitigate · events | Kill ffmpeg · summon · health |
| **CLI agent** | `grok` / `xai-grok-pager` | Full tools · plan · subagents · MCP |

**Robustness rules**

1. Prefer **local APIs** with short timeouts; degrade to static Pages when offline (`sw.js`).  
2. Never block the UI thread on long shell — use multi-term + events.  
3. Voice and text share one **intent router** (`grok-listen` + chat text).  
4. Pin chat window for always-on operator UX; undock for multi-monitor.  
5. Check [status.x.ai](https://status.x.ai) before big pushes (`npm run status`).

---

## Slash / voice quick map

| Intent | TUI | Lab |
|--------|-----|-----|
| Plan | `/plan` | Ship → Plan · “open plan” |
| Skills | Ctrl+L Skills | Ship → Skills · “open ship” |
| Plugins | `/plugins` | Ship → Plugins |
| Subagents | `/agents` | Ship → Subagents |
| Docs | — | Docs tab · hash routes |
| Summon | launch TUI | “hey grok” · multi-term |
| Review | `/review` | skill `lab-review` |

---

## Compliance

| Rule | Lab stance |
|------|------------|
| No external PRs to `xai-org/grok-build` | Lab + plugin on **fork** only |
| Prefer plugins over forking pager | **lab-ship** + GY plugins |
| Unaltered brand marks | `assets/brand/` · content/12-brand |
| Apache-2.0 | Lab + native shell aligned |

---

## Verification checklist

- [ ] `./serve.sh` → Ship tab loads · no console errors  
- [ ] Plan rehearsal → approve path updates status  
- [ ] Q&A answers persist across refresh (`lab.ship.v1`)  
- [ ] `grok plugin validate` on lab-ship passes  
- [ ] Chat text send routes an intent or shows echo  
- [ ] Pages deploy: `version.json` SHA updates · clients auto-reload  

See also: [Extension surfaces](#/04-extension-surfaces) · [Plugin catalog](#/05-plugin-catalog) · [Roadmap](#/09-roadmap) · [Lab shells](#/15-lab-shells).
