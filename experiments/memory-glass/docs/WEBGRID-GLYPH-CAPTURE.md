# WebGrid timing plane × glyph optical capture

**Context:** Memory Glass Grok dev environment — race-shell WebGrid agent (BPS instrument)  
× multi-agent optical debate at `http://127.0.0.1:8765/#debate`  
(Glyph 13×13, Decimen fountain, AI Fleet peel, Capacity ladder).

**Status:** product rule locked · one hot path at a time · metrics float = operator consent.

---

## Glyph debate (:8765/#debate) × WebGrid — implications

| Debate idea | WebGrid parallel |
|-------------|------------------|
| Frame clock → peel → score → log | Blue detect → pointer → BPS → `:9880` |
| Headless peel must not skip reality | Race-shell can’t be a black void — metrics are the **disclosure surface** |
| Honest rate ladder (glyph ≠ QR Mb/s) | Agent BPS ≠ implant |
| Back-spool tax | Optical mix/fuzz competed with click cadence; stopping spool → faster boot (correct) |
| Thin glyph tickets vs bulk fountain | Race HUD = thin control plane; full lab = bulk theater |

---

## Shared product rule

> **One hot path at a time** — either **race instrument** or **dense optical peel soak**.  
> **Metrics float = operator consent:** what is the machine doing right now.

Glyph tech wants capture engines that are **race-shell-shaped**:

1. Strip chrome  
2. Keep the loop  
3. Keep a **visible score**  
4. Emit **JSONL**

**WebGrid is the timing calibration plane for that architecture — not a competing product.**

---

## Two channels, one craft

| Plane | What it measures | Engine today |
|-------|------------------|--------------|
| **WebGrid race** | Motor timing · click → blue · BPS/NTPM | `webgrid-play` + race-shell · WKWebView canvas read |
| **Glyph / fountain** | Air-gap **bits** · screen→camera · tickets | LT mix, glyph 13×13, fountain QR, peel workers |

Shared architecture:

```
source → frame clock → detect/target → act → score → log → fleet board
```

| Step | WebGrid | Glyph / optical |
|------|---------|-----------------|
| source | Neuralink canvas | mix-pipe / TV / /watch |
| frame clock | RAF / pointer cadence | fps / compositor tick |
| detect | blue `rgb(10,132,255)` cell | free-mask · module threshold · QR |
| act | synthetic `pointerup` | peel / ingest LT frame |
| score | BPS · NTPM | BER · fountain % · B/frame |
| log | `:9880` play.jsonl | packets / fountain / soak JSONL |
| fleet | LIVE RANK / leaderboard | plant registry / AI peel scheduler |

---

## Implications (expanded)

1. **Same honesty ladder**  
   Debate capacity ladder (Jawta → glyph → L3 → QR) must not collapse into one “Mb/s” marketing number.  
   WebGrid already labels **agent ≠ implant**. Optical must label **loopback ≠ glass-to-glass BER**.

2. **Headless peel = race-shell for photons**  
   AI Fleet seat on :8765: `demux → frame_clock → glyph_peel → fountain_accum`.  
   Race-shell is the same idea for BPS: strip chrome, keep the loop, keep a **visible score HUD**.  
   Black void / hidden metrics = failed instrument (not “faster”).

3. **Metrics float is the disclosure surface**  
   LIVE RANK + race HUD are operator consent for “what is the machine doing.”  
   Ethics seat: no silent capture. WebGrid agent ticks → `:9880` are the audit log.  
   Optical plant: `/metrics` was the disclosure surface — stopped during race to free the hot path.

4. **Back-spool tax**  
   Optical mix/fuzz/spool competes with getImageData click cadence.  
   Stopping spool → faster race boot **and** cleaner capture budgets for peel workers.  
   Product rule: **one hot path at a time** (race *or* dense peel soak).

5. **Shared data model**  
   Both emit JSONL events with `t`, machine, peak, mode.  
   Future: one `capture_session` bus — WebGrid run id + glyph session id + plant key.

