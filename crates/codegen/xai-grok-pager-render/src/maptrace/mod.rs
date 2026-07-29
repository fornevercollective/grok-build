//! `/map` — fornevercollective geospatial map modal inside Grok.
//!
//! Feature id: **fc-maptrace-v1**
//!
//! Same product class as `/watch` and `/timesync`:
//! - **In-Grok modal** (ratatui) reflows every paint — no stretch ghosts
//! - **Pop-out** first-class ability: external `maptrace` TUI / web / Terminal
//! - Optional **timesync JSONL** stamp (`~/.panda/packs/timesync.jsonl`)
//!
//! In-TTY map is a pure-Rust equirectangular ASCII canvas (no Node required).
//! Pop-out prefers the full `dev/maptrace` stack when available.

use crate::render::safe_buf::SafeBuf;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;
use ratatui::widgets::{Block, BorderType, Borders, Clear, Widget};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Binary stamp / feature id.
pub const FEATURE_ID: &str = "fc-maptrace-v1";
pub const FEATURE_LABEL: &str = "fornevercollective maptrace";
pub const TOAST_OPEN: &str =
    "MAP · fornevercollective maptrace · Esc close · o pop-out · t target";
pub const TOAST_POPOUT: &str =
    "MAP · pop-out → external maptrace (fc-maptrace-v1 · o · /map popout …)";

/// Default target when bare `/map`.
pub const DEFAULT_TARGET: &str = "1.1.1.1";

/// SpaceX Starbase (Boca Chica, TX) — place pin only, not a network path.
pub const STARBASE_LAT: f64 = 25.997;
pub const STARBASE_LON: f64 = -97.157;
/// Public network target when user asks for Starbase / SpaceX base Texas.
pub const STARBASE_NET_TARGET: &str = "spacex.com";

// ---------------------------------------------------------------------------
// Place aliases → network host (honest: CDN edge ≠ physical site)
// ---------------------------------------------------------------------------

/// Resolve free-text place / ops aliases to a traceroute host + optional place pin.
///
/// `/map` traces **network hosts**, not coordinates. Place names like `starbase`
/// pin **SBX** on the canvas and trace `spacex.com` (Cloudflare CDN — not Boca Chica).
pub fn resolve_map_target(raw: &str) -> ResolvedTarget {
    let t = raw.trim();
    if t.is_empty() {
        return ResolvedTarget {
            host: DEFAULT_TARGET.to_string(),
            place: None,
            honesty: None,
        };
    }
    let key = t.to_ascii_lowercase().replace('_', "-").replace(' ', "-");
    match key.as_str() {
        "starbase"
        | "sbx"
        | "boca"
        | "boca-chica"
        | "bocachica"
        | "spacex-base"
        | "spacex-texas"
        | "spacex-tx"
        | "base-texas"
        | "texas-base" => ResolvedTarget {
            host: STARBASE_NET_TARGET.to_string(),
            place: Some(PlacePin {
                name: "SBX",
                label: "Starbase / Boca Chica TX",
                lat: STARBASE_LAT,
                lon: STARBASE_LON,
                glyph: 'X',
            }),
            honesty: Some(
                "network path → spacex.com (Cloudflare CDN) · pin SBX is physical site only"
                    .into(),
            ),
        },
        "spacex" | "spacex.com" => ResolvedTarget {
            host: STARBASE_NET_TARGET.to_string(),
            place: Some(PlacePin {
                name: "SBX",
                label: "Starbase pin (CDN ≠ site)",
                lat: STARBASE_LAT,
                lon: STARBASE_LON,
                glyph: 'X',
            }),
            honesty: Some(
                "spacex.com = Cloudflare edge · SBX pin = Boca Chica (not on this hop path)"
                    .into(),
            ),
        },
        _ => ResolvedTarget {
            host: t.to_string(),
            place: None,
            honesty: None,
        },
    }
}

#[derive(Clone, Debug)]
pub struct PlacePin {
    pub name: &'static str,
    pub label: &'static str,
    pub lat: f64,
    pub lon: f64,
    pub glyph: char,
}

#[derive(Clone, Debug)]
pub struct ResolvedTarget {
    pub host: String,
    pub place: Option<PlacePin>,
    pub honesty: Option<String>,
}

// ---------------------------------------------------------------------------
// Pop-out arg parsing (mirrors live_demux::parse_watch_args)
// ---------------------------------------------------------------------------

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
            | "web"
            | "browser"
            | "window"
            | "tui"
            // à la carte original maptrace stack
            | "original"
            | "allacarte"
            | "a-la-carte"
            | "alacarte"
    )
}

