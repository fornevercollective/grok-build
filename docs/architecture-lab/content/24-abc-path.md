# A · B · C path — center + 3 feeds

**Cherry-pick rule:** steal **patterns**, not monorepos. Ship as **Lab / Panda / plugins** — matches `CONTRIBUTING.md` (no PRs to `xai-org`) and Lab `AGENTS.md` (prefer extension surfaces).

## Options (ranked)

| Option | Host | Feeds | Status (0.3.9+) |
|--------|------|-------|-----------------|
| **A** | Lab native (center + control) | Panda / Terminal αβγ **next to** Lab | **Primary workflow** — Multi opens 3 titled terms + optional Panda mux |
| **B** | Browser workbench / Agent | **Embedded** xterm via `/api/pty/*` | **Primary for serve** — `./serve.sh` → `/workbench.html` |
| **C** | Panda / Mu hosts Lab | Lab as pane / frost webview | **Pipe only** — not default; see below |

## How they map onto grok-cli / overview

| Path | Use **grok-cli** for | Use **overview** for |
|------|----------------------|----------------------|
| **A** Lab + Multi αβγ | Railway agent roles · TerminalPane layout · mugrok speed | Outline “plan approve” UI · snapshot export |
| **B** Workbench center+3 PTY | Chat stream + tool-card density from notes/railway | **onAiIterate-style** center · markdown/math cards |
| **C** Panda/Mu hosts Lab | mugrok + ironraw terminal host | Lab as embedded surface + snapshot bridge |

**Closest kinship:** railway axum+WS ↔ Lab native axum control bus; mugrok/notes terminal ↔ Panda + workbench PTY; overview’s host-wired AI callback ↔ **Agent/Workbench Send → `POST /api/agent/iterate` → `grok -p`** (no client keys).

Full map, scorecard, and upstream tip: [Dev-off · grok-cli · overview](#/26-dev-off-grok-cli-overview).

### What we should not do

- Vendor whole **grok-notes-ts** or **overview** (React monorepo tax, Electron vibes).
- Treat railway HTML as the Lab shell (we have **tao+wry**).
- Ship API keys in **`VITE_*`**.

**Do:** path-copy small modules (WS enum, snapshot codec, tool-card CSS) into Lab / `experiments/`.

## Option A — two processes, one workflow

1. Run **native Lab** (`docs/architecture-lab/native/./launch.sh float`).
2. **Multi** / menu Open Multi-term → Terminal windows titled **α Plan · β Build · γ Verify** (profiles under `~/.panda/profiles/`).
3. **Arrange / Dock** tiles Lab satellites; OS terms sit on the left (scripted bounds).
4. Agent / Launch / Chat stay Lab chrome; real typing is in Terminal/Panda.

**Center agent (now):** general Agent Send → `LabAiIterate` / `grok -p` when serve (or native proxy) is up; plan/build/verify still route to handoff bus + Multi.

## Option B — one browser surface

```bash
cd docs/architecture-lab
./serve.sh          # auto-picks free port if :8765 held by native
# → workbench.html  center agent + live αβγ xterm
# POST /api/agent/iterate  { "prompt": "…", "role": "agent" }
```

If native already owns **8765**, serve prints the free port (e.g. **8766**). Use **that** URL for PTY hub + iterate; native WebViews keep using their embedded server.

Surfaces: Workbench · Agent · Launch · Chat · Stream (tabs on Lab + Launch pad).

## Option C — Panda/Mu as host (pipe)

Goal: **one product process** where Lab is a webview/pane inside Panda frost window.

| Step | Work |
|------|------|
| C.1 | `panda window` / frost already experiments path |
| C.2 | Load `http://127.0.0.1:PORT/` or workbench as embedded surface |
| C.3 | Map αβγ panes ↔ Lab handoff bus (same `lab-handoff.json`) |
| C.4 | Ship as optional `panda host-lab` — **not** default until frost stable |

**Do not** merge Mu/Tauri monorepos. Pattern only: multi-pane host + env dual-home + handoff file.

## Cherry-pick scorecard (with grok-cli + overview)

| Bucket | Count | Reality |
|--------|------:|---------|
| External high-signal trees on disk | **+2** | grok-cli, overview |
| Concepts in Lab product now | **~5–6** | Multi-PTY, dual home, handoff, workbench PTY, browser host, clusters |
| Ready to productize next | **3** | onAiIterate bridge · railway WS bus · TerminalPane chrome |
| Fully productized | **~3** | Panda multi-pane · dual home · serve workbench αβγ (+ iterate stub/live) |
| Leave as reference | rest | OAuth notebook, full notes collab, TensorFlow, … |

## World-class gap (honest)

| Dimension | Gap |
|-----------|-----|
| Full Grok ACP stream in center | Medium-large — iterate is headless `grok -p`, not full pager tools UI |
| Native = workbench PTY | Medium — native Multi = OS terms; PTY hub = serve |
| Railway WS agent bus | Not yet — patterns only |
| Snapshot interchange | Not yet — overview codec as next path-copy |
| Robustness | Medium — multi-window + multi-PTY dogfood TBD |

## Pull order (next)

1. **Center agent** — onAiIterate bridge (shipped thin) → richer tool stream / optional railway WS  
2. **Terminal chrome** — notes TerminalPane UX on αβγ  
3. **Session interchange** — overview snapshot export next to handoffs  
4. **Option C** — mugrok/ironraw host; Lab URL as pane  

## Commands

```bash
# A — native
docs/architecture-lab/native/./launch.sh float   # Multi · Arrange · Agent

# B — browser PTY + iterate
docs/architecture-lab/./serve.sh                 # workbench on free port
curl -s -X POST http://127.0.0.1:PORT/api/agent/iterate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Summarize Lab A/B/C","role":"agent","max_turns":4}'

# Both: native may hold :8765; serve auto-increments
```

## Related

- [Dev-off · grok-cli · overview · xai-org](#/26-dev-off-grok-cli-overview)
- [Colossus/Dojo LTS](#/25-colossus-dojo-lts) — public-folder · repo-template · StageForge
- [Fleet funnel](#/23-fleet-funnel)
- [Panda shell](#/22-panda-shell)
- [Ship everything](#/17-ship-everything)
