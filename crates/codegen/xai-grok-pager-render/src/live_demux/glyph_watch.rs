//! `/watch glyph` — plant glyph control-plane surface + quantum-lift pop-out.
//!
//! **fc-glyph-watch-v1** · debate handoff → Glyph tools form → dense peel seat
//!
//! Not optical TX (that is `/watch optical [glyph]`). This path is:
//!
//! ```text
//! /watch glyph [URL]           TTY surface (synthetic grid or stream)
//! /watch popout glyph [URL]    ffplay via mg-quantum-video-lift + open arena
//! o (in modal)                 same custom pop-out (ffmpeg/ffplay HW path)
//! ```
//!
//! Path through:
//!   yt-dlp → ffmpeg/ffplay (videotoolbox) → last-lift.json → multiplex BC
//!   · open http://127.0.0.1:8787/ugrad-arena.html?mode=glyph  (MG PWA · Soft Path owns :8765)
//!
//! Honesty: lab BPS ≠ ARC % · video lift = control plane · peel owns dense map.

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;

/// Sentinel for resolve_watch_source / LiveWatchState.
pub const GLYPH_URL: &str = "glyph://live";
pub const FEATURE_ID: &str = "fc-glyph-watch-v1";
pub const TOAST_GLYPH: &str =
    "GLYPH · /watch plant path · o = quantum-lift ffplay + arena (fc-glyph-watch-v1)";

/// Default arena Glyph tools (paper keynote park :8790 · Soft Path owns :8765).
/// Override: LIVE_DEMUX_GLYPH_ARENA=http://127.0.0.1:8787/ugrad-arena.html?mode=glyph
pub const DEFAULT_ARENA_GLYPH: &str = "http://127.0.0.1:8790/ugrad-arena.html?mode=glyph";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GlyphWatchMode {
    /// Synthetic dense grid on TTY (no stream) — control-plane ready.
    Dense,
    /// Optional stream URL attached; TTY demux + special pop-out.
    Lift,
    /// Prefer peel-seat messaging (still opens arena dense form).
    Peel,
}

impl GlyphWatchMode {
    pub fn id(self) -> &'static str {
        match self {
            GlyphWatchMode::Dense => "dense",
            GlyphWatchMode::Lift => "lift",
            GlyphWatchMode::Peel => "peel",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            GlyphWatchMode::Dense => "glyph dense · plant control plane",
            GlyphWatchMode::Lift => "glyph lift · quantum video path",
            GlyphWatchMode::Peel => "glyph peel · dense seat (not race)",
        }
    }
}

/// Slash / channel tokens for plant glyph (not `/watch optical glyph`).
pub fn is_glyph_watch_token(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "glyph"
            | "glyph-live"
            | "glyphlive"
            | "glyph-watch"
            | "glyphwatch"
            | "q-lift"
            | "qlift"
            | "quantum-lift"
            | "quantumlift"
            | "peel-live"
            | "peellive"
            | "glyph-tools"
            | "glyphtools"
    )
}

/// True when input is a plant glyph-watch source (not optical TX).
///
/// Bare `glyph` qualifies. `optical glyph` is **not** handled here
/// (`optical::is_optical_source` wins first in the slash command).
pub fn is_glyph_watch_source(input: &str) -> bool {
    let t = input.trim();
    if t == GLYPH_URL || t.starts_with("glyph://") {
        return true;
    }
    // Reject pure optical compound (optical owns those).
    let low = t.to_ascii_lowercase();
    if low.split_whitespace().any(|w| {
        matches!(
            w,
            "optical" | "optic" | "optical-blur" | "jawta" | "fountain" | "decimen" | "airgap"
        ) || w.starts_with("optical://")
    }) {
        return false;
    }
    let key = t
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    is_glyph_watch_token(&key)
}

