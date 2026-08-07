# Memory Glass · Race Shell

**Fast boot · one page · no bells/whistles.**  
Agent WebGrid surface only — built to unhobble click cadence (Boris Cherny: delete harness tax).

## Why

| Layer | Full MG | Race shell |
|-------|---------|------------|
| Inject | live + drawers + maze + cal + … | `race-shell.js` + `webgrid-play.js` |
| Lab floats | optional / default theater | **hard off** |
| Pace | intel/fast | **turbo** (`sleep_ms: 1`) |
| Boot | multi-module hotpipe | **two blobs** |
| Goal | living craft / dual-space | **max robust BPS** |

## Launch

```bash
cd experiments/memory-glass
bash scripts/launch-webgrid-race-shell.sh
# or
MG_HOTPIPE_LEAN=race-shell MG_RACE_SHELL=1 \
  "$HOME/Applications/Memory Glass.app/Contents/MacOS/memory-glass" \
  'https://neuralink.com/webgrid/?mg_autoplay=1&mg_pace=turbo&mg_race=1&mg_lab_full=0'
```

Env:

| Var | Value |
|-----|--------|
| `MG_HOTPIPE_LEAN` | `race-shell` · `race` · `pure` · `bare` |
| `MG_RACE_SHELL` | `1` |
| `MG_LAB_FULL` | `0` |

## Concurrent topology (monitor)

| Seat | Role |
|------|------|
| **Browser A** | Memory Glass race-shell → neuralink WebGrid **or** offline `webgrid-ugrad` |
| **Browser A′** | `http://127.0.0.1:8787/webgrid-ugrad.html` — break paint ceiling (lab) |
| **Browser B** | `http://127.0.0.1:8765/#wg-glyph` optical multi-agent debate (research) |
| **Terminal 1** | Grok / orchestrator |
| **Terminal 2** | `webgrid-collector.py` :9880 + optional optical mix |
| **Terminal 3** | `python -m http.server 8765` research site · `8787` pwa (webgrid-ugrad) |

### Offline race target (recommended next)

```bash
cd experiments/memory-glass/pwa && python3 -m http.server 8787
# race-shell / browser → http://127.0.0.1:8787/webgrid-ugrad.html
# Tick mode "sim" + Run agent → expect hits/s ≫ 60 (paint was the wall)
```

See `docs/WEBGRID-GLYPH-CAPTURE.md` § Offline webgrid-ugrad.

Perf samples: `~/.panda/mg-soak/watch/perf-race.jsonl` · `topology.json`

## Skills this shell does **not** include (by design)

ARC-AGI-3 / Arena / optical fleet skills belong in **background agents** (8765, ugrad, kbatch), not in the race path:

- Interactive world-model exploration (ARC-AGI-3)
- Multi-agent orchestration / long-horizon loops (Claude Code style)
- Optical peel / fountain QR (8765 AI Fleet seat)
- Vision / coding / search arenas (arena.ai skill axes)
- Heap snapshots for JS runtimes (Bun `v8.writeHeapSnapshot` pattern — apply to side services, not WK race loop)

Race shell is the **timing instrument**. The craft grows beside it.

## Paint ceiling (measured)

Best race-shell runs cluster at **~588 BPS / ~3600 NTPM / ~60 hits/s** (v35.4–v35.7).  
That is **one clean hit per 60 Hz frame**, not a CPU or `sleep_ms` limit (MG ~3% CPU; wait_loops 5 vs 8 unchanged).

```
BPS ≈ 9.81 × NTPM/60   (30×30)
588.4 BPS ⇒ ~60 hits/s ⇒ ~16.7 ms/hit
```

Dominant stage: **wait for blue cell to change after paint** (WebKit composite + game logic).  
Full write-up: `docs/WEBGRID-GLYPH-CAPTURE.md` § WebGrid play ceiling.

Do **not** burn more cycles on wait_loops under the 16.7 ms gate without a deliberate A/B that accepts miss risk (predictive fire).

## Speed stack · headless / game-dev

See **`docs/SPEED-STACK.md`**.

| Mode | Flag | Look |
|------|------|------|
| Race (default gamedev) | `mg_gamedev=1` | Dark instrument chrome · canvas visible |
| Headless disclosure | `mg_headless=1` | Metrics HUD stays · not a black void |
| **GAMEDEV PURE** | `MG_GAMEDEV=1` · `MG_NO_INSPECT=1` | No inspect side · no drawers · no board thrash |
| Offline L0 | `launch-speed-stack.sh` | zig·bun·uv·ruff·tokio·satori·wasm·repel·tauri + kbatch-live |

```bash
# pure game-dev (recommended for play / clocks — no random menu thrash)
bash scripts/launch-gamedev.sh
bash scripts/launch-gamedev.sh --mode go --clock 10 --inc 2 --turns
bash scripts/launch-gamedev.sh --mode chess --agent
bash scripts/launch-gamedev.sh --online          # Neuralink still pure chrome
bash scripts/launch-speed-stack.sh --gamedev
bash scripts/launch-speed-stack.sh --headless
```

### GAMEDEV PURE rules

| Rule | Detail |
|------|--------|
| No inspect | Native inspect window **hidden** at launch (`MG_NO_INSPECT=1`); ⌘⌥I to show |
| No side menus | race-shell v5 kills tools/right/search/dragon/maze/menu-health |
| No auto-click thrash | Arena **agent OFF** unless `--agent` or `?agent=1` |
| WebGrid rules | BPS = log₂(N²−1)×NTPM/60 · blue rgb(10,132,255) · 70s round |
| /clock turns | Zulu · unix · markets strip + chess/go Fischer clocks |
| Surface | `lite-arena.html` offline · or Neuralink with `--online` |

**Hard rule:** `sleep_ms ≥ 1` (0 starves WK paint). Paint ceiling ~**588 BPS / 60 Hz**.

## Honesty

WebGrid BPS = **synthetic agent**, not Neuralink implant.
