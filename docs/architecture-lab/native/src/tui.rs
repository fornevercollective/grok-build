//! Ratatui control plane — **Charmbracelet-inspired** color handling
//! (lipgloss-style adaptive roles: pink / purple / green / orange / cyan).
//! Local fornever lab shell — not official xAI product chrome.

use anyhow::Result;
use crossterm::{
    event::{self, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Wrap},
    Terminal,
};
use std::io::{self, Stdout};
use std::path::Path;
use std::time::Duration;

/// Charmbracelet / lipgloss-adjacent palette (truecolor).
/// Roles mirror common Bubble Tea / Lip Gloss demos — not system ANSI defaults.
mod charm {
    use super::*;

    pub const PINK: Color = Color::Rgb(255, 122, 200); // #FF7AC8
    pub const FUCHSIA: Color = Color::Rgb(246, 116, 249);
    pub const PURPLE: Color = Color::Rgb(125, 86, 244); // #7D56F4
    pub const GREEN: Color = Color::Rgb(4, 181, 117); // #04B575
    pub const ORANGE: Color = Color::Rgb(255, 166, 87); // #FFA657
    pub const CYAN: Color = Color::Rgb(127, 212, 255); // #7FD4FF
    pub const YELLOW: Color = Color::Rgb(241, 250, 140);
    pub const SUBTLE: Color = Color::Rgb(110, 115, 141);
    pub const MUTED: Color = Color::Rgb(69, 71, 90);
    pub const TEXT: Color = Color::Rgb(205, 214, 244);
    pub const BG: Color = Color::Rgb(24, 24, 37); // #181825
    pub const SURFACE: Color = Color::Rgb(30, 30, 46);

    pub fn title() -> Style {
        Style::default()
            .fg(PINK)
            .add_modifier(Modifier::BOLD)
    }
    pub fn accent() -> Style {
        Style::default().fg(PURPLE)
    }
    pub fn ok() -> Style {
        Style::default().fg(GREEN)
    }
    pub fn warn() -> Style {
        Style::default().fg(ORANGE)
    }
    pub fn info() -> Style {
        Style::default().fg(CYAN)
    }
    pub fn dim() -> Style {
        Style::default().fg(SUBTLE)
    }
    pub fn body() -> Style {
        Style::default().fg(TEXT)
    }
    pub fn block() -> Style {
        Style::default().fg(PURPLE).bg(SURFACE)
    }
    pub fn border_active() -> Style {
        Style::default().fg(PINK)
    }
    pub fn border_idle() -> Style {
        Style::default().fg(MUTED)
    }
    pub fn key() -> Style {
        Style::default()
            .fg(YELLOW)
            .add_modifier(Modifier::BOLD)
    }
    pub fn rainbow_line(parts: &[(&str, Color)]) -> Line<'static> {
        Line::from(
            parts
                .iter()
                .map(|(s, c)| Span::styled((*s).to_string(), Style::default().fg(*c)))
                .collect::<Vec<_>>(),
        )
    }
}

pub async fn run(url: &str, root: &Path) -> Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let res = run_app(&mut terminal, url, root).await;

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    res
}

