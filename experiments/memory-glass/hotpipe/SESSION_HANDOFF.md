# Memory Glass · session handoff

**Saved:** 2026-07-18T00:48:22Z  
**Purpose:** restart agent / human session without re-deriving state.

---

## Quick restart

```bash
# HTTP still-pipe (serves live.jpg)
python3 ~/.panda/vision/still-server.py &

# FACE cam — continuous stream (device stays open; no LED snap thrash)
# Do NOT run snap-loop.sh (re-opens cam every N sec = snapshots)
bash ~/.panda/vision/capture-stream.sh &

# optional: glass.jpg = Memory Glass window grab (not camera)
# bash ~/.panda/vision/capture-gentle.sh &

# app
open -n "$HOME/Applications/Memory Glass.app"
# or rebuild first:
cd /Users/qbit/Projects/grok-build/experiments/memory-glass && bash build-mac-app.sh

# voice (optional; mute while typing)
bash ~/.panda/voice/mute.sh on
```

**Hot-pipe (no rebuild):** edit `experiments/memory-glass/hotpipe/live.js` → app auto-injects from  
`~/Applications/Memory Glass.app/Contents/Resources/hotpipe/` **or** source tree when not in `.app`.  
When running the `.app`, prefer **bundled** Resources; copy live.js into the app after edits:

```bash
cp experiments/memory-glass/hotpipe/live.js \
  "$HOME/Applications/Memory Glass.app/Contents/Resources/hotpipe/live.js"
```

---

## Git

| Item | Value |
|------|--------|
| Repo | `/Users/qbit/Projects/grok-build` |
| Remote | `origin/main` (fornevercollective/grok-build) |
| **Pushed tip** | `e0e776e` — *Sync product tree from xai-org/grok-build tip (path-checkout).* |
| **MG feature commit** | `a678887` — Memory Glass experiment |
| **MG scroll fix** | `3c27b6e` — depth scroll hop + handoff refresh |
| Branch | `main` = `origin/main` |
| **SOURCE_REV** | `124d85bc5dc6e7805560215fcc6d5413944920e1` (upstream monorepo tip path-checkout) |
| Upstream sync | `scripts/sync-upstream-path-checkout.sh` + `scripts/verify-upstream-sync.sh` |
| Policy | **GitHub behind-count is normal** — trust `SOURCE_REV` + path-checkout (`docs/FORK_SYNC.md`). **Never** force-merge `upstream/main` (unrelated histories). |

### Keep monorepo tools current

```bash
git fetch upstream
./scripts/verify-upstream-sync.sh          # exit 0 = content OK
# if DRIFT:
./scripts/sync-upstream-path-checkout.sh upstream/main
git commit -m "Sync product tree from xai-org/grok-build tip (path-checkout)."
git push origin main
```

Leverage in build (workspace): `cargo check -p xai-grok-pager-bin` · shell/tools/workspace crates under `crates/codegen/`.  
Memory Glass remains standalone under `experiments/memory-glass/`.

### Uncommitted (lab only, not MG)

```
M docs/architecture-lab/browser.html
?? docs/architecture-lab/assets/lab-page-metrics.js
```

---

## Binary / stamp last known good

| | |
|--|--|
| App | `~/Applications/Memory Glass.app` |
| Last build stamp | **v0.2.0 · b1784335396 · r1784335412** |
| Bundle epoch | ~1784335410 |
| Hot-pipe VER | **live-v17-hands** (H1 inspect hands/air + path contrails + spatial lock) |
| live.js size | ~check after inject |

---

## Architecture (do not unlearn)

| Layer | Path | Owns |
|-------|------|------|
| **Rust shell** | `experiments/memory-glass/src/main.rs` | Windows, menus, IPC (`track_pose`, `track_people`), inspect HTML, PAGE/CINEMA/DEPTH, cam auth |
| **Hot-pipe** | `hotpipe/live.js` | Face mesh, matte, paths, spatial calib, multi-subject zones |
| **Still-pipe** | `~/.panda/vision/` + still-server :9877 | `live.jpg` / `glass.jpg`; phone `POST /upload` |
| **Voice** | `~/.panda/voice/` (+ Resources-pack/voice) | mute, whisper bridge, TTS, dial-in |
| **Plugin pack** | `plugin/SKILL.md`, `ARCHITECTURE.md`, `Resources-pack/MANIFEST.md` | Grok Build ground-running |

**Rules that matter**

1. **Hot-pipe first** for track/HUD; rust rebuild only for window/IPC/native.  
2. **PAGE default** — DEPTH is opt-in (cam/axis thrash history).  
3. **Inspect owns heavy track**; main stays calm (no body filter thrash).  
4. **Single continuous camera writer** for `live.jpg` — use `capture-stream.sh` (open device once).  
   **Never** `snap-loop.sh` style `-frames:v 1` every few seconds (LED flash / snapshot feel).  
5. Mesh/matte defaults **low** so face stays visible (MESH α ~0.28, MATTE α ~0.14).

---

## Features shipped (current)

