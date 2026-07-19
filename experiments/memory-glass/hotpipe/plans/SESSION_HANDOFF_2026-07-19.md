# Session handoff · 2026-07-19 (overnight cook → morning)

**UTC:** 2026-07-19T09:26Z  
**Leap session:** `019f78be-e18d-70d3-ad47-a5531bb8eedc` (MG Qbit Bus Sub-μ Multi-Agent Spine)  
**Peer session (example):** `019f6e76-4944-7ec1-96b4-1aa5fb98cc81`  
**Repo:** `/Volumes/qbitOS/00.dev/projects/grok-build` · product: `experiments/memory-glass`  
**App:** `~/Applications/Memory Glass.app` (release build + hotpipe bake)

---

## One-liner

**Qbit spine + leap foundation H1–H5 are green.** Multi-tier Agent Desk lives inside MG. Next is **live human verify** (⌘⇧R → DESK), not more fabric. Monitors that burned Grok coins were **killed**.

---

## Role split

| Lane | Owns | Does not |
|------|------|----------|
| **Leap (this session)** | native IPC · bus/loop/router · truss · L1 pilot · SITREP · Agent Desk · dormant worker | bulk filesystem reorg · kbatch SPA content · Rubik/Bloch chrome thrash |
| **Peer** | FLEET catalogue · disk archive · term-snap · Rubik v6 · Bloch drawer · menu exercise · kbatch content · ugrad-r0 checks | fork `QbitCodec.SYMBOLS` · re-wire uterm (already done) |

**Conflict rule:** only one agent edits `QbitCodec.SYMBOLS`. Everyone else publishes envelopes.

---

## Hurdles (flight path)

| ID | Name | Status | Notes |
|----|------|--------|--------|
| **H1** | Live native (`qbit_env` + release app) | ✅ | `Cmd::QbitEnv` in `main.rs` · binary has `qbit_env` · installed |
| **H2** | Fleet seats on truss | ✅ | `resolveSeat(memory-glass\|kbatch\|uvspeed\|…)` |
| **H3** | L1 uterm → bus | ✅ | `uterm.html` `mgPublishLine` → BC `mg-qbit-term` → L1 pilot v2 |
| **H4** | Dormant worker | ✅ | `scripts/qbit-dormant-worker.mjs` |
| **H5** | Core-race SITREP + chip | ✅ | `qbit-race-sitrep.js` · HUD chip · mesh presence (peer-extended) |
| **Desk** | Multi-tier αβγδ | ✅ | `mg-agent-desk.js` · TOOLS→Qbit→DESK |
| **H6** | Multi-seat L1 + hexterm pilot | ✅ pilot | l1-v3 · nterminal `mgPublishLine` · desk `/hexterm` `/presence` (chip depth still optional) |
| **Later** | Rust qbit_loop thread · WASM codec · true sub-μ | ⬜ | not fake RTOS in WK |

Docs: `plans/OS_FLIGHT_PATH.md` · `plans/QBIT_CORE_RACE_LEAP.md` · `plans/MONTH_COLLAB.md`

---

## Modules shipped (hotpipe)

| File | Ver / role |
|------|------------|
| `qbit-codec.js` | alphabet · encode/decode · **SYMBOLS frozen** |
| `qbit-bus.js` | **v2** ordered queue · backpressure · sink |
| `qbit-loop.js` | **v2** dual-clock L3 + cortical L5 |
| `qbit-dac.js` | 8ch soft intensity |
| `qbit-router.js` | **v2** defaults (iron/inspect/gutter) |
| `qbit-adapters.js` | **v3** A–C + search/mesh/gt/market/gutter + mocks |
| `qbit-native-bridge.js` | IPC mirror · `nativeTμ` |
| `qbit-truss.js` | personas · claims · handoffs · climb · fleet seats |
| `qbit-term-plane.js` | L1 contract `__mgQbitTerm` |
| `qbit-l1-pilot.js` | **v3** BC + multi-seat presence · openUterm/Nterm/Hexterm |
| `qbit-race-sitrep.js` | SITREP pkt/Q/DAC · chip · mesh |
| `mg-agent-desk.js` | **v2** DESK αβγδ · `/hexterm` `/nterm` `/presence` |
| `ironline.js` | **v2** tickCortical |
| `kbatch-dojo-bridge.js` | gutter envelope publish |
| uvspeed `web/uterm.html` | `mgPublishLine` on Enter/paste |

