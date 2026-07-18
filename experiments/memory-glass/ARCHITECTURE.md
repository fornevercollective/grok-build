# Memory Glass · paint vs rusty · plugin direction

## Split of responsibility

| Layer | Where | Owns |
|-------|--------|------|
| **Rusty** | `src/main.rs` · `Memory Glass.app` | Windows, menus, IPC, camera auth, clipboard, reload, tile layout, inject scripts, bridge `track_pose` inspect→main |
| **Paint (hot-pipe)** | `hotpipe/live.js` | Face mesh, ofx polylines, gsplat/shards/voxels, SAM matte, glasses/beard scale, sys meters UI updates, still-pipe read |
| **Inspect chrome** | HTML in `main.rs` `inspect_panel_html` | Header buttons, log, **RAM/GPU/Spool/FPS** bars |
| **Main HUD** | init script in `main.rs` | LabViewRay, page/cinema/depth, CTRL menus |
| **Still-pipe** | `~/.panda/vision/still-server.py` | `live.jpg` for inspect; **POST /upload** for phone cam (Mac Mini) |
| **Voice** | `~/.panda/voice/*` | STT bridge, mute, TTS (outside app; scripts snapshotted in Resources/voice) |

### Direction (solid)

```
phone or laptop cam
  → still-pipe live.jpg  (or getUserMedia on main when available)
  → inspect FaceDetector + ofx lattice (JS paint)
  → IPC track_pose (Rust)
  → main LabViewRay.set(camera)  (browser content lean / lock)
```

**Hot-pipe first:** visual + track fixes in `live.js` without rebuild.  
**Rust rebuild** only for: native menus, window layout, new IPC ops, cam permissions, bundling.

## Goal + next hurdle

| | |
|--|--|
| **North-star** | Lightweight native droplet + ~1s hot-pipe + spatial mix + live Grok → **sub-16ms** stretch, no Electron |
| **Baseline (H0)** | Shell, continuous cam, inspect track, 6DOF lock, multi-subject paths, meters — **shipped** |
| **Next (H1)** | Hands / air pointer **without thrash** (inspect owns track; main PAGE calm) |
| **Ladder** | H2 pen tip · H3 WebGPU/Metal · H4 SW/IndexedDB · H5 subagents + Rust pre-fetch · H6 sub-16ms · H7–H9 multi-process / Metal / XR |

Full criteria + anti-goals: `hotpipe/GOALS.md`.

## Plugin / packet for Grok Build users

Ship as one folder users drop into experiments or enable as lab pack:

```
memory-glass/
  Memory Glass.app          # or build-mac-app.sh
  hotpipe/                  # live.js · LINEAGE · prompt
  Resources-pack/           # voice + vision + MANIFEST
  ARCHITECTURE.md
  plugin/SKILL.md           # agent onboarding
```

Agent ground-running:

1. `bash build-mac-app.sh && open ~/Applications/Memory\ Glass.app`
2. Still-pipe: `python3 ~/.panda/vision/still-server.py` (or Resources/vision)
3. Mute voice while typing: `bash ~/.panda/voice/mute.sh on`
4. Inspect meters: RAM · GPU proxy · Spool · FPS at bottom
5. Face track → main via `track_pose` (badge `→MAIN` / `→ browser`)

## Mac Mini (no built-in camera)

1. Run still-server on Mini with `MG_STILL_BIND=0.0.0.0`
2. Phone app (GrokYtalkY / any cam pusher) POST JPEG to `http://MINI_LAN:9877/upload`
3. Inspect reads `live.jpg` — same ofx path, no laptop FaceTime required
4. Optional future: BLE/mesh discover Mini via GY; not required for MVP

## Issue signals (inspect footer)

| Meter | Meaning |
|-------|---------|
| **RAM** | JS heap / deviceMemory pressure |
| **GPU** | Frame-budget proxy (+ WebGL present) |
| **Spool** | Still-pipe lag (time since last good face frame) |
| **FPS** | Inspect rAF health (full bar ≈ 60) |
| **sig** | `RAM_CRIT` · `GPU_WARN` · `SPOOL_STALL` · `FPS_DROP` |
