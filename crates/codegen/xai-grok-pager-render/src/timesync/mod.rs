//! `/timesync` — broadcast-quality world clock modal inside Grok.
//!
//! Feature id: **fc-timesync-v1** (fornevercollective)
//!
//! Paints into a ratatui popup that **re-layouts every frame** from the live
//! terminal size — same pattern as `/gy` / `/watch` — so stretching the Grok
//! window never leaves ghost glyphs (unlike a raw ANSI side terminal).
//!
//! Surfaces:
//!   · UTC / Zulu command time (USNO naval L0 reference)
//!   · Unix epoch + wall↔mono drift
//!   · L0–L3 time quality tiers (NTP stratum when `sntp` available)
//!   · Global equity sessions (approx RTH; weekends only)
//!   · Compact (≤80 cols) vs full market table / mil zones

use crate::render::safe_buf::SafeBuf;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;
use ratatui::widgets::{Block, BorderType, Borders, Clear, Widget};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Binary stamp / feature id (launchers, strings grep).
pub const FEATURE_ID: &str = "fc-timesync-v1";
pub const TOAST_OPEN: &str = "TIMESYNC · UTC/Zulu · markets · Esc close";

const TAI_UTC_LEAP: i64 = 37;
const GPS_UTC_OFFSET: i64 = 18;

// ---------------------------------------------------------------------------
// Epoch drift (GrokYtalkY clock.go class)
// ---------------------------------------------------------------------------

struct EpochDrift {
    wall0: i128,
    mono0: Instant,
}

impl EpochDrift {
    fn new() -> Self {
        Self {
            wall0: now_ns(),
            mono0: Instant::now(),
        }
    }

    fn reset(&mut self) {
        self.wall0 = now_ns();
        self.mono0 = Instant::now();
    }

    fn drift_ms(&self) -> f64 {
        let wall_d = now_ns() - self.wall0;
        let mono_d = self.mono0.elapsed().as_nanos() as i128;
        (wall_d - mono_d) as f64 / 1e6
    }
}

fn now_ns() -> i128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as i128)
        .unwrap_or(0)
}

fn now_unix_f() -> f64 {
    now_ns() as f64 / 1e9
}

// ---------------------------------------------------------------------------
// NTP sample (optional sntp)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Default)]
struct NtpSample {
    ok: bool,
    peer: String,
    offset_ms: Option<f64>,
    stratum: Option<u32>,
    refid: String,
    error: String,
    at: Option<Instant>,
}

static NTP_CACHE: OnceLock<Mutex<NtpSample>> = OnceLock::new();

fn ntp_cache() -> &'static Mutex<NtpSample> {
    NTP_CACHE.get_or_init(|| Mutex::new(NtpSample::default()))
}

fn sample_ntp(force: bool) -> NtpSample {
    let mut guard = ntp_cache().lock().unwrap_or_else(|e| e.into_inner());
    if !force
        && let Some(at) = guard.at
        && at.elapsed() < Duration::from_secs(8)
    {
        return guard.clone();
    }

    let peer = std::env::var("TIMESYNC_NTP_PEER").unwrap_or_else(|_| "time.apple.com".into());
    let mut sample = NtpSample {
        peer: peer.clone(),
        at: Some(Instant::now()),
        ..Default::default()
    };

    let Ok(out) = Command::new("sntp").args(["-d", &peer]).output() else {
        sample.error = "sntp missing".into();
        *guard = sample.clone();
        return sample;
    };
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );

    // offset: … (0.127…)
    if let Some(cap) = regex_first(r"offset:\s+\S+\s+\(([-+0-9.eE]+)\)", &text) {
        if let Ok(v) = cap.parse::<f64>() {
            sample.offset_ms = Some(v * 1000.0);
            sample.ok = true;
        }
    }
    if let Some(cap) = regex_first(r"stratum:\s+(\d+)", &text) {
        sample.stratum = cap.parse().ok();
    }
    if let Some(cap) = regex_first(r#"ref:\s+\S+\s+\("?([^"\n)]+)"?\)"#, &text) {
        sample.refid = cap.trim().to_string();
    }
    if !sample.ok {
        if let Some(cap) = regex_first(r"([-+]?[0-9.]+)\s*\+/-\s*[0-9.]+\s*seconds", &text) {
            if let Ok(v) = cap.parse::<f64>() {
                sample.offset_ms = Some(v * 1000.0);
                sample.ok = true;
            }
        }
    }
    if !sample.ok {
        sample.error = "ntp parse failed".into();
    }
    *guard = sample.clone();
    sample
}

