# Keyboard · Language · Jam Plane

**Status:** `float-kb-v4-lang-jam`  
**Role:** Standalone input + BCI training plane · Neuralink hit-target geometry · kbatch R4 cross-lang · qbpm jam studio seed

---

## Launch (hit the ground · live now)

| How | Action |
|-----|--------|
| Control Center | **Keyboard** → type · **Codec** → HEX encode demo |
| URL | `?mg_kb=1` · `?mg_kb=codec` · `?mg_kb=jam` · `?mg_kb=ddr` · `?mg_kb=braille` |
| API | `__mgFloatKb.launch({ mode:"codec", codec:"glyph", text:"…" })` |

**Encode:** CODEC → ASCII/HEX/BIN/PCAP/QGUT/STENO/GLYPH/QBIT → **RUN→** (clipboard)  
**Decode:** **←DEC** round-trips last output into buffer  
**ALL:** every codec view at once  

**Always-on inject order:** `qbit-codec.js` → `lang-codec-plane.js` → `keyboard-atlas-seed.js` → `float-keyboard.js`  

Atlas pack: `data/keyboard-language-atlas.json` (26 R4-aligned layouts + kbatch 15-layout ids).

---

## Why this plane exists

Grok (and most AI) is still **content**.  
You cannot yet **conduct** live collaboration of music, conversation, and body tracking as one craft.

**qbpm** was the conversation about a **future jam studio**.  
The Memory Glass keyboard + staff/notation + path geometry make the browser **live / breathe / create** — with a path to **xAI voices**, live iteration, and patient-safe large targets.

| Today | Near | Product mark |
|-------|------|----------------|
| Multi-layout keyboard + path trail | xAI voice on note/path | Neuralink patients type + train |
| Beats staff + maze rain | Full jam studio bus | SpaceX / TerraFab edge chips run the plane |
| kbatch ANALYZE + dojo | 32-lang live shadows | Cross-language BCI literacy |
| DDR mode | Full rhythm therapy | Clinical + consumer training |
| Braille 6-dot | Full BRF I/O | Accessibility first-class |

---

## Combined narrative (updated)

> **Memory Glass** is a native living craft: high-FPS WebGrid training on WKWebView, **kbatch R4-data** (32-lang dictionary/schools/typing, axes ≥ 0.75) under it, and a **keyboard/language/jam plane** so humans — including Neuralink patients — can type, pattern-flow, Braille, rhythm-train, and jam with notation that the browser lives and breathes.  
> **Play → BPS · type → path/analyze · jam → staff · books/dojo** is one loop — content AI is not enough; **live control of collaboration** is the mark.

---

## Modes

| Mode | Purpose |
|------|---------|
| **TYPE** | Large-target QWERTY-family / world layouts · inject · send · clipboard |
| **FLOW** | Path geometry for pattern-flow / contrail / kbatch blank-bridge analysis |
| **DDR** | Rhythm hit-targets (Dance Dance Revolution spirit) for BCI timing training |
| **BR8** | Braille 6-dot cell → Unicode Braille Patterns |
| **JAM** | Arms beats staff + `qbpm-live` bus — future jam studio / xAI voices |
| **CODEC** | Powerhouse transforms — see below |

## Codec powerhouse (`lang-codec-plane.js` + `concepts/qbit-codec.js`)

| Codec | Output |
|-------|--------|
| **ASCII** | Decimal codes + printable map |
| **HEX** | UTF-8 hex dump |
| **BIN** | Grouped binary |
| **PCAP** | Conceptual packet record (training UI — not wire capture) |
| **QGUT** | Quantum gutter 11-symbol stream (beyondBINARY gates) |
| **STENO** | StenoSTRIP 13 Unicode spaces (kbatch whitespace channel) |
| **GLYPH** | GrokYtalkY / `gyg1` 13×13 glyph grid + binary + steno-carry |
| **QBIT** | Full `QbitCodec` when loaded · else qbit-lite prefixes |

API: `window.__mgLangCodec.transform(text, format)` · `.allViews(text)` · `.invert(display, format)`  
Keyboard: mode **CODEC** → pick format → **RUN→** (copies display to clipboard).

## Layouts (seed)

`qwerty` `azerty` `qwertz` `dvorak` `colemak` `ru` `el` `he` `ar` `braille`  

Cross-lang target tags align with R4 analyzed plane (32 + en).  
ANALYZE opens `kbatch.ugrad.ai` with `layout` + `lang` + path payload.

---

## Standalone vs embedded

| Form | How |
|------|-----|
| **Embedded plane** | CTRL → Keyboard · or `?mg_lab_full=1` |
| **API** | `window.__mgFloatKb` · `.setLayout` `.setMode` `.standalone.press(ch)` |
| **Patient / maker standalone** | Same JS can mount without full lab kit; large hit targets; no auto-ghosts in product mode |
| **Chip / edge (vision)** | TerraFab / SpaceX-class devices run the **same plane** as local instrument, not a Chromium skin |

---

## Bridges

| System | Link |
|--------|------|
| Beats / staff / piano | `onKey` → notation live |
| Maze rain | `ingestKey` |
| Contrail | `observeAgent` on key path |
| Bloch | `onKeyHop` |
| kbatch dojo | ANALYZE / phrase run |
| Mesh chat | SEND can push search-comms chat |
| qbpm-live | JAM mode BroadcastChannel |

---

## Neuralink · SpaceX · TerraFab product mark

**Hypothesis:** patients and operators need a **browser that is an instrument**, not a document viewer.

1. **Large hit targets** (already Neuralink-style)  
2. **Timing training** (DDR + WebGrid BPS)  
3. **Language access** (R4 + Braille + RTL)  
4. **Path → shadow analysis** (kbatch geometry)  
5. **Jam / voice future** (staff now, xAI voices next)  
6. **Fleet instances** — same keyboard plane on edge chips worldwide  

This is not “a keyboard widget.”  
It is the **human I/O plane** of the living craft.
