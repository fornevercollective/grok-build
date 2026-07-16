//! TUI client — attaches to daemon session, paints frames, detach/reattach.

use std::io::{self, Stdout};
use std::path::PathBuf;
use std::time::Duration;

use anyhow::{Context, Result, bail};
use crossterm::event::{
    DisableMouseCapture, EnableMouseCapture, Event, EventStream, KeyEventKind,
};
use crossterm::execute;
use crossterm::terminal::{
    EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode,
};
use futures_util::StreamExt;
use ratatui::Terminal;
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect as RRect};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Clear, Paragraph, Wrap};
use tokio::net::UnixStream;
use tokio::time::interval;

use crate::daemon;
use crate::input::{Action, InputRouter};
use crate::protocol::{
    ClientMsg, FocusDirWire, FrameSnapshot, RemoteAction, RunSnap, ServerMsg, read_msg, write_msg,
};
use crate::theme::{self, ACCENT, ACCENT_2, FROST, LIVE, MUTED, TEXT, VOID, WARN};

pub struct AttachOpts {
    pub name: String,
    pub shell: Option<String>,
    pub cwd: Option<PathBuf>,
    pub splits: u8,
    pub create: bool,
}

pub async fn run_attached(opts: AttachOpts) -> Result<()> {
    daemon::ensure_running().await?;
    let mut stream = daemon::connect().await?;

    write_msg(
        &mut stream,
        &ClientMsg::Attach {
            name: opts.name.clone(),
            shell: opts.shell,
            cwd: opts.cwd,
            splits: opts.splits,
            create: opts.create,
        },
    )
    .await?;
    match read_msg::<ServerMsg>(&mut stream).await? {
        ServerMsg::Attached { name } => {
            eprintln_quiet(&format!("attached to session `{name}`"));
        }
        ServerMsg::Error { message } => bail!("{message}"),
        other => bail!("unexpected attach reply: {other:?}"),
    }

    enable_raw_mode().context("raw mode")?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    terminal.clear()?;

    let result = client_loop(&mut stream, &mut terminal).await;

    // Best-effort detach on exit (unless already detached).
    let _ = write_msg(&mut stream, &ClientMsg::Detach).await;
    let _ = read_msg::<ServerMsg>(&mut stream).await;

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;
    result
}

