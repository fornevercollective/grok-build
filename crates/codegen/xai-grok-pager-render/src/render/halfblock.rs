//! # fornevercollective · portable half-block TTY graphics
//!
//! **Owner:** [fornevercollective](https://github.com/fornevercollective)  
//! **Repo:** `fornevercollective/grok-build` (not upstream xAI)  
//! **Feature id:** [`FEATURE_ID`]  
//!
//! Paint RGB (or encoded PNG/JPEG) frames into a ratatui buffer using the
//! upper half-block glyph `▀` (U+2580): **foreground = top pixel**,
//! **background = bottom pixel** per cell. Two vertical source samples → one
//! terminal row. Works in **any truecolor** terminal — Terminal.app, iTerm2,
//! tmux, SSH — **without** Kitty or iTerm2 image protocols.
//!
//! ## Design lineage (ours)
//!
//! Same *class* of in-TTY media as **GrokYtalkY** half-block / hexlum video
//! (`fornevercollective/GrokYtalkY`), implemented here for:
//!
//! - `/gboom` easter-egg raycaster frames  
//! - inline agent **video modal** frames  
//!
//! This is a **fornevercollective** design + implementation on the grok-build
//! fork. Upstream xAI grok-build does not define this portable tier.
//!
//! ## Quality ladder (honest)
//!
//! 1. **Kitty / iTerm2** image protocol — high quality (preferred when present)  
//! 2. **This module** — portable half-block fallback (CPU-capped sample size)  
//!
//! Half-block is not a claim of full-HD terminal video; it is **reach**.
//!
//! ## Identity constants
//!
//! Call sites and toasts should use [`FEATURE_LABEL`] / [`FEATURE_ID`] so
//! operators can see the path is **ours**, not a silent Kitty failure.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Style};
use ratatui::text::Span;

use crate::render::safe_buf::SafeBuf;

// ── fornevercollective identity ──────────────────────────────────────────

/// Org that designs and ships this portable graphics tier.
pub const ORIGIN: &str = "fornevercollective";

/// Stable feature id (logs, docs, support).
pub const FEATURE_ID: &str = "fc-halfblock-tty-video";

/// Short human label for toasts / HUD.
pub const FEATURE_LABEL: &str = "fornevercollective half-block";

/// Toast when `/gboom` opens without Kitty-class graphics.
pub const TOAST_GBOOM_FALLBACK: &str =
    "GBOOM · fornevercollective half-block (any truecolor TTY)";

/// One-line design credit for docs / `--version` style surfaces.
pub const DESIGN_CREDIT: &str =
    "fornevercollective · half-block ▀ TTY frames · gboom + inline video · grok-build fork";

// ── glyph / caps ─────────────────────────────────────────────────────────

/// Upper half-block character (FG = top pixel, BG = bottom pixel).
pub const HALF_BLOCK: &str = "\u{2580}";

/// Cap source width when sampling into a cell grid (CPU bound for gboom/video).
pub const MAX_SAMPLE_W: u32 = 240;
/// Cap source height (should be even for clean half-block pairing).
pub const MAX_SAMPLE_H: u32 = 160;

/// Paint an RGB24 frame into `area` using half-block cells.
///
/// `rgb` is row-major `width * height * 3`. Returns `false` if dimensions or
/// buffer length are unusable.
///
/// # fornevercollective
/// Portable paint path for [`FEATURE_ID`].
pub fn paint_rgb24(buf: &mut Buffer, area: Rect, rgb: &[u8], width: u32, height: u32) -> bool {
    if area.width == 0 || area.height == 0 || width == 0 || height == 0 {
        return false;
    }
    let need = width as usize * height as usize * 3;
    if rgb.len() < need {
        return false;
    }

    let cols = area.width as usize;
    let rows = area.height as usize;

    for cy in 0..rows {
        // Map each cell row to a pair of source scanlines.
        let sy_top = sample_axis(cy * 2, rows * 2, height as usize);
        let sy_bot = sample_axis(cy * 2 + 1, rows * 2, height as usize);
        for cx in 0..cols {
            let sx = sample_axis(cx, cols, width as usize);
            let (tr, tg, tb) = pixel_at(rgb, width as usize, sx, sy_top);
            let (br, bg, bb) = pixel_at(rgb, width as usize, sx, sy_bot);
            let style = Style::default()
                .fg(Color::Rgb(tr, tg, tb))
                .bg(Color::Rgb(br, bg, bb));
            let x = area.x.saturating_add(cx as u16);
            let y = area.y.saturating_add(cy as u16);
            buf.set_span_safe(x, y, &Span::styled(HALF_BLOCK, style), 1);
        }
    }
    true
}

