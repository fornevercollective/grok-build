//! `/webgrid` — offline webgrid-ugrad chase on TTY half-block.
//!
//! **fc-webgrid-tty-v1** · same BPS formula as Memory Glass `pwa/webgrid-ugrad.html`
//! (Neuralink public: log₂(N²−1) × NTPM/60). Lab instrument — not implant.
//!
//! Own slash command — **not** a `/watch` channel or `/gboom` mode.
//! Toolchain may open via `Action::OpenLiveWatch { url: "webgrid://agent" }`
//! or free-form `"webgrid human 16"` (parsed by [`is_webgrid_source`]).
//!
//! ```text
//! /webgrid                    TTY chase · agent ON · N=12 default
//! /webgrid agent              force agent
//! /webgrid human              human only (arrows + space/enter)
//! /webgrid 30                 N×N grid size (4–30)
//! /webgrid popout             open offline webgrid-ugrad in browser/MG
//! /webgrid drone | hud        drone HUD pop-out (multi-unit FPV · map · RTH)
//! o (in modal)                same pop-out (chase); drone via /webgrid drone
//! ```
//!
//! Keys (webgrid modal):
//!   arrows / hjkl  cursor · space/enter hit · a agent · r restart · o browser · Esc quit

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// Sentinel for resolve_watch_source / LiveWatchState.
pub const WEBGRID_URL: &str = "webgrid://ugrad";
pub const FEATURE_ID: &str = "fc-webgrid-tty-v1";
pub const TOAST_WEBGRID: &str =
    "WEBGRID · offline ugrad chase · half-block · o = browser (fc-webgrid-tty-v1)";

/// Default offline surface (paper/gamedev site :8790 · MG PWA often :8787).
/// Override: LIVE_DEMUX_WEBGRID_URL=http://127.0.0.1:8790/webgrid-ugrad.html
pub const DEFAULT_WEBGRID_PAGE: &str =
    "http://127.0.0.1:8790/webgrid-ugrad.html?gamedev=1&tick=sim&N=30&dur=20&auto=1";

/// Drone HUD control surface (multi-unit FPV mosaic · flight path · RTH · maint).
/// Override: LIVE_DEMUX_WEBGRID_DRONE_URL=…
pub const DEFAULT_WEBGRID_DRONE_PAGE: &str =
    "http://127.0.0.1:8790/webgrid-drone-hud.html?backend=sim&units=4&demo=rows&track=motion";

pub const TOAST_WEBGRID_DRONE: &str =
    "WEBGRID DRONE HUD · multi-unit FPV · map/RTH · maint · fc-webgrid-drone-hud-v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WebgridMode {
    /// Perfect agent auto-hits (sim / paint instrument).
    Agent,
    /// Human cursor only.
    Human,
}

impl WebgridMode {
    pub fn id(self) -> &'static str {
        match self {
            WebgridMode::Agent => "agent",
            WebgridMode::Human => "human",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            WebgridMode::Agent => "webgrid · perfect agent (sim)",
            WebgridMode::Human => "webgrid · human chase",
        }
    }
}

/// Slash / channel tokens for offline webgrid-ugrad.
pub fn is_webgrid_token(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "webgrid"
            | "webgrif"
            | "wg"
            | "ugrad-webgrid"
            | "webgrid-ugrad"
            | "webgridugrad"
            | "wg-ugrad"
            | "offline-webgrid"
            | "grid-chase"
            | "gridchase"
    )
}

/// True when input is a **toolchain / `/webgrid` open string** for LiveWatchState.
///
/// Accepts:
/// - `webgrid://agent` · `webgrid://human`
/// - `webgrid human 16` · `webgrid turbo` (slash command pass-through)
///
/// Does **not** treat bare alias-only tokens as a `/watch` channel — those
/// belong to the `/webgrid` slash (aliases: wg, grid-chase, …).
pub fn is_webgrid_source(input: &str) -> bool {
    let t = input.trim();
    if t.is_empty() {
        return false;
    }
    if t == WEBGRID_URL || t.starts_with("webgrid://") {
        return true;
    }
    let low = t.to_ascii_lowercase();
    // Explicit webgrid-prefixed free-form (from /webgrid command).
    if low == "webgrid" || low.starts_with("webgrid ") {
        return true;
    }
    false
}

