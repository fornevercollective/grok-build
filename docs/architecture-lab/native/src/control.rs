//! SpaceXAI / Grok control bus — HTTP → EventLoopProxy → windows.
//! Lets agents modify/fix layout without embedding Electron.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::sync::Mutex;
use tao::event_loop::EventLoopProxy;

/// Commands the event loop applies to native windows.
#[derive(Debug, Clone)]
pub enum ControlCmd {
    ShowChat,
    HideChat,
    FocusChat,
    FocusLab,
    ToggleChat,
    /// Open chat only (focus chat; lab can stay minimized/background)
    OpenChatIndependent,
    ShowStream,
    HideStream,
    FocusStream,
    ToggleStream,
    /// Agent console: center chat + α/β/γ feeds (agentcn-inspired)
    ShowAgent,
    HideAgent,
    FocusAgent,
    ToggleAgent,
    /// Dock / undock satellite windows relative to lab
    Dock { target: WinTarget },
    Undock { target: WinTarget },
    ToggleDock { target: WinTarget },
    /// Dock all satellites and show them
    LinkAll,
    /// Undock all satellites (leave visible)
    UnlinkAll,
    SetAlwaysOnTop { target: WinTarget, on: bool },
    SetDecorations { target: WinTarget, on: bool },
    Minimize { target: WinTarget },
    Maximize { target: WinTarget },
    Close { target: WinTarget },
    SetPosition { target: WinTarget, x: i32, y: i32 },
    SetSize { target: WinTarget, w: u32, h: u32 },
    Center { target: WinTarget },
    EvalJs { target: WinTarget, script: String },
    ShowError { message: String },
    /// Reload webview(s)
    Refresh { target: WinTarget },
    /// Open check-for-updates (GitHub Pages version.json)
    CheckUpdates,
    /// Start OS window drag (frameless titlebar)
    DragWindow { target: WinTarget },
    /// Edge resize for frameless windows
    DragResize {
        target: WinTarget,
        direction: ResizeDir,
    },
    /// Cursor feedback while hovering resize edges
    CursorHit {
        target: WinTarget,
        x: i32,
        y: i32,
    },
    Ping,
    Quit,
}

/// Resize edge for frameless windows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResizeDir {
    East,
    West,
    North,
    South,
    NorthEast,
    NorthWest,
    SouthEast,
    SouthWest,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WinTarget {
    Lab,
    Chat,
    Stream,
    Agent,
    All,
}

impl Default for WinTarget {
    fn default() -> Self {
        WinTarget::Lab
    }
}

/// Shared between axum (any thread) and the tao event loop (main).
pub struct ControlBus {
    proxy: Mutex<Option<EventLoopProxy<ControlCmd>>>,
    errors: Mutex<VecDeque<ControlError>>,
    status: Mutex<Value>,
    chat_visible: Mutex<bool>,
    stream_visible: Mutex<bool>,
    chat_docked: Mutex<bool>,
    stream_docked: Mutex<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ControlError {
    pub t: u64,
    pub message: String,
    pub source: String,
}

impl ControlBus {
    pub fn new() -> Self {
        Self {
            proxy: Mutex::new(None),
            errors: Mutex::new(VecDeque::new()),
            status: Mutex::new(json!({
                "shell": "architecture-lab-native",
                "ready": false,
            })),
            chat_visible: Mutex::new(false),
            stream_visible: Mutex::new(false),
            chat_docked: Mutex::new(true),
            stream_docked: Mutex::new(true),
        }
    }

    pub fn attach_proxy(&self, proxy: EventLoopProxy<ControlCmd>) {
        *self.proxy.lock().unwrap() = Some(proxy);
        self.set_status(json!({ "ready": true, "shell": "architecture-lab-native" }));
    }

    pub fn send(&self, cmd: ControlCmd) -> Result<(), String> {
        let guard = self.proxy.lock().unwrap();
        let Some(proxy) = guard.as_ref() else {
            return Err("control bus not attached (window not ready)".into());
        };
        proxy
            .send_event(cmd)
            .map_err(|_| "event loop closed".to_string())
    }

    pub fn push_error(&self, message: impl Into<String>, source: impl Into<String>) {
        let err = ControlError {
            t: now_secs(),
            message: message.into(),
            source: source.into(),
        };
        eprintln!("[control] {} ({})", err.message, err.source);
        let mut q = self.errors.lock().unwrap();
        q.push_front(err);
        while q.len() > 50 {
            q.pop_back();
        }
    }

    pub fn errors(&self) -> Vec<ControlError> {
        self.errors.lock().unwrap().iter().cloned().collect()
    }

    pub fn clear_errors(&self) {
        self.errors.lock().unwrap().clear();
    }

    pub fn set_status(&self, v: Value) {
        *self.status.lock().unwrap() = v;
    }

    pub fn status(&self) -> Value {
        self.status.lock().unwrap().clone()
    }

    pub fn set_chat_visible(&self, v: bool) {
        *self.chat_visible.lock().unwrap() = v;
    }

    pub fn chat_visible(&self) -> bool {
        *self.chat_visible.lock().unwrap()
    }

    pub fn set_stream_visible(&self, v: bool) {
        *self.stream_visible.lock().unwrap() = v;
    }

    pub fn stream_visible(&self) -> bool {
        *self.stream_visible.lock().unwrap()
    }

    pub fn set_chat_docked(&self, v: bool) {
        *self.chat_docked.lock().unwrap() = v;
    }

    pub fn chat_docked(&self) -> bool {
        *self.chat_docked.lock().unwrap()
    }

