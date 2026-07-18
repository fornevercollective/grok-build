# Memory Glass · update bundle contents

## Inside `Memory Glass.app` (self-contained UI/engine)

| Path | Purpose |
|------|---------|
| `Contents/MacOS/memory-glass` | Rust + WKWebView binary |
| `Contents/MacOS/Memory Glass` | Launch wrapper → logs |
| `Contents/Resources/hotpipe/` | live.js · agent · mitigations · packs |
| `Contents/Resources/voice/` | speak / mute / bridge / STS / clone scripts (snapshot) |
| `Contents/Resources/vision/` | still-server + capture helpers (snapshot) |
| `Contents/Resources/AppIcon.icns` | Dock icon |
| `Contents/Resources/BUILD_STAMP` | build epoch / iso |
| `Contents/Info.plist` | camera usage, bundle id |

## Outside the app (machine-local runtime — not in .app)

| Path | Why external |
|------|----------------|
| `~/.panda/voice/` | live mute state, inbox, spoken.log, bridge.pid |
| `~/.panda/vision/` | live.jpg / glass.jpg still-pipe frames |
| `~/models/audio/whisper/ggml/*.bin` | large STT models (~GB) |
| `whisper-cli`, `ffmpeg` | Homebrew / local tools |
| `XAI_API_KEY` | secrets never bundled |

## Install / update checklist

```bash
cd experiments/memory-glass
bash build-mac-app.sh
# copies voice+vision snapshots into Resources, installs ~/Applications

# Sync runtime scripts from bundle → ~/.panda (optional)
bash "$HOME/Applications/Memory Glass.app/Contents/Resources/voice/install-to-panda.sh"

# Still-pipe for inspect face track
python3 ~/.panda/vision/still-server.py &   # or bundled vision/still-server.py

# Voice (muted by default for agent typing sessions)
bash ~/.panda/voice/mute.sh on
bash ~/.panda/voice/voice-bridge.sh &
```

## Hot-pipe resolution order (binary)

1. `MG_HOTPIPE` env
2. If path is inside `*.app` → `Contents/Resources/hotpipe`
3. Else source `CARGO_MANIFEST_DIR/hotpipe` (dev)
4. Fallback bundled / sibling
