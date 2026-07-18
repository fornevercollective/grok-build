# Memory Glass · Package map

**Rule:** If a reviewer asks “what’s core?” — point here.

```
experiments/memory-glass/
├── src/main.rs              # CORE · windows, IPC, inject, menus
├── build-mac-app.sh         # CORE · .app bundle
├── Cargo.toml               # CORE · memory-glass-browser 0.3.x
├── hotpipe/
│   ├── product-mode.js      # CORE · lean product profile
│   ├── webgrid-play.js      # CORE · play + fill + metrics scrape
│   ├── activity-leaderboard.js  # CORE · LIVE RANK pill
│   ├── session-recorder.js  # CORE · REC/SNAP (opt-in)
│   ├── float-layout.js      # CORE · pin / no-overlap
│   ├── sx-rail-chrome.js    # CORE · glass tokens + CTRL CSS
│   ├── glass-capsule-shell.js   # CORE · Control Center
│   ├── search-comms.js      # CORE · GO/CHAT/MESH bar
│   ├── float-keyboard.js    # CORE · language/jam plane (layouts·Braille·DDR·qbpm·codec)
│   ├── lang-codec-plane.js  # CORE · ASCII/HEX/BIN/PCAP/gutter/steno/glyph/qbit
│   ├── concepts/qbit-codec.js # CORE · full .qbit codec (concept on machine)
│   ├── webgrid-contrail.js  # LAB · path instrument
│   ├── memory-maze-gsplat.js    # LAB
│   ├── bloch-solve-bus.js       # LAB
│   ├── rubik-language-float.js  # LAB (WIP closed)
│   ├── sportsfield-bridge.js    # LAB
│   ├── brothernumsey-raider.js  # LAB
│   ├── geo-pattern-float.js     # LAB
│   ├── keyboard-beats.js        # LAB
│   ├── collab.js / collab-day.js # LAB · mesh
│   ├── live.js                  # LAB · spatial mesh HUD
│   └── …
├── docs/
│   ├── PRODUCT.md           # one sentence + roadmap
│   ├── PRIVACY.md
│   ├── PACKAGE_MAP.md       # this file
│   └── v0.3.0-PRODUCT-CHECKLIST.md
└── scripts/
    ├── mg-smoke.sh          # trust · launch smoke
    └── mg-hotpipe-sync.sh   # hot-pipe → app Resources
```

## Inject order (product-relevant)

1. `live.js` (shell HUD — keep lean)  
2. `webgrid-play.js`  
3. chrome: sx-rail → glass-cap → float-kb (optional)  
4. instruments (LAB — load but **do not auto-open**)  
5. `activity-leaderboard.js` + `session-recorder.js`  
6. `float-layout.js`  
7. **`product-mode.js` last** — closes ghosts, asserts lean chrome  

## Split roadmap (post-0.3)

| Crate / package | Owns |
|-----------------|------|
| `memory-glass-browser` | main.rs only |
| `mg-hotpipe-core` | product-mode, layout, board, webgrid-play, search |
| `mg-hotpipe-lab` | maze, bloch, rubik, field, raider, geo, beats |
| `mg-hotpipe-collab` | mesh / day |

Until then: **one crate**, clear map, product mode gate.
