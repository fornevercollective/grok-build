//! External **pop-out** player for `/watch` — real OS window via `ffplay`.
//!
//! In-TTY half-block stays the default; pop-out is a first-class ability:
//! - `/watch popout bloomberg` (also `out`, `--popout`, `external`, `ffplay`)
//! - **`o`** key while the live-watch modal is open (stream)
//! - **`Y`** key / `/watch camout` / `/watch popout camera` — **user camera(s)**
//!   as Zoom-style OS windows (see [`launch_cam_popout_async`])
//!
//! Stream pop-out prefers progressive / audio-capable formats (not the low-res
//! RGB demux pipe used for half-block paint). Camera pop-out uses AVFoundation
//! / v4l2 directly. The ffplay process is **detached** and outlives the TUI
//! modal (close Esc does not kill it).

use super::{
    resolve_playlist_limited, resolve_stream_url, resolve_watch_source, playlist_end_for,
    ytdlp_cookie_args, ChannelKind,
};
use super::camera::{cam_capture_size, cam_device, cam_mirror_default};
use std::process::{Command, Stdio};
use std::thread;

/// Toast when slash-command pop-out is kicked off.
pub const TOAST_POPOUT: &str =
    "WATCH · pop-out → external ffplay (fc-live-demux-v1 · o key · /watch popout …)";

/// Toast when camera pop-out is kicked off.
pub const TOAST_CAM_POPOUT: &str =
    "WATCH · cam pop-out → Zoom-style ffplay (Y key · /watch camout · /watch cameras)";

/// True when a slash-arg token means "open external window, not TTY modal".
pub fn is_popout_token(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "popout"
            | "pop-out"
            | "pop_out"
            | "out"
            | "--popout"
            | "--pop-out"
            | "-o"
            | "external"
            | "ext"
            | "ffplay"
            | "window"
    )
}

/// Tokens that **always** mean Zoom-style camera OS windows (not TTY stream).
///
/// Bare `camera` / `cam` alone do **not** force pop-out — those stay available
/// for TTY PiP (`launch-watch.sh camera` / key **`c`**). Pair them with
/// `popout` / `out`: `/watch popout camera`.
pub fn is_cam_popout_token(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "camout"
            | "cam-out"
            | "cam_out"
            | "cameras"
            | "webcam"
            | "self"
            | "selfie"
            | "you"
            | "zoom"
            | "gallery"
            | "camgrid"
            | "mosaic"
            // With explicit pop-out flag only (see is_cam_popout_source):
            | "camera"
            | "cam"
    )
}

/// Tokens that force external cam windows even without `popout` in the args.
fn is_force_cam_popout_token(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "camout"
            | "cam-out"
            | "cam_out"
            | "cameras"
            | "webcam"
            | "self"
            | "selfie"
            | "you"
            | "zoom"
            | "gallery"
            | "camgrid"
            | "mosaic"
    )
}

/// True when the remaining channel string should launch camera OS windows
/// instead of a stream resolve (used when pop-out path is already selected,
/// or for force tokens like `camout` / `cameras`).
pub fn is_cam_popout_source(channel: &str) -> bool {
    let t = channel.trim().to_ascii_lowercase();
    if t.is_empty() {
        return false;
    }
    let first = t.split_whitespace().next().unwrap_or("");
    is_cam_popout_token(first)
}

/// Split `/watch` args into `(popout, channel_or_url)`.
///
/// Accepts tokens anywhere: `popout bloomberg`, `bloomberg --popout`, `out vevo`.
/// Shuffle flags (`shuffle` / `noshuffle`) are left in the rest string so
/// [`LiveWatchState::open`] can apply them (or stripped only for pop-out).
///
/// Force cam pop-out (no stream modal): `camout`, `cameras`, `mosaic`, `you`, …
/// Explicit: `/watch popout camera` · `/watch out cam`.
pub fn parse_watch_args(raw: &str) -> (bool, String) {
    let mut popout = false;
    let mut parts: Vec<&str> = Vec::new();
    for tok in raw.split_whitespace() {
        if is_popout_token(tok) {
            popout = true;
        } else {
            parts.push(tok);
        }
    }
    let channel = parts.join(" ");
    let first = channel
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if is_force_cam_popout_token(&first) {
        popout = true;
    }
    (popout, channel)
}

