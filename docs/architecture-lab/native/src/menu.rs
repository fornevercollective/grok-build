//! Native app menu — macOS uses pure Cocoa (no muda).
//!
//! muda 0.15 SIGABRTs on menu actions via `platform_impl/macos/icon.rs`
//! (`to_png` → ZeroWidth unwrap) inside an ObjC callback that cannot unwind.
//! Even without AboutMetadata icons, that path has aborted on macOS 26.
//! Cocoa NSMenu + custom target avoids muda's icon pipeline entirely.

use crate::control::{ControlCmd, WinTarget};
use std::sync::OnceLock;
use tao::event_loop::EventLoopProxy;

#[allow(dead_code)]
pub struct MenuIds {
    pub refresh_lab: String,
    pub refresh_chat: String,
    pub refresh_all: String,
    pub win_lab: String,
    pub win_chat: String,
    pub win_stream: String,
    pub win_both: String,
    pub win_hide_chat: String,
    pub check_updates: String,
}

static MENU_PROXY: OnceLock<EventLoopProxy<ControlCmd>> = OnceLock::new();

pub fn install_menu(proxy: EventLoopProxy<ControlCmd>) -> MenuIds {
    let _ = MENU_PROXY.set(proxy);

    #[cfg(target_os = "macos")]
    install_cocoa_menu();

    MenuIds {
        refresh_lab: "refresh_lab".into(),
        refresh_chat: "refresh_chat".into(),
        refresh_all: "refresh_all".into(),
        win_lab: "win_lab".into(),
        win_chat: "win_chat".into(),
        win_stream: "win_stream".into(),
        win_both: "win_both".into(),
        win_hide_chat: "win_hide_chat".into(),
        check_updates: "check_updates".into(),
    }
}

fn send_cmd(cmd: ControlCmd) {
    if let Some(p) = MENU_PROXY.get() {
        let _ = p.send_event(cmd);
    }
}

fn dispatch_menu_id(id: &str) {
    match id {
        "about" => show_about_panel(),
        "refresh_all" => send_cmd(ControlCmd::Refresh {
            target: WinTarget::All,
        }),
        "refresh_lab" => send_cmd(ControlCmd::Refresh {
            target: WinTarget::Lab,
        }),
        "refresh_chat" => send_cmd(ControlCmd::Refresh {
            target: WinTarget::Chat,
        }),
        "refresh_stream" => send_cmd(ControlCmd::Refresh {
            target: WinTarget::Stream,
        }),
        "refresh_agent" => send_cmd(ControlCmd::Refresh {
            target: WinTarget::Agent,
        }),
        "refresh_launch" => send_cmd(ControlCmd::Refresh {
            target: WinTarget::Launch,
        }),
        "win_lab" => send_cmd(ControlCmd::FocusLab),
        "win_chat" => send_cmd(ControlCmd::ShowChat),
        "win_stream" => send_cmd(ControlCmd::ShowStream),
        "win_both" => {
            send_cmd(ControlCmd::FocusLab);
            send_cmd(ControlCmd::ShowChat);
            send_cmd(ControlCmd::ShowStream);
            send_cmd(ControlCmd::ShowAgent);
            send_cmd(ControlCmd::ShowLaunch);
        },
        "win_hide_chat" => send_cmd(ControlCmd::HideChat),
        "win_hide_stream" => send_cmd(ControlCmd::HideStream),
        "win_hide_agent" => send_cmd(ControlCmd::HideAgent),
        "win_hide_launch" => send_cmd(ControlCmd::HideLaunch),
        "dock_chat" => send_cmd(ControlCmd::Dock {
            target: WinTarget::Chat,
        }),
        "undock_chat" => send_cmd(ControlCmd::Undock {
            target: WinTarget::Chat,
        }),
        "dock_stream" => send_cmd(ControlCmd::Dock {
            target: WinTarget::Stream,
        }),
        "undock_stream" => send_cmd(ControlCmd::Undock {
            target: WinTarget::Stream,
        }),
        "link_all" => send_cmd(ControlCmd::LinkAll),
        "unlink_all" => send_cmd(ControlCmd::UnlinkAll),
        "arrange" => send_cmd(ControlCmd::Arrange),
        "check_updates" => send_cmd(ControlCmd::CheckUpdates),
        "open_agent" => send_cmd(ControlCmd::ShowAgent),
        "open_launch" => send_cmd(ControlCmd::ShowLaunch),
        "open_browser" => send_cmd(ControlCmd::ShowBrowser),
        "open_panda" => open_panda_from_menu(),
        "quit" => send_cmd(ControlCmd::Quit),
        "hide" => hide_app(),
        "hide_others" => hide_others(),
        "show_all" => show_all_windows(),
        "minimize" => send_cmd(ControlCmd::Minimize {
            target: WinTarget::Lab,
        }),
        "fullscreen" => { /* handled by first-responder toggleFullScreen: */ }
        _ => {}
    }
}

