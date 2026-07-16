//! Multi native windows: Lab + Chat + Stream + Agent + Launch (each own WKWebView).
//! Dock/undock links satellites to the lab; SpaceXAI control bus + IPC drag.

use crate::control::{ControlBus, ControlCmd, ResizeDir, WinTarget};
use crate::menu;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tao::{
    dpi::{LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize},
    event::{Event, StartCause, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy},
    window::{CursorIcon, ResizeDirection, Window, WindowBuilder, WindowId},
};
use wry::{http::Request, WebViewBuilder};

const DOCK_GAP: i32 = 10;

/// Detected monitor work area in **physical** pixels (menu bar / dock excluded when possible).
#[derive(Clone, Copy, Debug)]
struct WorkArea {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    /// Device scale (2.0 on Retina). Sizes stay physical for tao APIs.
    scale: f64,
}

impl WorkArea {
    fn fallback() -> Self {
        Self {
            x: 0,
            y: 0,
            w: 1440,
            h: 900,
            scale: 1.0,
        }
    }

    /// Logical points (CSS-like) for proportion math.
    fn logical_w(self) -> f64 {
        self.w as f64 / self.scale.max(0.5)
    }

    fn logical_h(self) -> f64 {
        self.h as f64 / self.scale.max(0.5)
    }

    fn phys(self, logical: f64) -> u32 {
        (logical * self.scale).round().max(1.0) as u32
    }

    fn phys_i(self, logical: f64) -> i32 {
        (logical * self.scale).round() as i32
    }
}

/// Read visible frame from NSScreen when available; else tao monitor size.
fn detect_work_area(window: &Window) -> WorkArea {
    #[cfg(target_os = "macos")]
    {
        if let Some(wa) = macos_visible_frame(window) {
            return wa;
        }
    }
    if let Some(m) = window.current_monitor() {
        let s = m.size();
        let p = m.position();
        let scale = m.scale_factor();
        // Reserve ~menu bar + small dock margin when we only have full frame.
        let menu = (28.0 * scale) as i32;
        let dock = (8.0 * scale) as i32;
        return WorkArea {
            x: p.x,
            y: p.y + menu,
            w: s.width as i32,
            h: (s.height as i32 - menu - dock).max(400),
            scale,
        };
    }
    WorkArea::fallback()
}

#[cfg(target_os = "macos")]
fn macos_visible_frame(window: &Window) -> Option<WorkArea> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSRect;
    use objc::{class, msg_send, sel, sel_impl};
    use tao::platform::macos::WindowExtMacOS;

    unsafe {
        let ns_win = window.ns_window() as id;
        if ns_win == nil {
            return None;
        }
        let screen: id = msg_send![ns_win, screen];
        let screen = if screen == nil {
            let screens: id = msg_send![class!(NSScreen), screens];
            if screens == nil {
                return None;
            }
            let count: usize = msg_send![screens, count];
            if count == 0 {
                return None;
            }
            msg_send![screens, objectAtIndex: 0usize]
        } else {
            screen
        };
        if screen == nil {
            return None;
        }
        let vis: NSRect = msg_send![screen, visibleFrame];
        let full: NSRect = msg_send![screen, frame];
        // Cocoa origin is bottom-left; tao/winit use top-left of primary.
        // Convert visibleFrame to top-left physical matching tao monitor coords.
        let scale: f64 = msg_send![screen, backingScaleFactor];
        let scale = if scale < 0.5 { 1.0 } else { scale };

        // Prefer tao monitor origin for multi-display consistency.
        let (mx, my, mw, mh) = if let Some(m) = window.current_monitor() {
            let p = m.position();
            let s = m.size();
            (p.x, p.y, s.width as i32, s.height as i32)
        } else {
            (
                (full.origin.x * scale) as i32,
                0,
                (full.size.width * scale) as i32,
                (full.size.height * scale) as i32,
            )
        };

        // Insets from full frame to visible (points → physical).
        let left_pt = vis.origin.x - full.origin.x;
        let bottom_pt = vis.origin.y - full.origin.y;
        let right_pt = (full.origin.x + full.size.width) - (vis.origin.x + vis.size.width);
        let top_pt = (full.origin.y + full.size.height) - (vis.origin.y + vis.size.height);

        let left = (left_pt * scale).round() as i32;
        let right = (right_pt * scale).round() as i32;
        let top = (top_pt * scale).round() as i32;
        let bottom = (bottom_pt * scale).round() as i32;

        Some(WorkArea {
            x: mx + left,
            y: my + top,
            w: (mw - left - right).max(480),
            h: (mh - top - bottom).max(360),
            scale,
        })
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
enum Role {
    Lab,
    Chat,
    Stream,
    /// agentcn-inspired console: center prompt + α/β/γ feeds
    Agent,
    /// Launch pad: View + Window menu control surface
    Launch,
    /// Lightweight browser (Rust host + system WebKit — Ladybird-style split)
    Browser,
}

impl Role {
    fn target(self) -> WinTarget {
        match self {
            Role::Lab => WinTarget::Lab,
            Role::Chat => WinTarget::Chat,
            Role::Stream => WinTarget::Stream,
            Role::Agent => WinTarget::Agent,
            Role::Launch => WinTarget::Launch,
            Role::Browser => WinTarget::Browser,
        }
    }
}

struct WinPair {
    window: Window,
    /// Lazy for chat/stream: first-launch crash on some Macs when 3 WKWebViews
    /// navigate + inject large init scripts concurrently (NSString/ObjC abort).
    webview: Option<wry::WebView>,
    role: Role,
    /// Stable entry URL for safe reload (avoids evaluate_script → CFString crash).
    entry_url: String,
}

/// Snapshot of which satellites were open before chat-only / orb focus.
#[derive(Clone, Debug, Default)]
struct WorkspaceSnap {
    chat: bool,
    stream: bool,
    agent: bool,
    launch: bool,
    browser: bool,
    chat_docked: bool,
    stream_docked: bool,
    /// "orb" | "full" | ""
    chat_surface: String,
    taken: bool,
}

/// Dock/undock layout — satellites snap to lab when docked.
struct LayoutState {
    chat_docked: bool,
    stream_docked: bool,
    /// Suppress undock-on-move while we programmatically snap.
    suppressing_move: bool,
    /// First-launch cluster applied (resolution-aware positions).
    clustered: bool,
    /// Last multi-window layout (restored by Lab / restore_workspace).
    snap: WorkspaceSnap,
}

pub fn run_blocking(url: &str, float: bool, _root: &Path, bus: Arc<ControlBus>) -> Result<()> {
    let event_loop = EventLoopBuilder::<ControlCmd>::with_user_event().build();
    let proxy = event_loop.create_proxy();
    bus.attach_proxy(proxy.clone());
    let _menu_ids = menu::install_menu(proxy.clone());

    // First-launch safety: only build the lab WKWebView up front.
    // Chat/stream windows exist (for layout/dock) but attach WebViews on first show.
    // Concurrent triple WK navigation + large init scripts has aborted on cold Macs
    // with: NSString initWithBytes:length:encoding: (panic in ObjC, cannot unwind).
    let eager = std::env::var("LAB_NATIVE_EAGER")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let mut windows: HashMap<WindowId, WinPair> = HashMap::new();

    // ── Lab window (frameless float — same chrome language as chat) ──
    let lab = build_lab_window(&event_loop, float)?;
    center_window(&lab);
    let lab_id = lab.id();
    // Keep entry URL ASCII-safe (fragment applied after base load via SPA hash).
    let lab_url = url.trim_end_matches('/').to_string() + "/";
    let lab_entry = if float {
        format!("{lab_url}#/00-overview")
    } else {
        lab_url.clone()
    };
    let lab_wv = build_webview(
        &lab,
        &lab_entry,
        &lab_init_script(),
        Role::Lab,
        proxy.clone(),
    )?;
    windows.insert(
        lab_id,
        WinPair {
            window: lab,
            webview: Some(lab_wv),
            role: Role::Lab,
            entry_url: lab_entry.clone(),
        },
    );

    // ── Chat window shell — webview lazy unless LAB_NATIVE_EAGER=1 ──
    let chat = build_chat_window(&event_loop)?;
    place_chat_window(&chat);
    chat.set_visible(false);
    let chat_id = chat.id();
    let chat_url = format!("{lab_url}chat.html");
    let chat_wv = if eager {
        Some(build_webview(
            &chat,
            &chat_url,
            &chat_init_script(),
            Role::Chat,
            proxy.clone(),
        )?)
    } else {
        None
    };
    windows.insert(
        chat_id,
        WinPair {
            window: chat,
            webview: chat_wv,
            role: Role::Chat,
            entry_url: chat_url.clone(),
        },
    );
    bus.set_chat_visible(false);
    bus.set_chat_docked(true);

    // ── Stream shell — webview lazy unless LAB_NATIVE_EAGER=1 ──
    let stream = build_stream_window(&event_loop)?;
    place_stream_window(&stream);
    stream.set_visible(false);
    let stream_id = stream.id();
    let stream_url = format!("{lab_url}stream.html");
    let stream_wv = if eager {
        Some(build_webview(
            &stream,
            &stream_url,
            &stream_init_script(),
            Role::Stream,
            proxy.clone(),
        )?)
    } else {
        None
    };
    windows.insert(
        stream_id,
        WinPair {
            window: stream,
            webview: stream_wv,
            role: Role::Stream,
            entry_url: stream_url.clone(),
        },
    );
    bus.set_stream_visible(false);
    bus.set_stream_docked(true);

    // ── Agent console — lazy webview (center chat + three feeds) ──
    let agent = build_agent_window(&event_loop)?;
    place_agent_window(&agent);
    agent.set_visible(false);
    let agent_id = agent.id();
    let agent_url = format!("{lab_url}agent.html");
    let agent_wv = if eager {
        Some(build_webview(
            &agent,
            &agent_url,
            &agent_init_script(),
            Role::Agent,
            proxy.clone(),
        )?)
    } else {
        None
    };
    windows.insert(
        agent_id,
        WinPair {
            window: agent,
            webview: agent_wv,
            role: Role::Agent,
            entry_url: agent_url.clone(),
        },
    );

    // ── Launch pad — lazy webview (View + Window controls) ──
    let launch = build_launch_window(&event_loop)?;
    place_launch_window(&launch);
    launch.set_visible(false);
    let launch_id = launch.id();
    let launch_url = format!("{lab_url}launch.html");
    let launch_wv = if eager {
        Some(build_webview(
            &launch,
            &launch_url,
            &launch_init_script(),
            Role::Launch,
            proxy.clone(),
        )?)
    } else {
        None
    };
    windows.insert(
        launch_id,
        WinPair {
            window: launch,
            webview: launch_wv,
            role: Role::Launch,
            entry_url: launch_url.clone(),
        },
    );

    // ── Browser — lazy WKWebView (simple URL surface) ──
    let browser = build_browser_window(&event_loop)?;
    place_browser_window(&browser);
    browser.set_visible(false);
    let browser_id = browser.id();
    let browser_url = format!("{lab_url}browser.html");
    let browser_wv = if eager {
        Some(build_webview(
            &browser,
            &browser_url,
            &browser_init_script(),
            Role::Browser,
            proxy.clone(),
        )?)
    } else {
        None
    };
    windows.insert(
        browser_id,
        WinPair {
            window: browser,
            webview: browser_wv,
            role: Role::Browser,
            entry_url: browser_url.clone(),
        },
    );

    // Initial dock snap + resolution cluster (geometry only; show after AppKit Init)
    {
        let mut layout = LayoutState {
            chat_docked: true,
            stream_docked: true,
            suppressing_move: false,
            clustered: false,
            snap: WorkspaceSnap::default(),
        };
        apply_launch_cluster(&mut windows, &mut layout, float);
        snap_docked(&mut windows, &mut layout);
        layout.clustered = true;
    }

    // Default: lab only. Opt in with LAB_NATIVE_SHOW_ALL=1 for chat+stream on launch.
    // (Avoid surprising "all windows open" when Grok just wants chat.)
    let show_all_on_launch = std::env::var("LAB_NATIVE_SHOW_ALL")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
        || std::env::var("LAB_NATIVE_MINIMAL")
            .map(|v| v == "0" || v.eq_ignore_ascii_case("false"))
            .unwrap_or(false);

    tracing::info!(
        lab_url = %lab_entry,
        %chat_url,
        %stream_url,
        agent_url = %agent_url,
        launch_url = %launch_url,
        browser_url = %browser_url,
        float,
        eager,
        show_all_on_launch,
        "lab webview up · chat/stream/agent/launch/browser {}",
        if eager { "eager" } else { "lazy-on-show" }
    );

    let bus_loop = bus.clone();
    let proxy_loop = proxy.clone();
    let mut layout = LayoutState {
        chat_docked: true,
        stream_docked: true,
        suppressing_move: false,
        clustered: true,
        snap: WorkspaceSnap::default(),
    };
    let mut did_launch_show = false;

    event_loop.run(move |event, _target, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            Event::NewEvents(StartCause::Init) => {
                // Re-cluster against live monitor geometry after AppKit is up.
                layout.suppressing_move = true;
                apply_launch_cluster(&mut windows, &mut layout, float);
                snap_docked(&mut windows, &mut layout);
                layout.suppressing_move = false;
                layout.clustered = true;

                if show_all_on_launch && !did_launch_show {
                    did_launch_show = true;
                    // Attach + show chat/stream so the full triple fits the display.
                    for p in windows.values_mut() {
                        if matches!(p.role, Role::Chat | Role::Stream) {
                            if let Err(e) = ensure_webview(p, &proxy_loop) {
                                tracing::warn!(role = ?p.role, %e, "launch show: webview attach failed");
                                continue;
                            }
                            p.window.set_visible(true);
                        }
                    }
                    bus_loop.set_chat_visible(true);
                    bus_loop.set_stream_visible(true);
                    layout.suppressing_move = true;
                    snap_docked(&mut windows, &mut layout);
                    layout.suppressing_move = false;
                    tracing::info!("launch show-all: lab + chat + stream fitted to work area");
                }
            }
            Event::UserEvent(cmd) => {
                // Menu / HTTP control must never panic across AppKit.
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    apply_cmd(
                        &cmd,
                        &mut windows,
                        &bus_loop,
                        &mut layout,
                        control_flow,
                        &proxy_loop,
                    )
                }));
                match result {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => bus_loop.push_error(e, "control"),
                    Err(payload) => {
                        let msg = if let Some(s) = payload.downcast_ref::<&str>() {
                            (*s).to_string()
                        } else if let Some(s) = payload.downcast_ref::<String>() {
                            s.clone()
                        } else {
                            "control panic".into()
                        };
                        eprintln!("[window] control panic caught: {msg}");
                        bus_loop.push_error(msg, "control-panic");
                    }
                }
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::Moved(_),
                ..
            } => {
                handle_moved(window_id, &mut windows, &mut layout, &bus_loop);
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::Resized(_),
                ..
            } => {
                // Lab resize re-snaps docked satellites
                if let Some(pair) = windows.get(&window_id) {
                    if pair.role == Role::Lab {
                        layout.suppressing_move = true;
                        snap_docked(&mut windows, &mut layout);
                        layout.suppressing_move = false;
                    }
                }
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::CloseRequested,
                ..
            } => {
                if let Some(pair) = windows.get(&window_id) {
                    match pair.role {
                        Role::Chat => {
                            pair.window.set_visible(false);
                            bus_loop.set_chat_visible(false);
                        }
                        Role::Stream => {
                            pair.window.set_visible(false);
                            bus_loop.set_stream_visible(false);
                        }
                        Role::Agent | Role::Launch | Role::Browser => {
                            pair.window.set_visible(false);
                        }
                        Role::Lab => {
                            *control_flow = ControlFlow::Exit;
                        }
                    }
                }
            }
            _ => {}
        }
    });
}