/// Parse `/watch webgrid [agent|human] [N] [turbo]` → (mode, N, turbo, label).
pub fn parse_webgrid_args(input: &str) -> (WebgridMode, u32, bool, String) {
    let mut mode = WebgridMode::Agent;
    let mut n: u32 = env_n_default();
    let mut turbo = false;
    let mut notes: Vec<String> = Vec::new();
    for tok in input.split_whitespace() {
        let low = tok.to_ascii_lowercase();
        if is_webgrid_token(&low) || low.starts_with("webgrid://") {
            if let Some(rest) = low.strip_prefix("webgrid://") {
                match rest {
                    "human" | "play" | "manual" => mode = WebgridMode::Human,
                    "turbo" | "chip" => turbo = true,
                    _ => {}
                }
            }
            continue;
        }
        match low.as_str() {
            "agent" | "auto" | "sim" | "bot" => mode = WebgridMode::Agent,
            "human" | "play" | "manual" | "hand" => mode = WebgridMode::Human,
            "turbo" | "chip" | "fast" => turbo = true,
            "popout" | "out" | "external" | "ffplay" | "window" | "--popout" | "-o" => {}
            // drone HUD tokens are handled by slash popout launcher; ignore for TTY mode
            "drone" | "hud" | "drone-hud" | "fleet" | "mavlink" | "elrs" | "rth" | "map" => {
                notes.push(low);
            }
            other if other.parse::<u32>().is_ok() => {
                let v = other.parse::<u32>().unwrap_or(n);
                n = v.clamp(4, 30);
            }
            other => notes.push(other.to_string()),
        }
    }
    let label = if notes.is_empty() {
        format!("{} · {}×{}", mode.label(), n, n)
    } else {
        format!("{} · {}×{} · {}", mode.id(), n, n, notes.join(" "))
    };
    (mode, n, turbo, label)
}

pub fn webgrid_url(mode: WebgridMode) -> String {
    format!("webgrid://{}", mode.id())
}

fn env_n_default() -> u32 {
    std::env::var("LIVE_DEMUX_WEBGRID_N")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(12)
        .clamp(4, 30)
}

fn env_dur_ms() -> u64 {
    std::env::var("LIVE_DEMUX_WEBGRID_DUR")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(20)
        .saturating_mul(1000)
        .max(3000)
}

fn env_fps() -> f32 {
    std::env::var("LIVE_DEMUX_WEBGRID_FPS")
        .ok()
        .and_then(|s| s.parse::<f32>().ok())
        .unwrap_or(20.0)
        .clamp(4.0_f32, 60.0_f32)
}

/// Browser / MG page for pop-out (our offline build).
pub fn webgrid_page_url() -> String {
    std::env::var("LIVE_DEMUX_WEBGRID_URL").unwrap_or_else(|_| DEFAULT_WEBGRID_PAGE.into())
}

/// Browser / MG page for drone HUD pop-out.
pub fn webgrid_drone_page_url() -> String {
    std::env::var("LIVE_DEMUX_WEBGRID_DRONE_URL")
        .unwrap_or_else(|_| DEFAULT_WEBGRID_DRONE_PAGE.into())
}

/// True when args request the drone HUD surface (not chase board).
pub fn is_drone_hud_args(input: &str) -> bool {
    input.split_whitespace().any(|t| {
        matches!(
            t.to_ascii_lowercase().as_str(),
            "drone"
                | "hud"
                | "drone-hud"
                | "dronehud"
                | "fleet"
                | "mavlink"
                | "elrs"
                | "rth"
                | "map"
                | "flight"
        )
    })
}

// ── Game state (shared with paint thread + UI keys) ────────────────────

struct Trial {
    t_ms: f64,
    hit: bool,
}

