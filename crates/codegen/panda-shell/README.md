# panda

Standalone **glass-morphism multi-terminal shell** with:

- **Detach / reattach** sessions (daemon-backed PTYs)
- **Model routing strip** (route env into every pane)
- **Hybrid Metal frost window** (`panda window`)
- Black-on-black frost TUI chrome

```
░▒ panda [main]  ◉main  ·  CPU · Metal · GPU
 models  1 Grok Build [cloud]  2 Grok 4 [cloud]  3 Local Metal [metal] …
╭─ ◆ zsh · live ──────┬─ ◆ zsh · live ──╮
│ $ _                 │                 │
╰─────────────────────┴─────────────────╯
 · C-a d detach  C-a q kill  C-a m model
```

## Install (standalone app)

```bash
# from monorepo
cargo build -p panda-shell --release
./target/release/panda install          # → ~/.local/bin/panda
# macOS also writes ~/.panda/Panda.command (double-clickable)

panda info
```

Data lives under `~/.panda/` (`PANDA_HOME` overrides):

| Path | Purpose |
|------|---------|
| `panda.sock` | daemon IPC |
| `daemon.pid` | daemon pid |
| `daemon.log` | daemon log |
| `Panda.command` | macOS launcher |

## Sessions (detach / reattach)

```bash
panda                        # create/attach session `main`
panda new dev --splits 2     # named session, 2 starter splits
# inside TUI:  Ctrl-a d      # detach (PTYs keep running)
panda ls                     # list sessions
panda attach dev             # reattach
panda kill dev               # destroy session
panda start                  # ensure daemon is up
panda daemon                 # run daemon in foreground
```

Default flow auto-spawns the daemon on first use.

| Chord | Action |
|--------|--------|
| `C-a d` | **Detach** (session lives) |
| `C-a q` | Kill session & quit |
| `C-a %` / `"` | Split H / V |
| `C-a` arrows | Focus neighbor |
| `C-a m` / `M` | Next / prev **model** |
| `C-a 1-9` | Select model on strip |
| `C-a ?` | Help |

## Model routing strip

Top strip shows catalog chips. Active model is exported into every pane:

```
PANDA_MODEL / GROK_MODEL / AI_MODEL
PANDA_MODEL_LABEL
PANDA_MODEL_BACKEND   # cloud | metal | cpu | gpu
```

Override catalog:

```bash
export PANDA_MODELS='grok-build:Grok Build:cloud,mlx-local:MLX:metal,jax:JAX:gpu'
panda new ml
```

## Hybrid Metal frost window

```bash
panda window           # session main
panda window dev
```

Native window with a **glass frost shader** (Metal-labelled kernel on macOS, CPU fallback elsewhere). Pulls live frames from the same daemon session. `Esc` / `q` closes (detaches that client only).

```bash
panda accel            # CPU / Metal / GPU + frost backend
```

## Stack

| Layer | Tech |
|--------|------|
| TUI | ratatui + crossterm |
| VT / PTY | alacritty_terminal via `ptyctl` + portable-pty |
| Sessions | Unix socket daemon (`~/.panda/panda.sock`) |
| Frost window | winit + softbuffer + frost shader |
| Accel | CPU topology + Metal probe + GPU label |

## Env

| Variable | Meaning |
|----------|---------|
| `PANDA_HOME` | Config/socket root |
| `PANDA_MODELS` | `id:label:backend,...` |
| `PANDA_GPU` | Override GPU label |
| `PANDA_METAL_NAME` | Override Metal detail |
| `PANDA_NO_METAL=1` | Force-disable Metal claim |
| `SHELL` | Default pane shell |
