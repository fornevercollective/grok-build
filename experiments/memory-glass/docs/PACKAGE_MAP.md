# Memory Glass · Package map

**Rule:** If a reviewer asks “what’s core?” — point here.

```
experiments/memory-glass/
├── src/main.rs              # CORE · windows, IPC, inject, menus, filmstrip slim
├── build-mac-app.sh         # CORE · .app bundle
├── Cargo.toml               # CORE · memory-glass-browser 0.3.x
├── hotpipe/
│   ├── product-mode.js      # CORE · lean product profile
│   ├── webgrid-play.js      # CORE · play + fill + metrics scrape
│   ├── activity-leaderboard.js  # CORE · LIVE RANK pill
│   ├── session-recorder.js  # CORE · REC/SNAP (opt-in)
│   ├── float-layout.js      # CORE · pin / no-overlap
│   ├── sx-rail-chrome.js    # CORE · glass tokens + CTRL CSS
│   ├── glass-capsule-shell.js   # CORE · Control Center (legacy)
│   ├── mg-tools-drawer.js   # CORE · LEFT TOOLS · edge peeks (mueee-style)
│   ├── mg-right-drawer.js   # CORE · RIGHT DATA · Live/MKT/Grok/…
│   ├── market-filmstrip.js  # CORE · MKT industry sections · Yahoo/train
│   ├── menu-health-monitor.js # CORE · __mgMenus Grok open/close/exercise
│   ├── mg-calibrate-boot.js # CORE · CAL sequence
│   ├── search-comms.js      # CORE · GO/CHAT/MESH bar
│   ├── float-keyboard.js    # CORE · language/jam plane
│   ├── lang-codec-plane.js  # CORE · ASCII/HEX/BIN/PCAP/gutter/steno/glyph/qbit
│   ├── keyboard-beats.js    # LAB · piano (pop-out only on canvas)
│   ├── lark-governance.js   # LAB · GT tree (IANA+CDN)
│   ├── webgrid-contrail.js  # LAB · path instrument
│   ├── memory-maze-gsplat.js / bloch / rubik / field / raider / geo
│   ├── data/filmstrip-board.json  # MKT seed (~5.7k tickers)
│   └── …
├── docs/
│   ├── PRODUCT.md · PRIVACY.md · PACKAGE_MAP.md · ARCHITECTURE.md
└── scripts/
    ├── mg-smoke.sh          # trust · product surface
    ├── mg-hotpipe-sync.sh   # hot-pipe → app Resources
    └── mg-menu-monitor.sh   # live MENU_HEALTH stream
```

## Inject order (lean / product-relevant)

1. `live.js` (shell HUD)  
2. `webgrid-play.js` (+ contrail / lab when not strict)  
3. chrome tokens → tools drawer → right drawer → MKT → keyboard stack  
4. instruments (LAB — load, **do not auto-open** except LIVE RANK chip)  
5. `float-layout.js`  
6. **`product-mode.js`** then **`menu-health-monitor.js`** last  

## Grok all-buttons scenario

```js
// auto at ~4.5s after inject, or:
window.__mgMenus.exercise({ delayMs: 180 })
window.__mgMenus.probe({ heal: true, emit: true })
// report: MENUS pill · ~/.panda/mg-soak/watch/menu-health.jsonl · launch.log
```

Catalog: tools · data · search · keyboard · board · maze · beats · field ·
raider · bloch · geo · rubik · mkt · grok · solve · dragon (+ optional ctrl).

## Split roadmap (post-0.3)

| Crate / package | Owns |
|-----------------|------|
| `memory-glass-browser` | main.rs only |
| `mg-hotpipe-core` | product-mode, drawers, board, webgrid-play, search, MKT |
| `mg-hotpipe-lab` | maze, bloch, rubik, field, raider, geo, beats |
| `mg-hotpipe-collab` | mesh / day |

Until then: **one crate**, clear map, product mode gate, dual drawers, edge peeks.