/// Parse `/watch glyph [dense|lift|peel] [URL…]` → (mode, optional stream URL, label text).
pub fn parse_glyph_watch_args(input: &str) -> (GlyphWatchMode, Option<String>, String) {
    let mut mode = GlyphWatchMode::Dense;
    let mut url: Option<String> = None;
    let mut notes: Vec<String> = Vec::new();
    for tok in input.split_whitespace() {
        let low = tok.to_ascii_lowercase();
        if is_glyph_watch_token(&low) || low.starts_with("glyph://") {
            if let Some(rest) = low.strip_prefix("glyph://") {
                mode = match rest {
                    "lift" | "video" => GlyphWatchMode::Lift,
                    "peel" | "dense-peel" => GlyphWatchMode::Peel,
                    _ => GlyphWatchMode::Dense,
                };
            }
            continue;
        }
        match low.as_str() {
            "dense" | "grid" | "index" => mode = GlyphWatchMode::Dense,
            "lift" | "video" | "stream" | "qlift" => mode = GlyphWatchMode::Lift,
            "peel" | "zxing" | "hybrid" => mode = GlyphWatchMode::Peel,
            "popout" | "out" | "external" | "ffplay" | "window" | "--popout" | "-o" => {}
            other if other.starts_with("http://")
                || other.starts_with("https://")
                || other.starts_with("file:")
                || other.starts_with("rtsp://")
                || other.starts_with("rtmp://")
                || other.ends_with(".m3u8")
                || other.ends_with(".mp4")
                || other.ends_with(".mkv") =>
            {
                url = Some(tok.to_string());
                mode = GlyphWatchMode::Lift;
            }
            other => notes.push(other.to_string()),
        }
    }
    // leftover free text may be a bare yt search / channel name
    if url.is_none() {
        let joined = notes.join(" ");
        if !joined.is_empty()
            && !matches!(
                joined.as_str(),
                "live" | "plant" | "mint" | "arena" | "tools"
            )
        {
            // treat as page URL / yt search seed when look like domain
            if joined.contains('.') || joined.starts_with("ytsearch") {
                url = Some(joined.clone());
                mode = GlyphWatchMode::Lift;
            } else {
                notes.clear();
                notes.push(joined);
            }
        }
    }
    let label = if notes.is_empty() {
        mode.label().to_string()
    } else {
        format!("{} · {}", mode.id(), notes.join(" "))
    };
    (mode, url, label)
}

pub fn glyph_url(mode: GlyphWatchMode) -> String {
    format!("glyph://{}", mode.id())
}

/// Arena URL (override with LIVE_DEMUX_GLYPH_ARENA).
pub fn arena_glyph_url() -> String {
    std::env::var("LIVE_DEMUX_GLYPH_ARENA").unwrap_or_else(|_| DEFAULT_ARENA_GLYPH.into())
}

fn mg_root_candidates() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Ok(root) = std::env::var("FC_GROK_ROOT") {
        v.push(PathBuf::from(root).join("experiments/memory-glass"));
        v.push(PathBuf::from(std::env::var("FC_GROK_ROOT").unwrap()).join(""));
    }
    if let Ok(home) = std::env::var("HOME") {
        v.push(PathBuf::from(&home).join("Projects/grok-build/experiments/memory-glass"));
        v.push(
            PathBuf::from(&home)
                .join("Projects/fornevercollective/grok-build/experiments/memory-glass"),
        );
    }
    // Known lab mount (qbitOS)
    v.push(PathBuf::from(
        "/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass",
    ));
    v.push(PathBuf::from(
        "/Volumes/qbitOS/00.dev/projects/grok-build",
    ));
    v
}

/// Locate mg-quantum-video-lift.sh (preferred) or glyph-watch-popout.sh.
pub fn find_glyph_lift_script() -> Option<PathBuf> {
    // Prefer dedicated pop-out wrapper if present
    for root in mg_root_candidates() {
        let wrap = root.join("scripts/live-demux/glyph-watch-popout.sh");
        if wrap.is_file() {
            return Some(wrap);
        }
        let wrap2 = root.join("scripts/glyph-watch-popout.sh");
        if wrap2.is_file() {
            return Some(wrap2);
        }
        let lift = root.join("scripts/mg-quantum-video-lift.sh");
        if lift.is_file() {
            return Some(lift);
        }
    }
    // grok-build scripts/live-demux
    if let Ok(root) = std::env::var("FC_GROK_ROOT") {
        let p = PathBuf::from(root).join("scripts/live-demux/glyph-watch-popout.sh");
        if p.is_file() {
            return Some(p);
        }
    }
    let gb = PathBuf::from("/Volumes/qbitOS/00.dev/projects/grok-build/scripts/live-demux/glyph-watch-popout.sh");
    if gb.is_file() {
        return Some(gb);
    }
    None
}