fn open_panda_from_menu() {
    let repo = std::env::var("ARCH_LAB_ROOT")
        .ok()
        .map(std::path::PathBuf::from)
        .and_then(|lab| lab.parent().map(|p| p.to_path_buf()))
        .and_then(|docs| docs.parent().map(|p| p.to_path_buf()))
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
        send_cmd(ControlCmd::ShowError {
            message: msg.to_string(),
        });
    }
}

/// System About — CFBundle icon from Info.plist only (never muda PNG).
fn show_about_panel() {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::{id, nil};
        use objc::{class, msg_send, sel, sel_impl};
        unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            if app != nil {
                let _: () = msg_send![app, orderFrontStandardAboutPanel: nil];
            }
        }
    }
}

fn hide_app() {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::{id, nil};
        use objc::{class, msg_send, sel, sel_impl};
        unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            if app != nil {
                let _: () = msg_send![app, hide: nil];
            }
        }
    }
}

fn hide_others() {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::{id, nil};
        use objc::{class, msg_send, sel, sel_impl};
        unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            if app != nil {
                let _: () = msg_send![app, hideOtherApplications: nil];
            }
        }
    }
}

fn show_all_windows() {
    #[cfg(target_os = "macos")]
    {
        use cocoa::base::{id, nil};
        use objc::{class, msg_send, sel, sel_impl};
        unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            if app != nil {
                let _: () = msg_send![app, unhideAllApplications: nil];
            }
        }
    }
}

// ── macOS Cocoa menubar (no muda) ────────────────────────────────────

