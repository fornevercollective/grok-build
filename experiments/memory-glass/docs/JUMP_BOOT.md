# Memory Glass · Jump A–F + Boot B0–B8+

## Jump layers (A–F)

| ID | Name | Entry |
|----|------|--------|
| **A** | Presentable craft | `html.mg-presentable` · `mg-chrome-tokens.js` · dual drawers |
| **B** | Agent-in-glass | Right **Grok** · `__mgGrokTerm` · `__mgJump.agentSurface()` |
| **C** | Mesh presence | `__mgJump.meshPing()` · BroadcastChannel `mg-mesh` |
| **D** | Isolation roles | `__mgIsolate.roles` · shell/content/inspect/agent |
| **E** | Plane map | `__mgJump.planes` · `openPlane("market"\|"control"\|…)` |
| **F** | Browser wedge metrics | `__mgJump.wedgeMetrics()` |

```js
window.__mgJump.report()   // full A–F snapshot
window.__mgJump.openPlane("market")
```

## Boot B0–B8+

```js
window.__mgCal.boot()                 // CAL + layers + SHOW if green
window.__mgCal.boot({ mode: "layers" }) // B0–B8+ only
window.__mgCal.layers()               // same
// URL: ?mg_cal=1 | ?mg_cal=layers | ?mg_cal=full
```

| Phase | Check |
|-------|--------|
| **B0** | TOOLS + DATA tabs · stamp · no mega pill |
| **B1** | Menu probe green (dual-drawer catalog) |
| **B2** | Left TOOLS open · acts/sections |
| **B3** | Right DATA · Mkt embed host |
| **B4** | Shell words SOLVE / LIVE / INSPECT |
| **B5** | Search dock open/close |
| **B6** | Scroll soak · chrome under `<html>` |
| **B7** | Clear stack · only shell remains |
| **B8** | Feel score ≥75 (tokens+dual+presentable+jump) |
| **B8+** | Jump A–F report present |

## Menu catalog (v6)

`__mgMenus.exercise()` includes: `tools`, `data`, `search`, keyboard, board, maze, beats, field, raider, bloch, geo, rubik, mkt, grok, solve, dragon.

Probe: `__mgMenus.probe()` · pill **MENUS n/n**.
