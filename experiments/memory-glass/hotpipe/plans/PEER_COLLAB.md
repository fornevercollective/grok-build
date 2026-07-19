# Peer collab · two Grok terminals on one machine

**Updated:** 2026-07-19  
**Story:** Memory Glass is the machine · Agent Desk αβγδ is the multi-tier IDE · truss is multiplayer · peer is map/chrome/kbatch content.

---

## Seats

| Seat | Session (typical) | Owns | Does not |
|------|-------------------|------|----------|
| **Leap** | desk / flight path | native · truss · Agent Desk · dormant · race · L1 pilot | bulk `~/dev` moves · kbatch SPA content thrash |
| **Peer** | fleet / chrome | FLEET · catalogue · term-snap · chrome-stable · kbatch SPA content | `QbitCodec.SYMBOLS` · fake sub-μ · re-scaffold bus |

**Shared alphabet:** one `QbitCodec.SYMBOLS` — never forked.

---

## Join protocol (daily)

### Leap opens

```text
open MG → ⌘⇧R → DESK αβγδ
/persona stream-agent
/claim memory-glass
/qa
/curious
/peer                  # writes handoff for peer
```

### Peer joins

```text
1. Read ~/.panda/lab-handoff.json  (or STEER + status)
2. Read this file + MONTH_COLLAB.md
3. open MG → ⌘⇧R
4. DESK: /claim kbatch   (or leave if leap already claimed)
5. Content: living-books · learn · staff · dojo
6. Chrome glitch: tsnap → paste into either Grok
```

### Handoff file

| Path | Role |
|------|------|
| `~/.panda/lab-handoff.json` | last `/peer` or truss handoff |
| `~/.panda/mg-soak/STEER.md` | soft interject |
| `~/.panda/mg-soak/watch/status.md` | truth board |
| `FLEET.md` | map only |
| `hotpipe/plans/OS_FLIGHT_PATH.md` | H1–H5 |
| `hotpipe/plans/MONTH_COLLAB.md` | 4-week shape |

---

## Agent Desk tiers (both may use; leap owns features)

| Tier | Glyph | Commands (examples) |
|------|-------|---------------------|
| α PLAN | plan | `/claim` · `/persona` · `/peer` |
| β BUILD | build | `/tools` · `/nav` · `/kbatch` · notes |
| γ VERIFY | verify | `/qa` · `/smoke` · `/break` |
| δ EXPLORE | explore | `/curious` · `/race` |

```js
__mgAgentDesk.open()
__mgAgentDesk.run("/claim kbatch")
__mgAgentDesk.run("/peer")
__mgAgentDesk.report()
```

---

## Conflict rules

1. **One product claim at a time** — truss `resolveSeat`; don’t dual-edit the same hot files.  
2. **Map first** — catalogue paths; no overnight bulk reorg.  
3. **Disk** — no full WebGrid soak if free &lt; 10 Gi `/Users` or &lt; 15 Gi qbitOS.  
4. **Monetize** — human-gated only (Monday stocks deliberate).  
5. **term-snap** — either seat; ship FIX packet into Grok, not silent file thrash.

---

## Week roles (month map)

| Week | Leap | Peer |
|------|------|------|
| W1 | Desk live · stream claim→curious | FLEET stable · tsnap ready · kbatch content |
| W2 | uvspeed L1 `publishBus` pilot | chrome QA · staff/keys harvest as needed |
| W3 | core-race SITREP · dormant overnight | living books / learn depth |
| W4 | multi-seat collab day · stocks board | map + chrome + content freeze for demo |

---

## Peer one-liner

We are not a second OS. We are the **map, chrome, and kbatch language plane** so the desk can claim, QA, break, and get curious without thrashing paths.