fn build_lab_window(
    event_loop: &tao::event_loop::EventLoop<ControlCmd>,
    float: bool,
) -> Result<Window> {
    // Frameless + custom HTML chrome — same float language as chat.
    // Min sizes are logical points (tao scales); keep modest so small laptops can resize.
    let (w, h, min_w, min_h) = if float {
        (980.0, 720.0, 480.0, 360.0)
    } else {
        (1280.0, 860.0, 640.0, 420.0)
    };

    // ASCII-only titles — avoid rare NSString edge cases with punctuation glyphs.
    let mut wb = WindowBuilder::new()
        .with_title("Grok Build Lab")
        .with_decorations(false)
        .with_resizable(true)
        // Transparent host so NSView can clip soft lab corners (not stock Apple sheet radius)
        .with_transparent(true)
        .with_always_on_top(false)
        .with_inner_size(LogicalSize::new(w, h))
        .with_min_inner_size(LogicalSize::new(min_w, min_h))
        .with_visible(true);

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        wb = wb
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_has_shadow(true);
    }

    let win = wb.build(event_loop).context("build lab window")?;
    #[cfg(target_os = "macos")]
    crate::macos_style::apply_lab_window_shape(&win);
    Ok(win)
}

/// Chat window presentation: full panel vs Siri-scale orb.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ChatSurface {
    Full,
    Orb,
}

// Full lab-ship chat: tall enough for large orb (top) + Grok Voice · eve below
const CHAT_FULL_W: f64 = 360.0;
const CHAT_FULL_H: f64 = 720.0;
// chrome 36 + controls ~70 + orb 128 + waveform ~72 + padding ≈ 340
const CHAT_ORB_W: f64 = 220.0;
const CHAT_ORB_H: f64 = 340.0;

/// Remember which windows were open before chat-only / orb focus.
fn snapshot_workspace(windows: &HashMap<WindowId, WinPair>, layout: &mut LayoutState) {
    let mut snap = WorkspaceSnap {
        chat_docked: layout.chat_docked,
        stream_docked: layout.stream_docked,
        taken: true,
        ..Default::default()
    };
    for p in windows.values() {
        let vis = p.window.is_visible();
        match p.role {
            Role::Chat => {
                snap.chat = vis;
                if p.entry_url.contains("orb.html") {
                    snap.chat_surface = "orb".into();
                } else {
                    snap.chat_surface = "full".into();
                }
            }
            Role::Stream => snap.stream = vis,
            Role::Agent => snap.agent = vis,
            Role::Launch => snap.launch = vis,
            Role::Browser => snap.browser = vis,
            Role::Lab => {}
        }
    }
    // Prefer keeping chat in restore set when we're about to solo-chat
    if !snap.chat {
        snap.chat = true;
    }
    layout.snap = snap;
    tracing::info!(
        chat = layout.snap.chat,
        stream = layout.snap.stream,
        agent = layout.snap.agent,
        surface = %layout.snap.chat_surface,
        "workspace snapshot taken"
    );
}

/// Lab button: show lab + re-open satellites that were visible before solo chat/orb.
fn restore_workspace(
    windows: &mut HashMap<WindowId, WinPair>,
    layout: &mut LayoutState,
    bus: &ControlBus,
    proxy: &EventLoopProxy<ControlCmd>,
) -> Result<(), String> {
    let snap = layout.snap.clone();
    // Always bring lab back
    for p in windows.values_mut() {
        if p.role == Role::Lab {
            ensure_webview(p, proxy)?;
            p.window.set_minimized(false);
            p.window.set_visible(true);
            p.window.set_focus();
        }
    }

    if !snap.taken {
        // No snapshot — arrange visible lab + any already-open satellites
        layout.suppressing_move = true;
        arrange_workspace(windows, layout);
        layout.suppressing_move = false;
        tracing::info!("restore_workspace: no snap · arranged lab");
        return Ok(());
    }

    layout.chat_docked = snap.chat_docked;
    layout.stream_docked = snap.stream_docked;
    bus.set_chat_docked(snap.chat_docked);
    bus.set_stream_docked(snap.stream_docked);

    let show = |role: Role, on: bool| -> bool { on };

    for p in windows.values_mut() {
        match p.role {
            Role::Chat if show(Role::Chat, snap.chat) => {
                // Keep current chat surface (orb/full) from snap
                let base = {
                    let u = p.entry_url.as_str();
                    if let Some(i) = u.rfind('/') {
                        u[..=i].to_string()
                    } else {
                        u.to_string()
                    }
                };
                let want_orb = snap.chat_surface == "orb";
                let url = if want_orb {
                    format!("{base}orb.html")
                } else {
                    format!("{base}chat.html")
                };
                if p.entry_url != url {
                    p.entry_url = url.clone();
                    ensure_webview(p, proxy)?;
                    if let Some(wv) = p.webview.as_ref() {
                        let _ = wv.load_url(&url);
                    }
                } else {
                    ensure_webview(p, proxy)?;
                }
                p.window.set_minimized(false);
                p.window.set_visible(true);
                bus.set_chat_visible(true);
            }
            Role::Stream if show(Role::Stream, snap.stream) => {
                ensure_webview(p, proxy)?;
                p.window.set_minimized(false);
                p.window.set_visible(true);
                bus.set_stream_visible(true);
            }
            Role::Agent if show(Role::Agent, snap.agent) => {
                ensure_webview(p, proxy)?;
                p.window.set_minimized(false);
                p.window.set_visible(true);
            }
            Role::Launch if show(Role::Launch, snap.launch) => {
                ensure_webview(p, proxy)?;
                p.window.set_minimized(false);
                p.window.set_visible(true);
            }
            Role::Browser if show(Role::Browser, snap.browser) => {
                ensure_webview(p, proxy)?;
                p.window.set_minimized(false);
                p.window.set_visible(true);
            }
            Role::Chat if !snap.chat => {
                p.window.set_visible(false);
                bus.set_chat_visible(false);
            }
            Role::Stream if !snap.stream => {
                p.window.set_visible(false);
                bus.set_stream_visible(false);
            }
            Role::Agent if !snap.agent => p.window.set_visible(false),
            Role::Launch if !snap.launch => p.window.set_visible(false),
            Role::Browser if !snap.browser => p.window.set_visible(false),
            _ => {}
        }
    }

    layout.suppressing_move = true;
    if layout.chat_docked || layout.stream_docked {
        snap_docked(windows, layout);
    } else {
        arrange_workspace(windows, layout);
    }
    layout.suppressing_move = false;
    tracing::info!(
        chat = snap.chat,
        stream = snap.stream,
        agent = snap.agent,
        launch = snap.launch,
        browser = snap.browser,
        "workspace restored"
    );
    Ok(())
}

fn apply_chat_surface(
    windows: &mut HashMap<WindowId, WinPair>,
    layout: &mut LayoutState,
    bus: &ControlBus,
    proxy: &EventLoopProxy<ControlCmd>,
    surface: ChatSurface,
) -> Result<(), String> {
    // Capture multi-window state so Lab button can restore it
    snapshot_workspace(windows, layout);

    layout.chat_docked = false;
    layout.stream_docked = false;
    bus.set_chat_docked(false);
    bus.set_stream_docked(false);
    bus.set_stream_visible(false);

    // Base URL from chat entry (…/chat.html or …/orb.html → …/)
    let base = windows
        .values()
        .find(|p| p.role == Role::Chat)
        .map(|p| {
            let u = p.entry_url.as_str();
            // Strip last path segment
            if let Some(i) = u.rfind('/') {
                u[..=i].to_string()
            } else {
                u.to_string()
            }
        })
        .unwrap_or_else(|| "http://127.0.0.1:8765/".into());

    let (url, w, h, min_w, min_h) = match surface {
        ChatSurface::Orb => (
            format!("{base}orb.html"),
            CHAT_ORB_W,
            CHAT_ORB_H,
            200.0,
            300.0,
        ),
        ChatSurface::Full => (
            format!("{base}chat.html"),
            CHAT_FULL_W,
            CHAT_FULL_H,
            220.0,
            320.0,
        ),
    };

    for p in windows.values_mut() {
        match p.role {
            Role::Chat => {
                p.entry_url = url.clone();
                ensure_webview(p, proxy)?;
                if let Some(wv) = p.webview.as_ref() {
                    let _ = wv.load_url(&url);
                }

                // Size in logical points first (tao/macOS DPI-safe), then re-assert
                // physical after show so Retina doesn't keep a stale full-chat size.
                let scale = p
                    .window
                    .current_monitor()
                    .map(|m| m.scale_factor())
                    .unwrap_or(1.0)
                    .max(0.5);
                p.window
                    .set_min_inner_size(Some(LogicalSize::new(min_w, min_h)));
                // Clear any huge max from prior full-chat session
                p.window.set_max_inner_size::<LogicalSize<f64>>(None);
                p.window.set_inner_size(LogicalSize::new(w, h));
                // Explicit physical pass (avoids 0×0 / stale after load_url)
                let pw = (w * scale).round().max(1.0) as u32;
                let ph = (h * scale).round().max(1.0) as u32;
                p.window.set_inner_size(PhysicalSize::new(pw, ph));

                if let Some(m) = p.window.current_monitor() {
                    // Prefer visible work area so menu bar / dock don't clip.
                    let wa = detect_work_area(&p.window);
                    let margin_x = wa.phys_i(16.0).max(12);
                    // Full chat: pin to TOP of work area (above terminal feeds / agent band).
                    // Orb chat: keep lower-right float so it stays Siri-thumb reachable.
                    let (x, y) = match surface {
                        ChatSurface::Full => {
                            let x = (wa.x + wa.w as i32 - pw as i32 - margin_x).max(wa.x + 8);
                            let y = wa.y + wa.phys_i(10.0).max(8);
                            (x, y)
                        }
                        ChatSurface::Orb => {
                            let x = (wa.x + wa.w as i32 - pw as i32 - margin_x).max(wa.x + 8);
                            let y = (wa.y + wa.h as i32 - ph as i32 - wa.phys_i(20.0)).max(wa.y + 40);
                            (x, y)
                        }
                    };
                    p.window
                        .set_outer_position(PhysicalPosition::new(x, y));
                }

                p.window.set_visible(true);
                p.window.set_minimized(false);
                p.window.set_always_on_top(true);
                // Second size assert after visibility (AppKit sometimes ignores pre-show)
                p.window.set_inner_size(LogicalSize::new(w, h));
                p.window.set_focus();
                bus.set_chat_visible(true);
                #[cfg(target_os = "macos")]
                crate::macos_style::apply_lab_window_shape(&p.window);
                tracing::info!(
                    surface = ?surface,
                    w,
                    h,
                    scale,
                    url = %url,
                    "chat surface sized"
                );
            }
            Role::Lab => {
                p.window.set_minimized(false);
                p.window.set_visible(false);
            }
            Role::Stream | Role::Agent | Role::Launch | Role::Browser => {
                p.window.set_visible(false);
            }
        }
    }
    Ok(())
}

