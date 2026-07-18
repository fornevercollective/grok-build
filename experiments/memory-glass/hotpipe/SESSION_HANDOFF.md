# Memory Glass · session handoff (continue here)

Paste this into a **new Grok Build session** (`/new`) to continue live work.

---

## Kickoff prompt (copy below)

```
Continue Memory Glass live iteration (experiments/memory-glass).

## Product
- Native macOS browser: tao + wry → WKWebView (not Chrome/Electron)
- App: ~/Applications/Memory Glass.app  (also experiments/memory-glass/Memory Glass.app)
- Bundle ID: dev.fornevercollective.memory-glass
- Stamp on every window: v{PKG} · b{BUILD_EPOCH} · r{RUN_EPOCH}
  - b = compile-time Unix epoch (build.rs)
  - r = process start epoch
  - User must match stamp to know relaunch is live

## Launch
open -n "$HOME/Applications/Memory Glass.app"
# safe (hot-pipe off):
MG_HOTPIPE_OFF=1 open -n "$HOME/Applications/Memory Glass.app"

## Hot-pipe (prefer for JS/HUD fixes — no full relaunch)
Path: experiments/memory-glass/hotpipe/
- live.js          → auto soft-inject on mtime (~1.5s poll)
- mitigations/     → once-per-stem auto apply on real err only
- agent.html       → Inspect › Agent
- prompt.md        → live intent
- out/             → inspect packs
- SESSION_HANDOFF.md → this file

Inspect float (⌘⌥I): Copy · → Grok · Hot · Mitigate · Agent
Packs: hotpipe/out/inspect-pack-*.md + ~/.panda/packs/mg-inspect.json

## UI layout (current)
- Top-left: version stamp (plain text, no circle) near grab dots
- Top-right: . inspect  then  . depth ▾  (page | cinema | depth)
- Coverflow + camera PIP live inside inspect float (not bottom of main page)
- Coverflow credit ONLY in source comments (not public UI)
- CTRL: Eye presets then Glasses Rx under Eye; Modes; Lens; Stereo; Track

## Three site modes
- page   — normal site, pointer only, no cam/cinema
- cinema — theater dim, more see-through, mouse tracking
- depth  — full face+hands+lidar+axis+no-glasses stack (default)

## Eye presets
human eagle cat owl dog horse spider gecko fly(Compound) calibrate(No-glasses)

## Known fixed recently
- Hot-pipe mitigate feedback storm (IPC loop) → once-per-stem + skip noise srcs
- Camera request no longer blocks main thread 20s
- Clipboard via native pbcopy (navigator.clipboard often missing in WKWebView)
- Inspect PIP: hide mirrored play chrome; coverflow clipped under PIP
- Glasses Rx moved under Eye

## Known open / fragile
- Camera TCC: status can flip notDetermined on fresh process; System Settings › Camera must allow Memory Glass
- Dock icon cache: killall Dock if logo looks stale (stamp is truth)
- Live gsplat/lidar/page-prism parallelism still ~proxy (2.5D HUD), not real multi-view 3DGS
- Multi-webview live page textures for true prism stack not built

## How user reports issues
"I clicked X, expected Y, saw Z · stamp b… r…"
or paste Inspect → Copy dump

## How agent fixes
1. Prefer hotpipe/live.js or mitigations/*.js (soft inject)
2. cargo build + build-mac-app.sh only for Rust/window/IPC
3. Always tell user the new b{epoch} after rebuild
4. Never re-enable spam mitigations or blocking camera wait

Continue: wait for user report or inspect dump; fix via hot-pipe first.
```

---

## One-liner for user after `/new`

Open Memory Glass, confirm stamp top-left, try **page / cinema / depth**, then either paste Inspect **Copy** here or say: *I clicked X, saw Y*.
