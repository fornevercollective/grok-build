# Grok Build Lab · Electron shell (**deprecated**)

> **Prefer the Rust native shell:** [`../native/README.md`](../native/README.md)  
> Product path is **tao + wry → WKWebView**, not Electron.  
> Force this fallback only with `ARCH_LAB_FORCE_ELECTRON=1`.  
> Full map: [Dev build · versions · forks](../content/14-dev-build-and-forks.md).

**Status:** optional emergency fallback. Not the primary Mac app.  
**App name:** Grok Build Lab.

**Not a browser tab. Not “open localhost.”**

A frameless Electron shell that:

| Layer | Behavior |
|--------|----------|
| **UI** | `lab://app/*` custom protocol (embedded files from the lab folder) |
| **API** | Silent `127.0.0.1` process for `/api/*` only — never shown as a window URL |
| **Window** | **Float** (default): always-on-top pod, TUI/Rust-tool chrome · **Lab**: full workspace |

## Launch (macOS)

```bash
cd docs/architecture-lab/desktop
./build-mac-app.sh          # Grok Build Lab.app
open "Grok Build Lab.app"   # or double-click

# or
./launch-mac.sh             # float mode
./launch-mac.sh --lab       # full lab mode
```

First run installs Electron once (`npm install` inside `desktop/`).

```bash
npm install
npm run start:float   # floating walkie-style pod
npm run start:lab     # full Grok Build Lab
```

## Modes

| Mode | Look | Shortcut |
|------|------|----------|
| **float** | Compact frameless always-on-top window, walkie centered | `⌘1` |
| **lab** | Full docs/tools workspace | `⌘2` |

Title bar (frameless): **⧉ float · ▣ lab · Pin · – · ×**

## Why not Chrome `--app=http://127.0.0.1`?

That path was removed. The product window is the Electron shell; localhost is only a private API backend for git/processes/media.

## Permissions

macOS may ask for **Camera** / **Microphone** (walkie + Listen).
