# Memory Glass · Goals & next hurdles

**Last updated:** 2026-07-17  
**Status:** H0 done · **H1–H6 implemented (hard push)** · H7–H9 scaffolded · soak may still be accruing

---

## North-star goal

Ship a **native, low-overhead droplet browser** (tao + wry → WKWebView) that:

1. **Stays lighter than Electron/Chromium** — transparent shell, flat **PAGE** default, optional **DEPTH** HUD.
2. **Iterates in ~1s** via hot-pipe live JS (HUD, mesh, contrails, inspect) without full Rust rebuilds.
3. **Carries spatial mix** — face instrument, 6DOF head lock, multi-subject paths, path contrails — while the main page stays readable.
4. **Hits sub-16ms spatial HUD frames** as the performance bar (H6 adaptive quality path).
5. **Scales live Grok integration** — inspect packs, Lab subagents, voice, still-pipe — without making the WebView the heavy process.

**One-liner:** *Native WKWebView speed floor + hot-pipe iteration → spatial mix and live Grok without Electron bloat.*

---

## Hurdle status (hard push)

| ID | Hurdle | Status | Where |
|----|--------|--------|--------|
| **H0** | Baseline shell + face/paths + continuous cam | **Done** | live.js · still-pipe |
| **H1** | Hands / air pointer without thrash | **Shipped (robust)** | MediaPipe Hands + **heuristic fallback** · inspect-only · `track_hand` · soak meter · main PAGE calm |
| **H2** | Pen / object tip track | **Shipped** | Index tip preferred · object peak fallback · pen path HUD · IPC via track_hand engine `h2-pen-*` |
| **H3** | WebGPU / denser GSPLAT | **Shipped (practical)** | WebGPU device request when available · **dense canvas2d** midpoints + hand splats · adaptive quality |
| **H4** | Cache (IndexedDB) | **Shipped** | `mg-hurdles-v1` IDB: spatial, ui, roster, soak, packs |
| **H5** | Parallel subagents + Rust pre-fetch | **Shipped (hooks)** | `still_prefetch_meta_js` every ~350ms · `__mgStillPrefetch` · `agent-parallel.md` · `__mgAgentPackHook` → IDB |
| **H6** | Sub-16ms spatial HUD frames | **Shipped (path)** | Frame EMA + adaptive `quality` · strip shows ms · denser draws throttle under budget |
| **H7** | Multi-process isolation | **Scaffold** | `__mgIsolate={track:'inspect'}` · inspect owns heavy track · main PAGE calm (true multi-process = future wry) |
| **H8** | Metal parallax / rim | **Scaffold (CSS)** | `mg-h8-rim` inset glow on DEPTH only · no body thrash · real Metal = later |
| **H9** | XR touch / Vision depth | **Scaffold (proxy)** | Face-z touch band `--mg-xr-z` / `mg-xr-touch-proxy` · not Vision hardware |

```
H0 ──► H1 hands ✓ ──► H2 pen ✓
                 │
                 └─► H3 dense GSPLAT ✓ ──► H6 budget ✓
                          ▲                    ▲
                     H4 IDB ✓            H5 prefetch ✓
                          │
                          ▼
              H7 isolate scaffold ──► H8 rim CSS ──► H9 touch proxy
```

### Runtime strip (inspect)

`hurdles-v1 · H1 soak … · H2 TIP · H3 backend · H4 IDB · H5 pf · H6 Nms · H7 inspect · H9 z…`

H1 **SOAK✓** when `greenMs ≥ 5 min` with hands present + budget/spool ok.

---

## Implementation map

| Layer | Files |
|-------|--------|
| Hot-pipe core | `hotpipe/live.js` (`live-v18-hurdles`) |
| Hurdles pack | `hotpipe/hurdles.js` (`hurdles-v1`) |
| Inject | `src/main.rs` → live.js **then** hurdles.js; mtime both |
| Prefetch | `still_prefetch_meta_js()` · stats `~/.panda/vision/live.jpg` |
| Agent | `hotpipe/agent-parallel.md` |
| Packs | `~/.panda/packs/mg-*.md` |

---

## Anti-goals (unchanged)

1. Electron/Chromium embed “for features.”
2. Snap-loop / multi-ffmpeg on device 0.
3. Heavy track + body filters on **main** PAGE by default.
4. Mitigate storms / blocking camera wait on launch.
5. High mesh/matte α that hides the face.
6. Force-merge unrelated-history upstream.

---

## Claim map (writeups)

| Claim | Status |
|-------|--------|
| tao + wry → WKWebView | **True** |
| Hot-pipe ~1s | **True** |
| Hands / air without thrash | **H1 true** (inspect + heuristic; soak accrues) |
| Pen / object tip | **H2 true** (index/object path) |
| WebGPU denser GSPLAT | **H3 partial** — device when available; dense canvas always |
| IndexedDB cache | **H4 true** |
| Rust pre-fetch + agent hooks | **H5 true** (stat-based; not second cam) |
| Sub-16ms HUD | **H6 path** — adaptive quality; not a hard guarantee every frame |
| Multi-process / Metal / XR product | **H7–H9 scaffold** |

---

## Agent prompt seed

```
Continue Memory Glass. Read hotpipe/GOALS.md + SESSION_HANDOFF.md.
H0–H6 hard-pushed (live-v18 + hurdles-v1). H7–H9 scaffold only.
Hot-pipe first; never multi-ffmpeg or PAGE body thrash.
Verify inspect strip: H1 soak, H6 ms, H5 pf age.
```
