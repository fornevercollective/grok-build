//! Live-watch layout budget — **80×24 terminal first** + GrokYtalkY multi-chat.
//!
//! GrokYtalkY companion rules we honor:
//! - Real terminal only (never invent a larger canvas) — default **80×24**.
//! - Multi-chat **pin rail** sits *above* the main window (`gy grok` / pins-dock);
//!   Grok only gets the bottom pane — often ~12–16 rows of a 24-row term.
//! - Glyph aesthetic: **25²** tiles (half-block → **25 cols × 13 rows**); on lean
//!   terms drop to **13²** (`term-lean` · ◎13) so nothing is half-clipped.
//! - Video fills the free band; camera is a compact **PiP** (not a full-height
//!   column that steals / obscures the main stream).
//!
//! See `GrokYtalkY/video_scale.go`, `ui_view.go` (renderVideoChrome / FitGlyphDual).

use ratatui::layout::Rect;

/// Classic terminal baseline (GrokYtalkY default).
pub const TERM_LEAN_COLS: u16 = 80;
pub const TERM_LEAN_ROWS: u16 = 24;

/// GY listener square: 25×25 sample → half-block paint needs 25 cols × 13 rows.
pub const GLYPH_N: u16 = 25;
pub const GLYPH_HALF_ROWS: u16 = 13; // ceil(25/2)

/// term-lean dual disk (FitGlyphDual on 80×24).
pub const GLYPH_LEAN_N: u16 = 13;
pub const GLYPH_LEAN_HALF_ROWS: u16 = 7; // ceil(13/2)

/// Minimum stream region when camera is on (cols × half-rows).
const MIN_STREAM_COLS: u16 = 16;
const MIN_STREAM_ROWS: u16 = 4;

/// How camera sits relative to the main stream.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CamMode {
    /// Compact square tile over the stream (default — GY pin aesthetic).
    Pip,
    /// Side column only on wide rooms (does not eat stream height).
    Side,
}

/// Computed regions for one paint of `/watch` video (search bar already split out).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WatchVideoLayout {
    pub stream: Rect,
    pub cam: Option<Rect>,
    pub cam_mode: CamMode,
    /// Suggested RGB capture size for the camera tile (even height).
    pub cam_src_w: u32,
    pub cam_src_h: u32,
    /// Suggested RGB sample size for the main stream paint (even height).
    pub stream_src_w: u32,
    pub stream_src_h: u32,
}

/// Classify terminal budget from the *popup inner* area (not the full TTY).
///
/// `area` is already after Grok chrome + live-watch title/status margins.
pub fn is_lean_term(area: Rect) -> bool {
    area.width <= TERM_LEAN_COLS || area.height <= 16
}

/// Choose camera tile size (cells) matching GY glyph rail.
///
/// - lean (≤80 wide or short height): **13×7** (◎13)
/// - roomier: **25×13** (25² half-block)
/// - large (`/cam`): **48×24** half-block square-ish
///
/// Env override: `LIVE_DEMUX_CAM_TILE=13|25|40|48|64` (cols; rows ≈ ceil(n/2)).
/// Also accepts `WIDTHxHEIGHT` e.g. `56x28`.
pub fn cam_tile_cells(area: Rect) -> (u16, u16) {
    if let Ok(s) = std::env::var("LIVE_DEMUX_CAM_TILE") {
        let s = s.trim();
        if let Some((a, b)) = s.split_once('x').or_else(|| s.split_once('X')) {
            if let (Ok(w), Ok(h)) = (a.parse::<u16>(), b.parse::<u16>()) {
                let w = w.clamp(6, 160);
                let h = h.clamp(3, 80);
                return (w, h);
            }
        }
        if let Ok(n) = s.parse::<u16>() {
            if n > 0 {
                // Named presets + free size: square-ish half-block (cols × ceil(cols/2)).
                let cols = match n {
                    1..=12 => GLYPH_LEAN_N,
                    13..=19 => GLYPH_LEAN_N,
                    20..=32 => GLYPH_N,
                    _ => n.clamp(6, 160),
                };
                let rows = ((cols as u32 + 1) / 2).clamp(3, 80) as u16;
                return (cols, rows);
            }
        }
        // Word presets: large / big / huge
        match s.to_ascii_lowercase().as_str() {
            "lean" | "small" | "mini" => return (GLYPH_LEAN_N, GLYPH_LEAN_HALF_ROWS),
            "glyph" | "pin" | "default" => return (GLYPH_N, GLYPH_HALF_ROWS),
            "large" | "big" | "lg" => return (48, 24),
            "xl" | "huge" | "xlarge" => return (64, 32),
            "xxl" | "max" => {
                // Cap to room: leave ≥16 cols for stream in side mode.
                let cols = area.width.saturating_sub(18).clamp(40, 120);
                let rows = area.height.saturating_sub(1).clamp(12, 60);
                return (cols, rows);
            }
            _ => {}
        }
    }
    if is_lean_term(area) {
        (GLYPH_LEAN_N, GLYPH_LEAN_HALF_ROWS)
    } else {
        (GLYPH_N, GLYPH_HALF_ROWS)
    }
}

/// Prefer PiP unless explicitly forced side, or width is huge and height is short.
pub fn prefer_pip(area: Rect) -> bool {
    if let Ok(s) = std::env::var("LIVE_DEMUX_CAM_LAYOUT") {
        match s.trim().to_ascii_lowercase().as_str() {
            "side" | "column" | "left" => return false,
            "pip" | "overlay" | "inset" | "tile" => return true,
            _ => {}
        }
    }
    // Side column only when we have ≥100 cols and enough height that a 25-col
    // rail does not crush the stream (GY dual needs ~54 cols).
    !(area.width >= 100 && area.height >= 14)
}

