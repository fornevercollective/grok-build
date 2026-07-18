# Large-scale collaboration plan

## Goals

Make Memory Glass ready for **many agents + humans** without turning the shell into Electron Slack.

## Surfaces

| Surface | Role |
|---------|------|
| Main PAGE | Calm reading; optional DEPTH |
| Inspect | Track + dock (PIPE/CORP/R1/EGO/CAL/UGRAD/IRON/MESH) |
| Phone | Chat · photo/link share · snapshots · Talk |
| Still-server | live.jpg · conversation · shares · snaps |
| Hot-pipe out/ | packs for Grok Build |
| Mesh channels | `mg-mesh` · `ugrad-live` (presence) |

## Mesh protocol (M0)

```js
// BroadcastChannel('mg-mesh')
{ v:1, t:'presence'|'pack'|'bps'|'iron'|'chat', id, name, payload, ts }
```

- **presence** — seat online, role (human|agent|mini)  
- **pack** — inspect pack summary pointer  
- **bps** — WebGrid / H9 training score  
- **iron** — layer budget snapshot  
- **chat** — optional short status (not full transcript; use conversation.jsonl)

## Scale stages

| Stage | N seats | Mechanism |
|-------|---------|-----------|
| M0 solo | 1 | local |
| M1 pair | 2–4 | BroadcastChannel same machine / profile |
| M2 lab | 4–16 | still-server LAN + shared conversation |
| M3 fleet | 16+ | external relay (future; panda fleet hooks) |

## Competitive collab (vs other browsers)

- Chrome/Safari: no first-class multi-agent spatial inspect  
- We: packs + voice + still-pipe snapshots + μgrad fitness  

## Rules

1. Mesh never writes PAGE DOM thrash.  
2. Large transcripts stay in `~/.panda/voice/conversation.jsonl`.  
3. Packs stay small; link out to files.  
4. Phone share/photo already feeds agent inbox.  