async fn client_loop(
    stream: &mut UnixStream,
    terminal: &mut Terminal<CrosstermBackend<Stdout>>,
) -> Result<()> {
    let mut events = EventStream::new();
    let mut tick = interval(Duration::from_millis(33));
    let mut input = InputRouter::default();
    let mut last: Option<FrameSnapshot> = None;
    let mut should_exit = false;
    let mut detached = false;

    // Initial size.
    if let Ok(size) = terminal.size() {
        let _ = send(
            stream,
            ClientMsg::Resize {
                cols: size.width,
                rows: size.height,
            },
        )
        .await;
    }

    loop {
        if should_exit {
            break;
        }

        tokio::select! {
            _ = tick.tick() => {
                match send(stream, ClientMsg::Snapshot).await {
                    Ok(ServerMsg::Frame(f)) => last = Some(f),
                    Ok(ServerMsg::Error { message }) if message.contains("gone") || message.contains("ended") => {
                        should_exit = true;
                    }
                    Ok(ServerMsg::Ok { status }) if status == "session ended" => {
                        should_exit = true;
                    }
                    _ => {}
                }
            }
            maybe = events.next() => {
                match maybe {
                    Some(Ok(Event::Key(key))) => {
                        if key.kind == KeyEventKind::Release {
                            continue;
                        }
                        if let Some(action) = input.handle(key) {
                            match action {
                                Action::Detach => {
                                    let _ = send(stream, ClientMsg::Detach).await;
                                    detached = true;
                                    should_exit = true;
                                }
                                Action::Quit => {
                                    // Kill session entirely.
                                    let _ = send(stream, ClientMsg::Action(RemoteAction::KillSession)).await;
                                    should_exit = true;
                                }
                                other => {
                                    if let Some(remote) = action_to_remote(other) {
                                        match send(stream, ClientMsg::Action(remote)).await {
                                            Ok(ServerMsg::Ok { status }) if status == "session ended" => {
                                                should_exit = true;
                                            }
                                            Ok(ServerMsg::Error { message }) => {
                                                if let Some(f) = last.as_mut() {
                                                    f.status_msg = message;
                                                }
                                            }
                                            _ => {}
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(Event::Resize(cols, rows))) => {
                        let _ = send(stream, ClientMsg::Resize { cols, rows }).await;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) | None => should_exit = true,
                }
            }
        }

        if let Some(frame) = &last {
            let size = terminal.size()?;
            if size.width < 10 || size.height < 5 {
                continue;
            }
            let prefix = input.prefix_armed;
            let help = input.show_help;
            terminal.draw(|f| {
                draw_frame(f, frame, prefix, help);
            })?;
        }
    }

    if detached {
        // Skip auto-detach in caller if we already did.
    }
    Ok(())
}

async fn send(stream: &mut UnixStream, msg: ClientMsg) -> Result<ServerMsg> {
    write_msg(stream, &msg).await?;
    read_msg(stream).await
}

fn action_to_remote(action: Action) -> Option<RemoteAction> {
    Some(match action {
        Action::SplitHorizontal => RemoteAction::SplitHorizontal,
        Action::SplitVertical => RemoteAction::SplitVertical,
        Action::ClosePane => RemoteAction::ClosePane,
        Action::FocusNext => RemoteAction::FocusNext,
        Action::FocusPrev => RemoteAction::FocusPrev,
        Action::FocusLeft => RemoteAction::FocusDir(FocusDirWire::Left),
        Action::FocusRight => RemoteAction::FocusDir(FocusDirWire::Right),
        Action::FocusUp => RemoteAction::FocusDir(FocusDirWire::Up),
        Action::FocusDown => RemoteAction::FocusDir(FocusDirWire::Down),
        Action::ZoomToggle => RemoteAction::ZoomToggle,
        Action::NewTab => RemoteAction::NewTab,
        Action::NextTab => RemoteAction::NextTab,
        Action::PrevTab => RemoteAction::PrevTab,
        Action::PtyBytes(b) => RemoteAction::PtyBytes(b),
        Action::NextModel => RemoteAction::NextModel,
        Action::PrevModel => RemoteAction::PrevModel,
        Action::SelectModel(i) => RemoteAction::SelectModel(i),
        Action::ToggleHelp | Action::Detach | Action::Quit => return None,
    })
}

fn draw_frame(f: &mut ratatui::Frame<'_>, frame: &FrameSnapshot, prefix: bool, help: bool) {
    let area = f.area();
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // tabs
            Constraint::Length(1), // model strip
            Constraint::Min(3),    // panes
            Constraint::Length(1), // status
        ])
        .split(area);

    // Top bar
    let mut spans = vec![
        Span::styled(" ░▒ ", Style::default().fg(MUTED).bg(FROST)),
        Span::styled(
            "panda",
            Style::default()
                .fg(ACCENT)
                .bg(FROST)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!(" [{}] ", frame.session),
            Style::default().fg(ACCENT_2).bg(FROST),
        ),
    ];
    for (i, tab) in frame.tabs.iter().enumerate() {
        let active = i == frame.tab_idx;
        spans.push(Span::styled(
            format!(" {}{} ", if active { "◉" } else { "○" }, tab),
            if active {
                theme::title_active()
            } else {
                theme::title_inactive()
            },
        ));
    }
    spans.push(Span::styled(
        format!("  ·  {}  ", frame.accel),
        Style::default().fg(MUTED).bg(FROST),
    ));
    f.render_widget(
        Paragraph::new(Line::from(spans)).style(theme::frost()),
        chunks[0],
    );

    // Model strip
    draw_model_strip(f, chunks[1], frame);

    // Panes — positions are relative to body; offset into body chunk.
    let body = chunks[2];
    for pane in &frame.panes {
        let area = RRect::new(
            body.x.saturating_add(pane.x),
            body.y.saturating_add(pane.y),
            pane.w.min(body.width.saturating_sub(pane.x)),
            pane.h.min(body.height.saturating_sub(pane.y)),
        );
        if area.width == 0 || area.height == 0 {
            continue;
        }
        paint_pane(f, area, pane);
    }

    // Status
    let prefix_sp = if prefix {
        Span::styled(
            " PREFIX ",
            Style::default()
                .fg(VOID)
                .bg(ACCENT)
                .add_modifier(Modifier::BOLD),
        )
    } else {
        Span::styled(" · ", Style::default().fg(MUTED).bg(FROST))
    };
    let msg = Span::styled(
        format!(" {} ", frame.status_msg),
        Style::default().fg(TEXT).bg(FROST),
    );
    let hint = Span::styled(
        "  C-a d detach  C-a q kill  C-a m/M model  C-a ? help ",
        Style::default().fg(MUTED).bg(FROST),
    );
    f.render_widget(
        Paragraph::new(Line::from(vec![prefix_sp, msg, hint])),
        chunks[3],
    );

    if help {
        draw_help(f, area);
    }
}

fn draw_model_strip(f: &mut ratatui::Frame<'_>, area: RRect, frame: &FrameSnapshot) {
    let mut spans = vec![Span::styled(
        " models ",
        Style::default()
            .fg(MUTED)
            .bg(FROST)
            .add_modifier(Modifier::DIM),
    )];
    for (i, m) in frame.models.iter().enumerate() {
        let active = i == frame.active_model;
        let label = format!(" {} {} ", i + 1, m.label);
        spans.push(Span::styled(
            label,
            if active {
                Style::default()
                    .fg(VOID)
                    .bg(ACCENT)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(TEXT).bg(FROST)
            },
        ));
        spans.push(Span::styled(
            format!("[{}] ", m.backend),
            Style::default().fg(MUTED).bg(FROST),
        ));
    }
    spans.push(Span::styled(
        "  C-a m next · C-a 1-9 select ",
        Style::default().fg(MUTED).bg(FROST),
    ));
    f.render_widget(
        Paragraph::new(Line::from(spans)).style(theme::frost()),
        area,
    );
}

fn paint_pane(f: &mut ratatui::Frame<'_>, area: RRect, pane: &crate::protocol::PaneSnap) {
    let border = if pane.focused {
        theme::border_focus()
    } else {
        theme::border_dim()
    };
    let title_color = if pane.alive { LIVE } else { WARN };
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border)
        .border_type(ratatui::widgets::BorderType::Rounded)
        .style(theme::glass())
        .title(Span::styled(
            pane.title.clone(),
            Style::default().fg(title_color).bg(FROST),
        ));
    let inner = block.inner(area);
    f.render_widget(block, area);

    let lines: Vec<Line> = pane
        .lines
        .iter()
        .map(|runs| Line::from(runs_to_spans(runs)))
        .collect();
    f.render_widget(
        Paragraph::new(lines)
            .style(theme::glass())
            .alignment(Alignment::Left),
        inner,
    );

    if pane.focused && pane.alive {
        let cr = pane.cursor_row.saturating_sub(1) as u16;
        let cc = pane.cursor_col.saturating_sub(1) as u16;
        if cr < inner.height && cc < inner.width {
            f.render_widget(
                Paragraph::new("▌").style(
                    Style::default()
                        .fg(ACCENT)
                        .bg(theme::GLASS)
                        .add_modifier(Modifier::BOLD),
                ),
                RRect::new(inner.x + cc, inner.y + cr, 1, 1),
            );
        }
    }
}

fn runs_to_spans(runs: &[RunSnap]) -> Vec<Span<'static>> {
    let mut spans = Vec::new();
    for run in runs {
        let mut style = Style::default().fg(TEXT).bg(theme::GLASS);
        if let Some(ref fg) = run.fg {
            if let Some(c) = theme::parse_css_color(fg) {
                style = style.fg(c);
            }
        }
        if let Some(ref bg) = run.bg {
            if let Some(c) = theme::parse_css_color(bg) {
                style = style.bg(c);
            }
        }
        if run.bold {
            style = style.add_modifier(Modifier::BOLD);
        }
        if run.italic {
            style = style.add_modifier(Modifier::ITALIC);
        }
        if run.underline {
            style = style.add_modifier(Modifier::UNDERLINED);
        }
        if run.dim {
            style = style.add_modifier(Modifier::DIM);
        }
        if run.inverse {
            style = style.add_modifier(Modifier::REVERSED);
        }
        spans.push(Span::styled(run.text.clone(), style));
    }
    if spans.is_empty() {
        spans.push(Span::styled(" ", Style::default().bg(theme::GLASS)));
    }
    spans
}

fn draw_help(f: &mut ratatui::Frame<'_>, area: RRect) {
    let w = 58u16.min(area.width.saturating_sub(4));
    let h = 20u16.min(area.height.saturating_sub(2));
    let x = area.x + (area.width.saturating_sub(w)) / 2;
    let y = area.y + (area.height.saturating_sub(h)) / 2;
    let rect = RRect::new(x, y, w, h);
    f.render_widget(Clear, rect);
    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(ratatui::widgets::BorderType::Rounded)
        .border_style(theme::border_focus())
        .style(theme::frost())
        .title(Span::styled(
            " panda · standalone · detach/reattach ",
            theme::title_active(),
        ));
    let body = vec![
        Line::from(Span::styled(
            " Prefix: Ctrl-a",
            theme::help_desc(),
        )),
        Line::from(""),
        help_row("d", "detach (session keeps running)"),
        help_row("q", "kill session & quit"),
        help_row("%  \"", "split vertical / horizontal"),
        help_row("x", "close pane"),
        help_row("arrows/hjkl", "focus neighbor"),
        help_row("m / M", "next / prev model"),
        help_row("1-9", "select model on strip"),
        help_row("c [ ]", "new / prev / next tab"),
        help_row("z", "zoom pane"),
        help_row("?", "toggle help"),
        Line::from(""),
        Line::from(Span::styled(
            " CLI: panda attach NAME · panda ls · panda window",
            theme::help_desc(),
        )),
    ];
    f.render_widget(
        Paragraph::new(body)
            .block(block)
            .wrap(Wrap { trim: false }),
        rect,
    );
}

fn help_row(key: &str, desc: &str) -> Line<'static> {
    Line::from(vec![
        Span::styled(format!("  {key:<14}"), theme::help_key()),
        Span::styled(desc.to_string(), theme::help_desc()),
    ])
}

