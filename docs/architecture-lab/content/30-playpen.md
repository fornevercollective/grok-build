# Dev playpen · manage · explore · mitigate · research · /voice

The **native Rust shell** is Grok’s local playpen: a room to grow in, crash-safe ops, research context, and voice I/O — without Electron.

Cloud pair: **[Grok Automations](https://grok.com/automations)** (schedule / trigger).  
Local pair: this playpen (HTTP on the Lab host, usually `http://127.0.0.1:8765`).

## Domains

| Domain | Role |
|--------|------|
| **manage** | Status, fleet, handoff bus, arrange/chain hints |
| **explore** | Git, processes, packs, lab tree, bins, events |
| **mitigate** | Diagnose · kill ffmpeg · soft-recover · reset handoff · summon |
| **research** | Full snapshot, crash log tail, content index |
| **voice** | `/voice` catalog · **Grok TTS** (default) · Listen via **Grok STT** when Web Speech is blocked · macOS `say` opt-in only |

## HTTP

```bash
# Full status + catalog
curl -s http://127.0.0.1:8765/api/playpen | jq .

# Dispatch
curl -s -X POST http://127.0.0.1:8765/api/playpen \
  -H 'Content-Type: application/json' \
  -d '{"domain":"mitigate","action":"diagnose"}' | jq .

# Freeform cmd
curl -s -X POST http://127.0.0.1:8765/api/playpen \
  -d '{"cmd":"explore git"}' -H 'Content-Type: application/json' | jq .

# /voice — Grok free TTS (eve · ara · leo …), not macOS say
export XAI_API_KEY=…   # or ~/.grok/auth.json
curl -s http://127.0.0.1:8765/api/voice | jq .
curl -s -X POST http://127.0.0.1:8765/api/voice \
  -d '{"action":"speak","text":"Hello from Grok voice","voice_id":"eve"}' \
  -H 'Content-Type: application/json' | jq .
curl -s -X POST http://127.0.0.1:8765/api/voice \
  -d '{"action":"say-status","voice_id":"ara"}' -H 'Content-Type: application/json' | jq .
# macOS say is opt-in only: "use_mac_say": true
```

Also: `GET|POST /voice` (same handlers). Engine is **Grok/xAI TTS** (`https://api.x.ai/v1/tts`); audio plays via `afplay`.

## Crash & recover loop

1. `POST /api/playpen {"domain":"research","action":"crash"}` — launch.log tail + events  
2. `POST /api/mitigate {"action":"diagnose"}` — ffmpeg / hot procs / handoff queue  
3. `soft-recover` — reap ffmpeg + diagnose  
4. `POST /api/control {"action":"arrange"}` — re-fit windows  
5. `/voice say-status` — announce healthy  

## Automations bridge

| Cloud (grok.com) | Local playpen |
|------------------|---------------|
| Schedule / trigger | `POST /api/agent/chain` |
| Report back | fat pack + handoff + events |
| Overnight digests | research snapshot + git log |
| “Mac stuck” | mitigate diagnose / soft-recover |

## Safety

- Mitigate is **ops-only** (no product YOLO).  
- Research is **read-oriented**.  
- TTS never logs API keys.  
- α plan / γ verify still prefer no product writes; β build via chain + worktree.

## Chat vision playpen

Floating **chat** window (`Cmd+2` / show_chat):

| Control | Role |
|---------|------|
| **Cam** | Open/close user camera in orb + self pin |
| **Hold / Listen** | Push-to-talk + intent (native WKWebView: Grok STT fallback when Web Speech returns `service-not-allowed`) |
| **See me** | Sample persona + optional AIto pose |
| **Recover** | Soft-recover + re-open chat standalone |
| **Pins** | GY-style bubbles: You · AIto · Stream · α · β |

Persona grows at `localStorage` + `~/.panda/personas.json` (`GET|POST /api/persona`).  
AIto sidecar: `GY_VISION_AITO_URL` (default `http://127.0.0.1:8766`) · `GET /api/vision/health`.

Grok can open windows:

```bash
curl -s -X POST localhost:8765/api/control -d '{"action":"show_chat"}' -H 'Content-Type: application/json'
curl -s -X POST localhost:8765/api/control -d '{"action":"open_chat_independent"}' -H 'Content-Type: application/json'
curl -s -X POST localhost:8765/api/control -d '{"action":"show_agent"}' -H 'Content-Type: application/json'
```

## Related

- [29 · Grok Voice spheres](29-grok-voice-spheres.md)  
- [21 · Triple shell handoffs](21-triple-shell.md)  
- [15 · Lab shells](15-lab-shells.md)  
