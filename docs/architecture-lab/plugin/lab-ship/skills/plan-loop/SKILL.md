---
name: plan-loop
description: >
  Run a structured plan→approve→build loop for ambiguous features.
  Use when the user says /plan-loop, wants plan mode discipline, or is
  starting a multi-file architectural change. Triggers: plan mode, plan-loop,
  design first, approve before code.
---

# Plan loop skill

Use Grok Build **plan mode** for ambiguous work. Do not write application code until the plan is approved.

## Steps

1. **Enter plan mode** with `enter_plan_mode` (or ask the user to run `/plan`).
2. **Explore** (read-only): architecture, existing patterns, tests, extension surfaces (plugins/skills/hooks/MCP) before proposing core forks.
3. **Clarify** with `ask_user_question` when there are 2+ reasonable approaches (framework, schema, UX direction, risk tradeoff). Prefer 2–4 concrete options; put the recommended option first with "(Recommended)".
4. **Write** the plan to the session `plan.md` only:
   - Context / why
   - Recommended approach (not every alternative)
   - Critical file paths
   - Reuse existing utilities (with paths)
   - Verification: build, test, manual smoke
5. **Exit** with `exit_plan_mode` and wait for approve / comments / changes / quit.
6. **Only after approve**: implement, then verify (tests + smoke). Prefer plugins/skills over forking `xai-grok-pager`.

## Lab context

When working under `docs/architecture-lab/`:

- Prefer the **Ship** tab rehearsal for UX demos.
- Keep Pages path `docs/architecture-lab/` stable.
- Brand marks stay unaltered official assets.

## Anti-patterns

- Editing source files while still in plan mode
- Skipping Q&A when the design fork is expensive to reverse
- Giant always-on skills; keep procedures on-demand
