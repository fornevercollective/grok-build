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

/// Dock / window mark — rust-rim superhero shield + cyan glass portal (128×128 RGBA).
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
    Drag,
    Recenter,
    /// Spawn another Memory Glass process (Cmd+N)
    NewWindow(String),
}

fn place_on_primary(window: &Window) {
    let size = window.outer_size();
    if let Some(mon) = window.primary_monitor().or_else(|| window.current_monitor()) {
        let mpos = mon.position();
        let msize = mon.size();
        let x = mpos.x + (msize.width as i32 - size.width as i32) / 2;
        let y = mpos.y + (msize.height as i32 - size.height as i32) / 4;
        window.set_outer_position(PhysicalPosition::new(x.max(mpos.x + 24), y.max(mpos.y + 32)));
        return;
    }
    window.set_outer_position(LogicalPosition::new(80.0, 60.0));
}

/// Make the *native shell* see-through: NSWindow + contentView + WKWebView.
/// Overlay divs cannot show the desktop if the host window paints opaque.
#[cfg(target_os = "macos")]
fn clear_window_bg(window: &Window) {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use tao::platform::macos::WindowExtMacOS;

    unsafe {
        let ns_window = window.ns_window() as *mut Object;
        if ns_window.is_null() {
            return;
        }
        let clear: *mut Object = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setBackgroundColor: clear];
        let _: () = msg_send![ns_window, setOpaque: false];
        // Shadow reads as a black fragmented frame on transparent shells — off for seamless.
        let _: () = msg_send![ns_window, setHasShadow: false];

        // Content view + layer must not fill black behind WKWebView.
        let content: *mut Object = msg_send![ns_window, contentView];
        if !content.is_null() {
            let _: () = msg_send![content, setWantsLayer: true];
            let layer: *mut Object = msg_send![content, layer];
            if !layer.is_null() {
                let cg_clear: *mut Object = msg_send![class!(NSColor), clearColor];
                let cg: *mut std::ffi::c_void = msg_send![cg_clear, CGColor];
                let _: () = msg_send![layer, setBackgroundColor: cg];
                let _: () = msg_send![layer, setOpaque: false];
            }
        }
        let _: () = msg_send![ns_window, invalidateShadow];
    }
}

