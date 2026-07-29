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
//! Public claims without a paint stamp: **identity + portability + boundary** —
//! not a performance number. Real p50/p95 require [`PaintTimings`] stamps.
//!
//! ## Paint timings (KBatch-style fold metrics)
//!
//! Each successful [`paint_rgb24`] records a high-resolution duration into a
//! ring. Call [`PaintTimings::snapshot`] / [`write_stamp_if_due`] to publish
//! p50/p95 JSON (see env `HALFBLOCK_PAINT_TIMINGS`).
//!
//! ## Identity constants
//!
//! Call sites and toasts should use [`FEATURE_LABEL`] / [`FEATURE_ID`] so
//! operators can see the path is **ours**, not a silent Kitty failure.

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Style};
use ratatui::text::Span;
use serde::Serialize;

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

/// Default ring length **per phase** for p50/p95 (≈2–4s at 30–60 fps).
///
/// Raycast + halfblock_paint + frame_total share the process; capacity is
/// applied per phase so one path cannot evict another.
pub const PAINT_TIMING_RING: usize = 120;

/// Graphics path label for stamps (this module is always half-block).
pub const PAINT_PATH_HALFBLOCK: &str = "half-block";
/// Kitty/iTerm protocol path (recorded by call sites that used it).
pub const PAINT_PATH_KITTY: &str = "kitty";

// ── paint timings (fold metrics) ─────────────────────────────────────────

/// Which stage was timed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaintPhase {
    /// Half-block cell fill only ([`paint_rgb24`]).
    HalfblockPaint,
    /// GBOOM raycast / RGB framebuffer fill before half-block.
    Raycast,
    /// Combined raycast + half-block for one presented frame.
    FrameTotal,
}

/// One recorded sample.
#[derive(Debug, Clone, Copy)]
struct PaintSample {
    phase: PaintPhase,
    us: u64,
    cols: u16,
    rows: u16,
    src_w: u32,
    src_h: u32,
}

/// Rolling paint timing sample (public-class, local only).
///
/// Sketch-compatible surface: last path + cell count + micros.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct PaintTiming {
    pub cells: u32,
    /// `"kitty"` | `"halfblock"` | `"raycast"` | `"frame_total"`
    pub path: &'static str,
    pub micros: u64,
    pub cols: u16,
    pub rows: u16,
}

/// Rolling paint timings for honest p50/p95 stamps.
#[derive(Debug, Default)]
pub struct PaintTimings {
    samples: VecDeque<PaintSample>,
    capacity: usize,
    frames_since_stamp: usize,
    path_hint: &'static str,
    last: Option<PaintTiming>,
}

impl PaintTimings {
    pub fn new(capacity: usize) -> Self {
        Self {
            samples: VecDeque::with_capacity(capacity.max(8)),
            capacity: capacity.max(8),
            frames_since_stamp: 0,
            path_hint: PAINT_PATH_HALFBLOCK,
            last: None,
        }
    }

    pub fn set_path_hint(&mut self, path: &'static str) {
        self.path_hint = path;
    }

    pub fn last(&self) -> Option<PaintTiming> {
        self.last
    }

    pub fn record(
        &mut self,
        phase: PaintPhase,
        elapsed: std::time::Duration,
        cols: u16,
        rows: u16,
        src_w: u32,
        src_h: u32,
    ) {
        let us = elapsed.as_micros().min(u128::from(u64::MAX)) as u64;
        // Evict oldest sample of *this* phase when at capacity (not global mix).
        let phase_count = self.samples.iter().filter(|s| s.phase == phase).count();
        if phase_count >= self.capacity {
            if let Some(i) = self.samples.iter().position(|s| s.phase == phase) {
                self.samples.remove(i);
            }
        }
        self.samples.push_back(PaintSample {
            phase,
            us,
            cols,
            rows,
            src_w,
            src_h,
        });
        let path = match phase {
            PaintPhase::HalfblockPaint => "halfblock",
            PaintPhase::Raycast => "raycast",
            PaintPhase::FrameTotal => "frame_total",
        };
        self.last = Some(PaintTiming {
            cells: u32::from(cols).saturating_mul(u32::from(rows)),
            path,
            micros: us,
            cols,
            rows,
        });
        if matches!(phase, PaintPhase::HalfblockPaint | PaintPhase::FrameTotal) {
            self.frames_since_stamp = self.frames_since_stamp.saturating_add(1);
        }
    }

