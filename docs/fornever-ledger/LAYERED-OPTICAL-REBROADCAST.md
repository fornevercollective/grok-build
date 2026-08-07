# Layered optical re-broadcast · Mac Mini budget

| | |
|--|--|
| **Feature** | `fc-layered-optical-v1` |
| **Host** | Apple M4 Mac Mini (lab) |
| **Human path** | Live re-broadcast (Bloomberg / news / any `/watch` stream) |
| **Machine path** | Camera / phone / glasses decode **side-channel layers** from the same raster |
| **Explicit only** | No auto-start on Grok boot |

## Goal

A viewer can watch a **normal** live feed. A second device aimed at the screen (or a glasses passthrough of the same image) recovers **alternative media / packets** encoded in layers that look like broadcast chrome, soft blur, anaglyph ghosting, AI-style watermarks, or stego whitespace in companion docs/prompts.

```
yt-dlp → ffmpeg 15fps 960w MJPEG ──► ffplay (human)
                 │
                 ├── mix.mjpg / mix.jpg
                 ├── mask.png (SAM / MediaPipe / heuristic talent occlude)
                 └── layered compositor → rebroadcast.mjpg
                           │
         ┌─────────────────┼──────────────────┐
         │                 │                  │
    fountain QR      pulse / OOK         watermark LSB
    (Decimen)        (jawta light)       (Meta/Google-class)
         │                 │                  │
         └──── camera / phone / glasses RX ───┘
```

## Broadcast layout regions (TX free vs occlude)

From `broadcast_layout.py` (16:9 news):

| Region | Role | Approx free area (960×540) |
|--------|------|----------------------------|
| lower_third | primary TX plate | ~0.96×0.18 ≈ **17%** frame |
| ticker | secondary strip | ~10% |
| left/right pillars | side bars | ~2×(0.10×0.62) ≈ **12%** |
| bug | corner QR beacon | ~1.7% |
| logo_sphere | strobe bug | ~0.4% |
| talent | **occlude** (SAM) | center talking head |

**Practical free TX pixels (after talent occlude):** ~35–45% of frame for modular codes; rest is picture + face.

## Channel classes & realistic budgets

Assumptions for **screen→camera** (phone propped ~40–60 cm, 1080p capture, autofocus stable):

| Layer | Human appearance | Carrier | Practical FPS | Payload / frame | Sustained throughput | Notes |
|-------|------------------|---------|---------------|-----------------|----------------------|-------|
| **A. Fountain QR (Decimen)** | Visible QR plate in L3/bug | QR v27–v40 + LT | **12–24** TX | 1.4–3.0 KB | **15–50 KB/s** handheld · **80–186 KB/s** propped (parent experiment ceiling) | Best hard packet path |
| **B. Glyph grid** | Pixel modules / finder corners | custom grid | 10–15 | 0.5–2 KB | 5–25 KB/s | Needs CV threshold |
| **C. Jawta light / pulse** | Full-field or L3 flicker | OOK luminance | 5–20 WPM-class | few bits | **5–50 bit/s** | Beacon / SOS / control plane |
| **D. Anaglyph ghost** | Red/cyan residual | R−B chroma | 10–15 | 50–200 B | 0.5–3 KB/s | Glasses or split-channel cam |
| **E. Visible boxes** | Soft HUD rects | edge / ID codes | 5–10 | 20–100 B | 0.1–1 KB/s | Robust, low density |
| **F. Occluded object fill** | Texture **behind** talent (mask inverse) | only free mask | 5–15 | varies | depends on free px | SAM quality critical |
| **G. Side bar barcode** | Pillar strips | 1D / thin QR | 15–30 | 100–400 B | 2–10 KB/s | Stable geometry |
| **H. Quick pulse overlays** | 1–3 frame flashes | temporal burst | bursts | 32–256 B | duty-cycle limited | Sync + key frames |
| **I. AI watermark class** | Near-invisible | see below | continuous | ~0.01–1 bit/px effective | **0.1–5 KB/s** over 960×540@15 if aggressive; **<<1 KB/s** if “imperceptible” | Training-data / forensic style |

### I. Watermark / signal-distortion class (Meta / Google-like)

Not claiming product parity — **order-of-magnitude** for a **re-encode → display → camera** chain:

| Style | Human detectability | Bits / frame (est.) | @15 fps | Survives phone cam? |
|-------|---------------------|---------------------|---------|---------------------|
| Meta-class **imperceptible** spectral / spatial watermark | very low | 50–500 | ~0.1–1 KB/s | often **no** after MJPEG + cam |
| Google-class **SynthID-ish** soft blur / texture | low–med | 100–2k | ~0.2–4 KB/s | partial |
| **Visible soft QR / fuzzy modules** (our “fuzz”) | med | 0.5–3 KB | **7–45 KB/s** | yes (design intent) |
| **LSB in DCT of rebroadcast H.264** (not optical) | invisible on clean decode | high | **10–100+ KB/s** digital-only | N/A for glasses optical |