/// After wry builds the WKWebView, re-assert drawsBackground=false (shell transparency).
#[cfg(target_os = "macos")]
fn clear_webview_bg(webview: &wry::WebView) {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    use wry::WebViewExtMacOS;

    unsafe {
        let wk = webview.webview();
        let wk_ptr = &*wk as *const _ as *mut Object;
        // Private KVC used by wry's `transparent` feature — re-apply post-build.
        let no: *mut Object = msg_send![class!(NSNumber), numberWithBool: false];
        let key: *mut Object = msg_send![class!(NSString), stringWithUTF8String: b"drawsBackground\0".as_ptr()];
        let _: () = msg_send![wk_ptr, setValue: no forKey: key];

        let _: () = msg_send![wk_ptr, setWantsLayer: true];
        let layer: *mut Object = msg_send![wk_ptr, layer];
        if !layer.is_null() {
            let clear: *mut Object = msg_send![class!(NSColor), clearColor];
            let cg: *mut std::ffi::c_void = msg_send![clear, CGColor];
            let _: () = msg_send![layer, setBackgroundColor: cg];
            let _: () = msg_send![layer, setOpaque: false];
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn clear_window_bg(_window: &Window) {}

#[cfg(not(target_os = "macos"))]
fn clear_webview_bg(_webview: &wry::WebView) {}

fn hud_init_script() -> &'static str {
    r##"
(function () {
  if (window.__mgHud) return;
  window.__mgHud = true;

  var OPEN_KEY = "mg.dragon.panel.open";

  /*
   * Seamless droplet: page is NOT scaled (scale leaves a black gap).
   * Lean = overlay parallax only. Aperture = long white feather into transparent shell.
   * Perspective controls live in the fold panel (FOV / lean / tilt / droplet / glow).
   */
  var drop = document.createElement("style");
  drop.id = "mg-droplet-mask";
  drop.textContent = ""
    + "html,body,#__next,#root,#app,main,header,footer,section,div{"
    + "  border-color:transparent!important;"
    + "}"
    + "html,body{"
    + "  background:transparent!important;"
    + "  background-color:transparent!important;"
    + "  box-shadow:none!important;"
    + "  outline:none!important;"
    + "}"
    /* Extra-long feather — eliminates dark premultiply fringing at the lip */
    + "html,body{"
    + "  -webkit-mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    #fff 0%,#fff 42%,"
    + "    rgba(255,255,255,0.97) 54%,"
    + "    rgba(255,255,255,0.75) 64%,"
    + "    rgba(255,255,255,0.4) 74%,"
    + "    rgba(255,255,255,0.15) 84%,"
    + "    rgba(255,255,255,0.04) 92%,"
    + "    transparent 100%);"
    + "  mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    #fff 0%,#fff 42%,"
    + "    rgba(255,255,255,0.97) 54%,"
    + "    rgba(255,255,255,0.75) 64%,"
    + "    rgba(255,255,255,0.4) 74%,"
    + "    rgba(255,255,255,0.15) 84%,"
    + "    rgba(255,255,255,0.04) 92%,"
    + "    transparent 100%);"
    + "  -webkit-mask-mode:alpha;mask-mode:alpha;"
    + "}"
    /* Site sits flat on the glass — no distance float / skew / tilt */
    + "body{"
    + "  min-height:100vh!important;"
    + "  transform:none!important;"
    + "  perspective:none!important;"
    + "}";
  (document.documentElement || document.head).appendChild(drop);

  var css = ""
    + "#mg-root{all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;"
    + "font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;"
    + "color:rgba(244,246,250,0.94)}"
    + "#mg-root *{box-sizing:border-box}"
    /* ── Depth stack: layered parallax + interior room (portal depth) ── */
    + "#mg-lf{"
    + "  position:fixed;inset:0;z-index:0;pointer-events:none;"
    + "  perspective:var(--mg-fov,1600px);perspective-origin:50% 46%;"
    + "  transform-style:preserve-3d;"
    + "  -webkit-mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    #fff 0%,#fff 50%,rgba(255,255,255,0.5) 72%,transparent 100%);"
    + "  mask-image:radial-gradient(ellipse var(--mg-drop-w,86%) var(--mg-drop-h,80%) at 50% 46%,"
    + "    #fff 0%,#fff 50%,rgba(255,255,255,0.5) 72%,transparent 100%)}"
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
    /* Foveated soft ring — sharp center, soft periphery (no-glasses calibration cue) */
    + "#mg-fovea{"
    + "  position:fixed;inset:0;z-index:7;pointer-events:none;"
    + "  background:radial-gradient(circle var(--mg-fovea-r,28%) at var(--mg-fovea-x,50%) var(--mg-fovea-y,46%),"
    + "    transparent 0%,transparent 55%,"
    + "    rgba(255,255,255,0.03) 78%,"
    + "    rgba(255,255,255,0.07) 100%);"
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
    /* Liquid glass rim — irradiance (glow) only on the lip, no outer black */
    + "#mg-lens{"
    + "  position:fixed;inset:5% 6%;z-index:3;pointer-events:none;"
    + "  border-radius:48% 48% 52% 52% / 42% 42% 58% 58%;"
    + "  transform:translate3d(var(--mg-lx,0px),var(--mg-ly,0px),0);"
    + "  will-change:transform;"
    + "  box-shadow:"
    + "    inset 0 0 0 1px rgba(255,255,255,0.5),"
    + "    inset 0 20px 60px rgba(255,255,255,0.2),"
    + "    inset 0 -24px 50px rgba(160,200,255,0.1),"
    + "    0 0 50px 8px rgba(255,255,255,0.14),"
    + "    0 0 90px 20px rgba(140,190,255,0.08);"
    + "  background:"
    + "    radial-gradient(ellipse 65% 48% at 32% 26%,rgba(255,255,255,0.28),transparent 52%),"
    + "    radial-gradient(ellipse 50% 40% at 72% 68%,rgba(120,180,255,0.1),transparent 55%),"
    + "    radial-gradient(ellipse 90% 85% at 50% 50%,transparent 50%,rgba(255,255,255,0.06) 100%);"
    + "  -webkit-mask-image:radial-gradient(ellipse 93% 91% at 50% 48%,"
    + "    transparent 0%,transparent 56%,rgba(0,0,0,0.25) 68%,#000 86%,#000 100%);"
    + "  mask-image:radial-gradient(ellipse 93% 91% at 50% 48%,"
    + "    transparent 0%,transparent 56%,rgba(0,0,0,0.25) 68%,#000 86%,#000 100%);"
    + "  backdrop-filter:blur(8px) saturate(1.45) brightness(1.06);"
    + "  -webkit-backdrop-filter:blur(8px) saturate(1.45) brightness(1.06)}"
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
    /* ── CTRL hang + clean grips (.... white, no bg) + tabs ── */
    + "#mg-dragon{position:fixed;top:0;left:50%;transform:translateX(-50%);"
    + "width:min(760px,96vw);pointer-events:auto;z-index:30;"
    + "display:flex;flex-direction:column;align-items:center;gap:0}"
    + "#mg-tab-row{display:flex;align-items:center;justify-content:center;gap:10px;"
    + "  align-self:center;width:auto;max-width:100%;padding:6px 0 0}"
    + ".mg-grip{"
    + "  appearance:none;border:0;cursor:grab;user-select:none;"
    + "  display:flex;align-items:center;justify-content:center;"
    + "  min-width:48px;min-height:32px;padding:6px 8px;"
    + "  background:transparent;border:none;box-shadow:none;"
    + "  color:#fff;"
    + "  font:700 14px/1 ui-monospace,Menlo,monospace;letter-spacing:0.16em;"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.25);"
    + "  transition:text-shadow .15s,opacity .15s;opacity:0.85}"
    + ".mg-grip:hover{opacity:1;text-shadow:0 0 12px rgba(255,255,255,0.75),0 1px 2px rgba(0,0,0,0.2);"
    + "  background:transparent}"
    + ".mg-grip:active{cursor:grabbing;background:transparent}"
    + "#mg-grip-l,#mg-grip-r{border-radius:0}"
    + "#mg-drag-pad{position:absolute;left:0;right:0;top:0;height:40px;"
    + "  pointer-events:auto;cursor:grab;z-index:0;background:transparent}"
    + "#mg-tab-row{position:relative;z-index:1}"
    /* CTRL — text only, no circle / chip */
    + "#mg-tab{position:relative;flex:0 0 auto;z-index:2;"
    + "appearance:none;cursor:pointer;user-select:none;"
    + "background:transparent;border:none;box-shadow:none;border-radius:0;"
    + "color:#fff;font:600 11px/1 system-ui,sans-serif;"
    + "letter-spacing:0.16em;text-transform:uppercase;"
    + "padding:8px 6px;display:flex;align-items:center;gap:6px;"
    + "text-shadow:0 1px 2px rgba(0,0,0,0.25);"
    + "transition:opacity .15s,text-shadow .15s;opacity:0.9}"
    + "#mg-tab:hover{opacity:1;background:transparent;"
    + "  text-shadow:0 0 12px rgba(255,255,255,0.65),0 1px 2px rgba(0,0,0,0.2)}"
    + "#mg-tab:active{transform:none;background:transparent}"
    + "#mg-tab .hinge{display:none}"
    + "#mg-tab .tab-lbl{display:flex;align-items:center;gap:6px}"
    + "#mg-tab .chev{font-size:10px;color:rgba(255,255,255,0.7);transition:transform .35s cubic-bezier(.2,.9,.2,1)}"
    + "#mg-dragon.is-open #mg-tab .chev{transform:rotate(180deg)}"
    + "#mg-tab .live{width:5px;height:5px;border-radius:50%;background:#4ade80;"
    + "box-shadow:0 0 8px rgba(74,222,128,0.7);animation:mg-pulse 1.8s ease-in-out infinite}"
    + "@keyframes mg-pulse{0%,100%{opacity:1}50%{opacity:.4}}"
    /* Browser tab strip (Cmd+T) */
    + "#mg-tabs{display:flex;align-items:center;justify-content:center;gap:2px;"
    + "  max-width:min(720px,94vw);min-height:22px;"
    + "  overflow-x:auto;padding:2px 4px 6px;scrollbar-width:none}"
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
    + ".mg-btab.on{color:#fff;text-shadow:0 0 10px rgba(255,255,255,0.45)}"
    + ".mg-btab .x{opacity:0.4;font-size:12px;line-height:1;padding:0 2px}"
    + ".mg-btab .x:hover{opacity:1;color:#fff}"
    + "#mg-tab-add{appearance:none;border:0;background:transparent;cursor:pointer;"
    + "  color:rgba(255,255,255,0.55);font:700 14px/1 system-ui;padding:2px 8px}"
    + "#mg-tab-add:hover{color:#fff}"
    + "#mg-panel{overflow:hidden;max-height:0;opacity:0;"
    + "width:min(520px,94vw);align-self:center;"
    + "transform:perspective(900px) rotateX(-18deg);transform-origin:top center;"
    + "transition:max-height .38s cubic-bezier(.2,.85,.2,1),opacity .24s ease,transform .38s cubic-bezier(.2,.85,.2,1);"
    + "background:rgba(255,255,255,0.16);"
    + "backdrop-filter:blur(28px) saturate(1.45);-webkit-backdrop-filter:blur(28px) saturate(1.45);"
    + "border:1px solid rgba(255,255,255,0.22);border-top:0;border-radius:0 0 18px 18px;"
    + "box-shadow:0 16px 40px rgba(0,0,0,0.12),inset 0 1px 0 rgba(255,255,255,0.35)}"
    + "#mg-dragon.is-open #mg-panel{max-height:480px;opacity:1;transform:perspective(900px) rotateX(0)}"
    + "#mg-panel-inner{padding:14px 16px 16px;display:flex;flex-direction:column;gap:11px}"
    + "#mg-panel .hdr{display:flex;justify-content:space-between;align-items:center;"
    + "font:600 9px/1 system-ui;letter-spacing:0.14em;text-transform:uppercase;"
    + "color:rgba(255,255,255,0.55);padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.12)}"
    + "#mg-panel .hdr em{font-style:normal;color:rgba(255,255,255,0.9)}"
    + "#mg-panel .hdr .sys{color:#4ade80}"
    + "#mg-keys{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}"
    + "#mg-keys button{appearance:none;height:36px;border-radius:10px;cursor:pointer;"
    + "border:1px solid rgba(255,255,255,0.2);"
    + "background:rgba(255,255,255,0.1);"
    + "color:rgba(255,255,255,0.9);font:650 10px/1 system-ui;letter-spacing:0.06em;"
    + "text-transform:uppercase;transition:background .15s}"
    + "#mg-keys button:hover{background:rgba(255,255,255,0.2)}"
    + "#mg-keys button.accent{color:#fff;background:rgba(255,255,255,0.18)}"
    /* Perspective control deck */
    + "#mg-persp{display:grid;gap:6px;margin-top:2px}"
    + "#mg-persp label{display:grid;grid-template-columns:72px 1fr 36px;gap:6px;align-items:center;"
    + "  font:600 9px/1 system-ui;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.5)}"
    + "#mg-persp input[type=range]{width:100%;accent-color:#fff}"
    + "#mg-persp .v{font:600 9px ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.65);text-align:right}"
    + "#mg-foot{font:500 9px/1.3 system-ui;color:rgba(255,255,255,0.4);text-align:center;letter-spacing:0.04em}"
    + "#mg-scrim{position:fixed;inset:0;pointer-events:none;opacity:0;z-index:25;"
    + "background:rgba(255,255,255,0.08);transition:opacity .3s}"
    + "#mg-dragon.is-open ~ #mg-scrim{opacity:1;pointer-events:auto}"
    + "#mg-dragon.is-open #mg-panel{max-height:480px}"
    + "#mg-eyes{display:flex;flex-wrap:wrap;gap:4px}"
    + "#mg-eyes button{appearance:none;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.3);"
    + "  border-radius:8px;padding:6px 8px;font:650 9px system-ui;letter-spacing:0.04em;text-transform:uppercase;"
    + "  color:rgba(20,22,28,0.75);cursor:pointer}"
    + "#mg-eyes button.on{background:rgba(20,22,28,0.85);color:#fff;border-color:transparent}"
    + "#mg-calib{font:500 9px/1.35 system-ui;color:rgba(255,255,255,0.42);padding:4px 0 0}"
    + "#mg-modes{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}"
    + "#mg-modes button{appearance:none;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.08);"
    + "  border-radius:8px;padding:6px 8px;font:650 9px system-ui;letter-spacing:0.04em;text-transform:uppercase;"
    + "  color:rgba(255,255,255,0.75);cursor:pointer}"
    + "#mg-modes button.on{background:rgba(255,255,255,0.2);color:#fff;border-color:rgba(255,255,255,0.4)}"
    + "#mg-eyes button{border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.08);"
    + "  color:rgba(255,255,255,0.75)}"
    + "#mg-eyes button.on{background:rgba(255,255,255,0.2);color:#fff;border-color:rgba(255,255,255,0.4)}"
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
    /* Always-on top-left grab — white :: , no background */
    + "#mg-corner-grab{"
    + "  position:fixed;top:10px;left:12px;z-index:60;pointer-events:auto;"
    + "  appearance:none;border:0;cursor:grab;user-select:none;"
    + "  min-width:40px;min-height:36px;padding:6px 10px;"
    + "  border-radius:0;"
    + "  background:transparent;border:none;box-shadow:none;"
    + "  color:#fff;"
    + "  font:700 16px/1 ui-monospace,Menlo,monospace;letter-spacing:0.14em;"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.25);"
    + "  transition:color .15s,text-shadow .15s}"
    + "#mg-corner-grab:hover{color:#fff;text-shadow:0 0 12px rgba(255,255,255,0.7),0 1px 2px rgba(0,0,0,0.2);"
    + "  background:transparent}"
    + "#mg-corner-grab:active{cursor:grabbing;background:transparent}"
    /* Dim veil — find chrome when drop is closed / page is bright */
    + "#mg-dim{"
    + "  position:fixed;inset:0;z-index:55;pointer-events:none;"
    + "  background:rgba(8,10,14,0.55);"
    + "  opacity:0;transition:opacity .35s ease;"
    + "  box-shadow:inset 0 0 0 2px rgba(255,255,255,0.12),"
    + "    inset 0 0 80px rgba(255,255,255,0.06)}"
    + "html.mg-dim-on #mg-dim{opacity:1}"
    + "html.mg-dim-on #mg-corner-grab,"
    + "html.mg-dim-on #mg-search-peek{"
    + "  color:#fff;text-shadow:0 0 14px rgba(255,255,255,0.9),0 1px 3px rgba(0,0,0,0.5)}"
    + "html.mg-dim-on #mg-dragon,"
    + "html.mg-dim-on #mg-search-dock{filter:drop-shadow(0 0 12px rgba(255,255,255,0.35))}"
    /* Bottom search — collapsed · expands on use · auto-hides */
    + "#mg-search-dock{"
    + "  position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));"
    + "  transform:translateX(-50%);z-index:50;pointer-events:auto;"
    + "  display:flex;flex-direction:column;align-items:center}"
    + "#mg-search-peek{"
    + "  appearance:none;border:0;cursor:pointer;user-select:none;"
    + "  padding:6px 10px;border-radius:0;"
    + "  background:transparent;border:none;box-shadow:none;"
    + "  color:#fff;"
    + "  font:700 14px/1 ui-monospace,Menlo,monospace;letter-spacing:0.2em;"
    + "  text-shadow:0 1px 2px rgba(0,0,0,0.25);"
    + "  transition:opacity .25s,transform .25s,text-shadow .15s;opacity:0.9}"
    + "#mg-search-peek:hover{opacity:1;text-shadow:0 0 12px rgba(255,255,255,0.75);"
    + "  background:transparent}"
    + "#mg-search{"
    + "  display:flex;align-items:center;gap:6px;padding:7px 9px;"
    + "  width:min(640px,92vw);border-radius:999px;"
    + "  background:rgba(255,255,255,0.14);"
    + "  backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);"
    + "  border:1px solid rgba(255,255,255,0.28);"
    + "  box-shadow:0 10px 32px rgba(0,0,0,0.12),inset 0 1px 0 rgba(255,255,255,0.4);"
    + "  opacity:0;transform:translateY(10px) scale(0.98);pointer-events:none;"
    + "  max-height:0;overflow:hidden;margin:0;padding-top:0;padding-bottom:0;"
    + "  transition:opacity .26s ease,transform .26s ease,max-height .26s ease,padding .26s}"
    + "#mg-search-dock.is-open #mg-search{"
    + "  opacity:1;transform:translateY(0) scale(1);pointer-events:auto;"
    + "  max-height:72px;padding:7px 9px}"
    + "#mg-search-dock.is-open #mg-search-peek{"
    + "  opacity:0;transform:scale(0.9);pointer-events:none;position:absolute;bottom:0}"
    + "#mg-search-dock:not(.is-open) #mg-search{border-width:0}"
    + "#mg-search form{flex:1;display:flex;gap:6px;min-width:0;margin:0;position:relative}"
    + "#mg-search input{flex:1;min-width:0;height:36px;border-radius:999px;padding:0 14px;"
    + "border:1px solid rgba(255,255,255,0.2);outline:none;"
    + "background:rgba(0,0,0,0.12);color:rgba(255,255,255,0.95);"
    + "font:13px/1 system-ui,sans-serif}"
    + "#mg-search input::placeholder{color:rgba(255,255,255,0.4)}"
    + "#mg-search input:focus{border-color:rgba(255,255,255,0.45);"
    + "box-shadow:0 0 0 3px rgba(255,255,255,0.1);background:rgba(0,0,0,0.18)}"
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
    '<button type="button" id="mg-corner-grab" title="Drag · double-click to dim/undim">::</button>' +
    '<div id="mg-dragon">' +
      '<div id="mg-drag-pad" title="Drag to move"></div>' +
      '<div id="mg-tab-row">' +
        '<button type="button" class="mg-grip" id="mg-grip-l" title="Drag to move">....</button>' +
        '<button type="button" id="mg-tab" aria-expanded="false" aria-controls="mg-panel">' +
          '<span class="tab-lbl"><span class="live"></span>CTRL <span class="chev">▾</span></span>' +
        '</button>' +
        '<button type="button" class="mg-grip" id="mg-grip-r" title="Drag to move">....</button>' +
      '</div>' +
      '<div id="mg-tabs" role="tablist" aria-label="Tabs"></div>' +
      '<div id="mg-panel" role="region" aria-label="Mission controls">' +
        '<div id="mg-panel-inner">' +
          '<div class="hdr"><span>PORTAL · <em>DEPTH</em></span><span class="sys">LIVE</span></div>' +
          '<div id="mg-keys">' +
            '<button type="button" data-op="back">◀</button>' +
            '<button type="button" data-op="forward">▶</button>' +
            '<button type="button" data-op="reload">↻</button>' +
            '<button type="button" class="accent" id="mg-recenter">MAIN</button>' +
          '</div>' +
          '<div id="mg-eyes" role="group" aria-label="Eye presets">' +
            '<button type="button" data-eye="human" class="on">Human</button>' +
            '<button type="button" data-eye="eagle">Eagle</button>' +
            '<button type="button" data-eye="cat">Cat</button>' +
            '<button type="button" data-eye="owl">Owl</button>' +
            '<button type="button" data-eye="fly">Compound</button>' +
            '<button type="button" data-eye="calibrate">No-glasses</button>' +
          '</div>' +
          '<div id="mg-modes" role="group" aria-label="Stereo modes">' +
            '<button type="button" id="mg-ana-toggle">Anaglyph RB</button>' +
            '<button type="button" id="mg-mirror-toggle">Mirror R</button>' +
            '<button type="button" id="mg-focus-toggle" class="on">Hover focus</button>' +
            '<button type="button" id="mg-track-toggle">Cam track</button>' +
          '</div>' +
          '<div id="mg-persp">' +
            '<label>FOV <input type="range" id="mg-c-fov" min="600" max="3200" value="2533"/><span class="v" id="mg-v-fov">2533</span></label>' +
            '<label>Focal <input type="range" id="mg-c-focal" min="20" max="200" value="168"/><span class="v" id="mg-v-focal">168</span></label>' +
            '<label>IPD <input type="range" id="mg-c-ipd" min="0" max="80" value="51"/><span class="v" id="mg-v-ipd">51</span></label>' +
            '<label>Ana <input type="range" id="mg-c-ana" min="0" max="100" value="53"/><span class="v" id="mg-v-ana">53</span></label>' +
            '<label>Accom <input type="range" id="mg-c-accom" min="0" max="100" value="48"/><span class="v" id="mg-v-accom">48</span></label>' +
            '<label>Fovea <input type="range" id="mg-c-fovea" min="10" max="90" value="78"/><span class="v" id="mg-v-fovea">78</span></label>' +
            '<label>Drop <input type="range" id="mg-c-drop" min="0" max="98" value="0"/><span class="v" id="mg-v-drop">0</span></label>' +
            '<label>LF <input type="range" id="mg-c-lf" min="0" max="100" value="80"/><span class="v" id="mg-v-lf">80</span></label>' +
            '<label>Glow <input type="range" id="mg-c-glow" min="0" max="100" value="55"/><span class="v" id="mg-v-glow">55</span></label>' +
            '<label>Follow <input type="range" id="mg-c-follow" min="4" max="28" value="22"/><span class="v" id="mg-v-follow">22</span></label>' +
          '</div>' +
          '<div id="mg-calib">Depth layers · hover focus · anaglyph optional · camera → viewRay</div>' +
          '<div id="mg-foot">FLAT VIEWPORT · 3 TABS · ⌘T / ⌘N / ⌘W</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="mg-scrim"></div>' +
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

  /*
   * Light-field portal + anaglyph multi-stack.
   * viewRay is the single pivot: pointer today → camera tracking later.
   */
  (function portal() {
    var rootEl = document.documentElement;
    var ctrl = {
      /* spacex cool test — Drop climbs 0→80; page stays flat (no lean/tilt float) */
      fov: 2533, focal: 168, ipd: 51, accom: 0.48, fovea: 78,
      drop: 0, lf: 0.80, glow: 0.55, follow: 0.22, lean: 0, tilt: 0,
      ana: 0.53, anaOn: false, mirror: false, hoverFocus: true, camTrack: false
    };
    /* Shared view ray — camera tracking plugs in here later */
    window.LabViewRay = {
      x: 0, y: 0,           // -1..1 view offset
      nx: 0.5, ny: 0.46,    // 0..1 normalized focus on screen
      source: "pointer",    // "pointer" | "camera"
      set: function (o) {
        if (o.x != null) this.x = o.x;
        if (o.y != null) this.y = o.y;
        if (o.nx != null) this.nx = o.nx;
        if (o.ny != null) this.ny = o.ny;
        if (o.source) this.source = o.source;
      }
    };
    /* User spacex.com cool test (slightly see-through):
       FOV 2533 · Focal 168 · IPD 51 · Ana 53 · Accom 48 · Fovea 78 · Drop 55 · LF 80 · Glow? → map:
       FOV, Focal, IPD, Ana, Accom, Fovea, Drop, LF, Follow — Glow from human cool default 55 */
    var EYES = {
      human:     { fov: 2533, focal: 168, ipd: 51, ana: 53, fovea: 78, accom: 48, drop: 80, lf: 80, glow: 55, follow: 22 },
      eagle:     { fov: 900,  focal: 120, ipd: 48, ana: 40, fovea: 14, accom: 70, drop: 82, lf: 70, glow: 55, follow: 12 },
      cat:       { fov: 1400, focal: 40,  ipd: 40, ana: 45, fovea: 35, accom: 55, drop: 88, lf: 60, glow: 70, follow: 14 },
      owl:       { fov: 1100, focal: 80,  ipd: 56, ana: 35, fovea: 22, accom: 30, drop: 90, lf: 50, glow: 45, follow: 10 },
      fly:       { fov: 2400, focal: 25,  ipd: 12, ana: 70, fovea: 55, accom: 80, drop: 92, lf: 85, glow: 80, follow: 18 },
      calibrate: { fov: 1700, focal: 55,  ipd: 18, ana: 25, fovea: 40, accom: 25, drop: 88, lf: 35, glow: 50, follow: 11 }
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
      if (e.drop != null) setSlider("mg-c-drop", e.drop);
      setSlider("mg-c-lf", e.lf);
      setSlider("mg-c-glow", e.glow);
      if (e.follow != null) setSlider("mg-c-follow", e.follow);
      var cal = document.getElementById("mg-calib");
      if (cal) {
        cal.textContent = name === "calibrate"
          ? "No-glasses: low IPD stress · soft fovea · mild depth · mid accommodation"
          : name === "human"
            ? "Human · spacex cool — FOV2533 · focal168 · IPD51 · drop→80 · flat page"
            : ("Eye · " + name + " — focal " + e.focal + " · IPD " + e.ipd + " · fovea " + e.fovea + "%");
      }
    }
    document.querySelectorAll("#mg-eyes button").forEach(function (b) {
      b.addEventListener("click", function () { applyEye(b.getAttribute("data-eye")); });
    });
    function bind(id, key, map, outId) {
      var el = document.getElementById(id);
      var out = document.getElementById(outId);
      if (!el) return;
      function apply() {
        var raw = +el.value;
        ctrl[key] = map(raw);
        if (out) out.textContent = String(raw);
        rootEl.style.setProperty("--mg-fov", ctrl.fov + "px");
        rootEl.style.setProperty("--mg-drop-w", ctrl.drop + "%");
        rootEl.style.setProperty("--mg-drop-h", (ctrl.drop * 0.93).toFixed(1) + "%");
        rootEl.style.setProperty("--mg-ipd", ctrl.ipd + "px");
        rootEl.style.setProperty("--mg-stereo-a", (ctrl.ipd / 80 * 0.22).toFixed(3));
        rootEl.style.setProperty("--mg-fovea-r", ctrl.fovea + "%");
        rootEl.style.setProperty("--mg-ana-a", String(0.25 + ctrl.ana * 0.55));
        /* Anaglyph half-offset grows with IPD; zero at focus plane via dynamic feOffset */
        var half = Math.max(0, ctrl.ipd * 0.22 * (0.4 + ctrl.ana));
        rootEl.style.setProperty("--mg-ana-off", half.toFixed(2) + "px");
        updateAnaglyphFilter(half);
        var g = ctrl.glow;
        var ir = document.getElementById("mg-irradiance");
        var ch = document.getElementById("mg-chroma");
        var ln = document.getElementById("mg-lens");
        if (ir) ir.style.opacity = String(0.45 + g * 0.5);
        if (ch) ch.style.opacity = String(0.35 + g * 0.5);
        if (ln) ln.style.opacity = String(0.5 + g * 0.5);
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
    bind("mg-c-drop", "drop", function (v) { return v; }, "mg-v-drop");
    bind("mg-c-lf", "lf", function (v) { return v / 100; }, "mg-v-lf");
    bind("mg-c-glow", "glow", function (v) { return v / 100; }, "mg-v-glow");
    bind("mg-c-follow", "follow", function (v) { return v / 100; }, "mg-v-follow");

    function toggleBtn(id, key, cls) {
      var b = document.getElementById(id);
      if (!b) return;
      b.addEventListener("click", function () {
        ctrl[key] = !ctrl[key];
        b.classList.toggle("on", ctrl[key]);
        if (cls) rootEl.classList.toggle(cls, ctrl[key]);
        if (key === "mirror") {
          document.getElementById("mg-ana-stack").classList.toggle("mg-ana-mirror", ctrl.mirror);
        }
        if (key === "camTrack") {
          window.LabViewRay.source = ctrl.camTrack ? "camera" : "pointer";
          var cal = document.getElementById("mg-calib");
          if (cal) {
            cal.textContent = ctrl.camTrack
              ? "Cam track armed — feed LabViewRay.set({x,y,nx,ny,source:'camera'}) from Face/webcam"
              : "Pointer viewRay · enable Anaglyph RB for red/cyan glasses";
          }
          if (ctrl.camTrack) startCameraStub();
        }
      });
    }
    toggleBtn("mg-ana-toggle", "anaOn", "mg-ana-on");
    toggleBtn("mg-mirror-toggle", "mirror", null);
    toggleBtn("mg-focus-toggle", "hoverFocus", "mg-focus-on");
    toggleBtn("mg-track-toggle", "camTrack", null);
    document.getElementById("mg-focus-toggle").classList.add("on");
    rootEl.classList.add("mg-focus-on");

    /* Optional: FaceDetector / getUserMedia stub — same viewRay pipeline */
    var camTimer = 0;
    function startCameraStub() {
      if (camTimer) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        var cal = document.getElementById("mg-calib");
        if (cal) cal.textContent = "No camera API — keep pointer or inject LabViewRay from external tracker";
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } })
        .then(function (stream) {
          var v = document.createElement("video");
          v.srcObject = stream;
          v.playsInline = true;
          v.muted = true;
          v.play();
          var canvas = document.createElement("canvas");
          canvas.width = 160; canvas.height = 120;
          var ctx = canvas.getContext("2d", { willReadFrequently: true });
          camTimer = setInterval(function () {
            if (!ctrl.camTrack) {
              stream.getTracks().forEach(function (t) { t.stop(); });
              clearInterval(camTimer); camTimer = 0;
              return;
            }
            if (v.readyState < 2) return;
            ctx.drawImage(v, 0, 0, 160, 120);
            /* Brightness centroid ≈ face proxy until FaceDetector/MediaPipe wired */
            var data = ctx.getImageData(0, 0, 160, 120).data;
            var sx = 0, sy = 0, sw = 0;
            for (var y = 0; y < 120; y += 2) {
              for (var x = 0; x < 160; x += 2) {
                var i = (y * 160 + x) * 4;
                var lum = data[i] * 0.3 + data[i + 1] * 0.5 + data[i + 2] * 0.2;
                if (lum > 90) { sx += x; sy += y; sw++; }
              }
            }
            if (sw > 40) {
              var nx = 1 - sx / sw / 160; /* mirror selfie */
              var ny = sy / sw / 120;
              window.LabViewRay.set({
                x: (nx - 0.5) * 2,
                y: (ny - 0.5) * 2,
                nx: nx,
                ny: ny,
                source: "camera"
              });
            }
          }, 66);
        })
        .catch(function () {
          var cal = document.getElementById("mg-calib");
          if (cal) cal.textContent = "Camera denied — use pointer hover focus or external LabViewRay";
        });
    }

    var tx = 0, ty = 0, fnx = 0.5, fny = 0.46;
    var mx = 0, my = 0, tmx = 0, tmy = 0; /* cursor px (raw + smoothed) */
    var w = window.innerWidth || 1;
    var h = window.innerHeight || 1;
    window.addEventListener("resize", function () {
      w = window.innerWidth || 1;
      h = window.innerHeight || 1;
    }, { passive: true });
    window.addEventListener("pointermove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (window.LabViewRay.source !== "pointer") return;
      var nx = e.clientX / w;
      var ny = e.clientY / h;
      window.LabViewRay.set({
        x: (nx - 0.5) * 2,
        y: (ny - 0.5) * 2,
        nx: nx,
        ny: ny,
        source: "pointer"
      });
    }, { passive: true });

    var planes = [
      { el: document.getElementById("mg-lf-near"), z: 140 },
      { el: document.getElementById("mg-lf-mid"), z: 420 },
      { el: document.getElementById("mg-lf-far"), z: 900 }
    ];

    /* Paint dual anaglyph stacks as mirrored LF silhouettes */
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

    function frame() {
      var f = Math.min(0.32, Math.max(0.04, ctrl.follow));
      /* Pull from shared viewRay (pointer or camera) */
      var ray = window.LabViewRay;
      tx += (ray.x - tx) * f;
      ty += (ray.y - ty) * f;
      fnx += (ray.nx - fnx) * f;
      fny += (ray.ny - fny) * f;
      var vx = tx, vy = ty;

      /* Hover focus: map screen position → focus plane depth bias */
      var focusBias = ctrl.hoverFocus ? ((0.5 - fny) * 120) : 0;
      var focusZ = 80 + ctrl.focal * 6 + focusBias;
      var lf = ctrl.lf;
      var ipd = ctrl.ipd;

      /* Smooth cursor in viewport px — sphere/reticle sit ON the mouse, not half-page low */
      tmx += (mx - tmx) * Math.min(0.45, f * 2.2);
      tmy += (my - tmy) * Math.min(0.45, f * 2.2);
      rootEl.style.setProperty("--mg-mx", (tmx - 36).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-my", (tmy - 24).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-fx", (tmx - 24).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-fy", (tmy - 24).toFixed(1) + "px");
      rootEl.style.setProperty("--mg-fovea-x", (fnx * 100).toFixed(2) + "%");
      rootEl.style.setProperty("--mg-fovea-y", (fny * 100).toFixed(2) + "%");

      planes.forEach(function (p) {
        if (!p.el) return;
        var z = p.z;
        var disparity = ipd * (1 - focusZ / z) * lf;
        var sx = -vx * disparity * 1.4;
        var sy = -vy * disparity * 1.1;
        var defocus = Math.min(1, Math.abs(z - focusZ) / (focusZ + 200));
        var blur = defocus * ctrl.accom * 2.2;
        var sc = 1 + (1 - focusZ / z) * 0.04 * lf;
        p.el.style.transform =
          "translate3d(calc(-50% + " + sx.toFixed(2) + "px), calc(-50% + " + sy.toFixed(2) +
          "px), " + (-z).toFixed(0) + "px) scale(" + sc.toFixed(4) + ")";
        p.el.style.filter = blur > 0.05 ? ("blur(" + blur.toFixed(2) + "px)") : "none";
        p.el.style.opacity = String(0.22 + (1 - defocus * 0.5) * 0.4 * lf);
      });

      paintAnaEyes(vx, vy, focusZ, lf, ipd);

      rootEl.style.setProperty("--mg-im-x", (-vx * 28 * lf).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-im-y", (-vy * 20 * lf).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-im-ry", (vx * 10 * lf).toFixed(3) + "deg");
      rootEl.style.setProperty("--mg-im-rx", (8 + vy * -6 * lf).toFixed(3) + "deg");

      /* Page stays flat on glass — no body skew / tilt / push-back */
      rootEl.style.setProperty("--mg-rx", "0deg");
      rootEl.style.setProperty("--mg-ry", "0deg");
      rootEl.style.setProperty("--mg-px", "0px");
      rootEl.style.setProperty("--mg-py", "0px");
      rootEl.style.setProperty("--mg-pz", "0px");
      rootEl.style.setProperty("--mg-sc", "1");
      rootEl.style.setProperty("--mg-lx", (vx * 3.2).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-ly", (vy * 2.5).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-hx", (vx * -5).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-hy", (vy * -4).toFixed(2) + "px");
      rootEl.style.setProperty("--mg-ang", (200 + vx * 22).toFixed(1) + "deg");
      rootEl.style.setProperty("--mg-fovea-a", (0.4 + ctrl.accom * 0.4).toFixed(3));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    /* Boot human stack, then climb Drop 0 → 80 (general viewing aperture) */
    try {
      applyEye("human");
      setSlider("mg-c-drop", 0);
      ctrl.drop = 0;
      rootEl.style.setProperty("--mg-drop-w", "0%");
      rootEl.style.setProperty("--mg-drop-h", "0%");
      var dropTarget = 80;
      var dropStart = performance.now();
      var dropDur = 1600; /* ms ease-out climb */
      function climbDrop(now) {
        var t = Math.min(1, (now - dropStart) / dropDur);
        /* ease-out cubic */
        var e = 1 - Math.pow(1 - t, 3);
        var v = Math.round(dropTarget * e);
        var el = document.getElementById("mg-c-drop");
        var out = document.getElementById("mg-v-drop");
        if (el) el.value = String(v);
        if (out) out.textContent = String(v);
        ctrl.drop = v;
        rootEl.style.setProperty("--mg-drop-w", v + "%");
        rootEl.style.setProperty("--mg-drop-h", (v * 0.93).toFixed(1) + "%");
        if (t < 1) requestAnimationFrame(climbDrop);
      }
      requestAnimationFrame(climbDrop);
    } catch (e) {}
  })();

  var dragon = document.getElementById("mg-dragon");
  var tab = document.getElementById("mg-tab");
  var urlEl = document.getElementById("mg-url");
  try { urlEl.value = location.href; } catch (e) {}

  function post(msg) {
    try { window.ipc.postMessage(JSON.stringify(msg)); } catch (e) {}
  }

  function setOpen(open) {
    dragon.classList.toggle("is-open", !!open);
    tab.setAttribute("aria-expanded", open ? "true" : "false");
    try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (e) {}
  }

  var prefer = null;
  try { prefer = localStorage.getItem(OPEN_KEY); } catch (e) {}
  if (prefer === "1") setOpen(true);
  else setOpen(false);

  tab.addEventListener("click", function () { setOpen(!dragon.classList.contains("is-open")); });
  document.getElementById("mg-scrim").addEventListener("click", function () { setOpen(false); });

  function startDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    post({ op: "drag" });
  }
  document.getElementById("mg-grip-l").addEventListener("pointerdown", startDrag);
  document.getElementById("mg-grip-r").addEventListener("pointerdown", startDrag);
  document.getElementById("mg-drag-pad").addEventListener("pointerdown", startDrag);
  var cornerGrab = document.getElementById("mg-corner-grab");
  var dimOn = false;
  function setDim(on) {
    dimOn = !!on;
    document.documentElement.classList.toggle("mg-dim-on", dimOn);
    if (cornerGrab) {
      cornerGrab.title = dimOn
        ? "Drag · double-click to undim"
        : "Drag · double-click to dim (find controls)";
    }
  }
  function toggleDim(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setDim(!dimOn);
  }
  if (cornerGrab) {
    cornerGrab.addEventListener("pointerdown", startDrag);
    cornerGrab.addEventListener("dblclick", toggleDim);
  }
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
  function renderTabs() {
    var strip = document.getElementById("mg-tabs");
    if (!strip) return;
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
    var u = url || (browserTabs[activeTab] && browserTabs[activeTab].url) || "https://www.spacex.com/";
    post({ op: "new_window", url: u });
  }
  renderTabs();

  window.addEventListener("keydown", function (e) {
    var t = e.target;
    var tag = (t && t.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable);
    var meta = e.metaKey || e.ctrlKey;
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
    if (meta && (e.key === "w" || e.key === "W") && !typing) {
      e.preventDefault();
      if (browserTabs.length > 1) {
        browserTabs.splice(activeTab, 1);
        if (activeTab >= browserTabs.length) activeTab = browserTabs.length - 1;
        switchTab(activeTab);
      }
      return;
    }
    if (typing) return;
    if (e.key === "d" || e.key === "D") toggleDim(e);
  }, true);
  /* When drop is very low, pulse dim hint so corners are findable */
  (function watchDropForDim() {
    var last = -1;
    setInterval(function () {
      var el = document.getElementById("mg-c-drop");
      if (!el) return;
      var v = +el.value;
      if (v <= 12 && last > 12 && !dimOn) {
        /* just closed down — brief auto-dim to locate chrome */
        setDim(true);
      }
      last = v;
    }, 400);
  })();

  document.getElementById("mg-recenter").addEventListener("click", function (e) {
    e.stopPropagation();
    post({ op: "recenter" });
  });

  /* Search: collapsed ..::.. · expand on click · auto-hide when idle */
  (function searchDock() {
    var dock = document.getElementById("mg-search-dock");
    var peek = document.getElementById("mg-search-peek");
    var bar = document.getElementById("mg-search");
    if (!dock || !peek || !bar) return;
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
      }, 2800);
    }
    peek.addEventListener("click", openSearch);
    bar.addEventListener("pointerdown", function () { clearTimeout(hideT); });
    bar.addEventListener("focusin", function () { clearTimeout(hideT); });
    bar.addEventListener("focusout", function () { armHide(); });
    bar.addEventListener("pointerleave", function () {
      if (document.activeElement !== urlEl) armHide();
    });
  })();

  document.getElementById("mg-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var s = String(urlEl.value || "").trim();
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
    try { document.getElementById("mg-search-dock").classList.remove("is-open"); } catch (err) {}
  });
  root.querySelectorAll("button[data-op]").forEach(function (b) {
    b.addEventListener("click", function () {
      post({ op: b.getAttribute("data-op") });
    });
  });

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
        .unwrap_or_else(|| "https://www.spacex.com/".into());

    let event_loop: EventLoop<Cmd> = EventLoopBuilder::with_user_event().build();
    let proxy = event_loop.create_proxy();

    let mut wb = WindowBuilder::new()
        .with_title("Memory Glass")
        .with_inner_size(LogicalSize::new(1280.0, 860.0))
        .with_min_inner_size(LogicalSize::new(640.0, 480.0))
        .with_decorations(false)
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
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true)
            .with_title_hidden(true)
            .with_has_shadow(false);
    }

    let window = wb.build(&event_loop).context("tao window")?;
    place_on_primary(&window);
    clear_window_bg(&window);
    // Re-apply icon after build (some hosts only honor post-create)
    if let Some(icon) = app_icon() {
        window.set_window_icon(Some(icon));
    }
    window.set_visible(true);
    window.set_focus();

    let proxy_ipc = proxy.clone();
    let handler = move |req: Request<String>| {
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
            "recenter" => Some(Cmd::Recenter),
            "new_window" => {
                let url = v
                    .get("url")
                    .and_then(|x| x.as_str())
                    .unwrap_or("https://www.spacex.com/")
                    .to_string();
                Some(Cmd::NewWindow(url))
            }
            _ => None,
        };
        if let Some(cmd) = cmd {
            let _ = proxy_ipc.send_event(cmd);
        }
    };

    // Early paint: force transparent document BEFORE page CSS (shell must be clear).
    let shell_clear = r#"
      document.documentElement.style.background = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      if (document.body) {
        document.body.style.background = 'transparent';
        document.body.style.backgroundColor = 'transparent';
      }
    "#;

    let webview = WebViewBuilder::new()
        .with_url(&start)
        .with_transparent(true) // requires wry feature "transparent" → drawsBackground=false
        .with_initialization_script(shell_clear)
        .with_initialization_script(hud_init_script())
        .with_ipc_handler(handler)
        .with_accept_first_mouse(true)
        .build(&window)
        .context("wry WKWebView")?;

    clear_window_bg(&window);
    clear_webview_bg(&webview);

    eprintln!("Memory Glass — flat portal viewport");
    eprintln!("  shell  : transparent NSWindow + WKWebView");
    eprintln!("  optic  : droplet · depth layers (page flat, no skew/tilt)");
    eprintln!("  tabs   : three open (spacex · starship · launches)");
    eprintln!("  start  : {start}");

    let mut webview = Some(webview);

    event_loop.run(move |event, _target, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            Event::UserEvent(cmd) => match cmd {
                Cmd::Navigate(url) => {
                    if let Some(wv) = webview.as_ref() {
                        let _ = wv.load_url(&url);
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
                    let _ = window.drag_window();
                }
                Cmd::Recenter => {
                    place_on_primary(&window);
                    window.set_focus();
                }
                Cmd::NewWindow(url) => {
                    if let Ok(exe) = std::env::current_exe() {
                        let _ = std::process::Command::new(exe)
                            .arg(&url)
                            .stdin(std::process::Stdio::null())
                            .stdout(std::process::Stdio::null())
                            .stderr(std::process::Stdio::null())
                            .spawn();
                    }
                }
            },
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                webview.take();
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}
