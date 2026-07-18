# WebGrid metrics · Intel laptop publish

**When:** 2026-07-18T17:54:55Z  
**Machine:** MacBookPro16,1 · x86_64 · 16 GB · 3072×1920 Retina  
**GPUs:** Intel UHD 630 + AMD Radeon Pro 5500M  

## Session results (truth = sidebar peak, P-001)

| Round | Peak BPS | Peak NTPM | Hits | Miss | Hit rate | N |
|------:|---------:|----------:|-----:|-----:|---------:|--:|
| 1 | 3.76 | 23 | 25 | 7 | 78.1% | 30 |
| 2 | 2.45 | 15 | 16 | 4 | 80.0% | 30 |

**Session best:** **3.76 BPS** / **23 NTPM** · overall hit≈**78.8%**  
**Leaderboard score:** 49.1  

## Older Intel success rate

This MacBook Pro 16,1 (2019 Intel) agent autoplay:

- **Hit rate (agent estimate):** ~**78.8%** (41 hits / 52 attempts)
- **Peak BPS:** 3.76 (far below N1 marketing 10.39 and below a healthy Mini/M-series agent soak if Mini was scoring higher overnight)
- **Round 1 was better** (3.76 BPS) than round 2 (2.45) — thermal / FPS buffer drift likely

### Why contrails miss marks on this machine

1. **WKWebView + Intel UHD**: canvas blue target repaint lags agent `pointerup` (default pace sleep_ms≈4).
2. **Contrail `observeAgent`** paints at click coords immediately; blue cell may already have moved → trail looks off-target even when NTPM still increments.
3. **Watch `blues:0`** is a canvas sample bug under overlay chrome; do not use for hit truth.

### Recommended Intel calibration

```bash
# slower agent pace (fewer ghost misses)
echo '{"sleep_ms":14,"wait_loops":12,"mode":"intel-buffer","source":"manual"}' > ~/.panda/mg-soak/watch/pace.json
# relaunch
cd /Users/qbit/Projects/grok-build/experiments/memory-glass
bash scripts/launch-webgrid-laptop.sh --large --rounds 3
```

Optional: ⌘0 zoom; nearly fullscreen; reduce glass overlays during play.

## Publish locations

- Leaderboard: `/Users/qbit/.panda/packs/mg-activity-leaderboard.json`
- Metrics: `/Users/qbit/.panda/packs/mg-webgrid-metrics-laptop.json`
- Play stream: `/Users/qbit/.panda/mg-soak/watch/play.jsonl`

## X draft (you post)

```
WebGrid laptop bench · MacBookPro16,1 Intel+5500M · 3072×1920
30×30 agent · session best 3.76 BPS / 23 NTPM · hit≈78.8%
R1 3.76 · R2 2.45 BPS
Contrail lag = FPS buffer (pace up sleep_ms on Intel) · vs N1 ref 10.39 marketing
#MemoryGlass #WebGrid #WKWebView
```
