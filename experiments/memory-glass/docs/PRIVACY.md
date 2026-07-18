# Memory Glass · Privacy

**Short version:** Training instruments stay **on-device** unless you explicitly open a remote URL or mesh channel.

## Camera

| Use | When | Network |
|-----|------|---------|
| Face / hand spatial HUD (`live.js`) | Inspect or spatial mode on | **Local only** — frames processed in WKWebView / still-pipe |
| Still-pipe (`~/.panda/vision`) | Optional phone/Mac Mini feed | Localhost by default |
| Page `getUserMedia` | Only if a site you navigate requests it | Site policy applies |

Memory Glass does **not** upload camera frames to xAI, Neuralink, or third parties as part of the shell.

## Metrics & leaderboard

| Data | Storage |
|------|---------|
| WebGrid BPS / NTPM / runs | `localStorage` on device (`mg.activity.*`) |
| Fleet seed benches | Bundled JSON under `hotpipe/data/` |
| SNAP composites | Local disk via IPC `save_lab_snap` |

No automatic X / social post. **X DRAFT** copies text for **you** to post.

## Mesh / chat

| Channel | Scope |
|---------|--------|
| `BroadcastChannel("mg-mesh")` | Same-machine browsers / seats |
| Collab day | Local + optional ugrad-live bridge if open |

Turn off by not using CHAT/MESH modes.

## Network

| Destination | Why |
|-------------|-----|
| Sites you type / tab | Navigation |
| Neuralink WebGrid | Training surface (you chose the URL) |
| kbatch / mueee links | Optional lab tools from Control Center |
| GitHub / train pages | Optional |

## Notarization

Current distribution uses **ad-hoc codesign** (`codesign --sign -`) for local Dock installs.  
**Apple notarized Developer ID builds** are a trust-layer goal for `v0.4+` — not claimed yet.

## Contact / data requests

Local app only — delete `localStorage` and `~/.panda` packs to wipe lab state.
