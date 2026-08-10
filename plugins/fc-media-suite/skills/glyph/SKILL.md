---
name: glyph
description: >
  /glyph plant engine — dense peel, quantum-lift, layered broadcast TX/RX,
  encode/decode, live translation desk, webgrid. Universal via `fcs glyph`
  for any terminal and any AI. Triggers: /glyph, fcs glyph, glyph peel,
  quantum-lift, ugrad-arena mode=glyph, glyph broadcast, glyph translate.
---

# /glyph · fc-glyph-engine-v1

**Universal (any terminal · any AI):** `fcs glyph …`  
Not Grok-only. Nested alias still works: `/watch glyph`.

## Surfaces (:8790 paper/lab)

| Surface | URL |
|---------|-----|
| **Arena Glyph** | http://127.0.0.1:8790/ugrad-arena.html?mode=glyph |
| **Live translation** | http://127.0.0.1:8790/lang-chat-desk.html?from=en&to=es,fr,ja&v=27relay |
| **Webgrid** | http://127.0.0.1:8790/webgrid-ugrad.html |
| **Agent contract** | http://127.0.0.1:8790/llms-glyph.txt |
| **Manifest** | http://127.0.0.1:8790/data/glyph/manifest.json |

Soft Path owns **:8765/8766** — do not bind glyph there.

## Commands

```bash
# any terminal / any agent
fcs glyph
fcs glyph arena
fcs glyph peel                 # TTY dense peel (real Terminal)
fcs glyph popout [URL]         # agent-safe: quantum-lift + arena
fcs glyph lift 'https://…'
fcs glyph broadcast bloomberg  # layered rebroadcast + glyph TX budget
fcs glyph color chroma turbo   # dense color update (anaglyph|hsv|…)
fcs glyph glyphy               # video pop-out + anaglyph/magma arena
fcs glyph glyphy /path/to.mp4  # same with local MPEG-4 / MOV
fcs glyph multiband            # one image → all TX/RX versions · packet striping
fcs glyph stripe --langs=es,fr,ja
# lab: http://127.0.0.1:8790/multiband-glyph.html
# bridges: lang-shadow-entity.html?compose=1 · lang-chat-desk.html?boot=0&provider=live
fcs glyph encode "hello"
fcs glyph decode
fcs glyph translate from en to es,fr,ja
fcs glyph webgrid
fcs glyph stack                # arena + language + webgrid
fcs glyph soak 30              # doctor · color cycle · contracts
fcs glyph tx | rx
fcs glyph doctor

# plain shell after fcs install
/glyph
/glyph color chroma
/glyph peel
/glyph soak 30
/glyph broadcast bloomberg
/glyph translate from en to es,fr,ja

# launch script
bash scripts/launch-glyph.sh
bash scripts/launch-glyph.sh popout
bash scripts/live-demux/glyph-watch-popout.sh [URL]
```

## What each path does

| Action | Role |
|--------|------|
| **arena** | DINOv3-style dense peel lab + glyph tools form |
| **color** | Dense color scoring update · heat palette · BC `color_update` |
| **peel** | TTY half-block dense grid (control plane seat) |
| **popout / lift** | yt-dlp → ffmpeg HW → ffplay · multiplex rubik/bloch/glyph_dense/tensor |
| **broadcast** | Layered optical rebroadcast (human program + machine glyph/QR/pulse layers) |
| **encode / decode** | Capacity/steno + arena synth + last-lift ticket |
| **translate** | lang-chat-desk multi-lang fanout + glyph strip |
| **webgrid** | Offline ugrad chase (same as `/webgrid`) |
| **soak** | Doctor + HTTP contracts + color cycle + steno report |
| **stack** | Open arena + translation + webgrid together |

## Color update (`ugrad-arena-v1.7`)

| Color mode | Scoring |
|------------|---------|
| `hybrid` | luma + RGB + chroma (+ anaglyph/hsv blend) |
| `luma` | Rec.709 energy + gradient |
| `rgb` | per-channel variance |
| `chroma` | distance-from-gray |
| `anaglyph` | \|R−B\| residual (optical R/B seat) |
| `hsv` | hue/sat score |

| Heat map | Palette |
|----------|---------|
| `fc` | navy → teal → lime → amber → magenta |
| `turbo` | turbo-like |
| `viridis` | viridis |
| `magma` | magma |

```bash
fcs glyph color chroma turbo
# opens: …/ugrad-arena.html?mode=glyph&color=chroma&heat=turbo&synth=1&color_update=1
# pack: ~/.panda/packs/glyph-color-latest.json
# BC: ugrad-glyph-dense · ugrad-glyph-tools · mg-glyph-flow
```

## Encode · decode · broadcast speed

Layered budget (order-of-magnitude, screen→camera):

| Layer | Practical throughput |
|-------|----------------------|
| Fountain QR (Decimen) | ~15–50 KB/s handheld · up to ~80–186 KB/s propped |
| Glyph grid modules | ~5–25 KB/s |
| Jawta light / pulse | ~5–50 bit/s control |
| Soft watermark / fuzz | ~0.1–5 KB/s class |

Honesty: **lab BPS ≠ ARC %** · **glyph tickets ≠ Decimen bulk** · peel XOR race.

```bash
# capacity tools
python3 scripts/live-demux/optical-transfer/whitespace_steno.py budget
bash scripts/live-demux/optical-transfer/mini-layered-test.sh bloomberg --seconds=45
# preview: http://127.0.0.1:8791/preview.mjpg
```

## Live translation bridge

```bash
fcs glyph translate from en to es,fr,ja
python3 scripts/language/lang-chat-bridge.py say "hello everyone" \
  --from en --to es,fr,ja --aggregate
```

Browser:

```js
const D = window.__fcLanguageDesk
D.setLangs('en', ['es','fr','ja'])
await D.fanout('hello everyone')
D.openGy('glyph')
```

## Agent rules

1. Prefer **`fcs glyph`** — do not reimplement peel/lift in chat.
2. Non-TTY / CI / agent shells → `popout` · `stack` · `translate` (never hung TUI).
3. TTY peel needs real Terminal + fornevercollective binary.
4. Ports: paper/lab **:8790** · layered preview **:8791** · Soft Path **:8765 reserved**.

## Pack bus

- `~/.panda/packs/glyph-engine-latest.json`
- `~/.panda/packs/last-lift.json`
- `~/.panda/packs/language-chat-latest.json`

## See also

- `/watch glyph` — nested plant path (`fc-glyph-watch-v1`)
- `/optical` — blur / jawta / Decimen fountain
- `/language` — multi-lang desk
- `/webgrid` — offline chase
- `docs/fornever-ledger/LAYERED-OPTICAL-REBROADCAST.md`
