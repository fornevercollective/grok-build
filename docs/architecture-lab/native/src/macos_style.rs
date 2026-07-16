//! Non-Apple window chrome — soft lab corners (Grok/SpaceXAI float vibe).
//! Intentional: not stock NSWindow chrome; local fornever lab shell.
//!
//! Visual language: chat-orb multi-hue bloom sits *around* the 18px rounded
//! shell (corner glows + rainbow hairline) on every float surface.

#![cfg(target_os = "macos")]

use cocoa::appkit::NSColor;
use cocoa::base::{id, nil, YES};
use objc::{msg_send, sel, sel_impl};
use tao::platform::macos::WindowExtMacOS;
use tao::window::Window;

/// Lab corner radius in points — softer than macOS system sheets (≈10).
pub const LAB_CORNER_RADIUS: f64 = 18.0;

/// Apply fornever-lab rounded shell + transparent host so CSS can soft-clip.
/// Safe to call again after lazy webview attach (re-asserts layer clip).
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

/// CSS fragment for webviews — lab rounded content + chat-orb corner glow + rainbow edge.
/// Targets lab · chat · stream · agent · launch body/html classes.
pub fn lab_round_css() -> &'static str {
    r#"
/* ── Shell: all native float surfaces ─────────────────────────────── */
html.lab-native, html.lab-float,
html.lab-chat-surface, html.lab-stream-surface,
html.lab-agent-surface, html.lab-launch-surface, html.lab-browser-surface,
body.lab-native, body.lab-float,
body.lab-chat-window, body.stream-window,
body.lab-agent-surface, body.lab-launch-surface, body.lab-browser-surface,
body.ac-body, body.lp-body, body.br-body {
  border-radius: 18px !important;
  overflow: hidden !important;
  background-clip: padding-box !important;
}

/* Transparent host + solid interior so corners don't show square fill */
html.lab-native, html.lab-float,
html.lab-chat-surface, html.lab-stream-surface,
html.lab-agent-surface, html.lab-launch-surface, html.lab-browser-surface {
  background: transparent !important;
}

body.lab-native, body.lab-float,
body.lab-chat-window, body.stream-window,
body.lab-agent-surface, body.lab-launch-surface, body.lab-browser-surface,
body.ac-body, body.lp-body, body.br-body {
  position: relative !important;
  /* soft hairline + depth so glow reads against desktop */
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.06) !important;
}

/* ── Chat-orb corner bloom (behind / around rounded shell) ──────────
   Same multi-hue language as .chat-stage::before conic halo —
   sits just inside the 18px radius so it wraps each corner. */
body.lab-native::before, body.lab-float::before,
body.lab-chat-window::before, body.stream-window::before,
body.lab-agent-surface::before, body.lab-launch-surface::before, body.lab-browser-surface::before,
body.ac-body::before, body.lp-body::before, body.br-body::before {
  content: "" !important;
  pointer-events: none !important; /* never block wheel/scroll */
  position: fixed !important;
  inset: 0 !important;
  border-radius: 18px !important;
  z-index: 0 !important; /* below scrollports (z-index 2–5) */
  background:
    radial-gradient(ellipse 55% 48% at 0% 0%, rgba(110, 203, 255, 0.42), transparent 62%),
    radial-gradient(ellipse 55% 48% at 100% 0%, rgba(167, 139, 250, 0.36), transparent 62%),
    radial-gradient(ellipse 55% 48% at 0% 100%, rgba(255, 122, 200, 0.28), transparent 62%),
    radial-gradient(ellipse 55% 48% at 100% 100%, rgba(74, 222, 128, 0.34), transparent 62%),
    radial-gradient(ellipse 70% 40% at 50% 0%, rgba(110, 203, 255, 0.12), transparent 70%) !important;
  filter: blur(16px) !important;
  opacity: 0.72 !important;
  mix-blend-mode: screen !important;
  animation: lab-corner-glow 18s linear infinite !important;
}
@keyframes lab-corner-glow {
  0%, 100% { filter: blur(16px) hue-rotate(0deg); opacity: 0.68; }
  50% { filter: blur(20px) hue-rotate(12deg); opacity: 0.85; }
}

/* ── Continuous rainbow rim (chat-orb palette) ───────────────────── */
body.lab-native::after, body.lab-float::after,
body.lab-chat-window::after, body.stream-window::after,
body.lab-agent-surface::after, body.lab-launch-surface::after, body.lab-browser-surface::after,
body.ac-body::after, body.lp-body::after, body.br-body::after {
  content: "" !important;
  pointer-events: none !important; /* never block wheel/scroll */
  position: fixed !important;
  inset: 0 !important;
  border-radius: 18px !important;
  z-index: 1 !important; /* rim above glow, below interactive UI */
  padding: 1.25px !important;
  background: conic-gradient(
    from 180deg,
    rgba(110, 203, 255, 0.7),
    rgba(167, 139, 250, 0.55),
    rgba(248, 113, 113, 0.5),
    rgba(74, 222, 128, 0.55),
    rgba(110, 203, 255, 0.7)
  ) !important;
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask-composite: exclude !important;
  opacity: 0.62 !important;
  animation: lab-rim-spin 22s linear infinite !important;
}
@keyframes lab-rim-spin {
  to { filter: hue-rotate(360deg); }
}
"#
}
