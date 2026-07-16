# Lab shells · native vs Electron

**Companions to Grok Build Lab itself** — how the float/lab apps are built, how fast they are, and how to extend them.

| Surface | Path | Engine | Status |
|---------|------|--------|--------|
| **Native (preferred)** | `docs/architecture-lab/native/` | Rust · **tao + wry** → **WKWebView** / WebView2 / WebKitGTK | **Product path** · crate **0.2.0** · lab content **0.2.1** |
| **Electron (fallback)** | `docs/architecture-lab/desktop/` | Node · **Electron 33** → Chromium | **Deprecated** · `ARCH_LAB_FORCE_ELECTRON=1` only |
| **Browser / Pages** | static lab | Static HTML + MD | Always available |

> Prefer native. Electron remains an emergency path when system webview is unusable.  
> Full build/version/fork map: [Dev build · versions · forks](#/14-dev-build-and-forks).

**App name:** **Grok Build Lab** (`.app` / menus / window title).  
**Bundle id:** `dev.fornevercollective.grok-build-lab` (local lab — not an xAI product).

---

## Launch

```bash
# Native (product)
cd docs/architecture-lab/native
./launch.sh float      # frameless float (default)
./launch.sh lab        # full workspace
./launch.sh tui        # ratatui control plane, no webview
./build-mac-app.sh && open "Grok Build Lab.app"
# logs: ~/Library/Logs/GrokBuildLab/launch.log

# Electron (fallback only)
ARCH_LAB_FORCE_ELECTRON=1 bash docs/architecture-lab/desktop/launch-mac.sh
```

Package scripts from lab root:

```bash
npm run desktop          # native float
npm run desktop:lab
npm run desktop:tui
npm run desktop:app      # rebuild .app
npm run desktop:electron # force Electron
```

In-app route: **Companions → Lab shells · native vs Electron** · `#/15-lab-shells`.

---

## Speed & performance

### Footprint (measured on this tree)

| Artifact | Approx. size |
|----------|----------------|
| `native/target/release/architecture-lab` | **~4.7 MB** (thin LTO · strip · `codegen-units=4`) |
| `native/Grok Build Lab.app` | **~7.7 MB** (binary + bundled lab snapshot) |
| `desktop/node_modules/electron` | **~256 MB** |
| `desktop/node_modules` total | **~550 MB** |
| `desktop/Grok Build Lab.app` | **~164 KB** wrapper (still needs Electron/npm to run) |

**Native is roughly 30–70× smaller** on disk than a real Electron install for the same lab UI.

### Process model

| Factor | Native | Electron |
|--------|--------|----------|
| Host process | **One** Rust binary | Electron main + renderer + **child** `serve.sh` |
| UI engine | **System webview** (WKWebView on macOS) | Full **Chromium** embed |
| Node in product | **No** | Yes (main process) |
| HTTP | In-process **axum** | External bash/Python server |
| Port | Prefer `:8765`, else ephemeral | Same class of health polling |
| Windows | **Triple** WKWebView (lab · chat · stream) | Single Chromium surface + chrome |
| Idle event loop | `ControlFlow::Wait` | Chromium + Node keep-alive |

### Cold start

| | Native | Electron |
|--|--------|----------|
| First install | `cargo build --release` once | `npm install` + Electron download |
| Typical path | Bind → health probe → open triple webviews | Spawn Electron → spawn `serve.sh` → poll health (up to ~10 s) → load `lab://` |
| TUI-only | `--mode tui` skips webview entirely | N/A |

### Runtime costs

**Native strengths**

- Shared OS WebKit — no second browser engine in RAM  
- Control path is cheap: `POST /api/control` → `EventLoopProxy` → windows  
- Release profile: **thin LTO**, strip, practical codegen units (fast lab iteration)  
- Standalone Cargo workspace → **fast lab iteration** without monorepo pager deps  
- Safe multi-webview reload via `load_url` (not `location.reload()` inject)  

**Native ceilings**

- UI is still the lab **SPA** (HTML/CSS/JS) inside WKWebView  
- Up to **three** webviews (lab + chat + stream) when all open  
- Ops APIs shell out (`ps`, `git`, summon) — spawn-bound, not Rust-bound  
- Isolation means deep monorepo crate linking requires deliberate deps  

**Electron costs**

- Chromium baseline memory  
- Extra hop: UI → `lab://` → proxy → localhost API → child server  
- Injected titlebar chrome after every load  

### Performance scorecard

| Criterion | Native | Electron |
|-----------|--------|----------|
| Ship size | ★★★★★ | ★☆☆☆☆ |
| RAM / idle CPU | ★★★★☆ | ★★☆☆☆ |
| Cold start | ★★★★☆ | ★★☆☆☆ |
| Agent window automation | ★★★★★ | ★★☆☆☆ |
| Chromium-only APIs | ★★☆☆☆ | ★★★★★ |
| Alignment (Rust / terminal-first) | ★★★★★ | ★★☆☆☆ |

---

## Extension & integration

### Native host APIs (axum)

| Route | Role |
|-------|------|
| `GET /api/health` | Native flag, webview type, `grok`/`gy` paths, control URL, dock state |
| `GET /api/version` | Git SHA / ref (update checks) |
| `GET /api/processes` | Filtered process list (grok · ffmpeg · gy · lab) |
| `GET\|POST /api/events` | Lightweight event surface |
| `GET /api/git-log` | Repo history for tools |
| `GET\|POST /api/summon-grok` | Spawn / summon Grok tooling |
| `GET\|POST /api/mitigate` | Ops mitigation hooks |
| `GET /api/media/tools` | Media tool discovery |
| `GET /api/voices` | SpaceXAI voice model catalog |
| `POST /api/tts` | TTS proxy |
| **`GET\|POST /api/control`** | **SpaceXAI / Grok window control plane** |
| `GET /api/control/status` · `/errors` | Status + error ring |

Port is printed at launch (`:8765` if free, else ephemeral).  
Bundled `.app` uses `ARCH_LAB_ROOT` / `Resources/lab` snapshot when live tree is absent.

### Control bus (agents · scripts · Grok)

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
  -d '{"action":"eval","target":"chat","script":"LabChat.listen()"}'
```

**Actions include:**  
`show_chat` · `hide_chat` · `toggle_chat` · `open_chat_independent` · `chat_only` ·  
`show_stream` · `hide_stream` · `toggle_stream` · `focus_stream` ·  
`dock_chat` · `undock_chat` · `dock_stream` · `undock_stream` · `link_all` · `unlink_all` · `dock` · `undock` ·  
`focus_lab` / `focus_chat` · `pin` / `unpin` · `center` · `move` · `resize` ·  
`minimize` / `maximize` / `close` · `refresh` / `refresh_lab` / `refresh_chat` / `refresh_stream` / `refresh_all` ·  
`check_updates` · **`eval`** (JS inject) · `error` · `drag` · `ping` · `quit` · …

Targets: `lab` · `chat` · `stream` · `all`.

This is the primary **automation surface** for the float app — not Electron IPC.

**Refresh safety:** multi-webview reload uses `WebView::load_url` with each window’s `entry_url` (hash preserved). Avoids CFString / `evaluate_script("location.reload()")` crashes on Refresh All.

### Triple windows + dock

| Window | Default | Notes |
|--------|---------|-------|
| **Lab** | Visible · frameless | Docs SPA, tools, walkie chrome · rounded shell + Charm-style palette |
| **Chat** | Hidden until opened | Independent always-on-top WKWebView (`chat.html`); docks **right** of lab |
| **Stream** | Hidden until opened | Feed surface (`stream.html`); docks **left** of lab |

| Layout | Effect |
|--------|--------|
| **Dock** | Snap satellite to lab; follows lab move/resize |
| **Undock** | Free float |
| **Link All** (⇧⌘L) | Show + dock chat & stream |
| **Unlink All** | Undock both (keep visible) |

Menus (**muda**):

| Menu | Actions |
|------|---------|
| **View** | Refresh All (⌘R) · Refresh Lab · Refresh Chat · Refresh Stream |
| **Window** | Lab · Open Chat · Open Stream · Link / Unlink · Hide satellites |
| **Help** | Check for Updates… (Pages `version.json` vs local) |

Frameless drag: `data-drag-region` + IPC `drag` → native window drag.  
Chrome: fornevercollective brand swing (unaltered Grok marks + rainbow aura), not official product chrome.

### Electron integration (narrower)

| Surface | Capability |
|---------|------------|
| `lab://app/*` | Privileged protocol → disk + API proxy |
| Preload IPC | mode, pin, min, close, always-on-top |
| Menu / Tray | Float vs lab, walkie helpers |
| Backend | External `serve.sh` only — **no** in-process control bus |

Do **not** extend Electron for new agent automation. Land it on native `/api/control`.

### Grok Build ecosystem (lab hosts docs; does not reimplement)

Extend the **agent** without forking the pager — see [Extension surfaces](#/04-extension-surfaces) and [Leverage](#/07-leverage):

| Surface | Mechanism |
|---------|-----------|
| Plugins | skills · commands · hooks · agents · MCP · LSP · manifest |
| Loose dirs | `~/.grok/{skills,commands,hooks,agents,plugins}` · project `.grok/` |
| Hooks | Lifecycle; **PreToolUse can deny** |
| MCP | External tools vs built-in shell/edit/search |
| ACP | `grok agent stdio` / `serve` for IDE embed |
| Subagents | explore · plan · general-purpose · custom |
| **GY mesh** | Companion process — see [GrokYtalkY companion](#/10-gy-companion) |

Grok Build Lab is **not** a Grok plugin. It is a companion docs + float shell.

### Integration diagram

```text
Agents / curl / Grok scripts
        │  POST /api/control
        ▼
┌────────────────────────────────────────┐
│  architecture-lab (native · Grok Build Lab)
│  axum ──► ControlBus ──► tao           │
│           triple WKWebView             │
│           lab · chat · stream          │
│           dock / link_all              │
└───────────────┬────────────────────────┘
                │ /api/health discovers
                ▼
     grok / xai-grok-pager · gy · plugins / MCP
```

Electron path (legacy):

```text
Electron main ──spawn──► serve.sh ──► static lab + ops APIs
     └── lab:// UI (Chromium) ──proxy──► localhost /api/*
```

---

## Stack reference (native)

| Crate | Role |
|-------|------|
| `tao` 0.31 | Windowing |
| `wry` 0.48 | System webview |
| `muda` 0.15 | Native menus |
| `axum` 0.8 | HTTP + static |
| `tokio` 1 | Async runtime |
| `ratatui` + `crossterm` | `--mode tui` |
| `clap` 4 | CLI |
| `objc` + `cocoa` (macOS) | Rounded window corners |

**Release profile:** `lto = "thin"`, `codegen-units = 4`, `strip = true` (practical iterative builds).

**Not** a member of the monorepo root workspace — intentional isolation.  
License: Apache-2.0 · Bundle id: `dev.fornevercollective.grok-build-lab`.

---

## Gaps & leverage

1. **Not a PTY mux** — pair with terminal tools (`panda`, `tmux`, `gy grok`) as peer processes; health already discovers `grok` / `gy`.  
2. **Events API** — still thin; streaming would strengthen agent feedback.  
3. **UI jank** — optimize lab SPA assets if needed; the host shell is already light.  
4. **Electron** — keep for emergency only; no new features.  
5. **Cross-platform** — macOS is the primary ship path; Windows/Linux webview paths exist via wry but are less exercised.

---

## Decision rule

| Need | Use |
|------|-----|
| Ship float app · agent window control · small footprint | **native/** · **Grok Build Lab.app** |
| Docs only · CI Pages | Browser / static lab |
| System webview broken · Chromium-only API | Electron fallback |

Related: [GrokYtalkY companion](#/10-gy-companion) · [Local stack](#/11-local-stack) · [Dev build · forks](#/14-dev-build-and-forks).