    pub fn len(&self) -> usize {
        self.samples.len()
    }

    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    /// Build a stamp for `phase` (filters the ring). Returns `None` if fewer
    /// than 2 samples for that phase.
    pub fn snapshot(&self, phase: PaintPhase) -> Option<PaintTimingStamp> {
        let mut us: Vec<u64> = self
            .samples
            .iter()
            .filter(|s| s.phase == phase)
            .map(|s| s.us)
            .collect();
        if us.len() < 2 {
            return None;
        }
        us.sort_unstable();
        let last = self
            .samples
            .iter()
            .rev()
            .find(|s| s.phase == phase)
            .copied()?;
        let p50 = percentile_us(&us, 50);
        let p95 = percentile_us(&us, 95);
        let sum: u128 = us.iter().map(|&v| v as u128).sum();
        let mean = sum as f64 / us.len() as f64;
        Some(PaintTimingStamp {
            schema: "fc-halfblock-paint-timings-v1",
            origin: ORIGIN,
            feature_id: FEATURE_ID,
            feature_label: FEATURE_LABEL,
            path: self.path_hint,
            phase,
            terminal: TerminalInfo::detect(),
            cells: CellExtent {
                cols: last.cols,
                rows: last.rows,
                cell_count: u32::from(last.cols).saturating_mul(u32::from(last.rows)),
            },
            sample_px: SampleExtent {
                w: last.src_w,
                h: last.src_h,
            },
            frames: us.len(),
            p50_ms: us_to_ms(p50),
            p95_ms: us_to_ms(p95),
            mean_ms: mean / 1000.0,
            last_ms: us_to_ms(last.us),
            ring_capacity: self.capacity,
        })
    }

    /// Write JSON stamp when enough frames have elapsed since last write.
    ///
    /// Controlled by env:
    /// - `HALFBLOCK_PAINT_TIMINGS=1` — enable auto write
    /// - `HALFBLOCK_PAINT_STAMP_PATH` — output file (default
    ///   `~/.panda/packs/halfblock-paint-timings.json`)
    /// - `HALFBLOCK_PAINT_STAMP_EVERY` — frames between writes (default 60)
    pub fn write_stamp_if_due(&mut self, phase: PaintPhase) -> Option<PathBuf> {
        if !timings_enabled() {
            return None;
        }
        let every = stamp_every_frames();
        if self.frames_since_stamp < every {
            return None;
        }
        let stamp = self.snapshot(phase)?;
        let path = stamp_path();
        if write_stamp_file(&path, &stamp).is_ok() {
            self.frames_since_stamp = 0;
            Some(path)
        } else {
            None
        }
    }
}

/// Process-wide ring (gboom + video share the half-block paint path).
static GLOBAL_TIMINGS: Mutex<Option<PaintTimings>> = Mutex::new(None);

fn global_timings() -> std::sync::MutexGuard<'static, Option<PaintTimings>> {
    GLOBAL_TIMINGS.lock().unwrap_or_else(|e| e.into_inner())
}

/// Record into the process-wide ring.
pub fn record_global(
    phase: PaintPhase,
    elapsed: std::time::Duration,
    cols: u16,
    rows: u16,
    src_w: u32,
    src_h: u32,
) {
    let mut g = global_timings();
    let t = g.get_or_insert_with(|| PaintTimings::new(PAINT_TIMING_RING));
    t.record(phase, elapsed, cols, rows, src_w, src_h);
    let _ = t.write_stamp_if_due(phase);
}

/// Snapshot process-wide timings for a phase.
pub fn global_snapshot(phase: PaintPhase) -> Option<PaintTimingStamp> {
    global_timings()
        .as_ref()
        .and_then(|t| t.snapshot(phase))
}