/// Split `/map` args into `(popout, want_web, target)`.
pub fn parse_map_args(raw: &str) -> (bool, bool, String) {
    let mut popout = false;
    let mut web = false;
    let mut parts: Vec<&str> = Vec::new();
    for tok in raw.split_whitespace() {
        let lower = tok.to_ascii_lowercase();
        if is_popout_token(tok) {
            popout = true;
            if matches!(lower.as_str(), "web" | "browser") {
                web = true;
            }
        } else if matches!(lower.as_str(), "--web" | "-w") {
            popout = true;
            web = true;
        } else {
            parts.push(tok);
        }
    }
    (popout, web, parts.join(" "))
}

// ---------------------------------------------------------------------------
// Cities (shared ops wall with timesync)
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
struct City {
    name: &'static str,
    lat: f64,
    lon: f64,
    glyph: char,
}

const CITIES: &[City] = &[
    City { name: "UTC", lat: 0.0, lon: 0.0, glyph: 'Z' },
    City { name: "NYC", lat: 40.7, lon: -74.0, glyph: 'N' },
    City { name: "LAX", lat: 34.0, lon: -118.2, glyph: 'L' },
    City { name: "CHI", lat: 41.9, lon: -87.6, glyph: 'C' },
    City { name: "LON", lat: 51.5, lon: -0.1, glyph: '£' },
    City { name: "PAR", lat: 48.9, lon: 2.3, glyph: 'P' },
    City { name: "FRA", lat: 50.1, lon: 8.7, glyph: 'F' },
    City { name: "DXB", lat: 25.2, lon: 55.3, glyph: 'D' },
    City { name: "BOM", lat: 19.1, lon: 72.9, glyph: 'B' },
    City { name: "SIN", lat: 1.3, lon: 103.8, glyph: 'S' },
    City { name: "HKG", lat: 22.3, lon: 114.2, glyph: 'H' },
    City { name: "TYO", lat: 35.7, lon: 139.7, glyph: 'T' },
    City { name: "SYD", lat: -33.9, lon: 151.2, glyph: 'Y' },
    City { name: "SAO", lat: -23.5, lon: -46.6, glyph: 'A' },
    // SpaceX Starbase · Boca Chica TX (physical site pin — not a hop)
    City {
        name: "SBX",
        lat: STARBASE_LAT,
        lon: STARBASE_LON,
        glyph: 'X',
    },
];

// ---------------------------------------------------------------------------
// Simple land mask (coarse equirectangular continents)
// ---------------------------------------------------------------------------

/// Very coarse land test: rectangles approximating major landmasses.
fn is_land(lat: f64, lon: f64) -> bool {
    // Americas
    if lat > -55.0 && lat < 72.0 && lon > -168.0 && lon < -52.0 {
        // carve gulf/caribbean approx
        if lat > 15.0 && lat < 32.0 && lon > -100.0 && lon < -80.0 {
            return lat > 24.0 || lon < -95.0;
        }
        return true;
    }
    // Greenland
    if lat > 60.0 && lat < 84.0 && lon > -55.0 && lon < -15.0 {
        return true;
    }
    // Europe + Africa + W Asia
    if lat > -35.0 && lat < 72.0 && lon > -12.0 && lon < 60.0 {
        // Mediterranean carve (ocean strip)
        if lat > 33.0 && lat < 44.0 && lon > -5.0 && lon < 36.0 && lat < 36.0 {
            return lon < 5.0 || lon > 30.0;
        }
        return true;
    }
    // Asia
    if lat > 5.0 && lat < 75.0 && lon > 60.0 && lon < 145.0 {
        return true;
    }
    // SE Asia / Indonesia band
    if lat > -10.0 && lat < 20.0 && lon > 95.0 && lon < 140.0 {
        return true;
    }
    // Australia
    if lat > -44.0 && lat < -10.0 && lon > 112.0 && lon < 154.0 {
        return true;
    }
    // Antarctica strip
    if lat < -62.0 {
        return true;
    }
    false
}

fn project(lat: f64, lon: f64, w: usize, h: usize) -> (usize, usize) {
    let x = ((lon + 180.0) / 360.0 * w as f64).floor() as isize;
    let y = ((90.0 - lat) / 180.0 * h as f64).floor() as isize;
    (
        x.clamp(0, w.saturating_sub(1) as isize) as usize,
        y.clamp(0, h.saturating_sub(1) as isize) as usize,
    )
}

