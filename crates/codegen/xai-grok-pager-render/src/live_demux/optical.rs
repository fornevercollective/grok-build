//! `/watch optical` — jawta light + fountain blur as the **main watch surface**.
//!
//! fc-optical-transfer-v1 · screen→camera payload inside the Grok TTY modal
//! (half-block paint), with **`o`** / `/watch popout optical` for OS display
//! (browser send.html · jawta light).
//!
//! Not a side cam tile — the optical field **is** the stream pane.

use std::f32::consts::TAU;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant}; // Duration: decimen spawn settle

/// Sentinel URL for resolve_watch_source / LiveWatchState.
pub const OPTICAL_URL: &str = "optical://display";
pub const FEATURE_ID: &str = "fc-optical-transfer-v1";
pub const TOAST_OPTICAL: &str =
    "OPTICAL · /watch surface · jawta light + blur embed · o pop-out OS (fc-optical-transfer-v1)";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpticalMode {
    /// Soft bokeh + temporal OOK + corner glyph modules (default tool).
    Blur,
    /// Full-field jawta dit/dah beam.
    Light,
    /// Glyph-grid fountain modules only.
    Glyph,
    /// Same as blur but label as QR (browser pop-out uses QR mode).
    Qr,
}

impl OpticalMode {
    pub fn id(self) -> &'static str {
        match self {
            OpticalMode::Blur => "blur",
            OpticalMode::Light => "light",
            OpticalMode::Glyph => "glyph",
            OpticalMode::Qr => "qr",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            OpticalMode::Blur => "optical blur · jawta + embed",
            OpticalMode::Light => "optical light · jawta pulse",
            OpticalMode::Glyph => "optical glyph · fountain grid",
            OpticalMode::Qr => "optical qr · fountain embed",
        }
    }
}

/// True when a slash token means optical display (not yt-dlp / cam desk).
pub fn is_optical_token(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "optical"
            | "optic"
            | "optical-blur"
            | "opticalblur"
            | "jawta"
            | "jawta-light"
            | "light-tx"
            | "lighttx"
            | "fountain"
            | "decimen"
            | "airgap"
            | "air-gap"
    )
}

/// True when `input` (channel string) is an optical watch source.
pub fn is_optical_source(input: &str) -> bool {
    let t = input.trim();
    if t == OPTICAL_URL || t.starts_with("optical://") {
        return true;
    }
    let key = t
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    is_optical_token(&key)
        || matches!(
            key.as_str(),
            "blur" | "glyph" | "light" // only when paired via parse_optical — see below
        ) && t.to_ascii_lowercase().contains("optical")
}

/// Live timesync pulse body (morse-safe). Replaces legacy SOS default feed.
pub fn timesync_pulse_text() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Format via chrono-free UTC from unix — simple manual UTC breakdown
    // Use local formatting via HTTP-date style: prefer gmtime via libc-less math
    let days = now / 86400;
    let rem = now % 86400;
    let hh = rem / 3600;
    let mm = (rem % 3600) / 60;
    let ss = rem % 60;
    // Civil date from days since 1970-01-01 (Howard Hinnant algorithm)
    let z = days as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    let mon = match m {
        1 => "JAN",
        2 => "FEB",
        3 => "MAR",
        4 => "APR",
        5 => "MAY",
        6 => "JUN",
        7 => "JUL",
        8 => "AUG",
        9 => "SEP",
        10 => "OCT",
        11 => "NOV",
        _ => "DEC",
    };
    format!(
        "Z {hh:02}{mm:02}{ss:02}Z {d:02} {mon} {y} U {now}",
        hh = hh,
        mm = mm,
        ss = ss,
        d = d,
        mon = mon,
        y = y,
        now = now
    )
}

/// Resolve pulse library keys: sos/timesync/zulu/clock/sync → live timesync.
pub fn resolve_optical_text(raw: &str, mode: OpticalMode) -> String {
    let t = raw.trim();
    let low = t.to_ascii_lowercase();
    let timesync_keys = [
        "sos",
        "timesync",
        "zulu",
        "clock",
        "utc",
        "sync",
        "time",
    ];
    if timesync_keys.contains(&low.as_str()) {
        return timesync_pulse_text();
    }
    if t.is_empty() {
        return match mode {
            OpticalMode::Light => timesync_pulse_text(),
            _ => std::env::var("LIVE_DEMUX_OPTICAL_TEXT").unwrap_or_else(|_| "FC OPTICAL".into()),
        };
    }
    t.to_string()
}