struct GameInner {
    n: u32,
    target: i32,
    cursor: u32,
    hits: u64,
    misses: u64,
    trials: Vec<Trial>,
    peak_bps: f64,
    running: bool,
    agent: bool,
    turbo: bool,
    t0: Instant,
    duration_ms: u64,
    seed: u32,
    rng: u32,
    last_hit: i32,
    /// Status line fragment
    note: String,
}

struct SharedWg {
    width: u32,
    height: u32,
    rgb: Option<Vec<u8>>,
    generation: AtomicU64,
    game: GameInner,
    error: Option<String>,
}

fn mulberry32_next(state: &mut u32) -> f64 {
    *state = state.wrapping_add(0x6D2B_79F5);
    let mut t = *state;
    t = (t ^ (t >> 15)).wrapping_mul(t | 1);
    t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
    ((t ^ (t >> 14)) as f64) / 4294967296.0
}

/// Neuralink public BPS: log₂(N²−1) × NTPM/60
pub fn bps_from(n: u32, ntpm: f64) -> f64 {
    let cells = (n as f64) * (n as f64);
    if cells <= 1.0 {
        return 0.0;
    }
    ((cells - 1.0).ln() / std::f64::consts::LN_2) * (ntpm / 60.0).max(0.0)
}

fn ntpm_from_trials(trials: &[Trial], now_ms: f64) -> f64 {
    let cut = now_ms - 60_000.0;
    let mut n: i64 = 0;
    for tr in trials.iter().rev() {
        if tr.t_ms < cut {
            break;
        }
        n += if tr.hit { 1 } else { -1 };
    }
    n as f64
}

fn elapsed_s(g: &GameInner) -> f64 {
    if !g.running && g.hits == 0 && g.misses == 0 {
        return 0.0;
    }
    g.t0.elapsed().as_secs_f64()
}

fn spawn_target(g: &mut GameInner) {
    let cells = (g.n * g.n) as i32;
    if cells <= 1 {
        g.target = 0;
        return;
    }
    // Avoid same cell twice in a row when possible.
    for _ in 0..8 {
        let r = (mulberry32_next(&mut g.rng) * cells as f64).floor() as i32;
        let r = r.clamp(0, cells - 1);
        if r != g.last_hit || cells == 1 {
            g.target = r;
            return;
        }
    }
    g.target = (g.last_hit + 1).rem_euclid(cells);
}

fn click_cell(g: &mut GameInner, i: i32) -> bool {
    if !g.running || g.target < 0 {
        return false;
    }
    let now_ms = g.t0.elapsed().as_secs_f64() * 1000.0;
    let hit = i == g.target;
    g.trials.push(Trial { t_ms: now_ms, hit });
    // prune
    let cut = now_ms - 65_000.0;
    while g.trials.first().map(|t| t.t_ms < cut).unwrap_or(false) {
        g.trials.remove(0);
    }
    if hit {
        g.hits = g.hits.saturating_add(1);
        g.last_hit = i;
        spawn_target(g);
    } else {
        g.misses = g.misses.saturating_add(1);
    }
    let ntpm = if g.turbo && g.hits > 0 {
        let el = elapsed_s(g).max(0.0005);
        (g.hits as f64 / el) * 60.0
    } else {
        ntpm_from_trials(&g.trials, now_ms)
    };
    let bps = bps_from(g.n, ntpm);
    if bps > g.peak_bps {
        g.peak_bps = bps;
    }
    hit
}

fn score_line(g: &GameInner) -> String {
    let now_ms = g.t0.elapsed().as_secs_f64() * 1000.0;
    let el = elapsed_s(g);
    let ntpm = if g.turbo && g.hits > 0 {
        (g.hits as f64 / el.max(0.0005)) * 60.0
    } else {
        ntpm_from_trials(&g.trials, now_ms)
    };
    let bps = bps_from(g.n, ntpm);
    let hps = if el > 0.05 {
        g.hits as f64 / el
    } else {
        0.0
    };
    let left = if g.running {
        let used = g.t0.elapsed().as_millis() as u64;
        g.duration_ms.saturating_sub(used) as f64 / 1000.0
    } else {
        el
    };
    let mode = if g.agent { "agent" } else { "human" };
    let turbo = if g.turbo { " turbo" } else { "" };
    format!(
        "{:.1} BPS peak {:.1} · {} hit {} miss · {:.0} hps · {}×{} · {mode}{turbo} · {:.1}s · {}",
        bps,
        g.peak_bps,
        g.hits,
        g.misses,
        hps,
        g.n,
        g.n,
        left,
        g.note
    )
}

