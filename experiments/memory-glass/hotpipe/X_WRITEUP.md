# Memory Glass · X / Grok writeups

## Goal (north-star · for posts)

**Goal:** a native, low-overhead droplet browser — **tao + wry → WKWebView** — that stays lighter than Electron/Chromium, iterates HUD/mesh/contrails in ~1s via **hot-pipe**, and scales spatial mix + live Grok integration toward **sub-16ms** spatial HUD frames without abandoning the lightweight shell.

**Next hurdle:** **hands + in-air pointer without thrash** (inspect-first). Face instrument + path contrails are baseline; re-enabling hands must not reintroduce body/transform thrash or multi-cam load. After that: pen tip → WebGPU/Metal denser GSPLAT → cache + parallel subagents/pre-fetch → multi-process / XR.

Canonical ladder: `hotpipe/GOALS.md`.

---

## Single post — goal ladder (X / Grok · primary)

North-star goal for **Memory Glass:** a native **WKWebView** droplet browser with ~1s **hot-pipe** JS iteration, spatial mix (**GSPLAT**, HUD, paths), and live Grok integration — avoiding Electron bloat while targeting **sub-16ms** spatial HUD frames.

**H0 baseline (shipped):** continuous cam · **6DOF** head lock · multi-subject paths · soft mesh/person matte · inspect tracking · performance meters.

**H1–H6 hard push:** inspect hands/air (+ heuristic fallback) · pen/object tip paths · denser GSPLAT · IndexedDB cache · Rust still-pipe pre-fetch meta · adaptive **sub-16ms** frame budget — calm **PAGE**, no multi-ffmpeg.

**H7–H9 scaffold:** inspect isolation · CSS rim · face-z touch proxy (true multi-process / Metal / XR later).

Supporting files (`GOALS.md`, `SESSION_HANDOFF`, `X_WRITEUP`, `ARCHITECTURE`, `hurdles.js`) plus `~/.panda` packs enable quick agent handoff and iteration.

#MemoryGlass #WKWebView #Rust #GrokBuild #xAI

---

## Single post — speed baseline (prose · X-ready)

Memory Glass leverages native **tao + wry → WKWebView** for a low-overhead droplet browser (transparent shell, flat **PAGE** default, optional **DEPTH** HUD), delivering lower RAM/CPU than Electron/Chromium while supporting **hot-pipe** live JS injection (~1s updates) for HUD, mesh, contrails, and inspect without full Rust rebuilds.

**Goal:** keep that native speed floor while scaling spatial mix and live Grok — stretch target **sub-16ms** spatial HUD frames.

Current speed baseline includes continuous cam streaming (no LED thrash), off-main-thread tracking/canvas, **6DOF** head lock, multi-subject paths, and performance meters. **Next hurdle:** hands + in-air pointer without reintroducing thrash. Roadmap after that: **WebGPU/Metal** denser GSPLAT recon, service workers + IndexedDB caching, Grok Build parallel subagents, and Rust pre-fetching.

Further potential includes multi-process isolation, Metal-accelerated parallax/rim effects, headless agent offload, and XR touch paths — preserving the lightweight native footprint while scaling spatial mix and live Grok integration.

#MemoryGlass #WKWebView #Rust #GrokBuild
---

## Single post — speed baseline (structured · alt)

Memory Glass leverages native **tao + wry → WKWebView** for a low-overhead droplet browser (transparent shell, flat **PAGE** default, optional **DEPTH** HUD) — lower RAM/CPU than Electron/Chromium, with **hot-pipe** live JS injection (~1s) for HUD, mesh, contrails, and inspect without a full Rust rebuild.

**Goal:** native speed floor + spatial mix + live Grok → stretch **sub-16ms** HUD frames without Electron bloat.

**Baseline today:** continuous cam stream (no snap-loop LED thrash) · inspect-side tracking/canvas · 6DOF head lock · multi-subject paths · RAM/GPU/Spool/FPS meters.

**Next hurdle:** hands + in-air pointer **without thrash** (inspect-first).