/// Parse mode + free text from `/watch optical light timesync` style args.
pub fn parse_optical_args(input: &str) -> (OpticalMode, String) {
    let lower = input.trim().to_ascii_lowercase();
    let mut mode = OpticalMode::Blur;
    let mut text_parts: Vec<&str> = Vec::new();
    for tok in lower.split_whitespace() {
        if is_optical_token(tok) || tok == "optical://" || tok.starts_with("optical://") {
            if let Some(rest) = tok.strip_prefix("optical://") {
                mode = match rest {
                    "light" => OpticalMode::Light,
                    "glyph" => OpticalMode::Glyph,
                    "qr" => OpticalMode::Qr,
                    _ => OpticalMode::Blur,
                };
            }
            continue;
        }
        match tok {
            "blur" | "soft" | "bokeh" => mode = OpticalMode::Blur,
            "light" | "pulse" | "beam" | "morse" => mode = OpticalMode::Light,
            "glyph" | "grid" | "modules" => mode = OpticalMode::Glyph,
            "qr" | "qrcode" | "fountain" => mode = OpticalMode::Qr,
            "popout" | "out" | "external" | "ffplay" | "window" => {}
            other => text_parts.push(other),
        }
    }
    let raw = if text_parts.is_empty() {
        String::new()
    } else {
        text_parts.join(" ")
    };
    let text = resolve_optical_text(&raw, mode);
    (mode, text)
}

pub fn optical_url(mode: OpticalMode) -> String {
    format!("optical://{}", mode.id())
}

// ── RGB frame generator (software optical display) ─────────────────────

struct SharedOpt {
    width: u32,
    height: u32,
    rgb: Option<Vec<u8>>,
    generation: AtomicU64,
    error: Option<String>,
}

