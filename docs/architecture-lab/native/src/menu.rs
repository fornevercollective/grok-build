//! Native app menu — Refresh · Windows · Check for Updates.
//! Uses `muda` (works with tao on macOS/Windows/Linux).

use crate::control::{ControlCmd, WinTarget};
use muda::{
    accelerator::{Accelerator, Code, Modifiers},
    AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu,
};
use tao::event_loop::EventLoopProxy;

#[allow(dead_code)]
pub struct MenuIds {
    pub refresh_lab: muda::MenuId,
    pub refresh_chat: muda::MenuId,
    pub refresh_all: muda::MenuId,
    pub win_lab: muda::MenuId,
    pub win_chat: muda::MenuId,
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
        let _ = app_m.append_items(&[
            &PredefinedMenuItem::about(
                Some("About Grok Build Lab"),
                Some(AboutMetadata {
                    name: Some("Grok Build Lab".into()),
                    version: Some(env!("CARGO_PKG_VERSION").into()),
                    copyright: Some("Local lab · SpaceXAI / Grok marks © xAI".into()),
                    ..Default::default()
                }),
            ),
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
    let _ = view.append_items(&[
        &refresh_all,
        &refresh_lab,
        &refresh_chat,
        &PredefinedMenuItem::separator(),
        &PredefinedMenuItem::fullscreen(None),
    ]);
    let _ = menu.append(&view);

    // Windows
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
    let win_both = MenuItem::with_id(
        "win_both",
        "Show Both Windows",
        true,
        Some(Accelerator::new(Some(Modifiers::META), Code::Digit0)),
    );
    let win_hide_chat = MenuItem::with_id("win_hide_chat", "Hide Chat Window", true, None);
    let _ = win.append_items(&[
        &win_lab,
        &win_chat,
        &win_both,
        &PredefinedMenuItem::separator(),
        &win_hide_chat,
        &PredefinedMenuItem::separator(),
        &PredefinedMenuItem::minimize(None),
    ]);
    let _ = menu.append(&win);

    // Help / Updates
    let help = Submenu::new("Help", true);
    let check_updates = MenuItem::with_id(
        "check_updates",
        "Check for Updates…",
        true,
        None,
    );
    let _ = help.append(&check_updates);
    let _ = menu.append(&help);

    #[cfg(target_os = "macos")]
    {
        menu.init_for_nsapp();
    }

    // Route menu events → control bus
    let proxy2 = proxy.clone();
    MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
        let id = event.id().0.as_str();
        match id {
            "refresh_all" => {
                let _ = proxy2.send_event(ControlCmd::Refresh {
                    target: WinTarget::All,
                });
            }
            "refresh_lab" => {
                let _ = proxy2.send_event(ControlCmd::Refresh {
                    target: WinTarget::Lab,
                });
            }
            "refresh_chat" => {
                let _ = proxy2.send_event(ControlCmd::Refresh {
                    target: WinTarget::Chat,
                });
            }
            "win_lab" => {
                let _ = proxy2.send_event(ControlCmd::FocusLab);
            }
            "win_chat" => {
                let _ = proxy2.send_event(ControlCmd::OpenChatIndependent);
            }
            "win_both" => {
                let _ = proxy2.send_event(ControlCmd::FocusLab);
                let _ = proxy2.send_event(ControlCmd::OpenChatIndependent);
            }
            "win_hide_chat" => {
                let _ = proxy2.send_event(ControlCmd::HideChat);
            }
            "check_updates" => {
                let _ = proxy2.send_event(ControlCmd::CheckUpdates);
            }
            _ => {}
        }
    }));

    MenuIds {
        refresh_lab: refresh_lab.id().clone(),
        refresh_chat: refresh_chat.id().clone(),
        refresh_all: refresh_all.id().clone(),
        win_lab: win_lab.id().clone(),
        win_chat: win_chat.id().clone(),
        win_both: win_both.id().clone(),
        win_hide_chat: win_hide_chat.id().clone(),
        check_updates: check_updates.id().clone(),
    }
}
