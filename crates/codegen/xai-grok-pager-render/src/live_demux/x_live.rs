//! X.com (Twitter) live streams — **from** (watch) and **to** (go live).
//!
//! # From x.com (ingest)
//! Paste into `/watch` search or args:
//! - `https://x.com/i/broadcasts/<id>`
//! - `https://x.com/<user>/status/<id>` / `https://x.com/i/status/<id>`
//! - `https://pscp.tv/w/…` · `video.pscp.tv` HLS
//! - `x:<broadcast-or-status>` · `twitter <url>`
//!
//! Resolved with **yt-dlp** extractors `twitter`, `twitter:broadcast`,
//! `twitter:spaces`, … Cookies (`YTDLP_COOKIES` / `YTDLP_COOKIES_FROM_BROWSER`)
//! help on gated broadcasts.
//!
//! # To x.com (go live)
//! Local camera/mic → HLS via `~/Projects/x-media-studio-hls` (or `X_HLS_ROOT`),
//! then X Media Studio Producer pulls the public `.m3u8`.
//! In player: **`U`** (shift+u) or `/watch golive`.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Toast when go-live pipeline is kicked off.
pub const TOAST_GO_LIVE: &str =
    "X GO-LIVE · HLS pipeline → studio.x.com producer (fc-live-demux-v1 · U key · /watch golive)";

/// Hint when user opens bare `x` / `twitter` without a URL.
pub const HINT_PASTE_X: &str =
    "X live · paste https://x.com/i/broadcasts/… or /status/… · Enter · cookies help gated streams";

/// True if `s` looks like an X/Twitter/Periscope media locator.
pub fn is_x_locator(s: &str) -> bool {
    let t = s.trim().to_ascii_lowercase();
    if t.is_empty() {
        return false;
    }
    t.contains("x.com/")
        || t.contains("twitter.com/")
        || t.contains("t.co/")
        || t.contains("pscp.tv")
        || t.contains("periscope.tv")
        || t.contains("video.pscp.tv")
        || t.starts_with("x:")
        || t.starts_with("twitter:")
        || t.starts_with("xlive:")
}

/// Bare hub tokens — open search prefilled for X, don't try to demux a homepage.
pub fn is_x_hub_token(s: &str) -> bool {
    matches!(
        s.trim().to_ascii_lowercase().as_str(),
        "x" | "twitter"
            | "xcom"
            | "x-com"
            | "x.com"
            | "x-live"
            | "xlive"
            | "x_live"
            | "spaces"
            | "xspaces"
    )
}

/// Go-live / uplink tokens for slash args.
pub fn is_go_live_token(s: &str) -> bool {
    matches!(
        s.trim().to_ascii_lowercase().as_str(),
        "golive"
            | "go-live"
            | "go_live"
            | "x-out"
            | "xout"
            | "x-push"
            | "push-x"
            | "uplink"
            | "x-uplink"
            | "to-x"
            | "tox"
            | "--golive"
    )
}

/// Strip go-live tokens from watch args; returns `(go_live, remaining)`.
pub fn parse_go_live_args(raw: &str) -> (bool, String) {
    let mut go = false;
    let mut parts: Vec<&str> = Vec::new();
    for tok in raw.split_whitespace() {
        if is_go_live_token(tok) {
            go = true;
        } else {
            parts.push(tok);
        }
    }
    (go, parts.join(" "))
}

