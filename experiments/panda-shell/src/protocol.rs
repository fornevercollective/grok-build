//! Length-prefixed JSON protocol between client and session daemon.

use std::path::PathBuf;

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;

use crate::layout::{FocusDir, SplitDir};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClientMsg {
    Ping,
    ListSessions,
    /// Create session if missing, then attach this client.
    Attach {
        name: String,
        shell: Option<String>,
        cwd: Option<PathBuf>,
        splits: u8,
        create: bool,
    },
    Detach,
    Kill {
        name: String,
    },
    /// High-level mux action.
    Action(RemoteAction),
    Resize {
        cols: u16,
        rows: u16,
    },
    /// Request a full frame snapshot for painting.
    Snapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RemoteAction {
    SplitHorizontal,
    SplitVertical,
    ClosePane,
    FocusNext,
    FocusPrev,
    FocusDir(FocusDirWire),
    ZoomToggle,
    NewTab,
    NextTab,
    PrevTab,
    PtyBytes(Vec<u8>),
    NextModel,
    PrevModel,
    SelectModel(usize),
    /// Destroy session and leave.
    KillSession,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FocusDirWire {
    Left,
    Right,
    Up,
    Down,
}

impl From<FocusDirWire> for FocusDir {
    fn from(v: FocusDirWire) -> Self {
        match v {
            FocusDirWire::Left => FocusDir::Left,
            FocusDirWire::Right => FocusDir::Right,
            FocusDirWire::Up => FocusDir::Up,
            FocusDirWire::Down => FocusDir::Down,
        }
    }
}

impl From<FocusDir> for FocusDirWire {
    fn from(v: FocusDir) -> Self {
        match v {
            FocusDir::Left => FocusDirWire::Left,
            FocusDir::Right => FocusDirWire::Right,
            FocusDir::Up => FocusDirWire::Up,
            FocusDir::Down => FocusDirWire::Down,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SplitDirWire {
    Horizontal,
    Vertical,
}

impl From<SplitDirWire> for SplitDir {
    fn from(v: SplitDirWire) -> Self {
        match v {
            SplitDirWire::Horizontal => SplitDir::Horizontal,
            SplitDirWire::Vertical => SplitDir::Vertical,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServerMsg {
    Pong,
    SessionList {
        sessions: Vec<SessionInfo>,
    },
    Attached {
        name: String,
    },
    Detached,
    Ok {
        status: String,
    },
    Error {
        message: String,
    },
    Frame(FrameSnapshot),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub name: String,
    pub attached: bool,
    pub panes: usize,
    pub model: String,
    pub created_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameSnapshot {
    pub session: String,
    pub tabs: Vec<String>,
    pub tab_idx: usize,
    pub status_msg: String,
    pub accel: String,
    pub models: Vec<ModelChip>,
    pub active_model: usize,
    pub panes: Vec<PaneSnap>,
    pub body: RectSnap,
    pub model_strip: RectSnap,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelChip {
    pub id: String,
    pub label: String,
    pub backend: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneSnap {
    pub x: u16,
    pub y: u16,
    pub w: u16,
    pub h: u16,
    pub title: String,
    pub focused: bool,
    pub alive: bool,
    pub cursor_row: usize,
    pub cursor_col: usize,
    pub lines: Vec<Vec<RunSnap>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunSnap {
    pub text: String,
    pub fg: Option<String>,
    pub bg: Option<String>,
    pub bold: bool,
    pub dim: bool,
    pub italic: bool,
    pub underline: bool,
    pub inverse: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RectSnap {
    pub x: u16,
    pub y: u16,
    pub w: u16,
    pub h: u16,
}

const MAX_MSG: u32 = 16 * 1024 * 1024;

pub async fn write_msg<T: Serialize>(stream: &mut UnixStream, msg: &T) -> Result<()> {
    let bytes = serde_json::to_vec(msg).context("encode json")?;
    if bytes.len() as u32 > MAX_MSG {
        bail!("message too large: {}", bytes.len());
    }
    stream.write_u32(bytes.len() as u32).await?;
    stream.write_all(&bytes).await?;
    stream.flush().await?;
    Ok(())
}

pub async fn read_msg<T: for<'de> Deserialize<'de>>(stream: &mut UnixStream) -> Result<T> {
    let len = stream.read_u32().await.context("read length")?;
    if len > MAX_MSG {
        bail!("message length {len} exceeds cap");
    }
    let mut buf = vec![0u8; len as usize];
    stream.read_exact(&mut buf).await.context("read body")?;
    serde_json::from_slice(&buf).context("decode json")
}