/// Layout video + optional camera for the given paint area.
///
/// Camera **never** replaces the main stream band — PiP paints on top after
/// stream so the cam is not obscured. Side mode keeps stream full height.
pub fn layout_watch_video(area: Rect, camera_on: bool) -> WatchVideoLayout {
    if area.width == 0 || area.height == 0 {
        return WatchVideoLayout {
            stream: area,
            cam: None,
            cam_mode: CamMode::Pip,
            cam_src_w: 8,
            cam_src_h: 8,
            stream_src_w: 8,
            stream_src_h: 8,
        };
    }

    if !camera_on {
        let (sw, sh) = src_for_cells(area.width, area.height);
        return WatchVideoLayout {
            stream: area,
            cam: None,
            cam_mode: CamMode::Pip,
            cam_src_w: 8,
            cam_src_h: 8,
            stream_src_w: sw,
            stream_src_h: sh,
        };
    }

    let (tile_w, tile_h) = cam_tile_cells(area);
    let tile_w = tile_w.min(area.width.saturating_sub(2)).max(6);
    let tile_h = tile_h.min(area.height.saturating_sub(1)).max(3);

    if prefer_pip(area) {
        // Bottom-left PiP — clears title chrome, leaves main stream full-bleed.
        // 1-cell margin from edges so border/status do not clip the face.
        let margin = 0u16;
        let cx = area.x + margin;
        let cy = area.y + area.height.saturating_sub(tile_h + margin);
        let cam = Rect::new(cx, cy, tile_w, tile_h);
        let (cw, ch) = src_for_cells(tile_w, tile_h);
        let (sw, sh) = src_for_cells(area.width, area.height);
        return WatchVideoLayout {
            stream: area,
            cam: Some(cam),
            cam_mode: CamMode::Pip,
            cam_src_w: cw,
            cam_src_h: ch,
            stream_src_w: sw,
            stream_src_h: sh,
        };
    }

    // Side column: cam width = tile (glyph width), full height; stream gets rest.
    let gap = 1u16;
    let cam_cols = tile_w
        .min(area.width.saturating_sub(MIN_STREAM_COLS + gap))
        .max(6);
    let stream_cols = area.width.saturating_sub(cam_cols.saturating_add(gap));
    let stream_cols = stream_cols.max(MIN_STREAM_COLS.min(area.width));
    let cam = Rect::new(area.x, area.y, cam_cols, area.height.max(MIN_STREAM_ROWS));
    let stream = Rect::new(
        area.x + cam_cols + gap,
        area.y,
        stream_cols,
        area.height,
    );
    let (cw, ch) = src_for_cells(cam.width, cam.height);
    let (sw, sh) = src_for_cells(stream.width, stream.height);
    WatchVideoLayout {
        stream,
        cam: Some(cam),
        cam_mode: CamMode::Side,
        cam_src_w: cw,
        cam_src_h: ch,
        stream_src_w: sw,
        stream_src_h: sh,
    }
}

/// RGB source size for a cell box (1 col = 1 px wide, 1 row = 2 px tall).
fn src_for_cells(cols: u16, rows: u16) -> (u32, u32) {
    crate::render::halfblock::sample_size_for_cells(cols, rows)
}

/// Popup chrome fill fraction for small terms (use nearly the whole pane).
///
/// On 80×24 / GY-bottom-pane, a 90% centered popup wastes precious rows and
/// makes the camera tile feel buried under margins + stream.
pub fn popup_fill_frac(area: Rect) -> (u32, u32) {
    // (width_pct, height_pct)
    if area.width <= TERM_LEAN_COLS && area.height <= TERM_LEAN_ROWS {
        (100, 100)
    } else if area.height <= 16 || area.width <= 90 {
        (98, 96)
    } else {
        (90, 90)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lean_80x12_uses_pip_13() {
        let area = Rect::new(0, 0, 80, 12);
        assert!(is_lean_term(area));
        assert!(prefer_pip(area));
        let (w, h) = cam_tile_cells(area);
        assert_eq!((w, h), (GLYPH_LEAN_N, GLYPH_LEAN_HALF_ROWS));
        let lay = layout_watch_video(area, true);
        assert_eq!(lay.cam_mode, CamMode::Pip);
        let cam = lay.cam.expect("cam");
        assert_eq!(cam.width, GLYPH_LEAN_N);
        assert_eq!(cam.height, GLYPH_LEAN_HALF_ROWS);
        // stream is full area (PiP overlays)
        assert_eq!(lay.stream, area);
        // cam sits bottom-left
        assert_eq!(cam.x, 0);
        assert_eq!(cam.y, area.height - cam.height);
    }

    #[test]
    fn wide_room_may_side() {
        let area = Rect::new(0, 0, 120, 20);
        assert!(!prefer_pip(area));
        let lay = layout_watch_video(area, true);
        assert_eq!(lay.cam_mode, CamMode::Side);
        let cam = lay.cam.expect("cam");
        assert!(cam.width <= GLYPH_N);
        assert!(lay.stream.width >= MIN_STREAM_COLS);
        assert_eq!(lay.stream.height, area.height);
    }

    #[test]
    fn no_camera_full_stream() {
        let area = Rect::new(0, 0, 80, 14);
        let lay = layout_watch_video(area, false);
        assert!(lay.cam.is_none());
        assert_eq!(lay.stream, area);
    }

    #[test]
    fn popup_fill_on_lean_is_full() {
        let area = Rect::new(0, 0, 80, 24);
        assert_eq!(popup_fill_frac(area), (100, 100));
    }
}