// ---------------------------------------------------------------------------
// Hops
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct Hop {
    pub n: u32,
    pub ip: String,
    pub rtt_ms: Option<f64>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub label: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum Phase {
    Idle,
    Tracing,
    Ready,
    Error(String),
}

// ---------------------------------------------------------------------------
// Timesync pipe stamp (optional)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Default)]
struct TimesyncStamp {
    zulu: String,
    unix_ms: u64,
    tier_label: String,
    age_ms: u64,
}

fn timesync_pipe_path() -> PathBuf {
    if let Ok(p) = std::env::var("TIMESYNC_PIPE")
        && !p.is_empty()
    {
        return PathBuf::from(p);
    }
    dirs_fallback_home()
        .join(".panda")
        .join("packs")
        .join("timesync.jsonl")
}

fn dirs_fallback_home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn read_timesync_stamp() -> Option<TimesyncStamp> {
    let path = timesync_pipe_path();
    let data = std::fs::read_to_string(&path).ok()?;
    let line = data.lines().rev().find(|l| !l.trim().is_empty())?;
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if v.get("schema").and_then(|s| s.as_str()) != Some("fc-timesync-v1") {
        // still accept if fields present
    }
    let zulu = v
        .get("zulu")
        .and_then(|x| x.as_str())
        .unwrap_or("?")
        .to_string();
    let unix_ms = v.get("unix_ms").and_then(|x| x.as_u64()).unwrap_or(0);
    let tier_label = v
        .get("tier_label")
        .and_then(|x| x.as_str())
        .unwrap_or("L?")
        .to_string();
    let age_ms = if unix_ms > 0 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        now.saturating_sub(unix_ms)
    } else {
        0
    };
    Some(TimesyncStamp {
        zulu,
        unix_ms,
        tier_label,
        age_ms,
    })
}

// ---------------------------------------------------------------------------
// Traceroute (best-effort local)
// ---------------------------------------------------------------------------

fn run_traceroute(target: &str) -> Result<Vec<Hop>, String> {
    // Prefer macOS/BSD traceroute -n; fall back to tracepath / traceroute.
    let candidates: &[(&str, &[&str])] = &[
        ("traceroute", &["-n", "-w", "1", "-q", "1", "-m", "18"]),
        ("traceroute", &["-n", "-m", "18"]),
        ("tracepath", &["-n"]),
    ];
    let mut last_err = "no traceroute binary".to_string();
    for (bin, args) in candidates {
        if !command_exists(bin) {
            continue;
        }
        let mut cmd = Command::new(bin);
        cmd.args(*args).arg(target);
        cmd.stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        xai_tty_utils::detach_std_command(&mut cmd);
        match cmd.output() {
            Ok(out) => {
                let text = format!(
                    "{}\n{}",
                    String::from_utf8_lossy(&out.stdout),
                    String::from_utf8_lossy(&out.stderr)
                );
                let hops = parse_traceroute_text(&text);
                if hops.is_empty() {
                    last_err = format!("{bin}: no hops parsed");
                    continue;
                }
                // Geo is applied by caller (place pin dest when known).
                return Ok(hops);
            }
            Err(e) => last_err = format!("{bin}: {e}"),
        }
    }
    Err(last_err)
}

fn command_exists(bin: &str) -> bool {
    Command::new("which")
        .arg(bin)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn parse_traceroute_text(text: &str) -> Vec<Hop> {
    let mut hops = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // " 1  192.168.1.1  1.2 ms  1.1 ms  1.0 ms"
        // " 2  * * *"
        let mut parts = line.split_whitespace();
        let Some(n_s) = parts.next() else { continue };
        let Ok(n) = n_s.trim_end_matches('.').parse::<u32>() else {
            continue;
        };
        let Some(tok) = parts.next() else { continue };
        if tok == "*" {
            hops.push(Hop {
                n,
                ip: "*".into(),
                rtt_ms: None,
                lat: None,
                lon: None,
                label: format!("hop {n} · *"),
            });
            continue;
        }
        // strip (hostname) forms — if next is IP in parens take that
        let ip = if tok.starts_with('(') {
            tok.trim_matches(|c| c == '(' || c == ')').to_string()
        } else {
            tok.to_string()
        };
        let mut rtt = None;
        for p in parts {
            if let Ok(v) = p.parse::<f64>() {
                rtt = Some(v);
                break;
            }
        }
        hops.push(Hop {
            n,
            ip: ip.clone(),
            rtt_ms: rtt,
            lat: None,
            lon: None,
            label: format!("hop {n} · {ip}"),
        });
    }
    hops
}

fn geolocate_approx(hops: &mut [Hop], dest: Option<(f64, f64)>) {
    let n = hops.len().max(1) as f64;
    // Default great-circle-ish from local-ish US toward TYO when dest unknown.
    let (lat0, lon0) = (40.7, -74.0);
    let (lat1, lon1) = dest.unwrap_or((35.7, 139.7));
    for (i, h) in hops.iter_mut().enumerate() {
        if h.ip == "*" || h.ip.starts_with("10.") || h.ip.starts_with("192.168.") {
            h.lat = Some(lat0 + (i as f64) * 0.05);
            h.lon = Some(lon0 + (i as f64) * 0.1);
            continue;
        }
        // Cloudflare / anycast-ish: cluster near west coast, not physical site.
        if h.ip.starts_with("104.18.")
            || h.ip.starts_with("104.16.")
            || h.ip.starts_with("172.64.")
            || h.ip.starts_with("108.162.")
        {
            h.lat = Some(37.4);
            h.lon = Some(-122.0);
            continue;
        }
        let t = (i as f64 + 1.0) / n;
        h.lat = Some(lat0 + (lat1 - lat0) * t);
        h.lon = Some(lon0 + (lon1 - lon0) * t);
    }
}

