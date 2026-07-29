//! # fornevercollective · GrokYtalkY TTY placeholders
//!
//! **Owner:** fornevercollective · **Feature id:** [`FEATURE_ID`]
//!
//! In-Grok Build **stub surfaces** that mirror GrokYtalkY companion concepts
//! (burst orb, waveform, chat rail, glyph pins, CLI tool map) without
//! reimplementing the GY mesh. Real multi-user / phone cast / hub still lives
//! in the separate `gy` binary (`fornevercollective/GrokYtalkY`).
//!
//! Paint path: half-block RGB + ratatui text chrome (same ladder as
//! [`crate::render::halfblock`]). Opened via `/gy [surface]`.

use std::f32::consts::TAU;
use std::time::Instant;

use crossterm::event::{KeyCode, KeyEvent};
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, BorderType, Borders, Paragraph, Widget};

use crate::render::halfblock::{self, HALF_BLOCK};
use crate::render::safe_buf::SafeBuf;

/// Stable feature id for logs / docs / support.
pub const FEATURE_ID: &str = "fc-gy-tty-placeholders";
/// Org credit.
pub const ORIGIN: &str = "fornevercollective";
/// Toast when panel opens.
pub const TOAST_OPEN: &str = "GY TTY · fornevercollective placeholders (mesh stays in `gy`)";

/// Catalog entry status.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SurfaceStatus {
    /// Shipped elsewhere in this fork (e.g. half-block gboom/video).
    Shipped,
    /// Interactive stub in this panel.
    Placeholder,
    /// Documented only — use external `gy` CLI.
    External,
}

/// Named surface (subcommand for `/gy`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Surface {
    Status,
    Burst,
    Wave,
    Chat,
    Pins,
    Tools,
    Stream,
    Help,
}

impl Surface {
    pub const ALL: &'static [Surface] = &[
        Surface::Status,
        Surface::Burst,
        Surface::Wave,
        Surface::Chat,
        Surface::Pins,
        Surface::Tools,
        Surface::Stream,
        Surface::Help,
    ];

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "" | "status" | "ls" | "list" => Some(Self::Status),
            "burst" | "orb" | "b" => Some(Self::Burst),
            "wave" | "waveform" | "w" => Some(Self::Wave),
            "chat" | "walkie" | "c" => Some(Self::Chat),
            "pins" | "pin" | "glyph" | "p" => Some(Self::Pins),
            "tools" | "cli" | "gy" => Some(Self::Tools),
            "stream" | "gyst" | "binary" => Some(Self::Stream),
            "help" | "?" | "h" => Some(Self::Help),
            _ => None,
        }
    }

    pub fn id(self) -> &'static str {
        match self {
            Self::Status => "status",
            Self::Burst => "burst",
            Self::Wave => "wave",
            Self::Chat => "chat",
            Self::Pins => "pins",
            Self::Tools => "tools",
            Self::Stream => "stream",
            Self::Help => "help",
        }
    }

    pub fn title(self) -> &'static str {
        match self {
            Self::Status => "GY · catalog",
            Self::Burst => "GY · burst orb",
            Self::Wave => "GY · waveform",
            Self::Chat => "GY · chat rail",
            Self::Pins => "GY · glyph pins",
            Self::Tools => "GY · terminal tools",
            Self::Stream => "GY · stream / .gyst",
            Self::Help => "GY · help",
        }
    }

    pub fn blurb(self) -> &'static str {
        match self {
            Self::Status => "Placeholder index + shipped half-block tier",
            Self::Burst => "Siri-sized PTT face orb (stub; mesh in gy burst)",
            Self::Wave => "Audio level / walkie waveform (stub)",
            Self::Chat => "Mesh walkie chat lines (stub; room stays in gy)",
            Self::Pins => "Multi-user pin rail (stub; gy pins-dock)",
            Self::Tools => "Map of `gy` CLI tools — shell out, not reimplemented",
            Self::Stream => "Binary .gyst / hexlum stream notes (stub)",
            Self::Help => "Keys + boundary rules",
        }
    }

    pub fn status(self) -> SurfaceStatus {
        match self {
            Self::Status | Self::Help => SurfaceStatus::Shipped,
            Self::Burst | Self::Wave | Self::Chat | Self::Pins | Self::Stream => {
                SurfaceStatus::Placeholder
            }
            Self::Tools => SurfaceStatus::External,
        }
    }

    pub fn status_label(self) -> &'static str {
        match self.status() {
            SurfaceStatus::Shipped => "shipped",
            SurfaceStatus::Placeholder => "placeholder",
            SurfaceStatus::External => "external gy",
        }
    }
}

