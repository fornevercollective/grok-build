# Memory Glass · hard truth · competitive comparison

**Measured:** 2026-07-18 · macOS · MG 0.2.0 build `1784352124`  
**Honesty contract:** no feature-parity claims; numbers where we have them; “could be” only under free overnight sandbox reign.

---

## 1. What we actually are

| Fact | Value |
|------|--------|
| Product | Native **shell** browser (droplet UX + spatial HUD + training loops) |
| Window | **tao 0.31** |
| Web | **wry 0.48** → **WKWebView** (Safari’s engine, not Chromium) |
| Rust surface | ~7.9k LOC `main.rs` + ~13.5k LOC hotpipe JS |
| Release binary | **~1.7 MB** stripped (thin LTO) |
| Observed RSS (main process) | **~100 MB** (one sample; WebKit helpers extra) |
| Hot-pipe inject | live+lens+hurdles+research+ego+iron+ugrad+collab+dock |
| Not | Full browser product · multiproc site isolation · own HTML engine |

**One sentence:** We are a **Rust-hosted WebKit shell** optimized for glass, spatial inspect, hot-pipe, and μgrad/WebGrid training — not a from-scratch browser.

---

## 2. Stack truth table

| Layer | Ours | Safari | Chrome | Firefox | Ladybird | Servo | Electron |
|-------|------|--------|--------|---------|----------|-------|----------|
| **Layout/engine** | WebKit (system) | WebKit | Blink | Gecko | own (LibWeb) | own (Servo) | Blink |
| **Shell language** | Rust (tao/wry) | ObjC/Swift | C++ | C++/Rust | C++/Swift | Rust | C++/JS |
| **Ship binary (shell)** | ~1.7 MB | large app | large | large | large | research | Chromium multi-100MB+ |
| **Process model** | 1 app + WK helpers | multiproc | multiproc | multiproc | multiproc | multiproc | multiproc + Node |
| **Transparent glass** | **first-class** | limited | limited | limited | n/a | n/a | possible, heavy |
| **Hot reload HUD** | **~1s hot-pipe** | n/a | extensions | extensions | n/a | n/a | HMR if configured |
| **Spatial face/hands** | **inspect instrument** | no | no | no | no | no | DIY |
| **WebGrid/μgrad training** | **first-class hooks** | no | no | no | no | no | DIY |
| **Cross-platform** | macOS-first | Apple | yes | yes | growing | research | yes |
| **Standards completeness** | = Safari (WK) | full Safari | full Chrome | full FF | incomplete | incomplete | = Chrome |
| **Extension ecosystem** | none | limited | huge | huge | none | none | npm |

### Honest wins
1. **Shell weight** — 1.7 MB Rust bin vs Electron/Chromium app bundles.  
2. **Glass UX** — soft Drop lip, dual inspect, PAGE/CINEMA/DEPTH.  
3. **Iteration** — hot-pipe without cargo for paint/track.  
4. **Training identity** — WebGrid BPS + μgrad R0–R6 + ironline budgets.  
5. **Same engine as Safari** — site compatibility ≈ Safari, not a new engine risk.

### Honest losses
1. **Not multiproc isolation** — H7 is a *map*, not Chrome-grade site sandboxing.  
2. **No engine ownership** — we cannot fix WebKit bugs or beat Chrome on V8-only sites.  
3. **No Windows/Linux product path yet.**  
4. **No extensions / sync / password manager product.**  
5. **Inspect track depends on still-pipe + JS** — not Metal-native vision.  
6. **H6 “sub-16ms”** is adaptive path, not a hard real-time guarantee.  
7. **Ladybird/Servo** own the “pure Rust/from-scratch engine” story; we do not.

---

## 3. Peer-by-peer (blunt)

### vs Safari
| | |
|--|--|
| **Engine** | Same family (WKWebView). Compatibility ~parity on web content. |
| **We win** | Glass shell, spatial inspect, hot-pipe, phone still-pipe, training loops. |
| **They win** | Ship quality, multiproc, privacy stack, OS integration depth, users. |
| **Could be** | “Safari-glass lab browser” — never “Safari replacement.” |

### vs Chrome
| | |
|--|--|
| **Engine** | Different (Blink vs WebKit). Some sites prefer Chrome. |
| **We win** | Process tax, droplet UX, agent/inspect loop. |
| **They win** | Everything ecosystem (extensions, DevTools, enterprise, speed on some JS). |
| **Could be** | Niche pro spatial/agent browser — not market share fight. |

### vs Firefox
| | |
|--|--|
| **Learn from** | Multiprocess, privacy UX, Rust in engine components. |
| **We win** | Glass + training + simpler shell. |
| **They win** | Cross browser maturity, cross-platform. |

### vs Ladybird
| | |
|--|--|
| **Philosophy** | They rebuild the web; we host WebKit. |
| **They win** | Long-term engine independence, purity. |
| **We win** | Ship today on real sites (SpaceX, etc.), glass UX, training. |
| **Could be** | Optional Servo/Ladybird *experiment* pane in 12–24 months — not default. |

### vs Servo
| | |
|--|--|
| Research layout engine. | Great embed candidate *later* if embed story stabilizes. |
| Today: too incomplete for cool-test reading. | Stay WK. |

### vs Electron / Chromium shells (Arc-like, etc.)
| | |
|--|--|
| **We win hard** | Binary size, no Node, no second Chromium. |
| **They win** | Cross desktop app ergonomics, packaging, cross-platform. |
| **Anti-goal** | Becoming Electron “for speed of features.” |

---

## 4. Measured floor (this machine · one sample)

