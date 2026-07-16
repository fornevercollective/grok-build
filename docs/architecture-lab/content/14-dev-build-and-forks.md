# Dev build · dependencies · versioning · forks

Single map for **how this lab is built**, **what versions mean**, **where code diverges**, and **whether we meet plugin + contributing guidelines**.

---

## Compliance snapshot (living)

| Guideline | Status | Notes |
|-----------|--------|-------|
| **Upstream `CONTRIBUTING.md`** (no external PRs to SpaceXAI tree) | **Met** | Lab is local engineering docs + shells. Do **not** open PRs to `xai-org/grok-build`. Experiments stay on `fornevercollective/grok-build` or personal forks. |
| **Apache-2.0 monorepo license** | **Mostly met** | Root `LICENSE` is Apache-2.0. Native shell crate is aligned to Apache-2.0 (was briefly MIT — fixed). Electron desktop remains private/local. |
| **Plugin unit** (skills · commands · hooks · manifest) | **Met for GY** | `gy-glyph-pins` has `.grok-plugin/plugin.json`, skills, commands, hooks. Grok Build Lab itself is **not** a Grok plugin — it is a companion docs surface. |
| **`grok plugin validate`** | **Met** | `grok plugin validate ~/.grok/plugins/gy-glyph-pins` → valid. |
| **Plugin enabled in config** | **Check locally** | Files under `~/.grok/plugins/` are not always *enabled*. Use TUI `Ctrl+L` → Plugins, or `[plugins].enabled` in `~/.grok/config.toml`. |
| **Extension without forking pager** | **Met** | Lab uses plugins / HTTP / native host; does not patch `xai-grok-pager` for mesh or docs. |
| **GY boundary** (no reimplement mesh in Grok) | **Met** | Walkie/orb in lab UI; mesh remains `gy` / GrokYtalkY. Skills point at companion, not a second mesh stack. |
| **Brand guidelines** ([x.ai/legal/brand-guidelines](https://x.ai/legal/brand-guidelines)) | **Met · swung further out of product ballpark** | Official marks **unaltered** under `assets/brand/`. Dock icon = unaltered mark + **separate** rainbow aura. Window shell is **non-Apple** (18px lab corners, rainbow rim, fornever chrome). Bundle id `dev.fornevercollective.*` (not `ai.x`). TUI uses Charmbracelet-style colors — local craft, not product marketing. Lab is **not** an official xAI app. |
| **Security reports** | **Met (process)** | Vulnerabilities in upstream → `SECURITY.md` → [HackerOne X/xAI](https://hackerone.com/x). Lab-local issues → private fix, not public issue spam. Prize eligibility scorecard: [HackerOne bounty page](#/16-hackerone-x). |

### Plugin anatomy checklist (`gy-glyph-pins`)

- [x] Manifest name matches folder (`gy-glyph-pins`)
- [x] Skill descriptions include triggers
- [x] Hooks non-blocking SessionStart (path/status hints)
- [x] Commands `/glyph-pins`, `/with-grok`
- [x] Source of truth in companion repo; install under `~/.grok/plugins/`
- [ ] Confirm enabled in every machine’s `config.toml` (operator step)

### What Grok Build Lab is *not*

| Not this | Because |
|----------|---------|
| A Grok Build core crate | Lives under `docs/architecture-lab/`; native is **standalone Cargo workspace** |
| An official xAI app | Local map + float shell; no endorsement claim |
| A replacement for `grok` TUI | Hosts docs/tools; agent remains `grok` / `xai-grok-pager` |
| Upstream contribution surface | See `CONTRIBUTING.md` |

---

## Codebase map · forks · diversions

```text
xai-org/grok-build          (upstream · SpaceXAI · periodic public sync)
        │
        │  git remote: upstream
        ▼
fornevercollective/grok-build   (origin · local experiments + Grok Build Lab)
        │
        ├── crates/codegen/xai-grok-*     ← stays close to upstream (do not random-fork)
        ├── docs/architecture-lab/        ← THIS LAB (docs SPA + shells)
        │     ├── content/*.md            source of truth for lab pages
        │     ├── serve.sh                Python3 static + ops APIs
        │     ├── native/                 Rust float shell (standalone workspace)
        │     └── desktop/                Electron fallback (deprecated product path)
        │
        └── (does not vendor GrokYtalkY)

fornevercollective/GrokYtalkY   (separate repo)
        ├── gy binary (Go)
        └── grok-plugin/gy-glyph-pins  → rsync/symlink → ~/.grok/plugins/gy-glyph-pins
```

| Tree | Role | Divergence policy |
|------|------|-------------------|
| **`upstream` `xai-org/grok-build`** | Official Grok Build source | Read / merge carefully; **no external PRs** |
| **`origin` `fornevercollective/grok-build`** | Working fork with lab + Pages | Lab + workflow only in `docs/architecture-lab/**` preferred; avoid large core rewrites |
| **`docs/architecture-lab/native`** | Standalone Rust binary | **Not** a member of root `Cargo.toml` workspace — intentional isolation (fast builds, no pager deps) |
| **`docs/architecture-lab/desktop`** | Electron | **Deprecated** product path; keep for emergency fallback only |
| **`GrokYtalkY`** | Mesh / pins / walkie CLI | Separate Go codebase; plugin is the only Grok-facing bundle |
| **GitHub Pages** | Static publish of lab | Built by `.github/workflows/pages-architecture-lab.yml` from lab tree (excludes `.app`, `target`, `node_modules`) |

### Product paths (prefer left → right)

| Preference | Surface | Engine | Status |
|------------|---------|--------|--------|
| **1 · preferred** | Native float app | tao + wry → **WKWebView** / WebView2 | **Product path** |
| **2 · docs only** | Browser / Pages | Static HTML + MD | Always available |
| **3 · fallback** | Electron `desktop/` | Chromium + Node | Deprecated — `ARCH_LAB_FORCE_ELECTRON=1` |

**Deep dive (footprint · cold start · `/api/control` · scorecard):** [Lab shells · native vs Electron](#/15-lab-shells) under Companions.

### status.x.ai go/no-go (big pushes)

| Check | Command |
|-------|---------|
| Manual | Open [status.x.ai](https://status.x.ai) |
| Script | `npm run status --prefix docs/architecture-lab` or `bash docs/architecture-lab/scripts/status-xai-check.sh --strict` |
| Git hook | `npm run install-pre-push --prefix docs/architecture-lab` |
| Pages CI | Workflow job `status-gating` runs the same script before deploy |

| Exit | Meaning |
|------|---------|
| **0 GO** | No incident / outage signals |
| **1 NO-GO** | Do **not** big-push |
| **2 UNKNOWN** | Unreachable / CF — confirm in browser; strict mode blocks |

Emergency only: `STATUS_XAI_SKIP=1 git push` or `STATUS_XAI_ALLOW_UNKNOWN=1`.

---

## Versioning matrix

Versions are **not one number**. Use this matrix when shipping.

| Component | Where | Scheme | Current (doc baseline) |
|-----------|--------|--------|-------------------------|
| Lab static package | `docs/architecture-lab/package.json` | semver · lab site | **0.2.0** |
| Native crate | `native/Cargo.toml` `version` | semver · binary | **0.2.0** |
| Mac `.app` marketing | `Info.plist` `CFBundleShortVersionString` | = native semver | **0.2.0** |
| Mac `.app` build | `Info.plist` `CFBundleVersion` | monotonic integer | bump on each `.app` ship |
| Electron package | `desktop/package.json` | semver · legacy | 0.1.x · frozen |
| Pages / live clients | `version.json` | **git SHA** + `short` + `built_at` | written by `prepare-pages-site.sh` / live `serve.sh` |
| Check for Updates (native) | compares local vs Pages `version.json` | SHA equality | Help → Check for Updates… |
| gy-glyph-pins | `.grok-plugin/plugin.json` | semver · plugin | **0.2.0** (companion repo) |
| Grok Build binary | crates / release tags | upstream | independent of lab |

### Bump rules

1. **Lab content-only** (MD/CSS/JS docs) → bump `package.json` patch/minor; Pages SHA changes on deploy (clients auto-reload).  
2. **Native shell behavior** (window, menu, control API) → bump `native/Cargo.toml` + `Info.plist` together + rebuild `.app`.  
3. **Plugin** → bump only in GrokYtalkY `plugin.json`, then rsync to `~/.grok/plugins/`.  
4. **Never** claim lab version equals Grok Build CLI version.

### App identifiers

| Key | Value | Note |
|-----|-------|------|
| Bundle id (native) | `dev.fornevercollective.architecture-lab` | Local lab — not an xAI product id |
| Display name | `Grok Build Lab` | Neutral engineering name |

---

## Build dependencies

### A. Static lab (browser / Pages)

| Dep | Version / notes |
|-----|-----------------|
| **Python 3** | 3.9+ (ops APIs in `serve.sh`) |
| Browser | any modern; Safari/Chrome/Firefox |
| Optional | `git` (history / version.json) |
| **Not required** | Node, npm, Rust |

```bash
cd docs/architecture-lab
./serve.sh          # http://127.0.0.1:8765
./serve.sh 9000
```

### B. Native shell (product path)

| Dep | Version / notes |
|-----|-----------------|
| **Rust** | MSRV in crate: `1.85`; monorepo pin often higher (`rust-toolchain.toml` e.g. 1.92) — use stable ≥ 1.85 |
| **Cargo** | ships with rustup |
| **macOS** | 12.0+ · Xcode CLT (WKWebView / system frameworks) |
| **Windows** | WebView2 runtime |
| **Linux** | WebKitGTK (distro package) |
| **crates** (lockfile: `native/Cargo.lock`) | `tao 0.31`, `wry 0.48`, `muda 0.15`, `axum 0.8`, `tokio 1`, `ratatui 0.29`, `clap 4`, … |

```bash
cd docs/architecture-lab/native
cargo build --release
./launch.sh float          # lab float; chat opens independently
./build-mac-app.sh
open "Grok Build Lab.app"
```

Standalone workspace: `native/Cargo.toml` has `[workspace]` so it does **not** join root grok-build workspace.

### C. Electron fallback (deprecated)

| Dep | Version / notes |
|-----|-----------------|
| **Node.js** | 18+ recommended |
| **npm** | for `desktop/package.json` |
| **electron** | ^33 (devDependency) |

```bash
ARCH_LAB_FORCE_ELECTRON=1 bash desktop/launch-mac.sh
# or: cd desktop && npm install && npm run start:float
```

### D. Grok Build from monorepo

| Dep | Notes |
|-----|--------|
| Rust toolchain | root `rust-toolchain.toml` |
| `protoc` | `bin/protoc` / workspace build |
| See | root `README.md` · `cargo build -p xai-grok-pager-bin --release` |

### E. GrokYtalkY + plugin

| Dep | Notes |
|-----|--------|
| Go | for `gy` binary |
| Plugin tree | no compile — markdown + hooks JSON |
| Install | rsync/symlink into `~/.grok/plugins/gy-glyph-pins` |
| Enable | TUI plugins panel or `config.toml` |

---

## Runtime surfaces (native)

| Window | Default | How to open |
|--------|---------|-------------|
| **Lab** | Visible · frameless float chrome | App launch |
| **Chat** | Hidden · independent float | Lab bar **Chat**, menu **Window → Open Chat Window** (⌘2), `POST {"action":"open_chat_independent"}` |

Control API: `POST /api/control` (port printed at launch; prefer free port when `:8765` busy).  
Logs: `~/Library/Logs/ArchitectureLab/launch.log` on macOS.

---

## Where to change what

| Goal | Edit |
|------|------|
| Docs page | `content/*.md` + `nav.json` |
| Lab SPA shell | `index.html`, `assets/app.js`, `assets/style.css` |
| Chat surface | `chat.html` |
| Native windows / menu / IPC | `native/src/window.rs`, `menu.rs`, `control.rs` |
| Ops HTTP in browser serve | `serve.sh` |
| Ops HTTP in native | `native/src/api.rs` |
| Pages packaging | `scripts/prepare-pages-site.sh`, workflow YAML |
| Brand assets | `assets/brand/` (unaltered copies only) |
| GY plugin | `GrokYtalkY/grok-plugin/gy-glyph-pins` then sync |

---

## CI / deploy

| Pipeline | Trigger | Output |
|----------|---------|--------|
| `pages-architecture-lab.yml` | push `docs/architecture-lab/**` to main · manual | GitHub Pages site + `version.json` SHA |

Excludes from site: `native/target`, `*.app`, `desktop/node_modules`, `desktop/dist`.

---

## Operator checklist (new machine)

1. Clone `fornevercollective/grok-build` (add `upstream` remote for xAI sync).  
2. `./serve.sh` for docs; or `native/build-mac-app.sh` for float app.  
3. Install/enable `gy-glyph-pins`; run `grok plugin validate` + enable in TUI.  
4. Optional: `gy` from GrokYtalkY for mesh.  
5. Confirm brand assets present; do not recolor Grok marks.  
6. Read [Riffing on these docs](#/99-contributing-docs) before expanding the lab.  
