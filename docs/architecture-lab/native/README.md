# Grok Build Lab · Native shell (Rust)

**Not Electron. Not a browser tab.**

| Surface | Engine |
|---------|--------|
| Float / Lab window | **tao + wry** → macOS **WKWebView**, Windows WebView2, Linux WebKitGTK |
| Chat window | Same stack · independent frameless float (`chat.html`) |
| Embedded server | **axum** — static lab + `/api/*` + SpaceXAI **control bus** |
| Menus | **muda** (View refresh · Window · Help / updates) |
| Terminal | **ratatui** `--mode tui` (mugrok / grok-cli lineage) |

Dojo/Colossus-shaped path: one Rust binary, system webview, no Chromium embed, no Node in the product process.

> **Dev map (deps · versions · forks · compliance):**  
> [`../content/14-dev-build-and-forks.md`](../content/14-dev-build-and-forks.md) · in-app [Dev build · forks](#/14-dev-build-and-forks)

---

## Versioning

| Field | Location | Meaning |
|-------|----------|---------|
| Crate semver | `Cargo.toml` `version` | Native binary release |
| Mac marketing | `build-mac-app.sh` → `CFBundleShortVersionString` | Must match crate |
| Mac build | `CFBundleVersion` | Integer; bump each `.app` ship |
| Pages / update check | lab `version.json` (git SHA) | Help → Check for Updates… |
| Bundle id | `dev.fornevercollective.architecture-lab` | Local lab — not an xAI product |

**Current baseline:** `0.2.0` (crate + marketing).

This crate is a **standalone Cargo workspace** (`[workspace]` in this folder) — it is **not** a member of the monorepo root workspace. That is intentional (isolation, faster lab iteration).

**License:** Apache-2.0 (aligned with grok-build monorepo).

---

## Build dependencies

| Dependency | Requirement |
|------------|-------------|
| Rust / Cargo | Stable **≥ 1.85** (MSRV). Monorepo may pin higher via root `rust-toolchain.toml`. |
| macOS SDK | 12.0+ · Xcode Command Line Tools |
| Windows | WebView2 runtime |
| Linux | WebKitGTK development packages |
| Python | not required for native binary (used only by `../serve.sh`) |
| Node / Electron | **not** required |

### Direct crates (see `Cargo.toml` / `Cargo.lock`)

| Crate | Role |
|-------|------|
| `tao` 0.31 | Windowing |
| `wry` 0.48 | System webview |
| `muda` 0.15 | Native menus |
| `axum` 0.8 | HTTP + static |
| `tokio` 1 | Async runtime |
| `ratatui` + `crossterm` | `--mode tui` |
| `clap` 4 | CLI |
| `serde` / `serde_json` | Control API JSON |
| `tracing` | Logs |

---

## Build & run

```bash
cd docs/architecture-lab/native
cargo build --release
./launch.sh float    # frameless lab float (default); chat independent
./launch.sh lab      # larger lab workspace
./launch.sh tui      # terminal control plane
```

### Mac app

```bash
./build-mac-app.sh
open "Grok Build Lab.app"
# logs: ~/Library/Logs/GrokBuildLab/launch.log
```

Icon: `icons/AppIcon.icns` — unaltered Grok mark + rainbow aura chrome (brand-safe composition).

---

## Triple windows + control

| Window | Default | Open |
|--------|---------|------|
| **Lab** | Visible · frameless float chrome · drag title bar | App start |
| **Chat** | **Hidden** · can dock right of lab | **Chat** · **Window → Open Chat** (⌘2) |
| **Stream** | **Hidden** · can dock left of lab | **Stream** · **Window → Open Stream** (⌘3) |

### Dock / undock

| Action | Effect |
|--------|--------|
| **Dock** | Snap satellite to lab (chat → right, stream → left); follows lab move/resize |
| **Undock** | Free float |
| **Link All** (⇧⌘L) | Show + dock chat & stream |
| **Unlink All** | Undock both (keep visible) |

### Menus

| Menu | Actions |
|------|---------|
| **View** | Refresh All (⌘R) · Refresh Lab · Refresh Chat · Refresh Stream |
| **Window** | Lab (⌘1) · Open Chat (⌘2) · Open Stream (⌘3) · Link / Unlink · Hide satellites |
| **Help** | Check for Updates… (Pages `version.json` vs local) |

Refresh uses `load_url` + per-window `entry_url` (safe across triple webviews).

### Control API (agents / Grok / scripts)

Port is printed at launch (`:8765` if free, else ephemeral).

```bash
curl -s http://127.0.0.1:PORT/api/control | jq .
curl -s -X POST http://127.0.0.1:PORT/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"open_chat_independent"}'
curl -s -X POST http://127.0.0.1:PORT/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"show_stream"}'
curl -s -X POST http://127.0.0.1:PORT/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"link_all"}'
curl -s -X POST http://127.0.0.1:PORT/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"refresh_all"}'
curl -s -X POST http://127.0.0.1:PORT/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"pin","target":"lab","on":true}'
```

Actions include: `show_chat` · `show_stream` · `open_chat_independent` · dock/undock · `link_all` · `unlink_all` · `focus_*` · `pin` · `unpin` · `center` · `move` · `resize` · `minimize` · `maximize` · `close` · `refresh` / `refresh_*` · `check_updates` · `eval` · `error` · `quit` · `drag` (IPC).

Targets: `lab` · `chat` · `stream` · `all`.

Errors: `GET /api/control/errors` · toast in windows.

Frameless drag: title bars use `data-drag-region` + `window.ipc.postMessage('drag')` → `window.drag_window()`.

---

## Leverage map (other codebases)

| Codebase | Relation |
|----------|----------|
| **grok-build monorepo** | Hosts this folder under `docs/`; core agent is separate crates |
| **`xai-org/grok-build` upstream** | Periodic sync; **no external PRs** (`CONTRIBUTING.md`) |
| **GrokYtalkY** | Mesh / `gy` / plugin source — not vendored here |
| **grok-cli notes / railway axum** | Pattern kinship only (in-process HTTP); not a hard dependency |
| **Electron `../desktop/`** | Deprecated fallback |

---

## Why not Electron

Electron ships full Chromium + Node. Fine for some tools; wrong for a **terminal-first Grok / Dojo** story. Native uses the **OS webview** and a **Rust** process — closer to Tauri-class footprint without buying the whole framework.

**In-app doc (Companions):** [Lab shells · native vs Electron](../content/15-lab-shells.md) · route `#/15-lab-shells` — footprint, cold start, `/api/control`, integration scorecard.

## Deprecation

`docs/architecture-lab/desktop/` (Electron) remains as optional fallback:

```bash
ARCH_LAB_FORCE_ELECTRON=1 bash ../desktop/launch-mac.sh
```

Prefer:

```bash
./launch.sh float
# or
./build-mac-app.sh && open "Grok Build Lab.app"
```
