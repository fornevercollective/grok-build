# GBOOM + video half-block patch

**Branch:** `patch/gboom-halfblock-video`  
**Goal:** Run `/gboom` and in-terminal video on **any** truecolor terminal — not only Kitty/Ghostty/WezTerm — without opening a second window.

## What changed

| Area | Behavior |
|------|----------|
| **`/gboom` open** | Always opens on the agent view. Kitty when available; else half-block (`▀`) + toast *“half-block mode”*. |
| **GBOOM paint** | Prefer Kitty PNG post-flush; on failure → RGB raycast → half-block cells in the popup. |
| **Video modal** | `open_from_path` no longer requires a graphics protocol. Frames extract as PNG; Kitty placement if possible, else half-block decode+paint. |
| **Poster frames** | PNG extract works with `GraphicsProtocol::None` (for half-block / future use). |

## Modules

- `crates/codegen/xai-grok-pager-render/src/render/halfblock.rs` — RGB24 / encoded → `▀` cells  
- `gboom::GboomState::paint_half_blocks`  
- `prompt_images::VideoViewerState::paint_half_blocks` / `current_frame_rgb`  
- Wire-up in `xai-grok-pager` agent render + `dispatch_open_gboom`

## Relation to GrokYtalkY

Same **in-TTY graphics idea** as GY half-block / hexlum (no Kitty). Mesh / `gy grok` / phone cast is **not** required to play. Optional future: publish gboom frames as `.gyst` to a local hub for spectators.

## Try it

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
cargo run -p xai-grok-pager-bin   # or your usual binary package
# in the TUI:
/gboom
```

Video: open a media path that already uses the inline video viewer (Play control) — works without Kitty once frames decode.

## Tests

```bash
cargo test -p xai-grok-pager-render --lib -- halfblock paint_half_blocks
cargo test -p xai-grok-pager-render --lib gboom::
cargo check -p xai-grok-pager
```

## Controls (unchanged)

WASD / arrows move · Space/Enter fire · Esc/q quit · mouse aim when release-aware terminal.