#[cfg(target_os = "macos")]
fn install_cocoa_menu() {
    use cocoa::appkit::{NSApp, NSApplication, NSMenu, NSMenuItem};
    use cocoa::base::{id, nil};
    use cocoa::foundation::{NSAutoreleasePool, NSString};
    use objc::declare::ClassDecl;
    use objc::runtime::{Object, Sel};
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CStr;
    use std::os::raw::c_char;
    use std::sync::Once;

    static REGISTER: Once = Once::new();
    REGISTER.call_once(|| {
        let superclass = class!(NSObject);
        let mut decl = ClassDecl::new("GrokLabMenuTarget", superclass)
            .expect("declare GrokLabMenuTarget");
        extern "C" fn menu_action(_this: &Object, _cmd: Sel, sender: id) {
            unsafe {
                // representedObject is NSString with action id
                let rep: id = msg_send![sender, representedObject];
                if rep == nil {
                    return;
                }
                let utf8: *const c_char = msg_send![rep, UTF8String];
                if utf8.is_null() {
                    return;
                }
                let id_str = CStr::from_ptr(utf8).to_string_lossy();
                // Never panic across ObjC
                if let Err(payload) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    dispatch_menu_id(&id_str);
                })) {
                    let msg = if let Some(s) = payload.downcast_ref::<&str>() {
                        (*s).to_string()
                    } else if let Some(s) = payload.downcast_ref::<String>() {
                        s.clone()
                    } else {
                        "unknown".into()
                    };
                    eprintln!("[menu] action panic caught: {msg}");
                }
            }
        }
        unsafe {
            decl.add_method(
                sel!(labMenuAction:),
                menu_action as extern "C" fn(&Object, Sel, id),
            );
        }
        decl.register();
    });

    unsafe {
        let pool = NSAutoreleasePool::new(nil);
        let app = NSApp();
        if app == nil {
            let _: () = msg_send![pool, drain];
            return;
        }

        let target: id = msg_send![class!(GrokLabMenuTarget), new];
        let menubar = NSMenu::new(nil).autorelease();

        // ── App menu ──
        let app_menu_item = NSMenuItem::new(nil).autorelease();
        let app_menu = NSMenu::new(nil).autorelease();
        use cocoa::appkit::NSEventModifierFlags;
        let none = NSEventModifierFlags::empty();
        let cmd = NSEventModifierFlags::NSCommandKeyMask;
        let cmd_shift = NSEventModifierFlags::NSCommandKeyMask
            | NSEventModifierFlags::NSShiftKeyMask;
        let cmd_opt = NSEventModifierFlags::NSCommandKeyMask
            | NSEventModifierFlags::NSAlternateKeyMask;
        let cmd_ctrl = NSEventModifierFlags::NSCommandKeyMask
            | NSEventModifierFlags::NSControlKeyMask;

        append_action_item(app_menu, target, "About Grok Build Lab", "about", "", none);
        app_menu.addItem_(NSMenuItem::separatorItem(nil));
        // Services
        let services_item = NSMenuItem::alloc(nil).initWithTitle_action_keyEquivalent_(
            NSString::alloc(nil).init_str("Services"),
            sel!(noop:),
            NSString::alloc(nil).init_str(""),
        );
        let services_menu = NSMenu::new(nil).autorelease();
        let _: () = msg_send![services_item, setSubmenu: services_menu];
        let _: () = msg_send![app, setServicesMenu: services_menu];
        app_menu.addItem_(services_item);
        app_menu.addItem_(NSMenuItem::separatorItem(nil));
        append_action_item(app_menu, target, "Hide Grok Build Lab", "hide", "h", cmd);
        append_action_item(app_menu, target, "Hide Others", "hide_others", "h", cmd_opt);
        append_action_item(app_menu, target, "Show All", "show_all", "", none);
        app_menu.addItem_(NSMenuItem::separatorItem(nil));
        append_action_item(app_menu, target, "Quit Grok Build Lab", "quit", "q", cmd);
        app_menu_item.setSubmenu_(app_menu);
        menubar.addItem_(app_menu_item);

        // ── View ──
        let view_item = NSMenuItem::new(nil).autorelease();
        let view_menu = NSMenu::alloc(nil).initWithTitle_(NSString::alloc(nil).init_str("View"));
        append_action_item(view_menu, target, "Refresh All Windows", "refresh_all", "r", cmd);
        append_action_item(view_menu, target, "Refresh Lab", "refresh_lab", "r", cmd_shift);
        append_action_item(view_menu, target, "Refresh Chat", "refresh_chat", "", none);
        append_action_item(view_menu, target, "Refresh Stream", "refresh_stream", "", none);
        append_action_item(view_menu, target, "Refresh Agent", "refresh_agent", "", none);
        append_action_item(view_menu, target, "Refresh Launch Pad", "refresh_launch", "", none);
        view_menu.addItem_(NSMenuItem::separatorItem(nil));
        // Fullscreen uses first-responder (safe system selector)
        let fs = NSMenuItem::alloc(nil).initWithTitle_action_keyEquivalent_(
            NSString::alloc(nil).init_str("Toggle Full Screen"),
            sel!(toggleFullScreen:),
            NSString::alloc(nil).init_str("f"),
        );
        let _: () = msg_send![fs, setKeyEquivalentModifierMask: cmd_ctrl];
        view_menu.addItem_(fs);
        view_item.setSubmenu_(view_menu);
        menubar.addItem_(view_item);

        // ── Window ──
        let win_item = NSMenuItem::new(nil).autorelease();
        let win_menu = NSMenu::alloc(nil).initWithTitle_(NSString::alloc(nil).init_str("Window"));
        append_action_item(win_menu, target, "Lab Workspace", "win_lab", "1", cmd);
        append_action_item(win_menu, target, "Open Chat Window", "win_chat", "2", cmd);
        append_action_item(win_menu, target, "Open Stream Feed", "win_stream", "3", cmd);
        append_action_item(win_menu, target, "Show All Windows", "win_both", "0", cmd);
        win_menu.addItem_(NSMenuItem::separatorItem(nil));
        append_action_item(win_menu, target, "Open Launch Pad", "open_launch", "o", cmd_shift);
        append_action_item(win_menu, target, "Open Browser", "open_browser", "b", cmd_shift);
        append_action_item(win_menu, target, "Open Agent Console", "open_agent", "a", cmd_shift);
        append_action_item(
            win_menu,
            target,
            "Open Multi-term (Panda / prompt)",
            "open_panda",
            "p",
            cmd_shift,
        );
        win_menu.addItem_(NSMenuItem::separatorItem(nil));
        append_action_item(win_menu, target, "Dock Chat to Lab", "dock_chat", "", none);
        append_action_item(win_menu, target, "Undock Chat", "undock_chat", "", none);
        append_action_item(win_menu, target, "Dock Stream to Lab", "dock_stream", "", none);
        append_action_item(win_menu, target, "Undock Stream", "undock_stream", "", none);
        append_action_item(win_menu, target, "Link All (Dock + Show)", "link_all", "l", cmd_shift);
        append_action_item(win_menu, target, "Unlink All (Undock)", "unlink_all", "", none);
        append_action_item(win_menu, target, "Arrange Windows", "arrange", "y", cmd_shift);
        win_menu.addItem_(NSMenuItem::separatorItem(nil));
        append_action_item(win_menu, target, "Hide Chat Window", "win_hide_chat", "", none);
        append_action_item(win_menu, target, "Hide Stream Feed", "win_hide_stream", "", none);
        append_action_item(win_menu, target, "Hide Agent Console", "win_hide_agent", "", none);
        append_action_item(win_menu, target, "Hide Launch Pad", "win_hide_launch", "", none);
        win_menu.addItem_(NSMenuItem::separatorItem(nil));
        let min_item = NSMenuItem::alloc(nil).initWithTitle_action_keyEquivalent_(
            NSString::alloc(nil).init_str("Minimize"),
            sel!(performMiniaturize:),
            NSString::alloc(nil).init_str("m"),
        );
        win_menu.addItem_(min_item);
        win_item.setSubmenu_(win_menu);
        menubar.addItem_(win_item);
        let _: () = msg_send![app, setWindowsMenu: win_menu];

        // ── Help ──
        let help_item = NSMenuItem::new(nil).autorelease();
        let help_menu = NSMenu::alloc(nil).initWithTitle_(NSString::alloc(nil).init_str("Help"));
        append_action_item(help_menu, target, "Check for Updates...", "check_updates", "", none);
        help_item.setSubmenu_(help_menu);
        menubar.addItem_(help_item);

        app.setMainMenu_(menubar);
        // Keep target alive for the process lifetime (NSMenuItem setTarget retains,
        // but we also stash a strong ref so the class instance cannot be collected).
        static TARGET_SLOT: std::sync::OnceLock<usize> = std::sync::OnceLock::new();
        let _ = TARGET_SLOT.set(target as usize);
        let _: () = msg_send![pool, drain];
    }
}

#[cfg(target_os = "macos")]
unsafe fn append_action_item(
    menu: cocoa::base::id,
    target: cocoa::base::id,
    title: &str,
    action_id: &str,
    key: &str,
    modifiers: cocoa::appkit::NSEventModifierFlags,
) {
    use cocoa::appkit::NSMenuItem;
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::{msg_send, sel, sel_impl};

    let item = NSMenuItem::alloc(nil).initWithTitle_action_keyEquivalent_(
        NSString::alloc(nil).init_str(title),
        sel!(labMenuAction:),
        NSString::alloc(nil).init_str(key),
    );
    let _: () = msg_send![item, setTarget: target];
    // Always apply explicit mask (empty = no modifiers for items without keys).
    let _: () = msg_send![item, setKeyEquivalentModifierMask: modifiers];
    let rep: id = NSString::alloc(nil).init_str(action_id);
    let _: () = msg_send![item, setRepresentedObject: rep];
    let _: () = msg_send![menu, addItem: item];
}