fn open_url(url: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open")
            .arg(url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = Command::new("xdg-open")
            .arg(url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }
}

/// Blocking: quantum-lift ffplay (+ optional URL) + open Glyph arena tab.
pub fn launch_glyph_popout_blocking(url: Option<&str>, open_arena: bool) -> Result<String, String> {
    let script = find_glyph_lift_script()
        .ok_or_else(|| {
            "glyph pop-out: missing mg-quantum-video-lift.sh / glyph-watch-popout.sh \
             (set FC_GROK_ROOT or install under experiments/memory-glass/scripts)"
                .to_string()
        })?;

    let mut cmd = Command::new("bash");
    cmd.arg(&script);

    let name = script
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("lift");

    if name.contains("glyph-watch-popout") {
        // wrapper: glyph-watch-popout.sh [URL]
        if let Some(u) = url.filter(|s| !s.is_empty()) {
            cmd.arg(u);
        } else {
            cmd.arg("--arena-only");
        }
    } else {
        // mg-quantum-video-lift.sh lift|ffplay URL
        if let Some(u) = url.filter(|s| !s.is_empty()) {
            cmd.arg("lift").arg(u);
        } else {
            // no URL: still open arena; tools check
            cmd.arg("tools");
        }
    }

    cmd.env("MG_LIFT_MUX", "rubik,bloch,glyph_dense,tensor_lane");
    cmd.env("MG_HWACCEL", std::env::var("MG_HWACCEL").unwrap_or_else(|_| "auto".into()));
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);

    let child = cmd
        .spawn()
        .map_err(|e| format!("glyph lift spawn failed: {e}"))?;

    if open_arena {
        // brief settle so ffplay can claim focus first when URL present
        if url.map(|u| !u.is_empty()).unwrap_or(false) {
            thread::sleep(std::time::Duration::from_millis(350));
        }
        open_url(&arena_glyph_url());
    }

    let arena = arena_glyph_url();
    Ok(format!(
        "glyph pop-out · quantum-lift pid {} · arena {arena} · meta ~/.panda/mg-soak/video-feed/last-lift.json",
        child.id()
    ))
}

/// Fire-and-forget custom pop-out (ffmpeg/ffplay via quantum-lift + arena).
pub fn launch_glyph_popout_async(url: Option<&str>, open_arena: bool) -> String {
    let url_owned = url.map(|s| s.to_string());
    let _ = thread::Builder::new()
        .name("glyph-watch-popout".into())
        .spawn(move || {
            let u = url_owned.as_deref();
            if let Err(e) = launch_glyph_popout_blocking(u, open_arena) {
                eprintln!("[fc-glyph-watch] pop-out: {e}");
            }
        });
    match url {
        Some(u) if !u.is_empty() => format!(
            "glyph pop-out · quantum-lift ffplay · {}… · arena {}",
            u.chars().take(48).collect::<String>(),
            arena_glyph_url()
        ),
        _ => format!(
            "glyph pop-out · open arena + tools form · {} · (pass URL for ffplay lift)",
            arena_glyph_url()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens() {
        assert!(is_glyph_watch_token("glyph"));
        assert!(is_glyph_watch_token("q-lift"));
        assert!(is_glyph_watch_token("GLYPH-LIVE"));
        assert!(!is_glyph_watch_token("bloomberg"));
        assert!(!is_glyph_watch_token("optical"));
    }

    #[test]
    fn source_rejects_optical_compound() {
        assert!(is_glyph_watch_source("glyph"));
        assert!(is_glyph_watch_source("glyph https://youtu.be/x"));
        assert!(is_glyph_watch_source("glyph://lift"));
        assert!(!is_glyph_watch_source("optical glyph"));
        assert!(!is_glyph_watch_source("optical://glyph"));
    }

    #[test]
    fn parse_url_forces_lift() {
        let (m, u, _) = parse_glyph_watch_args("glyph https://example.com/v.m3u8");
        assert_eq!(m, GlyphWatchMode::Lift);
        assert_eq!(u.as_deref(), Some("https://example.com/v.m3u8"));
    }

    #[test]
    fn parse_peel() {
        let (m, u, _) = parse_glyph_watch_args("glyph peel");
        assert_eq!(m, GlyphWatchMode::Peel);
        assert!(u.is_none());
    }
}
