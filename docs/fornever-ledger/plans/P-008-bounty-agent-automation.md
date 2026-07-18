# P-008 · Bug bounty agent automation

## Why
Year of breakage knowledge must stay machine-usable for agents (ledger skill).

## α
- Schema for BUG_BOUNTY_NOTES.jsonl
- Triggers: crash in soak, codesign fail, agent_end anomaly

## β
- `scripts/ledger-append.sh` helper
- Soak end: scan for crash kinds → auto draft MG-### if new
- Morning brief references open P0/P1 plans

## γ
- Synthetic crash line produces JSONL + brief mention
- No deletes

## Success
Agents default to ledger before inventing architecture.