**Mac Mini M4** can run **multiple layers in parallel** on the compositor (CPU) while ffmpeg/ffplay handle the program path. Bottleneck is **optical channel SNR**, not Mini CPU, until SAM2 full quality at >5 Hz.

### Segment Anything live

| Mask path | Update rate | Quality | Mini cost |
|-----------|-------------|---------|-----------|
| Heuristic oval | every frame free | low | free |
| MediaPipe selfie | ~3–8 Hz | good heads | light |
| **SAM-lite** (color + edge + oval, OpenCV) | 2–5 Hz | ok news | light |
| FastSAM / SAM2 (optional `MIX_SAM_CMD`) | 1–3 Hz | best | heavy GPU/ANE |

`MIX_MASK_EVERY=8` at 15 fps mix ≈ **~1.9 Hz** mask refresh (matches SAM cadence).

## Combined multi-layer stack (recommended Mini test)

| Layer | Duty | Target rate |
|-------|------|-------------|
| Program video | always | 15 fps 960w H.264/MJPEG human path |
| SAM mask | every 8 frames | person occlude |
| Decimen QR in L3 | continuous | 12–24 fps plate |
| Side-bar thin code | continuous | 15 fps |
| Pulse sync | 1 Hz burst | 8–16 bytes session id |
| Soft watermark residual | continuous | low rate integrity hash |

**Optimistic stacked optical (propped phone, good light):**  
~**40–100 KB/s** if QR is primary + thin bars.  
**Conservative live news (handheld, motion):**  
~**5–20 KB/s** usable.  
**Pulse-only control plane:**  
**bits/s**, not files.

## Whitespace / stego glyph in prompts & documents

Separate channel: **text**, not video. Survives copy-paste into many UIs; often stripped by LLM tokenizers or markdown normalizers.

| Technique | Glyphs | Bits / char slot | 1k tokens (~4k chars) | 10-page doc (~30k chars) | Survives LLM? |
|-----------|--------|------------------|------------------------|---------------------------|---------------|
| Trailing spaces (0x20) | space vs none EOL | 1 bit/line | tens of bits | hundreds | often stripped |
| NBSP (U+00A0) vs space | 2-way | 1 bit/space | ~0.1–0.5 KB | ~1–3 KB | sometimes |
| Zero-width (ZWSP U+200B, ZWNJ, ZWJ, WJ) | 4-way | 2 bit/insert | **0.5–2 KB** dense | **5–15 KB** | **often stripped by tokenizers** |
| Homoglyph Latin/Cyrillic | large alphabet | ~1–3 bit/letter | high if full rewrite | high | visible to careful humans |
| Variation selectors / emoji ZWJ | complex | high | high | high | fragile |
| Markdown / HTML comment | block | free | unlimited in raw file | unlimited | not in plain chat |
| Unicode tags (U+E0001…) | stealth | high | high | high | frequently filtered |

**Practical “standard prompt” stego (chat box, ~500–2000 visible chars):**

- **Safe-ish:** 20–80 bits via rare NBSP / double-space patterns (metadata only).  
- **Aggressive ZW inserts:** 200–2000 bytes before filters kill it.  
- **Document paste (Word/Google Docs before export):** multi-KB via mixed whitespace + soft hyphen (U+00AD).  
- **After LLM round-trip:** assume **near-zero** zero-width survival; prefer **visible** structured fields or attached binary.

Tool: `scripts/live-demux/optical-transfer/whitespace_steno.py`

## Mac Mini one-shot

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build   # or clone path
bash scripts/live-demux/optical-transfer/mini-layered-test.sh bloomberg
# optional: --no-ffplay  ·  --decimen  ·  --seconds 60
```

Artifacts under `~/.panda/vision/cast/`:

| File | Role |
|------|------|
| `mix-pipe.json` | stream status + mask method |
| `mix-latest.jpg` | last program frame |
| `mix-mask.png` | talent occlude |
| `mix-regions.json` | TX boxes |
| `layered-budget.json` | live measured FPS + channel estimates |
| `layered-preview.mjpg` | composite with debug overlays (if enabled) |

## Non-goals

- Covert misuse / bypassing content policies.  
- Claiming Meta/Google watermark reverse-engineering.  
- Silent cast or auto camera start.

## Related

- `scripts/live-demux/optical-transfer/README.md`  
- `MINI.md` · skill **optical** · mix-pipe · Decimen vendor  
- CAST-TV wall if rebroadcast goes to TCL / Hisense


## Live Mini measurement (M4 lab)

Captured during bloomberg mix-pipe + layered_fuzz smoke:

| Metric | Value |
|--------|-------|
| Composite FPS | **20.68** |
| Free mask frac (SAM-lite) | **0.531** |
| Stacked modular estimate | **3.45 KB/s** |
| L3 modules / frame | 137 B |
| Watermark-noise / frame | 24 B |
| Decimen literature ceiling | 128 KB/s handheld · 186 KB/s propped |

Simple module grid is **not** fountain QR — real Decimen plates should approach the literature ceiling when the phone is propped and AF is stable.

