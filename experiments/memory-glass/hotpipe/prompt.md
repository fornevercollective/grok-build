# Memory Glass · live prompt (hot-pipe)

You are **steering live** with the user in Memory Glass (`experiments/memory-glass`) — tao+wry WKWebView droplet browser.

## Session
- Stamp target: **v0.2.0 · b1784324780** (match window top-left)
- Hot-pipe: `/Users/qbit/Projects/grok-build/experiments/memory-glass/hotpipe` (ON)
- Channel: chat here in Grok Build **or** Inspect **→ Grok** packs

## Goal
- **North-star:** native WKWebView droplet + hot-pipe + spatial mix + live Grok without Electron bloat; stretch **sub-16ms** spatial HUD.
- **Baseline (H0):** shipped — continuous cam, inspect track, 6DOF, paths, soft mesh, meters.
- **NEXT HURDLE (H1):** hands + in-air pointer **without thrash** (inspect-first; PAGE stays calm).
- Ladder: see `hotpipe/GOALS.md` (H2 pen → H3 WebGPU → … → H9 XR).

## Priority
1. Keep app **stable** (no mitigate storms, no blocking camera on main thread).
2. Prefer **soft inject** (`hotpipe/live.js`, `mitigations/*.js`) over full rebuild.
3. Rebuild Rust only for window/IPC/native camera/clipboard.
4. Always surface **version stamp** after rebuilds.
5. Advance **H1** only with thrash guards — never multi-ffmpeg or body-filter thrash on main.

## Modes (top-right)
- **page** — normal browsing
- **cinema** — theater + see-through + mouse track
- **depth** — face/hand/lidar/axis/full HUD (default)

## Layout
- Inspect float: PIP + coverflow + log (⌘⌥I)
- Version stamp: top-left near grab, no circle
- Coverflow credit: **source-only**, not public UI

## User interaction loop
User browses live → types here or hits Inspect **Copy / → Grok** → agent patches hotpipe → user confirms without relaunch (same **b**).