fn build_chat_window(event_loop: &tao::event_loop::EventLoop<ControlCmd>) -> Result<Window> {
    let mut wb = WindowBuilder::new()
        .with_title("Grok")
        .with_decorations(false)
        .with_always_on_top(true)
        .with_resizable(true)
        .with_transparent(true)
        // Default small; ChatOrb / ChatFull resize on demand
        .with_inner_size(LogicalSize::new(CHAT_ORB_W, CHAT_ORB_H))
        .with_min_inner_size(LogicalSize::new(160.0, 200.0))
        .with_visible(false);

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        wb = wb
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_has_shadow(true);
    }

    let win = wb.build(event_loop).context("build chat window")?;
    #[cfg(target_os = "macos")]
    crate::macos_style::apply_lab_window_shape(&win);
    Ok(win)
}

fn build_agent_window(event_loop: &tao::event_loop::EventLoop<ControlCmd>) -> Result<Window> {
    // Large agent console: center chat + three feeds (Cursor / agentcn layout)
    let mut wb = WindowBuilder::new()
        .with_title("Grok Build Lab - Agent Console")
        .with_decorations(false)
        .with_always_on_top(false)
        .with_resizable(true)
        .with_transparent(true)
        .with_inner_size(LogicalSize::new(1180.0, 760.0))
        .with_min_inner_size(LogicalSize::new(640.0, 420.0))
        .with_visible(false);

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        wb = wb
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_has_shadow(true);
    }

    let win = wb.build(event_loop).context("build agent window")?;
    #[cfg(target_os = "macos")]
    crate::macos_style::apply_lab_window_shape(&win);
    Ok(win)
}

fn place_agent_window(window: &Window) {
    if let Some(m) = window.current_monitor() {
        let screen = m.size();
        let size = window.outer_size();
        let x = ((screen.width as i32 - size.width as i32) / 2).max(24);
        let y = ((screen.height as i32 - size.height as i32) / 2).max(40);
        window.set_outer_position(PhysicalPosition::new(x, y));
    } else {
        window.set_outer_position(LogicalPosition::new(80.0, 60.0));
    }
}

fn build_launch_window(event_loop: &tao::event_loop::EventLoop<ControlCmd>) -> Result<Window> {
    // Compact launch pad — View + Window controls
    let mut wb = WindowBuilder::new()
        .with_title("Grok Build Lab - Launch Pad")
        .with_decorations(false)
        .with_always_on_top(true)
        .with_resizable(true)
        .with_transparent(true)
        .with_inner_size(LogicalSize::new(520.0, 640.0))
        .with_min_inner_size(LogicalSize::new(320.0, 360.0))
        .with_visible(false);

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        wb = wb
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_has_shadow(true);
    }

    let win = wb.build(event_loop).context("build launch window")?;
    #[cfg(target_os = "macos")]
    crate::macos_style::apply_lab_window_shape(&win);
    Ok(win)
}

fn place_launch_window(window: &Window) {
    if let Some(m) = window.current_monitor() {
        let screen = m.size();
        let size = window.outer_size();
        // Upper-right-ish so it doesn't cover lab center
        let x = (screen.width as i32 - size.width as i32 - 40).max(24);
        let y = 56i32;
        window.set_outer_position(PhysicalPosition::new(x, y));
    } else {
        window.set_outer_position(LogicalPosition::new(100.0, 56.0));
    }
}

fn agent_init_script() -> String {
    let chrome = float_chrome_js("agent");
    format!(
        r##"
{chrome}
document.documentElement.classList.add("lab-native","lab-agent-surface");
function __labMarkAgentBody(){{
  if (document.body) {{
    document.body.classList.add("lab-native","lab-agent-surface","ac-body");
  }}
}}
__labMarkAgentBody();
document.addEventListener("DOMContentLoaded", __labMarkAgentBody);
window.LabDesktop = Object.assign(window.LabDesktop || {{}}, {{
  isDesktop: true, isNative: true, isAgentWindow: true, shell: "wry-agent", floatChrome: true,
  control: function(action, extra){{
    return fetch("/api/control", {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify(Object.assign({{ action: action, target: "agent" }}, extra || {{}}))
    }}).then(function(r){{ return r.json(); }});
  }}
}});
"##
    )
}

fn launch_init_script() -> String {
    let chrome = float_chrome_js("launch");
    format!(
        r##"
{chrome}
document.documentElement.classList.add("lab-native","lab-launch-surface");
function __labMarkLaunchBody(){{
  if (document.body) {{
    document.body.classList.add("lab-native","lab-launch-surface","lp-body");
  }}
}}
__labMarkLaunchBody();
document.addEventListener("DOMContentLoaded", __labMarkLaunchBody);
window.LabDesktop = Object.assign(window.LabDesktop || {{}}, {{
  isDesktop: true, isNative: true, isLaunchWindow: true, shell: "wry-launch", floatChrome: true,
  control: function(action, extra){{
    return fetch("/api/control", {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify(Object.assign({{ action: action, target: "launch" }}, extra || {{}}))
    }}).then(function(r){{ return r.json(); }});
  }}
}});
"##
    )
}

fn build_browser_window(event_loop: &tao::event_loop::EventLoop<ControlCmd>) -> Result<Window> {
    let mut wb = WindowBuilder::new()
        .with_title("Grok Build Lab - Browser")
        .with_decorations(false)
        .with_always_on_top(false)
        .with_resizable(true)
        .with_transparent(true)
        .with_inner_size(LogicalSize::new(960.0, 700.0))
        .with_min_inner_size(LogicalSize::new(480.0, 360.0))
        .with_visible(false);

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        wb = wb
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_has_shadow(true);
    }

    let win = wb.build(event_loop).context("build browser window")?;
    #[cfg(target_os = "macos")]
    crate::macos_style::apply_lab_window_shape(&win);
    Ok(win)
}

fn place_browser_window(window: &Window) {
    if let Some(m) = window.current_monitor() {
        let screen = m.size();
        let size = window.outer_size();
        let x = (screen.width as i32 - size.width as i32 - 36).max(24);
        let y = ((screen.height as i32 - size.height as i32) / 2).max(48);
        window.set_outer_position(PhysicalPosition::new(x, y));
    } else {
        window.set_outer_position(LogicalPosition::new(120.0, 80.0));
    }
}

fn browser_init_script() -> String {
    let chrome = float_chrome_js("browser");
    format!(
        r##"
{chrome}
document.documentElement.classList.add("lab-native","lab-browser-surface");
function __labMarkBrowserBody(){{
  if (document.body) {{
    document.body.classList.add("lab-native","lab-browser-surface","br-body");
  }}
}}
__labMarkBrowserBody();
document.addEventListener("DOMContentLoaded", __labMarkBrowserBody);
window.LabDesktop = Object.assign(window.LabDesktop || {{}}, {{
  isDesktop: true, isNative: true, isBrowserWindow: true, shell: "wry-browser", floatChrome: true,
  control: function(action, extra){{
    return fetch("/api/control", {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify(Object.assign({{ action: action, target: "browser" }}, extra || {{}}))
    }}).then(function(r){{ return r.json(); }});
  }}
}});
"##
    )
}

/// Resolution-aware first-launch cluster — fills the **visible** work area.
/// Uses logical proportions × scale so Retina displays get full-size shells
/// (not half-size from treating physical px as points).
fn apply_launch_cluster(
    windows: &mut HashMap<WindowId, WinPair>,
    layout: &mut LayoutState,
    float: bool,
) {
    let Some(lab) = lab_pair(windows) else {
        return;
    };
    let wa = detect_work_area(&lab.window);
    let margin_l = 12.0_f64; // logical points
    let gap_l = 10.0_f64;
    let lw_pts = wa.logical_w();
    let lh_pts = wa.logical_h();

    // Side shells scale with display width (logical).
    let side_pts = if lw_pts >= 1600.0 {
        380.0
    } else if lw_pts >= 1400.0 {
        340.0
    } else if lw_pts >= 1200.0 {
        300.0
    } else if lw_pts >= 1000.0 {
        260.0
    } else {
        220.0
    };

    // Main lab: remaining width after two flanks; height ~78–86% of work area.
    let lab_w_pts = (lw_pts - side_pts * 2.0 - gap_l * 2.0 - margin_l * 2.0)
        .clamp(if float { 520.0 } else { 640.0 }, if float { 1400.0 } else { 1600.0 });
    let lab_h_pts = (lh_pts * if float { 0.82 } else { 0.88 })
        .clamp(420.0, lh_pts - margin_l * 2.0 - 40.0);

    let side_w = wa.phys(side_pts);
    let lab_w = wa.phys(lab_w_pts);
    let lab_h = wa.phys(lab_h_pts);
    let gap = wa.phys_i(gap_l).max(DOCK_GAP);
    let margin = wa.phys_i(margin_l).max(8);

    // Center the triple cluster in the work area.
    let cluster_w = side_w as i32 * 2 + lab_w as i32 + gap * 2;
    let lab_x = wa.x + ((wa.w - cluster_w) / 2).max(margin) + side_w as i32 + gap;
    let lab_y = wa.y + margin;

    for p in windows.values() {
        match p.role {
            Role::Lab => {
                p.window
                    .set_inner_size(PhysicalSize::new(lab_w, lab_h));
                p.window
                    .set_outer_position(PhysicalPosition::new(lab_x, lab_y));
            }
            Role::Chat => {
                let ch = lab_h.saturating_sub(wa.phys(4.0)).max(wa.phys(360.0));
                p.window
                    .set_inner_size(PhysicalSize::new(side_w, ch));
                p.window.set_outer_position(PhysicalPosition::new(
                    lab_x + lab_w as i32 + gap,
                    lab_y,
                ));
            }
            Role::Stream => {
                let shh = lab_h.saturating_sub(wa.phys(4.0)).max(wa.phys(320.0));
                p.window
                    .set_inner_size(PhysicalSize::new(side_w, shh));
                p.window.set_outer_position(PhysicalPosition::new(
                    (lab_x - side_w as i32 - gap).max(wa.x + margin),
                    lab_y,
                ));
            }
            Role::Agent => {
                // Park below lab, full cluster width, remaining height.
                let aw = (cluster_w as u32).min((wa.w - margin * 2) as u32);
                let rest = (wa.y + wa.h - (lab_y + lab_h as i32) - gap - margin).max(0) as u32;
                let ah = rest.clamp(wa.phys(240.0), wa.phys(420.0));
                let ax = (lab_x - side_w as i32 - gap).max(wa.x + margin);
                let ay = lab_y + lab_h as i32 + gap;
                p.window.set_inner_size(PhysicalSize::new(aw, ah));
                p.window
                    .set_outer_position(PhysicalPosition::new(ax, ay));
            }
            Role::Launch => {
                let lw = wa.phys(420.0).min(wa.phys(lw_pts * 0.28));
                let lh = wa.phys(520.0).min((wa.h as u32).saturating_sub(wa.phys(80.0)));
                p.window.set_inner_size(PhysicalSize::new(lw, lh));
                p.window.set_outer_position(PhysicalPosition::new(
                    wa.x + wa.w - lw as i32 - margin,
                    wa.y + margin,
                ));
            }
            Role::Browser => {
                let bw = wa.phys((lw_pts * 0.48).clamp(560.0, 1100.0));
                let bh = wa.phys((lh_pts * 0.62).clamp(420.0, 860.0));
                p.window.set_inner_size(PhysicalSize::new(bw, bh));
                p.window.set_outer_position(PhysicalPosition::new(
                    wa.x + wa.w - bw as i32 - margin,
                    wa.y + ((wa.h - bh as i32) / 2).max(margin),
                ));
            }
        }
    }
    layout.chat_docked = true;
    layout.stream_docked = true;
    tracing::info!(
        wa_w = wa.w,
        wa_h = wa.h,
        scale = wa.scale,
        lab_w,
        lab_h,
        side_w,
        lab_w_pts,
        lab_h_pts,
        "launch cluster applied (work-area fit)"
    );
}

fn build_stream_window(event_loop: &tao::event_loop::EventLoop<ControlCmd>) -> Result<Window> {
    let mut wb = WindowBuilder::new()
        .with_title("Grok Build Lab - Stream")
        .with_decorations(false)
        .with_always_on_top(false)
        .with_resizable(true)
        .with_transparent(true)
        .with_inner_size(LogicalSize::new(420.0, 520.0))
        .with_min_inner_size(LogicalSize::new(220.0, 280.0))
        .with_visible(false);

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        wb = wb
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_has_shadow(true);
    }

    let win = wb.build(event_loop).context("build stream window")?;
    #[cfg(target_os = "macos")]
    crate::macos_style::apply_lab_window_shape(&win);
    Ok(win)
}

