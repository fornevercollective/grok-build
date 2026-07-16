//! Media resolve for Stream window — yt-dlp · blank · GY hub · ffplay · local HLS restream.
//! Mirrors serve.sh resolve path so native Lab (not only ./serve.sh) can play.
//! X broadcasts / Periscope m3u8 are CORS-hostile in WKWebView → restream same-origin.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const GY_HUB: &str = "http://127.0.0.1:9876";
const BLANK_URL: &str = "http://127.0.0.1:5173";

struct HlsJob {
    id: String,
    dir: PathBuf,
    child: Child,
    title: String,
    src: String,
}

fn hls_jobs() -> &'static Mutex<HashMap<String, HlsJob>> {
    static JOBS: OnceLock<Mutex<HashMap<String, HlsJob>>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn hls_root() -> PathBuf {
    std::env::temp_dir().join("grok-build-lab-hls")
}

/// Active stream feed — chat Stream pin pipes a low-res preview of this.
#[derive(Clone, Debug, Default)]
struct ActiveFeed {
    playing: bool,
    play: String,
    input: String,
    title: String,
    job_id: String,
    via: String,
    live: bool,
    quality: String,
    updated_ms: u64,
}

fn active_feed() -> &'static Mutex<ActiveFeed> {
    static FEED: OnceLock<Mutex<ActiveFeed>> = OnceLock::new();
    FEED.get_or_init(|| Mutex::new(ActiveFeed::default()))
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Publish what Stream window is playing (for pin preview pipe).
pub fn set_active_feed(
    play: &str,
    input: &str,
    title: &str,
    job_id: Option<&str>,
    via: &str,
    live: bool,
    quality: &str,
) {
    let mut g = active_feed().lock().unwrap_or_else(|e| e.into_inner());
    g.playing = !play.is_empty();
    g.play = play.to_string();
    g.input = input.to_string();
    g.title = title.to_string();
    g.job_id = job_id.unwrap_or("").to_string();
    g.via = via.to_string();
    g.live = live;
    g.quality = quality.to_string();
    g.updated_ms = now_ms();
}

pub fn clear_active_feed() {
    let mut g = active_feed().lock().unwrap_or_else(|e| e.into_inner());
    *g = ActiveFeed::default();
    g.updated_ms = now_ms();
}