// ---------------------------------------------------------------------------
// Map binary / pop-out discovery
// ---------------------------------------------------------------------------

fn maptrace_bin() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("MAPTRACE_BIN")
        && !p.is_empty()
        && Path::new(&p).is_file()
    {
        return Some(PathBuf::from(p));
    }
    // which maptrace
    if let Ok(out) = Command::new("which").arg("maptrace").output()
        && out.status.success()
    {
        let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !p.is_empty() {
            return Some(PathBuf::from(p));
        }
    }
    // common dev path
    let home = dirs_fallback_home();
    for rel in [
        "dev/maptrace/bin/maptrace.js",
        "Projects/maptrace/bin/maptrace.js",
    ] {
        let p = home.join(rel);
        if p.is_file() {
            return Some(p);
        }
    }
    // sibling of this workspace when running from grok-build
    if let Ok(cwd) = std::env::current_dir() {
        let p = cwd
            .join("..")
            .join("..")
            .join("dev")
            .join("maptrace")
            .join("bin")
            .join("maptrace.js");
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

/// True when `maptrace` JS + native sqlite3 look loadable for **this** Node arch.
///
/// Hard-fails arm64 `.node` under x86_64 Node (common Rosetta mismatch).
pub fn maptrace_native_ok(bin: &Path) -> bool {
    // Only JS entry needs native probe.
    if bin.extension().and_then(|e| e.to_str()) != Some("js") {
        return true;
    }
    let root = bin
        .parent()
        .and_then(|p| p.parent()) // bin/ -> package root
        .unwrap_or(bin);
    let sqlite = root
        .join("node_modules")
        .join("sqlite3")
        .join("build")
        .join("Release")
        .join("node_sqlite3.node");
    if !sqlite.is_file() {
        // No prebuilt — still try; failure falls to traceroute.
        return true;
    }
    // `file` reports Mach-O arm64 / x86_64
    let Ok(out) = Command::new("file").arg(&sqlite).output() else {
        return true;
    };
    let info = String::from_utf8_lossy(&out.stdout).to_ascii_lowercase();
    let node_arch = std::env::consts::ARCH; // e.g. x86_64, aarch64
    let node_is_arm = matches!(node_arch, "aarch64" | "arm" | "arm64");
    let so_is_arm = info.contains("arm64") || info.contains("aarch64");
    let so_is_x64 = info.contains("x86_64") || info.contains("x86-64");
    if node_is_arm && so_is_x64 && !so_is_arm {
        return false;
    }
    if !node_is_arm && so_is_arm && !so_is_x64 {
        return false;
    }
    true
}

/// Spawn external maptrace (TUI or web). Detached from Grok process group.
/// On native-module arch mismatch or missing binary → **traceroute Terminal**.
pub fn launch_popout_async(target: &str, web: bool) -> String {
    let resolved = resolve_map_target(target);
    let host = resolved.host.clone();
    let mode = if web { "web" } else { "tui" };
    let host_c = host.clone();
    let _ = thread::Builder::new()
        .name("maptrace-popout".into())
        .spawn(move || {
            if let Err(e) = launch_popout_blocking(&host_c, web) {
                eprintln!("[maptrace pop-out] {e}");
            }
        });
    let note = resolved
        .honesty
        .as_deref()
        .unwrap_or("system traceroute if maptrace native fails");
    format!("pop-out · map · {mode} · {host} · {note}")
}

pub fn launch_popout_blocking(target: &str, web: bool) -> Result<String, String> {
    let resolved = resolve_map_target(target);
    let host = resolved.host.as_str();

    if let Some(bin) = maptrace_bin() {
        if maptrace_native_ok(&bin) {
            let mut cmd = if bin.extension().and_then(|e| e.to_str()) == Some("js") {
                let mut c = Command::new("node");
                c.arg(&bin);
                c
            } else {
                Command::new(&bin)
            };
            cmd.arg(host);
            if web {
                cmd.args(["--web", "--port", "3847"]);
            }
            // Capture stderr briefly is hard when detached — probe first via
            // short dry import when JS.
            if bin.extension().and_then(|e| e.to_str()) == Some("js") {
                if let Some(root) = bin.parent().and_then(|p| p.parent()) {
                    let probe = Command::new("node")
                        .args(["-e", "require('sqlite3')"])
                        .current_dir(root)
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::piped())
                        .output();
                    if let Ok(out) = probe {
                        if !out.status.success() {
                            let err = String::from_utf8_lossy(&out.stderr);
                            eprintln!(
                                "[maptrace pop-out] native module fail → traceroute fallback\n{err}"
                            );
                            return launch_terminal_fallback(host);
                        }
                    }
                }
            }
            cmd.stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            xai_tty_utils::detach_std_command(&mut cmd);
            match cmd.spawn() {
                Ok(child) => {
                    return Ok(format!(
                        "pop-out · maptrace pid {} · {host}",
                        child.id()
                    ));
                }
                Err(e) => {
                    eprintln!("[maptrace pop-out] spawn failed: {e} → traceroute");
                }
            }
        } else {
            eprintln!(
                "[maptrace pop-out] sqlite3 arch mismatch (Node {} vs native) → traceroute",
                std::env::consts::ARCH
            );
        }
    }

    launch_terminal_fallback(host)
}