6. **Product SKU split (from debate)**  
   - **Thin:** bug-sized mint + glyph tickets (control plane) — like race HUD  
   - **Race instrument:** WebGrid BPS shell (timing calibration)  
   - **Bulk:** fountain QR when contracted / lab soak only  

7. **TV track / cast-align**  
   Pixel grid + vantage is the optical twin of WebGrid cell geometry.  
   Track error (px) maps to module BER the way miss trials map to NTPM.

---

## Race-shell v2 visibility contract

- Page background **not** pure black  
- Neuralink canvas **visible**  
- Metrics: `#mg-race-hud` + LIVE RANK pill  
- Lab (maze/contrail/drawers) still off for BPS  
- Optical dense peel **not** co-resident on same hot path  

---

## WebGrid play ceiling — bottleneck is paint, not CPU

**One-line:** Bottleneck = waiting for the next painted blue (≈60 Hz), not agent sleep or CPU.  
Best runs sit at **~1 clean hit per frame** → why sleep/wait_loops stop helping.

### Best runs (same wall)

| Run | Peak BPS | NTPM | Agent clicks/s | Pace |
|-----|----------|------|----------------|------|
| v35.4 | 588.4 | 3598 | ~59.5 | 1ms / 8 waits |
| v35.6 | 587.4 | 3592 | ~59.3 | 1ms / 8 |
| v35.7 | 588.4 | 3598 | ~59.7 | 1ms / 5 |

Cutting wait_loops 8 → 5 did nothing. MG ~3% CPU → **not compute-bound**.

### Math (30×30)

```
BPS = log₂(30²−1) × NTPM/60 ≈ 9.81 × NTPM/60
```

| Peak BPS | Implies |
|----------|---------|
| **588.4** | 3598 NTPM ≈ **60.0 clean hits/s** |
| 700 | ~71 hits/s |
| 483 | ~49 hits/s |

~60 hits/s ≈ one hit per **16.7 ms** ≈ one **60 Hz** display frame.

### Where time goes each hit

```
find blue (getImageData + scan)
  → fire pointerup
  → wait until canvas blue cell CHANGES   ← dominant
  → repeat
```

| Stage | Cost | Limiting? |
|-------|------|-----------|
| sleep(1) | 1 ms | No — already floor |
| wait_loops 5–8 | few ms polls | No — 5 vs 8 same BPS |
| getImageData full canvas | GPU/CPU readback | Secondary |
| 30×30 cell scan | cheap + early-exit | No |
| **Wait for next blue after paint** | ~1 display frame | **YES** |
| Neuralink hit handling + next target | page/rAF | **YES (coupled)** |

You must wait for blue to move before the next click. That update only appears after WebKit composites a new frame. **Faster JS polling cannot invent a new blue sooner than paint + game logic allow.**

Why broken “faster” modes fail:

- `sleep(0)` → paint starvation → 1 click  
- Chain-click → multi-fire / bad hits → ~162 BPS  
- Faster wait → still ~588  

### Ranked bottlenecks

1. **Hard ceiling:** ~60 Hz paint / game tick — peak BPS tracks one successful hit per frame, not agent skill  
2. **Serial protocol:** click → wait for new blue (correct for scoring; caps at blue spawn rate)  
3. canvas.getImageData full frame — costly but not what pins 60/s (CPU idle)  
4. Chrome / floats / GPU bar — small tax; stripped in race-shell  
5. **Not** the bottleneck: M4 CPU, sleep_ms, wait_loops (current range), maze (off)  

### What might go faster (harder work)

| Idea | Why | Risk |
|------|-----|------|
| Sub-rect getImageData near last cell | less readback | small gain |
| Don’t wait full paint — predictive next cell | break 60 Hz coupling | misses / NTPM collapse |
| Native click_at IPC only | less JS overhead | dual-fire pain (tried) |
| Smaller grid 12×12 | different N, different BPS scale | not “faster 30×30” |
| Quieter compositor | marginal | already ~3% CPU |

**Honest take:** for 30×30 WebGrid in WKWebView, **~588 BPS is the real-time paint/game ceiling**, not a tuning bug. Further “faster” in JS is mostly rearranging deck chairs under a ~16.7 ms frame gate.

