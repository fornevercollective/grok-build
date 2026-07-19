# WebGrid bench · Mac mini M4 (Mac16,10)

**Machine:** Mac mini · Apple M4 · 16 GB · arm64 · host `tadericsonsMini`  
**Display:** DELL U2715H 2560×1440 (main)  
**Source:** `~/.panda/mg-soak/watch/play.jsonl` + ANALYSIS + agent-3rounds + live result.json  
**JSON:** `webgrid-bench-macmini-m4.json` · fleet seed `webgrid-fleet-board.json`

## Fleet-facing peaks

| Lane | Player | Grid | Peak BPS | NTPM | Clicks | Provenance |
|------|--------|------|----------|------|--------|------------|
| FULL | agent | 30×30 | **483.58** | 2957 | 3377 | agent-30x30 / play.jsonl |
| MINI | agent | 12×12 | **402.03** | 3369 | 3900 | agent_end N=12 |
| FULL | agent | 30×30 | **98.12** | 600 | 619 | live PNG + result.json |
| FULL | agent | 30×30 | **90.76** | 555 | 625 | agent-3rounds sessionBest |
| FULL | human | 30×30 | **6.38** | 39 | — | ANALYSIS / LEARNINGS |

## Compare · laptop Intel

| Machine | Peak BPS | NTPM | File |
|---------|----------|------|------|
| MacBookPro16,1 | **3.76** | 23 | `webgrid-bench-macbookpro16-1.json` |

Laptop 3.76 was previously the only board-visible seat score. Mini fleet rows are now seeded into `mg.activity.leaderboard.v1` via activity-board-v5.

## Notes

- Agent BPS on large N can be far above human; board labels **player** (`agent` / `human`).  
- N1 marketing 10.39 BPS is clinical implant reference — not agent, not this fleet.  
- Human Mini calibration peak **6.38 BPS** is the honest human bar on this seat.
