//! Native app menu — Refresh · Windows (dock/stream) · Check for Updates.
//! Uses `muda` (works with tao on macOS/Windows/Linux).
//!
//! Note: avoid `PredefinedMenuItem::about(Some(AboutMetadata{...}))` on macOS.
//! muda 0.15 can SIGABRT in `platform_impl/macos/icon.rs` (`to_png` → ZeroWidth)
//! when the About path touches `PlatformIcon` across the ObjC menu action
//! (panic in a function that cannot unwind → abort). Use system About instead.

use crate::control::{ControlCmd, WinTarget};
use muda::{
    accelerator::{Accelerator, Code, Modifiers},
    Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu,
};
use std::panic::{catch_unwind, AssertUnwindSafe};
use tao::event_loop::EventLoopProxy;

#[allow(dead_code)]
pub struct MenuIds {
    pub refresh_lab: muda::MenuId,
    pub refresh_chat: muda::MenuId,
    pub refresh_all: muda::MenuId,
    pub win_lab: muda::MenuId,
    pub win_chat: muda::MenuId,
    pub win_stream: muda::MenuId,
    pub win_both: muda::MenuId,
    pub win_hide_chat: muda::MenuId,
    pub check_updates: muda::MenuId,
}

pub fn install_menu(proxy: EventLoopProxy<ControlCmd>) -> MenuIds {
    let menu = Menu::new();

    // App / File
    #[cfg(target_os = "macos")]
    {
        let app_m = Submenu::new("Grok Build Lab", true);
        // Custom About — never use muda PredefinedMenuItem::about with metadata/icon.
        let about = MenuItem::with_id("about", "About Grok Build Lab", true, None);
        let _ = app_m.append_items(&[
            &about,
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::services(None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::hide(None),
            &PredefinedMenuItem::hide_others(None),
            &PredefinedMenuItem::show_all(None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::quit(None),
        ]);
        let _ = menu.append(&app_m);
    }

    // View — refresh
    let view = Submenu::new("View", true);
    let refresh_all = MenuItem::with_id(
        "refresh_all",
        "Refresh All Windows",
        true,
        Some(Accelerator::new(Some(Modifiers::META), Code::KeyR)),
    );
    let refresh_lab = MenuItem::with_id(
        "refresh_lab",
        "Refresh Lab",
        true,
        Some(Accelerator::new(
            Some(Modifiers::META | Modifiers::SHIFT),
            Code::KeyR,
        )),
    );
    let refresh_chat = MenuItem::with_id("refresh_chat", "Refresh Chat", true, None);
    let refresh_stream = MenuItem::with_id("refresh_stream", "Refresh Stream", true, None);
    let refresh_agent = MenuItem::with_id("refresh_agent", "Refresh Agent", true, None);
    let refresh_launch = MenuItem::with_id("refresh_launch", "Refresh Launch Pad", true, None);
    let _ = view.append_items(&[
        &refresh_all,
        &refresh_lab,
        &refresh_chat,
        &refresh_stream,
        &refresh_agent,
        &refresh_launch,
        &PredefinedMenuItem::separator(),
        &PredefinedMenuItem::fullscreen(None),
    ]);
    let _ = menu.append(&view);

    // Windows — open / dock / undock
    let win = Submenu::new("Window", true);
    let win_lab = MenuItem::with_id(
        "win_lab",
        "Lab Workspace",
        true,
        Some(Accelerator::new(Some(Modifiers::META), Code::Digit1)),
    );
    let win_chat = MenuItem::with_id(
        "win_chat",
        "Open Chat Window",
        true,
        Some(Accelerator::new(Some(Modifiers::META), Code::Digit2)),
    );
    let win_stream = MenuItem::with_id(
        "win_stream",
        "Open Stream Feed",
        true,
        Some(Accelerator::new(Some(Modifiers::META), Code::Digit3)),
    );
    let win_both = MenuItem::with_id(
        "win_both",
        "Show All Windows",
        true,
        Some(Accelerator::new(Some(Modifiers::META), Code::Digit0)),
    );
    let win_hide_chat = MenuItem::with_id("win_hide_chat", "Hide Chat Window", true, None);
    let win_hide_stream = MenuItem::with_id("win_hide_stream", "Hide Stream Feed", true, None);
    let dock_chat = MenuItem::with_id("dock_chat", "Dock Chat to Lab", true, None);
    let undock_chat = MenuItem::with_id("undock_chat", "Undock Chat", true, None);
    let dock_stream = MenuItem::with_id("dock_stream", "Dock Stream to Lab", true, None);
    let undock_stream = MenuItem::with_id("undock_stream", "Undock Stream", true, None);
    let link_all = MenuItem::with_id(
        "link_all",
        "Link All (Dock + Show)",
        true,
        Some(Accelerator::new(
            Some(Modifiers::META | Modifiers::SHIFT),
            Code::KeyL,
        )),
    );
    let unlink_all = MenuItem::with_id("unlink_all", "Unlink All (Undock)", true, None);
    let arrange = MenuItem::with_id(
        "arrange",
        "Arrange Windows",
        true,
        Some(Accelerator::new(
            Some(Modifiers::META | Modifiers::SHIFT),
            Code::KeyY,
        )),
    );
    let open_launch = MenuItem::with_id(
        "open_launch",
        "Open Launch Pad",
        true,
        Some(Accelerator::new(
            Some(Modifiers::META | Modifiers::SHIFT),
            Code::KeyO,
        )),
    );
    let open_browser = MenuItem::with_id(
        "open_browser",
        "Open Browser",
        true,
        Some(Accelerator::new(
            Some(Modifiers::META | Modifiers::SHIFT),
            Code::KeyB,
        )),
    );
    let open_agent = MenuItem::with_id(
        "open_agent",
        "Open Agent Console",
        true,
        Some(Accelerator::new(
            Some(Modifiers::META | Modifiers::SHIFT),
            Code::KeyA,
        )),
    );
    let open_panda = MenuItem::with_id(
        "open_panda",
        "Open Multi-term (Panda / prompt)",
        true,
        Some(Accelerator::new(
            Some(Modifiers::META | Modifiers::SHIFT),
            Code::KeyP,
        )),
    );
    let win_hide_agent = MenuItem::with_id("win_hide_agent", "Hide Agent Console", true, None);
    let win_hide_launch = MenuItem::with_id("win_hide_launch", "Hide Launch Pad", true, None);
    let _ = win.append_items(&[
        &win_lab,
        &win_chat,
        &win_stream,
        &win_both,
        &PredefinedMenuItem::separator(),
        &open_launch,
        &open_browser,
        &open_agent,
        &open_panda,
        &PredefinedMenuItem::separator(),
        &dock_chat,
        &undock_chat,
        &dock_stream,
        &undock_stream,
        &link_all,
        &unlink_all,
        &arrange,
        &PredefinedMenuItem::separator(),
        &win_hide_chat,
        &win_hide_stream,
        &win_hide_agent,
        &win_hide_launch,
        &PredefinedMenuItem::separator(),
        &PredefinedMenuItem::minimize(None),
    ]);
    let _ = menu.append(&win);

    // Help / Updates
    let help = Submenu::new("Help", true);
    // ASCII ellipsis — avoid fancy unicode in menu titles where possible
    let check_updates = MenuItem::with_id("check_updates", "Check for Updates...", true, None);
    let _ = help.append(&check_updates);
    let _ = menu.append(&help);

    #[cfg(target_os = "macos")]
    {
        menu.init_for_nsapp();
    }

    let proxy2 = proxy.clone();
    MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
        // Menu actions run under AppKit (cannot unwind). Never let a Rust panic
        // become SIGABRT mid-sendAction.
        let result = catch_unwind(AssertUnwindSafe(|| {
            dispatch_menu_event(event.id().0.as_str(), &proxy2);
        }));
        if let Err(payload) = result {
            let msg = panic_message(&payload);
            eprintln!("[menu] panic caught (menu action): {msg}");
            tracing::error!(%msg, "menu action panic caught");
        }
    }));

    MenuIds {
        refresh_lab: refresh_lab.id().clone(),
        refresh_chat: refresh_chat.id().clone(),
        refresh_all: refresh_all.id().clone(),
        win_lab: win_lab.id().clone(),
        win_chat: win_chat.id().clone(),
        win_stream: win_stream.id().clone(),
        win_both: win_both.id().clone(),
        win_hide_chat: win_hide_chat.id().clone(),
        check_updates: check_updates.id().clone(),
    }
}

