//! Live demux pipeline: yt-dlp resolve + ffmpeg RGB24 pipe → half-block TTY.
//!
//! **fornevercollective** · `fc-live-demux-v1`
//!
//! Plays YouTube / playlist URLs **inside Grok** (same paint ladder as `/gboom`:
//! Kitty when available, else [`crate::render::halfblock`]).
//!
//! **Pop-out** (first-class): external `ffplay` OS window — `/watch popout …`
//! or **`o`** while the modal is open (stream; see [`popout`]).
//!
//! **Camera pop-out** (Zoom-style): `/watch camout` · `/watch cameras` ·
//! `/watch mosaic` · **`Y`** in the modal — local AVFoundation/v4l2 → OS window(s).
//!
//! ```text
//! /watch bloomberg | vevo | URL  →  channels → PlaylistController → StreamResolver → LiveDemux → paint
//! /watch popout bloomberg        →  channels → resolve → ffplay window (detached)
//! /watch camout | cameras | mosaic →  local cam(s) → ffplay (Zoom tiles / gallery)
//! ```

mod camera;
mod channels;
mod glyph_watch;
mod layout;
mod lens;
mod mic;
mod optical;
mod popout;
mod webgrid;
mod x_live;

pub use camera::{
    apply_cam_profile, apply_phone_tether_profile, cam_auto_on, cam_capture_size, cam_device,
    cam_dims, cam_mirror_default, cam_source, cam_still_path, cam_width_frac, is_desk_source,
    CamSource, CameraFeed, DESK_URL,
};
pub use mic::{mic_auto_on, MicLevelFeed, MicSnapshot, MicSource, WAVE_BINS};
// cam_width_frac retained for side-mode / env overrides (layout prefers PiP).
pub use layout::{
    cam_tile_cells, dual_cam_desk, dual_cam_tiles, is_lean_term, layout_watch_video,
    popup_fill_frac, prefer_pip, CamMode, WatchVideoLayout, GLYPH_HALF_ROWS, GLYPH_LEAN_HALF_ROWS,
    GLYPH_LEAN_N, GLYPH_N, TERM_LEAN_COLS, TERM_LEAN_ROWS,
};
pub use channels::{
    channel_index_in_filter, channel_suggest_items, channels_for_filter, find_channel,
    format_channel_list, hop_letter, is_trailer_feed_id, next_news_channel, news_channels_alpha,
    prev_news_channel, resolve_watch_source, ChannelDef, ChannelKind, ChannelRegion, GuideFilter,
    ResolvedSource, CHANNELS, DEFAULT_CHANNEL_ID, MOVIE_TRAILERS_URL, VEVO_FRIDAY_URL,
};
pub use popout::{
    is_cam_popout_source, is_popout_token, launch_cam_popout_async, launch_cam_popout_blocking,
    launch_popout_async, launch_popout_blocking, launch_popout_smart_async, list_avfoundation_cameras,
    parse_cam_pop_mode, parse_watch_args, popout_page, resolve_popout_stream_url,
    spawn_ffplay_camera, spawn_ffplay_popout, CamPopMode, TOAST_CAM_POPOUT, TOAST_POPOUT,
};
pub use lens::{
    is_cam_style_token, is_lens_token, launch_lens_async, launch_lens_blocking,
    launch_optic_style_blocking, lens_vf, parse_lens_args, LensInput, LensProfile,
    FEATURE_ID as LENS_FEATURE_ID, TOAST_LENS,
};
pub use x_live::{
    is_go_live_token, is_x_hub_token, is_x_locator, is_x_page_url, is_x_user_media_feed,
    launch_go_live_async, normalize_x_url, open_x_studio, parse_go_live_args, x_user_media_handle,
    HINT_PASTE_X, TOAST_GO_LIVE,
};
pub use optical::{
    is_optical_source, is_optical_token, launch_optical_popout_async, optical_url,
    parse_optical_args, OpticalFeed, OpticalMode, FEATURE_ID as OPTICAL_FEATURE_ID, OPTICAL_URL,
    TOAST_OPTICAL,
};
pub use glyph_watch::{
    arena_glyph_url, glyph_url, is_glyph_watch_source, is_glyph_watch_token,
    launch_glyph_popout_async, parse_glyph_watch_args, GlyphWatchMode,
    FEATURE_ID as GLYPH_WATCH_FEATURE_ID, GLYPH_URL, TOAST_GLYPH,
};
pub use webgrid::{
    is_drone_hud_args, is_webgrid_source, is_webgrid_token, launch_webgrid_drone_popout_async,
    launch_webgrid_drone_popout_url_async, launch_webgrid_popout_async, parse_webgrid_args,
    webgrid_drone_page_url, webgrid_page_url, webgrid_url, WebgridFeed, WebgridMode,
    FEATURE_ID as WEBGRID_FEATURE_ID, TOAST_WEBGRID, TOAST_WEBGRID_DRONE, WEBGRID_URL,
};

use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;

/// Minimum rows reserved under the video for the in-modal search bar.
const SEARCH_BAR_ROWS: u16 = 1;

/// Feature identity (ledger / toast).
pub const FEATURE_ID: &str = "fc-live-demux-v1";
pub const FEATURE_LABEL: &str = "fornevercollective live demux";
/// Cam talk / waveform / motion-track stamp (Memory Glass → terminal).
pub const FEATURE_CAM_TALK: &str = mic::FEATURE_ID; // "fc-cam-talk-v1"
pub const TOAST_OPEN: &str =
    "WATCH · live demux · c cam · a mic · t talk · H dual · L lens · o pop-out (fc-live-demux-v1 · fc-cam-talk-v1)";
/// Toast when opening dual cam desk (you|phone only — no yt-dlp).
pub const TOAST_DESK: &str =
    "DESK · you | phone  · no VEVO  · H cycle · L lens · Y pop dual (fc-cam-talk-v1)";
/// Toast when `/watch optical` opens the optical blur surface.
pub const TOAST_OPTICAL_WATCH: &str = optical::TOAST_OPTICAL;
/// Toast when `/watch glyph` opens the plant glyph control-plane surface.
pub const TOAST_GLYPH_WATCH: &str = glyph_watch::TOAST_GLYPH;
/// Toast when `/watch webgrid` opens the offline ugrad chase surface.
pub const TOAST_WEBGRID_WATCH: &str = webgrid::TOAST_WEBGRID;

/// Default Friday-stream playlist when `/watch` is bare (= VEVO music TV).
pub const DEFAULT_URL: &str = VEVO_FRIDAY_URL;

fn env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

fn demux_dims() -> (u32, u32) {
    let w = env_u32("LIVE_DEMUX_W", 160).max(2) & !1; // even for half-block
    let h = env_u32("LIVE_DEMUX_H", 90).max(2) & !1;
    (w, h)
}

fn demux_fps() -> f64 {
    let n = env_u32("LIVE_DEMUX_FPS", 12).clamp(1, 30);
    n as f64
}

fn scrub_sec() -> u32 {
    env_u32("LIVE_DEMUX_SCRUB_SEC", 10).max(1)
}

fn playlist_end_for(kind: ChannelKind) -> u32 {
    playlist_end_for_channel(kind, None)
}

fn playlist_end_for_channel(kind: ChannelKind, channel_id: Option<&str>) -> u32 {
    // Trailer feeds want a deep catalog so shuffle has room to roam.
    let default = if channel_id.is_some_and(is_trailer_feed_id) {
        120
    } else {
        match kind {
            // Music TV needs a long zap list (VEVO Friday style). News is a single live.
            ChannelKind::MusicTv => 80,
            ChannelKind::LiveNews => 5,
            ChannelKind::Generic => 40,
        }
    };
    env_u32("LIVE_DEMUX_PLAYLIST_END", default).max(1)
}

/// Strip shuffle flags from `/watch` args. Returns `(forced_shuffle, remaining)`.
///
/// `forced_shuffle`: `Some(true/false)` when user passed a flag; `None` = channel default.
///
/// Tokens: `shuffle` `--shuffle` `-s` `random` · `noshuffle` `sequential` `seq`
pub fn strip_shuffle_flag(raw: &str) -> (Option<bool>, String) {
    let mut forced: Option<bool> = None;
    let mut parts: Vec<&str> = Vec::new();
    for tok in raw.split_whitespace() {
        match tok.to_ascii_lowercase().as_str() {
            "shuffle" | "--shuffle" | "-s" | "random" | "rand" => forced = Some(true),
            "noshuffle" | "--no-shuffle" | "no-shuffle" | "sequential" | "seq" | "linear" => {
                forced = Some(false)
            }
            _ => parts.push(tok),
        }
    }
    (forced, parts.join(" "))
}

/// Fisher–Yates shuffle (deterministic seed — time + pid for live variety).
fn shuffle_vec<T>(items: &mut [T], seed: u64) {
    if items.len() < 2 {
        return;
    }
    let mut state = seed | 1;
    for i in (1..items.len()).rev() {
        // xorshift64*
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        let j = (state as usize) % (i + 1);
        items.swap(i, j);
    }
}

fn random_playlist_index(len: usize, exclude: Option<usize>) -> usize {
    if len == 0 {
        return 0;
    }
    if len == 1 {
        return 0;
    }
    let nanos = Instant::now().elapsed().as_nanos() as u64;
    let seed = nanos
        ^ (std::process::id() as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15)
        ^ exclude.unwrap_or(0) as u64;
    let mut state = seed | 1;
    state ^= state << 13;
    state ^= state >> 7;
    state ^= state << 17;
    let mut i = (state as usize) % len;
    if exclude == Some(i) {
        i = (i + 1) % len;
    }
    i
}

// ---------------------------------------------------------------------------
// Playlist
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub page_url: String,
}

pub(crate) fn ytdlp_cookie_args() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(path) = std::env::var("YTDLP_COOKIES")
        && !path.is_empty()
        && PathBuf::from(&path).is_file()
    {
        out.push("--cookies".into());
        out.push(path);
    } else if let Ok(browser) = std::env::var("YTDLP_COOKIES_FROM_BROWSER")
        && !browser.is_empty()
    {
        out.push("--cookies-from-browser".into());
        out.push(browser);
    }
    // X/Twitter-specific cookie env when generic cookies are unset.
    if out.is_empty() {
        if let Ok(browser) = std::env::var("X_COOKIES_FROM_BROWSER")
            && !browser.is_empty()
        {
            out.push("--cookies-from-browser".into());
            out.push(browser);
        } else if let Ok(path) = std::env::var("X_COOKIES")
            && !path.is_empty()
            && PathBuf::from(&path).is_file()
        {
            out.push("--cookies".into());
            out.push(path);
        }
    }
    out
}

/// Resolve a watch URL or playlist into flat entries via yt-dlp.
pub fn resolve_playlist(url: &str) -> Result<Vec<PlaylistEntry>, String> {
    resolve_playlist_limited(url, playlist_end_for(ChannelKind::Generic))
}

/// Resolve with an explicit playlist-end (music TV uses a longer list).
pub fn resolve_playlist_limited(url: &str, end: u32) -> Result<Vec<PlaylistEntry>, String> {
    // X profile Media tabs are not yt-dlp playlists — expand via GraphQL helper.
    if x_live::is_x_user_media_feed(url) {
        match resolve_x_user_media_playlist(url, end) {
            Ok(entries) if !entries.is_empty() => return Ok(entries),
            Ok(_) => {
                return Err(format!(
                    "X media feed empty for {url} (cookies? YTDLP_COOKIES_FROM_BROWSER=safari)"
                ));
            }
            Err(e) => return Err(e),
        }
    }

    let end = end.max(1).to_string();
    let mut cmd = Command::new("yt-dlp");
    cmd.args([
        "--flat-playlist",
        "-j",
        "--playlist-end",
        &end,
        "--no-warnings",
    ]);
    for a in ytdlp_cookie_args() {
        cmd.arg(a);
    }
    cmd.arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("yt-dlp not available: {e}"))?;
    if !output.status.success() && output.stdout.is_empty() {
        return Err("yt-dlp flat-playlist failed (cookies? bot wall?)".into());
    }

    let mut entries = Vec::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let eid = v
            .get("id")
            .and_then(|x| x.as_str())
            .or_else(|| v.get("url").and_then(|x| x.as_str()))
            .unwrap_or("")
            .to_string();
        if eid.is_empty() {
            continue;
        }
        let title = v
            .get("title")
            .and_then(|x| x.as_str())
            .unwrap_or(&eid)
            .replace('|', "/")
            .replace('\n', " ");
        let title = title.chars().take(80).collect::<String>();
        let mut page = v
            .get("url")
            .and_then(|x| x.as_str())
            .or_else(|| v.get("webpage_url").and_then(|x| x.as_str()))
            .unwrap_or("")
            .to_string();
        if !page.starts_with("http") {
            page = format!("https://www.youtube.com/watch?v={eid}");
        }
        entries.push(PlaylistEntry {
            id: eid,
            title,
            page_url: page,
        });
    }

    if entries.is_empty() {
        // Single-item fallback
        let title = resolve_title(url).unwrap_or_else(|| "item".into());
        entries.push(PlaylistEntry {
            id: "single".into(),
            title,
            page_url: url.to_string(),
        });
    }
    Ok(entries)
}

/// Expand `https://x.com/<user>/media` via `scripts/live-demux/x-media-feed.py`.
fn resolve_x_user_media_playlist(url: &str, end: u32) -> Result<Vec<PlaylistEntry>, String> {
    let end = end.max(1).to_string();
    let script = x_media_feed_script().ok_or_else(|| {
        "x-media-feed.py not found (expected scripts/live-demux/x-media-feed.py under repo or GROK_BUILD_ROOT)".to_string()
    })?;

    // Prefer yt-dlp's venv python (has yt_dlp.cookies); fall back to python3.
    let py = ytdlp_python().unwrap_or_else(|| "python3".into());
    let mut cmd = Command::new(&py);
    cmd.arg(&script)
        .args(["--end", &end, "--format", "jsonl"])
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // Propagate cookie env so the helper matches yt-dlp.
    for (k, v) in [
        ("YTDLP_COOKIES", std::env::var("YTDLP_COOKIES").ok()),
        (
            "YTDLP_COOKIES_FROM_BROWSER",
            std::env::var("YTDLP_COOKIES_FROM_BROWSER")
                .ok()
                .or_else(|| std::env::var("X_COOKIES_FROM_BROWSER").ok())
                .or_else(|| Some("safari".into())),
        ),
        ("X_COOKIES", std::env::var("X_COOKIES").ok()),
        (
            "X_COOKIES_FROM_BROWSER",
            std::env::var("X_COOKIES_FROM_BROWSER").ok(),
        ),
    ] {
        if let Some(val) = v {
            if !val.is_empty() {
                cmd.env(k, val);
            }
        }
    }
    xai_tty_utils::detach_std_command(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("x-media-feed.py spawn failed ({py}): {e}"))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let err = err.trim();
        return Err(if err.is_empty() {
            "x-media-feed.py failed (login x.com in Safari? YTDLP_COOKIES_FROM_BROWSER=safari)".into()
        } else {
            format!("x-media-feed: {err}")
        });
    }

    let mut entries = Vec::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        let eid = v
            .get("id")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        if eid.is_empty() {
            continue;
        }
        let title = v
            .get("title")
            .and_then(|x| x.as_str())
            .unwrap_or(&eid)
            .replace('|', "/")
            .replace('\n', " ");
        let title = title.chars().take(80).collect::<String>();
        let page = v
            .get("url")
            .and_then(|x| x.as_str())
            .or_else(|| v.get("webpage_url").and_then(|x| x.as_str()))
            .unwrap_or("")
            .to_string();
        if !page.starts_with("http") {
            continue;
        }
        entries.push(PlaylistEntry {
            id: eid,
            title,
            page_url: page,
        });
    }
    Ok(entries)
}

fn x_media_feed_script() -> Option<PathBuf> {
    // Explicit override
    if let Ok(p) = std::env::var("X_MEDIA_FEED_PY") {
        let pb = PathBuf::from(&p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    // Repo-relative candidates
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(r) = std::env::var("GROK_BUILD_ROOT") {
        roots.push(PathBuf::from(r));
    }
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.clone());
        // walk up a few levels for when binary runs from target/
        let mut p = cwd;
        for _ in 0..5 {
            if p.join("scripts/live-demux/x-media-feed.py").is_file() {
                roots.push(p.clone());
            }
            if !p.pop() {
                break;
            }
        }
    }
    // Common dev path
    if let Some(home) = std::env::var_os("HOME") {
        roots.push(PathBuf::from(home).join("Projects/grok-build"));
    }
    for root in roots {
        let cand = root.join("scripts/live-demux/x-media-feed.py");
        if cand.is_file() {
            return Some(cand);
        }
    }
    None
}