### Browser
- Native tao+wry WKWebView droplet shell  
- PAGE / CINEMA / DEPTH modes  
- CTRL menus · tabs · search · ⌘R / menus (Navigate · View · Edit · Window)  
- Tile browser + inspect on-screen  
- Inspect: Cam/Mic, hot, mitigate, agent, meters (RAM/GPU/Spool/FPS)

### Track (inspect + still-pipe)
- 468 mesh (MediaPipe when CDN works · lattice fallback)  
- Soft person matte (light α)  
- ofx features + 6DOF  
- **Path contrails** (Daito/fencing tip: nose/gaze/brow, velocity color)  
- Spatial HEAD LOCK · rest · look extent · MOCAP/HDRI/GSPLAT ref  
- Multi-face · click assign subject · HOME/NEAR/PUBLIC/PRIVATE zones  
- IPC `track_people` / `track_pose` (main stores CSS vars; page axis optional in DEPTH)

### DEPTH scroll fix (in working tree if not committed)
- `--mg-py` always 0  
- `html.mg-scrolling` freezes body transform during wheel/scroll  
- Damped pitch; no scale-from-vy  

### Voice (optional)
- `mute.sh` · bridge dial-in v2 · large whisper via `env.sh`  
- speak.sh xAI TTS fallback · clone-voice · STS scaffold  
- Session export: `~/.panda/voice/sessions/`

---

## Goal + next hurdle (canonical: `GOALS.md`)

| | |
|--|--|
| **North-star** | Native WKWebView droplet + ~1s hot-pipe + spatial mix + live Grok — **without** Electron bloat; stretch **sub-16ms** spatial HUD frames |
| **Baseline** | **Shipped** — continuous cam, inspect track, 6DOF lock, multi-subject paths, soft mesh, meters |
| **NEXT HURDLE (H1)** | **In progress** — inspect hands/air (`live-v17-hands` + `track_hand` IPC); main PAGE calm; DEPTH hands **opt-in** |
| **After H1** | H2 pen/object tip → H3 WebGPU/Metal GSPLAT → H4 cache → H5 subagents/pre-fetch → H6 sub-16ms → H7–H9 multi-process / Metal / XR |

Full ladder, success criteria, anti-goals: **`hotpipe/GOALS.md`**.

## Known issues / next builds

| Issue | Notes |
|-------|--------|
| Camera multi-grab | Only one continuous writer (`capture-stream.sh`) + still-server |
| Auth flap | AV status 0 at boot then prompt; System Settings › Camera › Memory Glass |
| MediaPipe CDN | Often blocked; lattice 468 still works |
| **Hands / in-air touch (H1)** | **Partial** — inspect MediaPipe Hands + air pointer + `track_hand`; main PAGE never thrash; soak not done |
| Pen/object track (H2) | Not built — needs tip detector + stable video |
| WebGPU GSPLAT (H3) | Roadmap — canvas 2D proxy today |
| Git | Prefer commit X_WRITEUP / GOALS / capture-stream pack when dirty |

**Roadmap distance (approx.)**  
- Face instrument + paths: **shipped (H0)**  
- Hands + air pointer: **next · days (H1)**  
- Pen tip + depth touch: **1–2+ weeks (H2)**  
- Sub-16ms / WebGPU density: **weeks · target bar (H3–H6)**  
- XR product: **months / other stack (H9)**
---

## Key paths

```
experiments/memory-glass/
  src/main.rs
  hotpipe/live.js          # VER live-v17-hands
  hotpipe/GOALS.md         # north-star + next hurdle ladder
  hotpipe/LINEAGE.md
  hotpipe/X_WRITEUP.md
  hotpipe/SESSION_HANDOFF.md  # this file
  build-mac-app.sh
  ARCHITECTURE.md
  plugin/SKILL.md
  Resources-pack/

~/Applications/Memory Glass.app
~/Library/Logs/MemoryGlass/launch.log
~/.panda/vision/{live.jpg,still-server.py,capture-gentle.sh}
~/.panda/voice/{mute.sh,voice-bridge.sh,speak.sh,sessions/}
```

---

## Product rules (from live sessions)

- Stamp `v{pkg} · b{epoch} · r{epoch}`  
- No mitigate storms / no blocking camera wait on launch  
- TTS mute + spoken.log echo filter when voice on  
- Prefer inspect for mesh; don’t obscure face (low α)  
- DEPTH: scroll must not hop (see main.rs mg-scrolling)

---

## Agent prompt seed (paste next session)

```
Continue Memory Glass (experiments/memory-glass).
Read hotpipe/GOALS.md + SESSION_HANDOFF.md.
North-star: native WKWebView droplet + hot-pipe + spatial mix without Electron bloat.
Baseline shipped (H0). H1 partial: live-v17-hands inspect hands/air + track_hand; finish soak + offline Hands bundle.
Hot-pipe first (live.js); rust rebuild only for native/IPC.

Still-pipe :9877, single continuous cam writer (capture-stream.sh — never snap-loop).
Do not reintroduce body filter thrash or multi-ffmpeg on device 0.
```
---

*End of handoff. Background monitors should be stopped when this file is written.*