### Coupling to glyph / optical

Same honesty as the debate ladder:

| Instrument | Ceiling language |
|------------|------------------|
| WebGrid race | **~1 hit / display frame** at 30×30 |
| Glyph 13×13 | **~21 B/frame × composite fps** (raw) — not Decimen propped rates |
| Loopback smoke | hop ms, not glass BER |
| Optical peel soak | only when race is **idle** (one hot path) |

WebGrid calibrates **how fast a capture loop can honestly tick under paint** — the template for race-shell-shaped glyph engines.

---

## Offline webgrid-ugrad (go-ugrad pattern) — break the paint gate

**Why:** Neuralink WebGrid peak ~588 BPS is **their paint/game ownership**, not agent skill.  
**Fix:** Own tick + state offline (same family as [go-ugrad](https://mueee.qbitos.ai/go-ugrad.html)).

### What go-ugrad already is

| Piece | Role |
|-------|------|
| Local rules engine | Capture, suicide, board 9/13/19 — all in-page |
| Click → state | Intersection click, no remote game server |
| 3×3 tensor slice | Same shape as ugrad-r0 / Datasets.goboard |
| Train station | `GoUgrad.runTrain(env, steps)` · postMessage · BroadcastChannel |
| Multi-tab | ugrad-go-board broadcast/follow · monitor grid |
| Tensor lane | Shared 9-cell bus (`ugrad-tensor-lane`) |
| Envs | go-board, chess-density, checkers, pong, xor… |

Offline-capable: HTML + JS + localStorage + BroadcastChannel. No Neuralink dependency.

### Neuralink WebGrid vs offline ours

| | Neuralink WebGrid (online) | Offline ugrad-style clone |
|--|---------------------------|---------------------------|
| Who owns the frame | Their canvas + paint clock | **You** (rAF / sim tick) |
| Hit loop | pointerup → wait for their blue paint | click → **instant state update** |
| Ceiling measured | ~60 hits/s ≈ 60 Hz → ~588 BPS | **sim-step limited**, not display-limited |
| Read path | getImageData full canvas | Direct grid array / cell index |
| Agent API | Scrape + reverse-engineer | `agentStep()`, `spawnTarget()`, score |
| Train | Side channel only | First-class tensor env + MLP head |
| Honesty | Agent ≠ implant (must label) | Lab instrument — still label, no third-party scrape |

### What offline accomplishes

1. **Break ~60 Hz hit ceiling (lab BPS)** — hit → clear → place next → score same JS turn; measure sim BPS / render BPS / agent BPS  
2. **Same instrument as Go, different physics** — `runTrain('webgrid-chase')` · 9-cell neighborhood · Broadcast race  
3. **Controlled experiments** — variable N, seeds, spawn policy, record/replay, headless soak  
4. **Bridge glyph capture** — same bus shape as peel: frame clock → act → score → JSONL  
5. **Does not replace** — Neuralink marketing/clinical claims; their official leaderboard  

### Built artifact

```text
experiments/memory-glass/pwa/webgrid-ugrad.html
```

Serve:

```bash
cd experiments/memory-glass/pwa
python3 -m http.server 8787
# open http://127.0.0.1:8787/webgrid-ugrad.html
```

| Feature | |
|---------|--|
| Rules | spawn blue, hit, miss, duration, BPS = log₂(N²−1)×NTPM/60 |
| N | 12×12 / 30×30 |
| Tick modes | **sim** (no paint wait) · **render** · **rAF-paced** |
| API | `window.WebgridUgrad.agentStep() \| runAgent() \| getState() \| clickCell(i)` |
| BroadcastChannel | `ugrad-webgrid-race` · `ugrad-tensor-lane` (9-cell) |
| MG race-shell | Point at `http://127.0.0.1:8787/webgrid-ugrad.html` — no Neuralink |

**First-week unlocks:** prove hits/s ≫ 60 in sim · fair A/B pace · tensor train on same clicks · multi-monitor fleet seats.

### Bottom line

| Question | Answer |
|----------|--------|
| Can offline based on go-ugrad accomplish more? | **Yes** — ownership of tick + state |
| What mainly? | Uncap 60 Hz paint wall, full agent/train API, deterministic lab, tensor lane shared with Go/chess |
| What stays the same? | Honesty labels; public Neuralink score is a different category |
| Best next build | `webgrid-ugrad.html` twin (done lean MVP) → race-shell points at it → remeasure |

---

## ARC Prize / prize world — how this fits (and what it is not)

**Leaderboard:** [arcprize.org/leaderboard](https://arcprize.org/leaderboard)  
**Problem class:** ARC-AGI-1/2 = passive grid rule induction (train pairs → exact test grids, pass@2).  
**ARC-AGI-3:** interactive agents adapting to novel environments (on-the-fly).  
**Prize framing:** accuracy **and** efficiency (cost/task, compute budget; Kaggle-style systems under strict $ limits).

### Category map

| Our surface | ARC Prize relation |
|-------------|-------------------|
| **Neuralink WebGrid BPS ~588** | **Not ARC.** Motor timing / paint-bound click instrument. Public reference only (agent ≠ implant). |
| **Lite Arena / webgrid-ugrad sim** | **Not ARC score.** Lab frame-clock + agent API; proves paint ownership; trains control loops. |
| **go-ugrad tensor lane** | **Adjacent tooling.** Small env + MLP head pattern useful for *search policies*, not a substitute for ARC task solvers. |
| **Glyph / Decimen optical peel** | **Not ARC.** Air-gap bits / plant sidechannel; different product SKU. |
| **Debate multi-agent seats (:8765)** | **Process**, not a submission. Orchestration / honesty / hot-path rules. |
| **Possible ARC path** | Use offline envs + race-shell discipline to build **sample-efficient, budgeted** solvers that emit exact grids on private/semi-private eval — then submit under prize rules. |

### What transfers (honest)

1. **Efficiency culture** — ARC leaderboard cares about cost/task; race-shell “one hot path / strip chrome / visible score” is the same instinct as “don’t burn $200/task for +1%.”  
2. **Owned eval loops** — Offline webgrid-ugrad / go-ugrad teach: don’t let a third party own your frame clock. ARC private sets similarly: you can’t scrape the answer; you need a general method.  
3. **Exact-match discipline** — ARC scores binary exact grids. Glyph BER / NTPM are continuous proxies for *instrument quality*, not ARC points.  
4. **Interactive ARC-AGI-3** — Closer cousin to race-shell / Lite Arena agents than to passive LLM grid dumps: adapt online, limited steps, environment owns dynamics.  
5. **Multi-env tensor bus** — go / chess / webgrid-chase as **curriculum for search & representation**, not as “we solved ARC because BPS is high.”

### What does **not** transfer

| Claim | Status |
|-------|--------|
| High WebGrid BPS ⇒ ARC leaderboard rank | **False** — different task, different scoring |
| Offline sim hits/s ≫ 60 ⇒ AGI progress bar | **False** — only uncaps lab motor timing |
| Optical glyph rates ⇒ ARC prize eligibility | **False** — wrong domain |
| Debate seats alone as a submission | **False** — need code + eval harness + writeup |

### Prize-world product split (recommended)

```
┌─────────────────────┬──────────────────────────────────────────┐
│ SKU                 │ Role in prize world                      │
├─────────────────────┼──────────────────────────────────────────┤
│ Race instrument     │ Calibrate agent loop / efficiency habit  │
│ Offline envs        │ Train + A/B without third-party paint    │
│ ARC solver harness  │ Actual ARC-AGI-1/2/3 submissions         │
│ Optical / glyph     │ Separate product (broadcast sidechannel) │
│ Leaderboard honesty │ Never mix BPS, BER, and ARC %            │
└─────────────────────┴──────────────────────────────────────────┘
```

**Bottom line for prize world:**  
WebGrid × glyph architecture is **infrastructure for building and disciplining agents** (owned tick, thin control plane, JSONL audit, multi-env train).  
**ARC Prize points** only come from **exact task solve rates on held-out ARC sets under budget** — a separate submission path that can *use* this infrastructure, not a rebrand of 588 BPS.

### Both terminals agree (operating law)

| Call | Motion |
|------|--------|
| **PASS** | Lab frame-clock (webgrid-ugrad / Lite Arena) for glyph + agent dev |
| **PASS** | ARC-AGI-3 interactive = closest prize cousin to race-shell agents |
| **FAIL** | Leaderboard conflation (BPS · BER · ARC %) |
| **FAIL** | Co-run dense peel + race (one hot path) |
| **FAIL** | Submit WebGrid BPS / glyph rates as ARC progress |

**Two offline pages (don’t merge):** webgrid-ugrad = paint-ceiling lab · Lite Arena = multi-game dual-AI gym · ARC harness = only prize path (not built) · glyph peel = parallel product.

**If prize-bound:** thin `{observe, act, reset, log}` seat → ARC-AGI-3 SDK adapter — no Neuralink BPS in the score.

---

## Concurrent topology (Grok dev)

| Seat | Role |
|------|------|
| **Browser A** | Memory Glass race-shell → neuralink WebGrid |
| **Browser B** | `http://127.0.0.1:8765/#debate` optical multi-agent debate |
| **Terminal 1** | Grok / orchestrator |
| **Terminal 2** | `webgrid-collector.py` :9880 |
| **Terminal 3** | research site `:8765` (this debate) |
| **Optional** | optical mix/metrics — **only when race is idle** |

Perf samples: `~/.panda/mg-soak/watch/perf-race.jsonl` · `topology.json`  
Debate corpus: `~/.panda/vision/cast/paper/site/`

---

## Lite Arena · offline remake (no floats)

**Page:** `experiments/memory-glass/pwa/lite-arena.html`  
**Served:** `http://127.0.0.1:8765/lite-arena.html` (copy in debate site)  
**API:** `window.LiteArena` · BPS formula parity · BroadcastChannel

### Why offline

Neuralink WebGrid caps ~**1 hit/display frame (~588 BPS)**. Lite Arena owns the tick: **sim-tick** can uncap that wall for lab tests.

### Built-in layout (no float window handling)

| Region | Contents |
|--------|----------|
| Top bar | Mode tabs · Start · Agent · Clock pause · BC status |
| Stage | WebGrid canvas · Go SVG · Chess board · Glyph arch text |
| Side (always) | Score HUD · Chess/Go clocks · Dual AI seats · BC · Event log |

**No MG race-shell floats required** for offline tests — disclosure is the side panel.

### Modes

| Mode | Features |
|------|----------|
| **WebGrid** | N=12/30 · 70s · BPS = log₂(N²−1)×NTPM/60 · agent · sim-tick |
| **Go** | 9/13/19 · capture · suicide block · clocks · Engine A/B |
| **Chess** | Lite rules · clocks · Engine A/B · auto dual turns |
| **Glyph / 4K** | Product architecture for stenography + layering |

### Clocks (chess / go level)

- Main time **per side** (min/side input)  
- Active side burns; **pause freezes both** (broadcast-friendly)  
- Reset without clearing board position  

### Dual AI seats → kbatch.ugrad.ai

| Seat | Channel |
|------|---------|
| Engine A / B | `random` · `greedy` · `remote` · `human` |
| Auto dual turns | alternates sides every ~350 ms |
| Remote proposals | BroadcastChannel `ugrad-lite-engine` `{ type:'propose-move', game, move, engine }` |

Path: dual-engine adjudication on Go/Chess → same pattern for **rubik-language math** multi-face state on kbatch.ugrad.ai.

### BroadcastChannel

| Name | Payload |
|------|---------|
| `ugrad-lite-arena` | full state snapshots (go/chess/webgrid) |
| `ugrad-webgrid-race` | score ticks (MG race-shell compatible shape) |
| `ugrad-lite-engine` | dual AI move proposals |

### BPS parity

```
BPS = log2(N*N-1) * NTPM / 60
NTPM = net hits in last 60s (+1 hit, -1 miss)
```

Same as Neuralink public formula; offline is **lab instrument ≠ implant**.

---

## 4K TV glyph stenography · live layering

| Layer | Role | Profile notes | Hot path? |
|-------|------|---------------|-----------|
| 0 Program / plate | 4K picture | RGB full/limited · Rec.709 / 2020 · optional HDR PQ | always |
| 1 Free-mask / chroma | talent holdout | green/magenta key · alpha premultiplied matte | peel soak |
| 2 Glyph 13×13 | thin tickets / steno | high-contrast modules · control plane B/frame | control |
| 3 Fountain QR | bulk Decimen-class | soak only · never co-resident with race | soak only |
| 4 Disclosure HUD | score / consent | race-HUD-shaped · always visible | always |

**Stenography use cases**

1. Session / plant tickets in glyph (control plane)  
2. Steno budget stream → language plane (kbatch.ugrad.ai)  
3. Rubik-language multi-face state encoded over glyph frames  
4. Dual-engine (A vs B) adjudication logged JSONL (Lite Arena pattern)  

**Honesty:** raw glyph B/frame × composite fps ≠ Decimen propped Mb/s; loopback ≠ glass-to-glass BER.

---

## See also

- `docs/MG-RACE-SHELL.md`  
- `docs/WEBGRID-GLYPH-CAPTURE.md` (this file)  
- `pwa/lite-arena.html` · offline lab  
- `http://127.0.0.1:8765/#wg-glyph` · `#debate` · `#tv-track`  
- `http://127.0.0.1:8765/lite-arena.html`  
- `~/.panda/vision/cast/glyph-broadcast-dataset/`  
- cast-align · house vantage · mix-regions (pixel track)  
- [go-ugrad](https://mueee.qbitos.ai/go-ugrad.html) pattern source  

## DINOv3 · live dense pixel estimation (glyph)

Meta [DINOv3](https://ai.meta.com/research/publications/dinov3/) / [facebookresearch/dinov3](https://github.com/facebookresearch/dinov3):
self-supervised dense visual features · Gram anchoring for stable patch maps · scalable ViT suite.

**Arena lab** (`ugrad-arena.html` · mode `glyph`):
- Live cam / file / synth glyph → **patch grid** dense scores (variance + Sobel)
- **Gram proxy** on patch means (stability cue; not full Gram anchoring train)
- Heat map for peel tickets · BC `ugrad-glyph-dense`
- Optional full model: set `window.__dinoInfer = (imageData) => ({ heat: Float32Array })` after loading ONNX/weights

Honesty: browser path is a **dense estimation scaffold** for glyph peel timing/layout; production DINOv3 runs offline (Python/torch) or via future ONNX inject — not claimed as full foundation weights in WKWebView.

## Glyph tools form + quantum video lift

Debate handoff → arena: `data/arena-handoff.json` · form `ugrad/glyph-tools-form.js` · mount on Glyph tab.

```
bash scripts/mg-quantum-video-lift.sh tools
bash scripts/mg-quantum-video-lift.sh lift "https://youtube.com/..."
```

Stack: **yt-dlp → ffmpeg (videotoolbox) → ffplay** · meta `~/.panda/mg-soak/video-feed/last-lift.json` · multiplex BC to rubik / glyph dense / tensor.  
TOOLS drawer: **GLYPH TOOLS** · **Q-LIFT**.  
Honesty: one hot path (race XOR peel); lab BPS ≠ ARC %.

## Glyph tools form + quantum video lift (arena extension)

- **Form:** `pwa/ugrad/glyph-tools-form.js` on `ugrad-arena.html?mode=glyph` (v1.5)
- **Loads doctrine from:** `data/arena-handoff.json` (debate #arena-handoff)
- **BC:** `ugrad-glyph-tools` · `ugrad-glyph-dense`
- **Video lift:** `scripts/mg-quantum-video-lift.sh` — yt-dlp → ffmpeg/ffplay (HW) → qbit envelope → multiplex Rubik/glyph/tensor/Bloch
- **Meta:** `~/.panda/mg-soak/video-feed/last-lift.json`
- **TOOLS drawer:** GLYPH TOOLS · Q-LIFT
- **Honesty:** lift = control plane; peel = dense seat; one hot path; lab BPS ≠ ARC %
