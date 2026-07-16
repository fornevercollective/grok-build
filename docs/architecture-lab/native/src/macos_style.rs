//! Non-Apple window chrome — soft lab corners (Grok/SpaceXAI float vibe).
//! Intentional: not stock NSWindow chrome; local fornever lab shell.

#![cfg(target_os = "macos")]

use cocoa::appkit::NSColor;
use cocoa::base::{id, nil, YES};
use objc::{msg_send, sel, sel_impl};
use tao::platform::macos::WindowExtMacOS;
use tao::window::Window;

/// Lab corner radius in points — softer than macOS system sheets (≈10).
pub const LAB_CORNER_RADIUS: f64 = 18.0;

/// Apply fornever-lab rounded shell + transparent host so CSS can soft-clip.
pub fn apply_lab_window_shape(window: &Window) {
    unsafe {
        let ns_win = window.ns_window() as id;
        if ns_win == nil {
            return;
        }

        // Transparent host so rounded layer edges aren't squared by opaque fill.
        let _: () = msg_send![ns_win, setOpaque: false];
        let clear: id = NSColor::clearColor(nil);
        let _: () = msg_send![ns_win, setBackgroundColor: clear];

        // Keep shadow for float pod depth (not flat browser-like).
        let _: () = msg_send![ns_win, setHasShadow: YES];

        // Content view layer: rounded clip (distinct from Apple system radius).
        let content: id = msg_send![ns_win, contentView];
        if content != nil {
            let _: () = msg_send![content, setWantsLayer: YES];
            let layer: id = msg_send![content, layer];
            if layer != nil {
                let _: () = msg_send![layer, setCornerRadius: LAB_CORNER_RADIUS];
                let _: () = msg_send![layer, setMasksToBounds: YES];
            }
        }

        let _: () = msg_send![ns_win, invalidateShadow];
    }
}

/// CSS fragment for webviews — lab rounded content + rainbow edge (not official mark).
pub fn lab_round_css() -> &'static str {
    r#"
html.lab-native, html.lab-float, html.lab-chat-surface, html.lab-stream-surface,
body.lab-native, body.lab-float, body.lab-chat-window, body.stream-window {
  border-radius: 18px !important;
  overflow: hidden !important;
}
body.lab-native, body.lab-float, body.lab-chat-window, body.stream-window {
  /* soft rainbow hairline — lab chrome, not a trademark */
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.06),
    inset 0 0 0 1px transparent;
  background-clip: padding-box;
  position: relative;
}
body.lab-native::before, body.lab-float::before,
body.lab-chat-window::before, body.stream-window::before {
  content: "";
  pointer-events: none;
  position: fixed;
  inset: 0;
  border-radius: 18px;
  z-index: 400;
  box-shadow:
    inset 0 0 0 1px rgba(110,203,255,0.22),
    inset 0 0 24px rgba(167,139,250,0.06);
}
/* continuous rainbow rim */
body.lab-native::after, body.lab-float::after,
body.lab-chat-window::after, body.stream-window::after {
  content: "";
  pointer-events: none;
  position: fixed;
  inset: 0;
  border-radius: 18px;
  z-index: 401;
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(110,203,255,0.55),
    rgba(167,139,250,0.45),
    rgba(248,113,113,0.4),
    rgba(74,222,128,0.45),
    rgba(110,203,255,0.55)
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.55;
}
"#
}
