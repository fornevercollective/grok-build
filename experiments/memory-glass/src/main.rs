//! Memory Glass — concept browser shell (tao + wry / WKWebView).
//! Frameless · droplet glass edges (desktop shows through) · Dragon top tab
//! · bottom search float (x.ai/voice sphere gunmetal / soft white glass).

use anyhow::{Context, Result};
use http::Request;
use tao::{
    dpi::{LogicalPosition, LogicalSize, PhysicalPosition},
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop, EventLoopBuilder},
    window::{Icon, Window, WindowBuilder},
};
use wry::WebViewBuilder;

/// Compile-time stamp (build.rs) — proves the binary was rebuilt.
const MG_PKG: &str = env!("CARGO_PKG_VERSION");
const MG_BUILD_EPOCH: &str = env!("MG_BUILD_EPOCH");
const MG_BUILD_ISO: &str = env!("MG_BUILD_ISO");

// Coverflow credit (code attribution only — not rendered in UI):
// Andrew Coulter Enright · Heather Samples Enright · Roan · NYC family.
// Friends of the project; classic Cover Flow lineage acknowledgment.

fn process_start_epoch() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn version_label(process_epoch: u64) -> String {
    format!(
        "MG {MG_PKG} · build {MG_BUILD_EPOCH} ({MG_BUILD_ISO}) · run {process_epoch}"
    )
}

fn version_short(process_epoch: u64) -> String {
    format!("v{MG_PKG} · b{MG_BUILD_EPOCH} · r{process_epoch}")
}

/// Inject version stamp into a page that defines window.__mgSetVersion or #mg-build-stamp.
fn inject_version_stamp(webview: &wry::WebView, process_epoch: u64) {
    let full = version_label(process_epoch);
    let short = version_short(process_epoch);
    let js = format!(
        r#"(function(){{try{{
  window.__MG_PKG='{pkg}';
  window.__MG_BUILD_EPOCH={be};
  window.__MG_BUILD_ISO='{bi}';
  window.__MG_RUN_EPOCH={re};
  window.__MG_VERSION='{full}';
  if(typeof window.__mgSetVersion==='function')window.__mgSetVersion('{full}','{short}');
  var el=document.getElementById('mg-build-stamp');
  if(el){{el.textContent='{short}';el.title='{full}';}}
  var el2=document.getElementById('mg-build-stamp-full');
  if(el2)el2.textContent='{full}';
  if(typeof window.__mgDevLog==='function')window.__mgDevLog('ok','{full}','version');
}}catch(e){{}}}})();"#,
        pkg = js_single_quote(MG_PKG),
        be = MG_BUILD_EPOCH,
        bi = js_single_quote(MG_BUILD_ISO),
        re = process_epoch,
        full = js_single_quote(&full),
        short = js_single_quote(&short),
    );
    let _ = webview.evaluate_script(&js);
}

/// Dock / window mark — black/graphite shield + white singularity portal (xAI-lean aesthetic).
fn app_icon() -> Option<Icon> {
    const W: u32 = 128;
    const H: u32 = 128;
    let rgba = include_bytes!("../assets/icon_128.rgba").to_vec();
    Icon::from_rgba(rgba, W, H).ok()
}

#[derive(Debug, Clone)]
enum Cmd {
    Navigate(String),
    Back,
    Forward,
    Reload,
    /// System window drag (synthesized NSEvent — safe under async WKWebView IPC)
    Drag,
    /// Resize window from edge/corner drag (throttled; macOS has no drag_resize_window)
    ResizeBy { dir: String, dx: f64, dy: f64 },
    Recenter,
    /// Dim custom stoplights (. . .) — close / min / zoom
    WinClose,
    WinMinimize,
    WinZoom,
    /// Spawn another Memory Glass process (Cmd+N) — always boots spacex.com
    NewWindow(String),
    /// Dev inspect float (separate native window to the right)
    DevLog {
        lvl: String,
        msg: String,
        src: String,
    },
    DevShow,
    DevHide,
    DevToggle,
    DevClear,
    /// Open macOS System Settings → Privacy → Camera
    OpenCameraPrefs,
    /// Ask AVFoundation for camera access (triggers OS prompt if needed)
    RequestCameraAccess,
    /// Hot-pipe: re-inject live.js into main (and agent if open)
    HotReload,
    /// Hot-pipe: scan recent errors and apply matching mitigations
    HotMitigate { msg: String },
    /// Hot-pipe: write inspect pack + clipboard-friendly markdown for Grok Build
    SubmitInspect { dump: String },
    /// Hot-pipe: open agent.html in main webview
    OpenAgent,
    /// Clean new window → hotpipe/leaderboard.html with optional handoff JSON
    OpenLeaderboard {
        handoff: Option<String>,
        post: bool,
    },
    /// Push prompt.md / loop.json into agent page
    HotLoadPrompt,
    HotLoadLoop,
    /// Coverflow in inspect: main → inspect tab list
    SyncTabs {
        json: String,
    },
    /// Coverflow axis from main viewRay → inspect
    SyncCfAxis {
        yaw: f64,
        pitch: f64,
        expand: f64,
    },
    /// Inspect coverflow card clicked → switch main tab
    SwitchTab {
        index: usize,
    },
    /// Native clipboard write (WKWebView often lacks navigator.clipboard)
    ClipboardCopy {
        text: String,
    },
    /// Voice STT mute (true = mute, false = unmute) via ~/.panda/voice/mute.sh
    MicMute(bool),
    /// Push current mic mute state into inspect UI (no change)
    MicStatus,
    /// Force tile main browser left + inspect fully on-screen
    TileLayout,
    /// Still-pipe / ofx face pose from inspect → main LabViewRay (browser content track)
    TrackPose {
        yaw: f64,
        pitch: f64,
        roll: f64,
        z: f64,
        nx: f64,
        ny: f64,
        conf: f64,
        smile: f64,
        brow: f64,
        jaw: f64,
        engine: String,
    },
    /// Multi-person array (JSON) for persona / occlusion / FOV filters on main
    TrackPeople {
        json: String,
    },
    /// Inspect-first hands / air pointer → main CSS vars only (no body thrash)
    TrackHand {
        present: bool,
        nx: f64,
        ny: f64,
        pinch: f64,
        expand: f64,
        conf: f64,
        engine: String,
    },
    /// Trusted in-process click (AppKit NSEvent) — for WebGrid etc. inside OUR WKWebView.
    /// `x`,`y` are CSS client coordinates (origin top-left of the page viewport).
    SyntheticClick {
        x: f64,
        y: f64,
    },
    /// WKWebView page zoom (1.0 = 100%). WebGrid uses ~0.7–0.85 to fit 30×30 grid.
    PageZoom {
        scale: f64,
    },
    /// Streaming video under-hood: yt-dlp / ffmpeg / ffplay / blank / gy via mg-video-feed.sh
    MediaFeed {
        media_op: String,
        url: String,
    },
    /// Re-read flip-board filmstrip JSON and inject into main for MKT rail
    LoadFilmstrip,
    /// Re-assert NSWindow/WK glass on both panes (after FS / multi-scale display move).
    ReassertGlass,
}

const HOME_URL: &str = "https://www.spacex.com/";

fn place_on_primary(window: &Window) {
    let size = window.outer_size();
    // Cascade by pid so ⌘N windows don't stack perfectly on top of each other
    let cascade = ((std::process::id() % 9) as i32) * 32;
    if let Some(mon) = window.primary_monitor().or_else(|| window.current_monitor()) {
        let mpos = mon.position();
        let msize = mon.size();
        // Sit on the LEFT third so inspect can dock fully on the right (not half off-screen)
        let x = mpos.x + 24 + cascade;
        let y = mpos.y + (msize.height as i32 - size.height as i32) / 5 + cascade;
        window.set_outer_position(PhysicalPosition::new(x.max(mpos.x + 16), y.max(mpos.y + 36)));
        return;
    }
    window.set_outer_position(LogicalPosition::new(40.0 + cascade as f64, 48.0 + cascade as f64));
}

/// Leftmost *landscape* (horizontal) monitor — never the tall vertical panel.
fn leftmost_landscape_monitor(window: &Window) -> Option<tao::monitor::MonitorHandle> {
    let mut best: Option<tao::monitor::MonitorHandle> = None;
    let mut best_x = i32::MAX;
    for mon in window.available_monitors() {
        let s = mon.size();
        // Landscape: width clearly greater than height
        if (s.width as f64) < (s.height as f64) * 1.05 {
            continue;
        }
        let x = mon.position().x;
        if x < best_x {
            best_x = x;
            best = Some(mon);
        }
    }
    best.or_else(|| window.primary_monitor())
        .or_else(|| window.current_monitor())
}

/// True when WebGrid should open as a compact window (Neuralink 12×12 / Safari zoom-in look).
fn webgrid_wants_small_window() -> bool {
    if let Ok(v) = std::env::var("MG_WEBGRID_SCALE") {
        let v = v.to_ascii_lowercase();
        if v == "small" || v == "12" || v == "12x12" || v == "mobile" {
            return true;
        }
    }
    if std::env::var("MG_WEBGRID_SMALL")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
    {
        return true;
    }
    // argv URL / flags
    for a in std::env::args() {
        let l = a.to_ascii_lowercase();
        if l.contains("mg_scale=small")
            || l.contains("grid=12")
            || l.contains("mg_grid=12")
            || l.contains("mg_window=small")
        {
            return true;
        }
    }
    false
}

/// Prefer primary monitor when it is landscape (laptop main display); else leftmost landscape.
fn webgrid_target_monitor(window: &Window) -> Option<tao::monitor::MonitorHandle> {
    if let Some(pri) = window.primary_monitor() {
        let s = pri.size();
        if (s.width as f64) >= (s.height as f64) * 1.05 {
            return Some(pri);
        }
    }
    leftmost_landscape_monitor(window)
}

/// WebGrid layout (once at boot).
/// Neuralink: 12×12 if innerWidth≤751 OR innerHeight≤600, else 30×30.
/// Large (default): near-fullscreen on laptop main display → 30×30.
/// Small: `?mg_scale=small` / `?grid=12` / env `MG_WEBGRID_SCALE=small` → compact window → 12×12.
/// Override size: MG_WEBGRID_W / MG_WEBGRID_H (logical px).
fn place_for_webgrid_play(main: &Window, inspect: Option<&Window>) {
    let scale = main.scale_factor().max(1.0);
    let Some(mon) = webgrid_target_monitor(main) else {
        place_on_primary(main);
        return;
    };
    let mpos = mon.position();
    let msize = mon.size();
    let mon_w = msize.width as f64 / scale;
    let mon_h = msize.height as f64 / scale;
    let small = webgrid_wants_small_window();
    let env_w = std::env::var("MG_WEBGRID_W")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|w| *w >= 400.0 && *w <= 8000.0);
    let env_h = std::env::var("MG_WEBGRID_H")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|h| *h >= 400.0 && *h <= 8000.0);
    let (logical_w, logical_h, target) = if small {
        // Compact browser — Safari zoom-in / mobile breakpoint → big-cell 12×12
        (
            env_w.unwrap_or_else(|| 720.0_f64.min(mon_w - 40.0).max(560.0)),
            env_h.unwrap_or_else(|| 560.0_f64.min(mon_h - 60.0).max(480.0)),
            "12×12",
        )
    } else {
        // Near-fullscreen on this display (e.g. 2560×1440 laptop) → 30×30
        // Leave chrome margins; do not hard-cap below modern QHD.
        (
            env_w.unwrap_or_else(|| (mon_w - 32.0).clamp(1280.0, mon_w - 16.0)),
            env_h.unwrap_or_else(|| (mon_h - 56.0).clamp(780.0, mon_h - 28.0)),
            "30×30",
        )
    };
    main.set_inner_size(LogicalSize::new(logical_w, logical_h));
    let outer = main.outer_size();
    let ow = outer.width as i32;
    let oh = outer.height as i32;
    let x = mpos.x + (12.0 * scale).round() as i32;
    let y = mpos.y + (28.0 * scale).round() as i32;
    main.set_outer_position(PhysicalPosition::new(x, y));
    eprintln!(
        "webgrid layout (once): display {}x{} (log {:.0}x{:.0}) · main {}x{} @ ({},{}) · target {target} (small={small})",
        msize.width, msize.height, mon_w, mon_h, ow, oh, x, y
    );
    // Inspect: only nudge if it would sit on top of main; otherwise leave alone
    if let Some(insp) = inspect {
        if let (Ok(ip), Ok(_)) = (insp.outer_position(), main.outer_position()) {
            let is = insp.outer_size();
            let overlap = ip.x < x + ow && ip.x + is.width as i32 > x;
            if overlap {
                let gap = (16.0 * scale).round() as i32;
                let ix = (x + ow + gap).min(mpos.x + msize.width as i32 - is.width as i32 - 12);
                insp.set_outer_position(PhysicalPosition::new(ix, y));
            }
        }
    }
}

/// Spawn a new Memory Glass instance. Prefer the .app via `open -n` so LS/Dock match;
/// fall back to current_exe. Always boots HOME_URL (spacex) unless caller overrides.
fn spawn_new_window(url: &str) {
    let url = if url.trim().is_empty() { HOME_URL } else { url };

    if let Ok(exe) = std::env::current_exe() {
        // .../Memory Glass.app/Contents/MacOS/memory-glass → app bundle
        let app = exe
            .parent() // MacOS
            .and_then(|p| p.parent()) // Contents
            .and_then(|p| p.parent()) // Memory Glass.app
            .filter(|p| {
                p.extension().and_then(|e| e.to_str()) == Some("app")
                    || p.file_name()
                        .and_then(|n| n.to_str())
                        .is_some_and(|n| n.ends_with(".app"))
            });

        if let Some(app_path) = app {
            let status = std::process::Command::new("open")
                .arg("-n")
                .arg("-a")
                .arg(app_path)
                .arg("--args")
                .arg(url)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn();
            if status.is_ok() {
                return;
            }
        }

        let _ = std::process::Command::new(exe)
            .arg(url)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
    }
}

/// Soft ship corner radius — single layer clip only (no recursive tree = no crunch).
const MG_CORNER_R: f64 = 12.0;

/// Detect near-fullscreen / maximized fill of the current monitor (secondary vertical too).
/// Uses physical px for both window outer size and monitor size (scale-factor safe).
#[cfg(target_os = "macos")]
fn window_nearly_fills_monitor(window: &Window) -> bool {
    let size = window.outer_size();
    let Some(mon) = window.current_monitor().or_else(|| window.primary_monitor()) else {
        return false;
    };
    let ms = mon.size();
    // ≥90% of either dimension → fullscreen-ish (works at 1× and 2× Retina)
    let fill_w = size.width as f64 / (ms.width as f64).max(1.0);
    let fill_h = size.height as f64 / (ms.height as f64).max(1.0);
    fill_w >= 0.90 || fill_h >= 0.90
}

/// Backing scale for the window's current screen (1.0, 2.0, …).
/// Must match CALayer.contentsScale or glass composites as a black plate on Retina / mixed DPI.
#[cfg(target_os = "macos")]
fn window_backing_scale(window: &Window) -> f64 {
    let s = window.scale_factor();
    if s.is_finite() && s > 0.25 && s < 8.0 {
        s
    } else {
        1.0
    }
}

/// Make the *native shell* see-through: NSWindow + contentView + WKWebView.
/// Scale-aware: sets layer.contentsScale to the window's backingScaleFactor so glass
/// works simultaneously on 1× landscape + 2× Retina / vertical second screens.
/// Re-call after Moved / Resized / Focused / ScaleFactorChanged.
#[cfg(target_os = "macos")]
fn clear_window_bg(window: &Window) {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use tao::platform::macos::WindowExtMacOS;

    let nearly_fs = window_nearly_fills_monitor(window);
    let scale = window_backing_scale(window);
    // Fullscreen / monitor-fill: no corner radius (masks + opaque FS spaces → solid black)
    // cornerRadius is in points (not pixels) — same MG_CORNER_R at every scale factor
    let radius = if nearly_fs { 0.0_f64 } else { MG_CORNER_R };

    unsafe {
        let ns_window = window.ns_window() as *mut Object;
        if ns_window.is_null() {
            return;
        }
        let clear: *mut Object = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setBackgroundColor: clear];
        let _: () = msg_send![ns_window, setOpaque: false];
        // Shadow on secondary FS can force an opaque backdrop plate — off when filling monitor
        let _: () = msg_send![ns_window, setHasShadow: !nearly_fs];
        // Survive green-button / Spaces transitions that re-paint the titlebar chrome
        let _: () = msg_send![ns_window, setTitlebarAppearsTransparent: true];
        let _: () = msg_send![ns_window, setTitleVisibility: 1i64]; // NSWindowTitleHidden = 1

        // Prefer layer-backed compositing for multi-scale multi-display glass
        let _: () = msg_send![ns_window, setAutorecalculatesKeyViewLoop: true];

        let content: *mut Object = msg_send![ns_window, contentView];
        if !content.is_null() {
            let _: () = msg_send![content, setWantsLayer: true];
            let layer: *mut Object = msg_send![content, layer];
            if !layer.is_null() {
                let cg_clear: *mut Object = msg_send![class!(NSColor), clearColor];
                let cg: *mut std::ffi::c_void = msg_send![cg_clear, CGColor];
                let _: () = msg_send![layer, setBackgroundColor: cg];
                let _: () = msg_send![layer, setOpaque: false];
                // Critical for Retina / mixed 1×+2× setups
                let _: () = msg_send![layer, setContentsScale: scale];
                let _: () = msg_send![layer, setCornerRadius: radius];
                // masksToBounds + radius on FS can composite as a black card on the other display
                let _: () = msg_send![layer, setMasksToBounds: !nearly_fs];
                // Allow subpixel / transparent blending across scale factors
                let _: () = msg_send![layer, setAllowsGroupOpacity: false];
            }
        }
        let _: () = msg_send![ns_window, invalidateShadow];
    }
}

/// After wry builds the WKWebView, re-assert drawsBackground=false (shell transparency).
/// Scale-aware contentsScale so WK layers stay clear on every display DPI.
#[cfg(target_os = "macos")]
fn clear_webview_bg(webview: &wry::WebView) {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use wry::WebViewExtMacOS;

    unsafe {
        let wk = webview.webview();
        let wk_ptr = &*wk as *const _ as *mut Object;
        let no: *mut Object = msg_send![class!(NSNumber), numberWithBool: false];
        let key: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: b"drawsBackground\0".as_ptr()];
        let _: () = msg_send![wk_ptr, setValue: no forKey: key];

        // Backing scale from the view's window when available (1× / 2× / 3×)
        let mut scale = 2.0_f64;
        let win: *mut Object = msg_send![wk_ptr, window];
        if !win.is_null() {
            let bs: f64 = msg_send![win, backingScaleFactor];
            if bs.is_finite() && bs > 0.25 && bs < 8.0 {
                scale = bs;
            }
        }

        let _: () = msg_send![wk_ptr, setWantsLayer: true];
        let layer: *mut Object = msg_send![wk_ptr, layer];
        if !layer.is_null() {
            let clear: *mut Object = msg_send![class!(NSColor), clearColor];
            let cg: *mut std::ffi::c_void = msg_send![clear, CGColor];
            let _: () = msg_send![layer, setBackgroundColor: cg];
            let _: () = msg_send![layer, setOpaque: false];
            let _: () = msg_send![layer, setContentsScale: scale];
            let _: () = msg_send![layer, setCornerRadius: 0.0_f64];
            let _: () = msg_send![layer, setMasksToBounds: false];
            let _: () = msg_send![layer, setAllowsGroupOpacity: false];
        }
    }
}

/// Re-assert glass on a window + its webview after monitor moves / FS / zoom / scale change.
#[cfg(target_os = "macos")]
fn reassert_glass_shell(window: &Window, webview: Option<&wry::WebView>) {
    clear_window_bg(window);
    if let Some(wv) = webview {
        clear_webview_bg(wv);
    }
}

/// Min interval between full dual-pane glass reasserts (ms).
/// Without this, move/zoom/heartbeat storms crash or freeze AppKit (layer thrash).
#[cfg(target_os = "macos")]
fn reassert_all_glass(
    main: &Window,
    main_wv: Option<&wry::WebView>,
    inspect: &Window,
    inspect_wv: Option<&wry::WebView>,
) {
    use std::sync::atomic::{AtomicU64, Ordering};
    static LAST_MS: AtomicU64 = AtomicU64::new(0);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let prev = LAST_MS.load(Ordering::Relaxed);
    if now.saturating_sub(prev) < 400 {
        return; // debounce — crash fix
    }
    LAST_MS.store(now, Ordering::Relaxed);

    reassert_glass_shell(main, main_wv);
    reassert_glass_shell(inspect, inspect_wv);
    eprintln!(
        "glass: reassert main@{}× inspect@{}× nearly_fs={},{}",
        window_backing_scale(main),
        window_backing_scale(inspect),
        window_nearly_fills_monitor(main),
        window_nearly_fills_monitor(inspect)
    );
}

#[cfg(not(target_os = "macos"))]
fn reassert_glass_shell(_window: &Window, _webview: Option<&wry::WebView>) {}

#[cfg(not(target_os = "macos"))]
fn reassert_all_glass(
    _main: &Window,
    _main_wv: Option<&wry::WebView>,
    _inspect: &Window,
    _inspect_wv: Option<&wry::WebView>,
) {
}

#[cfg(not(target_os = "macos"))]
fn clear_window_bg(_window: &Window) {}

#[cfg(not(target_os = "macos"))]
fn clear_webview_bg(_webview: &wry::WebView) {}

/// Bridge native NSMenu actions → tao EventLoopProxy (custom selectors).
#[cfg(target_os = "macos")]
static MENU_PROXY: std::sync::Mutex<Option<tao::event_loop::EventLoopProxy<Cmd>>> =
    std::sync::Mutex::new(None);

#[cfg(target_os = "macos")]
fn menu_send(cmd: Cmd) {
    if let Ok(g) = MENU_PROXY.lock() {
        if let Some(p) = g.as_ref() {
            let _ = p.send_event(cmd);
        }
    }
}

/// Install App / Navigate / View / Edit / Window menus.
/// Navigate + View use a custom ObjC target so Reload / Hot Reload / Inspect land in Rust.
#[cfg(target_os = "macos")]
fn install_standard_edit_menu(proxy: tao::event_loop::EventLoopProxy<Cmd>) {
    use objc::{
        class, declare::ClassDecl, msg_send,
        runtime::{Object, Sel, YES},
        sel, sel_impl,
    };
    use std::sync::Once;

    if let Ok(mut g) = MENU_PROXY.lock() {
        *g = Some(proxy);
    }

    unsafe fn ns_str(s: &str) -> *mut Object {
        let c = std::ffi::CString::new(s).unwrap_or_default();
        msg_send![class!(NSString), stringWithUTF8String: c.as_ptr()]
    }

    unsafe fn add_item(
        menu: *mut Object,
        title: &str,
        action: Sel,
        key: &str,
        mods: Option<u64>,
        target: *mut Object,
    ) {
        let title_s = ns_str(title);
        let key_s = ns_str(key);
        let item: *mut Object = msg_send![class!(NSMenuItem), alloc];
        let item: *mut Object = msg_send![
            item,
            initWithTitle: title_s
            action: action
            keyEquivalent: key_s
        ];
        if let Some(mask) = mods {
            let _: () = msg_send![item, setKeyEquivalentModifierMask: mask];
        }
        if !target.is_null() {
            let _: () = msg_send![item, setTarget: target];
        }
        let _: () = msg_send![menu, addItem: item];
    }

    unsafe fn add_sep(menu: *mut Object) {
        let sep: *mut Object = msg_send![class!(NSMenuItem), separatorItem];
        let _: () = msg_send![menu, addItem: sep];
    }

    // Custom NSObject subclass for menu actions (id, SEL, id sender)
    type MenuFn = extern "C" fn(&Object, Sel, *mut Object);
    extern "C" fn mg_reload(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::Reload);
    }
    extern "C" fn mg_back(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::Back);
    }
    extern "C" fn mg_forward(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::Forward);
    }
    extern "C" fn mg_home(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::Navigate(HOME_URL.to_string()));
    }
    extern "C" fn mg_hot_reload(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::HotReload);
    }
    extern "C" fn mg_inspect_toggle(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::DevToggle);
    }
    extern "C" fn mg_inspect_show(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::DevShow);
    }
    extern "C" fn mg_inspect_hide(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::DevHide);
    }
    extern "C" fn mg_inspect_clear(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::DevClear);
    }
    extern "C" fn mg_open_agent(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::OpenAgent);
    }
    extern "C" fn mg_mitigate(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::HotMitigate { msg: String::new() });
    }
    extern "C" fn mg_cam_prefs(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::OpenCameraPrefs);
    }
    extern "C" fn mg_cam_request(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::RequestCameraAccess);
    }
    extern "C" fn mg_mic_mute(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::MicMute(true));
    }
    extern "C" fn mg_mic_unmute(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::MicMute(false));
    }
    extern "C" fn mg_tile(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::TileLayout);
    }
    extern "C" fn mg_new_window(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::NewWindow(HOME_URL.to_string()));
    }
    extern "C" fn mg_recenter(_: &Object, _: Sel, _: *mut Object) {
        menu_send(Cmd::Recenter);
    }

    static REGISTER: Once = Once::new();
    REGISTER.call_once(|| {
        let superclass = class!(NSObject);
        let mut decl = ClassDecl::new("MGMenuTarget", superclass).expect("MGMenuTarget");
        unsafe {
            decl.add_method(sel!(mgReload:), mg_reload as MenuFn);
            decl.add_method(sel!(mgBack:), mg_back as MenuFn);
            decl.add_method(sel!(mgForward:), mg_forward as MenuFn);
            decl.add_method(sel!(mgHome:), mg_home as MenuFn);
            decl.add_method(sel!(mgHotReload:), mg_hot_reload as MenuFn);
            decl.add_method(sel!(mgInspectToggle:), mg_inspect_toggle as MenuFn);
            decl.add_method(sel!(mgInspectShow:), mg_inspect_show as MenuFn);
            decl.add_method(sel!(mgInspectHide:), mg_inspect_hide as MenuFn);
            decl.add_method(sel!(mgInspectClear:), mg_inspect_clear as MenuFn);
            decl.add_method(sel!(mgOpenAgent:), mg_open_agent as MenuFn);
            decl.add_method(sel!(mgMitigate:), mg_mitigate as MenuFn);
            decl.add_method(sel!(mgCamPrefs:), mg_cam_prefs as MenuFn);
            decl.add_method(sel!(mgCamRequest:), mg_cam_request as MenuFn);
            decl.add_method(sel!(mgMicMute:), mg_mic_mute as MenuFn);
            decl.add_method(sel!(mgMicUnmute:), mg_mic_unmute as MenuFn);
            decl.add_method(sel!(mgTile:), mg_tile as MenuFn);
            decl.add_method(sel!(mgNewWindow:), mg_new_window as MenuFn);
            decl.add_method(sel!(mgRecenter:), mg_recenter as MenuFn);
        }
        decl.register();
    });

    unsafe {
        let ns_app: *mut Object = msg_send![class!(NSApplication), sharedApplication];
        if ns_app.is_null() {
            return;
        }

        // NSEventModifierFlagCommand = 1<<20, Shift = 1<<17, Option = 1<<19
        const CMD: u64 = 1 << 20;
        const CMD_SHIFT: u64 = (1 << 20) | (1 << 17);
        const CMD_OPT: u64 = (1 << 20) | (1 << 19);

        let target: *mut Object = msg_send![class!(MGMenuTarget), new];
        // Retain for app lifetime
        let _: *mut Object = msg_send![target, retain];
        let nil_tgt: *mut Object = std::ptr::null_mut();

        let main_menu: *mut Object = msg_send![class!(NSMenu), new];

        // --- App ---
        let app_item: *mut Object = msg_send![class!(NSMenuItem), new];
        let app_menu: *mut Object = msg_send![class!(NSMenu), new];
        add_item(app_menu, "Hide Memory Glass", sel!(hide:), "h", Some(CMD), nil_tgt);
        add_item(
            app_menu,
            "Hide Others",
            sel!(hideOtherApplications:),
            "h",
            Some(CMD_SHIFT),
            nil_tgt,
        );
        add_item(
            app_menu,
            "Show All",
            sel!(unhideAllApplications:),
            "",
            None,
            nil_tgt,
        );
        add_sep(app_menu);
        add_item(
            app_menu,
            "Quit Memory Glass",
            sel!(terminate:),
            "q",
            Some(CMD),
            nil_tgt,
        );
        let _: () = msg_send![app_item, setSubmenu: app_menu];
        let _: () = msg_send![main_menu, addItem: app_item];

        // --- Navigate (Reload lives here) ---
        let nav_item: *mut Object = msg_send![class!(NSMenuItem), new];
        let nav_title = ns_str("Navigate");
        let nav_menu: *mut Object = msg_send![class!(NSMenu), alloc];
        let nav_menu: *mut Object = msg_send![nav_menu, initWithTitle: nav_title];
        add_item(nav_menu, "Back", sel!(mgBack:), "[", Some(CMD), target);
        add_item(nav_menu, "Forward", sel!(mgForward:), "]", Some(CMD), target);
        add_item(nav_menu, "Reload", sel!(mgReload:), "r", Some(CMD), target);
        add_item(
            nav_menu,
            "Hard Reload (Hot-pipe)",
            sel!(mgHotReload:),
            "r",
            Some(CMD_SHIFT),
            target,
        );
        add_sep(nav_menu);
        add_item(nav_menu, "Home (SpaceX)", sel!(mgHome:), "", None, target);
        add_item(
            nav_menu,
            "New Window",
            sel!(mgNewWindow:),
            "n",
            Some(CMD),
            target,
        );
        let _: () = msg_send![nav_item, setSubmenu: nav_menu];
        let _: () = msg_send![main_menu, addItem: nav_item];

        // --- View (inspect · cam · mic · layout) ---
        let view_item: *mut Object = msg_send![class!(NSMenuItem), new];
        let view_title = ns_str("View");
        let view_menu: *mut Object = msg_send![class!(NSMenu), alloc];
        let view_menu: *mut Object = msg_send![view_menu, initWithTitle: view_title];
        add_item(
            view_menu,
            "Toggle Inspect",
            sel!(mgInspectToggle:),
            "i",
            Some(CMD_OPT),
            target,
        );
        add_item(
            view_menu,
            "Show Inspect",
            sel!(mgInspectShow:),
            "",
            None,
            target,
        );
        add_item(
            view_menu,
            "Hide Inspect",
            sel!(mgInspectHide:),
            "",
            None,
            target,
        );
        add_item(
            view_menu,
            "Clear Inspect Log",
            sel!(mgInspectClear:),
            "",
            None,
            target,
        );
        add_sep(view_menu);
        add_item(
            view_menu,
            "Tile Browser + Inspect",
            sel!(mgTile:),
            "t",
            Some(CMD_OPT),
            target,
        );
        add_item(
            view_menu,
            "Recenter Window",
            sel!(mgRecenter:),
            "",
            None,
            target,
        );
        add_sep(view_menu);
        add_item(
            view_menu,
            "Hot Reload live.js",
            sel!(mgHotReload:),
            "",
            None,
            target,
        );
        add_item(
            view_menu,
            "Run Mitigations",
            sel!(mgMitigate:),
            "",
            None,
            target,
        );
        add_item(view_menu, "Open Agent", sel!(mgOpenAgent:), "", None, target);
        add_sep(view_menu);
        add_item(
            view_menu,
            "Request Camera Access",
            sel!(mgCamRequest:),
            "",
            None,
            target,
        );
        add_item(
            view_menu,
            "Open Camera Privacy Settings…",
            sel!(mgCamPrefs:),
            "",
            None,
            target,
        );
        add_sep(view_menu);
        add_item(
            view_menu,
            "Mute Microphone (STT)",
            sel!(mgMicMute:),
            "",
            None,
            target,
        );
        add_item(
            view_menu,
            "Unmute Microphone (STT)",
            sel!(mgMicUnmute:),
            "",
            None,
            target,
        );
        let _: () = msg_send![view_item, setSubmenu: view_menu];
        let _: () = msg_send![main_menu, addItem: view_item];

        // --- Edit ---
        let edit_item: *mut Object = msg_send![class!(NSMenuItem), new];
        let edit_title = ns_str("Edit");
        let edit_menu: *mut Object = msg_send![class!(NSMenu), alloc];
        let edit_menu: *mut Object = msg_send![edit_menu, initWithTitle: edit_title];
        add_item(edit_menu, "Undo", sel!(undo:), "z", Some(CMD), nil_tgt);
        add_item(edit_menu, "Redo", sel!(redo:), "z", Some(CMD_SHIFT), nil_tgt);
        add_sep(edit_menu);
        add_item(edit_menu, "Cut", sel!(cut:), "x", Some(CMD), nil_tgt);
        add_item(edit_menu, "Copy", sel!(copy:), "c", Some(CMD), nil_tgt);
        add_item(edit_menu, "Paste", sel!(paste:), "v", Some(CMD), nil_tgt);
        add_item(
            edit_menu,
            "Select All",
            sel!(selectAll:),
            "a",
            Some(CMD),
            nil_tgt,
        );
        let _: () = msg_send![edit_item, setSubmenu: edit_menu];
        let _: () = msg_send![main_menu, addItem: edit_item];

        // --- Window ---
        let win_item: *mut Object = msg_send![class!(NSMenuItem), new];
        let win_title = ns_str("Window");
        let win_menu: *mut Object = msg_send![class!(NSMenu), alloc];
        let win_menu: *mut Object = msg_send![win_menu, initWithTitle: win_title];
        add_item(
            win_menu,
            "Minimize",
            sel!(performMiniaturize:),
            "m",
            Some(CMD),
            nil_tgt,
        );
        add_item(win_menu, "Zoom", sel!(performZoom:), "", None, nil_tgt);
        add_sep(win_menu);
        add_item(
            win_menu,
            "Tile Browser + Inspect",
            sel!(mgTile:),
            "",
            None,
            target,
        );
        add_item(
            win_menu,
            "Bring All to Front",
            sel!(arrangeInFront:),
            "",
            None,
            nil_tgt,
        );
        let _: () = msg_send![win_item, setSubmenu: win_menu];
        let _: () = msg_send![main_menu, addItem: win_item];
        let _: () = msg_send![ns_app, setWindowsMenu: win_menu];

        let _: () = msg_send![ns_app, setMainMenu: main_menu];
        let _: () = msg_send![ns_app, setActivationPolicy: 0i64]; // regular
        let _: bool = msg_send![ns_app, activateIgnoringOtherApps: YES];
    }
}

#[cfg(not(target_os = "macos"))]
fn install_standard_edit_menu(_proxy: tao::event_loop::EventLoopProxy<Cmd>) {}

/// AVMediaTypeVideo = "vide". Status: 0 notDetermined, 1 restricted, 2 denied, 3 authorized.
#[cfg(target_os = "macos")]
fn camera_auth_status() -> i64 {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    #[link(name = "AVFoundation", kind = "framework")]
    extern "C" {}
    unsafe {
        let media: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: b"vide\0".as_ptr()];
        let status: i64 = msg_send![class!(AVCaptureDevice), authorizationStatusForMediaType: media];
        status
    }
}

/// Session + durable camera grant state (stops prompt spam across WebGrid / hot reload).
fn camera_grant_path() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".into()))
        .join(".panda/mg-session/camera-grant.json")
}

fn load_camera_grant() -> serde_json::Value {
    let p = camera_grant_path();
    std::fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn save_camera_grant(granted: bool, source: &str) {
    let p = camera_grant_path();
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Durable "logged-in session" — 30 days preference so we don't re-nag at every boot.
    // OS TCC is still the real gate; this only controls *when we prompt*.
    let until = now + 30 * 24 * 3600;
    let mut v = load_camera_grant();
    if let Some(obj) = v.as_object_mut() {
        obj.insert("granted".into(), serde_json::json!(granted));
        obj.insert("source".into(), serde_json::json!(source));
        obj.insert("updated_at".into(), serde_json::json!(now));
        if granted {
            obj.insert("granted_until".into(), serde_json::json!(until));
            obj.insert("session_ok".into(), serde_json::json!(true));
        }
    }
    let _ = std::fs::write(
        &p,
        serde_json::to_string_pretty(&v).unwrap_or_else(|_| "{}".into()),
    );
    eprintln!(
        "camera: grant saved granted={granted} src={source} → {}",
        p.display()
    );
}

fn camera_grant_fresh() -> bool {
    let v = load_camera_grant();
    if v.get("granted").and_then(|x| x.as_bool()) != Some(true) {
        return false;
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let until = v.get("granted_until").and_then(|x| x.as_u64()).unwrap_or(0);
    until > now
}

/// Request camera permission via AVFoundation.
/// Never blocks the UI event loop for long — returns current status; prompt is fire-and-forget.
/// Process-once: after a grant or deny this launch, we never re-show the OS sheet.
#[cfg(target_os = "macos")]
fn request_camera_access_native() -> bool {
    request_camera_access_native_opts(true)
}

/// `allow_prompt`: when false, only report status / use session grant — never show OS sheet
/// (WebGrid play, background boot).
#[cfg(target_os = "macos")]
fn request_camera_access_native_opts(allow_prompt: bool) -> bool {
    use block::ConcreteBlock;
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use std::sync::atomic::{AtomicBool, Ordering};

    #[link(name = "AVFoundation", kind = "framework")]
    extern "C" {}

    /// Process-lifetime: one OS prompt max per launch.
    static REQUESTED: AtomicBool = AtomicBool::new(false);
    static SESSION_OK: AtomicBool = AtomicBool::new(false);

    if SESSION_OK.load(Ordering::SeqCst) {
        return true;
    }

    let status = camera_auth_status();
    eprintln!(
        "camera: AVAuthorizationStatus={status} (0=? 1=restricted 2=denied 3=authorized) prompt={}",
        allow_prompt
    );
    if status == 3 {
        SESSION_OK.store(true, Ordering::SeqCst);
        save_camera_grant(true, "avfoundation_authorized");
        return true;
    }
    if status == 2 || status == 1 {
        eprintln!("camera: denied/restricted — System Settings › Privacy & Security › Camera › Memory Glass");
        save_camera_grant(false, "denied");
        return false;
    }

    // notDetermined
    if !allow_prompt {
        eprintln!(
            "camera: deferred (no prompt) · session_file_ok={} · still-pipe vision OK without Mac cam",
            camera_grant_fresh()
        );
        return false;
    }

    // notDetermined → fire async request once (do not Condvar-block main thread)
    if REQUESTED.swap(true, Ordering::SeqCst) {
        eprintln!("camera: request already in flight / completed this process");
        return camera_auth_status() == 3 || SESSION_OK.load(Ordering::SeqCst);
    }

    let block = ConcreteBlock::new(move |granted: u8| {
        let ok = granted != 0;
        eprintln!("camera: requestAccess granted={}", ok);
        if ok {
            SESSION_OK.store(true, Ordering::SeqCst);
            save_camera_grant(true, "user_prompt");
        } else {
            save_camera_grant(false, "user_denied_prompt");
        }
    });
    let block = block.copy();

    unsafe {
        let media: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: b"vide\0".as_ptr()];
        let _: () = msg_send![
            class!(AVCaptureDevice),
            requestAccessForMediaType: media
            completionHandler: &*block
        ];
    }
    // Prompt is showing; return false until user answers (getUserMedia will succeed after)
    false
}

#[cfg(not(target_os = "macos"))]
fn request_camera_access_native() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
fn request_camera_access_native_opts(_allow_prompt: bool) -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
fn camera_auth_status() -> i64 {
    3
}

/// Write text to the system clipboard (macOS pbcopy; Linux xclip/xsel fallback).
fn clipboard_copy_text(text: &str) -> bool {
    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        use std::process::{Command, Stdio};
        let mut child = match Command::new("pbcopy")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(c) => c,
            Err(_) => return false,
        };
        if let Some(mut stdin) = child.stdin.take() {
            if stdin.write_all(text.as_bytes()).is_err() {
                return false;
            }
        }
        return child.wait().map(|s| s.success()).unwrap_or(false);
    }
    #[cfg(not(target_os = "macos"))]
    {
        use std::io::Write;
        use std::process::{Command, Stdio};
        for bin in ["xclip", "xsel"] {
            let mut cmd = Command::new(bin);
            if bin == "xclip" {
                cmd.args(["-selection", "clipboard"]);
            } else {
                cmd.args(["--clipboard", "--input"]);
            }
            if let Ok(mut child) = cmd
                .stdin(Stdio::piped())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
            {
                if let Some(mut stdin) = child.stdin.take() {
                    let _ = stdin.write_all(text.as_bytes());
                }
                if child.wait().map(|s| s.success()).unwrap_or(false) {
                    return true;
                }
            }
        }
        false
    }
}

fn open_camera_privacy_settings() {
    // macOS Ventura+ deep link; fall back to Privacy pane
    let urls = [
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera",
        "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Camera",
    ];
    for u in urls {
        let ok = std::process::Command::new("open")
            .arg(u)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok {
            eprintln!("camera: opened System Settings ({u})");
            return;
        }
    }
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security")
        .status();
}

// ── Hot-pipe (live inject · agent · mitigations · Grok packs) ──────────────

fn hotpipe_dir() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("MG_HOTPIPE") {
        return std::path::PathBuf::from(p);
    }
    // When running from Memory Glass.app, prefer bundled Resources/hotpipe (self-contained update).
    // Dev builds (cargo run / bare binary) still prefer source tree for hot-pipe iteration.
    if let Ok(exe) = std::env::current_exe() {
        let in_app = exe
            .components()
            .any(|c| c.as_os_str().to_string_lossy().ends_with(".app"));
        if let Some(macos) = exe.parent() {
            let bundled = macos
                .parent()
                .map(|c| c.join("Resources/hotpipe"))
                .unwrap_or_else(|| macos.join("hotpipe"));
            if in_app && bundled.is_dir() {
                return bundled;
            }
            // Dev: source tree next (CARGO_MANIFEST_DIR baked at compile time)
            let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("hotpipe");
            if manifest.is_dir() {
                return manifest;
            }
            if bundled.is_dir() {
                return bundled;
            }
            let sibling = macos.join("hotpipe");
            if sibling.is_dir() {
                return sibling;
            }
        }
    }
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("hotpipe")
}

fn read_hotpipe_file(name: &str) -> Option<String> {
    let p = hotpipe_dir().join(name);
    std::fs::read_to_string(&p).ok()
}

fn inject_js_blob(webview: &wry::WebView, js: &str) {
    // Wrap so syntax errors don't kill the page
    let wrapped = format!(
        "(function(){{try{{\n{js}\n}}catch(e){{try{{if(window.__mgDevLog)window.__mgDevLog('err',String(e&&e.stack||e),'hotpipe');}}catch(_e){{}}}}}})();"
    );
    let _ = webview.evaluate_script(&wrapped);
}


fn mg_video_feed_script() -> std::path::PathBuf {
    // Prefer source tree next to hotpipe; fall back to ~/.panda copy
    let cand = [
        hotpipe_dir().join("../scripts/mg-video-feed.sh"),
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scripts/mg-video-feed.sh"),
        std::env::var_os("HOME").map(std::path::PathBuf::from).unwrap_or_default().join(".panda/mg-soak/bin/mg-video-feed.sh"),
    ];
    for p in cand {
        if p.is_file() {
            return p;
        }
    }
    hotpipe_dir().join("../scripts/mg-video-feed.sh")
}

fn spawn_media_feed(media_op: &str, url: &str) {
    let script = mg_video_feed_script();
    let op = if media_op.is_empty() { "tools" } else { media_op };
    eprintln!("media_feed: {} {} {}", script.display(), op, url);
    let mut cmd = std::process::Command::new("bash");
    cmd.arg(&script).arg(op);
    if !url.is_empty() {
        cmd.arg(url);
    }
    match cmd.spawn() {
        Ok(child) => eprintln!("media_feed: spawned pid={}", child.id()),
        Err(e) => eprintln!("media_feed: spawn failed: {e}"),
    }
}

fn filmstrip_paths() -> Vec<std::path::PathBuf> {
    let mut v = Vec::new();
    if let Some(h) = std::env::var_os("HOME").map(std::path::PathBuf::from) {
        v.push(h.join(".panda/mg-soak/flip-board-live/filmstrip.json"));
        v.push(h.join(".panda/mg-soak/flip-board-live/rows.json"));
    }
    v.push(hotpipe_dir().join("data/filmstrip-board.json"));
    v.push(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("hotpipe/data/filmstrip-board.json"));
    v
}

/// Inject window.__mgFilmstripBoard from local JSON (auto-hydrate MKT rail).
fn inject_filmstrip_board(wv: &wry::WebView) {
    for path in filmstrip_paths() {
        if !path.is_file() {
            continue;
        }
        let Ok(raw) = std::fs::read_to_string(&path) else {
            continue;
        };
        // Cap payload size for evaluate_script (~ few MB max practical)
        if raw.len() > 4_000_000 {
            eprintln!("filmstrip: skip large {} ({} bytes)", path.display(), raw.len());
            continue;
        }
        // Validate JSON
        if serde_json::from_str::<serde_json::Value>(&raw).is_err() {
            continue;
        }
        let js = format!(
            r#"(function(){{try{{
  var data = {raw};
  window.__mgFilmstripBoard = data;
  if (window.__mgMarket && window.__mgMarket.loadBoard) {{
    var n = window.__mgMarket.loadBoard(data);
    if (window.__mgDevLog) window.__mgDevLog('ok','filmstrip auto n='+n,'mkt');
  }}
}}catch(e){{try{{if(window.__mgDevLog)window.__mgDevLog('err',String(e),'mkt');}}catch(_e){{}}}}}})();"#
        );
        if let Err(e) = wv.evaluate_script(&js) {
            eprintln!("filmstrip inject: {e}");
        } else {
            eprintln!("filmstrip: injected from {}", path.display());
            return;
        }
    }
    eprintln!("filmstrip: no board file found");
}

/// `lean=true` for WebGrid play: dual-space floats lab (skip heavy non-play modules).
/// Always keeps contrail/maze/bloch/rubik/beats/keyboard/board LIVE for training.
fn inject_live_js(targets: &[&wry::WebView]) -> bool {
    inject_live_js_mode(targets, false)
}

fn inject_live_js_mode(targets: &[&wry::WebView], lean: bool) -> bool {
    let Some(js) = read_hotpipe_file("live.js") else {
        eprintln!("hotpipe: live.js missing under {}", hotpipe_dir().display());
        return false;
    };
    /* MG_HOTPIPE_LEAN=strict → old agent-only; default lean = dual-space play lab */
    let env_lean = std::env::var("MG_HOTPIPE_LEAN")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true") || v.eq_ignore_ascii_case("webgrid"))
        .unwrap_or(false);
    let strict = std::env::var("MG_HOTPIPE_LEAN")
        .map(|v| v.eq_ignore_ascii_case("strict") || v.eq_ignore_ascii_case("agent-only"))
        .unwrap_or(false);
    let lean = lean || env_lean;

    let webgrid = read_hotpipe_file("webgrid-play.js").unwrap_or_default();
    let activity_board = read_hotpipe_file("activity-leaderboard.js").unwrap_or_default();
    let session_rec = read_hotpipe_file("session-recorder.js").unwrap_or_default();
    let contrail = read_hotpipe_file("webgrid-contrail.js").unwrap_or_default();
    let glass_cap = read_hotpipe_file("glass-capsule-shell.js").unwrap_or_default();
    let float_kb = read_hotpipe_file("float-keyboard.js").unwrap_or_default();
    let bloch_bus = read_hotpipe_file("bloch-solve-bus.js").unwrap_or_default();
    let mem_maze = read_hotpipe_file("memory-maze-gsplat.js").unwrap_or_default();
    let kb_beats = read_hotpipe_file("keyboard-beats.js").unwrap_or_default();
    let rubik_lang = read_hotpipe_file("rubik-language-float.js").unwrap_or_default();
    let collab = read_hotpipe_file("collab.js").unwrap_or_default();
    let collab_day = read_hotpipe_file("collab-day.js").unwrap_or_default();
    let live_hud = read_hotpipe_file("live-solve-hud.js").unwrap_or_default();
    let kbatch_dojo = read_hotpipe_file("kbatch-dojo-bridge.js").unwrap_or_default();
    let quantum = read_hotpipe_file("quantum-webgrid.js").unwrap_or_default();
    let sx_rail = read_hotpipe_file("sx-rail-chrome.js").unwrap_or_default();

    if lean {
        for wv in targets {
            inject_js_blob(wv, &js);
            if !webgrid.is_empty() {
                inject_js_blob(wv, &webgrid);
            }
            if !kbatch_dojo.is_empty() {
                inject_js_blob(wv, &kbatch_dojo);
            }
            /* Dual-space floats — always on for WebGrid lab (unless strict) */
            if !strict {
                if !sx_rail.is_empty() {
                    inject_js_blob(wv, &sx_rail);
                }
                if !quantum.is_empty() {
                    inject_js_blob(wv, &quantum);
                }
                if !contrail.is_empty() {
                    inject_js_blob(wv, &contrail);
                }
                if !glass_cap.is_empty() {
                    inject_js_blob(wv, &glass_cap);
                }
                if !float_kb.is_empty() {
                    inject_js_blob(wv, &float_kb);
                }
                if !bloch_bus.is_empty() {
                    inject_js_blob(wv, &bloch_bus);
                }
                if !mem_maze.is_empty() {
                    inject_js_blob(wv, &mem_maze);
                }
                if !kb_beats.is_empty() {
                    inject_js_blob(wv, &kb_beats);
                }
                if !rubik_lang.is_empty() {
                    inject_js_blob(wv, &rubik_lang);
                }
                if !collab.is_empty() {
                    inject_js_blob(wv, &collab);
                }
                if !collab_day.is_empty() {
                    inject_js_blob(wv, &collab_day);
                }
                if !live_hud.is_empty() {
                    inject_js_blob(wv, &live_hud);
                }
            }
            if !activity_board.is_empty() {
                inject_js_blob(wv, &activity_board);
            }
            if !session_rec.is_empty() {
                inject_js_blob(wv, &session_rec);
            }
            inject_leaderboard_handoff(wv);
        }
        eprintln!(
            "hotpipe: LEAN play-lab floats={} → {} surface(s)",
            !strict,
            targets.len()
        );
        return true;
    }

    // Full stack (normal browse / inspect / research)
    let body = read_hotpipe_file("body-pose.js").unwrap_or_default();
    let lens = read_hotpipe_file("lens.js").unwrap_or_default();
    let hurdles = read_hotpipe_file("hurdles.js").unwrap_or_default();
    let research = read_hotpipe_file("research.js").unwrap_or_default();
    let ego = read_hotpipe_file("ego.js").unwrap_or_default();
    let dock = read_hotpipe_file("inspect-dock.js").unwrap_or_default();
    let ironline = read_hotpipe_file("ironline.js").unwrap_or_default();
    let ugrad = read_hotpipe_file("ugrad-ladder.js").unwrap_or_default();
    let ugrad_wg = read_hotpipe_file("ugrad-webgrid-tensor.js").unwrap_or_default();
    let collab = read_hotpipe_file("collab.js").unwrap_or_default();
    let market = read_hotpipe_file("market-filmstrip.js").unwrap_or_default();
    let video = read_hotpipe_file("video-feed-panel.js").unwrap_or_default();
    let lark = read_hotpipe_file("lark-governance.js").unwrap_or_default();
    let quantum = read_hotpipe_file("quantum-webgrid.js").unwrap_or_default();
    let sx_rail = read_hotpipe_file("sx-rail-chrome.js").unwrap_or_default();
    let kbatch_dojo = read_hotpipe_file("kbatch-dojo-bridge.js").unwrap_or_default();
    let contrail = read_hotpipe_file("webgrid-contrail.js").unwrap_or_default();
    let glass_cap = read_hotpipe_file("glass-capsule-shell.js").unwrap_or_default();
    let float_kb = read_hotpipe_file("float-keyboard.js").unwrap_or_default();
    let bloch_bus = read_hotpipe_file("bloch-solve-bus.js").unwrap_or_default();
    let mem_maze = read_hotpipe_file("memory-maze-gsplat.js").unwrap_or_default();
    let kb_beats = read_hotpipe_file("keyboard-beats.js").unwrap_or_default();
    let rubik_lang = read_hotpipe_file("rubik-language-float.js").unwrap_or_default();
    let collab_day = read_hotpipe_file("collab-day.js").unwrap_or_default();
    let live_hud = read_hotpipe_file("live-solve-hud.js").unwrap_or_default();
    for wv in targets {
        inject_js_blob(wv, &js);
        if !body.is_empty() {
            inject_js_blob(wv, &body);
        }
        if !lens.is_empty() {
            inject_js_blob(wv, &lens);
        }
        if !hurdles.is_empty() {
            inject_js_blob(wv, &hurdles);
        }
        if !research.is_empty() {
            inject_js_blob(wv, &research);
        }
        if !ego.is_empty() {
            inject_js_blob(wv, &ego);
        }
        if !dock.is_empty() {
            inject_js_blob(wv, &dock);
        }
        if !ironline.is_empty() {
            inject_js_blob(wv, &ironline);
        }
        if !ugrad.is_empty() {
            inject_js_blob(wv, &ugrad);
        }
        if !ugrad_wg.is_empty() {
            inject_js_blob(wv, &ugrad_wg);
        }
        if !collab.is_empty() {
            inject_js_blob(wv, &collab);
        }
        if !webgrid.is_empty() {
            inject_js_blob(wv, &webgrid);
        }
        if !kbatch_dojo.is_empty() {
            inject_js_blob(wv, &kbatch_dojo);
        }
        if !contrail.is_empty() {
            inject_js_blob(wv, &contrail);
        }
        if !sx_rail.is_empty() {
            inject_js_blob(wv, &sx_rail);
        }
        if !market.is_empty() {
            inject_js_blob(wv, &market);
        }
        if !video.is_empty() {
            inject_js_blob(wv, &video);
        }
        if !lark.is_empty() {
            inject_js_blob(wv, &lark);
        }
        if !quantum.is_empty() {
            inject_js_blob(wv, &quantum);
        }
        if !glass_cap.is_empty() {
            inject_js_blob(wv, &glass_cap);
        }
        if !float_kb.is_empty() {
            inject_js_blob(wv, &float_kb);
        }
        if !bloch_bus.is_empty() {
            inject_js_blob(wv, &bloch_bus);
        }
        if !activity_board.is_empty() {
            inject_js_blob(wv, &activity_board);
        }
        if !session_rec.is_empty() {
            inject_js_blob(wv, &session_rec);
        }
        if !mem_maze.is_empty() {
            inject_js_blob(wv, &mem_maze);
        }
        if !kb_beats.is_empty() {
            inject_js_blob(wv, &kb_beats);
        }
        if !rubik_lang.is_empty() {
            inject_js_blob(wv, &rubik_lang);
        }
        if !collab_day.is_empty() {
            inject_js_blob(wv, &collab_day);
        }
        if !live_hud.is_empty() {
            inject_js_blob(wv, &live_hud);
        }
        inject_filmstrip_board(wv);
        inject_leaderboard_handoff(wv);
    }
    eprintln!(
        "hotpipe: FULL stack injected → {} surface(s)",
        targets.len()
    );
    true
}

/// H5: warm still-pipe + expose prefetch meta to inspect (no multi-ffmpeg)
fn still_prefetch_meta_js() -> String {
    let vision = dirs_vision();
    let live = vision.join("live.jpg");
    let (ok, age_ms, bytes) = match std::fs::metadata(&live) {
        Ok(m) => {
            let age = m
                .modified()
                .ok()
                .and_then(|t| t.elapsed().ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(99999);
            (true, age, m.len())
        }
        Err(_) => (false, 99999u64, 0u64),
    };
    format!(
        r#"(function(){{try{{
  var m={{ok:{ok},ageMs:{age},bytes:{bytes},t:Date.now()}};
  window.__mgPrefetchMeta=m;
  if(typeof window.__mgStillPrefetch==='function')window.__mgStillPrefetch(m);
  if(m.ok&&typeof window.__mgSysStillOk==='function'&&m.ageMs<800)window.__mgSysStillOk();
}}catch(e){{}}}})();"#,
        ok = if ok { "true" } else { "false" },
        age = age_ms,
        bytes = bytes
    )
}

fn dirs_vision() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("GY_VISION_DIR") {
        return std::path::PathBuf::from(p);
    }
    dirs_home().join(".panda/vision")
}

fn dirs_home() -> std::path::PathBuf {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("."))
}

fn mtime_of(path: &std::path::Path) -> Option<std::time::SystemTime> {
    std::fs::metadata(path).and_then(|m| m.modified()).ok()
}

/// Match inspect error text → mitigation file stems.
fn mitigation_for_error(msg: &str) -> Option<&'static str> {
    let m = msg.to_lowercase();
    if m.contains("notallowederror")
        || m.contains("camera denied")
        || m.contains("permissiondenied")
    {
        return Some("camera_denied");
    }
    if m.contains("can't find variable: wrap")
        || m.contains("cannot find variable: wrap")
        || m.contains("wrap is not defined")
        || m.contains("prescriptionsection")
    {
        return Some("portal_wrap");
    }
    None
}

fn apply_mitigation(targets: &[&wry::WebView], stem: &str) -> bool {
    let path = hotpipe_dir()
        .join("mitigations")
        .join(format!("{stem}.js"));
    let Ok(js) = std::fs::read_to_string(&path) else {
        for wv in targets {
            inject_dev_line(
                wv,
                "warn",
                &format!("mitigation missing · {stem}.js"),
                "hotpipe",
            );
        }
        return false;
    };
    for wv in targets {
        inject_js_blob(wv, &js);
        inject_dev_line(
            wv,
            "ok",
            &format!("mitigation applied · {stem}"),
            "hotpipe",
        );
    }
    true
}

fn write_inspect_pack(dump: &str, start_url: &str) -> std::path::PathBuf {
    let dir = hotpipe_dir().join("out");
    let _ = std::fs::create_dir_all(&dir);
    let ts = chrono_like_ts();
    let path = dir.join(format!("inspect-pack-{ts}.md"));
    let prompt = read_hotpipe_file("prompt.md").unwrap_or_default();
    let body = format!(
        r#"# Memory Glass · inspect pack
- time: {ts}
- start: {start_url}
- hotpipe: {}

## Live prompt
{prompt}

## Inspect spit
```
{dump}
```

## Ask Grok Build
Diagnose Memory Glass HUD/track/camera/coverflow issues from the spit.
Prefer a hotpipe patch under `experiments/memory-glass/hotpipe/` when the fix is JS.
Full cargo rebuild only if Rust/window/IPC must change.
"#,
        hotpipe_dir().display()
    );
    let _ = std::fs::write(&path, &body);

    // Fleet pack for Lab chain / Panda
    if let Some(home) = std::env::var_os("HOME") {
        let panda = std::path::PathBuf::from(home).join(".panda/packs");
        let _ = std::fs::create_dir_all(&panda);
        let json = serde_json::json!({
            "source": "memory-glass",
            "ts": ts,
            "start": start_url,
            "hotpipe": hotpipe_dir().display().to_string(),
            "pack_path": path.display().to_string(),
            "dump": dump,
            "prompt": prompt,
        });
        let _ = std::fs::write(
            panda.join("mg-inspect.json"),
            serde_json::to_string_pretty(&json).unwrap_or_else(|_| "{}".into()),
        );
        let _ = std::fs::write(panda.join("last.json"), serde_json::to_string_pretty(&json).unwrap_or_else(|_| "{}".into()));
    }
    path
}

fn chrono_like_ts() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // simple local-ish stamp without chrono dep: unix + random-ish
    format!("{secs}")
}

fn agent_file_url() -> Option<String> {
    let p = hotpipe_dir().join("agent.html");
    if !p.is_file() {
        return None;
    }
    Some(format!("file://{}", p.display()))
}

fn leaderboard_file_url(post: bool) -> Option<String> {
    let p = hotpipe_dir().join("leaderboard.html");
    if !p.is_file() {
        // bundled app Resources/hotpipe
        return None;
    }
    let mut u = format!("file://{}", p.display());
    if post {
        u.push_str("?post=1");
    }
    Some(u)
}

fn mg_session_dir() -> std::path::PathBuf {
    std::path::PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".into()))
        .join(".panda/mg-session")
}

fn write_leaderboard_handoff(text: &str) -> std::path::PathBuf {
    let dir = mg_session_dir();
    let _ = std::fs::create_dir_all(&dir);
    let p = dir.join("leaderboard-handoff.json");
    let _ = std::fs::write(&p, text);
    p
}

fn read_leaderboard_handoff() -> Option<String> {
    let p = mg_session_dir().join("leaderboard-handoff.json");
    std::fs::read_to_string(p).ok().filter(|s| !s.trim().is_empty())
}

/// Inject handoff JSON so clean leaderboard window can post the playthrough run.
fn inject_leaderboard_handoff(wv: &wry::WebView) {
    let Some(raw) = read_leaderboard_handoff() else {
        return;
    };
    // Escape for single-quoted JS string via JSON encoding
    let encoded = serde_json::to_string(&raw).unwrap_or_else(|_| "\"{}\"".into());
    let js = format!(
        r#"(function(){{try{{
  var raw={encoded};
  var h=typeof raw==='string'?JSON.parse(raw):raw;
  window.__mgLbHandoff=h;
  try{{if(window.__mgLeaderboardPage&&window.__mgLeaderboardPage.ingest)window.__mgLeaderboardPage.ingest(h);}}catch(e0){{}}
  try{{if(window.__mgActivityBoard&&h&&h.run){{/* board module hydrates on timer */}}}}catch(e1){{}}
}}catch(e){{}}}})();"#
    );
    let _ = wv.evaluate_script(&js);
}

fn push_prompt_to_webview(wv: &wry::WebView) {
    let prompt = read_hotpipe_file("prompt.md").unwrap_or_else(|| "(prompt.md missing)".into());
    let js = format!(
        "(function(){{try{{if(window.__mgAgentSetPrompt)window.__mgAgentSetPrompt('{}');}}catch(e){{}}}})();",
        js_single_quote(&prompt)
    );
    let _ = wv.evaluate_script(&js);
}

fn push_loop_to_webview(wv: &wry::WebView) {
    let loop_txt = read_hotpipe_file("loop.json").unwrap_or_else(|| "{}".into());
    let js = format!(
        "(function(){{try{{if(window.__mgAgentSetLoop)window.__mgAgentSetLoop('{}');}}catch(e){{}}}})();",
        js_single_quote(&loop_txt)
    );
    let _ = wv.evaluate_script(&js);
}

/// Last lines of the launch wrapper log (tee from Memory Glass.app).
fn launch_log_tail(max_lines: usize) -> Vec<String> {
    let path = dirs_launch_log();
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return vec![format!("(no launch.log yet · {})", path.display())];
    };
    raw.lines()
        .rev()
        .take(max_lines)
        .map(|s| s.to_string())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

fn dirs_launch_log() -> std::path::PathBuf {
    if let Some(home) = std::env::var_os("HOME") {
        return std::path::PathBuf::from(home)
            .join("Library/Logs/MemoryGlass/launch.log");
    }
    std::path::PathBuf::from("launch.log")
}

/// Escape a string for embedding inside a single-quoted JS string.
fn js_single_quote(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('\n', "\\n")
        .replace('\r', "")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029")
}

/// One log line into a webview that exposes window.__mgDevLog(lvl, msg, src).
fn inject_dev_line(webview: &wry::WebView, lvl: &str, msg: &str, src: &str) {
    let js = format!(
        "(function(){{try{{if(typeof window.__mgDevLog==='function')window.__mgDevLog('{}','{}','{}');}}catch(e){{}}}})();",
        js_single_quote(lvl),
        js_single_quote(msg),
        js_single_quote(src)
    );
    let _ = webview.evaluate_script(&js);
}

/// Push boot + launch.log spit into inspect webview(s).
fn inject_dev_boot_spit(targets: &[&wry::WebView], start_url: &str) {
    if targets.is_empty() {
        return;
    }
    let mut lines: Vec<(String, String, String)> = Vec::new();
    lines.push(("ok".into(), "Memory Glass process up".into(), "rust".into()));
    lines.push(("info".into(), format!("start {start_url}"), "rust".into()));
    lines.push((
        "info".into(),
        "shell transparent NSWindow + WKWebView".into(),
        "rust".into(),
    ));
    lines.push((
        "ok".into(),
        "inspect float · native window to the right · ⌘⌥I".into(),
        "rust".into(),
    ));
    lines.push((
        "ok".into(),
        format!("hot-pipe · {} · edit live.js without relaunch", hotpipe_dir().display()),
        "hotpipe".into(),
    ));
    for line in launch_log_tail(18) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let lvl = if trimmed.contains("error")
            || trimmed.contains("Error")
            || trimmed.contains("panic")
            || trimmed.contains("denied")
        {
            "err"
        } else if trimmed.contains("WARN") || trimmed.contains("warn") {
            "warn"
        } else if trimmed.starts_with("----") {
            "ok"
        } else {
            "info"
        };
        lines.push((lvl.into(), trimmed.to_string(), "launch.log".into()));
    }
    for (lvl, msg, src) in &lines {
        for wv in targets {
            inject_dev_line(wv, lvl, msg, src);
        }
    }
}

/// Dock inspect to the right of main; only clamps if it would leave the monitor.
fn place_inspect_right_of(main: &Window, inspect: &Window) {
    tile_browser_and_inspect(main, inspect, false);
}

/// Dual-pane layout: main left, inspect fully visible to its right.
/// `force` = initial boot / menu Tile — may shrink & left-align main.
/// Soft path (window moved/resized) only repositions inspect and shrinks if overflow.
fn tile_browser_and_inspect(main: &Window, inspect: &Window, force: bool) {
    let scale = main.scale_factor().max(1.0);
    let mon = main
        .current_monitor()
        .or_else(|| main.primary_monitor())
        .or_else(|| inspect.current_monitor())
        .or_else(|| inspect.primary_monitor());

    let Ok(main_pos0) = main.outer_position() else {
        return;
    };
    let main_size0 = main.outer_size();
    let insp_size0 = inspect.outer_size();
    let gap = (12.0 * scale).round() as i32;
    let y_off = (28.0 * scale).round() as i32;

    let Some(mon) = mon else {
        inspect.set_outer_position(PhysicalPosition::new(
            main_pos0.x + main_size0.width as i32 + gap,
            main_pos0.y + y_off,
        ));
        return;
    };

    let mpos = mon.position();
    let msize = mon.size();
    let margin_l = (14.0 * scale).round() as i32;
    let margin_r = (14.0 * scale).round() as i32;
    let margin_t = (32.0 * scale).round() as i32;
    let margin_b = (16.0 * scale).round() as i32;
    let work_w = (msize.width as i32 - margin_l - margin_r).max(800);
    let work_h = (msize.height as i32 - margin_t - margin_b).max(480);
    let mon_left = mpos.x + margin_l;
    let mon_top = mpos.y + margin_t;
    let mon_right = mpos.x + msize.width as i32 - margin_r;
    let mon_bottom = mpos.y + msize.height as i32 - margin_b;

    let mut insp_w = insp_size0.width as i32;
    let mut insp_h = insp_size0.height as i32;
    let mut main_w = main_size0.width as i32;
    let mut main_h = main_size0.height as i32;

    if force {
        // Comfortable dual-pane defaults for this monitor
        let insp_pref_w = ((380.0_f64 * scale).round() as i32)
            .min((work_w as f64 * 0.32).round() as i32)
            .max((300.0 * scale).round() as i32);
        let insp_pref_h = ((work_h as f64) * 0.86).round() as i32;
        inspect.set_inner_size(LogicalSize::new(
            (insp_pref_w as f64 / scale).clamp(300.0, 460.0),
            (insp_pref_h as f64 / scale).clamp(480.0, 1100.0),
        ));
        let is = inspect.outer_size();
        insp_w = is.width as i32;
        insp_h = is.height as i32;

        let max_main_w = (work_w - gap - insp_w).max((640.0 * scale).round() as i32);
        if main_w > max_main_w || main_h > work_h {
            main.set_inner_size(LogicalSize::new(
                (max_main_w as f64 / scale).clamp(640.0, 1400.0),
                (main_h.min(work_h) as f64 / scale).clamp(480.0, 1100.0),
            ));
            let s = main.outer_size();
            main_w = s.width as i32;
            main_h = s.height as i32;
        }
    }

    // Will inspect fall off the right edge?
    let overflow =
        main_pos0.x + main_w + gap + insp_w > mon_right || main_pos0.x < mon_left - 12;
    if !force && overflow {
        // Soft rescue: shrink main just enough so inspect fits
        let max_main_w = (mon_right - mon_left - gap - insp_w).max((600.0 * scale).round() as i32);
        if main_w > max_main_w {
            main.set_inner_size(LogicalSize::new(
                (max_main_w as f64 / scale).max(600.0),
                main_h as f64 / scale,
            ));
            let s = main.outer_size();
            main_w = s.width as i32;
            main_h = s.height as i32;
        }
    }

    let need_shift = force || overflow;
    let main_x = if need_shift {
        mon_left
    } else {
        main_pos0
            .x
            .clamp(mon_left, (mon_right - main_w - gap - insp_w).max(mon_left))
    };
    let main_y = main_pos0
        .y
        .clamp(mon_top, (mon_bottom - main_h).max(mon_top));

    if need_shift || (main_x - main_pos0.x).abs() > 2 || (main_y - main_pos0.y).abs() > 2 {
        main.set_outer_position(PhysicalPosition::new(main_x, main_y));
    }

    // Re-read after possible main move/resize
    let main_size = main.outer_size();
    main_w = main_size.width as i32;
    let Ok(main_pos) = main.outer_position() else {
        return;
    };
    let mut insp_x = main_pos.x + main_w + gap;
    if insp_x + insp_w > mon_right {
        let overflow_px = insp_x + insp_w - mon_right;
        let target_w = (main_w - overflow_px - 4).max((600.0 * scale).round() as i32);
        if target_w < main_w {
            main.set_inner_size(LogicalSize::new(
                (target_w as f64 / scale).max(580.0),
                main_size.height as f64 / scale,
            ));
            let s = main.outer_size();
            main_w = s.width as i32;
            main.set_outer_position(PhysicalPosition::new(main_x, main_y));
            insp_x = main_x + main_w + gap;
        }
        insp_x = insp_x.min(mon_right - insp_w).max(mon_left);
    }
    // Keep inspect height inside work area (position only — don't fight user size unless force)
    if force && insp_h > work_h {
        inspect.set_inner_size(LogicalSize::new(
            insp_w as f64 / scale,
            (work_h as f64 / scale).clamp(420.0, 1100.0),
        ));
        insp_h = inspect.outer_size().height as i32;
    }
    let insp_y = (main_pos.y + y_off).clamp(mon_top, (mon_bottom - insp_h).max(mon_top));
    inspect.set_outer_position(PhysicalPosition::new(insp_x, insp_y));
}

fn voice_mic_mute(mute: bool) {
    let script = dirs_voice_mute_sh();
    let arg = if mute { "on" } else { "off" };
    match std::process::Command::new(&script)
        .arg(arg)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(_) => eprintln!("mic: mute.sh {arg}"),
        Err(e) => eprintln!("mic: mute.sh failed ({script}): {e}"),
    }
}

fn dirs_voice_mute_sh() -> String {
    std::env::var("HOME")
        .map(|h| format!("{h}/.panda/voice/mute.sh"))
        .unwrap_or_else(|_| "/Users/qbit/.panda/voice/mute.sh".into())
}

fn voice_mic_is_muted() -> bool {
    let path = std::env::var("HOME")
        .map(|h| std::path::PathBuf::from(h).join(".panda/voice/user.mute"))
        .unwrap_or_else(|_| std::path::PathBuf::from("/Users/qbit/.panda/voice/user.mute"));
    if !path.exists() {
        return false;
    }
    // non-empty mute file = muted (epoch or 999…)
    std::fs::read_to_string(&path)
        .map(|s| {
            let t = s.trim();
            !t.is_empty()
                && t != "0"
                && t
                    .parse::<i64>()
                    .map(|e| {
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0);
                        e > now
                    })
                    .unwrap_or(true)
        })
        .unwrap_or(false)
}

/// Standalone glass notification HTML for the external inspect window.
/// Hosts: coverflow carousel · camera PIP · inspect spit / hot-pipe.
fn inspect_panel_html() -> String {
    r##"<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Inspect</title>
<style>
  html,body{margin:0;height:100%;background:transparent!important;
    background-color:transparent!important;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    color:rgba(255,255,255,0.92);overflow:hidden;-webkit-user-select:none;user-select:none}
  /* Glass panel — stays translucent; native NSWindow must stay non-opaque (reassert on move/FS) */
  #panel{position:fixed;inset:8px;display:flex;flex-direction:column;
    background:rgba(10,12,16,0.52);
    backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);
    border:1px solid rgba(255,255,255,0.16);border-radius:12px;
    /* Soft glass lift — no hard black drop (was crunchy on transparent NSWindow) */
    box-shadow:0 8px 28px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,0.12);
    overflow:hidden}
  /* Vertical second screen / nearly full height — thinner glass, edge-to-edge, no black card */
  @media (min-height: 900px) and (max-width: 960px) {
    #panel{
      inset:0;border-radius:0;border-left:none;border-right:none;
      background:rgba(8,10,14,0.38);
      box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);
    }
  }
  html.mg-inspect-fill #panel{
    inset:0!important;border-radius:0!important;
    background:rgba(8,10,14,0.36)!important;
  }
  #hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;
    padding:11px 12px 10px;border-bottom:1px solid rgba(255,255,255,0.1);
    cursor:default;flex-shrink:0}
  #hdr .ttl{font:700 10px/1 system-ui;letter-spacing:0.18em;text-transform:uppercase;
    color:rgba(255,255,255,0.75)}
  #hdr .ttl .dot{opacity:0.5;margin-right:6px}
  #mg-build-stamp{font:600 9px/1.2 ui-monospace,Menlo,monospace;letter-spacing:0.04em;
    color:rgba(160,210,255,0.75);text-transform:none;margin-top:4px}
  #mg-build-stamp-full{display:none}
  #hdr .acts{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;max-width:72%}
  #hdr button{appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.16);
    background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.8);
    font:650 9px/1 system-ui;letter-spacing:0.08em;text-transform:uppercase;
    padding:5px 8px;border-radius:4px}
  #hdr button:hover{background:rgba(255,255,255,0.16);color:#fff}
  #hdr button.primary{border-color:rgba(140,200,255,0.45);color:rgba(160,210,255,0.95)}
  #hdr button.toggle.on{border-color:rgba(100,220,160,0.55);color:rgba(140,240,180,0.98);
    background:rgba(60,160,110,0.22)}
  #hdr button.toggle.off{border-color:rgba(255,120,120,0.4);color:rgba(255,170,170,0.9);
    background:rgba(120,40,40,0.22)}
  /* PIP on top, coverflow BELOW (clipped — never floats over camera) */
  #stage{flex-shrink:0;display:flex;flex-direction:column;gap:0;
    padding:10px 10px 8px;border-bottom:1px solid rgba(255,255,255,0.1);
    overflow:hidden}
  #pip-wrap{position:relative;width:100%;height:148px;border-radius:8px;overflow:hidden;
    border:1px solid rgba(160,210,255,0.28);background:#050608;
    box-shadow:0 4px 14px rgba(0,0,0,0.16);z-index:2;flex-shrink:0}
  #pip-mirror{position:absolute;inset:0;overflow:hidden}
  #pip-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
    transform:scaleX(-1);background:#050608}
  /* Hide native play chrome (scaleX would mirror the play glyph) */
  #pip-video::-webkit-media-controls{display:none!important}
  #pip-video::-webkit-media-controls-start-playback-button{display:none!important;-webkit-appearance:none}
  #pip-video::-webkit-media-controls-enclosure{display:none!important}
  #pip-overlay{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;
    transform:scaleX(-1)}
  #pip-lbl{position:absolute;left:8px;bottom:6px;z-index:3;
    font:650 8px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;
    color:rgba(180,220,255,0.7);text-shadow:0 1px 2px rgba(0,0,0,0.8)}
  /* Hover media controls — cam / mic on-off over face PIP */
  #pip-hover{position:absolute;right:8px;top:8px;z-index:5;display:flex;gap:6px;
    opacity:0;transform:translateY(-4px);pointer-events:none;
    transition:opacity .18s ease,transform .18s ease}
  #pip-wrap:hover #pip-hover,#pip-wrap:focus-within #pip-hover,#pip-hover.is-pinned{
    opacity:1;transform:none;pointer-events:auto}
  #pip-hover button{appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,0.28);
    background:rgba(8,10,14,0.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    color:rgba(255,255,255,0.9);font:700 9px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;
    padding:7px 10px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,0.35)}
  #pip-hover button:hover{background:rgba(255,255,255,0.16);color:#fff}
  #pip-hover button.on{border-color:rgba(100,220,160,0.55);color:rgba(160,255,200,0.98)}
  #pip-hover button.off{border-color:rgba(255,120,120,0.45);color:rgba(255,180,180,0.95);
    opacity:0.92}
  #cf{perspective:800px;height:100px;position:relative;overflow:hidden;z-index:1;
    margin-top:8px;flex-shrink:0;contain:layout paint}
  #cf-stage{position:relative;width:100%;height:100%;transform-style:preserve-3d;
    transform:rotateX(var(--cf-pitch,4deg)) rotateY(var(--cf-yaw,0deg)) scale(var(--cf-expand,1));
    transition:transform .1s linear;overflow:visible}
  .cf-card{position:absolute;left:50%;top:50%;width:100px;height:64px;margin:-32px 0 0 -50px;
    border:1px solid rgba(255,255,255,0.22);border-radius:4px;cursor:pointer;overflow:hidden;
    background:linear-gradient(165deg,rgba(255,255,255,0.1),rgba(0,0,0,0.25)),rgba(8,12,18,0.7);
    box-shadow:0 8px 18px rgba(0,0,0,0.35);transform-style:preserve-3d;
    transition:transform .35s cubic-bezier(.2,.85,.2,1),opacity .25s}
  .cf-card.on{border-color:rgba(180,230,255,0.55);box-shadow:0 0 14px rgba(100,190,255,0.22)}
  .cf-card .ttl{position:absolute;left:6px;right:6px;bottom:6px;z-index:2;
    font:650 8px/1.1 system-ui;letter-spacing:0.1em;text-transform:uppercase;
    color:rgba(255,255,255,0.9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cf-card .idx{position:absolute;top:5px;left:6px;font:700 8px/1 ui-monospace,Menlo,monospace;
    letter-spacing:0.1em;color:rgba(160,210,255,0.65)}
  #log{flex:1;overflow-y:auto;padding:8px 10px 12px;display:flex;flex-direction:column;gap:6px;
    -webkit-user-select:text;user-select:text;min-height:0}
  .row{display:grid;grid-template-columns:42px 1fr;gap:4px 8px;padding:7px 8px;border-radius:8px;
    background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);
    animation:in .25s ease}
  .row.err{background:rgba(255,70,70,0.12);border-color:rgba(255,120,120,0.28)}
  .row.warn{background:rgba(255,180,60,0.1);border-color:rgba(255,200,100,0.22)}
  .row.info{background:rgba(120,180,255,0.08);border-color:rgba(140,190,255,0.16)}
  .row.ok{background:rgba(80,200,140,0.08);border-color:rgba(100,220,160,0.18)}
  .lvl{font:700 8px/1.2 ui-monospace,Menlo,monospace;letter-spacing:0.06em;text-transform:uppercase;
    color:rgba(255,255,255,0.45);padding-top:2px}
  .row.err .lvl{color:rgba(255,140,140,0.95)}
  .row.warn .lvl{color:rgba(255,200,120,0.95)}
  .row.info .lvl{color:rgba(160,200,255,0.9)}
  .row.ok .lvl{color:rgba(140,230,180,0.9)}
  .body{min-width:0;font:500 10px/1.4 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.9);
    white-space:pre-wrap;word-break:break-word;-webkit-user-select:text;user-select:text}
  .meta{grid-column:2;font:500 8px/1.2 system-ui;color:rgba(255,255,255,0.35)}
  #empty{padding:20px 12px;text-align:center;font:500 10px/1.4 system-ui;
    color:rgba(255,255,255,0.35);letter-spacing:0.06em}
  /* System / spool meters — issue signals for RAM · GPU · frame lag */
  #mg-sys{flex-shrink:0;border-top:1px solid rgba(255,255,255,0.1);
    padding:8px 10px 10px;background:rgba(0,0,0,0.28);
    display:flex;flex-direction:column;gap:5px}
  #mg-sys .sys-row{display:grid;grid-template-columns:52px 1fr 40px;gap:6px;align-items:center}
  #mg-sys .sys-lbl{font:650 8px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;
    color:rgba(160,200,255,0.7)}
  #mg-sys .sys-bar{height:7px;border-radius:3px;background:rgba(255,255,255,0.08);
    overflow:hidden;border:1px solid rgba(255,255,255,0.1)}
  #mg-sys .sys-fill{height:100%;width:0%;border-radius:2px;
    background:linear-gradient(90deg,rgba(80,200,140,0.85),rgba(120,200,255,0.9));
    transition:width .25s ease,background .3s}
  #mg-sys .sys-fill.warn{background:linear-gradient(90deg,rgba(255,190,80,0.9),rgba(255,140,60,0.95))}
  #mg-sys .sys-fill.crit{background:linear-gradient(90deg,rgba(255,90,90,0.95),rgba(255,60,100,0.95))}
  #mg-sys .sys-pct{font:600 9px/1 ui-monospace,Menlo,monospace;color:rgba(200,220,255,0.85);text-align:right}
  #mg-sys .sys-sig{font:500 8px/1.25 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.45);
    letter-spacing:0.04em;min-height:1.25em}
  #mg-sys .sys-sig.hot{color:rgba(255,180,100,0.95)}
  #mg-sys .sys-sig.bad{color:rgba(255,120,120,0.98)}
  @keyframes in{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
</style></head>
<body>
<div id="panel">
  <div id="hdr">
    <div>
      <div class="ttl"><span class="dot">.</span>inspect · coverflow · pip</div>
      <div id="mg-build-stamp">version pending…</div>
      <div id="mg-build-stamp-full"></div>
    </div>
    <span class="acts">
      <button type="button" class="toggle on" id="btn-cam" title="Camera on/off">Cam</button>
      <button type="button" class="toggle on" id="btn-mic" title="Mic / STT on/off">Mic</button>
      <button type="button" id="copy">Copy</button>
      <button type="button" class="primary" id="submit">→ Grok</button>
      <button type="button" id="hot">Hot</button>
      <button type="button" id="mitigate">Mitigate</button>
      <button type="button" id="agent">Agent</button>
      <button type="button" id="clear">Clear</button>
      <button type="button" id="hide">Hide</button>
    </span>
  </div>
  <div id="stage">
    <div id="pip-wrap">
      <div id="pip-mirror">
        <video id="pip-video" muted playsinline autoplay></video>
      </div>
      <canvas id="pip-overlay" width="360" height="200"></canvas>
      <div id="pip-hover" class="pip-media-ctl">
        <button type="button" class="on" id="pip-cam" title="Toggle camera">Cam · on</button>
        <button type="button" class="on" id="pip-mic" title="Toggle microphone / STT">Mic · on</button>
      </div>
      <div id="pip-lbl">pip · face · hands</div>
    </div>
    <div id="cf">
      <div id="cf-stage"></div>
    </div>
  </div>
  <div id="log"><div id="empty">Waiting for launch / runtime spit…</div></div>
  <div id="mg-sys" title="Browser/runtime issue signals">
    <div class="sys-row"><span class="sys-lbl">RAM</span><div class="sys-bar"><div class="sys-fill" id="sys-ram"></div></div><span class="sys-pct" id="sys-ram-p">—</span></div>
    <div class="sys-row"><span class="sys-lbl">GPU</span><div class="sys-bar"><div class="sys-fill" id="sys-gpu"></div></div><span class="sys-pct" id="sys-gpu-p">—</span></div>
    <div class="sys-row"><span class="sys-lbl">Spool</span><div class="sys-bar"><div class="sys-fill" id="sys-spool"></div></div><span class="sys-pct" id="sys-spool-p">—</span></div>
    <div class="sys-row"><span class="sys-lbl">FPS</span><div class="sys-bar"><div class="sys-fill" id="sys-fps"></div></div><span class="sys-pct" id="sys-fps-p">—</span></div>
    <div class="sys-sig" id="sys-sig">SYS · waiting for samples…</div>
  </div>
</div>
<script>
(function(){
  var MAX=250, n=0, lines=[];
  function post(op, extra){
    try{
      var o=Object.assign({op:op}, extra||{});
      window.ipc.postMessage(JSON.stringify(o));
    }catch(e){}
  }
  /* ── System meters (RAM / GPU proxy / still-pipe spool / FPS) ── */
  (function sysMeters(){
    var lastFrame=performance.now(), frames=0, fps=30, fpsEma=30;
    var lastStillOk=performance.now();
    var gpuLoadEma=12;
    var glInfo='';
    try{
      var c=document.createElement('canvas');
      var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
      if(gl){
        var dbg=gl.getExtension('WEBGL_debug_renderer_info');
        glInfo=dbg?String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||''):'webgl';
      }
    }catch(e){}
    function setBar(id, pct, pId){
      var el=document.getElementById(id);
      var p=document.getElementById(pId);
      var v=Math.max(0,Math.min(100, pct|0));
      if(el){
        el.style.width=v+'%';
        el.classList.toggle('warn', v>=70&&v<88);
        el.classList.toggle('crit', v>=88);
      }
      if(p) p.textContent=v+'%';
      return v;
    }
    window.__mgSysStillOk=function(){ lastStillOk=performance.now(); };
    window.__mgSysSet=function(o){
      if(!o) return;
      if(o.stillOk) lastStillOk=performance.now();
      if(o.gpu!=null) gpuLoadEma=gpuLoadEma*0.7+(+o.gpu)*0.3;
    };
    function sample(){
      frames++;
      var now=performance.now();
      if(now-lastFrame>=500){
        fps=frames*1000/(now-lastFrame);
        fpsEma=fpsEma*0.6+fps*0.4;
        frames=0; lastFrame=now;
      }
      /* RAM: js heap if available, else deviceMemory inverse proxy */
      var ramPct=0;
      try{
        if(performance.memory && performance.memory.jsHeapSizeLimit){
          ramPct=100*(performance.memory.usedJSHeapSize/performance.memory.jsHeapSizeLimit);
        } else if(navigator.deviceMemory){
          /* lower deviceMemory → higher pressure score baseline */
          ramPct=Math.min(95, 18+(8-Math.min(8,navigator.deviceMemory))*9);
        } else {
          ramPct=28;
        }
      }catch(e){ ramPct=30; }
      /* Spool: age of last still-pipe / track frame */
      var stillAge=now-lastStillOk;
      var spoolPct=Math.min(100, (stillAge/2500)*100); /* 2.5s = 100% lag */
      /* GPU proxy: frame-time budget + gl presence (no true GPU %) */
      var frameBudget=Math.max(0, 100-(fpsEma/60)*100);
      var gpuPct=Math.min(99, gpuLoadEma*0.45+frameBudget*0.55+(glInfo?0:15));
      /* FPS bar inverted: full bar = healthy 60fps */
      var fpsBar=Math.min(100, (fpsEma/60)*100);

      setBar('sys-ram', ramPct, 'sys-ram-p');
      setBar('sys-gpu', gpuPct, 'sys-gpu-p');
      setBar('sys-spool', spoolPct, 'sys-spool-p');
      setBar('sys-fps', fpsBar, 'sys-fps-p');
      var sig=document.getElementById('sys-sig');
      if(sig){
        var issues=[];
        if(ramPct>=88) issues.push('RAM_CRIT heap pressure');
        else if(ramPct>=70) issues.push('RAM_WARN');
        if(gpuPct>=88) issues.push('GPU_CRIT frame budget');
        else if(gpuPct>=70) issues.push('GPU_WARN');
        if(spoolPct>=80) issues.push('SPOOL_STALL still-pipe lag');
        else if(spoolPct>=50) issues.push('SPOOL_SLOW');
        if(fpsEma<18) issues.push('FPS_DROP '+fpsEma.toFixed(0));
        var gshort=glInfo?(glInfo.length>42?glInfo.slice(0,42)+'…':glInfo):'no-webgl';
        if(issues.length){
          sig.textContent=issues.join(' · ');
          sig.className='sys-sig '+(ramPct>=88||gpuPct>=88||spoolPct>=80?'bad':'hot');
        } else {
          sig.textContent='OK · fps '+fpsEma.toFixed(0)+' · '+gshort;
          sig.className='sys-sig';
        }
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    /* also tick spool without rAF stall */
    setInterval(function(){
      var now=performance.now();
      var spoolPct=Math.min(100, ((now-lastStillOk)/2500)*100);
      setBar('sys-spool', spoolPct, 'sys-spool-p');
    }, 400);
  })();
  function dumpText(){
    return lines.map(function(r){
      return '['+r.t+'] '+(r.lvl||'info').toUpperCase()+' '+r.msg+(r.src?(' ('+r.src+')'):'');
    }).join('\n');
  }
  window.__mgDevLog=function(lvl,msg,src){
    var log=document.getElementById('log');
    if(!log) return;
    var empty=document.getElementById('empty');
    if(empty) empty.remove();
    var t=new Date().toISOString().slice(11,19);
    var item={lvl:lvl||'info', msg:String(msg||''), src:src||'', t:t};
    lines.push(item);
    if(lines.length>MAX) lines.shift();
    var row=document.createElement('div');
    row.className='row '+item.lvl;
    var L=document.createElement('div'); L.className='lvl'; L.textContent=item.lvl;
    var B=document.createElement('div'); B.className='body'; B.textContent=item.msg;
    var M=document.createElement('div'); M.className='meta';
    M.textContent=item.t+(item.src?(' · '+item.src):'');
    row.appendChild(L); row.appendChild(B); row.appendChild(M);
    log.appendChild(row);
    n++;
    while(log.querySelectorAll('.row').length>MAX){
      var f=log.querySelector('.row'); if(f) f.remove();
    }
    log.scrollTop=log.scrollHeight;
    /* Auto-mitigate only real page/runtime errs — never re-fire on hotpipe/mitigation noise */
    var src=(item.src||'').toLowerCase();
    var skip=src==='mitigation'||src==='hotpipe'||src==='clipboard'||src==='version'||src==='rust'||src==='launch.log'||src==='camera'||src==='inspect';
    if(item.lvl==='err' && !skip && item.msg){
      post('hot_mitigate', {msg:item.msg, src:item.src||''});
    }
  };
  window.__mgDevClear=function(){
    var log=document.getElementById('log');
    if(!log) return;
    log.innerHTML='';
    lines=[];
    var empty=document.createElement('div');
    empty.id='empty'; empty.textContent='Log cleared · waiting for spit…';
    log.appendChild(empty);
    n=0;
  };
  window.__mgDevDump=function(){ return dumpText(); };
  document.getElementById('clear').onclick=function(){ window.__mgDevClear(); post('dev_clear'); };
  document.getElementById('hide').onclick=function(){ post('dev_hide'); };
  document.getElementById('hot').onclick=function(){ post('hot_reload'); };
  document.getElementById('mitigate').onclick=function(){ post('hot_mitigate', {msg: dumpText()}); };
  document.getElementById('agent').onclick=function(){ post('open_agent'); };
  function copyViaNative(text, okMsg){
    /* Prefer native pbcopy via IPC — WKWebView often has no navigator.clipboard */
    post('clipboard_copy', {text: String(text||'')});
    /* Do not re-log through __mgDevLog here (avoids IPC noise); set empty status via row only once */
    try {
      var log=document.getElementById('log');
      if(log){
        var row=document.createElement('div');
        row.className='row ok';
        row.innerHTML='<div class="lvl">ok</div><div class="body"></div><div class="meta">clipboard</div>';
        row.querySelector('.body').textContent=okMsg||'Copy requested (native clipboard)';
        log.appendChild(row);
        log.scrollTop=log.scrollHeight;
      }
    } catch(e){}
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(String(text||'')).catch(function(){});
    }
  }
  document.getElementById('copy').onclick=function(){
    copyViaNative(dumpText(), 'Copied inspect spit (native clipboard)');
  };
  document.getElementById('submit').onclick=function(){
    var text=dumpText();
    var pack='Memory Glass inspect pack\n\n'+text+'\n\n(also written to hotpipe/out + ~/.panda/packs/mg-inspect.json)';
    post('submit_inspect', {dump: text});
    copyViaNative(pack, 'Submitted pack + copied for Grok Build');
  };
  window.__mgSetVersion=function(full,short){
    var el=document.getElementById('mg-build-stamp');
    if(el){el.textContent=short||full;el.title=full||'';}
    var el2=document.getElementById('mg-build-stamp-full');
    if(el2)el2.textContent=full||'';
    try{document.title='MG Inspect · '+(short||full||'');}catch(e){}
  };

  /* ── Coverflow in inspect float ── */
  var tabs=[], active=0, axis={yaw:0,pitch:6,expand:1};
  function cardXf(off){
    var abs=Math.abs(off);
    /* Keep cards in the cf band — mild fan, no large upward pitch over PIP */
    var rotY=-off*38+axis.yaw*0.22;
    var rotX=2+Math.min(4,Math.abs(axis.pitch)*0.08)+abs*1.2;
    var tx=off*70+axis.yaw*0.8;
    var ty=abs*3;
    var tz=-abs*48;
    var sc=off===0?1.06:Math.max(0.68,0.92-abs*0.08);
    var op=off===0?1:Math.max(0.32,0.88-abs*0.16);
    return {t:'translate3d(calc(-50% + '+tx.toFixed(1)+'px), calc(-50% + '+ty.toFixed(1)+'px), '+tz.toFixed(1)+'px) rotateY('+rotY.toFixed(1)+'deg) rotateX('+rotX.toFixed(1)+'deg) scale('+sc.toFixed(3)+')', op:op, z:String(100-abs)};
  }
  window.__mgInspectSetTabs=function(list, activeIdx){
    tabs=Array.isArray(list)?list:[];
    active=activeIdx|0;
    var stage=document.getElementById('cf-stage');
    if(!stage) return;
    stage.innerHTML='';
    tabs.forEach(function(tb,i){
      var off=i-active;
      var card=document.createElement('button');
      card.type='button';
      card.className='cf-card'+(i===active?' on':'');
      card.innerHTML='<span class="idx">'+(i+1<10?'0':'')+(i+1)+'</span><span class="ttl"></span>';
      card.querySelector('.ttl').textContent=tb.title||tb.url||('tab '+(i+1));
      var xf=cardXf(off);
      card.style.transform=xf.t; card.style.opacity=String(xf.op); card.style.zIndex=xf.z;
      card.onclick=function(e){ e.preventDefault(); post('switch_tab',{index:i}); };
      stage.appendChild(card);
    });
  };
  window.__mgInspectSetAxis=function(yaw,pitch,expand){
    axis.yaw=+yaw||0; axis.pitch=+pitch||6; axis.expand=+expand||1;
    document.documentElement.style.setProperty('--cf-yaw', axis.yaw+'deg');
    document.documentElement.style.setProperty('--cf-pitch', axis.pitch+'deg');
    document.documentElement.style.setProperty('--cf-expand', String(axis.expand));
    var stage=document.getElementById('cf-stage');
    if(!stage) return;
    var cards=stage.querySelectorAll('.cf-card');
    for(var c=0;c<cards.length;c++){
      var off=c-active;
      var xf=cardXf(off);
      cards[c].style.transform=xf.t;
      cards[c].style.opacity=String(xf.op);
      cards[c].classList.toggle('on', c===active);
    }
  };
  /* ── PIP camera + mic toggles (header + hover) ──
   * Default Mac cam OFF — still-pipe (phone) is primary vision and never needs
   * the OS "Memory Glass would like to access the camera" sheet during WebGrid.
   * Explicit Cam toggle enables Mac getUserMedia for the full session. */
  var pipStream=null;
  var camOn=false;
  var micOn=true; /* STT mic; inspect video stays muted for echo safety */
  var camSessionGranted=false;
  try{
    camSessionGranted=localStorage.getItem('mg.camera.session_ok')==='1'
      || sessionStorage.getItem('mg.camera.session_ok')==='1';
  }catch(eSess){}
  function paintMediaBtns(){
    var pairs=[
      [document.getElementById('btn-cam'), document.getElementById('pip-cam'), camOn, 'Cam'],
      [document.getElementById('btn-mic'), document.getElementById('pip-mic'), micOn, 'Mic']
    ];
    pairs.forEach(function(p){
      var on=!!p[2], label=p[3];
      [p[0], p[1]].forEach(function(b){
        if(!b) return;
        b.classList.toggle('on', on);
        b.classList.toggle('off', !on);
        if(b.id==='pip-cam'||b.id==='pip-mic'){
          b.textContent=label+' · '+(on?'on':'off');
        } else {
          b.textContent=label;
        }
        b.setAttribute('aria-pressed', on?'true':'false');
        b.title=label+(on?' on — click to turn off':' off — click to turn on');
      });
    });
    var lbl=document.getElementById('pip-lbl');
    if(lbl){
      lbl.textContent=camOn
        ? ('pip · live'+(micOn?' · mic':' · mic off'))
        : ('pip · cam off'+(micOn?' · mic':' · muted'));
    }
  }
  window.__mgInspectCam=function(on){
    camOn=!!on;
    var v=document.getElementById('pip-video');
    var lbl=document.getElementById('pip-lbl');
    if(!v){ paintMediaBtns(); return; }
    try{ v.controls=false; v.removeAttribute('controls'); v.setAttribute('playsinline',''); v.muted=true; }catch(eC){}
    if(!camOn){
      if(pipStream){ pipStream.getTracks().forEach(function(t){try{t.stop();}catch(e){}}); pipStream=null; }
      v.srcObject=null;
      try{ localStorage.setItem('mg.inspect.macCam','0'); }catch(e0){}
      paintMediaBtns();
      window.__mgDevLog('info','Inspect Mac cam off · still-pipe primary','pip');
      return;
    }
    /* Prefer existing stream — full-session reuse, no re-prompt */
    if(pipStream && pipStream.getVideoTracks && pipStream.getVideoTracks().some(function(t){return t.readyState==='live';})){
      v.srcObject=pipStream;
      v.play().catch(function(){});
      paintMediaBtns();
      window.__mgDevLog('ok','Inspect Mac cam · session stream reused','pip');
      return;
    }
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
      if(lbl) lbl.textContent='pip · no media';
      paintMediaBtns();
      window.__mgDevLog('warn','Inspect PIP · no mediaDevices (insecure origin)','pip');
      return;
    }
    /* One native prompt max for this process; then getUserMedia reuses TCC grant */
    try{
      if(window.ipc&&window.ipc.postMessage){
        window.ipc.postMessage(JSON.stringify({op:'request_camera'}));
      }
    }catch(eReq){}
    navigator.mediaDevices.getUserMedia({video:true,audio:false}).then(function(s){
      pipStream=s; v.srcObject=s;
      camSessionGranted=true;
      try{
        localStorage.setItem('mg.camera.session_ok','1');
        sessionStorage.setItem('mg.camera.session_ok','1');
        localStorage.setItem('mg.inspect.macCam','1');
      }catch(eLs){}
      var p=v.play();
      if(p&&p.then) p.then(function(){ paintMediaBtns(); }).catch(function(){
        if(lbl) lbl.textContent='pip · tap to play';
        v.addEventListener('click', function once(){ v.play().catch(function(){}); v.removeEventListener('click', once); }, {once:true});
      });
      paintMediaBtns();
      window.__mgDevLog('ok','Inspect Mac cam live · session grant saved','pip');
    }).catch(function(err){
      camOn=false;
      paintMediaBtns();
      if(lbl) lbl.textContent='pip · denied';
      window.__mgDevLog('warn','Inspect PIP camera · '+(err&&err.name||'fail')+' · still-pipe still works','pip');
    });
  };
  window.__mgInspectMic=function(on){
    micOn=!!on;
    post(micOn ? 'mic_unmute' : 'mic_mute');
    paintMediaBtns();
    window.__mgDevLog('ok','Mic STT '+(micOn?'on':'muted'),'mic');
  };
  window.__mgSetMicState=function(on){
    micOn=!!on;
    paintMediaBtns();
  };
  function toggleCam(){ window.__mgInspectCam(!camOn); }
  function toggleMic(){ window.__mgInspectMic(!micOn); }
  var bc=document.getElementById('btn-cam');
  var bm=document.getElementById('btn-mic');
  var pc=document.getElementById('pip-cam');
  var pm=document.getElementById('pip-mic');
  if(bc) bc.onclick=function(e){ e.preventDefault(); toggleCam(); };
  if(bm) bm.onclick=function(e){ e.preventDefault(); toggleMic(); };
  if(pc) pc.onclick=function(e){ e.preventDefault(); e.stopPropagation(); toggleCam(); };
  if(pm) pm.onclick=function(e){ e.preventDefault(); e.stopPropagation(); toggleMic(); };
  /* Keep hover controls visible briefly after click */
  var hover=document.getElementById('pip-hover');
  var pinT=0;
  function pinHover(){
    if(!hover) return;
    hover.classList.add('is-pinned');
    clearTimeout(pinT);
    pinT=setTimeout(function(){ hover.classList.remove('is-pinned'); }, 1600);
  }
  if(hover){
    hover.addEventListener('click', pinHover);
  }
  /* Sync mic state from native on boot */
  try{
    post('mic_status');
  }catch(eM){}
  /* Do NOT auto getUserMedia — that OS sheet blocks WebGrid.
   * Still-pipe (phone) owns face/hands. Mac cam only if user opted in this session. */
  setTimeout(function(){
    var wantMac=false;
    try{ wantMac=localStorage.getItem('mg.inspect.macCam')==='1' && camSessionGranted; }catch(eW){}
    if(wantMac){
      window.__mgInspectCam(true);
    }else{
      camOn=false;
      paintMediaBtns();
      var lbl=document.getElementById('pip-lbl');
      if(lbl) lbl.textContent='pip · still-pipe · Mac cam off';
      window.__mgDevLog('ok','Inspect · still-pipe primary · Mac cam deferred (no prompt)','pip');
    }
  }, 400);
  paintMediaBtns();
  /* Mark fill / vertical-screen maximize so CSS keeps glass (not solid black card) */
  function markInspectFill(){
    try{
      var tall=window.innerHeight>=900 && window.innerWidth<=960;
      var fill=window.innerHeight>=(screen.availHeight*0.9) || tall;
      document.documentElement.classList.toggle('mg-inspect-fill', !!fill);
    }catch(eF){}
  }
  markInspectFill();
  window.addEventListener('resize', markInspectFill);
  window.__mgDevLog('ok','Inspect · cam/mic · coverflow · hot-pipe · glass reassert on move/FS','inspect');
})();
</script>
</body></html>
"##
    .to_string()
}

/// Start a system window drag from an async IPC click (WKWebView / grips).
/// Uses a synthesized left-mouse-down at the current cursor — never reads
/// NSApp.currentEvent (nil → crash) and never floods set_outer_position.
#[cfg(target_os = "macos")]
fn begin_system_window_drag(window: &Window) {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use tao::platform::macos::WindowExtMacOS;

    #[repr(C)]
    struct NSPoint {
        x: f64,
        y: f64,
    }

    unsafe {
        let ns_window = window.ns_window() as *mut Object;
        if ns_window.is_null() {
            return;
        }

        // Cursor in window base coordinates (AppKit requirement for performWindowDragWithEvent:)
        let loc: NSPoint = msg_send![ns_window, mouseLocationOutsideOfEventStream];
        let window_number: i64 = msg_send![ns_window, windowNumber];

        // NSEventTypeLeftMouseDown = 1
        let event: *mut Object = msg_send![
            class!(NSEvent),
            mouseEventWithType: 1u64
            location: loc
            modifierFlags: 0u64
            timestamp: 0f64
            windowNumber: window_number
            context: std::ptr::null_mut::<Object>()
            eventNumber: 0i64
            clickCount: 1i64
            pressure: 1f64
        ];
        if event.is_null() {
            return;
        }
        let _: () = msg_send![ns_window, performWindowDragWithEvent: event];
    }
}

#[cfg(not(target_os = "macos"))]
fn begin_system_window_drag(window: &Window) {
    let _ = window.drag_window();
}

/// Trusted mouse click delivered in-process to the NSWindow (hits WKWebView).
/// JS synthetic events often set `isTrusted=false` and WebGrid ignores them.
/// `client_x` / `client_y`: CSS viewport coords (top-left origin).
#[cfg(target_os = "macos")]
fn synthetic_webview_click(window: &Window, client_x: f64, client_y: f64) {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use tao::platform::macos::WindowExtMacOS;

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSPoint {
        x: f64,
        y: f64,
    }

    unsafe {
        let ns_window = window.ns_window() as *mut Object;
        if ns_window.is_null() {
            return;
        }
        // AppKit window coords: origin bottom-left of window content
        let scale = window.scale_factor().max(1.0);
        let inner = window.inner_size();
        let logical_h = inner.height as f64 / scale;
        // Map CSS client (top-left of web content) → window base (bottom-left).
        let loc = NSPoint {
            x: client_x,
            y: (logical_h - client_y).max(0.0),
        };
        let window_number: i64 = msg_send![ns_window, windowNumber];
        // NSEventTypeLeftMouseDown = 1, LeftMouseUp = 2
        for (etype, pressure) in [(1u64, 1f64), (2u64, 0f64)] {
            let event: *mut Object = msg_send![
                class!(NSEvent),
                mouseEventWithType: etype
                location: loc
                modifierFlags: 0u64
                timestamp: 0f64
                windowNumber: window_number
                context: std::ptr::null_mut::<Object>()
                eventNumber: 0i64
                clickCount: 1i64
                pressure: pressure
            ];
            if !event.is_null() {
                let _: () = msg_send![ns_window, sendEvent: event];
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn synthetic_webview_click(_window: &Window, _x: f64, _y: f64) {}

fn hud_init_script() -> &'static str {
    r##"
(function () {
  function mgEl(id) { return document.getElementById(id); }
  function mgOn(el, ev, fn, opts) {
    if (!el) return;
    try { el.addEventListener(ev, fn, opts); } catch (e) {}
  }

  /*
   * Dev inspect buffer — installed FIRST so we catch spit from boot / portal / cam.
   * Renders into a glass float on the right once #mg-dev exists.
   */
  (function installDevInspect() {
    if (window.__mgDevInstalled) return;
    window.__mgDevInstalled = true;
    var MAX = 200;
    var buf = [];
    var errN = 0;
    var warnN = 0;
    var openPref = false;
    try { openPref = localStorage.getItem("mg.dev.open") === "1"; } catch (e0) {}

    function fmtArg(a) {
      try {
        if (a == null) return String(a);
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.name + ": " + a.message + (a.stack ? "\n" + a.stack : "");
        if (typeof a === "object") {
          try { return JSON.stringify(a); } catch (eJ) { return String(a); }
        }
        return String(a);
      } catch (eF) { return "?"; }
    }
    function paint() {
      var log = mgEl("mg-dev-log");
      var badge = mgEl("mg-dev-badge");
      var empty = mgEl("mg-dev-empty");
      var root = mgEl("mg-dev");
      if (badge) {
        var n = errN + warnN;
        badge.textContent = String(Math.min(99, buf.length));
        badge.classList.toggle("has-err", errN > 0);
        badge.classList.toggle("has-warn", errN === 0 && warnN > 0);
        if (n > 0) badge.textContent = String(Math.min(99, n));
      }
      if (!log) return;
      if (empty) empty.remove();
      /* append only new rows */
      var have = log.querySelectorAll(".row").length;
      for (var i = have; i < buf.length; i++) {
        var it = buf[i];
        var row = document.createElement("div");
        row.className = "row " + (it.lvl || "info");
        var lvl = document.createElement("div");
        lvl.className = "lvl";
        lvl.textContent = it.lvl || "info";
        var body = document.createElement("div");
        body.className = "body";
        body.textContent = it.msg;
        var meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = it.t + (it.src ? " · " + it.src : "");
        row.appendChild(lvl);
        row.appendChild(body);
        row.appendChild(meta);
        log.appendChild(row);
      }
      while (log.querySelectorAll(".row").length > MAX) {
        var first = log.querySelector(".row");
        if (first) first.remove();
      }
      log.scrollTop = log.scrollHeight;
      var last = buf.length ? buf[buf.length - 1] : null;
      if (root && last && (last.lvl === "err" || last.lvl === "warn")) {
        if (!root.classList.contains("is-open") && !root.__mgUserClosed) {
          root.classList.add("is-open");
        }
      }
    }
    function push(lvl, msg, src) {
      var now = new Date();
      var t = now.toISOString().slice(11, 19);
      var L = lvl || "info";
      var M = String(msg || "");
      var S = src || "";
      buf.push({ lvl: L, msg: M, src: S, t: t });
      if (buf.length > MAX) buf.shift();
      if (L === "err") errN++;
      if (L === "warn") warnN++;
      try { paint(); } catch (eP) {}
      /* Bridge to native inspect window (floats outside browser, docked right) */
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(JSON.stringify({
            op: "dev_log", lvl: L, msg: M, src: S, t: t
          }));
        }
      } catch (eIpc) {}
    }
    window.__mgDevLog = function (lvl, msg, src) { push(lvl, msg, src); };
    window.__mgDevClear = function () {
      buf = []; errN = 0; warnN = 0;
      var log = mgEl("mg-dev-log");
      if (log) {
        log.innerHTML = "";
        var empty = document.createElement("div");
        empty.id = "mg-dev-empty";
        empty.textContent = "Log cleared · waiting for spit…";
        log.appendChild(empty);
      }
      paint();
    };
    window.__mgDevDump = function () {
      return buf.map(function (r) {
        return "[" + r.t + "] " + (r.lvl || "info").toUpperCase() + " " + r.msg + (r.src ? " (" + r.src + ")" : "");
      }).join("\n");
    };
    window.__mgDevSetOpen = function (on) {
      /* Prefer native float outside the browser; keep in-page as badge only */
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(JSON.stringify({ op: on ? "dev_show" : "dev_hide" }));
        }
      } catch (eI) {}
      var root = mgEl("mg-dev");
      if (!root) return;
      root.classList.toggle("is-open", !!on);
      root.__mgUserClosed = !on;
      try { localStorage.setItem("mg.dev.open", on ? "1" : "0"); } catch (eL) {}
    };

    /* Hook console */
    var levels = ["log", "info", "warn", "error", "debug"];
    levels.forEach(function (name) {
      var orig = console[name] && console[name].bind(console);
      console[name] = function () {
        try {
          var args = Array.prototype.slice.call(arguments);
          var lvl = name === "error" ? "err" : (name === "warn" ? "warn" : (name === "log" || name === "info" ? "info" : "info"));
          if (name === "log") lvl = "info";
          push(lvl, args.map(fmtArg).join(" "), "console." + name);
        } catch (eH) {}
        if (orig) try { return orig.apply(console, arguments); } catch (eO) {}
      };
    });
    window.addEventListener("error", function (ev) {
      var msg = (ev && ev.message) || "error";
      if (ev && ev.filename) msg += " @ " + ev.filename + ":" + (ev.lineno || 0);
      push("err", msg, "window.onerror");
    }, true);
    window.addEventListener("unhandledrejection", function (ev) {
      var r = ev && ev.reason;
      push("err", fmtArg(r), "unhandledrejection");
    });

    push("ok", "Dev inspect online · glass float (right)", "boot");
    push("info", "Capturing console · errors · launch spit", "boot");
    if (openPref) {
      setTimeout(function () {
        var root = mgEl("mg-dev");
        if (root) root.classList.add("is-open");
      }, 0);
    }
    /* Flush paint when DOM ready */
    var tries = 0;
    var tick = setInterval(function () {
      tries++;
      if (mgEl("mg-dev-log") || tries > 80) {
        clearInterval(tick);
        paint();
      }
    }, 50);
  })();

  /* Re-run safe: remount + re-wire menus if chrome already exists (SPA / second inject) */
  if (mgEl("mg-root")) {
    try {
      var er = mgEl("mg-root");
      if (er.hasAttribute("popover")) er.removeAttribute("popover");
      er.style.width = "0px";
      er.style.height = "0px";
      er.style.overflow = "visible";
      er.style.pointerEvents = "none";
      er.style.zIndex = "2147483646";
      if (er.parentNode !== document.documentElement) document.documentElement.appendChild(er);
      /* Re-bind shell menus even on re-entry — SPA can drop listeners */
      if (typeof window.__mgWireShellMenus === "function") {
        try { window.__mgWireShellMenus(); } catch (eW) {}
      }
    } catch (e0) {}
    return;
  }
  window.__mgHud = true;
  window.__mgSetVersion = function (full, short) {
    try {
      var el = document.getElementById("mg-build-stamp");
      if (el) {
        el.textContent = short || full || "";
        el.title = full || short || "";
      }
      window.__MG_VERSION = full || short || "";
    } catch (eV) {}
  };

  var OPEN_KEY = "mg.dragon.panel.open";

  /*
   * Seamless droplet: page is NOT scaled (scale leaves a black gap).
   * Mask applies to BODY only — never html — so #mg-root chrome stays unclipped
   * (YouTube theater / fullscreen would otherwise swallow CTRL + search hit targets).
   * Camera viewRay drives overlays always; optional page-axis lean when not theater.
   */
  var drop = document.createElement("style");
  drop.id = "mg-droplet-mask";
  drop.textContent = ""
    /*
     * See-through glass (Drop / Glow sliders live again):
     *  - html stays clear so desktop shows at the lip
     *  - body fill alpha via --mg-fill-a (Drop drives it)
     *  - long soft droplet mask via --mg-drop-w/h (Drop)
     *  - single 12px corner clip on content layer (native) only — no clip-path crunch
     */
    + "html{"
    + "  height:100%!important;"
    + "  background:transparent!important;"
    + "  background-color:transparent!important;"
    + "  border-radius:12px!important;"
    + "  overflow:hidden!important;"
    + "  -webkit-mask-image:none!important;mask-image:none!important;"
    + "  clip-path:none!important;-webkit-clip-path:none!important;"
    + "}"
    + "html,body{box-shadow:none!important;outline:none!important}"
    + "body{"
    + "  height:100%!important;"
    + "  min-height:100%!important;"
    + "  margin:0!important;"
    + "  overflow-x:hidden!important;"
    + "  overflow-y:auto!important;"
    + "  background:rgba(12,14,18,var(--mg-fill-a,0.78))!important;"
    + "  background-color:rgba(12,14,18,var(--mg-fill-a,0.78))!important;"
    /* Soft corners only — hard 12px clip fights long glass vignette */
    + "  border-radius:0!important;"
    /*
     * Drop = long soft glass lip (organic-sphere feel), NOT a small cookie-cutter ellipse.
     * Ellipse stays near full-window; --mg-drop-core moves where the soft fade begins.
     * JS applySeeThrough() rewrites a concrete mask (WK var recompute is flaky).
     */
    + "  -webkit-mask-image:radial-gradient(ellipse var(--mg-drop-w,108%) var(--mg-drop-h,104%) at 50% 48%,"
    + "    #fff 0%,"
    + "    #fff var(--mg-drop-core,72%),"
    + "    rgba(255,255,255,0.88) var(--mg-drop-mid,82%),"
    + "    rgba(255,255,255,0.48) var(--mg-drop-soft,90%),"
    + "    rgba(255,255,255,0.14) 96%,"
    + "    transparent 100%)!important;"
    + "  mask-image:radial-gradient(ellipse var(--mg-drop-w,108%) var(--mg-drop-h,104%) at 50% 48%,"
    + "    #fff 0%,"
    + "    #fff var(--mg-drop-core,72%),"
    + "    rgba(255,255,255,0.88) var(--mg-drop-mid,82%),"
    + "    rgba(255,255,255,0.48) var(--mg-drop-soft,90%),"
    + "    rgba(255,255,255,0.14) 96%,"
    + "    transparent 100%)!important;"
    + "  -webkit-mask-mode:alpha!important;mask-mode:alpha!important;"
    + "  -webkit-mask-repeat:no-repeat!important;mask-repeat:no-repeat!important;"
    + "  -webkit-mask-size:100% 100%!important;mask-size:100% 100%!important;"
    + "  transform:none;"
    + "  transform-origin:50% 46%;"
    + "  perspective:none;"
    + "  -webkit-overflow-scrolling:touch;"
    + "}"
    + "body::-webkit-scrollbar{width:9px;height:9px}"
    + "body::-webkit-scrollbar-track{background:transparent;margin:12px 2px}"
    + "body::-webkit-scrollbar-thumb{"
    + "  background:rgba(255,255,255,0.18);border-radius:8px;"
    + "  border:2px solid transparent;background-clip:padding-box}"
    + "body::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.28);"
    + "  border:2px solid transparent;background-clip:padding-box}"
    + "body::-webkit-scrollbar-corner{background:transparent}"
    + "html::after{"
    + "  content:'';pointer-events:none;position:fixed;inset:0;z-index:2147483000;"
    + "  border-radius:12px;"
    + "  box-shadow:inset 0 0 0 1px rgba(255,255,255,0.10),"
    + "    inset 0 0 36px rgba(255,255,255,0.04);"
    + "  background:transparent;"
    + "}"
    + "html.mg-axis-on:not(.mg-yt-theater):not(.mg-yt-fs):not(.mg-scrolling) body{"
    + "  transform:perspective(var(--mg-fov,1600px))"
    + "    rotateX(var(--mg-rx,0deg)) rotateY(var(--mg-ry,0deg))"
    + "    translate3d(var(--mg-px,0px),0px,var(--mg-pz,0px))"
    + "    scale(var(--mg-sc,1))!important;"
    + "  transform-style:preserve-3d;"
    + "  will-change:transform;"
    + "}"
    + "html.mg-axis-on.mg-scrolling body,"
    + "html.mg-yt-theater body,html.mg-yt-fs body{"
    + "  transform:none!important;"
    + "  will-change:auto;"
    + "}";
  (document.documentElement || document.head).appendChild(drop);

  var css = ""
    /*
     * Zero-size root: children are position:fixed to the viewport.
     * A full-viewport root (even pointer-events:none) still fights WKWebView
     * hit-testing after SPA churn / second windows (⌘N) — blocks move/resize/clicks.
     */
    + "#mg-root{"
    + "  position:fixed!important;top:0!important;left:0!important;"
    + "  width:0!important;height:0!important;margin:0!important;padding:0!important;"
    + "  border:none!important;background:transparent!important;"
    + "  display:block!important;visibility:visible!important;opacity:1!important;"
    + "  overflow:visible!important;z-index:2147483646!important;pointer-events:none!important;"
    + "  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;"
    + "  color:rgba(244,246,250,0.96);"
    + "  transform:none!important;clip:auto!important;clip-path:none!important;"
    + "  -webkit-mask-image:none!important;mask-image:none!important}"
    + "#mg-root *{box-sizing:border-box}"
    + "#mg-root button,#mg-root input,#mg-root form,#mg-root label,"
    + "#mg-root #mg-dragon,#mg-root #mg-search-dock,#mg-root #mg-stoplights,"
    + "#mg-root #mg-tabs,#mg-root #mg-panel,#mg-root #mg-tab-row,"
    + "#mg-root #mg-drag-pad,#mg-root .mg-grip,#mg-root .mg-edge,#mg-root .mg-dot,"
    + "#mg-root #mg-cinema-btn,#mg-root #mg-top-right,#mg-root #mg-mode-menu,#mg-root #mg-mode-menu button,"
    + "#mg-root #mg-dev,#mg-root #mg-dev button,#mg-root #mg-dev-log,"
    + "#mg-root .mg-btab,#mg-root #mg-tab-add{"
    + "  pointer-events:auto}"
    /* Clipboard: chrome uses user-select:none; restore on real fields */
    + "#mg-root input,#mg-root textarea,#mg-root select,"
    + "#mg-root [contenteditable],#mg-root [contenteditable=true]{"
    + "  -webkit-user-select:text!important;user-select:text!important;"
    + "  -webkit-touch-callout:default}"
    + "#mg-root #mg-lf,#mg-root #mg-ana-stack,#mg-root #mg-stereo-ghost,"
    + "#mg-root #mg-vignette,#mg-root #mg-lens,#mg-root #mg-irradiance,"
    + "#mg-root #mg-chroma,#mg-root #mg-spec,#mg-root #mg-fovea,"
    + "#mg-root #mg-focus-reticle,#mg-root #mg-hud-ring,#mg-root #mg-dim,"
    + "#mg-root #mg-cam-pip,#mg-root #mg-scrim{"
    + "  pointer-events:none!important}"
    /* Scrim only blocks page when panel open — never covers chrome z-order */
    + "#mg-dragon.is-open ~ #mg-scrim{pointer-events:auto!important}"
    /* Edge resize hit strips — thick enough to grab; above page, under open CTRL panel */
    + ".mg-edge{position:fixed!important;z-index:2147483630!important;"
    + "  background:transparent;padding:0;margin:0;border:0;"
    + "  pointer-events:auto!important;-webkit-app-region:no-drag}"
    + ".mg-edge.n{top:0;left:14px;right:14px;height:10px;cursor:ns-resize}"
    + ".mg-edge.s{bottom:0;left:14px;right:14px;height:12px;cursor:ns-resize}"
    + ".mg-edge.e{top:14px;right:0;bottom:14px;width:10px;cursor:ew-resize}"
    + ".mg-edge.w{top:14px;left:0;bottom:14px;width:10px;cursor:ew-resize}"
    + ".mg-edge.ne{top:0;right:0;width:18px;height:18px;cursor:nesw-resize}"
    + ".mg-edge.nw{top:0;left:0;width:18px;height:18px;cursor:nwse-resize}"
    + ".mg-edge.se{bottom:0;right:0;width:20px;height:20px;cursor:nwse-resize}"
    + ".mg-edge.sw{bottom:0;left:0;width:18px;height:18px;cursor:nesw-resize}"
    /* ── Depth stack: overlays only — no second full-window mask (avoids edge double-glass) ── */
    + "#mg-lf{"
    + "  position:fixed;inset:0;z-index:0;pointer-events:none;"
    + "  perspective:var(--mg-fov,1600px);perspective-origin:50% 46%;"
    + "  transform-style:preserve-3d;"
    + "  -webkit-mask-image:none;mask-image:none;"
    + "  opacity:0}"
    + "html.mg-mode-depth #mg-lf{opacity:1}"
    + ".mg-lf-plane{position:absolute;left:50%;top:50%;will-change:transform;transform-style:preserve-3d}"
    /* Interior-mapping room (cubic infinite window behind the page plane) */
    + "#mg-im-room{position:absolute;left:50%;top:50%;width:140%;height:140%;"
    + "  margin:-70% 0 0 -70%;transform-style:preserve-3d;"
    + "  transform:translate3d(var(--mg-im-x,0px),var(--mg-im-y,0px),var(--mg-im-z,-420px))"
    + "    rotateX(var(--mg-im-rx,8deg)) rotateY(var(--mg-im-ry,0deg));"
    + "  will-change:transform}"
    + ".mg-im-face{position:absolute;inset:0;border:1px solid rgba(255,255,255,0.06);"
    + "  background-size:48px 48px,100% 100%;"
    + "  background-image:"
    + "    linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),"
    + "    linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px),"
    + "    radial-gradient(ellipse at center,rgba(120,180,255,0.08),transparent 70%)}"
    + "#mg-im-back{transform:translateZ(-280px) scale(1.35);opacity:0.55}"
    + "#mg-im-floor{height:55%;top:auto;bottom:0;"
    + "  transform:rotateX(78deg) translateZ(-40px) scale(1.4);transform-origin:50% 100%;opacity:0.45;"
    + "  background-image:linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),"
    + "    linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px),"
    + "    linear-gradient(180deg,transparent,rgba(140,200,255,0.1))}"
    + "#mg-im-ceil{height:40%;bottom:auto;top:0;"
    + "  transform:rotateX(-72deg) translateZ(-20px) scale(1.3);transform-origin:50% 0%;opacity:0.25}"
    + "#mg-im-left{width:50%;right:auto;"
    + "  transform:rotateY(82deg) translateZ(-60px) scale(1.2);transform-origin:0% 50%;opacity:0.3}"
    + "#mg-im-right{width:50%;left:auto;right:0;"
    + "  transform:rotateY(-82deg) translateZ(-60px) scale(1.2);transform-origin:100% 50%;opacity:0.3}"
    /* Ray layers — near / mid / far (parallax ∝ 1/depth like light-field samples) */
    + "#mg-lf-near{width:120%;height:120%;margin:-60% 0 0 -60%;"
    + "  background:radial-gradient(ellipse 40% 30% at 50% 40%,rgba(255,255,255,0.07),transparent 60%);"
    + "  opacity:0.5}"
    + "#mg-lf-mid{width:160%;height:160%;margin:-80% 0 0 -80%;"
    + "  background:"
    + "    radial-gradient(ellipse 50% 40% at 30% 60%,rgba(255,180,140,0.05),transparent 50%),"
    + "    radial-gradient(ellipse 45% 35% at 70% 35%,rgba(140,180,255,0.06),transparent 50%);"
    + "  opacity:0.45}"
    + "#mg-lf-far{width:200%;height:200%;margin:-100% 0 0 -100%;"
    + "  background:radial-gradient(ellipse 70% 50% at 50% 50%,rgba(160,140,255,0.04),transparent 65%);"
    + "  opacity:0.35}"
    /* Fovea: sharp core follows mouse/viewRay; soft periphery (no-glasses cue) */
    + "#mg-fovea{"
    + "  position:fixed;inset:0;z-index:7;pointer-events:none;"
    + "  background:"
    + "    radial-gradient(circle var(--mg-fovea-core,12%) at var(--mg-fovea-x,50%) var(--mg-fovea-y,46%),"
    + "      rgba(255,255,255,0.07) 0%,transparent 70%),"
    + "    radial-gradient(circle var(--mg-fovea-r,28%) at var(--mg-fovea-x,50%) var(--mg-fovea-y,46%),"
    + "      transparent 0%,transparent 52%,"
    + "      rgba(0,0,0,0.04) 78%,"
    + "      rgba(0,0,0,0.1) 100%);"
    + "  mix-blend-mode:soft-light;opacity:var(--mg-fovea-a,0.65)}"
    /* Stereo ghost (IPD) — subtle dual-edge offset for pupillary baseline */
    + "#mg-stereo-ghost{"
    + "  position:fixed;inset:0;z-index:2;pointer-events:none;"
    + "  box-shadow:"
    + "    inset calc(var(--mg-ipd,0px) * -0.5) 0 20px rgba(255,80,80,var(--mg-stereo-a,0)),"
    + "    inset calc(var(--mg-ipd,0px) * 0.5) 0 20px rgba(80,140,255,var(--mg-stereo-a,0));"
    + "  -webkit-mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    transparent 0%,transparent 58%,#000 88%,#000 100%);"
    + "  mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    transparent 0%,transparent 58%,#000 88%,#000 100%);"
    + "  mix-blend-mode:screen}"
    /* Glass rim overlays — Glow + organic-sphere breathe (CSS only, no Three) */
    + "#mg-lens,#mg-irradiance,#mg-chroma,#mg-hud-ring,#mg-vignette,#mg-spec{"
    + "  visibility:visible;pointer-events:none}"
    + "@keyframes mg-orb-breathe{"
    + "  0%,100%{transform:translate3d(var(--mg-lx,0px),var(--mg-ly,0px),0) scale(1)}"
    + "  50%{transform:translate3d(var(--mg-lx,0px),var(--mg-ly,0px),0) scale(1.012)}"
    + "}"
    + "#mg-lens{"
    + "  position:fixed;inset:4% 5%;z-index:3;pointer-events:none;"
    + "  border-radius:48% 48% 52% 52% / 42% 42% 58% 58%;"
    + "  opacity:0.45;"
    + "  transform:translate3d(var(--mg-lx,0px),var(--mg-ly,0px),0);"
    + "  will-change:transform,opacity;"
    + "  box-shadow:"
    + "    inset 0 0 0 1px rgba(255,255,255,0.42),"
    + "    inset 0 20px 60px rgba(255,255,255,0.16),"
    + "    inset 0 -24px 50px rgba(160,200,255,0.1),"
    + "    0 0 50px 8px rgba(255,255,255,0.1),"
    + "    0 0 90px 20px rgba(140,190,255,0.08);"
    + "  background:"
    + "    radial-gradient(ellipse 65% 48% at 32% 26%,rgba(255,255,255,0.24),transparent 52%),"
    + "    radial-gradient(ellipse 50% 40% at 72% 68%,rgba(120,180,255,0.1),transparent 55%),"
    + "    radial-gradient(ellipse 90% 85% at 50% 50%,transparent 50%,rgba(255,255,255,0.05) 100%);"
    /* Rim-only mask — long soft band, no hard ring */
    + "  -webkit-mask-image:radial-gradient(ellipse 96% 94% at 50% 48%,"
    + "    transparent 0%,transparent 52%,rgba(0,0,0,0.15) 66%,rgba(0,0,0,0.55) 78%,#000 92%,transparent 100%);"
    + "  mask-image:radial-gradient(ellipse 96% 94% at 50% 48%,"
    + "    transparent 0%,transparent 52%,rgba(0,0,0,0.15) 66%,rgba(0,0,0,0.55) 78%,#000 92%,transparent 100%);"
    + "  backdrop-filter:blur(6px) saturate(1.35) brightness(1.04);"
    + "  -webkit-backdrop-filter:blur(6px) saturate(1.35) brightness(1.04)}"
    /* Edge tone shift + irradiance: warm L, cool R, white top caustic */
    + "#mg-irradiance{"
    + "  position:fixed;inset:4.5% 5.5%;z-index:4;pointer-events:none;"
    + "  border-radius:48% 48% 52% 52% / 42% 42% 58% 58%;"
    + "  transform:translate3d(var(--mg-lx,0px),var(--mg-ly,0px),0);"
    + "  will-change:transform;"
    + "  background:"
    + "    conic-gradient(from var(--mg-ang,200deg) at 50% 48%,"
    + "      rgba(255,200,160,0.0) 0deg,"
    + "      rgba(255,170,120,0.22) 50deg,"
    + "      rgba(255,255,255,0.35) 110deg,"
    + "      rgba(140,190,255,0.28) 180deg,"
    + "      rgba(180,140,255,0.14) 240deg,"
    + "      rgba(255,200,160,0.12) 300deg,"
    + "      rgba(255,200,160,0.0) 360deg);"
    + "  -webkit-mask-image:radial-gradient(ellipse 91% 89% at 50% 48%,"
    + "    transparent 0%,transparent 58%,rgba(0,0,0,0.4) 70%,#000 88%,transparent 100%);"
    + "  mask-image:radial-gradient(ellipse 91% 89% at 50% 48%,"
    + "    transparent 0%,transparent 58%,rgba(0,0,0,0.4) 70%,#000 88%,transparent 100%);"
    + "  mix-blend-mode:screen;opacity:0.9;"
    + "  filter:blur(1.2px)}"
    /* Chromatic dispersion at lip only */
    + "#mg-chroma{"
    + "  position:fixed;inset:5% 6%;z-index:5;pointer-events:none;"
    + "  border-radius:48% 48% 52% 52% / 42% 42% 58% 58%;"
    + "  transform:translate3d(var(--mg-lx,0px),var(--mg-ly,0px),0);"
    + "  box-shadow:"
    + "    inset 3px 0 18px rgba(255,90,90,0.18),"
    + "    inset -3px 0 18px rgba(70,150,255,0.2),"
    + "    inset 0 3px 14px rgba(255,255,255,0.22),"
    + "    inset 0 -2px 16px rgba(160,120,255,0.1);"
    + "  -webkit-mask-image:radial-gradient(ellipse 90% 88% at 50% 48%,"
    + "    transparent 0%,transparent 64%,#000 84%,#000 100%);"
    + "  mask-image:radial-gradient(ellipse 90% 88% at 50% 48%,"
    + "    transparent 0%,transparent 64%,#000 84%,#000 100%);"
    + "  mix-blend-mode:screen;opacity:0.8}"
    /* Wet specular — true cursor follow (viewport px, not bogus viewRay offset) */
    + "#mg-spec{"
    + "  position:fixed;width:72px;height:48px;z-index:6;pointer-events:none;"
    + "  left:0;top:0;margin:0;"
    + "  border-radius:50%;"
    + "  background:radial-gradient(ellipse at center,"
    + "    rgba(255,255,255,0.7),rgba(255,255,255,0.18) 42%,transparent 70%);"
    + "  filter:blur(4px);opacity:0.75;"
    + "  transform:translate3d(var(--mg-mx,0px),var(--mg-my,0px),0);"
    + "  will-change:transform}"
    /* No black vignette — soft white falloff only at far corners */
    + "#mg-vignette{"
    + "  position:fixed;inset:0;z-index:1;pointer-events:none;"
    + "  background:radial-gradient(ellipse 75% 70% at 50% 46%,"
    + "    transparent 45%,rgba(255,255,255,0.04) 78%,rgba(255,255,255,0.08) 100%);"
    + "  opacity:0.85}"
    + "#mg-hud-ring{"
    + "  position:fixed;inset:9% 10%;z-index:6;pointer-events:none;"
    + "  border-radius:46% 46% 50% 50% / 40% 40% 56% 56%;"
    + "  border:1px solid rgba(255,255,255,0.1);"
    + "  box-shadow:0 0 30px rgba(255,255,255,0.06);"
    + "  transform:translate3d(var(--mg-hx,0px),var(--mg-hy,0px),0);"
    + "  will-change:transform;opacity:0.55}"
    /*
     * Memory Glass shell layout (tao + wry → WKWebView / ObjC):
     *   TOP band (high):  . . .  |  CTRL  |  . track ▾   — same header line
     *   BOTTOM: tabs strip, then ..... search peek
     */
    + "html{--mg-shell-top:2px;--mg-dots-top:2px;--mg-page-pad-top:40px;"
    /* Leave room for tabs + search dock so content/scroll ends above chrome */
    + "  --mg-page-pad-bot:96px;--mg-search-bottom:12px;--mg-tabs-bottom:58px;"
    + "  --mg-hdr-fs:11px;--mg-hdr-ls:0.22em;--mg-hdr-pad-y:6px;"
    + "  --mg-cf-yaw:0;--mg-cf-pitch:0;--mg-cf-z:0;"
    + "  --mg-focal-scale:1;--mg-sharp:1;--mg-contrast:1}"
    + "body{"
    + "  padding-top:var(--mg-page-pad-top,40px)!important;"
    + "  padding-bottom:var(--mg-page-pad-bot,96px)!important;"
    + "  box-sizing:border-box!important;"
    + "  scroll-padding-top:var(--mg-page-pad-top,40px)!important;"
    + "  scroll-padding-bottom:var(--mg-page-pad-bot,96px)!important;"
    + "  transform-origin:var(--mg-fovea-x,50%) var(--mg-fovea-y,46%);"
    + "  will-change:transform,filter}"
    /* Mild focal zoom + sharpness (no-glasses reading assist) */
    + "html.mg-focal-zoom:not(.mg-cinema-on):not(.mg-dim-on):not(.mg-axis-on) body{"
    + "  transform:scale(var(--mg-focal-scale,1));"
    + "  filter:contrast(var(--mg-contrast,1)) saturate(var(--mg-sharp,1))}"
    + "html.mg-cinema-on body,html.mg-dim-on body,html.mg-axis-on body{"
    + "  filter:none}"
    /* Shared top header band — TRACK / CTRL / dots all sit on this line */
    + "#mg-dragon{position:fixed!important;top:var(--mg-shell-top,2px)!important;"
    + "left:50%!important;right:auto!important;bottom:auto!important;"
    + "transform:translateX(-50%)!important;"
    + "width:min(420px,92vw);pointer-events:auto!important;z-index:2147483640!important;"
    + "display:flex!important;flex-direction:column;align-items:center;gap:0;"
    + "visibility:visible!important;opacity:1!important;margin:0!important;"
    + "touch-action:manipulation;-webkit-user-select:none;user-select:none;"
    + "isolation:isolate;overflow:visible!important}"
    + "#mg-dragon.is-open{z-index:2147483646!important}"
    + "html.mg-yt-theater #mg-dragon,html.mg-yt-fs #mg-dragon,"
    + "html.mg-yt-video #mg-dragon{z-index:2147483645!important}"
    + "html.mg-yt-theater #mg-dragon.is-open,html.mg-yt-fs #mg-dragon.is-open,"
    + "html.mg-yt-video #mg-dragon.is-open{z-index:2147483647!important}"
    + "#mg-tab-row{display:flex;align-items:center;justify-content:center;gap:12px;"
    + "  align-self:center;width:auto;max-width:100%;padding:0;"
    + "  min-height:28px;"
    + "  background:transparent;border:none;box-shadow:none;border-radius:0;"
    + "  position:relative;z-index:4}"
    /* Coverflow + PIP live in the inspect float — hide on main browser page */
    + "#mg-coverflow,#mg-page-stack,#mg-cf-stage,#mg-cf-credit,.mg-cf-card{display:none!important}"
    + "#mg-cam-pip{display:none!important}"
    /* Tabs sit above search dock (both fixed to viewport, above page scroll) */
    + "#mg-tabs{"
    + "  position:fixed!important;left:50%!important;transform:translateX(-50%)!important;"
    + "  bottom:calc(var(--mg-tabs-bottom,58px) + env(safe-area-inset-bottom,0px))!important;"
    + "  top:auto!important;z-index:2147483602!important;"
    + "  display:flex!important;align-items:center;justify-content:center;gap:2px;"
    + "  max-width:min(720px,94vw);min-height:18px;"
    + "  overflow-x:auto;padding:2px 4px;margin:0!important;scrollbar-width:none;"
    + "  background:transparent;border:none;border-radius:0;"
    + "  pointer-events:auto!important;opacity:0.85}"
    + "#mg-tabs:hover{opacity:1}"
    + ".mg-grip{"
    + "  appearance:none;cursor:grab;user-select:none;"
    + "  display:flex;align-items:center;justify-content:center;"
    + "  min-width:44px;min-height:28px;padding:var(--mg-hdr-pad-y,6px) 8px;"
    + "  background:transparent!important;border:none!important;box-shadow:none!important;"
    + "  outline:none;border-radius:0;"
    + "  color:rgba(255,255,255,0.78);"
    + "  font:700 var(--mg-hdr-fs,11px)/1 ui-monospace,Menlo,monospace;"
    + "  letter-spacing:var(--mg-hdr-ls,0.22em);"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.35);"
    + "  transition:opacity .15s,text-shadow .15s,color .15s;opacity:0.88}"
    + ".mg-grip:hover{opacity:1;color:#fff;"
    + "  text-shadow:0 0 12px rgba(255,255,255,0.55),0 1px 2px rgba(0,0,0,0.25);"
    + "  background:transparent!important}"
    + ".mg-grip:active{cursor:grabbing;background:transparent!important}"
    + "#mg-grip-l,#mg-grip-r{border-radius:0}"
    /* Drag pad only behind the CTRL word row — never covers the open panel */
    + "#mg-drag-pad{position:absolute;left:20%;right:20%;top:0;height:28px;"
    + "  pointer-events:auto;cursor:grab;z-index:1;background:transparent}"
    /* CTRL — same header word style as TRACK */
    + "#mg-tab{position:relative;flex:0 0 auto;z-index:5;"
    + "appearance:none;cursor:pointer;user-select:none;"
    + "background:transparent!important;border:none!important;box-shadow:none!important;"
    + "border-radius:0;outline:none;"
    + "color:rgba(255,255,255,0.9);"
    + "font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif;"
    + "letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;"
    + "padding:var(--mg-hdr-pad-y,6px) 6px;min-height:28px;"
    + "display:flex;align-items:center;gap:8px;"
    + "text-shadow:0 1px 2px rgba(0,0,0,0.4);"
    + "transition:opacity .15s,text-shadow .15s,color .15s;opacity:0.92}"
    + "#mg-tab:hover{opacity:1;color:#fff;background:transparent!important;"
    + "  text-shadow:0 0 14px rgba(255,255,255,0.45),0 1px 2px rgba(0,0,0,0.25)}"
    + "#mg-tab:active{transform:none;background:transparent!important}"
    + "#mg-tab .hinge{display:none}"
    + "#mg-tab .tab-lbl{display:flex;align-items:center;gap:8px}"
    + "#mg-tab .chev{font-size:9px;color:rgba(255,255,255,0.65);letter-spacing:0;"
    + "  transition:transform .35s cubic-bezier(.2,.9,.2,1)}"
    + "#mg-dragon.is-open #mg-tab .chev{transform:rotate(180deg)}"
    + "#mg-tab .live{width:5px;height:5px;border-radius:50%;background:#4ade80;"
    + "box-shadow:0 0 8px rgba(74,222,128,0.7);animation:mg-pulse 1.8s ease-in-out infinite;"
    + "  flex-shrink:0}"
    + "@keyframes mg-pulse{0%,100%{opacity:1}50%{opacity:.4}}"
    + "#mg-tabs::-webkit-scrollbar{display:none}"
    + ".mg-btab{appearance:none;border:0;cursor:pointer;user-select:none;"
    + "  display:inline-flex;align-items:center;gap:4px;"
    + "  padding:4px 8px;border-radius:0;"
    + "  background:transparent;color:rgba(255,255,255,0.55);"
    + "  font:600 10px/1 system-ui;letter-spacing:0.02em;"
    + "  white-space:nowrap;max-width:120px;"
    + "  transition:color .15s,opacity .15s}"
    + ".mg-btab .ttl{overflow:hidden;text-overflow:ellipsis;max-width:90px}"
    + ".mg-btab:hover{color:rgba(255,255,255,0.95);background:transparent}"
    + ".mg-btab.on{color:#fff;text-shadow:0 0 10px rgba(255,255,255,0.35)}"
    + ".mg-btab .x{opacity:0.4;font-size:12px;line-height:1;padding:0 2px}"
    + ".mg-btab .x:hover{opacity:1;color:#fff}"
    + "#mg-tab-add{appearance:none;border:0;background:transparent;cursor:pointer;"
    + "  color:rgba(255,255,255,0.55);font:700 14px/1 system-ui;padding:2px 8px}"
    + "#mg-tab-add:hover{color:#fff}"
    /*
     * CTRL dropdown — SpaceX-style light glass menu (matches TRACK drop).
     * Open state uses visibility + pointer-events so it never “collapses” under max-height races.
     */
    + "#mg-panel{"
    + "  position:relative;z-index:3;"
    + "  overflow:hidden;max-height:0;opacity:0;visibility:hidden;pointer-events:none;"
    + "  width:min(400px,92vw);align-self:center;margin-top:6px;"
    + "  transform:translateY(-4px);transform-origin:top center;"
    + "  transition:max-height .3s cubic-bezier(.2,.85,.2,1),opacity .18s ease,transform .22s ease,visibility 0s linear .3s;"
    + "  background:rgba(8,10,14,0.55);"
    + "  backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);"
    + "  border:1px solid rgba(255,255,255,0.14);border-radius:4px;"
    + "  box-shadow:0 18px 50px rgba(0,0,0,0.35)}"
    + "#mg-dragon.is-open #mg-panel{"
    + "  max-height:min(70vh,620px);opacity:1;visibility:visible;pointer-events:auto;"
    + "  transform:translateY(0);"
    + "  transition:max-height .32s cubic-bezier(.2,.85,.2,1),opacity .18s ease,transform .22s ease,visibility 0s}"
    + "#mg-panel-inner{"
    + "  display:flex;flex-direction:column;gap:0;"
    + "  padding:6px 0 10px;"
    + "  max-height:min(66vh,580px);overflow-x:hidden;overflow-y:auto;"
    + "  overscroll-behavior:contain;scrollbar-width:thin;"
    + "  -webkit-overflow-scrolling:touch}"
    + "#mg-panel .hdr{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;"
    + "  font:600 var(--mg-hdr-fs,11px)/1 system-ui;letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;"
    + "  color:rgba(255,255,255,0.45);padding:10px 16px 8px;"
    + "  border-bottom:1px solid rgba(255,255,255,0.08)}"
    + "#mg-panel .hdr em{font-style:normal;color:rgba(255,255,255,0.88)}"
    + "#mg-panel .hdr .sys{color:rgba(120,220,160,0.9);letter-spacing:0.14em}"
    /* Expand / Collapse — text links, not chips */
    + "#mg-sec-master{display:flex;justify-content:flex-end;gap:14px;margin:0;flex-shrink:0;"
    + "  padding:6px 16px 4px;border-bottom:1px solid rgba(255,255,255,0.06)}"
    + "#mg-sec-master button{appearance:none;cursor:pointer;user-select:none;"
    + "  min-height:0;padding:6px 0;border-radius:0;border:none;"
    + "  background:transparent!important;"
    + "  color:rgba(255,255,255,0.45);font:600 10px/1 system-ui;"
    + "  letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;"
    + "  transition:color .12s}"
    + "#mg-sec-master button:hover{color:#fff;background:transparent!important}"
    + "#mg-sec-master button:active{transform:none}"
    /* Section rows — stacked, no overlap; body only when .is-open */
    + "#mg-panel .mg-sec{"
    + "  position:relative;display:block;flex-shrink:0;"
    + "  border:none;border-radius:0;background:transparent;overflow:visible;"
    + "  border-bottom:1px solid rgba(255,255,255,0.06);"
    + "  margin:0;padding:0}"
    + "#mg-panel .mg-sec:last-of-type{border-bottom:none}"
    + "#mg-panel .mg-sec-toggle{appearance:none;width:100%;cursor:pointer;user-select:none;"
    + "  display:flex;align-items:center;justify-content:space-between;gap:10px;"
    + "  position:relative;z-index:1;"
    + "  min-height:36px;padding:10px 16px;margin:0;box-sizing:border-box;"
    + "  background:transparent!important;border:none;"
    + "  color:rgba(255,255,255,0.55);text-align:left;"
    + "  font:600 var(--mg-hdr-fs,11px)/1.2 system-ui;"
    + "  letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;"
    + "  transition:color .12s,background .12s}"
    + "#mg-panel .mg-sec-toggle:hover{color:#fff;background:rgba(255,255,255,0.06)!important}"
    + "#mg-panel .mg-sec.is-open .mg-sec-toggle{color:#fff;"
    + "  background:rgba(255,255,255,0.05)!important}"
    + "#mg-panel .mg-sec-toggle .sec-meta{display:flex;align-items:center;gap:10px;min-width:0}"
    + "#mg-panel .mg-sec-toggle .sec-title{font:inherit;letter-spacing:inherit}"
    + "#mg-panel .mg-sec-toggle .sec-count{font:500 9px/1 system-ui;"
    + "  letter-spacing:0.08em;color:rgba(255,255,255,0.32);text-transform:uppercase;"
    + "  padding:0;border:none;border-radius:0;background:transparent}"
    + "#mg-panel .mg-sec-toggle .chev{flex-shrink:0;font-size:9px;opacity:0.55;letter-spacing:0;"
    + "  transition:transform .25s cubic-bezier(.2,.9,.2,1)}"
    + "#mg-panel .mg-sec.is-open .mg-sec-toggle .chev{transform:rotate(180deg);opacity:0.85}"
    + "#mg-panel .mg-sec-body{"
    + "  display:none!important;flex-direction:column;gap:8px;"
    + "  position:relative;z-index:0;"
    + "  padding:2px 14px 12px;margin:0;"
    + "  background:rgba(0,0,0,0.14);"
    + "  border-top:1px solid rgba(255,255,255,0.05);"
    + "  box-sizing:border-box;min-height:0}"
    + "#mg-panel .mg-sec.is-open > .mg-sec-body{display:flex!important}"
    + "#mg-keys{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}"
    + "#mg-keys button{appearance:none;height:32px;border-radius:2px;cursor:pointer;"
    + "border:1px solid rgba(255,255,255,0.1);"
    + "background:rgba(255,255,255,0.05);"
    + "color:rgba(255,255,255,0.85);font:650 10px/1 system-ui;letter-spacing:0.1em;"
    + "text-transform:uppercase;transition:background .12s,color .12s}"
    + "#mg-keys button:hover{background:rgba(255,255,255,0.12);color:#fff}"
    + "#mg-keys button.accent{color:#fff;background:rgba(255,255,255,0.1);"
    + "  border-color:rgba(255,255,255,0.16)}"
    /* Slider clumps inside sections */
    + "#mg-panel .mg-sliders{display:grid;gap:8px}"
    + "#mg-panel .mg-sliders label{display:grid;grid-template-columns:72px 1fr 36px;gap:6px;align-items:center;"
    + "  font:600 10px/1 system-ui;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.5)}"
    + "#mg-panel .mg-sliders input[type=range]{width:100%;accent-color:#fff;height:22px}"
    + "#mg-panel .mg-sliders .v{font:600 10px ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.65);text-align:right}"
    /* Rx fields live inside .mg-sec */
    + "#mg-rx .rx-row{display:grid;grid-template-columns:28px 1fr 1fr 1fr;gap:6px;align-items:center}"
    + "#mg-rx .rx-row.pd{grid-template-columns:28px 1fr 1fr}"
    + "#mg-rx .rx-h{font:600 8px/1 system-ui;letter-spacing:0.08em;text-transform:uppercase;"
    + "  color:rgba(255,255,255,0.4);text-align:center}"
    + "#mg-rx .rx-h.lbl{text-align:left}"
    + "#mg-rx .rx-eye{font:700 9px/1 system-ui;color:rgba(255,255,255,0.55)}"
    + "#mg-rx input[type=number]{width:100%;min-width:0;height:30px;border-radius:8px;"
    + "  border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.18);"
    + "  color:rgba(255,255,255,0.92);font:600 11px/1 ui-monospace,Menlo,monospace;"
    + "  text-align:center;padding:0 4px;outline:none}"
    + "#mg-rx input[type=number]:focus{border-color:rgba(255,255,255,0.4);"
    + "  box-shadow:0 0 0 2px rgba(255,255,255,0.08)}"
    + "#mg-rx .rx-note{font:500 8px/1.35 system-ui;color:rgba(255,255,255,0.38)}"
    + "#mg-rx .rx-actions{display:flex;gap:6px;flex-wrap:wrap}"
    + "#mg-rx .rx-actions button,#mg-rx .rx-actions label.file{"
    + "  appearance:none;flex:1;min-width:72px;height:32px;border-radius:8px;cursor:pointer;"
    + "  border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);"
    + "  color:rgba(255,255,255,0.9);font:650 9px/1 system-ui;letter-spacing:0.06em;text-transform:uppercase;"
    + "  display:flex;align-items:center;justify-content:center}"
    + "#mg-rx .rx-actions button.primary{background:rgba(255,255,255,0.2)}"
    + "#mg-rx .rx-actions button:hover,#mg-rx .rx-actions label.file:hover{background:rgba(255,255,255,0.22)}"
    + "#mg-rx .rx-actions input[type=file]{display:none}"
    + "#mg-rx .rx-vendor{display:grid;grid-template-columns:72px 1fr;gap:6px;align-items:center}"
    + "#mg-rx .rx-vendor select{height:30px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);"
    + "  background:rgba(0,0,0,0.22);color:rgba(255,255,255,0.9);font:600 10px/1 system-ui;padding:0 8px}"
    + "#mg-rx .rx-vendor-hint{font:500 8px/1.35 system-ui;color:rgba(255,255,255,0.36);grid-column:1/-1}"
    + "#mg-foot{font:500 9px/1.3 system-ui;color:rgba(255,255,255,0.32);text-align:center;"
    + "  letter-spacing:0.12em;text-transform:uppercase;padding:8px 16px 4px}"
    + "#mg-calib{padding:4px 16px 0}"
    + "#mg-scrim{position:fixed;inset:0;pointer-events:none;opacity:0;z-index:2147482900;"
    + "background:rgba(0,0,0,0.18);transition:opacity .28s}"
    + "#mg-dragon.is-open ~ #mg-scrim{opacity:1;pointer-events:auto}"
    /* Main-page PIP hidden — camera preview lives in inspect float */
    + "#mg-cam-pip{display:none!important}"
    /*
     * Expansion hands — Ender's Game / Ash Thorp (DosXMachina · GITS) style HUD.
     * Wire skeleton + expanding palm rings + pinch nodes. Above page, under CTRL.
     */
    + "#mg-occ{position:fixed;inset:0;z-index:2147483644!important;pointer-events:none;"
    + "  width:100vw;height:100vh;opacity:0;transition:opacity .2s;"
    + "  mix-blend-mode:screen}"
    + "html.mg-occ-on #mg-occ,html.mg-hands-on #mg-occ{opacity:1}"
    + "html.mg-cinema-on #mg-occ,html.mg-dim-on #mg-occ{opacity:0!important}"
    + "#mg-hand-cursor{position:fixed;width:28px;height:28px;margin:-14px 0 0 -14px;"
    + "  left:var(--mg-hand-px,50%);top:var(--mg-hand-py,50%);"
    + "  z-index:2147483645;pointer-events:none;border-radius:50%;"
    + "  border:1px solid rgba(140,220,255,0.7);"
    + "  box-shadow:0 0 16px rgba(100,190,255,0.45),inset 0 0 8px rgba(255,255,255,0.25);"
    + "  opacity:0;transition:opacity .15s;transform:scale(var(--mg-hand-pinch,1))}"
    + "html.mg-hands-on #mg-hand-cursor{opacity:0.9}"
    + "#mg-lidar{position:fixed;inset:0;z-index:2147483300;pointer-events:none;"
    + "  width:100vw;height:100vh;opacity:0;transition:opacity .25s;mix-blend-mode:screen}"
    + "html.mg-lidar-on #mg-lidar{opacity:0.35}"
    + "html.mg-cinema-on #mg-lidar,html.mg-dim-on #mg-lidar{opacity:0!important}"
    /* Version stamp — top-left near grab dots; plain credit-style text (no circle/chip) */
    + "#mg-build-stamp{"
    + "  position:fixed!important;left:48px!important;"
    + "  top:var(--mg-shell-top,2px)!important;"
    + "  bottom:auto!important;right:auto!important;"
    + "  z-index:2147483642!important;pointer-events:none;"
    + "  max-width:min(46vw,420px);"
    + "  padding:var(--mg-hdr-pad-y,6px) 0;margin:0;border:none;border-radius:0;"
    + "  background:transparent!important;box-shadow:none!important;"
    + "  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;"
    + "  color:rgba(255,255,255,0.28);"
    + "  font:500 8px/1.3 system-ui,sans-serif;letter-spacing:0.1em;text-transform:uppercase;"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.4);"
    + "  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
    + "  min-height:28px;display:flex;align-items:center}"
    + "html.mg-cinema-on #mg-build-stamp,html.mg-dim-on #mg-build-stamp{opacity:0.12}"
    + "html.mg-track-lock body{will-change:transform}"
    + "#mg-eyes{display:flex;flex-wrap:wrap;gap:2px}"
    + "#mg-eyes button,#mg-modes button{"
    + "  appearance:none;cursor:pointer;border:none;border-radius:0;"
    + "  background:transparent;padding:7px 8px;"
    + "  font:600 10px/1 system-ui;letter-spacing:0.14em;text-transform:uppercase;"
    + "  color:rgba(255,255,255,0.48);transition:color .12s,background .12s}"
    + "#mg-eyes button:hover,#mg-modes button:hover{color:#fff;background:rgba(255,255,255,0.05)}"
    + "#mg-eyes button.on,#mg-modes button.on{color:#fff;"
    + "  background:rgba(255,255,255,0.06);text-shadow:0 0 10px rgba(255,255,255,0.25)}"
    + "#mg-calib{font:500 9px/1.35 system-ui;color:rgba(255,255,255,0.36);"
    + "  letter-spacing:0.04em}"
    + "#mg-modes{display:flex;flex-wrap:wrap;gap:2px;margin-top:0}"
    /* Anaglyph dual stacks — red L / cyan R (screen blend) */
    + "#mg-ana-stack{position:fixed;inset:0;z-index:1;pointer-events:none;display:none;"
    + "  -webkit-mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    #fff 0%,#fff 48%,rgba(255,255,255,0.4) 78%,transparent 100%);"
    + "  mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    #fff 0%,#fff 48%,rgba(255,255,255,0.4) 78%,transparent 100%)}"
    + "html.mg-ana-on #mg-ana-stack{display:block}"
    + ".mg-ana-eye{position:absolute;inset:0;mix-blend-mode:screen}"
    + "#mg-ana-L{transform:translate3d(calc(var(--mg-ana-off,6px) * -1),0,0);"
    + "  filter:url(#mg-filt-red);opacity:var(--mg-ana-a,0.55)}"
    + "#mg-ana-R{transform:translate3d(var(--mg-ana-off,6px),0,0);"
    + "  filter:url(#mg-filt-cyan);opacity:var(--mg-ana-a,0.55)}"
    + ".mg-ana-mirror #mg-ana-R{transform:translate3d(var(--mg-ana-off,6px),0,0) scaleX(-1);"
    + "  transform-origin:50% 50%}"
    /* Page body anaglyph via SVG filter when enabled */
    + "html.mg-ana-on body{"
    + "  filter:url(#mg-filt-anaglyph);"
    + "}"
    /* Focus ring at mouse (convergence target) */
    + "#mg-focus-reticle{"
    + "  position:fixed;z-index:8;pointer-events:none;width:48px;height:48px;"
    + "  left:0;top:0;margin:0;"
    + "  border:1px solid rgba(255,255,255,0.35);border-radius:50%;"
    + "  box-shadow:0 0 0 1px rgba(255,60,60,0.25),0 0 0 2px rgba(40,160,255,0.2),0 0 20px rgba(255,255,255,0.15);"
    + "  transform:translate3d(var(--mg-fx,0px),var(--mg-fy,0px),0);"
    + "  will-change:transform;"
    + "  opacity:0}"
    + "html.mg-ana-on #mg-focus-reticle,html.mg-focus-on #mg-focus-reticle{opacity:0.85}"
    /*
     * Custom stoplights — dim .  .  . (not bright R/Y/G).
     * System traffic lights are hidden; these are close / min / zoom.
     */
    /* Dots on the same high header band as CTRL / TRACK */
    + "#mg-stoplights{"
    + "  position:fixed!important;top:var(--mg-shell-top,2px)!important;"
    + "  left:10px!important;right:auto!important;bottom:auto!important;"
    + "  z-index:2147483642!important;pointer-events:auto!important;"
    + "  display:flex!important;align-items:center;gap:8px;"
    + "  min-height:28px;"
    + "  background:transparent!important;border:none!important;box-shadow:none!important;"
    + "  padding:var(--mg-hdr-pad-y,6px) 0;margin:0!important;transform:none!important;"
    + "  visibility:visible!important;opacity:1!important;isolation:isolate;"
    + "  line-height:1}"
    + "#mg-stoplights .mg-dot{"
    + "  appearance:none;cursor:pointer;user-select:none;"
    + "  width:auto;min-width:12px;min-height:18px;padding:0 1px;margin:0;"
    + "  background:transparent!important;border:none!important;box-shadow:none!important;"
    + "  outline:none;border-radius:0;"
    + "  color:rgba(255,255,255,0.38);"
    + "  font:700 15px/1 ui-monospace,Menlo,monospace;"
    + "  letter-spacing:0;text-shadow:0 1px 2px rgba(0,0,0,0.35);"
    + "  transition:color .15s,opacity .15s,text-shadow .15s;opacity:0.9}"
    + "#mg-stoplights .mg-dot:hover{color:rgba(255,255,255,0.82);"
    + "  text-shadow:0 0 10px rgba(255,255,255,0.35)}"
    + "#mg-stoplights .mg-dot[data-win=close]:hover{color:rgba(255,200,200,0.75)}"
    + "#mg-stoplights .mg-dot[data-win=min]:hover{color:rgba(255,230,190,0.7)}"
    + "#mg-stoplights .mg-dot[data-win=max]:hover{color:rgba(200,230,210,0.7)}"
    /*
     * Cinema dim — theater for test footage (odysseymovie.com etc.).
     * Soft black field + edge falloff; content stays clear in the center.
     * Shell UI fades out; hover / D / Cinema button brings controls back.
     */
    + "#mg-dim{"
    + "  position:fixed;inset:0;z-index:2147482800;pointer-events:none;"
    + "  background:transparent;"
    + "  opacity:0;transition:opacity .55s ease,background .55s ease}"
    + "html.mg-cinema-on #mg-dim,"
    + "html.mg-dim-on #mg-dim{"
    + "  opacity:1;"
    /* Hole in the center so the film stays bright; only the frame dims */
    + "  background:"
    + "    radial-gradient(ellipse 84% 76% at 50% 48%,"
    + "      transparent 0%,transparent 42%,"
    + "      rgba(0,0,0,0.45) 62%,"
    + "      rgba(0,0,0,0.88) 82%,"
    + "      rgba(0,0,0,0.96) 100%)}"
    /* Black under the page (letterbox / transparent shell) — does NOT cover video paint */
    + "html.mg-cinema-on body,"
    + "html.mg-dim-on body{"
    + "  background:#000!important;background-color:#000!important;"
    + "  -webkit-mask-image:none!important;mask-image:none!important;"
    + "  padding-top:0!important}"
    + "html.mg-cinema-on,"
    + "html.mg-dim-on{"
    + "  background:#000!important;background-color:#000!important}"
    /* Hide portal optics so only the film surface remains */
    + "html.mg-cinema-on #mg-lf,"
    + "html.mg-cinema-on #mg-ana-stack,"
    + "html.mg-cinema-on #mg-stereo-ghost,"
    + "html.mg-cinema-on #mg-vignette,"
    + "html.mg-cinema-on #mg-lens,"
    + "html.mg-cinema-on #mg-irradiance,"
    + "html.mg-cinema-on #mg-chroma,"
    + "html.mg-cinema-on #mg-spec,"
    + "html.mg-cinema-on #mg-fovea,"
    + "html.mg-cinema-on #mg-focus-reticle,"
    + "html.mg-cinema-on #mg-hud-ring,"
    + "html.mg-dim-on #mg-lf,"
    + "html.mg-dim-on #mg-ana-stack,"
    + "html.mg-dim-on #mg-stereo-ghost,"
    + "html.mg-dim-on #mg-vignette,"
    + "html.mg-dim-on #mg-lens,"
    + "html.mg-dim-on #mg-irradiance,"
    + "html.mg-dim-on #mg-chroma,"
    + "html.mg-dim-on #mg-spec,"
    + "html.mg-dim-on #mg-fovea,"
    + "html.mg-dim-on #mg-focus-reticle,"
    + "html.mg-dim-on #mg-hud-ring{"
    + "  opacity:0!important;visibility:hidden!important;pointer-events:none!important}"
    /* Shell controls: nearly gone; fade in on hover so you can exit cinema */
    + "html.mg-cinema-on #mg-dragon,"
    + "html.mg-cinema-on #mg-stoplights,"
    + "html.mg-cinema-on #mg-search-dock,"
    + "html.mg-cinema-on #mg-tabs,"
    + "html.mg-dim-on #mg-dragon,"
    + "html.mg-dim-on #mg-stoplights,"
    + "html.mg-dim-on #mg-search-dock,"
    + "html.mg-dim-on #mg-tabs{"
    + "  opacity:0.08;transition:opacity .4s ease;filter:none}"
    + "html.mg-cinema-on #mg-dragon:hover,"
    + "html.mg-cinema-on #mg-stoplights:hover,"
    + "html.mg-cinema-on #mg-search-dock:hover,"
    + "html.mg-cinema-on #mg-tabs:hover,"
    + "html.mg-cinema-on #mg-dragon.is-open,"
    + "html.mg-dim-on #mg-dragon:hover,"
    + "html.mg-dim-on #mg-stoplights:hover,"
    + "html.mg-dim-on #mg-search-dock:hover,"
    + "html.mg-dim-on #mg-tabs:hover,"
    + "html.mg-dim-on #mg-dragon.is-open{"
    + "  opacity:1}"
    /*
     * Top-right cluster:  [ . inspect  n ]  [ . track ▾ ]
     * Inspect is LEFT of TRACK; no circle/chip — same word style as TRACK.
     */
    + "#mg-top-right{"
    + "  position:fixed!important;top:var(--mg-shell-top,2px)!important;"
    + "  right:12px!important;left:auto!important;bottom:auto!important;"
    + "  z-index:2147483643!important;pointer-events:auto!important;"
    + "  display:flex!important;flex-direction:row;align-items:flex-start;"
    + "  gap:18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}"
    + "#mg-mode-menu{"
    + "  position:relative!important;top:auto!important;right:auto!important;"
    + "  display:flex!important;flex-direction:column;align-items:flex-end;"
    + "  text-align:right;user-select:none}"
    + "#mg-mode-trigger{"
    + "  appearance:none;cursor:pointer;user-select:none;"
    + "  display:inline-flex;align-items:center;gap:8px;"
    + "  min-height:28px;padding:var(--mg-hdr-pad-y,6px) 2px;margin:0;"
    + "  background:transparent!important;border:none!important;box-shadow:none!important;"
    + "  color:rgba(255,255,255,0.9);"
    + "  font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif;"
    + "  letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.4);"
    + "  transition:color .15s,opacity .15s,text-shadow .15s;opacity:0.92}"
    + "#mg-mode-trigger:hover{opacity:1;color:#fff;"
    + "  text-shadow:0 0 14px rgba(255,255,255,0.45)}"
    + "#mg-mode-trigger .dot{opacity:0.55;letter-spacing:0;margin-right:4px}"
    + "#mg-mode-trigger .chev{font-size:9px;opacity:0.65;letter-spacing:0;"
    + "  transition:transform .25s cubic-bezier(.2,.9,.2,1)}"
    + "#mg-mode-menu.is-open #mg-mode-trigger .chev{transform:rotate(180deg)}"
    + "#mg-mode-drop{"
    + "  display:none!important;flex-direction:column;align-items:flex-end;gap:0;"
    + "  position:relative;z-index:2147483647;"
    + "  margin-top:4px;padding:8px 0 6px;min-width:168px;"
    + "  background:rgba(8,10,14,0.42)!important;"
    + "  backdrop-filter:blur(22px) saturate(1.25);-webkit-backdrop-filter:blur(22px) saturate(1.25);"
    + "  border:1px solid rgba(255,255,255,0.12);border-radius:2px;"
    + "  box-shadow:0 16px 48px rgba(0,0,0,0.28);"
    + "  visibility:hidden;opacity:0;pointer-events:none}"
    + "#mg-mode-menu.is-open #mg-mode-drop{"
    + "  display:flex!important;visibility:visible!important;opacity:1!important;"
    + "  pointer-events:auto!important}"
    + "#mg-mode-drop button{"
    + "  appearance:none;cursor:pointer;user-select:none;width:100%;"
    + "  display:block;text-align:right;"
    + "  padding:9px 14px;margin:0;"
    + "  background:transparent!important;border:none!important;box-shadow:none!important;"
    + "  color:rgba(255,255,255,0.5);"
    + "  font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif;"
    + "  letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;"
    + "  transition:color .12s,background .12s,opacity .12s}"
    + "#mg-mode-drop button:hover{color:#fff;background:rgba(255,255,255,0.06)!important}"
    + "#mg-mode-drop button.on{color:#fff;"
    + "  text-shadow:0 0 10px rgba(255,255,255,0.35)}"
    + "#mg-mode-drop button .dot{opacity:0.45;margin-right:8px;letter-spacing:0}"
    + "#mg-mode-drop button.on .dot{opacity:0.9}"
    + "html.mg-cinema-on #mg-top-right,"
    + "html.mg-dim-on #mg-top-right{opacity:0.12;transition:opacity .35s}"
    + "html.mg-cinema-on #mg-top-right:hover,"
    + "html.mg-dim-on #mg-top-right:hover,"
    + "html.mg-cinema-on #mg-mode-menu.is-open,"
    + "html.mg-dim-on #mg-mode-menu.is-open{opacity:1}"
    /* legacy id alias if present */
    + "#mg-cinema-btn{display:none!important}"
    /* Inspect control — LEFT of TRACK, flat word (no circle/chip) */
    + "#mg-dev{"
    + "  position:relative!important;top:auto!important;right:auto!important;"
    + "  left:auto!important;bottom:auto!important;"
    + "  z-index:auto!important;pointer-events:auto!important;"
    + "  width:auto;display:flex!important;flex-direction:column;align-items:flex-end;gap:0;"
    + "  font-family:system-ui,sans-serif}"
    + "#mg-dev-toggle{"
    + "  appearance:none;cursor:pointer;user-select:none;align-self:flex-end;"
    + "  min-height:28px;padding:var(--mg-hdr-pad-y,6px) 2px;margin:0;"
    + "  background:transparent!important;border:none!important;border-radius:0!important;"
    + "  box-shadow:none!important;outline:none;"
    + "  color:rgba(255,255,255,0.9);"
    + "  font:600 var(--mg-hdr-fs,11px)/1 system-ui,sans-serif;"
    + "  letter-spacing:var(--mg-hdr-ls,0.22em);text-transform:uppercase;"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.4);"
    + "  display:inline-flex;align-items:center;gap:8px;"
    + "  transition:color .15s,opacity .15s,text-shadow .15s;opacity:0.92}"
    + "#mg-dev-toggle:hover{opacity:1;color:#fff;background:transparent!important;"
    + "  text-shadow:0 0 14px rgba(255,255,255,0.45)}"
    + "#mg-dev-toggle .dot{opacity:0.55;letter-spacing:0;margin-right:2px}"
    + "#mg-dev-badge{"
    + "  min-width:0;height:auto;padding:0;border-radius:0;"
    + "  background:transparent;color:rgba(255,255,255,0.45);"
    + "  font:600 10px/1 ui-monospace,Menlo,monospace;letter-spacing:0.06em}"
    + "#mg-dev-badge.has-err{background:transparent;color:rgba(255,140,140,0.95)}"
    + "#mg-dev-badge.has-warn{background:transparent;color:rgba(255,200,120,0.9)}"
    + "#mg-dev-panel{display:none!important}"
    + "html.mg-cinema-on #mg-dev,html.mg-dim-on #mg-dev{opacity:1}"
    /* Search dock: fixed to viewport bottom — never scrolls with page content */
    + "#mg-search-dock{"
    + "  position:fixed!important;left:50%!important;"
    + "  bottom:calc(var(--mg-search-bottom,12px) + env(safe-area-inset-bottom,0px))!important;"
    + "  top:auto!important;right:auto!important;"
    + "  transform:translateX(-50%)!important;z-index:2147483605!important;"
    + "  pointer-events:auto!important;"
    + "  display:flex!important;flex-direction:column-reverse!important;align-items:center;"
    + "  visibility:visible!important;opacity:1!important;"
    + "  max-width:min(680px,96vw);width:auto;"
    + "  touch-action:manipulation;"
    + "  -webkit-mask-image:none!important;mask-image:none!important}"
    + "html.mg-yt-theater #mg-search-dock,html.mg-yt-fs #mg-search-dock{"
    + "  z-index:2147483640}"
    + "#mg-search-peek{"
    + "  appearance:none;cursor:pointer;user-select:none;"
    + "  padding:8px 14px;border-radius:0;"
    + "  background:transparent!important;border:none!important;box-shadow:none!important;"
    + "  outline:none;"
    + "  color:rgba(255,255,255,0.88);"
    + "  font:700 14px/1 ui-monospace,Menlo,monospace;letter-spacing:0.2em;"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.45);"
    + "  transition:opacity .25s,color .15s,text-shadow .15s;opacity:0.95;"
    + "  display:block!important;visibility:visible!important;"
    + "  position:relative;z-index:2}"
    + "#mg-search-peek:hover{opacity:1;color:#fff;"
    + "  text-shadow:0 0 12px rgba(255,255,255,0.55);background:transparent!important}"
    /* Open bar grows UPWARD (column-reverse parent) so it never falls under the window */
    + "#mg-search{"
    + "  display:flex;align-items:center;gap:6px;padding:7px 9px;"
    + "  width:min(640px,92vw);border-radius:999px;"
    + "  background:rgba(18,22,30,0.72);"
    + "  backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);"
    + "  border:1px solid rgba(255,255,255,0.28);"
    + "  box-shadow:0 10px 32px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.35);"
    + "  opacity:0;transform:translateY(8px) scale(0.98);pointer-events:none;"
    + "  max-height:0;overflow:hidden;margin:0 0 6px 0;padding-top:0;padding-bottom:0;"
    + "  transition:opacity .22s ease,transform .22s ease,max-height .22s ease,padding .22s,margin .22s}"
    + "#mg-search-dock.is-open #mg-search{"
    + "  opacity:1;transform:translateY(0) scale(1);pointer-events:auto;"
    + "  max-height:80px;padding:7px 9px;margin:0 0 6px 0}"
    + "#mg-search-dock.is-open #mg-search-peek{"
    + "  opacity:0.35;pointer-events:none}"
    + "#mg-search-dock:not(.is-open) #mg-search{border-width:0;margin:0}"
    + "#mg-search form{flex:1;display:flex;gap:6px;min-width:0;margin:0;position:relative}"
    + "#mg-search input{flex:1;min-width:0;height:36px;border-radius:999px;padding:0 14px;"
    + "border:1px solid rgba(255,255,255,0.2);outline:none;"
    + "background:rgba(0,0,0,0.28);color:rgba(255,255,255,0.95);"
    + "font:13px/1 system-ui,sans-serif}"
    + "#mg-search input::placeholder{color:rgba(255,255,255,0.4)}"
    + "#mg-search input:focus{border-color:rgba(110,203,255,0.55);"
    + "box-shadow:0 0 0 3px rgba(110,203,255,0.12);background:rgba(0,0,0,0.35)}"
    + "#mg-search .nav{appearance:none;width:36px;height:36px;border-radius:999px;cursor:pointer;"
    + "border:1px solid rgba(255,255,255,0.18);"
    + "background:rgba(255,255,255,0.08);"
    + "color:rgba(255,255,255,0.85);font-size:13px}"
    + "#mg-search .nav:hover{background:rgba(255,255,255,0.16);color:#fff}"
    + "#mg-search .go{appearance:none;height:36px;padding:0 14px;border-radius:999px;cursor:pointer;"
    + "border:1px solid rgba(255,255,255,0.25);"
    + "background:rgba(255,255,255,0.88);"
    + "color:rgba(10,12,16,0.9);font:650 11px system-ui;letter-spacing:0.06em}"
    + "#mg-search .go:hover{background:#fff}";

  var st = document.createElement("style");
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var root = document.createElement("div");
  root.id = "mg-root";
  root.innerHTML =
    '<div id="mg-lf">' +
      '<div id="mg-im-room">' +
        '<div class="mg-im-face" id="mg-im-back"></div>' +
        '<div class="mg-im-face" id="mg-im-floor"></div>' +
        '<div class="mg-im-face" id="mg-im-ceil"></div>' +
        '<div class="mg-im-face" id="mg-im-left"></div>' +
        '<div class="mg-im-face" id="mg-im-right"></div>' +
      '</div>' +
      '<div class="mg-lf-plane" id="mg-lf-far" data-z="900"></div>' +
      '<div class="mg-lf-plane" id="mg-lf-mid" data-z="420"></div>' +
      '<div class="mg-lf-plane" id="mg-lf-near" data-z="140"></div>' +
    '</div>' +
    '<svg width="0" height="0" style="position:absolute">' +
      '<defs>' +
        '<filter id="mg-filt-red" color-interpolation-filters="sRGB">' +
          '<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>' +
        '</filter>' +
        '<filter id="mg-filt-cyan" color-interpolation-filters="sRGB">' +
          '<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>' +
        '</filter>' +
        /* Full-page anaglyph: dual offset + red/cyan screen blend */
        '<filter id="mg-filt-anaglyph" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">' +
          '<feOffset in="SourceGraphic" dx="0" dy="0" result="src"/>' +
          '<feOffset in="src" dx="-6" dy="0" result="Loff"/>' +
          '<feColorMatrix in="Loff" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>' +
          '<feOffset in="src" dx="6" dy="0" result="Roff"/>' +
          '<feColorMatrix in="Roff" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cyan"/>' +
          '<feBlend mode="screen" in="red" in2="cyan"/>' +
        '</filter>' +
      '</defs>' +
    '</svg>' +
    '<div id="mg-ana-stack" aria-hidden="true">' +
      '<div class="mg-ana-eye" id="mg-ana-L"></div>' +
      '<div class="mg-ana-eye" id="mg-ana-R"></div>' +
    '</div>' +
    '<div id="mg-stereo-ghost"></div>' +
    '<div id="mg-vignette"></div>' +
    '<div id="mg-lens"></div>' +
    '<div id="mg-irradiance"></div>' +
    '<div id="mg-chroma"></div>' +
    '<div id="mg-spec"></div>' +
    '<div id="mg-fovea"></div>' +
    '<div id="mg-focus-reticle"></div>' +
    '<div id="mg-hud-ring"></div>' +
    '<div id="mg-dim" aria-hidden="true"></div>' +
    '<div class="mg-edge n" data-dir="n" title="Resize"></div>' +
    '<div class="mg-edge s" data-dir="s" title="Resize"></div>' +
    '<div class="mg-edge e" data-dir="e" title="Resize"></div>' +
    '<div class="mg-edge w" data-dir="w" title="Resize"></div>' +
    '<div class="mg-edge ne" data-dir="ne" title="Resize"></div>' +
    '<div class="mg-edge nw" data-dir="nw" title="Resize"></div>' +
    '<div class="mg-edge se" data-dir="se" title="Resize"></div>' +
    '<div class="mg-edge sw" data-dir="sw" title="Resize"></div>' +
    '<div id="mg-stoplights" role="group" aria-label="Window">' +
      '<button type="button" class="mg-dot" data-win="close" title="Close">.</button>' +
      '<button type="button" class="mg-dot" data-win="min" title="Minimize">.</button>' +
      '<button type="button" class="mg-dot" data-win="max" title="Zoom">.</button>' +
    '</div>' +
    '<div id="mg-top-right">' +
      '<div id="mg-dev" aria-live="polite">' +
        '<button type="button" id="mg-dev-toggle" title="Inspect float (⌘⌥I)">' +
          '<span class="dot">.</span>inspect' +
          '<span id="mg-dev-badge"></span>' +
        '</button>' +
        '<div id="mg-dev-panel" role="log" aria-label="Dev inspect">' +
          '<div id="mg-dev-log"><div id="mg-dev-empty"></div></div>' +
        '</div>' +
      '</div>' +
      '<div id="mg-mode-menu" role="navigation" aria-label="View modes">' +
        '<button type="button" id="mg-mode-trigger" aria-expanded="false" aria-haspopup="true" aria-controls="mg-mode-drop" title="View mode: page · cinema · depth">' +
          '<span class="dot">.</span><span id="mg-mode-label">page</span><span class="chev">▾</span>' +
        '</button>' +
        '<div id="mg-mode-drop" role="menu">' +
          '<button type="button" role="menuitem" data-mode="page" class="on"><span class="dot">.</span>page</button>' +
          '<button type="button" role="menuitem" data-mode="phone" title="Live device relay (lean CTRL)"><span class="dot">.</span>phone</button>' +
          '<button type="button" role="menuitem" data-mode="cinema"><span class="dot">.</span>cinema</button>' +
          '<button type="button" role="menuitem" data-mode="depth"><span class="dot">.</span>depth</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="mg-dragon">' +
      '<div id="mg-drag-pad" title="Drag to move"></div>' +
      '<div id="mg-tab-row">' +
        '<button type="button" class="mg-grip" id="mg-grip-l" title="Drag to move">....</button>' +
        '<button type="button" id="mg-tab" aria-expanded="false" aria-controls="mg-panel">' +
          '<span class="tab-lbl"><span class="live"></span>CTRL <span class="chev">▾</span></span>' +
        '</button>' +
        '<button type="button" class="mg-grip" id="mg-grip-r" title="Drag to move">....</button>' +
      '</div>' +
      '<div id="mg-panel" role="region" aria-label="Mission controls">' +
        '<div id="mg-panel-inner">' +
          '<div class="hdr"><span>PORTAL · <em>DEPTH</em></span><span class="sys">LIVE</span></div>' +
          '<div id="mg-sec-master" role="group" aria-label="Section controls">' +
            '<button type="button" id="mg-sec-expand" title="Open every section">Expand all</button>' +
            '<button type="button" id="mg-sec-collapse" title="Close every section">Collapse all</button>' +
          '</div>' +
          '<div class="mg-sec is-open" data-sec="nav">' +
            '<button type="button" class="mg-sec-toggle" aria-expanded="true">' +
              '<span class="sec-meta"><span class="sec-title">Nav</span><span class="sec-count">4</span></span>' +
              '<span class="chev">▾</span>' +
            '</button>' +
            '<div class="mg-sec-body">' +
              '<div id="mg-keys">' +
                '<button type="button" data-op="back">◀</button>' +
                '<button type="button" data-op="forward">▶</button>' +
                '<button type="button" data-op="reload">↻</button>' +
                '<button type="button" class="accent" id="mg-recenter">MAIN</button>' +
                '<button type="button" id="mg-phone-relay" title="PHONE live relay">PHONE</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mg-sec is-open" data-sec="eye">' +
            '<button type="button" class="mg-sec-toggle" aria-expanded="true">' +
              '<span class="sec-meta"><span class="sec-title">Eye</span><span class="sec-count">10</span></span>' +
              '<span class="chev">▾</span>' +
            '</button>' +
            '<div class="mg-sec-body">' +
              '<div id="mg-eyes" role="group" aria-label="Eye presets">' +
                '<button type="button" data-eye="human">Human</button>' +
                '<button type="button" data-eye="eagle">Eagle</button>' +
                '<button type="button" data-eye="cat">Cat</button>' +
                '<button type="button" data-eye="owl">Owl</button>' +
                '<button type="button" data-eye="dog">Dog</button>' +
                '<button type="button" data-eye="horse">Horse</button>' +
                '<button type="button" data-eye="spider">Spider</button>' +
                '<button type="button" data-eye="gecko">Gecko</button>' +
                '<button type="button" data-eye="fly">Compound</button>' +
                '<button type="button" data-eye="calibrate" class="on">No-glasses</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mg-sec" id="mg-rx" data-sec="rx">' +
            '<button type="button" class="mg-sec-toggle" id="mg-rx-toggle" aria-expanded="false">' +
              '<span class="sec-meta"><span class="sec-title">Glasses Rx</span><span class="sec-count">PD · Astig</span></span>' +
              '<span class="chev">▾</span>' +
            '</button>' +
            '<div class="mg-sec-body" id="mg-rx-body">' +
              '<div class="rx-row">' +
                '<span class="rx-h lbl"></span>' +
                '<span class="rx-h">SPH</span>' +
                '<span class="rx-h">CYL</span>' +
                '<span class="rx-h">AXIS°</span>' +
              '</div>' +
              '<div class="rx-row">' +
                '<span class="rx-eye">OD</span>' +
                '<input type="number" id="mg-rx-sph-od" step="0.25" min="-20" max="20" placeholder="-2.00" title="Right sphere (D)"/>' +
                '<input type="number" id="mg-rx-cyl-od" step="0.25" min="-8" max="8" placeholder="-0.75" title="Right cylinder (astigmatism)"/>' +
                '<input type="number" id="mg-rx-ax-od" step="1" min="0" max="180" placeholder="90" title="Right axis degrees"/>' +
              '</div>' +
              '<div class="rx-row">' +
                '<span class="rx-eye">OS</span>' +
                '<input type="number" id="mg-rx-sph-os" step="0.25" min="-20" max="20" placeholder="-2.00" title="Left sphere (D)"/>' +
                '<input type="number" id="mg-rx-cyl-os" step="0.25" min="-8" max="8" placeholder="-0.75" title="Left cylinder (astigmatism)"/>' +
                '<input type="number" id="mg-rx-ax-os" step="1" min="0" max="180" placeholder="90" title="Left axis degrees"/>' +
              '</div>' +
              '<div class="rx-row pd">' +
                '<span class="rx-eye">PD</span>' +
                '<input type="number" id="mg-rx-pd" step="0.5" min="40" max="80" placeholder="63" title="Pupillary distance (mm)"/>' +
                '<input type="number" id="mg-rx-pd-near" step="0.5" min="40" max="80" placeholder="near" title="Near PD optional (mm)"/>' +
              '</div>' +
              '<div class="rx-vendor">' +
                '<span class="rx-eye">Brand</span>' +
                '<select id="mg-rx-vendor" title="Source brand / format hint">' +
                  '<option value="auto">Auto-detect</option>' +
                  '<option value="memory-glass">Memory Glass JSON</option>' +
                  '<option value="warby-parker">Warby Parker</option>' +
                  '<option value="meta-rayban">Meta Ray-Ban / Meta AI</option>' +
                  '<option value="oakley">Oakley / Luxottica</option>' +
                  '<option value="xreal">XREAL</option>' +
                  '<option value="viture">VITURE</option>' +
                  '<option value="rokid">Rokid</option>' +
                  '<option value="even-realities">Even Realities</option>' +
                  '<option value="zenni">Zenni / generic lab</option>' +
                  '<option value="generic">Generic optical</option>' +
                '</select>' +
                '<div class="rx-vendor-hint" id="mg-rx-import-status">Import JSON · CSV · TXT · .rx from Warby, Meta Ray-Ban, Oakley, XREAL, labs…</div>' +
              '</div>' +
              '<div class="rx-note">SPH/CYL diopters · AXIS 0–180° · PD mm · import smart-glasses / retailer Rx files</div>' +
              '<div class="rx-actions">' +
                '<label class="file" title="Import prescription file">Import' +
                  '<input type="file" id="mg-rx-file" accept=".json,.csv,.txt,.rx,.xml,.html,.htm,application/json,text/csv,text/plain"/>' +
                '</label>' +
                '<button type="button" id="mg-rx-sample" title="Download sample template for selected brand">Sample</button>' +
                '<button type="button" id="mg-rx-clear">Clear</button>' +
                '<button type="button" class="primary" id="mg-rx-apply">Apply Rx</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mg-sec is-open" data-sec="modes">' +
            '<button type="button" class="mg-sec-toggle" aria-expanded="true">' +
              '<span class="sec-meta"><span class="sec-title">Modes</span><span class="sec-count">12</span></span>' +
              '<span class="chev">▾</span>' +
            '</button>' +
            '<div class="mg-sec-body">' +
              '<div id="mg-modes" role="group" aria-label="Stereo modes">' +
                '<button type="button" id="mg-cinema-toggle">Cinema dim</button>' +
                '<button type="button" id="mg-ana-toggle">Anaglyph RB</button>' +
                '<button type="button" id="mg-mirror-toggle">Mirror R</button>' +
                '<button type="button" id="mg-focus-toggle" class="on">Hover focus</button>' +
                '<button type="button" id="mg-zoom-toggle" class="on">Focal zoom</button>' +
                '<button type="button" id="mg-track-toggle">Cam track</button>' +
                '<button type="button" id="mg-axis-toggle">Page axis</button>' +
                '<button type="button" id="mg-hand-toggle" class="on">Hands</button>' +
                '<button type="button" id="mg-occ-toggle" class="on">Occlude</button>' +
                '<button type="button" id="mg-lidar-toggle" class="on">Lidar/GSplat</button>' +
                '<button type="button" id="mg-recalib">Recalibrate</button>' +
                '<button type="button" id="mg-pip-toggle">Cam PIP</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mg-sec is-open" data-sec="lens">' +
            '<button type="button" class="mg-sec-toggle" aria-expanded="true">' +
              '<span class="sec-meta"><span class="sec-title">Lens</span><span class="sec-count">7 sliders</span></span>' +
              '<span class="chev">▾</span>' +
            '</button>' +
            '<div class="mg-sec-body">' +
              '<div class="mg-sliders" id="mg-persp-lens">' +
                '<label>FOV <input type="range" id="mg-c-fov" min="600" max="3200" value="1800"/><span class="v" id="mg-v-fov">1800</span></label>' +
                '<label>Focal <input type="range" id="mg-c-focal" min="20" max="200" value="95"/><span class="v" id="mg-v-focal">95</span></label>' +
                '<label>Fovea <input type="range" id="mg-c-fovea" min="10" max="90" value="34"/><span class="v" id="mg-v-fovea">34</span></label>' +
                '<label>Sharp <input type="range" id="mg-c-sharp" min="0" max="100" value="62"/><span class="v" id="mg-v-sharp">62</span></label>' +
                '<label>Zoom <input type="range" id="mg-c-zoom" min="0" max="14" value="5"/><span class="v" id="mg-v-zoom">5</span></label>' +
                '<label>Accom <input type="range" id="mg-c-accom" min="0" max="100" value="12"/><span class="v" id="mg-v-accom">12</span></label>' +
                '<label>Drop <input type="range" id="mg-c-drop" min="40" max="98" value="82"/><span class="v" id="mg-v-drop">82</span></label>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mg-sec" data-sec="stereo">' +
            '<button type="button" class="mg-sec-toggle" aria-expanded="false">' +
              '<span class="sec-meta"><span class="sec-title">Stereo</span><span class="sec-count">4 sliders</span></span>' +
              '<span class="chev">▾</span>' +
            '</button>' +
            '<div class="mg-sec-body">' +
              '<div class="mg-sliders" id="mg-persp-stereo">' +
                '<label>IPD <input type="range" id="mg-c-ipd" min="0" max="80" value="14"/><span class="v" id="mg-v-ipd">14</span></label>' +
                '<label>Ana <input type="range" id="mg-c-ana" min="0" max="100" value="18"/><span class="v" id="mg-v-ana">18</span></label>' +
                '<label>LF <input type="range" id="mg-c-lf" min="0" max="100" value="42"/><span class="v" id="mg-v-lf">42</span></label>' +
                '<label>Glow <input type="range" id="mg-c-glow" min="0" max="100" value="40"/><span class="v" id="mg-v-glow">40</span></label>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mg-sec" data-sec="track">' +
            '<button type="button" class="mg-sec-toggle" aria-expanded="false">' +
              '<span class="sec-meta"><span class="sec-title">Track</span><span class="sec-count">4 sliders</span></span>' +
              '<span class="chev">▾</span>' +
            '</button>' +
            '<div class="mg-sec-body">' +
              '<div class="mg-sliders" id="mg-persp-track">' +
                '<label>Follow <input type="range" id="mg-c-follow" min="4" max="55" value="42"/><span class="v" id="mg-v-follow">42</span></label>' +
                '<label>Lean <input type="range" id="mg-c-lean" min="0" max="100" value="55"/><span class="v" id="mg-v-lean">55</span></label>' +
                '<label>Tilt <input type="range" id="mg-c-tilt" min="0" max="100" value="48"/><span class="v" id="mg-v-tilt">48</span></label>' +
                '<label>Axis gain <input type="range" id="mg-c-gain" min="10" max="160" value="112"/><span class="v" id="mg-v-gain">112</span></label>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="mg-calib">Head lock · expand hands · coverflow+PIP above inspect</div>' +
          '<div id="mg-foot">PAGE · PHONE · CINEMA · DEPTH · ⌘T/N/W</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="mg-scrim"></div>' +
    '<canvas id="mg-occ" width="1280" height="720" aria-hidden="true"></canvas>' +
    '<div id="mg-hand-cursor" aria-hidden="true"></div>' +
    '<canvas id="mg-lidar" width="960" height="540" aria-hidden="true"></canvas>' +
    '<div id="mg-page-stack" aria-hidden="true"></div>' +
    /* Coverflow UI lives in inspect float; hidden shell kept for tracking video only */
    '<div id="mg-coverflow" aria-hidden="true" style="display:none">' +
      '<div id="mg-cf-stage"></div>' +
    '</div>' +
    '<div id="mg-cam-pip" aria-hidden="true" style="display:none">' +
      '<video id="mg-cam-video" muted playsinline></video>' +
      '<canvas id="mg-cam-overlay" width="400" height="300"></canvas>' +
      '<div class="pip-lbl" id="mg-pip-lbl">mesh · expand hands · lidar</div>' +
    '</div>' +
    '<div id="mg-tabs" role="tablist" aria-label="Tabs"></div>' +
    /* Version top-left near grab; credit lives in source only (not public UI) */
    '<div id="mg-build-stamp" title="Build / run stamp">version pending…</div>' +
    '<div id="mg-search-dock">' +
      '<button type="button" id="mg-search-peek" title="Open search">.....</button>' +
      '<div id="mg-search">' +
        '<button type="button" class="nav" data-op="back" title="Back">←</button>' +
        '<button type="button" class="nav" data-op="forward" title="Forward">→</button>' +
        '<button type="button" class="nav" data-op="reload" title="Reload">↻</button>' +
        '<form id="mg-form">' +
          '<input id="mg-url" spellcheck="false" autocomplete="off" placeholder="Search or URL"/>' +
          '<button type="submit" class="go">Go</button>' +
        '</form>' +
      '</div>' +
    '</div>';
  document.documentElement.appendChild(root);

  /* Re-mount only if detached — never rewrite full-screen geometry */
  function fortifyHud() {
    var r = document.getElementById("mg-root");
    if (!r) return;
    try {
      if (r.hasAttribute("popover")) r.removeAttribute("popover");
      if (r.parentNode !== document.documentElement) {
        document.documentElement.appendChild(r);
      }
      r.style.pointerEvents = "none";
      r.style.width = "0px";
      r.style.height = "0px";
      r.style.overflow = "visible";
      r.style.zIndex = "2147483646";
    } catch (e) {}
  }
  fortifyHud();
  setInterval(fortifyHud, 4000);
  try {
    new MutationObserver(function () {
      var r = document.getElementById("mg-root");
      if (!r || r.parentNode !== document.documentElement) fortifyHud();
    }).observe(document.documentElement, { childList: true, subtree: false });
  } catch (e) {}

  /*
   * Light-field portal + anaglyph multi-stack.
   * LabViewRay is the single pivot: pointer | camera (FaceDetector / centroid).
   * Page-axis lean is optional; auto-suppressed in YouTube theater / fullscreen.
   */
  try { (function portal() {
    var rootEl = document.documentElement;
    var ctrl = {
      /* Default no-glasses reading stack (auto-calibrated on boot) */
      fov: 1800, focal: 95, ipd: 14, accom: 0.12, fovea: 34,
      drop: 82, lf: 0.42, glow: 0.40, follow: 0.42,
      lean: 0.55, tilt: 0.48, gain: 1.12,
      sharp: 0.62, zoom: 0.05,
      ana: 0.18, anaOn: false, mirror: false, hoverFocus: true,
      /* Default PAGE mode — no cam/lidar/hands thrash. DEPTH opt-in via mode menu. */
      focalZoom: false, camTrack: false, pageAxis: false, camPip: false,
      handTrack: false, occlude: false, lidar: false
    };
    /* Rest-pose zero — x/y yaw-pitch, z forward/back (face scale), roll head tilt */
    var calib = { x: 0, y: 0, z: 0, roll: 0, nx: 0.5, ny: 0.46, faceScale: 0, ready: false };
    var ytState = { theater: false, fs: false, video: false };
    window.LabViewRay = {
      x: 0, y: 0, z: 0, roll: 0,
      nx: 0.5, ny: 0.46,
      rawX: 0, rawY: 0, rawZ: 0, rawRoll: 0,
      source: "pointer",
      confidence: 0,
      locked: false,
      engine: "none",
      hands: null,
      person: null,
      set: function (o) {
        if (o.x != null) this.rawX = o.x;
        if (o.y != null) this.rawY = o.y;
        if (o.z != null) this.rawZ = o.z;
        if (o.roll != null) this.rawRoll = o.roll;
        var src = o.source || this.source;
        var sx = (o.x != null ? o.x : this.rawX);
        var sy = (o.y != null ? o.y : this.rawY);
        var sz = (o.z != null ? o.z : this.rawZ);
        var sr = (o.roll != null ? o.roll : this.rawRoll);
        if (src === "camera") {
          sx -= calib.x;
          sy -= calib.y;
          sz -= calib.z;
          sr -= (calib.roll || 0);
        }
        this.x = Math.max(-1.6, Math.min(1.6, sx));
        this.y = Math.max(-1.6, Math.min(1.6, sy));
        this.z = Math.max(-1.6, Math.min(1.6, sz));
        this.roll = Math.max(-1.2, Math.min(1.2, sr));
        if (o.nx != null) this.nx = o.nx;
        if (o.ny != null) this.ny = o.ny;
        if (o.source) this.source = o.source;
        if (o.confidence != null) this.confidence = o.confidence;
        if (o.locked != null) this.locked = !!o.locked;
        if (o.engine) this.engine = o.engine;
        if (o.hands) this.hands = o.hands;
        if (o.person) this.person = o.person;
      },
      recalibrate: function () {
        calib.x = this.rawX;
        calib.y = this.rawY;
        calib.z = this.rawZ;
        calib.roll = this.rawRoll || 0;
        calib.nx = this.nx;
        calib.ny = this.ny;
        calib.ready = true;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.roll = 0;
        try { localStorage.setItem("mg.viewray.calib", JSON.stringify(calib)); } catch (e) {}
      }
    };
    try {
      var savedCal = JSON.parse(localStorage.getItem("mg.viewray.calib") || "null");
      if (savedCal && typeof savedCal.x === "number") {
        calib.x = savedCal.x; calib.y = savedCal.y;
        calib.z = savedCal.z || 0;
        calib.roll = savedCal.roll || 0;
        calib.nx = savedCal.nx || 0.5; calib.ny = savedCal.ny || 0.46;
        calib.faceScale = savedCal.faceScale || 0;
        calib.ready = true;
      }
    } catch (e) {}
    /* User spacex.com cool test (slightly see-through):
       FOV 2533 · Focal 168 · IPD 51 · Ana 53 · Accom 48 · Fovea 78 · Drop 55 · LF 80 · Glow? → map:
       FOV, Focal, IPD, Ana, Accom, Fovea, Drop, LF, Follow — Glow from human cool default 55 */
    var EYES = {
      human:     { fov: 2533, focal: 168, ipd: 51, ana: 53, fovea: 78, accom: 48, sharp: 35, zoom: 2, drop: 80, lf: 80, glow: 55, follow: 22 },
      eagle:     { fov: 900,  focal: 120, ipd: 48, ana: 40, fovea: 14, accom: 70, sharp: 55, zoom: 4, drop: 82, lf: 70, glow: 55, follow: 12 },
      cat:       { fov: 1400, focal: 40,  ipd: 40, ana: 45, fovea: 35, accom: 55, sharp: 45, zoom: 3, drop: 88, lf: 60, glow: 70, follow: 14 },
      owl:       { fov: 1100, focal: 80,  ipd: 56, ana: 35, fovea: 22, accom: 30, sharp: 40, zoom: 3, drop: 90, lf: 50, glow: 45, follow: 10 },
      /* Dog: motion-biased, lower acuity center, wide periphery */
      dog:       { fov: 2200, focal: 70,  ipd: 44, ana: 38, fovea: 48, accom: 40, sharp: 38, zoom: 3, drop: 86, lf: 55, glow: 50, follow: 30 },
      /* Horse: extreme lateral FOV, monocular bias, distant focal */
      horse:     { fov: 3000, focal: 150, ipd: 72, ana: 62, fovea: 62, accom: 25, sharp: 32, zoom: 1, drop: 84, lf: 45, glow: 35, follow: 10 },
      /* Spider: multi-lens / high FOV stress, tight modules, high accom chatter */
      spider:    { fov: 2800, focal: 30,  ipd: 8,  ana: 85, fovea: 70, accom: 88, sharp: 75, zoom: 7, drop: 92, lf: 90, glow: 85, follow: 34 },
      /* Gecko: nocturnal-ish, high contrast, close focus, sticky tracking */
      gecko:     { fov: 1600, focal: 55,  ipd: 28, ana: 30, fovea: 28, accom: 50, sharp: 58, zoom: 5, drop: 88, lf: 48, glow: 65, follow: 28 },
      fly:       { fov: 2400, focal: 25,  ipd: 12, ana: 70, fovea: 55, accom: 80, sharp: 70, zoom: 6, drop: 92, lf: 85, glow: 80, follow: 18 },
      /* No-glasses / prescription-assist: tighter fovea, low blur, mild zoom, sharper text */
      calibrate: { fov: 1800, focal: 95,  ipd: 14, ana: 18, fovea: 34, accom: 12, sharp: 62, zoom: 5, drop: 88, lf: 28, glow: 40, follow: 26 }
    };
    function setSlider(id, val) {
      var el = document.getElementById(id);
      if (el) { el.value = String(val); el.dispatchEvent(new Event("input")); }
    }
    function applyEye(name) {
      var e = EYES[name];
      if (!e) return;
      document.querySelectorAll("#mg-eyes button").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-eye") === name);
      });
      setSlider("mg-c-fov", e.fov);
      setSlider("mg-c-focal", e.focal);
      setSlider("mg-c-ipd", e.ipd);
      if (e.ana != null) setSlider("mg-c-ana", e.ana);
      setSlider("mg-c-fovea", e.fovea);
      setSlider("mg-c-accom", e.accom);
      if (e.sharp != null) setSlider("mg-c-sharp", e.sharp);
      if (e.zoom != null) setSlider("mg-c-zoom", e.zoom);
      if (e.drop != null) setSlider("mg-c-drop", e.drop);
      setSlider("mg-c-lf", e.lf);
      setSlider("mg-c-glow", e.glow);
      if (e.follow != null) setSlider("mg-c-follow", e.follow);
      try { localStorage.setItem("mg.eye", name); } catch (err) {}
      rootEl.classList.toggle("mg-no-glasses", name === "calibrate");
      var cal = document.getElementById("mg-calib");
      if (cal) {
        var labels = {
          calibrate: "No-glasses · sharp + focal zoom · low IPD stress",
          human: "Human · spacex cool — FOV2533 · focal168 · IPD51",
          dog: "Dog · motion bias · wider mid-periphery",
          horse: "Horse · panoramic FOV · distant focal · high IPD",
          spider: "Spider · multi-lens stress · high FOV / accom",
          gecko: "Gecko · close focus · sticky follow · night glow"
        };
        cal.textContent = labels[name]
          || ("Eye · " + name + " — focal " + e.focal + " · IPD " + e.ipd + " · fovea " + e.fovea + "%");
      }
    }
    document.querySelectorAll("#mg-eyes button").forEach(function (b) {
      b.addEventListener("click", function () { applyEye(b.getAttribute("data-eye")); });
    });
    function applySeeThrough() {
      /*
       * Drop → long soft glass lip (organic-sphere feel), NOT a small hard ellipse.
       * Glow → lens rim overlays + slight underplate soften.
       *
       * Model: ellipse stays near full-window (soft edge can be long).
       * Drop only moves the solid core % inside that large ellipse.
       * Concrete mask-image inline — WK often won't recompute mask from CSS vars alone.
       */
      var d = Math.max(20, Math.min(100, +ctrl.drop || 80));
      var t = Math.max(0, Math.min(1, (d - 40) / 58)); /* 0 at Drop40 … 1 at Drop98 */
      /* Keep aperture large so falloff is never a cookie-cutter */
      var dw = (104 + t * 12).toFixed(1) + "%"; /* ~104% … 116% */
      var dh = (100 + t * 12).toFixed(1) + "%";
      /* Solid core: low Drop → deep glass (small core, long soft tail) */
      var core = 22 + t * 56;   /* ~22% … ~78% */
      var mid  = core + 10 + (1 - t) * 6;
      var soft = Math.min(94, core + 22 + (1 - t) * 8);
      var coreS = core.toFixed(1) + "%";
      var midS  = mid.toFixed(1) + "%";
      var softS = soft.toFixed(1) + "%";
      rootEl.style.setProperty("--mg-drop-w", dw);
      rootEl.style.setProperty("--mg-drop-h", dh);
      rootEl.style.setProperty("--mg-drop-core", coreS);
      rootEl.style.setProperty("--mg-drop-mid", midS);
      rootEl.style.setProperty("--mg-drop-soft", softS);
      /* fill: Drop40 ≈ 0.14 glass, Drop98 ≈ 0.92 */
      var fillA = 0.14 + t * 0.78;
      rootEl.style.setProperty("--mg-fill-a", fillA.toFixed(3));
      var mask =
        "radial-gradient(ellipse " + dw + " " + dh + " at 50% 48%," +
        "#fff 0%," +
        "#fff " + coreS + "," +
        "rgba(255,255,255,0.88) " + midS + "," +
        "rgba(255,255,255,0.48) " + softS + "," +
        "rgba(255,255,255,0.14) 96%," +
        "transparent 100%)";
      var cinema = rootEl.classList.contains("mg-cinema-on") || rootEl.classList.contains("mg-dim-on");
      try {
        document.documentElement.style.setProperty("background", "transparent", "important");
        document.documentElement.style.setProperty("background-color", "transparent", "important");
        if (document.body) {
          var b = document.body;
          if (!cinema) {
            b.style.setProperty("background", "rgba(12,14,18," + fillA.toFixed(3) + ")", "important");
            b.style.setProperty("background-color", "rgba(12,14,18," + fillA.toFixed(3) + ")", "important");
            b.style.setProperty("border-radius", "0", "important");
            b.style.setProperty("-webkit-mask-image", mask, "important");
            b.style.setProperty("mask-image", mask, "important");
            b.style.setProperty("-webkit-mask-mode", "alpha", "important");
            b.style.setProperty("mask-mode", "alpha", "important");
            b.style.setProperty("-webkit-mask-repeat", "no-repeat", "important");
            b.style.setProperty("mask-repeat", "no-repeat", "important");
            b.style.setProperty("-webkit-mask-size", "100% 100%", "important");
            b.style.setProperty("mask-size", "100% 100%", "important");
          }
        }
      } catch (eBg) {}
      var g = +ctrl.glow || 0;
      var ir = document.getElementById("mg-irradiance");
      var ch = document.getElementById("mg-chroma");
      var ln = document.getElementById("mg-lens");
      var vg = document.getElementById("mg-vignette");
      var sp = document.getElementById("mg-spec");
      var hr = document.getElementById("mg-hud-ring");
      /* Glow softens underplate slightly + organic breathe on lens rim */
      if (!cinema && document.body && g > 0.02) {
        try {
          var glowFill = Math.max(0.08, fillA - g * 0.16);
          document.body.style.setProperty(
            "background-color",
            "rgba(12,14,18," + glowFill.toFixed(3) + ")",
            "important"
          );
          rootEl.style.setProperty("--mg-fill-a", glowFill.toFixed(3));
        } catch (eG) {}
      }
      rootEl.style.setProperty("--mg-orb-g", String(g));
      if (ir) { ir.style.visibility = "visible"; ir.style.opacity = String(0.12 + g * 0.85); }
      if (ch) { ch.style.visibility = "visible"; ch.style.opacity = String(0.1 + g * 0.8); }
      if (ln) {
        ln.style.visibility = "visible";
        ln.style.opacity = String(0.18 + g * 0.82);
        /* organic-sphere-ish slow breathe when glow is up */
        ln.style.animation = g > 0.08 ? "mg-orb-breathe " + (4.2 - g * 1.4).toFixed(2) + "s ease-in-out infinite" : "none";
      }
      if (vg) { vg.style.visibility = "visible"; vg.style.opacity = String(0.12 + g * 0.5); }
      if (sp) { sp.style.visibility = "visible"; sp.style.opacity = String(0.18 + g * 0.65); }
      if (hr) {
        hr.style.visibility = "visible";
        hr.style.opacity = String(0.2 + g * 0.55);
      }
    }
    function bind(id, key, map, outId) {
      var el = document.getElementById(id);
      var out = document.getElementById(outId);
      if (!el) return;
      function apply() {
        var raw = +el.value;
        ctrl[key] = map(raw);
        if (out) out.textContent = String(raw);
        rootEl.style.setProperty("--mg-fov", ctrl.fov + "px");
        rootEl.style.setProperty("--mg-ipd", ctrl.ipd + "px");
        rootEl.style.setProperty("--mg-stereo-a", (ctrl.ipd / 80 * 0.22).toFixed(3));
        rootEl.style.setProperty("--mg-fovea-r", ctrl.fovea + "%");
        rootEl.style.setProperty("--mg-ana-a", String(0.25 + ctrl.ana * 0.55));
        /* Anaglyph half-offset grows with IPD; zero at focus plane via dynamic feOffset */
        var half = Math.max(0, ctrl.ipd * 0.22 * (0.4 + ctrl.ana));
        rootEl.style.setProperty("--mg-ana-off", half.toFixed(2) + "px");
        updateAnaglyphFilter(half);
        applySeeThrough();
      }
      el.addEventListener("input", apply);
      apply();
    }
    function updateAnaglyphFilter(half) {
      var filt = document.getElementById("mg-filt-anaglyph");
      if (!filt) return;
      var offs = filt.querySelectorAll("feOffset");
      /* [0]=src identity, [1]=L, [2]=R — indices after structure */
      if (offs.length >= 3) {
        offs[1].setAttribute("dx", String(-half));
        offs[2].setAttribute("dx", String(half));
      }
    }
    bind("mg-c-fov", "fov", function (v) { return v; }, "mg-v-fov");
    bind("mg-c-focal", "focal", function (v) { return v; }, "mg-v-focal");
    bind("mg-c-ipd", "ipd", function (v) { return v; }, "mg-v-ipd");
    bind("mg-c-ana", "ana", function (v) { return v / 100; }, "mg-v-ana");
    bind("mg-c-accom", "accom", function (v) { return v / 100; }, "mg-v-accom");
    bind("mg-c-fovea", "fovea", function (v) { return v; }, "mg-v-fovea");
    bind("mg-c-sharp", "sharp", function (v) { return v / 100; }, "mg-v-sharp");
    bind("mg-c-zoom", "zoom", function (v) { return v / 100; }, "mg-v-zoom");
    bind("mg-c-drop", "drop", function (v) { return v; }, "mg-v-drop");
    bind("mg-c-lf", "lf", function (v) { return v / 100; }, "mg-v-lf");
    bind("mg-c-glow", "glow", function (v) { return v / 100; }, "mg-v-glow");
    bind("mg-c-follow", "follow", function (v) { return v / 100; }, "mg-v-follow");
    bind("mg-c-lean", "lean", function (v) { return v / 100; }, "mg-v-lean");
    bind("mg-c-tilt", "tilt", function (v) { return v / 100; }, "mg-v-tilt");
    bind("mg-c-gain", "gain", function (v) { return v / 100; }, "mg-v-gain");

    function setCalibMsg(msg) {
      var cal = document.getElementById("mg-calib");
      if (cal) cal.textContent = msg;
      try {
        if (typeof window.__mgDevLog === "function" && msg) {
          window.__mgDevLog("info", String(msg), "calib");
        }
      } catch (eD) {}
    }

    /* ── CTRL section clumps: collapse each + Expand/Collapse all ── */
    (function sectionClumps() {
      function setOpen(sec, open) {
        if (!sec) return;
        sec.classList.toggle("is-open", !!open);
        var tog = sec.querySelector(".mg-sec-toggle");
        if (tog) tog.setAttribute("aria-expanded", open ? "true" : "false");
        try {
          var id = sec.getAttribute("data-sec");
          if (id) localStorage.setItem("mg.sec." + id, open ? "1" : "0");
        } catch (e) {}
      }
      var openCount = 0;
      document.querySelectorAll("#mg-panel .mg-sec").forEach(function (sec) {
        var id = sec.getAttribute("data-sec");
        try {
          var saved = localStorage.getItem("mg.sec." + id);
          if (saved === "1") setOpen(sec, true);
          else if (saved === "0") setOpen(sec, false);
        } catch (e) {}
        if (sec.classList.contains("is-open")) openCount += 1;
        var tog = sec.querySelector(".mg-sec-toggle");
        if (!tog || tog.__mgSecBound) return;
        tog.__mgSecBound = true;
        tog.addEventListener("click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          setOpen(sec, !sec.classList.contains("is-open"));
        });
      });
      /* If every section was force-closed (stale localStorage), restore useful defaults */
      if (openCount === 0) {
        ["nav", "eye", "modes", "lens"].forEach(function (id) {
          var sec = document.querySelector('#mg-panel .mg-sec[data-sec="' + id + '"]');
          if (sec) setOpen(sec, true);
        });
      }
      var exp = document.getElementById("mg-sec-expand");
      var col = document.getElementById("mg-sec-collapse");
      if (exp && !exp.__mgBound) {
        exp.__mgBound = true;
        exp.addEventListener("click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          document.querySelectorAll("#mg-panel .mg-sec").forEach(function (s) { setOpen(s, true); });
        });
      }
      if (col && !col.__mgBound) {
        col.__mgBound = true;
        col.addEventListener("click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          document.querySelectorAll("#mg-panel .mg-sec").forEach(function (s) { setOpen(s, false); });
        });
      }
    })();

    /* ── Glasses Rx · PD · Astigmatism ── */
    (function prescriptionSection() {
      var wrap = document.getElementById("mg-rx");
      var tog = document.getElementById("mg-rx-toggle");
      function num(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback;
        var v = parseFloat(el.value);
        return isFinite(v) ? v : fallback;
      }
      function setNum(id, v) {
        var el = document.getElementById(id);
        if (!el) return;
        if (v == null || v === "" || !isFinite(v)) el.value = "";
        else el.value = String(v);
      }
      function loadRx() {
        try {
          var raw = localStorage.getItem("mg.rx");
          if (!raw) return;
          var r = JSON.parse(raw);
          if (!r || typeof r !== "object") return;
          setNum("mg-rx-sph-od", r.sphOD);
          setNum("mg-rx-sph-os", r.sphOS);
          setNum("mg-rx-cyl-od", r.cylOD);
          setNum("mg-rx-cyl-os", r.cylOS);
          setNum("mg-rx-ax-od", r.axOD);
          setNum("mg-rx-ax-os", r.axOS);
          setNum("mg-rx-pd", r.pd);
          setNum("mg-rx-pd-near", r.pdNear);
        } catch (e) {}
      }
      function saveRx(r) {
        try { localStorage.setItem("mg.rx", JSON.stringify(r)); } catch (e) {}
      }
      function readRx() {
        return {
          sphOD: num("mg-rx-sph-od", 0),
          sphOS: num("mg-rx-sph-os", 0),
          cylOD: num("mg-rx-cyl-od", 0),
          cylOS: num("mg-rx-cyl-os", 0),
          axOD: num("mg-rx-ax-od", 90),
          axOS: num("mg-rx-ax-os", 90),
          pd: num("mg-rx-pd", 63),
          pdNear: num("mg-rx-pd-near", NaN)
        };
      }
      /**
       * Map clinical Rx → portal optics (no-glasses reading assist).
       * SPH (D): |sphere| → zoom + sharp + focal
       * CYL (D): astigmatism magnitude → fovea / mild blur anisotropy
       * AXIS (°): stored for display / future filter orientation
       * PD (mm): pupillary distance → IPD control
       */
      function applyRx() {
        var r = readRx();
        var sph = (r.sphOD + r.sphOS) / 2;
        var cyl = (Math.abs(r.cylOD) + Math.abs(r.cylOS)) / 2;
        var ax = (r.axOD + r.axOS) / 2;
        var pd = r.pd;
        if (!isFinite(pd) || pd < 40) pd = 63;
        if (isFinite(r.pdNear) && r.pdNear >= 40) {
          /* bias slightly toward near PD for screen work */
          pd = pd * 0.65 + r.pdNear * 0.35;
        }
        /* PD mm → IPD slider (clinical PD is typically 54–74) */
        setSlider("mg-c-ipd", Math.max(0, Math.min(80, Math.round(pd))));
        /* Myopia/hyperopia magnitude drives mild magnification */
        var mag = Math.min(14, Math.max(0, Math.abs(sph) * 1.9 + cyl * 0.9));
        setSlider("mg-c-zoom", Math.round(mag));
        /* Sharpness rises with |Rx| so text holds without glasses */
        var sharp = Math.min(100, Math.round(42 + Math.abs(sph) * 11 + cyl * 14));
        setSlider("mg-c-sharp", sharp);
        /* Focal plane: stronger Rx → closer accommodation cue */
        var focal = Math.max(20, Math.min(200, Math.round(118 - Math.abs(sph) * 14 - cyl * 6)));
        setSlider("mg-c-focal", focal);
        /* Tighter fovea with higher prescription */
        var fovea = Math.max(16, Math.min(55, Math.round(40 - Math.abs(sph) * 2.2 - cyl * 1.5)));
        setSlider("mg-c-fovea", fovea);
        /* Less defocus blur when assisting no-glasses */
        var accom = Math.max(4, Math.min(45, Math.round(18 - cyl * 2.5 - Math.abs(sph) * 0.8)));
        setSlider("mg-c-accom", accom);
        /* Stereo stress down for no-glasses */
        setSlider("mg-c-ana", Math.max(5, Math.min(40, Math.round(22 - cyl * 2))));
        setSlider("mg-c-follow", Math.min(40, Math.round(22 + Math.abs(sph) * 1.5)));
        /* CSS hooks for optional astigmatic cue */
        rootEl.style.setProperty("--mg-astig", String(Math.min(1, cyl / 3)));
        rootEl.style.setProperty("--mg-astig-axis", (isFinite(ax) ? ax : 90) + "deg");
        rootEl.style.setProperty("--mg-rx-sph", String(sph));
        rootEl.classList.add("mg-no-glasses");
        rootEl.classList.add("mg-rx-on");
        rootEl.classList.add("mg-focal-zoom");
        ctrl.focalZoom = true;
        var zt = document.getElementById("mg-zoom-toggle");
        if (zt) zt.classList.add("on");
        /* Mark No-glasses eye selected without clobbering mapped sliders */
        document.querySelectorAll("#mg-eyes button").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-eye") === "calibrate");
        });
        try { localStorage.setItem("mg.eye", "calibrate"); } catch (e1) {}
        saveRx(r);
        setCalibMsg(
          "Rx applied · SPH " + sph.toFixed(2) + "D · CYL " + cyl.toFixed(2) +
          "D · AXIS " + Math.round(ax) + "° · PD " + pd.toFixed(1) + "mm → IPD/zoom/sharp"
        );
      }
      function clearRx() {
        ["mg-rx-sph-od","mg-rx-sph-os","mg-rx-cyl-od","mg-rx-cyl-os",
         "mg-rx-ax-od","mg-rx-ax-os","mg-rx-pd","mg-rx-pd-near"].forEach(function (id) {
          setNum(id, null);
        });
        try { localStorage.removeItem("mg.rx"); } catch (e) {}
        rootEl.classList.remove("mg-rx-on");
        rootEl.style.removeProperty("--mg-astig");
        rootEl.style.removeProperty("--mg-astig-axis");
        rootEl.style.removeProperty("--mg-rx-sph");
        setCalibMsg("Rx cleared · use No-glasses preset or re-enter prescription");
      }
      var applyBtn = document.getElementById("mg-rx-apply");
      var clearBtn = document.getElementById("mg-rx-clear");
      if (applyBtn) applyBtn.addEventListener("click", function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        applyRx();
      });
      if (clearBtn) clearBtn.addEventListener("click", function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        clearRx();
      });
      loadRx();
      /* Auto-apply saved Rx on boot if present */
      try {
        if (localStorage.getItem("mg.rx")) {
          setTimeout(function () { applyRx(); }, 600);
        }
      } catch (e2) {}

      /* ── Multi-vendor Rx import (Warby / Meta Ray-Ban / Oakley / smart glasses) ── */
      function setImportStatus(msg) {
        var el = document.getElementById("mg-rx-import-status");
        if (el) el.textContent = msg;
      }
      function pick(obj, keys) {
        if (!obj || typeof obj !== "object") return undefined;
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (obj[k] != null && obj[k] !== "") return obj[k];
          /* case-insensitive */
          var found = undefined;
          Object.keys(obj).some(function (ok) {
            if (ok.toLowerCase() === String(k).toLowerCase()) {
              found = obj[ok];
              return true;
            }
            return false;
          });
          if (found != null && found !== "") return found;
        }
        return undefined;
      }
      function toD(v) {
        if (v == null || v === "") return null;
        if (typeof v === "number" && isFinite(v)) return v;
        var s = String(v).trim().replace(/[^\d.+\-]/g, "");
        if (!s || s === "-" || s === "+" || s === ".") return null;
        var n = parseFloat(s);
        return isFinite(n) ? n : null;
      }
      function toAxis(v) {
        var n = toD(v);
        if (n == null) return null;
        n = Math.round(n) % 180;
        if (n < 0) n += 180;
        return n;
      }
      function eyeFrom(obj) {
        if (!obj || typeof obj !== "object") return { sph: null, cyl: null, ax: null };
        return {
          sph: toD(pick(obj, [
            "sph", "sphere", "SPH", "Sphere", "spherical", "power", "spherePower",
            "sv", "sphereValue", "ds", "diopter", "prescription"
          ])),
          cyl: toD(pick(obj, [
            "cyl", "cylinder", "CYL", "Cylinder", "cylindrical", "cylinderPower", "astig", "astigmatism"
          ])),
          ax: toAxis(pick(obj, [
            "axis", "AXIS", "ax", "axisDegrees", "cylinderAxis", "astigAxis"
          ]))
        };
      }
      function normalizeRx(partial, vendor) {
        var r = {
          sphOD: null, sphOS: null, cylOD: null, cylOS: null,
          axOD: 90, axOS: 90, pd: 63, pdNear: null, vendor: vendor || "generic"
        };
        if (!partial) return r;
        Object.keys(r).forEach(function (k) {
          if (partial[k] != null && partial[k] !== "") r[k] = partial[k];
        });
        if (r.sphOD == null && r.sphOS != null) r.sphOD = r.sphOS;
        if (r.sphOS == null && r.sphOD != null) r.sphOS = r.sphOD;
        if (r.cylOD == null) r.cylOD = 0;
        if (r.cylOS == null) r.cylOS = 0;
        if (!isFinite(r.axOD)) r.axOD = 90;
        if (!isFinite(r.axOS)) r.axOS = 90;
        if (!isFinite(r.pd) || r.pd < 40) r.pd = 63;
        return r;
      }
      function fillFormFromRx(r) {
        setNum("mg-rx-sph-od", r.sphOD);
        setNum("mg-rx-sph-os", r.sphOS);
        setNum("mg-rx-cyl-od", r.cylOD);
        setNum("mg-rx-cyl-os", r.cylOS);
        setNum("mg-rx-ax-od", r.axOD);
        setNum("mg-rx-ax-os", r.axOS);
        setNum("mg-rx-pd", r.pd);
        setNum("mg-rx-pd-near", r.pdNear);
        var vs = document.getElementById("mg-rx-vendor");
        if (vs && r.vendor) {
          for (var i = 0; i < vs.options.length; i++) {
            if (vs.options[i].value === r.vendor) { vs.selectedIndex = i; break; }
          }
        }
      }

      /* Vendor-shaped JSON templates for export/sample */
      var RX_SAMPLES = {
        "memory-glass": {
          format: "memory-glass-rx-v1",
          vendor: "memory-glass",
          sphOD: -2.0, sphOS: -1.75, cylOD: -0.75, cylOS: -0.5, axOD: 90, axOS: 85, pd: 63, pdNear: 60
        },
        "warby-parker": {
          brand: "Warby Parker",
          prescription: {
            rightEye: { sphere: -2.0, cylinder: -0.75, axis: 90 },
            leftEye: { sphere: -1.75, cylinder: -0.5, axis: 85 },
            pd: 63,
            nearPd: 60,
            prescriptionType: "single_vision"
          }
        },
        "meta-rayban": {
          manufacturer: "Meta",
          product: "Ray-Ban Meta",
          lensPrescription: {
            od: { sphere: -2.0, cylinder: -0.75, axis: 90 },
            os: { sphere: -1.75, cylinder: -0.5, axis: 85 },
            pupillaryDistance: 63,
            nearPupillaryDistance: 60,
            type: "single_vision"
          }
        },
        "oakley": {
          brand: "Oakley",
          group: "Luxottica",
          rx: {
            OD: { SPH: -2.0, CYL: -0.75, AXIS: 90 },
            OS: { SPH: -1.75, CYL: -0.5, AXIS: 85 },
            PD: 63
          }
        },
        "xreal": {
          brand: "XREAL",
          prescription: {
            right: { sph: -2.0, cyl: -0.75, axis: 90 },
            left: { sph: -1.75, cyl: -0.5, axis: 85 },
            pdMm: 63
          }
        },
        "viture": {
          brand: "VITURE",
          opticalProfile: {
            OD: { sphere: -2.0, cylinder: -0.75, axis: 90 },
            OS: { sphere: -1.75, cylinder: -0.5, axis: 85 },
            PD: 63
          }
        },
        "rokid": {
          brand: "Rokid",
          glassesRx: {
            right: { sphere: -2.0, cylinder: -0.75, axis: 90 },
            left: { sphere: -1.75, cylinder: -0.5, axis: 85 },
            pupillary_distance: 63
          }
        },
        "even-realities": {
          brand: "Even Realities",
          rx: {
            od: { sph: -2.0, cyl: -0.75, ax: 90 },
            os: { sph: -1.75, cyl: -0.5, ax: 85 },
            pd: 63
          }
        },
        "zenni": {
          lab: "Zenni",
          eyes: {
            R: { sphere: -2.0, cylinder: -0.75, axis: 90 },
            L: { sphere: -1.75, cylinder: -0.5, axis: 85 }
          },
          pd: { distance: 63, near: 60 }
        },
        "generic": {
          OD: { sphere: -2.0, cylinder: -0.75, axis: 90 },
          OS: { sphere: -1.75, cylinder: -0.5, axis: 85 },
          PD: 63
        }
      };

      function detectVendor(obj, text, hint) {
        if (hint && hint !== "auto") return hint;
        var blob = (text || "") + " " + JSON.stringify(obj || {}).toLowerCase();
        if (/warby/.test(blob) || (obj && obj.prescription && obj.prescription.rightEye)) return "warby-parker";
        if (/meta|ray-?ban|rayban/.test(blob) || (obj && obj.lensPrescription)) return "meta-rayban";
        if (/oakley|luxottica/.test(blob)) return "oakley";
        if (/xreal/.test(blob)) return "xreal";
        if (/viture/.test(blob) || (obj && obj.opticalProfile)) return "viture";
        if (/rokid/.test(blob) || (obj && obj.glassesRx)) return "rokid";
        if (/even\s*realit/.test(blob)) return "even-realities";
        if (/zenni|eyebuydirect|glassesusa/.test(blob)) return "zenni";
        if (obj && obj.format === "memory-glass-rx-v1") return "memory-glass";
        return "generic";
      }

      function parseFromObject(obj, vendorHint) {
        if (!obj || typeof obj !== "object") return null;
        var vendor = detectVendor(obj, "", vendorHint);
        var root = obj;
        /* unwrap common containers */
        if (obj.prescription && typeof obj.prescription === "object") root = obj.prescription;
        else if (obj.lensPrescription) root = obj.lensPrescription;
        else if (obj.opticalProfile) root = obj.opticalProfile;
        else if (obj.glassesRx) root = obj.glassesRx;
        else if (obj.rx && typeof obj.rx === "object") root = obj.rx;
        else if (obj.data && typeof obj.data === "object") root = obj.data;

        var od = null, os = null, pd = null, pdNear = null;

        /* Memory Glass native */
        if (obj.format === "memory-glass-rx-v1" || obj.sphOD != null || obj.sphOS != null) {
          return normalizeRx({
            sphOD: toD(obj.sphOD), sphOS: toD(obj.sphOS),
            cylOD: toD(obj.cylOD), cylOS: toD(obj.cylOS),
            axOD: toAxis(obj.axOD), axOS: toAxis(obj.axOS),
            pd: toD(obj.pd), pdNear: toD(obj.pdNear),
            vendor: vendor
          }, vendor);
        }

        /* Warby: rightEye / leftEye */
        od = eyeFrom(pick(root, ["rightEye", "right_eye", "RightEye", "od", "OD", "R", "right", "RE"]) || {});
        os = eyeFrom(pick(root, ["leftEye", "left_eye", "LeftEye", "os", "OS", "L", "left", "LE"]) || {});

        /* nested eyes: { eyes: { R: {}, L: {} } } */
        if ((od.sph == null && os.sph == null) && root.eyes) {
          od = eyeFrom(pick(root.eyes, ["R", "OD", "right", "rightEye"]) || {});
          os = eyeFrom(pick(root.eyes, ["L", "OS", "left", "leftEye"]) || {});
        }

        /* flat OD/OS keys on root */
        if (od.sph == null && root.OD) od = eyeFrom(root.OD);
        if (os.sph == null && root.OS) os = eyeFrom(root.OS);

        pd = toD(pick(root, [
          "pd", "PD", "pupillaryDistance", "pupillary_distance", "pdMm", "pd_mm",
          "distancePd", "binocularPd", "pdDistance"
        ]));
        if (pd == null) pd = toD(pick(obj, [
          "pd", "PD", "pupillaryDistance", "pupillary_distance", "pdMm"
        ]));
        pdNear = toD(pick(root, [
          "nearPd", "nearPD", "near_pd", "nearPupillaryDistance", "pdNear", "pd_near"
        ]));
        if (pdNear == null && root.pd && typeof root.pd === "object") {
          pd = toD(pick(root.pd, ["distance", "far", "binocular", "pd"])) || pd;
          pdNear = toD(pick(root.pd, ["near", "close"]));
        }

        if (od.sph == null && os.sph == null && pd == null) return null;
        return normalizeRx({
          sphOD: od.sph, sphOS: os.sph,
          cylOD: od.cyl, cylOS: os.cyl,
          axOD: od.ax, axOS: os.ax,
          pd: pd, pdNear: pdNear,
          vendor: vendor
        }, vendor);
      }

      function parseCsv(text) {
        var lines = text.replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); });
        if (lines.length < 2) return null;
        var headers = lines[0].split(/[,;\t]/).map(function (h) { return h.trim().toLowerCase().replace(/[\"']/g, ""); });
        function col() {
          for (var a = 0; a < arguments.length; a++) {
            var i = headers.indexOf(arguments[a]);
            if (i >= 0) return i;
          }
          return -1;
        }
        var iEye = col("eye", "side", "od/os");
        var iSph = col("sph", "sphere", "spherical");
        var iCyl = col("cyl", "cylinder", "cylindrical");
        var iAx = col("axis", "ax");
        var iPd = col("pd", "pupillarydistance", "pupillary_distance");
        var r = { sphOD: null, sphOS: null, cylOD: 0, cylOS: 0, axOD: 90, axOS: 90, pd: 63, pdNear: null, vendor: "generic" };
        for (var li = 1; li < lines.length; li++) {
          var cells = lines[li].split(/[,;\t]/).map(function (c) { return c.trim().replace(/^["']|["']$/g, ""); });
          var eye = (iEye >= 0 ? cells[iEye] : "").toUpperCase();
          var sph = iSph >= 0 ? toD(cells[iSph]) : null;
          var cyl = iCyl >= 0 ? toD(cells[iCyl]) : 0;
          var ax = iAx >= 0 ? toAxis(cells[iAx]) : 90;
          if (iPd >= 0 && toD(cells[iPd]) != null) r.pd = toD(cells[iPd]);
          if (/OD|RIGHT|R\b|RE/.test(eye) || (iEye < 0 && li === 1)) {
            r.sphOD = sph; r.cylOD = cyl; r.axOD = ax != null ? ax : 90;
          } else if (/OS|LEFT|L\b|LE/.test(eye) || (iEye < 0 && li === 2)) {
            r.sphOS = sph; r.cylOS = cyl; r.axOS = ax != null ? ax : 90;
          }
        }
        if (r.sphOD == null && r.sphOS == null) return null;
        return normalizeRx(r, "generic");
      }

      function parsePlainText(text) {
        var t = text.replace(/\r/g, "\n");
        var r = { sphOD: null, sphOS: null, cylOD: 0, cylOS: 0, axOD: 90, axOS: 90, pd: 63, pdNear: null, vendor: "generic" };
        /* OD -2.00 -0.75 x 90  or  OD SPH -2.00 CYL -0.75 AXIS 90 */
        function parseEyeLine(label, line) {
          var m = line.match(new RegExp(
            label + "[^\\d+\\-]*([+\\-]?\\d+(?:\\.\\d+)?)\\s*([+\\-]?\\d+(?:\\.\\d+)?)?\\s*[x×@]?\\s*(\\d{1,3})?",
            "i"
          ));
          if (!m) {
            m = line.match(new RegExp(
              label + ".*?SPH(?:ERE)?\\s*([+\\-]?\\d+(?:\\.\\d+)?).*?CYL(?:INDER)?\\s*([+\\-]?\\d+(?:\\.\\d+)?).*?AXIS\\s*(\\d{1,3})",
              "i"
            ));
          }
          if (!m) return null;
          return { sph: toD(m[1]), cyl: toD(m[2]) != null ? toD(m[2]) : 0, ax: toAxis(m[3]) != null ? toAxis(m[3]) : 90 };
        }
        var lines = t.split("\n");
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          var od = parseEyeLine("OD|RIGHT|R\\b", line);
          if (od && /OD|RIGHT|\bR\b/i.test(line)) {
            r.sphOD = od.sph; r.cylOD = od.cyl; r.axOD = od.ax;
          }
          var os = parseEyeLine("OS|LEFT|L\\b", line);
          if (os && /OS|LEFT|\bL\b/i.test(line)) {
            r.sphOS = os.sph; r.cylOS = os.cyl; r.axOS = os.ax;
          }
          var pdm = line.match(/\bPD\b[^0-9]{0,12}(\d{2}(?:\.\d+)?)/i);
          if (pdm) r.pd = toD(pdm[1]);
          var npd = line.match(/near\s*PD[^0-9]{0,12}(\d{2}(?:\.\d+)?)/i);
          if (npd) r.pdNear = toD(npd[1]);
        }
        /* single-line compact: OD:-2.00/-0.75x90 OS:-1.75/-0.50x85 PD:63 */
        if (r.sphOD == null) {
          var compact = t.match(/OD\s*[:=]?\s*([+\-]?\d+(?:\.\d+)?)(?:\s*\/\s*([+\-]?\d+(?:\.\d+)?))?(?:\s*[x×]\s*(\d{1,3}))?/i);
          if (compact) {
            r.sphOD = toD(compact[1]);
            r.cylOD = toD(compact[2]) != null ? toD(compact[2]) : 0;
            r.axOD = toAxis(compact[3]) != null ? toAxis(compact[3]) : 90;
          }
        }
        if (r.sphOS == null) {
          var compactL = t.match(/OS\s*[:=]?\s*([+\-]?\d+(?:\.\d+)?)(?:\s*\/\s*([+\-]?\d+(?:\.\d+)?))?(?:\s*[x×]\s*(\d{1,3}))?/i);
          if (compactL) {
            r.sphOS = toD(compactL[1]);
            r.cylOS = toD(compactL[2]) != null ? toD(compactL[2]) : 0;
            r.axOS = toAxis(compactL[3]) != null ? toAxis(compactL[3]) : 90;
          }
        }
        if (r.sphOD == null && r.sphOS == null) return null;
        return normalizeRx(r, detectVendor(null, t, "auto"));
      }

      function parseRxFile(text, name, vendorHint) {
        var lower = (name || "").toLowerCase();
        var trimmed = (text || "").replace(/^\uFEFF/, "").trim();
        if (!trimmed) return { error: "Empty file" };
        /* JSON */
        if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[" || /\.json$/i.test(lower)) {
          try {
            var obj = JSON.parse(trimmed);
            if (Array.isArray(obj)) obj = obj[0];
            var rxJ = parseFromObject(obj, vendorHint);
            if (rxJ) return { rx: rxJ, format: "json", vendor: rxJ.vendor };
            return { error: "JSON recognized but no OD/OS/PD fields found" };
          } catch (e) {
            return { error: "Invalid JSON: " + (e.message || e) };
          }
        }
        /* CSV */
        if (/\.csv$/i.test(lower) || (trimmed.indexOf(",") >= 0 && /sph|sphere|od|eye/i.test(trimmed.split("\n")[0] || ""))) {
          var rxC = parseCsv(trimmed);
          if (rxC) return { rx: rxC, format: "csv", vendor: rxC.vendor };
        }
        /* plain / .rx / xml-ish text */
        var rxT = parsePlainText(trimmed);
        if (rxT) return { rx: rxT, format: "text", vendor: rxT.vendor };
        /* try JSON again after stripping wrappers */
        var brace = trimmed.indexOf("{");
        if (brace >= 0) {
          try {
            var obj2 = JSON.parse(trimmed.slice(brace));
            var rx2 = parseFromObject(obj2, vendorHint);
            if (rx2) return { rx: rx2, format: "json-embedded", vendor: rx2.vendor };
          } catch (e2) {}
        }
        return { error: "Could not parse Rx — try Memory Glass / Warby / Meta / Oakley JSON, CSV, or OD/OS text" };
      }

      function importFile(file) {
        if (!file) return;
        var vendorHint = (document.getElementById("mg-rx-vendor") || {}).value || "auto";
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var text = String(reader.result || "");
            var result = parseRxFile(text, file.name, vendorHint);
            if (result.error) {
              setImportStatus("Import failed · " + result.error);
              setCalibMsg("Rx import failed · " + result.error);
              return;
            }
            fillFormFromRx(result.rx);
            saveRx(result.rx);
            if (wrap) wrap.classList.add("is-open");
            if (tog) tog.setAttribute("aria-expanded", "true");
            applyRx();
            setImportStatus(
              "Imported " + (result.vendor || "generic") + " (" + (result.format || "file") + ") · " + file.name
            );
          } catch (e) {
            setImportStatus("Import error · " + (e.message || e));
          }
        };
        reader.onerror = function () {
          setImportStatus("Could not read file");
        };
        reader.readAsText(file);
      }

      var fileIn = document.getElementById("mg-rx-file");
      if (fileIn) {
        fileIn.addEventListener("change", function () {
          var f = fileIn.files && fileIn.files[0];
          if (f) importFile(f);
          fileIn.value = "";
        });
      }
      var sampleBtn = document.getElementById("mg-rx-sample");
      if (sampleBtn) {
        sampleBtn.addEventListener("click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          var brand = (document.getElementById("mg-rx-vendor") || {}).value || "memory-glass";
          if (brand === "auto") brand = "memory-glass";
          var sample = RX_SAMPLES[brand] || RX_SAMPLES["generic"];
          var blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "mg-rx-sample-" + brand + ".json";
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          setImportStatus("Downloaded sample · " + brand + " · edit & Import");
        });
      }
      /* drag-drop onto Rx panel */
      if (wrap) {
        wrap.addEventListener("dragover", function (e) {
          e.preventDefault();
          e.stopPropagation();
        });
        wrap.addEventListener("drop", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) importFile(f);
        });
      }
    })();

    function toggleBtn(id, key, cls) {
      var b = document.getElementById(id);
      if (!b) return;
      b.addEventListener("click", function (ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        ctrl[key] = !ctrl[key];
        b.classList.toggle("on", ctrl[key]);
        if (cls) rootEl.classList.toggle(cls, ctrl[key]);
        if (key === "mirror") {
          document.getElementById("mg-ana-stack").classList.toggle("mg-ana-mirror", ctrl.mirror);
        }
        if (key === "pageAxis") {
          rootEl.classList.toggle("mg-axis-on", ctrl.pageAxis);
          setCalibMsg(ctrl.pageAxis
            ? "Page axis ON — head lock drives lean/tilt (off in YT theater)"
            : "Page axis OFF — overlays only");
        }
        if (key === "camPip") {
          var pip = document.getElementById("mg-cam-pip");
          if (pip) pip.classList.toggle("is-on", ctrl.camPip && ctrl.camTrack);
        }
        if (key === "handTrack") {
          setCalibMsg(ctrl.handTrack
            ? "Expand hands ON · Ender/Ash-Thorp rings · pinch select · swipe coverflow"
            : "Hands OFF");
          rootEl.classList.toggle("mg-hands-on", !!ctrl.handTrack);
          if (!ctrl.handTrack) {
            lastHands = [];
            rootEl.classList.remove("mg-occ-on", "mg-hands-on");
            rootEl.style.setProperty("--mg-cf-expand", "1");
            var oc = document.getElementById("mg-occ");
            if (oc) { var ox = oc.getContext("2d"); if (ox) ox.clearRect(0, 0, oc.width, oc.height); }
          }
        }
        if (key === "occlude") {
          rootEl.classList.toggle("mg-occ-on", ctrl.occlude && lastHands && lastHands.length > 0);
          if (!ctrl.occlude) {
            var oc2 = document.getElementById("mg-occ");
            if (oc2) { var ox2 = oc2.getContext("2d"); if (ox2) ox2.clearRect(0, 0, oc2.width, oc2.height); }
          }
          setCalibMsg(ctrl.occlude ? "Occlude ON · hand silhouettes over page" : "Occlude OFF");
        }
        if (key === "lidar") {
          rootEl.classList.toggle("mg-lidar-on", ctrl.lidar);
          if (!ctrl.lidar) {
            var lc = document.getElementById("mg-lidar");
            if (lc) { var lx = lc.getContext("2d"); if (lx) lx.clearRect(0, 0, lc.width, lc.height); }
          }
          setCalibMsg(ctrl.lidar ? "Lidar/GSplat ON · person depth field" : "Lidar/GSplat OFF");
        }
        if (key === "camTrack") {
          window.LabViewRay.source = ctrl.camTrack ? "camera" : "pointer";
          if (ctrl.camTrack) {
            /* Auto-link page axis so track actually drives the scene */
            if (!ctrl.pageAxis) {
              ctrl.pageAxis = true;
              var ab = document.getElementById("mg-axis-toggle");
              if (ab) ab.classList.add("on");
              rootEl.classList.add("mg-axis-on");
            }
            setCalibMsg("Cam track + page axis · face window · auto HEAD LOCK");
            startCameraTrack();
          } else {
            stopCameraTrack();
            setCalibMsg("Pointer viewRay · enable Cam track for head lock");
            var pipOff = document.getElementById("mg-cam-pip");
            if (pipOff) pipOff.classList.remove("is-on");
          }
        }
      });
    }
    toggleBtn("mg-ana-toggle", "anaOn", "mg-ana-on");
    toggleBtn("mg-mirror-toggle", "mirror", null);
    toggleBtn("mg-focus-toggle", "hoverFocus", "mg-focus-on");
    toggleBtn("mg-zoom-toggle", "focalZoom", "mg-focal-zoom");
    toggleBtn("mg-track-toggle", "camTrack", null);
    toggleBtn("mg-axis-toggle", "pageAxis", "mg-axis-on");
    toggleBtn("mg-hand-toggle", "handTrack", null);
    toggleBtn("mg-occ-toggle", "occlude", null);
    toggleBtn("mg-lidar-toggle", "lidar", null);
    toggleBtn("mg-pip-toggle", "camPip", null);
    try {
      var ft = document.getElementById("mg-focus-toggle");
      var zt = document.getElementById("mg-zoom-toggle");
      if (ft) ft.classList.add("on");
      if (zt) zt.classList.add("on");
      rootEl.classList.add("mg-focus-on");
      rootEl.classList.add("mg-focal-zoom");
    } catch (eFocus) {}

    function setToggleUi(id, on) {
      var b = document.getElementById(id);
      if (b) b.classList.toggle("on", !!on);
    }
    function ensureCamTrack(on) {
      if (!!ctrl.camTrack === !!on) {
        if (on) startCameraTrack();
        return;
      }
      ctrl.camTrack = !!on;
      setToggleUi("mg-track-toggle", on);
      window.LabViewRay.source = on ? "camera" : "pointer";
      if (on) startCameraTrack();
      else stopCameraTrack();
    }
    function ensurePageAxis(on) {
      ctrl.pageAxis = !!on;
      setToggleUi("mg-axis-toggle", on);
      rootEl.classList.toggle("mg-axis-on", !!on);
    }
    function ensureHands(on) {
      ctrl.handTrack = !!on;
      setToggleUi("mg-hand-toggle", on);
      rootEl.classList.toggle("mg-hands-on", !!on);
      if (!on) {
        lastHands = [];
        rootEl.classList.remove("mg-hands-on", "mg-occ-on");
        rootEl.style.setProperty("--mg-cf-expand", "1");
        try {
          var ocH = document.getElementById("mg-occ");
          if (ocH) { var oxH = ocH.getContext("2d"); if (oxH) oxH.clearRect(0, 0, ocH.width, ocH.height); }
        } catch (eH) {}
      }
    }
    function ensureLidar(on) {
      ctrl.lidar = !!on;
      setToggleUi("mg-lidar-toggle", on);
      rootEl.classList.toggle("mg-lidar-on", !!on);
    }
    function ensureOcclude(on) {
      ctrl.occlude = !!on;
      setToggleUi("mg-occ-toggle", on);
    }
    /**
     * Three quick site modes:
     *  page   — normal reading, pointer only, no cam/cinema
     *  cinema — theater dim + see-through glass + mouse tracking
     *  depth  — full face/hand/lidar + glasses/no-glasses stack
     */
    window.__mgApplyViewMode = function (mode) {
      mode = mode || "page";
      rootEl.classList.remove("mg-xr-on", "mg-mode-page", "mg-mode-cinema", "mg-mode-depth");
      rootEl.classList.add("mg-mode-" + mode);

      if (mode === "page") {
        if (typeof window.__mgSetCinema === "function") window.__mgSetCinema(false);
        ensureCamTrack(false);
        ensurePageAxis(false);
        ensureHands(false);
        ensureLidar(false);
        ensureOcclude(false);
        ctrl.camPip = false;
        setToggleUi("mg-pip-toggle", false);
        ctrl.focalZoom = false;
        ctrl.hoverFocus = false;
        ctrl.anaOn = false;
        setToggleUi("mg-zoom-toggle", false);
        setToggleUi("mg-focus-toggle", false);
        setToggleUi("mg-ana-toggle", false);
        rootEl.classList.remove("mg-focal-zoom", "mg-focus-on", "mg-ana-on", "mg-no-glasses", "mg-axis-on", "mg-drop-rim");
        window.LabViewRay.source = "pointer";
        setSlider("mg-c-drop", 88);
        setSlider("mg-c-lf", 12);
        setSlider("mg-c-glow", 35);
        setCalibMsg("PAGE · glass aperture · Drop/Glow = see-through");
        return;
      }

      if (mode === "cinema") {
        /* Theater + lighter see-through + mouse ray (no face cam required) */
        ensureCamTrack(false);
        ensurePageAxis(false);
        ensureHands(false);
        ensureLidar(false);
        ensureOcclude(false);
        ctrl.camPip = false;
        setToggleUi("mg-pip-toggle", false);
        ctrl.focalZoom = true;
        ctrl.hoverFocus = true;
        ctrl.anaOn = false;
        setToggleUi("mg-zoom-toggle", true);
        setToggleUi("mg-focus-toggle", true);
        setToggleUi("mg-ana-toggle", false);
        rootEl.classList.add("mg-focal-zoom", "mg-focus-on");
        rootEl.classList.remove("mg-ana-on", "mg-axis-on", "mg-no-glasses", "mg-drop-rim");
        window.LabViewRay.source = "pointer";
        setSlider("mg-c-drop", 72);
        setSlider("mg-c-lf", 35);
        setSlider("mg-c-glow", 55);
        setSlider("mg-c-follow", 38);
        if (typeof window.__mgSetCinema === "function") window.__mgSetCinema(true);
        setCalibMsg("CINEMA · more glass · Drop/Glow live");
        return;
      }

      if (mode === "depth") {
        if (typeof window.__mgSetCinema === "function") window.__mgSetCinema(false);
        rootEl.classList.add("mg-xr-on");
        applyEye("calibrate");
        ensureCamTrack(true);
        ensurePageAxis(true);
        /* H1 thrash guard: main hands OPT-IN (toggle). Inspect owns hands via still-pipe. */
        ensureHands(false);
        ensureLidar(false);
        ensureOcclude(false);
        ctrl.camPip = true;
        ctrl.focalZoom = true;
        ctrl.hoverFocus = true;
        setToggleUi("mg-pip-toggle", true);
        setToggleUi("mg-zoom-toggle", true);
        setToggleUi("mg-focus-toggle", true);
        rootEl.classList.add("mg-focal-zoom", "mg-focus-on", "mg-no-glasses", "mg-axis-on");
        setSlider("mg-c-lean", 70);
        setSlider("mg-c-tilt", 62);
        setSlider("mg-c-gain", 120);
        setSlider("mg-c-follow", 46);
        setSlider("mg-c-lf", 55);
        setSlider("mg-c-ana", 28);
        setSlider("mg-c-drop", 82);
        setSlider("mg-c-glow", 50);
        setCalibMsg("DEPTH · glass + face lock · Drop/Glow live");
        return;
      }

      /* legacy aliases */
      if (mode === "track" || mode === "xr" || mode === "noglasses") {
        window.__mgApplyViewMode("depth");
        return;
      }
    };

    var recalibBtn = document.getElementById("mg-recalib");
    if (recalibBtn) {
      recalibBtn.addEventListener("click", function (ev) {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        window.LabViewRay.recalibrate();
        tx = 0; ty = 0; tz = 0;
        poseSmooth = { yaw: 0, pitch: 0, roll: 0, z: 0 };
        restFaceScale = calib.faceScale || restFaceScale;
        setCalibMsg("Recalibrated — yaw/pitch/roll/z zero · face scale locked");
        recalibBtn.classList.add("on");
        setTimeout(function () { recalibBtn.classList.remove("on"); }, 600);
      });
    }

    /*
     * Live cam PIP (bottom-right) + 6DOF head track.
     * Engine preference (Rhizomatiks / Daito-style face mesh lineage → web):
     *   1) MediaPipe Face Mesh (468 pts + relative z) — daito.ws / face-lab era AAM→mesh
     *   2) FaceDetector landmarks
     *   3) Skin centroid fallback
     * Depth: face scale + mesh z → LabViewRay.z (forward/back)
     */
    var camTimer = 0;
    var camStream = null;
    var camVideo = null;
    var faceDetector = null;
    var mpFaceMesh = null;
    var mpReady = false;
    var mpLoading = false;
    var autoCalibFrames = 0;
    var lastFaceAxis = null;
    var poseSmooth = { yaw: 0, pitch: 0, roll: 0, z: 0 };
    var restFaceScale = 0;
    try {
      if (typeof FaceDetector === "function") {
        faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      }
    } catch (e) { faceDetector = null; }

    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[src="' + src + '"]');
        if (existing) {
          if (existing.getAttribute("data-loaded") === "1") resolve();
          else existing.addEventListener("load", function () { resolve(); });
          return;
        }
        var s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = function () { s.setAttribute("data-loaded", "1"); resolve(); };
        s.onerror = function () { reject(new Error("load fail " + src)); };
        (document.head || document.documentElement).appendChild(s);
      });
    }

    function ensureMediaPipeMesh(cb) {
      if (mpReady && mpFaceMesh) { cb(null, mpFaceMesh); return; }
      if (mpLoading) {
        var n = 0;
        var t = setInterval(function () {
          n++;
          if (mpReady && mpFaceMesh) { clearInterval(t); cb(null, mpFaceMesh); }
          else if (n > 100) { clearInterval(t); cb(new Error("mp timeout")); }
        }, 50);
        return;
      }
      mpLoading = true;
      setCalibMsg("Loading face mesh + hands (MediaPipe)…");
      var faceBase = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/";
      var handBase = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/";
      loadScript(faceBase + "face_mesh.js").then(function () {
        if (typeof FaceMesh !== "function") throw new Error("FaceMesh global missing");
        var mesh = new FaceMesh({
          locateFile: function (file) { return faceBase + file; }
        });
        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        mesh.onResults(function (results) {
          window.__mgMpLastResults = results;
          lastMpFaceLm = results && results.multiFaceLandmarks
            ? results.multiFaceLandmarks[0] : null;
          /* Immediate apply when results land — no frame lag */
          if (ctrl.camTrack && camVideo && lastMpFaceLm) {
            applyMeshFrame(lastMpFaceLm, lastMpHandsLm);
          }
        });
        mpFaceMesh = mesh;
        mpReady = true;
        mpLoading = false;
        setCalibMsg("Face Mesh ready · loading hands…");
        cb(null, mesh);
        /* Hands load in parallel after face is up */
        if (!mpHandsLoading && !mpHandsReady) {
          mpHandsLoading = true;
          loadScript(handBase + "hands.js").then(function () {
            if (typeof Hands !== "function") throw new Error("Hands missing");
            var hands = new Hands({
              locateFile: function (file) { return handBase + file; }
            });
            hands.setOptions({
              maxNumHands: 2,
              modelComplexity: 1,
              minDetectionConfidence: 0.5,
              minTrackingConfidence: 0.5
            });
            hands.onResults(function (results) {
              lastMpHandsLm = (results && results.multiHandLandmarks) || null;
              if (ctrl.camTrack && camVideo && lastMpFaceLm) {
                applyMeshFrame(lastMpFaceLm, lastMpHandsLm);
              } else if (ctrl.camTrack && lastMpHandsLm) {
                lastHands = lastMpHandsLm;
                if (ctrl.handTrack) drawHandExpansion(lastHands, 640, 480);
              }
            });
            mpHands = hands;
            mpHandsReady = true;
            mpHandsLoading = false;
            setCalibMsg("Mesh + hands ready · head lock · occlude · lidar");
          }).catch(function () {
            mpHandsLoading = false;
            setCalibMsg("Face Mesh only · hands CDN offline");
          });
        }
      }).catch(function (err) {
        mpLoading = false;
        setCalibMsg("MediaPipe unavailable · FaceDetector fallback · " + (err && err.message ? err.message : "err"));
        cb(err);
      });
    }

    function applyMeshFrame(lm, handsLm) {
      if (!camVideo || !lm) return;
      var vw = camVideo.videoWidth || 640;
      var vh = camVideo.videoHeight || 480;
      var axis = axisFromMediaPipe(lm, vw, vh);
      lastFaceAxis = axis;
      var pose = headPoseFromAxis(axis);
      var conf = Math.min(1, (axis.box.width * axis.box.height) / (vw * vh * 0.08));
      var hands = (ctrl.handTrack && handsLm) ? handsLm : [];
      lastHands = hands;
      var person = null;
      if (ctrl.lidar) {
        person = buildPersonCloud(lm, hands, vw, vh, axis, pose);
        lastPersonCloud = person;
      }
      pushHeadRay(pose, conf, axis, { hands: hands, person: person });
      if (!window.__mgEyeAuto && conf > 0.4) {
        window.__mgEyeAuto = true;
        var faceFrac = (axis.box.width * axis.box.height) / (vw * vh);
        var saved = null;
        try { saved = localStorage.getItem("mg.eye"); } catch (eS) {}
        if (!saved) {
          if (faceFrac < 0.08) {
            applyEye("calibrate");
            setSlider("mg-c-zoom", 7);
            setSlider("mg-c-sharp", 70);
          } else if (faceFrac >= 0.14) {
            applyEye("human");
          }
        }
      }
    }

    function stopCameraTrack() {
      if (camTimer) { clearInterval(camTimer); camTimer = 0; }
      if (trackRaf) { cancelAnimationFrame(trackRaf); trackRaf = 0; }
      if (camStream) {
        camStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        camStream = null;
      }
      var vEl = document.getElementById("mg-cam-video");
      if (vEl) { try { vEl.srcObject = null; } catch (e) {} }
      camVideo = null;
      autoCalibFrames = 0;
      lastFaceAxis = null;
      lastGoodPose = null;
      lastHands = [];
      lastPersonCloud = null;
      lastMpFaceLm = null;
      lastMpHandsLm = null;
      poseSmooth = { yaw: 0, pitch: 0, roll: 0, z: 0 };
      var ov = document.getElementById("mg-cam-overlay");
      if (ov) {
        var octx = ov.getContext("2d");
        if (octx) octx.clearRect(0, 0, ov.width, ov.height);
      }
      ["mg-occ", "mg-lidar"].forEach(function (id) {
        var c = document.getElementById(id);
        if (!c) return;
        var cx = c.getContext("2d");
        if (cx) cx.clearRect(0, 0, c.width, c.height);
      });
      rootEl.classList.remove("mg-track-lock", "mg-occ-on", "mg-lidar-on");
      var pip = document.getElementById("mg-cam-pip");
      if (pip) pip.classList.remove("is-on");
    }

    function landmarksFromBox(box, vw, vh) {
      var x = box.x, y = box.y, w = box.width, h = box.height;
      return {
        forehead: { x: x + w * 0.5, y: y + h * 0.12 },
        eyeL: { x: x + w * 0.32, y: y + h * 0.36 },
        eyeR: { x: x + w * 0.68, y: y + h * 0.36 },
        nose: { x: x + w * 0.5, y: y + h * 0.52 },
        chin: { x: x + w * 0.5, y: y + h * 0.92 },
        gaze: { x: x + w * 0.5, y: y + h * 0.36 },
        box: box,
        vw: vw,
        vh: vh
      };
    }

    function landmarksFromFace(face, vw, vh) {
      var box = face.boundingBox;
      var base = landmarksFromBox(box, vw, vh);
      var lm = face.landmarks || [];
      var eyes = [];
      for (var i = 0; i < lm.length; i++) {
        var L = lm[i];
        var t = (L.type || L.locations && "point" || "").toString().toLowerCase();
        var pts = L.locations || L.location || [];
        if (!pts || !pts.length) {
          if (L.x != null) pts = [{ x: L.x, y: L.y }];
        }
        if (!pts || !pts.length) continue;
        var px = 0, py = 0, n = 0;
        for (var j = 0; j < pts.length; j++) {
          if (pts[j].x == null) continue;
          px += pts[j].x; py += pts[j].y; n++;
        }
        if (!n) continue;
        px /= n; py /= n;
        if (t.indexOf("eye") >= 0) eyes.push({ x: px, y: py });
        else if (t.indexOf("nose") >= 0) base.nose = { x: px, y: py };
        else if (t.indexOf("mouth") >= 0) base.chin = { x: px, y: Math.min(vh, py + box.height * 0.18) };
      }
      if (eyes.length >= 2) {
        eyes.sort(function (a, b) { return a.x - b.x; });
        base.eyeL = eyes[0];
        base.eyeR = eyes[eyes.length - 1];
        base.gaze = {
          x: (base.eyeL.x + base.eyeR.x) * 0.5,
          y: (base.eyeL.y + base.eyeR.y) * 0.5
        };
        base.forehead = {
          x: base.gaze.x,
          y: Math.max(0, base.gaze.y - box.height * 0.28)
        };
        if (!base.nose || Math.abs(base.nose.y - base.gaze.y) < 2) {
          base.nose = {
            x: base.gaze.x,
            y: base.gaze.y + box.height * 0.16
          };
        }
      }
      return base;
    }

    /**
     * Head pose 6DOF (selfie cam, pre-mirror image coords).
     * Lock-stable solve: interocular scale + nose/eye geometry (face-lab lineage).
     * Yaw/pitch use IOD units so axis snaps hard when face is tracked.
     */
    function headPoseFromAxis(axis) {
      var eyeL = axis.eyeL, eyeR = axis.eyeR, nose = axis.nose;
      var chin = axis.chin, forehead = axis.forehead, gaze = axis.gaze;
      var box = axis.box;
      var iod = Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y) || 1;
      var eyeMidX = (eyeL.x + eyeR.x) * 0.5;
      var eyeMidY = (eyeL.y + eyeR.y) * 0.5;
      /* Yaw: nose vs eye midline in IOD units (selfie: +x = image right = user left → flip) */
      var yaw = -((nose.x - eyeMidX) / iod) * 2.35;
      /* Pitch: nose below eyes + forehead/chin balance */
      var faceH = Math.max(iod * 1.4, Math.abs(chin.y - forehead.y) || box.height || 1);
      var pitch = ((nose.y - eyeMidY) / faceH) * 2.1
        + ((chin.y - eyeMidY) / faceH) * 0.45
        - ((eyeMidY - forehead.y) / faceH) * 0.35;
      var roll = Math.atan2(eyeR.y - eyeL.y, Math.max(2, eyeR.x - eyeL.x));
      /* Depth: face scale (primary) + mesh z (secondary) */
      var faceScale = iod / Math.max(1, axis.vw || 640);
      var zScale = 0;
      var rest = restFaceScale > 0.01 ? restFaceScale : (calib.faceScale || 0);
      if (rest > 0.01) zScale = (faceScale - rest) / rest;
      var z = zScale * 1.15;
      if (axis.meshZ != null && isFinite(axis.meshZ)) {
        z = z * 0.55 + (-axis.meshZ * 6.5) * 0.45;
      }
      /* Gaze bias (small) for look-direction lock */
      yaw += -((gaze.x - eyeMidX) / iod) * 0.35;
      pitch += ((gaze.y - eyeMidY) / faceH) * 0.2;
      function clamp(v, lim) { return Math.max(-lim, Math.min(lim, v)); }
      return {
        yaw: clamp(yaw, 1.55),
        pitch: clamp(pitch, 1.45),
        roll: clamp(roll, 0.9),
        z: clamp(z, 1.5),
        faceScale: faceScale,
        iod: iod
      };
    }

    /* Adaptive one-euro-ish smooth: snappy when moving, sticky when still → hard lock */
    function smoothHeadPose(pose) {
      function step(key, v, minA, maxA) {
        var prev = poseSmooth[key] || 0;
        var d = Math.abs(v - prev);
        var a = minA + Math.min(1, d * 3.2) * (maxA - minA);
        poseSmooth[key] = prev + (v - prev) * a;
        return poseSmooth[key];
      }
      return {
        yaw: step("yaw", pose.yaw, 0.38, 0.72),
        pitch: step("pitch", pose.pitch, 0.38, 0.72),
        roll: step("roll", pose.roll, 0.32, 0.65),
        z: step("z", pose.z || 0, 0.28, 0.58),
        faceScale: pose.faceScale,
        iod: pose.iod
      };
    }

    /* MediaPipe Face Mesh landmark indices (468) */
    var MP = { noseTip: 1, noseBridge: 6, forehead: 10, chin: 152, eyeLO: 33, eyeLI: 133, eyeRO: 263, eyeRI: 362, cheekL: 234, cheekR: 454 };

    function axisFromMediaPipe(lm, vw, vh) {
      function L(i) {
        var p = lm[i];
        return { x: p.x * vw, y: p.y * vh, z: p.z };
      }
      var eyeL = L(MP.eyeLO);
      var eyeR = L(MP.eyeRO);
      var eyeLI = L(MP.eyeLI);
      var eyeRI = L(MP.eyeRI);
      var gaze = {
        x: (eyeL.x + eyeR.x + eyeLI.x + eyeRI.x) * 0.25,
        y: (eyeL.y + eyeR.y + eyeLI.y + eyeRI.y) * 0.25
      };
      var nose = L(MP.noseBridge);
      var forehead = L(MP.forehead);
      var chin = L(MP.chin);
      var cheekL = L(MP.cheekL);
      var cheekR = L(MP.cheekR);
      var minX = Math.min(cheekL.x, eyeL.x, chin.x);
      var maxX = Math.max(cheekR.x, eyeR.x, chin.x);
      var minY = Math.min(forehead.y, eyeL.y);
      var maxY = Math.max(chin.y, cheekL.y);
      var box = { x: minX, y: minY, width: Math.max(8, maxX - minX), height: Math.max(8, maxY - minY) };
      /* average mesh z near nose (relative depth) */
      var meshZ = (lm[MP.noseBridge].z + lm[MP.noseTip].z + lm[MP.forehead].z) / 3;
      return {
        forehead: forehead,
        eyeL: eyeL,
        eyeR: eyeR,
        nose: nose,
        chin: chin,
        gaze: gaze,
        box: box,
        vw: vw,
        vh: vh,
        meshZ: meshZ,
        engine: "mediapipe"
      };
    }

    function drawFaceAxis(axis, pose) {
      var ov = document.getElementById("mg-cam-overlay");
      if (!ov || !axis) return;
      var ctx = ov.getContext("2d");
      if (!ctx) return;
      var W = ov.width, H = ov.height;
      var sx = W / (axis.vw || 1);
      var sy = H / (axis.vh || 1);
      function P(p) { return { x: p.x * sx, y: p.y * sy }; }
      ctx.clearRect(0, 0, W, H);
      var fh = P(axis.forehead), el = P(axis.eyeL), er = P(axis.eyeR);
      var ns = P(axis.nose), ch = P(axis.chin), gz = P(axis.gaze);
      var boxCx = (axis.box.x + axis.box.width * 0.5) * sx;
      var boxCy = (axis.box.y + axis.box.height * 0.48) * sy;
      if (axis.box) {
        ctx.strokeStyle = "rgba(110,203,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(axis.box.x * sx, axis.box.y * sy, axis.box.width * sx, axis.box.height * sy);
      }
      /* midline forehead → nose → chin (head pivot vertical) */
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(fh.x, fh.y);
      ctx.lineTo(ns.x, ns.y);
      ctx.lineTo(ch.x, ch.y);
      ctx.stroke();
      /* eye line (roll) */
      ctx.strokeStyle = "rgba(110,203,255,0.95)";
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(er.x, er.y);
      ctx.stroke();
      /* look left/right ray from nose (yaw) — mirrored PIP so arrow matches user motion */
      var p = pose || { yaw: 0, pitch: 0, roll: 0 };
      var ray = Math.max(32, axis.box.height * sy * 0.42);
      /* raw image coords (pre mirror): +yaw = subject look left = image right; PIP flips X */
      var yawTipX = ns.x - p.yaw * ray * 0.85;
      var yawTipY = ns.y + p.pitch * ray * 0.15;
      ctx.strokeStyle = "rgba(255,190,100,0.95)";
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.moveTo(ns.x, ns.y);
      ctx.lineTo(yawTipX, yawTipY);
      ctx.stroke();
      /* pitch arrow (up/down from gaze) */
      ctx.strokeStyle = "rgba(180,255,170,0.9)";
      ctx.beginPath();
      ctx.moveTo(gz.x, gz.y);
      ctx.lineTo(gz.x + p.yaw * 8, gz.y + p.pitch * ray * 0.7);
      ctx.stroke();
      /* roll tick on eye line */
      ctx.save();
      ctx.translate(gz.x, gz.y);
      ctx.rotate(p.roll);
      ctx.strokeStyle = "rgba(200,160,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.stroke();
      ctx.restore();
      /* head center crosshair */
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(boxCx - 8, boxCy);
      ctx.lineTo(boxCx + 8, boxCy);
      ctx.moveTo(boxCx, boxCy - 8);
      ctx.lineTo(boxCx, boxCy + 8);
      ctx.stroke();
      function mark(pt, color, r) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r || 3, 0, Math.PI * 2);
        ctx.fill();
      }
      mark(fh, "rgba(255,255,255,0.95)", 3.5);
      mark(el, "rgba(110,203,255,1)", 3);
      mark(er, "rgba(110,203,255,1)", 3);
      mark(ns, "rgba(255,180,120,1)", 3.5);
      mark(ch, "rgba(255,255,255,0.9)", 3);
      mark(gz, "rgba(255,220,140,1)", 2.5);
      ctx.font = "600 9px system-ui,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("F", fh.x + 5, fh.y + 3);
      ctx.fillText("N", ns.x + 5, ns.y + 3);
      ctx.fillText("C", ch.x + 5, ch.y + 3);
      ctx.fillStyle = "rgba(110,203,255,0.9)";
      ctx.fillText("E", el.x - 10, el.y - 4);
      ctx.fillText("E", er.x + 4, er.y - 4);
      /* depth bar (forward/back) */
      var zN = Math.max(-1, Math.min(1, p.z || 0));
      var barW = 40, barH = 4;
      var bx = W - barW - 6, by = 8;
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = zN >= 0 ? "rgba(120,220,160,0.9)" : "rgba(255,160,120,0.9)";
      ctx.fillRect(bx + barW * 0.5, by, (barW * 0.5) * zN, barH);
      if (zN < 0) ctx.fillRect(bx + barW * 0.5 + (barW * 0.5) * zN, by, -(barW * 0.5) * zN, barH);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "650 8px ui-monospace,Menlo,monospace";
      ctx.fillText(
        "y " + p.yaw.toFixed(2) + " p " + p.pitch.toFixed(2) + " r " + p.roll.toFixed(2) + " z " + (p.z || 0).toFixed(2),
        5, H - 5
      );
      ctx.fillText(axis.engine === "mediapipe" ? "mesh" : "box", W - 36, H - 5);
    }

    var lastGoodPose = null;
    var lostFrames = 0;
    var lastHands = [];
    var lastPersonCloud = null;
    var trackRaf = 0;
    var mpHands = null;
    var mpHandsReady = false;
    var mpHandsLoading = false;
    var lastMpFaceLm = null;
    var lastMpHandsLm = null;
    var trackBusy = false;

    function buildPersonCloud(lm, handsLm, vw, vh, axis, pose) {
      /* Sparse face gaussians + torso lidar rays (screen + relative depth) */
      var pts = [];
      var step = 6;
      if (lm && lm.length) {
        for (var i = 0; i < lm.length; i += step) {
          var p = lm[i];
          if (!p) continue;
          pts.push({
            x: p.x, y: p.y,
            z: (p.z != null ? -p.z : 0) + (pose ? pose.z * 0.08 : 0),
            r: 1.6, kind: "face"
          });
        }
      }
      /* Synthetic torso + shoulder fan under chin (body mass for occlusion/lidar) */
      if (axis && axis.chin && axis.box) {
        var cx = (axis.box.x + axis.box.width * 0.5) / vw;
        var cy = axis.chin.y / vh;
        var bw = (axis.box.width / vw) * 1.35;
        var faceD = pose ? pose.z : 0;
        for (var row = 0; row < 10; row++) {
          for (var col = 0; col < 8; col++) {
            var u = (col / 7) - 0.5;
            var v = row / 9;
            var flare = 1 + v * 0.55;
            pts.push({
              x: cx + u * bw * flare,
              y: cy + v * 0.42,
              z: faceD * 0.12 + v * 0.08,
              r: 2.2 - v * 0.6,
              kind: "body"
            });
          }
        }
      }
      if (handsLm && handsLm.length) {
        for (var h = 0; h < handsLm.length; h++) {
          var hand = handsLm[h];
          for (var k = 0; k < hand.length; k++) {
            var hp = hand[k];
            pts.push({
              x: hp.x, y: hp.y,
              z: (hp.z != null ? -hp.z * 0.5 : 0.05) + 0.04,
              r: k === 0 || k === 9 ? 3.2 : 1.8,
              kind: "hand"
            });
          }
        }
      }
      return { pts: pts, vw: vw, vh: vh, t: performance.now() };
    }

    function drawPersonLidar(cloud) {
      var c = document.getElementById("mg-lidar");
      if (!c || !ctrl.lidar || !cloud || !cloud.pts) {
        if (c) {
          var cx0 = c.getContext("2d");
          if (cx0) cx0.clearRect(0, 0, c.width, c.height);
        }
        return;
      }
      var ctx = c.getContext("2d");
      if (!ctx) return;
      var W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      /* Soft person mass + gaussian points (Quest-style depth field) */
      var pts = cloud.pts;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        /* Mirror X to match selfie UX */
        var x = (1 - p.x) * W;
        var y = p.y * H;
        var depth = Math.max(0.15, Math.min(1.4, 0.55 + p.z * 1.2));
        var r = (p.r || 2) * (1.1 + depth * 0.5);
        var a = p.kind === "hand" ? 0.55 : (p.kind === "face" ? 0.42 : 0.22);
        if (p.kind === "hand") ctx.fillStyle = "rgba(120,220,255," + a + ")";
        else if (p.kind === "face") ctx.fillStyle = "rgba(255,210,140," + a + ")";
        else ctx.fillStyle = "rgba(160,200,255," + (a * depth) + ")";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /*
     * Expansion hand HUD — Ender's Game / Ash Thorp (DosXMachina · Ghost in the Shell).
     * Wire skeleton + expanding palm rings + pinch nodes; open palm fans coverflow.
     */
    var handGesture = {
      pinch: 1, expand: 0, cx: 0.5, cy: 0.5, swipe: 0, lastCx: 0.5, pinchHold: 0
    };
    function dist2(a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function drawHandExpansion(hands, vw, vh) {
      var c = document.getElementById("mg-occ");
      if (!c) return;
      var ctx = c.getContext("2d");
      if (!ctx) return;
      var W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      var show = ctrl.handTrack && hands && hands.length;
      rootEl.classList.toggle("mg-hands-on", !!show);
      if (!show) {
        rootEl.style.setProperty("--mg-cf-expand", "1");
        return;
      }
      var chains = [
        [0,1,2,3,4], [0,5,6,7,8], [0,9,10,11,12], [0,13,14,15,16], [0,17,18,19,20],
        [5,9,13,17]
      ];
      var tips = [4, 8, 12, 16, 20];
      /* Phone still-pipe wide FOV: boost hand IK around palm (matches hotpipe live-v19) */
      var handRigBoost = (ctrl.handRigScale != null) ? +ctrl.handRigScale : 1.45;
      if (!(handRigBoost > 0)) handRigBoost = 1.45;
      var handTargetSpan = 0.24;
      var maxExpand = 0;
      var primary = null;
      for (var hi = 0; hi < hands.length; hi++) {
        var lm = hands[hi];
        if (!lm || lm.length < 21) continue;
        var palmIds = [0, 5, 9, 13, 17];
        var pcxN = 0, pcyN = 0;
        for (var pi0 = 0; pi0 < palmIds.length; pi0++) {
          pcxN += lm[palmIds[pi0]].x;
          pcyN += lm[palmIds[pi0]].y;
        }
        pcxN /= palmIds.length;
        pcyN /= palmIds.length;
        var spanN = 0;
        for (var ti0 = 0; ti0 < tips.length; ti0++) {
          var tip0 = lm[tips[ti0]];
          spanN += Math.hypot(tip0.x - pcxN, tip0.y - pcyN);
        }
        spanN /= tips.length;
        var autoS = Math.max(1, Math.min(3.4, handTargetSpan / Math.max(spanN, 0.035)));
        var rigS = Math.max(1, Math.min(4.2, autoS * handRigBoost));
        function HP(i) {
          var p = lm[i];
          var nx = pcxN + (p.x - pcxN) * rigS;
          var ny = pcyN + (p.y - pcyN) * rigS;
          if (nx < -0.08) nx = -0.08;
          if (nx > 1.08) nx = 1.08;
          if (ny < -0.08) ny = -0.08;
          if (ny > 1.08) ny = 1.08;
          /* mirror x for selfie-style page overlay */
          return { x: (1 - nx) * W, y: ny * H, nx: 1 - nx, ny: ny };
        }
        var wrist = HP(0);
        var midTip = HP(12);
        var idxTip = HP(8);
        var thumbTip = HP(4);
        var palmPts = [0, 5, 9, 13, 17].map(HP);
        var palmCx = 0, palmCy = 0;
        for (var pi = 0; pi < palmPts.length; pi++) {
          palmCx += palmPts[pi].x; palmCy += palmPts[pi].y;
        }
        palmCx /= palmPts.length; palmCy /= palmPts.length;
        var openSpan = 0;
        for (var ti = 0; ti < tips.length; ti++) {
          openSpan += dist2(wrist, HP(tips[ti]));
        }
        openSpan /= tips.length;
        var expandN = Math.max(0, Math.min(1.8, (openSpan / Math.max(H * 0.14, 1)) - 0.2));
        var pinchD = dist2(thumbTip, idxTip);
        var pinchN = Math.max(0.35, Math.min(1.8, pinchD / Math.max(H * 0.05, 1)));
        if (expandN > maxExpand) maxExpand = expandN;
        if (!primary || hi === 0) {
          primary = {
            x: idxTip.x, y: idxTip.y, nx: idxTip.nx, ny: idxTip.ny,
            pinch: pinchN, expand: expandN, palmX: palmCx, palmY: palmCy, rigS: rigS
          };
        }
        /* Solid occlusion fill (optional Quest-style) */
        if (ctrl.occlude) {
          ctx.beginPath();
          for (var pj = 0; pj < palmPts.length; pj++) {
            if (pj === 0) ctx.moveTo(palmPts[pj].x, palmPts[pj].y);
            else ctx.lineTo(palmPts[pj].x, palmPts[pj].y);
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(6,10,16,0.55)";
          ctx.fill();
        }
        /* Expanding palm rings (Ash Thorp / Ender interface language) */
        var srt = Math.sqrt(rigS);
        var ringMax = (32 + expandN * 100) * srt;
        for (var r = 0; r < 4; r++) {
          var rr = ringMax * (0.35 + r * 0.22);
          ctx.beginPath();
          ctx.arc(palmCx, palmCy, rr, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(120,200,255," + (0.32 - r * 0.05).toFixed(2) + ")";
          ctx.lineWidth = (1.1 + (3 - r) * 0.45) * Math.min(1.9, srt);
          ctx.stroke();
        }
        /* Crosshair at palm */
        ctx.strokeStyle = "rgba(180,230,255,0.45)";
        ctx.lineWidth = 1.2 * srt;
        ctx.beginPath();
        ctx.moveTo(palmCx - 18 * srt, palmCy); ctx.lineTo(palmCx + 18 * srt, palmCy);
        ctx.moveTo(palmCx, palmCy - 18 * srt); ctx.lineTo(palmCx, palmCy + 18 * srt);
        ctx.stroke();
        /* Wire skeleton */
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        var lw = Math.min(3, 1.55 * srt);
        for (var ci = 0; ci < chains.length; ci++) {
          var ch = chains[ci];
          ctx.beginPath();
          for (var j = 0; j < ch.length; j++) {
            var q = HP(ch[j]);
            if (j === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          }
          ctx.strokeStyle = "rgba(140,210,255," + (ci === 5 ? "0.4" : "0.6") + ")";
          ctx.lineWidth = ci === 5 ? lw * 1.4 : lw;
          ctx.stroke();
        }
        /* Joint nodes */
        var jR = Math.max(2.3, 2.1 * srt);
        for (var ji = 0; ji < 21; ji++) {
          var jn = HP(ji);
          ctx.fillStyle = ji === 8 || ji === 4
            ? "rgba(255,255,255,0.95)"
            : "rgba(120,200,255,0.7)";
          ctx.beginPath();
          ctx.arc(jn.x, jn.y, ji === 0 ? jR * 1.5 : jR, 0, Math.PI * 2);
          ctx.fill();
        }
        /* Pinch bond */
        ctx.beginPath();
        ctx.moveTo(thumbTip.x, thumbTip.y);
        ctx.lineTo(idxTip.x, idxTip.y);
        ctx.strokeStyle = pinchN < 0.75
          ? "rgba(255,220,140,0.85)"
          : "rgba(140,200,255,0.25)";
        ctx.lineWidth = pinchN < 0.75 ? 2.2 * srt : 1;
        ctx.stroke();
        /* Fingertip expansion blossoms */
        for (var t = 0; t < tips.length; t++) {
          var tip = HP(tips[t]);
          var tr = (12 + expandN * 16) * srt;
          var grd = ctx.createRadialGradient(tip.x, tip.y, 1, tip.x, tip.y, tr);
          grd.addColorStop(0, "rgba(255,255,255,0.55)");
          grd.addColorStop(0.4, "rgba(100,190,255,0.22)");
          grd.addColorStop(1, "rgba(100,190,255,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, tr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (primary) {
        var swipe = primary.nx - handGesture.lastCx;
        handGesture.swipe = handGesture.swipe * 0.7 + swipe * 0.3;
        handGesture.lastCx = primary.nx;
        handGesture.cx = primary.nx;
        handGesture.cy = primary.ny;
        handGesture.pinch = primary.pinch;
        handGesture.expand = maxExpand;
        rootEl.style.setProperty("--mg-hand-x", (primary.nx * 100).toFixed(2) + "%");
        rootEl.style.setProperty("--mg-hand-y", (primary.ny * 100).toFixed(2) + "%");
        rootEl.style.setProperty("--mg-hand-px", (primary.nx * 100).toFixed(2) + "%");
        rootEl.style.setProperty("--mg-hand-py", (primary.ny * 100).toFixed(2) + "%");
        rootEl.style.setProperty("--mg-hand-pinch", Math.max(0.5, Math.min(1.6, 2.1 - primary.pinch)).toFixed(3));
        /* Open palm expands coverflow stage (Ender battle-room scale language) */
        var expScale = 1 + Math.min(0.35, maxExpand * 0.22);
        rootEl.style.setProperty("--mg-cf-expand", expScale.toFixed(3));
        /* Pinch hold selects / swipes coverflow */
        if (primary.pinch < 0.72) {
          handGesture.pinchHold += 1;
          if (handGesture.pinchHold === 8) {
            try {
              if (typeof window.__mgCfHandSelect === "function") {
                window.__mgCfHandSelect(primary.nx, primary.ny);
              }
            } catch (eHs) {}
          }
        } else {
          handGesture.pinchHold = 0;
        }
        if (Math.abs(handGesture.swipe) > 0.045 && maxExpand > 0.35) {
          try {
            if (typeof window.__mgCfHandSwipe === "function") {
              window.__mgCfHandSwipe(handGesture.swipe > 0 ? -1 : 1);
            }
          } catch (eHw) {}
          handGesture.swipe = 0;
        }
      }
      rootEl.classList.toggle("mg-occ-on", !!(ctrl.occlude && hands.length));
    }
    function drawHandOcclusion(hands, vw, vh) {
      drawHandExpansion(hands, vw, vh);
    }

    function pushHeadRay(pose, conf, axis, extra) {
      var sm = smoothHeadPose(pose);
      if (!restFaceScale && pose.faceScale > 0.02) restFaceScale = pose.faceScale;
      if (!calib.faceScale && pose.faceScale > 0.02) calib.faceScale = pose.faceScale;
      lastGoodPose = sm;
      lostFrames = 0;
      var locked = conf > 0.42 && pose.faceScale > 0.02;
      var nx = 0.5 + sm.yaw * 0.48;
      var ny = 0.46 + sm.pitch * 0.44;
      nx = Math.max(0.04, Math.min(0.96, nx));
      ny = Math.max(0.04, Math.min(0.96, ny));
      var hands = (extra && extra.hands) || lastHands;
      var person = (extra && extra.person) || lastPersonCloud;
      window.LabViewRay.set({
        x: sm.yaw,
        y: sm.pitch,
        z: sm.z,
        roll: sm.roll,
        nx: nx,
        ny: ny,
        source: "camera",
        confidence: conf,
        locked: locked,
        engine: (axis && axis.engine) || "facedetector",
        hands: hands,
        person: person
      });
      rootEl.classList.toggle("mg-track-lock", locked);
      rootEl.classList.toggle("mg-occ-on", !!(ctrl.occlude && hands && hands.length));
      rootEl.classList.toggle("mg-lidar-on", !!(ctrl.lidar && person));
      rootEl.style.setProperty("--mg-head-yaw", sm.yaw.toFixed(3));
      rootEl.style.setProperty("--mg-head-pitch", sm.pitch.toFixed(3));
      rootEl.style.setProperty("--mg-head-roll", sm.roll.toFixed(3));
      rootEl.style.setProperty("--mg-head-z", sm.z.toFixed(3));
      rootEl.style.setProperty("--mg-face-z", (1 + sm.z * 0.35).toFixed(3));
      if (axis) drawFaceAxis(axis, sm);
      if (ctrl.lidar) drawPersonLidar(person);
      /* Always paint expansion hands when tracking hands (not only occlude) */
      if (ctrl.handTrack && hands && hands.length) {
        drawHandExpansion(hands, (axis && axis.vw) || 640, (axis && axis.vh) || 480);
      } else {
        rootEl.classList.remove("mg-hands-on");
        rootEl.style.setProperty("--mg-cf-expand", "1");
        var ocClr = document.getElementById("mg-occ");
        if (ocClr && !ctrl.occlude) {
          var oxc = ocClr.getContext("2d");
          if (oxc) oxc.clearRect(0, 0, ocClr.width, ocClr.height);
        }
      }
      if (!calib.ready && conf > 0.4) {
        autoCalibFrames += 1;
        if (autoCalibFrames >= 12) {
          calib.faceScale = pose.faceScale || restFaceScale || calib.faceScale;
          restFaceScale = calib.faceScale;
          window.LabViewRay.recalibrate();
          setCalibMsg("HEAD LOCK · expand hands · coverflow+PIP above inspect");
        }
      } else if (locked && calib.ready) {
        var lbl = document.getElementById("mg-pip-lbl");
        if (lbl) {
          var he = (typeof handGesture !== "undefined" && handGesture.expand) ? handGesture.expand : 0;
          lbl.textContent = "LOCK · hands×" + he.toFixed(1)
            + " y" + sm.yaw.toFixed(2) + " z" + sm.z.toFixed(2);
        }
      }
    }

    function holdLastHeadPose() {
      lostFrames += 1;
      if (!lastGoodPose || lostFrames > 45) {
        rootEl.classList.remove("mg-track-lock");
        return;
      }
      /* Hold last good pose briefly so axis stays locked through blinks */
      var decay = Math.max(0.35, 1 - lostFrames * 0.015);
      window.LabViewRay.set({
        x: lastGoodPose.yaw * decay,
        y: lastGoodPose.pitch * decay,
        z: lastGoodPose.z * decay,
        roll: lastGoodPose.roll * decay,
        nx: 0.5 + lastGoodPose.yaw * 0.48 * decay,
        ny: 0.46 + lastGoodPose.pitch * 0.44 * decay,
        source: "camera",
        confidence: 0.35 * decay,
        locked: lostFrames < 12,
        engine: "hold"
      });
    }

    function startCameraTrack() {
      if (camTimer) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCalibMsg("No camera API — pointer viewRay only");
        ctrl.camTrack = false;
        var tb = document.getElementById("mg-track-toggle");
        if (tb) tb.classList.remove("on");
        return;
      }
      setCalibMsg("Requesting camera… allow Memory Glass if prompted");
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(JSON.stringify({ op: "request_camera" }));
        }
      } catch (eReq) {}
      var constraints = {
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };
      function onCamOk(stream) {
        camStream = stream;
        var v = document.getElementById("mg-cam-video") || document.createElement("video");
        camVideo = v;
        v.srcObject = stream;
        v.playsInline = true;
        v.muted = true;
        v.setAttribute("playsinline", "");
        v.play().catch(function () {});
        var pip = document.getElementById("mg-cam-pip");
        if (pip) {
          ctrl.camPip = true;
          pip.classList.add("is-on");
          var pt = document.getElementById("mg-pip-toggle");
          if (pt) pt.classList.add("on");
        }
        setCalibMsg("Camera live · head lock + expand hands · PIP");
        try {
          if (window.__mgDevLog) window.__mgDevLog("ok", "getUserMedia stream active", "camera");
        } catch (eL) {}

        var canvas = document.createElement("canvas");
        canvas.width = 320; canvas.height = 240;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });

        function sampleCentroid() {
          if (!camVideo || camVideo.readyState < 2) return;
          ctx.drawImage(camVideo, 0, 0, 320, 240);
          var data = ctx.getImageData(0, 0, 320, 240).data;
          var sx = 0, sy = 0, sw = 0;
          for (var y = 20; y < 220; y += 2) {
            for (var x = 40; x < 280; x += 2) {
              var i = (y * 320 + x) * 4;
              var lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
              var r = data[i], g = data[i + 1], b = data[i + 2];
              if (lum > 55 && lum < 230 && r > g - 10 && r > b && (r - b) > 8) {
                sx += x; sy += y; sw++;
              }
            }
          }
          if (sw > 80) {
            var cx = sx / sw, cy = sy / sw;
            var fakeBox = { x: cx - 60, y: cy - 70, width: 120, height: 150 };
            var axis = landmarksFromBox(fakeBox, 320, 240);
            lastFaceAxis = axis;
            var pose = headPoseFromAxis(axis);
            pushHeadRay(pose, Math.min(1, sw / 2500), axis);
          }
        }

        function sampleFaceDetector() {
          if (!faceDetector) { sampleCentroid(); return; }
          faceDetector.detect(camVideo).then(function (faces) {
            if (!ctrl.camTrack) return;
            if (faces && faces.length) {
              var face = faces[0];
              var box = face.boundingBox;
              var vw = camVideo.videoWidth || 640;
              var vh = camVideo.videoHeight || 480;
              var axis = landmarksFromFace(face, vw, vh);
              axis.engine = "facedetector";
              lastFaceAxis = axis;
              var pose = headPoseFromAxis(axis);
              var conf = Math.min(1, (box.width * box.height) / (vw * vh * 0.12));
              var person = ctrl.lidar ? buildPersonCloud(null, lastHands, vw, vh, axis, pose) : null;
              if (person) lastPersonCloud = person;
              pushHeadRay(pose, conf, axis, { hands: lastHands, person: person });
              if (!window.__mgEyeAuto && conf > 0.4) {
                window.__mgEyeAuto = true;
                var faceFrac = (box.width * box.height) / (vw * vh);
                var saved = null;
                try { saved = localStorage.getItem("mg.eye"); } catch (eS) {}
                if (!saved) {
                  if (faceFrac < 0.08) {
                    applyEye("calibrate");
                    setSlider("mg-c-zoom", 7);
                    setSlider("mg-c-sharp", 70);
                  } else if (faceFrac >= 0.14) {
                    applyEye("human");
                  }
                }
              }
            } else {
              sampleCentroid();
            }
          }).catch(function () { sampleCentroid(); });
        }

        function sampleMediaPipe() {
          if (!mpFaceMesh || !camVideo || trackBusy) {
            if (!mpFaceMesh) sampleFaceDetector();
            return;
          }
          trackBusy = true;
          var jobs = [mpFaceMesh.send({ image: camVideo })];
          if (ctrl.handTrack && mpHandsReady && mpHands) {
            jobs.push(mpHands.send({ image: camVideo }));
          }
          Promise.all(jobs).then(function () {
            trackBusy = false;
            /* Primary path is onResults → applyMeshFrame (zero extra lag).
               If no face this frame, hold lock then fall back. */
            if (!lastMpFaceLm) {
              holdLastHeadPose();
              sampleFaceDetector();
            }
          }).catch(function () {
            trackBusy = false;
            sampleFaceDetector();
          });
        }

        function sampleFace() {
          if (!camVideo || camVideo.readyState < 2) return;
          if (mpReady && mpFaceMesh) sampleMediaPipe();
          else sampleFaceDetector();
        }

        /* rAF pump (~30fps throttle) — faster data path than setInterval */
        var lastSend = 0;
        function trackLoop(now) {
          trackRaf = 0;
          if (!ctrl.camTrack) {
            stopCameraTrack();
            return;
          }
          if (!document.hidden && now - lastSend >= 28) {
            lastSend = now;
            sampleFace();
          }
          trackRaf = requestAnimationFrame(trackLoop);
        }
        trackRaf = requestAnimationFrame(trackLoop);
        camTimer = 1; /* mark active */

        ensureMediaPipeMesh(function (err) {
          if (!err) setCalibMsg("HEAD LOCK · mesh + expand hands · coverflow+PIP");
          else setCalibMsg("FaceDetector 6DOF · mesh CDN offline — depth via face scale");
        });
      }

      function onCamFail(err) {
        var name = (err && err.name) ? err.name : "blocked";
        var detail = (err && err.message) ? err.message : "";
        try {
          if (window.__mgDevLog) {
            window.__mgDevLog("err", "Camera " + name + (detail ? (" · " + detail) : ""), "camera");
          }
        } catch (eD) {}
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
          setCalibMsg("Camera denied — System Settings › Privacy & Security › Camera › Memory Glass → ON, then click Cam track");
          try {
            if (window.ipc && window.ipc.postMessage) {
              window.ipc.postMessage(JSON.stringify({ op: "open_camera_prefs" }));
            }
          } catch (eP) {}
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCalibMsg("No camera found · pointer viewRay");
        } else {
          setCalibMsg("Camera failed — " + name + " · click Cam track to retry");
        }
        ctrl.camTrack = false;
        ctrl.camPip = false;
        var tb = document.getElementById("mg-track-toggle");
        var pt = document.getElementById("mg-pip-toggle");
        if (tb) tb.classList.remove("on");
        if (pt) pt.classList.remove("on");
        window.LabViewRay.source = "pointer";
      }

      /* Prefer ideal constraints; fall back to bare {video:true} */
      navigator.mediaDevices.getUserMedia(constraints).then(onCamOk).catch(function () {
        navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(onCamOk).catch(onCamFail);
      });
    }

    /* Boot PAGE mode — no auto cam/lidar/hands (those thrash the browser).
     * DEPTH mode menu turns tracking on. Inspect still-pipe owns face HUD. */
    try {
      var tr = document.getElementById("mg-track-toggle");
      var pp = document.getElementById("mg-pip-toggle");
      var ax = document.getElementById("mg-axis-toggle");
      var hh = document.getElementById("mg-hand-toggle");
      var oo = document.getElementById("mg-occ-toggle");
      var ll = document.getElementById("mg-lidar-toggle");
      if (tr) tr.classList.remove("on");
      if (pp) pp.classList.remove("on");
      if (ax) { ax.classList.remove("on"); rootEl.classList.remove("mg-axis-on"); }
      if (hh) hh.classList.remove("on");
      if (oo) oo.classList.remove("on");
      if (ll) ll.classList.remove("on");
      rootEl.classList.remove("mg-occ-on", "mg-lidar-on", "mg-hands-on", "mg-track-lock", "mg-xr-on");
      /* do NOT startCameraTrack on boot */
      setCalibMsg("PAGE · stable · face track lives in Inspect (still-pipe)");
    } catch (eBoot) {}

    /* YouTube theater / fullscreen — keep HUD alive, suppress page axis */
    function detectYtMode() {
      var host = "";
      try { host = location.hostname || ""; } catch (e) {}
      var isYt = /youtube\.com$|youtu\.be$|youtube-nocookie\.com$/i.test(host.replace(/^www\./, ""));
      ytState.video = isYt;
      var theater = false;
      var fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (isYt) {
        try {
          var flexy = document.querySelector("ytd-watch-flexy");
          if (flexy) {
            theater = flexy.hasAttribute("theater") || flexy.hasAttribute("fullscreen")
              || flexy.getAttribute("theater") === "" || !!flexy.theater;
          }
          if (!theater) {
            var ptc = document.getElementById("player-theater-container");
            theater = !!(ptc && ptc.childElementCount > 0 && ptc.offsetHeight > 120);
          }
          if (!theater && document.querySelector(".ytp-fullscreen, ytd-watch-flexy[fullscreen]")) {
            theater = true;
          }
        } catch (e) {}
      }
      ytState.theater = theater;
      ytState.fs = fs;
      rootEl.classList.toggle("mg-yt-video", isYt);
      rootEl.classList.toggle("mg-yt-theater", theater);
      rootEl.classList.toggle("mg-yt-fs", fs);
    }
    setInterval(detectYtMode, 2000);
    document.addEventListener("fullscreenchange", detectYtMode, true);
    document.addEventListener("webkitfullscreenchange", detectYtMode, true);
    detectYtMode();

    var tx = 0, ty = 0, tz = 0, fnx = 0.5, fny = 0.46;
    var mx = 0, my = 0, tmx = 0, tmy = 0;
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    window.addEventListener("resize", function () {
      w = window.innerWidth || 1;
      h = window.innerHeight || 1;
    }, { passive: true });
    window.addEventListener("pointermove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (window.LabViewRay.source === "camera" && ctrl.camTrack) return;
      var nx = e.clientX / w;
      var ny = e.clientY / h;
      window.LabViewRay.set({
        x: (nx - 0.5) * 2,
        y: (ny - 0.5) * 2,
        nx: nx,
        ny: ny,
        source: "pointer",
        confidence: 1
      });
    }, { passive: true });

    /* Depth page-axis: freeze body transform while scrolling (kills vertical hop) */
    window.__mgScrolling = false;
    var __mgScrollTimer = 0;
    function __mgMarkScrolling() {
      window.__mgScrolling = true;
      try { rootEl.classList.add("mg-scrolling"); } catch (eS) {}
      if (__mgScrollTimer) clearTimeout(__mgScrollTimer);
      __mgScrollTimer = setTimeout(function () {
        window.__mgScrolling = false;
        try { rootEl.classList.remove("mg-scrolling"); } catch (eS2) {}
      }, 220);
    }
    window.addEventListener("wheel", __mgMarkScrolling, { passive: true, capture: true });
    window.addEventListener("scroll", __mgMarkScrolling, { passive: true, capture: true });
    window.addEventListener("touchmove", __mgMarkScrolling, { passive: true, capture: true });
    document.addEventListener("scroll", __mgMarkScrolling, { passive: true, capture: true });

    var planes = [
      { el: document.getElementById("mg-lf-near"), z: 140 },
      { el: document.getElementById("mg-lf-mid"), z: 420 },
      { el: document.getElementById("mg-lf-far"), z: 900 }
    ];

    function paintAnaEyes(vx, vy, focusZ, lf, ipd) {
      var L = document.getElementById("mg-ana-L");
      var R = document.getElementById("mg-ana-R");
      if (!L || !R || !ctrl.anaOn) return;
      var half = ipd * 0.5 * (0.5 + ctrl.ana);
      function layers(sign) {
        var html = "";
        planes.forEach(function (p) {
          var disparity = ipd * (1 - focusZ / p.z) * lf;
          var sx = -vx * disparity * 1.2 + sign * half * (p.z / 500);
          var sy = -vy * disparity * 0.9;
          html += '<div style="position:absolute;left:50%;top:50%;width:70%;height:70%;margin:-35% 0 0 -35%;'
            + "border-radius:40%;border:1px solid rgba(255,255,255,0.12);"
            + "transform:translate3d(" + sx.toFixed(1) + "px," + sy.toFixed(1) + "px,0) scale("
            + (0.85 + p.z / 3000).toFixed(3) + ");opacity:0.35\"></div>";
        });
        return html;
      }
      L.innerHTML = layers(-1);
      R.innerHTML = layers(1);
    }

    var lastVx = 999, lastVy = 999, lastFx = 999, lastFy = 999, lastVz = 999;
    var opticsPaused = false;
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && opticsPaused) {
        opticsPaused = false;
        requestAnimationFrame(frame);
      }
    });
    function frame() {
      if (document.hidden) {
        opticsPaused = true;
        return;
      }
      opticsPaused = false;
      var ray = window.LabViewRay;
      var conf = ray.confidence || 0;
      var locked = !!ray.locked || (ray.source === "camera" && conf > 0.45);
      /* Harder follow when head is locked — axis snaps to track */
      var fBase = Math.min(0.55, Math.max(0.06, ctrl.follow));
      var f = locked ? Math.min(0.62, fBase * 1.65 + 0.12) : fBase;
      var g = ctrl.gain * (locked ? 1.15 : 1);
      tx += (ray.x * g - tx) * f;
      ty += (ray.y * g - ty) * f;
      tz += ((ray.z || 0) * g - tz) * f;
      fnx += (ray.nx - fnx) * f;
      fny += (ray.ny - fny) * f;
      /* Integrate roll lightly into page lean when locked */
      var tr = (ray.roll || 0) * (locked ? 0.85 : 0.4);
      var vx = tx, vy = ty, vz = tz;

      /* Skip DOM writes when motion is tiny (include depth) */
      var moved = Math.abs(vx - lastVx) > 0.003 || Math.abs(vy - lastVy) > 0.003
        || Math.abs(fnx - lastFx) > 0.003 || Math.abs(fny - lastFy) > 0.003
        || Math.abs(vz - (lastVz || 0)) > 0.004
        || Math.abs(mx - tmx) > 1.5 || Math.abs(my - tmy) > 1.5;
      if (!moved) {
        requestAnimationFrame(frame);
        return;
      }
      lastVx = vx; lastVy = vy; lastFx = fnx; lastFy = fny; lastVz = vz;

      var focusBias = ctrl.hoverFocus ? ((0.5 - fny) * 120) : 0;
      /* closer (vz+) pulls focus nearer */
      var focusZ = 80 + ctrl.focal * 6 + focusBias - vz * 90;
      var lf = ctrl.lf;
      var ipd = ctrl.ipd;

      var mf = Math.min(0.55, Math.max(0.12, f * 2.8));
      if (ctrl.camTrack && ray.source === "camera") {
        var cx = fnx * w;
        var cy = fny * h;
        tmx += (cx - tmx) * mf;
        tmy += (cy - tmy) * mf;
      } else {
        tmx += (mx - tmx) * mf;
        tmy += (my - tmy) * mf;
      }
      rootEl.style.setProperty("--mg-mx", (tmx - 36).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-my", (tmy - 24).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-fx", (tmx - 24).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-fy", (tmy - 24).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-fovea-x", (fnx * 100).toFixed(2) + "%");
      rootEl.style.setProperty("--mg-fovea-y", (fny * 100).toFixed(2) + "%");
      rootEl.style.setProperty("--mg-fovea-core", Math.max(8, ctrl.fovea * 0.38).toFixed(1) + "%");
      rootEl.style.setProperty("--mg-fovea-r", Math.max(18, ctrl.fovea).toFixed(1) + "%");

      var sharpN = Math.max(0, Math.min(1, ctrl.sharp));
      var zoomN = Math.max(0, Math.min(0.14, ctrl.zoom));
      var contrast = 1 + sharpN * 0.18;
      var sat = 1 + sharpN * 0.08;
      rootEl.style.setProperty("--mg-contrast", contrast.toFixed(3));
      rootEl.style.setProperty("--mg-sharp", sat.toFixed(3));
      if (ctrl.focalZoom && zoomN > 0.001 && !rootEl.classList.contains("mg-cinema-on") && !ctrl.pageAxis) {
        var edge = Math.min(1, Math.hypot(fnx - 0.5, fny - 0.46) * 2.2);
        /* lean in when head moves forward (vz+) */
        var scF = 1 + zoomN * (1 - edge * 0.35) + Math.max(0, vz) * 0.06;
        rootEl.style.setProperty("--mg-focal-scale", scF.toFixed(4));
        rootEl.classList.add("mg-focal-zoom");
      } else {
        rootEl.style.setProperty("--mg-focal-scale", "1");
        if (!ctrl.focalZoom) rootEl.classList.remove("mg-focal-zoom");
      }

      if (lf > 0.02) {
        planes.forEach(function (p) {
          if (!p.el) return;
          var z = p.z - vz * 120;
          var disparity = ipd * (1 - focusZ / Math.max(40, z)) * lf;
          var sx = -vx * disparity * 1.4;
          var sy = -vy * disparity * 1.1;
          var defocus = Math.min(1, Math.abs(z - focusZ) / (focusZ + 200));
          var blur = defocus * ctrl.accom * 1.6 * (1 - sharpN * 0.65);
          var sc = 1 + (1 - focusZ / Math.max(40, z)) * 0.04 * lf + vz * 0.03;
          p.el.style.transform =
            "translate3d(calc(-50% + " + sx.toFixed(2) + "px), calc(-50% + " + sy.toFixed(2) +
            "px), " + (-z).toFixed(0) + "px) scale(" + sc.toFixed(4) + ")";
          p.el.style.filter = blur > 0.08 ? ("blur(" + blur.toFixed(2) + "px)") : "none";
          p.el.style.opacity = String(0.22 + (1 - defocus * 0.5) * 0.4 * lf);
        });
        rootEl.style.setProperty("--mg-im-x", (-vx * 36 * lf).toFixed(2) + "px");
        rootEl.style.setProperty("--mg-im-y", (-vy * 26 * lf).toFixed(2) + "px");
        rootEl.style.setProperty("--mg-im-z", (-420 + vz * 140).toFixed(0) + "px");
        rootEl.style.setProperty("--mg-im-ry", (vx * 14 * lf * ctrl.lean).toFixed(3) + "deg");
        rootEl.style.setProperty("--mg-im-rx", (8 + vy * -10 * lf * ctrl.tilt).toFixed(3) + "deg");
      }

      if (ctrl.anaOn) paintAnaEyes(vx, vy, focusZ, lf, ipd);

      var axisLive = ctrl.pageAxis && !ytState.theater && !ytState.fs && !window.__mgScrolling;
      if (axisLive) {
        /* Decouple from weak LF — min 0.78 so track actually moves the page */
        var axisPow = Math.max(0.78, lf) * (locked ? 1.2 : 1);
        var tiltN = Math.max(0.35, ctrl.tilt);
        var leanN = Math.max(0.4, ctrl.lean);
        /* Pitch rotation damped — vertical hop was from py + strong rx during scroll */
        rootEl.style.setProperty("--mg-rx", (-vy * 7 * tiltN * axisPow + tr * 3).toFixed(3) + "deg");
        rootEl.style.setProperty("--mg-ry", (vx * 18 * leanN * axisPow).toFixed(3) + "deg");
        rootEl.style.setProperty("--mg-px", (-vx * 28 * axisPow).toFixed(2) + "px");
        /* Always 0 — body translateY fights scrollTop and causes live vertical hop */
        rootEl.style.setProperty("--mg-py", "0px");
        rootEl.style.setProperty("--mg-pz", (-Math.abs(vx) * 10 * axisPow + vz * 22).toFixed(2) + "px");
        /* Scale only from depth / horizontal lean — not vy (avoids scroll pulse) */
        rootEl.style.setProperty("--mg-sc", (1 + Math.abs(vx) * 0.01 * axisPow + Math.max(0, vz) * 0.025).toFixed(4));
      } else if (!window.__mgScrolling) {
        rootEl.style.setProperty("--mg-rx", "0deg");
        rootEl.style.setProperty("--mg-ry", "0deg");
        rootEl.style.setProperty("--mg-px", "0px");
        rootEl.style.setProperty("--mg-py", "0px");
        rootEl.style.setProperty("--mg-pz", "0px");
        rootEl.style.setProperty("--mg-sc", "1");
      }
      /* while __mgScrolling: leave last CSS vars; CSS forces transform:none */
      rootEl.style.setProperty("--mg-lx", (vx * 4.2).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-ly", (vy * 3.2).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-hx", (vx * -7).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-hy", (vy * -5).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-ang", (200 + vx * 28).toFixed(1) + "deg");
      rootEl.style.setProperty("--mg-fovea-a", (0.4 + ctrl.accom * 0.4).toFixed(3));
      /* Coverflow axis → inspect float (coverflow lives there now) */
      rootEl.style.setProperty("--mg-cf-yaw", (vx * 14 + tr * 4).toFixed(2));
      rootEl.style.setProperty("--mg-cf-pitch", (-vy * 9).toFixed(2));
      rootEl.style.setProperty("--mg-cf-z", (vz * 28).toFixed(1));
      try {
        if (typeof window.__mgCfApplyAxis === "function") {
          window.__mgCfApplyAxis(vx, vy, vz, tr);
        }
      } catch (eCf) {}
      /* Throttled axis push to inspect coverflow */
      if (!window.__mgCfAxisLast || performance.now() - window.__mgCfAxisLast > 80) {
        window.__mgCfAxisLast = performance.now();
        try {
          var exp = parseFloat(getComputedStyle(rootEl).getPropertyValue("--mg-cf-expand")) || 1;
          if (window.ipc && window.ipc.postMessage) {
            window.ipc.postMessage(JSON.stringify({
              op: "sync_cf_axis",
              yaw: vx * 14 + tr * 4,
              pitch: -vy * 9,
              expand: exp
            }));
          }
        } catch (eAx) {}
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    /*
     * Boot: auto no-glasses (prescription-assist) unless user saved another eye.
     * Optional face distance pass: far face → more zoom/sharp; near → human.
     */
    try {
      var savedEye = null;
      try { savedEye = localStorage.getItem("mg.eye"); } catch (e0) {}
      var bootEye = (savedEye && EYES[savedEye]) ? savedEye : "calibrate";
      applyEye(bootEye);
      /* Glass default: soft lip visible without hard cookie-cutter */
      var dropTarget = 78;
      setSlider("mg-c-drop", dropTarget);
      ctrl.drop = dropTarget;
      if (typeof applySeeThrough === "function") applySeeThrough();
      else {
        rootEl.style.setProperty("--mg-drop-w", "110%");
        rootEl.style.setProperty("--mg-drop-h", "106%");
        rootEl.style.setProperty("--mg-drop-core", "58%");
        rootEl.style.setProperty("--mg-fill-a", "0.66");
      }
      rootEl.classList.remove("mg-drop-rim");
      /* Eye distance auto-adjust runs from live PIP face track (single camera). */
    } catch (e) {}
  })(); } catch (ePortal) {
    try { console.error("mg portal init", ePortal); } catch (eC) {}
    try {
      if (typeof window.__mgDevLog === "function") {
        window.__mgDevLog("err", String(ePortal && (ePortal.stack || ePortal.message || ePortal)), "portal");
      }
    } catch (eD) {}
    try { if (typeof window.__mgWireShellMenus === "function") window.__mgWireShellMenus(); } catch (eW2) {}
  }

  var dragon = mgEl("mg-dragon");
  var tab = mgEl("mg-tab");
  var urlEl = mgEl("mg-url");
  try { if (urlEl) urlEl.value = location.href; } catch (e) {}

  function post(msg) {
    try { window.ipc.postMessage(JSON.stringify(msg)); } catch (e) {}
  }

  function setOpen(open) {
    if (!dragon || !tab) return;
    dragon = mgEl("mg-dragon") || dragon;
    tab = mgEl("mg-tab") || tab;
    dragon.classList.toggle("is-open", !!open);
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (e) {}
    /* Keep panel above coverflow / mode chrome while open */
    try {
      dragon.style.zIndex = open ? "2147483646" : "";
    } catch (eZ) {}
  }

  /* Always boot panel closed — open scrim was locking second windows (⌘N) */
  try { setOpen(false); } catch (eSo) {}

  /* Keep shell layout: top row + bottom tabs above ..... */
  (function pinShellControls() {
    /* One high header band — TRACK / CTRL / dots share this top */
    var SHELL_TOP = "2px";
    var DOTS_TOP = "2px";
    var PAD_TOP = "40px";
    var PAD_BOT = "96px"; /* tabs + search dock above fold; content scrolls above chrome */
    function apply() {
      try {
        document.documentElement.style.setProperty("--mg-shell-top", SHELL_TOP);
        document.documentElement.style.setProperty("--mg-dots-top", DOTS_TOP);
        document.documentElement.style.setProperty("--mg-page-pad-top", PAD_TOP);
        document.documentElement.style.setProperty("--mg-page-pad-bot", PAD_BOT);
        document.documentElement.style.setProperty("--mg-hdr-fs", "11px");
        document.documentElement.style.setProperty("--mg-hdr-ls", "0.22em");
        document.documentElement.style.setProperty("--mg-hdr-pad-y", "6px");
        if (document.body) {
          document.body.style.setProperty("padding-top", PAD_TOP, "important");
          document.body.style.setProperty("padding-bottom", PAD_BOT, "important");
          document.body.style.setProperty("box-sizing", "border-box", "important");
        }
        var lights = document.getElementById("mg-stoplights");
        var shell = document.getElementById("mg-dragon");
        var topRight = document.getElementById("mg-top-right");
        var tabs = document.getElementById("mg-tabs");
        if (lights) {
          lights.style.setProperty("top", SHELL_TOP, "important");
          lights.style.setProperty("left", "10px", "important");
          lights.style.setProperty("z-index", "2147483642", "important");
        }
        if (shell) {
          shell.style.setProperty("top", SHELL_TOP, "important");
          shell.style.setProperty("z-index", "2147483640", "important");
        }
        /* Inspect + TRACK share #mg-top-right — do not absolute-position children */
        if (topRight) {
          topRight.style.setProperty("top", SHELL_TOP, "important");
          topRight.style.setProperty("right", "12px", "important");
          topRight.style.setProperty("z-index", "2147483643", "important");
        }
        if (tabs) {
          tabs.style.setProperty("bottom", "calc(max(14px, env(safe-area-inset-bottom)) + 36px)", "important");
          tabs.style.setProperty("top", "auto", "important");
          tabs.style.setProperty("left", "50%", "important");
          tabs.style.setProperty("transform", "translateX(-50%)", "important");
          tabs.style.setProperty("z-index", "2147483501", "important");
        }
      } catch (e) {}
    }
    apply();
    setTimeout(apply, 80);
    setTimeout(apply, 500);
    window.addEventListener("load", apply, { once: true });
  })();

  /*
   * Window move — ONE system drag per pointerdown.
   * Continuous drag_by + set_outer_position crashed under WKWebView.
   * Native path synthesizes mouse-down (safe from async IPC).
   */
  function startWindowDrag(e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    try { post({ op: "drag" }); } catch (err) {}
  }
  /* Resize: low-rate absolute steps only (no per-frame flood) */
  var resizeBusy = false;
  function startWindowResize(e, dir) {
    if (resizeBusy) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    resizeBusy = true;
    var lastX = e.screenX;
    var lastY = e.screenY;
    var lastSend = 0;
    function onMove(ev) {
      var now = performance.now();
      if (now - lastSend < 40) return; /* ≤25 Hz */
      lastSend = now;
      var dx = ev.screenX - lastX;
      var dy = ev.screenY - lastY;
      lastX = ev.screenX;
      lastY = ev.screenY;
      if (dx === 0 && dy === 0) return;
      if (Math.abs(dx) > 80) dx = dx > 0 ? 80 : -80;
      if (Math.abs(dy) > 80) dy = dy > 0 ? 80 : -80;
      try { post({ op: "resize_by", dir: dir, dx: dx, dy: dy }); } catch (err) {}
    }
    function onUp() {
      resizeBusy = false;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    }
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
  }

  /*
   * SpaceX-style top-right word menu + CTRL open + grips.
   * Wired via __mgWireShellMenus so a portal() throw cannot kill menus.
   */
  var cinemaOn = false;
  var viewMode = "page";
  var lastNonCinemaMode = "page";
  var MODE_LABELS = {
    page: "page",
    phone: "phone",
    cinema: "cinema",
    depth: "depth",
    /* legacy */
    track: "depth",
    noglasses: "depth",
    xr: "depth"
  };
  var PHONE_RELAY_URL = "http://127.0.0.1:9877/relay.html";
  var shellMenusWired = false;
  function syncModeMenu(mode) {
    viewMode = mode || viewMode;
    if (viewMode !== "cinema") lastNonCinemaMode = viewMode;
    var lab = mgEl("mg-mode-label");
    if (lab) lab.textContent = MODE_LABELS[viewMode] || viewMode;
    document.querySelectorAll("#mg-mode-drop [data-mode]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-mode") === viewMode);
    });
    var trig = mgEl("mg-mode-trigger");
    if (trig) {
      trig.title = ". " + (MODE_LABELS[viewMode] || viewMode) + " — view mode";
    }
  }
  function setModeMenuOpen(open) {
    var menu = mgEl("mg-mode-menu");
    var trig = mgEl("mg-mode-trigger");
    if (!menu || !trig) return;
    menu.classList.toggle("is-open", !!open);
    trig.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function setCinema(on) {
    cinemaOn = !!on;
    document.documentElement.classList.toggle("mg-cinema-on", cinemaOn);
    document.documentElement.classList.toggle("mg-dim-on", cinemaOn);
    var panelBtn = mgEl("mg-cinema-toggle");
    if (panelBtn) panelBtn.classList.toggle("on", cinemaOn);
    if (cinemaOn) {
      if (viewMode !== "cinema") lastNonCinemaMode = viewMode;
      syncModeMenu("cinema");
    } else if (viewMode === "cinema") {
      syncModeMenu(lastNonCinemaMode || "track");
    }
    try {
      if (cinemaOn) {
        document.documentElement.style.setProperty("--mg-drop-w", "100%");
        document.documentElement.style.setProperty("--mg-drop-h", "100%");
        document.documentElement.style.setProperty("--mg-page-pad-top", "0px");
        document.documentElement.style.setProperty("--mg-page-pad-bot", "0px");
        if (document.body) {
          document.body.style.setProperty("padding-top", "0px", "important");
          document.body.style.setProperty("padding-bottom", "0px", "important");
          document.body.style.setProperty("background", "#000", "important");
          document.body.style.setProperty("background-color", "#000", "important");
        }
        document.documentElement.style.setProperty("background", "#000", "important");
        document.documentElement.style.setProperty("background-color", "#000", "important");
      } else {
        document.documentElement.style.setProperty("--mg-page-pad-top", "40px");
        document.documentElement.style.setProperty("--mg-page-pad-bot", "96px");
        document.documentElement.style.setProperty("background", "transparent", "important");
        document.documentElement.style.setProperty("background-color", "transparent", "important");
        if (document.body) {
          document.body.style.setProperty("padding-top", "40px", "important");
          document.body.style.setProperty("padding-bottom", "96px", "important");
          /* clear cinema solid black — Drop/Glow re-apply via applySeeThrough */
          document.body.style.removeProperty("background");
          document.body.style.removeProperty("background-color");
          document.body.style.removeProperty("-webkit-mask-image");
          document.body.style.removeProperty("mask-image");
        }
        var dw = document.documentElement.style.getPropertyValue("--mg-drop-w");
        if (!dw || dw === "100%") {
          document.documentElement.style.setProperty("--mg-drop-w", "88%");
          document.documentElement.style.setProperty("--mg-drop-h", "84%");
        }
        /* Restore glass lip after theater */
        try {
          var dropEl = document.getElementById("mg-c-drop");
          if (dropEl) dropEl.dispatchEvent(new Event("input"));
        } catch (e3) {}
      }
    } catch (e2) {}
  }
  function toggleCinema(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setCinema(!cinemaOn);
  }
  function openPhoneRelay() {
    /* Lean CTRL-style multi-device relay (still-pipe LAN hub) */
    try {
      post({ op: "new_window", url: PHONE_RELAY_URL });
    } catch (e0) {
      try { window.open(PHONE_RELAY_URL, "_blank"); } catch (e1) {}
    }
    try {
      if (typeof setCalibMsg === "function") {
        setCalibMsg("PHONE · relay " + PHONE_RELAY_URL + " · chat/talk/cam links");
      }
      if (window.__mgDevLog) {
        window.__mgDevLog("ok", "PHONE relay → " + PHONE_RELAY_URL, "phone");
      }
    } catch (e2) {}
  }
  function applyViewMode(mode) {
    mode = mode || "page";
    if (mode === "track" || mode === "xr" || mode === "noglasses") mode = "depth";
    /* phone is an action under page menu — open relay, stay in page mode */
    if (mode === "phone") {
      setModeMenuOpen(false);
      openPhoneRelay();
      syncModeMenu(viewMode === "cinema" || viewMode === "depth" ? viewMode : "page");
      return;
    }
    setModeMenuOpen(false);
    syncModeMenu(mode);
    try {
      if (typeof window.__mgApplyViewMode === "function") {
        window.__mgApplyViewMode(mode);
      } else if (mode === "cinema") {
        setCinema(true);
      } else if (cinemaOn) {
        setCinema(false);
      }
    } catch (eA) {}
  }
  window.__mgSetCinema = setCinema;
  window.__mgApplyViewModeExternal = applyViewMode;

  window.__mgWireShellMenus = function () {
    try {
      dragon = mgEl("mg-dragon") || dragon;
      tab = mgEl("mg-tab") || tab;
      urlEl = mgEl("mg-url") || urlEl;
      /* CTRL open/close — always rebind (clone-safe) */
      if (tab && !tab.__mgBound) {
        tab.__mgBound = true;
        mgOn(tab, "click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (!dragon) dragon = mgEl("mg-dragon");
          if (!dragon) return;
          setOpen(!dragon.classList.contains("is-open"));
        });
      }
      var scrim = mgEl("mg-scrim");
      if (scrim && !scrim.__mgBound) {
        scrim.__mgBound = true;
        mgOn(scrim, "click", function () { setOpen(false); });
      }
      /* Grips / edges */
      ["mg-grip-l", "mg-grip-r", "mg-drag-pad"].forEach(function (id) {
        var g = mgEl(id);
        if (g && !g.__mgDragBound) {
          g.__mgDragBound = true;
          mgOn(g, "pointerdown", startWindowDrag);
        }
      });
      var rootNow = mgEl("mg-root");
      if (rootNow) {
        rootNow.querySelectorAll(".mg-edge").forEach(function (el) {
          if (el.__mgResizeBound) return;
          el.__mgResizeBound = true;
          mgOn(el, "pointerdown", function (e) {
            startWindowResize(e, el.getAttribute("data-dir") || "se");
          });
        });
        rootNow.querySelectorAll("#mg-stoplights .mg-dot").forEach(function (dot) {
          if (dot.__mgBound) return;
          dot.__mgBound = true;
          mgOn(dot, "click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var w = dot.getAttribute("data-win");
            if (w === "close") post({ op: "win_close" });
            else if (w === "min") post({ op: "win_min" });
            else if (w === "max") post({ op: "win_max" });
          });
        });
      }
      /* Top-right word menu */
      var menu = mgEl("mg-mode-menu");
      var trig = mgEl("mg-mode-trigger");
      var drop = mgEl("mg-mode-drop");
      if (trig && !trig.__mgBound) {
        trig.__mgBound = true;
        mgOn(trig, "click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          var m = mgEl("mg-mode-menu");
          setModeMenuOpen(!(m && m.classList.contains("is-open")));
        });
      }
      if (drop && !drop.__mgBound) {
        drop.__mgBound = true;
        drop.querySelectorAll("[data-mode]").forEach(function (b) {
          mgOn(b, "click", function (e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            applyViewMode(b.getAttribute("data-mode"));
          });
        });
      }
      if (!window.__mgModeOutsideBound) {
        window.__mgModeOutsideBound = true;
        document.addEventListener("click", function (e) {
          var m = mgEl("mg-mode-menu");
          if (!m || !m.classList.contains("is-open")) return;
          if (m.contains(e.target)) return;
          setModeMenuOpen(false);
        }, true);
      }
      var cinemaToggle = mgEl("mg-cinema-toggle");
      if (cinemaToggle && !cinemaToggle.__mgBound) {
        cinemaToggle.__mgBound = true;
        mgOn(cinemaToggle, "click", toggleCinema);
      }
      var gripL = mgEl("mg-grip-l");
      if (gripL && !gripL.__mgCinemaBound) {
        gripL.__mgCinemaBound = true;
        mgOn(gripL, "dblclick", toggleCinema);
      }
      /* CTRL section clumps (re-bind if portal failed) */
      var openN = 0;
      document.querySelectorAll("#mg-panel .mg-sec").forEach(function (sec) {
        if (sec.classList.contains("is-open")) openN += 1;
        var tog = sec.querySelector(".mg-sec-toggle");
        if (!tog || tog.__mgSecBound) return;
        tog.__mgSecBound = true;
        mgOn(tog, "click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          var open = !sec.classList.contains("is-open");
          sec.classList.toggle("is-open", open);
          tog.setAttribute("aria-expanded", open ? "true" : "false");
          try {
            var id = sec.getAttribute("data-sec");
            if (id) localStorage.setItem("mg.sec." + id, open ? "1" : "0");
          } catch (eS) {}
        });
      });
      if (openN === 0) {
        ["nav", "eye", "modes", "lens"].forEach(function (id) {
          var sec = document.querySelector('#mg-panel .mg-sec[data-sec="' + id + '"]');
          if (!sec) return;
          sec.classList.add("is-open");
          var t = sec.querySelector(".mg-sec-toggle");
          if (t) t.setAttribute("aria-expanded", "true");
          try { localStorage.setItem("mg.sec." + id, "1"); } catch (eR) {}
        });
      }
      var exp = mgEl("mg-sec-expand");
      var col = mgEl("mg-sec-collapse");
      if (exp && !exp.__mgBound) {
        exp.__mgBound = true;
        mgOn(exp, "click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          document.querySelectorAll("#mg-panel .mg-sec").forEach(function (s) {
            s.classList.add("is-open");
            var t = s.querySelector(".mg-sec-toggle");
            if (t) t.setAttribute("aria-expanded", "true");
            try {
              var id = s.getAttribute("data-sec");
              if (id) localStorage.setItem("mg.sec." + id, "1");
            } catch (eE) {}
          });
        });
      }
      if (col && !col.__mgBound) {
        col.__mgBound = true;
        mgOn(col, "click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          document.querySelectorAll("#mg-panel .mg-sec").forEach(function (s) {
            s.classList.remove("is-open");
            var t = s.querySelector(".mg-sec-toggle");
            if (t) t.setAttribute("aria-expanded", "false");
            try {
              var id = s.getAttribute("data-sec");
              if (id) localStorage.setItem("mg.sec." + id, "0");
            } catch (eC) {}
          });
        });
      }
      /* Dev inspect float — toggle / clear / copy */
      var dev = mgEl("mg-dev");
      var devTog = mgEl("mg-dev-toggle");
      var devClear = mgEl("mg-dev-clear");
      var devCopy = mgEl("mg-dev-copy");
      if (devTog && !devTog.__mgBound) {
        devTog.__mgBound = true;
        mgOn(devTog, "click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          try {
            if (window.ipc && window.ipc.postMessage) {
              window.ipc.postMessage(JSON.stringify({ op: "dev_toggle" }));
            }
          } catch (eT) {}
          if (dev) dev.classList.toggle("is-open");
        });
      }
      if (devClear && !devClear.__mgBound) {
        devClear.__mgBound = true;
        mgOn(devClear, "click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          if (typeof window.__mgDevClear === "function") window.__mgDevClear();
        });
      }
      if (devCopy && !devCopy.__mgBound) {
        devCopy.__mgBound = true;
        mgOn(devCopy, "click", function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          try {
            var text = typeof window.__mgDevDump === "function" ? window.__mgDevDump() : "";
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(function () {
                if (window.__mgDevLog) window.__mgDevLog("ok", "Log copied to clipboard", "inspect");
              }).catch(function () {
                if (window.__mgDevLog) window.__mgDevLog("warn", "Clipboard blocked — select rows manually", "inspect");
              });
            } else if (window.__mgDevLog) {
              window.__mgDevLog("warn", "No clipboard API", "inspect");
            }
          } catch (eCp) {}
        });
      }
      if (!shellMenusWired) {
        shellMenusWired = true;
        syncModeMenu(viewMode || "page");
        try {
          if (window.__mgDevLog) window.__mgDevLog("ok", "Shell menus · page / cinema / depth", "shell");
        } catch (eOk) {}
      }
    } catch (eWire) {
      try { console.error("mg wire menus", eWire); } catch (eC) {}
      try {
        if (window.__mgDevLog) window.__mgDevLog("err", String(eWire && (eWire.stack || eWire.message || eWire)), "wire");
      } catch (eD) {}
    }
  };
  window.__mgWireShellMenus();
  /* Tabs (⌘T) + window (⌘N) — capture phase so WKWebView doesn't eat shortcuts */
  var browserTabs = [
    { id: 1, url: "https://www.spacex.com/", title: "spacex" },
    { id: 2, url: "https://www.spacex.com/vehicles/starship/", title: "starship" },
    { id: 3, url: "https://www.spacex.com/launches/", title: "launches" }
  ];
  var nextTabId = 3;
  var activeTab = 0;
  function tabTitle(url) {
    try {
      var host = new URL(url).hostname || "tab";
      if (host.indexOf("www.") === 0) host = host.slice(4);
      return host || "tab";
    } catch (e) { return "tab"; }
  }
  function switchTab(i) {
    if (i < 0 || i >= browserTabs.length) return;
    activeTab = i;
    var u = browserTabs[i].url;
    post({ op: "navigate", url: u });
    try { urlEl.value = u; } catch (e) {}
    renderTabs();
  }
  window.__mgSwitchTab = switchTab;
  function syncTabsToInspect() {
    try {
      var payload = {
        active: activeTab,
        tabs: browserTabs.map(function (t) {
          return { title: t.title || tabTitle(t.url), url: t.url || "" };
        })
      };
      post({ op: "sync_tabs", json: JSON.stringify(payload) });
    } catch (eS) {}
  }

  /*
   * Cover Flow tab stack — 3D HUD carousel (Gmunk / MN8 / prologue-style depth).
   * Credit: Andrew Coulter Enright · Heather Samples Enright · Roan · NYC.
   */
  var cfAxis = { yaw: 0, pitch: 0, z: 0 };
  function cfCardTransform(offset, yaw, pitch) {
    var abs = Math.abs(offset);
    var side = offset === 0 ? 0 : (offset > 0 ? 1 : -1);
    /* Classic coverflow: fan rotateY, push back, slight rise */
    var rotY = -offset * 52 + yaw * 0.35;
    var rotX = 8 + pitch * 0.25 + abs * 2;
    var tx = offset * 96 + yaw * 1.2;
    var ty = abs * 6 + pitch * 0.8;
    var tz = -abs * 72 - Math.abs(yaw) * 0.4;
    var sc = offset === 0 ? 1.08 : Math.max(0.62, 0.92 - abs * 0.1);
    var op = offset === 0 ? 1 : Math.max(0.28, 0.85 - abs * 0.18);
    return {
      transform:
        "translate3d(calc(-50% + " + tx.toFixed(1) + "px), calc(-50% + " + ty.toFixed(1) + "px), " +
        tz.toFixed(1) + "px) rotateY(" + rotY.toFixed(2) + "deg) rotateX(" + rotX.toFixed(2) +
        "deg) scale(" + sc.toFixed(3) + ")",
      opacity: op,
      zIndex: String(100 - abs)
    };
  }
  function renderCoverflow() {
    var stage = document.getElementById("mg-cf-stage");
    var stack = document.getElementById("mg-page-stack");
    if (!stage) return;
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    browserTabs.forEach(function (tb, i) {
      var off = i - activeTab;
      var card = document.createElement("button");
      card.type = "button";
      card.className = "mg-cf-card" + (i === activeTab ? " on" : "");
      card.setAttribute("data-i", String(i));
      card.setAttribute("data-off", String(off));
      card.title = (tb.title || tabTitle(tb.url)) + " · " + (tb.url || "");
      var idx = document.createElement("span");
      idx.className = "cf-idx";
      idx.textContent = (i + 1 < 10 ? "0" : "") + String(i + 1);
      var glow = document.createElement("span");
      glow.className = "cf-glow";
      var ttl = document.createElement("span");
      ttl.className = "cf-ttl";
      ttl.textContent = tb.title || tabTitle(tb.url);
      card.appendChild(glow);
      card.appendChild(idx);
      card.appendChild(ttl);
      var tr = cfCardTransform(off, cfAxis.yaw, cfAxis.pitch);
      card.style.transform = tr.transform;
      card.style.opacity = String(tr.opacity);
      card.style.zIndex = tr.zIndex;
      card.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        switchTab(i);
      });
      stage.appendChild(card);
    });
    /* Page-stack ghost plates for depth (prev/next only) */
    if (stack) {
      while (stack.firstChild) stack.removeChild(stack.firstChild);
      [-2, -1, 1, 2].forEach(function (off) {
        var ti = activeTab + off;
        if (ti < 0 || ti >= browserTabs.length) return;
        var plate = document.createElement("div");
        plate.className = "mg-ps-plate";
        var side = off > 0 ? 1 : -1;
        var abs = Math.abs(off);
        plate.style.opacity = String(Math.max(0.04, 0.16 - abs * 0.04));
        plate.style.transform =
          "translate3d(" + (side * abs * 28 + cfAxis.yaw * 2).toFixed(1) + "px," +
          (cfAxis.pitch * 1.2).toFixed(1) + "px," + (-abs * 48).toFixed(0) + "px) " +
          "rotateY(" + (-side * abs * 10 + cfAxis.yaw * 0.4).toFixed(1) + "deg) " +
          "rotateX(" + (4 + cfAxis.pitch * 0.3).toFixed(1) + "deg)";
        stack.appendChild(plate);
      });
    }
  }
  window.__mgCfApplyAxis = function (vx, vy, vz, roll) {
    cfAxis.yaw = (vx || 0) * 10 + (roll || 0) * 3;
    cfAxis.pitch = (vy || 0) * -7;
    cfAxis.z = (vz || 0) * 20;
    var stage = document.getElementById("mg-cf-stage");
    if (!stage) return;
    /* Live re-skew cards without full rebuild when only axis moves */
    var cards = stage.querySelectorAll(".mg-cf-card");
    for (var c = 0; c < cards.length; c++) {
      var off = +cards[c].getAttribute("data-off");
      if (!isFinite(off)) continue;
      var tr = cfCardTransform(off, cfAxis.yaw, cfAxis.pitch);
      cards[c].style.transform = tr.transform;
      cards[c].style.opacity = String(tr.opacity);
    }
    var stack = document.getElementById("mg-page-stack");
    if (stack) {
      var plates = stack.querySelectorAll(".mg-ps-plate");
      /* plates rebuilt on tab change; light nudge via CSS vars on stack */
      stack.style.transform =
        "rotateY(" + (cfAxis.yaw * 0.15).toFixed(2) + "deg) rotateX(" +
        (cfAxis.pitch * 0.12).toFixed(2) + "deg)";
    }
  };
  (function coverflowGestures() {
    var stage = document.getElementById("mg-cf-stage");
    var root = document.getElementById("mg-coverflow");
    if (!stage || !root) return;
    var dragX = 0, dragging = false, startX = 0;
    var swipeCool = 0;
    root.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) < 2 && Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      var dir = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) > 0 ? 1 : -1;
      switchTab(activeTab + dir);
    }, { passive: false });
    stage.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      dragX = 0;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      dragX = e.clientX - startX;
      /* preview scrub: temporary yaw bias */
      document.documentElement.style.setProperty("--mg-cf-yaw", (cfAxis.yaw + dragX * 0.04).toFixed(2));
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dragX) > 48) {
        switchTab(activeTab + (dragX < 0 ? 1 : -1));
      }
      dragX = 0;
    }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    /* Expansion-hand bridges (Ender/Ash-Thorp) */
    window.__mgCfHandSwipe = function (dir) {
      var now = performance.now();
      if (now < swipeCool) return;
      swipeCool = now + 420;
      switchTab(activeTab + (dir > 0 ? 1 : -1));
    };
    window.__mgCfHandSelect = function (nx, ny) {
      /* Map hand X across coverflow cards → pick nearest */
      var n = browserTabs.length;
      if (!n) return;
      var t = Math.max(0, Math.min(1, nx));
      var i = Math.round(t * (n - 1));
      if (i !== activeTab) switchTab(i);
    };
  })();

  function renderTabs() {
    var strip = document.getElementById("mg-tabs");
    if (strip) {
      while (strip.firstChild) strip.removeChild(strip.firstChild);
      browserTabs.forEach(function (tb, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "mg-btab" + (i === activeTab ? " on" : "");
        b.setAttribute("data-i", String(i));
        var ttl = document.createElement("span");
        ttl.className = "ttl";
        ttl.textContent = tb.title || tabTitle(tb.url);
        var x = document.createElement("span");
        x.className = "x";
        x.textContent = "×";
        b.appendChild(ttl);
        b.appendChild(x);
        b.addEventListener("click", function (ev) {
          if (ev.target === x || (ev.target && ev.target.classList && ev.target.classList.contains("x"))) {
            ev.preventDefault();
            ev.stopPropagation();
            if (browserTabs.length <= 1) return;
            var idx = +b.getAttribute("data-i");
            browserTabs.splice(idx, 1);
            if (activeTab >= browserTabs.length) activeTab = browserTabs.length - 1;
            else if (activeTab > idx) activeTab -= 1;
            switchTab(activeTab);
            return;
          }
          switchTab(+b.getAttribute("data-i"));
        });
        strip.appendChild(b);
      });
      var add = document.createElement("button");
      add.type = "button";
      add.id = "mg-tab-add";
      add.title = "New tab (⌘T)";
      add.textContent = "+";
      add.addEventListener("click", function () { newTab("https://www.spacex.com/"); });
      strip.appendChild(add);
    }
    renderCoverflow();
    syncTabsToInspect();
  }
  function newTab(url) {
    var u = url || "https://www.spacex.com/";
    nextTabId += 1;
    browserTabs.push({ id: nextTabId, url: u, title: tabTitle(u) });
    activeTab = browserTabs.length - 1;
    post({ op: "navigate", url: u });
    try { urlEl.value = u; } catch (e) {}
    renderTabs();
  }
  function newWindow(url) {
    /* ⌘N default SpaceX home; callers (PHONE relay) may pass an explicit URL. */
    var u = url && String(url).trim() ? String(url).trim() : "https://www.spacex.com/";
    post({ op: "new_window", url: u });
  }
  try { window.__mgOpenPhoneRelay = openPhoneRelay; } catch (ePh) {}
  renderTabs();
  try {
    if (window.__mgDevLog) {
      window.__mgDevLog("ok", "Coverflow online (inspect float) · credit in source", "coverflow");
    }
  } catch (eCf0) {}

  window.addEventListener("keydown", function (e) {
    var t = e.target;
    var tag = (t && t.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable);
    var meta = e.metaKey || e.ctrlKey;
    var k = String(e.key || "").toLowerCase();
    /* Never swallow clipboard / undo / select-all — native Edit menu + WKWebView */
    if (meta && (k === "c" || k === "v" || k === "x" || k === "a" || k === "z" || k === "y")) {
      return;
    }
    if (meta && (e.key === "n" || e.key === "N")) {
      e.preventDefault();
      e.stopPropagation();
      newWindow();
      return;
    }
    if (meta && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      e.stopPropagation();
      newTab("https://www.spacex.com/");
      return;
    }
    if (meta && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      e.stopPropagation();
      try {
        document.getElementById("mg-search-dock").classList.add("is-open");
        urlEl.focus(); urlEl.select();
      } catch (err) {}
      return;
    }
    if (meta && (e.key === "r" || e.key === "R") && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      post({ op: "reload" });
      return;
    }
    if (meta && e.shiftKey && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      e.stopPropagation();
      post({ op: "hot_reload" });
      return;
    }
    if (meta && e.altKey && (e.key === "t" || e.key === "T")) {
      e.preventDefault();
      e.stopPropagation();
      post({ op: "tile_layout" });
      return;
    }
    if (meta && (e.key === "w" || e.key === "W") && !typing) {
      e.preventDefault();
      if (browserTabs.length > 1) {
        browserTabs.splice(activeTab, 1);
        if (activeTab >= browserTabs.length) activeTab = browserTabs.length - 1;
        switchTab(activeTab);
      }
      return;
    }
    /* ⌘⌥I / Ctrl+Shift+I — toggle native inspect float (outside window) */
    if ((meta && e.altKey && k === "i") || (e.ctrlKey && e.shiftKey && k === "i")) {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (window.ipc && window.ipc.postMessage) {
          window.ipc.postMessage(JSON.stringify({ op: "dev_toggle" }));
        }
      } catch (eI) {}
      return;
    }
    if (typing) return;
    if (e.key === "d" || e.key === "D") toggleCinema(e);
    if (e.key === "f" || e.key === "F") toggleCinema(e);
  }, true);

  mgOn(mgEl("mg-recenter"), "click", function (e) {
    e.stopPropagation();
    post({ op: "recenter" });
  });
  mgOn(mgEl("mg-phone-relay"), "click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    openPhoneRelay();
  });

  /* Search: collapsed ..... · expand on click · stays above page scroll (fixed dock) */
  (function searchDock() {
    var dock = document.getElementById("mg-search-dock");
    var peek = document.getElementById("mg-search-peek");
    var bar = document.getElementById("mg-search");
    if (!dock || !peek || !bar) return;
    /* Guarantee dock is a direct fixed child under #mg-root / html (not trapped in transformed body) */
    try {
      var host = document.getElementById("mg-root") || document.documentElement;
      if (dock.parentNode !== host) host.appendChild(dock);
    } catch (eRe) {}
    var hideT = 0;
    function openSearch() {
      dock.classList.add("is-open");
      clearTimeout(hideT);
      try { urlEl.focus(); urlEl.select(); } catch (e) {}
      armHide();
    }
    function closeSearch() {
      if (document.activeElement === urlEl) return;
      dock.classList.remove("is-open");
    }
    function armHide() {
      clearTimeout(hideT);
      hideT = setTimeout(function () {
        if (document.activeElement === urlEl) { armHide(); return; }
        closeSearch();
      }, 4800);
    }
    peek.addEventListener("click", function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      openSearch();
    });
    bar.addEventListener("pointerdown", function () { clearTimeout(hideT); });
    bar.addEventListener("focusin", function () { clearTimeout(hideT); });
    bar.addEventListener("focusout", function () { armHide(); });
    /* ⌘L / Ctrl+L focuses search */
    if (!window.__mgSearchKeyBound) {
      window.__mgSearchKeyBound = true;
      window.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && (e.key === "l" || e.key === "L")) {
          e.preventDefault();
          openSearch();
        }
      }, true);
    }
  })();

  mgOn(mgEl("mg-form"), "submit", function (e) {
    e.preventDefault();
    var s = String((urlEl && urlEl.value) || "").trim();
    if (!s) return;
    if (!/^https?:\/\//i.test(s)) {
      if (/^[\w.-]+\.[a-z]{2,}/i.test(s)) s = "https://" + s;
      else s = "https://www.google.com/search?q=" + encodeURIComponent(s);
    }
    if (browserTabs[activeTab]) {
      browserTabs[activeTab].url = s;
      browserTabs[activeTab].title = tabTitle(s);
    }
    post({ op: "navigate", url: s });
    renderTabs();
    try { var sd = mgEl("mg-search-dock"); if (sd) sd.classList.remove("is-open"); } catch (err) {}
  });
  try {
    var rootBind = mgEl("mg-root") || root;
    if (rootBind) {
      rootBind.querySelectorAll("button[data-op]").forEach(function (b) {
        if (b.__mgOpBound) return;
        b.__mgOpBound = true;
        mgOn(b, "click", function () {
          post({ op: b.getAttribute("data-op") });
        });
      });
    }
  } catch (eOps) {}
  /* Final guarantee — menus live even if earlier wiring failed */
  try { window.__mgWireShellMenus(); } catch (eFinal) {}

  setInterval(function () {
    try {
      if (document.activeElement !== urlEl) {
        urlEl.value = location.href;
        if (browserTabs[activeTab]) {
          browserTabs[activeTab].url = location.href;
          browserTabs[activeTab].title = tabTitle(location.href);
          renderTabs();
        }
      }
    } catch (e) {}
  }, 1200);
})();
"##
}

fn main() -> Result<()> {
    let start = std::env::args()
        .nth(1)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| HOME_URL.to_string());

    let run_epoch = process_start_epoch();
    let ver_full = version_label(run_epoch);
    let ver_short = version_short(run_epoch);
    eprintln!("Memory Glass version stamp");
    eprintln!("  pkg    : {MG_PKG}");
    eprintln!("  build  : {MG_BUILD_EPOCH} ({MG_BUILD_ISO})");
    eprintln!("  run    : {run_epoch}");
    eprintln!("  label  : {ver_full}");

    let event_loop: EventLoop<Cmd> = EventLoopBuilder::with_user_event().build();
    let proxy = event_loop.create_proxy();

    let webgrid_mode = start.to_ascii_lowercase().contains("webgrid")
        || start.to_ascii_lowercase().contains("neuralink.com/webgrid");
    let webgrid_small = webgrid_mode && webgrid_wants_small_window();
    let mut wb = WindowBuilder::new()
        .with_title(format!("Memory Glass · {ver_short}"))
        // Medium browser for play (WebGrid); slightly wider default otherwise
        .with_inner_size(LogicalSize::new(
            // WebGrid large → 30×30; small → 12×12 (h≤600 / w≤751)
            // Initial size; place_for_webgrid_play resizes to laptop display.
            if webgrid_small {
                720.0
            } else if webgrid_mode {
                2400.0
            } else {
                980.0
            },
            if webgrid_small {
                560.0
            } else if webgrid_mode {
                1350.0
            } else {
                820.0
            },
        ))
        .with_min_inner_size(LogicalSize::new(520.0, 400.0))
        // Decorations ON so macOS keeps system resize edges; custom .mg-edge strips as backup.
        .with_decorations(true)
        .with_transparent(true)
        .with_resizable(true)
        .with_visible(false);

    if let Some(icon) = app_icon() {
        wb = wb.with_window_icon(Some(icon));
    }

    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        wb = wb
            // Native resize/titlebar chrome; hide bright system stoplights — we use dim . . .
            .with_movable_by_window_background(true)
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_titlebar_buttons_hidden(true)
            .with_has_shadow(true);
    }

    let window = wb.build(&event_loop).context("tao window")?;
    if webgrid_mode {
        // Defer full place until inspect exists — still park on landscape left now
        if let Some(mon) = leftmost_landscape_monitor(&window) {
            let mpos = mon.position();
            window.set_outer_position(PhysicalPosition::new(mpos.x + 24, mpos.y + 48));
        } else {
            place_on_primary(&window);
        }
    } else {
        place_on_primary(&window);
    }
    clear_window_bg(&window);
    // App / Navigate / View / Edit / Window — Reload + controls in dropdowns
    install_standard_edit_menu(proxy.clone());
    // Re-apply icon after build (some hosts only honor post-create)
    if let Some(icon) = app_icon() {
        window.set_window_icon(Some(icon));
    }
    window.set_visible(true);
    window.set_focus();

    // Camera: never block WebGrid / play with OS permission sheet at boot.
    // - already authorized → mark session grant (no sheet)
    // - webgrid / play URLs → defer completely (still-pipe phone vision)
    // - otherwise soft check without prompting unless user later enables Cam
    let start_l = start.to_ascii_lowercase();
    let defer_cam = webgrid_mode
        || start_l.contains("play")
        || std::env::var("MG_CAMERA_DEFER")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
    let status0 = camera_auth_status();
    if status0 == 3 {
        let _ = request_camera_access_native_opts(false);
        eprintln!("camera: already authorized · session grant recorded · no prompt");
    } else if defer_cam {
        let _ = request_camera_access_native_opts(false);
        eprintln!(
            "camera: deferred for play session (status={}) · still-pipe OK · Cam toggle later if needed",
            status0
        );
    } else if camera_grant_fresh() {
        // Prior grant in 30d window but TCC notDetermined (unsigned rebuilds) —
        // still avoid auto-sheet; user can enable Cam once.
        let _ = request_camera_access_native_opts(false);
        eprintln!("camera: prior session grant on file · skip boot prompt (status={status0})");
    } else {
        // First run only: optional soft prompt (still non-blocking)
        let cam_ok = request_camera_access_native_opts(true);
        if !cam_ok {
            eprintln!(
                "camera: status={} — enable Memory Glass under System Settings › Privacy & Security › Camera if needed",
                camera_auth_status()
            );
        }
    }

    let make_ipc = |proxy: tao::event_loop::EventLoopProxy<Cmd>| {
        move |req: Request<String>| {
            let body = req.body();
            let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
                return;
            };
            let op = v.get("op").and_then(|x| x.as_str()).unwrap_or("");
            let cmd = match op {
                "navigate" => v
                    .get("url")
                    .and_then(|x| x.as_str())
                    .map(|u| Cmd::Navigate(u.to_string())),
                "back" => Some(Cmd::Back),
                "forward" => Some(Cmd::Forward),
                "reload" => Some(Cmd::Reload),
                "drag" => Some(Cmd::Drag),
                "click_at" | "synthetic_click" => Some(Cmd::SyntheticClick {
                    x: v.get("x").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    y: v.get("y").and_then(|x| x.as_f64()).unwrap_or(0.0),
                }),
                "resize_by" => {
                    let dir = v
                        .get("dir")
                        .and_then(|x| x.as_str())
                        .unwrap_or("se")
                        .to_string();
                    let dx = v.get("dx").and_then(|x| x.as_f64()).unwrap_or(0.0);
                    let dy = v.get("dy").and_then(|x| x.as_f64()).unwrap_or(0.0);
                    Some(Cmd::ResizeBy { dir, dx, dy })
                }
                "recenter" => Some(Cmd::Recenter),
                "win_close" => Some(Cmd::WinClose),
                "win_min" => Some(Cmd::WinMinimize),
                "win_max" => Some(Cmd::WinZoom),
                // cinema is CSS-only (native opaque toggle crashed with transparent WKWebView)
                "cinema" => None,
                "new_window" => {
                    let url = v
                        .get("url")
                        .and_then(|x| x.as_str())
                        .filter(|s| !s.is_empty())
                        .unwrap_or(HOME_URL)
                        .to_string();
                    Some(Cmd::NewWindow(url))
                }
                "dev_log" => Some(Cmd::DevLog {
                    lvl: v
                        .get("lvl")
                        .and_then(|x| x.as_str())
                        .unwrap_or("info")
                        .to_string(),
                    msg: v
                        .get("msg")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                    src: v
                        .get("src")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                }),
                "dev_show" => Some(Cmd::DevShow),
                "dev_hide" => Some(Cmd::DevHide),
                "dev_toggle" => Some(Cmd::DevToggle),
                "dev_clear" => Some(Cmd::DevClear),
                "open_camera_prefs" => Some(Cmd::OpenCameraPrefs),
                "request_camera" => Some(Cmd::RequestCameraAccess),
                "hot_reload" => Some(Cmd::HotReload),
                "page_zoom" | "zoom" => Some(Cmd::PageZoom {
                    scale: v
                        .get("scale")
                        .or_else(|| v.get("z"))
                        .and_then(|x| x.as_f64())
                        .unwrap_or(1.0),
                }),
                "media_feed" => Some(Cmd::MediaFeed {
                    media_op: v
                        .get("media_op")
                        .or_else(|| v.get("action"))
                        .and_then(|x| x.as_str())
                        .unwrap_or("tools")
                        .to_string(),
                    url: v
                        .get("url")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                }),
                "load_filmstrip" | "filmstrip" => Some(Cmd::LoadFilmstrip),
                "reassert_glass" | "glass" => Some(Cmd::ReassertGlass),
                "hot_mitigate" => Some(Cmd::HotMitigate {
                    msg: v
                        .get("msg")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                }),
                "submit_inspect" => Some(Cmd::SubmitInspect {
                    dump: v
                        .get("dump")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                }),
                "open_agent" => Some(Cmd::OpenAgent),
                "open_leaderboard" => Some(Cmd::OpenLeaderboard {
                    handoff: v
                        .get("handoff")
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string()),
                    post: v
                        .get("post")
                        .and_then(|x| x.as_bool())
                        .unwrap_or(false),
                }),
                "hot_load_prompt" => Some(Cmd::HotLoadPrompt),
                "hot_load_loop" => Some(Cmd::HotLoadLoop),
                "switch_tab" => Some(Cmd::SwitchTab {
                    index: v.get("index").and_then(|x| x.as_u64()).unwrap_or(0) as usize,
                }),
                "sync_tabs" => Some(Cmd::SyncTabs {
                    json: v
                        .get("json")
                        .and_then(|x| x.as_str())
                        .unwrap_or("[]")
                        .to_string(),
                }),
                "sync_cf_axis" => Some(Cmd::SyncCfAxis {
                    yaw: v.get("yaw").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    pitch: v.get("pitch").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    expand: v.get("expand").and_then(|x| x.as_f64()).unwrap_or(1.0),
                }),
                "clipboard_copy" => Some(Cmd::ClipboardCopy {
                    text: v
                        .get("text")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string(),
                }),
                "mic_mute" => Some(Cmd::MicMute(true)),
                "mic_unmute" => Some(Cmd::MicMute(false)),
                "mic_status" => Some(Cmd::MicStatus),
                "tile_layout" => Some(Cmd::TileLayout),
                "track_pose" => Some(Cmd::TrackPose {
                    yaw: v.get("yaw").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    pitch: v.get("pitch").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    roll: v.get("roll").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    z: v.get("z").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    nx: v.get("nx").and_then(|x| x.as_f64()).unwrap_or(0.5),
                    ny: v.get("ny").and_then(|x| x.as_f64()).unwrap_or(0.46),
                    conf: v.get("conf").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    smile: v.get("smile").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    brow: v.get("brow").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    jaw: v.get("jaw").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    engine: v
                        .get("engine")
                        .and_then(|x| x.as_str())
                        .unwrap_or("still-pipe")
                        .to_string(),
                }),
                "track_people" => Some(Cmd::TrackPeople {
                    json: v
                        .get("people")
                        .map(|p| p.to_string())
                        .or_else(|| {
                            v.get("json")
                                .and_then(|x| x.as_str())
                                .map(|s| s.to_string())
                        })
                        .unwrap_or_else(|| "[]".into()),
                }),
                "track_hand" => Some(Cmd::TrackHand {
                    present: v
                        .get("present")
                        .and_then(|x| x.as_bool())
                        .unwrap_or(false),
                    nx: v.get("nx").and_then(|x| x.as_f64()).unwrap_or(0.5),
                    ny: v.get("ny").and_then(|x| x.as_f64()).unwrap_or(0.5),
                    pinch: v.get("pinch").and_then(|x| x.as_f64()).unwrap_or(1.0),
                    expand: v.get("expand").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    conf: v.get("conf").and_then(|x| x.as_f64()).unwrap_or(0.0),
                    engine: v
                        .get("engine")
                        .and_then(|x| x.as_str())
                        .unwrap_or("inspect-hands")
                        .to_string(),
                }),
                _ => None,
            };
            if let Some(cmd) = cmd {
                let _ = proxy.send_event(cmd);
            }
        }
    };
    let handler_main = make_ipc(proxy.clone());
    let handler_insp = make_ipc(proxy.clone());

    // Early paint — long soft glass lip (not cookie-cutter ellipse).
    let shell_clear = r#"
      var de = document.documentElement;
      de.style.background = 'transparent';
      de.style.backgroundColor = 'transparent';
      de.style.borderRadius = '12px';
      de.style.overflow = 'hidden';
      de.style.clipPath = 'none';
      de.style.height = '100%';
      de.style.setProperty('--mg-fill-a', '0.70');
      de.style.setProperty('--mg-drop-w', '110%');
      de.style.setProperty('--mg-drop-h', '106%');
      de.style.setProperty('--mg-drop-core', '62%');
      de.style.setProperty('--mg-drop-mid', '74%');
      de.style.setProperty('--mg-drop-soft', '86%');
      if (document.body) {
        var b = document.body;
        var mask = 'radial-gradient(ellipse 110% 106% at 50% 48%,#fff 0%,#fff 62%,rgba(255,255,255,0.88) 74%,rgba(255,255,255,0.48) 86%,rgba(255,255,255,0.14) 96%,transparent 100%)';
        b.style.background = 'rgba(12,14,18,0.70)';
        b.style.backgroundColor = 'rgba(12,14,18,0.70)';
        b.style.borderRadius = '0';
        b.style.height = '100%';
        b.style.overflowY = 'auto';
        b.style.overflowX = 'hidden';
        b.style.clipPath = 'none';
        b.style.webkitMaskImage = mask;
        b.style.maskImage = mask;
      }
      de.classList.remove('mg-drop-rim');
    "#;

    let webview = WebViewBuilder::new()
        .with_url(&start)
        .with_transparent(true) // requires wry feature "transparent" → drawsBackground=false
        .with_clipboard(true) // Linux/Windows clipboard; macOS uses Edit menu + WKWebView
        .with_initialization_script(shell_clear)
        .with_initialization_script(hud_init_script())
        .with_ipc_handler(handler_main)
        .with_accept_first_mouse(true)
        .build(&window)
        .context("wry WKWebView")?;

    clear_window_bg(&window);
    clear_webview_bg(&webview);

    // ── External inspect float (native NSWindow, docks outside main to the right) ──
    let mut inspect_wb = WindowBuilder::new()
        .with_title(format!("MG Inspect · {ver_short}"))
        .with_inner_size(LogicalSize::new(380.0, 700.0))
        .with_min_inner_size(LogicalSize::new(300.0, 420.0))
        .with_decorations(false)
        .with_transparent(true)
        .with_resizable(true)
        .with_always_on_top(true)
        .with_visible(true);
    if let Some(icon) = app_icon() {
        inspect_wb = inspect_wb.with_window_icon(Some(icon));
    }
    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::WindowBuilderExtMacOS;
        inspect_wb = inspect_wb
            .with_movable_by_window_background(true)
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_titlebar_buttons_hidden(true)
            .with_has_shadow(true);
    }
    let inspect_window = inspect_wb.build(&event_loop).context("inspect window")?;
    clear_window_bg(&inspect_window);
    // Transparent float: native NSShadow reads as a hard black crunch — off; CSS lift only.
    #[cfg(target_os = "macos")]
    {
        use objc::{msg_send, runtime::Object, sel, sel_impl};
        use tao::platform::macos::WindowExtMacOS;
        unsafe {
            let ns = inspect_window.ns_window() as *mut Object;
            if !ns.is_null() {
                let _: () = msg_send![ns, setHasShadow: false];
                let _: () = msg_send![ns, invalidateShadow];
            }
        }
    }
    // Dual-pane default — WebGrid uses left landscape medium + inspect parked
    if webgrid_mode {
        place_for_webgrid_play(&window, Some(&inspect_window));
        eprintln!("  layout : webgrid play · large landscape · 30×30 desktop grid · chrome-safe");
        // Layout CSS expands the play canvas; keep page zoom at 1.0 so grid can fill
        // (zoom < 1 shrank the whole page including Neuralink's max-height cap).
        if let Err(e) = webview.zoom(1.0) {
            eprintln!("webgrid default zoom: {e}");
        } else {
            eprintln!("  zoom   : 1.0 (fill play area via CSS — not shrink)");
        }
    } else {
        tile_browser_and_inspect(&window, &inspect_window, true);
    }

    let inspect_wv = WebViewBuilder::new()
        .with_html(inspect_panel_html())
        .with_transparent(true)
        .with_ipc_handler(handler_insp)
        .with_accept_first_mouse(true)
        .build(&inspect_window)
        .context("inspect webview")?;
    clear_webview_bg(&inspect_wv);

    eprintln!("Memory Glass — portal + cam tricks");
    eprintln!("  shell  : transparent NSWindow + WKWebView");
    eprintln!("  optic  : droplet · LF depth · page-axis (off in YT theater)");
    eprintln!("  cam    : daito/ofxFaceTracker lineage · MediaPipe 468 · SAM-matte · DepthNets voxels");
    eprintln!("  tabs   : three open (spacex · starship · launches)");
    eprintln!("  start  : {start}");
    eprintln!("  inspect: native glass float · right of browser · ⌘⌥I");
    eprintln!("  stamp  : {ver_full}");

    // Version on every live surface
    inject_version_stamp(&webview, run_epoch);
    inject_version_stamp(&inspect_wv, run_epoch);
    // Launch spit goes to the external inspect float (main page also streams via IPC)
    inject_dev_boot_spit(&[&inspect_wv], &start);
    inject_dev_line(&inspect_wv, "ok", &ver_full, "version");
    inject_dev_line(&webview, "ok", &ver_full, "version");
    // Initial hot-pipe inject — LEAN on WebGrid (Intel FPS thrash guard)
    let hotpipe_lean = webgrid_mode;
    inject_live_js_mode(&[&webview, &inspect_wv], hotpipe_lean);

    let main_id = window.id();
    let inspect_id = inspect_window.id();
    let mut webview = Some(webview);
    let mut inspect_wv = Some(inspect_wv);
    let mut inspect_visible = true;
    let mut dev_spit_at = Some(std::time::Instant::now() + std::time::Duration::from_millis(900));
    let mut hot_poll_at = Some(std::time::Instant::now() + std::time::Duration::from_millis(1200));
    let mut live_mtime: Option<std::time::SystemTime> = mtime_of(&hotpipe_dir().join("live.js"));
    let mut hurdles_mtime: Option<std::time::SystemTime> = mtime_of(&hotpipe_dir().join("hurdles.js"));
    let mut research_mtime: Option<std::time::SystemTime> =
        mtime_of(&hotpipe_dir().join("research.js"));
    let mut ego_mtime: Option<std::time::SystemTime> = mtime_of(&hotpipe_dir().join("ego.js"));
    let mut dock_mtime: Option<std::time::SystemTime> =
        mtime_of(&hotpipe_dir().join("inspect-dock.js"));
    let mut mitigate_cooldown: Option<std::time::Instant> = None;
    let mut mitigated_stems: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut agent_push_at: Option<std::time::Instant> = None;
    let mut prefetch_at: Option<std::time::Instant> =
        Some(std::time::Instant::now() + std::time::Duration::from_millis(400));
    let hotpipe_enabled = std::env::var("MG_HOTPIPE_OFF").ok().as_deref() != Some("1");
    let start_for_spit = start.clone();
    eprintln!(
        "  hotpipe: {} lean={} ({})",
        if hotpipe_enabled { "on" } else { "OFF (MG_HOTPIPE_OFF=1)" },
        hotpipe_lean,
        hotpipe_dir().display()
    );

    event_loop.run(move |event, _target, control_flow| {
        let now = std::time::Instant::now();
        // Boot spit
        if let Some(when) = dev_spit_at {
            if now >= when {
                if let Some(wv) = inspect_wv.as_ref() {
                    inject_dev_boot_spit(&[wv], &start_for_spit);
                }
                if hotpipe_enabled {
                    let mut t: Vec<&wry::WebView> = Vec::new();
                    if let Some(wv) = webview.as_ref() {
                        t.push(wv);
                    }
                    if let Some(wv) = inspect_wv.as_ref() {
                        t.push(wv);
                    }
                    inject_live_js_mode(&t, hotpipe_lean);
                }
                if let Some(wv) = webview.as_ref() {
                    inject_version_stamp(wv, run_epoch);
                }
                if let Some(wv) = inspect_wv.as_ref() {
                    inject_version_stamp(wv, run_epoch);
                }
                place_inspect_right_of(&window, &inspect_window);
                dev_spit_at = None;
            }
        }
        if let Some(when) = agent_push_at {
            if now >= when {
                if let Some(wv) = webview.as_ref() {
                    push_prompt_to_webview(wv);
                    push_loop_to_webview(wv);
                    if hotpipe_enabled {
                        inject_live_js_mode(&[wv], hotpipe_lean);
                    }
                    inject_version_stamp(wv, run_epoch);
                }
                agent_push_at = None;
            }
        }
        // Poll live.js + hurdles.js mtime — soft hot-reload without app relaunch
        if hotpipe_enabled && hot_poll_at.map(|t| now >= t).unwrap_or(true) {
            hot_poll_at = Some(now + std::time::Duration::from_millis(1500));
            let p = hotpipe_dir().join("live.js");
            let h = hotpipe_dir().join("hurdles.js");
            let r = hotpipe_dir().join("research.js");
            let e = hotpipe_dir().join("ego.js");
            let d = hotpipe_dir().join("inspect-dock.js");
            let mut changed = false;
            if let Some(mt) = mtime_of(&p) {
                match live_mtime {
                    None => live_mtime = Some(mt),
                    Some(prev) if mt > prev => {
                        live_mtime = Some(mt);
                        changed = true;
                    }
                    _ => {}
                }
            }
            if let Some(mt) = mtime_of(&h) {
                match hurdles_mtime {
                    None => hurdles_mtime = Some(mt),
                    Some(prev) if mt > prev => {
                        hurdles_mtime = Some(mt);
                        changed = true;
                    }
                    _ => {}
                }
            }
            if let Some(mt) = mtime_of(&r) {
                match research_mtime {
                    None => research_mtime = Some(mt),
                    Some(prev) if mt > prev => {
                        research_mtime = Some(mt);
                        changed = true;
                    }
                    _ => {}
                }
            }
            if let Some(mt) = mtime_of(&e) {
                match ego_mtime {
                    None => ego_mtime = Some(mt),
                    Some(prev) if mt > prev => {
                        ego_mtime = Some(mt);
                        changed = true;
                    }
                    _ => {}
                }
            }
            if let Some(mt) = mtime_of(&d) {
                match dock_mtime {
                    None => dock_mtime = Some(mt),
                    Some(prev) if mt > prev => {
                        dock_mtime = Some(mt);
                        changed = true;
                    }
                    _ => {}
                }
            }
            if changed {
                let mut t: Vec<&wry::WebView> = Vec::new();
                if let Some(wv) = webview.as_ref() {
                    t.push(wv);
                }
                if let Some(wv) = inspect_wv.as_ref() {
                    t.push(wv);
                }
                if inject_live_js_mode(&t, hotpipe_lean) {
                    eprintln!("hotpipe: stack reloaded lean={hotpipe_lean}");
                }
            }
        }
        // H5: still-pipe prefetch meta (stat live.jpg — never open a second camera)
        if prefetch_at.map(|t| now >= t).unwrap_or(true) {
            prefetch_at = Some(now + std::time::Duration::from_millis(350));
            let js = still_prefetch_meta_js();
            if let Some(wv) = inspect_wv.as_ref() {
                let _ = wv.evaluate_script(&js);
            }
        }
        // Quiet wake for hot-pipe poll (not a busy spin)
        *control_flow = ControlFlow::WaitUntil(now + std::time::Duration::from_millis(250));

        match event {
            Event::UserEvent(cmd) => match cmd {
                Cmd::Navigate(url) => {
                    if let Some(wv) = webview.as_ref() {
                        let _ = wv.load_url(&url);
                        // Re-spit + re-stamp after tab navigate (page reload wipes HUD)
                        dev_spit_at =
                            Some(std::time::Instant::now() + std::time::Duration::from_millis(1200));
                    }
                }
                Cmd::DevLog { lvl, msg, src } => {
                    // WebGrid playthrough watch: append JSON samples to disk (https page
                    // cannot fetch http://localhost — IPC is the only reliable path).
                    if src == "webgrid-watch" || msg.starts_with("MGW:") {
                        let payload = if let Some(rest) = msg.strip_prefix("MGW:") {
                            rest.to_string()
                        } else {
                            msg.clone()
                        };
                        let watch_dir = std::path::PathBuf::from(
                            std::env::var("HOME").unwrap_or_else(|_| ".".into()),
                        )
                        .join(".panda/mg-soak/watch");
                        let _ = std::fs::create_dir_all(&watch_dir);
                        let line = if payload.trim_start().starts_with('{') {
                            payload
                        } else {
                            serde_json::json!({
                                "kind": "log",
                                "msg": payload,
                                "src": src,
                                "t": std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_millis() as u64)
                                    .unwrap_or(0),
                            })
                            .to_string()
                        };
                        if let Ok(mut f) = std::fs::OpenOptions::new()
                            .create(true)
                            .append(true)
                            .open(watch_dir.join("play.jsonl"))
                        {
                            use std::io::Write;
                            let _ = writeln!(f, "{line}");
                        }
                        let _ = std::fs::write(
                            watch_dir.join("live-summary.json"),
                            &line,
                        );
                        eprintln!("MG_WATCH {line}");
                    }
                    if let Some(wv) = inspect_wv.as_ref() {
                        // Don't spam inspect UI with full JSON every 350ms
                        if src != "webgrid-watch" && !msg.starts_with("MGW:") {
                            inject_dev_line(wv, &lvl, &msg, &src);
                        }
                    }
                    // Auto-show on errors so spit is never missed
                    if lvl == "err" {
                        if !inspect_visible {
                            inspect_window.set_visible(true);
                            inspect_visible = true;
                            place_inspect_right_of(&window, &inspect_window);
                        }
                        // Live mitigations: once per stem per session + cooldown
                        let src_l = src.to_lowercase();
                        let skip = matches!(
                            src_l.as_str(),
                            "mitigation"
                                | "hotpipe"
                                | "clipboard"
                                | "version"
                                | "rust"
                                | "launch.log"
                                | "camera"
                                | "inspect"
                                | "pip"
                        );
                        let cool_ok = mitigate_cooldown
                            .map(|t| std::time::Instant::now() >= t)
                            .unwrap_or(true);
                        if hotpipe_enabled && !skip && cool_ok {
                            if let Some(stem) = mitigation_for_error(&msg) {
                                if !mitigated_stems.contains(stem) {
                                    let mut t: Vec<&wry::WebView> = Vec::new();
                                    if let Some(wv) = webview.as_ref() {
                                        t.push(wv);
                                    }
                                    if let Some(wv) = inspect_wv.as_ref() {
                                        t.push(wv);
                                    }
                                    if apply_mitigation(&t, stem) {
                                        mitigated_stems.insert(stem.to_string());
                                        mitigate_cooldown = Some(
                                            std::time::Instant::now()
                                                + std::time::Duration::from_secs(30),
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
                Cmd::HotReload => {
                    if !hotpipe_enabled {
                        if let Some(wv) = inspect_wv.as_ref() {
                            inject_dev_line(wv, "warn", "hotpipe disabled (MG_HOTPIPE_OFF=1)", "hotpipe");
                        }
                    } else {
                        let mut t: Vec<&wry::WebView> = Vec::new();
                        if let Some(wv) = webview.as_ref() {
                            t.push(wv);
                        }
                        if let Some(wv) = inspect_wv.as_ref() {
                            t.push(wv);
                        }
                        inject_live_js_mode(&t, hotpipe_lean);
                        live_mtime = mtime_of(&hotpipe_dir().join("live.js"));
                    }
                }
                Cmd::HotMitigate { msg } => {
                    if !hotpipe_enabled {
                        // skip
                    } else {
                        let mut t: Vec<&wry::WebView> = Vec::new();
                        if let Some(wv) = webview.as_ref() {
                            t.push(wv);
                        }
                        if let Some(wv) = inspect_wv.as_ref() {
                            t.push(wv);
                        }
                        let cool_ok = mitigate_cooldown
                            .map(|t0| std::time::Instant::now() >= t0)
                            .unwrap_or(true);
                        if !cool_ok {
                            // ignore storm
                        } else if msg.trim().is_empty() {
                            // Manual button: allow re-run, clear stems
                            mitigated_stems.clear();
                            for stem in ["camera_denied", "portal_wrap"] {
                                let _ = apply_mitigation(&t, stem);
                                mitigated_stems.insert(stem.to_string());
                            }
                            mitigate_cooldown = Some(
                                std::time::Instant::now() + std::time::Duration::from_secs(15),
                            );
                        } else if let Some(stem) = mitigation_for_error(&msg) {
                            if !mitigated_stems.contains(stem) && apply_mitigation(&t, stem) {
                                mitigated_stems.insert(stem.to_string());
                                mitigate_cooldown = Some(
                                    std::time::Instant::now() + std::time::Duration::from_secs(30),
                                );
                            }
                        }
                    }
                }
                Cmd::SubmitInspect { dump } => {
                    let path = write_inspect_pack(&dump, &start_for_spit);
                    let pack = format!(
                        "Memory Glass inspect pack\n{}\n\n{}\n\n(path: {})\n",
                        version_label(run_epoch),
                        dump,
                        path.display()
                    );
                    let clip_ok = clipboard_copy_text(&pack);
                    let msg = format!(
                        "Grok pack · {} · clipboard {}",
                        path.display(),
                        if clip_ok { "ok" } else { "fail" }
                    );
                    eprintln!("hotpipe: {msg}");
                    if let Some(wv) = inspect_wv.as_ref() {
                        inject_dev_line(wv, "ok", &msg, "hotpipe");
                    }
                    if let Some(wv) = webview.as_ref() {
                        inject_dev_line(wv, "ok", &msg, "hotpipe");
                    }
                }
                Cmd::OpenAgent => {
                    if let Some(url) = agent_file_url() {
                        if let Some(wv) = webview.as_ref() {
                            let _ = wv.load_url(&url);
                        }
                        agent_push_at =
                            Some(std::time::Instant::now() + std::time::Duration::from_millis(600));
                        if let Some(wv) = inspect_wv.as_ref() {
                            inject_dev_line(wv, "info", &format!("Opened agent · {url}"), "hotpipe");
                        }
                    } else if let Some(wv) = inspect_wv.as_ref() {
                        inject_dev_line(wv, "err", "agent.html missing under hotpipe/", "hotpipe");
                    }
                }
                Cmd::OpenLeaderboard { handoff, post } => {
                    if let Some(ref h) = handoff {
                        let p = write_leaderboard_handoff(h);
                        eprintln!("leaderboard: handoff → {}", p.display());
                    }
                    if let Some(url) = leaderboard_file_url(post) {
                        spawn_new_window(&url);
                        if let Some(wv) = inspect_wv.as_ref() {
                            inject_dev_line(
                                wv,
                                "ok",
                                &format!("Clean leaderboard window · {url}"),
                                "board",
                            );
                        }
                        if let Some(wv) = webview.as_ref() {
                            inject_dev_line(
                                wv,
                                "ok",
                                "Leaderboard window opened · post your run",
                                "board",
                            );
                        }
                    } else if let Some(wv) = inspect_wv.as_ref() {
                        inject_dev_line(
                            wv,
                            "err",
                            "leaderboard.html missing under hotpipe/",
                            "board",
                        );
                    }
                }
                Cmd::HotLoadPrompt => {
                    if let Some(wv) = webview.as_ref() {
                        push_prompt_to_webview(wv);
                    }
                }
                Cmd::HotLoadLoop => {
                    if let Some(wv) = webview.as_ref() {
                        push_loop_to_webview(wv);
                    }
                }
                Cmd::SyncTabs { json } => {
                    if let Some(wv) = inspect_wv.as_ref() {
                        // json is full payload: {"active":n,"tabs":[...]}
                        let payload = if json.trim().starts_with('{') {
                            json
                        } else {
                            format!(r#"{{"tabs":{json},"active":0}}"#)
                        };
                        let js = format!(
                            "(function(){{try{{var d={payload};if(window.__mgInspectSetTabs)window.__mgInspectSetTabs(d.tabs||[],d.active|0);}}catch(e){{}}}})();"
                        );
                        let _ = wv.evaluate_script(&js);
                    }
                }
                Cmd::SyncCfAxis { yaw, pitch, expand } => {
                    if let Some(wv) = inspect_wv.as_ref() {
                        let js = format!(
                            "(function(){{try{{if(window.__mgInspectSetAxis)window.__mgInspectSetAxis({yaw},{pitch},{expand});}}catch(e){{}}}})();"
                        );
                        let _ = wv.evaluate_script(&js);
                    }
                }
                Cmd::SwitchTab { index } => {
                    if let Some(wv) = webview.as_ref() {
                        let js = format!(
                            "(function(){{try{{if(typeof switchTab==='function')switchTab({index});else if(window.__mgSwitchTab)window.__mgSwitchTab({index});}}catch(e){{}}}})();"
                        );
                        let _ = wv.evaluate_script(&js);
                    }
                }
                Cmd::ClipboardCopy { text } => {
                    let ok = clipboard_copy_text(&text);
                    eprintln!(
                        "clipboard: {} ({} bytes)",
                        if ok { "ok" } else { "fail" },
                        text.len()
                    );
                    if let Some(wv) = inspect_wv.as_ref() {
                        inject_dev_line(
                            wv,
                            if ok { "ok" } else { "err" },
                            if ok {
                                "Native clipboard write ok (pbcopy)"
                            } else {
                                "Native clipboard write failed"
                            },
                            "clipboard",
                        );
                    }
                }
                Cmd::DevShow => {
                    inspect_window.set_visible(true);
                    inspect_visible = true;
                    place_inspect_right_of(&window, &inspect_window);
                    inspect_window.set_focus();
                }
                Cmd::DevHide => {
                    inspect_window.set_visible(false);
                    inspect_visible = false;
                }
                Cmd::DevToggle => {
                    inspect_visible = !inspect_visible;
                    inspect_window.set_visible(inspect_visible);
                    if inspect_visible {
                        place_inspect_right_of(&window, &inspect_window);
                        inspect_window.set_focus();
                    }
                }
                Cmd::DevClear => {
                    if let Some(wv) = inspect_wv.as_ref() {
                        let _ = wv.evaluate_script(
                            "(function(){try{if(window.__mgDevClear)window.__mgDevClear();}catch(e){}})();",
                        );
                    }
                }
                Cmd::OpenCameraPrefs => {
                    open_camera_privacy_settings();
                    if let Some(wv) = webview.as_ref() {
                        inject_dev_line(
                            wv,
                            "warn",
                            "Opened System Settings › Camera — enable Memory Glass, then click Cam track",
                            "camera",
                        );
                    }
                    if let Some(wv) = inspect_wv.as_ref() {
                        inject_dev_line(
                            wv,
                            "warn",
                            "Opened System Settings › Camera — enable Memory Glass, then click Cam track",
                            "camera",
                        );
                    }
                }
                Cmd::RequestCameraAccess => {
                    // Explicit Cam / feature request — one OS prompt max per process
                    let ok = request_camera_access_native_opts(true);
                    let msg = if ok {
                        "Camera authorized · session grant active (no re-nag this launch)"
                    } else {
                        "Camera prompt once / pending — allow Memory Glass; won't re-block play every tick"
                    };
                    let lvl = if ok { "ok" } else { "info" };
                    eprintln!("camera: RequestCameraAccess → {msg}");
                    if let Some(wv) = inspect_wv.as_ref() {
                        inject_dev_line(wv, lvl, msg, "camera");
                    }
                    if let Some(wv) = webview.as_ref() {
                        inject_dev_line(wv, lvl, msg, "camera");
                        if ok {
                            let _ = wv.evaluate_script(
                                "(function(){try{localStorage.setItem('mg.camera.session_ok','1');sessionStorage.setItem('mg.camera.session_ok','1');if(window.__mgDevLog)window.__mgDevLog('ok','Native camera authorized · session','camera');}catch(e){}})();",
                            );
                        }
                    }
                }
                Cmd::Back => {
                    if let Some(wv) = webview.as_ref() {
                        let _ = wv.evaluate_script("history.back()");
                    }
                }
                Cmd::Forward => {
                    if let Some(wv) = webview.as_ref() {
                        let _ = wv.evaluate_script("history.forward()");
                    }
                }
                Cmd::Reload => {
                    if let Some(wv) = webview.as_ref() {
                        let _ = wv.evaluate_script("location.reload()");
                    }
                }
                Cmd::Drag => {
                    // System drag once — never flood positions; never tao drag_window
                    // (nil NSApp.currentEvent under async IPC → crash).
                    begin_system_window_drag(&window);
                }
                Cmd::SyntheticClick { x, y } => {
                    // Opt-in autoplay only — never flood (rate-limit hard).
                    // Human mouse always wins; this is scoped to main window content.
                    static LAST_CLICK_MS: std::sync::atomic::AtomicU64 =
                        std::sync::atomic::AtomicU64::new(0);
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                    let prev = LAST_CLICK_MS.load(std::sync::atomic::Ordering::Relaxed);
                    if now.saturating_sub(prev) < 16 {
                        // max ~60/s — never a full-screen click storm
                    } else if x.is_finite() && y.is_finite() && x >= 0.0 && y >= 0.0 {
                        LAST_CLICK_MS.store(now, std::sync::atomic::Ordering::Relaxed);
                        synthetic_webview_click(&window, x, y);
                    }
                }
                Cmd::PageZoom { scale } => {
                    // WebGrid zoom-out so large window shows full 30×30 (not cropped UI).
                    // Do NOT reassert glass here — zoom is spammed from JS interval and
                    // reassert storms were crashing AppKit.
                    static LAST_Z: std::sync::atomic::AtomicU64 =
                        std::sync::atomic::AtomicU64::new(0);
                    // Safari-like range: up to ~2.5 so ⌘+ can reach big-cell 12×12 look
                    let z = if scale.is_finite() {
                        scale.clamp(0.45, 2.5)
                    } else {
                        1.0
                    };
                    // Skip no-op / micro-repeat (encode scale*1000 as u64)
                    let zkey = (z * 1000.0).round() as u64;
                    let prev = LAST_Z.swap(zkey, std::sync::atomic::Ordering::Relaxed);
                    if prev == zkey {
                        // same zoom already applied
                    } else if let Some(wv) = webview.as_ref() {
                        if let Err(e) = wv.zoom(z) {
                            eprintln!("page_zoom: {e}");
                        } else {
                            eprintln!("page_zoom: main → {z:.2}");
                        }
                    }
                }
                Cmd::MediaFeed { media_op, url } => {
                    spawn_media_feed(&media_op, &url);
                }
                Cmd::LoadFilmstrip => {
                    if let Some(wv) = webview.as_ref() {
                        inject_filmstrip_board(wv);
                    }
                }
                Cmd::ReassertGlass => {
                    reassert_all_glass(
                        &window,
                        webview.as_ref(),
                        &inspect_window,
                        inspect_wv.as_ref(),
                    );
                }
                Cmd::ResizeBy { dir, dx, dy } => {
                    // Physical-pixel resize (screenX/Y deltas from JS are already logical-ish;
                    // multiply by scale once and keep size/position in physical units).
                    if dx.is_finite() && dy.is_finite() {
                        let scale = window.scale_factor();
                        if scale.is_finite() && scale > 0.1 && scale < 8.0 {
                            // dx/dy arrive in CSS/logical screen coords from browser
                            let ndx = (dx.clamp(-120.0, 120.0) * scale).round() as i32;
                            let ndy = (dy.clamp(-120.0, 120.0) * scale).round() as i32;
                            if let Ok(pos) = window.outer_position() {
                                let size = window.inner_size(); // physical
                                let mut x = pos.x;
                                let mut y = pos.y;
                                let mut w = size.width as i32;
                                let mut h = size.height as i32;
                                let min_w = (520.0 * scale).round() as i32;
                                let min_h = (400.0 * scale).round() as i32;
                                let d = dir.as_str();
                                if d.contains('e') {
                                    w = (w + ndx).max(min_w);
                                }
                                if d.contains('w') {
                                    let nw = (w - ndx).max(min_w);
                                    x += w - nw;
                                    w = nw;
                                }
                                if d.contains('s') {
                                    h = (h + ndy).max(min_h);
                                }
                                if d.contains('n') {
                                    let nh = (h - ndy).max(min_h);
                                    y += h - nh;
                                    h = nh;
                                }
                                if w > 0 && h > 0 {
                                    use tao::dpi::PhysicalSize;
                                    window.set_outer_position(PhysicalPosition::new(x, y));
                                    let _ = window.set_inner_size(PhysicalSize::new(
                                        w as u32,
                                        h as u32,
                                    ));
                                }
                            }
                        }
                    }
                }
                Cmd::Recenter => {
                    place_on_primary(&window);
                    window.set_focus();
                }
                Cmd::WinClose => {
                    webview.take();
                    inspect_wv.take();
                    *control_flow = ControlFlow::Exit;
                }
                Cmd::WinMinimize => {
                    let _ = window.set_minimized(true);
                }
                Cmd::WinZoom => {
                    let maxed = window.is_maximized();
                    window.set_maximized(!maxed);
                    place_inspect_right_of(&window, &inspect_window);
                }
                Cmd::NewWindow(url) => {
                    let u = if url.trim().is_empty() {
                        HOME_URL
                    } else {
                        url.as_str()
                    };
                    spawn_new_window(u);
                }
                Cmd::MicMute(mute) => {
                    voice_mic_mute(mute);
                    let live = !mute;
                    let js = format!(
                        r#"(function(){{try{{if(window.__mgSetMicState)window.__mgSetMicState({live});if(window.__mgDevLog)window.__mgDevLog('ok','Mic STT {state}','mic');}}catch(e){{}}}})();"#,
                        live = if live { "true" } else { "false" },
                        state = if mute { "muted" } else { "live" },
                    );
                    if let Some(wv) = inspect_wv.as_ref() {
                        let _ = wv.evaluate_script(&js);
                    }
                    if let Some(wv) = webview.as_ref() {
                        let _ = wv.evaluate_script(&js);
                    }
                }
                Cmd::MicStatus => {
                    let muted = voice_mic_is_muted();
                    let live = !muted;
                    let js = format!(
                        r#"(function(){{try{{if(window.__mgSetMicState)window.__mgSetMicState({live});}}catch(e){{}}}})();"#,
                        live = if live { "true" } else { "false" },
                    );
                    if let Some(wv) = inspect_wv.as_ref() {
                        let _ = wv.evaluate_script(&js);
                    }
                }
                Cmd::TileLayout => {
                    tile_browser_and_inspect(&window, &inspect_window, true);
                    inspect_window.set_visible(true);
                    inspect_visible = true;
                    if let Some(wv) = inspect_wv.as_ref() {
                        inject_dev_line(wv, "ok", "Tiled browser + inspect on screen", "layout");
                    }
                }
                Cmd::TrackPose {
                    yaw,
                    pitch,
                    roll,
                    z,
                    nx,
                    ny,
                    conf,
                    smile,
                    brow,
                    jaw,
                    engine,
                } => {
                    // Drive main browser LabViewRay from inspect still-pipe / ofx track
                    if let Some(wv) = webview.as_ref() {
                        let eng = js_single_quote(&engine);
                        let locked = conf > 0.42;
                        let js = format!(
                            r#"(function(){{try{{
  var o={{x:{yaw},y:{pitch},z:{z},roll:{roll},nx:{nx},ny:{ny},
    source:'camera',confidence:{conf},locked:{locked},engine:'{eng}',
    smile:{smile},brow:{brow},jaw:{jaw}}};
  window.__mgRemoteTrack=o;
  if(window.LabViewRay&&typeof window.LabViewRay.set==='function'){{
    window.LabViewRay.set(o);
  }}
  if(typeof window.__mgApplyRemoteTrack==='function')window.__mgApplyRemoteTrack(o);
}}catch(e){{}}}})();"#,
                            yaw = yaw,
                            pitch = pitch,
                            z = z,
                            roll = roll,
                            nx = nx,
                            ny = ny,
                            conf = conf,
                            locked = if locked { "true" } else { "false" },
                            eng = eng,
                            smile = smile,
                            brow = brow,
                            jaw = jaw,
                        );
                        let _ = wv.evaluate_script(&js);
                    }
                }
                Cmd::TrackPeople { json } => {
                    // Multi-persona FOV / occlusion pack → main
                    if let Some(wv) = webview.as_ref() {
                        // json is already a JSON array/object string from serde Value::to_string
                        let safe = json.replace("</", "<\\/");
                        let js = format!(
                            r#"(function(){{try{{
  var people={safe};
  if(!Array.isArray(people)) people=(people&&people.people)||[];
  window.__mgPeople=people;
  if(typeof window.__mgApplyRemotePeople==='function')window.__mgApplyRemotePeople(people);
  else if(typeof window.__mgApplyRemoteTrack==='function'&&people[0]){{
    var p=people[0];
    window.__mgApplyRemoteTrack({{
      x:p.yaw||p.x||0,y:p.pitch||p.y||0,z:p.z||0,roll:p.roll||0,
      nx:p.nx||0.5,ny:p.ny||0.46,confidence:p.conf||0.5,locked:!!(p.conf>0.4),
      engine:p.engine||'multi',persona:p.persona||p.name||''
    }});
  }}
}}catch(e){{}}}})();"#,
                            safe = safe
                        );
                        let _ = wv.evaluate_script(&js);
                    }
                }
                Cmd::TrackHand {
                    present,
                    nx,
                    ny,
                    pinch,
                    expand,
                    conf,
                    engine,
                } => {
                    // H1: inspect hands → main CSS/storage only (hot-pipe thrash guards)
                    if let Some(wv) = webview.as_ref() {
                        let eng = js_single_quote(&engine);
                        let js = format!(
                            r#"(function(){{try{{
  var h={{present:{present},nx:{nx},ny:{ny},pinch:{pinch},expand:{expand},conf:{conf},engine:'{eng}'}};
  window.__mgHand=h;
  if(typeof window.__mgApplyRemoteHand==='function')window.__mgApplyRemoteHand(h);
}}catch(e){{}}}})();"#,
                            present = if present { "true" } else { "false" },
                            nx = nx,
                            ny = ny,
                            pinch = pinch,
                            expand = expand,
                            conf = conf,
                            eng = eng,
                        );
                        let _ = wv.evaluate_script(&js);
                    }
                }
            },
            Event::WindowEvent {
                window_id,
                event: WindowEvent::CloseRequested,
                ..
            } => {
                if window_id == inspect_id {
                    // Hide inspect float — do not quit the browser
                    inspect_window.set_visible(false);
                    inspect_visible = false;
                } else if window_id == main_id {
                    webview.take();
                    inspect_wv.take();
                    *control_flow = ControlFlow::Exit;
                }
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::Moved(_) | WindowEvent::Resized(_),
                ..
            } if window_id == main_id && inspect_visible => {
                place_inspect_right_of(&window, &inspect_window);
                // Debounced — do not queue a second ReassertGlass (that storms)
                reassert_all_glass(
                    &window,
                    webview.as_ref(),
                    &inspect_window,
                    inspect_wv.as_ref(),
                );
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::Moved(_) | WindowEvent::Resized(_),
                ..
            } if window_id == inspect_id => {
                // Inspect dragged to vertical second screen / maximized there
                reassert_all_glass(
                    &window,
                    webview.as_ref(),
                    &inspect_window,
                    inspect_wv.as_ref(),
                );
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::ScaleFactorChanged { scale_factor, .. },
                ..
            } => {
                eprintln!(
                    "glass: ScaleFactorChanged window={:?} scale={scale_factor:.2}",
                    window_id
                );
                reassert_all_glass(
                    &window,
                    webview.as_ref(),
                    &inspect_window,
                    inspect_wv.as_ref(),
                );
            }
            Event::WindowEvent {
                window_id,
                event: WindowEvent::Focused(true),
                ..
            } => {
                // Focus after Spaces / fullscreen exit — debounced reassert only
                if window_id == main_id || window_id == inspect_id {
                    reassert_all_glass(
                        &window,
                        webview.as_ref(),
                        &inspect_window,
                        inspect_wv.as_ref(),
                    );
                }
            }
            // No MainEventsCleared glass heartbeat — that was storming and crashing
            _ => {}
        }
    });
}
