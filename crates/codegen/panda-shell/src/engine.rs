//! Session engine — owns PTYs, layout, model router (daemon-side).

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;

use crate::accel::{self, AccelReport};
use crate::layout::{FocusDir, Node, PaneId, Rect, RemoveResult, SplitDir};
use crate::models::ModelRouter;
use crate::pane::Pane;
use crate::protocol::{FrameSnapshot, PaneSnap, RectSnap, RunSnap, SessionInfo};

#[derive(Clone)]
pub struct SessionConfig {
    pub name: String,
    pub shell: Option<String>,
    pub cwd: Option<PathBuf>,
    pub initial_splits: u8,
}

struct Tab {
    name: String,
    root: Node,
    focus: PaneId,
    panes: HashMap<PaneId, Pane>,
    zoom: Option<PaneId>,
}

pub struct SessionEngine {
    pub name: String,
    cfg: SessionConfig,
    tabs: Vec<Tab>,
    tab_idx: usize,
    next_id: u64,
    pub models: ModelRouter,
    pub accel: AccelReport,
    pub status_msg: String,
    /// Number of connected clients (TUI / window). Detach only when zero.
    pub attached_clients: u32,
    pub created_ms: u64,
    /// Last client terminal body size (for frame layout).
    body_cols: u16,
    body_rows: u16,
    term_cols: u16,
    term_rows: u16,
}

impl SessionEngine {
    pub async fn create(cfg: SessionConfig) -> Result<Self> {
        let created_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let name = cfg.name.clone();
        let mut eng = Self {
            name: name.clone(),
            cfg: cfg.clone(),
            tabs: Vec::new(),
            tab_idx: 0,
            next_id: 1,
            models: ModelRouter::load(),
            accel: accel::detect(),
            status_msg: format!("session `{name}` ready · C-a d detach"),
            attached_clients: 0,
            created_ms,
            body_cols: 80,
            body_rows: 24,
            term_cols: 100,
            term_rows: 30,
        };
        eng.new_tab("main").await?;
        let n = eng.cfg.initial_splits.min(4);
        for i in 0..n {
            if i % 2 == 0 {
                eng.split(SplitDir::Horizontal).await?;
            } else {
                eng.split(SplitDir::Vertical).await?;
            }
        }
        Ok(eng)
    }

    pub fn info(&self) -> SessionInfo {
        let panes = self.tabs.iter().map(|t| t.panes.len()).sum();
        SessionInfo {
            name: self.name.clone(),
            attached: self.attached_clients > 0,
            panes,
            model: self.models.active().id.clone(),
            created_ms: self.created_ms,
        }
    }

    fn alloc_id(&mut self) -> PaneId {
        let id = PaneId(self.next_id);
        self.next_id += 1;
        id
    }

    fn tab_mut(&mut self) -> &mut Tab {
        &mut self.tabs[self.tab_idx]
    }

    fn tab(&self) -> &Tab {
        &self.tabs[self.tab_idx]
    }

    async fn spawn_pane(&self, id: PaneId, title: String, cols: u16, rows: u16) -> Result<Pane> {
        let pane = Pane::spawn(
            id,
            title,
            cols,
            rows,
            self.cfg.shell.as_deref(),
            self.cfg.cwd.clone(),
        )
        .await?;
        // Inject model routing env into the already-running shell via export.
        let exports: String = self
            .models
            .env_pairs()
            .into_iter()
            .map(|(k, v)| format!("export {k}={v}; "))
            .collect();
        let _ = pane
            .write_bytes(format!("{exports}clear 2>/dev/null; true\n").as_bytes())
            .await;
        Ok(pane)
    }

    async fn new_tab(&mut self, name: &str) -> Result<()> {
        let id = self.alloc_id();
        let pane = self
            .spawn_pane(id, format!("{name}:1"), 80, 24)
            .await?;
        let mut panes = HashMap::new();
        panes.insert(id, pane);
        self.tabs.push(Tab {
            name: name.into(),
            root: Node::leaf(id),
            focus: id,
            panes,
            zoom: None,
        });
        self.tab_idx = self.tabs.len() - 1;
        Ok(())
    }

