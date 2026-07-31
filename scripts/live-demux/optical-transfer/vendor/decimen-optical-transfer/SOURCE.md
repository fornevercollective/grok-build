# Vendored source

**Upstream:** https://github.com/bashalarmistalt/decimen-optical-transfer  
**Author:** BashAlarmist  
**License:** MIT (see LICENSE)  
**Fetched:** 2026-07-31  
**Commit:** (shallow clone main @ fetch time)

This is the load-tested browser PoC (fountain-coded animated QR, zxing-wasm
receive, Vite + basic-ssl). Do not replace with simplified glyph stubs —
`npm run dev` / built `dist/` is the production QR path for fc-optical-transfer.

## FC fork deltas (fornevercollective)

- **TV fuzz FPS** default: `29.97` NTSC frame (was cinema `24`).
  Options: `59.94` NTSC field (analog snow), `25`/`50` PAL, rounded `30`/`60`.
- **Field look**: progressive · interlace (odd/even scanline fields) · snow
  (quiet-zone only; modules stay decodable).
- Query: `?fps=59.94&field=interlace` or `?fuzz=1` (29.97).
- UI chrome: CRT scanline overlay (CSS); timing still drives real TX cadence.
- **Dual layer live mix + TX** (2026-07-31):
  - **mix**: demo bloomberg-like color pipe · webcam · `getDisplayMedia` (pipe `/watch bloomberg` window)
  - **transmission**: fountain QR at TV fuzz rate
  - **composite**: underlay (video through white modules) · multiply · soft · stack · pip
  - sliders: mix strength · TX strength · color bleed (slight live chroma on dark modules)
  - white modules stay bright enough, dark modules capped for decode
- **Broadcast isolates** (2026-07-31):
  - Default composite `broadcast`: 16:9 mix full-bleed
  - TX only in L3 / ticker / pillars / bug (finders not on talent)
  - Talent occlusion via `/mask.png` (MediaPipe if installed, else center oval)
  - Regions from `/regions.json` · SAM hook via `MIX_SAM_CMD`
  - `?debug=1` draws isolate outlines