fn launch_terminal_fallback(target: &str) -> Result<String, String> {
    // macOS: open a new Terminal window with traceroute (always works; no maptrace)
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Terminal\" to do script \"clear; echo 'MAP pop-out · traceroute fallback (maptrace native unavailable)'; echo 'target: {target}'; echo; traceroute -n -q 1 -m 18 {target}; echo; echo '[done] press enter'; read\""
        );
        let status = Command::new("osascript")
            .args(["-e", &script])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|e| format!("osascript: {e}"))?;
        if status.success() {
            return Ok(format!(
                "pop-out · Terminal traceroute · {target} (maptrace skipped — arch/native)"
            ));
        }
    }
    // non-macOS: run traceroute in background dumping to temp? just error with command.
    Err(format!(
        "maptrace unusable — run: traceroute -n -q 1 -m 18 {target}"
    ))
}

// ---------------------------------------------------------------------------
// Modal state
// ---------------------------------------------------------------------------

enum WorkerMsg {
    Hops(Vec<Hop>),
    Failed(String),
}

pub enum MapKeyOutcome {
    Close,
    Changed,
    Toast(String),
}

/// Modal state for `/map [target]`.
pub struct MapState {
    /// Network host actually traced.
    target: String,
    /// Optional physical place pin (e.g. SBX) — not a hop.
    place: Option<PlacePin>,
    honesty: Option<String>,
    hops: Vec<Hop>,
    phase: Phase,
    status: String,
    show_cities: bool,
    show_hops: bool,
    worker_rx: Option<std::sync::mpsc::Receiver<WorkerMsg>>,
    last_stamp: Option<TimesyncStamp>,
    last_stamp_at: Instant,
    opened_at: Instant,
    /// Target edit buffer when in "type target" mode (after `t`).
    editing: bool,
    edit_buf: String,
    tick_gen: u64,
}

impl MapState {
    pub fn open(target: &str) -> Self {
        let resolved = resolve_map_target(target);
        let mut status = "ready · t target · r re-trace · o pop-out".to_string();
        if let Some(ref h) = resolved.honesty {
            status = h.clone();
        }
        let mut s = Self {
            target: resolved.host.clone(),
            place: resolved.place,
            honesty: resolved.honesty,
            hops: Vec::new(),
            phase: Phase::Idle,
            status,
            show_cities: true,
            show_hops: true,
            worker_rx: None,
            last_stamp: read_timesync_stamp(),
            last_stamp_at: Instant::now(),
            opened_at: Instant::now(),
            editing: false,
            edit_buf: String::new(),
            tick_gen: 0,
        };
        s.start_trace();
        s
    }

    fn start_trace(&mut self) {
        self.phase = Phase::Tracing;
        let dest_note = self
            .place
            .as_ref()
            .map(|p| format!(" · pin {}", p.name))
            .unwrap_or_default();
        self.status = format!("tracing {}{dest_note}…", self.target);
        self.hops.clear();
        let (tx, rx) = std::sync::mpsc::channel();
        self.worker_rx = Some(rx);
        let target = self.target.clone();
        let dest = self.place.as_ref().map(|p| (p.lat, p.lon));
        let _ = thread::Builder::new()
            .name("maptrace-trace".into())
            .spawn(move || match run_traceroute(&target) {
                Ok(mut h) => {
                    geolocate_approx(&mut h, dest);
                    let _ = tx.send(WorkerMsg::Hops(h));
                }
                Err(e) => {
                    let _ = tx.send(WorkerMsg::Failed(e));
                }
            });
    }

    pub fn title(&self) -> String {
        let place = self
            .place
            .as_ref()
            .map(|p| format!(" · {}", p.name))
            .unwrap_or_default();
        match &self.phase {
            Phase::Tracing => format!("map · tracing {}{place}…", self.target),
            Phase::Error(e) => format!("map · error · {e}"),
            Phase::Ready | Phase::Idle => format!("map · {}{place}", self.target),
        }
    }