| Metric | Memory Glass | Safari (main) | Notes |
|--------|--------------|---------------|--------|
| Shell RSS | ~101 MB | ~316 MB main | Not apples-to-apples; WK helpers both sides |
| Binary on disk | 1.7 MB | multi-100 MB app | We embed zero WebKit |
| Tabs at boot | 3 (spacex/starship/launches) | user | |
| Hot-pipe inject | logged on launch | n/a | |

**Do not claim** “10× lighter than Safari” — helpers and GPU processes dominate real browsing.

**Do claim** “Rust shell is ~1.7 MB and hosts system WebKit without Chromium.”

---

## 5. If sandboxed free reign overnight (continuous test)

Assume: isolated Mini or CI Mac · no production data · camera optional · network allowed to local + allowlisted URLs.

### Night 0 — Soak harness (must)
| Job | Duration | Pass criteria |
|-----|----------|---------------|
| Launch / kill loop | 8h | no zombie processes; clean exit 100% |
| Hot-pipe mtime inject | 8h | inject succeeds; no JS exception storm |
| Still-server uptime | 8h | /health ok; live.jpg age bound when fed |
| H6 EMA log | 8h | p50 ≤16ms inspect path when idle; p95 logged |
| Memory growth | 8h | RSS slope &lt; X MB/h (set baseline Night 0) |
| Soft Drop mask | periodic | screenshot diff / no hard cookie-cutter regression |

### Night 1 — Web content compatibility (WK truth)
| Suite | URLs | Pass |
|-------|------|------|
| Cool-test | spacex, starship, launches, x.ai | paint + scroll + no crash |
| Media | YouTube theater/fullscreen | cinema CSS path; no thrash |
| WebGL | simple three.js sandbox | no black frame death |
| Auth/cookie | accounts.google.com (login page only) | load, no hang |

### Night 2 — Spatial / training
| Job | Pass |
|-----|------|
| Still-pipe synthetic JPEG pump | spool lag p95 |
| H1 soak synthetic hands | greenMs accrual when forced |
| WebGrid BPS meter | train mode scores monotonic with scripted clicks |
| Ironline L5 vs H6 | correlation log |

### Night 3 — Collab / multi-agent
| Job | Pass |
|-----|------|
| 2–4 MG seats mg-mesh | presence peer count stable |
| share photo/link/reply | conversation.jsonl integrity |
| pack → Grok pointer | file written; no shell crash |

### Night 4 — Adversarial / stress
| Job | Pass |
|-----|------|
| Rapid tab open/close | no IPC deadlock |
| 1000 hot-pipe injects | no leak |
| Pathological pages (huge DOM) | graceful degrade; H6 quality drop |
| Kill still-server mid-flight | inspect degrades, shell lives |

### Night 5+ — Competitive benchmarking (honest)
| Bench | Against | Metric |
|-------|---------|--------|
| Cold start to first paint | Safari same URL | ms |
| JS Speedometer-class | Safari/Chrome | **expect ≈Safari, lose to Chrome sometimes** |
| Memory after 50 tabs | Safari | process count + RSS |
| Glass-only UX score | human rubric | Drop lip, inspect lag |

**Overnight “free reign” ceiling (realistic 1–2 weeks of nights):**
- Hard numbers for RSS slope, inject failure rate, H6 distributions  
- Compatibility denylist/allowlist for cool-test  
- Automated screenshot regression for Drop soft lip  
- Competitive dashboard: *not* “we beat Chrome,” but “WK parity ±ε + glass suite 100% green”

**What free reign still cannot buy overnight:**
- Multiproc site isolation product  
- Own engine  
- Chrome extension store  
- Ladybird completeness  

---

## 6. Where it could be (12-month vectors)

| Vector | Investment | Outcome if free reign |
|--------|------------|------------------------|
| **A. Best-in-class WK glass shell** | continuous soak + UX | Pro spatial/agent browser people choose over Safari for *this* work |
| **B. True multiproc (H7 product)** | wry/tao multi-webview + OS sandboxes | Closer to FF/Chrome isolation story |
| **C. Servo/Ladybird side engine** | research embed | Demo pane; not default cool-test |
| **D. Cross-platform** | wry Linux/Windows | Fleet Mini + laptop parity |
| **E. Training OS** | WebGrid + μgrad + ego online | Unique wedge no browser has |

**Recommended north-star under free reign:** **A + E**, with **B** as safety, **C** as research, **D** when macOS is boringly solid.

---

## 7. Scoreboard (self-rate 0–10)

| Dimension | Score | Note |
|-----------|-------|------|
| Shell lightness | **9** | 1.7 MB Rust; system WK |
| Web compatibility | **7** | = Safari, not Chrome |
| Glass / spatial UX | **8** | unique; still rough edges |
| Security isolation | **4** | H7 scaffold ≠ product multiproc |
| Cross-platform | **2** | macOS-first |
| Ecosystem | **1** | no extensions |
| Iteration speed (dev) | **9** | hot-pipe |
| Training / agent loop | **8** | WebGrid/μgrad/collab hooks |
| Production polish | **5** | lab-grade, not consumer |
| **Overall product maturity** | **5.5** | strong experiment · not a Safari replacement |

---

## 8. Hard push checklist (execute next)

See `scripts/overnight-soak.sh` and `plans/OVERNIGHT_SANDBOX.md`.

1. Continuous launch/health/hot-pipe soak logging to `~/.panda/mg-soak/`  
2. Screenshot Drop at 40/70/94 for soft-lip regression  
3. H6 EMA time series  
4. Competitive first-paint vs Safari (same URL, `osascript` open)  
5. Weekly scoreboard refresh in this file  

---

*Last measured samples are single-shot. Overnight soak is the only way to turn claims into distributions.*
