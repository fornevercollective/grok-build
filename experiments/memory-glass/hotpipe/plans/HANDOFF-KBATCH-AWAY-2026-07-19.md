# HANDOFF · User away (door / multi-hour) · KBatch × MG

**Opened:** 2026-07-19  
**Also see:** `~/.panda/kbatch-mg-collab/HANDOFF.md` · bus.jsonl

## Do NOT

- Kill still-server (9877/9878) — phone PWA + still-pipe  
- Kill Memory Glass process  
- `pkill -f` broad patterns that self-match agents  
- Force-push or reset user worktrees  

## DO

1. Keep **kbatch local** on `http://127.0.0.1:8899/` (KBatch-dictionary)  
2. Keep **live** https://kbatch.ugrad.ai healthy  
3. Memory Glass: TOOLS → **kbatch · R4-data** → Site map / LOCAL / Dojo / Books  
4. Append collab notes to `~/.panda/kbatch-mg-collab/bus.jsonl`  
5. Prefer hotpipe JS inject over cargo rebuild  

## Modules

| Module | Role |
|--------|------|
| `mg-kbatch-site.js` | Full surface map + open/nav |
| `kbatch-fleet-bridge.js` | R4 axes seed |
| `kbatch-dojo-bridge.js` | Phrase / strain / MCP |
| `mg-tools-drawer.js` v30 | UI for site map |

## Console

```js
__mgKbatchSite.report()
__mgKbatchSite.openMap()
__mgKbatchSite.open('living-books')
__mgKbatchSite.open('dojo')
```

## When user returns

- Summarize bus.jsonl + status.json  
- Confirm every SURFACES id opens  
- Phone still-pipe still streaming if PWA active  