/// Key outcome for the panel.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GyTtyKeyOutcome {
    Close,
    Changed,
}

/// Modal panel state — tickable half-block demos + text stubs.
pub struct GyTtyState {
    surface: Surface,
    t0: Instant,
    /// Phase time for animations (seconds).
    phase: f32,
    /// Mock chat scroll offset.
    chat_scroll: usize,
    /// Mock pin selection.
    pin_ix: usize,
}

impl GyTtyState {
    pub fn new(surface: Surface) -> Self {
        Self {
            surface,
            t0: Instant::now(),
            phase: 0.0,
            chat_scroll: 0,
            pin_ix: 0,
        }
    }

    pub fn surface(&self) -> Surface {
        self.surface
    }

    pub fn set_surface(&mut self, surface: Surface) {
        self.surface = surface;
        self.phase = 0.0;
    }

    /// Advance animations.
    pub fn tick(&mut self) {
        let now = Instant::now();
        let dt = now.duration_since(self.t0).as_secs_f32().min(0.1);
        self.t0 = now;
        self.phase += dt;
    }

    pub fn handle_key(&mut self, key: &KeyEvent) -> GyTtyKeyOutcome {
        if matches!(
            key.code,
            KeyCode::Esc | KeyCode::Char('q') | KeyCode::Char('Q')
        ) {
            return GyTtyKeyOutcome::Close;
        }
        // Tab / number keys cycle surfaces.
        match key.code {
            KeyCode::Tab | KeyCode::Right | KeyCode::Char(']') => {
                self.cycle(1);
            }
            KeyCode::BackTab | KeyCode::Left | KeyCode::Char('[') => {
                self.cycle(-1);
            }
            KeyCode::Char(c @ '1'..='8') => {
                let i = (c as u8 - b'1') as usize;
                if let Some(s) = Surface::ALL.get(i) {
                    self.set_surface(*s);
                }
            }
            KeyCode::Up | KeyCode::Char('k') => {
                if self.surface == Surface::Chat {
                    self.chat_scroll = self.chat_scroll.saturating_add(1);
                } else if self.surface == Surface::Pins {
                    self.pin_ix = self.pin_ix.saturating_sub(1);
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if self.surface == Surface::Chat {
                    self.chat_scroll = self.chat_scroll.saturating_sub(1);
                } else if self.surface == Surface::Pins {
                    self.pin_ix = (self.pin_ix + 1).min(MOCK_PINS.len().saturating_sub(1));
                }
            }
            KeyCode::Char(' ') | KeyCode::Enter => {
                // Placeholder PTT pulse — just bump phase for visual.
                self.phase += 0.35;
            }
            _ => {}
        }
        GyTtyKeyOutcome::Changed
    }

    fn cycle(&mut self, delta: i32) {
        let n = Surface::ALL.len() as i32;
        let cur = Surface::ALL
            .iter()
            .position(|s| *s == self.surface)
            .unwrap_or(0) as i32;
        let next = (cur + delta).rem_euclid(n) as usize;
        self.set_surface(Surface::ALL[next]);
    }

    /// Draw chrome + surface body into `area` (full agent overlay region).
    pub fn paint(&mut self, buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
        if area.width < 20 || area.height < 6 {
            return;
        }
        crate::render::color::dim_area(buf, area, bg, 0.45);

        let popup_w = ((area.width as u32 * 92) / 100)
            .max(24)
            .min(area.width as u32) as u16;
        let popup_h = ((area.height as u32 * 88) / 100)
            .max(8)
            .min(area.height as u32) as u16;
        let px = area.x + (area.width.saturating_sub(popup_w)) / 2;
        let py = area.y + (area.height.saturating_sub(popup_h)) / 2;
        let popup = Rect::new(px, py, popup_w, popup_h);

        ratatui::widgets::Clear.render(popup, buf);
        buf.set_style(popup, Style::default().fg(fg).bg(bg));

        Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(dim).bg(bg))
            .style(Style::default().bg(bg))
            .title(Span::styled(
                format!(" {} ", self.surface.title()),
                Style::default()
                    .fg(Color::Rgb(80, 200, 220))
                    .bg(bg)
                    .add_modifier(Modifier::BOLD),
            ))
            .title_bottom(Span::styled(
                format!(
                    " {} · tab cycle · 1-8 jump · space PTT · esc quit ",
                    self.surface.status_label()
                ),
                Style::default().fg(dim).bg(bg),
            ))
            .render(popup, buf);

        let inner = Rect::new(
            popup.x + 1,
            popup.y + 1,
            popup.width.saturating_sub(2),
            popup.height.saturating_sub(2),
        );
        if inner.width < 4 || inner.height < 2 {
            return;
        }

        // Pills row.
        self.paint_pills(buf, inner, bg, dim);
        let body = Rect::new(
            inner.x,
            inner.y + 1,
            inner.width,
            inner.height.saturating_sub(1),
        );

        match self.surface {
            Surface::Status => paint_status(buf, body, bg, fg, dim),
            Surface::Burst => self.paint_burst(buf, body, bg),
            Surface::Wave => self.paint_wave(buf, body, bg),
            Surface::Chat => self.paint_chat(buf, body, bg, fg, dim),
            Surface::Pins => self.paint_pins(buf, body, bg, fg, dim),
            Surface::Tools => paint_tools(buf, body, bg, fg, dim),
            Surface::Stream => paint_stream(buf, body, bg, fg, dim),
            Surface::Help => paint_help(buf, body, bg, fg, dim),
        }
    }