    pub fn set_stream_docked(&self, v: bool) {
        *self.stream_docked.lock().unwrap() = v;
    }

    pub fn stream_docked(&self) -> bool {
        *self.stream_docked.lock().unwrap()
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Body for POST /api/control
#[derive(Debug, Deserialize)]
pub struct ControlRequest {
    /// Action name: show_chat, hide_chat, show_stream, dock_chat, undock_stream, …
    pub action: String,
    #[serde(default)]
    pub target: WinTarget,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub w: Option<u32>,
    pub h: Option<u32>,
    pub on: Option<bool>,
    pub script: Option<String>,
    pub message: Option<String>,
    /// Panda fleet splits (open_panda / spawn_fleet)
    pub splits: Option<u8>,
}

impl ControlRequest {
    pub fn into_cmd(self) -> Result<ControlCmd, String> {
        let a = self.action.trim().to_ascii_lowercase().replace('-', "_");
        match a.as_str() {
            "show_chat" | "open_chat" => Ok(ControlCmd::ShowChat),
            "hide_chat" | "close_chat" => Ok(ControlCmd::HideChat),
            "toggle_chat" => Ok(ControlCmd::ToggleChat),
            "open_chat_independent" | "chat_only" | "independent_chat" => {
                Ok(ControlCmd::OpenChatIndependent)
            }
            "focus_chat" => Ok(ControlCmd::FocusChat),
            "focus_lab" | "focus" => Ok(ControlCmd::FocusLab),
            "show_stream" | "open_stream" | "stream" => Ok(ControlCmd::ShowStream),
            "hide_stream" | "close_stream" => Ok(ControlCmd::HideStream),
            "toggle_stream" => Ok(ControlCmd::ToggleStream),
            "focus_stream" => Ok(ControlCmd::FocusStream),
            "show_agent" | "open_agent" | "agent" | "agent_console" => Ok(ControlCmd::ShowAgent),
            "hide_agent" | "close_agent" => Ok(ControlCmd::HideAgent),
            "toggle_agent" => Ok(ControlCmd::ToggleAgent),
            "focus_agent" => Ok(ControlCmd::FocusAgent),
            "dock" | "dock_window" => Ok(ControlCmd::Dock {
                target: self.target,
            }),
            "undock" | "undock_window" => Ok(ControlCmd::Undock {
                target: self.target,
            }),
            "toggle_dock" => Ok(ControlCmd::ToggleDock {
                target: self.target,
            }),
            "dock_chat" => Ok(ControlCmd::Dock {
                target: WinTarget::Chat,
            }),
            "undock_chat" => Ok(ControlCmd::Undock {
                target: WinTarget::Chat,
            }),
            "dock_stream" => Ok(ControlCmd::Dock {
                target: WinTarget::Stream,
            }),
            "undock_stream" => Ok(ControlCmd::Undock {
                target: WinTarget::Stream,
            }),
            "link" | "link_all" | "dock_all" => Ok(ControlCmd::LinkAll),
            "unlink" | "unlink_all" | "undock_all" => Ok(ControlCmd::UnlinkAll),
            "drag" | "drag_window" => Ok(ControlCmd::DragWindow {
                target: self.target,
            }),
            "pin" | "always_on_top" => Ok(ControlCmd::SetAlwaysOnTop {
                target: self.target,
                on: self.on.unwrap_or(true),
            }),
            "unpin" => Ok(ControlCmd::SetAlwaysOnTop {
                target: self.target,
                on: false,
            }),
            "decorations" | "chrome" => Ok(ControlCmd::SetDecorations {
                target: self.target,
                on: self.on.unwrap_or(true),
            }),
            "minimize" | "min" => Ok(ControlCmd::Minimize {
                target: self.target,
            }),
            "maximize" | "max" => Ok(ControlCmd::Maximize {
                target: self.target,
            }),
            "close" => Ok(ControlCmd::Close {
                target: self.target,
            }),
            "center" => Ok(ControlCmd::Center {
                target: self.target,
            }),
            "move" | "position" => Ok(ControlCmd::SetPosition {
                target: self.target,
                x: self.x.unwrap_or(0),
                y: self.y.unwrap_or(0),
            }),
            "resize" | "size" => Ok(ControlCmd::SetSize {
                target: self.target,
                w: self.w.unwrap_or(480),
                h: self.h.unwrap_or(640),
            }),
            "eval" | "js" | "inject" => {
                let script = self
                    .script
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| "script required for eval".to_string())?;
                Ok(ControlCmd::EvalJs {
                    target: self.target,
                    script,
                })
            }
            "error" | "toast_error" => Ok(ControlCmd::ShowError {
                message: self
                    .message
                    .unwrap_or_else(|| "unknown error".into()),
            }),
            "refresh" | "reload" => Ok(ControlCmd::Refresh {
                target: self.target,
            }),
            "refresh_lab" => Ok(ControlCmd::Refresh {
                target: WinTarget::Lab,
            }),
            "refresh_chat" => Ok(ControlCmd::Refresh {
                target: WinTarget::Chat,
            }),
            "refresh_stream" => Ok(ControlCmd::Refresh {
                target: WinTarget::Stream,
            }),
            "refresh_agent" => Ok(ControlCmd::Refresh {
                target: WinTarget::Agent,
            }),
            "refresh_all" => Ok(ControlCmd::Refresh {
                target: WinTarget::All,
            }),
            "check_updates" | "updates" => Ok(ControlCmd::CheckUpdates),
            "ping" => Ok(ControlCmd::Ping),
            "quit" | "exit" => Ok(ControlCmd::Quit),
            other => Err(format!("unknown action: {other}")),
        }
    }
}
