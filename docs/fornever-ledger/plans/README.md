# Panda-loop plan catalog

Run each plan through **panda-loop** (α plan → β build → γ verify).

```bash
bash experiments/memory-glass/scripts/panda-loop.sh next \
  --from plan --to build \
  --summary "P-00X short title" \
  --prompt "Implement plan docs/fornever-ledger/plans/P-00X-….md"
```

| ID | Plan | Priority | Ledger ties |
|----|------|----------|-------------|
| P-001 | WebGrid score scrape truth | P0 | MG-006, MG-012 |
| P-002 | Auto re-sign hotpipe deploy | P0 | MG-001, MG-008 |
| P-003 | Camera single-writer guard | P1 | MG-004, PD-001 |
| P-004 | Glass second-monitor FS soak | P1 | MG-014, MG-002 |
| P-005 | Offline Ollama full ROI chain | P1 | LLM-*, overnight |
| P-006 | Upstream grok-build merge dry-run | P2 | GB-001 |
| P-007 | Panda fleet triple-pane ship | P2 | panda-shell roadmap |
| P-008 | Bug bounty agent automation | P2 | ledger skill |

**Rules:** enumerate · do not delete repos · resign after `.app` edits · append ledger on new breaks.
