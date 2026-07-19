# OS flight path · kick ass through the rest

**Updated:** 2026-07-19  
**North star:** Neuralink-speed IronLine · native sub-μ path · Grokpool truss · Dojo→Colossus · core-race climb · human-gated monetize  
**Peer lane:** fleet catalogue + term-snap + chrome (no bulk moves overnight)  
**This lane:** velocity — native · truss · terminals · race

---

## One picture

```
                    FLEET CATALOGUE (map only — peer)
                    FLEET.md · AWESOME · catalogue.json
                              │ seats / paths
                              ▼
┌──────────── agents / Grok / panda / dormant ────────────┐
│  claim · handoff · persona · term-snap FIX packets      │
└──────────────────────────┬──────────────────────────────┘
                           │ __mgQbitTruss
                           ▼
              __mgQbitBus  (envelope · IronLine every hop)
                    │                │
         ┌──────────┼────────┐       │
         ▼          ▼        ▼       ▼
    L3 loop    L5 cortical  codec   native qbit_env (μs)
         │                           main ↔ inspect
         ▼
    adapters → MG drawers · kbatch · WebGrid · MKT
         │
         ▼
    L1 TERMINAL PLANE  ←── hexterm / uterm / nterminal / grok-cli / habitat
         (speak envelopes; do NOT become a second OS)
         │
         ▼
    core-race · dojo · Colossus-shaped work graph
```

---

## What is already true

| Layer | State |
|-------|--------|
| Spine bus/loop/router/adapters/gutter | smoke **PASS** |
| Leap foundation native+truss | smoke **PASS** · cargo check **OK** |
| qbitOS disk | ~544 Gi free after model cleanup |
| Fleet catalogue | 135 entries · **map first**, no thrash moves |
| term-snap | local fix packets → Grok |
| Rust/Tauri terminals | **many starts, none is the OS** — become L1 clients |

---

## The next big hurdle (name it)

### **H1 — Live native velocity (this week)**

**Goal:** Running Memory Glass binary speaks `qbit_env` with `nativeTμ`; truss climb + native report in real panes.

| Step | Do |
|------|-----|
| 1 | `cargo build --release` in memory-glass |
| 2 | resign / install to `~/Applications/Memory Glass.app` |
| 3 | ⌘⇧R · `__mgQbitNative.report()` · `__mgQbitTruss.climb()` |
| 4 | Gate press / chat → inspect sees remote envelope |

**Done when:** main↔inspect envelopes carry `nativeTμ` without BroadcastChannel.

### **H2 — Fleet seats on the truss (days)**

**Goal:** catalogue.json is the **seat registry** for claims (not a filesystem reorg).

| Step | Do |
|------|-----|
| 1 | Truss loads catalogue paths (MG, kbatch, uvspeed, overview, …) |
| 2 | `claim({ product: "memory-glass" })` resolves canonical path |
| 3 | Handoff writes `~/.panda/lab-handoff.json` |
| 4 | Peer keeps catalogue scan; we only **read** |

**Done when:** overnight agent can claim `kbatch` or `memory-glass` without path thrash.

### **H3 — L1 terminal plane (not a new terminal product)**

**Goal:** One contract so old Rust/web terminals stop forking reality.

**In flight path (existing trees):**

| Tree | Role in OS |
|------|------------|
| **uvspeed** hexterm / uterm / nterminal / steno-term | L0–L1 speed surface · already qbit-prefixed plans |
| **quantum-fox** terminals | experimental UI · feed bus, don’t own alphabet |
| **grok-cli** | agent chat surface · emit truss handoffs |
| **qbit-habitat** | habitat shell · optional seat |
| **MG `__mgGrokTerm`** | in-app bridge · already |
| **panda-shell** | multi-pane αβγ · already |

**Contract (`__mgQbitTerm` / L1):**

```js
// any terminal implements:
{ open(), write(line), report(),
  publishBus({ kind, text }),   // → classify/encode on L3
  onEnvelope(env) }             // optional subscribe
```

**Rule:** Terminals are **adapters**, same as Keys/Staff. Alphabet stays `QbitCodec.SYMBOLS` only.

**Done when:** hexterm or uterm (pick one pilot) can `publishBus` a line and IronLine L1 ticks. ✅

