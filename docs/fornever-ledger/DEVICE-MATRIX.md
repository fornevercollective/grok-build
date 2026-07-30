# Device matrix · Chrome / Safari / Firefox · cast

Multi-browser + DevTools-style device support for GrokCast (no AVFoundation cam thrash).

## Engines

| Engine | Browsers | Gyro permission | getUserMedia | Notes |
|--------|----------|-----------------|--------------|-------|
| **chromium** | Chrome, Edge, DashCast WebView | no extra | yes | Device toolbar emulates viewport/DPR/touch |
| **webkit** | Safari, iOS Safari | **user gesture** | **https only** | RDM + Add to Home Screen PWA |
| **gecko** | Firefox | no extra | yes | RDM Ctrl+Shift+M |

Profiles: `scripts/live-demux/devices/browser-matrix.json`

## DevTools presets

`scripts/live-demux/devices/devtools-presets.json` — iPhone SE/14/15, iPad, Pixel 7, Nest Hub, desktop 1080/1440, **TCL / Hisense cast 1080**.

```text
GET  /devices
GET  /api/devices
GET  /api/devices/matrix
GET  /api/devices/presets
POST /api/devices/hello   # surface capability beacon
```

Query emulation:

```text
/news?emulate=1&device=iphone-14-pro
/box?pwa=1&device=pixel-7
```

JS: `FCDevice` from `/device-kit.js` — detect engine, features, apply soft CSS frame.

## Cast panels

| id | file |
|----|------|
| tcl-google-uhd | `devices/tcl-google-uhd.json` |
| hisense-google-uhd | `devices/hisense-google-uhd.json` |

## Operator tips

1. Phone control: Safari or Chrome **https://LAN:8766** → Setup → Add to Home Screen  
2. Desk preview: Chrome device mode **or** `/devices` preset frame  
3. TV: DashCast `/news?tv=1` or `/tv?tv=1` (Chromium WebView)  
4. Do **not** start `cam-relay.sh` for device lab work  
