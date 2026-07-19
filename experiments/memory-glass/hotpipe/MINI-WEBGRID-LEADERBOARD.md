# Mini WebGrid leaderboard · findable + fleet metrics

## UI

- Top-right chip: **MINI BOARD** (12×12) or **BOARD** (30×30)
- Auto-opens on WebGrid hosts after ~700 ms
- Lanes: **ALL** · **12×12** · **30×30** · **MINI** (Mac mini seat) · **LAPTOP**

## Metrics shown (not composite-only)

Each row surfaces:

- machine label (Mac mini M4 / MacBook Pro 16 Intel)
- player (agent / human)
- peak **BPS** · **NTPM** · grid · clicks
- composite score (ordering) as secondary

## Fleet seed (ships in hotpipe)

| id | seat | BPS |
|----|------|-----|
| fleet-mini-agent-30-peak | Mac mini M4 | 483.58 |
| fleet-mini-agent-12-peak | Mac mini M4 | 402.03 |
| fleet-mini-agent-30-live98 | Mac mini M4 | 98.12 |
| fleet-mini-agent-3rounds | Mac mini M4 | 90.76 |
| fleet-mini-human-30 | Mac mini M4 human | 6.38 |
| fleet-laptop-agent-30 | MacBookPro16,1 | 3.76 |

If you still only see ~3.76 / mid-session laptop-ish values:

1. Reload WebGrid in Memory Glass (hotpipe v5 injects seed on boot)  
2. Or BOARD → CLEAR, then reload (fleet seed re-merges)  
3. Console: `__mgActivityBoard.mergeFleetSeed(); __mgActivityBoard.report()`

## Files

- `hotpipe/activity-leaderboard.js` · VER `activity-board-v5-fleet-machine`
- `hotpipe/data/webgrid-fleet-board.json`
- `hotpipe/data/webgrid-bench-macmini-m4.json`
- `hotpipe/data/webgrid-bench-macbookpro16-1.json`
