# fornevercollective · GBOOM + TTY video half-block

| | |
|--|--|
| **Owner** | **fornevercollective** |
| **Repo** | https://github.com/fornevercollective/grok-build |
| **Branch** | `patch/gboom-halfblock-video` |
| **Feature id** | `fc-halfblock-tty-video` |
| **Module** | `xai-grok-pager-render::render::halfblock` |
| **Not** | Upstream xAI-only Kitty path · not a cloud stream product |

## Design credit

**Designed and implemented by fornevercollective** on the grok-build fork so that:

1. **`/gboom`** runs on **any truecolor terminal** (Terminal.app, iTerm2, tmux, SSH).  
2. **Inline video** (agent media modal) plays the same way when Kitty/iTerm image protocol is missing.  
3. Kitty/iTerm remains the **high-quality tier** when present — half-block is the **portable fallback**, not a downgrade of the protocol path.

**Lineage:** same *class* of in-TTY graphics as **GrokYtalkY** half-block / hexlum video  
(`fornevercollective/GrokYtalkY`). GY mesh cast is **not** required to play.

**Identity constants (code):**

```text
ORIGIN          = "fornevercollective"
FEATURE_ID      = "fc-halfblock-tty-video"
FEATURE_LABEL   = "fornevercollective half-block"
TOAST_GBOOM_FALLBACK = "GBOOM · fornevercollective half-block (any truecolor TTY)"
```

## What ships

| Area | Behavior |
|------|----------|
| **`/gboom` open** | Always opens on the agent view. Kitty when available; else half-block + **owned** toast. |
| **GBOOM paint** | Prefer Kitty PNG post-flush; on failure → RGB raycast → half-block cells. |
| **Video modal** | `open_from_path` does not require a graphics protocol. Frames extract as PNG; Kitty if possible, else half-block. |
| **Poster frames** | PNG extract works with `GraphicsProtocol::None`. |

## Modules (ours)

| Path | Role |
|------|------|
| `crates/.../render/halfblock.rs` | **FC** RGB24 / encoded → `▀` cells + identity constants |
| `gboom::GboomState::paint_half_blocks` | Game frames → half-block |
| `prompt_images::VideoViewerState::paint_half_blocks` | Video frames → half-block |
| `dispatch_open_gboom` | Toast uses `halfblock::TOAST_GBOOM_FALLBACK` |
| agent_view render | Fallback paint when protocol placement fails |

## Honesty

| Is | Is not |
|----|--------|
| Portable in-TTY motion for demos + easter egg | Broadcast streaming / multi-user CDN |
| Reach for non-Kitty terminals | Full-HD terminal video claim |
| Fork differentiator for **fornevercollective/grok-build** | Upstream xAI default |
| Feature identity + portability + boundary | A **performance number** without a paint stamp |

**Public claims without timings:** identity + portability + boundary only.  
**Public claims with timings:** only after a real [`halfblock` paint stamp](#paint-timings-fold-metrics) (p50/p95 over N frames).

## Paint timings (fold metrics)

Same spirit as KBatch fold metrics: instrument paint, fold ring, publish stamp.

| Piece | Role |
|-------|------|
| `render/halfblock.rs` | `Instant` around `paint_rgb24`; ring of last N samples |
| `GboomState::paint_half_blocks` | Records **raycast**, **halfblock_paint**, **frame_total** |
| Stamp schema | `fc-halfblock-paint-timings-v1` JSON |

### Env

```bash
export HALFBLOCK_PAINT_TIMINGS=1
# optional:
export HALFBLOCK_PAINT_STAMP_EVERY=60          # frames between writes
export HALFBLOCK_PAINT_STAMP_PATH=~/.panda/packs/halfblock-paint-timings.json
```

### Stamp fields (honest publish unit)

| Field | Meaning |
|-------|---------|
| `path` | `half-block` or `kitty` |
| `phase` | `halfblock_paint` · `raycast` · `frame_total` |
| `terminal` | `TERM` · `TERM_PROGRAM` · tmux · columns/lines env |
| `cells` | cols · rows · cell_count |
| `sample_px` | source w×h used for the last sample |
| `frames` | N in ring for that phase |
| `p50_ms` / `p95_ms` / `mean_ms` / `last_ms` | high-res fold |

### API

```rust
use xai_grok_pager_render::render::halfblock::{
    global_snapshot, write_global_stamp, paint_p50_p95_ms,
    paint_stamp_snapshot, last_paint_timing, PaintPhase,
};

// After a /gboom session:
let stamp = global_snapshot(PaintPhase::FrameTotal);
let _path = write_global_stamp(PaintPhase::HalfblockPaint);

// Sketch-compatible helpers (status line / ledger line):
let last = last_paint_timing();                 // cells · path · micros
let (p50, p95) = paint_p50_p95_ms().unwrap_or((0.0, 0.0));
let json = paint_stamp_snapshot();              // feature_id · p50/p95 · honesty note
```

```bash
# auto-write ~/.panda/packs/halfblock-paint-timings.json every 60 frames
export HALFBLOCK_PAINT_TIMINGS=1
# then play /gboom for a few seconds
```

Until a stamp file exists for a known terminal size, do **not** quote fps or ms/frame in public copy.
Honest public line once stamped:

```text
half-block paint p50 ≈ X.X ms · p95 ≈ Y.Y ms
(local truecolor TTY · feature fc-halfblock-tty-video)
```

## Next iteration

**GY TTY placeholders** (`fc-gy-tty-placeholders`): `/gy [burst|wave|chat|pins|tools|stream|…]`  
See [GY-TTY-PLACEHOLDERS.md](./GY-TTY-PLACEHOLDERS.md).

## Try it

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
cargo run -p xai-grok-pager-bin   # or your usual binary package
# in the TUI:
/gboom
# Expect toast if no Kitty: "GBOOM · fornevercollective half-block …"
```

Video: open a media path that uses the inline video viewer (Play) — works without Kitty once frames decode.

## Tests

```bash
cargo test -p xai-grok-pager-render --lib -- halfblock
cargo test -p xai-grok-pager-render --lib gboom::
cargo check -p xai-grok-pager
```

## Publish (our remote only)

```bash
git push -u origin patch/gboom-halfblock-video
# PR into fornevercollective/grok-build main when ready
# Do not present as upstream xAI work
```

## Controls (unchanged)

WASD / arrows move · Space/Enter fire · Esc/q quit · mouse aim when release-aware terminal.