**Roadmap:** WebGPU/Metal denser GSPLAT · service workers + IndexedDB · Grok Build parallel subagents · Rust pre-fetch → target **sub-16ms** spatial HUD frames.

**Further:** multi-process isolation · Metal parallax/rim · headless agent offload · XR touch paths — keep the lightweight native footprint while scaling spatial mix and live Grok integration.

#MemoryGlass #WKWebView #Rust #GrokBuild
---

## Thread A — Native speed baseline + roadmap (2026-07)

### 1/
**Memory Glass** — native macOS droplet browser.

**tao + wry → WKWebView**, not Electron/Chromium.

Lower RAM/CPU footprint than a full browser engine. Transparent shell. Flat **PAGE** mode by default. Optional **DEPTH** spatial HUD.

### 2/
**Hot-pipe** keeps the loop fast:

Edit `hotpipe/live.js` → inject into main + inspect in ~1s.

HUD / mesh / path contrails / inspect meters without a cargo rebuild.

Rust rebuild only for windows, menus, IPC, cam auth.

### 3/
**What ships today (inspect + still-pipe)**

• 468 face mesh + soft person matte (low α so you still *see* your face)  
• 6DOF head pose · spatial **HEAD LOCK**  
• Daito-style **path contrails** (fencing tip / velocity)  
• Multi-subject · HOME/NEAR/PUBLIC/PRIVATE zones  
• Inspect float · tile layout · RAM/GPU/Spool/FPS meters  
• Phone cam `POST /upload` path for Mini (no built-in camera)

### 4/
**Native advantages → baseline speed**

| Choice | Why it’s fast |
|--------|----------------|
| WKWebView | System browser core, not Chromium embed |
| PAGE default | No body transform thrash while reading/scrolling |
| Hot-pipe JS | Sub-second HUD iteration |
| Still-pipe stream | Continuous cam open (not snap-loop LED thrash) |
| Track on inspect | Heavy canvas off the main page thread |

DEPTH scroll is freeze-on-wheel so page-axis lean doesn’t hop the document.

### 5/
**Next hurdle, then speed ladder**

**Next:** hands + in-air pointer **without thrash** (inspect-first; main PAGE stays calm).

Then roadmap (not all shipped):

1. **Pen / object tip** — fencing tip as path source  
2. **WebGPU / Metal** — real GSPLAT / point-cloud density  
3. **Aggressive cache** — service workers + IndexedDB for page tracks / packs  
4. **Parallel Lab subagents** — Grok Build offline pack / mitigate  
5. **Rust pre-fetch** — camera/page edge prep before inject  

Target: **sub-16ms** spatial HUD frames while keeping the droplet footprint.
### 6/
**Further potential**

• Multi-process isolation (future wry / multi-webview)  
• GPU-accelerated parallax / rim via Metal shaders  
• Headless agent offload so the main WebView stays light  
• True in-air touch / Vision-class depth (hardware + native path)

### 7/
**One-liner**

Native WKWebView baseline + hot-pipe iteration = strong speed floor.  
WebGPU + cache + offload = path to spatial mix without Electron bloat.

#MemoryGlass #WKWebView #Rust #GrokBuild #xAI

---

## Accuracy notes (internal)

| Claim | Status |
|-------|--------|
| tao + wry → WKWebView, not Electron | **True** |
| Hot-pipe ~1s inject | **True** (mtime poll) |
| Transparent / droplet shell | **True** |
| Hands / air pointer | **H1 shipped** — MediaPipe + heuristic; inspect-only thrash-safe |
| Pen / object tip | **H2 shipped** — index/object tip path |
| Dense GSPLAT / WebGPU | **H3** — dense canvas; WebGPU device when available |
| IndexedDB cache | **H4 shipped** |
| Prefetch + agent hooks | **H5 shipped** (stat live.jpg) |
| Sub-16ms spatial frames | **H6 path** — adaptive quality EMA |
| Continuous cam | Use `capture-stream.sh`, not `snap-loop.sh` |
GitHub “behind xai-org” is **history only** — trust `SOURCE_REV` + path-checkout (`docs/FORK_SYNC.md`).