fn text_to_morse(text: &str) -> String {
    let table: &[(&str, &str)] = &[
        ("a", ".-"),
        ("b", "-..."),
        ("c", "-.-."),
        ("d", "-.."),
        ("e", "."),
        ("f", "..-."),
        ("g", "--."),
        ("h", "...."),
        ("i", ".."),
        ("j", ".---"),
        ("k", "-.-"),
        ("l", ".-.."),
        ("m", "--"),
        ("n", "-."),
        ("o", "---"),
        ("p", ".--."),
        ("q", "--.-"),
        ("r", ".-."),
        ("s", "..."),
        ("t", "-"),
        ("u", "..-"),
        ("v", "...-"),
        ("w", ".--"),
        ("x", "-..-"),
        ("y", "-.--"),
        ("z", "--.."),
        ("0", "-----"),
        ("1", ".----"),
        ("2", "..---"),
        ("3", "...--"),
        ("4", "....-"),
        ("5", "....."),
        ("6", "-...."),
        ("7", "--..."),
        ("8", "---.."),
        ("9", "----."),
        (" ", " "),
    ];
    text.to_ascii_lowercase()
        .chars()
        .filter_map(|c| {
            let s = c.to_string();
            table.iter().find(|(k, _)| *k == s.as_str()).map(|(_, m)| *m)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// (start_ms, dur_ms) for ON marks.
fn morse_events(morse: &str, wpm: f32) -> Vec<(f32, f32)> {
    let dit = 1200.0 / wpm.max(1.0);
    let mut t = 0.0f32;
    let mut ev = Vec::new();
    for ch in morse.chars() {
        match ch {
            '.' => {
                ev.push((t, dit));
                t += dit + dit;
            }
            '-' => {
                ev.push((t, dit * 3.0));
                t += dit * 3.0 + dit;
            }
            ' ' => t += dit * 3.0,
            _ => {}
        }
    }
    ev
}

fn on_at(events: &[(f32, f32)], ms: f32) -> bool {
    events
        .iter()
        .any(|&(s, d)| ms >= s && ms < s + d)
}

fn render_frame(
    w: u32,
    h: u32,
    t: f32,
    on: f32,
    mode: OpticalMode,
    seq: u32,
    text_hash: u32,
) -> Vec<u8> {
    let w = w.max(8) as usize;
    let h = h.max(8) as usize;
    let mut rgb = vec![0u8; w * h * 3];
    let base = 28.0 + 70.0 * on;
    match mode {
        OpticalMode::Light => {
            let v = if on > 0.5 { 245u8 } else { 12u8 };
            for px in rgb.chunks_exact_mut(3) {
                px[0] = v;
                px[1] = (v as f32 * 0.85) as u8;
                px[2] = (v as f32 * 0.2) as u8;
            }
        }
        OpticalMode::Glyph | OpticalMode::Qr => {
            // full glyph-ish grid
            let n = 25usize;
            let cell_w = (w / n).max(1);
            let cell_h = (h / n).max(1);
            for y in 0..h {
                for x in 0..w {
                    let gx = x / cell_w;
                    let gy = y / cell_h;
                    let bit = ((gx * 17 + gy * 31 + seq as usize + text_hash as usize) ^ (seq as usize * 3))
                        & 1;
                    let border = gx == 0 || gy == 0 || gx + 1 >= n || gy + 1 >= n;
                    let v = if border {
                        if ((gx + gy + seq as usize) & 1) == 0 {
                            0
                        } else {
                            255
                        }
                    } else if bit == 1 {
                        0
                    } else {
                        255
                    };
                    let i = (y * w + x) * 3;
                    rgb[i] = v;
                    rgb[i + 1] = v;
                    rgb[i + 2] = v;
                }
            }
        }
        OpticalMode::Blur => {
            for y in 0..h {
                let v = y as f32 / (h as f32 - 1.0).max(1.0);
                for x in 0..w {
                    let u = x as f32 / (w as f32 - 1.0).max(1.0);
                    let mut lum = base;
                    // soft blobs
                    for k in 0..5 {
                        let kf = k as f32;
                        let bx = 0.25 + 0.5 * ((t * 0.35 + kf * 1.7).sin() * 0.5 + 0.5);
                        let by = 0.3 + 0.4 * ((t * 0.28 + kf * 2.1).cos() * 0.5 + 0.5);
                        let dx = u - bx;
                        let dy = v - by;
                        let g = (-(dx * dx + dy * dy) / (2.0 * 0.04)).exp();
                        lum += 55.0 * g * (0.5 + 0.5 * on);
                    }
                    // vignette
                    let cx = u - 0.5;
                    let cy = v - 0.5;
                    let vig = 1.0 - 0.4 * (cx * cx + cy * cy) * 4.0;
                    lum *= vig.clamp(0.2, 1.0);
                    let r = (lum + 10.0 * (u * 6.0 + t).sin()).clamp(0.0, 255.0) as u8;
                    let g = lum.clamp(0.0, 255.0) as u8;
                    let b = (lum + 14.0 * (v * 5.0 - t).cos()).clamp(0.0, 255.0) as u8;
                    let i = (y * w + x) * 3;
                    rgb[i] = r;
                    rgb[i + 1] = g;
                    rgb[i + 2] = b;
                }
            }
            // corner glyph stamp (bottom-right embed)
            stamp_glyph_corner(&mut rgb, w, h, seq, text_hash);
        }
    }
    // subtle scanline for light/blur identity
    if matches!(mode, OpticalMode::Blur | OpticalMode::Light) {
        for y in (0..h).step_by(4) {
            for x in 0..w {
                let i = (y * w + x) * 3;
                rgb[i] = rgb[i].saturating_sub(6);
                rgb[i + 1] = rgb[i + 1].saturating_sub(4);
            }
        }
    }
    let _ = TAU; // keep import warm for future phase anim
    rgb
}

fn stamp_glyph_corner(rgb: &mut [u8], w: usize, h: usize, seq: u32, text_hash: u32) {
    let n = 11usize;
    let cell = (w.min(h) / 28).max(2);
    let gw = n * cell;
    let gh = n * cell;
    let x0 = w.saturating_sub(gw + 2);
    let y0 = h.saturating_sub(gh + 2);
    for gy in 0..n {
        for gx in 0..n {
            let border = gx == 0 || gy == 0 || gx + 1 == n || gy + 1 == n;
            let bit = ((gx * 13 + gy * 7 + seq as usize) ^ text_hash as usize) & 1;
            let on = border || bit == 1;
            let v = if on { 0u8 } else { 255u8 };
            for cy in 0..cell {
                for cx in 0..cell {
                    let x = x0 + gx * cell + cx;
                    let y = y0 + gy * cell + cy;
                    if x < w && y < h {
                        let i = (y * w + x) * 3;
                        rgb[i] = v;
                        rgb[i + 1] = v;
                        rgb[i + 2] = v;
                    }
                }
            }
        }
    }
}

/// Background optical RGB feed for the watch stream pane.
pub struct OpticalFeed {
    shared: Arc<Mutex<SharedOpt>>,
    stop: Arc<AtomicBool>,
    _join: Option<JoinHandle<()>>,
    mode: OpticalMode,
}

impl OpticalFeed {
    pub fn start(mode: OpticalMode, width: u32, height: u32, text: &str) -> Self {
        let w = width.max(16) & !1;
        let h = height.max(16) & !1;
        let shared = Arc::new(Mutex::new(SharedOpt {
            width: w,
            height: h,
            rgb: None,
            generation: AtomicU64::new(0),
            error: None,
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let shared_c = Arc::clone(&shared);
        let stop_c = Arc::clone(&stop);
        let text_owned = text.to_string();
        let wpm: f32 = std::env::var("LIVE_DEMUX_OPTICAL_WPM")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(15.0);
        let fps: f32 = std::env::var("LIVE_DEMUX_OPTICAL_FPS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(12.0);
        let join = thread::Builder::new()
            .name("live-demux-optical".into())
            .spawn(move || {
                // Refresh timesync pulse each cycle so light feed tracks wall clock
                let mut text_live = resolve_optical_text(&text_owned, mode);
                let mut morse = text_to_morse(&text_live);
                let mut events = morse_events(&morse, wpm);
                let mut cycle = events
                    .last()
                    .map(|(s, d)| s + d)
                    .unwrap_or(1000.0)
                    .max(1.0);
                let mut text_hash = text_live
                    .bytes()
                    .fold(0u32, |a, b| a.wrapping_mul(31).wrapping_add(b as u32));
                let t0 = Instant::now();
                let mut seq = 0u32;
                let mut cycle_anchor = 0.0f32;
                let period = Duration::from_secs_f32(1.0 / fps.max(1.0));
                while !stop_c.load(Ordering::Relaxed) {
                    let elapsed = t0.elapsed().as_secs_f32();
                    // new timesync body every morse cycle for light mode
                    if mode == OpticalMode::Light && elapsed - cycle_anchor >= cycle {
                        cycle_anchor = elapsed;
                        text_live = timesync_pulse_text();
                        morse = text_to_morse(&text_live);
                        events = morse_events(&morse, wpm);
                        cycle = events
                            .last()
                            .map(|(s, d)| s + d)
                            .unwrap_or(1000.0)
                            .max(1.0);
                        text_hash = text_live
                            .bytes()
                            .fold(0u32, |a, b| a.wrapping_mul(31).wrapping_add(b as u32));
                    }
                    let ms = ((elapsed - cycle_anchor) * 1000.0) % cycle;
                    let on = if on_at(&events, ms) { 1.0f32 } else { 0.0 };
                    let frame = render_frame(w, h, elapsed, on, mode, seq, text_hash);
                    if let Ok(mut g) = shared_c.lock() {
                        g.rgb = Some(frame);
                        g.generation.fetch_add(1, Ordering::Relaxed);
                    }
                    seq = seq.wrapping_add(1);
                    thread::sleep(period);
                }
            })
            .ok();
        Self {
            shared,
            stop,
            _join: join,
            mode,
        }
    }

    pub fn mode(&self) -> OpticalMode {
        self.mode
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
        self.shared.lock().ok()?.error.take()
    }
}

impl Drop for OpticalFeed {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

// ── Pop-out / serve (OS display alongside TTY watch) ───────────────────

fn optical_script_dir() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let candidates = [
        PathBuf::from(&home).join("Projects/grok-build/scripts/live-demux/optical-transfer"),
        PathBuf::from(&home)
            .join("Projects/fornevercollective/grok-build/scripts/live-demux/optical-transfer"),
    ];
    if let Ok(root) = std::env::var("FC_GROK_ROOT") {
        let p = PathBuf::from(root).join("scripts/live-demux/optical-transfer");
        if p.is_dir() {
            return Some(p);
        }
    }
    candidates.into_iter().find(|p| p.is_dir())
}

/// BashAlarmist Decimen app (load-tested fountain QR in browser).
fn decimen_dir() -> Option<PathBuf> {
    optical_script_dir().map(|d| d.join("vendor/decimen-optical-transfer"))
}

fn decimen_port() -> u16 {
    std::env::var("LIVE_DEMUX_DECIMEN_PORT")
        .or_else(|_| std::env::var("LIVE_DEMUX_OPTICAL_PORT"))
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(5173)
}

/// Default LAN port for optical HTTP TX/RX pages.
pub fn optical_port() -> u16 {
    std::env::var("LIVE_DEMUX_OPTICAL_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8767)
}

/// Fire-and-forget OS optical display.
///
/// - **Qr / Glyph** → BashAlarmist **Decimen** (vendored load-tested browser QR)
/// - **Blur / Light** → fc send.html (jawta + soft field); QR path still uses Decimen when requested
pub fn launch_optical_popout_async(mode: OpticalMode, text: &str) -> String {
    let mode_id = mode.id().to_string();
    let text = text.to_string();
    let use_decimen = matches!(mode, OpticalMode::Qr | OpticalMode::Glyph)
        || std::env::var("LIVE_DEMUX_OPTICAL_DECIMEN")
            .map(|s| matches!(s.trim(), "1" | "true" | "yes" | "on" | "always"))
            .unwrap_or(false);
    let _ = thread::Builder::new()
        .name("optical-popout".into())
        .spawn(move || {
            let r = if use_decimen {
                launch_decimen_popout_blocking()
            } else {
                launch_fc_popout_blocking(mode_id.as_str(), &text, optical_port())
            };
            if let Err(e) = r {
                eprintln!("[fc-optical] pop-out: {e}");
            }
        });
    if use_decimen {
        let port = decimen_port();
        format!(
            "optical pop-out · Decimen fountain QR (BashAlarmist) · \
             https://127.0.0.1:{port}/send/ · phone RX https://LAN:{port}/receive/ · \
             (load-tested browser PoC · MIT)"
        )
    } else {
        let port = optical_port();
        format!(
            "optical pop-out · {} · http://127.0.0.1:{port}/send.html?mode={} · \
             tip: /optical qr → Decimen load-tested QR",
            mode.label(),
            mode.id()
        )
    }
}

/// Launch vendored Decimen (Vite HTTPS preferred for phone getUserMedia).
fn launch_decimen_popout_blocking() -> Result<String, String> {
    let dir = optical_script_dir()
        .ok_or_else(|| "optical-transfer scripts missing".to_string())?;
    let sh = dir.join("decimen.sh");
    if !sh.is_file() {
        return Err(format!("missing {}", sh.display()));
    }
    if decimen_dir().map(|d| d.join("dist/send/index.html").is_file()) != Some(true) {
        // best-effort build
        let _ = Command::new("bash")
            .arg(&sh)
            .arg("build")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let port = decimen_port();
    // Prefer HTTPS dev server so phone camera works on LAN (same as upstream README).
    let mut cmd = Command::new("bash");
    cmd.arg(&sh).arg("dev");
    cmd.env("LIVE_DEMUX_DECIMEN_PORT", port.to_string());
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("decimen dev spawn: {e}"))?;
    // Give vite a moment, then open send (https self-signed).
    thread::sleep(Duration::from_millis(900));
    let url = format!("https://127.0.0.1:{port}/send/");
    let _ = open_url(&url);
    Ok(format!(
        "decimen · pid {} · {url} · RX /receive/ (accept cert once on phone)",
        child.id()
    ))
}

fn launch_fc_popout_blocking(mode: &str, text: &str, port: u16) -> Result<String, String> {
    let dir = optical_script_dir()
        .ok_or_else(|| "optical-transfer scripts missing".to_string())?;
    let script = dir.join("optical_blur.py");
    if !script.is_file() {
        return Err(format!("missing {}", script.display()));
    }
    // Write payload for browser
    if let Ok(home) = std::env::var("HOME") {
        let pipe = PathBuf::from(home).join(".panda/vision/cast");
        let _ = std::fs::create_dir_all(&pipe);
        let b64 = base64_encode(text.as_bytes());
        let _ = std::fs::write(
            pipe.join("optical-tx-payload.json"),
            format!(
                "{{\"mode\":\"{mode}\",\"text\":{},\"b64\":\"{b64}\",\"wpm\":15}}\n",
                serde_json_str(text)
            ),
        );
    }
    let mut cmd = Command::new("python3");
    cmd.arg(&script)
        .arg("serve")
        .arg("--port")
        .arg(port.to_string())
        .arg("--path")
        .arg(format!("/send.html?mode={mode}&auto=1"));
    cmd.env("LIVE_DEMUX_OPTICAL_TEXT", text);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("optical serve spawn: {e}"))?;
    let url = format!("http://127.0.0.1:{port}/send.html?mode={mode}&auto=1");
    let _ = open_url(&url);
    Ok(format!("optical OS display · pid {} · {url}", child.id()))
}

fn open_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = Command::new("xdg-open").arg(url).spawn();
        Ok(())
    }
}

fn base64_encode(data: &[u8]) -> String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            T[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

fn serde_json_str(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            c if c.is_control() => {}
            c => o.push(c),
        }
    }
    o.push('"');
    o
}