/// Resolve a direct media URL suitable for external playback (audio + higher res).
///
/// Falls back to the half-block stream resolver if the pop-out format fails.
pub fn resolve_popout_stream_url(page_url: &str) -> Result<String, String> {
    // Prefer single progressive/HLS with audio under 720p; then best overall.
    let formats = [
        "b[height<=720]/best[height<=720]/bv*[height<=720]+ba/b",
        "b/best/bv*+ba/b",
    ];
    for fmt in formats {
        if let Ok(url) = ytdlp_g(page_url, fmt) {
            return Ok(url);
        }
    }
    // Last resort: same path as in-TTY demux (may be video-only).
    resolve_stream_url(page_url)
}

fn ytdlp_g(page_url: &str, format: &str) -> Result<String, String> {
    let mut cmd = Command::new("yt-dlp");
    cmd.args(["-g", "-f", format, "--no-playlist", "--no-warnings"]);
    for a in ytdlp_cookie_args() {
        cmd.arg(a);
    }
    cmd.arg(page_url)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    let out = cmd
        .output()
        .map_err(|e| format!("yt-dlp -g failed: {e}"))?;
    if !out.status.success() {
        return Err("yt-dlp -g failed".into());
    }
    // Combined formats → one line; split av → first is typically video.
    // Prefer a single line; if multiple, still take first (ffplay one input).
    let url = String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    if url.is_empty() {
        return Err("yt-dlp -g empty".into());
    }
    Ok(url)
}

/// Spawn detached `ffplay` for a resolved stream URL. Returns OS pid.
pub fn spawn_ffplay_popout(stream_url: &str, window_title: &str) -> Result<u32, String> {
    let title = if window_title.is_empty() {
        "pop-out · /watch".to_string()
    } else {
        // Keep SDL window title sane (no newlines).
        let t: String = window_title.chars().take(96).collect();
        format!("pop-out · /watch · {t}")
    };

    let mut cmd = Command::new("ffplay");
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-autoexit",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-framedrop",
        "-window_title",
        &title,
        stream_url,
    ]);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    // Detach so Esc in TUI / shell exit does not kill the window.
    xai_tty_utils::detach_std_command(&mut cmd);

    let child = cmd
        .spawn()
        .map_err(|e| format!("ffplay spawn failed (install ffmpeg?): {e}"))?;
    Ok(child.id())
}

/// Blocking: resolve channel/URL → first playlist entry → stream → ffplay.
pub fn launch_popout_blocking(input: &str) -> Result<String, String> {
    let resolved = resolve_watch_source(input);
    let end = playlist_end_for(resolved.kind);
    let entries = resolve_playlist_limited(&resolved.url, end)?;
    let entry = entries
        .first()
        .ok_or_else(|| format!("{}: empty playlist (channel offline?)", resolved.label))?;
    let stream = resolve_popout_stream_url(&entry.page_url)?;
    let title = if entry.title.is_empty() {
        resolved.label.clone()
    } else {
        format!("{} · {}", resolved.label, entry.title)
    };
    let pid = spawn_ffplay_popout(&stream, &title)?;
    Ok(format!(
        "pop-out · {} · ffplay pid {pid} (close window to quit)",
        resolved.label
    ))
}

