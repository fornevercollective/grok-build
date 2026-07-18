---
name: memory-glass
description: >
  Native macOS droplet browser (tao+wry WKWebView) with ofx/daito face track,
  inspect float, hot-pipe live.js, still-pipe phone cam, voice mute bridge.
  Use when user wants Memory Glass, face HUD, inspect meters, or cam-less Mini.
---

# Memory Glass · Grok Build plugin pack

## Ground running (agent)

```bash
cd experiments/memory-glass   # or path to this pack
bash build-mac-app.sh
open -n "$HOME/Applications/Memory Glass.app"

# still-pipe (required for inspect face + main LabViewRay bridge)
python3 "$HOME/.panda/vision/still-server.py" &
# or: python3 Resources/vision/still-server.py

# optional voice (keep muted while typing)
bash "$HOME/.panda/voice/mute.sh" on
```

## What Grok should know

| Surface | Role |
|---------|------|
| Main window | Browser + LabViewRay page lean driven by **still-pipe track_pose** |
| Inspect float | Face ofx mesh · gsplat · depth · **RAM/GPU/Spool/FPS** meters |
| Hot-pipe | Edit `hotpipe/live.js` → auto inject (no rebuild) |
| Rust rebuild | Windows, menus, new IPC only |

## Mac Mini / no camera

```bash
MG_STILL_BIND=0.0.0.0 python3 ~/.panda/vision/still-server.py
# From phone (same LAN):
curl -F "file=@frame.jpg" http://MINI_IP:9877/upload
```

GrokYtalkY phone can push frames the same way (HTTP POST JPEG).

## Issue grab

Inspect bottom bars: **RAM · GPU · Spool · FPS** + signal text (`SPOOL_STALL`, `RAM_CRIT`, …).

## Goal + next hurdle

| | |
|--|--|
| **North-star** | Native WKWebView droplet + hot-pipe (~1s) + spatial mix + live Grok — no Electron bloat; stretch **sub-16ms** HUD frames |
| **Baseline** | Shipped (continuous cam, inspect track, 6DOF, paths, soft mesh, meters) |
| **NEXT** | **H1 hands / air pointer without thrash** — inspect-first; never body-filter thrash on PAGE |
| **After** | H2 pen tip · H3 WebGPU/Metal GSPLAT · H4 cache · H5 subagents/pre-fetch · H6 sub-16ms · H7–H9 multi-process / XR |

Canonical: `hotpipe/GOALS.md`. Do not jump to XR while H1 is open.

## Docs

- `hotpipe/GOALS.md` — north-star, next hurdle, ladder, anti-goals
- `ARCHITECTURE.md` — paint vs rusty
- `hotpipe/LINEAGE.md` — daito/ofx/SAM map
- `hotpipe/SESSION_HANDOFF.md` — restart + known issues
- `hotpipe/X_WRITEUP.md` — public speed language
- `Resources-pack/MANIFEST.md` — what's in the .app
