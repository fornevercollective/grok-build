# Port handoff · Soft Path owns 8765 / 8766

**Source of truth (kid game):**  
`/Volumes/qbitOS/00.dev/projects/MotherOfThyme_Soft-Path/docs/PORT-HANDOFF.md`

## Soft Path exclusive

| Port | Role |
|------|------|
| **8765** HTTP | Soft Path play · rooms · walkers · talk · force-refresh |
| **8766** HTTPS | Soft Path phone camera (secure context) |

```bash
cd /Volumes/qbitOS/00.dev/projects/MotherOfThyme_Soft-Path/game/web
./scripts/claim-and-start.sh
# dry-run: ./scripts/claim-and-start.sh --dry-run
```

| Who | URL |
|-----|-----|
| Desktop | http://127.0.0.1:8765/play.html |
| Phone + camera | https://\<LAN-IP\>:8766/play.html |
| Dev Lead | http://127.0.0.1:8765/dev.html |

## Parking map (grok-build / Memory Glass / lab)

| App | Port | Notes |
|-----|------|--------|
| Soft Path (kid game) | **8765 + 8766 HTTPS** | Exclusive — do not bind |
| Memory Glass PWA | **8787** | `experiments/memory-glass/pwa` · ugrad-arena · glyph tools |
| Memory Glass webgrid | **9880** | `webgrid-collector.py` |
| Cast align / TV hub | **8791 + 8792 HTTPS** | `LIVE_DEMUX_CAST_PORT` / `LIVE_DEMUX_CAST_HTTPS_PORT` |
| uvspeed bench / freya / hexbench | **8790** | DATA drawer local apps |
| Architecture lab / experiments | **8790+** | paper, keynotes, one-offs |
| Panda paper keynote | **8795** (example) | never 8765 while kid plays |

### Glyph / arena defaults (reparked)

- `LIVE_DEMUX_GLYPH_ARENA` default → `http://127.0.0.1:8787/ugrad-arena.html?mode=glyph`
- Cast defaults → `8791` / `8792`

### Rule

> **Do not bind 8765 or 8766** for Memory Glass, cast, paper, or lab static servers while Soft Path is the family LAN shell.

## Agent checklist

1. `lsof -nP -iTCP:8765,8766 -sTCP:LISTEN` — only Soft Path `serve.py` from `MotherOfThyme_Soft-Path/game/web`
2. MG → 8787 · webgrid → 9880 · cast → 8791 · experiments → 8790+
3. Kid open: http://127.0.0.1:8765/play.html