/// Fire-and-forget pop-out. Returns a toast immediately; resolve runs on a worker.
pub fn launch_popout_async(input: &str) -> String {
    let resolved = resolve_watch_source(input);
    let label = resolved.label.clone();
    let input_owned = input.to_string();
    let kind = resolved.kind;
    let label_for_worker = label.clone();
    let _ = thread::Builder::new()
        .name("live-demux-popout".into())
        .spawn(move || {
            if let Err(e) = launch_popout_blocking(&input_owned) {
                // Best-effort: surface on stderr so agents / launch scripts see it.
                eprintln!("[live-demux pop-out] {label_for_worker}: {e}");
            }
        });
    match kind {
        ChannelKind::LiveNews => format!("pop-out · news · launching ffplay… ({label})"),
        ChannelKind::MusicTv => format!("pop-out · music TV · launching ffplay… ({label})"),
        ChannelKind::Generic => format!("pop-out · launching ffplay… ({label})"),
    }
}

/// Pop out from an already-open modal (known page URL + label).
pub fn popout_page(page_url: &str, label: &str) -> Result<String, String> {
    let stream = resolve_popout_stream_url(page_url)?;
    let pid = spawn_ffplay_popout(&stream, label)?;
    Ok(format!("pop-out · {label} · ffplay pid {pid}"))
}

// ── Camera pop-out (Zoom-style self / multi-cam windows) ─────────────────

/// How many cameras to open for a cam-popout request.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CamPopMode {
    /// `LIVE_DEMUX_CAM_DEVICE` / default index only (selfie).
    Primary,
    /// Every real camera (webcams / Continuity only), each its own window.
    All,
    /// One gallery window via ffmpeg xstack (2–N cams).
    Mosaic,
    /// Laptop webcam **and** phone still-pipe (`live.jpg`) — two OS windows.
    Dual,
    /// Phone still-pipe only (Memory Glass inspect live.jpg).
    PhoneStill,
}

/// Parse channel string after popout flags → cam mode.
///
/// | input | mode |
/// |-------|------|
/// | `cam` `camera` `self` `you` `webcam` `camout` | Primary |
/// | `cameras` `all` (as second token) | All |
/// | `mosaic` `grid` `zoom` `gallery` `camgrid` | Mosaic |
pub fn parse_cam_pop_mode(channel: &str) -> CamPopMode {
    let t = channel.trim().to_ascii_lowercase();
    let tokens: Vec<&str> = t.split_whitespace().collect();
    if tokens.iter().any(|t| {
        matches!(
            *t,
            "mosaic" | "grid" | "zoom" | "gallery" | "camgrid" | "xstack"
        )
    }) {
        return CamPopMode::Mosaic;
    }
    if tokens.iter().any(|t| {
        matches!(
            *t,
            "dual" | "both" | "sidebyside" | "sbs" | "you+phone" | "pair"
        )
    }) {
        return CamPopMode::Dual;
    }
    if tokens.iter().any(|t| {
        matches!(
            *t,
            "phone" | "still" | "stillpipe" | "tether" | "pwa" | "live.jpg"
        )
    }) {
        return CamPopMode::PhoneStill;
    }
    if tokens.iter().any(|t| matches!(*t, "cameras" | "all")) {
        return CamPopMode::All;
    }
    // `camout all` style
    if tokens.len() >= 2 && tokens[1] == "all" {
        return CamPopMode::All;
    }
    // When dual cam is active, bare primary pop-out opens both windows.
    if super::camera::cam_source().is_dual() {
        return CamPopMode::Dual;
    }
    CamPopMode::Primary
}

/// ffplay looping still-pipe JPEG (phone PWA → live.jpg).
pub fn spawn_ffplay_still(path: &str, label: &str) -> Result<u32, String> {
    use super::camera::{cam_still_path, ensure_still_seed_public};
    let still = if path.is_empty() {
        cam_still_path()
    } else {
        path.to_string()
    };
    ensure_still_seed_public(&still);
    let (disp_w, disp_h) = cam_pop_display_size();
    let title = if label.is_empty() {
        "cam · phone still-pipe".into()
    } else {
        format!("cam · {label}")
    };
    let mut cmd = Command::new("ffplay");
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-framedrop",
        "-loop",
        "0",
        "-window_title",
        &title,
        "-vf",
        &format!("scale={disp_w}:{disp_h}"),
        &still,
    ]);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("ffplay still spawn failed: {e}"))?;
    Ok(child.id())
}

