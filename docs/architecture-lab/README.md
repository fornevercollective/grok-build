# Grok Build Lab

Launchable docs site for mapping **Grok Build** architecture, plugins, and leverage paths. Markdown sources are the source of truth — riff freely.

**App name:** Grok Build Lab (`.app` / menus / window title).  
**Disk path:** `docs/architecture-lab/` is **historical** (kept so CI/Pages paths stay stable). Product name everywhere else is **Grok Build Lab**.  
**Official CLI:** [x.ai/cli](https://x.ai/cli) · **Status board:** [status.x.ai](https://status.x.ai)

Works **locally** and on **GitHub Pages**. Open tabs auto-reload when a new deploy lands.

| Doc | Topic |
|-----|--------|
| **[content/14-dev-build-and-forks.md](content/14-dev-build-and-forks.md)** | **Build deps · versioning · forks · status.x.ai go/no-go** |
| [content/99-contributing-docs.md](content/99-contributing-docs.md) | How to riff on lab pages |
| [native/README.md](native/README.md) | Rust float shell (product path) |
| [content/32-memory-glass-browser.md](content/32-memory-glass-browser.md) | **Memory Glass** browser · SpaceX void · droplet optics |
| [content/06-plugin-anatomy.md](content/06-plugin-anatomy.md) | Plugin packaging rules |
| [content/12-brand.md](content/12-brand.md) | SpaceXAI / Grok brand |

**Lab version (package):** `0.4.0` · **Native crate:** `0.3.20` · **lab-ship (orb + phone):** `0.2.1` · **Pages clients:** git SHA in `version.json`  
**lab-ship** = chat orb + **phone PWA** (`phone.html` · Chat/Agent/Stream/Prompt/Docs) · control `lab-ship` · **Ship deck** `#/tool/ship` · **Plugin** `plugin/lab-ship/` · **Matrix** [17-ship-everything](content/17-ship-everything.md)

### Go / no-go before big pushes

```bash
npm run status --prefix docs/architecture-lab          # check https://status.x.ai
npm run install-pre-push --prefix docs/architecture-lab  # git pre-push hook
# emergency only: STATUS_XAI_SKIP=1 git push
```

---

## Compliance (short)

| Rule | Status |
|------|--------|
| Upstream `CONTRIBUTING.md` — no external PRs to SpaceXAI tree | Met (lab is local/fork work) |
| Prefer plugins over forking the pager | Met |
| **lab-ship = chat orb** + plugin pack | Met (orb UI + `/lab-ship` · control `lab-ship`) |
| `gy-glyph-pins` plugin anatomy + validate | Met when present under `~/.grok/plugins/` |
| Brand: unaltered official marks | Met (watch composite dock icon policy) |
| Native license Apache-2.0 | Met (aligned with monorepo) |

Full checklist → [14-dev-build-and-forks](content/14-dev-build-and-forks.md).

---

## Launch (local)

```bash
cd docs/architecture-lab
./serve.sh          # http://127.0.0.1:8765 (opens browser on macOS)
./serve.sh 9000     # custom port
```

No npm required for the web lab. Python 3 static server + ops APIs only.

## Native desktop (Rust · WKWebView — not Electron)

```bash
cd docs/architecture-lab/native
cargo build --release
./launch.sh float             # frameless lab float; chat opens independently
./launch.sh lab               # larger workspace
./launch.sh tui               # ratatui control plane
./build-mac-app.sh && open "Grok Build Lab.app"
```

| Layer | Tech |
|-------|------|
| Window | **tao + wry** → system **WKWebView** (macOS) |
| HTTP | **axum** in-process (static + control API) |
| Menu | **Cocoa** (muda removed — ZeroWidth abort on About) |
| Terminal | **ratatui** (`--mode tui`) |

Electron under `desktop/` is optional **deprecated** fallback (`ARCH_LAB_FORCE_ELECTRON=1`).

See [native/README.md](native/README.md).

## Memory Glass (browser surface)

Two layers — **lab concept** (this folder) and **native shell** (experiments):

| Layer | Path | What it is |
|-------|------|------------|
| **DOM optics** | `assets/memory-glass.{js,css}` · `browser.html` | Soft droplet aperture over SpaceX blueprint void · parallax · Glass toggle |
| **Lab doc** | [`content/32-memory-glass-browser.md`](content/32-memory-glass-browser.md) (`#/32-memory-glass-browser`) | Design notes · controls · architecture |
| **Native shell** | [`../../experiments/memory-glass/`](../../experiments/memory-glass/) | Standalone Rust browser · **tao + wry → WKWebView** · flat page · 3 tabs · rust-shield Dock icon |

```bash
# Conceptual (static lab / native Lab Browser)
./serve.sh
open http://127.0.0.1:8765/browser.html   # Memory Glass wired by default

# Standalone native droplet browser
cd ../../experiments/memory-glass
cargo build --release
./build-mac-app.sh && open "Memory Glass.app"
```

Not Chrome. Not Electron. Full notes: [Memory Glass browser](content/32-memory-glass-browser.md) · [experiments/memory-glass README](../../experiments/memory-glass/README.md).

## GitHub Pages

| | |
|--|--|
| **URL** | [https://fornevercollective.github.io/grok-build/](https://fornevercollective.github.io/grok-build/) |
| **Deploy** | `.github/workflows/pages-architecture-lab.yml` on push to `main` (paths under `docs/architecture-lab/**`) |
| **Manual** | Actions → **Deploy Grok Build Lab (Pages)** → Run workflow |
| **Auto-reload** | `version.json` + `assets/lab-update.js` — open clients reload when the SHA changes |

First-time setup (repo admin): **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Layout

```text
docs/architecture-lab/          # historical path · product name = Grok Build Lab
  index.html          # SPA shell (Docs · Ship · Notes · …)
  browser.html        # Lab browser shell · Memory Glass optics
  chat.html           # float chat · voice + text
  stream.html         # stream feed window
  agent.html          # Agent Console · center chat + α/β/γ feeds (agentcn scaffold)
  workbench.html      # Browser workbench · center agent + live xterm PTYs (needs ./serve.sh)
  launch.html         # Launch Pad · View + Window menu controls
  nav.json            # sidebar sections / page ids
  serve.sh            # local server + ops APIs
  version.json        # local placeholder; Pages overwrites with SHA
  package.json        # lab semver 0.3.11 (not Grok CLI / not native crate)
  plugin/lab-ship/    # lab-ship = chat orb product + Grok pack (/lab-ship)
  orb.html            # lab-ship UI face (desktop mini)
  phone.html          # lab-ship phone PWA (Chat·Agent·Stream·Prompt·Docs)
  chat.html           # lab-ship full panel
  scripts/
    status-xai-check.sh       # status.x.ai go/no-go
    install-pre-push-hook.sh  # git push gate
  assets/             # app.js · tools.js · memory-glass.js/css · ship-deck · …
  content/            # markdown source of truth (incl. 32-memory-glass-browser)
  native/             # Rust product shell → Grok Build Lab.app · bin grok-build-lab
  desktop/            # Electron fallback (deprecated · no Architecture Lab.app)
  scripts/prepare-pages-site.sh

# Sibling experiment (standalone native droplet browser):
../../experiments/memory-glass/   # tao+wry Memory Glass · build-mac-app.sh
```

## Codebase forks (one glance)

```text
xai-org/grok-build  (upstream)
        → fornevercollective/grok-build  (origin · includes this lab)
GrokYtalkY (separate) → gy-glyph-pins plugin → ~/.grok/plugins/
```

## Riff workflow

1. Add `content/NN-my-page.md`
2. Register it in `nav.json`
3. Hard-refresh the browser / native **View → Refresh**

See [Riffing on these docs](content/99-contributing-docs.md).

## Related

| Path | What |
|------|------|
| `../` (pager user-guide) | Official Grok Build user docs |
| `~/Projects/GrokYtalkY` | Companion mesh / pins |
| `~/.grok/plugins/gy-glyph-pins` | Installed GY plugin |
| Root `CONTRIBUTING.md` | No external PRs to upstream |
