//! Floating native window — system WebView (WKWebView on macOS).
//! No Electron. No Chromium bundle.

use anyhow::Result;
use std::path::Path;
use tao::{
    dpi::{LogicalPosition, LogicalSize, PhysicalPosition},
    event::{Event, StartCause, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    window::WindowBuilder,
};
use wry::WebViewBuilder;

pub fn run_blocking(url: &str, float: bool, _root: &Path) -> Result<()> {
    let event_loop = EventLoopBuilder::new().build();
    let mut wb = WindowBuilder::new()
        .with_title(if float {
            "architecture-lab · float"
        } else {
            "architecture-lab"
        })
        .with_visible(true)
        .with_resizable(true);

    if float {
        // Compact pod — TUI/tool aesthetic, always above, no OS chrome
        wb = wb
            .with_decorations(false)
            .with_inner_size(LogicalSize::new(480.0, 620.0))
            .with_min_inner_size(LogicalSize::new(340.0, 400.0))
            .with_always_on_top(true)
            .with_transparent(false);
    } else {
        wb = wb
            .with_decorations(true)
            .with_inner_size(LogicalSize::new(1280.0, 860.0))
            .with_min_inner_size(LogicalSize::new(800.0, 560.0));
    }

    let window = wb.build(&event_loop)?;

    // Center on primary monitor
    if let Some(m) = window.current_monitor() {
        let screen = m.size();
        let size = window.outer_size();
        let x = (screen.width as i32 - size.width as i32) / 2;
        let y = (screen.height as i32 - size.height as i32) / 2;
        window.set_outer_position(PhysicalPosition::new(x.max(0), y.max(0)));
    } else {
        window.set_outer_position(LogicalPosition::new(120.0, 80.0));
    }

    let entry = if float {
        format!("{url}#/00-overview")
    } else {
        url.to_string()
    };

    // Inject desktop chrome after load via init script
    let init = r#"
      document.documentElement.classList.add('lab-native','lab-desktop');
      document.body && document.body.classList.add('lab-native','lab-desktop');
      window.LabDesktop = window.LabDesktop || {
        isDesktop: true,
        isNative: true,
        shell: 'wry-wkwebview',
        platform: navigator.platform
      };
      // Center floating walkie once DOM ready
      window.addEventListener('DOMContentLoaded', function(){
        setTimeout(function(){
          try {
            if (window.LabWalkie) {
              LabWalkie.showSiri && LabWalkie.showSiri();
              LabWalkie.centerSiri && LabWalkie.centerSiri();
            }
          } catch (e) {}
        }, 400);
      });
    "#;

    let builder = WebViewBuilder::new()
        .with_url(&entry)
        .with_initialization_script(init)
        .with_devtools(cfg!(debug_assertions));

    #[cfg(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    ))]
    let _webview = builder.build(&window)?;

    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    )))]
    let _webview = {
        use tao::platform::unix::WindowExtUnix;
        use wry::WebViewBuilderExtUnix;
        let vbox = window.default_vbox().unwrap();
        builder.build_gtk(vbox)?
    };

    tracing::info!(%entry, float, "native webview up (system engine)");

    event_loop.run(move |event, _target, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            Event::NewEvents(StartCause::Init) => {}
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => *control_flow = ControlFlow::Exit,
            _ => {}
        }
    });
}
