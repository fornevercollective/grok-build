//! Ratatui control plane — terminal lineage (mugrok / grok-cli / Grok Build pager spirit).

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
    let mut log: Vec<String> = vec![
        format!("architecture-lab native TUI"),
        format!("root  {}", root.display()),
        format!("http  {url}  (API only — open window with default mode)"),
        "keys: q quit · o open float · l open lab · r health · g git head".into(),
    ];
    let mut status = "ready".to_string();

    loop {
        terminal.draw(|f| {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3),
                    Constraint::Min(6),
                    Constraint::Length(3),
                ])
                .split(f.area());

            let title = Paragraph::new(Line::from(vec![
                Span::styled(
                    " architecture-lab ",
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::raw("native · rust · system-webview · tui"),
            ]))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Dojo path (not Electron)"),
            );
            f.render_widget(title, chunks[0]);

            let items: Vec<ListItem> = log
                .iter()
                .rev()
                .take(40)
                .map(|l| ListItem::new(l.as_str()))
                .collect();
            let list = List::new(items).block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("event log"),
            );
            f.render_widget(list, chunks[1]);

            let help = Paragraph::new(status.as_str())
                .wrap(Wrap { trim: true })
                .block(Block::default().borders(Borders::ALL).title("status"));
            f.render_widget(help, chunks[2]);
        })?;

        if event::poll(Duration::from_millis(120))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => break,
                    KeyCode::Char('o') => {
                        status = spawn_self("float", url);
                        log.push(status.clone());
                    }
                    KeyCode::Char('l') => {
                        status = spawn_self("lab", url);
                        log.push(status.clone());
                    }
                    KeyCode::Char('r') => {
                        status = health_probe(url).await;
                        log.push(status.clone());
                    }
                    KeyCode::Char('g') => {
                        status = "git: use History tab in lab window (o)".into();
                        log.push(status.clone());
                    }
                    _ => {}
                }
            }
        }
    }
    Ok(())
}

fn spawn_self(mode: &str, _url: &str) -> String {
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
    // reuse tiny TCP client logic via curl if present
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
