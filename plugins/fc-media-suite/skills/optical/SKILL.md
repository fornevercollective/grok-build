---
name: optical
description: >
  Optical blur / jawta light pulse / Decimen fountain QR+glyph transfer.
  Screen→camera air-gap data (no network). Triggers: optical blur, jawta light,
  optical transfer, light pulse, fountain QR, glyph embed, air-gap light.
---

# Optical blur · jawta light · fountain transfer

**fc-optical-transfer-v1** — payload as light only.

**Primary surface is `/watch`** — the live-watch modal half-block **is** the optical TX display (not only external HTML).

References:

- Jawta light pulse: https://mueee.qbitos.ai/jawta-audio.html  
- Decimen fountain QR: https://github.com/bashalarmistalt/decimen-optical-transfer  

## In Grok

```text
/optical                 # open /watch optical blur surface
/optical light sos       # jawta light mode on /watch
/optical popout hello    # /watch + OS browser send.html
/watch optical           # same surface from /watch
/watch popout optical    # /watch + OS display
# while /watch optical open:  o = OS browser pop-out · Esc closes TTY
```

## Decimen fountain QR (load-tested browser)

Vendored from [bashalarmistalt/decimen-optical-transfer](https://github.com/bashalarmistalt/decimen-optical-transfer) (MIT):

```bash
bash scripts/live-demux/optical-transfer/decimen.sh dev     # HTTPS Vite
# send:    https://127.0.0.1:5173/send/
# receive: https://<LAN>:5173/receive/   # phone — accept cert once
bash scripts/live-demux/optical-transfer/decimen.sh build   # rebuild dist/
```

In Grok: **`/optical qr`** or **`/optical decimen`** → starts Decimen + `/watch` surface.

### Broadcast + bloomberg mix-pipe

```bash
bash scripts/live-demux/optical-transfer/mix-pipe.sh bloomberg   # ffplay + mix.jpg + mask
# Decimen: https://127.0.0.1:5173/send/?mix=watch   composite=broadcast
# TX only in lower-third / pillars; talent occluded (mask.png)
# SAM later: MIX_SAM_CMD='…'  writes MIX_MASK from MIX_SNAP
```

| Mode | Use |
|------|-----|
| **blur** | Soft field + jawta OOK on **/watch** |
| **light** | Full-field jawta dit/dah on **/watch** |
| **qr / decimen** | **BashAlarmist Decimen** browser QR (real throughput path) |
| **popout** | OS display (qr→Decimen) |
| **serve / test** | Shell helpers |

## With cast / cam

```text
/optical popout
# optional: /cast http://<LAN>:8767/send.html?mode=blur

# phone RX
http://<LAN>:8767/receive.html → Start camera
```

## Pulse library

`sos` `cq` `sync` `beacon` `ack` `nack` `ping` `heartbeat` `73` `88` …

## See also

`scripts/live-demux/optical-transfer/README.md`  
Skills: cam · cast · lens · phone  