fn build_webview(
    window: &Window,
    url: &str,
    init: &str,
    role: Role,
    proxy: EventLoopProxy<ControlCmd>,
) -> Result<wry::WebView> {
    let target = role.target();
    let handler = move |req: Request<String>| {
        handle_ipc(req.body(), target, &proxy);
    };

    // Inject lab rounded-chrome CSS early (works with transparent host window).
    let round_css = lab_round_init_js();
    let full_init = format!("{round_css}\n{init}");

    let builder = WebViewBuilder::new()
        .with_url(url)
        .with_initialization_script(&full_init)
        .with_transparent(true)
        .with_ipc_handler(handler)
        .with_accept_first_mouse(true)
        .with_devtools(cfg!(debug_assertions));

    #[cfg(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    ))]
    {
        // Re-assert rounded NSView clip after WKWebView attaches (lazy satellites).
        #[cfg(target_os = "macos")]
        crate::macos_style::apply_lab_window_shape(window);
        builder.build(window).context("build webview")
    }

    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    )))]
    {
        use tao::platform::unix::WindowExtUnix;
        use wry::WebViewBuilderExtUnix;
        let vbox = window.default_vbox().unwrap();
        builder.build_gtk(vbox).context("build gtk webview")
    }
}

fn handle_ipc(body: &str, target: WinTarget, proxy: &EventLoopProxy<ControlCmd>) {
    let mut parts = body.split([':', ',']);
    let cmd = parts.next().unwrap_or("").trim();
    match cmd {
        "drag" | "drag_window" => {
            let _ = proxy.send_event(ControlCmd::DragWindow { target });
        }
        "minimize" | "min" => {
            let _ = proxy.send_event(ControlCmd::Minimize { target });
        }
        "maximize" | "max" => {
            let _ = proxy.send_event(ControlCmd::Maximize { target });
        }
        "close" => {
            let _ = proxy.send_event(ControlCmd::Close { target });
        }
        "edge_down" => {
            if let (Some(x), Some(y)) = (
                parts.next().and_then(|s| s.parse::<i32>().ok()),
                parts.next().and_then(|s| s.parse::<i32>().ok()),
            ) {
                // Negative x encodes edge press (see CursorHit in apply_cmd)
                let _ = proxy.send_event(ControlCmd::CursorHit {
                    target,
                    x: -x - 1,
                    y,
                });
            }
        }
        "mousemove" => {
            if let (Some(x), Some(y)) = (
                parts.next().and_then(|s| s.parse::<i32>().ok()),
                parts.next().and_then(|s| s.parse::<i32>().ok()),
            ) {
                let _ = proxy.send_event(ControlCmd::CursorHit { target, x, y });
            }
        }
        "show_chat" | "open_chat" => {
            let _ = proxy.send_event(ControlCmd::ShowChat);
        }
        "open_chat_independent" | "chat_only" => {
            let _ = proxy.send_event(ControlCmd::OpenChatIndependent);
        }
        "hide_chat" => {
            let _ = proxy.send_event(ControlCmd::HideChat);
        }
        "toggle_chat" => {
            let _ = proxy.send_event(ControlCmd::ToggleChat);
        }
        "show_stream" | "open_stream" => {
            let _ = proxy.send_event(ControlCmd::ShowStream);
        }
        "hide_stream" => {
            let _ = proxy.send_event(ControlCmd::HideStream);
        }
        "toggle_stream" => {
            let _ = proxy.send_event(ControlCmd::ToggleStream);
        }
        "show_agent" | "open_agent" | "agent" | "agent_console" => {
            let _ = proxy.send_event(ControlCmd::ShowAgent);
        }
        "hide_agent" | "close_agent" => {
            let _ = proxy.send_event(ControlCmd::HideAgent);
        }
        "toggle_agent" => {
            let _ = proxy.send_event(ControlCmd::ToggleAgent);
        }
        "focus_agent" => {
            let _ = proxy.send_event(ControlCmd::FocusAgent);
        }
        "show_launch" | "open_launch" | "launch" | "launch_pad" => {
            let _ = proxy.send_event(ControlCmd::ShowLaunch);
        }
        "hide_launch" | "close_launch" => {
            let _ = proxy.send_event(ControlCmd::HideLaunch);
        }
        "toggle_launch" => {
            let _ = proxy.send_event(ControlCmd::ToggleLaunch);
        }
        "focus_launch" => {
            let _ = proxy.send_event(ControlCmd::FocusLaunch);
        }
        "show_browser" | "open_browser" | "browser" | "web" => {
            let _ = proxy.send_event(ControlCmd::ShowBrowser);
        }
        "hide_browser" | "close_browser" => {
            let _ = proxy.send_event(ControlCmd::HideBrowser);
        }
        "toggle_browser" => {
            let _ = proxy.send_event(ControlCmd::ToggleBrowser);
        }
        "focus_browser" => {
            let _ = proxy.send_event(ControlCmd::FocusBrowser);
        }
        "dock" | "dock_window" => {
            let _ = proxy.send_event(ControlCmd::Dock { target });
        }
        "undock" | "undock_window" => {
            let _ = proxy.send_event(ControlCmd::Undock { target });
        }
        "dock_chat" => {
            let _ = proxy.send_event(ControlCmd::Dock {
                target: WinTarget::Chat,
            });
        }
        "undock_chat" => {
            let _ = proxy.send_event(ControlCmd::Undock {
                target: WinTarget::Chat,
            });
        }
        "dock_stream" => {
            let _ = proxy.send_event(ControlCmd::Dock {
                target: WinTarget::Stream,
            });
        }
        "undock_stream" => {
            let _ = proxy.send_event(ControlCmd::Undock {
                target: WinTarget::Stream,
            });
        }
        "link_all" | "dock_all" => {
            let _ = proxy.send_event(ControlCmd::LinkAll);
        }
        "unlink_all" | "undock_all" => {
            let _ = proxy.send_event(ControlCmd::UnlinkAll);
        }
        "arrange" | "organize" | "tidy" | "layout" => {
            let _ = proxy.send_event(ControlCmd::Arrange);
        }
        "center" => {
            let _ = proxy.send_event(ControlCmd::Center { target });
        }
        "pin" => {
            let _ = proxy.send_event(ControlCmd::SetAlwaysOnTop {
                target,
                on: true,
            });
        }
        "unpin" => {
            let _ = proxy.send_event(ControlCmd::SetAlwaysOnTop {
                target,
                on: false,
            });
        }
        "refresh" => {
            let _ = proxy.send_event(ControlCmd::Refresh { target });
        }
        _ => {}
    }
}

/// Attach WKWebView on first use (chat/stream). Lab is always eager.
fn ensure_webview(
    pair: &mut WinPair,
    proxy: &EventLoopProxy<ControlCmd>,
) -> Result<(), String> {
    if pair.webview.is_some() {
        return Ok(());
    }
    let init = match pair.role {
        Role::Lab => lab_init_script(),
        Role::Chat => chat_init_script(),
        Role::Stream => stream_init_script(),
        Role::Agent => agent_init_script(),
        Role::Launch => launch_init_script(),
        Role::Browser => browser_init_script(),
    };
    let url = pair.entry_url.clone();
    if url.is_empty() {
        return Err("empty entry_url".into());
    }
    // Guard: only ASCII-printable for the load URL (path is always http localhost).
    if !url.bytes().all(|b| b.is_ascii_graphic() || b == b'/' || b == b':' || b == b'#' || b == b'?' || b == b'&' || b == b'=' || b == b'.' || b == b'-' || b == b'_' || b == b'%') {
        return Err(format!("refusing non-ASCII entry_url: {url}"));
    }
    tracing::info!(role = ?pair.role, %url, "lazy-attaching webview");
    let wv = build_webview(&pair.window, &url, &init, pair.role, proxy.clone())
        .map_err(|e| format!("build webview: {e:#}"))?;
    pair.webview = Some(wv);
    Ok(())
}

/// Safe webview JS eval — never pass empty; swallow WK errors without panic.
fn safe_eval(webview: &wry::WebView, script: &str) -> Result<(), String> {
    if script.is_empty() {
        return Err("empty script".into());
    }
    // Avoid pathological scripts that have crashed WK/NSString on some Macs.
    if script.len() > 512_000 {
        return Err("script too large".into());
    }
    if script.bytes().any(|b| b == 0) {
        return Err("script contains NUL".into());
    }
    // catch_unwind won't catch ObjC SIGSEGV, but Result covers Rust-side failures.
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        webview.evaluate_script(script)
    }));
    match r {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => Err(format!("{e}")),
        Err(_) => Err("evaluate_script panicked".into()),
    }
}

/// Reload via load_url (stable) instead of location.reload() evaluate_script.
fn safe_reload(pair: &WinPair) -> Result<(), String> {
    let Some(webview) = pair.webview.as_ref() else {
        return Err("webview not attached yet".into());
    };
    let base = if !pair.entry_url.is_empty() {
        pair.entry_url.clone()
    } else {
        webview.url().map_err(|e| format!("url: {e}"))?
    };
    if base.is_empty() {
        return Err("no url to reload".into());
    }
    let bust = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    // Preserve hash fragment (lab routes live in #/…)
    let reload_url = if let Some((head, hash)) = base.split_once('#') {
        let head = head.trim_end_matches('&').trim_end_matches('?');
        let sep = if head.contains('?') { '&' } else { '?' };
        format!("{head}{sep}_r={bust}#{hash}")
    } else {
        let sep = if base.contains('?') { '&' } else { '?' };
        format!("{base}{sep}_r={bust}")
    };
    webview
        .load_url(&reload_url)
        .map_err(|e| format!("load_url: {e}"))
}

fn lab_round_init_js() -> String {
    #[cfg(target_os = "macos")]
    let css = crate::macos_style::lab_round_css();
    #[cfg(not(target_os = "macos"))]
    let css = "/* lab corners: webview-only on non-macOS */ body{border-radius:12px;overflow:hidden}";
    // Escape for embedding in JS string via template
    let css_escaped = css.replace('\\', "\\\\").replace('`', "\\`");
    format!(
        r##"
(function(){{
  try {{
    var st = document.createElement("style");
    st.id = "lab-round-chrome";
    st.textContent = `{css}`;
    (document.head || document.documentElement).appendChild(st);
  }} catch (e) {{}}
}})();
"##,
        css = css_escaped
    )
}

/// Shared float-chrome JS: drag titlebar, edge resize, traffic controls.
fn float_chrome_js(role: &str) -> String {
    // r## so strings like "/api/..." and "#id" never terminate the raw string.
    format!(
        r##"
(function(){{
  if (window.__labFloatChrome) return;
  window.__labFloatChrome = true;
  var ROLE = "{role}";
  function ipc(msg) {{
    try {{
      if (window.ipc && window.ipc.postMessage) window.ipc.postMessage(msg);
    }} catch (e) {{}}
  }}
  window.LabNative = Object.assign(window.LabNative || {{}}, {{
    role: ROLE,
    ipc: ipc,
    drag: function(){{ ipc("drag"); }},
    control: function(action, extra){{
      return fetch("/api/control", {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify(Object.assign({{ action: action, target: ROLE }}, extra || {{}}))
      }}).then(function(r){{ return r.json(); }});
    }}
  }});

  // Throttle edge cursor probes — full-document mousemove flooded the event loop
  // and contributed to freezes/crashes with multiple WKWebViews.
  // Edge band for resize (CSS px). Keep narrow so scrollports near edges still work.
  var __labMoveAt = 0;
  var EDGE = 10;
  function isScrollPort(t) {{
    return !!(t && t.closest && t.closest(
      ".ac-scroll, .ac-feed-body, .content-wrap, #panel-docs, .article, .wb-scroll, .stream-body, .sv-stage, .sv-list, pre, code, textarea, [data-scroll], .lp-scroll, .br-frame"
    ));
  }}
  function nearEdge(e) {{
    var m = EDGE;
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    return e.clientX <= m || e.clientX >= w - m || e.clientY <= m || e.clientY >= h - m;
  }}
  document.addEventListener("mousemove", function(e){{
    var now = Date.now();
    if (now - __labMoveAt < 40) return;
    __labMoveAt = now;
    if (!nearEdge(e)) return;
    // Don't fight scrollports with resize cursors
    if (isScrollPort(e.target) && !nearEdge(e)) return;
    try {{ ipc("mousemove:" + e.clientX + "," + e.clientY); }} catch (err) {{}}
  }}, true);

  document.addEventListener("mousedown", function(e){{
    if (e.button !== 0) return;
    var t = e.target;
    // Never steal wheel/scroll interactions inside scrollports (unless true rim).
    if (isScrollPort(t) && !nearEdge(e)) return;
    // Stoplights / chrome controls: never steal for drag; allow button handlers
    if (t && t.closest && t.closest("[data-no-drag], .tl, .lnb-tl, .lights, .lnb-lights, button, a, input, textarea, select, pre, video, .ac-scroll, .ac-feed-body, .content-wrap, #panel-docs, .article, .wb-scroll, .stream-body, .sv-stage")) {{
      // Still allow pure edge resize if press is on the very rim (not on a button)
      if (t.closest && t.closest("button, a, input, textarea, select, .tl, .lnb-tl")) return;
      // Scrollport interior: leave alone (let wheel / drag-select work)
      if (isScrollPort(t) && !nearEdge(e)) return;
    }}
    // Explicit resize grips
    var grip = t && t.closest ? t.closest("[data-resize]") : null;
    if (grip) {{
      try {{ ipc("edge_down:" + e.clientX + "," + e.clientY); }} catch (err) {{}}
      e.preventDefault();
      e.stopPropagation();
      return;
    }}
    var dragEl = t && t.closest ? t.closest("[data-drag-region]") : null;
    if (dragEl) {{
      if (nearEdge(e)) {{
        try {{ ipc("edge_down:" + e.clientX + "," + e.clientY); }} catch (err) {{}}
        e.preventDefault();
        return;
      }}
      if (e.detail === 2) {{
        ipc("maximize");
      }} else {{
        ipc("drag");
      }}
      e.preventDefault();
      return;
    }}
    // Edge resize only on true border (not deep into scroll content)
    if (nearEdge(e)) {{
      try {{ ipc("edge_down:" + e.clientX + "," + e.clientY); }} catch (err) {{}}
    }}
  }}, true);

  document.addEventListener("touchstart", function(e){{
    var t = e.target;
    if (t && t.closest && t.closest("[data-drag-region]")) ipc("drag");
  }}, {{ passive: true }});
}})();
"##,
        role = role
    )
}

