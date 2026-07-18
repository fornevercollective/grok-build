# Memory Glass · Goals & next hurdles

**Last updated:** 2026-07-17  
**Status:** Baseline shipped · **H1 in progress** (inspect hands/air · thrash guards on main)

---

## North-star goal

Ship a **native, low-overhead droplet browser** (tao + wry → WKWebView) that:

1. **Stays lighter than Electron/Chromium** — transparent shell, flat **PAGE** default, optional **DEPTH** HUD.
2. **Iterates in ~1s** via hot-pipe live JS (HUD, mesh, contrails, inspect) without full Rust rebuilds.
3. **Carries spatial mix** — face instrument, 6DOF head lock, multi-subject paths, path contrails — while the main page stays readable.
4. **Hits sub-16ms spatial HUD frames** as the performance bar (roadmap), without abandoning the lightweight native footprint.
5. **Scales live Grok integration** — inspect packs, Lab subagents, voice, still-pipe — without making the WebView the heavy process.

**One-liner:** *Native WKWebView speed floor + hot-pipe iteration → spatial mix and live Grok without Electron bloat.*

---

## What “done enough” looks like today (baseline)

| Pillar | Shipped | Guardrail |
|--------|---------|-----------|
| Shell | tao+wry WKWebView droplet, PAGE/CINEMA/DEPTH | PAGE default; DEPTH opt-in |
| Iteration | hot-pipe `live.js` ~1s inject | Rust only for window/IPC/cam auth |
| Cam | continuous `capture-stream.sh` + still-pipe :9877 | **Never** snap-loop LED thrash |
| Track | inspect owns mesh/matte/paths; main gets pose IPC | No body-filter thrash on main |
| Spatial | 6DOF head lock, multi-subject, zones, path contrails | Soft mesh/matte α (face still visible) |
| Meters | RAM / GPU / Spool / FPS on inspect | Surface `SPOOL_STALL`, `RAM_CRIT`, … |
| Mini | phone `POST /upload` → live.jpg | Single writer only |

Baseline is **good enough to demo and write about**; it is **not** the sub-16ms / WebGPU / XR end state.

---

## Next hurdle (active)

### H1 — Hands + in-air pointer without thrash

| | |
|--|--|
| **Why next** | Face instrument + fencing-style path contrails are live. The natural next spatial input is **hands / air pointer** (and later pen tip). Hands were disabled on main because they reintroduced **body/transform thrash** and frame pressure. |
| **Goal** | Stable hand landmarks + pinch/air-pointer → inspect (and optional main IPC) **without** reintroducing PAGE thrash or multi-cam load. |
| **Success** | Hands ON for ≥5 min browsing; FPS/Spool meters stay green; main body transform stays calm in PAGE; no LED thrash. |
| **Non-goals (this hurdle)** | Full XR depth, pen tip, WebGPU GSPLAT density. |
| **Where** | Hot-pipe first (`live.js` / inspect canvas); re-enable carefully. Rust only if new IPC op is required. |
| **Risk** | Same class of failure as early DEPTH: filters on `document.body`, main-thread MediaPipe, multi-ffmpeg. Prefer inspect-side track + sparse IPC. |
| **Est.** | Days (not weeks) if thrash discipline holds. |
| **Shipped (partial)** | `live-v17-hands`: MediaPipe Hands on **inspect still-pipe** (same `live.jpg`, throttled); expansion skeleton + air pointer (index tip) + hand path; `track_hand` IPC; main `__mgApplyRemoteHand` CSS-only (PAGE ignores); DEPTH no longer auto-enables main hands/lidar/occlude. |

**Agent rule:** do not “just turn hands back on” globally. Gate behind inspect toggle; keep PAGE as default; measure Spool/FPS before claiming done.

**Remaining for H1 done:** multi-minute soak with Spool/FPS green; MediaPipe Hands CDN offline bundle; optional main DEPTH hand cursor without occ thrash; pinch → coverflow only when user opts in.

---

## Hurdle ladder (ordered)

| ID | Hurdle | Depends on | Horizon | Outcome |
|----|--------|------------|---------|---------|
| **H0** | Baseline (shell + hot-pipe + face/paths + continuous cam) | — | **Done** | Demoable droplet + spatial face instrument |
| **H1** | Hands / air pointer **without thrash** | H0 | **Next · days** | Mid-air select/swipe without PAGE thrash |
| **H2** | Pen / object tip track | H1 + stable video | **1–2+ weeks** | Fencing/object tip as path source (not face-only) |
| **H3** | WebGPU / Metal denser GSPLAT recon | H0 | **Parallel track** | Real splat/point density vs canvas 2D proxy |
| **H4** | Cache layer (service workers + IndexedDB) | H0 | Weeks | Page tracks / packs / offline HUD assets stick |
| **H5** | Grok Build parallel subagents + Rust pre-fetch | H0 | Weeks | Offline pack/mitigate + cam/page edge prep before inject |
| **H6** | Sub-16ms spatial HUD frames | H3–H5 | Target bar | Sustained spatial HUD under 16ms/frame budget |
| **H7** | Multi-process isolation | wry/multi-webview | Later | Heavy track/agent off main WebView |
| **H8** | Metal parallax / rim + headless agent offload | H3, H7 | Later | GPU effects + agents not taxing shell |
| **H9** | XR touch / Vision-class depth | Hardware + native path | Months / other stack | True depth touch product path |

