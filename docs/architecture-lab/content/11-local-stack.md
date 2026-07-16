# Local stack recipes

## Build & run Grok Build from source

```bash
cd ~/Projects/grok-build
cargo run -p xai-grok-pager-bin
# release:
cargo build -p xai-grok-pager-bin --release
# → target/release/xai-grok-pager
```

## Install GY with multi-user + ffmpeg cleanup

```bash
cd ~/Projects/GrokYtalkY
go install .
ln -sfn grokytalky "$(go env GOPATH)/bin/gy"
gy pins          # contract
gy grok          # pins + grok
```

## Sync GY plugin into Grok

```bash
rsync -a ~/Projects/GrokYtalkY/grok-plugin/gy-glyph-pins/ \
  ~/.grok/plugins/gy-glyph-pins/
# enable in TUI or config.toml [plugins].enabled
```

## Launch this lab

```bash
cd ~/Projects/grok-build/docs/architecture-lab
./serve.sh
# open http://127.0.0.1:8765
```

### Native float shell (preferred desktop)

**Deps:** Rust ≥ 1.85, macOS 12+ / WebView2 / WebKitGTK. **No Node.**

```bash
cd ~/Projects/grok-build/docs/architecture-lab/native
cargo build --release
./launch.sh float
# or Mac app:
./build-mac-app.sh && open "Grok Build Lab.app"
```

Versions, forks, compliance: [Dev build · versions · forks](#/14-dev-build-and-forks) · [native/README](../native/README.md).

| Shell | Deps | Status |
|-------|------|--------|
| Browser + `serve.sh` | Python 3 | Always |
| Native `architecture-lab` | Rust, system webview | **Product path** |
| Electron `desktop/` | Node + Electron | Deprecated fallback |

### Layout chrome

| Spot | UI |
|------|-----|
| Sidebar **above** title | Walkie burst orb · idle/TX |
| Top bar **right of** filter | Glyph pins rail |
| Top bar | **Listen** → “hey grok” / “grok” summons Grok |

### Hey Grok (active listening)

1. Click **Listen** (mic permission).
2. Say **“hey grok”** or **“grok”**.
3. Lab `POST /api/summon-grok` launches `grok` / `xai-grok-pager` (macOS → Terminal.app).

```bash
# optional override
export GROK_BIN=/path/to/xai-grok-pager
./serve.sh
curl -X POST http://127.0.0.1:8765/api/summon-grok
```

## Useful paths

| Path | What |
|------|------|
| `~/.grok/config.toml` | User config, plugins, MCP |
| `~/.grok/plugins/` | User plugins |
| `~/.grok/hooks/` | User hooks |
| `~/.grok/auth.json` | Auth tokens |
| `~/Projects/grok-build` | Harness / lab host (often `origin` = fornevercollective) |
| `git remote upstream` → `xai-org/grok-build` | Official upstream (no external PRs) |
| `~/Projects/GrokYtalkY` | Companion source (separate repo) |
| `docs/architecture-lab/native/` | Standalone Rust shell (not Cargo workspace member) |

## Debug cheatsheet

```bash
grok plugin list
grok plugin details gy-glyph-pins
gy doctor
pgrep -x ffmpeg    # leftover cam?
# gy Ctrl+C should pkill -x ffmpeg now
```

## Recipe ideas to add

- [ ] Docker compose: hub + two gy nicks  
- [ ] Script: `lab-open` starts serve.sh + browser  
- [ ] CI: `grok -p` smoke against fixture repo  
