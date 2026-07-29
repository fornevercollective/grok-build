# fornevercollective · GY TTY placeholders

| | |
|--|--|
| **Owner** | **fornevercollective** |
| **Repo** | https://github.com/fornevercollective/grok-build |
| **Feature id** | `fc-gy-tty-placeholders` |
| **Module** | `xai-grok-pager-render::gy_tty` |
| **Slash** | `/gy [surface]` |
| **Lineage** | GrokYtalkY companion concepts · half-block paint from `fc-halfblock-tty-video` |

## Boundary (lab rule)

| In Grok Build | External `gy` (GrokYtalkY) |
|---------------|----------------------------|
| Half-block gboom + video (shipped) | Mesh hub, phone cast, multi-user pins |
| Catalog + demos + **spawn hooks** | Real PTT audio, vburst-frame, glyph hardware |
| PATH probe · copy install/run | `gy serve` / `stream-pub` / `colossus` / SFU |

**Grok agents do not reimplement the mesh.** Spawn + catalog only.

## Surfaces

| `/gy …` | Status | What you see |
|---------|--------|----------------|
| `status` | shipped catalog | Index of all surfaces + half-block credit |
| `burst` | **hook** | Orb · Space → `gy burst` · y/c · `GY_BURST_HOOK=0` |
| `wave` | placeholder | Animated waveform bars |
| `chat` | placeholder | Mock multi-user feed |
| `pins` | **hook** | Tiles · Space → `gy pins-dock` · y/c · `GY_PINS_HOOK=0` |
| `tools` | **probe** | PATH · y/c install\|run |
| `stream` | **hook** | type:gyst notes · Space → `gy stream-pub` **if `GY_HUB` set** · y/c recipe · `GY_STREAM_HOOK=0` |
| `help` | shipped | Keys + boundary |

## Keys

| Key | Action |
|-----|--------|
| Tab / `[` `]` | Cycle |
| `1`–`8` | Jump |
| Space / Enter | Pulse · **burst** / **pins** / **stream** external spawns |
| j/k | Chat scroll / pin select |
| **y / c** | tools · burst · pins · **stream** copy snippets |
| Esc / q | Close |

### Stream / type:gyst hub (opt-in)

| Condition | Space |
|-----------|--------|
| `gy` + `GY_HUB=host:port` + hook on | Detached `gy stream-pub` with `GY_HUB` env |
| `GY_HUB` unset | Toast: set hub first · y/c recipe |
| `GY_STREAM_HOOK=0` | Notes only |
| `gy` missing | → `/gy tools` |

```bash
export GY_HUB=127.0.0.1:9876
# hub/serve in another terminal if needed
/gy stream   # Space → stream-pub
```

Grok still does **not** host the hub or encode production GYST — it **spawns** the companion publisher.

## Try it

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
cargo build -p xai-grok-pager && ./target/debug/xai-grok-pager
/gy tools
/gy burst
/gy pins
export GY_HUB=127.0.0.1:9876
/gy stream
```

## Hook map (shipped)

| Surface | Real hook |
|---------|-----------|
| tools | PATH probe · y/c |
| burst | Space → `gy burst` |
| pins | Space → `gy pins-dock` |
| stream | Space → `gy stream-pub` when `GY_HUB` set |

## Still open

1. Waveform: sample mic only if user opts in (never by default)  
2. Optional: pipe actual gboom/video RGB into stream-pub stdin (deeper than spawn)

## Related

- [GBOOM-HALFBLOCK-PATCH.md](./GBOOM-HALFBLOCK-PATCH.md)  
- GrokYtalkY: burst · stream-binary · grokbuild-glyph-pins · companion  
