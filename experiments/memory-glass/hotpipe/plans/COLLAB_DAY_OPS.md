# Collab day ops · multi-seat (ready)

**Updated:** 2026-07-19T08:15Z  
**Status:** smoke **PASS** · desk dual-claim **PASS** (node) · live MG still needs human ⌘⇧R

---

## Seats (claimed in verify)

| Seat | Path / URL | Who |
|------|------------|-----|
| memory-glass | `/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass` | Leap |
| kbatch | `/Volumes/qbitOS/00.dev/projects/KBatch-dictionary` | Peer |
| uvspeed | `/Volumes/qbitOS/00.dev/projects/uvspeed` | L1 pilot pool |
| core-race | `https://mueee.qbitos.ai/qbit-core-race.html` | race open |

---

## Leap (this desk) — 90s

```text
open ~/Applications/Memory Glass.app
⌘⇧R
DESK αβγδ open
/persona stream-agent
/claim memory-glass
/qa
/curious
/sitrep
/uterm          # type one line → bus
/peer           # handoff for peer
```

Console:

```js
__mgAgentDesk.report()
__mgQbitNative.report()
__mgQbitTruss.report()
__mgQbitL1Pilot.report && __mgQbitL1Pilot.report()
__mgQbitRace.report && __mgQbitRace.report()
__mgRubikLang.report()   // trails=on
```

---

## Peer join — 90s

```text
1. Read this file + PEER_COLLAB.md + FLEET.md
2. open MG → ⌘⇧R
3. DESK: /claim kbatch
4. Content: living-books · learn · staff · dojo (no SYMBOLS)
5. Chrome glitch → tsnap → paste into either Grok
```

---

## Conflict rules

1. One product claim at a time on hot files  
2. Map first — no bulk reorg  
3. `QbitCodec.SYMBOLS` frozen  
4. Monetize human-gated only  

---

## Done when

- [ ] Both desks open, different claims  
- [ ] `/sitrep` matches SITREP chip  
- [ ] uterm line lands on bus  
- [ ] Peer can `/peer` reverse without thrash  
- [ ] IronLine green in live pane  

Node-side already proved: claim MG + kbatch, handoff, sitrep, rubik v6.