    fn paint_pills(&self, buf: &mut Buffer, area: Rect, bg: Color, dim: Color) {
        let y = area.y;
        let mut x = area.x;
        for (i, s) in Surface::ALL.iter().enumerate() {
            let label = format!(" {} ", s.id());
            let active = *s == self.surface;
            let style = if active {
                Style::default()
                    .fg(Color::Black)
                    .bg(Color::Rgb(80, 200, 220))
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(dim).bg(bg)
            };
            let w = label.chars().count() as u16;
            if x + w >= area.x + area.width {
                break;
            }
            buf.set_span_safe(x, y, &Span::styled(label, style), w);
            x = x.saturating_add(w + 1);
            let _ = i;
        }
    }

    fn paint_burst(&self, buf: &mut Buffer, area: Rect, bg: Color) {
        // Left: half-block orb. Right: caption.
        let mid = area.width / 2;
        let orb = Rect::new(area.x, area.y, mid.max(8), area.height);
        let side = Rect::new(
            area.x + mid,
            area.y,
            area.width.saturating_sub(mid),
            area.height,
        );
        paint_burst_orb_rgb(buf, orb, self.phase);
        let lines = vec![
            Line::from(Span::styled(
                "burst · placeholder",
                Style::default()
                    .fg(Color::Rgb(255, 180, 80))
                    .bg(bg)
                    .add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from(Span::styled(
                "Hold Space = PTT (visual only)",
                Style::default().fg(Color::Rgb(180, 180, 190)).bg(bg),
            )),
            Line::from(Span::styled(
                "Real TX: gy burst · mesh vburst-frame",
                Style::default().fg(Color::Rgb(120, 140, 160)).bg(bg),
            )),
            Line::from(Span::styled(
                "Glyph N: 13 / 25 / 37 / 49 (gy)",
                Style::default().fg(Color::Rgb(120, 140, 160)).bg(bg),
            )),
            Line::from(""),
            Line::from(Span::styled(
                format!("phase {:.1}s  ·  {}", self.phase, FEATURE_ID),
                Style::default().fg(Color::Rgb(90, 100, 110)).bg(bg),
            )),
        ];
        Paragraph::new(lines).render(side, buf);
    }

    fn paint_wave(&self, buf: &mut Buffer, area: Rect, bg: Color) {
        let wave_h = area.height.saturating_sub(3).max(2);
        let wave = Rect::new(area.x, area.y, area.width, wave_h);
        paint_waveform_rgb(buf, wave, self.phase);
        let foot = Rect::new(
            area.x,
            area.y + wave_h,
            area.width,
            area.height.saturating_sub(wave_h),
        );
        Paragraph::new(vec![
            Line::from(Span::styled(
                "waveform · placeholder  (pcm16 mesh in gy /duplex)",
                Style::default().fg(Color::Rgb(160, 220, 160)).bg(bg),
            )),
            Line::from(Span::styled(
                "space = pulse · real walkie audio stays in GrokYtalkY",
                Style::default().fg(Color::Rgb(110, 120, 130)).bg(bg),
            )),
        ])
        .render(foot, buf);
    }

    fn paint_chat(&self, buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
        let mut lines: Vec<Line> = vec![Line::from(Span::styled(
            "chat rail · placeholder  (room = gy serve / GY_ROOM)",
            Style::default().fg(Color::Rgb(200, 160, 255)).bg(bg),
        ))];
        lines.push(Line::from(""));
        let start = MOCK_CHAT
            .len()
            .saturating_sub(area.height as usize)
            .saturating_sub(self.chat_scroll);
        for (i, (nick, msg)) in MOCK_CHAT.iter().enumerate().skip(start) {
            if lines.len() as u16 >= area.height.saturating_sub(1) {
                break;
            }
            let _ = i;
            lines.push(Line::from(vec![
                Span::styled(
                    format!("{nick}: "),
                    Style::default()
                        .fg(Color::Rgb(80, 200, 220))
                        .bg(bg)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::styled(*msg, Style::default().fg(fg).bg(bg)),
            ]));
        }
        lines.push(Line::from(Span::styled(
            "› @peer …   [stub — use gy for mesh chat]",
            Style::default().fg(dim).bg(bg),
        )));
        Paragraph::new(lines).render(area, buf);
    }

    fn paint_pins(&self, buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
        // Top: half-block pin tiles. Bottom: roster text.
        let tile_h = (area.height / 2).clamp(3, 8);
        let tiles = Rect::new(area.x, area.y, area.width, tile_h);
        paint_pins_rgb(buf, tiles, self.pin_ix, self.phase);
        let body = Rect::new(
            area.x,
            area.y + tile_h,
            area.width,
            area.height.saturating_sub(tile_h),
        );
        let mut lines = vec![Line::from(Span::styled(
            "glyph pins · placeholder  (live rail: gy pins-dock / gy grok)",
            Style::default().fg(Color::Rgb(255, 200, 100)).bg(bg),
        ))];
        lines.push(Line::from(""));
        for (i, (nick, note)) in MOCK_PINS.iter().enumerate() {
            let mark = if i == self.pin_ix { "▸" } else { " " };
            let style = if i == self.pin_ix {
                Style::default()
                    .fg(Color::Rgb(255, 220, 120))
                    .bg(bg)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(fg).bg(bg)
            };
            lines.push(Line::from(Span::styled(
                format!("{mark} [{nick}]  {note}"),
                style,
            )));
        }
        lines.push(Line::from(Span::styled(
            "j/k select · real unread badges live in gy",
            Style::default().fg(dim).bg(bg),
        )));
        Paragraph::new(lines).render(body, buf);
    }
}

impl Default for GyTtyState {
    fn default() -> Self {
        Self::new(Surface::Status)
    }
}

// ── catalog text surfaces ────────────────────────────────────────────────

fn paint_status(buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
    let mut lines = vec![
        Line::from(Span::styled(
            format!("{ORIGIN} · {FEATURE_ID}"),
            Style::default()
                .fg(Color::Rgb(80, 200, 220))
                .bg(bg)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            "GrokYtalkY concepts inside Grok Build — stubs only",
            Style::default().fg(dim).bg(bg),
        )),
        Line::from(""),
    ];
    for s in Surface::ALL {
        lines.push(Line::from(vec![
            Span::styled(
                format!("  {:8} ", s.id()),
                Style::default()
                    .fg(Color::Rgb(80, 200, 220))
                    .bg(bg)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                format!("[{:11}] ", s.status_label()),
                Style::default().fg(status_color(s.status())).bg(bg),
            ),
            Span::styled(s.blurb(), Style::default().fg(fg).bg(bg)),
        ]));
    }
    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "Also shipped: /gboom + video half-block  (fc-halfblock-tty-video)",
        Style::default().fg(Color::Rgb(126, 200, 96)).bg(bg),
    )));
    lines.push(Line::from(Span::styled(
        "Boundary: mesh / phone / hub = external `gy` binary",
        Style::default().fg(dim).bg(bg),
    )));
    Paragraph::new(lines).render(area, buf);
}

