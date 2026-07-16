---
description: Run status.x.ai go/no-go and lab pre-ship checklist
argument-hint: "[strict|soft]"
---

# /ship-check

Run the **ship-checklist** skill end-to-end.

Arguments: $ARGUMENTS

1. Load skill `ship-checklist`.
2. If argument contains `strict`, use `--strict` status check.
3. Report go / no-go and remaining manual steps (serve, validate, Pages).
