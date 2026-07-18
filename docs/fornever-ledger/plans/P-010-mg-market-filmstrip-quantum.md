# P-010 · Memory Glass market filmstrip + quantum Bloch + school capsules + Lark + video

## Status (leap)

| Slice | Status | Artifact |
|-------|--------|----------|
| P-010a filmstrip panel | **landed** | `hotpipe/market-filmstrip.js` |
| P-010b iron condor corridor + lane-hit | **landed** | same · `scoreCondorTrial` |
| P-010c X cashtag force-graph | planned | filter lists ready; graph viz next |
| P-010d kbatch periodic capsules | **landed** | `quantum-webgrid.js` CAPSULES |
| P-010e Bloch/composer WebGrid | **landed** | `quantum-webgrid.js` |
| P-010f video pop-out feed | **landed** | `video-feed-panel.js` + `mg-video-feed.sh` |
| P-010g Lark governance rail | **landed** | `lark-governance.js` |
| Data spine refresh | **landed** | harvest + refresh-flip-board-live + export-filmstrip |

See `docs/fornever-ledger/LEAP_MAP.md`.

## Context
- Fork: `fornevercollective/grok-build` ← `xai-org/grok-build`
- Ahead of upstream: **~63+** product commits under `experiments/` (MG, panda, ledger, train bus, leap rails)
- Behind upstream: **3** monorepo sync commits (pull carefully; do not clobber experiments)
- Live board: RH + X cashtags → Yahoo MACD/BB → `~/.panda/mg-soak/flip-board-live/`
- Train bus: WebGrid skill + flip trials → `~/.panda/mg-soak/train/`

## Product vision (one browser surface)

### A · Market filmstrip (WebGrid scaffolding)
**Not** a generic chart tab — a **stabilized market window** reusing WebGrid training chrome:

| Metaphor | Behavior |
|----------|----------|
| Film strip / FPS timeline | Horizontal strip of symbols; bias color; cursor frame |
| GitHub contribution bar | Density via BB-width / flip recency |
| Stable window | Only score when width proxy in band |
| Iron condor rails | Long/short call/put from BB-proxy |
| Filters | sector · bias · stable · search |

**Glyph layer:** kbatch / GrokYtalkY tokens for bias, squeeze, freshness, wing-touch.

### B · School capsules + quantum
Periodic cells → drill (μgrad, composer, uvqbit, arxiv).  
Bloch game: gates as filmstrip; score = distance to target state.

### C · Video handler (collapsible, under-hood)
Left **VID** rail: URL → OPEN / BLANK / GY / FFPLAY / YT-DLP / PROBE.  
Shell: `scripts/mg-video-feed.sh`. Agent: `window.__mgVideo.*`.

### D · Lark governance (web control surface)
Bottom **LARK** rail: unix · epoch · hops · ip · layer tree · policies.  
Auto feature for “where am I in the stack” on any page.

## What Memory Glass has that Chrome/Safari/Arc don’t

| Built-in | Why others can’t match easily |
|----------|-------------------------------|
| Native glass + multi-monitor reassert | System browser chrome fights transparency/Spaces |
| Still-pipe phone vision / hands HUD | First-class phone→Mac vision bus |
| Offline Ollama soak/train loop | Agent-native local models |
| WebGrid skill bus ↔ flip train | Same features for timing under noise |
| X cashtag → board merge | Social liquidity on RH universe |
| Iron-condor filmstrip | Options geometry as HUD + train targets |
| Streaming video under-hood | ffmpeg/ffplay/yt-dlp/blank/gy without extension store |
| Lark governance tree | unix/epoch/hops/ip control surface |
| Quantum + school cells | Same cell grammar as markets |
| Codesign-aware hotpipe | Ship UI without full browser release |
| Panda α/β/γ + bounty ledger | Research ops in the product tree |

## Safety
- No auto-trading. Research / paper / education only.
- Never delete RH/crossover/train repos. Backup rows before overwrite.
