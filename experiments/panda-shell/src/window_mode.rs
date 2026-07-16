//! Hybrid windowed Metal frost mode — native window with glass shader.
//!
//! Uses blocking Unix IPC so winit can own the main thread without nesting
//! Tokio runtimes (macOS requires the event loop on the main thread).

use std::io::{Read, Write};
use std::os::unix::net::UnixStream as StdUnixStream;
use std::sync::Arc;
use std::time::Instant;

use anyhow::{Context, Result, bail};
use softbuffer::{Context as SbContext, Surface};
use winit::application::ApplicationHandler;
use winit::dpi::LogicalSize;
use winit::event::WindowEvent;
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop};
use winit::window::{Window, WindowId};

use crate::frost::{self, FrostBackend};
use crate::paths::socket_path;
use crate::protocol::{ClientMsg, FrameSnapshot, ServerMsg};

/// Open a hybrid frosted window bound to a daemon session.
///
/// Must run on the process main thread on macOS (winit requirement).
pub fn run_hybrid(session: Option<String>) -> Result<()> {
    let backend = frost::select_backend();
    let event_loop = EventLoop::new().context("create event loop")?;
    event_loop.set_control_flow(ControlFlow::Poll);

    let mut app = HybridApp {
        window: None,
        surface: None,
        sb_ctx: None,
        backend,
        started: Instant::now(),
        session,
        stream: None,
        last_frame: None,
        status: String::from("panda · hybrid frost"),
        last_poll: Instant::now(),
    };
    event_loop.run_app(&mut app).context("run hybrid window")?;
    Ok(())
}

struct HybridApp {
    window: Option<Arc<Window>>,
    surface: Option<Surface<Arc<Window>, Arc<Window>>>,
    sb_ctx: Option<SbContext<Arc<Window>>>,
    backend: FrostBackend,
    started: Instant,
    session: Option<String>,
    stream: Option<StdUnixStream>,
    last_frame: Option<FrameSnapshot>,
    status: String,
    last_poll: Instant,
}

impl ApplicationHandler for HybridApp {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }
        let attrs = Window::default_attributes()
            .with_title(format!(
                "panda · {} · {}",
                self.backend.kind, self.backend.label
            ))
            .with_inner_size(LogicalSize::new(1100.0, 720.0))
            .with_transparent(true);

        let window = Arc::new(event_loop.create_window(attrs).expect("create window"));
        let sb_ctx = SbContext::new(window.clone()).expect("softbuffer context");
        let surface = Surface::new(&sb_ctx, window.clone()).expect("softbuffer surface");
        self.sb_ctx = Some(sb_ctx);
        self.surface = Some(surface);
        self.window = Some(window);

        if let Some(name) = self.session.clone() {
            match attach_blocking(&name) {
                Ok(stream) => {
                    self.status = format!("attached `{name}` · {}", self.backend.label);
                    self.stream = Some(stream);
                    log_win(&format!("attached session `{name}`"));
                }
                Err(e) => {
                    self.status = format!("attach failed: {e:#}");
                    log_win(&format!("attach failed: {e:#}"));
                    // Keep window open with frost-only chrome so the user still
                    // gets a visual surface; retry on next poll.
                }
            }
        }
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _id: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::CloseRequested => {
                self.detach();
                event_loop.exit();
            }
            WindowEvent::RedrawRequested => self.redraw(),
            WindowEvent::Resized(_) => {
                if let Some(w) = &self.window {
                    w.request_redraw();
                }
            }
            WindowEvent::KeyboardInput { event, .. } if event.state.is_pressed() => {
                use winit::keyboard::{Key, NamedKey};
                let quit = match &event.logical_key {
                    Key::Named(NamedKey::Escape) => true,
                    Key::Character(c) if c == "q" => true,
                    _ => false,
                };
                if quit {
                    self.detach();
                    event_loop.exit();
                }
            }
            _ => {}
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
        // Poll daemon ~30 fps without spinning the CPU too hard.
        if self.last_poll.elapsed().as_millis() >= 32 {
            self.last_poll = Instant::now();
            // Retry attach if we lost the stream (or first attach failed).
            if self.stream.is_none() {
                if let Some(name) = self.session.clone() {
                    if let Ok(stream) = attach_blocking(&name) {
                        log_win(&format!("reattached `{name}`"));
                        self.stream = Some(stream);
                        self.status = format!("attached `{name}` · {}", self.backend.label);
                    }
                }
            }
            if self.stream.is_some() {
                match self.poll_frame() {
                    Some(frame) => {
                        self.status = format!(
                            "{} · {} · {}",
                            frame.session,
                            frame
                                .models
                                .get(frame.active_model)
                                .map(|m| m.label.as_str())
                                .unwrap_or("?"),
                            self.backend.label
                        );
                        self.last_frame = Some(frame);
                    }
                    None => {
                        // Drop broken stream; retry next tick.
                        if let Some(mut s) = self.stream.take() {
                            let _ = write_msg_blocking(&mut s, &ClientMsg::Detach);
                        }
                        log_win("snapshot failed — dropping stream");
                    }
                }
            }
        }
        if let Some(w) = &self.window {
            w.request_redraw();
        }
        std::thread::sleep(std::time::Duration::from_millis(8));
    }
}

