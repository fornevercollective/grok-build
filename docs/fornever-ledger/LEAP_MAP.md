# Memory Glass · LEAP MAP (P-010 rounded)

**Differentiator (explicit):** not more generic tabs, not auto-trading, **not Dia/Comet**.  
**Product = agent + vision + train bus + dual-space solve + collab-day mesh + filterable market filmstrip + Lark/GT + video under-hood + quantum/school cells — one glass surface.**  
**Growth brief:** `experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md`

## Surfaces (collapsible rails + inspect dock tabs)

| Surface | Hotpipe | API | Role |
|---------|---------|-----|------|
| **MKT** | `market-filmstrip.js` | `window.__mgMarket` | Filmstrip + iron-condor WebGrid · RH∪X · stable window |
| **VID** | `video-feed-panel.js` | `window.__mgVideo` | Streaming feed · blank/gy/ffplay/yt-dlp/ffmpeg |
| **LARK** | `lark-governance.js` | `window.__mgLark` | Governance tree · unix/epoch/hops/ip · policies |
| **QBIT** | `quantum-webgrid.js` | `window.__mgQuantum` | Bloch gate filmstrip · periodic capsules · school |
| Dock | `inspect-dock.js` v3 | `window.__mgDock` | PIPE…MESH + MKT/VID/LARK/QBIT actions |

## Data spine (live)

```
RH watchlists ∪ X cashtags
        → build_flip_board (Yahoo MACD/BB)
        → ~/.panda/mg-soak/flip-board-live/rows.json
        → export-filmstrip-board.py → filmstrip.json
        → flip-train-bridge → trials.jsonl
        → train-trial-bus → model.json
        → soak-morning-brief (stamp-first)
```

Scripts:

- `scripts/refresh-flip-board-live.sh`
- `scripts/harvest_x_cashtags.py` + `seeds/x-cashtags-seed.txt`
- `scripts/export-filmstrip-board.py`
- `scripts/flip-train-bridge.py` / `train-trial-bus.py`
- `scripts/mg-video-feed.sh` (VID under-hood)
- `scripts/soak-morning-brief.py` (train + REFRESH_STAMP first)

## Iron condor WebGrid (concept → code)

- **Stabilized window:** BB-width proxy in band → only score when market not thrashing.
- **Rails:** long put / short put / short call / long call from close ± width×k (options chain later).
- **Hit/miss:** same skill grammar as Neuralink WebGrid (timing under noise).
- **Trials:** `localStorage mg.filmstrip.trials` + bridge domain `flip_condor`.

## Video feed (stolen patterns, owned surface)

Sources scanned:

- `docs/architecture-lab/assets/video-feed.js` (yt-dlp · ffmpeg · ffplay · blank · gy)
- GrokYtalkY `stream-binary.md` / `grokbuild-glyph-pins.md`
- grok-cli feed icons / video stage
- youtube-pipeline-viewer + lark-live

MG owns: collapsible left **VID** rail + `mg-video-feed.sh` for agent/shell.

## Lark governance (stolen patterns, owned surface)

Sources scanned:

- `qbit-FLEET/.../10_governance-tree.{json,md,html}`
- uvspeed Lark OS / glyph subdomain plans
- mu.eee / uvspeed `glyph.html`
- archive/lark design system

MG owns: bottom-right **LARK** rail — unix/epoch/hops/ip + layer tree + fleet policies (no auto-trade, resign, secrets).

## Quantum / school (stolen patterns, owned surface)

Sources scanned:

- `fornevercollective/composer` (bloch-lab, bloch-viewer)
- IBM Quantum Composer metaphor
- mueee.qbitos.ai/uvqbit.html (needs concept align — now QBIT capsules)
- ugrad ants `grokGrad*.html`, kbatch.ugrad.ai
- ECharts matrix-periodic-table metaphor

MG owns: **QBIT** rail — Bloch canvas + gate filmstrip + periodic capsules.

## Patterns stolen from public grok-build ecosystem (plugins only — no mass-merge)

| Source | Steal | Not steal |
|--------|-------|-----------|
| josepha-mayo/oh-my-grok-build | browser MCP, research CLI, swarm/cron ideas | rebrand / mobile fork wholesale |
| vshulcz/deja-vu | session memory layer ideas | replace MG vision bus |
| phuryn/grok-build-vscode | desk GUI optional | core glass |
| 1parado/grok-build-switch | multi-vendor model switch for soak | identity |
| architecture-lab video-feed | media tool chain | lab-only URL hardcodes as product |
| qbit-FLEET governance tree | layer model | Mistral-only narrative |

See `docs/fornever-ledger/PATTERN_STEAL.md`.

## Project inventory (missed concepts folded in)

| Project | Folded into LEAP |
|---------|------------------|
| ugrad / ants / grokGrad* | school capsules, μgrad ladder already in dock |
| qbitos-iron-line | IRON budgets (existing) + iron condor name bridge |
| qbitos-quantum-prefixes / composer | QBIT + qbit codec |
| youtube-pipeline-viewer / lark-live | VID + LARK naming |
| GrokYtalkY (MacBookPro volume) | blank/gy/ffplay, glyph pins, gyst streams |
| flip / crossover / robinhood-agentic | market data spine |
| KBatch-dictionary | kbatch capsule links |
| uvspeed Lark plans | governance web control surface |
| architecture-lab video-feed | VID implementation pattern |
| fornevercollective/composer | Bloch lab links |

## Git posture

- **origin:** 0/0 when LEAP commits land
- **upstream xai-org:** ~63 product commits ahead; 3 monorepo syncs behind; **unrelated roots** — cherry-pick crates only, never clobber `experiments/`

## Safety

- No auto-trading.
- No secret commits.
- Resign Memory Glass.app after native/hotpipe ship (`scripts/resign-app.sh`).
- Never delete RH/crossover/train repos; backup rows before overwrite.

## KBatch bridge (2026-07-18+)

- **Handoff (live):** https://kbatch.ugrad.ai/handoff/MEMORY-GLASS-KBATCH.md  
- **FN honor-seed:** 15 Indigenous educational packs; green–amber chips; opt-in / community-first (not bulk open).  
- **Accreditation:** knowledge · workforce · government · certified · first-nations · terminal-independence · security-literacy.  
- **mueee terminal independence:** https://mueee.qbitos.ai/terminal.html  
- **Playclear chrome:** main-only keyboard/capsule/flow; trail last-80; strain kinematics.

### Safety addenda
- FN / Indigenous: honor-seed only — community gate; no mass scrape.  
- Security literacy: defensive only — no exploits / attack PoCs.
