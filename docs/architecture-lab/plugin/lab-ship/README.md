# lab-ship = chat orb

**lab-ship** is the **Grok Build Lab chat face** — desktop orb + **phone PWA** — plus the Grok Build extension pack that opens and steers it.

| Layer | What |
|-------|------|
| **Phone PWA** | `phone.html` — Chat · Agent · Stream · Prompt · Docs (installable) |
| **Product face (desktop)** | Chat orb (Siri-scale) — control `chat_orb` / `lab-ship` |
| **Full panel** | `chat.html` (expand from orb **Full**) |
| **Grok plugin** | skills · commands · agents · hooks under this folder |
| **Host** | Grok Build Lab.app / `./serve.sh` (local control API) |

### Phone

```bash
# with Lab host running
open http://127.0.0.1:8765/phone.html
# Install to Home Screen (iOS/Android) — manifest start_url = phone.html
```

Not a pager fork. Not the whole Lab docs site. **The orb is the product.**

## Open the orb

```bash
# with Lab native host running
curl -s -X POST http://127.0.0.1:8765/api/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"lab-ship"}'
# aliases: chat_orb · orb · siri_orb · labship
```

In Grok TUI (plugin enabled): **`/lab-ship`** → open/focus the orb and arm Hold/Mic guidance.

## Ecosystem plugin install

```bash
# from grok-build repo root
grok plugin install ./docs/architecture-lab/plugin/lab-ship --trust
grok plugin enable lab-ship
```

```toml
# ~/.grok/config.toml
[plugins]
enabled = ["lab-ship"]
```

Manifest **0.2.1**.

## Commands

| Command | Role |
|---------|------|
| **`/lab-ship`** | Open/focus the **chat orb** (lab-ship face) |
| `/plan-loop` | Plan → approve → build |
| `/ship-check` | status.x.ai + pre-push |
| `/triple-handoff` | α plan · β build · γ verify |

## Skills / agents

| Kind | Name |
|------|------|
| Skill | `plan-loop` · `ship-checklist` · `lab-review` · `triple-handoff` · **`lab-ship-orb`** |
| Agent | `lab-explorer` · `lab-tester` |
| Hook | SessionStart — *lab-ship (chat orb) ready* |

## Orb controls (product)

| Control | Role |
|---------|------|
| **Hold** | Push-to-talk → Grok STT → intent (broadcast-safe when gated) |
| **Cam** | Live face in orb |
| **Mic** | Arm Listen · wake **“hey grok”** or Hold to act |
| **See me** | Persona / vision sample |
| **Full** | Expand to full chat panel |

## Related paths

| Path | Role |
|------|------|
| `docs/architecture-lab/orb.html` | lab-ship UI |
| `docs/architecture-lab/chat.html` | full chat |
| `docs/architecture-lab/native/` | Lab.app host |
| Stream window | separate feed (e.g. X broadcasts) — not the orb |
