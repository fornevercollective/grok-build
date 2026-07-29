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
