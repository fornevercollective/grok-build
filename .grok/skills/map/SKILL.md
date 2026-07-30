---
name: map
description: >
  Open fornevercollective maptrace inside Grok or pop it out externally.
  Use when the user says /map, /maptrace, starbase, Boca Chica, SBX, SpaceX base Texas,
  trace map, world map, traceroute map, hop map, geomap, pop out map, or wants geospatial
  hops next to /watch and /clock. Covers in-Grok ASCII map modal (fc-maptrace-v1) and
  first-class pop-out (maptrace TUI/web or traceroute fallback) matching /watch and /timesync.
---

# /map · maptrace skill (fornevercollective)

Feature id: **`fc-maptrace-v1`**. Same product class as **`/watch`** (pop-out) and **`/clock`** (`/timesync`).

## Prefer in-Grok first

Real Terminal only (agent non-TTY cannot open the modal):

```bash
cd ~/Projects/grok-build
bash scripts/launch-map.sh
# then:
/map starbase          # SBX pin + spacex.com
/map spacex.com
/map 1.1.1.1
```

### Place aliases (honest)

| Alias | Network host | Pin |
|-------|--------------|-----|
| `starbase` / `sbx` / `boca chica` / `spacex-texas` | `spacex.com` | **X** SBX 25.997°N 97.157°W |

Public edge is **Cloudflare CDN** — not a physical path to Boca Chica. HUD shows that honesty line.

### Keys

Esc · **o** pop-out · **w** web · t target · r re-trace · c/h cities/hops

## Pop-out

```text
/map popout spacex.com
/map popout starbase
bash scripts/launch-map.sh popout spacex.com
```

If maptrace `sqlite3` native arch ≠ Node arch (arm64 module under x86_64 Node), pop-out
**hard-fails to system traceroute** in Terminal — no silent crash.

## Companion

```bash
# A: Zulu stamp for map HUD
bash scripts/launch-timesync.sh   # /timesync
# B: map
bash scripts/launch-map.sh --auto spacex.com
```

Ledger: `docs/fornever-ledger/MAPTRACE-MODAL.md`