/// Display size for cam ffplay windows (`LIVE_DEMUX_CAM_SIZE`, default 960x540).
fn cam_pop_display_size() -> (u32, u32) {
    if let Ok(s) = std::env::var("LIVE_DEMUX_CAM_SIZE") {
        if let Some((a, b)) = s.split_once('x') {
            if let (Ok(w), Ok(h)) = (a.parse::<u32>(), b.parse::<u32>()) {
                return (w.max(320), h.max(240));
            }
        }
    }
    (960, 540)
}

fn cam_pop_fps() -> u32 {
    std::env::var("LIVE_DEMUX_CAM_FPS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(15)
        .clamp(1, 30)
}

/// List real AVFoundation video device indices (macOS). Skips non-camera entries.
pub fn list_avfoundation_cameras() -> Vec<(String, String)> {
    if !cfg!(target_os = "macos") {
        return Vec::new();
    }
    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-f", "avfoundation", "-list_devices", "true", "-i", ""]);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    xai_tty_utils::detach_std_command(&mut cmd);
    let Ok(out) = cmd.output() else {
        return Vec::new();
    };
    let err = String::from_utf8_lossy(&out.stderr);
    let mut in_video = false;
    let mut cams = Vec::new();
    for line in err.lines() {
        if line.contains("AVFoundation video devices:") {
            in_video = true;
            continue;
        }
        if line.contains("AVFoundation audio devices:") {
            break;
        }
        if !in_video {
            continue;
        }
        // e.g. [AVFoundation …] [0] FaceTime HD Camera (Built-in)
        if let Some(br) = line.rfind('[') {
            let rest = &line[br + 1..];
            if let Some(end) = rest.find(']') {
                let idx = rest[..end].trim();
                let name = rest[end + 1..].trim();
                if idx.chars().all(|c| c.is_ascii_digit())
                    && !name.is_empty()
                    && !name.starts_with("Capture screen")
                {
                    cams.push((idx.to_string(), name.to_string()));
                }
            }
        }
    }
    cams
}

/// Spawn detached `ffplay` on a local camera device. Returns OS pid.
pub fn spawn_ffplay_camera(device: &str, label: &str, mirror: bool) -> Result<u32, String> {
    // Continuity Brick needs native modes (not FaceTime defaults).
    // Never treat a bare index as Continuity without name resolve — indices
    // renumber when Continuity disconnects.
    let is_phone = super::camera::cam_phone_device()
        .as_ref()
        .is_some_and(|d| d == device);
    let (cap_w, cap_h) = if is_phone {
        super::camera::cam_phone_capture_size()
    } else {
        cam_capture_size()
    };
    let (disp_w, disp_h) = cam_pop_display_size();
    let fps = if is_phone {
        std::env::var("LIVE_DEMUX_CAM_PHONE_FPS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(30u32)
            .clamp(8, 30)
    } else {
        cam_pop_fps()
    };
    let title = if label.is_empty() {
        format!("cam · [{device}]")
    } else {
        let t: String = label.chars().take(80).collect();
        format!("cam · [{device}] {t}")
    };
    let mut vf = format!("scale={disp_w}:{disp_h}");
    if mirror {
        vf = format!("hflip,{vf}");
    }

    let mut cmd = Command::new("ffplay");
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-framedrop",
        "-window_title",
        &title,
    ]);

    if cfg!(target_os = "macos") {
        let fr = format!("{fps}");
        let sz = format!("{cap_w}x{cap_h}");
        let inp = format!("{device}:none");
        if is_phone {
            cmd.args([
                "-f",
                "avfoundation",
                "-framerate",
                &fr,
                "-video_size",
                &sz,
                "-pixel_format",
                "uyvy422",
                "-i",
                &inp,
                "-an",
                "-vf",
                &vf,
            ]);
        } else {
            cmd.args([
                "-f",
                "avfoundation",
                "-framerate",
                &fr,
                "-video_size",
                &sz,
                "-i",
                &inp,
                "-an",
                "-vf",
                &vf,
            ]);
        }
    } else if cfg!(target_os = "linux") {
        let dev = if device.starts_with('/') {
            device.to_string()
        } else {
            format!("/dev/video{device}")
        };
        cmd.args([
            "-f",
            "v4l2",
            "-framerate",
            &format!("{fps}"),
            "-video_size",
            &format!("{cap_w}x{cap_h}"),
            "-i",
            &dev,
            "-an",
            "-vf",
            &vf,
        ]);
    } else {
        return Err("camera pop-out only on macOS / Linux".into());
    }

    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);

    let child = cmd
        .spawn()
        .map_err(|e| format!("ffplay camera spawn failed: {e}"))?;
    Ok(child.id())
}

