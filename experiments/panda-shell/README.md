# Panda · glass multi-terminal shell

**Product experiment** toward a new **Mu-class** terminal / app shell — multi-pane PTYs, detach/reattach, model routing strip, hybrid frost window.

- **Not** an `xai-org` crate. Lives under `experiments/` so upstream syncs do not erase it.
- **Does not** fork `xai-grok-pager`. Talks to `grok` / agents as **spawned processes** and env (model strip).
- Reuses monorepo **`ptyctl`** (upstream VT/PTY) as a library path dep only.

```
░▒ panda [main]  ◉main  ·  CPU · Metal · GPU
 models  1 Grok Build [cloud]  2 Grok 4 [cloud]  3 Local Metal [metal] …
╭─ ◆ zsh · live ──────┬─ ◆ zsh · live ──╮
│ $ _                 │                 │
╰─────────────────────┴─────────────────╯
 · C-a d detach  C-a q kill  C-a m model
```

## Why this exists

| Source | What we take |
|--------|----------------|
| **This crate (history)** | Daemon sessions · glass frost · multi-pane · model strip |
| **Grok Build Lab** | Triple shell α/β/γ · handoff bus · native float patterns |
| **GrokPtah** (fork leverage) | Multi-tab PTY + tool cards **as UX reference** — not a Tauri rewrite |
| **agent-tui** | Separate config home (`~/.panda` vs `~/.grok`) |
| **gork / no-telemetry** | Optional privacy defaults later |
| **grok-oss** | Distro/install ideas later |
| **Mu** (`04.crush/mu`) | GPU / Metal / winit direction for frost + future viz |

Stance: **steal patterns, not monorepos.** Prefer plugins/MCP for agent behavior; Panda owns **shell UX**.

## Build

```bash
# from grok-build repo root (workspace member)
cargo build -p panda-shell --release
./target/release/panda info
./target/release/panda install   # → ~/.local/bin/panda (+ macOS Panda.command)
```

## Sessions

```bash
panda                        # attach/create session main
panda new dev --splits 2
# TUI: Ctrl-a d  detach · Ctrl-a q kill · Ctrl-a % / " splits · Ctrl-a m model
panda ls
panda attach dev
panda window                 # frost native window on session
panda accel                  # CPU / Metal / GPU probe
```

Data: `~/.panda/` (`PANDA_HOME` override). Socket daemon keeps PTYs alive across detaches.

## Model strip → Grok / agents

Active chip exports into every pane:

| Env | Meaning |
|-----|---------|
| `PANDA_MODEL` / `GROK_MODEL` / `AI_MODEL` | id |
| `PANDA_MODEL_LABEL` | display |
| `PANDA_MODEL_BACKEND` | `cloud` · `metal` · `cpu` · `gpu` |

```bash
export PANDA_MODELS='grok-build:Grok Build:cloud,local:Local:metal'
panda new fleet
# then in a pane: grok   or   grok -p "…"
```

## Lab integration

| Lab surface | Panda role |
|-------------|------------|
| Triple shell α/β/γ | Each column can be a **panda pane** instead of bare Terminal.app |
| `/api/shells` handoffs | Panda sessions stay up while lab bus advances plan→build→verify |
| Ship multi-term | Future: “Open in Panda” instead of only OS Terminal |
| native lab (tao/wry) | Parallel product path; Panda is **terminal-first**, lab is **docs+control** |

See lab page: **`#/22-panda-shell`**.

## Roadmap (kick-ass path)

1. **Stable daemon + multi-pane** (now)  
2. **Wire lab “Spawn triple” → three panda panes** with α/β/γ profiles  
3. **GrokPtah-style tool cards** as optional overlay (not Tauri host)  
4. **Mu GPU path** — promote frost from softbuffer toward wgpu where it helps  
5. **Dual install** — `panda` binary + `~/.panda` never clobbers `~/.grok`  
6. Optional **privacy profile** inspired by gork / no-telemetry (for child `grok` only)

## Stack

| Layer | Tech |
|--------|------|
| TUI | ratatui + crossterm |
| VT / PTY | `ptyctl` + portable-pty |
| Sessions | Unix socket daemon |
| Frost window | winit + softbuffer |
| Accel | CPU topology + Metal probe |

## Env

| Variable | Meaning |
|----------|---------|
| `PANDA_HOME` | Config/socket root |
| `PANDA_MODELS` | `id:label:backend,...` |
| `PANDA_GPU` / `PANDA_METAL_NAME` | Accel labels |
| `PANDA_NO_METAL=1` | Disable Metal claim |
| `SHELL` | Default pane shell |