### Scripts

| Path | Role |
|------|------|
| `scripts/qbit-smoke.mjs` | CI spine + leap smoke |
| `scripts/qbit-dormant-worker.mjs` | offline job drain |
| `scripts/term-snap-to-truss.sh` | FIX packet → truss one-liners |
| `scripts/mg-hotpipe-sync.sh` | bake companions onto codec + resign |
| `build-mac-app.sh` | release bundle → ~/Applications |

### Verify commands

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass
node scripts/qbit-smoke.mjs
# expect: qbit-smoke · PASS (incl. l1-uterm-ingest · race-sitrep · desk-sitrep)

open "$HOME/Applications/Memory Glass.app"
# ⌘⇧R
```

```js
__mgQbitBus.report()
__mgQbitLoop.selfTest()
__mgQbitNative.report()
__mgQbitTruss.report()
__mgQbitL1Pilot.report()
__mgQbitRace.report()
__mgAgentDesk.open()
// /sitrep  /curious  /claim kbatch  /uterm  /peer  /qa
```

---

## Architecture (target = live)

```
sensors/UI ─► __mgQbitBus (envelope tμ·seq·lane·prefix·payload)
                 │
    IronLine · QbitCodec · Tensor/Gutter
                 │
         dual-clock: L3 loop + cortical 24ms L5
                 │
    router defaults + adapters + truss + desk
                 │
    native qbit_env (main↔inspect) · L1 pilot · SITREP