fn eprintln_quiet(msg: &str) {
    // Only print when not yet in alt screen.
    let _ = msg;
}

pub async fn list_sessions() -> Result<()> {
    daemon::ensure_running().await?;
    let mut stream = daemon::connect().await?;
    write_msg(&mut stream, &ClientMsg::ListSessions).await?;
    match read_msg::<ServerMsg>(&mut stream).await? {
        ServerMsg::SessionList { sessions } => {
            if sessions.is_empty() {
                println!("(no sessions — `panda new` to create one)");
            } else {
                println!(
                    "{:<16} {:<10} {:>5}  {:<20}  {}",
                    "NAME", "STATE", "PANES", "MODEL", "CREATED"
                );
                for s in sessions {
                    println!(
                        "{:<16} {:<10} {:>5}  {:<20}  {}",
                        s.name,
                        if s.attached { "attached" } else { "detached" },
                        s.panes,
                        s.model,
                        s.created_ms
                    );
                }
            }
            Ok(())
        }
        ServerMsg::Error { message } => bail!("{message}"),
        other => bail!("unexpected: {other:?}"),
    }
}

pub async fn kill_session(name: &str) -> Result<()> {
    daemon::ensure_running().await?;
    let mut stream = daemon::connect().await?;
    write_msg(
        &mut stream,
        &ClientMsg::Kill {
            name: name.to_string(),
        },
    )
    .await?;
    match read_msg::<ServerMsg>(&mut stream).await? {
        ServerMsg::Ok { status } => {
            println!("{status}");
            Ok(())
        }
        ServerMsg::Error { message } => bail!("{message}"),
        other => bail!("unexpected: {other:?}"),
    }
}
