---
name: lab-ship-orb
description: >
  lab-ship is the Grok Build Lab chat orb. Open, focus, or explain the Siri-scale
  float (Hold · Cam · Mic · intents). Triggers: /lab-ship, lab-ship, chat orb,
  open orb, siri orb, floating chat.
---

# lab-ship = chat orb

## Identity

| Name | Meaning |
|------|---------|
| **lab-ship** | Product name for the **chat orb** + its Grok plugin pack |
| UI | `docs/architecture-lab/orb.html` |
| Control | `POST /api/control {"action":"lab-ship"}` (= `chat_orb`) |
| Expand | Full chat → `chat_full` / orb **Full** button |

## Open

```bash
curl -s -X POST http://127.0.0.1:8765/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"lab-ship"}'
```

Aliases: `chat_orb` · `orb` · `siri_orb` · `labship` · `ship_orb`.

## Voice (safe with room/TV/Spaces)

- **Hold** = intentional talk (always acts).
- **Mic / Listen** = armed; only acts on **hey grok** or after wake, so broadcast audio does not fire tools.
- STT path in native WKWebView: Grok `/api/stt` when Web Speech returns `service-not-allowed`.

## Do not confuse

| Thing | Not lab-ship |
|-------|----------------|
| Stream window | Video feeds / X broadcasts |
| Lab docs SPA | `index.html` Ship deck |
| gy-glyph-pins | Mesh pins (separate plugin) |
