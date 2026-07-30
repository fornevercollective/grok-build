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

/// Where the cam tile samples frames from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CamSource {
    /// Local AVFoundation / v4l2 device (laptop / desktop webcam).
    Local,
    /// Memory Glass still-pipe (`live.jpg` from phone PWA POST /upload).
    PhoneStill,
    /// **Side-by-side**: laptop webcam **and** phone still-pipe (default for `/cam phone`).
    Dual,
}

impl CamSource {
    pub fn label(self) -> &'static str {
        match self {
            CamSource::Local => "local",
            CamSource::PhoneStill => "phone",
            CamSource::Dual => "you+phone",
        }
    }

    pub fn includes_local(self) -> bool {
        matches!(self, CamSource::Local | CamSource::Dual)
    }

    pub fn includes_phone(self) -> bool {
        matches!(self, CamSource::PhoneStill | CamSource::Dual)
    }

    pub fn is_dual(self) -> bool {
        matches!(self, CamSource::Dual)
    }
}

/// Active cam source from env (`LIVE_DEMUX_CAM_SOURCE=dual|phone|local`).
pub fn cam_source() -> CamSource {
    match std::env::var("LIVE_DEMUX_CAM_SOURCE")
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        // Dual first — `/cam phone` default is you + phone side-by-side.
        "dual" | "both" | "sidebyside" | "side-by-side" | "sbs" | "you+phone"
        | "you-phone" | "local+phone" | "phone+local" | "2" | "pair" => CamSource::Dual,
        "phone" | "still" | "stillpipe" | "still-pipe" | "tether" | "pwa" | "live.jpg"
        | "mg" | "memoryglass" | "memory-glass" | "phone-only" | "only-phone" => {
            CamSource::PhoneStill
        }
        "local" | "webcam" | "desktop" | "laptop" | "you" | "self" | "facetime" => {
            CamSource::Local
        }
        _ => CamSource::Local,
    }
}

/// Path to still-pipe JPEG (phone uploads → this file).
pub fn cam_still_path() -> String {
    if let Ok(p) = std::env::var("LIVE_DEMUX_CAM_STILL") {
        if !p.trim().is_empty() {
            return p;
        }
    }
    if let Ok(p) = std::env::var("MG_LIVE_JPG") {
        if !p.trim().is_empty() {
            return p;
        }
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let vision = std::env::var("GY_VISION_DIR")
        .unwrap_or_else(|_| format!("{home}/.panda/vision"));
    format!("{vision}/live.jpg")
}

/// True if this AVFoundation name is **not a real camera** (must never open for phone).
///
/// When Continuity drops, device indices renumber; a bare numeric index can
/// point at a non-camera device. Phone path only accepts Continuity/webcam names.
pub fn is_capture_screen_name(name: &str) -> bool {
    let n = name.trim().to_ascii_lowercase();
    n.starts_with("capture screen") || n.contains("capture screen")
}

/// Resolve a live phone/Continuity device index by **name**, never by blind index.
///
/// Prefers: Brick / Continuity / iPhone camera names. Skips FaceTime and non-cameras.
/// Returns `None` → fall back to optional JPEG still-pipe.
pub fn resolve_phone_live_device() -> Option<(String, String)> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    // Lazy import path: list from popout to avoid circular module issues.
    let cams = super::popout::list_avfoundation_cameras();
    // Prefer Continuity / iPhone back cam names.
    let prefer = [
        "brick",
        "continuity",
        "iphone",
        "desk view",
        "deskview",
        "wide angle",
        "back",
    ];
    for (idx, name) in &cams {
        if is_capture_screen_name(name) {
            continue;
        }
        let nl = name.to_ascii_lowercase();
        if nl.contains("facetime") || nl.contains("built-in") {
            continue;
        }
        for p in prefer {
            if nl.contains(p) {
                return Some((idx.clone(), name.clone()));
            }
        }
    }
    // Any non-FaceTime, non-screen cam
    for (idx, name) in &cams {
        if is_capture_screen_name(name) {
            continue;
        }
        let nl = name.to_ascii_lowercase();
        if !nl.contains("facetime") && !nl.contains("built-in") {
            return Some((idx.clone(), name.clone()));
        }
    }
    None
}

