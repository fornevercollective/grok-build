# fc-optical-transfer · optical blur tool

**Jawta light pulse** (air-gap optical TX from [jawta-audio](https://mueee.qbitos.ai/jawta-audio.html))  
+ **Decimen fountain QR** — **vendored load-tested browser app** from  
  [bashalarmistalt/decimen-optical-transfer](https://github.com/bashalarmistalt/decimen-optical-transfer) (MIT)  
+ fc half-block `/watch optical` surface + jawta light.

**QR path = their built PoC** (`vendor/decimen-optical-transfer`, `npm run build` → `dist/`).  
Do not use simplified glyph stubs for real transfers — use Decimen send/receive.

Payload travels as **light only** — screen → camera. No network path between devices.

## Modes

| Mode | Human sees | Camera recovers |
|------|------------|-----------------|
| **blur** (default tool) | Soft bokeh / optical blur field + mild jawta flicker | Mean luminance OOK **and** corner glyph/QR fountain frames |
| **light** | Full-screen jawta dit/dah beam | Luminance threshold → morse |
| **qr** | Animated QR fountain | BarcodeDetector / zxing peel |
| **glyph** | Pixel-module grid (finder corners) | OpenCV/threshold or import JSONL |

Protocol magic `0xD1 0x0C` — Decimen-compatible 20-byte self-describing frames + Luby transform.

## Primary surface: `/watch`

Optical TX is a **first-class live-watch surface** (half-block inside Grok), not only external HTML:

```text
/optical                 # open /watch optical blur
/watch optical light sos
/optical popout hello    # /watch + OS browser (o key same)
# in modal: o = OS display · Esc closes TTY
```

## Layered rebroadcast (Bloomberg + SAM + multi-channel fuzz)

Mac Mini / M4 path for **human live re-broadcast** + **machine-readable side channels**
(anaglyph, L3 modules, side bars, pulse, soft watermark noise, alt still in free mask):

```bash
bash scripts/live-demux/optical-transfer/mini-layered-test.sh bloomberg --seconds=45
# mix:     http://127.0.0.1:8790/mix.mjpg   (+ optional ffplay)
# layered: http://127.0.0.1:8791/preview.mjpg
# budget:  http://127.0.0.1:8791/budget.json
# stop:    bash scripts/live-demux/optical-transfer/mini-layered-test.sh stop
```

Whitespace / glyph capacity (prompts & documents):

```bash
python3 scripts/live-demux/optical-transfer/whitespace_steno.py matrix
python3 scripts/live-demux/optical-transfer/whitespace_steno.py budget
```

Capacity tables + watermark class notes:  
`docs/fornever-ledger/LAYERED-OPTICAL-REBROADCAST.md`

## Quick start (shell)

```bash
# unit test (no cam)
bash scripts/live-demux/optical-transfer/optical-transfer.sh test

# *** Decimen load-tested fountain QR (browser) ***
bash scripts/live-demux/optical-transfer/decimen.sh dev
# laptop:  https://127.0.0.1:5173/send/
# phone:   https://<LAN>:5173/receive/  (accept self-signed cert once)
# rebuild: bash …/decimen.sh build

# optical blur / jawta (fc UI)
bash scripts/live-demux/optical-transfer/optical-transfer.sh light sos
bash scripts/live-demux/optical-transfer/optical-transfer.sh serve
```

Python CLI:

```bash
python3 scripts/live-demux/optical-transfer/optical_blur.py test
python3 scripts/live-demux/optical-transfer/optical_blur.py blur --text 'FC' --serve-inline --open
python3 scripts/live-demux/optical-transfer/optical_blur.py light --pulse beacon --wpm 20
python3 scripts/live-demux/optical-transfer/optical_blur.py glyph --file ./note.bin --ffplay
python3 scripts/live-demux/optical-transfer/optical_blur.py rx --mode light
```

## State / pipes

| Path | Role |
|------|------|
| `~/.panda/vision/cast/optical-pipe.jsonl` | event log |
| `~/.panda/vision/cast/optical-state.json` | last event |
| `~/.panda/vision/cast/optical-blur.ppm` | live PPM TX (blur/light) |
| `~/.panda/vision/cast/optical-tx-payload.json` | browser payload handoff |

## Cast / cam integration

```bash
# TX on laptop, cast the serve URL to TV (explicit)
bash scripts/live-demux/optical-transfer/optical-transfer.sh serve
# /cast http://<LAN>:8767/send.html?mode=blur

# RX: Continuity / phone camera on receive.html
# or: python3 optical_blur.py rx --mode light  (watches optical-blur.ppm)
```

With `/cam` optic star style: keep **corner embed only** so subject core stays clean; blur mode already stamps glyph BR.

## Pulse library (jawta)

`sos` `cq` `qth` `qsl` `73` `88` `qrz` `rst` `beacon` `sync` `ack` `nack` `ping` `heartbeat`

## Design notes

1. Fountain frames: any order · ~K·1.15 distinct · progress = frames collected.  
2. Jawta light: PARIS WPM dits · full-field luminance OOK.  
3. Optical blur: soft gradients for humans; OOK lift + corner modules for machines.  
4. Secure context required for phone `getUserMedia` (use HTTPS hub or localhost).  
5. QR library optional (`cast-align/qrcode-generator.js` served at `/qrcode-generator.js`).

## Layout

```
optical-transfer/
  protocol.py           # LT + jawta morse (Python · interop)
  optical_blur.py       # CLI blur/light/glyph
  optical-transfer.sh   # launcher
  decimen.sh            # **Decimen** (load-tested QR browser)
  vendor/decimen-optical-transfer/   # upstream MIT (BashAlarmist)
    dist/               # built send/ + receive/ + zxing wasm
    send/ receive/ shared/  # source (Vite + qrcode + zxing-wasm)
  send.html / receive.html  # fc blur/light UI (not the QR throughput path)
  light-tx.html
  README.md
```