/// Spawn one mosaic window (ffmpeg xstack → ffplay) for multiple cameras.
fn spawn_ffplay_camera_mosaic(cams: &[(String, String)]) -> Result<u32, String> {
    if cams.is_empty() {
        return Err("no cameras for mosaic".into());
    }
    if cams.len() == 1 {
        return spawn_ffplay_camera(&cams[0].0, &cams[0].1, cam_mirror_default());
    }
    if !cfg!(target_os = "macos") {
        // Linux: open separate windows (xstack multi-v4l2 is finicky).
        let mut last = 0u32;
        for (idx, name) in cams {
            last = spawn_ffplay_camera(idx, name, false)?;
            thread::sleep(std::time::Duration::from_millis(300));
        }
        return Ok(last);
    }

    let n = cams.len();
    let (cols, rows) = if n == 2 {
        (2, 1)
    } else if n <= 4 {
        (2, 2)
    } else if n <= 6 {
        (3, 2)
    } else {
        let cols = (n as f64).sqrt().ceil() as usize;
        let rows = ((n as f64) / cols as f64).ceil() as usize;
        (cols, rows)
    };
    let (cell_w, cell_h) = cam_pop_display_size();
    let (cap_w, cap_h) = cam_capture_size();
    let fps = cam_pop_fps();

    let mut filter_parts: Vec<String> = Vec::new();
    let mut stack_in = String::new();
    let mut layout = String::new();
    for i in 0..n {
        filter_parts.push(format!(
            "[{i}:v]scale={cell_w}:{cell_h},setsar=1[v{i}]"
        ));
        stack_in.push_str(&format!("[v{i}]"));
        let r = i / cols;
        let c = i % cols;
        let x = c * cell_w as usize;
        let y = r * cell_h as usize;
        if !layout.is_empty() {
            layout.push('|');
        }
        layout.push_str(&format!("{x}_{y}"));
    }
    let fc = format!(
        "{};{stack_in}xstack=inputs={n}:layout={layout}[out]",
        filter_parts.join(";"),
        stack_in = stack_in,
        n = n,
        layout = layout,
    );

    let names: String = cams
        .iter()
        .map(|(_, n)| format!("[{n}]"))
        .collect::<Vec<_>>()
        .join(" ");
    let title: String = format!("cam mosaic · {n} · {names}")
        .chars()
        .take(96)
        .collect();

    // ffmpeg complex → rawvideo pipe → ffplay is heavy; use ffmpeg to SDL via ffplay filter.
    // Simpler: ffmpeg outputs to pipe and ffplay reads — but multi-input needs one process.
    // Use ffplay with filter_complex (ffplay accepts -filter_complex).
    let mut cmd = Command::new("ffplay");
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-framedrop",
        "-window_title",
        &title,
    ]);
    for (idx, _) in cams {
        cmd.args([
            "-f",
            "avfoundation",
            "-framerate",
            &format!("{fps}"),
            "-video_size",
            &format!("{cap_w}x{cap_h}"),
            "-i",
            &format!("{idx}:none"),
        ]);
    }
    cmd.args(["-filter_complex", &fc, "-map", "[out]", "-an"]);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);

    let child = cmd
        .spawn()
        .map_err(|e| format!("ffplay mosaic spawn failed: {e}"))?;
    let _ = (rows, cols); // layout already baked into filter
    Ok(child.id())
}