fn render_frame(g: &GameInner, w: u32, h: u32) -> Vec<u8> {
    let w = w.max(8) as usize;
    let h = h.max(8) as usize;
    let n = g.n.max(1) as usize;
    let mut rgb = vec![0u8; w * h * 3];
    // dark board
    for px in rgb.chunks_exact_mut(3) {
        px[0] = 8;
        px[1] = 10;
        px[2] = 14;
    }
    let cell_w = (w / n).max(1);
    let cell_h = (h / n).max(1);
    let ox = (w.saturating_sub(cell_w * n)) / 2;
    let oy = (h.saturating_sub(cell_h * n)) / 2;
    let tgt = g.target;
    let cur = g.cursor as i32;
    let last = g.last_hit;

    for gy in 0..n {
        for gx in 0..n {
            let idx = (gy * n + gx) as i32;
            let x0 = ox + gx * cell_w;
            let y0 = oy + gy * cell_h;
            // colors
            let (r, gr, b) = if idx == tgt {
                // Neuralink-ish blue target
                (40u8, 120, 255)
            } else if idx == last && last >= 0 {
                (28, 90, 48) // last hit green flash residue
            } else if (gx + gy) % 2 == 0 {
                (18, 20, 28)
            } else {
                (12, 14, 20)
            };
            let gap = 1usize;
            for cy in gap..(cell_h.saturating_sub(gap)) {
                for cx in gap..(cell_w.saturating_sub(gap)) {
                    let x = x0 + cx;
                    let y = y0 + cy;
                    if x < w && y < h {
                        let i = (y * w + x) * 3;
                        rgb[i] = r;
                        rgb[i + 1] = gr;
                        rgb[i + 2] = b;
                    }
                }
            }
            // cursor ring (human / agent focus)
            if idx == cur {
                let cr = 255u8;
                let cg = 220u8;
                let cb = 80u8;
                for t in 0..cell_w.max(cell_h) {
                    for &(dx, dy) in &[
                        (t, 0),
                        (t, cell_h.saturating_sub(1)),
                        (0, t),
                        (cell_w.saturating_sub(1), t),
                    ] {
                        let x = x0 + dx;
                        let y = y0 + dy;
                        if x < w && y < h && dx < cell_w && dy < cell_h {
                            let i = (y * w + x) * 3;
                            rgb[i] = cr;
                            rgb[i + 1] = cg;
                            rgb[i + 2] = cb;
                        }
                    }
                }
            }
        }
    }
    // top HUD strip (bps bar)
    let bar_h = (h / 18).max(2);
    let peak_frac = (g.peak_bps / 700.0).clamp(0.0, 1.0);
    let bar_w = ((w as f64) * peak_frac) as usize;
    for y in 0..bar_h {
        for x in 0..w {
            let i = (y * w + x) * 3;
            if x < bar_w {
                rgb[i] = 30;
                rgb[i + 1] = 200;
                rgb[i + 2] = 120;
            } else {
                rgb[i] = 20;
                rgb[i + 1] = 24;
                rgb[i + 2] = 32;
            }
        }
    }
    rgb
}

/// Background webgrid RGB feed for the watch stream pane.
pub struct WebgridFeed {
    shared: Arc<Mutex<SharedWg>>,
    stop: Arc<AtomicBool>,
    _join: Option<JoinHandle<()>>,
    mode: WebgridMode,
}

