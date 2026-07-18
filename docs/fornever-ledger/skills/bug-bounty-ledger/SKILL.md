---
name: bug-bounty-ledger
description: >
  Append-only breakage and bug-bounty notes for fornevercollective / Memory Glass /
  grok-build. Use when something crashes, codesign fails, soak dies, WebGrid scores
  lie, or user mentions bug bounty / ledger. Never delete repos or evidence.
---

# Bug bounty ledger skill

## Paths
- `docs/fornever-ledger/BUG_BOUNTY_LEDGER.md` — master table
- `docs/fornever-ledger/BUG_BOUNTY_NOTES.jsonl` — append-only events
- `docs/fornever-ledger/ECOSYSTEM_MAP.md` — year portfolio map

## On new issue
1. Assign ID `MG-###` / `GB-###` / `PD-###` / `LLM-###`
2. Add row to LEDGER (sev, symptom, root, mitigation, status)
3. Append JSONL line with UTC timestamp
4. Prefer fix + resign + smoke; never delete repos

## Policy
ENUMERATE · LEARN · DOCUMENT. No `rm -rf` on user year-of-dev trees.