    pub fn status_line(&self) -> String {
        let stamp = self
            .last_stamp
            .as_ref()
            .map(|s| format!("Z{} · {} · {}ms", s.zulu, s.tier_label, s.age_ms))
            .unwrap_or_else(|| "timesync pipe quiet".into());
        let honesty = self.honesty.as_deref().unwrap_or("");
        if honesty.is_empty() {
            format!("{}  │  {stamp}", self.status)
        } else {
            format!("{}  │  {honesty}  │  {stamp}", self.status)
        }
    }

    pub fn tick(&mut self) -> bool {
        let mut dirty = false;
        self.tick_gen = self.tick_gen.wrapping_add(1);

        if self.last_stamp_at.elapsed() > Duration::from_secs(1) {
            self.last_stamp_at = Instant::now();
            let st = read_timesync_stamp();
            if st.is_some() {
                self.last_stamp = st;
                dirty = true;
            }
        }

        if let Some(rx) = self.worker_rx.as_ref() {
            match rx.try_recv() {
                Ok(WorkerMsg::Hops(h)) => {
                    let n = h.len();
                    self.hops = h;
                    self.phase = Phase::Ready;
                    self.status = format!("{} hops · {}", n, self.target);
                    self.worker_rx = None;
                    dirty = true;
                }
                Ok(WorkerMsg::Failed(e)) => {
                    self.phase = Phase::Error(e.clone());
                    self.status = e;
                    self.worker_rx = None;
                    dirty = true;
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {}
                Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                    self.worker_rx = None;
                    if self.phase == Phase::Tracing {
                        self.phase = Phase::Error("trace worker died".into());
                        dirty = true;
                    }
                }
            }
        }

        // pulse while tracing
        if self.phase == Phase::Tracing {
            dirty = true;
        }
        dirty
    }

    pub fn handle_key(&mut self, key: &KeyEvent) -> MapKeyOutcome {
        if self.editing {
            return self.handle_edit_key(key);
        }
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => MapKeyOutcome::Close,
            KeyCode::Char('o') | KeyCode::Char('O') => {
                let toast = launch_popout_async(&self.target, false);
                MapKeyOutcome::Toast(toast)
            }
            KeyCode::Char('w') | KeyCode::Char('W') => {
                let toast = launch_popout_async(&self.target, true);
                MapKeyOutcome::Toast(toast)
            }
            KeyCode::Char('r') | KeyCode::Char('R') => {
                self.start_trace();
                MapKeyOutcome::Changed
            }
            KeyCode::Char('t') | KeyCode::Char('T') => {
                self.editing = true;
                self.edit_buf = self.target.clone();
                self.status = format!("target> {}", self.edit_buf);
                MapKeyOutcome::Changed
            }
            KeyCode::Char('c') => {
                self.show_cities = !self.show_cities;
                MapKeyOutcome::Changed
            }
            KeyCode::Char('h') => {
                self.show_hops = !self.show_hops;
                MapKeyOutcome::Changed
            }
            _ => MapKeyOutcome::Changed,
        }
    }

    fn handle_edit_key(&mut self, key: &KeyEvent) -> MapKeyOutcome {
        match key.code {
            KeyCode::Esc => {
                self.editing = false;
                self.status = "edit cancelled".into();
                MapKeyOutcome::Changed
            }
            KeyCode::Enter => {
                self.editing = false;
                let t = self.edit_buf.trim().to_string();
                if !t.is_empty() {
                    let resolved = resolve_map_target(&t);
                    self.target = resolved.host;
                    self.place = resolved.place;
                    self.honesty = resolved.honesty.clone();
                    if let Some(h) = resolved.honesty {
                        self.status = h;
                    }
                    self.start_trace();
                }
                MapKeyOutcome::Changed
            }
            KeyCode::Backspace => {
                self.edit_buf.pop();
                self.status = format!("target> {}", self.edit_buf);
                MapKeyOutcome::Changed
            }
            KeyCode::Char(c) if !c.is_control() => {
                self.edit_buf.push(c);
                self.status = format!("target> {}", self.edit_buf);
                MapKeyOutcome::Changed
            }
            _ => MapKeyOutcome::Changed,
        }
    }

    /// Render ASCII map into string rows for the given cell size.
    fn render_map_rows(&self, w: usize, h: usize) -> Vec<String> {
        let w = w.max(16);
        let h = h.max(6);
        let mut grid: Vec<Vec<char>> = (0..h)
            .map(|y| {
                (0..w)
                    .map(|x| {
                        let lon = -180.0 + (x as f64 + 0.5) / w as f64 * 360.0;
                        let lat = 90.0 - (y as f64 + 0.5) / h as f64 * 180.0;
                        if is_land(lat, lon) {
                            '·'
                        } else {
                            ' '
                        }
                    })
                    .collect()
            })
            .collect();

        // equator + prime meridian
        let (_, eq_y) = project(0.0, 0.0, w, h);
        let (pm_x, _) = project(0.0, 0.0, w, h);
        for x in 0..w {
            if grid[eq_y][x] == ' ' {
                grid[eq_y][x] = '─';
            }
        }
        for y in 0..h {
            if grid[y][pm_x] == ' ' {
                grid[y][pm_x] = '│';
            } else if grid[y][pm_x] == '─' {
                grid[y][pm_x] = '┼';
            }
        }

        if self.show_cities {
            for c in CITIES {
                let (x, y) = project(c.lat, c.lon, w, h);
                grid[y][x] = c.glyph;
            }
        }

        // Place pin (e.g. SBX Starbase) — physical site, drawn above cities.
        if let Some(ref p) = self.place {
            let (x, y) = project(p.lat, p.lon, w, h);
            grid[y][x] = p.glyph;
        }

        if self.show_hops {
            for hop in &self.hops {
                if let (Some(lat), Some(lon)) = (hop.lat, hop.lon) {
                    let (x, y) = project(lat, lon, w, h);
                    let g = if hop.n < 10 {
                        char::from_digit(hop.n, 10).unwrap_or('*')
                    } else {
                        '*'
                    };
                    grid[y][x] = g;
                }
            }
        }

        // pulse marker while tracing
        if self.phase == Phase::Tracing {
            let t = self.opened_at.elapsed().as_secs_f64();
            let lon = -180.0 + ((t * 40.0) % 360.0);
            let (x, y) = project(20.0, lon, w, h);
            grid[y][x] = '◎';
        }

        grid.into_iter().map(|row| row.into_iter().collect()).collect()
    }
}

