# Grok Build Lab

Launchable docs site for mapping **Grok Build** architecture, plugins, and leverage paths. Markdown sources are the source of truth — riff freely.

**App name:** Grok Build Lab (`.app` / menus / window title).

Works **locally** and on **GitHub Pages**. Open tabs auto-reload when a new deploy lands.

| Doc | Topic |
|-----|--------|
| **[content/14-dev-build-and-forks.md](content/14-dev-build-and-forks.md)** | **Build deps · versioning · forks · plugin/contributing compliance** |
| [content/99-contributing-docs.md](content/99-contributing-docs.md) | How to riff on lab pages |
| [native/README.md](native/README.md) | Rust float shell (product path) |
| [content/06-plugin-anatomy.md](content/06-plugin-anatomy.md) | Plugin packaging rules |
| [content/12-brand.md](content/12-brand.md) | SpaceXAI / Grok brand |

**Lab version (package):** `0.2.0` · **Native crate:** `0.2.0` · **Pages clients:** git SHA in `version.json`

---

## Compliance (short)

| Rule | Status |
|------|--------|
| Upstream `CONTRIBUTING.md` — no external PRs to SpaceXAI tree | Met (lab is local/fork work) |
| Prefer plugins over forking the pager | Met |
| `gy-glyph-pins` plugin anatomy + `grok plugin validate` | Met (enable in TUI if missing) |
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
| Menu | **muda** |
| Terminal | **ratatui** (`--mode tui`) |

Electron under `desktop/` is optional **deprecated** fallback (`ARCH_LAB_FORCE_ELECTRON=1`).

See [native/README.md](native/README.md).

## GitHub Pages

| | |
|--|--|
| **URL** | [https://fornevercollective.github.io/grok-build/](https://fornevercollective.github.io/grok-build/) |
| **Deploy** | `.github/workflows/pages-architecture-lab.yml` on push to `main` (paths under `docs/architecture-lab/**`) |
| **Manual** | Actions → **Deploy Architecture Lab (Pages)** → Run workflow |
| **Auto-reload** | `version.json` + `assets/lab-update.js` — open clients reload when the SHA changes |

First-time setup (repo admin): **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Layout

```text
architecture-lab/
  index.html          # SPA shell
  nav.json            # sidebar sections / page ids
  serve.sh            # local server + ops APIs
  version.json        # local placeholder; Pages overwrites with SHA
  package.json        # lab semver 0.2.0 (not Grok CLI version)
  assets/
  content/            # markdown source of truth
  native/             # Rust product shell (standalone Cargo workspace)
  desktop/            # Electron fallback (deprecated)
  scripts/prepare-pages-site.sh
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