fn dispatch_menu_event(id: &str, proxy: &EventLoopProxy<ControlCmd>) {
    match id {
        "about" => {
            show_about_panel();
        }
        "refresh_all" => {
            let _ = proxy.send_event(ControlCmd::Refresh {
                target: WinTarget::All,
            });
        }
        "refresh_lab" => {
            let _ = proxy.send_event(ControlCmd::Refresh {
                target: WinTarget::Lab,
            });
        }
        "refresh_chat" => {
            let _ = proxy.send_event(ControlCmd::Refresh {
                target: WinTarget::Chat,
            });
        }
        "refresh_stream" => {
            let _ = proxy.send_event(ControlCmd::Refresh {
                target: WinTarget::Stream,
            });
        }
        "refresh_agent" => {
            let _ = proxy.send_event(ControlCmd::Refresh {
                target: WinTarget::Agent,
            });
        }
        "refresh_launch" => {
            let _ = proxy.send_event(ControlCmd::Refresh {
                target: WinTarget::Launch,
            });
        }
        "win_lab" => {
            let _ = proxy.send_event(ControlCmd::FocusLab);
        }
        "win_chat" => {
            let _ = proxy.send_event(ControlCmd::ShowChat);
        }
        "win_stream" => {
            let _ = proxy.send_event(ControlCmd::ShowStream);
        }
        "win_both" => {
            let _ = proxy.send_event(ControlCmd::FocusLab);
            let _ = proxy.send_event(ControlCmd::ShowChat);
            let _ = proxy.send_event(ControlCmd::ShowStream);
            let _ = proxy.send_event(ControlCmd::ShowAgent);
            let _ = proxy.send_event(ControlCmd::ShowLaunch);
        }
        "win_hide_chat" => {
            let _ = proxy.send_event(ControlCmd::HideChat);
        }
        "win_hide_stream" => {
            let _ = proxy.send_event(ControlCmd::HideStream);
        }
        "win_hide_agent" => {
            let _ = proxy.send_event(ControlCmd::HideAgent);
        }
        "win_hide_launch" => {
            let _ = proxy.send_event(ControlCmd::HideLaunch);
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
        "link_all" => {
            let _ = proxy.send_event(ControlCmd::LinkAll);
        }
        "unlink_all" => {
            let _ = proxy.send_event(ControlCmd::UnlinkAll);
        }
        "arrange" => {
            let _ = proxy.send_event(ControlCmd::Arrange);
        }
        "check_updates" => {
            let _ = proxy.send_event(ControlCmd::CheckUpdates);
        }
        "open_agent" => {
            let _ = proxy.send_event(ControlCmd::ShowAgent);
        }
        "open_launch" => {
            let _ = proxy.send_event(ControlCmd::ShowLaunch);
        }
        "open_browser" => {
            let _ = proxy.send_event(ControlCmd::ShowBrowser);
        }
        "open_panda" => {
            // Spawn Panda off the menu thread — no window ControlCmd required.
            // Resolve monorepo from ARCH_LAB_ROOT or walk from cwd.
            let repo = std::env::var("ARCH_LAB_ROOT")
                .ok()
                .map(std::path::PathBuf::from)
                .and_then(|lab| lab.parent().map(|p| p.to_path_buf())) // architecture-lab → docs
                .and_then(|docs| docs.parent().map(|p| p.to_path_buf())) // docs → repo
                .or_else(|| {
                    let mut p = std::env::current_dir().ok()?;
                    for _ in 0..8 {
                        if p.join("experiments/panda-shell").is_dir() {
                            return Some(p);
                        }
                        if !p.pop() {
                            break;
                        }
                    }
                    None
                })
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
            let out = crate::fleet::open_panda_fleet(&repo, 3);
            if out.get("ok").and_then(|v| v.as_bool()) != Some(true) {
                let msg = out
                    .get("message")
                    .or_else(|| out.get("mitigation"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("open panda failed");
                eprintln!("[menu] open_panda: {msg}");
                let _ = proxy.send_event(ControlCmd::ShowError {
                    message: msg.to_string(),
                });
            }
        }
        _ => {}
    }
}

/// System About panel — uses CFBundle icon/name from Info.plist, no muda Icon path.
fn show_about_panel() {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::{id, nil};
        use objc::{class, msg_send, sel, sel_impl};
        // orderFrontStandardAboutPanel: is safe; never convert muda RgbaIcon → PNG.
        let result = catch_unwind(AssertUnwindSafe(|| unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            if app != nil {
                let _: () = msg_send![app, orderFrontStandardAboutPanel: nil];
            }
        }));
        if let Err(payload) = result {
            let msg = panic_message(&payload);
            eprintln!("[menu] about panel failed: {msg}");
            // Fallback: osascript dialog
            let _ = std::process::Command::new("osascript")
                .arg("-e")
                .arg(format!(
                    r#"display dialog "Grok Build Lab {}" with title "About Grok Build Lab" buttons {{"OK"}} default button "OK""#,
                    env!("CARGO_PKG_VERSION")
                ))
                .spawn();
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = env!("CARGO_PKG_VERSION");
    }
}

fn panic_message(payload: &Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = payload.downcast_ref::<&str>() {
        (*s).to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "unknown panic".into()
    }
}
