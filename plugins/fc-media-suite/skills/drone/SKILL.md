---
name: drone
description: >
  /drone standalone multi-unit FPV ops HUD (Oblivion/DJI) — track SAM/DINO/SLAM/GSPLAT,
  Carto tiles, fc-timesync clock, hotpipe, LAFR/gsplat cal hooks.
  Triggers: /drone, /hud, drone-hud, fleet-hud, webgrid-drone, gsplat, fc-drone.
  Not nested under /webgrid or /watch.
---

# /drone · fc-webgrid-drone-hud-v2

**Standalone** production-grade FPV ops surface (DJI + Oblivion + tactical).

```bash
bash scripts/launch-drone.sh
bash scripts/launch-drone.sh gsplat
/drone
/drone units 4 track
/drone sam | dino | slam | gsplat
/drone clock
/drone ugrad | mavlink | elrs | mixed
/drone rth
/drone help
```

**Page:** `http://127.0.0.1:8790/webgrid-drone-hud.html?backend=sim&units=4&demo=rows&track=motion`

## Surfaces

| Panel | Role |
|-------|------|
| Full-bleed FPV | SPD/ALT tapes · reticle · pitch ladder · compass · mission day |
| Map tiles | Carto dark / voyager / OSM · never black-only · tile progress |
| Track plane | MOTION · SAM · DINO · SLAM · **GSPLAT cal** (LAFR / 3DGS-Calib hooks) |
| Clock | Zulu pill · mission strip · payload stamps (`fc-timesync-v1`) |
| Cmd bar | ARM RTH HOLD LAND GO TRK SAM SLAM GSPLAT MAP CLK |
| TX panel | market/off-market path · DeckTX · ELRS · MAVLink · smart-wifi |
| Hotpipe | `~/.panda/packs/drone-hotpipe.jsonl` · postMessage · `WebgridDroneHud.hotpipe` |

## Keys

`WASD` sticks · `Q`/`E` yaw · `Z`/`C` thr · `Space` arm · `Esc` disarm · `R` RTH · `H` hold · `L` land · `P` preload · `G` go · `T` track · `S` SAM · `M` pin · `C` clock · `1`–`4` unit

## Live feeds

```text
?feed0=https://unit/stream.m3u8
&iframe0=https://drone.ugrad.ai/viewer/viewer?media=mixed&demo=rows
&track=gsplat&backend=mixed
```

## Hotpipe

```json
{"type":"drone.track","unit":"U01","boxes":[{"id":"t3","x":0.4,"y":0.3,"w":0.1,"h":0.12,"label":"person","score":0.91}]}
{"type":"drone.cmd","cmd":"rth"}
{"type":"drone.gsplat","calib":{"residual":0.08,"gaussians":12000,"gsCalib":true,"lafr":true}}
```

## Gsplat / LAFR honesty

- Browser sim runs **live residual calibration UI** + N gaussians ramp.
- Real LAFR ([uzh-rpg/LAFR](https://github.com/uzh-rpg/LAFR)) and 3DGS-Calib need companion GPU pipeline; hotpipe bridges results into HUD.
- TX today: ELRS module + DeckTX / elrs-joystick-control; telemetry via MAVLink Anywhere.

## Map refs

- https://map.ugrad.ai/map-hub?lite=1 (hub data separate — basemap is Carto)
- https://map.ugrad.ai/tools/particle-earth.html
- https://map.ugrad.ai/tools/geo-desk
- https://tools.ugrad.ai/tools/clock

JS: `WebgridDroneHud.getState()` · `.cmd()` · `.track.setMode()` · `.map.setBasemap()` · `.clock.snapshot()` · `.hotpipe.ingest()`