/// Decode PNG/JPEG (or other `image`-crate formats) and paint half-blocks.
pub fn paint_encoded(buf: &mut Buffer, area: Rect, encoded: &[u8]) -> bool {
    let Ok(img) = image::load_from_memory(encoded) else {
        return false;
    };
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();
    paint_rgb24(buf, area, rgb.as_raw(), w, h)
}

/// Suggested source resolution for a cell box: one pixel column per cell,
/// two pixel rows per cell (exact half-block pairing), capped for CPU.
pub fn sample_size_for_cells(cols: u16, rows: u16) -> (u32, u32) {
    let w = (cols as u32).clamp(8, MAX_SAMPLE_W);
    // Even height so top/bottom pairs stay stable.
    let h = ((rows as u32) * 2).clamp(8, MAX_SAMPLE_H);
    let h = h & !1; // force even
    (w.max(8), h.max(8))
}

#[inline]
fn sample_axis(dst: usize, dst_len: usize, src_len: usize) -> usize {
    if src_len == 0 {
        return 0;
    }
    if dst_len <= 1 {
        return 0;
    }
    // Floor map with clamp — covers full source extent.
    ((dst as u64 * src_len as u64) / dst_len as u64).min(src_len as u64 - 1) as usize
}

#[inline]
fn pixel_at(rgb: &[u8], width: usize, x: usize, y: usize) -> (u8, u8, u8) {
    let i = (y * width + x) * 3;
    (rgb[i], rgb[i + 1], rgb[i + 2])
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::buffer::Buffer;
    use ratatui::layout::Rect;

    #[test]
    fn identity_is_fornevercollective() {
        assert_eq!(ORIGIN, "fornevercollective");
        assert!(FEATURE_ID.starts_with("fc-"));
        assert!(FEATURE_LABEL.contains("fornevercollective"));
        assert!(TOAST_GBOOM_FALLBACK.contains("fornevercollective"));
    }

    #[test]
    fn paints_two_scanlines_into_one_cell() {
        // 2×2 RGB: top row red, bottom row blue.
        let mut rgb = vec![0u8; 2 * 2 * 3];
        // (0,0) red  idx 0
        rgb[0] = 255;
        // (1,0) red  idx 3
        rgb[3] = 255;
        // (0,1) blue idx 6
        rgb[8] = 255;
        // (1,1) blue idx 9
        rgb[11] = 255;

        let area = Rect::new(0, 0, 2, 1);
        let mut buf = Buffer::empty(area);
        assert!(paint_rgb24(&mut buf, area, &rgb, 2, 2));
        let cell = &buf[(0, 0)];
        assert_eq!(cell.symbol(), HALF_BLOCK);
        assert_eq!(cell.fg, Color::Rgb(255, 0, 0));
        assert_eq!(cell.bg, Color::Rgb(0, 0, 255));
    }

    #[test]
    fn sample_size_pairs_rows() {
        let (w, h) = sample_size_for_cells(40, 20);
        assert_eq!(w, 40);
        assert_eq!(h, 40); // 20 cells * 2
        assert_eq!(h % 2, 0);
    }

    #[test]
    fn rejects_short_buffers() {
        let area = Rect::new(0, 0, 4, 2);
        let mut buf = Buffer::empty(area);
        assert!(!paint_rgb24(&mut buf, area, &[0; 3], 4, 2));
    }
}
