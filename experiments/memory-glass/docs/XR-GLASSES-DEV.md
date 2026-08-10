# Memory Glass · XR / VR glasses dev pipe (v2)

**Anyone** with a glasses kit, Memory Glass (or the PWA), this repo, and an AI agent can **sync, join a room, and co-work**.

## One command

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build   # or your clone
bash experiments/memory-glass/scripts/mg-xr-dev.sh auto
```

| Command | Effect |
|---------|--------|
| `auto` | sync + **room API serve** + status |
| `sync` / `hot` | hotpipe → app + PWA · `hot` also ⌘⇧R |
| `serve` / `restart` | PWA + `/api/xr/*` multi-seat |
| `doctor` | green/red checklist |
| `onboard` | print human + AI guide |
| `quest` | adb reverse + headset URLs |
| `room [lab]` | snapshot peers |
| `for-ai` | agent JSON |

## Who can work together

| Role | What they need | How they join |
|------|----------------|---------------|
| **Host** | Mac + repo + optional MG.app | `mg-xr-dev.sh auto` |
| **Glass** | Quest / Pico / Vision / tethered AR | browser → LAN or adb `xr-dev.html?room=lab&join=1` |
| **AI** | shell + edit + curl | `curl …/api/xr/for-ai` · edit hotpipe · `hot` |
| **Desktop only** | browser | desktop-proxy profile + SBS / anaglyph |

Shared state: room **`lab`** (device, optics, note, handoff) via `POST /api/xr/room`.

## Surfaces

| Surface | Path |
|---------|------|
| Registry | `hotpipe/data/xr-glasses-registry.json` (v2 + setup) |
| Hotpipe | `hotpipe/mg-xr-glasses.js` → `window.__mgXr` **v2** |
| Serve | `scripts/mg-xr-serve.py` (static + room API) |
| CLI | `scripts/mg-xr-dev.sh` |
| Desk | `http://127.0.0.1:8787/xr-dev.html` |
| Onboard | `http://127.0.0.1:8787/xr-onboard.html` |
| Agent | `http://127.0.0.1:8787/api/xr/for-ai` |
| Room | `http://127.0.0.1:8787/api/xr/room?room=lab` |
| State | `~/.panda/mg-xr/LATEST.json` · `rooms.json` |

## Console API

```js
__mgXr.auto()
__mgXr.apply("quest-3")
__mgXr.list() · __mgXr.status() · __mgXr.forAi()
__mgXr.room.join("lab") · __mgXr.room.peers()
__mgXr.exportHandoff("note for next agent")
__mgXr.enterWebXR()
```

Query: `?device=quest-3&mg_xr=1&room=lab&join=1&follow=1`

## Device classes

| Class | Examples | Path |
|-------|----------|------|
| `standalone-vr` | Quest, Pico, Vision Pro | WebXR · ADB · browser |
| `tethered-ar` | XREAL, VITURE, Rokid | host browser / USB-C |
| `smart-glasses` | Ray-Ban Meta, Even | host MG / companion |
| `optical-rx` | Warby, Zenni | Rx import in MG |
| `desktop-proxy` | Mac | SBS / anaglyph |

## Agent loop (copy-paste)

```bash
bash experiments/memory-glass/scripts/mg-xr-dev.sh doctor
curl -s http://127.0.0.1:8787/api/xr/for-ai | jq .
# edit experiments/memory-glass/hotpipe/*.js
bash experiments/memory-glass/scripts/mg-xr-dev.sh hot
```

Rules:

1. Never bind **8765/8766** (Soft Path).  
2. Never `pkill` Memory Glass — use `hot` / ⌘⇧R.  
3. Prefer hotpipe JS over Rust for UI.  
4. Quest WebXR: prefer **adb reverse** so headset sees `http://127.0.0.1:8787` (secure-ish localhost).

## Ports

| Port | Owner |
|------|--------|
| **8787** | MG PWA · XR desk · room API |
| **8765/8766** | Soft Path only |

## Limits (honest)

- Not a native MG binary on the HMD — **browser + host shell**.  
- Multi-seat shares **profile/optics/handoff**, not full DOM collab.  
- LAN HTTP may block immersive WebXR; use adb reverse / HTTPS later if needed.
