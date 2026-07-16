# Dev-off trees — grok-cli · overview · xai-org

**Cherry-pick rule:** path-copy **small modules** into `docs/architecture-lab/` or `experiments/`.  
**Never** vendor whole trees · never PR to `xai-org` · never ship API keys in `VITE_*`.

One sentence:

> **grok-cli** = terminal + multi-agent + axum/WS + notes density; **overview** = clean offline research shell + AI host hook + shareable snapshots — both are **pattern mines** for Lab, not drop-in apps.

Local checkouts (this machine):

| Tree | Path |
|------|------|
| grok-cli | `~/projects/grok-cli` |
| overview | `~/projects/overview` |
| xai-org/grok-build | remote `upstream` on this fork |

---

## Upstream `xai-org/grok-build` — what’s new

GitHub compare often fails (**unrelated histories**). Local truth:

```bash
git fetch upstream
git log --oneline main..upstream/main
# currently (re-fetch to refresh):
#   8adf901  Synced from monorepo
#   c68e39f  Publish harness and TUI open-source
```

### `8adf901` — Synced from monorepo (tip)

Notable monorepo deltas in that sync (not Lab code):

| Area | What changed | Lab need? |
|------|----------------|-----------|
| **hooks HTTP** | SSRF fix — block redirect bypass in hook runner | **Maybe later** — path-checkout if we re-use hook runner patterns |
| **headless pager** | Drain `task_backgrounded` before no-wait exit | **Yes pattern** — our `/api/agent/iterate` uses `grok -p`; match timeouts |
| **skills** | Keep skills reachable when name collides with client builtin | **Low** — Lab skills are separate |
| **grok-shell** | OAuth `workspaces:read/write`; release session binding | **No** — not Lab chrome |
| **voice / STT** | Enterprise WSS URL + API-key bearer | **No** — Lab uses SpaceXAI voice proxy already |
| **sandbox / workspace-server** | Delete legacy ready-file arm | **No** unless we host sandbox |
| **pager UX** | Folder-trust in minimal mode; billing URL when browser can’t open | **No** for Lab shell |
| **agent SDK** | Stop SDK agents staging self-updates they can’t adopt | **No** |
| **link opener** | Preserve semantic link targets; VS Code SSH links | **No** |
| **Build** | `SOURCE_REV` monorepo SHA; **DotSlash** required for `bin/protoc` | **Yes if building crates** — install DotSlash before path-checkout builds |

### `c68e39f` — Publish harness and TUI open-source

Initial public open-source sync of harness + TUI from the monorepo. Baseline for all later syncs.

### What we should take from upstream

| Action | What | How |
|--------|------|-----|
| **Do not** | Force-merge entire `upstream/main` | Histories unrelated; would trash Lab |
| **Do** | Note `SOURCE_REV` + DotSlash when rebuilding monorepo crates | Path-checkout `crates/` only |
| **Do** | Mirror headless drain/timeout discipline | Lab `POST /api/agent/iterate` |
| **Maybe** | Hooks SSRF lesson | Never allow open redirects in any Lab webhook proxy |
| **Skip** | OAuth workspace scopes, enterprise STT, settings_modal split | Pager product surface |

```bash
# Example path-checkout (only when you need a crate fix):
git fetch upstream
git checkout upstream/main -- crates/codegen/xai-grok-hooks/src/runner/http.rs
# review · build · commit on a branch — never force-merge trees
```

---

## How grok-cli / overview map onto A · B · C

| Path | Use **grok-cli** for | Use **overview** for |
|------|----------------------|----------------------|
| **A** Lab + Multi αβγ | Railway agent roles · TerminalPane layout · mugrok speed | Outline “plan approve” UI · snapshot export |
| **B** Workbench center+3 PTY | Chat stream + tool-card density from notes/railway | **onAiIterate-style** center · markdown/math cards |
| **C** Panda/Mu hosts Lab | mugrok + ironraw terminal host | Lab as embedded surface + snapshot bridge |

**Closest kinship**

- **grok-cli** railway axum+WS ↔ Lab native **axum control bus** (`/api/control`, `/api/shells`, `/api/pty/*`)
- **mugrok/notes** terminal ↔ **Panda + workbench PTY**
- **overview** host-wired AI callback = cleanest pattern for **Agent/Workbench Send → real model** without forking the pager

---

## What we should **not** do

- Vendor whole **grok-notes-ts** or **overview** into grok-build (React monorepo tax, Electron vibes, license/ops noise).
- Treat **railway HTML** as the Lab shell (we already have **tao+wry**).
- Ship API keys in **`VITE_*`** (overview already forbids that — keep it).
- Monorepo-merge **xai-org** or open external PRs.

**Do:** path-copy small modules (WS message enum, snapshot codec, chat scroll/tool-card CSS, drawer tabs) into `docs/architecture-lab/` / `experiments/`.

---

## Updated cherry-pick scorecard

| Bucket | Count | Reality |
|--------|------:|---------|
| External high-signal trees on disk | **+2** | grok-cli, overview |
| Concepts in Lab product now | **~5–6** | Multi-PTY, dual home, handoff, workbench PTY, browser host, clusters |
| Ready to productize next from these | **3** | (1) overview **onAiIterate** → Agent/Workbench, (2) railway WS agent bus, (3) notes TerminalPane chrome |
| Leave as reference | rest | OAuth notebook, TensorFlow, full notes collab, etc. |
| Upstream monorepo tip | 2 commits | path-checkout only · SSRF/headless patterns |

---

## Suggested pull order

### 1. Center agent (closes “no tool stream” gap) — **in progress**

- overview: **onAiIterate** contract  
- grok-cli: ChatComponent + railway task/agent WS shapes  
- Wire Agent/Workbench Send → `grok -p` / SpaceXAI / optional railway-style WS  

**Lab now:** `POST /api/agent/iterate` + `assets/lab-ai-iterate.js` (thin host hook).  
Keywords plan/build/verify still route to PTY/handoff first; general turns call iterate.

### 2. Terminal chrome polish (A/B)

- notes **TerminalPane** UX on workbench αβγ  
- keep PTY backend as `serve.sh` / Panda  

### 3. Session interchange

- overview workspace snapshot as optional export for Lab agent + handoffs  
- schema reference: `~/projects/overview/src/research/workspace-snapshot.ts`  
- Lab target: optional `lab-session.json` next to `~/.panda/lab-handoff.json`  

### 4. Option C later

- mugrok/ironraw as host shell; Lab URL as pane (still pattern-only)

---

## Lab surfaces for this map

| Surface | Role |
|---------|------|
| `GET/POST /api/agent/iterate` | Host AI callback (overview-style) via `grok -p` |
| `assets/lab-ai-iterate.js` | Client helper · stub when offline |
| Workbench / Agent Send | Routes roles · else iterates |
| `#/24-abc-path` | A/B/C options |
| `#/25-colossus-dojo-lts` | Media → train LTS pipe |
| This page | Dev-off + upstream |

---

## Related

- [Upstream tools sync · Lab 1–4+](#/27-upstream-tools-sync) — path-checkout inventory
- [A · B · C path](#/24-abc-path)
- [Colossus/Dojo LTS](#/25-colossus-dojo-lts)
- [Fleet funnel](#/23-fleet-funnel)
- [Dev build · forks](#/14-dev-build-and-forks)
- [Merge · conflicts](#/20-merge-and-conflicts)