```
H0 baseline ──► H1 hands/air (NEXT)
                 │
                 ├─► H2 pen tip
                 │
                 └─► H3 WebGPU/Metal ──► H6 sub-16ms ◄── H4 cache + H5 subagents/prefetch
                                              │
                                              ▼
                                    H7 multi-process ──► H8 Metal/offload ──► H9 XR
```

---

## Goal ↔ claim map (for writeups)

Use this so X/Grok posts stay accurate:

| Public claim | Goal tier | Status |
|--------------|-----------|--------|
| tao + wry → WKWebView, not Electron | North-star #1 | **True now** |
| Hot-pipe ~1s HUD/mesh/contrails | North-star #2 | **True now** |
| Continuous cam, no LED thrash | Baseline | **True** if `capture-stream.sh` only |
| Off-main-thread tracking/canvas | Baseline | **True** (inspect owns heavy track) |
| 6DOF head lock · multi-subject paths | Baseline | **True now** |
| Sub-16ms spatial HUD frames | North-star #4 / H6 | **Target**, not guaranteed today |
| WebGPU denser GSPLAT | H3 | **Roadmap** (canvas 2D proxy today) |
| SW + IndexedDB caching | H4 | **Roadmap** |
| Parallel subagents + Rust pre-fetch | H5 | **Roadmap** |
| Hands / air pointer | **H1 next hurdle** | **Not stable** — disabled thrash history |
| Pen / object tip | H2 | **Not built** |
| Multi-process · XR touch | H7–H9 | **Further potential** |

---

## Session goals (how to pick work)

When starting a session, pick **one** primary:

| Mode | Primary goal | Stop condition |
|------|--------------|----------------|
| **Ship baseline polish** | Soft mesh, meters, cam stream, scroll hop | Demo 10 min PAGE + optional DEPTH |
| **Next hurdle (H1)** | Hands/air without thrash | Success criteria in H1 table |
| **Speed track** | H3 or H4 or H5 slice | Measurable FPS/Spool or inject latency win |
| **Write / pack** | X writeup, handoff, plugin docs | Docs match accuracy map |
| **Ops** | Fork path-checkout, single cam writer, mute | `verify-upstream-sync` green; no LED thrash |

**Default if user says “keep going”:** advance **H1** (hands/air) with thrash guards; do not jump to XR.

---

## Anti-goals (do not sacrifice for “progress”)

1. Electron/Chromium embed “for features.”
2. Snap-loop / multi-ffmpeg on device 0.
3. Heavy track + body filters on the **main** browsing surface by default.
4. Mitigate storms / blocking camera wait on launch.
5. High mesh/matte α that hides the face.
6. Force-merge unrelated-history upstream (use path-checkout + `SOURCE_REV`).

---

## Metrics that define the goal

| Metric | Baseline intent | Stretch (H6) |
|--------|-----------------|--------------|
| Hot-pipe inject lag | ~1s mtime poll | Sub-second optional |
| Inspect FPS bar | ~60 when idle track | Hold under dense mesh + hands |
| Spool | Continuous stream, no stall | Stable through phone-upload Mini path |
| Spatial HUD frame time | Not formally budgeted yet | **&lt;16ms** sustained |
| RAM vs Electron-class shell | Qualitative win (WKWebView) | Keep after WebGPU/agent work |
| PAGE scroll | No hop in DEPTH (`mg-scrolling`) | Unchanged when hands ON |

---

## Cross-links

| Doc | Role |
|-----|------|
| `SESSION_HANDOFF.md` | Restart ops + known issues |
| `X_WRITEUP.md` | Public speed/baseline language |
| `LINEAGE.md` | daito/ofx role map + native/heavy gaps |
| `ARCHITECTURE.md` | Paint vs rusty split |
| `plugin/SKILL.md` | Agent ground-running |
| `prompt.md` | Live session steering priorities |

---

## Agent prompt seed (goal-aware)

```
Continue Memory Glass (experiments/memory-glass).
Read hotpipe/GOALS.md + SESSION_HANDOFF.md.
North-star: native WKWebView droplet + hot-pipe + spatial mix without Electron bloat.
Baseline is shipped; NEXT HURDLE = H1 hands/air pointer without thrash (inspect-first, PAGE calm).
Do not reintroduce body filter thrash or multi-ffmpeg. WebGPU/sub-16ms are roadmap, not this session unless asked.
```
