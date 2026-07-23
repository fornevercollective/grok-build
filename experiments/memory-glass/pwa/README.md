# Memory Glass · PWA (phone / homescreen)

Firefox-style **installable web app**: run in any browser or **Add to Home Screen**.

## What this is

| Surface | Role |
|---------|------|
| **Memory Glass.app** (native WKWebView) | Full browser · DRAW overlay · PICK · DESK live · product-core |
| **PWA shell** (`pwa/`) | Phone homescreen companion · address bar · REC/SNAP/BOARD/**PICK**/DRAW/DESK chip · offline shell |

Many sites block iframes; the PWA can **OPEN ↗** a real tab and still keep the tool chip UX. Full in-page DRAW/PICK requires the native app (or a future bookmarklet inject).

## Serve locally

```bash
cd experiments/memory-glass/pwa
python3 -m http.server 8787
# phone on same LAN: http://<your-ip>:8787/
```

## Install

- **iOS Safari:** Share → **Add to Home Screen**
- **Android Chrome:** menu → **Install app** / Add to Home screen  
- **Desktop Chrome/Edge:** install icon in URL bar  

## 2019 MacBook Pro (Touch Bar)

Native app defaults to **product-core** + **compat low-power** when Intel / low cores detected:

- `hotpipe/mg-compat.js` — reduces blur, parks lab, lite CSS  
- Force lite: `?mg_low=1` or `localStorage.mg.power='low'` or env `MG_LOW_POWER=1`  
- Force full lab: `?mg_lab_full=1` or `MG_LAB_FULL=1`

Touch Bar models (MacBookPro15,x / 16,x Intel) are the target for `mg-low-power` heuristics.

## Chip (parity with native)

`REC · SNAP · BOARD · ◎ PICK · ✎ DRAW · DESK · OPEN ↗`

## Roadmap

1. Bookmarklet to inject product-core into the active tab  
2. Share-target for URLs into DESK  
3. Capacitor/iOS wrapper if App Store shell is needed  
