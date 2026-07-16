//! Media resolve for Stream window — yt-dlp · blank · GY hub · ffplay.
//! Mirrors serve.sh resolve path so native Lab (not only ./serve.sh) can play.

use serde_json::{json, Value};
use std::process::Command;
use std::time::Duration;

const GY_HUB: &str = "http://127.0.0.1:9876";
const BLANK_URL: &str = "http://127.0.0.1:5173";

fn which(name: &str) -> Option<String> {
    Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}

fn reachable(url: &str) -> bool {
    // Best-effort TCP/HTTP probe without adding reqwest if we can use curl
    Command::new("curl")
        .args(["-sS", "-o", "/dev/null", "-w", "%{http_code}", "--connect-timeout", "0.4", "--max-time", "1.2", url])
        .output()
        .ok()
        .and_then(|o| {
            let code = String::from_utf8_lossy(&o.stdout).trim().to_string();
            code.parse::<u16>().ok()
        })
        .map(|c| (200..500).contains(&c))
        .unwrap_or(false)
}

pub fn tools_json() -> Value {
    let blank = reachable(&format!("{BLANK_URL}/"));
    let gy = reachable(&format!("{GY_HUB}/")) || reachable(&format!("{GY_HUB}/api/lan"));
    json!({
        "ok": true,
        "ytdlp": which("yt-dlp"),
        "ffmpeg": which("ffmpeg"),
        "ffplay": which("ffplay"),
        "blank": blank,
        "blank_url": if blank { Some(BLANK_URL) } else { None::<&str> },
        "gy_hub": gy,
        "gy_hub_url": if gy { Some(GY_HUB) } else { None::<&str> },
        "gy_bin": which("gy"),
        "native": true,
        "popout": true,
    })
}

/// Normalize @handle / x:name / device: into a resolvable URL.
pub fn expand_input(raw: &str) -> String {
    let s = raw.trim();
    if s.is_empty() {
        return String::new();
    }
    if s.to_ascii_lowercase().starts_with("device:")
        || s.to_ascii_lowercase().starts_with("cam:")
        || s.to_ascii_lowercase().starts_with("uvc:")
    {
        return s.to_string();
    }
    // x.com / twitter short forms first (SpaceXAI feed)
    if let Some(rest) = s.strip_prefix("x:@").or_else(|| s.strip_prefix("twitter:@")) {
        return format!("https://x.com/{}", rest.trim_start_matches('@'));
    }
    if let Some(rest) = s
        .strip_prefix("x:")
        .or_else(|| s.strip_prefix("twitter:"))
        .or_else(|| s.strip_prefix("X:"))
    {
        let h = rest.trim_start_matches('@');
        return format!("https://x.com/{h}");
    }
    // @handle → X first when known brand, else YouTube live (GY style)
    if s.starts_with('@') && !s.contains(' ') && !s.contains("://") {
        let h = &s[1..];
        let low = h.to_ascii_lowercase();
        if matches!(
            low.as_str(),
            "spacexai" | "xai" | "elonmusk" | "spacex" | "tesla"
        ) {
            return format!("https://x.com/{h}");
        }
        return format!("https://www.youtube.com/@{h}/live");
    }
    if let Some(rest) = s.strip_prefix("youtube:").or_else(|| s.strip_prefix("yt:")) {
        let h = rest.trim_start_matches('@');
        return format!("https://www.youtube.com/@{h}/live");
    }
    s.to_string()
}

fn ytdlp_fmt(quality: &str) -> &'static str {
    match quality.to_ascii_lowercase().as_str() {
        "best" | "max" | "source" => "bestvideo*+bestaudio/best/best",
        "720" | "720p" => "best[height<=720]/bv*[height<=720]+ba/b[height<=720]/best",
        "480" | "480p" => "best[height<=480]/bv*[height<=480]+ba/b[height<=480]/best",
        _ => "best[height<=1080]/bv*[height<=1080]+ba/b[height<=1080]/best",
    }
}

