# Qbit Bus · multiagent handoff (spine complete)

**Status:** base spine **LIVE** · dual-clock · queue/backpressure · gutter · defaults · adapters v3  
**Date:** 2026-07-18 overnight cook finish  
**Smoke:** `node experiments/memory-glass/scripts/qbit-smoke.mjs` → **PASS** (hooks non-empty under mocks)

---

## Target architecture (all live)

```
sensors/UI/IPC ─► __mgQbitBus  (envelope: tμ · seq · lane · prefix · payload)
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   IronLine L0–L7   QbitCodec    Tensor / Gutter
   budget + cort    encode/dec   observe · kind:gutter
         │             │             │
         └────── dual-clock loop ────┘
              L3 inner · cortical 24ms L5
                       │
              router defaults + adapters → surfaces
```

| Target | Module | Status |
|--------|--------|--------|
| One bus | `qbit-bus-v2` | **LIVE** · ordered pending + backpressure + sink |
| Clock L3 | `qbit-loop-v2` inner | **LIVE** · μs budget, classify/encode/drain only |
| Clock cortical | loop outer + `ironline-v2.tickCortical` | **LIVE** · ~24 ms L5 schedule only |
| Budget gate | IronLine + router | **LIVE** |
| Encode plane | `qbit-codec.js` | **LIVE** · SYMBOLS frozen |
| Tensor path | adapters → ugrad | **LIVE** on bus |
| Gutter | `kind:"gutter"` dojo + adapters | **LIVE** first-class |
| Router defaults | ironline · inspect ring · cell · gutter | **LIVE** |
| Adapters | `qbit-adapters-v3` | **LIVE** Keys/Staff/Maze/WebGrid/Search/Mesh/GT/MKT/gutter |
| Node hooks proof | `installMocks` + smoke | **LIVE** hooks=[…] non-empty |
| Live MG | ⌘⇧R after sync | **operator verify** |

---

## Modules

| File | Ver | Role |
|------|-----|------|
| `qbit-codec.js` | — | Prefixes · gates · encodeRecord |
| `qbit-bus.js` | v2 | Envelope · ordered queue · backpressure · sink |
| `qbit-loop.js` | v2 | Dual-clock L3 + cortical L5 |
| `qbit-dac.js` | v1 | 8ch intensity |
| `qbit-router.js` | v2 | Routes + **default subscribers** |
| `qbit-adapters.js` | v3 | All surface hooks + gutter + installMocks |
| `ironline.js` | v2 | L0–L7 + tickCortical |
| `kbatch-dojo-bridge.js` | — | Publishes `kind:"gutter"` |
| `scripts/qbit-smoke.mjs` | — | Full spine CI |

---

## APIs

```js
__mgQbitBus.publish({ src, kind, prefix, withGlyph, payload })
__mgQbitBus.drain(n)          // ordered pending
__mgQbitBus.peekPending()
__mgQbitLoop.scheduleL5(fn)   // outer clock only
__mgQbitLoop.classifyAsync / encodeAsync  // L3 only
__mgQbitRouter.ring()
__mgQbitRouter.lastGutter()
__mgQbitAdapters.installMocks()  // offline proof
__mgQbitAdapters.report()        // hooks=[…]
__mgIronline.tickCortical(ms)
```

---

## Inject order (lean)

codec → bus → loop → dac → router → …surfaces… → adapters  
(IronLine earlier in hurdles path; loop calls tickCortical when present.)

Bake: `mg-hotpipe-sync.sh` companions onto codec.

---

## Verify

```bash
cd experiments/memory-glass
node scripts/qbit-smoke.mjs
# expect: PASS · hooks-nonempty · dual-clock · bus-ordered-queue · gutter · backpressure

bash scripts/mg-hotpipe-sync.sh
# MG → ⌘⇧R
# __mgQbitAdapters.report()
# __mgQbitLoop.report()
# __mgQbitBus.report()
# __mgQbitRouter.report()
```

---

## Conflict rule

**Only one agent edits `QbitCodec.SYMBOLS`.** Everyone else publishes envelopes.

---

## Still optional (not blocking “base live”)

- Native Rust `qbit_env` IPC / true sub-μ  
- Full deprecate of every direct `__mgX` cross-call (adapters are additive)  
- Deeper MKT quote stream on bus  
