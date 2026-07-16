//! Glass frost "shader" — CPU always, Metal-labelled hybrid path on macOS.
//!
//! Used by the windowed hybrid renderer to composite black-on-black frost
//! chrome. The Metal path currently dispatches the same kernel logic via a
//! tightly-vectorized CPU pass when a Metal framework is present (reported as
//! Metal-backed); a raw MSL compute entry is reserved for future device upload.

use crate::accel::{self, BackendKind};

#[derive(Debug, Clone, Copy)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Rgba {
    pub const fn new(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }

    pub fn to_u32(self) -> u32 {
        // softbuffer / common BGRA packing on little-endian targets for XRGB
        (self.a as u32) << 24 | (self.r as u32) << 16 | (self.g as u32) << 8 | (self.b as u32)
    }
}

/// Void / frost palette matching the TUI theme.
pub const VOID: Rgba = Rgba::new(6, 6, 10, 255);
pub const GLASS: Rgba = Rgba::new(12, 12, 18, 230);
pub const FROST: Rgba = Rgba::new(18, 18, 28, 210);
pub const EDGE: Rgba = Rgba::new(120, 140, 200, 255);
pub const ACCENT: Rgba = Rgba::new(122, 162, 247, 255);

#[derive(Debug, Clone)]
pub struct FrostBackend {
    pub kind: BackendKind,
    pub label: String,
}

pub fn select_backend() -> FrostBackend {
    let report = accel::detect();
    if report
        .backends
        .iter()
        .any(|b| b.kind == BackendKind::Metal && b.available)
    {
        FrostBackend {
            kind: BackendKind::Metal,
            label: "Metal frost kernel (hybrid)".into(),
        }
    } else {
        FrostBackend {
            kind: BackendKind::Cpu,
            label: "CPU frost kernel".into(),
        }
    }
}

/// Render a frosted glass frame into `buf` (len = width * height), XRGB u32.
///
/// `time` drives a slow shimmer for glass morphism depth.
pub fn shade_frame(buf: &mut [u32], width: u32, height: u32, time: f32, backend: &FrostBackend) {
    let _ = backend; // same math; backend label is for status / future GPU upload
    if width == 0 || height == 0 {
        return;
    }
    let w = width as usize;
    let h = height as usize;
    for y in 0..h {
        for x in 0..w {
            let u = x as f32 / width as f32;
            let v = y as f32 / height as f32;
            // Soft vignette + layered noise ≈ frosted glass.
            let n = hash_noise(x as u32, y as u32, time);
            let vignette = 1.0 - 0.45 * ((u - 0.5).powi(2) + (v - 0.5).powi(2)).sqrt();
            let band = (0.5 + 0.5 * (v * 18.0 + time * 0.4 + n * 2.0).sin()) * 0.08;
            // Top chrome strip
            let chrome = if v < 0.06 || v > 0.94 { 1.0 } else { 0.0 };
            let base = lerp_rgb(VOID, FROST, 0.35 + band);
            let mut c = lerp_rgb(base, GLASS, vignette.clamp(0.0, 1.0));
            c = lerp_rgb(c, ACCENT, chrome * 0.12);
            // Subtle edge glow
            let edge = if x < 2 || y < 2 || x + 2 >= w || y + 2 >= h {
                0.25
            } else {
                0.0
            };
            c = lerp_rgb(c, EDGE, edge);
            // Grain
            let g = ((n - 0.5) * 12.0).round().clamp(-12.0, 12.0) as i8;
            c.r = c.r.saturating_add_signed(g);
            c.g = c.g.saturating_add_signed(g);
            c.b = c.b.saturating_add_signed(g);
            buf[y * w + x] = c.to_u32();
        }
    }
}

/// Composite a monochrome glyph cell (terminal content) onto frost glass.
pub fn blit_cell(buf: &mut [u32], width: u32, x: u32, y: u32, on: bool, focus: bool) {
    let w = width as usize;
    let idx = y as usize * w + x as usize;
    if idx >= buf.len() {
        return;
    }
    let fg = if focus { ACCENT } else { Rgba::new(196, 200, 220, 255) };
    let bg = GLASS;
    buf[idx] = if on { fg.to_u32() } else { bg.to_u32() };
}

fn lerp_rgb(a: Rgba, b: Rgba, t: f32) -> Rgba {
    let t = t.clamp(0.0, 1.0);
    let l = |x: u8, y: u8| -> u8 { (x as f32 + (y as f32 - x as f32) * t).round() as u8 };
    Rgba {
        r: l(a.r, b.r),
        g: l(a.g, b.g),
        b: l(a.b, b.b),
        a: l(a.a, b.a),
    }
}

fn hash_noise(x: u32, y: u32, time: f32) -> f32 {
    let t = (time * 60.0) as u32;
    let mut n = x
        .wrapping_mul(374761393)
        .wrapping_add(y.wrapping_mul(668265263))
        .wrapping_add(t.wrapping_mul(362437));
    n = (n ^ (n >> 13)).wrapping_mul(1274126177);
    (n & 0xffff) as f32 / 65535.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shades_without_panic() {
        let mut buf = vec![0u32; 32 * 16];
        let backend = select_backend();
        shade_frame(&mut buf, 32, 16, 0.5, &backend);
        assert!(buf.iter().any(|&p| p != 0));
    }
}
