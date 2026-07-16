# Architecture Lab · Native shell (Rust)

**Not Electron. Not a browser tab.**

| Surface | Engine |
|---------|--------|
| Float / Lab window | **tao + wry** → macOS **WKWebView**, Windows WebView2, Linux WebKitGTK |
| Embedded server | **axum** — static lab + `/api/*` (health, git-log, summon, mitigate, …) |
| Terminal | **ratatui** `--mode tui` (mugrok / grok-cli lineage) |

This is the Dojo/Colossus-shaped path: one Rust binary, system webview, no Chromium embed, no Node in the product process.

## Build & run

```bash
cd docs/architecture-lab/native
cargo build --release
./launch.sh float    # always-on-top pod (default)
./launch.sh lab      # full workspace
./launch.sh tui      # terminal control plane
```

### Mac app

```bash
./build-mac-app.sh
open "Architecture Lab.app"
```

### From grok-cli

```bash
# after clone: ~/dev/grok-cli-main
./scripts/launch-architecture-lab.sh float
```

## Leverage map (grok-cli ↔ lab)

| From grok-cli | How we use it |
|---------------|----------------|
| `launch-cli.sh` pattern | Start local surface + optional backend, then hand off |
| `mugrok` / ratatui spirit | `--mode tui` control plane |
| `grok-railway-v15` axum | Same family of in-process HTTP + static serve |
| Notes / history / walkie UI | Already in architecture-lab SPA; native just hosts it |
| Offline Ollama / Grok API | Unchanged — env keys via `~/.grok` |

## Why not Electron

Electron ships a full Chromium + Node. Fine for some tools; wrong for a **terminal-first Grok / Dojo** story. Native uses the **OS webview** and a **Rust** process — closer to Tauri-class footprint without buying the whole framework.

## Deprecation

`docs/architecture-lab/desktop/` (Electron) remains as optional fallback. Prefer:

```bash
native/launch.sh float
```
