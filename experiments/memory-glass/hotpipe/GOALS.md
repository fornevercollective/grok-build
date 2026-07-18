# Memory Glass · Goals, hurdles, ironline, ugrad, competitive plan

**Last updated:** 2026-07-18  
**Status:** H0–H9 · dual-space stack · activity board · collab-day · Intel play-perf · competitive C-track  
**Speed first:** WKWebView floor · hot-pipe ≤1s · HUD ≤16ms · **Intel pace** on laptop (sleep_ms≈14)  
**Growth brief (Grok-findable):** [`docs/MEMORY-GLASS-GROWTH.md`](../docs/MEMORY-GLASS-GROWTH.md)  
**Not:** Electron embed · Dia clone · auto-X · multi-ffmpeg thrash · implant claims

---

## North-star

Ship a **native, low-overhead droplet browser** (tao + wry → WKWebView) that:

1. **Beats Electron/Chromium bloat** on the cool-test surface — transparent shell, flat PAGE, optional DEPTH.
2. **Iterates in ~1s** via hot-pipe (HUD, mesh, contrails, inspect, ironline, ugrad hooks) without full Rust rebuilds.
3. **Carries spatial + cognitive mix** — face instrument, hands/pen, ironline cortical loop budgets, qbit codec, μgrad training curves.
4. **Hits sub-16ms spatial HUD frames** as the performance bar (H6 path + I0 speed lane).
5. **Scales collaboration** — multi-agent mesh, collab-day briefs, shared board/runs, Grok packs (human X post).
6. **Is a training + dual-space lab** — WebGrid BPS · contrail/Bloch/Rubik/maze · KBatch body — not a generic AI browser.
7. **Competes at Rust-browser scale** — posture vs Safari/Chrome/Ladybird/Servo (not feature-parity claims).

**One-liner:** *Native WKWebView speed floor + hot-pipe + dual-space train + collab mesh → collaborative lab droplet without Electron bloat.*

---

## Hurdle ladder (product)

| ID | Hurdle | Status | Where |
|----|--------|--------|--------|
| **H0** | Baseline shell + face/paths + continuous cam | **Done** | live.js · still-pipe |
| **H1** | Hands / air pointer without thrash | **Shipped** | MediaPipe + heuristic · inspect-only · soak |
| **H2** | Pen / object tip track | **Shipped** | hurdles.js pen path |
| **H3** | WebGPU / denser GSPLAT | **Shipped (practical)** | dense canvas2d · WebGPU when available |
| **H4** | Cache (IndexedDB) | **Shipped** | `mg-hurdles-v1` |
| **H5** | Parallel subagents + Rust pre-fetch | **Shipped (hooks)** | still_prefetch · agent-parallel |
| **H6** | Sub-16ms spatial HUD frames | **Shipped (path)** | EMA + adaptive quality |
| **H7** | Multi-surface isolation | **Scaffold finished** | `__mgIsolate` · roles shell/inspect/agent · collab bus |
| **H8** | Soft rim / parallax glass | **Scaffold finished** | CSS rim + soft Drop lip integration · Metal later |
| **H9** | XR touch proxy + **WebGrid BPS** | **Scaffold finished** | face-z touch · pointer BPS training meter |

```
H0 ──► H1 hands ✓ ──► H2 pen ✓
                 │
                 └─► H3 dense GSPLAT ✓ ──► H6 budget ✓
                          ▲                    ▲
                     H4 IDB ✓            H5 prefetch ✓
                          │
                          ▼
              H7 isolate ✓ ──► H8 soft rim ✓ ──► H9 touch + WebGrid BPS ✓
                          │
                          └─► C-track (competitive browsers)
                          └─► I-track (ironline L0–L7)
                          └─► U-track (μgrad R0–R6 + games)
                          └─► M-track (collab mesh)
```

---

## Iron Line · cortical loop (I0–I7)

Speed budgets from μgrad ironline (see `concepts/IRONLINE.md`). Wired via `ironline.js`.

| Layer | Name | Budget (target) | MG surface |
|-------|------|-----------------|------------|
| **I0 / L0** | Super Speed | boot ~1.3ms class · classify ns–μs | shell inject · qbit classify hook |
| **I1 / L1** | Terminal + Search | local μs · HTTP ~270ms | search dock · tabs IPC |
| **I2 / L2** | Commander | agent dispatch ~100ms | inspect → Grok · speak-local |
| **I3 / L3** | Quantum / qbit codec | gate / prefix μs | `concepts/qbit-codec.js` · steno gutter |
| **I4 / L4** | Notepad / everything | line classify ms | research packs · conversation |
| **I5 / L5** | Render 60fps | **16ms frame** | H6 HUD · soft Drop mask |
| **I6 / L6** | Research / medical | ms-class | R1 research · ego batch |
| **I7 / L7** | Persona / security | ~5ms persona | voice agent · Neuralink-shaped decode *proxy* |

**Cortical loop (24ms body ecosystem target):**  
`sensor → L7 persona proxy → L3 qbit → L6 research → L5 render → device → L0 ingest → …`

