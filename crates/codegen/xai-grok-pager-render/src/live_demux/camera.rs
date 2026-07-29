//! Optional local camera feed for `/watch` picture-in-side layout.
//!
//! Spawns ffmpeg against the platform capture device (AVFoundation on macOS,
//! v4l2 on Linux), pipes RGB24 frames, same ring pattern as stream demux.
//! Toggle with **`c`** in the live-watch modal — left pane = you, right = stream.

use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

/// Default share of the paint width for **side-column** mode only.
///
/// Prefer PiP (see [`super::layout`]) — full-height side columns obscure the
/// main stream on 80×24 / GY multi-chat bottom panes.
pub const DEFAULT_CAM_WIDTH_FRAC: f32 = 0.22;

struct SharedCam {
    width: u32,
    height: u32,
    rgb: Option<Vec<u8>>,
    generation: AtomicU64,
    error: Option<String>,
}

impl SharedCam {
    fn new(w: u32, h: u32) -> Self {
        Self {
            width: w,
            height: h,
            rgb: None,
            generation: AtomicU64::new(0),
            error: None,
        }
    }

    fn frame_bytes(&self) -> usize {
        (self.width as usize) * (self.height as usize) * 3
    }
}

fn env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

fn env_bool(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(s) => matches!(
            s.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

/// Capture dimensions for the half-block camera pane (even for half-block).
///
/// Defaults track GrokYtalkY **25²** glyph tiles (25×26 px → 25 cols × 13 ▀ rows),
/// not a portrait 80×90 slab that overfills lean terminals.
///
/// `/cam` / large presets set `LIVE_DEMUX_CAM_W`/`_H` (e.g. 96×96 or 128×128).
/// When only `LIVE_DEMUX_CAM_TILE` is set, dims scale from the tile so the
/// RGB ring matches the paint box (1 col ≈ 1 px, 1 row ≈ 2 px).
pub fn cam_dims() -> (u32, u32) {
    if std::env::var("LIVE_DEMUX_CAM_W").is_ok() || std::env::var("LIVE_DEMUX_CAM_H").is_ok() {
        let default_w = 26u32;
        let default_h = 26u32;
        let w = env_u32("LIVE_DEMUX_CAM_W", default_w).max(2) & !1;
        let h = env_u32("LIVE_DEMUX_CAM_H", default_h).max(2) & !1;
        return (w, h);
    }
    // Derive from tile preset when present (keeps /cam large sharp).
    if let Ok(s) = std::env::var("LIVE_DEMUX_CAM_TILE") {
        let s = s.trim().to_ascii_lowercase();
        let (cols, rows) = match s.as_str() {
            "large" | "big" | "lg" => (48u32, 24u32),
            "xl" | "huge" | "xlarge" => (64, 32),
            "xxl" | "max" => (80, 40),
            "lean" | "small" | "mini" => (13, 7),
            "glyph" | "pin" | "default" => (25, 13),
            other => {
                if let Some((a, b)) = other.split_once('x') {
                    (
                        a.parse().unwrap_or(26),
                        b.parse().unwrap_or(26),
                    )
                } else if let Ok(n) = other.parse::<u32>() {
                    let cols = n.clamp(6, 160);
                    (cols, ((cols + 1) / 2).max(4))
                } else {
                    (26, 26)
                }
            }
        };
        // RGB: 1 cell col = 1 px, 1 cell row = 2 px (half-block).
        let w = (cols.max(2)) & !1;
        let h = ((rows * 2).max(2)) & !1;
        return (w, h);
    }
    let default_w = 26u32; // 25 + even pad
    let default_h = 26u32; // square 25² sample (even)
    let w = env_u32("LIVE_DEMUX_CAM_W", default_w).max(2) & !1;
    let h = env_u32("LIVE_DEMUX_CAM_H", default_h).max(2) & !1;
    (w, h)
}

/// Apply a named camera size/layout profile for `/cam` (process env).
///
/// | profile | tile | layout | notes |
/// |---------|------|--------|-------|
/// | `large` (default) | 48×24 | side | big chat self-view |
/// | `xl` / `huge` | 64×32 | side | roomier terminals |
/// | `max` | fills room | side | leave ~18 cols for stream |
/// | `pip` | 40×20 | pip | large overlay, not column |
/// | `lean` | 13×7 | pip | GY dual / 80×24 |
pub fn apply_cam_profile(profile: &str) {
    let p = profile.trim().to_ascii_lowercase();
    let (tile, layout, mirror_on) = match p.as_str() {
        "" | "large" | "big" | "lg" | "cam" => ("large", "side", "1"),
        "xl" | "huge" | "xlarge" => ("xl", "side", "1"),
        "xxl" | "max" | "fill" => ("max", "side", "1"),
        "pip" | "overlay" | "inset" => ("40", "pip", "1"),
        "lean" | "small" | "mini" | "glyph" => ("lean", "pip", "1"),
        "side" => ("large", "side", "1"),
        other if other.parse::<u16>().is_ok() || other.contains('x') => (profile.trim(), "side", "1"),
        _ => ("large", "side", "1"),
    };
    // SAFETY: single-threaded TUI sets process-wide live-demux knobs (same
    // pattern as launch-watch.sh). Child ffmpeg reads these at cam start.
    unsafe {
        std::env::set_var("LIVE_DEMUX_CAM_ON", "1");
        std::env::set_var("GROK_LIVE_WATCH_CAM", "1");
        std::env::set_var("LIVE_DEMUX_CAM_TILE", tile);
        std::env::set_var("LIVE_DEMUX_CAM_LAYOUT", layout);
        std::env::set_var("LIVE_DEMUX_CAM_MIRROR", mirror_on);
        // Prefer FaceTime-safe capture; scale down in vf to cam_dims.
        if std::env::var("LIVE_DEMUX_CAM_CAPTURE").is_err() {
            std::env::set_var("LIVE_DEMUX_CAM_CAPTURE", "640x480");
        }
    }
}

pub fn cam_fps() -> f64 {
    env_u32("LIVE_DEMUX_CAM_FPS", 12).clamp(1, 30) as f64
}

/// Width fraction of the modal inner area for camera (0.15–0.5).
pub fn cam_width_frac() -> f32 {
    std::env::var("LIVE_DEMUX_CAM_FRAC")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_CAM_WIDTH_FRAC)
        .clamp(0.15, 0.50)
}

/// Device selector:
/// - macOS AVFoundation: `"0"`, `"1"`, or a name fragment
/// - Linux: `/dev/video0` path or index
pub fn cam_device() -> String {
    std::env::var("LIVE_DEMUX_CAM_DEVICE")
        .or_else(|_| std::env::var("LIVE_DEMUX_CAMERA"))
        .unwrap_or_else(|_| {
            if cfg!(target_os = "macos") {
                "0".into()
            } else {
                "/dev/video0".into()
            }
        })
}

/// Mirror (hflip) for selfie view — default on.
pub fn cam_mirror_default() -> bool {
    env_bool("LIVE_DEMUX_CAM_MIRROR", true)
}

/// Auto-enable camera side pane when `/watch` opens (`LIVE_DEMUX_CAM_ON=1`).
pub fn cam_auto_on() -> bool {
    env_bool("LIVE_DEMUX_CAM_ON", false)
        || env_bool("GROK_LIVE_WATCH_CAM", false)
}

/// Native capture size requested from the device (before scale-to-pane).
///
/// FaceTime HD and most Continuity/Brick cams expose **640x480** and **1280x720**,
/// not 640x360 — wrong size makes AVFoundation fail open with I/O error.
pub fn cam_capture_size() -> (u32, u32) {
    if let Ok(s) = std::env::var("LIVE_DEMUX_CAM_CAPTURE") {
        // "640x480" or "1280x720"
        if let Some((a, b)) = s.split_once('x') {
            if let (Ok(w), Ok(h)) = (a.parse::<u32>(), b.parse::<u32>()) {
                return (w.max(160), h.max(120));
            }
        }
    }
    (640, 480)
}

/// ffmpeg capture of the local camera → RGB24 frames.
pub struct CameraFeed {
    child: Child,
    pg: xai_tty_utils::ProcessGroup,
    reader: Option<JoinHandle<()>>,
    shared: Arc<Mutex<SharedCam>>,
    stop: Arc<AtomicBool>,
    pub width: u32,
    pub height: u32,
    mirror: bool,
}

impl CameraFeed {
    /// Start capture. `mirror` applies hflip in the filter graph.
    pub fn start(w: u32, h: u32, fps: f64, mirror: bool) -> Result<Self, String> {
        let device = cam_device();
        let shared = Arc::new(Mutex::new(SharedCam::new(w, h)));
        let stop = Arc::new(AtomicBool::new(false));
        let (cap_w, cap_h) = cam_capture_size();
        // Prefer a device fps the cam actually lists (12 is common on FaceTime).
        let cap_fps = (fps.max(1.0) as u32).clamp(1, 30);

        let mut vf = format!("scale={w}:{h}");
        if mirror {
            vf.push_str(",hflip");
        }

        let mut cmd = Command::new("ffmpeg");
        cmd.args(["-hide_banner", "-loglevel", "error"]);

        if cfg!(target_os = "macos") {
            // AVFoundation: video[:audio]. We only want video.
            // Device can be index "0" or a name — keep as-is for ffmpeg.
            // Use a real mode (640x480@12) then scale down for half-block.
            cmd.args([
                "-f",
                "avfoundation",
                "-framerate",
                &format!("{cap_fps}"),
                "-video_size",
                &format!("{cap_w}x{cap_h}"),
                "-i",
                &format!("{device}:none"),
            ]);
        } else if cfg!(target_os = "linux") {
            let dev = if device.starts_with('/') {
                device.clone()
            } else {
                format!("/dev/video{device}")
            };
            cmd.args([
                "-f",
                "v4l2",
                "-framerate",
                &format!("{cap_fps}"),
                "-video_size",
                &format!("{cap_w}x{cap_h}"),
                "-i",
                &dev,
            ]);
        } else {
            return Err("camera capture only supported on macOS (AVFoundation) and Linux (v4l2)".into());
        }

        cmd.args([
            "-an",
            "-vf",
            &vf,
            "-r",
            &format!("{fps}"),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "pipe:1",
        ]);
        cmd.stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        xai_tty_utils::detach_std_command(&mut cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("camera ffmpeg spawn failed: {e}"))?;
        let mut pg = xai_tty_utils::ProcessGroup::new()
            .map_err(|e| format!("camera process group: {e}"))?;
        let _ = pg.attach_std(&child);

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "camera ffmpeg stdout missing".to_string())?;
        let mut stderr = child.stderr.take();

        let shared_r = Arc::clone(&shared);
        let stop_r = Arc::clone(&stop);
        let frame_len = {
            let g = shared.lock().map_err(|_| "shared lock".to_string())?;
            g.frame_bytes()
        };

        let reader = thread::Builder::new()
            .name("live-demux-cam".into())
            .spawn(move || {
                let mut reader = stdout;
                let mut buf = vec![0u8; frame_len];
                loop {
                    if stop_r.load(Ordering::Relaxed) {
                        break;
                    }
                    match read_exact(&mut reader, &mut buf, &stop_r) {
                        Ok(true) => {
                            if let Ok(mut g) = shared_r.lock() {
                                g.rgb = Some(buf.clone());
                                g.generation.fetch_add(1, Ordering::Relaxed);
                            }
                        }
                        Ok(false) => break,
                        Err(msg) => {
                            if let Ok(mut g) = shared_r.lock() {
                                g.error = Some(msg);
                            }
                            break;
                        }
                    }
                }
                if let Some(ref mut err) = stderr {
                    let mut s = String::new();
                    let _ = err.read_to_string(&mut s);
                    let s = s.trim();
                    if !s.is_empty()
                        && let Ok(mut g) = shared_r.lock()
                        && g.error.is_none()
                    {
                        g.error = Some(s.chars().take(200).collect());
                    }
                }
            })
            .map_err(|e| format!("camera reader thread: {e}"))?;

        Ok(Self {
            child,
            pg,
            reader: Some(reader),
            shared,
            stop,
            width: w,
            height: h,
            mirror,
        })
    }

    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        let _ = self.pg.terminate();
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(h) = self.reader.take() {
            let _ = h.join();
        }
    }

    pub fn frame_generation(&self) -> u64 {
        self.shared
            .lock()
            .map(|g| g.generation.load(Ordering::Relaxed))
            .unwrap_or(0)
    }

    pub fn snapshot_rgb(&self) -> Option<(Vec<u8>, u32, u32)> {
        let g = self.shared.lock().ok()?;
        let rgb = g.rgb.clone()?;
        Some((rgb, g.width, g.height))
    }

    pub fn take_error(&self) -> Option<String> {
        self.shared.lock().ok().and_then(|mut g| g.error.take())
    }

    pub fn mirror(&self) -> bool {
        self.mirror
    }
}

impl Drop for CameraFeed {
    fn drop(&mut self) {
        self.stop();
    }
}

fn read_exact(r: &mut impl Read, buf: &mut [u8], stop: &AtomicBool) -> Result<bool, String> {
    let mut off = 0;
    while off < buf.len() {
        if stop.load(Ordering::Relaxed) {
            return Ok(false);
        }
        match r.read(&mut buf[off..]) {
            Ok(0) => {
                if off == 0 {
                    return Ok(false);
                }
                return Err("short read from camera ffmpeg".into());
            }
            Ok(n) => off += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(format!("camera read: {e}")),
        }
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dims_even() {
        let (w, h) = cam_dims();
        assert_eq!(w % 2, 0);
        assert_eq!(h % 2, 0);
    }

    #[test]
    fn frac_clamped_default() {
        let f = cam_width_frac();
        assert!((0.15..=0.50).contains(&f));
    }
}