pub fn get_active_feed() -> Value {
    let g = active_feed().lock().unwrap_or_else(|e| e.into_inner());
    json!({
        "ok": true,
        "playing": g.playing && !g.play.is_empty(),
        "play": g.play,
        "input": g.input,
        "title": g.title,
        "jobId": g.job_id,
        "via": g.via,
        "live": g.live,
        "quality": g.quality,
        "preview": "low-res pin pipe — same origin HLS when restreamed",
        "updated_ms": g.updated_ms,
        "streamKind": if g.play.contains(".m3u8") { "hls" } else { "progressive" },
    })
}

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
    // GrokYtalkY facility ingest — Continuity / UVC / multi-cam HDRI ladder
    // gy:device:0 → start hub ingest, return play HLS when ready (resolved later)
    if let Some(rest) = s
        .strip_prefix("gy:")
        .or_else(|| s.strip_prefix("GY:"))
        .or_else(|| s.strip_prefix("ingest:"))
    {
        let ref_src = rest.trim();
        if ref_src.is_empty() {
            return "device:0".into();
        }
        // Keep as gy:… for resolve path (prefer_gy + special-case)
        return format!("gy:{ref_src}");
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

/// Start GrokYtalkY facility ingest (Continuity / UVC / multi-cam) → browser HLS.
fn gy_ingest_start(src: &str) -> Result<Value, String> {
    if !(reachable(&format!("{GY_HUB}/")) || reachable(&format!("{GY_HUB}/api/lan"))) {
        return Err("gy hub not reachable — run: gy serve  (port 9876)".into());
    }
    let enc = urlencoding_lite(src);
    let out = Command::new("curl")
        .args([
            "-sS",
            &format!("{GY_HUB}/api/media/ingest/start?src={enc}"),
            "--max-time",
            "45",
        ])
        .output()
        .map_err(|e| e.to_string())?;
    let j: Value = serde_json::from_slice(&out.stdout).map_err(|e| format!("gy ingest json: {e}"))?;
    // Accept several response shapes from gy hub versions
    let mut play = j
        .get("play")
        .or_else(|| j.get("playRel"))
        .or_else(|| j.get("video"))
        .or_else(|| j.get("streamUrl"))
        .or_else(|| j.pointer("/job/play"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if play.is_empty() {
        if let Some(id) = j
            .get("id")
            .or_else(|| j.get("jobId"))
            .and_then(|v| v.as_str())
        {
            play = format!("{GY_HUB}/api/media/ingest/play/{id}/index.m3u8");
        }
    }
    if play.starts_with('/') {
        play = format!("{GY_HUB}{play}");
    }
    if play.is_empty() {
        return Err(j
            .get("error")
            .and_then(|e| e.as_str())
            .unwrap_or("gy ingest start returned no play URL")
            .to_string());
    }
    Ok(json!({
        "ok": true,
        "url": src,
        "video": play,
        "play": play,
        "title": format!("GY tether · {src}"),
        "live": true,
        "via": "gy-ingest",
        "streamKind": "hls",
        "gy_hub": GY_HUB,
        "input": src,
        "hint": "Continuity Camera: System Settings → Continuity · or USB UVC as device:N",
        "popout": format!("{GY_HUB}/burst.html?url={}", urlencoding_lite(src)),
    }))
}

fn gy_resolve(url: &str, quality: &str) -> Result<Value, String> {
    if !(reachable(&format!("{GY_HUB}/")) || reachable(&format!("{GY_HUB}/api/lan"))) {
        return Err("gy hub not reachable (gy serve on :9876)".into());
    }
    // gy:device:0 / gy:device:avfoundation:1 → facility ingest multi-stream path
    let ingest_src = url
        .strip_prefix("gy:")
        .or_else(|| url.strip_prefix("GY:"))
        .or_else(|| url.strip_prefix("ingest:"))
        .map(|s| s.trim().to_string());
    if let Some(src) = ingest_src {
        let src = if src.is_empty() {
            "device:0".into()
        } else if src.starts_with("device:")
            || src.starts_with("cam:")
            || src.starts_with("uvc:")
            || src.starts_with("ndi:")
            || src.starts_with("decklink:")
            || src.starts_with("stereo:")
            || src.starts_with("xr:")
        {
            src
        } else if src.chars().all(|c| c.is_ascii_digit()) {
            format!("device:{src}")
        } else {
            src
        };
        return gy_ingest_start(&src);
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
    resolve_opts(raw_url, quality, prefer_blank, prefer_gy, true)
}

pub fn resolve_opts(
    raw_url: &str,
    quality: &str,
    prefer_blank: bool,
    prefer_gy: bool,
    restream: bool,
) -> Value {
    let raw_in = raw_url.trim();
    let url = expand_input(raw_in);
    if url.is_empty() {
        return json!({"ok": false, "error": "missing url"});
    }

    let mut errors: Vec<String> = Vec::new();
    let mut result: Option<Value> = None;

    // GrokYtalkY tether / multi-cam / Continuity — always try GY hub ingest first
    let is_gy = url.to_ascii_lowercase().starts_with("gy:")
        || url.to_ascii_lowercase().starts_with("ingest:")
        || raw_in.to_ascii_lowercase().starts_with("gy:");
    if is_gy {
        match gy_resolve(&url, quality) {
            Ok(v) => return with_popouts(v, &url, raw_in),
            Err(e) => {
                errors.push(e.clone());
                // fall through to local device restream if gy:device:N
            }
        }
        if let Some(rest) = url
            .strip_prefix("gy:")
            .or_else(|| url.strip_prefix("GY:"))
            .or_else(|| raw_in.strip_prefix("gy:"))
        {
            let dev = rest.trim();
            let dev = if dev.is_empty() {
                "device:0".into()
            } else if dev.starts_with("device:") {
                dev.to_string()
            } else if dev.chars().all(|c| c.is_ascii_digit()) {
                format!("device:{dev}")
            } else {
                dev.to_string()
            };
            if dev.starts_with("device:") {
                match start_hls_restream(&dev, "tethered phone cam", true) {
                    Ok(v) => return with_popouts(v, &dev, raw_in),
                    Err(e2) => {
                        return json!({
                            "ok": false,
                            "error": format!("gy hub: {}; local: {e2}", errors.join("; ")),
                            "input": raw_in,
                            "hint": "gy serve · Continuity Camera as device · or ffmpeg device:0",
                        });
                    }
                }
            }
        }
    }

    // Local device cam always restreams
    let is_device = url.to_ascii_lowercase().starts_with("device:")
        || url.to_ascii_lowercase().starts_with("cam:")
        || url.to_ascii_lowercase().starts_with("uvc:");

    if is_device {
        match start_hls_restream(&url, "local camera", true) {
            Ok(v) => return with_popouts(v, &url, raw_in),
            Err(e) => {
                return json!({
                    "ok": false,
                    "error": e,
                    "input": raw_in,
                    "hint": "allow camera · brew install ffmpeg · Continuity Camera as device:N",
                });
            }
        }
    }

    if prefer_gy || is_gy {
        match gy_resolve(&url, quality) {
            Ok(v) => result = Some(v),
            Err(e) => errors.push(e),
        }
    }
    if result.is_none() && prefer_blank {
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
            }
            // CORS-safe same-origin HLS for X broadcasts / remote m3u8
            if restream {
                let play = v
                    .get("play")
                    .or_else(|| v.get("video"))
                    .and_then(|p| p.as_str())
                    .unwrap_or("")
                    .to_string();
                let title = v
                    .get("title")
                    .and_then(|t| t.as_str())
                    .unwrap_or("stream")
                    .to_string();
                let live = v.get("live").and_then(|l| l.as_bool()).unwrap_or(false);
                let needs = play.starts_with("http")
                    && (play.contains(".m3u8")
                        || play.contains("pscp.tv")
                        || play.contains("video.twimg")
                        || url.contains("broadcasts")
                        || url.contains("x.com")
                        || url.contains("twitter.com"));
                // Prefer copy-restream for HLS; skip if already same-origin
                let already_local = play.starts_with("/api/media/hls/");
                if needs && !already_local && !play.is_empty() {
                    match start_hls_restream(&play, &title, live) {
                        Ok(local) => {
                            if let Some(obj) = v.as_object_mut() {
                                if let Some(lp) =
                                    local.get("play").and_then(|p| p.as_str())
                                {
                                    obj.insert("raw".into(), json!(play));
                                    obj.insert("play".into(), json!(lp));
                                    obj.insert("video".into(), json!(lp));
                                    obj.insert("streamKind".into(), json!("hls"));
                                    obj.insert("via".into(), json!("yt-dlp+ffmpeg-hls"));
                                    obj.insert(
                                        "jobId".into(),
                                        local.get("jobId").cloned().unwrap_or(json!(null)),
                                    );
                                    obj.insert("restream".into(), json!(true));
                                }
                            }
                        }
                        Err(e) => {
                            if let Some(obj) = v.as_object_mut() {
                                obj.insert("restream_error".into(), json!(e));
                                obj.insert(
                                    "hint".into(),
                                    json!("restream failed — try Pop ffplay / Pop blank"),
                                );
                            }
                        }
                    }
                }
            }
            with_popouts(v, &url, raw_in)
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

fn with_popouts(mut v: Value, url: &str, raw_in: &str) -> Value {
    if let Some(obj) = v.as_object_mut() {
        obj.insert("resolved".into(), json!(url));
        obj.insert("input".into(), json!(raw_in));
        if !obj.contains_key("popout") {
            obj.insert(
                "popout".to_string(),
                json!(format!("ffplay · blank={BLANK_URL} · gy={GY_HUB}")),
            );
        }
        obj.insert(
            "popout_blank".to_string(),
            json!(format!("{BLANK_URL}/?url={}", urlencoding_lite(url))),
        );
        obj.insert(
            "popout_gy".to_string(),
            json!(format!(
                "{GY_HUB}/burst.html?url={}",
                urlencoding_lite(url)
            )),
        );
    }
    v
}

/// Remux remote HLS (or other ffmpeg input) to same-origin `/api/media/hls/{id}/index.m3u8`.
pub fn start_hls_restream(src: &str, title: &str, live: bool) -> Result<Value, String> {
    let ff = which("ffmpeg").ok_or_else(|| "ffmpeg not found — brew install ffmpeg".to_string())?;
    let job_id = format!(
        "{:x}{:x}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
            % 0xffff_ffff
    );
    let job_id: String = job_id.chars().take(12).collect();

    let out_dir = hls_root().join(&job_id);
    let _ = std::fs::create_dir_all(&out_dir);
    let index = out_dir.join("index.m3u8");
    let seg_pat = out_dir.join("seg_%03d.ts");
    let seg_s = seg_pat.to_string_lossy().to_string();
    let index_s = index.to_string_lossy().to_string();

    let low = src.to_ascii_lowercase();
    let is_device = low.starts_with("device:") || low.starts_with("cam:") || low.starts_with("uvc:");

    let mut args: Vec<String> = vec![
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-y".into(),
    ];
    if is_device {
        let ref_id = src.split(':').nth(1).unwrap_or("0").trim();
        #[cfg(target_os = "macos")]
        {
            args.extend([
                "-f".into(),
                "avfoundation".into(),
                "-framerate".into(),
                "30".into(),
                "-video_size".into(),
                "1280x720".into(),
                "-i".into(),
                format!("{ref_id}:none"),
            ]);
        }
        #[cfg(not(target_os = "macos"))]
        {
            args.extend([
                "-f".into(),
                "v4l2".into(),
                "-i".into(),
                format!("/dev/video{ref_id}"),
            ]);
        }
        // re-encode local cam
        args.extend([
            "-c:v".into(),
            "libx264".into(),
            "-preset".into(),
            "veryfast".into(),
            "-crf".into(),
            "22".into(),
            "-c:a".into(),
            "aac".into(),
            "-b:a".into(),
            "128k".into(),
        ]);
    } else {
        // Network HLS/MP4 (X broadcasts / Periscope): re-encode to stable local HLS.
        // Stream-copy often injects discontinuities that hls.js treats as fatal.
        args.extend([
            "-reconnect".into(),
            "1".into(),
            "-reconnect_streamed".into(),
            "1".into(),
            "-reconnect_delay_max".into(),
            "5".into(),
            "-i".into(),
            src.to_string(),
            "-map".into(),
            "0:v:0".into(),
            "-map".into(),
            "0:a:0?".into(),
            "-c:v".into(),
            "libx264".into(),
            "-preset".into(),
            "veryfast".into(),
            "-tune".into(),
            "zerolatency".into(),
            "-crf".into(),
            "23".into(),
            "-maxrate".into(),
            "5M".into(),
            "-bufsize".into(),
            "10M".into(),
            "-pix_fmt".into(),
            "yuv420p".into(),
            "-g".into(),
            "48".into(),
            "-c:a".into(),
            "aac".into(),
            "-b:a".into(),
            "128k".into(),
            "-ac".into(),
            "2".into(),
            "-ar".into(),
            "48000".into(),
        ]);
    }
    args.extend([
        "-f".into(),
        "hls".into(),
        "-hls_time".into(),
        "2".into(),
        "-hls_list_size".into(),
        if live { "8" } else { "0" }.into(), // VOD-style full list for replay broadcasts
        "-hls_flags".into(),
        if live {
            "delete_segments+append_list+independent_segments".into()
        } else {
            "append_list+independent_segments".into()
        },
        "-hls_segment_filename".into(),
        seg_s,
        index_s.clone(),
    ]);

    let child = Command::new(&ff)
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("ffmpeg spawn: {e}"))?;

    // Evict old jobs (keep ≤2)
    {
        let mut map = hls_jobs().lock().unwrap_or_else(|e| e.into_inner());
        while map.len() >= 2 {
            if let Some(k) = map.keys().next().cloned() {
                if let Some(mut old) = map.remove(&k) {
                    let _ = old.child.kill();
                    let _ = std::fs::remove_dir_all(&old.dir);
                }
            } else {
                break;
            }
        }
        map.insert(
            job_id.clone(),
            HlsJob {
                id: job_id.clone(),
                dir: out_dir.clone(),
                child,
                title: title.to_string(),
                src: src.to_string(),
            },
        );
    }

    // Wait for playlist
    let deadline = Instant::now() + Duration::from_secs(12);
    loop {
        if index.is_file() {
            if let Ok(meta) = std::fs::metadata(&index) {
                if meta.len() > 24 {
                    break;
                }
            }
        }
        // Check child alive
        {
            let mut map = hls_jobs().lock().unwrap_or_else(|e| e.into_inner());
            if let Some(job) = map.get_mut(&job_id) {
                if let Ok(Some(status)) = job.child.try_wait() {
                    let err = job
                        .child
                        .stderr
                        .as_mut()
                        .and_then(|s| {
                            use std::io::Read;
                            let mut buf = String::new();
                            let _ = s.read_to_string(&mut buf);
                            Some(buf)
                        })
                        .unwrap_or_default();
                    map.remove(&job_id);
                    let _ = std::fs::remove_dir_all(&out_dir);
                    return Err(format!(
                        "ffmpeg exited {:?} — {}",
                        status.code(),
                        err.chars().take(220).collect::<String>()
                    ));
                }
            }
        }
        if Instant::now() > deadline {
            stop_job(&job_id);
            return Err("HLS playlist not ready (timeout) — try Pop ffplay".into());
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    let play = format!("/api/media/hls/{job_id}/index.m3u8");
    Ok(json!({
        "ok": true,
        "jobId": job_id,
        "play": play,
        "video": play,
        "streamKind": "hls",
        "via": "ffmpeg-hls",
        "title": title,
        "live": live,
        "src": src,
    }))
}

pub fn stop_job(job_id: &str) -> bool {
    let mut map = hls_jobs().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut job) = map.remove(job_id) {
        let _ = job.child.kill();
        let _ = std::fs::remove_dir_all(&job.dir);
        true
    } else {
        false
    }
}

/// Read a file from an active HLS job directory (index.m3u8 / seg_NNN.ts).
pub fn hls_file(job_id: &str, file: &str) -> Result<(Vec<u8>, &'static str), String> {
    let safe: String = file
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect();
    if safe.is_empty() || safe.contains("..") {
        return Err("bad path".into());
    }
    let map = hls_jobs().lock().unwrap_or_else(|e| e.into_inner());
    let job = map.get(job_id).ok_or_else(|| "unknown HLS job".to_string())?;
    let path = job.dir.join(&safe);
    if !path.starts_with(&job.dir) {
        return Err("path escape".into());
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("read: {e}"))?;
    let ctype = if safe.ends_with(".m3u8") {
        "application/vnd.apple.mpegurl"
    } else if safe.ends_with(".ts") {
        "video/mp2t"
    } else {
        "application/octet-stream"
    };
    Ok((bytes, ctype))
}

#[allow(dead_code)]
fn path_exists(p: &Path) -> bool {
    p.exists()
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
    // Stop HLS restream jobs
    let ids: Vec<String> = {
        let map = hls_jobs().lock().unwrap_or_else(|e| e.into_inner());
        map.keys().cloned().collect()
    };
    for id in &ids {
        stop_job(id);
    }
    // Best-effort: stop ffplay leftovers
    let _ = Command::new("pkill").args(["-x", "ffplay"]).output();
    json!({ "ok": true, "stopped": true, "hls_jobs": ids.len() })
}