async fn run_app(
    terminal: &mut Terminal<CrosstermBackend<Stdout>>,
    url: &str,
    root: &Path,
) -> Result<()> {
    let mut log: Vec<(String, Color)> = vec![
        (
            "fornever · Grok Build Lab · local shell (not an official xAI product)".into(),
            charm::PINK,
        ),
        (format!("root  {}", root.display()), charm::SUBTLE),
        (
            format!("http  {url}  · API + float windows · Charm-style TUI"),
            charm::CYAN,
        ),
        (
            "keys: q quit · o float · l lab · r health · g git · c colors".into(),
            charm::YELLOW,
        ),
    ];
    let mut status = "ready · lipgloss roles · pink title · purple borders".to_string();
    let mut status_color = charm::GREEN;
    let mut focus = 0u8; // which block is “active” for border color

    loop {
        terminal.draw(|f| {
            // Clear with charm surface
            let bg = Block::default().style(Style::default().bg(charm::BG));
            f.render_widget(bg, f.area());

            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(1)
                .constraints([
                    Constraint::Length(4),
                    Constraint::Min(6),
                    Constraint::Length(4),
                ])
                .split(f.area());

            // Title bar — lipgloss-style multi-span rainbow
            let title_line = charm::rainbow_line(&[
                ("  ❯ ", charm::PINK),
                ("fornever lab", charm::PINK),
                (" · ", charm::MUTED),
                ("Grok Build Lab", charm::PURPLE),
                (" · ", charm::MUTED),
                ("native", charm::CYAN),
                (" · ", charm::MUTED),
                ("tui", charm::GREEN),
                ("  ", charm::MUTED),
            ]);
            let subtitle = Line::from(vec![
                Span::styled("  charm-style colors", charm::dim()),
                Span::styled(" · ", charm::dim()),
                Span::styled("local engineering shell", charm::dim()),
                Span::styled(" · ", charm::dim()),
                Span::styled("no endorsement", charm::ORANGE),
            ]);
            let title = Paragraph::new(vec![title_line, subtitle]).block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(if focus == 0 {
                        charm::border_active()
                    } else {
                        charm::border_idle()
                    })
                    .title(Span::styled(" dojo · not electron ", charm::accent()))
                    .style(Style::default().bg(charm::SURFACE)),
            );
            f.render_widget(title, chunks[0]);

            let items: Vec<ListItem> = log
                .iter()
                .rev()
                .take(48)
                .map(|(l, c)| {
                    ListItem::new(Line::from(Span::styled(
                        format!("  {l}"),
                        Style::default().fg(*c),
                    )))
                })
                .collect();
            let list = List::new(items).block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(if focus == 1 {
                        charm::border_active()
                    } else {
                        charm::border_idle()
                    })
                    .title(Span::styled(" event log ", charm::info()))
                    .style(Style::default().bg(charm::SURFACE).fg(charm::TEXT)),
            );
            f.render_widget(list, chunks[1]);

            let help = Paragraph::new(vec![
                Line::from(vec![
                    Span::styled("  status ", charm::dim()),
                    Span::styled(status.clone(), Style::default().fg(status_color)),
                ]),
                Line::from(vec![
                    Span::styled("  ", charm::dim()),
                    Span::styled("q", charm::key()),
                    Span::styled(" quit  ", charm::dim()),
                    Span::styled("o", charm::key()),
                    Span::styled(" float  ", charm::dim()),
                    Span::styled("l", charm::key()),
                    Span::styled(" lab  ", charm::dim()),
                    Span::styled("r", charm::key()),
                    Span::styled(" health  ", charm::dim()),
                    Span::styled("c", charm::key()),
                    Span::styled(" palette", charm::dim()),
                ]),
            ])
            .wrap(Wrap { trim: false })
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(if focus == 2 {
                        charm::border_active()
                    } else {
                        charm::border_idle()
                    })
                    .title(Span::styled(" lipgloss roles ", charm::ok()))
                    .style(Style::default().bg(charm::SURFACE)),
            );
            f.render_widget(help, chunks[2]);
        })?;

        if event::poll(Duration::from_millis(120))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => break,
                    KeyCode::Tab => {
                        focus = (focus + 1) % 3;
                    }
                    KeyCode::Char('o') => {
                        status = spawn_self("float");
                        status_color = charm::CYAN;
                        log.push((status.clone(), charm::CYAN));
                    }
                    KeyCode::Char('l') => {
                        status = spawn_self("lab");
                        status_color = charm::PURPLE;
                        log.push((status.clone(), charm::PURPLE));
                    }
                    KeyCode::Char('r') => {
                        status = health_probe(url).await;
                        status_color = if status.contains("ok") {
                            charm::GREEN
                        } else {
                            charm::ORANGE
                        };
                        log.push((status.clone(), status_color));
                    }
                    KeyCode::Char('g') => {
                        status = "git: open lab window (o) → History tab".into();
                        status_color = charm::SUBTLE;
                        log.push((status.clone(), charm::SUBTLE));
                    }
                    KeyCode::Char('c') => {
                        // demo charm palette in the log
                        log.push(("── charm palette ──".into(), charm::MUTED));
                        log.push(("pink title".into(), charm::PINK));
                        log.push(("purple accent / borders".into(), charm::PURPLE));
                        log.push(("green ok".into(), charm::GREEN));
                        log.push(("orange warn".into(), charm::ORANGE));
                        log.push(("cyan info".into(), charm::CYAN));
                        log.push(("yellow keys".into(), charm::YELLOW));
                        log.push(("subtle dim".into(), charm::SUBTLE));
                        status = "palette dumped · lipgloss-inspired truecolor".into();
                        status_color = charm::FUCHSIA;
                    }
                    _ => {}
                }
            }
        }
    }
    Ok(())
}

fn spawn_self(mode: &str) -> String {
    let exe = std::env::current_exe().ok();
    let Some(exe) = exe else {
        return "cannot resolve self exe".into();
    };
    match std::process::Command::new(exe)
        .args(["--mode", mode])
        .spawn()
    {
        Ok(_) => format!("spawned --mode {mode}"),
        Err(e) => format!("spawn failed: {e}"),
    }
}

async fn health_probe(url: &str) -> String {
    let health = format!("{url}api/health");
    match std::process::Command::new("curl")
        .args(["-sf", &health])
        .output()
    {
        Ok(o) if o.status.success() => {
            let body = String::from_utf8_lossy(&o.stdout);
            format!("health ok · {}", body.chars().take(80).collect::<String>())
        }
        Ok(_) => "health non-200".into(),
        Err(e) => format!("health err {e}"),
    }
}

#[allow(dead_code)]
fn _unused_rect() -> Rect {
    Rect::default()
}

#[allow(dead_code)]
fn _unused_styles() {
    let _ = charm::title();
    let _ = charm::body();
    let _ = charm::block();
    let _ = charm::warn();
}