fn regex_first(pat: &str, hay: &str) -> Option<String> {
    // Tiny ad-hoc extractors — avoid pulling regex crate API surface here.
    // Patterns used are simple enough for manual scans.
    match pat {
        r"offset:\s+\S+\s+\(([-+0-9.eE]+)\)" => {
            let key = "offset:";
            let i = hay.find(key)?;
            let rest = &hay[i + key.len()..];
            let open = rest.find('(')?;
            let close = rest[open + 1..].find(')')?;
            Some(rest[open + 1..open + 1 + close].to_string())
        }
        r"stratum:\s+(\d+)" => {
            let key = "stratum:";
            let i = hay.find(key)?;
            let rest = hay[i + key.len()..].trim_start();
            let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if digits.is_empty() {
                None
            } else {
                Some(digits)
            }
        }
        r#"ref:\s+\S+\s+\("?([^"\n)]+)"?\)"# => {
            let key = "ref:";
            let i = hay.find(key)?;
            let rest = &hay[i + key.len()..];
            let open = rest.find('(')?;
            let mut s = rest[open + 1..].trim_start_matches('"');
            if let Some(end) = s.find(|c| c == ')' || c == '"') {
                s = &s[..end];
            }
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
        r"([-+]?[0-9.]+)\s*\+/-\s*[0-9.]+\s*seconds" => {
            let key = "+/-";
            let i = hay.find(key)?;
            let before = hay[..i].trim_end();
            let tok = before.split_whitespace().last()?;
            Some(tok.to_string())
        }
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
struct TierInfo {
    level: u8,
    label: &'static str,
    note: String,
}

fn classify_tier(ntp: &NtpSample, drift_ms: f64) -> TierInfo {
    let off = ntp.offset_ms.map(|m| m.abs()).unwrap_or(99_000.0);
    let mut info = if ntp.ok {
        match ntp.stratum {
            Some(s) if s <= 1 && off < 250.0 => TierInfo {
                level: 1,
                label: if off < 5.0 {
                    "L1 LOCKED"
                } else {
                    "L1 TRACEABLE"
                },
                note: format!(
                    "NTP stratum-1 · public path offset {off:.1}ms (not facility PTP) · L0=USNO Master Clock remote"
                ),
            },
            Some(s) if s <= 3 && off < 500.0 => TierInfo {
                level: 2,
                label: "L2 NETWORK",
                note: format!("NTP stratum-{s} · locked to upstream"),
            },
            Some(s) => TierInfo {
                level: 2,
                label: "L2 DEGRADED",
                note: format!("NTP offset large ({off:.0}ms) or stratum {s}"),
            },
            None => TierInfo {
                level: 2,
                label: "L2 NETWORK",
                note: "NTP ok · stratum unknown".into(),
            },
        }
    } else {
        TierInfo {
            level: 3,
            label: "L3 FREE-RUN",
            note: if ntp.error.is_empty() {
                "no NTP lock — wall clock only".into()
            } else {
                ntp.error.clone()
            },
        }
    };
    if drift_ms.abs() > 50.0 {
        info.note.push_str(&format!(" · wallΔ {drift_ms:+.1}ms"));
    }
    info
}

// ---------------------------------------------------------------------------
// Markets / cities (fixed summer offsets — July-friendly; no holiday cal)
// ---------------------------------------------------------------------------

#[derive(Clone, Copy)]
struct MarketDef {
    id: &'static str,
    label: &'static str,
    region: &'static str,
    /// UTC offset minutes (approx current seasonal).
    utc_off_min: i32,
    open_m: i32,
    close_m: i32,
    pre_m: Option<i32>,
    ah_m: Option<i32>,
}

// Northern summer offsets (EDT/CEST/etc.) — fine for broadcast HUD.
const MARKETS: &[MarketDef] = &[
    MarketDef {
        id: "nyse",
        label: "NYSE",
        region: "Americas",
        utc_off_min: -4 * 60,
        open_m: 9 * 60 + 30,
        close_m: 16 * 60,
        pre_m: Some(4 * 60),
        ah_m: Some(20 * 60),
    },
    MarketDef {
        id: "nasdaq",
        label: "NASDAQ",
        region: "Americas",
        utc_off_min: -4 * 60,
        open_m: 9 * 60 + 30,
        close_m: 16 * 60,
        pre_m: Some(4 * 60),
        ah_m: Some(20 * 60),
    },
    MarketDef {
        id: "cme",
        label: "CME",
        region: "Americas",
        utc_off_min: -5 * 60,
        open_m: 8 * 60 + 30,
        close_m: 15 * 60 + 15,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "tsx",
        label: "TSX",
        region: "Americas",
        utc_off_min: -4 * 60,
        open_m: 9 * 60 + 30,
        close_m: 16 * 60,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "bovespa",
        label: "B3",
        region: "Americas",
        utc_off_min: -3 * 60,
        open_m: 10 * 60,
        close_m: 17 * 60 + 55,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "lse",
        label: "LSE",
        region: "EMEA",
        utc_off_min: 60,
        open_m: 8 * 60,
        close_m: 16 * 60 + 30,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "xetra",
        label: "XETRA",
        region: "EMEA",
        utc_off_min: 2 * 60,
        open_m: 9 * 60,
        close_m: 17 * 60 + 30,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "euronext",
        label: "Euronext",
        region: "EMEA",
        utc_off_min: 2 * 60,
        open_m: 9 * 60,
        close_m: 17 * 60 + 30,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "six",
        label: "SIX",
        region: "EMEA",
        utc_off_min: 2 * 60,
        open_m: 9 * 60,
        close_m: 17 * 60 + 30,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "jse",
        label: "JSE",
        region: "EMEA",
        utc_off_min: 2 * 60,
        open_m: 9 * 60,
        close_m: 17 * 60,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "tse",
        label: "TSE",
        region: "APAC",
        utc_off_min: 9 * 60,
        open_m: 9 * 60,
        close_m: 15 * 60,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "hkex",
        label: "HKEX",
        region: "APAC",
        utc_off_min: 8 * 60,
        open_m: 9 * 60 + 30,
        close_m: 16 * 60,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "sse",
        label: "SSE",
        region: "APAC",
        utc_off_min: 8 * 60,
        open_m: 9 * 60 + 30,
        close_m: 15 * 60,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "sgx",
        label: "SGX",
        region: "APAC",
        utc_off_min: 8 * 60,
        open_m: 9 * 60,
        close_m: 17 * 60,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "asx",
        label: "ASX",
        region: "APAC",
        utc_off_min: 10 * 60,
        open_m: 10 * 60,
        close_m: 16 * 60,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "nse",
        label: "NSE",
        region: "APAC",
        utc_off_min: 5 * 60 + 30,
        open_m: 9 * 60 + 15,
        close_m: 15 * 60 + 30,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "krx",
        label: "KRX",
        region: "APAC",
        utc_off_min: 9 * 60,
        open_m: 9 * 60,
        close_m: 15 * 60 + 30,
        pre_m: None,
        ah_m: None,
    },
    MarketDef {
        id: "twse",
        label: "TWSE",
        region: "APAC",
        utc_off_min: 8 * 60,
        open_m: 9 * 60,
        close_m: 13 * 60 + 30,
        pre_m: None,
        ah_m: None,
    },
];

const CITIES: &[(&str, i32, &str)] = &[
    ("UTC/Z", 0, "Z"),
    ("NYC", -4 * 60, "R"),
    ("CHI", -5 * 60, "S"),
    ("DEN", -6 * 60, "T"),
    ("LAX", -7 * 60, "U"),
    ("LON", 60, "Z/A"),
    ("PAR", 2 * 60, "A/B"),
    ("ZRH", 2 * 60, "A/B"),
    ("DXB", 4 * 60, "D"),
    ("DEL", 5 * 60 + 30, "E"),
    ("SIN", 8 * 60, "H"),
    ("HKG", 8 * 60, "H"),
    ("TYO", 9 * 60, "I"),
    ("SYD", 10 * 60, "K/L"),
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MktStatus {
    Open,
    Pre,
    Ah,
    Closed,
}

fn local_parts(unix: f64, off_min: i32) -> (i32, i32, i32, u32) {
    // returns h, m, s, weekday (0=Mon … 6=Sun) in local
    let secs = unix as i64 + (off_min as i64) * 60;
    let day_secs = ((secs % 86400) + 86400) % 86400;
    let h = (day_secs / 3600) as i32;
    let m = ((day_secs % 3600) / 60) as i32;
    let s = (day_secs % 60) as i32;
    // Unix epoch Thursday=4; we want Mon=0
    let days = secs.div_euclid(86400);
    // 1970-01-01 was Thursday → weekday 3 if Mon=0
    let wd = ((days + 3).rem_euclid(7)) as u32;
    (h, m, s, wd)
}

fn market_status(m: &MarketDef, unix: f64) -> (MktStatus, String) {
    let (h, mi, _, wd) = local_parts(unix, m.utc_off_min);
    let mins = h * 60 + mi;
    let local = format!("{h:02}:{mi:02}");
    if wd >= 5 {
        return (MktStatus::Closed, local);
    }
    if mins >= m.open_m && mins < m.close_m {
        return (MktStatus::Open, local);
    }
    if let Some(pre) = m.pre_m {
        if mins >= pre && mins < m.open_m {
            return (MktStatus::Pre, local);
        }
    }
    if let Some(ah) = m.ah_m {
        if mins >= m.close_m && mins < ah {
            return (MktStatus::Ah, local);
        }
    }
    (MktStatus::Closed, local)
}

fn status_glyph(s: MktStatus) -> char {
    match s {
        MktStatus::Open => '●',
        MktStatus::Pre => '◐',
        MktStatus::Ah => '◑',
        MktStatus::Closed => '○',
    }
}

fn status_color(s: MktStatus) -> Color {
    match s {
        MktStatus::Open => Color::Rgb(0, 255, 160),
        MktStatus::Pre => Color::Rgb(255, 190, 70),
        MktStatus::Ah => Color::Rgb(160, 140, 255),
        MktStatus::Closed => Color::Rgb(100, 105, 120),
    }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TimesyncKeyOutcome {
    Close,
    Changed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum LayoutMode {
    Auto,
    Compact,
    Full,
}

/// Modal state for `/timesync`.
pub struct TimesyncState {
    drift: EpochDrift,
    mode: LayoutMode,
    last_ntp: NtpSample,
    /// Force NTP refresh on next tick.
    want_ntp: bool,
    opened_at: Instant,
    /// Throttle NTP work — first sample at open.
    ntp_started: bool,
}

impl TimesyncState {
    pub fn open() -> Self {
        // Kick NTP early (blocking briefly is ok on open for first paint quality).
        let ntp = sample_ntp(true);
        Self {
            drift: EpochDrift::new(),
            mode: LayoutMode::Auto,
            last_ntp: ntp,
            want_ntp: false,
            opened_at: Instant::now(),
            ntp_started: true,
        }
    }

    pub fn tick(&mut self) -> bool {
        if self.want_ntp {
            self.last_ntp = sample_ntp(true);
            self.want_ntp = false;
            return true;
        }
        // Soft refresh every 8s
        if self
            .last_ntp
            .at
            .map(|t| t.elapsed() >= Duration::from_secs(8))
            .unwrap_or(true)
        {
            self.last_ntp = sample_ntp(false);
        }
        // Always redraw for live clock (~4 Hz via tick ceiling).
        true
    }

    pub fn handle_key(&mut self, key: &KeyEvent) -> TimesyncKeyOutcome {
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') | KeyCode::Char('Q') => TimesyncKeyOutcome::Close,
            KeyCode::Char('r') | KeyCode::Char('R') => {
                self.drift.reset();
                TimesyncKeyOutcome::Changed
            }
            KeyCode::Char('n') | KeyCode::Char('N') => {
                self.want_ntp = true;
                TimesyncKeyOutcome::Changed
            }
            KeyCode::Char('m') | KeyCode::Char('M') => {
                self.mode = match self.mode {
                    LayoutMode::Auto => LayoutMode::Compact,
                    LayoutMode::Compact => LayoutMode::Full,
                    LayoutMode::Full => LayoutMode::Auto,
                };
                TimesyncKeyOutcome::Changed
            }
            _ => TimesyncKeyOutcome::Changed,
        }
    }

    fn resolved_mode(&self, area: Rect) -> LayoutMode {
        match self.mode {
            LayoutMode::Auto => {
                if area.width >= 100 || area.height >= 28 {
                    LayoutMode::Full
                } else {
                    LayoutMode::Compact
                }
            }
            other => other,
        }
    }

    /// Paint chrome + body into agent overlay region. Recomputes layout from
    /// `area` every call — resize is free (ratatui Clear + fill).
    pub fn paint(&mut self, buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
        if area.width < 24 || area.height < 8 {
            return;
        }
        crate::render::color::dim_area(buf, area, bg, 0.5);

        let popup_w = ((area.width as u32 * 94) / 100)
            .max(30)
            .min(area.width as u32) as u16;
        let popup_h = ((area.height as u32 * 92) / 100)
            .max(10)
            .min(area.height as u32) as u16;
        let px = area.x + (area.width.saturating_sub(popup_w)) / 2;
        let py = area.y + (area.height.saturating_sub(popup_h)) / 2;
        let popup = Rect::new(px, py, popup_w, popup_h);

        // Critical for resize: wipe previous frame cells inside popup.
        Clear.render(popup, buf);
        buf.set_style(popup, Style::default().fg(fg).bg(bg));

        Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(dim).bg(bg))
            .style(Style::default().bg(bg))
            .render(popup, buf);

        let title = format!(" TIMESYNC · {FEATURE_ID} ");
        let tw = title.chars().count().min(popup.width as usize) as u16;
        let tx = popup.x + (popup.width.saturating_sub(tw)) / 2;
        buf.set_span_safe(
            tx,
            popup.y,
            &Span::styled(
                &title,
                Style::default()
                    .fg(fg)
                    .bg(bg)
                    .add_modifier(Modifier::BOLD),
            ),
            tw,
        );

        let inner = Rect::new(
            popup.x + 1,
            popup.y + 1,
            popup.width.saturating_sub(2),
            popup.height.saturating_sub(2),
        );
        if inner.width < 20 || inner.height < 4 {
            return;
        }

        // Fill inner solid so shrinking height leaves no ghosts.
        for y in inner.y..inner.y + inner.height {
            for x in inner.x..inner.x + inner.width {
                if let Some(cell) = buf.cell_mut((x, y)) {
                    cell.set_symbol(" ");
                    cell.set_style(Style::default().bg(bg).fg(fg));
                }
            }
        }

        let mode = self.resolved_mode(inner);
        let unix = now_unix_f();
        let drift = self.drift.drift_ms();
        let tier = classify_tier(&self.last_ntp, drift);
        let lines = self.build_lines(unix, drift, &tier, mode, inner.width as usize);

        let accent = Color::Rgb(0, 220, 255);
        let zulu_c = Color::Rgb(255, 230, 80);
        let good = Color::Rgb(80, 255, 140);
        let mute = dim;

        for (i, (text, kind)) in lines.iter().enumerate() {
            if i as u16 >= inner.height {
                break;
            }
            let y = inner.y + i as u16;
            let color = match kind {
                LineKind::Zulu => zulu_c,
                LineKind::Accent => accent,
                LineKind::Good => good,
                LineKind::Mute => mute,
                LineKind::Header => fg,
                LineKind::Market(s) => status_color(*s),
                LineKind::Normal => fg,
            };
            let style = if matches!(kind, LineKind::Zulu | LineKind::Header) {
                Style::default().fg(color).bg(bg).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(color).bg(bg)
            };
            let clipped: String = text.chars().take(inner.width as usize).collect();
            buf.set_span_safe(
                inner.x,
                y,
                &Span::styled(&clipped, style),
                inner.width,
            );
        }

        // Bottom status bar on border
        let bar = format!(
            " {} · Δ{:+.1}ms · m layout · r reset · n ntp · Esc ",
            tier.label, drift
        );
        let bar_y = popup.y + popup.height.saturating_sub(1);
        buf.set_span_safe(
            popup.x + 1,
            bar_y,
            &Span::styled(bar, Style::default().fg(mute).bg(bg)),
            popup.width.saturating_sub(2),
        );

        let _ = self.opened_at;
        let _ = self.ntp_started;
    }

    fn build_lines(
        &self,
        unix: f64,
        drift: f64,
        tier: &TierInfo,
        mode: LayoutMode,
        width: usize,
    ) -> Vec<(String, LineKind)> {
        let mut out = Vec::new();
        let (uh, um, us, _) = local_parts(unix, 0);
        let _zulu = format!("{uh:02}{um:02}{us:02}Z");
        let iso = format_iso_utc(unix);
        let unix_i = unix as i64;
        let ms = ((unix.fract()) * 1000.0).abs() as i64;

        out.push((
            format!("UTC/ZULU  {uh:02}:{um:02}:{us:02} Z   {iso}   {}", tier.label),
            LineKind::Zulu,
        ));
        out.push((
            format!(
                "unix {unix_i}.{ms:03}   Δ{drift:+.2}ms   TAI {}   GPS {}",
                unix_i + TAI_UTC_LEAP,
                unix_i + GPS_UTC_OFFSET
            ),
            LineKind::Accent,
        ));

        let ntp = &self.last_ntp;
        let off = ntp
            .offset_ms
            .map(|m| format!("{m:+.1}ms"))
            .unwrap_or_else(|| "n/a".into());
        let strat = ntp
            .stratum
            .map(|s| s.to_string())
            .unwrap_or_else(|| "—".into());
        let refid = if ntp.refid.is_empty() {
            String::new()
        } else {
            format!(" ({})", ntp.refid)
        };
        out.push((
            format!(
                "ntp {off}  stratum {strat}  {}{refid}   L0 USNO Master Clock (remote)",
                ntp.peer
            ),
            LineKind::Mute,
        ));
        out.push((tier.note.clone(), LineKind::Mute));
        out.push((
            "─".repeat(width.min(120)),
            LineKind::Mute,
        ));

        // Cities strip
        let mut row = String::new();
        for (name, off, mil) in CITIES {
            let (h, m, s, _) = local_parts(unix, *off);
            let cell = format!("{name:<5}{h:02}:{m:02}:{s:02}/{mil}  ");
            if row.chars().count() + cell.chars().count() > width && !row.is_empty() {
                out.push((row, LineKind::Normal));
                row = String::new();
            }
            row.push_str(&cell);
        }
        if !row.is_empty() {
            out.push((row, LineKind::Normal));
        }

        // Markets
        let mut open_n = 0;
        let mut pre_n = 0;
        let mut ah_n = 0;
        let mut mrows: Vec<(MktStatus, String)> = Vec::new();
        for m in MARKETS {
            let (st, local) = market_status(m, unix);
            match st {
                MktStatus::Open => open_n += 1,
                MktStatus::Pre => pre_n += 1,
                MktStatus::Ah => ah_n += 1,
                MktStatus::Closed => {}
            }
            let phase = match st {
                MktStatus::Open => "open",
                MktStatus::Pre => "pre",
                MktStatus::Ah => "AH",
                MktStatus::Closed => "closed",
            };
            mrows.push((
                st,
                format!(
                    "{} {:<8} {:<8} {:<6} {}",
                    status_glyph(st),
                    m.label,
                    m.region,
                    phase,
                    local
                ),
            ));
        }
        out.push((
            format!("MARKETS  ●{open_n} open  ◐{pre_n} pre  ◑{ah_n} AH  ○ closed"),
            LineKind::Header,
        ));

        match mode {
            LayoutMode::Compact | LayoutMode::Auto => {
                // dense grid
                let cell_w = 16usize;
                let per = (width / cell_w).max(1);
                let mut line = String::new();
                let mut count = 0;
                for m in MARKETS {
                    let (st, local) = market_status(m, unix);
                    let cell = format!("{}{:<7}{} ", status_glyph(st), m.label, local);
                    line.push_str(&cell);
                    count += 1;
                    if count >= per {
                        out.push((line, LineKind::Normal));
                        line = String::new();
                        count = 0;
                    }
                }
                if !line.is_empty() {
                    out.push((line, LineKind::Normal));
                }
            }
            LayoutMode::Full => {
                out.push((
                    format!("  {:<8} {:<8} {:<6} {}", "EXCH", "REGION", "STAT", "LOCAL"),
                    LineKind::Mute,
                ));
                for (st, row) in mrows {
                    out.push((format!("  {row}"), LineKind::Market(st)));
                }
                // mil zones
                out.push((
                    "NAVAL LETTER ZONES  Z=Zulu=UTC  (L0 command reference)".into(),
                    LineKind::Header,
                ));
                let mut mil = String::from("  ");
                let letters: &[(&str, i32)] = &[
                    ("Z", 0),
                    ("A", 1),
                    ("B", 2),
                    ("C", 3),
                    ("D", 4),
                    ("E", 5),
                    ("F", 6),
                    ("G", 7),
                    ("H", 8),
                    ("I", 9),
                    ("K", 10),
                    ("L", 11),
                    ("M", 12),
                    ("N", -1),
                    ("O", -2),
                    ("P", -3),
                    ("Q", -4),
                    ("R", -5),
                    ("S", -6),
                    ("T", -7),
                    ("U", -8),
                    ("V", -9),
                    ("W", -10),
                    ("X", -11),
                    ("Y", -12),
                ];
                for (letter, hoff) in letters {
                    let (h, m, _, _) = local_parts(unix, hoff * 60);
                    let piece = format!("{letter}{h:02}{m:02} ");
                    if mil.chars().count() + piece.chars().count() > width {
                        out.push((mil, LineKind::Mute));
                        mil = String::from("  ");
                    }
                    mil.push_str(&piece);
                }
                if mil.trim().len() > 0 {
                    out.push((mil, LineKind::Mute));
                }
            }
        }

        out.push((
            "maptrace/gboom pipe: ~/.panda/packs/timesync.jsonl  (standalone) · /timesync is in-Grok"
                .into(),
            LineKind::Mute,
        ));
        out
    }
}

#[derive(Clone, Copy, Debug)]
enum LineKind {
    Normal,
    Header,
    Zulu,
    Accent,
    Good,
    Mute,
    Market(MktStatus),
}

fn format_iso_utc(unix: f64) -> String {
    let secs = unix as i64;
    // days since epoch
    let days = secs.div_euclid(86400);
    let day_secs = secs.rem_euclid(86400);
    let h = day_secs / 3600;
    let m = (day_secs % 3600) / 60;
    let s = day_secs % 60;
    let (y, mo, d) = civil_from_days(days);
    let ms = ((unix.fract()) * 1000.0).abs() as i64;
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}.{ms:03}Z")
}

/// Howard Hinnant civil_from_days (UTC).
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feature_id_stable() {
        assert_eq!(FEATURE_ID, "fc-timesync-v1");
    }

    #[test]
    fn zulu_parts_reasonable() {
        let (h, m, s, _) = local_parts(0.0, 0);
        assert_eq!((h, m, s), (0, 0, 0));
    }

    #[test]
    fn open_does_not_panic() {
        let mut s = TimesyncState::open();
        let _ = s.tick();
        let key = KeyEvent::new(KeyCode::Char('m'), crossterm::event::KeyModifiers::NONE);
        let _ = s.handle_key(&key);
    }
}