fn lab_init_script() -> String {
    let chrome = float_chrome_js("lab");
    format!(
        r##"
{chrome}
document.documentElement.classList.add("lab-native","lab-desktop","lab-float");
document.addEventListener("DOMContentLoaded", function(){{
  document.body && document.body.classList.add("lab-native","lab-desktop","lab-float");
  // Float shell: collapse left rail by default for content room
  if (localStorage.getItem("lab.sidebarCollapsed") === null) {{
    document.body.classList.add("sidebar-collapsed");
    try {{ localStorage.setItem("lab.sidebarCollapsed", "1"); }} catch (e) {{}}
  }}
  var s = document.getElementById("siri-burst");
  if (s) {{ s.classList.add("siri-hidden"); s.style.display = "none"; }}
  var peek = document.getElementById("siri-burst-peek");
  if (peek) peek.style.display = "none";

  if (!document.getElementById("lab-native-bar")) {{
    var bar = document.createElement("div");
    bar.id = "lab-native-bar";
    bar.setAttribute("data-drag-region", "1");
    bar.innerHTML =
      '<div class="lnb-lights" data-no-drag>' +
        '<button type="button" class="lnb-tl close" data-ipc="close" title="Close"></button>' +
        '<button type="button" class="lnb-tl min" data-ipc="minimize" title="Minimize"></button>' +
        '<button type="button" class="lnb-tl max" data-ipc="maximize" title="Zoom"></button>' +
      '</div>' +
      '<span class="lnb-dot"></span>' +
      '<span class="lnb-title">Grok Build Lab</span>' + // ASCII title
      '<span class="lnb-sp"></span>' +
      '<button type="button" class="lnb-btn primary" data-c="open_launch" data-no-drag title="Launch pad · View + Window controls">Launch</button>' +
      '<button type="button" class="lnb-btn primary" data-c="show_chat" data-no-drag title="Open chat (Cmd+2)">Chat</button>' +
      '<button type="button" class="lnb-btn primary" data-c="show_stream" data-no-drag title="Open stream only (does not move chat)">Stream</button>' +
      '<button type="button" class="lnb-btn primary" data-c="open_agent" data-no-drag title="Agent console · center chat + αβγ feeds">Agent</button>' +
      '<button type="button" class="lnb-btn primary" data-c="open_browser" data-no-drag title="Lab browser · system WebKit">Web</button>' +
      '<button type="button" class="lnb-btn primary" data-c="open_panda" data-no-drag title="Multi-term · αβγ Terminals (Cmd+Shift+P)">Multi</button>' +
      '<button type="button" class="lnb-btn primary" data-c="arrange" data-no-drag title="Cluster all visible windows">Arrange</button>' +
      '<button type="button" class="lnb-btn" data-c="link_all" data-no-drag title="Dock chat + stream to lab flanks">Dock</button>' +
      '<button type="button" class="lnb-btn" data-c="unlink_all" data-no-drag title="Undock chat + stream (free float)">Undock</button>' +
      '<button type="button" class="lnb-btn" data-c="center" data-t="lab" data-no-drag title="Center">Ctr</button>' +
      '<button type="button" class="lnb-btn" data-c="pin" data-t="lab" data-no-drag title="Always on top" id="lnb-pin">Pin</button>' +
      '<button type="button" class="lnb-btn" data-c="refresh" data-t="lab" data-no-drag title="Refresh">R</button>';
    document.body.prepend(bar);

    var st = document.createElement("style");
    st.textContent = [
      "html,body.lab-float{{background:#0b0c0f!important}}",
      "#lab-native-bar{{position:fixed;top:0;left:0;right:0;z-index:250;height:40px;display:flex;align-items:center;gap:8px;",
      "padding:0 12px 0 14px;user-select:none;cursor:default;",
      "background:rgba(11,12,15,.72);backdrop-filter:blur(16px) saturate(1.25);-webkit-backdrop-filter:blur(16px) saturate(1.25);",
      "border-bottom:1px solid rgba(255,255,255,.06);",
      "box-shadow:0 1px 0 rgba(110,203,255,.04);",
      "font:11px ui-monospace,Menlo,monospace;color:#8b93a7}}",
      "#lab-native-bar .lnb-lights{{display:flex;align-items:center;gap:7px;margin-right:6px}}",
      "#lab-native-bar .lnb-tl{{appearance:none;width:12px;height:12px;border-radius:50%;border:0;padding:0;cursor:pointer;",
      "box-shadow:inset 0 0 0 0.5px rgba(0,0,0,.25)}}",
      "#lab-native-bar .lnb-tl.close{{background:#ff5f57}}#lab-native-bar .lnb-tl.min{{background:#febc2e}}#lab-native-bar .lnb-tl.max{{background:#28c840}}",
      "#lab-native-bar .lnb-tl:hover{{filter:brightness(1.08)}}",
      "#lab-native-bar .lnb-dot{{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px rgba(74,222,128,.5);flex-shrink:0}}",
      "#lab-native-bar .lnb-title{{color:rgba(110,203,255,.95);letter-spacing:0.04em;white-space:nowrap}}",
      "#lab-native-bar .lnb-sp{{flex:1;min-width:8px}}",
      "#lab-native-bar .lnb-btn{{appearance:none;border:1px solid rgba(255,255,255,.08);background:rgba(16,18,24,.55);",
      "color:#9aa3b5;border-radius:6px;height:24px;padding:0 9px;cursor:pointer;font:11px ui-monospace,Menlo,monospace}}",
      "#lab-native-bar .lnb-btn:hover{{color:#6ecbff;border-color:rgba(110,203,255,.35);background:rgba(110,203,255,.08)}}",
      "#lab-native-bar .lnb-btn.primary{{color:#6ecbff;border-color:rgba(110,203,255,.35);background:rgba(110,203,255,.1)}}",
      "#lab-native-bar .lnb-btn.primary:hover{{background:rgba(110,203,255,.18)}}",
      "#lab-native-bar::after{{content:\"\";position:absolute;left:12%;right:12%;bottom:-1px;height:1px;",
      "background:linear-gradient(90deg,transparent,rgba(110,203,255,.45),rgba(167,139,250,.4),rgba(248,113,113,.35),rgba(74,222,128,.4),transparent);opacity:.7;pointer-events:none}}",
      "body.lab-native{{padding-top:40px!important}}",
      /* Float density: compact filter + fluid scale already in style.css via .lab-float */
      "body.lab-float .topbar,body.lab-float .app-tabs{{background:rgba(11,12,15,.72)!important}}",
    ].join("");
    document.head.appendChild(st);

    bar.querySelectorAll("button[data-ipc]").forEach(function(b){{
      b.addEventListener("click", function(e){{
        e.stopPropagation();
        window.LabNative && LabNative.ipc(b.getAttribute("data-ipc"));
      }});
    }});
    var pinned = false;
    bar.querySelectorAll("button[data-c]").forEach(function(b){{
      b.addEventListener("click", function(e){{
        e.stopPropagation();
        var action = b.getAttribute("data-c");
        if (action === "pin") {{
          pinned = !pinned;
          action = pinned ? "pin" : "unpin";
          b.textContent = pinned ? "Unpin" : "Pin";
        }}
        if (action === "open_panda") {{
          fetch("/api/panda/open", {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{ splits: 3 }})
          }}).then(function(r){{ return r.json(); }}).then(function(j){{
            if (window.LabDesktop && LabDesktop.showError) {{
              LabDesktop.showError(j.message || (j.launched ? "Panda fleet opening…" : "Panda failed"));
            }}
          }}).catch(function(err){{
            if (window.LabDesktop && LabDesktop.showError) LabDesktop.showError(String(err));
          }});
          return;
        }}
        if (action === "open_agent") {{
          fetch("/api/control", {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{ action: "show_agent" }})
          }});
          return;
        }}
        if (action === "open_launch" || action === "show_launch") {{
          fetch("/api/control", {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{ action: "show_launch" }})
          }});
          return;
        }}
        if (action === "open_browser" || action === "show_browser") {{
          fetch("/api/control", {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{ action: "show_browser" }})
          }});
          return;
        }}
        if (action === "arrange" || action === "organize" || action === "tidy") {{
          fetch("/api/control", {{
            method: "POST",
            headers: {{ "Content-Type": "application/json" }},
            body: JSON.stringify({{ action: "arrange" }})
          }});
          return;
        }}
        var body = {{ action: action, target: b.getAttribute("data-t") || "lab" }};
        fetch("/api/control", {{ method:"POST", headers:{{"Content-Type":"application/json"}}, body: JSON.stringify(body) }});
      }});
    }});
  }}

  window.LabDesktop = Object.assign(window.LabDesktop || {{}}, {{
    isDesktop: true, isNative: true, shell: "wry-wkwebview",
    chatSeparate: true, floatChrome: true,
    control: function(action, extra){{
      return fetch("/api/control", {{
        method: "POST",
        headers: {{ "Content-Type": "application/json" }},
        body: JSON.stringify(Object.assign({{ action: action }}, extra || {{}}))
      }}).then(function(r){{ return r.json(); }});
    }}
  }});

  if (!document.getElementById("lab-native-error")) {{
    var er = document.createElement("div");
    er.id = "lab-native-error";
    er.style.cssText = "display:none;position:fixed;left:50%;bottom:1.2rem;transform:translateX(-50%);z-index:300;max-width:90%;padding:0.5rem 0.85rem;border-radius:10px;background:rgba(40,12,12,.95);border:1px solid rgba(248,113,113,.45);color:#fca5a5;font:12px ui-monospace,Menlo,monospace";
    document.body.appendChild(er);
    window.LabDesktop.showError = function(msg){{
      er.textContent = msg; er.style.display = "block";
      clearTimeout(er._t); er._t = setTimeout(function(){{ er.style.display = "none"; }}, 6000);
    }};
  }}
}});
"##
    )
}

fn chat_init_script() -> String {
    let chrome = float_chrome_js("chat");
    format!(
        r##"
{chrome}
document.documentElement.classList.add("lab-native","lab-chat-surface");
window.LabDesktop = Object.assign(window.LabDesktop || {{}}, {{
  isDesktop: true, isNative: true, isChatWindow: true, shell: "wry-chat", floatChrome: true,
  control: function(action, extra){{
    return fetch("/api/control", {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify(Object.assign({{ action: action, target: "chat" }}, extra || {{}}))
    }}).then(function(r){{ return r.json(); }});
  }}
}});
"##
    )
}

fn stream_init_script() -> String {
    let chrome = float_chrome_js("stream");
    format!(
        r##"
{chrome}
document.documentElement.classList.add("lab-native","lab-stream-surface");
window.LabDesktop = Object.assign(window.LabDesktop || {{}}, {{
  isDesktop: true, isNative: true, isStreamWindow: true, shell: "wry-stream", floatChrome: true,
  control: function(action, extra){{
    return fetch("/api/control", {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify(Object.assign({{ action: action, target: "stream" }}, extra || {{}}))
    }}).then(function(r){{ return r.json(); }});
  }}
}});
"##
    )
}

fn center_window(window: &Window) {
    if let Some(m) = window.current_monitor() {
        let screen = m.size();
        let size = window.outer_size();
        let x = (screen.width as i32 - size.width as i32) / 2;
        let y = (screen.height as i32 - size.height as i32) / 2;
        window.set_outer_position(PhysicalPosition::new(x.max(40), y.max(40)));
    } else {
        window.set_outer_position(LogicalPosition::new(120.0, 80.0));
    }
}

fn place_chat_window(window: &Window) {
    if let Some(m) = window.current_monitor() {
        let screen = m.size();
        let size = window.outer_size();
        let x = screen.width as i32 - size.width as i32 - 28;
        let y = screen.height as i32 - size.height as i32 - 48;
        window.set_outer_position(PhysicalPosition::new(x.max(12), y.max(12)));
    } else {
        window.set_outer_position(LogicalPosition::new(40.0, 80.0));
    }
}