/// Blocking: open camera pop-out windows for the given mode.
pub fn launch_cam_popout_blocking(mode: CamPopMode) -> Result<String, String> {
    let mirror = cam_mirror_default();
    match mode {
        CamPopMode::Primary => {
            let device = cam_device();
            let label = format!("primary · device {device}");
            let pid = spawn_ffplay_camera(&device, &label, mirror)?;
            Ok(format!(
                "cam pop-out · [{device}] · ffplay pid {pid} (close window to quit)"
            ))
        }
        CamPopMode::PhoneStill => {
            // Live Continuity when configured; else still-pipe slideshow.
            if let Some(dev) = super::camera::cam_phone_device() {
                let pid = spawn_ffplay_camera(&dev, "phone · Continuity live", false)?;
                Ok(format!(
                    "cam pop-out · phone LIVE Continuity [{dev}] · ffplay pid {pid}"
                ))
            } else {
                let path = super::camera::cam_still_path();
                let pid = spawn_ffplay_still(&path, "phone still-pipe")?;
                Ok(format!(
                    "cam pop-out · phone still · {path} · ffplay pid {pid}"
                ))
            }
        }
        CamPopMode::Dual => {
            // Side-by-side OS windows: laptop webcam + live Continuity (or still).
            let device = cam_device();
            let you = spawn_ffplay_camera(&device, "you · laptop webcam", mirror)?;
            thread::sleep(std::time::Duration::from_millis(350));
            let phone = if let Some(dev) = super::camera::cam_phone_device() {
                spawn_ffplay_camera(&dev, "phone · Continuity live", false)?
            } else {
                let path = super::camera::cam_still_path();
                spawn_ffplay_still(&path, "phone still-pipe")?
            };
            Ok(format!(
                "cam pop-out · dual LIVE · you[{device}] pid {you} · phone pid {phone}"
            ))
        }
        CamPopMode::All => {
            let cams = if cfg!(target_os = "macos") {
                let listed = list_avfoundation_cameras();
                if listed.is_empty() {
                    // Fall back to env / 0
                    vec![(cam_device(), "primary".into())]
                } else {
                    listed
                }
            } else {
                vec![(cam_device(), "primary".into())]
            };
            let mut pids = Vec::new();
            for (idx, name) in &cams {
                match spawn_ffplay_camera(idx, name, mirror) {
                    Ok(pid) => pids.push(format!("[{idx}] pid {pid}")),
                    Err(e) => pids.push(format!("[{idx}] err: {e}")),
                }
                // Stagger opens so AVFoundation does not race.
                thread::sleep(std::time::Duration::from_millis(350));
            }
            // Also open phone still if dual/phone source is active.
            if super::camera::cam_source().includes_phone() {
                let path = super::camera::cam_still_path();
                match spawn_ffplay_still(&path, "phone still-pipe") {
                    Ok(pid) => pids.push(format!("[phone] pid {pid}")),
                    Err(e) => pids.push(format!("[phone] err: {e}")),
                }
            }
            Ok(format!(
                "cam pop-out · {} windows · {}",
                pids.len(),
                pids.join(" · ")
            ))
        }
        CamPopMode::Mosaic => {
            let cams = if cfg!(target_os = "macos") {
                let listed = list_avfoundation_cameras();
                if listed.is_empty() {
                    vec![(cam_device(), "primary".into())]
                } else {
                    listed
                }
            } else {
                vec![(cam_device(), "primary".into())]
            };
            let pid = spawn_ffplay_camera_mosaic(&cams)?;
            Ok(format!(
                "cam mosaic · {} cams · ffplay pid {pid}",
                cams.len()
            ))
        }
    }
}