fn ytdlp_python() -> Option<String> {
    // Homebrew cellar layouts
    for base in ["/usr/local/Cellar/yt-dlp", "/opt/homebrew/Cellar/yt-dlp"] {
        let base = PathBuf::from(base);
        if !base.is_dir() {
            continue;
        }
        let mut versions: Vec<PathBuf> = std::fs::read_dir(&base)
            .ok()?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.is_dir())
            .collect();
        versions.sort();
        versions.reverse();
        for v in versions {
            let py = v.join("libexec/bin/python");
            if py.is_file() {
                return Some(py.to_string_lossy().into_owned());
            }
        }
    }
    // `yt-dlp` next to a venv python
    if let Ok(out) = Command::new("yt-dlp")
        .args(["--version"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
    {
        if out.success() {
            // fall through — caller uses python3
        }
    }
    None
}

fn resolve_title(url: &str) -> Option<String> {
    let mut cmd = Command::new("yt-dlp");
    cmd.args(["--print", "%(title)s", "--no-playlist", "--no-warnings"]);
    for a in ytdlp_cookie_args() {
        cmd.arg(a);
    }
    cmd.arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    let t = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if t.is_empty() { None } else { Some(t) }
}

/// Soft cache for resolved stream URLs (HLS/googlevideo expire; keep ≤90 min).
struct StreamCacheEntry {
    stream: String,
    at: Instant,
}

fn stream_cache() -> &'static Mutex<HashMap<String, StreamCacheEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<String, StreamCacheEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

const STREAM_CACHE_TTL: Duration = Duration::from_secs(90 * 60);

fn cache_get_stream(page_url: &str) -> Option<String> {
    let Ok(map) = stream_cache().lock() else {
        return None;
    };
    let e = map.get(page_url)?;
    if e.at.elapsed() > STREAM_CACHE_TTL {
        return None;
    }
    Some(e.stream.clone())
}

fn cache_put_stream(page_url: &str, stream: &str) {
    if let Ok(mut map) = stream_cache().lock() {
        // Bound cache size so long zap sessions don't grow forever.
        if map.len() > 128 {
            map.clear();
        }
        map.insert(
            page_url.to_string(),
            StreamCacheEntry {
                stream: stream.to_string(),
                at: Instant::now(),
            },
        );
    }
}

/// Resolve a direct media URL for the current page (`yt-dlp -g`).
///
/// Uses a soft process-local cache so n/p zap across already-seen tracks is
/// near-instant until the CDN URL expires.
/// X.com / Twitter / pscp URLs try X-friendly format lists first.
pub fn resolve_stream_url(page_url: &str) -> Result<String, String> {
    if let Some(hit) = cache_get_stream(page_url) {
        return Ok(hit);
    }
    let formats: &[&str] = if x_live::is_x_page_url(page_url) {
        x_live::x_stream_format_candidates()
    } else {
        &["bv*[height<=480]+ba/b/bv*+ba/b"]
    };
    let mut last_err = String::from("yt-dlp -g failed");
    for fmt in formats {
        match ytdlp_g_one(page_url, fmt) {
            Ok(url) => {
                cache_put_stream(page_url, &url);
                return Ok(url);
            }
            Err(e) => last_err = e,
        }
    }
    Err(if x_live::is_x_page_url(page_url) {
        format!(
            "{last_err} · X/Twitter often needs login cookies \
             (YTDLP_COOKIES / YTDLP_COOKIES_FROM_BROWSER / X_COOKIES_FROM_BROWSER=safari)"
        )
    } else {
        last_err
    })
}

fn ytdlp_g_one(page_url: &str, format: &str) -> Result<String, String> {
    let mut cmd = Command::new("yt-dlp");
    cmd.args([
        "-g",
        "-f",
        format,
        "--no-playlist",
        "--no-warnings",
    ]);
    for a in ytdlp_cookie_args() {
        cmd.arg(a);
    }
    cmd.arg(page_url)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    xai_tty_utils::detach_std_command(&mut cmd);
    let out = cmd
        .output()
        .map_err(|e| format!("yt-dlp -g failed: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let snip = err.lines().next().unwrap_or("yt-dlp -g failed").trim();
        return Err(if snip.is_empty() {
            "yt-dlp -g failed (cookies? bot wall?)".into()
        } else {
            snip.chars().take(160).collect()
        });
    }
    let url = String::from_utf8_lossy(&out.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    if url.is_empty() {
        return Err("yt-dlp -g returned empty stream URL".into());
    }
    Ok(url)
}

// ---------------------------------------------------------------------------
// Shared frame state (reader thread → UI)
// ---------------------------------------------------------------------------

struct SharedFrame {
    width: u32,
    height: u32,
    /// Latest RGB24 frame (w*h*3).
    rgb: Option<Vec<u8>>,
    /// Monotonic generation; UI paints when this advances.
    generation: AtomicU64,
    error: Option<String>,
    eof: AtomicBool,
}

impl SharedFrame {
    fn new(w: u32, h: u32) -> Self {
        Self {
            width: w,
            height: h,
            rgb: None,
            generation: AtomicU64::new(0),
            error: None,
            eof: AtomicBool::new(false),
        }
    }

    fn frame_bytes(&self) -> usize {
        (self.width as usize) * (self.height as usize) * 3
    }
}

// ---------------------------------------------------------------------------
// Live demux child (ffmpeg → RGB24 stdout)
// ---------------------------------------------------------------------------

struct LiveDemux {
    child: Child,
    pg: xai_tty_utils::ProcessGroup,
    reader: Option<JoinHandle<()>>,
    shared: Arc<Mutex<SharedFrame>>,
    stop: Arc<AtomicBool>,
}

impl LiveDemux {
    fn start(stream_url: &str, seek_secs: u32, w: u32, h: u32, fps: f64) -> Result<Self, String> {
        let shared = Arc::new(Mutex::new(SharedFrame::new(w, h)));
        let stop = Arc::new(AtomicBool::new(false));

        let mut cmd = Command::new("ffmpeg");
        cmd.args(["-hide_banner", "-loglevel", "error"]);
        cmd.args([
            "-reconnect",
            "1",
            "-reconnect_streamed",
            "1",
            "-reconnect_delay_max",
            "5",
        ]);
        // Skip -ss 0 — some googlevideo URLs error on seek-at-zero.
        if seek_secs > 0 {
            cmd.args(["-ss", &seek_secs.to_string()]);
        }
        cmd.args(["-i", stream_url]);
        cmd.args([
            "-an",
            "-vf",
            &format!("scale={w}:{h}"),
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
        // Own process group so we can kill orphans on seek / track change.
        xai_tty_utils::detach_std_command(&mut cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("ffmpeg spawn failed: {e}"))?;
        let mut pg = xai_tty_utils::ProcessGroup::new()
            .map_err(|e| format!("process group: {e}"))?;
        let _ = pg.attach_std(&child);

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "ffmpeg stdout missing".to_string())?;
        let mut stderr = child.stderr.take();

        let shared_r = Arc::clone(&shared);
        let stop_r = Arc::clone(&stop);
        let frame_len = {
            let g = shared.lock().map_err(|_| "shared lock".to_string())?;
            g.frame_bytes()
        };

        let reader = thread::Builder::new()
            .name("live-demux-reader".into())
            .spawn(move || {
                let mut reader = stdout;
                let mut buf = vec![0u8; frame_len];
                // Drop under load: only keep latest complete frame.
                loop {
                    if stop_r.load(Ordering::Relaxed) {
                        break;
                    }
                    match read_exact_interruptible(&mut reader, &mut buf, &stop_r) {
                        Ok(true) => {
                            if let Ok(mut g) = shared_r.lock() {
                                g.rgb = Some(buf.clone());
                                g.generation.fetch_add(1, Ordering::Relaxed);
                            }
                        }
                        Ok(false) => {
                            // EOF
                            if let Ok(g) = shared_r.lock() {
                                g.eof.store(true, Ordering::Relaxed);
                            }
                            break;
                        }
                        Err(msg) => {
                            if let Ok(mut g) = shared_r.lock() {
                                g.error = Some(msg);
                                g.eof.store(true, Ordering::Relaxed);
                            }
                            break;
                        }
                    }
                }
                // Drain a bit of stderr for diagnostics.
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
            .map_err(|e| format!("reader thread: {e}"))?;

        Ok(Self {
            child,
            pg,
            reader: Some(reader),
            shared,
            stop,
        })
    }

    fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        let _ = self.pg.terminate();
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(h) = self.reader.take() {
            let _ = h.join();
        }
    }

    fn frame_generation(&self) -> u64 {
        self.shared
            .lock()
            .map(|g| g.generation.load(Ordering::Relaxed))
            .unwrap_or(0)
    }

    fn snapshot_rgb(&self) -> Option<(Vec<u8>, u32, u32)> {
        let g = self.shared.lock().ok()?;
        let rgb = g.rgb.clone()?;
        Some((rgb, g.width, g.height))
    }

    fn take_error(&self) -> Option<String> {
        self.shared
            .lock()
            .ok()
            .and_then(|mut g| g.error.take())
    }

    fn eof(&self) -> bool {
        self.shared
            .lock()
            .map(|g| g.eof.load(Ordering::Relaxed))
            .unwrap_or(true)
    }
}

impl Drop for LiveDemux {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Read exactly `buf.len()` bytes, or EOF / stop.
fn read_exact_interruptible(
    r: &mut impl Read,
    buf: &mut [u8],
    stop: &AtomicBool,
) -> Result<bool, String> {
    let mut off = 0;
    while off < buf.len() {
        if stop.load(Ordering::Relaxed) {
            return Ok(false);
        }
        match r.read(&mut buf[off..]) {
            Ok(0) => {
                if off == 0 {
                    return Ok(false); // clean EOF
                }
                return Err("short read from ffmpeg (pipe closed mid-frame)".into());
            }
            Ok(n) => off += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(format!("ffmpeg read: {e}")),
        }
    }
    Ok(true)
}

// ---------------------------------------------------------------------------
// LiveWatchState — modal owned by AgentView
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LiveWatchKeyOutcome {
    Close,
    Changed,
}

#[derive(Clone, Debug)]
enum Phase {
    /// Background resolve in flight.
    Resolving,
    /// Demux running (or paused holding last frame).
    Ready,
    Error(String),
}

/// Result channel from resolve / restart worker.
enum WorkerMsg {
    Playlist {
        entries: Vec<PlaylistEntry>,
        stream: String,
        idx: usize,
        seek: u32,
    },
    Stream {
        stream: String,
        idx: usize,
        seek: u32,
    },
    Failed(String),
}

/// In-player channel guide (A–Z list · region / news filters · letter hop).
#[derive(Clone, Debug)]
pub struct ChannelGuide {
    pub open: bool,
    pub filter: GuideFilter,
    /// Cursor into `channels_for_filter(filter)` (A–Z).
    pub cursor: usize,
    /// First visible row when the list is taller than the pane.
    pub scroll: usize,
}

impl Default for ChannelGuide {
    fn default() -> Self {
        Self {
            open: false,
            filter: GuideFilter::All,
            cursor: 0,
            scroll: 0,
        }
    }
}

/// Modal state for `/watch [url|channel]` — live demux → half-block inside Grok.
pub struct LiveWatchState {
    source_url: String,
    /// Human channel / source label (e.g. "Bloomberg Live", "VEVO Friday · music TV").
    channel_label: String,
    /// Canonical built-in id when known (`bloomberg`, `vevo`, …).
    channel_id: Option<String>,
    kind: ChannelKind,
    /// Prefer this region when zapping news stations with n/p.
    zap_region: Option<ChannelRegion>,
    entries: Vec<PlaylistEntry>,
    idx: usize,
    seek_secs: u32,
    playing: bool,
    phase: Phase,
    demux: Option<LiveDemux>,
    /// Optical blur / jawta light feed — **main stream pane** (`/watch optical`).
    optical: Option<OpticalFeed>,
    /// Offline webgrid-ugrad chase feed — **main stream pane** (`/watch webgrid`).
    webgrid: Option<WebgridFeed>,
    /// Optional local camera (left half when dual). Toggle with `c`.
    camera: Option<CameraFeed>,
    /// Optional phone still-pipe feed (right half when dual / `/cam phone`).
    camera_phone: Option<CameraFeed>,
    /// User wants camera on (may be waiting on first frame / error).
    camera_on: bool,
    camera_mirror: bool,
    camera_err: Option<String>,
    cam_paint_rgb: Option<Vec<u8>>,
    cam_paint_w: u32,
    cam_paint_h: u32,
    cam_paint_gen: u64,
    /// Phone still-pipe paint buffer (dual / phone-only).
    phone_paint_rgb: Option<Vec<u8>>,
    phone_paint_w: u32,
    phone_paint_h: u32,
    phone_paint_gen: u64,
    /// Mic level / waveform (Memory Glass talk grammar). Toggle with **`a`**.
    mic: Option<MicLevelFeed>,
    mic_on: bool,
    mic_snap: MicSnapshot,
    /// Motion energy 0..1 from cam frame diffs (tracking proxy).
    motion_level: f32,
    prev_cam_thumb: Option<Vec<u8>>,
    /// In-modal talk/chat strip (cam interaction). **`t`** focuses; Enter posts.
    talk_buf: String,
    talk_focused: bool,
    talk_lines: VecDeque<String>,
    /// Cached frame for paint (avoids clone every draw when gen stable).
    paint_rgb: Option<Vec<u8>>,
    paint_w: u32,
    paint_h: u32,
    paint_gen: u64,
    last_frame_time: Instant,
    fps: f64,
    status: String,
    worker_rx: Option<std::sync::mpsc::Receiver<WorkerMsg>>,
    /// When paused, freeze paint gen consumption.
    opened_at: Instant,
    /// Consecutive resolve/demux failures — auto-skip dead tracks, cap to avoid loops.
    fail_skips: u32,
    /// Last direct stream URL used by the in-TTY demux (for quick pop-out re-resolve base).
    current_page_url: Option<String>,
    /// Channel guide overlay (`g` / Tab).
    guide: ChannelGuide,
    /// In-modal search / tune bar under the video (`/` or `f` to focus).
    /// Type channel names, URLs, or free-text search without leaving `/watch`.
    search_buf: String,
    search_focused: bool,
    /// When true: EOF / auto-advance picks a **random** other track (trailer feed default).
    /// Toggle with **`S`**. One-shot random jump: **`s`**.
    shuffle: bool,
}

impl LiveWatchState {
    /// Open immediately; playlist + first stream resolve on a worker thread.
    ///
    /// `input` may be empty (→ VEVO Friday), a channel alias (`bloomberg`),
    /// a full URL, free-text search words, flags (`shuffle` / `noshuffle`),
    /// or **`desk`** (dual you|phone only — no yt-dlp).
    pub fn open(input: &str) -> Self {
        let (w, h) = demux_dims();
        let fps = demux_fps();
        let (shuffle_flag, clean_input) = strip_shuffle_flag(input);
        // `/cam phone` / dual desk must NEVER fall through to empty → VEVO.
        // Force desk when: explicit desk tokens, CAM_DESK=1, or dual source
        // with no real channel/URL (so /phone and /lens dual stay cam-only).
        let clean_input = {
            let t = clean_input.trim();
            let force_desk = camera::is_desk_source(t)
                || layout::dual_cam_desk()
                || (layout::dual_cam_tiles()
                    && (t.is_empty()
                        || matches!(
                            t.to_ascii_lowercase().as_str(),
                            "phone" | "tether" | "dual" | "both" | "cam" | "selfie"
                        )));
            if force_desk
                && (t.is_empty()
                    || camera::is_desk_source(t)
                    || matches!(
                        t.to_ascii_lowercase().as_str(),
                        "phone" | "tether" | "dual" | "both" | "cam" | "selfie"
                    ))
            {
                // Ensure layout paint path is desk even if slash forgot the env.
                // SAFETY: single-threaded open before worker spawn.
                unsafe {
                    std::env::set_var("LIVE_DEMUX_CAM_DESK", "1");
                    if !layout::dual_cam_tiles() {
                        std::env::set_var("LIVE_DEMUX_CAM_SOURCE", "dual");
                    }
                    std::env::set_var("LIVE_DEMUX_CAM_ON", "1");
                }
                "desk".to_string()
            } else {
                clean_input
            }
        };
        let resolved = resolve_watch_source(&clean_input);
        let source_url = resolved.url.clone();
        let channel_label = resolved.label.clone();
        let channel_id = resolved.channel_id.clone();
        let kind = resolved.kind;
        // Trailer feeds default to shuffle; others sequential unless flag set.
        let shuffle = match shuffle_flag {
            Some(v) => v,
            None => channel_id.as_deref().is_some_and(is_trailer_feed_id),
        };
        let zap_region = channel_id
            .as_deref()
            .and_then(find_channel)
            .map(|c| c.region)
            .or_else(|| match resolved.guide_filter {
                GuideFilter::Region(r) => Some(r),
                GuideFilter::Music => Some(ChannelRegion::Music),
                _ => None,
            });
        let end = playlist_end_for_channel(kind, channel_id.as_deref());
        // X hub / dual-cam desk: don't spawn yt-dlp.
        let x_hub = source_url == "x://hub"
            || channel_id.as_deref() == Some("x") && source_url.starts_with("x://");
        let desk = source_url == camera::DESK_URL
            || channel_id.as_deref() == Some("desk")
            || camera::is_desk_source(&clean_input)
            || layout::dual_cam_desk();
        let optical_src = optical::is_optical_source(&clean_input)
            || source_url.starts_with("optical://")
            || channel_id.as_deref() == Some("optical");
        // Offline webgrid-ugrad chase (our build) — synthetic TTY, not yt-dlp.
        let webgrid_src = !optical_src
            && (webgrid::is_webgrid_source(&clean_input)
                || source_url.starts_with("webgrid://")
                || channel_id.as_deref() == Some("webgrid"));
        let (webgrid_mode, webgrid_n, webgrid_turbo, _webgrid_label) = if webgrid_src {
            webgrid::parse_webgrid_args(&clean_input)
        } else {
            (webgrid::WebgridMode::Agent, 12, false, String::new())
        };
        // Plant glyph: synthetic TTY when no stream URL; stream demux when URL given.
        let glyph_src = !optical_src
            && !webgrid_src
            && (glyph_watch::is_glyph_watch_source(&clean_input)
                || source_url.starts_with("glyph://")
                || channel_id.as_deref() == Some("glyph"));
        let (glyph_mode, glyph_stream_url, _glyph_label) = if glyph_src {
            glyph_watch::parse_glyph_watch_args(&clean_input)
        } else {
            (glyph_watch::GlyphWatchMode::Dense, None, String::new())
        };
        // Synthetic glyph pane only when no concrete stream page.
        let glyph_synthetic = glyph_src
            && (source_url.starts_with("glyph://")
                || glyph_stream_url.is_none()
                    && !source_url.starts_with("http")
                    && !source_url.starts_with("rtsp")
                    && !source_url.starts_with("rtmp")
                    && !source_url.starts_with("file:"));
        let (optical_mode, optical_text) = if optical_src {
            optical::parse_optical_args(&clean_input)
        } else {
            (optical::OpticalMode::Blur, String::new())
        };
        let (tx, rx) = std::sync::mpsc::channel();
        let worker_rx = if x_hub || desk || optical_src || glyph_synthetic || webgrid_src {
            None
        } else {
            let url_c = source_url.clone();
            let label_c = channel_label.clone();
            let do_shuffle_order = shuffle;
            thread::Builder::new()
                .name("live-demux-resolve".into())
                .spawn(move || {
                    match resolve_playlist_limited(&url_c, end) {
                        Ok(mut entries) if !entries.is_empty() => {
                            if do_shuffle_order {
                                let seed = Instant::now().elapsed().as_nanos() as u64
                                    ^ (std::process::id() as u64);
                                shuffle_vec(&mut entries, seed);
                            }
                            let page = entries[0].page_url.clone();
                            match resolve_stream_url(&page) {
                                Ok(stream) => {
                                    let _ = tx.send(WorkerMsg::Playlist {
                                        entries,
                                        stream,
                                        idx: 0,
                                        seek: 0,
                                    });
                                }
                                Err(e) => {
                                    let _ = tx.send(WorkerMsg::Failed(format!("{label_c}: {e}")));
                                }
                            }
                        }
                        Ok(_) => {
                            let _ = tx.send(WorkerMsg::Failed(format!(
                                "{label_c}: empty playlist (channel offline?)"
                            )));
                        }
                        Err(e) => {
                            let _ = tx.send(WorkerMsg::Failed(format!("{label_c}: {e}")));
                        }
                    }
                })
                .ok();
            Some(rx)
        };

        let shuf = if shuffle { " · shuffle on" } else { "" };
        let status = if webgrid_src {
            format!(
                "webgrid · {} · {}×{} · arrows+space hit · a agent · o browser · Esc",
                webgrid_mode.id(),
                webgrid_n,
                webgrid_n
            )
        } else if optical_src {
            format!(
                "optical · {} · o OS pop-out · Esc  ({})",
                optical_mode.id(),
                optical_text.chars().take(32).collect::<String>()
            )
        } else if desk {
            "desk · you | phone  · H cycle · L lens · Y pop dual · a mic · t talk · Esc".into()
        } else if x_hub {
            x_live::HINT_PASTE_X.to_string()
        } else {
            match kind {
                ChannelKind::MusicTv => {
                    format!("music TV · resolving… ({channel_label}){shuf}  · g guide · s zap")
                }
                ChannelKind::LiveNews => {
                    format!("news live · resolving… ({channel_label})  · g guide · n/p stations")
                }
                ChannelKind::Generic => {
                    if x_live::is_x_page_url(&source_url) {
                        format!("X live · resolving… ({channel_label})")
                    } else {
                        format!("resolving… ({channel_label}){shuf}  · g guide")
                    }
                }
            }
        };

        let mut guide = ChannelGuide {
            open: resolved.open_guide,
            filter: resolved.guide_filter,
            cursor: 0,
            scroll: 0,
        };
        if let Some(ref id) = channel_id {
            if let Some(i) = channel_index_in_filter(guide.filter, id) {
                guide.cursor = i;
            }
        }

        let (cam_w, cam_h) = cam_dims();
        let mut state = Self {
            source_url,
            channel_label,
            channel_id,
            kind,
            zap_region,
            entries: Vec::new(),
            idx: 0,
            seek_secs: 0,
            playing: optical_src || webgrid_src || (!x_hub && !desk),
            phase: if x_hub || desk || optical_src || webgrid_src {
                Phase::Ready
            } else {
                Phase::Resolving
            },
            demux: None,
            optical: None,
            webgrid: None,
            camera: None,
            camera_phone: None,
            camera_on: false,
            camera_mirror: cam_mirror_default(),
            camera_err: None,
            cam_paint_rgb: None,
            cam_paint_w: cam_w,
            cam_paint_h: cam_h,
            cam_paint_gen: 0,
            phone_paint_rgb: None,
            phone_paint_w: cam_w,
            phone_paint_h: cam_h,
            phone_paint_gen: 0,
            mic: None,
            mic_on: false,
            mic_snap: MicSnapshot::idle(),
            motion_level: 0.0,
            prev_cam_thumb: None,
            talk_buf: String::new(),
            talk_focused: false,
            talk_lines: VecDeque::new(),
            paint_rgb: None,
            paint_w: w,
            paint_h: h,
            paint_gen: 0,
            last_frame_time: Instant::now(),
            fps,
            status,
            worker_rx,
            opened_at: Instant::now(),
            fail_skips: 0,
            current_page_url: None,
            guide,
            search_buf: if x_hub {
                "https://x.com/i/broadcasts/".into()
            } else {
                String::new()
            },
            search_focused: x_hub,
            shuffle,
        };
        // Optical surface: main pane is jawta/blur RGB (not yt-dlp).
        if optical_src {
            let (ow, oh) = demux_dims();
            // Prefer larger optical field when roomy (half-block scales).
            let (ow, oh) = (
                ow.max(64).min(160),
                oh.max(48).min(120),
            );
            state.optical = Some(OpticalFeed::start(
                optical_mode,
                ow,
                oh,
                &optical_text,
            ));
            state.playing = true;
            state.phase = Phase::Ready;
            state.paint_w = ow;
            state.paint_h = oh;
            state.status = format!(
                "optical · {} · o OS display · Esc · {}",
                optical_mode.id(),
                optical_text.chars().take(40).collect::<String>()
            );
            // Persist mode for L/o helpers
            unsafe {
                std::env::set_var("LIVE_DEMUX_OPTICAL_MODE", optical_mode.id());
                std::env::set_var("LIVE_DEMUX_OPTICAL_TEXT", &optical_text);
            }
        }
        // Plant glyph synthetic surface: dense grid TTY + o → quantum-lift pop-out.
        if glyph_synthetic {
            let (ow, oh) = demux_dims();
            let (ow, oh) = (ow.max(64).min(160), oh.max(48).min(120));
            // Reuse optical RGB generator in Glyph mode for the half-block pane.
            state.optical = Some(OpticalFeed::start(
                OpticalMode::Glyph,
                ow,
                oh,
                "FC GLYPH LIVE",
            ));
            state.playing = true;
            state.phase = Phase::Ready;
            state.paint_w = ow;
            state.paint_h = oh;
            state.channel_id = Some("glyph".into());
            if !state.source_url.starts_with("glyph://") {
                state.source_url = glyph_watch::glyph_url(glyph_mode);
            }
            state.status = format!(
                "glyph · {} · o quantum-lift+arena · Esc · {}",
                glyph_mode.id(),
                glyph_watch::arena_glyph_url()
            );
            unsafe {
                std::env::set_var("LIVE_DEMUX_GLYPH_MODE", glyph_mode.id());
            }
        }
        // Offline webgrid-ugrad chase (our build) — half-block grid instrument.
        if webgrid_src {
            let (ow, oh) = demux_dims();
            // Prefer square-ish board for N×N cells.
            let side = ow.max(oh).max(96).min(200);
            let (ow, oh) = (side & !1, side & !1);
            state.webgrid = Some(WebgridFeed::start(
                webgrid_mode,
                webgrid_n,
                webgrid_turbo,
                ow,
                oh,
            ));
            state.playing = true;
            state.phase = Phase::Ready;
            state.paint_w = ow;
            state.paint_h = oh;
            state.channel_id = Some("webgrid".into());
            if !state.source_url.starts_with("webgrid://") {
                state.source_url = webgrid::webgrid_url(webgrid_mode);
            }
            state.channel_label = format!("webgrid-ugrad · {}×{}", webgrid_n, webgrid_n);
            state.status = format!(
                "webgrid · {} · {}×{} · arrows hit · a agent · r restart · o browser · Esc",
                webgrid_mode.id(),
                webgrid_n,
                webgrid_n
            );
            unsafe {
                std::env::set_var("LIVE_DEMUX_WEBGRID_MODE", webgrid_mode.id());
                std::env::set_var("LIVE_DEMUX_WEBGRID_N", webgrid_n.to_string());
            }
        }
        // Auto-open local camera side pane (launch-watch.sh camera · LIVE_DEMUX_CAM_ON=1).
        // Desk dual always forces cam on (you|phone is the whole surface).
        // Optical / synthetic glyph / webgrid: cam off by default (display is the field).
        if !optical_src && !glyph_synthetic && !webgrid_src && (camera::cam_auto_on() || desk) {
            state.camera_on = true;
            state.start_camera();
            if desk {
                state.status =
                    "desk · you | phone  · H cycle · L lens · Y pop dual · a mic · t talk · Esc"
                        .into();
            } else {
                state.status = state.hud_status();
            }
        }
        state
    }

    /// True when this modal is the plant glyph control-plane surface.
    ///
    /// Distinct from optical TX (`/watch optical glyph`). Glyph reuses the
    /// optical RGB generator for TTY paint but routes **`o`** to quantum-lift.
    pub fn is_glyph_watch(&self) -> bool {
        self.channel_id.as_deref() == Some("glyph")
            || self.source_url.starts_with("glyph://")
    }

    /// True when this modal is the offline webgrid-ugrad chase (our build).
    pub fn is_webgrid(&self) -> bool {
        self.webgrid.is_some()
            || self.channel_id.as_deref() == Some("webgrid")
            || self.source_url.starts_with("webgrid://")
    }

    /// True when this modal is the optical TX surface (not a stream).
    pub fn is_optical(&self) -> bool {
        // Glyph plant path reuses OpticalFeed for paint — exclude it here.
        if self.is_glyph_watch() || self.is_webgrid() {
            return false;
        }
        self.optical.is_some()
            || self.source_url.starts_with("optical://")
            || self.channel_id.as_deref() == Some("optical")
    }

    /// Jump to a random other playlist entry (one-shot shuffle zap).
    pub fn shuffle_next(&mut self) {
        if self.entries.len() < 2 {
            self.status = "shuffle · need 2+ trailers in feed".into();
            return;
        }
        self.fail_skips = 0;
        let next = random_playlist_index(self.entries.len(), Some(self.idx));
        let title = self
            .entries
            .get(next)
            .map(|e| e.title.as_str())
            .unwrap_or("?");
        self.status = format!("shuffle → {title}");
        self.request_stream_for(next, 0);
    }

    /// Toggle shuffle mode (random on EOF / auto-advance).
    pub fn toggle_shuffle(&mut self) {
        self.shuffle = !self.shuffle;
        self.status = if self.shuffle {
            "shuffle mode ON · s jump · auto-random on end".into()
        } else {
            "shuffle mode OFF · sequential n/p".into()
        };
    }

    pub fn shuffle_enabled(&self) -> bool {
        self.shuffle
    }

    /// Whether the channel guide overlay is open.
    pub fn guide_open(&self) -> bool {
        self.guide.open
    }

    /// Whether the under-video search bar is focused for typing.
    pub fn search_focused(&self) -> bool {
        self.search_focused
    }

    /// Current search / tune query text.
    pub fn search_query(&self) -> &str {
        &self.search_buf
    }

    fn focus_search(&mut self) {
        self.search_focused = true;
        // Don't fight the guide for keys.
        if self.guide.open {
            self.guide.open = false;
        }
        self.status = format!(
            "SEARCH · type channel, URL, or words · Enter load · Esc unfocus · Tab complete · ({})",
            if self.search_buf.is_empty() {
                "empty"
            } else {
                self.search_buf.as_str()
            }
        );
    }

    fn unfocus_search(&mut self) {
        self.search_focused = false;
        self.status = self.hud_status();
    }

    /// Submit search buffer → retune in-place via [`switch_source`].
    fn submit_search(&mut self) {
        let q = self.search_buf.trim().to_string();
        if q.is_empty() {
            self.status = "SEARCH · type a channel (bloomberg), URL, or words".into();
            return;
        }
        let lower = q.to_ascii_lowercase();
        if matches!(
            lower.as_str(),
            "list" | "guide" | "channels" | "help" | "?"
        ) {
            self.search_focused = false;
            self.open_guide(None);
            return;
        }
        self.search_focused = false;
        self.switch_source(&q);
    }

    /// Tab-complete first matching built-in channel id (or leave buffer alone).
    fn complete_search(&mut self) {
        let q = self.search_buf.trim().to_ascii_lowercase();
        if q.is_empty() {
            return;
        }
        // Prefer id/alias prefix match from full channel list.
        if let Some(ch) = CHANNELS.iter().find(|c| {
            c.id.starts_with(&q)
                || c.aliases.iter().any(|a| a.to_ascii_lowercase().starts_with(&q))
                || c.label.to_ascii_lowercase().contains(&q)
        }) {
            self.search_buf = ch.id.to_string();
            self.status = format!("SEARCH · complete → {} ({})", ch.id, ch.label);
        }
    }

    /// Keys for offline webgrid-ugrad chase (TTY instrument).
    fn handle_webgrid_key(&mut self, key: &KeyEvent) -> LiveWatchKeyOutcome {
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => {
                self.webgrid.take();
                self.optical.take();
                self.demux.take();
                self.stop_camera();
                self.stop_mic();
                LiveWatchKeyOutcome::Close
            }
            KeyCode::Left | KeyCode::Char('h') => {
                if let Some(ref wg) = self.webgrid {
                    wg.move_cursor(-1, 0);
                }
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Right | KeyCode::Char('l') => {
                if let Some(ref wg) = self.webgrid {
                    wg.move_cursor(1, 0);
                }
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Up | KeyCode::Char('k') => {
                if let Some(ref wg) = self.webgrid {
                    wg.move_cursor(0, -1);
                }
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if let Some(ref wg) = self.webgrid {
                    wg.move_cursor(0, 1);
                }
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Enter | KeyCode::Char(' ') => {
                if let Some(ref wg) = self.webgrid {
                    wg.hit_cursor();
                }
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('a') | KeyCode::Char('A') => {
                if let Some(ref wg) = self.webgrid {
                    wg.toggle_agent();
                }
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('r') | KeyCode::Char('R') => {
                if let Some(ref wg) = self.webgrid {
                    wg.restart();
                }
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('o') => {
                let _ = self.pop_out();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('/') | KeyCode::Char('f') | KeyCode::Char('F') => {
                self.focus_search();
                LiveWatchKeyOutcome::Changed
            }
            _ => LiveWatchKeyOutcome::Changed,
        }
    }

    fn handle_search_key(&mut self, key: &KeyEvent) -> LiveWatchKeyOutcome {
        // Ctrl+U clear, Ctrl+A select-all clear to start.
        if key.modifiers.contains(KeyModifiers::CONTROL) {
            match key.code {
                KeyCode::Char('u') | KeyCode::Char('U') => {
                    self.search_buf.clear();
                    self.status = "SEARCH · cleared".into();
                    return LiveWatchKeyOutcome::Changed;
                }
                KeyCode::Char('w') | KeyCode::Char('W') => {
                    // Delete last word.
                    let trimmed = self.search_buf.trim_end();
                    if let Some(i) = trimmed.rfind(char::is_whitespace) {
                        self.search_buf.truncate(i + 1);
                    } else {
                        self.search_buf.clear();
                    }
                    return LiveWatchKeyOutcome::Changed;
                }
                _ => {}
            }
        }

        match key.code {
            KeyCode::Esc => {
                self.unfocus_search();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Enter => {
                self.submit_search();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Tab => {
                self.complete_search();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Backspace => {
                self.search_buf.pop();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Delete => {
                // Treat as backspace (no cursor model).
                self.search_buf.pop();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char(ch) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                // Printable characters (including space and slash for URLs).
                if !ch.is_control() {
                    // Cap length so paint stays sane.
                    if self.search_buf.chars().count() < 200 {
                        self.search_buf.push(ch);
                    }
                }
                LiveWatchKeyOutcome::Changed
            }
            // Arrow keys leave search focused but allow scrub? Better stay in search.
            KeyCode::Left | KeyCode::Right | KeyCode::Up | KeyCode::Down => {
                LiveWatchKeyOutcome::Changed
            }
            _ => LiveWatchKeyOutcome::Changed,
        }
    }

    /// Talk strip keys — Memory Glass camera-talk → terminal chat notes.
    fn handle_talk_key(&mut self, key: &KeyEvent) -> LiveWatchKeyOutcome {
        match key.code {
            KeyCode::Esc => {
                self.talk_focused = false;
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Enter => {
                self.commit_talk_line();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Backspace | KeyCode::Delete => {
                self.talk_buf.pop();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char(ch) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                if !ch.is_control() && self.talk_buf.chars().count() < 160 {
                    self.talk_buf.push(ch);
                }
                LiveWatchKeyOutcome::Changed
            }
            _ => LiveWatchKeyOutcome::Changed,
        }
    }

    /// Switch to another built-in channel / URL without closing the modal.
    pub fn switch_source(&mut self, input: &str) {
        let resolved = resolve_watch_source(input);
        self.source_url = resolved.url.clone();
        self.channel_label = resolved.label.clone();
        self.channel_id = resolved.channel_id.clone();
        self.kind = resolved.kind;
        self.zap_region = self
            .channel_id
            .as_deref()
            .and_then(find_channel)
            .map(|c| c.region);
        self.entries.clear();
        self.idx = 0;
        self.seek_secs = 0;
        self.fail_skips = 0;
        self.demux.take();
        self.paint_rgb = None;
        self.paint_gen = 0;
        self.current_page_url = None;
        self.guide.filter = resolved.guide_filter;
        if let Some(ref id) = self.channel_id {
            if let Some(i) = channel_index_in_filter(self.guide.filter, id) {
                self.guide.cursor = i;
            }
        }

        // X hub: don't demux sentinel — focus search for broadcast/status paste.
        let x_hub = self.source_url == "x://hub"
            || (self.channel_id.as_deref() == Some("x") && self.source_url.starts_with("x://"));
        if x_hub {
            self.worker_rx = None;
            self.phase = Phase::Ready;
            self.playing = false;
            self.search_buf = "https://x.com/i/broadcasts/".into();
            self.search_focused = true;
            self.status = x_live::HINT_PASTE_X.to_string();
            return;
        }

        self.phase = Phase::Resolving;
        self.playing = true;
        self.status = if x_live::is_x_page_url(&self.source_url) {
            format!("X live · tuning… ({})", self.channel_label)
        } else {
            format!("tuning… ({})", self.channel_label)
        };

        let end = playlist_end_for(self.kind);
        let (tx, rx) = std::sync::mpsc::channel();
        self.worker_rx = Some(rx);
        let url_c = self.source_url.clone();
        let label_c = self.channel_label.clone();
        thread::Builder::new()
            .name("live-demux-switch".into())
            .spawn(move || {
                match resolve_playlist_limited(&url_c, end) {
                    Ok(entries) if !entries.is_empty() => {
                        let page = entries[0].page_url.clone();
                        match resolve_stream_url(&page) {
                            Ok(stream) => {
                                let _ = tx.send(WorkerMsg::Playlist {
                                    entries,
                                    stream,
                                    idx: 0,
                                    seek: 0,
                                });
                            }
                            Err(e) => {
                                let _ = tx.send(WorkerMsg::Failed(format!("{label_c}: {e}")));
                            }
                        }
                    }
                    Ok(_) => {
                        let _ = tx.send(WorkerMsg::Failed(format!(
                            "{label_c}: empty playlist (channel offline?)"
                        )));
                    }
                    Err(e) => {
                        let _ = tx.send(WorkerMsg::Failed(format!("{label_c}: {e}")));
                    }
                }
            })
            .ok();
    }

    fn open_guide(&mut self, filter: Option<GuideFilter>) {
        if let Some(f) = filter {
            self.guide.filter = f;
        } else if matches!(self.kind, ChannelKind::LiveNews) {
            // Prefer current region when opening from a news stream.
            if let Some(r) = self.zap_region {
                if !matches!(r, ChannelRegion::Music) {
                    self.guide.filter = GuideFilter::Region(r);
                } else {
                    self.guide.filter = GuideFilter::News;
                }
            } else {
                self.guide.filter = GuideFilter::News;
            }
        } else if matches!(self.kind, ChannelKind::MusicTv) {
            self.guide.filter = GuideFilter::Music;
        }
        if let Some(ref id) = self.channel_id {
            if let Some(i) = channel_index_in_filter(self.guide.filter, id) {
                self.guide.cursor = i;
            } else {
                self.guide.cursor = 0;
            }
        } else {
            self.guide.cursor = 0;
        }
        self.guide.scroll = 0;
        self.guide.open = true;
        self.clamp_guide_cursor();
        self.status = format!(
            "GUIDE · {}  ↑↓ select · Enter tune · a–z hop · 0–6 filter · Esc close",
            self.guide.filter.label()
        );
    }

    fn close_guide(&mut self) {
        self.guide.open = false;
        self.status = self.hud_status();
    }

    fn clamp_guide_cursor(&mut self) {
        let n = channels_for_filter(self.guide.filter).len();
        if n == 0 {
            self.guide.cursor = 0;
            self.guide.scroll = 0;
            return;
        }
        if self.guide.cursor >= n {
            self.guide.cursor = n - 1;
        }
    }

    fn guide_move(&mut self, delta: isize) {
        let list = channels_for_filter(self.guide.filter);
        if list.is_empty() {
            return;
        }
        let n = list.len() as isize;
        let cur = self.guide.cursor as isize;
        let next = (cur + delta).rem_euclid(n) as usize;
        self.guide.cursor = next;
        self.status = format!(
            "GUIDE · {} · {}/{}  {}",
            self.guide.filter.label(),
            next + 1,
            list.len(),
            list[next].id
        );
    }

    fn guide_set_filter(&mut self, filter: GuideFilter) {
        let keep_id = channels_for_filter(self.guide.filter)
            .get(self.guide.cursor)
            .map(|c| c.id);
        self.guide.filter = filter;
        self.guide.scroll = 0;
        if let Some(id) = keep_id.or(self.channel_id.as_deref()) {
            self.guide.cursor = channel_index_in_filter(filter, id).unwrap_or(0);
        } else {
            self.guide.cursor = 0;
        }
        self.clamp_guide_cursor();
        let list = channels_for_filter(self.guide.filter);
        let id = list
            .get(self.guide.cursor)
            .map(|c| c.id)
            .unwrap_or("—");
        self.status = format!(
            "GUIDE · {} · {} ch  cursor={id}  (0 all · 1 news · 2 music · 3 us · 4 eu · 5 world · 6 special)",
            filter.label(),
            list.len()
        );
    }

    fn guide_hop_letter(&mut self, letter: char) {
        if let Some(ch) = hop_letter(self.guide.filter, letter) {
            if let Some(i) = channel_index_in_filter(self.guide.filter, ch.id) {
                self.guide.cursor = i;
                self.status = format!(
                    "GUIDE · hop '{letter}' → {}  ({})",
                    ch.id, ch.label
                );
            }
        } else {
            self.status = format!(
                "GUIDE · no channel starting with '{letter}' in {}",
                self.guide.filter.label()
            );
        }
    }

    fn guide_tune_selected(&mut self) {
        let list = channels_for_filter(self.guide.filter);
        let Some(ch) = list.get(self.guide.cursor) else {
            self.status = "GUIDE · empty list".into();
            return;
        };
        let id = ch.id.to_string();
        self.guide.open = false;
        self.switch_source(&id);
    }

    fn zap_news_station(&mut self, forward: bool) {
        let next = if forward {
            next_news_channel(self.channel_id.as_deref(), self.zap_region)
        } else {
            prev_news_channel(self.channel_id.as_deref(), self.zap_region)
        };
        if let Some(ch) = next {
            self.switch_source(ch.id);
        } else {
            self.status = "no news stations".into();
        }
    }

    /// Whether the camera side pane is active (or starting).
    pub fn camera_on(&self) -> bool {
        self.camera_on
    }

    /// Start local HLS pipeline for **go-live to x.com** (X Media Studio).
    ///
    /// Spawns `~/Projects/x-media-studio-hls/bin/go-live.sh` (or `X_HLS_ROOT`),
    /// opens studio.x.com/producer/sources. User still pastes the public
    /// `.m3u8` after tunneling. Does not leave the `/watch` modal.
    pub fn go_live_x(&mut self) -> Result<String, String> {
        let msg = x_live::launch_go_live_async()?;
        let _ = x_live::open_x_studio();
        self.status = msg.clone();
        Ok(msg)
    }

    /// Pop the current track out to an external `ffplay` window (detached).
    ///
    /// Re-resolves with an audio-capable format (higher quality than the TTY pipe).
    /// In-TTY demux keeps running; Esc only closes the modal, not the OS window.
    pub fn pop_out(&mut self) -> Result<String, String> {
        // Offline webgrid → browser / Memory Glass (our webgrid-ugrad.html).
        if self.is_webgrid() {
            let msg = webgrid::launch_webgrid_popout_async();
            self.status = msg.clone();
            return Ok(msg);
        }
        // Plant glyph → quantum-lift ffplay + arena Glyph tools (custom handler).
        if self.is_glyph_watch() {
            let page = self
                .current_page_url
                .clone()
                .or_else(|| self.entries.get(self.idx).map(|e| e.page_url.clone()))
                .filter(|s| !s.is_empty() && !s.starts_with("glyph://"));
            let msg = glyph_watch::launch_glyph_popout_async(page.as_deref(), true);
            self.status = msg.clone();
            return Ok(msg);
        }
        // Optical surface → OS browser (send.html), not yt-dlp/ffplay.
        if self.is_optical() {
            let mode = self
                .optical
                .as_ref()
                .map(|o| o.mode())
                .unwrap_or(OpticalMode::Blur);
            let text = std::env::var("LIVE_DEMUX_OPTICAL_TEXT")
                .unwrap_or_else(|_| "FC OPTICAL".into());
            let msg = optical::launch_optical_popout_async(mode, &text);
            self.status = msg.clone();
            return Ok(msg);
        }
        let page = self
            .current_page_url
            .clone()
            .or_else(|| {
                self.entries
                    .get(self.idx)
                    .map(|e| e.page_url.clone())
            })
            .filter(|s| !s.is_empty())
            .ok_or_else(|| "no track yet — wait for resolve".to_string())?;
        let title = self
            .entries
            .get(self.idx)
            .map(|e| format!("{} · {}", self.channel_label, e.title))
            .unwrap_or_else(|| self.channel_label.clone());
        // Resolve + spawn on a worker so the UI thread never blocks on yt-dlp.
        let page_c = page.clone();
        let title_c = title.clone();
        thread::Builder::new()
            .name("live-demux-popout-key".into())
            .spawn(move || {
                if let Err(e) = popout::popout_page(&page_c, &title_c) {
                    eprintln!("[live-demux pop-out] {e}");
                }
            })
            .map_err(|e| format!("pop-out thread: {e}"))?;
        let msg = format!("pop-out · launching ffplay… ({title})");
        self.status = msg.clone();
        Ok(msg)
    }

    /// Pop local camera(s) out to Zoom-style OS `ffplay` window(s).
    ///
    /// Default: primary device (`LIVE_DEMUX_CAM_DEVICE`). Does not stop the
    /// TTY PiP — if the same device is locked, close TTY cam first (`c`).
    pub fn pop_out_camera(&mut self, mode: popout::CamPopMode) -> Result<String, String> {
        let msg = popout::launch_cam_popout_async(mode);
        self.status = msg.clone();
        Ok(msg)
    }

    /// Toggle local camera feed (left of the playing stream).
    pub fn toggle_camera(&mut self) {
        if self.camera_on {
            self.stop_camera();
            self.camera_on = false;
            self.camera_err = None;
            self.status = self.hud_status();
            return;
        }
        self.camera_on = true;
        self.start_camera();
        self.status = self.hud_status();
    }

    fn start_camera(&mut self) {
        self.camera.take();
        self.camera_phone.take();
        self.cam_paint_rgb = None;
        self.cam_paint_gen = 0;
        self.phone_paint_rgb = None;
        self.phone_paint_gen = 0;
        self.camera_err = None;
        self.prev_cam_thumb = None;
        self.motion_level = 0.0;
        let (w, h) = cam_dims();
        // Dual: each half tile is roughly half width.
        let (cell_w, cell_h) = if camera::cam_source().is_dual() {
            ((w / 2).max(8) & !1, h)
        } else {
            (w, h)
        };
        let fps = camera::cam_fps();
        let src = camera::cam_source();
        let mut any_ok = false;
        let mut errs: Vec<String> = Vec::new();

        if src.includes_local() {
            match CameraFeed::start_source(
                cell_w,
                cell_h,
                fps,
                self.camera_mirror,
                camera::CamSource::Local,
            ) {
                Ok(feed) => {
                    self.cam_paint_w = feed.width;
                    self.cam_paint_h = feed.height;
                    self.camera = Some(feed);
                    any_ok = true;
                }
                Err(e) => errs.push(format!("local: {e}")),
            }
        }
        if src.includes_phone() {
            match CameraFeed::start_source(
                cell_w,
                cell_h,
                fps,
                false, // phone still: no hflip
                camera::CamSource::PhoneStill,
            ) {
                Ok(feed) => {
                    self.phone_paint_w = feed.width;
                    self.phone_paint_h = feed.height;
                    self.camera_phone = Some(feed);
                    any_ok = true;
                }
                Err(e) => errs.push(format!("phone: {e}")),
            }
        }

        if any_ok {
            if mic_auto_on() {
                self.start_mic();
            }
            if !errs.is_empty() {
                self.status = format!("cam · partial · {}", errs.join(" · "));
            }
        } else {
            self.camera_err = Some(errs.join(" · "));
            self.camera_on = false;
            self.status = format!("cam: {}", errs.join(" · "));
        }
    }

    fn stop_camera(&mut self) {
        self.camera.take();
        self.camera_phone.take();
        self.cam_paint_rgb = None;
        self.cam_paint_gen = 0;
        self.phone_paint_rgb = None;
        self.phone_paint_gen = 0;
        self.prev_cam_thumb = None;
        self.motion_level = 0.0;
        self.stop_mic();
    }

    /// Toggle mic waveform meter (Memory Glass L/R/M grammar → TTY bars).
    pub fn toggle_mic(&mut self) {
        if self.mic_on {
            self.stop_mic();
            self.status = "mic · off".into();
            return;
        }
        self.start_mic();
        self.status = if self.mic_on {
            "mic · on · wave under cam (MG hub if :9877)".into()
        } else {
            "mic · failed".into()
        };
    }

    /// Cycle cam source: local → dual (you|phone) → phone-only → local.
    ///
    /// Memory Glass inspect grammar: phone PWA → hub `/upload` → still → tile.
    pub fn toggle_phone_source(&mut self) {
        let next = match camera::cam_source() {
            camera::CamSource::Local => camera::CamSource::Dual,
            camera::CamSource::Dual => camera::CamSource::PhoneStill,
            camera::CamSource::PhoneStill => camera::CamSource::Local,
        };
        // SAFETY: process-wide knobs; cam restart reads them.
        unsafe {
            match next {
                camera::CamSource::Dual => {
                    std::env::set_var("LIVE_DEMUX_CAM_SOURCE", "dual");
                    std::env::set_var("LIVE_DEMUX_CAM_MIRROR", "1");
                    if std::env::var("LIVE_DEMUX_CAM_TILE").is_err() {
                        std::env::set_var("LIVE_DEMUX_CAM_TILE", "96");
                    }
                    std::env::set_var("LIVE_DEMUX_CAM_LAYOUT", "side");
                    if std::env::var("LIVE_DEMUX_CAM_STILL").is_err() {
                        std::env::set_var("LIVE_DEMUX_CAM_STILL", camera::cam_still_path());
                    }
                }
                camera::CamSource::PhoneStill => {
                    std::env::set_var("LIVE_DEMUX_CAM_SOURCE", "phone-only");
                    std::env::set_var("LIVE_DEMUX_CAM_MIRROR", "0");
                    if std::env::var("LIVE_DEMUX_CAM_STILL").is_err() {
                        std::env::set_var("LIVE_DEMUX_CAM_STILL", camera::cam_still_path());
                    }
                }
                camera::CamSource::Local => {
                    std::env::set_var("LIVE_DEMUX_CAM_SOURCE", "local");
                }
            }
        }
        if self.camera_on {
            self.stop_camera();
            self.camera_on = true;
            self.start_camera();
        }
        self.status = match next {
            camera::CamSource::Dual => format!(
                "cam · dual you|phone · {} · Y pop-out both",
                camera::cam_still_path()
            ),
            camera::CamSource::PhoneStill => format!(
                "cam · phone only · {} · open phone PWA → allow cam",
                camera::cam_still_path()
            ),
            camera::CamSource::Local => "cam · local webcam only".into(),
        };
    }

    fn start_mic(&mut self) {
        self.mic.take();
        self.mic_on = false;
        self.mic_snap = MicSnapshot::idle();
        match MicLevelFeed::start() {
            Ok(feed) => {
                self.mic = Some(feed);
                self.mic_on = true;
            }
            Err(e) => {
                self.status = format!("mic: {e}");
                self.mic_on = false;
            }
        }
    }

    fn stop_mic(&mut self) {
        if let Some(mut m) = self.mic.take() {
            m.stop();
        }
        self.mic_on = false;
        self.mic_snap = MicSnapshot::idle();
    }

    pub fn mic_on(&self) -> bool {
        self.mic_on
    }

    pub fn talk_focused(&self) -> bool {
        self.talk_focused
    }

    pub fn motion_level(&self) -> f32 {
        self.motion_level
    }

    fn focus_talk(&mut self) {
        self.talk_focused = true;
        self.search_focused = false;
        self.status = "talk · type · Enter post · Esc unfocus".into();
    }

    fn commit_talk_line(&mut self) {
        let line = self.talk_buf.trim().to_string();
        self.talk_buf.clear();
        if line.is_empty() {
            return;
        }
        // Keep last 6 lines for HUD / mesh handoff later.
        while self.talk_lines.len() >= 6 {
            self.talk_lines.pop_front();
        }
        self.talk_lines.push_back(line.clone());
        self.status = format!("talk · {line}");
        // Optional: emit to stderr for agents / GY hooks.
        eprintln!("[fc-cam-talk] {line}");
    }

    /// Update motion energy from a downscaled cam thumb (tracking proxy).
    fn update_motion_from_cam(&mut self, rgb: &[u8], w: u32, h: u32) {
        // Sample every 8th pixel into a tiny thumb for cheap Δ.
        let step = 8usize;
        let mut thumb = Vec::with_capacity(((w as usize / step) * (h as usize / step)).max(1));
        let ww = w as usize;
        let hh = h as usize;
        for y in (0..hh).step_by(step) {
            for x in (0..ww).step_by(step) {
                let i = (y * ww + x) * 3;
                if i + 2 < rgb.len() {
                    // luma
                    let yv = (rgb[i] as u32 * 3 + rgb[i + 1] as u32 * 6 + rgb[i + 2] as u32) / 10;
                    thumb.push(yv as u8);
                }
            }
        }
        if let Some(prev) = self.prev_cam_thumb.as_ref() {
            if prev.len() == thumb.len() && !thumb.is_empty() {
                let mut acc = 0u64;
                for (a, b) in prev.iter().zip(thumb.iter()) {
                    acc += (*a as i16 - *b as i16).unsigned_abs() as u64;
                }
                let mean = acc as f32 / thumb.len() as f32 / 255.0;
                self.motion_level = (self.motion_level * 0.65 + mean * 2.5).clamp(0.0, 1.0);
            }
        }
        self.prev_cam_thumb = Some(thumb);
    }

    /// Toggle selfie mirror (restarts capture if camera is on).
    pub fn toggle_camera_mirror(&mut self) {
        self.camera_mirror = !self.camera_mirror;
        if self.camera_on {
            self.start_camera();
        }
        self.status = self.hud_status();
    }

    /// True when multi-track sources should skip a broken entry instead of erroring out.
    fn can_auto_skip(&self) -> bool {
        self.entries.len() > 1
            && matches!(self.kind, ChannelKind::MusicTv | ChannelKind::Generic)
            && self.fail_skips < self.entries.len().min(12) as u32
    }

    /// Advance to next track after a hard resolve/demux failure.
    fn skip_broken_track(&mut self, reason: &str) {
        self.fail_skips = self.fail_skips.saturating_add(1);
        let next = (self.idx + 1) % self.entries.len();
        let title = self
            .entries
            .get(self.idx)
            .map(|e| e.title.as_str())
            .unwrap_or("?");
        self.status = format!("skip · {title} ({reason}) → next");
        self.request_stream_for(next, 0);
    }

    fn start_demux(&mut self, stream: &str) {
        self.demux.take(); // Drop stops prior child
        let (w, h) = (self.paint_w, self.paint_h);
        // Remember page URL for `o` pop-out (stream URL itself may be video-only 480p).
        if let Some(e) = self.entries.get(self.idx) {
            self.current_page_url = Some(e.page_url.clone());
        }
        match LiveDemux::start(stream, self.seek_secs, w, h, self.fps) {
            Ok(d) => {
                self.demux = Some(d);
                self.phase = Phase::Ready;
                self.paint_gen = 0;
                self.paint_rgb = None;
                // Successful start resets consecutive fail counter.
                self.fail_skips = 0;
                self.status = self.hud_status();
            }
            Err(e) => {
                if self.can_auto_skip() {
                    self.skip_broken_track(&e);
                } else {
                    self.phase = Phase::Error(e.clone());
                    self.status = e;
                }
            }
        }
    }

    fn request_stream_for(&mut self, idx: usize, seek: u32) {
        if self.entries.is_empty() {
            return;
        }
        let idx = idx % self.entries.len();
        self.idx = idx;
        self.seek_secs = seek;
        self.phase = Phase::Resolving;
        self.status = format!("resolving stream… [{}]", self.entries[idx].title);
        self.demux.take();

        let page = self.entries[idx].page_url.clone();
        let (tx, rx) = std::sync::mpsc::channel();
        self.worker_rx = Some(rx);
        thread::Builder::new()
            .name("live-demux-stream".into())
            .spawn(move || match resolve_stream_url(&page) {
                Ok(stream) => {
                    let _ = tx.send(WorkerMsg::Stream { stream, idx, seek });
                }
                Err(e) => {
                    let _ = tx.send(WorkerMsg::Failed(e));
                }
            })
            .ok();
    }

    fn hud_status(&self) -> String {
        if self.is_webgrid() {
            if let Some(ref wg) = self.webgrid {
                return format!("▶ {}", wg.hud_line());
            }
            return format!("▶ webgrid · {}", self.channel_label);
        }
        if self.is_glyph_watch() {
            let play = if self.playing { "▶" } else { "⏸" };
            let mode = std::env::var("LIVE_DEMUX_GLYPH_MODE").unwrap_or_else(|_| "dense".into());
            return format!(
                "{play} glyph · {mode} · o quantum-lift+arena  · Esc  · {}",
                self.channel_label
            );
        }
        if self.is_optical() {
            let mode = self
                .optical
                .as_ref()
                .map(|o| o.mode().id())
                .unwrap_or("blur");
            let play = if self.playing { "▶" } else { "⏸" };
            return format!(
                "{play} optical · {mode} · half-block TX  · o OS pop-out  · Esc  · {}",
                self.channel_label
            );
        }
        let n = self.entries.len().max(1);
        let title = self
            .entries
            .get(self.idx)
            .map(|e| e.title.as_str())
            .unwrap_or("…");
        let play = if self.playing { "▶" } else { "⏸" };
        let cam = if self.camera_on {
            let src = camera::cam_source().label();
            if self.camera_err.is_some() {
                format!("  · cam!({src})")
            } else if self.cam_paint_rgb.is_some() || self.phone_paint_rgb.is_some() {
                format!("  · {src} mot{:.0}%", self.motion_level * 100.0)
            } else {
                format!("  · {src}…")
            }
        } else {
            String::new()
        };
        let mic = if self.mic_on {
            format!(
                "  · {} ▮{:.0}%",
                self.mic_snap.source_label(),
                self.mic_snap.rms * 100.0
            )
        } else {
            String::new()
        };
        let talk = if self.talk_focused {
            "  · talk▌"
        } else if !self.talk_lines.is_empty() {
            "  · talk"
        } else {
            ""
        };
        let shuf = if self.shuffle { "  · 🔀" } else { "" };
        match self.kind {
            ChannelKind::MusicTv => format!(
                "{play} {}  {}/{}  {title}  · n/p  s  g  o  c  a mic  t talk  t≈{}s{shuf}{cam}{mic}{talk}",
                self.channel_label,
                self.idx + 1,
                n,
                self.seek_secs
            ),
            ChannelKind::LiveNews => format!(
                "{play} {}  · live  n/p  g  t≈{}s  o  c  a  t{cam}{mic}{talk}",
                self.channel_label,
                self.seek_secs
            ),
            ChannelKind::Generic => format!(
                "{play} [{}/{}] {}  t≈{}s  s  g  o  c  a  t{shuf}{cam}{mic}{talk}",
                self.idx + 1,
                n,
                title,
                self.seek_secs
            ),
        }
    }

    /// Title for overlay chrome.
    pub fn title(&self) -> String {
        if self.guide.open {
            return format!(
                "GUIDE · {} · {}/{}",
                self.guide.filter.label(),
                self.guide.cursor + 1,
                channels_for_filter(self.guide.filter).len().max(1)
            );
        }
        match &self.phase {
            Phase::Resolving => format!("{} · resolving…", self.channel_label),
            Phase::Error(e) => format!("{} · error: {e}", self.channel_label),
            Phase::Ready => {
                let track = self
                    .entries
                    .get(self.idx)
                    .map(|e| e.title.as_str())
                    .unwrap_or("…");
                match self.kind {
                    ChannelKind::MusicTv => {
                        format!(
                            "{} · {}/{} · {track}",
                            self.channel_label,
                            self.idx + 1,
                            self.entries.len().max(1)
                        )
                    }
                    ChannelKind::LiveNews => format!("{} · {track}", self.channel_label),
                    ChannelKind::Generic => format!("live · {track}"),
                }
            }
        }
    }

    pub fn status_line(&self) -> &str {
        &self.status
    }

    pub fn playing(&self) -> bool {
        self.playing
    }

    /// Poll worker + pull new frames. Returns true if UI should redraw.
    pub fn tick(&mut self) -> bool {
        let mut dirty = false;

        // Worker results
        if let Some(rx) = self.worker_rx.as_ref() {
            match rx.try_recv() {
                Ok(WorkerMsg::Playlist {
                    entries,
                    stream,
                    idx,
                    seek,
                }) => {
                    self.entries = entries;
                    self.idx = idx;
                    self.seek_secs = seek;
                    self.worker_rx = None;
                    self.fail_skips = 0;
                    self.start_demux(&stream);
                    dirty = true;
                }
                Ok(WorkerMsg::Stream { stream, idx, seek }) => {
                    self.idx = idx;
                    self.seek_secs = seek;
                    self.worker_rx = None;
                    self.start_demux(&stream);
                    dirty = true;
                }
                Ok(WorkerMsg::Failed(e)) => {
                    self.worker_rx = None;
                    // Music TV / multi-track: skip dead entries instead of hard-fail.
                    if self.can_auto_skip() {
                        self.skip_broken_track(&e);
                    } else {
                        self.phase = Phase::Error(e.clone());
                        self.status = e;
                    }
                    dirty = true;
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {}
                Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                    self.worker_rx = None;
                    if matches!(self.phase, Phase::Resolving) {
                        self.phase = Phase::Error("resolve worker died".into());
                        self.status = "resolve worker died".into();
                        dirty = true;
                    }
                }
            }
        }

        // Camera frames keep updating even while stream is paused.
        if self.camera_on {
            if let Some(ref cam) = self.camera {
                if let Some(err) = cam.take_error() {
                    self.camera_err = Some(format!("local: {err}"));
                    self.status = format!("cam local: {err}");
                    self.camera.take();
                    dirty = true;
                } else {
                    let frame_gen = cam.frame_generation();
                    if frame_gen != self.cam_paint_gen
                        && let Some((rgb, w, h)) = cam.snapshot_rgb()
                    {
                        self.update_motion_from_cam(&rgb, w, h);
                        self.cam_paint_rgb = Some(rgb);
                        self.cam_paint_w = w;
                        self.cam_paint_h = h;
                        self.cam_paint_gen = frame_gen;
                        dirty = true;
                    }
                }
            }
            if let Some(ref cam) = self.camera_phone {
                if let Some(err) = cam.take_error() {
                    self.status = format!("cam phone: {err}");
                    self.camera_phone.take();
                    dirty = true;
                } else {
                    let frame_gen = cam.frame_generation();
                    if frame_gen != self.phone_paint_gen
                        && let Some((rgb, w, h)) = cam.snapshot_rgb()
                    {
                        // Motion from phone too when dual.
                        if self.camera.is_none() {
                            self.update_motion_from_cam(&rgb, w, h);
                        }
                        self.phone_paint_rgb = Some(rgb);
                        self.phone_paint_w = w;
                        self.phone_paint_h = h;
                        self.phone_paint_gen = frame_gen;
                        dirty = true;
                    }
                }
            }
            // Both feeds died → stop.
            if self.camera.is_none() && self.camera_phone.is_none() && self.camera_err.is_some() {
                self.camera_on = false;
            }
        }

        // Mic waveform (local ffmpeg and/or Memory Glass /wave hub).
        if self.mic_on {
            if let Some(ref mic) = self.mic {
                let snap = mic.snapshot();
                if snap.generation != self.mic_snap.generation {
                    self.mic_snap = snap;
                    dirty = true;
                }
            }
        }

        // Optical surface frames (main stream pane) — always when feed present.
        if let Some(ref opt) = self.optical {
            let frame_gen = opt.frame_generation();
            if frame_gen != self.paint_gen
                && let Some((rgb, w, h)) = opt.snapshot_rgb()
            {
                self.paint_rgb = Some(rgb);
                self.paint_w = w;
                self.paint_h = h;
                self.paint_gen = frame_gen;
                self.last_frame_time = Instant::now();
                self.status = self.hud_status();
                dirty = true;
            }
        }

        // Offline webgrid-ugrad chase frames (main stream pane).
        if let Some(ref wg) = self.webgrid {
            let frame_gen = wg.frame_generation();
            if frame_gen != self.paint_gen
                && let Some((rgb, w, h)) = wg.snapshot_rgb()
            {
                self.paint_rgb = Some(rgb);
                self.paint_w = w;
                self.paint_h = h;
                self.paint_gen = frame_gen;
                self.last_frame_time = Instant::now();
                self.status = self.hud_status();
                dirty = true;
            }
        }

        if !self.playing
            && !self.camera_on
            && !self.mic_on
            && self.optical.is_none()
            && self.webgrid.is_none()
        {
            return dirty;
        }
        if !self.playing && self.optical.is_none() && self.webgrid.is_none() {
            return dirty;
        }

        if let Some(ref demux) = self.demux {
            if let Some(err) = demux.take_error() {
                self.status = format!("demux: {err}");
                dirty = true;
            }
            let frame_gen = demux.frame_generation();
            if frame_gen != self.paint_gen
                && let Some((rgb, w, h)) = demux.snapshot_rgb()
            {
                self.paint_rgb = Some(rgb);
                self.paint_w = w;
                self.paint_h = h;
                self.paint_gen = frame_gen;
                self.last_frame_time = Instant::now();
                // Advance rough seek clock for HUD (best-effort live).
                // Not used for demux restart until user scrubs.
                self.status = self.hud_status();
                dirty = true;
            } else if demux.eof() && matches!(self.phase, Phase::Ready) {
                // Auto-advance playlist when stream ends (or demux dies mid-track).
                if self.entries.len() > 1 {
                    let next = if self.shuffle {
                        random_playlist_index(self.entries.len(), Some(self.idx))
                    } else {
                        (self.idx + 1) % self.entries.len()
                    };
                    self.request_stream_for(next, 0);
                    dirty = true;
                } else if matches!(self.kind, ChannelKind::LiveNews) {
                    // Live news: re-resolve (stream URL often rotates).
                    self.request_stream_for(self.idx, 0);
                    dirty = true;
                }
            }
        }

        dirty
    }

    pub fn handle_key(&mut self, key: &KeyEvent) -> LiveWatchKeyOutcome {
        // ── Talk strip (cam chat) — Memory Glass talk → terminal ──
        if self.talk_focused {
            return self.handle_talk_key(key);
        }

        // ── In-modal search (type under video without leaving /watch) ──
        if self.search_focused {
            return self.handle_search_key(key);
        }

        // ── Channel guide (A–Z · regions · letter hop) ─────────────────
        if self.guide.open {
            return self.handle_guide_key(key);
        }

        // ── Webgrid chase (our offline ugrad) — own key map ────────────
        if self.is_webgrid() {
            return self.handle_webgrid_key(key);
        }

        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => {
                self.demux.take();
                self.webgrid.take();
                self.stop_camera();
                self.stop_mic();
                LiveWatchKeyOutcome::Close
            }
            // Focus search bar under the video — load more content in-place.
            KeyCode::Char('/') | KeyCode::Char('f') | KeyCode::Char('F') => {
                self.focus_search();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('g') | KeyCode::Tab => {
                self.open_guide(None);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('G') => {
                // Force full A–Z news list.
                self.open_guide(Some(GuideFilter::News));
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('a') | KeyCode::Char('A') => {
                // Mic / waveform (Memory Glass phone-wave grammar).
                self.toggle_mic();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('t') | KeyCode::Char('T') => {
                // Talk / chat strip focus (Memory Glass camera-talk → terminal).
                self.focus_talk();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('c') | KeyCode::Char('C') => {
                // Local camera side pane (left of stream).
                self.toggle_camera();
                LiveWatchKeyOutcome::Changed
            }
            // Capital H only — lowercase `h` is scrub-back (with Left / ,).
            KeyCode::Char('H') => {
                // Cycle local → dual you|phone → phone-only (Memory Glass tether).
                self.toggle_phone_source();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('m') | KeyCode::Char('M') => {
                // Toggle selfie mirror when camera is on (or for next open).
                self.toggle_camera_mirror();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('o') => {
                // Glyph → quantum-lift+arena · Optical → OS browser · else stream ffplay.
                let _ = self.pop_out();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('O') => {
                // All local cameras → separate OS windows (Zoom gallery tiles).
                let _ = self.pop_out_camera(popout::CamPopMode::All);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('y') | KeyCode::Char('Y') => {
                // You / dual: laptop + phone still as OS windows when dual active.
                let mode = if camera::cam_source().is_dual()
                    || camera::cam_source().includes_phone()
                        && camera::cam_source().includes_local()
                {
                    popout::CamPopMode::Dual
                } else if camera::cam_source() == camera::CamSource::PhoneStill {
                    popout::CamPopMode::PhoneStill
                } else {
                    popout::CamPopMode::Primary
                };
                let _ = self.pop_out_camera(mode);
                LiveWatchKeyOutcome::Changed
            }
            // Capital L only — lowercase `l` is scrub-forward (with Right / .).
            KeyCode::Char('L') => {
                // Live lens pop-out — tiny bug world / HDRI anamorphic (360-capable).
                // If LIVE_DEMUX_CAM_STYLE is set (star/glass/bubble), open that GPU style.
                let style = std::env::var("LIVE_DEMUX_CAM_STYLE")
                    .unwrap_or_default()
                    .trim()
                    .to_ascii_lowercase();
                let (profile, input) = if !style.is_empty() {
                    lens::parse_lens_args(&style)
                } else {
                    lens::parse_lens_args("bug")
                };
                let input = if camera::cam_source().is_dual() && !profile.is_optic_style() {
                    lens::LensInput::Dual
                } else {
                    input
                };
                self.status = lens::launch_lens_async(profile, input);
                LiveWatchKeyOutcome::Changed
            }
            // Capital S — cam style star (GPU optic) while /watch is open.
            // (lowercase `s` remains shuffle zap.)
            KeyCode::Char('S') => {
                self.status = lens::launch_lens_async(
                    lens::LensProfile::OpticStar,
                    lens::LensInput::Webcam,
                );
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('U') => {
                // Go-live **to** x.com (HLS pipeline + open Producer).
                // Capital U only so lowercase `u` stays letter-hop.
                match self.go_live_x() {
                    Ok(msg) => self.status = msg,
                    Err(e) => self.status = e,
                }
                LiveWatchKeyOutcome::Changed
            }
            // Shuffle zap (before letter-hop so 's' is not a station hop).
            // Capital S is cam style star (above). Toggle shuffle: /watch shuffle.
            KeyCode::Char('s') => {
                self.shuffle_next();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char(' ') => {
                self.playing = !self.playing;
                self.status = self.hud_status();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('n') | KeyCode::Char(']') | KeyCode::Up => {
                if matches!(self.kind, ChannelKind::LiveNews) && self.entries.len() <= 1 {
                    // News: zap next station (A–Z within region when known).
                    self.zap_news_station(true);
                } else if !self.entries.is_empty() {
                    self.fail_skips = 0;
                    let next = (self.idx + 1) % self.entries.len();
                    self.request_stream_for(next, 0);
                }
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('p') | KeyCode::Char('[') | KeyCode::Down => {
                if matches!(self.kind, ChannelKind::LiveNews) && self.entries.len() <= 1 {
                    self.zap_news_station(false);
                } else if !self.entries.is_empty() {
                    self.fail_skips = 0;
                    let prev = (self.idx + self.entries.len() - 1) % self.entries.len();
                    self.request_stream_for(prev, 0);
                }
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Left | KeyCode::Char(',') | KeyCode::Char('h') => {
                let s = scrub_sec();
                let seek = self.seek_secs.saturating_sub(s);
                // Approximate position: seek_secs is demux restart base;
                // also fold in frames played since last restart when ready.
                let played = self.approx_played_secs();
                let base = self.seek_secs.saturating_add(played);
                let new_seek = base.saturating_sub(s);
                let _ = seek;
                self.request_stream_for(self.idx, new_seek);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Right | KeyCode::Char('.') | KeyCode::Char('l') => {
                let s = scrub_sec();
                let played = self.approx_played_secs();
                let new_seek = self.seek_secs.saturating_add(played).saturating_add(s);
                self.request_stream_for(self.idx, new_seek);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('0') => {
                self.request_stream_for(self.idx, 0);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char('r') | KeyCode::Char('R') => {
                self.request_stream_for(self.idx, self.seek_secs);
                LiveWatchKeyOutcome::Changed
            }
            // Letter hop without opening guide: jump straight to channel.
            KeyCode::Char(ch) if ch.is_ascii_alphabetic() => {
                let filter = if matches!(self.kind, ChannelKind::LiveNews) {
                    GuideFilter::News
                } else if matches!(self.kind, ChannelKind::MusicTv) {
                    GuideFilter::Music
                } else {
                    GuideFilter::All
                };
                if let Some(c) = hop_letter(filter, ch) {
                    self.switch_source(c.id);
                }
                LiveWatchKeyOutcome::Changed
            }
            _ => LiveWatchKeyOutcome::Changed,
        }
    }

    fn handle_guide_key(&mut self, key: &KeyEvent) -> LiveWatchKeyOutcome {
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') | KeyCode::Char('g') | KeyCode::Tab => {
                self.close_guide();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Up | KeyCode::Char('k') | KeyCode::Char('p') | KeyCode::Char('[') => {
                self.guide_move(-1);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Down | KeyCode::Char('j') | KeyCode::Char('n') | KeyCode::Char(']') => {
                self.guide_move(1);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::PageUp => {
                self.guide_move(-10);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::PageDown => {
                self.guide_move(10);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Home => {
                self.guide.cursor = 0;
                self.guide_move(0);
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::End => {
                let n = channels_for_filter(self.guide.filter).len();
                if n > 0 {
                    self.guide.cursor = n - 1;
                    self.guide_move(0);
                }
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Enter | KeyCode::Char(' ') => {
                self.guide_tune_selected();
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Left | KeyCode::Char(',') => {
                self.guide_set_filter(self.guide.filter.cycle_prev());
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Right | KeyCode::Char('.') | KeyCode::Char('f') => {
                self.guide_set_filter(self.guide.filter.cycle_next());
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char(d) if d.is_ascii_digit() => {
                if let Some(f) = GuideFilter::from_digit(d) {
                    self.guide_set_filter(f);
                }
                LiveWatchKeyOutcome::Changed
            }
            KeyCode::Char(ch) if ch.is_ascii_alphabetic() => {
                // a–z hop within current filter (A–Z station list).
                self.guide_hop_letter(ch);
                LiveWatchKeyOutcome::Changed
            }
            _ => LiveWatchKeyOutcome::Changed,
        }
    }

    fn approx_played_secs(&self) -> u32 {
        if self.fps <= 0.0 {
            return 0;
        }
        // gen advances once per frame when playing
        (self.paint_gen as f64 / self.fps).floor() as u32
    }

    /// Paint latest frame(s) as half-block cells.
    ///
    /// **Layout (GrokYtalkY multi-chat + 80×24):**
    /// - Main stream fills the free video band (never shrunk by a full-height cam column).
    /// - Local camera is a compact **PiP tile** (25×13 / lean 13×7) bottom-left,
    ///   painted *after* the stream so it is not obscured.
    /// - Wide rooms may use a side column (`LIVE_DEMUX_CAM_LAYOUT=side`).
    /// - Channel guide overlays the stream rect; search bar is always bottom row(s).
    pub fn paint_half_blocks(&mut self, buf: &mut Buffer, area: Rect) -> bool {
        // Reserve bottom row(s) for search/talk so typing never needs Esc → main prompt.
        let bar_h = if self.talk_focused {
            2
        } else if self.search_focused && !self.search_buf.is_empty() {
            2
        } else {
            SEARCH_BAR_ROWS
        };
        let (video_area, search_area) = Self::split_search_bar(area, bar_h);
        let mut painted = if video_area.height >= 2 {
            let lay = layout::layout_watch_video(video_area, self.camera_on);
            let mut p = false;
            // Desk dual: no yt-dlp stream — only you | phone full bleed.
            let desk = layout::dual_cam_desk()
                || self.channel_id.as_deref() == Some("desk")
                || self.source_url == camera::DESK_URL;
            if !desk && lay.stream.width > 0 && lay.stream.height > 0 {
                // Stream first (full band) — cam PiP overlays on top.
                p = self.paint_stream_pane(buf, lay.stream);
            }
            if self.guide.open && lay.stream.width > 0 {
                self.paint_guide(buf, lay.stream);
                p = true;
            }
            if let Some(cam_rect) = lay.cam {
                // Thin border so the tile reads as a pin (or full desk frame).
                self.paint_camera_chrome(buf, cam_rect);
                p |= self.paint_camera_pane(buf, cam_rect);
            } else if desk {
                // Cam failed to layout — still try full area dual paint.
                self.paint_camera_chrome(buf, video_area);
                p |= self.paint_camera_pane(buf, video_area);
            }
            p
        } else {
            false
        };
        if let Some(search_area) = search_area {
            self.paint_search_bar(buf, search_area);
            painted = true;
        }
        painted
    }

    /// 1-cell dim frame around the camera tile + wave/motion footer.
    fn paint_camera_chrome(&self, buf: &mut Buffer, area: Rect) {
        use crate::render::safe_buf::SafeBuf;
        use ratatui::style::{Color, Style};
        use ratatui::text::Span;
        if area.width < 3 || area.height < 2 {
            return;
        }
        // Outer 1-cell ring uses dim cells; inner content is painted over by paint_camera_pane.
        let style = Style::default()
            .fg(Color::Rgb(60, 90, 120))
            .bg(Color::Rgb(8, 10, 14));
        let top = format!("┌{}┐", "─".repeat(area.width.saturating_sub(2) as usize));
        let bot = format!("└{}┘", "─".repeat(area.width.saturating_sub(2) as usize));
        buf.set_span_safe(area.x, area.y, &Span::styled(&top, style), area.width);
        if area.height > 1 {
            buf.set_span_safe(
                area.x,
                area.y + area.height - 1,
                &Span::styled(&bot, style),
                area.width,
            );
        }
        for r in 1..area.height.saturating_sub(1) {
            buf.set_span_safe(area.x, area.y + r, &Span::styled("│", style), 1);
            buf.set_span_safe(
                area.x + area.width - 1,
                area.y + r,
                &Span::styled("│", style),
                1,
            );
        }
        // Waveform + motion on bottom chrome row (overwrites bottom border center).
        if area.height >= 3 && area.width > 6 {
            let inner_w = area.width.saturating_sub(2) as usize;
            let wave = if self.mic_on {
                self.mic_snap.bar_line(inner_w.saturating_sub(8).max(4))
            } else {
                "·".repeat(inner_w.saturating_sub(8).max(4))
            };
            let meter = format!(
                " {} {} m{:.0}%",
                camera::cam_source().label(),
                if self.mic_on {
                    self.mic_snap.source_label()
                } else {
                    "mute"
                },
                self.motion_level * 100.0
            );
            let line = format!("{wave}{meter}");
            let wave_style = Style::default()
                .fg(if self.mic_on && self.mic_snap.rms > 0.05 {
                    Color::Rgb(120, 220, 160)
                } else {
                    Color::Rgb(90, 110, 130)
                })
                .bg(Color::Rgb(8, 10, 14));
            buf.set_span_safe(
                area.x + 1,
                area.y + area.height - 1,
                &Span::styled(line, wave_style),
                area.width.saturating_sub(2),
            );
        }
    }

    /// Draw the under-video search / tune line (or talk strip when talk-focused).
    fn paint_search_bar(&self, buf: &mut Buffer, area: Rect) {
        use crate::render::safe_buf::SafeBuf;
        use ratatui::style::{Color, Modifier, Style};
        use ratatui::text::Span;

        if area.width < 8 || area.height == 0 {
            return;
        }

        // Talk mode reuses the bottom bar (Memory Glass camera-talk → terminal).
        if self.talk_focused || (!self.search_focused && self.camera_on && !self.talk_lines.is_empty())
        {
            self.paint_talk_bar(buf, area);
            if self.talk_focused {
                return;
            }
            // When not focused but have lines, fall through only if search empty —
            // prefer showing last talk on second visual; keep search prompt if focused.
        }

        if self.talk_focused {
            return;
        }

        let bg = if self.search_focused {
            Color::Rgb(28, 36, 52)
        } else {
            Color::Rgb(16, 18, 24)
        };
        let fg = if self.search_focused {
            Color::Rgb(240, 245, 255)
        } else {
            Color::Rgb(140, 148, 160)
        };
        let accent = Color::Rgb(80, 180, 255);
        // Fill bar background.
        buf.set_style(area, Style::default().bg(bg).fg(fg));

        let prompt = if self.search_focused { "▸ " } else { "/ " };
        let display = if self.search_buf.is_empty() && !self.search_focused {
            if self.camera_on {
                format!("{prompt}search · or t talk · a mic wave  (Enter load)")
            } else {
                format!("{prompt}search channel · URL · words  (Enter load · Tab complete)")
            }
        } else if self.search_focused {
            format!("{prompt}{}▌", self.search_buf)
        } else {
            format!("{prompt}{}", self.search_buf)
        };
        let style = if self.search_focused {
            Style::default()
                .fg(accent)
                .bg(bg)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(fg).bg(bg)
        };
        buf.set_span_safe(area.x, area.y, &Span::styled(display, style), area.width);

        // Optional second line: prefix suggestions when focused and typing.
        if area.height >= 2 && self.search_focused && !self.search_buf.is_empty() {
            let q = self.search_buf.trim().to_ascii_lowercase();
            let mut suggestions = Vec::new();
            for c in CHANNELS.iter() {
                if c.id.starts_with(&q)
                    || c.aliases
                        .iter()
                        .any(|a| a.to_ascii_lowercase().starts_with(&q))
                {
                    suggestions.push(c.id);
                    if suggestions.len() >= 6 {
                        break;
                    }
                }
            }
            if !suggestions.is_empty() {
                let line = format!("  {}", suggestions.join(" · "));
                buf.set_span_safe(
                    area.x,
                    area.y + 1,
                    &Span::styled(
                        line,
                        Style::default().fg(Color::Rgb(100, 110, 125)).bg(bg),
                    ),
                    area.width,
                );
            }
        }
    }

    /// Talk / chat bar under video (Memory Glass camera-talk → terminal).
    fn paint_talk_bar(&self, buf: &mut Buffer, area: Rect) {
        use crate::render::safe_buf::SafeBuf;
        use ratatui::style::{Color, Modifier, Style};
        use ratatui::text::Span;

        if area.width < 8 || area.height == 0 {
            return;
        }
        let bg = if self.talk_focused {
            Color::Rgb(24, 40, 36)
        } else {
            Color::Rgb(14, 20, 18)
        };
        let accent = Color::Rgb(120, 230, 180);
        let dim = Color::Rgb(100, 140, 120);
        buf.set_style(area, Style::default().bg(bg));

        let wave = if self.mic_on {
            self.mic_snap.bar_line(12)
        } else {
            "············".into()
        };
        let last = self.talk_lines.back().map(|s| s.as_str()).unwrap_or("");
        let prompt = if self.talk_focused {
            format!("talk › {}▌", self.talk_buf)
        } else if !last.is_empty() {
            format!("talk · {last}")
        } else {
            "talk › (t focus · Enter post · a mic)".into()
        };
        let head = format!(
            "{wave} m{:.0}% ",
            self.motion_level * 100.0
        );
        let style = Style::default()
            .fg(if self.talk_focused { accent } else { dim })
            .bg(bg)
            .add_modifier(if self.talk_focused {
                Modifier::BOLD
            } else {
                Modifier::empty()
            });
        let line = format!("{head}{prompt}");
        buf.set_span_safe(area.x, area.y, &Span::styled(line, style), area.width);

        if area.height >= 2 && self.talk_focused && !self.talk_lines.is_empty() {
            let hist: String = self
                .talk_lines
                .iter()
                .rev()
                .take(3)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join(" · ");
            buf.set_span_safe(
                area.x,
                area.y + 1,
                &Span::styled(
                    format!("  {hist}"),
                    Style::default().fg(Color::Rgb(90, 120, 110)).bg(bg),
                ),
                area.width,
            );
        }
    }

    /// Split `area` into (video, search_bar) with `bar_h` rows for search.
    fn split_search_bar(area: Rect, bar_h: u16) -> (Rect, Option<Rect>) {
        if area.height < 3 || bar_h == 0 {
            return (area, None);
        }
        let bar_h = bar_h.min(area.height.saturating_sub(2));
        let video_h = area.height.saturating_sub(bar_h);
        let video = Rect::new(area.x, area.y, area.width, video_h);
        let search = Rect::new(area.x, area.y + video_h, area.width, bar_h);
        (video, Some(search))
    }

    /// Paint the channel guide list over `area` (dims video underneath).
    fn paint_guide(&mut self, buf: &mut Buffer, area: Rect) {
        use crate::render::safe_buf::SafeBuf;
        use ratatui::style::{Color, Modifier, Style};
        use ratatui::text::Span;
        use ratatui::widgets::{Block, BorderType, Borders, Clear, Widget};

        if area.width < 12 || area.height < 4 {
            return;
        }

        // Keep a soft video backdrop but clear a solid list panel.
        let panel = area;
        Clear.render(panel, buf);
        let bg = Color::Rgb(12, 14, 20);
        let fg = Color::Rgb(220, 225, 235);
        let dim = Color::Rgb(120, 128, 140);
        let hi = Color::Rgb(80, 180, 255);
        let accent = Color::Rgb(255, 200, 80);
        buf.set_style(panel, Style::default().bg(bg).fg(fg));

        Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(hi).bg(bg))
            .title(format!(
                " GUIDE · {} · A–Z ",
                self.guide.filter.label()
            ))
            .title_style(
                Style::default()
                    .fg(accent)
                    .bg(bg)
                    .add_modifier(Modifier::BOLD),
            )
            .render(panel, buf);

        let inner = Rect::new(
            panel.x + 1,
            panel.y + 1,
            panel.width.saturating_sub(2),
            panel.height.saturating_sub(2),
        );
        if inner.height < 2 || inner.width < 8 {
            return;
        }

        // Header: filter key help
        let help = "0 all · 1 news · 2 music · 3 us · 4 eu · 5 world · 6 special · a–z hop · Enter";
        buf.set_span_safe(
            inner.x,
            inner.y,
            &Span::styled(help, Style::default().fg(dim).bg(bg)),
            inner.width,
        );

        let list_top = inner.y + 1;
        let list_h = inner.height.saturating_sub(2).max(1) as usize;
        let list = channels_for_filter(self.guide.filter);
        let n = list.len();
        if n == 0 {
            buf.set_span_safe(
                inner.x,
                list_top,
                &Span::styled("(no channels)", Style::default().fg(dim).bg(bg)),
                inner.width,
            );
            return;
        }

        // Scroll so cursor stays visible.
        if self.guide.cursor < self.guide.scroll {
            self.guide.scroll = self.guide.cursor;
        } else if self.guide.cursor >= self.guide.scroll + list_h {
            self.guide.scroll = self.guide.cursor + 1 - list_h;
        }

        let current_id = self.channel_id.as_deref();
        for row in 0..list_h {
            let i = self.guide.scroll + row;
            if i >= n {
                break;
            }
            let ch = list[i];
            let y = list_top + row as u16;
            let selected = i == self.guide.cursor;
            let live = current_id == Some(ch.id);
            let region_tag = match ch.region {
                ChannelRegion::Music => "mus",
                ChannelRegion::Us => "us",
                ChannelRegion::Europe => "eu",
                ChannelRegion::World => "wld",
                ChannelRegion::Specialty => "spc",
            };
            let mark = if selected {
                "▶"
            } else if live {
                "●"
            } else {
                " "
            };
            let line = format!(
                "{mark} {:12} [{region_tag}] {}",
                ch.id, ch.label
            );
            let style = if selected {
                Style::default()
                    .fg(Color::Black)
                    .bg(hi)
                    .add_modifier(Modifier::BOLD)
            } else if live {
                Style::default().fg(accent).bg(bg)
            } else {
                Style::default().fg(fg).bg(bg)
            };
            // Fill full row so selection bar is solid.
            if selected {
                for x in 0..inner.width {
                    if let Some(cell) = buf.cell_mut((inner.x + x, y)) {
                        cell.set_style(Style::default().bg(hi));
                    }
                }
            }
            buf.set_span_safe(inner.x, y, &Span::styled(line, style), inner.width);
        }

        // Footer count
        let foot_y = inner.y + inner.height.saturating_sub(1);
        let foot = format!(
            " {}/{}  ·  {} ",
            self.guide.cursor + 1,
            n,
            list.get(self.guide.cursor)
                .map(|c| c.id)
                .unwrap_or("—")
        );
        buf.set_span_safe(
            inner.x,
            foot_y,
            &Span::styled(foot, Style::default().fg(dim).bg(bg)),
            inner.width,
        );
    }

    fn paint_stream_pane(&self, buf: &mut Buffer, area: Rect) -> bool {
        let Some(rgb) = self.paint_rgb.as_ref() else {
            self.paint_placeholder(buf, area, None);
            return false;
        };
        crate::render::halfblock::paint_rgb24(buf, area, rgb, self.paint_w, self.paint_h)
    }

    fn paint_camera_pane(&self, buf: &mut Buffer, area: Rect) -> bool {
        // Inset 1 cell when chrome border is drawn (PiP tile).
        let inner = if area.width >= 5 && area.height >= 4 {
            Rect::new(
                area.x + 1,
                area.y + 1,
                area.width.saturating_sub(2),
                area.height.saturating_sub(2),
            )
        } else {
            area
        };

        let dual = camera::cam_source().is_dual()
            || (self.cam_paint_rgb.is_some() && self.phone_paint_rgb.is_some());
        let phone_only = camera::cam_source() == camera::CamSource::PhoneStill
            || (self.cam_paint_rgb.is_none() && self.phone_paint_rgb.is_some());

        if dual && inner.width >= 8 {
            // Side-by-side: left = you (laptop) · right = phone still-pipe.
            let gap = 1u16;
            let half = inner.width.saturating_sub(gap) / 2;
            let left = Rect::new(inner.x, inner.y, half.max(3), inner.height);
            let right = Rect::new(
                inner.x + half + gap,
                inner.y,
                inner.width.saturating_sub(half + gap).max(3),
                inner.height,
            );
            let mut painted = false;
            painted |= self.paint_one_cam(
                buf,
                left,
                self.cam_paint_rgb.as_deref(),
                self.cam_paint_w,
                self.cam_paint_h,
                "you",
            );
            painted |= self.paint_one_cam(
                buf,
                right,
                self.phone_paint_rgb.as_deref(),
                self.phone_paint_w,
                self.phone_paint_h,
                "phone",
            );
            // Labels on top row of each half.
            self.paint_cam_label(buf, left, "you");
            self.paint_cam_label(buf, right, "phone");
            return painted;
        }

        if phone_only {
            if let Some(rgb) = self.phone_paint_rgb.as_ref() {
                let ok = crate::render::halfblock::paint_rgb24(
                    buf,
                    inner,
                    rgb,
                    self.phone_paint_w,
                    self.phone_paint_h,
                );
                self.paint_cam_label(buf, inner, "phone");
                return ok;
            }
        }

        if let Some(rgb) = self.cam_paint_rgb.as_ref() {
            let ok = crate::render::halfblock::paint_rgb24(
                buf,
                inner,
                rgb,
                self.cam_paint_w,
                self.cam_paint_h,
            );
            self.paint_cam_label(buf, inner, "you");
            return ok;
        }
        if let Some(rgb) = self.phone_paint_rgb.as_ref() {
            let ok = crate::render::halfblock::paint_rgb24(
                buf,
                inner,
                rgb,
                self.phone_paint_w,
                self.phone_paint_h,
            );
            self.paint_cam_label(buf, inner, "phone");
            return ok;
        }
        let msg = if let Some(err) = self.camera_err.as_deref() {
            err
        } else if camera::cam_source().includes_phone() {
            "phone… open PWA"
        } else {
            "cam…"
        };
        self.paint_placeholder(buf, inner, Some(msg));
        false
    }

    fn paint_one_cam(
        &self,
        buf: &mut Buffer,
        area: Rect,
        rgb: Option<&[u8]>,
        w: u32,
        h: u32,
        empty: &str,
    ) -> bool {
        if let Some(rgb) = rgb {
            return crate::render::halfblock::paint_rgb24(buf, area, rgb, w, h);
        }
        self.paint_placeholder(buf, area, Some(empty));
        false
    }

    fn paint_cam_label(&self, buf: &mut Buffer, area: Rect, label: &str) {
        use crate::render::safe_buf::SafeBuf;
        use ratatui::style::{Color, Style};
        use ratatui::text::Span;
        if area.width < 3 || area.height == 0 {
            return;
        }
        let style = Style::default()
            .fg(Color::Rgb(180, 210, 255))
            .bg(Color::Rgb(12, 16, 22));
        buf.set_span_safe(
            area.x,
            area.y,
            &Span::styled(format!(" {label} "), style),
            area.width,
        );
    }

    fn paint_placeholder(&self, buf: &mut Buffer, area: Rect, override_msg: Option<&str>) {
        use crate::render::safe_buf::SafeBuf;
        use ratatui::style::{Modifier, Style};
        use ratatui::text::Span;
        if area.width < 8 || area.height < 2 {
            return;
        }
        let msg = override_msg.unwrap_or(match &self.phase {
            Phase::Resolving => "resolving yt-dlp · first frames in a few seconds…",
            Phase::Error(e) => e.as_str(),
            Phase::Ready => "waiting for first frame…",
        });
        let style = Style::default().add_modifier(Modifier::DIM);
        let y = area.y + area.height / 2;
        let x = area.x + 1;
        let span = Span::styled(msg, style);
        let max = area.width.saturating_sub(2);
        buf.set_span_safe(x, y, &span, max);
    }

    /// Overlay progress 0..1 (unknown duration → pulse on paint_gen).
    pub fn progress_pulse(&self) -> f64 {
        if self.paint_gen == 0 {
            let t = self.opened_at.elapsed().as_secs_f64();
            return ((t * 0.5).sin() * 0.5 + 0.5).clamp(0.0, 1.0);
        }
        // No duration; show mild motion from frame counter.
        ((self.paint_gen as f64 * 0.02) % 1.0).clamp(0.0, 1.0)
    }

    pub fn source_url(&self) -> &str {
        &self.source_url
    }

    pub fn dimensions(&self) -> (u32, u32) {
        (self.paint_w, self.paint_h)
    }
}

impl Drop for LiveWatchState {
    fn drop(&mut self) {
        self.demux.take();
        self.stop_camera();
    }
}

// ---------------------------------------------------------------------------
// Overlay chrome (same 90% popup pattern as video / gboom)
// ---------------------------------------------------------------------------

/// Render live-watch popup chrome. Returns popup rect for frame paint.
pub fn render_live_watch_overlay(
    buf: &mut Buffer,
    area: Rect,
    watch: &LiveWatchState,
    bg: ratatui::style::Color,
    text_fg: ratatui::style::Color,
    border_fg: ratatui::style::Color,
) -> Option<Rect> {
    use crate::render::safe_buf::SafeBuf;
    use ratatui::style::{Modifier, Style};
    use ratatui::text::Span;
    use ratatui::widgets::{Block, BorderType, Borders, Widget};

    if area.height < 6 || area.width < 16 {
        return None;
    }

    crate::render::color::dim_area(buf, area, bg, 0.5);

    // 80×24 / GY bottom-pane: use full area so cam PiP + stream are not
    // crushed by a centered 90% box (GrokYtalkY: never invent larger canvas,
    // never waste real rows on dead margin).
    let (wpct, hpct) = layout::popup_fill_frac(area);
    let popup_width = ((area.width as u32 * wpct) / 100)
        .max(if area.width < 40 { 16 } else { 28 })
        .min(area.width as u32) as u16;
    let popup_height = ((area.height as u32 * hpct) / 100)
        .max(if area.height < 12 { 6 } else { 8 })
        .min(area.height as u32) as u16;
    let popup_x = area.x + (area.width.saturating_sub(popup_width)) / 2;
    let popup_y = area.y + (area.height.saturating_sub(popup_height)) / 2;
    let popup_rect = Rect::new(popup_x, popup_y, popup_width, popup_height);

    ratatui::widgets::Clear.render(popup_rect, buf);
    buf.set_style(popup_rect, Style::default().fg(text_fg).bg(bg));

    Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(border_fg).bg(bg))
        .style(Style::default().bg(bg))
        .render(popup_rect, buf);

    let title = format!(" {} ", watch.title());
    let title_style = Style::default()
        .fg(text_fg)
        .bg(bg)
        .add_modifier(Modifier::BOLD);
    let tw = title.chars().count().min(popup_rect.width as usize) as u16;
    let tx = popup_rect.x + (popup_rect.width.saturating_sub(tw)) / 2;
    buf.set_span_safe(tx, popup_rect.y, &Span::styled(&title, title_style), tw);

    // Status on bottom border
    let status = format!(" {} ", watch.status_line());
    let bar_y = popup_rect.y + popup_rect.height.saturating_sub(1);
    let max = popup_rect.width.saturating_sub(2);
    buf.set_span_safe(
        popup_rect.x + 1,
        bar_y,
        &Span::styled(status, Style::default().fg(text_fg).bg(bg)),
        max,
    );

    Some(popup_rect)
}

// Silence unused import of Write on some platforms
#[allow(dead_code)]
fn _write_sink(w: &mut dyn Write) {
    let _ = w.write_all(b"");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_url_is_https() {
        assert!(DEFAULT_URL.starts_with("https://"));
    }

    fn stub_state(kind: ChannelKind, entries: Vec<PlaylistEntry>) -> LiveWatchState {
        LiveWatchState {
            source_url: DEFAULT_URL.into(),
            channel_label: "test channel".into(),
            channel_id: None,
            kind,
            zap_region: None,
            entries,
            idx: 0,
            seek_secs: 0,
            playing: true,
            phase: Phase::Ready,
            demux: None,
            optical: None,
            webgrid: None,
            camera: None,
            camera_phone: None,
            camera_on: false,
            camera_mirror: true,
            camera_err: None,
            cam_paint_rgb: None,
            cam_paint_w: 80,
            cam_paint_h: 90,
            cam_paint_gen: 0,
            phone_paint_rgb: None,
            phone_paint_w: 80,
            phone_paint_h: 90,
            phone_paint_gen: 0,
            mic: None,
            mic_on: false,
            mic_snap: MicSnapshot::idle(),
            motion_level: 0.0,
            prev_cam_thumb: None,
            talk_buf: String::new(),
            talk_focused: false,
            talk_lines: VecDeque::new(),
            paint_rgb: Some(vec![0u8; 160 * 90 * 3]),
            paint_w: 160,
            paint_h: 90,
            paint_gen: 1,
            last_frame_time: Instant::now(),
            fps: 12.0,
            status: "ok".into(),
            worker_rx: None,
            opened_at: Instant::now(),
            fail_skips: 0,
            current_page_url: Some("https://example.com".into()),
            guide: ChannelGuide::default(),
            search_buf: String::new(),
            search_focused: false,
            shuffle: false,
        }
    }

    #[test]
    fn talk_focus_and_commit() {
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        s.focus_talk();
        assert!(s.talk_focused());
        s.talk_buf = "hello mesh".into();
        s.commit_talk_line();
        assert!(!s.talk_buf.is_empty() || s.talk_lines.back().map(|x| x.as_str()) == Some("hello mesh"));
        assert_eq!(s.talk_lines.back().map(|x| x.as_str()), Some("hello mesh"));
        assert!(s.talk_buf.is_empty());
    }

    #[test]
    fn motion_updates_from_frame_delta() {
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        let black = vec![0u8; 16 * 16 * 3];
        let white = vec![255u8; 16 * 16 * 3];
        s.update_motion_from_cam(&black, 16, 16);
        s.update_motion_from_cam(&white, 16, 16);
        assert!(s.motion_level() > 0.01);
    }

    #[test]
    fn open_starts_resolving() {
        // Don't hit network in unit test — just construct state shape.
        let mut s = stub_state(
            ChannelKind::MusicTv,
            vec![PlaylistEntry {
                id: "x".into(),
                title: "test".into(),
                page_url: "https://example.com".into(),
            }],
        );
        assert!(s.playing());
        assert_eq!(s.dimensions(), (160, 90));
        let area = Rect::new(0, 0, 40, 20);
        let mut buf = Buffer::empty(area);
        assert!(s.paint_half_blocks(&mut buf, area));
    }

    #[test]
    fn key_close() {
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        let k = KeyEvent::from(KeyCode::Esc);
        assert_eq!(s.handle_key(&k), LiveWatchKeyOutcome::Close);
    }

    #[test]
    fn space_toggles_play() {
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        let k = KeyEvent::from(KeyCode::Char(' '));
        assert_eq!(s.handle_key(&k), LiveWatchKeyOutcome::Changed);
        assert!(!s.playing());
    }

    #[test]
    fn strip_shuffle_flag_parses() {
        let (f, rest) = strip_shuffle_flag("shuffle trailers");
        assert_eq!(f, Some(true));
        assert_eq!(rest, "trailers");
        let (f, rest) = strip_shuffle_flag("trailers noshuffle");
        assert_eq!(f, Some(false));
        assert_eq!(rest, "trailers");
        let (f, rest) = strip_shuffle_flag("bloomberg");
        assert_eq!(f, None);
        assert_eq!(rest, "bloomberg");
    }

    #[test]
    fn s_key_shuffles_to_other_track() {
        let entries: Vec<PlaylistEntry> = (0..5)
            .map(|i| PlaylistEntry {
                id: format!("t{i}"),
                title: format!("Trailer {i}"),
                page_url: format!("https://example.com/{i}"),
            })
            .collect();
        let mut s = stub_state(ChannelKind::MusicTv, entries);
        s.channel_id = Some("trailers".into());
        s.shuffle = true;
        s.idx = 0;
        // shuffle_next kicks resolve (no network in unit test) but updates idx intent
        // via request_stream_for — idx is set immediately.
        s.shuffle_next();
        assert_ne!(s.idx, 0, "should leave track 0");
        assert!(s.idx < 5);
        // request_stream_for overwrites status with "resolving stream…"
        assert!(s.status.contains("resolving") || s.status.contains("Trailer"));
    }

    #[test]
    fn capital_s_toggles_shuffle_mode() {
        let mut s = stub_state(
            ChannelKind::MusicTv,
            vec![
                PlaylistEntry {
                    id: "a".into(),
                    title: "A".into(),
                    page_url: "https://a".into(),
                },
                PlaylistEntry {
                    id: "b".into(),
                    title: "B".into(),
                    page_url: "https://b".into(),
                },
            ],
        );
        assert!(!s.shuffle_enabled());
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Char('S'))),
            LiveWatchKeyOutcome::Changed
        );
        assert!(s.shuffle_enabled());
        s.handle_key(&KeyEvent::from(KeyCode::Char('S')));
        assert!(!s.shuffle_enabled());
    }

    #[test]
    fn o_key_popout_does_not_close() {
        let mut s = stub_state(
            ChannelKind::LiveNews,
            vec![PlaylistEntry {
                id: "bbg".into(),
                title: "Bloomberg".into(),
                page_url: "https://www.youtube.com/@business/live".into(),
            }],
        );
        let k = KeyEvent::from(KeyCode::Char('o'));
        assert_eq!(s.handle_key(&k), LiveWatchKeyOutcome::Changed);
        assert!(s.status.contains("pop-out"));
    }

    #[test]
    fn channel_resolve_bloomberg() {
        let s = resolve_watch_source("bloomberg");
        assert_eq!(s.channel_id.as_deref(), Some("bloomberg"));
        assert!(s.url.contains("business") || s.url.contains("ytsearch"));
    }

    #[test]
    fn music_tv_can_auto_skip() {
        let s = stub_state(
            ChannelKind::MusicTv,
            vec![
                PlaylistEntry {
                    id: "a".into(),
                    title: "A".into(),
                    page_url: "https://a".into(),
                },
                PlaylistEntry {
                    id: "b".into(),
                    title: "B".into(),
                    page_url: "https://b".into(),
                },
            ],
        );
        assert!(s.can_auto_skip());
    }

    #[test]
    fn live_news_does_not_auto_skip_single() {
        let s = stub_state(
            ChannelKind::LiveNews,
            vec![PlaylistEntry {
                id: "live".into(),
                title: "Live".into(),
                page_url: "https://live".into(),
            }],
        );
        assert!(!s.can_auto_skip());
    }

    #[test]
    fn music_hud_uses_channel_label() {
        let mut s = stub_state(
            ChannelKind::MusicTv,
            vec![PlaylistEntry {
                id: "x".into(),
                title: "Song".into(),
                page_url: "https://x".into(),
            }],
        );
        s.channel_label = "Lo-Fi Radio · music TV".into();
        let hud = s.hud_status();
        assert!(hud.contains("Lo-Fi Radio"), "hud={hud}");
        assert!(!hud.starts_with("▶ VEVO TV"), "hud should not hardcode VEVO: {hud}");
    }

    #[test]
    fn stream_cache_roundtrip() {
        let page = "https://example.com/cache-test-unique";
        cache_put_stream(page, "https://cdn.example/stream1");
        assert_eq!(
            cache_get_stream(page).as_deref(),
            Some("https://cdn.example/stream1")
        );
    }

    #[test]
    fn slash_focuses_search_and_typing_stays_in_modal() {
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        assert!(!s.search_focused());
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Char('/'))),
            LiveWatchKeyOutcome::Changed
        );
        assert!(s.search_focused());
        // Esc unfocuses — does NOT close the watch modal.
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Esc)),
            LiveWatchKeyOutcome::Changed
        );
        assert!(!s.search_focused());
        // Second Esc closes.
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Esc)),
            LiveWatchKeyOutcome::Close
        );
    }

    #[test]
    fn search_accepts_chars_and_submit_retunes() {
        let mut s = stub_state(ChannelKind::LiveNews, Vec::new());
        s.focus_search();
        for ch in ['c', 'n', 'n'] {
            s.handle_key(&KeyEvent::from(KeyCode::Char(ch)));
        }
        assert_eq!(s.search_query(), "cnn");
        s.handle_key(&KeyEvent::from(KeyCode::Enter));
        assert!(!s.search_focused());
        // switch_source starts resolve worker — label/id should update.
        assert_eq!(s.channel_id.as_deref(), Some("cnn"));
        assert!(matches!(s.phase, Phase::Resolving));
    }

    #[test]
    fn tab_completes_channel_id() {
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        s.focus_search();
        s.search_buf = "bloo".into();
        s.complete_search();
        assert_eq!(s.search_query(), "bloomberg");
    }

    #[test]
    fn x_hub_open_focuses_search_without_resolve() {
        let s = LiveWatchState::open("x");
        assert_eq!(s.channel_id.as_deref(), Some("x"));
        assert!(s.search_focused(), "hub should focus paste bar");
        assert!(s.search_query().contains("x.com/i/broadcasts"));
        assert!(s.worker_rx.is_none(), "must not spawn yt-dlp on hub");
        assert!(matches!(s.phase, Phase::Ready));
    }

    #[test]
    fn x_broadcast_url_resolves() {
        let s = resolve_watch_source("https://twitter.com/i/broadcasts/1ynJOZQeqXqGR");
        assert_eq!(s.channel_id.as_deref(), Some("x"));
        assert_eq!(s.url, "https://x.com/i/broadcasts/1ynJOZQeqXqGR");
        assert!(s.label.starts_with("X ·"));
    }

    #[test]
    fn x_prefix_and_bare_id() {
        let a = resolve_watch_source("x:1ynJOZQeqXqGR");
        assert_eq!(a.url, "https://x.com/i/broadcasts/1ynJOZQeqXqGR");
        let b = resolve_watch_source("x https://x.com/elonmusk/status/1234567890123456789");
        assert!(b.url.contains("/status/1234567890123456789"));
        assert_eq!(b.channel_id.as_deref(), Some("x"));
    }

    #[test]
    fn capital_u_starts_go_live_path() {
        // Without x-media-studio-hls this errors — still a Changed, not Close.
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        let out = s.handle_key(&KeyEvent::from(KeyCode::Char('U')));
        assert_eq!(out, LiveWatchKeyOutcome::Changed);
        assert!(
            s.status.contains("go-live") || s.status.contains("X") || s.status.contains("pipeline")
                || s.status.contains("missing") || s.status.contains("studio"),
            "status={}",
            s.status
        );
    }

    #[test]
    fn c_toggles_camera_flag_without_hardware_when_start_fails() {
        // Without a real camera device in CI, start may fail and clear camera_on.
        // Still exercise the key path and mirror toggle state.
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        assert!(!s.camera_on());
        let before_mirror = s.camera_mirror;
        let k = KeyEvent::from(KeyCode::Char('m'));
        assert_eq!(s.handle_key(&k), LiveWatchKeyOutcome::Changed);
        assert_eq!(s.camera_mirror, !before_mirror);
    }

    #[test]
    fn split_paint_with_camera_on_and_stub_frames() {
        let mut s = stub_state(ChannelKind::Generic, Vec::new());
        s.camera_on = true;
        // Glyph-sized capture (25²), not portrait 80×90.
        s.cam_paint_rgb = Some(vec![32u8; 26 * 26 * 3]);
        s.cam_paint_w = 26;
        s.cam_paint_h = 26;
        // Lean 80×12 — PiP must leave stream full-bleed.
        let area = Rect::new(0, 0, 80, 12);
        let mut buf = Buffer::empty(area);
        assert!(s.paint_half_blocks(&mut buf, area));
        let lay = layout::layout_watch_video(
            Rect::new(0, 0, 80, 11), /* minus search row */
            true,
        );
        assert_eq!(lay.cam_mode, CamMode::Pip);
        assert_eq!(lay.stream.width, 80);
    }

    #[test]
    fn g_opens_guide_esc_closes_guide_not_player() {
        let mut s = stub_state(ChannelKind::LiveNews, Vec::new());
        s.channel_id = Some("bloomberg".into());
        s.zap_region = Some(ChannelRegion::Us);
        assert!(!s.guide_open());
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Char('g'))),
            LiveWatchKeyOutcome::Changed
        );
        assert!(s.guide_open());
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Esc)),
            LiveWatchKeyOutcome::Changed
        );
        assert!(!s.guide_open());
    }

    #[test]
    fn guide_letter_hop_b_bloomberg_in_us() {
        let mut s = stub_state(ChannelKind::LiveNews, Vec::new());
        s.channel_id = Some("abc".into());
        s.zap_region = Some(ChannelRegion::Us);
        s.open_guide(Some(GuideFilter::Region(ChannelRegion::Us)));
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Char('b'))),
            LiveWatchKeyOutcome::Changed
        );
        let list = channels_for_filter(GuideFilter::Region(ChannelRegion::Us));
        assert_eq!(list[s.guide.cursor].id, "bloomberg");
    }

    #[test]
    fn guide_filter_digit_1_news() {
        let mut s = stub_state(ChannelKind::LiveNews, Vec::new());
        s.open_guide(Some(GuideFilter::All));
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Char('1'))),
            LiveWatchKeyOutcome::Changed
        );
        assert_eq!(s.guide.filter, GuideFilter::News);
    }

    #[test]
    fn news_n_zaps_station() {
        let mut s = stub_state(
            ChannelKind::LiveNews,
            vec![PlaylistEntry {
                id: "live".into(),
                title: "Live".into(),
                page_url: "https://live".into(),
            }],
        );
        s.channel_id = Some("bloomberg".into());
        s.zap_region = Some(ChannelRegion::Us);
        // n should start switch (resolving) to next US station after bloomberg.
        assert_eq!(
            s.handle_key(&KeyEvent::from(KeyCode::Char('n'))),
            LiveWatchKeyOutcome::Changed
        );
        assert!(matches!(s.phase, Phase::Resolving));
        assert_ne!(s.channel_id.as_deref(), Some("bloomberg"));
    }

    #[test]
    fn paint_guide_when_open() {
        let mut s = stub_state(ChannelKind::LiveNews, Vec::new());
        s.open_guide(Some(GuideFilter::News));
        let area = Rect::new(0, 0, 48, 18);
        let mut buf = Buffer::empty(area);
        assert!(s.paint_half_blocks(&mut buf, area));
    }
}
