# A · B · C path — center + 3 feeds

**Cherry-pick rule:** steal **patterns**, not monorepos. Ship as **Lab / Panda / plugins** — matches `CONTRIBUTING.md` (no PRs to `xai-org`) and Lab `AGENTS.md` (prefer extension surfaces).

## Options (ranked)

| Option | Host | Feeds | Status (0.3.6+) |
|--------|------|-------|-----------------|
| **A** | Lab native (center + control) | Panda / Terminal αβγ **next to** Lab | **Primary workflow** — Multi opens 3 titled terms + optional Panda mux |
| **B** | Browser workbench / Agent | **Embedded** xterm via `/api/pty/*` | **Primary for serve** — `./serve.sh` → `/workbench.html` |
| **C** | Panda / Mu hosts Lab | Lab as pane / frost webview | **Pipe only** — not default; see below |

## Option A — two processes, one workflow

1. Run **native Lab** (`docs/architecture-lab/native/./launch.sh float`).
2. **Multi** / menu Open Multi-term → Terminal windows titled **α Plan · β Build · γ Verify** (profiles under `~/.panda/profiles/`).
3. **Arrange / Dock** tiles Lab satellites; OS terms sit on the left (scripted bounds).
4. Agent / Launch / Chat stay Lab chrome; real typing is in Terminal/Panda.

**ACP / real tool turn (next):** Agent Send → `grok -p` or ACP session writing into active role PTY (still cherry-pick, no pager fork).

## Option B — one browser surface

```bash
cd docs/architecture-lab
./serve.sh          # auto-picks free port if :8765 held by native
# → workbench.html  center agent + live αβγ xterm
```

If native already owns **8765**, serve prints the free port (e.g. **8766**). Use **that** URL for PTY hub; native WebViews keep using their embedded server.

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

## Fork scorecard (updated)

| Bucket | Count | Reality now |
|--------|------:|-------------|
| High-signal forks mapped | ~8 | Docs/funnel |
| Concepts **in code** | **~5–6** | Multi-PTY, dual home, model env, handoff bus, **browser PTY hub**, **workbench tool cards** |
| Fully productized | **~2.5–3** | Panda multi-pane · dual home · **serve workbench live αβγ** |
| Docs / funnel only | ~4–5 | Privacy, OpenRouter, Electron workbench, multi-provider, full ACP |

## World-class gap (honest)

| Dimension | Gap |
|-----------|-----|
| Full Grok ACP stream in center | Large — workbench routes + PTY, not full pager tools UI |
| Native = workbench PTY | Medium — native Multi = OS terms; PTY hub = serve |
| Robustness | Medium — multi-window + multi-PTY dogfood TBD |

## Commands

```bash
# A — native
docs/architecture-lab/native/./launch.sh float   # Multi · Arrange · Agent

# B — browser PTY
docs/architecture-lab/./serve.sh                 # workbench on free port

# Both: native may hold :8765; serve auto-increments
```

## Related

- [Colossus/Dojo LTS](#/25-colossus-dojo-lts) — public-folder · repo-template · StageForge
- [Fleet funnel](#/23-fleet-funnel)
- [Panda shell](#/22-panda-shell)
- [Ship everything](#/17-ship-everything)
