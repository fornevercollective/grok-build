# Memory Glass browser

**Surface:** [`browser.html`](../browser.html) · **Assets:** [`memory-glass.css`](../assets/memory-glass.css) · [`memory-glass.js`](../assets/memory-glass.js)  
**Native host:** Lab Browser window (tao + wry → WKWebView) · LabX `/api/control`  
**Default:** Memory Glass **on** (toggle **Glass** in chrome; **Full glass** for soft fullscreen aperture)

---

## What we were building

A **Grok / Lab browser** that is still an X-style feed shell (left nav · center timeline · right rail), but no longer a hard black rectangle. Content sits inside a **soft droplet / liquid-glass aperture** floating over a **SpaceX-style blueprint void** — parallax depth, lidar-like point cloud, memory falloff at the edge.

This is **not** a new HTML engine (not Servo / Ladybird). It is the **product chrome + spatial memory surface** around the same WKWebView feed.

---

## SpaceX design approach (what we lean on)

| Principle | In the UI |
|-----------|-----------|
| **Float above the drawing board** | Blueprint grid in perspective under the shell — content is the assembly; floor is the plan |
| **Mission-control telemetry, not consumer black glass alone** | Cyan contrail lines (`#6ecbff`), major grid every 4 cells, live pill as green telemetry |
| **Functional chrome, soft aperture** | Controls stay usable; **edges** bend (mask + caustic + rim sheen) instead of Apple hard rects |
| **Depth without VR headset required** | Parallax layers track pointer; stage translates slightly; full glass widens the aperture |
| **Lineage with the stack** | Same cyan language as Lab orb / voice spheres / SpaceXAI brand assets |

SpaceX product design (public brand + engineering culture we borrow): **show the system**, keep dark technical spaces, prefer precision grids and status over skeuomorphic luxury. We reject pure “iOS liquid glass for its own sake” and reframe glass as **optics over a blueprint** — glass morphism [liquid-glass](https://github.com/samasante/liquid-glass) optics + SpaceX void.

---

## Idea we were leaning on (campfire + memory)

From uvspeed journal **2026-02-16 — “The Day We Found the Campfire”**:

> The project has many apps and zero seconds of silence. The campfire is one view. Dark. Nothing to click. Just the machine breathing.

And the longer thread:

- **Instrument, not player** — the browser preserves *feeling* of focus (fleeting periphery, flutter at the rim) while remaining a working tool  
- **Hard edges are what every browser ships** — Apple wanted/wants hard frames; we push **soft droplet + parallax space** so depth exists without a full VR headset  
- **VR / glasses note** (session): dark cozy private space is good; missing motion/memory glitches at the edge — Memory Glass encodes a *hint* of that as focus veil + flutter, not a gimmick overlay  

Campfire tonality plans (plan-build-dock / `campfire-tonality-voice`) are the **audio** cousin: warm harp, rare speech, ambient first. Memory Glass is the **visual** cousin: ambient depth first, chrome second.

---

## Prior work folded in (uvspeed + 00.dev)

| Source | What we took |
|--------|----------------|
| `journal/00-timesheet.md` | Iron Line L0–L7, R-levels, long-running surface stack — browser is another *surface*, not a greenfield product |
| `journal/01-quantum-prefix-pipeline-plan.md` | DCA “every card = block”; plans as live addressable artifacts — Lab docs + browser as linked memory |
| `journal/02-uvqbit-research.md` | 8-layer pipeline · canvas/WebGPU · spatial delivery · cryostat / campfire already in product language |
| `journal/03-benchmark-results.md` | Speed culture: ns-class classification — shell chrome must stay light (CSS/JS only; no re-analyze on paint) |
| `journal/2026-02-15-nterminal-plan.md` | Cinema + campfire scene + point cloud + reasoning bubbles — lidar dots / point field here is the ambient cousin |
| `journal/2026-02-16.md` | Campfire breath · visual lineage (GMUNK/Tron, IBM cryostat, DEVS gold, Oblivion topo UI) |
| `assets/plan-build-dock/*` | Campfire, cryostat, multi-stream, floating VR keyboard, search-context intelligence — same family of surfaces |
| `chat-corpus.json` | Blueprint + browser + DEVS/tron language recurrence |
| Lab session `5012662` | X-style browser shell + LabX navigate/eval already shipped |

---

## Native Memory Glass (standalone)

**Path:** [`experiments/memory-glass`](../../../experiments/memory-glass) — Rust **tao + wry** droplet browser (not the Lab chrome shell).

```bash
cd experiments/memory-glass
cargo build --release
./build-mac-app.sh          # Dock icon: rust shield + cyan portal
open "Memory Glass.app"
```

Flat page viewport · three tabs · transparent WKWebView shell. See that folder’s `README.md`.

---

## How to run

```bash
# Static dogfood
cd docs/architecture-lab
./serve.sh   # or: python3 -m http.server 8765
open http://127.0.0.1:8765/browser.html

# Native Lab Browser window (product)
cd docs/architecture-lab/native
./launch.sh lab   # then Browser from launch / Lab chrome
```

| Control | Effect |
|---------|--------|
| **Glass** | Toggle Memory Glass (persists `lab.browser.memoryGlass`) |
| **Full glass** | Soft fullscreen aperture + maximize when native (`lab.browser.memoryGlass.full`) |
| `LabMemoryGlass.toggle()` | Console / automation API |

---

## Architecture (DOM)

```
body.memory-glass
├── #mg-void          blueprint + parallax layers + #mg-lidar canvas
└── #mg-stage         soft droplet mask + rim + caustic
    └── #mg-inner
        ├── .xb-chrome
        ├── #xb-shell   (left · center iframe · right rail)
        └── footer search (if present)
```

`memory-glass.js` **rewrites** chrome+shell into this tree on load so classic hard layout still works when glass is off (`body:not(.memory-glass)` resets margin/mask/shadow).

---

## Gaps (honest)

| Want | Have | Gap |
|------|------|-----|
| Standalone internet browser | WKWebView + X shell | No multi-process engine; X may block iframes |
| True liquid optics | CSS mask + backdrop + caustic | Not WebGPU refraction; good enough for Lab |
| Campfire audio in browser | Visual breath only | Optional later: quiet harp on glass toggle |
| Search / camera collab | LabX hooks partial | Chat-camera grow/reorg still roadmap |
| Spatial / VR warped browser | Parallax + veil | Full XR host is separate (ugrad / spatial notes) |

---

## Related lab docs

- [Lab shells · native vs Electron](#/15-lab-shells)  
- [A·B·C path · center + 3 feeds](#/24-abc-path)  
- [SpaceXAI / Grok brand](#/12-brand)  
- [Grok Voice · spheres](#/29-grok-voice-spheres)  