fn ytdlp_resolve(url: &str, quality: &str) -> Result<Value, String> {
    let bin = which("yt-dlp").ok_or_else(|| "yt-dlp not found — brew install yt-dlp".to_string())?;
    let fmt = ytdlp_fmt(quality);
    let out = Command::new(&bin)
        .args([
            "--no-playlist",
            "--no-warnings",
            "--socket-timeout",
            "15",
            "-f",
            fmt,
            "-g",
            "--",
            url,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!(
            "yt-dlp failed (rc {:?}) {} — try Pop blank / specific video URL",
            out.status.code(),
            err.chars().take(200).collect::<String>()
        ));
    }
    let lines: Vec<String> = String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    if lines.is_empty() {
        return Err("yt-dlp returned no URL".into());
    }
    let video = lines[0].clone();
    let audio = lines.get(1).cloned();
    let mut title = url.to_string();
    let mut live = false;
    if let Ok(meta) = Command::new(&bin)
        .args([
            "--no-playlist",
            "--no-warnings",
            "--print",
            "%(title)s",
            "--print",
            "%(is_live)s",
            "--",
            url,
        ])
        .output()
    {
        let mlines: Vec<_> = String::from_utf8_lossy(&meta.stdout)
            .lines()
            .map(|l| l.trim().to_string())
            .collect();
        if let Some(t) = mlines.first() {
            if !t.is_empty() {
                title = t.clone();
            }
        }
        if let Some(l) = mlines.get(1) {
            live = matches!(l.to_ascii_lowercase().as_str(), "1" | "true" | "yes");
        }
    }
    let kind = if video.contains(".m3u8") || video.contains("manifest") {
        "hls"
    } else {
        "progressive"
    };
    Ok(json!({
        "ok": true,
        "url": url,
        "video": video,
        "play": video,
        "audio": audio,
        "title": title,
        "live": live,
        "via": "yt-dlp",
        "streamKind": kind,
        "quality": quality,
        "raw": video,
    }))
}