/// Live Continuity / second-cam device for the **phone** half of dual desk.
///
/// When a Continuity cam is **present by name**, phone tiles use live AVFoundation.
/// When Continuity is offline, returns `None` → optional JPEG still-pipe.
///
/// **Never** opens non-camera devices by blind index (indices renumber when Continuity drops).
///
/// Env:
/// - `LIVE_DEMUX_CAM_PHONE_DEVICE=still` → force still-pipe
/// - `LIVE_DEMUX_CAM_PHONE_DEVICE=Brick` → name fragment match
/// - `LIVE_DEMUX_CAM_PHONE_DEVICE=1` → only if that index is a real camera
pub fn cam_phone_device() -> Option<String> {
    let force_still = matches!(
        std::env::var("LIVE_DEMUX_CAM_PHONE_STILL")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes" | "on" | "still"
    );
    if force_still {
        return None;
    }
    if let Ok(p) = std::env::var("LIVE_DEMUX_CAM_PHONE_DEVICE") {
        let p = p.trim();
        if p.is_empty()
            || matches!(
                p.to_ascii_lowercase().as_str(),
                "still" | "stillpipe" | "jpg" | "jpeg" | "pwa" | "none" | "off"
            )
        {
            return None;
        }
        // Numeric index — only accept if listed as a real camera.
        if p.chars().all(|c| c.is_ascii_digit()) {
            let cams = super::popout::list_avfoundation_cameras();
            if let Some((_, name)) = cams.iter().find(|(i, _)| i == p) {
                if is_capture_screen_name(name) {
                    eprintln!(
                        "[fc-cam] refuse phone device [{p}] = {name} (not a Continuity/webcam)"
                    );
                    return None;
                }
                return Some(p.to_string());
            }
            // Index not in real-cam list (might be screen-only slot) — refuse.
            eprintln!("[fc-cam] refuse phone device [{p}] — not a listed camera");
            return None;
        }
        // Name fragment
        let cams = super::popout::list_avfoundation_cameras();
        let needle = p.to_ascii_lowercase();
        for (idx, name) in cams {
            if is_capture_screen_name(&name) {
                continue;
            }
            if name.to_ascii_lowercase().contains(&needle) {
                return Some(idx);
            }
        }
        return None;
    }
    // Auto: Continuity by name only — never assume index 1.
    resolve_phone_live_device().map(|(idx, _)| idx)
}

/// Capture size for the phone Continuity / second cam (Brick prefers 640x480@30).
pub fn cam_phone_capture_size() -> (u32, u32) {
    if let Ok(s) = std::env::var("LIVE_DEMUX_CAM_PHONE_CAPTURE") {
        if let Some((a, b)) = s.split_once('x') {
            if let (Ok(w), Ok(h)) = (a.parse::<u32>(), b.parse::<u32>()) {
                return (w.max(160), h.max(120));
            }
        }
    }
    // Continuity "Desk View" camera mode (still a camera feed) may list higher modes.
    if let Some((_, name)) = resolve_phone_live_device() {
        let nl = name.to_ascii_lowercase();
        if nl.contains("desk view") || nl.contains("deskview") {
            return (1920, 1440);
        }
    }
    (640, 480)
}

/// Apply phone / still-pipe tether profile (Memory Glass inspect grammar).
///
/// **Default `/cam phone`:** **desk dual** — fullscreen laptop webcam | phone
/// still-pipe. **No yt-dlp / VEVO stream** (that is `/watch`, not the cam desk).
///
/// Env:
/// - `LIVE_DEMUX_CAM_SOURCE=dual` (default) · `phone-only` · `local`
/// - `LIVE_DEMUX_CAM_DESK=1` — fullscreen you|phone (no stream pane)
/// - still path `LIVE_DEMUX_CAM_STILL` / `GY_VISION_DIR/live.jpg`
pub fn apply_phone_tether_profile() {
    // SAFETY: process-wide knobs; child ffmpeg + layout read at cam start.
    unsafe {
        std::env::set_var("LIVE_DEMUX_CAM_ON", "1");
        std::env::set_var("GROK_LIVE_WATCH_CAM", "1");
        // Full-bleed dual desk (you | phone) — not a PiP on VEVO.
        std::env::set_var("LIVE_DEMUX_CAM_DESK", "1");
        std::env::set_var("LIVE_DEMUX_CAM_LAYOUT", "side");
        // Large capture so each half stays sharp when split 50/50.
        if std::env::var("LIVE_DEMUX_CAM_TILE").is_err() {
            std::env::set_var("LIVE_DEMUX_CAM_TILE", "max");
        }
        // `/cam phone` / `tether` / `dual` → you + phone side-by-side.
        let src = std::env::var("LIVE_DEMUX_CAM_SOURCE").unwrap_or_default();
        let src = src.trim().to_ascii_lowercase();
        if src.is_empty()
            || matches!(
                src.as_str(),
                "phone" | "tether" | "pwa" | "mg" | "inspect" | "dual" | "both"
            )
        {
            std::env::set_var("LIVE_DEMUX_CAM_SOURCE", "dual");
        }
        // Mirror laptop selfie; phone still is unmirrored in its own feed.
        std::env::set_var("LIVE_DEMUX_CAM_MIRROR", "1");
        std::env::set_var("LIVE_DEMUX_MIC", "1");
        if std::env::var("LIVE_DEMUX_CAM_CAPTURE").is_err() {
            std::env::set_var("LIVE_DEMUX_CAM_CAPTURE", "640x480");
        }
        if std::env::var("LIVE_DEMUX_CAM_STILL").is_err() {
            std::env::set_var("LIVE_DEMUX_CAM_STILL", cam_still_path());
        }
        // Live Continuity is resolved by **name** at capture start (see
        // `cam_phone_device`). Never force a bare index — renumbers when Continuity
        // disconnects and can hit a non-camera device.
        if std::env::var("MG_WAVE_URL").is_err()
            && std::env::var("MEMORY_GLASS_WAVE_URL").is_err()
        {
            let port = std::env::var("MG_STILL_PORT").unwrap_or_else(|_| "9877".into());
            std::env::set_var(
                "MG_WAVE_URL",
                format!("http://127.0.0.1:{port}/wave"),
            );
        }
    }
}