fn place_stream_window(window: &Window) {
    if let Some(m) = window.current_monitor() {
        let screen = m.size();
        let size = window.outer_size();
        let x = 28;
        let y = screen.height as i32 - size.height as i32 - 48;
        window.set_outer_position(PhysicalPosition::new(x, y.max(12)));
    } else {
        window.set_outer_position(LogicalPosition::new(40.0, 120.0));
    }
}

fn lab_pair<'a>(windows: &'a HashMap<WindowId, WinPair>) -> Option<&'a WinPair> {
    windows.values().find(|p| p.role == Role::Lab)
}

fn role_visible(windows: &HashMap<WindowId, WinPair>, role: Role) -> bool {
    windows
        .values()
        .any(|p| p.role == role && p.window.is_visible())
}

/// Dock **one** satellite to lab flanks. Opening Stream never repositions Chat.
fn snap_role(windows: &mut HashMap<WindowId, WinPair>, layout: &LayoutState, role: Role) {
    let Some(lab) = lab_pair(windows) else {
        return;
    };
    let wa = detect_work_area(&lab.window);
    let lab_pos = lab
        .window
        .outer_position()
        .unwrap_or(PhysicalPosition::new(80, 60));
    let lab_size = lab.window.outer_size();
    let lx = lab_pos.x;
    let ly = lab_pos.y;
    let lw = lab_size.width as i32;
    let lh = lab_size.height as i32;
    let gap = wa.phys_i(10.0).max(DOCK_GAP);
    let min_side = wa.phys(220.0);
    let max_side = wa.phys(400.0);

    match role {
        Role::Chat if layout.chat_docked => {
            if let Some(p) = windows
                .values()
                .find(|p| p.role == Role::Chat && p.window.is_visible())
            {
                let sz = p.window.outer_size();
                // Wider side panel so the large orb + Grok Voice · eve stay visible
                // (agent terminal feeds sit below lab — do not bury the orb off-screen).
                let side_w = sz.width.clamp(min_side.max(wa.phys(300.0)), max_side.max(wa.phys(420.0)));
                // Prefer top of lab band (not full stretch under terminal strip)
                let side_h = (lh as u32)
                    .saturating_sub(4)
                    .min(wa.phys(760.0))
                    .max(wa.phys(480.0));
                let x = lx + lw + gap;
                let y = ly; // top-align with lab — orb stays at top of panel
                for p in windows.values() {
                    if p.role == Role::Chat && p.window.is_visible() {
                        p.window.set_outer_position(PhysicalPosition::new(x, y));
                        p.window
                            .set_inner_size(PhysicalSize::new(side_w, side_h));
                    }
                }
            }
        }
        Role::Stream if layout.stream_docked => {
            if windows
                .values()
                .any(|p| p.role == Role::Stream && p.window.is_visible())
            {
                let sz = windows
                    .values()
                    .find(|p| p.role == Role::Stream)
                    .map(|p| p.window.outer_size())
                    .unwrap_or(PhysicalSize::new(min_side, wa.phys(400.0)));
                let side_w = sz.width.clamp(min_side, max_side);
                let side_h = (lh as u32).saturating_sub(4).max(wa.phys(300.0));
                let x = (lx - side_w as i32 - gap).max(wa.x + 8);
                for p in windows.values() {
                    if p.role == Role::Stream && p.window.is_visible() {
                        p.window.set_outer_position(PhysicalPosition::new(x, ly));
                        p.window
                            .set_inner_size(PhysicalSize::new(side_w, side_h));
                    }
                }
            }
        }
        _ => {}
    }
}

/// Dock both flanks (Link / Arrange / lab move only).
fn snap_docked(windows: &mut HashMap<WindowId, WinPair>, layout: &mut LayoutState) {
    snap_role(windows, layout, Role::Chat);
    snap_role(windows, layout, Role::Stream);
}

/// Smart workspace layout for **all visible** surfaces — fills work area.
///
/// ```text
/// ┌─ Stream ─┬────── Lab ──────┬─ Chat ─┐
/// │ (dock)   │                 │ (dock) │
/// ├──────────┴─────────────────┴────────┤
/// │ Launch (TR)        Agent (below)    │
/// └─────────────────────────────────────┘
/// ```
fn arrange_workspace(windows: &mut HashMap<WindowId, WinPair>, layout: &mut LayoutState) {
    let Some(lab) = lab_pair(windows) else {
        return;
    };
    let wa = detect_work_area(&lab.window);
    let margin = wa.phys_i(12.0).max(8);
    let gap = wa.phys_i(10.0).max(DOCK_GAP);
    let side_w = wa.phys(if wa.logical_w() >= 1400.0 {
        340.0
    } else if wa.logical_w() >= 1100.0 {
        300.0
    } else {
        240.0
    }) as i32;

    let chat_vis = role_visible(windows, Role::Chat);
    let stream_vis = role_visible(windows, Role::Stream);
    let agent_vis = role_visible(windows, Role::Agent);
    let launch_vis = role_visible(windows, Role::Launch);
    let browser_vis = role_visible(windows, Role::Browser);

    let need_left = stream_vis && layout.stream_docked;
    let need_right = chat_vis && layout.chat_docked;

    let left_reserve = if need_left { side_w + gap } else { margin };
    let right_reserve = if need_right { side_w + gap } else { margin };
    let bottom_reserve = if agent_vis {
        wa.phys_i(280.0) + gap
    } else {
        margin
    };
    let max_lab_w = (wa.w - left_reserve - right_reserve - margin).max(wa.phys_i(480.0));
    let max_lab_h = (wa.h - margin - bottom_reserve).max(wa.phys_i(360.0));

    // Grow lab to fill free band (arrange = fit display).
    let lw = max_lab_w;
    let mut lh = max_lab_h;
    // Leave a little headroom on very tall displays.
    if wa.logical_h() > 1000.0 {
        lh = (max_lab_h as f64 * 0.92) as i32;
    }

    let mut lx = wa.x + left_reserve;
    let ly = wa.y + margin;
    if !need_left && need_right {
        lx = wa.x + margin + ((wa.w - margin - right_reserve - lw) / 2).max(0);
    } else if need_left && !need_right {
        let free = wa.w - left_reserve - margin;
        lx = wa.x + left_reserve + ((free - lw) / 2).max(0);
    } else if !need_left && !need_right {
        lx = wa.x + ((wa.w - lw) / 2).max(margin);
    }

    for p in windows.values() {
        if p.role == Role::Lab {
            p.window
                .set_outer_position(PhysicalPosition::new(lx, ly));
            p.window
                .set_inner_size(PhysicalSize::new(lw as u32, lh as u32));
        }
    }

    let (lx, ly, lw, lh) = {
        let lab = lab_pair(windows).unwrap();
        let pos = lab
            .window
            .outer_position()
            .unwrap_or(PhysicalPosition::new(lx, ly));
        let sz = lab.window.outer_size();
        (pos.x, pos.y, sz.width as i32, sz.height as i32)
    };

    // Resize + snap docked flanks to lab height
    if need_right {
        for p in windows.values() {
            if p.role == Role::Chat && p.window.is_visible() {
                p.window
                    .set_inner_size(PhysicalSize::new(side_w as u32, lh as u32));
                p.window
                    .set_outer_position(PhysicalPosition::new(lx + lw + gap, ly));
            }
        }
    }
    if need_left {
        for p in windows.values() {
            if p.role == Role::Stream && p.window.is_visible() {
                p.window
                    .set_inner_size(PhysicalSize::new(side_w as u32, lh as u32));
                p.window.set_outer_position(PhysicalPosition::new(
                    (lx - side_w - gap).max(wa.x + margin),
                    ly,
                ));
            }
        }
    }

    if chat_vis && !layout.chat_docked {
        for p in windows.values() {
            if p.role == Role::Chat {
                let sz = p.window.outer_size();
                let x = wa.x + wa.w - sz.width as i32 - margin;
                let y = wa.y + wa.h - sz.height as i32 - margin;
                p.window.set_outer_position(PhysicalPosition::new(
                    x.max(wa.x + margin),
                    y.max(wa.y + margin),
                ));
            }
        }
    }
    if stream_vis && !layout.stream_docked {
        for p in windows.values() {
            if p.role == Role::Stream {
                let sz = p.window.outer_size();
                let x = wa.x + margin;
                let y = wa.y + wa.h - sz.height as i32 - margin;
                p.window
                    .set_outer_position(PhysicalPosition::new(x, y.max(wa.y + margin)));
            }
        }
    }

    if launch_vis {
        let launch_w = wa.phys(420.0);
        let launch_h = wa.phys(520.0);
        let x = if need_right {
            lx + lw + gap
        } else {
            wa.x + wa.w - launch_w as i32 - margin
        };
        for p in windows.values() {
            if p.role == Role::Launch {
                p.window
                    .set_inner_size(PhysicalSize::new(launch_w, launch_h));
                p.window.set_outer_position(PhysicalPosition::new(
                    x.min(wa.x + wa.w - launch_w as i32 - margin)
                        .max(wa.x + margin),
                    wa.y + margin,
                ));
            }
        }
    }

    if agent_vis {
        let left = if need_left {
            (lx - side_w - gap).max(wa.x + margin)
        } else {
            lx
        };
        let right = if need_right {
            lx + lw + gap + side_w
        } else {
            lx + lw
        };
        let agent_w = ((right - left) as u32).max(wa.phys(480.0));
        let rest = (wa.y + wa.h - (ly + lh) - gap - margin).max(0) as u32;
        let agent_h = rest.clamp(wa.phys(220.0), wa.phys(400.0));
        let y = ly + lh + gap;
        let y = if y + agent_h as i32 > wa.y + wa.h - margin {
            (wa.y + wa.h - agent_h as i32 - margin).max(ly)
        } else {
            y
        };
        for p in windows.values() {
            if p.role == Role::Agent {
                p.window
                    .set_inner_size(PhysicalSize::new(agent_w, agent_h));
                p.window.set_outer_position(PhysicalPosition::new(
                    left.max(wa.x + margin),
                    y,
                ));
            }
        }
    }

    if browser_vis {
        let bw = wa.phys((wa.logical_w() * 0.45).clamp(520.0, 1000.0));
        let bh = wa.phys((wa.logical_h() * 0.55).clamp(400.0, 800.0));
        for p in windows.values() {
            if p.role == Role::Browser {
                p.window.set_inner_size(PhysicalSize::new(bw, bh));
                p.window.set_outer_position(PhysicalPosition::new(
                    wa.x + wa.w - bw as i32 - margin,
                    wa.y + ((wa.h - bh as i32) / 2).max(margin),
                ));
            }
        }
    }

    tracing::info!(
        wa_w = wa.w,
        wa_h = wa.h,
        scale = wa.scale,
        lw,
        lh,
        "arrange workspace (work-area fit)"
    );
}

/// Place Agent / Launch near lab **without** resizing the lab (safer on show).
/// Full tiling remains `arrange_workspace` / Arrange command only.
fn place_free_satellites(windows: &mut HashMap<WindowId, WinPair>, _layout: &LayoutState) {
    let Some(lab) = lab_pair(windows) else {
        return;
    };
    let lab_pos = lab
        .window
        .outer_position()
        .unwrap_or(PhysicalPosition::new(80, 60));
    let lab_size = lab.window.outer_size();
    let lx = lab_pos.x;
    let ly = lab_pos.y;
    let lw = lab_size.width as i32;
    let lh = lab_size.height as i32;
    let mon = lab.window.current_monitor();
    let (screen_w, mon_x, mon_y) = if let Some(m) = mon {
        let s = m.size();
        let p = m.position();
        (s.width as i32, p.x, p.y)
    } else {
        (1440, 0, 0)
    };
    let gap = DOCK_GAP;
    let margin = 12i32;

    if role_visible(windows, Role::Launch) {
        let w = 480i32;
        let x = (mon_x + screen_w - w - margin).max(mon_x + margin);
        let y = mon_y + 48;
        for p in windows.values() {
            if p.role == Role::Launch && p.window.is_visible() {
                // Only nudge if overlapping lab center — never force-resize.
                let pos = p.window.outer_position().unwrap_or(PhysicalPosition::new(x, y));
                let overlaps_lab = pos.x < lx + lw && pos.x + 200 > lx && pos.y < ly + lh;
                if overlaps_lab {
                    p.window.set_outer_position(PhysicalPosition::new(x, y));
                }
            }
        }
    }

    if role_visible(windows, Role::Agent) {
        let x = lx;
        let y = ly + lh + gap;
        for p in windows.values() {
            if p.role == Role::Agent && p.window.is_visible() {
                let pos = p.window.outer_position().unwrap_or(PhysicalPosition::new(x, y));
                let overlaps_lab =
                    pos.x < lx + lw && pos.x + 400 > lx && pos.y < ly + lh && pos.y + 200 > ly;
                if overlaps_lab {
                    p.window
                        .set_outer_position(PhysicalPosition::new(x.max(mon_x + margin), y));
                }
            }
        }
    }

    if role_visible(windows, Role::Browser) {
        let x = mon_x + screen_w - 720;
        let y = mon_y + 80;
        for p in windows.values() {
            if p.role == Role::Browser && p.window.is_visible() {
                let pos = p.window.outer_position().unwrap_or(PhysicalPosition::new(x, y));
                let overlaps_lab =
                    pos.x < lx + lw && pos.x + 400 > lx && pos.y < ly + lh && pos.y + 200 > ly;
                if overlaps_lab {
                    p.window.set_outer_position(PhysicalPosition::new(
                        x.max(mon_x + margin),
                        y.max(mon_y + 48),
                    ));
                }
            }
        }
    }
}