**Pilot wire (2026-07-19):** `uterm.html` → `BroadcastChannel('mg-qbit-term')` + opener postMessage;  
`qbit-l1-pilot-v2` listens BC + iron-line + kbatch-gutter → bus. Smoke: `l1-pilot-selfTest` · `l1-uterm-ingest`.  
Desk: `/uterm` · `__mgQbitL1Pilot.openUterm()` · type a line in uterm → bus.

### **H4 — Dormant Colossus loop** ✅

**Goal:** Machines that would sleep still climb.

| Step | Do |
|------|-----|
| 1 | ✅ `~/.panda/mg-soak/truss-jobs.jsonl` |
| 2 | ✅ `scripts/qbit-dormant-worker.mjs` |
| 3 | Persona + monetize **flag only** (human gate) |
| 4 | Race climb events when budgets green (optional) |

**Done when:** overnight job file drains without MG UI focused. ✅ smoke/drained

### **H5 — Core-race SITREP** ✅ live meters + open

**Goal:** MG metrics → race language (pkt / Q / DAC / gates) toward [qbit-core-race](https://mueee.qbitos.ai/qbit-core-race.html).

| Step | Do |
|------|-----|
| 1 | ✅ `qbit-race-sitrep-v2` · IronLine + bus + DAC → SITREP |
| 2 | ✅ Desk `/sitrep` `/race` · TOOLS→Qbit→SITREP · top chip |
| 3 | ✅ Mesh `qbit-sitrep` presence · dblclick chip → core-race `?pkt=&Q=&DAC=…` |

---

## What we will not do (keeps speed)

| Don’t | Why |
|-------|-----|
| Bulk-move `~/dev` or rename active projects overnight | Breaks peer + paths (phase-2 archive **done** with symlinks) |
| Rewrite all terminals into one mega-crate now | Years of partial work; **adapter contract** wins first |
| Fake ns RTOS in WKWebView | Lie; use native thread later |
| Silent auto-monetize | Human gate forever |
| Full soak while `/Users` tight | Log thrash |

---

## Kick-ass order (execute this)

```
DONE    H1–H5 foundation (native · seats · L1 pilot · dormant · SITREP)
DONE    Node desk dual-claim + /peer + /sitrep (qbit-smoke PASS 2026-07-19)
DONE    Cube v6 grid-trails · harvest audio-staff / glyph / pynote manifests
DONE    H6 L1 multi-seat + hexterm pilot (l1-v3 · nterminal mgPublishLine · desk /hexterm /presence)
DONE    term-snap symlink ROOT fix (annotate.html resolve via ~/bin)
DESK    LIVE human: open MG → ⌘⇧R → DESK · /presence · /hexterm · /sitrep
NEXT    Peer join /claim kbatch · tsnap chrome · no SYMBOLS thrash
SIDE    Optional: beat_grid_seed → keyboard-beats preset · glyph table JSON
LATER   Rust qbit_loop thread + WASM codec (true sub-μ path)
LATER   MKT stocks human-gated only
```

### Morning 60s (merged fleet + leap)

```bash
open /Volumes/qbitOS/FLEET.md
cd /Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass
node scripts/qbit-smoke.mjs
# after rebuild:
# __mgQbitNative.report(); __mgQbitTruss.report(); __mgQbitTruss.climb("morning")
```

### Chrome glitch → fix now (term-snap)

Peer-shipped local tool (not cloud):

```bash
source ~/.bashrc   # aliases: tsnap tfix tinbox
tsnap              # region → pins → Ship
# in Grok: Ctrl+V (annotated PNG) + paste FIX text
# or: tfix
bash scripts/term-snap-to-truss.sh   # print FIX + truss claim/handoff one-liners
```

Inbox: `~/.panda/term-annotate/inbox/` · code: `/Volumes/qbitOS/00.dev/scripts/term-annotate/`

---

## Role split (stable)

| Who | Owns |
|-----|------|
| **Leap lane (this)** | native IPC · truss · terminal L1 contract · dormant · race |
| **Peer / fleet** | catalogue · FLEET.md · term-snap · chrome · kbatch site |
| **Both** | one alphabet · no SYMBOLS fork · no bulk thrash |

---

## Success metric (honest)

You can **point three agents at dormant machines**, they **claim different catalogue seats**, **handoff on the bus**, **IronLine stays green**, and a climb event points at **core-race** — without inventing a second OS or reorganizing 200 Gi overnight.
