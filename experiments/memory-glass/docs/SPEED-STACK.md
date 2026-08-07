# Speed stack · WebGrid max · headless game-dev

**One hot path.** Offline toolchain ≠ click loop. Paint ceiling ~**588 BPS / 60 Hz**.

## Layers

| Layer | Tools | Role |
|-------|--------|------|
| **L0 offline** | zig · bun · uv · ruff · tokio · satori · wasm · repel · tauri · **kbatch-live (rust)** | Benches, side services, keyboard GEO — **never** in WebGrid hit path |
| **L1 timing instrument** | Memory Glass race-shell + `webgrid-play` | Synthetic agent BPS on Neuralink WebGrid |
| **L2 disclosure** | `#mg-race-hud` · LIVE RANK · `:9880` JSONL | Operator consent (not a black void) |
| **L3 lab** | maze · optical · kbatch dojo | **Off** during race records |

## Hard rules

1. **`sleep_ms ≥ 1`** — `0` starves WK `getImageData`/paint (1-click bug).  
2. **Best runs sit at ~60 hits/s** → one clean hit per 60 Hz frame. More wait_loops or sleep thrash does not beat paint.  
3. **Headless ≠ invisible** — metrics HUD stays; canvas stays; lab chrome off.  
4. **Game-dev style** — dark instrument chrome (`mg_gamedev=1`); canvas still visible.  
5. **Agent BPS ≠ implant.**

## Launch

```bash
# full stack: offline kbatch bench + hyper race (gamedev default)
bash experiments/memory-glass/scripts/launch-speed-stack.sh

# headless disclosure styling
bash experiments/memory-glass/scripts/launch-speed-stack.sh --headless

# offline only
bash experiments/memory-glass/scripts/launch-speed-stack.sh --offline-only

# classic race-shell (also gamedev by default now)
bash experiments/memory-glass/scripts/launch-webgrid-race-shell.sh --gamedev
```

URL flags:

```
?mg_race=1&mg_pace=hyper&mg_lab_full=0&mg_gamedev=1&mg_headless=1
```

## Files

| Path | What |
|------|------|
| `hotpipe/race-shell.js` | v4 speed-stack HUD + gamedev/headless CSS |
| `hotpipe/webgrid-play.js` | sleep clamp ≥1 · hyper lock |
| `scripts/launch-speed-stack.sh` | offline + online launcher |
| `~/.panda/mg-soak/watch/pace.json` | live pace (must sleep≥1) |
| `~/.panda/mg-soak/watch/LATEST-keyboards-instant.json` | kbatch-live rust bench |

## Why not “make WebGrid faster” with Zig/Bun?

Those runtimes speed **side services** (collectors, peel workers, WASM sims).  
WebGrid peak is **paint/composite bound** on the Neuralink canvas inside WKWebView.  
Put Zig/Bun/Tokio on the **fleet seats**, not inside the 16.7 ms hit loop.

## μgrad Arena (unified)

Flagship offline surface: `pwa/ugrad-arena.html` → `:8765/ugrad-arena.html`

| Mode | Role |
|------|------|
| **WebGrid** | Chase lab · model performance · same BPS formula |
| **Go** | go-ugrad look · capture rules · tensor 9-cell |
| **Chess multilayer** | Live board + under-layer multipv trees on every move |
| **Rubik prep** | BC to cube-viewer L0–L7 language solve |

Look: [go-ugrad](https://mueee.qbitos.ai/go-ugrad.html) / [chess-ugrad](https://mueee.qbitos.ai/chess-ugrad.html).  
Chess lab engine: `pwa/ugrad/ugrad-chess-lab.js` (UgradChess).  
Predictive layers: multipv negamax depth 1–3 · ghost PV on board · does not block live play.

```bash
bash scripts/launch-gamedev.sh  # still lite-arena default
# or
open 'http://127.0.0.1:8765/ugrad-arena.html?mode=chess'
```