/// Sentinel URL for dual cam desk (no yt-dlp resolve).
pub const DESK_URL: &str = "cam://desk";

/// True when watch input is the dual-cam desk (you|phone only).
pub fn is_desk_source(input: &str) -> bool {
    matches!(
        input.trim().to_ascii_lowercase().as_str(),
        "desk"
            | "camdesk"
            | "cam-desk"
            | "dualcam"
            | "dual-cam"
            | "you+phone"
            | "you-phone"
            | "cam://desk"
            | "cam:desk"
    ) || input.trim() == DESK_URL
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
/// | `phone` / `tether` | large | side | still-pipe live.jpg (phone PWA) |
pub fn apply_cam_profile(profile: &str) {
    let p = profile.trim().to_ascii_lowercase();
    // Phone / tether is a source profile, not only a tile size.
    if matches!(
        p.as_str(),
        "phone"
            | "tether"
            | "dual"
            | "both"
            | "still"
            | "stillpipe"
            | "pwa"
            | "mg"
            | "inspect"
    ) {
        apply_phone_tether_profile();
        return;
    }
    if matches!(p.as_str(), "phone-only" | "only-phone") {
        apply_phone_tether_profile();
        unsafe {
            std::env::set_var("LIVE_DEMUX_CAM_SOURCE", "phone-only");
        }
        return;
    }
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
    /// Start capture using the process-wide [`cam_source`] (not Dual — use two feeds).
    pub fn start(w: u32, h: u32, fps: f64, mirror: bool) -> Result<Self, String> {
        let source = match cam_source() {
            CamSource::Dual => CamSource::Local, // dual uses start_source per feed
            s => s,
        };
        Self::start_source(w, h, fps, mirror, source)
    }

    /// Start capture for an explicit source (Local or PhoneStill).
    ///
    /// Dual mode is handled by the live-watch state (two feeds, side-by-side paint).
    pub fn start_source(
        w: u32,
        h: u32,
        fps: f64,
        mirror: bool,
        source: CamSource,
    ) -> Result<Self, String> {
        let source = match source {
            CamSource::Dual => CamSource::Local,
            s => s,
        };
        let shared = Arc::new(Mutex::new(SharedCam::new(w, h)));
        let stop = Arc::new(AtomicBool::new(false));
        let (cap_w, cap_h) = cam_capture_size();
        // Prefer a device fps the cam actually lists (12 is common on FaceTime).
        let cap_fps = (fps.max(1.0) as u32).clamp(1, 30);

        let mut vf = format!("scale={w}:{h}");
        // Phone still-pipe is already device-oriented; mirror only for local selfie.
        if mirror && source == CamSource::Local {
            vf.push_str(",hflip");
        }

        let mut cmd = Command::new("ffmpeg");
        cmd.args(["-hide_banner", "-loglevel", "error"]);

        match source {
            CamSource::Dual => unreachable!("mapped to Local above"),
            CamSource::PhoneStill => {
                // **Continuity Camera first** (live AVFoundation — iPhone as webcam).
                // HTTP/JPEG still-pipe only when LIVE_DEMUX_CAM_PHONE_STILL=1.
                let allow_still = matches!(
                    std::env::var("LIVE_DEMUX_CAM_PHONE_STILL")
                        .unwrap_or_default()
                        .trim()
                        .to_ascii_lowercase()
                        .as_str(),
                    "1" | "true" | "yes" | "on" | "still" | "http" | "pwa"
                );
                if let Some(phone_dev) = cam_phone_device() {
                    let (pw, ph) = cam_phone_capture_size();
                    let phone_fps = std::env::var("LIVE_DEMUX_CAM_PHONE_FPS")
                        .ok()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(30u32)
                        .clamp(8, 30);
                    eprintln!(
                        "[fc-cam] phone LIVE Continuity device [{phone_dev}] {pw}x{ph}@{phone_fps}"
                    );
                    if cfg!(target_os = "macos") {
                        cmd.args([
                            "-f",
                            "avfoundation",
                            "-framerate",
                            &format!("{phone_fps}"),
                            "-video_size",
                            &format!("{pw}x{ph}"),
                            "-pixel_format",
                            "uyvy422",
                            "-i",
                            &format!("{phone_dev}:none"),
                        ]);
                    } else if cfg!(target_os = "linux") {
                        let dev = if phone_dev.starts_with('/') {
                            phone_dev.clone()
                        } else {
                            format!("/dev/video{phone_dev}")
                        };
                        cmd.args([
                            "-f",
                            "v4l2",
                            "-framerate",
                            &format!("{phone_fps}"),
                            "-video_size",
                            &format!("{pw}x{ph}"),
                            "-i",
                            &dev,
                        ]);
                    } else {
                        return Err("phone live cam only on macOS / Linux".into());
                    }
                } else if allow_still {
                    // Opt-in HTTP/JPEG still-pipe (Mini PWA) — not the default desk path.
                    let still = cam_still_path();
                    ensure_still_seed(&still);
                    let still_fps = cap_fps.min(10).max(2);
                    eprintln!("[fc-cam] phone still-pipe (opt-in) {still}");
                    cmd.args([
                        "-f",
                        "image2",
                        "-loop",
                        "1",
                        "-framerate",
                        &format!("{still_fps}"),
                        "-i",
                        &still,
                    ]);
                } else {
                    return Err(
                        "phone Continuity Camera not listed (Brick / iPhone). \
                         Enable Continuity Camera on iPhone (Settings → General → AirPlay & Handoff), \
                         keep phone nearby, then reopen /cam phone. \
                         Optional still-pipe only if LIVE_DEMUX_CAM_PHONE_STILL=1."
                            .into(),
                    );
                }
            }
            CamSource::Local => {
                let device = cam_device();
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
                    return Err(
                        "camera capture only supported on macOS (AVFoundation) and Linux (v4l2)"
                            .into(),
                    );
                }
            }
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
            .map_err(|e| format!("camera ffmpeg spawn failed ({source:?}): {e}"))?;
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
            .name(
                match source {
                    CamSource::PhoneStill => "live-demux-cam-phone",
                    CamSource::Local | CamSource::Dual => "live-demux-cam",
                }
                .into(),
            )
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

/// Write a 1×1 JPEG so ffmpeg image2 can open before the phone posts.
pub fn ensure_still_seed_public(path: &str) {
    ensure_still_seed(path);
}

fn ensure_still_seed(path: &str) {
    use std::path::Path;
    let p = Path::new(path);
    if p.is_file() {
        if let Ok(meta) = p.metadata() {
            if meta.len() > 32 {
                return;
            }
        }
    }
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // Minimal valid JPEG (1×1 gray) — ~100 bytes.
    const MINI_JPEG: &[u8] = &[
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
        0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
        0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B,
        0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31,
        0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF,
        0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00,
        0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B,
        0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05,
        0x04, 0x04, 0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21,
        0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
        0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0A,
        0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35, 0x36, 0x37,
        0x38, 0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56,
        0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93,
        0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9,
        0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6,
        0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
        0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7,
        0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, 0xFE,
        0x3F, 0xFF, 0xD9,
    ];
    let _ = std::fs::write(p, MINI_JPEG);
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

    #[test]
    fn still_path_default_under_vision() {
        let p = cam_still_path();
        assert!(p.ends_with("live.jpg") || p.contains("live.jpg"));
    }

    #[test]
    fn phone_profile_sets_dual_side_by_side() {
        // Isolate: save/restore would be ideal; just assert apply sets dual.
        // Clear source so profile can set dual default.
        unsafe {
            std::env::remove_var("LIVE_DEMUX_CAM_SOURCE");
        }
        apply_phone_tether_profile();
        assert_eq!(cam_source(), CamSource::Dual);
        assert!(cam_source().includes_local());
        assert!(cam_source().includes_phone());
        assert!(cam_auto_on());
    }
}
