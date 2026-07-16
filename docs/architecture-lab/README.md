# Grok Build Architecture Lab

Launchable docs site for mapping **Grok Build** architecture, plugins, and leverage paths. Markdown sources are the source of truth — riff freely.

Works **locally** and on **GitHub Pages**. Open tabs auto-reload when a new deploy lands.

## Launch (local)

```bash
cd docs/architecture-lab
./serve.sh          # http://127.0.0.1:8765 (opens browser on macOS)
./serve.sh 9000     # custom port
```

No npm required for the web lab. Python 3 static server only.

## Native desktop (Rust · WKWebView — not Electron)

```bash
cd docs/architecture-lab/native
cargo build --release
./launch.sh float             # always-on-top pod
./launch.sh lab               # full workspace
./launch.sh tui               # ratatui control plane
./build-mac-app.sh && open "Architecture Lab.app"
```

From **grok-cli**:

```bash
~/dev/grok-cli-main/scripts/launch-architecture-lab.sh float
```

| Layer | Tech |
|-------|------|
| Window | **tao + wry** → system **WKWebView** (macOS) |
| HTTP | **axum** in-process (static + APIs) |
| Terminal | **ratatui** (`--mode tui`) |

Electron under `desktop/` is optional fallback only (`ARCH_LAB_FORCE_ELECTRON=1`).

See [native/README.md](native/README.md).

## GitHub Pages

| | |
|--|--|
| **URL** | [https://fornevercollective.github.io/grok-build/](https://fornevercollective.github.io/grok-build/) |
| **Deploy** | `.github/workflows/pages-architecture-lab.yml` on push to `main` (paths under `docs/architecture-lab/**`) |
| **Manual** | Actions → **Deploy Architecture Lab (Pages)** → Run workflow |
| **Auto-reload** | `version.json` + `assets/lab-update.js` — open clients reload when the SHA changes |

First-time setup (repo admin): **Settings → Pages → Build and deployment → Source: GitHub Actions**.

After the first successful deploy, the site is public at the URL above.

## Layout

```text
architecture-lab/
  index.html          # SPA shell
  nav.json            # sidebar sections / page ids
  serve.sh            # local server
  assets/
    style.css
    app.js            # hash router + markdown load
  content/
    00-overview.md
    01-architecture.md
    …
    99-contributing-docs.md
```

## Riff workflow

1. Add `content/12-my-page.md`
2. Register it in `nav.json`
3. Hard-refresh the browser

See [Riffing on these docs](#/99-contributing-docs) in the site.

## Related

| Path | What |
|------|------|
| `../` (pager user-guide) | Official Grok Build user docs |
| `~/Projects/GrokYtalkY` | Companion mesh / pins |
| `~/.grok/plugins/gy-glyph-pins` | Installed GY plugin |