    pub async fn split(&mut self, dir: SplitDir) -> Result<()> {
        let focus = self.tab().focus;
        let new_id = self.alloc_id();
        let (cols, rows) = self
            .tab()
            .panes
            .get(&focus)
            .map(|p| (p.term_cols.max(20) / 2, p.term_rows.max(6) / 2))
            .unwrap_or((40, 12));
        let pane = self
            .spawn_pane(new_id, format!("pane-{}", new_id.0), cols.max(10), rows.max(4))
            .await?;
        let tab = self.tab_mut();
        if tab.root.split_leaf(focus, dir, new_id) {
            tab.panes.insert(new_id, pane);
            tab.focus = new_id;
            tab.zoom = None;
            self.status_msg = format!("split {:?} → {}", dir, new_id.0);
        }
        Ok(())
    }

    pub async fn close_focus(&mut self) -> Result<bool> {
        // Returns true if session should die (last pane of last tab).
        if self.tab().panes.len() <= 1 {
            if self.tabs.len() <= 1 {
                return Ok(true);
            }
            let idx = self.tab_idx;
            self.tabs.remove(idx);
            if self.tab_idx >= self.tabs.len() {
                self.tab_idx = self.tabs.len() - 1;
            }
            return Ok(false);
        }
        let focus = self.tab().focus;
        let tab = self.tab_mut();
        match tab.root.remove_leaf(focus) {
            RemoveResult::Removed | RemoveResult::RemovedEmpty => {
                tab.panes.remove(&focus);
                tab.zoom = None;
                let mut leaves = Vec::new();
                tab.root.collect_leaves(&mut leaves);
                if let Some(id) = leaves.first() {
                    tab.focus = *id;
                }
                self.status_msg = format!("closed pane {}", focus.0);
            }
            RemoveResult::NotFound => {
                self.status_msg = "pane not found".into();
            }
        }
        Ok(false)
    }

    pub async fn apply_remote(&mut self, action: crate::protocol::RemoteAction) -> Result<bool> {
        use crate::protocol::RemoteAction;
        match action {
            RemoteAction::SplitHorizontal => self.split(SplitDir::Horizontal).await?,
            RemoteAction::SplitVertical => self.split(SplitDir::Vertical).await?,
            RemoteAction::ClosePane => {
                if self.close_focus().await? {
                    return Ok(true);
                }
            }
            RemoteAction::FocusNext => {
                let tab = self.tab_mut();
                tab.focus = tab.root.cycle(tab.focus, true);
                tab.zoom = None;
            }
            RemoteAction::FocusPrev => {
                let tab = self.tab_mut();
                tab.focus = tab.root.cycle(tab.focus, false);
                tab.zoom = None;
            }
            RemoteAction::FocusDir(d) => self.focus_dir(d.into()),
            RemoteAction::ZoomToggle => {
                let tab = self.tab_mut();
                tab.zoom = match tab.zoom {
                    Some(_) => None,
                    None => Some(tab.focus),
                };
            }
            RemoteAction::NewTab => {
                let n = self.tabs.len() + 1;
                self.new_tab(&format!("t{n}")).await?;
            }
            RemoteAction::NextTab => {
                if !self.tabs.is_empty() {
                    self.tab_idx = (self.tab_idx + 1) % self.tabs.len();
                }
            }
            RemoteAction::PrevTab => {
                if !self.tabs.is_empty() {
                    self.tab_idx = (self.tab_idx + self.tabs.len() - 1) % self.tabs.len();
                }
            }
            RemoteAction::PtyBytes(bytes) => {
                let focus = self.tab().focus;
                if let Some(pane) = self.tab_mut().panes.get(&focus) {
                    let _ = pane.write_bytes(&bytes).await;
                }
            }
            RemoteAction::NextModel => {
                self.models.next();
                self.broadcast_model_env().await;
                self.status_msg = format!("model → {}", self.models.active().id);
            }
            RemoteAction::PrevModel => {
                self.models.prev();
                self.broadcast_model_env().await;
                self.status_msg = format!("model → {}", self.models.active().id);
            }
            RemoteAction::SelectModel(i) => {
                if self.models.select(i) {
                    self.broadcast_model_env().await;
                    self.status_msg = format!("model → {}", self.models.active().id);
                }
            }
            RemoteAction::KillSession => return Ok(true),
        }
        Ok(false)
    }

    async fn broadcast_model_env(&self) {
        let exports: String = self
            .models
            .env_pairs()
            .into_iter()
            .map(|(k, v)| format!("export {k}='{v}'; "))
            .collect::<String>()
            + "\n";
        for tab in &self.tabs {
            for pane in tab.panes.values() {
                let _ = pane.write_bytes(exports.as_bytes()).await;
            }
        }
    }

