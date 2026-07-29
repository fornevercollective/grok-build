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
| `burst` | **hook shipped** | Half-block orb · **Space/Enter** spawns external `gy burst` when on PATH · **y/c** copy · `GY_BURST_HOOK=0` opt-out |
| `wave` | placeholder | Animated waveform bars |
| `chat` | placeholder | Mock multi-user feed |
| `pins` | **hook shipped** | Catalog tiles · **Space** → external `gy pins-dock` · **y/c** copy · `GY_PINS_HOOK=0` opt-out · j/k select |
| `tools` | **probe shipped** | PATH probe (`gy` / `~/.local/bin` / Homebrew) · **y/c** copy install *or* run lines · CLI map |
| `stream` | placeholder | `.gyst` / hexlum notes · next-steps |
| `help` | shipped | Keys + boundary |

## Keys (panel open)

| Key | Action |
|-----|--------|
| Tab / `[` `]` | Cycle surfaces |
| `1`–`8` | Jump surface |
| Space / Enter | Pulse · **burst:** `gy burst` · **pins:** `gy pins-dock` (if on PATH) |
| j/k | Chat scroll / pin select |
| **y / c** (tools) | Copy install snippet (if missing) or run lines (if found) |
| **y / c** (burst) | Copy `gy burst` run line (or install if missing) |
| **y / c** (pins) | Copy `gy pins-dock` + `gy grok` deep-links |
| Esc / q | Close |

### `/gy tools` — real hook (not stub)

| `gy` on PATH | Behavior |
|--------------|----------|
| **OK** | Shows path · `gy doctor` / `--help` / `burst` · **y/c** copies run lines |
| **MISSING** | Install lines for `fornevercollective/GrokYtalkY` · **y/c** copies clone + PATH hints |

Toast on open: `gy OK · <path>` or `gy MISSING · y/c copy install`.  
Still **zero mesh reimplementation** — detect + catalog + clipboard only.

### `/gy burst` — Space → external hook

| Condition | Space / Enter |
|-----------|----------------|
| `gy` on PATH + hook on | Pulse orb **and** detached `gy burst` (stdio null) |
| `GY_BURST_HOOK=0/false/off` | Pulse only |
| `gy` missing | Pulse only · toast → `/gy tools` |

Grok paints the orb; **mesh TX stays in `gy`**.

## Try it

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
./target/debug/xai-grok-pager
# then:
/gy tools          # PATH probe
/gy burst          # Space → gy burst if installed
# opt-out:  export GY_BURST_HOOK=0
```

### `/gy pins` — Space → external pins-dock

| Condition | Space / Enter |
|-----------|----------------|
| `gy` on PATH + hook on | Pulse tiles **and** detached `gy pins-dock` |
| `GY_PINS_HOOK=0/false/off` | Pulse only |
| `gy` missing | Pulse only · toast → `/gy tools` |

Clipboard also lists `gy grok` (tmux pins-dock above Grok). Live unread / multi-user rail stays in **gy**.

## Next (real work, not stubs)

1. ~~`/gy tools` PATH probe + copy install/run~~ **done**  
2. ~~Burst Space → external `gy burst`~~ **done**  
3. ~~Pins Space → external `gy pins-dock`~~ **done** (`try_spawn_gy_pins` · `GY_PINS_HOOK`)  
4. Optional: publish gboom/video frames as `type:gyst` to local hub when `GY_HUB` set  
5. Waveform: sample mic only if user opts in (never by default)

## Related

- [GBOOM-HALFBLOCK-PATCH.md](./GBOOM-HALFBLOCK-PATCH.md)  
- GrokYtalkY docs: burst · stream-binary · grokbuild-glyph-pins · companion  
