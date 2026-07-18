# P-009 · WebGrid ↔ stock flip train bridge

## Why
Year of WebGrid agent skill + crossover MACD/BB flip board should share one **trial bus** for live RSI/MACD/Bollinger flip-signal training.

## Mapping

| Unified feature | WebGrid | Flip board |
|-----------------|---------|------------|
| signal_strength | BPS (norm) | \|EV%\| |
| event_rate | NTPM | flip freshness |
| resolution | 12 vs 30 grid | timeframe weight |
| accuracy | hit/(hit+miss) | winRate |
| rsi_proxy | skill conviction | multi-TF MACD align |
| macd_hist_proxy | BPS momentum | hist≠MACD tension |
| bb_width_proxy | cell scale | BB position extremity |

## β shipped
- `scripts/flip-train-bridge.py`
- Outputs `~/.panda/mg-soak/train/{trials,flip_live}.jsonl` + manifest

## γ
```bash
python3 scripts/flip-train-bridge.py
# counts webgrid + flip > 0 when sources exist
```

## Live use
1. Agent plays WebGrid → play.jsonl (truth scrape P-001)
2. Crossover rebuilds rows.json
3. Bridge merges trials → train offline or feed µgrad/ugrad ladder
4. Labels = imminent/actionable flips + high-skill webgrid ends

## Never
- Claim agent BPS is BCI
- Delete crossover/train repos