```

Envelope kinds in play: `gate|cell|traj|note|chat|term|gutter|sitrep|claim|handoff|race|dac|…`

---

## Peer work this night (do not re-do)

| Ship | Where |
|------|--------|
| Fleet catalogue + FLEET.md | `/Volumes/qbitOS/FLEET.md` · `11_docs/catalogue/` |
| Disk archive Users→qbitOS | `02.backups/users-tref-20260719T0726Z` |
| term-snap | `~/bin/term-snap` · `00.dev/scripts/term-annotate/` |
| Rubik language float **v6** grid-trails | `rubik-language-float.js` |
| Bloch drawer live **v6** | `bloch-solve-bus.js` · TOOLS→Solve→Bloch |
| Menu exercise green | menu-health v13 open-box 18/18 |
| Multi-seat collab notes | `COLLAB_DAY_OPS.md` · `~/.panda/mg-soak/collab-handoff.json` |
| ugrad-r0 / steno checks | mueee live |

---

## Disk (as of handoff write)

| Volume | Free | Note |
|--------|------|------|
| `/Users` Data | ~**94 Gi** (52%) | was critical ~6 Gi; peer archive fixed |
| `qbitOS` | ~**455 Gi** (52%) | models cleaned earlier; backups landed |

**Do not:** full overnight soak without watching free space.  
**Safe free later:** `~/Downloads` leftovers, `~/.lmstudio` unused models, old `~/.grok` sessions (with care).

---

## Background processes

| Process | Coin cost | Action |
|---------|-----------|--------|
| ~~mg-overnight-watch loop~~ | **high** (Grok monitor events) | **KILLED** 2026-07-19 |
| ~~peer session poller~~ | **high** | **KILLED** |
| `still-server.py` | none (local) | optional leave |
| webgrid-collector | none if idle | optional |
| Memory Glass app | none | open for live verify |

---

## Pending (explicit)

1. **LIVE verify (human):** open MG → ⌘⇧R → DESK → `/sitrep` `/curious` `/claim` `/presence` `/hexterm` · confirm chip + native  
2. **Multi-seat collab day** (two Grok + desk dual claim) — ops in `COLLAB_DAY_OPS.md`  
3. **Optional:** richer multi-seat presence on SITREP chip (H6 pilot already has bus presence)  
4. **Optional:** Rubik/Bloch events → bus (like uterm)  
5. **Later:** Rust `qbit_loop` thread · WASM codec · MKT human-gated Monday stocks  

Handoff queue status may still say `build→verify` until someone marks **live verify PASS**.

---

## APIs cheat sheet

```js
__mgQbitBus.publish({ src, kind, lane, prefix, withGlyph, payload })
__mgQbitBus.drain(n) · peekPending() · report()
__mgQbitLoop.scheduleL5(fn) · classifyAsync · encodeAsync · selfTest()
__mgQbitDac.set(ch, level) · pulse · report()
__mgQbitRouter.on(src, kind, fn) · ring() · lastGutter()
__mgQbitTruss.claim({ product, title }) · handoff · climb · openCoreRace · seats()
__mgQbitTerm.register · publishBus · report()
__mgQbitL1Pilot.ingestLine · openUterm · openHexterm · openNterm · publishPresence · seats · report()
__mgQbitRace.snapshot · publish · report()  // chip paints
__mgAgentDesk.open() · run("/sitrep") · run("/presence") · run("/hexterm") · run("/peer")
__mgQbitNative.report()  // after rebuild for true IPC
```

term-snap (chrome bugs):

```bash
source ~/.bashrc
tsnap          # pin → ship
tfix           # last FIX.md
```

---

## Collab files (read first on resume)

| Path | Role |
|------|------|
| **This file** | full session handoff |
| `plans/OS_FLIGHT_PATH.md` | hurdles H1–H5 |
| `plans/MONTH_COLLAB.md` | month + livestream |
| `plans/QBIT_CORE_RACE_LEAP.md` | leap architecture |
| `plans/QBIT_BUS_HANDOFF.md` | bus multiagent contract |
| `~/.panda/mg-soak/PEER_COLLAB.md` | two-terminal protocol |
| `~/.panda/mg-soak/STEER.md` | soft interject |
| `~/.panda/mg-soak/watch/status.md` | live status board |
| `~/.panda/lab-handoff.json` | panda αβγ queue |
| `/Volumes/qbitOS/FLEET.md` | machine map |

---

## Resume checklist (60s)

```bash
# 1 truth
cat /Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass/hotpipe/plans/SESSION_HANDOFF_2026-07-19.md | head -80

# 2 smoke
cd /Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass && node scripts/qbit-smoke.mjs

# 3 live
open "$HOME/Applications/Memory Glass.app"   # ⌘⇧R · DESK · /sitrep

# 4 do NOT restart coin monitors unless needed
# was: mg-overnight-watch + peer poller — killed to stop token burn
```

---

## Session IDs / contact

| Who | ID / path |
|-----|-----------|
| Leap cook | `019f78be-e18d-70d3-ad47-a5531bb8eedc` |
| Peer overnight | `019f6e76-4944-7ec1-96b4-1aa5fb98cc81` |
| Grok sessions root | `~/.grok/sessions/%2FUsers%2Ftref/` |

---

---

## Addendum · peer post-handoff (2026-07-19T09:31Z)

| Item | Note |
|------|------|
| H6 pilot | `qbit-l1-pilot-v3` · nterminal mgPublishLine · desk `/hexterm` `/nterm` `/presence` |
| term-snap | symlink ROOT resolve fixed (`~/bin/term-snap` → real annotate.html) |
| Local residual | dormant worker + webgrid-collector **killed** (still-server left) |
| Coin monitors | stay **off** — do not restart unless needed |
| Smoke | **PASS** incl. `l1-nterm-ingest` · `l1-presence` · `desk-presence` |

*Handoff written for multi-agent resume. Fabric green. Live verify is the gate.*