impl HybridApp {
    fn detach(&mut self) {
        if let Some(mut stream) = self.stream.take() {
            let _ = write_msg_blocking(&mut stream, &ClientMsg::Detach);
            let _ = read_msg_blocking::<ServerMsg>(&mut stream);
        }
    }

    fn poll_frame(&mut self) -> Option<FrameSnapshot> {
        let stream = self.stream.as_mut()?;
        write_msg_blocking(stream, &ClientMsg::Snapshot).ok()?;
        match read_msg_blocking::<ServerMsg>(stream).ok()? {
            ServerMsg::Frame(f) => Some(f),
            _ => None,
        }
    }

    fn redraw(&mut self) {
        let Some(window) = self.window.clone() else {
            return;
        };
        let Some(surface) = self.surface.as_mut() else {
            return;
        };
        let size = window.inner_size();
        let width = size.width.max(1);
        let height = size.height.max(1);
        surface
            .resize(
                std::num::NonZeroU32::new(width).unwrap(),
                std::num::NonZeroU32::new(height).unwrap(),
            )
            .ok();
        let mut buf = surface.buffer_mut().expect("buffer");
        let time = self.started.elapsed().as_secs_f32();
        frost::shade_frame(&mut buf, width, height, time, &self.backend);

        if let Some(frame) = &self.last_frame {
            let cell_w = 8u32;
            let cell_h = 14u32;
            let origin_y = 48u32;
            for pane in &frame.panes {
                let px = 16 + pane.x as u32 * cell_w / 2;
                let py = origin_y + pane.y as u32 * cell_h / 2;
                for (row_i, line) in pane.lines.iter().enumerate().take(24) {
                    let mut col = 0u32;
                    for run in line {
                        for ch in run.text.chars().take(80) {
                            let on = !ch.is_whitespace();
                            let x = px + col * cell_w;
                            let y = py + row_i as u32 * cell_h;
                            if x + 1 < width && y + 1 < height {
                                frost::blit_cell(&mut buf, width, x, y, on, pane.focused);
                            }
                            col += 1;
                        }
                    }
                }
            }
        }

        // Draw status as a thin accent bar at the top (title carries detail too).
        let _ = &self.status;
        for x in 0..width.min(8) {
            for y in 0..4.min(height) {
                let i = (y * width + x) as usize;
                if i < buf.len() {
                    buf[i] = frost::ACCENT.to_u32();
                }
            }
        }

        buf.present().ok();
    }
}

fn attach_blocking(name: &str) -> Result<StdUnixStream> {
    let path = socket_path();
    let mut stream = StdUnixStream::connect(&path)
        .with_context(|| format!("connect {}", path.display()))?;
    // Non-blocking-ish deadlines so a stuck daemon cannot freeze AppKit.
    stream.set_read_timeout(Some(std::time::Duration::from_secs(3)))?;
    stream.set_write_timeout(Some(std::time::Duration::from_secs(3)))?;
    write_msg_blocking(
        &mut stream,
        &ClientMsg::Attach {
            name: name.to_string(),
            shell: None,
            cwd: None,
            splits: 0,
            create: true,
        },
    )?;
    match read_msg_blocking::<ServerMsg>(&mut stream)? {
        ServerMsg::Attached { .. } => Ok(stream),
        ServerMsg::Error { message } => bail!("{message}"),
        other => bail!("unexpected attach reply: {other:?}"),
    }
}

fn log_win(msg: &str) {
    use std::io::Write;
    let path = std::env::temp_dir().join("panda-window.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let _ = writeln!(f, "[{:?}] {msg}", Instant::now());
    }
    // Also surface on stderr for terminal launches.
    eprintln!("panda-window: {msg}");
}

fn write_msg_blocking<T: serde::Serialize>(stream: &mut StdUnixStream, msg: &T) -> Result<()> {
    let bytes = serde_json::to_vec(msg).context("encode json")?;
    let len = (bytes.len() as u32).to_be_bytes();
    stream.write_all(&len)?;
    stream.write_all(&bytes)?;
    stream.flush()?;
    Ok(())
}

fn read_msg_blocking<T: for<'de> serde::Deserialize<'de>>(stream: &mut StdUnixStream) -> Result<T> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).context("read length")?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > 16 * 1024 * 1024 {
        bail!("message too large: {len}");
    }
    let mut buf = vec![0u8; len];
    stream.read_exact(&mut buf).context("read body")?;
    serde_json::from_slice(&buf).context("decode json")
}