/// Render map modal chrome + canvas. Returns popup rect.
pub fn render_map_overlay(
    buf: &mut Buffer,
    area: Rect,
    state: &MapState,
    bg: Color,
    text_fg: Color,
    border_fg: Color,
) -> Option<Rect> {
    if area.height < 8 || area.width < 24 {
        return None;
    }

    crate::render::color::dim_area(buf, area, bg, 0.5);

    let popup_width = ((area.width as u32 * 92) / 100)
        .max(40)
        .min(area.width as u32) as u16;
    let popup_height = ((area.height as u32 * 92) / 100)
        .max(12)
        .min(area.height as u32) as u16;
    let popup_x = area.x + (area.width.saturating_sub(popup_width)) / 2;
    let popup_y = area.y + (area.height.saturating_sub(popup_height)) / 2;
    let popup_rect = Rect::new(popup_x, popup_y, popup_width, popup_height);

    Clear.render(popup_rect, buf);
    buf.set_style(popup_rect, Style::default().fg(text_fg).bg(bg));

    Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(border_fg).bg(bg))
        .style(Style::default().bg(bg))
        .render(popup_rect, buf);

    let title = format!(" {} ", state.title());
    let title_style = Style::default()
        .fg(text_fg)
        .bg(bg)
        .add_modifier(Modifier::BOLD);
    let tw = title.chars().count().min(popup_rect.width as usize) as u16;
    let tx = popup_rect.x + (popup_rect.width.saturating_sub(tw)) / 2;
    buf.set_span_safe(tx, popup_rect.y, &Span::styled(&title, title_style), tw);

    // Layout: map on top, hop list on bottom strip
    let inner_x = popup_rect.x + 1;
    let inner_y = popup_rect.y + 1;
    let inner_w = popup_rect.width.saturating_sub(2) as usize;
    let inner_h = popup_rect.height.saturating_sub(3) as usize; // title+status borders
    if inner_w < 8 || inner_h < 4 {
        return Some(popup_rect);
    }

    let hop_rows = (inner_h / 4).clamp(2, 8);
    let map_h = inner_h.saturating_sub(hop_rows).max(4);
    let rows = state.render_map_rows(inner_w, map_h);
    let land_style = Style::default().fg(Color::Rgb(120, 160, 120)).bg(bg);
    let water_style = Style::default().fg(Color::Rgb(40, 60, 90)).bg(bg);
    let mark_style = Style::default()
        .fg(Color::Rgb(255, 200, 80))
        .bg(bg)
        .add_modifier(Modifier::BOLD);
    let hop_style = Style::default()
        .fg(Color::Rgb(255, 120, 100))
        .bg(bg)
        .add_modifier(Modifier::BOLD);

    for (yi, row) in rows.iter().enumerate() {
        let y = inner_y + yi as u16;
        if y >= popup_rect.y + popup_rect.height - 2 {
            break;
        }
        // paint char by char for styles
        for (xi, ch) in row.chars().enumerate() {
            let x = inner_x + xi as u16;
            let style = if ch.is_ascii_digit() || ch == '*' || ch == '◎' {
                hop_style
            } else if matches!(
                ch,
                'N' | 'L' | 'C' | '£' | 'P' | 'F' | 'D' | 'B' | 'S' | 'H' | 'T' | 'Y' | 'A' | 'Z'
                    | 'X'
            ) {
                mark_style
            } else if ch == '·' {
                land_style
            } else {
                water_style
            };
            let s: String = ch.to_string();
            buf.set_span_safe(x, y, &Span::styled(s, style), 1);
        }
    }

    // Hop list
    let list_y0 = inner_y + map_h as u16;
    let list_style = Style::default().fg(text_fg).bg(bg);
    let mute = Style::default().fg(border_fg).bg(bg);
    buf.set_span_safe(
        inner_x,
        list_y0,
        &Span::styled(
            format!(
                "hops {} · cities {} · {FEATURE_ID}",
                if state.show_hops { "on" } else { "off" },
                if state.show_cities { "on" } else { "off" }
            ),
            mute,
        ),
        inner_w as u16,
    );
    let show: Vec<&Hop> = state.hops.iter().take(hop_rows.saturating_sub(1)).collect();
    for (i, hop) in show.iter().enumerate() {
        let y = list_y0 + 1 + i as u16;
        if y >= popup_rect.y + popup_rect.height - 1 {
            break;
        }
        let rtt = hop
            .rtt_ms
            .map(|v| format!("{v:.1}ms"))
            .unwrap_or_else(|| "—".into());
        let line = format!("{:>2}  {:<18}  {rtt}", hop.n, hop.ip);
        buf.set_span_safe(inner_x, y, &Span::styled(line, list_style), inner_w as u16);
    }
    if state.hops.is_empty() && state.phase == Phase::Tracing {
        buf.set_span_safe(
            inner_x,
            list_y0 + 1,
            &Span::styled("waiting for traceroute hops…", mute),
            inner_w as u16,
        );
    }

    // Status border
    let status = format!(" {} ", state.status_line());
    let bar_y = popup_rect.y + popup_rect.height.saturating_sub(1);
    buf.set_span_safe(
        popup_rect.x + 1,
        bar_y,
        &Span::styled(status, Style::default().fg(text_fg).bg(bg)),
        popup_rect.width.saturating_sub(2),
    );

    Some(popup_rect)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feature_id_stable() {
        assert_eq!(FEATURE_ID, "fc-maptrace-v1");
    }

    #[test]
    fn parse_popout() {
        let (p, w, t) = parse_map_args("popout 1.1.1.1");
        assert!(p);
        assert!(!w);
        assert_eq!(t, "1.1.1.1");
    }

    #[test]
    fn parse_web() {
        let (p, w, t) = parse_map_args("web example.com");
        assert!(p && w);
        assert_eq!(t, "example.com");
    }

    #[test]
    fn parse_plain() {
        let (p, _, t) = parse_map_args("cloudflare.com");
        assert!(!p);
        assert_eq!(t, "cloudflare.com");
    }

    #[test]
    fn land_mask_nyc() {
        assert!(is_land(40.7, -74.0));
        assert!(!is_land(0.0, -30.0)); // mid-Atlantic
    }

    #[test]
    fn open_starts_trace() {
        let s = MapState::open("127.0.0.1");
        assert_eq!(s.phase, Phase::Tracing);
    }

    #[test]
    fn starbase_alias_pins_sbx() {
        let r = resolve_map_target("starbase");
        assert_eq!(r.host, "spacex.com");
        assert!(r.place.is_some());
        assert_eq!(r.place.unwrap().name, "SBX");
        assert!(r.honesty.is_some());
    }

    #[test]
    fn boca_chica_alias() {
        let r = resolve_map_target("boca chica");
        assert_eq!(r.host, STARBASE_NET_TARGET);
    }

    #[test]
    fn map_rows_nonempty() {
        let s = MapState {
            target: "x".into(),
            place: Some(PlacePin {
                name: "SBX",
                label: "Starbase",
                lat: STARBASE_LAT,
                lon: STARBASE_LON,
                glyph: 'X',
            }),
            honesty: None,
            hops: vec![],
            phase: Phase::Ready,
            status: String::new(),
            show_cities: true,
            show_hops: true,
            worker_rx: None,
            last_stamp: None,
            last_stamp_at: Instant::now(),
            opened_at: Instant::now(),
            editing: false,
            edit_buf: String::new(),
            tick_gen: 0,
        };
        let rows = s.render_map_rows(40, 12);
        assert_eq!(rows.len(), 12);
        assert_eq!(rows[0].chars().count(), 40);
        // SBX glyph somewhere on canvas
        assert!(rows.iter().any(|r| r.contains('X')));
    }

    #[test]
    fn native_arch_probe_on_missing_file_ok() {
        assert!(maptrace_native_ok(Path::new("/no/such/maptrace.js")));
    }
}
