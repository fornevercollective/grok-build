# Iron Line · cortical loop · qbit codec

Sources: μgrad R0 ironline (`ironline` command), [mueee ugrad-r0](https://mueee.qbitos.ai/ugrad-r0.html), local `qbit-codec.js`.

## Pipeline L0→L7

| L | Name | Apps / concept | Budget (target) | Channel |
|---|------|----------------|-----------------|---------|
| L0 | Super Speed | qbit-raw, μgrad, steno | ~1.3ms boot · ns–μs classify | hexterm |
| L1 | Terminal + Search | HexTerm, search | 100μs local · ~270ms HTTP | iron-line |
| L2 | Commander | agent dispatch | ~100ms AI · 1ms corpus | hexterm |
| L3 | Quantum | quantum-gutter, qbit codec | 0.1μs gate · 50μs classify | quantum-loopback |
| L4 | Notepad | kbatch, packs | 2ms classify | kbatch-training |
| L5 | Render | 60fps glass HUD | **16ms** | hexcast / H6 |
| L6 | Research | medical / freya / R1 | 5ms-class | research |
| L7 | Persona | history, voice, security | ~5ms | persona proxy |

## Cortical loop (24ms body ecosystem)

```
[ sensors: cam · mic · pointer · still-pipe ]
        ↓
   L7 persona proxy (voice / agent intent)
        ↓
   L3 qbit codec (prefix · steno · concept tokens)
        ↓
   L6 research / ego taxonomy
        ↓
   L5 render (soft Drop · lens breathe · inspect)
        ↓
   device / user
        ↓
   L0 ingest → (repeat)
```

**Neuralink-shaped, not Neuralink-wired:** measure control bandwidth in **bits/sec** (WebGrid), close the loop in software on Mini/MBP.

## Qbit codec (concept load)

- **11 quantum-prefixed symbols** → gates + categories (shebang…variable)  
- **Steno whitespace** layer for dense encoding  
- File: `hotpipe/concepts/qbit-codec.js` → `window.QbitCodec` when loaded  
- Ironline hooks classify short agent strings / contrails for provenance

## Runtime API (`ironline.js`)

```js
window.__mgIronline = {
  layers: [...],           // L0–L7 status
  tick(layer, ms),         // record sample
  budgetOk(layer),         // within target?
  corticalMs: 24,          // target round-trip
  qbit: null | QbitCodec,
  report(),                // strip text
};
```

## Speed rules

1. Never block PAGE paint on L6/L7 work.  
2. Ironline samples are EMA, inspect-only by default.  
3. Qbit codec optional — load when CAL/IRON tab open.  
4. Cortical 24ms is a **training target**, not a hard RTOS guarantee.
