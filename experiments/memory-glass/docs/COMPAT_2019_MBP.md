# Memory Glass · 2019 MacBook Pro (Touch Bar) + PWA

## Target hardware

| Class | Notes |
|-------|--------|
| **2019 MBP 13/15/16** (Intel, Touch Bar) | Primary backwards-compat target |
| **Intel Mac ≤12 threads** | Auto `mg-low-power` via `mg-compat.js` |
| **Apple Silicon** | Full product-core by default |

## What “low power” does

1. **`mg-compat.js`** — no heavy `backdrop-filter`, solid chips, hide lab orbs  
2. **Product-core inject** — no maze/rubik/bloch/webgrid until `MG_LAB_FULL=1`  
3. **`MG_LOW_POWER=1`** — also skips `live.js`, sx-rail, menu-health, jump-stack (lightest native path)  
4. **Menu health** — product-core only probes tools/data/search/dragon (no lab FAIL thrash)

## Force modes

```bash
# Lightest native (2019 MBP recommended for lag)
MG_LOW_POWER=1 open -a "Memory Glass" --args "https://www.spacex.com/"

# Or in-page
# ?mg_low=1
# localStorage.setItem('mg.power','low')

# Full lab again
MG_LAB_FULL=1 open -a "Memory Glass"
# ?mg_lab_full=1
```

## Touch Bar

No special Touch Bar API required. Chrome is mouse/trackpad + keyboard. System Touch Bar shows default Safari-like controls if any; MG does not depend on NSTouchBar.

## PWA (phone / homescreen)

See `../pwa/README.md`.

```bash
cd experiments/memory-glass/pwa && python3 -m http.server 8787
# Install: Safari Share → Add to Home Screen
```

Native app remains the real browser; PWA is the **homescreen companion** (chip parity: REC · SNAP · BOARD · **PICK** · DRAW · DESK).

## Chip order (native + PWA)

`REC · SNAP · BOARD · ◎ PICK · ✎ DRAW · DESK αβγδ · POST · X DRAFT`