/// Force-write a stamp now (ignores EVERY cadence; still requires samples).
pub fn write_global_stamp(phase: PaintPhase) -> Option<PathBuf> {
    let mut g = global_timings();
    let t = g.as_mut()?;
    let stamp = t.snapshot(phase)?;
    let path = stamp_path();
    write_stamp_file(&path, &stamp).ok()?;
    t.frames_since_stamp = 0;
    Some(path)
}

/// Last paint sample (any phase). Sketch-compatible.
pub fn last_paint_timing() -> Option<PaintTiming> {
    global_timings().as_ref().and_then(|t| t.last())
}

/// Rolling p50 / p95 in **milliseconds** for half-block cell paint only.
///
/// Sketch-compatible helper for status lines / public posts once N is large.
pub fn paint_p50_p95_ms() -> Option<(f64, f64)> {
    let stamp = global_snapshot(PaintPhase::HalfblockPaint)?;
    Some((stamp.p50_ms, stamp.p95_ms))
}

/// JSON-friendly snapshot for a public stamp / ledger line.
///
/// Keep the honesty note: local terminal paint timings, not GPU cluster /
/// Colossus / broadcast stream numbers.
pub fn paint_stamp_snapshot() -> serde_json::Value {
    let last = last_paint_timing();
    let (p50, p95) = paint_p50_p95_ms().unwrap_or((0.0, 0.0));
    let frames = global_snapshot(PaintPhase::HalfblockPaint)
        .map(|s| s.frames)
        .unwrap_or(0);
    let term = TerminalInfo::detect();
    serde_json::json!({
        "schema": "fc-halfblock-paint-timings-v1",
        "feature_id": FEATURE_ID,
        "origin": ORIGIN,
        "feature_label": FEATURE_LABEL,
        "path": PAINT_PATH_HALFBLOCK,
        "terminal": {
            "term": term.term,
            "term_program": term.term_program,
            "tmux": term.tmux,
        },
        "last": last.map(|t| serde_json::json!({
            "cells": t.cells,
            "cols": t.cols,
            "rows": t.rows,
            "path": t.path,
            "ms": t.micros as f64 / 1000.0
        })),
        "frames": frames,
        "p50_ms": p50,
        "p95_ms": p95,
        "note": "local geometric half-block paint; not Colossus / not broadcast stream"
    })
}

fn timings_enabled() -> bool {
    match std::env::var("HALFBLOCK_PAINT_TIMINGS") {
        Ok(v) => {
            let v = v.trim();
            v == "1" || v.eq_ignore_ascii_case("true") || v.eq_ignore_ascii_case("yes")
        }
        Err(_) => false,
    }
}

fn stamp_every_frames() -> usize {
    std::env::var("HALFBLOCK_PAINT_STAMP_EVERY")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60)
        .max(2)
}

