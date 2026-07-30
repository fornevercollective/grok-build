---
name: tiles
description: >
  Independent ffplay tile plane — load/place/close/crash-isolate windows for live mosaics.
  Triggers: /tiles, ffplay tiles, tile plane, rearrange mosaic, independent popout.
---

# Tile plane · independent ffplay (fc-tile-plane-v1)

**Explicit only.** Tiles are siblings of Grok main bg — one crash does not kill the wall.

Architecture: `docs/fornever-ledger/FC-BROADCAST-TILE-PLANE.md`

## Commands

```bash
bash scripts/live-demux/ffplay-tiles.sh list
bash scripts/live-demux/ffplay-tiles.sh load 12 'https://x.com/zanelowe/media'
bash scripts/live-demux/ffplay-tiles.sh load A3 null          # placeholder
bash scripts/live-demux/ffplay-tiles.sh place t12 7           # move to cell 7
bash scripts/live-demux/ffplay-tiles.sh close t12
bash scripts/live-demux/ffplay-tiles.sh close all
bash scripts/live-demux/ffplay-tiles.sh reap
bash scripts/live-demux/ffplay-tiles.sh from-select           # null tiles on align selection
```

Placement cells come from `~/.panda/vision/cast/align-chart.json` (`/cast align`).

## With align chart

```bash
# 1) numbers on desk/TV
bash scripts/live-demux/cast-tv.sh align --no-cast
# 2) people call cells; load feeds
bash scripts/live-demux/ffplay-tiles.sh load 5 'https://x.com/zanelowe/media'
bash scripts/live-demux/ffplay-tiles.sh load 12 'https://www.youtube.com/…'
# 3) rearrange without touching other tiles
bash scripts/live-demux/ffplay-tiles.sh place t5 9
```

## Stack position

L0 align → **L1 tiles (this)** → L2 compose → L3 cast TCL → L4 chrome later → L5 news theme → L6 spatial later
