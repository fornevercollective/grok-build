# P-005 · Offline Ollama full ROI chain

## Why
Wire remaining ROI: LFM2 voice, codestral fix attempts, nomic-embed lore (partially done: brief + pace).

## α
- Map models → jobs (see OVERNIGHT_BROWSER.md)
- Safety: no force-push from codestral loop

## β
1. Soak brief default qwen3 with warm-up note
2. Pace advisor already; fix depends on P-001
3. `scripts/mg-embed-lore.py` — embed ledger + SESSION_HANDOFF + plans into `~/.panda/mg-soak/lore/`
4. Optional `scripts/codestral-fix-once.py` — propose patch file only (human apply)

## γ
- `MG_LOCAL_LLM=1` soak 0.05h produces morning-brief.md
- embed search returns MG-001
- no network required after models warm

## Success
Offline morning brief + lore search + documented codestral human-in-loop.