fn paint_tools(buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
    let gy_path = which_gy();
    let mut lines = vec![
        Line::from(Span::styled(
            "terminal tools · external map",
            Style::default()
                .fg(Color::Rgb(255, 180, 80))
                .bg(bg)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            format!(
                "gy binary: {}",
                gy_path
                    .as_deref()
                    .unwrap_or("not on PATH — install GrokYtalkY")
            ),
            Style::default().fg(dim).bg(bg),
        )),
        Line::from(""),
    ];
    for (cmd, desc) in GY_TOOLS {
        lines.push(Line::from(vec![
            Span::styled(
                format!("  {cmd:22} "),
                Style::default()
                    .fg(Color::Rgb(80, 200, 220))
                    .bg(bg)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled(*desc, Style::default().fg(fg).bg(bg)),
        ]));
        if lines.len() as u16 >= area.height.saturating_sub(2) {
            break;
        }
    }
    lines.push(Line::from(Span::styled(
        "Grok does not reimplement mesh — shell these out or use gy grok stack",
        Style::default().fg(dim).bg(bg),
    )));
    Paragraph::new(lines).render(area, buf);
}

fn paint_stream(buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
    let lines = vec![
        Line::from(Span::styled(
            "stream / binary · placeholder",
            Style::default()
                .fg(Color::Rgb(180, 220, 255))
                .bg(bg)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "Formats (GrokYtalkY):",
            Style::default().fg(fg).bg(bg),
        )),
        Line::from(Span::styled(
            "  .gyst   GYST packets  rgb24 · pcm16 · jpeg · hexlum · meta",
            Style::default().fg(dim).bg(bg),
        )),
        Line::from(Span::styled(
            "  .gyhex  text hex lines",
            Style::default().fg(dim).bg(bg),
        )),
        Line::from(Span::styled(
            "  .pcap   Wireshark USER0 wrapping GYST",
            Style::default().fg(dim).bg(bg),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "CLI:  gy encode · gy decode · gy watch · gy stream-pub · gy colossus",
            Style::default().fg(Color::Rgb(80, 200, 220)).bg(bg),
        )),
        Line::from(Span::styled(
            "In-Grok today: half-block video modal + /gboom (no mesh required)",
            Style::default().fg(Color::Rgb(126, 200, 96)).bg(bg),
        )),
        Line::from(Span::styled(
            "Next: optional publish gboom/video frames → local hub type:gyst",
            Style::default().fg(dim).bg(bg),
        )),
    ];
    Paragraph::new(lines).render(area, buf);
}

fn paint_help(buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
    let lines = vec![
        Line::from(Span::styled(
            "help · GY TTY placeholders",
            Style::default()
                .fg(Color::Rgb(80, 200, 220))
                .bg(bg)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "  /gy              open catalog",
            Style::default().fg(fg).bg(bg),
        )),
        Line::from(Span::styled(
            "  /gy burst|wave|chat|pins|tools|stream|help",
            Style::default().fg(fg).bg(bg),
        )),
        Line::from(Span::styled(
            "  tab / [ ]        cycle surfaces",
            Style::default().fg(fg).bg(bg),
        )),
        Line::from(Span::styled(
            "  1–8              jump surface",
            Style::default().fg(fg).bg(bg),
        )),
        Line::from(Span::styled(
            "  space            mock PTT pulse",
            Style::default().fg(fg).bg(bg),
        )),
        Line::from(Span::styled(
            "  esc / q          close",
            Style::default().fg(fg).bg(bg),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "Boundary (lab rule): Grok agents do not reimplement the mesh.",
            Style::default().fg(dim).bg(bg),
        )),
        Line::from(Span::styled(
            "Companion: gy · gy grok · gy serve · gy burst",
            Style::default().fg(dim).bg(bg),
        )),
        Line::from(Span::styled(
            "Docs: docs/fornever-ledger/GY-TTY-PLACEHOLDERS.md",
            Style::default().fg(dim).bg(bg),
        )),
    ];
    Paragraph::new(lines).render(area, buf);
}

fn status_color(s: SurfaceStatus) -> Color {
    match s {
        SurfaceStatus::Shipped => Color::Rgb(126, 200, 96),
        SurfaceStatus::Placeholder => Color::Rgb(235, 198, 82),
        SurfaceStatus::External => Color::Rgb(160, 140, 220),
    }
}

fn which_gy() -> Option<String> {
    std::env::var_os("PATH").and_then(|paths| {
        for dir in std::env::split_paths(&paths) {
            for name in ["gy", "grokytalky"] {
                let p = dir.join(name);
                if p.is_file() {
                    return Some(p.display().to_string());
                }
            }
        }
        None
    })
}

// ── half-block generators ────────────────────────────────────────────────

fn paint_burst_orb_rgb(buf: &mut Buffer, area: Rect, phase: f32) {
    let (w, h) = halfblock::sample_size_for_cells(area.width, area.height);
    let mut rgb = vec![0u8; (w * h * 3) as usize];
    let cx = (w as f32 - 1.0) * 0.5;
    let cy = (h as f32 - 1.0) * 0.5;
    let r = cx.min(cy) * 0.92;
    let pulse = 0.65 + 0.35 * (phase * 3.2).sin();
    for y in 0..h {
        for x in 0..w {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let d = (dx * dx + dy * dy).sqrt();
            let i = ((y * w + x) * 3) as usize;
            if d <= r {
                let t = 1.0 - (d / r);
                let glow = (t * t * pulse).clamp(0.0, 1.0);
                // Cyan/violet GY palette
                rgb[i] = (40.0 + 120.0 * glow) as u8;
                rgb[i + 1] = (180.0 * glow + 40.0) as u8;
                rgb[i + 2] = (220.0 * glow + 50.0) as u8;
                // Eye glints
                let eye = ((dx + r * 0.25).powi(2) + (dy + r * 0.15).powi(2)).sqrt();
                if eye < r * 0.08 {
                    rgb[i] = 255;
                    rgb[i + 1] = 255;
                    rgb[i + 2] = 255;
                }
            } else {
                rgb[i] = 8;
                rgb[i + 1] = 8;
                rgb[i + 2] = 12;
            }
        }
    }
    let _ = halfblock::paint_rgb24(buf, area, &rgb, w, h);
}

fn paint_waveform_rgb(buf: &mut Buffer, area: Rect, phase: f32) {
    let (w, h) = halfblock::sample_size_for_cells(area.width, area.height);
    let mut rgb = vec![0u8; (w * h * 3) as usize];
    let mid = (h as f32) * 0.5;
    for x in 0..w {
        let t = x as f32 / w as f32;
        let amp = 0.35
            + 0.25 * ((t * 8.0 + phase * 4.0) * TAU).sin().abs()
            + 0.15 * ((t * 19.0 - phase * 6.0) * TAU).sin().abs();
        let half = amp * mid;
        for y in 0..h {
            let i = ((y * w + x) * 3) as usize;
            let dy = (y as f32 - mid).abs();
            if dy <= half {
                let v = (1.0 - dy / half.max(1.0)).clamp(0.0, 1.0);
                rgb[i] = (30.0 + 40.0 * v) as u8;
                rgb[i + 1] = (160.0 + 80.0 * v) as u8;
                rgb[i + 2] = (90.0 + 40.0 * v) as u8;
            } else {
                rgb[i] = 10;
                rgb[i + 1] = 12;
                rgb[i + 2] = 14;
            }
        }
    }
    let _ = halfblock::paint_rgb24(buf, area, &rgb, w, h);
}

fn paint_pins_rgb(buf: &mut Buffer, area: Rect, selected: usize, phase: f32) {
    let (w, h) = halfblock::sample_size_for_cells(area.width, area.height);
    let mut rgb = vec![0u8; (w * h * 3) as usize];
    let n = MOCK_PINS.len().max(1) as u32;
    let tile_w = (w / n).max(4);
    for (ti, _) in MOCK_PINS.iter().enumerate() {
        let x0 = ti as u32 * tile_w;
        let x1 = if ti + 1 == MOCK_PINS.len() {
            w
        } else {
            x0 + tile_w.saturating_sub(1)
        };
        let active = ti == selected;
        let pulse = if active {
            0.75 + 0.25 * (phase * 5.0).sin()
        } else {
            0.45
        };
        for y in 0..h {
            for x in x0..x1.min(w) {
                let i = ((y * w + x) * 3) as usize;
                // Mini lattice noise
                let cell = ((x / 3) ^ (y / 3)) as f32;
                let g = ((cell * 17.0 + phase * 40.0).sin() * 0.5 + 0.5) * pulse;
                if active {
                    rgb[i] = (60.0 + 100.0 * g) as u8;
                    rgb[i + 1] = (40.0 + 80.0 * g) as u8;
                    rgb[i + 2] = (20.0 + 40.0 * g) as u8;
                } else {
                    rgb[i] = (20.0 + 50.0 * g) as u8;
                    rgb[i + 1] = (50.0 + 90.0 * g) as u8;
                    rgb[i + 2] = (70.0 + 100.0 * g) as u8;
                }
            }
        }
    }
    let _ = halfblock::paint_rgb24(buf, area, &rgb, w, h);
    let _ = HALF_BLOCK; // keep import used if optimizer trims
}

// ── mock data ────────────────────────────────────────────────────────────

const MOCK_CHAT: &[(&str, &str)] = &[
    ("alice", "ship the half-block path"),
    ("bob", "@you lgtm on gboom"),
    ("carol", "phone cast up on :9876"),
    ("alice", "pins rail next?"),
    ("system", "room=global  peers=3  (stub)"),
    ("bob", "gy burst feels right for PTT"),
    ("carol", "hexlum on stream-pub sim"),
];

const MOCK_PINS: &[(&str, &str)] = &[
    ("alice", "last: ship the half-block path"),
    ("bob", "last: @you lgtm · unread 1"),
    ("carol", "last: phone cast up"),
    ("colossus", "stream-pub sim · hexlum"),
];

const GY_TOOLS: &[(&str, &str)] = &[
    ("gy", "companion dock TUI"),
    ("gy burst", "dual Glyph burst orb + PTT"),
    ("gy serve", "headless mesh hub + phone cast"),
    ("gy join HOST:PORT", "join mesh room"),
    ("gy grok", "tmux pins-dock above grok"),
    ("gy watch PATH|URL", "ffmpeg pipe → half-block"),
    ("gy stream-pub …", "headless gyst → hub"),
    ("gy encode/decode", ".gyst / .gyhex / .pcap"),
    ("gy colossus", "pcap/sim loop → hub"),
    ("gy sfu-bridge", "hexlum → SFU glyph lanes"),
    ("gy doctor", "health / plugins / vision"),
    ("gy pins-dock", "multi-user pin rail only"),
];

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::buffer::Buffer;
    use ratatui::layout::Rect;

    #[test]
    fn parse_surfaces() {
        assert_eq!(Surface::parse("burst"), Some(Surface::Burst));
        assert_eq!(Surface::parse("WAVE"), Some(Surface::Wave));
        assert_eq!(Surface::parse(""), Some(Surface::Status));
        assert_eq!(Surface::parse("nope"), None);
    }

    #[test]
    fn paint_does_not_panic() {
        let mut state = GyTtyState::new(Surface::Burst);
        state.tick();
        let area = Rect::new(0, 0, 80, 24);
        let mut buf = Buffer::empty(area);
        state.paint(
            &mut buf,
            area,
            Color::Black,
            Color::White,
            Color::DarkGray,
        );
        // Title area should have content
        assert!(!buf[(1, 0)].symbol().is_empty() || !buf[(2, 0)].symbol().is_empty());
    }

    #[test]
    fn keys_cycle_and_close() {
        let mut state = GyTtyState::new(Surface::Status);
        let tab = KeyEvent::from(KeyCode::Tab);
        assert_eq!(state.handle_key(&tab), GyTtyKeyOutcome::Changed);
        assert_eq!(state.surface(), Surface::Burst);
        let esc = KeyEvent::from(KeyCode::Esc);
        assert_eq!(state.handle_key(&esc), GyTtyKeyOutcome::Close);
    }
}