/// After showing one surface: snap **only that** satellite if docked.
/// Opening Stream must never re-dock / re-cluster Chat (three-up glitch).
fn after_show_layout(
    windows: &mut HashMap<WindowId, WinPair>,
    layout: &mut LayoutState,
    focus: Role,
) {
    layout.suppressing_move = true;
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        match focus {
            Role::Chat | Role::Stream => snap_role(windows, layout, focus),
            Role::Agent | Role::Launch | Role::Browser => {
                place_free_satellites(windows, layout);
            }
            Role::Lab => {}
        }
    }));
    if r.is_err() {
        tracing::error!("after_show_layout panic caught");
    }
    layout.suppressing_move = false;
}

fn handle_moved(
    window_id: WindowId,
    windows: &mut HashMap<WindowId, WinPair>,
    layout: &mut LayoutState,
    _bus: &ControlBus,
) {
    if layout.suppressing_move {
        return;
    }
    // Only lab moves re-snap satellites. Docked windows stay linked until
    // explicit Undock / Unlink (avoids false undock from programmatic snaps).
    let role = windows.get(&window_id).map(|p| p.role);
    if role == Some(Role::Lab) {
        layout.suppressing_move = true;
        snap_docked(windows, layout);
        layout.suppressing_move = false;
    }
}

// ── Frameless edge hit-test ──────────────────────────────────────────

