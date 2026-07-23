# MG Phone PWA (offline + pull-to-refresh)

## Open (HTTPS — cam + SW need secure context)

```
https://<LAN-IP>:9878/phone.html
```

Examples on this lab Mac:

- `https://192.168.0.44:9878/phone.html`
- `https://192.168.0.107:9878/phone.html`

HTTP `:9877` is snap-only and **cannot** register a service worker on iPhone.

## Install (iOS)

1. Trust cert once (`phone-setup.html` → profile + Certificate Trust Settings)
2. Open **HTTPS** phone page in Safari
3. Share → **Add to Home Screen** → name **MG Phone**
4. Open from home icon (standalone)

## Iterate

| Gesture | Action |
|---------|--------|
| **Pull down** at top | Hard refresh shell + SW update |
| Bottom **↻** | Same hard refresh |
| Bottom **Cam / Talk / Chat / Setup** | Navigate inside PWA |
| Double-tap title | Refresh |

Service worker caches shell (`phone*.html`, `phone-pwa.js`, `sw.js`, icons).  
Live paths (`/upload`, `/live.jpg`, `/transcript`, …) are **network-only**.

## Files

| File | Role |
|------|------|
| `manifest.webmanifest` | Install metadata + shortcuts |
| `sw.js` | Offline shell, network-first HTML |
| `phone-pwa.js` | SW register, pull-to-refresh, nav |
| `icons/` | 192 / 512 touch icons |

## Restart still-server after edit

```bash
cp Resources-pack/vision/*.{html,js,webmanifest,css,py} ~/.panda/vision/
cp -R Resources-pack/vision/icons ~/.panda/vision/
# kill + start
MG_STILL_BIND=0.0.0.0 python3 ~/.panda/vision/still-server.py &
```

Then **pull to refresh** on the phone so the PWA picks up the new shell.