/// Normalize user paste into a canonical URL yt-dlp can extract.
///
/// Returns `None` if this doesn't look like X media (caller falls through).
pub fn normalize_x_url(input: &str) -> Option<String> {
    let raw = input.trim();
    if raw.is_empty() {
        return None;
    }

    // Prefix forms: x:URL · twitter:URL · xlive:ID
    let stripped = raw
        .strip_prefix("x:")
        .or_else(|| raw.strip_prefix("X:"))
        .or_else(|| raw.strip_prefix("twitter:"))
        .or_else(|| raw.strip_prefix("TWITTER:"))
        .or_else(|| raw.strip_prefix("xlive:"))
        .or_else(|| raw.strip_prefix("XLIVE:"))
        .unwrap_or(raw)
        .trim();

    // "twitter <url>" / "x <url>" two-token handled by resolve_watch_source.

    let s = stripped.trim();
    let lower = s.to_ascii_lowercase();

    // Already a full URL — only accept real X/Twitter/Periscope hosts.
    // (Must not steal YouTube / generic https locators into the X path.)
    if lower.starts_with("http://") || lower.starts_with("https://") {
        if is_x_locator(s) {
            return Some(canonicalize_x_host(s));
        }
        return None;
    }
    if lower.starts_with("www.") {
        let full = format!("https://{s}");
        if is_x_locator(&full) {
            return Some(canonicalize_x_host(&full));
        }
        return None;
    }

    // Bare numeric status id first (tweet snowflakes are pure digits; must not
    // be classified as Periscope broadcast ids just because they start with '1').
    if s.chars().all(|c| c.is_ascii_digit()) && s.len() >= 10 {
        return Some(format!("https://x.com/i/status/{s}"));
    }

    // Bare broadcast id (Periscope/X style: starts with 1, has letters, alphanumeric)
    if is_broadcast_id(s) {
        return Some(format!("https://x.com/i/broadcasts/{s}"));
    }

    // Path-only: /i/broadcasts/ID · i/broadcasts/ID · user/status/ID
    if let Some(rest) = s.strip_prefix('/') {
        return Some(canonicalize_x_host(&format!("https://x.com/{rest}")));
    }
    if lower.starts_with("i/broadcasts/") || lower.contains("/status/") {
        return Some(canonicalize_x_host(&format!("https://x.com/{s}")));
    }

    // @handle — not a stream by itself; no normalize (caller may search).
    if s.starts_with('@') {
        return None;
    }

    if is_x_locator(s) {
        return Some(canonicalize_x_host(s));
    }

    None
}

fn canonicalize_x_host(url: &str) -> String {
    let mut u = url.trim().to_string();
    // Prefer x.com host for yt-dlp twitter extractors.
    u = u
        .replace("https://twitter.com/", "https://x.com/")
        .replace("http://twitter.com/", "https://x.com/")
        .replace("https://www.twitter.com/", "https://x.com/")
        .replace("https://mobile.twitter.com/", "https://x.com/")
        .replace("https://www.x.com/", "https://x.com/");
    // Fix common path typos
    if let Some(id) = extract_broadcast_id(&u) {
        return format!("https://x.com/i/broadcasts/{id}");
    }
    if let Some(id) = extract_status_id(&u) {
        // Keep path if username present; else use i/status
        if u.contains("/status/") {
            return u;
        }
        return format!("https://x.com/i/status/{id}");
    }
    u
}

fn is_broadcast_id(s: &str) -> bool {
    let s = s.trim();
    if s.len() < 8 || s.len() > 32 {
        return false;
    }
    // X/Periscope broadcast ids often start with '1' and mix letters+digits.
    // Pure digit strings are status ids (handled separately).
    s.starts_with('1')
        && s.chars().any(|c| c.is_ascii_alphabetic())
        && s.chars().all(|c| c.is_ascii_alphanumeric())
}

fn extract_broadcast_id(url: &str) -> Option<String> {
    // …/i/broadcasts/ID or …/broadcasts/ID
    let markers = ["/i/broadcasts/", "/broadcasts/"];
    for m in markers {
        if let Some(i) = url.find(m) {
            let rest = &url[i + m.len()..];
            let id: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric())
                .collect();
            if is_broadcast_id(&id) {
                return Some(id);
            }
        }
    }
    None
}

fn extract_status_id(url: &str) -> Option<String> {
    if let Some(i) = url.find("/status/") {
        let rest = &url[i + "/status/".len()..];
        let id: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if id.len() >= 10 {
            return Some(id);
        }
    }
    None
}

/// True when this page URL should use X-friendly yt-dlp format selection.
pub fn is_x_page_url(url: &str) -> bool {
    is_x_locator(url)
}

/// Format strings for yt-dlp `-g` on X/Twitter (try in order).
pub fn x_stream_format_candidates() -> &'static [&'static str] {
    &[
        // Prefer progressive / HLS under 720p with audio when available.
        "b[height<=720]/best[height<=720]/bv*[height<=720]+ba/b",
        "http-*:hls-* / b / best",
        "b/best/bv*+ba/b",
    ]
}

// ---------------------------------------------------------------------------
// Go live (to x.com) — local HLS pipeline
// ---------------------------------------------------------------------------

