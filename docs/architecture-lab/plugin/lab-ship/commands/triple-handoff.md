---
description: Run the α plan · β build · γ verify handoff loop via lab bus
argument-hint: "[task summary]"
---

# /triple-handoff

Task: $ARGUMENTS

1. Load skill **triple-handoff**.  
2. If lab is up, `POST /api/shells/spawn` with `triple: true` and the task.  
3. Start in **plan** (read-only / plan mode).  
4. On approve, handoff plan→build; on build done, build→verify; on fail, loop back.  
5. Report shell statuses and recipes to the user.
