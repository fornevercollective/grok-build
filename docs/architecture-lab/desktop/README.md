# Architecture Lab · Floating desktop shell

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
./build-mac-app.sh          # Architecture Lab.app
open "Architecture Lab.app" # or double-click

# or
./launch-mac.sh             # float mode
./launch-mac.sh --lab       # full lab mode
```

First run installs Electron once (`npm install` inside `desktop/`).

```bash
npm install
npm run start:float   # floating walkie-style pod
npm run start:lab     # full Architecture Lab
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