fn blank_resolve(url: &str) -> Result<Value, String> {
    if !reachable(&format!("{BLANK_URL}/")) {
        return Err("blank not reachable (start GY blank on :5173)".into());
    }
    let body = serde_json::json!({ "url": url }).to_string();
    let out = Command::new("curl")
        .args([
            "-sS",
            "-X",
            "POST",
            &format!("{BLANK_URL}/api/ingest/resolve"),
            "-H",
            "Content-Type: application/json",
            "-d",
            &body,
            "--max-time",
            "95",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    let j: Value = serde_json::from_slice(&out.stdout).map_err(|e| format!("blank json: {e}"))?;
    let stream = j
        .get("streamUrl")
        .or_else(|| j.get("video"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let play_path = j
        .get("playPath")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut play = stream.clone();
    if !play_path.is_empty() {
        play = if play_path.starts_with("http") {
            play_path
        } else {
            format!("{BLANK_URL}{play_path}")
        };
    }
    if play.is_empty() && stream.is_empty() {
        return Err(j
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("blank resolve empty")
            .to_string());
    }
    let play = if play.is_empty() { stream.clone() } else { play };
    let kind = j
        .get("streamKind")
        .and_then(|v| v.as_str())
        .unwrap_or(if play.contains(".m3u8") {
            "hls"
        } else {
            "progressive"
        });
    Ok(json!({
        "ok": true,
        "url": url,
        "video": play,
        "play": play,
        "title": j.get("title").and_then(|t| t.as_str()).unwrap_or(url),
        "live": j.get("live").and_then(|l| l.as_bool()).unwrap_or(kind == "hls"),
        "via": "blank",
        "streamKind": kind,
        "raw": stream,
        "blank": BLANK_URL,
        "popout": format!("{BLANK_URL}/?url={}", urlencoding_lite(url)),
    }))
}

fn gy_resolve(url: &str, quality: &str) -> Result<Value, String> {
    if !(reachable(&format!("{GY_HUB}/")) || reachable(&format!("{GY_HUB}/api/lan"))) {
        return Err("gy hub not reachable (gy serve on :9876)".into());
    }
    let hq = if matches!(quality, "1080" | "best" | "max") {
        "best"
    } else {
        quality
    };
    let enc = urlencoding_lite(url);
    let out = Command::new("curl")
        .args([
            "-sS",
            &format!("{GY_HUB}/api/media/resolve?url={enc}&quality={hq}"),
            "--max-time",
            "100",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    let j: Value = serde_json::from_slice(&out.stdout).map_err(|e| format!("gy json: {e}"))?;
    if j.get("ok") == Some(&Value::Bool(false)) && j.get("video").is_none() {
        return Err(j
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("gy hub resolve failed")
            .to_string());
    }
    let mut video = j
        .get("video")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if video.starts_with('/') {
        video = format!("{GY_HUB}{video}");
    }
    if video.is_empty() {
        return Err("gy hub empty video".into());
    }
    Ok(json!({
        "ok": true,
        "url": url,
        "video": video,
        "play": video,
        "title": j.get("title").and_then(|t| t.as_str()).unwrap_or(url),
        "live": j.get("live").and_then(|l| l.as_bool()).unwrap_or(false),
        "via": j.get("via").and_then(|v| v.as_str()).unwrap_or("gy-hub"),
        "streamKind": j.get("streamKind").and_then(|v| v.as_str()).unwrap_or(
            if video.contains(".m3u8") { "hls" } else { "progressive" }
        ),
        "gy_hub": GY_HUB,
        "popout": format!("{GY_HUB}/burst.html?url={}", urlencoding_lite(url)),
    }))
}

fn urlencoding_lite(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

pub fn resolve(
    raw_url: &str,
    quality: &str,
    prefer_blank: bool,
    prefer_gy: bool,
) -> Value {
    let raw_in = raw_url.trim();
    let url = expand_input(raw_in);
    if url.is_empty() {
        return json!({"ok": false, "error": "missing url"});
    }

    let mut errors: Vec<String> = Vec::new();
    let mut result: Option<Value> = None;

    if prefer_gy {
        match gy_resolve(&url, quality) {
            Ok(v) => result = Some(v),
            Err(e) => errors.push(e),
        }
    }
    if result.is_none() && (prefer_blank || true) {
        match blank_resolve(&url) {
            Ok(v) => result = Some(v),
            Err(e) => errors.push(e),
        }
    }
    if result.is_none() {
        match ytdlp_resolve(&url, quality) {
            Ok(v) => result = Some(v),
            Err(e) => errors.push(e),
        }
    }

    match result {
        Some(mut v) => {
            if let Some(obj) = v.as_object_mut() {
                obj.insert("resolved".into(), json!(url));
                obj.insert("input".into(), json!(raw_in));
                // Always attach popout hints
                if !obj.contains_key("popout") {
                    obj.insert(
                        "popout".to_string(),
                        json!(format!(
                            "ffplay · blank={BLANK_URL} · gy={GY_HUB}"
                        )),
                    );
                }
                obj.insert(
                    "popout_blank".to_string(),
                    json!(format!("{BLANK_URL}/?url={}", urlencoding_lite(&url))),
                );
                obj.insert(
                    "popout_gy".to_string(),
                    json!(format!(
                        "{GY_HUB}/burst.html?url={}",
                        urlencoding_lite(&url)
                    )),
                );
            }
            v
        }
        None => json!({
            "ok": false,
            "error": errors.join("; "),
            "url": url,
            "input": raw_in,
            "tools": tools_json(),
            "hint": "Start blank (:5173) or gy hub (:9876), or brew install yt-dlp ffmpeg",
        }),
    }
}

pub fn ffplay(url: &str, quality: &str) -> Value {
    let bin = match which("ffplay") {
        Some(b) => b,
        None => {
            return json!({
                "ok": false,
                "error": "ffplay not found — brew install ffmpeg",
            });
        }
    };
    let expanded = expand_input(url);
    // Prefer direct stream URL via yt-dlp if possible
    let play = ytdlp_resolve(&expanded, quality)
        .ok()
        .and_then(|v| {
            v.get("video")
                .or_else(|| v.get("play"))
                .and_then(|p| p.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| expanded.clone());

    let child = Command::new(&bin)
        .args([
            "-autoexit",
            "-window_title",
            "Grok Build Lab · Stream",
            "-i",
            &play,
        ])
        .spawn();
    match child {
        Ok(c) => json!({
            "ok": true,
            "launched": true,
            "pid": c.id(),
            "via": "ffplay",
            "url": expanded,
            "play": play,
            "message": "ffplay pop-out launched",
        }),
        Err(e) => json!({"ok": false, "error": e.to_string()}),
    }
}

pub fn stop_all() -> Value {
    // Best-effort: stop ffplay / leftover ffmpeg lab jobs
    let _ = Command::new("pkill").args(["-f", "ffplay.*Grok Build Lab"]).output();
    json!({"ok": true, "stopped": true})
}

// Silence unused Duration import warning if we add timeouts later
#[allow(dead_code)]
fn _timeout_placeholder() -> Duration {
    Duration::from_secs(90)
}
