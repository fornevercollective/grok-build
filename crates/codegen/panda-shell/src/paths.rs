//! Standalone app paths under `~/.panda` (or `$PANDA_HOME`).

use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};

pub fn panda_home() -> PathBuf {
    if let Ok(p) = std::env::var("PANDA_HOME") {
        return PathBuf::from(p);
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".panda")
}

pub fn ensure_home() -> Result<PathBuf> {
    let home = panda_home();
    fs::create_dir_all(&home).with_context(|| format!("mkdir {}", home.display()))?;
    fs::create_dir_all(home.join("sessions"))
        .with_context(|| format!("mkdir {}", home.join("sessions").display()))?;
    Ok(home)
}

pub fn socket_path() -> PathBuf {
    panda_home().join("panda.sock")
}

pub fn pid_path() -> PathBuf {
    panda_home().join("daemon.pid")
}

pub fn log_path() -> PathBuf {
    panda_home().join("daemon.log")
}

/// Resolve the running panda binary (for daemon auto-spawn).
pub fn current_exe() -> Result<PathBuf> {
    std::env::current_exe().context("resolve current executable")
}
