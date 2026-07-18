# Mini WebGrid leaderboard — find it fast

## Where it is

| Entry | How |
|-------|-----|
| **Top-right chip** | `MINI BOARD` / `BOARD` — always visible when panel closed |
| **Live rank panel** | Auto-opens on WebGrid (incl. 12×12 mini) after ~0.7s |
| **SOLVE HUD** | Click green **BOARD** in top center strip |
| **Capsule** | `BOARD` · **`MINI LB`** (filters 12×12 lane) |
| **Search bar** | `board` · `mini lb` · `miniboard` |
| **Clean window** | `POST ↗` → `leaderboard.html` |

## Mini vs full

| Lane | Grid | Game id |
|------|------|---------|
| **MINI 12×12** | compact / `?mg_scale=small` | `webgrid-mini` |
| **FULL 30×30** | desktop large | `webgrid` |

Panel lanes: **ALL · MINI 12×12 · FULL 30×30**

## Launch mini

```bash
bash experiments/memory-glass/scripts/launch-webgrid-laptop.sh --small --rounds 3
# URL includes mg_scale=small → Neuralink 12×12
```

## Product shot

See `docs/assets/` / session images for full dual-space chrome mock (bells & whistles).
