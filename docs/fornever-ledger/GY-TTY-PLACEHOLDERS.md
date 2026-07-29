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
| Placeholder modals for burst/wave/chat/pins | Real PTT audio, vburst-frame, glyph hardware |
| Tool map pointing at CLI | `gy serve` / `stream-pub` / `colossus` / SFU |

**Grok agents do not reimplement the mesh.** These panels are discoverable stubs + animation demos so the fork has a home for the next iteration.

## Surfaces

| `/gy …` | Status | What you see |
|---------|--------|----------------|
| `status` | shipped catalog | Index of all surfaces + half-block credit |
| `burst` | placeholder | Animated half-block orb · mock PTT |
| `wave` | placeholder | Animated waveform bars |
| `chat` | placeholder | Mock multi-user feed |
| `pins` | placeholder | Mock pin tiles + roster |
| `tools` | external map | `gy` CLI inventory · PATH probe |
| `stream` | placeholder | `.gyst` / hexlum notes · next-steps |
| `help` | shipped | Keys + boundary |

## Keys (panel open)

| Key | Action |
|-----|--------|
| Tab / `[` `]` | Cycle surfaces |
| `1`–`8` | Jump surface |
| Space / Enter | Mock PTT pulse |
| j/k | Chat scroll / pin select |
| Esc / q | Close |

## Try it

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
./target/debug/xai-grok-pager
# then:
/gy
/gy burst
/gy wave
/gy tools
```

## Next (real work, not stubs)

1. Optional: publish gboom/video frames as `type:gyst` to local hub when `GY_HUB` set  
2. Burst: wire Space hold → optional shell-out or plugin hook to `gy burst`  
3. Pins: plugin `gy-glyph-pins` already exists — deep-link from `/gy pins`  
4. Waveform: sample mic only if user opts in (never by default)

## Related

- [GBOOM-HALFBLOCK-PATCH.md](./GBOOM-HALFBLOCK-PATCH.md)  
- GrokYtalkY docs: burst · stream-binary · grokbuild-glyph-pins · companion  