/// Candidate roots for the X Media Studio HLS project.
pub fn hls_project_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(p) = std::env::var("X_HLS_ROOT") {
        let p = PathBuf::from(p.trim());
        if !p.as_os_str().is_empty() {
            roots.push(p);
        }
    }
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Projects/x-media-studio-hls"));
        roots.push(home.join("dev/x-media-studio-hls"));
        roots.push(home.join("x-media-studio-hls"));
    }
    roots
}

/// Resolve `go-live.sh` if installed.
pub fn find_go_live_script() -> Option<PathBuf> {
    for root in hls_project_roots() {
        let sh = root.join("bin/go-live.sh");
        if sh.is_file() {
            return Some(sh);
        }
    }
    None
}

/// Launch local HLS encoder + nginx for X Media Studio (detached worker).
///
/// Does **not** complete "Go Live" on X — user still creates a Producer source
/// with the public `.m3u8` URL. Returns a human status string.
pub fn launch_go_live_async() -> Result<String, String> {
    let script = find_go_live_script().ok_or_else(|| {
        "X go-live: missing pipeline. Clone/setup ~/Projects/x-media-studio-hls \
         (or set X_HLS_ROOT). See that repo README · studio.x.com/producer"
            .to_string()
    })?;
    let root = script
        .parent()
        .and_then(|p| p.parent())
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf();

    // Detach: don't inherit TTY; leave process group for clean kill later if needed.
    let mut cmd = Command::new("bash");
    cmd.arg(&script)
        .current_dir(&root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    cmd.spawn()
        .map_err(|e| format!("X go-live spawn failed: {e}"))?;

    let local = "http://127.0.0.1:8787/hls/stream.m3u8";
    Ok(format!(
        "X go-live · started {} · local {local} · tunnel: cd {} && ./bin/tunnel.sh · then studio.x.com/producer/sources HLS",
        script.display(),
        root.display()
    ))
}

/// Open X Media Studio Producer in the default browser (best-effort).
pub fn open_x_studio() -> Result<(), String> {
    let url = "https://studio.x.com/producer/sources";
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("open studio: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("xdg-open studio: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = url;
        Err("open X Studio: unsupported OS".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_x_urls() {
        assert!(is_x_locator("https://x.com/i/broadcasts/1ynJOZQeqXqGR"));
        assert!(is_x_locator("https://twitter.com/foo/status/1234567890123456789"));
        assert!(is_x_locator("x:1ynJOZQeqXqGR"));
        assert!(is_x_locator("https://video.pscp.tv/foo.m3u8"));
        assert!(!is_x_locator("https://www.youtube.com/watch?v=abc"));
    }

    #[test]
    fn hub_tokens() {
        assert!(is_x_hub_token("x"));
        assert!(is_x_hub_token("Twitter"));
        assert!(is_x_hub_token("xlive"));
        assert!(!is_x_hub_token("bloomberg"));
    }

    #[test]
    fn normalize_broadcast() {
        let u = normalize_x_url("https://twitter.com/i/broadcasts/1ynJOZQeqXqGR").unwrap();
        assert_eq!(u, "https://x.com/i/broadcasts/1ynJOZQeqXqGR");
        let u2 = normalize_x_url("1ynJOZQeqXqGR").unwrap();
        assert_eq!(u2, "https://x.com/i/broadcasts/1ynJOZQeqXqGR");
        let u3 = normalize_x_url("x:1ynJOZQeqXqGR").unwrap();
        assert_eq!(u3, "https://x.com/i/broadcasts/1ynJOZQeqXqGR");
    }

    #[test]
    fn normalize_status() {
        let u = normalize_x_url("https://x.com/elonmusk/status/1234567890123456789").unwrap();
        assert!(u.contains("/status/1234567890123456789"));
        let u2 = normalize_x_url("1234567890123456789").unwrap();
        assert_eq!(u2, "https://x.com/i/status/1234567890123456789");
    }

    #[test]
    fn go_live_tokens() {
        assert!(is_go_live_token("golive"));
        assert!(is_go_live_token("x-out"));
        assert!(is_go_live_token("uplink"));
        let (g, rest) = parse_go_live_args("golive bloomberg");
        assert!(g);
        assert_eq!(rest, "bloomberg");
    }
}
