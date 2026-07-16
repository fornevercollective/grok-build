//! Multi native windows: Lab + Chat + Stream (each own WKWebView).
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

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
enum Role {
    Lab,
    Chat,
    Stream,
}

impl Role {
    fn target(self) -> WinTarget {
        match self {
            Role::Lab => WinTarget::Lab,
            Role::Chat => WinTarget::Chat,
            Role::Stream => WinTarget::Stream,
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

/// Dock/undock layout — satellites snap to lab when docked.
struct LayoutState {
    chat_docked: bool,
    stream_docked: bool,
    /// Suppress undock-on-move while we programmatically snap.
    suppressing_move: bool,
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

    // Initial dock snap positions (hidden until shown)
    {
        let mut layout = LayoutState {
            chat_docked: true,
            stream_docked: true,
            suppressing_move: false,
        };
        snap_docked(&mut windows, &mut layout);
    }

    tracing::info!(
        lab_url = %lab_entry,
        %chat_url,
        %stream_url,
        float,
        eager,
        "lab webview up · chat/stream {}",
        if eager { "eager" } else { "lazy-on-show" }
    );

    let bus_loop = bus.clone();
    let proxy_loop = proxy.clone();
    let mut layout = LayoutState {
        chat_docked: true,
        stream_docked: true,
        suppressing_move: false,
    };

    event_loop.run(move |event, _target, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            Event::NewEvents(StartCause::Init) => {}
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
    let (w, h, min_w, min_h) = if float {
        (980.0, 720.0, 640.0, 480.0)
    } else {
        (1280.0, 860.0, 800.0, 560.0)
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

fn build_chat_window(event_loop: &tao::event_loop::EventLoop<ControlCmd>) -> Result<Window> {
    let mut wb = WindowBuilder::new()
        .with_title("Grok Build Lab - Chat")
        .with_decorations(false)
        .with_always_on_top(true)
        .with_resizable(true)
        .with_transparent(true)
        .with_inner_size(LogicalSize::new(340.0, 580.0))
        .with_min_inner_size(LogicalSize::new(300.0, 480.0))
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

fn build_stream_window(event_loop: &tao::event_loop::EventLoop<ControlCmd>) -> Result<Window> {
    let mut wb = WindowBuilder::new()
        .with_title("Grok Build Lab - Stream")
        .with_decorations(false)
        .with_always_on_top(false)
        .with_resizable(true)
        .with_transparent(true)
        .with_inner_size(LogicalSize::new(420.0, 520.0))
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

  document.addEventListener("mousemove", function(e){{
    ipc("mousemove:" + e.clientX + "," + e.clientY);
  }}, true);

  document.addEventListener("mousedown", function(e){{
    if (e.button !== 0) return;
    var t = e.target;
    if (t && t.closest && t.closest("button, a, input, textarea, select, [data-no-drag]")) return;
    var dragEl = t && t.closest ? t.closest("[data-drag-region]") : null;
    if (dragEl) {{
      if (e.detail === 2) {{
        ipc("maximize");
      }} else {{
        ipc("drag");
      }}
      e.preventDefault();
      return;
    }}
    ipc("edge_down:" + e.clientX + "," + e.clientY);
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
      '<button type="button" class="lnb-btn primary" data-c="show_chat" data-no-drag title="Open chat (Cmd+2)">Chat</button>' +
      '<button type="button" class="lnb-btn primary" data-c="show_stream" data-no-drag title="Open stream feed (Cmd+3)">Stream</button>' +
      '<button type="button" class="lnb-btn" data-c="link_all" data-no-drag title="Dock chat + stream to lab">Link</button>' +
      '<button type="button" class="lnb-btn" data-c="unlink_all" data-no-drag title="Undock all satellites">Unlink</button>' +
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

fn snap_docked(windows: &mut HashMap<WindowId, WinPair>, layout: &mut LayoutState) {
    let Some(lab) = lab_pair(windows) else {
        return;
    };
    let lab_pos = lab.window.outer_position().unwrap_or(PhysicalPosition::new(80, 60));
    let lab_size = lab.window.outer_size();
    let lx = lab_pos.x;
    let ly = lab_pos.y;
    let lw = lab_size.width as i32;
    let lh = lab_size.height as i32;

    // Collect positions first to avoid borrow issues
    let chat_size = windows
        .values()
        .find(|p| p.role == Role::Chat)
        .map(|p| p.window.outer_size());
    let stream_size = windows
        .values()
        .find(|p| p.role == Role::Stream)
        .map(|p| p.window.outer_size());

    if layout.chat_docked {
        if let Some(sz) = chat_size {
            let x = lx + lw + DOCK_GAP;
            let y = ly;
            // match height roughly if taller lab
            let _ = sz;
            for p in windows.values() {
                if p.role == Role::Chat {
                    p.window
                        .set_outer_position(PhysicalPosition::new(x, y));
                    // optional: match lab height
                    p.window
                        .set_inner_size(PhysicalSize::new(sz.width, (lh as u32).saturating_sub(20).max(400)));
                }
            }
        }
    }
    if layout.stream_docked {
        if let Some(sz) = stream_size {
            let x = lx - sz.width as i32 - DOCK_GAP;
            let y = ly;
            for p in windows.values() {
                if p.role == Role::Stream {
                    p.window.set_outer_position(PhysicalPosition::new(
                        x.max(8),
                        y,
                    ));
                    p.window.set_inner_size(PhysicalSize::new(
                        sz.width,
                        (lh as u32).saturating_sub(20).max(360),
                    ));
                }
            }
        }
    }
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
    const INSET: f64 = 6.0;
    let inset = (INSET * scale) as i32;
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
            if layout.chat_docked {
                layout.suppressing_move = true;
                snap_docked(windows, layout);
                layout.suppressing_move = false;
            }
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
            if layout.stream_docked {
                layout.suppressing_move = true;
                snap_docked(windows, layout);
                layout.suppressing_move = false;
            }
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
                }
                WinTarget::All => {
                    layout.chat_docked = true;
                    layout.stream_docked = true;
                    bus.set_chat_docked(true);
                    bus.set_stream_docked(true);
                }
                WinTarget::Lab => {}
            }
            layout.suppressing_move = true;
            snap_docked(windows, layout);
            layout.suppressing_move = false;
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
                WinTarget::Lab => {}
            }
            Ok(())
        }
        ControlCmd::ToggleDock { target } => {
            let docked = match target {
                WinTarget::Chat => layout.chat_docked,
                WinTarget::Stream => layout.stream_docked,
                WinTarget::All => layout.chat_docked && layout.stream_docked,
                WinTarget::Lab => true,
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
                    Role::Lab => {
                        p.window.set_visible(true);
                    }
                }
            }
            layout.suppressing_move = true;
            snap_docked(windows, layout);
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
        ControlCmd::FocusLab => {
            for p in windows.values() {
                if p.role == Role::Lab {
                    p.window.set_visible(true);
                    p.window.set_focus();
                }
            }
            Ok(())
        }
        ControlCmd::SetAlwaysOnTop { target, on } => {
            for_target(windows, *target, |p| {
                p.window.set_always_on_top(*on);
            });
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
                })
                .map(|p| p.window.id())
                .collect();
            for id in ids {
                if let Some(p) = windows.get_mut(&id) {
                    // Refresh of never-shown satellite: attach then load.
                    if p.webview.is_none() && matches!(p.role, Role::Chat | Role::Stream) {
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