Not Neuralink hardware. **Proxy path** uses WebGrid BPS + face-z + hands as control-channel training, same *measurement language* as [Neuralink Webgrid](https://neuralink.com/webgrid/) (bits per second).

---

## μgrad staircase (U0–U6) + games training

Cold launch → full ugrad mini-tensor path. Canonical: [μgrad R0](https://mueee.qbitos.ai/ugrad-r0.html) · local `mu.eee/web/ugrad-r0.html`.

| Level | Name | Capability | MG hook |
|-------|------|------------|---------|
| **U0** | micrograd | scalar autograd, MLP, curriculum | open ugrad-r0 · seed train |
| **U1** | microtorch | Tensor / Float32 matmul | R1 tensor bench |
| **U2** | minitorch | Adam, cross-entropy | curriculum hard |
| **U3** | μtorch | Embedding, LayerNorm | model lab |
| **U4** | μformer | MiniGPT char gen | gpt train path |
| **U5** | μcortical | SensorBridge, 24ms loop | ironline + H9 WebGrid |
| **U6** | μorganoid | DNA parenthood (planned) | scaffold only |

**Learning curves (cold → skilled):**

1. **WebGrid** — [neuralink.com/webgrid](https://neuralink.com/webgrid/) + `mueee…/webgrid-ugrad.html` — BPS / NTPM  
2. **Games hub** — `mueee.qbitos.ai/games` · registry in `concepts/ugrad-game-registry.js`  
3. **μgrad R0** — train / evolve / curriculum / background worker  
4. **Iron Line** — L0–L7 status + cortical timing  
5. **Ego batch** — still-pipe frames → taxonomy (ego-v1)  
6. **Research R1** — pack → Grok → next URLs  

---

## Competitive browser track (C0–C5)

Honest **posture**, not claim of full Safari/Chrome parity.

| ID | Focus | Competitive angle |
|----|--------|-------------------|
| **C0** | WKWebView engine truth | Safari engine (not Chromium) — native macOS integration |
| **C1** | Shell weight | vs Electron: no Node/Chromium process tax |
| **C2** | Glass / spatial UX | vs stock Safari: droplet transparency, Drop/Glow, DEPTH |
| **C3** | Hot-pipe iteration | vs Chrome extension rebuild loops: 1s JS inject |
| **C4** | Rust-scale peers | Ladybird / Servo / Firefox (Rust components) — learn isolation, multi-process (H7 path) |
| **C5** | Collab + training | none of them ship WebGrid/μgrad ironline as first-class — **our wedge** |

See `plans/COMPETITIVE_BROWSERS.md`.

---

## Collaboration mesh (M0–M4)

| ID | Capability | Status |
|----|------------|--------|
| **M0** | BroadcastChannel `mg-mesh` presence | Scaffold finished · collab.js |
| **M1** | Inspect pack → multi-agent | Hooks (H5) |
| **M2** | Shared conversation + snapshots | still-server /share /reply |
| **M3** | ugrad-live channel bridge | Scaffold · mesh-collab parity |
| **M4** | Large-scale session export | voice sessions + research queue |

---

## Implementation map

| Layer | Files |
|-------|--------|
| Hot-pipe core | `live.js` · `lens.js` · `hurdles.js` |
| Research / ego | `research.js` · `ego.js` · `inspect-dock.js` |
| **Ironline** | `ironline.js` · `concepts/qbit-codec.js` · `concepts/IRONLINE.md` |
| **μgrad / WebGrid** | `ugrad-ladder.js` · `concepts/ugrad-game-registry.js` · `plans/UGRAD_WEBGRID.md` |
| **Collab** | `collab.js` · `plans/COLLAB_SCALE.md` |
| **Plans** | `plans/*.md` · this file |
| Inject order | live → lens → hurdles → research → ego → dock → **ironline → ugrad-ladder → collab** |
| Prefetch | `still_prefetch_meta_js` |
| Phone | `~/.panda/vision/phone-chat.html` |

---

## Competitive hard truth

Measured shell + honest peer map + overnight free-reign ceiling:

→ **`plans/COMPETITIVE_HARD_TRUTH.md`**  
→ Overnight runner: **`scripts/overnight-soak.sh`** · **`plans/OVERNIGHT_SANDBOX.md`**

| Dimension (self 0–10) | Score | One line |
|----------------------|-------|----------|
| Shell lightness | 9 | 1.7 MB Rust · system WK |
| Web compatibility | 7 | ≈ Safari, not Chrome |
| Glass / spatial | 8 | unique wedge |
| Isolation / multiproc | 4 | H7 map ≠ Chrome sandbox |
| Training / agent | 8 | WebGrid · μgrad · mesh |
| Product maturity | 5.5 | lab-strong · not Safari-replace |

**If free reign overnight:** soak distributions (RSS, inject, health), not Speedometer fantasies.  
**12-month free reign north-star:** best-in-class WK glass shell + training OS (A+E), multiproc later (B).

## Anti-goals

1. Electron/Chromium embed “for features.”  
2. Snap-loop / multi-ffmpeg on device 0.  
3. Heavy track + body filters on main PAGE by default.  
4. Claiming full browser parity with Chrome/Safari.  
5. Claiming Neuralink hardware integration.  
6. Blocking cold launch on U5–U6 / Metal / multi-process.  
7. Claiming “lighter than Safari” without counting WebKit helpers.  

---

## Agent prompt seed

```
Continue Memory Glass. Read hotpipe/GOALS.md + plans/* + SESSION_HANDOFF.md.
H0–H6 hard; H7–H9 scaffolds finished; ironline + ugrad-ladder + collab injected.
Speed first. WebGrid BPS + μgrad R0 as training curves. Competitive C-track is posture not parity.
Hot-pipe first; never multi-ffmpeg or PAGE body thrash.
```