enum Hit {
    Client,
    Left,
    Right,
    Top,
    Bottom,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

fn hit_test(size: PhysicalSize<u32>, x: i32, y: i32, scale: f64) -> Hit {
    // 8 CSS-px edge band; scale converts to physical for hit testing.
    const INSET: f64 = 8.0;
    let inset = (INSET * scale).round().max(6.0) as i32;
    let w = size.width as i32;
    let h = size.height as i32;
    let left = x < inset;
    let right = x >= w - inset;
    let top = y < inset;
    let bottom = y >= h - inset;
    match (top, bottom, left, right) {
        (true, _, true, _) => Hit::TopLeft,
        (true, _, _, true) => Hit::TopRight,
        (_, true, true, _) => Hit::BottomLeft,
        (_, true, _, true) => Hit::BottomRight,
        (true, _, _, _) => Hit::Top,
        (_, true, _, _) => Hit::Bottom,
        (_, _, true, _) => Hit::Left,
        (_, _, _, true) => Hit::Right,
        _ => Hit::Client,
    }
}

fn hit_to_resize(hit: Hit) -> Option<ResizeDirection> {
    Some(match hit {
        Hit::Left => ResizeDirection::West,
        Hit::Right => ResizeDirection::East,
        Hit::Top => ResizeDirection::North,
        Hit::Bottom => ResizeDirection::South,
        Hit::TopLeft => ResizeDirection::NorthWest,
        Hit::TopRight => ResizeDirection::NorthEast,
        Hit::BottomLeft => ResizeDirection::SouthWest,
        Hit::BottomRight => ResizeDirection::SouthEast,
        Hit::Client => return None,
    })
}

fn hit_cursor(hit: Hit) -> CursorIcon {
    match hit {
        Hit::Left => CursorIcon::WResize,
        Hit::Right => CursorIcon::EResize,
        Hit::Top => CursorIcon::NResize,
        Hit::Bottom => CursorIcon::SResize,
        Hit::TopLeft => CursorIcon::NwResize,
        Hit::TopRight => CursorIcon::NeResize,
        Hit::BottomLeft => CursorIcon::SwResize,
        Hit::BottomRight => CursorIcon::SeResize,
        Hit::Client => CursorIcon::Default,
    }
}

fn for_target(windows: &mut HashMap<WindowId, WinPair>, target: WinTarget, mut f: impl FnMut(&WinPair)) {
    for p in windows.values() {
        let hit = match target {
            WinTarget::All => true,
            WinTarget::Lab => p.role == Role::Lab,
            WinTarget::Chat => p.role == Role::Chat,
            WinTarget::Stream => p.role == Role::Stream,
            WinTarget::Agent => p.role == Role::Agent,
            WinTarget::Launch => p.role == Role::Launch,
            WinTarget::Browser => p.role == Role::Browser,
        };
        if hit {
            f(p);
        }
    }
}

fn apply_cmd(
    cmd: &ControlCmd,
    windows: &mut HashMap<WindowId, WinPair>,
    bus: &ControlBus,
    layout: &mut LayoutState,
    control_flow: &mut ControlFlow,
    proxy: &EventLoopProxy<ControlCmd>,
) -> Result<(), String> {
    match cmd {
        ControlCmd::Ping => Ok(()),
        ControlCmd::Quit => {
            *control_flow = ControlFlow::Exit;
            Ok(())
        }
        ControlCmd::ShowChat | ControlCmd::FocusChat => {
            // Attach WKWebView only when first shown (first-launch safety).
            for p in windows.values_mut() {
                if p.role == Role::Chat {
                    ensure_webview(p, proxy)?;
                    p.window.set_visible(true);
                    p.window.set_focus();
                    bus.set_chat_visible(true);
                }
            }
            after_show_layout(windows, layout, Role::Chat);
            Ok(())
        }
        ControlCmd::OpenChatIndependent => {
            // Undock for free float when opening "independently"
            layout.chat_docked = false;
            bus.set_chat_docked(false);
            for p in windows.values_mut() {
                if p.role == Role::Chat {
                    ensure_webview(p, proxy)?;
                    p.window.set_visible(true);
                    p.window.set_always_on_top(true);
                    p.window.set_focus();
                    bus.set_chat_visible(true);
                }
            }
            Ok(())
        }
        ControlCmd::ChatOnly => {
            // Full chat panel only — lab hidden (not dock-minimized), satellites off.
            apply_chat_surface(windows, layout, bus, proxy, ChatSurface::Full)?;
            tracing::info!("chat-only workspace (lab hidden, full chat float)");
            Ok(())
        }
        ControlCmd::ChatOrb => {
            // Siri-scale orb — tiny always-on-top float, orb.html
            apply_chat_surface(windows, layout, bus, proxy, ChatSurface::Orb)?;
            tracing::info!("chat-orb workspace (Siri-scale · lab hidden)");
            Ok(())
        }
        ControlCmd::ChatFull => {
            // Expand orb → full chat.html without reopening lab
            apply_chat_surface(windows, layout, bus, proxy, ChatSurface::Full)?;
            tracing::info!("chat expanded to full panel");
            Ok(())
        }
        ControlCmd::HideChat => {
            for p in windows.values() {
                if p.role == Role::Chat {
                    p.window.set_visible(false);
                    bus.set_chat_visible(false);
                }
            }
            Ok(())
        }
        ControlCmd::ToggleChat => {
            if bus.chat_visible() {
                apply_cmd(
                    &ControlCmd::HideChat,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            } else {
                apply_cmd(
                    &ControlCmd::ShowChat,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            }
        }
        ControlCmd::ShowStream | ControlCmd::FocusStream => {
            for p in windows.values_mut() {
                if p.role == Role::Stream {
                    ensure_webview(p, proxy)?;
                    p.window.set_visible(true);
                    p.window.set_focus();
                    bus.set_stream_visible(true);
                }
            }
            // Snap **stream only** — never re-dock/rearrange Chat.
            after_show_layout(windows, layout, Role::Stream);
            Ok(())
        }
        ControlCmd::HideStream => {
            for p in windows.values() {
                if p.role == Role::Stream {
                    p.window.set_visible(false);
                    bus.set_stream_visible(false);
                }
            }
            Ok(())
        }
        ControlCmd::ToggleStream => {
            if bus.stream_visible() {
                apply_cmd(
                    &ControlCmd::HideStream,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            } else {
                apply_cmd(
                    &ControlCmd::ShowStream,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            }
        }
        ControlCmd::ShowAgent | ControlCmd::FocusAgent => {
            for p in windows.values_mut() {
                if p.role == Role::Agent {
                    ensure_webview(p, proxy)?;
                    p.window.set_visible(true);
                    p.window.set_focus();
                }
            }
            after_show_layout(windows, layout, Role::Agent);
            Ok(())
        }
        ControlCmd::HideAgent => {
            for p in windows.values() {
                if p.role == Role::Agent {
                    p.window.set_visible(false);
                }
            }
            Ok(())
        }
        ControlCmd::ToggleAgent => {
            let visible = windows
                .values()
                .any(|p| p.role == Role::Agent && p.window.is_visible());
            if visible {
                apply_cmd(
                    &ControlCmd::HideAgent,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            } else {
                apply_cmd(
                    &ControlCmd::ShowAgent,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            }
        }
        ControlCmd::ShowLaunch | ControlCmd::FocusLaunch => {
            for p in windows.values_mut() {
                if p.role == Role::Launch {
                    ensure_webview(p, proxy)?;
                    p.window.set_visible(true);
                    p.window.set_focus();
                }
            }
            after_show_layout(windows, layout, Role::Launch);
            Ok(())
        }
        ControlCmd::HideLaunch => {
            for p in windows.values() {
                if p.role == Role::Launch {
                    p.window.set_visible(false);
                }
            }
            Ok(())
        }
        ControlCmd::ToggleLaunch => {
            let visible = windows
                .values()
                .any(|p| p.role == Role::Launch && p.window.is_visible());
            if visible {
                apply_cmd(
                    &ControlCmd::HideLaunch,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            } else {
                apply_cmd(
                    &ControlCmd::ShowLaunch,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            }
        }
        ControlCmd::ShowBrowser | ControlCmd::FocusBrowser => {
            for p in windows.values_mut() {
                if p.role == Role::Browser {
                    ensure_webview(p, proxy)?;
                    p.window.set_visible(true);
                    p.window.set_focus();
                }
            }
            after_show_layout(windows, layout, Role::Browser);
            Ok(())
        }
        ControlCmd::HideBrowser => {
            for p in windows.values() {
                if p.role == Role::Browser {
                    p.window.set_visible(false);
                }
            }
            Ok(())
        }
        ControlCmd::ToggleBrowser => {
            let visible = windows
                .values()
                .any(|p| p.role == Role::Browser && p.window.is_visible());
            if visible {
                apply_cmd(
                    &ControlCmd::HideBrowser,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            } else {
                apply_cmd(
                    &ControlCmd::ShowBrowser,
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            }
        }
        ControlCmd::Navigate { target, url } => {
            let url = url.trim().to_string();
            if url.is_empty() {
                return Err("empty navigate url".into());
            }
            // Drive browser.html labBrowse() so chrome stays put.
            let esc = url
                .replace('\\', "\\\\")
                .replace('\'', "\\'")
                .replace('\n', " ");
            let js = format!(
                "try{{if(window.labBrowse)labBrowse('{esc}');\
                 else if(document.getElementById('br-url')){{\
                 document.getElementById('br-url').value='{esc}';\
                 var f=document.getElementById('br-frame');if(f)f.src='{esc}';}}}}catch(e){{}}"
            );
            let ids: Vec<WindowId> = windows
                .values()
                .filter(|p| match target {
                    WinTarget::All => p.role == Role::Browser,
                    WinTarget::Browser => p.role == Role::Browser,
                    WinTarget::Lab => p.role == Role::Lab,
                    WinTarget::Chat => p.role == Role::Chat,
                    WinTarget::Stream => p.role == Role::Stream,
                    WinTarget::Agent => p.role == Role::Agent,
                    WinTarget::Launch => p.role == Role::Launch,
                })
                .map(|p| p.window.id())
                .collect();
            for id in ids {
                if let Some(p) = windows.get_mut(&id) {
                    if p.webview.is_none() && p.role == Role::Browser {
                        let _ = ensure_webview(p, proxy);
                    }
                    if let Some(wv) = p.webview.as_ref() {
                        let _ = safe_eval(wv, &js);
                    }
                }
            }
            Ok(())
        }
        ControlCmd::Dock { target } => {
            match target {
                WinTarget::Chat => {
                    layout.chat_docked = true;
                    bus.set_chat_docked(true);
                    for p in windows.values_mut() {
                        if p.role == Role::Chat {
                            ensure_webview(p, proxy)?;
                            p.window.set_visible(true);
                            bus.set_chat_visible(true);
                        }
                    }
                    layout.suppressing_move = true;
                    snap_role(windows, layout, Role::Chat);
                    layout.suppressing_move = false;
                }
                WinTarget::Stream => {
                    layout.stream_docked = true;
                    bus.set_stream_docked(true);
                    for p in windows.values_mut() {
                        if p.role == Role::Stream {
                            ensure_webview(p, proxy)?;
                            p.window.set_visible(true);
                            bus.set_stream_visible(true);
                        }
                    }
                    layout.suppressing_move = true;
                    snap_role(windows, layout, Role::Stream);
                    layout.suppressing_move = false;
                }
                WinTarget::All => {
                    layout.chat_docked = true;
                    layout.stream_docked = true;
                    bus.set_chat_docked(true);
                    bus.set_stream_docked(true);
                    layout.suppressing_move = true;
                    arrange_workspace(windows, layout);
                    layout.suppressing_move = false;
                }
                // Free-floating surfaces
                WinTarget::Lab | WinTarget::Agent | WinTarget::Launch | WinTarget::Browser => {}
            }
            Ok(())
        }
        ControlCmd::Undock { target } => {
            match target {
                WinTarget::Chat => {
                    layout.chat_docked = false;
                    bus.set_chat_docked(false);
                }
                WinTarget::Stream => {
                    layout.stream_docked = false;
                    bus.set_stream_docked(false);
                }
                WinTarget::All => {
                    layout.chat_docked = false;
                    layout.stream_docked = false;
                    bus.set_chat_docked(false);
                    bus.set_stream_docked(false);
                }
                WinTarget::Lab | WinTarget::Agent | WinTarget::Launch | WinTarget::Browser => {}
            }
            Ok(())
        }
        ControlCmd::ToggleDock { target } => {
            let docked = match target {
                WinTarget::Chat => layout.chat_docked,
                WinTarget::Stream => layout.stream_docked,
                WinTarget::All => layout.chat_docked && layout.stream_docked,
                // Always "docked" (noop undock) so toggle leaves free-float alone.
                WinTarget::Lab | WinTarget::Agent | WinTarget::Launch | WinTarget::Browser => true,
            };
            if docked {
                apply_cmd(
                    &ControlCmd::Undock { target: *target },
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            } else {
                apply_cmd(
                    &ControlCmd::Dock { target: *target },
                    windows,
                    bus,
                    layout,
                    control_flow,
                    proxy,
                )
            }
        }
        ControlCmd::LinkAll => {
            layout.chat_docked = true;
            layout.stream_docked = true;
            bus.set_chat_docked(true);
            bus.set_stream_docked(true);
            for p in windows.values_mut() {
                match p.role {
                    Role::Chat => {
                        ensure_webview(p, proxy)?;
                        p.window.set_visible(true);
                        bus.set_chat_visible(true);
                    }
                    Role::Stream => {
                        ensure_webview(p, proxy)?;
                        p.window.set_visible(true);
                        bus.set_stream_visible(true);
                    }
                    Role::Agent | Role::Launch | Role::Browser | Role::Lab => {
                        // Link = dock chat/stream only; don't force-show free-float.
                        if p.role == Role::Lab {
                            p.window.set_visible(true);
                        }
                    }
                }
            }
            layout.suppressing_move = true;
            arrange_workspace(windows, layout);
            layout.suppressing_move = false;
            Ok(())
        }
        ControlCmd::UnlinkAll => {
            layout.chat_docked = false;
            layout.stream_docked = false;
            bus.set_chat_docked(false);
            bus.set_stream_docked(false);
            Ok(())
        }
        ControlCmd::Arrange => {
            layout.suppressing_move = true;
            let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                arrange_workspace(windows, layout);
            }));
            layout.suppressing_move = false;
            if r.is_err() {
                bus.push_error("arrange panic caught", "control");
            }
            Ok(())
        }
        ControlCmd::FocusLab => {
            // Prefer full restore when we have a snapshot from chat-only/orb
            if layout.snap.taken {
                return restore_workspace(windows, layout, bus, proxy);
            }
            for p in windows.values_mut() {
                if p.role == Role::Lab {
                    ensure_webview(p, proxy)?;
                    p.window.set_minimized(false);
                    p.window.set_visible(true);
                    p.window.set_focus();
                }
            }
            Ok(())
        }
        ControlCmd::RestoreWorkspace => {
            restore_workspace(windows, layout, bus, proxy)
        }
        ControlCmd::SetAlwaysOnTop { target, on } => {
            let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                for_target(windows, *target, |p| {
                    p.window.set_always_on_top(*on);
                });
            }));
            if r.is_err() {
                bus.push_error("set_always_on_top panic", "control");
            }
            Ok(())
        }
        ControlCmd::SetDecorations { target, on } => {
            for_target(windows, *target, |p| {
                p.window.set_decorations(*on);
            });
            Ok(())
        }
        ControlCmd::Minimize { target } => {
            for_target(windows, *target, |p| {
                p.window.set_minimized(true);
            });
            Ok(())
        }
        ControlCmd::Maximize { target } => {
            for_target(windows, *target, |p| {
                p.window.set_maximized(!p.window.is_maximized());
            });
            Ok(())
        }
        ControlCmd::Close { target } => match target {
            WinTarget::Chat => apply_cmd(
                &ControlCmd::HideChat,
                windows,
                bus,
                layout,
                control_flow,
                proxy,
            ),
            WinTarget::Stream => apply_cmd(
                &ControlCmd::HideStream,
                windows,
                bus,
                layout,
                control_flow,
                proxy,
            ),
            WinTarget::Agent => apply_cmd(
                &ControlCmd::HideAgent,
                windows,
                bus,
                layout,
                control_flow,
                proxy,
            ),
            WinTarget::Launch => apply_cmd(
                &ControlCmd::HideLaunch,
                windows,
                bus,
                layout,
                control_flow,
                proxy,
            ),
            WinTarget::Browser => apply_cmd(
                &ControlCmd::HideBrowser,
                windows,
                bus,
                layout,
                control_flow,
                proxy,
            ),
            WinTarget::Lab | WinTarget::All => {
                *control_flow = ControlFlow::Exit;
                Ok(())
            }
        },
        ControlCmd::SetPosition { target, x, y } => {
            for_target(windows, *target, |p| {
                p.window
                    .set_outer_position(PhysicalPosition::new(*x, *y));
            });
            Ok(())
        }
        ControlCmd::SetSize { target, w, h } => {
            for_target(windows, *target, |p| {
                p.window.set_inner_size(PhysicalSize::new(*w, *h));
            });
            Ok(())
        }
        ControlCmd::Center { target } => {
            for_target(windows, *target, |p| center_window(&p.window));
            Ok(())
        }
        ControlCmd::EvalJs { target, script } => {
            // Never eval empty scripts (null CFString path in WK).
            if script.is_empty() {
                return Err("empty script".into());
            }
            let ids: Vec<WindowId> = windows
                .values()
                .filter(|p| match target {
                    WinTarget::All => true,
                    WinTarget::Lab => p.role == Role::Lab,
                    WinTarget::Chat => p.role == Role::Chat,
                    WinTarget::Stream => p.role == Role::Stream,
                    WinTarget::Agent => p.role == Role::Agent,
                    WinTarget::Launch => p.role == Role::Launch,
                    WinTarget::Browser => p.role == Role::Browser,
                })
                .map(|p| p.window.id())
                .collect();
            for id in ids {
                if let Some(p) = windows.get_mut(&id) {
                    if p.webview.is_none() {
                        // Don't force-attach just for eval on never-shown satellites.
                        continue;
                    }
                    if let Some(wv) = p.webview.as_ref() {
                        if let Err(e) = safe_eval(wv, script) {
                            bus.push_error(format!("eval failed: {e}"), "eval");
                        }
                    }
                }
            }
            Ok(())
        }
        ControlCmd::ShowError { message } => {
            bus.push_error(message.clone(), "api");
            let esc = message
                .replace('\\', "\\\\")
                .replace('\'', "\\'")
                .replace('\n', " ");
            let js = format!(
                "try{{window.LabDesktop&&LabDesktop.showError&&LabDesktop.showError('{esc}');\
                 window.LabChat&&LabChat.showError&&LabChat.showError('{esc}');}}catch(e){{}}"
            );
            // Only toast on visible surfaces with an attached webview
            for p in windows.values() {
                if p.window.is_visible() {
                    if let Some(wv) = p.webview.as_ref() {
                        let _ = safe_eval(wv, &js);
                    }
                }
            }
            Ok(())
        }
        ControlCmd::Refresh { target } => {
            // CRITICAL: do NOT use evaluate_script("location.reload()") —
            // on macOS WKWebView that path can SIGSEGV in CFStringCreateWithBytes
            // when multiple webviews reload from the menu action.
            let ids: Vec<WindowId> = windows
                .values()
                .filter(|p| match target {
                    WinTarget::All => true,
                    WinTarget::Lab => p.role == Role::Lab,
                    WinTarget::Chat => p.role == Role::Chat,
                    WinTarget::Stream => p.role == Role::Stream,
                    WinTarget::Agent => p.role == Role::Agent,
                    WinTarget::Launch => p.role == Role::Launch,
                    WinTarget::Browser => p.role == Role::Browser,
                })
                .map(|p| p.window.id())
                .collect();
            for id in ids {
                if let Some(p) = windows.get_mut(&id) {
                    // Refresh of never-shown satellite: attach then load.
                    if p.webview.is_none()
                        && matches!(
                            p.role,
                            Role::Chat
                                | Role::Stream
                                | Role::Agent
                                | Role::Launch
                                | Role::Browser
                        )
                    {
                        if let Err(e) = ensure_webview(p, proxy) {
                            bus.push_error(format!("refresh attach {:?}: {e}", p.role), "refresh");
                            continue;
                        }
                    }
                    if let Err(e) = safe_reload(p) {
                        bus.push_error(format!("refresh {:?}: {e}", p.role), "refresh");
                    }
                }
            }
            Ok(())
        }
        ControlCmd::CheckUpdates => {
            let js = r#"(async function(){
              try {
                const local = await fetch('/version.json?_=' + Date.now(), {cache:'no-store'}).then(r=>r.json()).catch(()=>({}));
                const remote = await fetch('https://fornevercollective.github.io/grok-build/version.json?_=' + Date.now(), {cache:'no-store'}).then(r=>r.json()).catch(()=>null);
                const ls = (local && (local.short || local.sha)) || 'local';
                if (!remote) {
                  const m = 'Could not reach update server. Local: ' + ls;
                  (window.LabDesktop && LabDesktop.showError) ? LabDesktop.showError(m) : alert(m);
                  return;
                }
                const rs = remote.short || remote.sha || '?';
                if (String(ls) === String(rs) || String(local.sha) === String(remote.sha)) {
                  const m = 'Grok Build Lab is up to date (' + ls + ').';
                  (window.LabDesktop && LabDesktop.showError) ? LabDesktop.showError(m) : alert(m);
                } else {
                  const m = 'Update available: ' + rs + ' (you have ' + ls + '). Open Pages or git pull.';
                  (window.LabDesktop && LabDesktop.showError) ? LabDesktop.showError(m) : alert(m);
                  try { window.open('https://fornevercollective.github.io/grok-build/', '_blank'); } catch(e) {}
                }
              } catch (e) {
                const m = 'Update check failed: ' + (e && e.message || e);
                (window.LabDesktop && LabDesktop.showError) ? LabDesktop.showError(m) : alert(m);
              }
            })();"#;
            // Only run on the focused/visible lab window (one is enough)
            let mut ran = false;
            for p in windows.values() {
                if p.role == Role::Lab && p.window.is_visible() {
                    if let Some(wv) = p.webview.as_ref() {
                        let _ = safe_eval(wv, js);
                        ran = true;
                        break;
                    }
                }
            }
            if !ran {
                for p in windows.values() {
                    if p.window.is_visible() {
                        if let Some(wv) = p.webview.as_ref() {
                            let _ = safe_eval(wv, js);
                            break;
                        }
                    }
                }
            }
            Ok(())
        }
        ControlCmd::DragWindow { target } => {
            for_target(windows, *target, |p| {
                let _ = p.window.drag_window();
            });
            Ok(())
        }
        ControlCmd::DragResize { target, direction } => {
            let dir = match direction {
                ResizeDir::East => ResizeDirection::East,
                ResizeDir::West => ResizeDirection::West,
                ResizeDir::North => ResizeDirection::North,
                ResizeDir::South => ResizeDirection::South,
                ResizeDir::NorthEast => ResizeDirection::NorthEast,
                ResizeDir::NorthWest => ResizeDirection::NorthWest,
                ResizeDir::SouthEast => ResizeDirection::SouthEast,
                ResizeDir::SouthWest => ResizeDirection::SouthWest,
            };
            for_target(windows, *target, |p| {
                let _ = p.window.drag_resize_window(dir);
            });
            Ok(())
        }
        ControlCmd::CursorHit { target, x, y } => {
            // x < 0 means edge_down press: |x|-1 is real x
            let press = *x < 0;
            let rx = if press { -x - 1 } else { *x };
            let ry = *y;
            for_target(windows, *target, |p| {
                let hit = hit_test(p.window.inner_size(), rx, ry, p.window.scale_factor());
                if press {
                    if let Some(dir) = hit_to_resize(hit) {
                        let _ = p.window.drag_resize_window(dir);
                    }
                } else {
                    p.window.set_cursor_icon(hit_cursor(hit));
                }
            });
            Ok(())
        }
    }
}