fn stamp_path() -> PathBuf {
    if let Ok(p) = std::env::var("HALFBLOCK_PAINT_STAMP_PATH") {
        let p = p.trim();
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    dirs_paint_default()
}

fn dirs_paint_default() -> PathBuf {
    if let Some(home) = std::env::var_os("HOME") {
        return PathBuf::from(home)
            .join(".panda")
            .join("packs")
            .join("halfblock-paint-timings.json");
    }
    PathBuf::from("halfblock-paint-timings.json")
}

/// Nearest-rank percentile on a **sorted** ascending slice.
pub fn percentile_us(sorted_us: &[u64], p: u8) -> u64 {
    if sorted_us.is_empty() {
        return 0;
    }
    let p = p.min(100) as usize;
    if sorted_us.len() == 1 {
        return sorted_us[0];
    }
    // Nearest-rank: index = ceil(p/100 * n) - 1
    let n = sorted_us.len();
    let rank = ((p * n + 99) / 100).saturating_sub(1).min(n - 1);
    sorted_us[rank]
}

fn us_to_ms(us: u64) -> f64 {
    (us as f64) / 1000.0
}

/// Terminal identity for stamps (env-based; no IPC).
#[derive(Debug, Clone, Serialize)]
pub struct TerminalInfo {
    pub term: String,
    pub term_program: Option<String>,
    pub colorterm: Option<String>,
    pub tmux: bool,
    pub columns_env: Option<u16>,
    pub lines_env: Option<u16>,
}

impl TerminalInfo {
    pub fn detect() -> Self {
        let term = std::env::var("TERM").unwrap_or_else(|_| "unknown".into());
        let term_program = std::env::var("TERM_PROGRAM").ok().filter(|s| !s.is_empty());
        let colorterm = std::env::var("COLORTERM").ok().filter(|s| !s.is_empty());
        let tmux = std::env::var_os("TMUX").is_some();
        let columns_env = std::env::var("COLUMNS")
            .ok()
            .and_then(|s| s.parse().ok());
        let lines_env = std::env::var("LINES").ok().and_then(|s| s.parse().ok());
        Self {
            term,
            term_program,
            colorterm,
            tmux,
            columns_env,
            lines_env,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CellExtent {
    pub cols: u16,
    pub rows: u16,
    pub cell_count: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct SampleExtent {
    pub w: u32,
    pub h: u32,
}

/// JSON stamp for ledger / public honesty (only ship numbers from this).
#[derive(Debug, Clone, Serialize)]
pub struct PaintTimingStamp {
    pub schema: &'static str,
    pub origin: &'static str,
    pub feature_id: &'static str,
    pub feature_label: &'static str,
    /// `"half-block"` or `"kitty"` (call-site path that produced the frame).
    pub path: &'static str,
    pub phase: PaintPhase,
    pub terminal: TerminalInfo,
    pub cells: CellExtent,
    pub sample_px: SampleExtent,
    pub frames: usize,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub mean_ms: f64,
    pub last_ms: f64,
    pub ring_capacity: usize,
}

/// Write stamp JSON (pretty). Creates parent dirs when possible.
pub fn write_stamp_file(path: &Path, stamp: &PaintTimingStamp) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let body = serde_json::to_vec_pretty(stamp)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    std::fs::write(path, body)
}

// ── paint ────────────────────────────────────────────────────────────────

/// Paint an RGB24 frame into `area` using half-block cells.
///
/// `rgb` is row-major `width * height * 3`. Returns `false` if dimensions or
/// buffer length are unusable.
///
/// # fornevercollective
/// Portable paint path for [`FEATURE_ID`]. Records paint duration into the
/// global timing ring (see [`record_global`]).
pub fn paint_rgb24(buf: &mut Buffer, area: Rect, rgb: &[u8], width: u32, height: u32) -> bool {
    if area.width == 0 || area.height == 0 || width == 0 || height == 0 {
        return false;
    }
    let need = width as usize * height as usize * 3;
    if rgb.len() < need {
        return false;
    }

    let t0 = Instant::now();
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

    record_global(
        PaintPhase::HalfblockPaint,
        t0.elapsed(),
        area.width,
        area.height,
        width,
        height,
    );
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

    #[test]
    fn percentile_nearest_rank() {
        let s = [10u64, 20, 30, 40, 50];
        assert_eq!(percentile_us(&s, 50), 30);
        assert_eq!(percentile_us(&s, 95), 50);
        assert_eq!(percentile_us(&s, 0), 10);
        assert_eq!(percentile_us(&[7], 95), 7);
    }

    #[test]
    fn timings_ring_snapshot_p50_p95() {
        let mut t = PaintTimings::new(32);
        // 10..100 us step 10
        for i in 1..=10 {
            t.record(
                PaintPhase::HalfblockPaint,
                std::time::Duration::from_micros(i * 10),
                80,
                24,
                80,
                48,
            );
        }
        let stamp = t.snapshot(PaintPhase::HalfblockPaint).expect("stamp");
        assert_eq!(stamp.frames, 10);
        assert_eq!(stamp.path, PAINT_PATH_HALFBLOCK);
        assert_eq!(stamp.cells.cols, 80);
        assert!(stamp.p50_ms > 0.0);
        assert!(stamp.p95_ms >= stamp.p50_ms);
        assert_eq!(stamp.origin, ORIGIN);
        // serialize shape
        let j = serde_json::to_value(&stamp).unwrap();
        assert_eq!(j["schema"], "fc-halfblock-paint-timings-v1");
        assert!(j["p50_ms"].as_f64().unwrap() > 0.0);
        assert!(j["terminal"]["term"].is_string());
    }

    #[test]
    fn paint_records_global_sample() {
        // Isolate: we only check that paint doesn't panic and ring grows.
        let area = Rect::new(0, 0, 8, 4);
        let mut buf = Buffer::empty(area);
        let w = 8u32;
        let h = 8u32;
        let rgb = vec![40u8; (w * h * 3) as usize];
        assert!(paint_rgb24(&mut buf, area, &rgb, w, h));
        let snap = global_snapshot(PaintPhase::HalfblockPaint);
        // May already have samples from other tests in same process.
        assert!(snap.is_none() || snap.unwrap().frames >= 1);
        assert!(last_paint_timing().is_some());
        let j = paint_stamp_snapshot();
        assert_eq!(j["feature_id"], FEATURE_ID);
        assert_eq!(j["origin"], ORIGIN);
        assert!(j["note"].as_str().unwrap().contains("local geometric"));
    }

    /// Drive ~90 frames at a known cell size and force-write the JSON stamp.
    ///
    /// ```text
    /// HALFBLOCK_PAINT_TIMINGS=1 cargo test -p xai-grok-pager-render \
    ///   paint_stamp_harness -- --ignored --nocapture
    /// cat ~/.panda/packs/halfblock-paint-timings.json
    /// ```
    #[test]
    #[ignore = "manual stamp: HALFBLOCK_PAINT_TIMINGS=1 cargo test … paint_stamp_harness -- --ignored"]
    fn paint_stamp_harness() {
        use crate::gboom::GboomState;
        use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

        // Known geometric size (laptop-class TTY box).
        let cols = 80u16;
        let rows = 24u16;
        let area = Rect::new(0, 0, cols, rows);
        let mut buf = Buffer::empty(area);
        let mut state = GboomState::new();
        // Leave title → Playing so raycast fills the game view.
        state.handle_key(&KeyEvent::new(KeyCode::Char('w'), KeyModifiers::NONE));

        let frames = 90usize;
        for i in 0..frames {
            for _ in 0..2 {
                state.tick();
            }
            assert!(
                state.paint_half_blocks(&mut buf, area),
                "paint failed at frame {i}"
            );
        }

        // Write per-phase stamps (public claim uses halfblock_paint).
        let base = stamp_path();
        if let Some(parent) = base.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        for (phase, suffix) in [
            (PaintPhase::Raycast, "raycast"),
            (PaintPhase::FrameTotal, "frame-total"),
            (PaintPhase::HalfblockPaint, "halfblock"),
        ] {
            if let Some(stamp) = global_snapshot(phase) {
                let path = base.with_file_name(format!(
                    "halfblock-paint-timings-{suffix}.json"
                ));
                write_stamp_file(&path, &stamp).expect("write phase stamp");
                eprintln!(
                    "wrote {}  p50={:.2}ms p95={:.2}ms frames={}",
                    path.display(),
                    stamp.p50_ms,
                    stamp.p95_ms,
                    stamp.frames
                );
            }
        }
        // Canonical path = half-block cell paint (honesty unit).
        if let Some(path) = write_global_stamp(PaintPhase::HalfblockPaint) {
            eprintln!("canonical stamp → {}", path.display());
        }

        let snap = paint_stamp_snapshot();
        eprintln!("{}", serde_json::to_string_pretty(&snap).unwrap());

        let (p50, p95) = paint_p50_p95_ms().expect("p50/p95");
        eprintln!(
            "half-block paint p50 ≈ {:.2} ms · p95 ≈ {:.2} ms  ({}×{} cells · fc-halfblock-tty-video)",
            p50, p95, cols, rows
        );
        assert!(p50 > 0.0);
        assert!(p95 >= p50);
    }
}
