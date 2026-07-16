---
description: Open the lab-ship chat orb (Hold · Cam · Mic float)
argument-hint: "[open|focus|listen|hold-hint]"
---

# /lab-ship

**lab-ship is the chat orb** — not a separate product.

User args: $ARGUMENTS

1. Load skill **lab-ship-orb**.
2. If Lab host is up (`http://127.0.0.1:8765` or current native port), call control:
   - default / `open` / `focus` → `POST /api/control {"action":"lab-ship"}` (alias of `chat_orb`)
   - `listen` → after open, `eval` target chat: arm listen if appropriate (prefer Hold while Spaces/broadcast audio is on)
3. Tell the user: orb is lab-ship · **Hold** to talk · **Cam** for face · room audio is ignored unless they say **hey grok** or hold.
4. If Lab host is down: point them to `docs/architecture-lab/native` → `./build-mac-app.sh` / `./launch.sh float`, then retry.