/// Fire-and-forget camera pop-out. Returns toast immediately.
pub fn launch_cam_popout_async(mode: CamPopMode) -> String {
    let mode_label = match mode {
        CamPopMode::Primary => "selfie",
        CamPopMode::All => "all cameras",
        CamPopMode::Mosaic => "gallery mosaic",
        CamPopMode::Dual => "you + phone (dual)",
        CamPopMode::PhoneStill => "phone still-pipe",
    };
    let _ = thread::Builder::new()
        .name("live-demux-cam-popout".into())
        .spawn(move || {
            if let Err(e) = launch_cam_popout_blocking(mode) {
                eprintln!("[live-demux cam pop-out] {e}");
            }
        });
    format!("cam pop-out · {mode_label} · launching ffplay… (Zoom-style OS window)")
}

/// Route a pop-out channel string: camera → cam windows, optical → browser,
/// glyph → quantum-lift ffplay + arena, else stream.
pub fn launch_popout_smart_async(input: &str) -> String {
    if is_cam_popout_source(input) {
        let mode = parse_cam_pop_mode(input);
        return launch_cam_popout_async(mode);
    }
    // Optical first so `/watch popout optical glyph` stays optical TX.
    if super::optical::is_optical_source(input) {
        let (mode, text) = super::optical::parse_optical_args(input);
        return super::optical::launch_optical_popout_async(mode, &text);
    }
    // Plant glyph: custom ffmpeg/ffplay via quantum-lift + open arena form.
    if super::glyph_watch::is_glyph_watch_source(input) {
        let (_mode, stream_url, _) = super::glyph_watch::parse_glyph_watch_args(input);
        return super::glyph_watch::launch_glyph_popout_async(stream_url.as_deref(), true);
    }
    // Empty with bare `/watch popout` stays stream (VEVO default).
    launch_popout_async(input)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_popout_prefix() {
        let (p, ch) = parse_watch_args("popout bloomberg");
        assert!(p);
        assert_eq!(ch, "bloomberg");
    }

    #[test]
    fn parse_popout_suffix() {
        let (p, ch) = parse_watch_args("bloomberg --popout");
        assert!(p);
        assert_eq!(ch, "bloomberg");
    }

    #[test]
    fn parse_out_alias() {
        let (p, ch) = parse_watch_args("out cnn");
        assert!(p);
        assert_eq!(ch, "cnn");
    }

    #[test]
    fn parse_no_popout() {
        let (p, ch) = parse_watch_args("bloomberg");
        assert!(!p);
        assert_eq!(ch, "bloomberg");
    }

    #[test]
    fn parse_bare_popout_means_default_channel() {
        let (p, ch) = parse_watch_args("popout");
        assert!(p);
        assert!(ch.is_empty());
    }

    #[test]
    fn token_detect() {
        assert!(is_popout_token("POPOUT"));
        assert!(is_popout_token("ffplay"));
        assert!(!is_popout_token("bloomberg"));
    }

    #[test]
    fn camout_implies_popout() {
        let (p, ch) = parse_watch_args("camout");
        assert!(p);
        assert_eq!(ch, "camout");
        assert!(is_cam_popout_source(&ch));
        assert_eq!(parse_cam_pop_mode(&ch), CamPopMode::Primary);
    }

    #[test]
    fn cameras_all_mode() {
        let (p, ch) = parse_watch_args("cameras");
        assert!(p);
        assert_eq!(parse_cam_pop_mode(&ch), CamPopMode::All);
    }

    #[test]
    fn mosaic_mode() {
        assert_eq!(parse_cam_pop_mode("mosaic"), CamPopMode::Mosaic);
        assert_eq!(parse_cam_pop_mode("zoom"), CamPopMode::Mosaic);
        let (p, ch) = parse_watch_args("popout camera");
        assert!(p);
        assert_eq!(parse_cam_pop_mode(&ch), CamPopMode::Primary);
    }
}
