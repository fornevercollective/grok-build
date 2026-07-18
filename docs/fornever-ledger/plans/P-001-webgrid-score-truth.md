# P-001 · WebGrid score scrape truth

## Why
Agent/LLM pace mis-read marketing **10.39 BPS** and **40×40** from page body (MG-006, MG-012). Breaks honest peaks and offline pace digest.

## α Plan done when
- Sidebar-only regex specified (timer · BPS · NTPM · N×N)
- Marketing blocklist documented
- Tests: fixture strings from end card + lobby

## β Build
- Files: `hotpipe/webgrid-play.js` `scrapeScore()`, `scripts/webgrid-pace-advisor.py` digest
- Reject peaks when `phase!=playing` and no timer
- Prefer `sc.grid` from sidebar only

## γ Verify
- Play 12×12 and 30×30 one round each
- `play.jsonl` agent_end never shows N=40 or bps=10.39 as live score
- Append ledger status → mitigated

## Success
Pace advisor digest.N ∈ {12,30}; peak matches sidebar only.
