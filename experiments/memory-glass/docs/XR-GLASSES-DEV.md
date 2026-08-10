# Memory Glass · XR / VR glasses dev pipe

**Automatic quick-pipe + sync + dev** for every glasses class MG cares about: tethered AR (XREAL / VITURE / Rokid), standalone VR (Quest / Pico / Vision Pro), smart glasses (Ray-Ban Meta / Even), Rx frames (Warby / Zenni), and desktop stereo proxy.

## One command

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
bash experiments/memory-glass/scripts/mg-xr-dev.sh auto
```

Does: **sync hotpipe → app + PWA**, **serve `:8787`**, print **status + detect + URLs**.

| Command | Effect |
|---------|--------|
| `…/mg-xr-dev.sh auto` | sync + serve + status |
| `… sync` | hotpipe + registry → app Resources + `pwa/` |
| `… serve` | static PWA on **8787** (never 8765/8766) |
| `… hot` | sync + ⌘⇧R |
| `… list` | device registry |
| `… detect` | host / adb guess |
| `… quest` | `adb reverse` + headset URL |
| `… open quest-3` | serve + open browser with profile |

## Surfaces

| Surface | Path / API |
|---------|------------|
| Registry | `hotpipe/data/xr-glasses-registry.json` |
| Hotpipe module | `hotpipe/mg-xr-glasses.js` → `window.__mgXr` |
| PWA desk | `http://127.0.0.1:8787/xr-dev.html` |
| TOOLS drawer | **XR** (auto) · **XR Dev** (nav PWA) |
| Lazy boot | `__mgLazy.need("xr")` |
| Hot sync bake | `COMPANION_MG_XR_GLASSES` into `live.js` |

## Console API

```js
__mgXr.list()           // all devices
__mgXr.detect()         // UA / WebXR guess
__mgXr.auto()           // detect + apply optics
__mgXr.apply("quest-3") // force profile
__mgXr.status()
__mgXr.enterWebXR()     // immersive-vr when available
__mgXr.pipeUrl()
__mgXr.syncHint()
```

Query flags:

- `?mg_xr=1` or `?device=quest-3` on any page with the module
- `?mg_xr_webxr=1` to request immersive session after load

## Device classes

| Class | Examples | Dev path |
|-------|----------|----------|
| `standalone-vr` | Quest 3/3S/2/Pro, Pico 4, Vision Pro | WebXR · ADB (Quest/Pico) · browser |
| `tethered-ar` | XREAL One/Air, VITURE, Rokid | USB-C host browser · partial WebXR |
| `smart-glasses` | Ray-Ban Meta, Even G1, Oakley Meta | companion / host; optics soft |
| `optical-rx` | Warby, Zenni | Rx import in MG inspect (existing) |
| `desktop-proxy` | Mac MG | anaglyph · SBS · WebXR sim |

Optics map into existing MG sliders: IPD · FOV · fovea · ana · eye preset · page/depth mode.

## Quest (Meta Horizon)

```bash
bash experiments/memory-glass/scripts/mg-xr-dev.sh serve
bash experiments/memory-glass/scripts/mg-xr-dev.sh quest
# On headset Meta Browser:
#   http://127.0.0.1:8787/xr-dev.html?device=quest-3&mg_xr=1
```

HzOS MCP (when connected): `get_adb_path`, `stream_device_logcat`, `take_screenshot`, `get_web_documentation_index` / `fetch_meta_quest_doc`.

## Ports

| Port | Owner |
|------|--------|
| **8787** | Memory Glass PWA · **xr-dev** · glyph arena |
| **8765 / 8766** | Soft Path only — **do not bind** |

See `docs/fornever-ledger/PORT-HANDOFF.md`.

## Agent workflow

1. `mg-xr-dev.sh auto` (or `sync` + existing PWA server)
2. In MG: TOOLS → **XR** or console `__mgXr.auto()`
3. Headset: LAN or adb-reverse URL → `xr-dev.html?device=…`
4. After hotpipe edits: `mg-xr-dev.sh hot` (no app kill)
5. Record learnings via dispatch if fleet session

## Related

- Inspect **Glasses Rx** (Warby / Meta Ray-Ban / XREAL / …) in native shell
- H9 XR touch proxy in `hotpipe/hurdles.js` (depth-z · not full HMD)
- Skill `memory-glass` · slash `/memory-glass`