impl WebgridFeed {
    pub fn start(mode: WebgridMode, n: u32, turbo: bool, width: u32, height: u32) -> Self {
        let w = width.max(32) & !1;
        let h = height.max(32) & !1;
        let n = n.clamp(4, 30);
        let seed = std::env::var("LIVE_DEMUX_WEBGRID_SEED")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| {
                (Instant::now().elapsed().as_nanos() as u32)
                    ^ (std::process::id().wrapping_mul(0x9E37_79B9))
            });
        let mut game = GameInner {
            n,
            target: -1,
            cursor: 0,
            hits: 0,
            misses: 0,
            trials: Vec::new(),
            peak_bps: 0.0,
            running: true,
            agent: matches!(mode, WebgridMode::Agent),
            turbo,
            t0: Instant::now(),
            duration_ms: env_dur_ms(),
            seed,
            rng: seed | 1,
            last_hit: -1,
            note: "←↑↓→ hit · a agent · r restart · o browser".into(),
        };
        spawn_target(&mut game);
        let shared = Arc::new(Mutex::new(SharedWg {
            width: w,
            height: h,
            rgb: None,
            generation: AtomicU64::new(0),
            game,
            error: None,
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let shared_c = Arc::clone(&shared);
        let stop_c = Arc::clone(&stop);
        let fps = env_fps();
        let join = thread::Builder::new()
            .name("live-demux-webgrid".into())
            .spawn(move || {
                let period = Duration::from_secs_f32(1.0 / fps.max(1.0));
                while !stop_c.load(Ordering::Relaxed) {
                    if let Ok(mut g) = shared_c.lock() {
                        // end round
                        if g.game.running
                            && g.game.t0.elapsed().as_millis() as u64 >= g.game.duration_ms
                        {
                            g.game.running = false;
                            g.game.agent = false;
                            g.game.note = "round end · r restart · o browser".into();
                        }
                        // perfect agent step(s)
                        if g.game.running && g.game.agent {
                            let batch = if g.game.turbo {
                                // Uncap lab instrument — still paced by paint FPS.
                                256u32
                            } else {
                                1u32
                            };
                            for _ in 0..batch {
                                let t = g.game.target;
                                if t >= 0 {
                                    click_cell(&mut g.game, t);
                                    g.game.cursor = t as u32;
                                }
                            }
                        }
                        let frame = render_frame(&g.game, g.width, g.height);
                        g.rgb = Some(frame);
                        g.generation.fetch_add(1, Ordering::Relaxed);
                    }
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

    pub fn mode(&self) -> WebgridMode {
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

    pub fn hud_line(&self) -> String {
        self.shared
            .lock()
            .map(|g| score_line(&g.game))
            .unwrap_or_else(|_| "webgrid…".into())
    }

    pub fn take_error(&self) -> Option<String> {
        self.shared.lock().ok()?.error.take()
    }

    /// Move cursor by (dx, dy) on the N×N board.
    pub fn move_cursor(&self, dx: i32, dy: i32) {
        if let Ok(mut g) = self.shared.lock() {
            let n = g.game.n as i32;
            let cur = g.game.cursor as i32;
            let x = cur % n;
            let y = cur / n;
            let nx = (x + dx).rem_euclid(n);
            let ny = (y + dy).rem_euclid(n);
            g.game.cursor = (ny * n + nx) as u32;
        }
    }

    /// Hit cell under cursor (human).
    pub fn hit_cursor(&self) {
        if let Ok(mut g) = self.shared.lock() {
            if !g.game.running {
                return;
            }
            let i = g.game.cursor as i32;
            click_cell(&mut g.game, i);
        }
    }

    pub fn toggle_agent(&self) {
        if let Ok(mut g) = self.shared.lock() {
            g.game.agent = !g.game.agent;
            g.game.note = if g.game.agent {
                "agent ON · a off · o browser".into()
            } else {
                "human · arrows+space · a agent · r restart".into()
            };
        }
    }

    pub fn restart(&self) {
        if let Ok(mut g) = self.shared.lock() {
            g.game.hits = 0;
            g.game.misses = 0;
            g.game.trials.clear();
            g.game.peak_bps = 0.0;
            g.game.running = true;
            g.game.t0 = Instant::now();
            g.game.last_hit = -1;
            g.game.rng = g.game.seed.wrapping_add(1) | 1;
            spawn_target(&mut g.game);
            g.game.note = "restarted · chase".into();
        }
    }

    pub fn set_agent(&self, on: bool) {
        if let Ok(mut g) = self.shared.lock() {
            g.game.agent = on;
        }
    }
}

impl Drop for WebgridFeed {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

// ── Pop-out: open our offline webgrid-ugrad in browser / Memory Glass ──

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

fn ensure_site_and_url() -> String {
    ensure_site_and_url_for(false)
}

fn ensure_drone_site_and_url() -> String {
    ensure_site_and_url_for(true)
}

fn ensure_site_and_url_for(drone: bool) -> String {
    // Best-effort: copy latest PWA assets into paper site when present.
    if let Some(pwa) = find_pwa_dir() {
        sync_webgrid_assets(&pwa);
    }
    let url = if drone {
        webgrid_drone_page_url()
    } else {
        webgrid_page_url()
    };
    // Best-effort: if default :8790 dead, try :8787 pwa, then file://
    if url_reachable(&url) {
        return url;
    }
    let alt = if drone {
        "http://127.0.0.1:8787/webgrid-drone-hud.html?backend=sim&units=4&demo=rows&track=motion"
    } else {
        "http://127.0.0.1:8787/webgrid-ugrad.html?gamedev=1&tick=sim&N=30&dur=20&auto=1"
    };
    if url_reachable(alt) {
        return alt.to_string();
    }
    // Try start gamedev site in background
    if let Some(site) = find_pwa_dir() {
        let _ = Command::new("bash")
            .arg("-c")
            .arg(format!(
                "cd '{}' && python3 -m http.server 8790 >/dev/null 2>&1 &",
                site.display()
            ))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        thread::sleep(Duration::from_millis(350));
        if url_reachable(&url) {
            return url;
        }
    }
    url
}

fn sync_webgrid_assets(pwa: &PathBuf) {
    let site = std::env::var("MG_SITE")
        .map(PathBuf::from)
        .or_else(|_| {
            std::env::var("HOME").map(|h| PathBuf::from(h).join(".panda/vision/cast/paper/site"))
        })
        .ok();
    let Some(site) = site else { return };
    let _ = std::fs::create_dir_all(&site);
    for name in ["webgrid-ugrad.html", "webgrid-drone-hud.html"] {
        let src = pwa.join(name);
        if src.is_file() {
            let _ = std::fs::copy(&src, site.join(name));
        }
    }
}

fn url_reachable(url: &str) -> bool {
    // lightweight TCP-ish check via curl if present
    Command::new("curl")
        .args(["-sf", "-o", "/dev/null", "--connect-timeout", "1", url])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn find_pwa_dir() -> Option<PathBuf> {
    let mut cands = Vec::new();
    if let Ok(root) = std::env::var("FC_GROK_ROOT") {
        cands.push(PathBuf::from(&root).join("experiments/memory-glass/pwa"));
        cands.push(PathBuf::from(root).join("pwa"));
    }
    if let Ok(home) = std::env::var("HOME") {
        cands.push(
            PathBuf::from(&home).join(".panda/vision/cast/paper/site"),
        );
        cands.push(
            PathBuf::from(&home)
                .join("Projects/grok-build/experiments/memory-glass/pwa"),
        );
    }
    cands.push(PathBuf::from(
        "/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass/pwa",
    ));
    cands.into_iter().find(|p| {
        p.join("webgrid-ugrad.html").is_file()
            || p.join("webgrid-drone-hud.html").is_file()
            || p.is_dir()
    })
}

/// Open offline webgrid-ugrad in the OS browser (and try Memory Glass if present).
pub fn launch_webgrid_popout_blocking() -> Result<String, String> {
    launch_webgrid_popout_blocking_kind(false)
}

/// Open drone HUD control surface (multi-unit video · path · RTH · maint).
pub fn launch_webgrid_drone_popout_blocking() -> Result<String, String> {
    launch_webgrid_popout_blocking_kind(true)
}

fn launch_webgrid_popout_blocking_kind(drone: bool) -> Result<String, String> {
    let url = if drone {
        ensure_drone_site_and_url()
    } else {
        ensure_site_and_url()
    };
    open_url(&url);
    // Prefer Memory Glass when installed (WK race shell can take the URL).
    #[cfg(target_os = "macos")]
    {
        let mg = PathBuf::from(std::env::var("HOME").unwrap_or_default())
            .join("Applications/Memory Glass.app");
        if mg.is_dir() {
            let _ = Command::new("open")
                .args(["-a", "Memory Glass", &url])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
        }
    }
    let kind = if drone { "drone HUD" } else { "chase" };
    Ok(format!("webgrid {kind} pop-out · {url}"))
}

pub fn launch_webgrid_popout_async() -> String {
    launch_webgrid_popout_async_kind(false)
}

pub fn launch_webgrid_drone_popout_async() -> String {
    launch_webgrid_popout_async_kind(true)
}

/// Open drone HUD at an explicit URL (units/backend overrides from `/drone` args).
pub fn launch_webgrid_drone_popout_url_async(url: String) -> String {
    let toast_url = url.clone();
    thread::Builder::new()
        .name("webgrid-drone-popout".into())
        .spawn(move || {
            // Ensure assets/server, but navigate to the caller URL.
            let _ = ensure_drone_site_and_url();
            open_url(&url);
            #[cfg(target_os = "macos")]
            {
                let mg = PathBuf::from(std::env::var("HOME").unwrap_or_default())
                    .join("Applications/Memory Glass.app");
                if mg.is_dir() {
                    let _ = Command::new("open")
                        .args(["-a", "Memory Glass", &url])
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .spawn();
                }
            }
        })
        .ok();
    format!("{} · opening browser… · {toast_url}", TOAST_WEBGRID_DRONE)
}

fn launch_webgrid_popout_async_kind(drone: bool) -> String {
    let name = if drone {
        "webgrid-drone-popout"
    } else {
        "webgrid-popout"
    };
    thread::Builder::new()
        .name(name.into())
        .spawn(move || {
            if let Err(e) = launch_webgrid_popout_blocking_kind(drone) {
                eprintln!("[fc-webgrid] {e}");
            }
        })
        .ok();
    if drone {
        format!("{} · opening browser…", TOAST_WEBGRID_DRONE)
    } else {
        format!("{} · opening browser…", TOAST_WEBGRID)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bps_formula_30x30_at_3600_ntpm() {
        // 3600 NTPM → ~60 hits/s on sustained; BPS ≈ 9.81 * 60 ≈ 588.6
        let bps = bps_from(30, 3600.0);
        assert!(bps > 580.0 && bps < 600.0, "bps={bps}");
    }

    #[test]
    fn tokens_and_parse() {
        assert!(is_webgrid_token("webgrid"));
        assert!(is_webgrid_token("webgrif"));
        assert!(is_webgrid_source("webgrid human 16"));
        let (m, n, turbo, _) = parse_webgrid_args("webgrid human 16 turbo");
        assert_eq!(m, WebgridMode::Human);
        assert_eq!(n, 16);
        assert!(turbo);
        assert!(is_drone_hud_args("drone"));
        assert!(is_drone_hud_args("popout hud"));
        assert!(is_drone_hud_args("webgrid fleet rth"));
        assert!(!is_drone_hud_args("human 16 turbo"));
        assert!(webgrid_drone_page_url().contains("webgrid-drone-hud"));
    }

    #[test]
    fn feed_paints_frame() {
        let f = WebgridFeed::start(WebgridMode::Agent, 8, false, 64, 64);
        thread::sleep(Duration::from_millis(80));
        let (rgb, w, h) = f.snapshot_rgb().expect("frame");
        assert_eq!(rgb.len(), (w * h * 3) as usize);
        assert!(f.frame_generation() > 0);
    }
}
