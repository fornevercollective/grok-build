//! Single PTY-backed terminal pane.

use std::path::PathBuf;

use anyhow::{Context, Result};
use ptyctl::pty::PtyConfig;
use ptyctl::session::{PtySession, SessionConfig};
use ptyctl::styled::StyledLine;
use ptyctl::term::{CursorPosition, ScreenOpts};

use crate::layout::PaneId;

pub struct Pane {
    #[allow(dead_code)]
    pub id: PaneId,
    pub title: String,
    pub session: PtySession,
    /// Last known content size (cols, rows) sent to the PTY.
    pub term_cols: u16,
    pub term_rows: u16,
}

impl Pane {
    pub async fn spawn(
        id: PaneId,
        title: impl Into<String>,
        cols: u16,
        rows: u16,
        shell: Option<&str>,
        cwd: Option<PathBuf>,
    ) -> Result<Self> {
        let cols = cols.max(2);
        let rows = rows.max(1);
        let (cmd, name) = resolve_shell(shell);
        let mut env = std::collections::HashMap::new();
        env.insert("TERM".into(), "xterm-256color".into());
        env.insert("COLORTERM".into(), "truecolor".into());
        env.insert("PANDA_SHELL".into(), "1".into());

        let session = PtySession::start(SessionConfig {
            pty: PtyConfig {
                command: cmd,
                cols,
                rows,
                cwd,
                env,
            },
            timeout: None,
            linger: false,
        })
        .await
        .context("failed to start PTY session")?;

        let title = title.into().if_empty(name);
        let title = if title.is_empty() {
            format!("pane-{}", id.0)
        } else {
            title
        };
        Ok(Self {
            id,
            title,
            session,
            term_cols: cols,
            term_rows: rows,
        })
    }

    pub async fn resize(&mut self, cols: u16, rows: u16) -> Result<()> {
        let cols = cols.max(2);
        let rows = rows.max(1);
        if cols == self.term_cols && rows == self.term_rows {
            return Ok(());
        }
        self.session.resize(cols, rows).await?;
        self.term_cols = cols;
        self.term_rows = rows;
        Ok(())
    }

    pub async fn write_bytes(&self, bytes: &[u8]) -> Result<()> {
        self.session.send_bytes(bytes).await
    }

    pub async fn styled_lines(&self) -> Vec<StyledLine> {
        self.session
            .screen_styled(&ScreenOpts {
                include_empty: true,
                ..Default::default()
            })
            .await
    }

    pub async fn cursor(&self) -> CursorPosition {
        self.session.cursor().await
    }

    pub fn alive(&self) -> bool {
        self.session.is_alive()
    }
}

trait IfEmpty {
    fn if_empty(self, fallback: String) -> String;
}

impl IfEmpty for String {
    fn if_empty(self, fallback: String) -> String {
        if self.is_empty() { fallback } else { self }
    }
}

fn resolve_shell(override_shell: Option<&str>) -> (Vec<String>, String) {
    if let Some(s) = override_shell {
        return (vec![s.to_string()], shell_basename(s));
    }
    if let Ok(s) = std::env::var("SHELL") {
        if !s.is_empty() {
            return (vec![s.clone()], shell_basename(&s));
        }
    }
    for candidate in ["/bin/zsh", "/bin/bash", "/bin/sh"] {
        if std::path::Path::new(candidate).exists() {
            return (vec![candidate.into()], shell_basename(candidate));
        }
    }
    (vec!["/bin/sh".into()], "sh".into())
}

fn shell_basename(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("shell")
        .to_string()
}
