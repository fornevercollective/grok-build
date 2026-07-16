# GrokYtalkY companion

**Product surface = terminal.** GY is not a website serve for pins.

## Roles

| Tool | Role |
|------|------|
| **Grok Build** | Agent coding TUI |
| **GrokYtalkY (`gy`)** | Mesh walkie, dual Glyph, multi-user pin rail |

## Same terminal

```bash
gy grok
```

```
┌──────────────────────────────┐
│ ◈ gy pins · N · multi · …    │
│ [■] [■] [■]                  │
│ alice: ship it               │  multi-user feed
│ › @bob …█                    │
├──────────────────────────────┤
│     grok  (Grok Build)       │
└──────────────────────────────┘
```

## Plugin

```text
~/.grok/plugins/gy-glyph-pins
```

1. `Ctrl+L` → enable **gy-glyph-pins**  
2. `/glyph-pins` · `/with-grok`  
3. SessionStart prints `gy` path + stack hints  

## Multi-user mesh

| Event | Pin rail |
|-------|----------|
| roster / join | pin per peer |
| chat | room feed + LastChat |
| `@you` / `to` | unread badge |
| leave | pin removed |
| Ctrl+C on gy | `ExitMediaCleanup` → `pkill -x ffmpeg` |

## Env

| Var | Default | Meaning |
|-----|---------|---------|
| `GY_ROOM` | `global` | mesh room |
| `GY_ROOM_MAX` | `48` | soft capacity |
| `GY_NICK` | `$USER` | local nick |
| `GY_PORT` | `9876` | hub port |

## Source

```text
~/Projects/GrokYtalkY
~/Projects/GrokYtalkY/grok-plugin/gy-glyph-pins
~/Projects/GrokYtalkY/docs/grokbuild-glyph-pins.md
```

## Boundary rule

Grok agents **do not reimplement the mesh**.  
Shell `gy` or use the top pane; plugin skills enforce that story.