    fn focus_dir(&mut self, dir: FocusDir) {
        let area = Rect {
            x: 0,
            y: 0,
            w: 200,
            h: 60,
        };
        let tab = self.tab_mut();
        if let Some(id) = tab.root.neighbor(tab.focus, area, dir) {
            tab.focus = id;
            tab.zoom = None;
        }
    }

    pub async fn resize_terminal(&mut self, cols: u16, rows: u16) -> Result<()> {
        self.term_cols = cols.max(10);
        self.term_rows = rows.max(5);
        // Layout: top chrome 1, model strip 1, body min, status 1
        let body_h = self.term_rows.saturating_sub(3).max(3);
        let body_w = self.term_cols;
        self.body_cols = body_w;
        self.body_rows = body_h;
        self.resize_panes().await
    }

    async fn resize_panes(&mut self) -> Result<()> {
        let body = Rect {
            x: 0,
            y: 2, // below top + model strip in client coords we re-map
            w: self.body_cols,
            h: self.body_rows,
        };
        let tab = &self.tabs[self.tab_idx];
        let mut map = HashMap::new();
        if let Some(z) = tab.zoom {
            map.insert(
                z,
                Rect {
                    x: 0,
                    y: 0,
                    w: body.w,
                    h: body.h,
                },
            );
        } else {
            tab.root.layout(
                Rect {
                    x: 0,
                    y: 0,
                    w: body.w,
                    h: body.h,
                },
                &mut map,
            );
        }
        let sizes: Vec<(PaneId, u16, u16)> = map
            .iter()
            .map(|(id, r)| {
                let cols = r.w.saturating_sub(2).max(2);
                let rows = r.h.saturating_sub(2).max(1);
                (*id, cols, rows)
            })
            .collect();
        for (id, cols, rows) in sizes {
            if let Some(pane) = self.tabs[self.tab_idx].panes.get_mut(&id) {
                let _ = pane.resize(cols, rows).await;
            }
        }
        Ok(())
    }

    pub async fn snapshot(&self) -> FrameSnapshot {
        let body = Rect {
            x: 0,
            y: 0,
            w: self.body_cols,
            h: self.body_rows,
        };
        let tab = self.tab();
        let mut map = HashMap::new();
        if let Some(z) = tab.zoom {
            map.insert(
                z,
                Rect {
                    x: 0,
                    y: 0,
                    w: body.w,
                    h: body.h,
                },
            );
        } else {
            tab.root.layout(body, &mut map);
        }

        let mut panes = Vec::new();
        for (id, r) in map {
            let Some(pane) = tab.panes.get(&id) else {
                continue;
            };
            let focused = id == tab.focus;
            let inner_rows = r.h.saturating_sub(2).max(1);
            let styled = pane.styled_lines().await;
            let cursor = pane.cursor().await;
            let mut lines = Vec::new();
            for sl in styled.into_iter().take(inner_rows as usize) {
                let runs = sl
                    .runs
                    .into_iter()
                    .map(|run| RunSnap {
                        text: run.text,
                        fg: run.fg,
                        bg: run.bg,
                        bold: run.bold,
                        dim: run.dim,
                        italic: run.italic,
                        underline: run.underline,
                        inverse: run.inverse,
                    })
                    .collect();
                lines.push(runs);
            }
            while lines.len() < inner_rows as usize {
                lines.push(vec![RunSnap {
                    text: " ".into(),
                    fg: None,
                    bg: None,
                    bold: false,
                    dim: false,
                    italic: false,
                    underline: false,
                    inverse: false,
                }]);
            }
            panes.push(PaneSnap {
                x: r.x,
                y: r.y,
                w: r.w,
                h: r.h,
                title: format!(
                    " {}{} · {} ",
                    if focused { "◆" } else { "◇" },
                    pane.title,
                    if pane.alive() { "live" } else { "exit" }
                ),
                focused,
                alive: pane.alive(),
                cursor_row: cursor.row,
                cursor_col: cursor.col,
                lines,
            });
        }

        FrameSnapshot {
            session: self.name.clone(),
            tabs: self.tabs.iter().map(|t| t.name.clone()).collect(),
            tab_idx: self.tab_idx,
            status_msg: self.status_msg.clone(),
            accel: self.accel.summary_line(),
            models: self.models.chips(),
            active_model: self.models.active,
            panes,
            body: RectSnap {
                x: 0,
                y: 2,
                w: self.body_cols,
                h: self.body_rows,
            },
            model_strip: RectSnap {
                x: 0,
                y: 1,
                w: self.term_cols,
                h: 1,
            },
        }
    }

}
