# Memory Glass · X promo media packet

**You post — no auto-post.**  
**Updated:** 2026-07-18 · fleet Mini + laptop metrics · **live captures only**  
**Folder:** `experiments/memory-glass/docs/x-promo-packet/`

## Quick use

1. Attach **2–4** images from **`images/live/`** only (not `ai-mock/`).  
2. Paste **single** or **thread** from `copy/`.  
3. Human review · post from your account.  
4. Optional: open BOARD in Memory Glass for live fleet ranks before posting.

```bash
open experiments/memory-glass/docs/x-promo-packet/images/live
pbcopy < experiments/memory-glass/docs/x-promo-packet/copy/01-single-post.txt
```

## Real screenshots (use these)

### Lab SNAP (Memory Glass chrome + metrics — preferred)

| File | What it is |
|------|------------|
| `live/latest-lab-snap.jpg` | **Newest** SNAP from in-app **SNAP** button / `mg_lab_demo=1` |
| `live/mg-lab-snap-*-*.jpg` | Lab composites: BOARD metrics + Mini/Laptop fleet + floats (not plain WebGrid) |
| `live/10-user-lab-metrics-284bps-macmini.jpg` | User capture · full dual-space lab · **284 BPS Mac mini** |

### WebGrid-only soak (OK as secondary)

| # | File | What it is |
|---|------|------------|
| 1 | `live/01-webgrid-lobby-loaded.png` | Lobby load |
| 2 | `live/03-webgrid-ingame-98bps-30x30.png` | In-game 98.12 BPS |
| 3 | `live/04`–`06` | Play / mid / end |

**Do not post:** `11-plain-webgrid-NOT-for-promo.png` (bare site · no MG metrics)

| `live/12-screen-recording-20260718-lab.mov` | **Your** screen recording · full lab mid-play |
| `live/13-user-lab-midplay-layout.jpg` | Still from that session |

**Recommended carousel:** `latest-lab-snap.jpg` → `10-user-lab-metrics-284bps-macmini.jpg` → `03-webgrid-ingame-98bps-30x30.png`

### How to SNAP again

1. Bottom-left bar: **REC · SNAP · BOARD · POST · X DRAFT**  
2. **FLOATS** (glass tools) opens panels **one-at-a-time** then **tiles** (no stack)  
3. **BOARD** must show fleet Mini + laptop BPS  
4. Hit **SNAP** → writes `~/.panda/mg-soak/watch/snaps/` + `docs/x-promo-packet/images/live/`  
5. Demo auto: `?mg_lab_demo=1` on WebGrid URL  

### Not for posting

`images/ai-mock/` — earlier AI stills. **Do not use** for evidence posts.

### Live board + chrome capture

If you need a frame with **MINI BOARD / floats / glass chrome** visible:

1. Launch: `bash experiments/memory-glass/scripts/launch-webgrid-laptop.sh` (works on Mini too).  
2. Wait for BOARD auto-open (top-right chip if closed).  
3. Capture: `Cmd+Shift+4` or  
   `swift ~/.panda/mg-soak/watch/capture.swift /path/to/out.png`  
4. Drop PNGs into `images/live/`.

> **Note:** Automated `screencapture` from this agent was blocked (Screen Recording not granted to the CLI). Real WebGrid soak frames above are genuine on-host captures from `~/.panda/mg-soak/webgrid/`.

## Fleet leaderboard metrics (real gameplay)

Board now seeds **Mac mini M4** + **MacBookPro16,1** with BPS / NTPM / clicks — not laptop-only composites.

| Seat | Player | Grid | Peak BPS | NTPM | Notes |
|------|--------|------|----------|------|-------|
| **Mac mini M4** | agent | 30×30 | **483.58** | 2957 | soak peak |
| **Mac mini M4** | agent | **12×12** | **402.03** | 3369 | MINI board lane |
| **Mac mini M4** | agent | 30×30 | **98.12** | 600 | live frame `03` |
| **Mac mini M4** | agent | 30×30 | **90.76** | 555 | 3-round session |
| **Mac mini M4** | **human** | 30×30 | **6.38** | 39 | calibration peak |
| MacBookPro16,1 Intel | agent | 30×30 | **3.76** | 23 | laptop bench only |

Laptop 3.76 BPS was previously the only visible board entry. Mini scores are now first-class (lanes: **MINI** / **LAPTOP** / 12×12 / 30×30).

Data files:

- `hotpipe/data/webgrid-fleet-board.json`
- `hotpipe/data/webgrid-bench-macmini-m4.json`
- `hotpipe/data/webgrid-bench-macbookpro16-1.json`

## Copy files

| File | Use |
|------|-----|
| `copy/01-single-post.txt` | One post + media |
| `copy/02-thread.txt` | 4-post thread |
| `copy/03-alt-text.txt` | Accessibility alts for **live** images |
| `copy/04-hashtags.txt` | Optional tags (light touch) |
| `copy/05-reply-bank.txt` | Common replies |

## Honest claims (do not overclaim)

- Educational dual-space lab · **not** a Neuralink implant product  
- Local/fleet leaderboard · human X post  
- Agent BPS ≠ human implant / N1 marketing (10.39 BPS)  
- Open Lab browser: https://fornevercollective.github.io/grok-build/  
- Mini WebGrid board: top-right **MINI BOARD** chip · fleet MINI lane  

## Live score pull (optional)

```js
// In Memory Glass WebGrid console before posting
__mgActivityBoard?.mergeFleetSeed?.()
__mgActivityBoard?.report?.()
__mgActivityBoard?.formatXDraft({ fresh: true })
```

## License / brand

Glass lab chrome is fornever / Memory Glass experiment.  
Do not imply official xAI or Neuralink endorsement.  
WebGrid is a public Neuralink training game URL only.
