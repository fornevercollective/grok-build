# fc-gpu-pipe

Throttle **laptop** GPU encode (VideoToolbox) and cast H.264 to the TV.

## Why

DashCast WebView often caps around **960×540 @ ~12 fps**. Desktop Chrome looks great because it uses a real GPU context. This pipe:

1. Generates an Imagine-style field (light CPU `lavfi`)
2. Encodes with **`h264_videotoolbox`** (bare-metal adjacent GPU on Intel UHD / AMD / Apple)
3. Rust **throttles** tier / fps / bitrate if encode lags realtime
4. **`catt cast`** file to TCL Default Media Receiver (proper decode path)

## Quick

```bash
cd scripts/live-demux/gpu-pipe
cargo build --release

# one 14s wow segment → cast
./target/release/fc-gpu-pipe --tier wow --secs 14 --cast-device 'Smart TV'

# or via cast-tv
bash scripts/live-demux/cast-tv.sh gpu-pipe
```

## Tiers

| Tier | Size | FPS | Bitrate | Use |
|------|------|-----|---------|-----|
| `battery` | 960×540 | 20 | 2.5 Mbps | On battery / thermal |
| `wow` | 1280×720 | 24 | 5.5 Mbps | Default promo |
| `insane` | 1920×1080 | 30 | 9 Mbps | Plugged in |

`--power auto` steps down if encode ratio &lt; 0.85× realtime.

## Env

```text
FC_GPU_PIPE_TIER=wow|battery|insane
FC_GPU_PIPE_POWER=auto|low|high
FC_GPU_PIPE_MODE=imagine|portal|tunnel
LIVE_DEMUX_CAST_DEVICE='Smart TV'
```

## Status

`~/.panda/vision/cast/gpu-pipe.jsonl` — per-segment encode timing + throttle events.
