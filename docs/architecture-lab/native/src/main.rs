//! Grok Build Lab — native floating shell.
//!
//! * **Window**: `tao` + `wry` → macOS **WKWebView** (not Electron/Chromium)
//! * **Server**: in-process `axum` serves the lab static tree + ops APIs
//! * **TUI**: `--tui` ratatui control plane (mugrok / grok-cli terminal lineage)
//!
//! Dojo/Colossus path: one Rust binary, system webview, no Node runtime in the product path.

mod api;
mod control;
mod menu;
#[cfg(target_os = "macos")]
mod macos_style;
mod tui;
mod window;

use anyhow::{Context, Result};
use clap::{Parser, ValueEnum};
use control::ControlBus;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::oneshot;

#[derive(Debug, Clone, Copy, ValueEnum, Default)]
enum Mode {
    /// Compact always-on-top floating pod (default)
    #[default]
    Float,
    /// Full lab workspace window
    Lab,
    /// Terminal-only control plane (no webview)
    Tui,
}

#[derive(Parser, Debug)]
#[command(
    name = "architecture-lab",
    about = "Grok Build Lab — native floating shell (WKWebView / TUI)",
    long_about = "Rust native shell for Grok Build Lab.\n\
        Float mode: frameless always-on-top pod.\n\
        Lab mode: full workspace.\n\
        TUI mode: ratatui control plane (no webview).\n\
        Serves the lab from disk; no browser, no Electron."
)]
struct Args {
    /// Window / surface mode
    #[arg(long, value_enum, default_value_t = Mode::Float)]
    mode: Mode,

    /// Lab root (defaults to parent of native/, or ARCH_LAB_ROOT)
    #[arg(long)]
    root: Option<PathBuf>,

    /// Bind address for the embedded HTTP server (only localhost by default)
    #[arg(long, default_value = "127.0.0.1")]
    host: String,

    /// Port (0 = pick a free port). If preferred port is busy, falls back automatically.
    #[arg(long, default_value_t = 0)]
    port: u16,

    /// Prefer this port first (default 8765), then ephemeral if busy.
    #[arg(long, default_value_t = 8765)]
    prefer_port: u16,

    /// Print URL and exit (for scripting)
    #[arg(long)]
    print_url: bool,
}

#[derive(Clone)]
pub struct LabState {
    pub root: PathBuf,
    pub repo: PathBuf,
    /// SpaceXAI / Grok can POST /api/control to drive windows.
    pub control: Arc<ControlBus>,
    pub base_url: Arc<std::sync::Mutex<String>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "grok_build_lab=info,architecture_lab=info".into()),
        )
        .init();

    let args = Args::parse();
    let root = match resolve_lab_root(args.root.clone()) {
        Ok(r) => r,
        Err(e) => {
            fatal_dialog(&format!(
                "Cannot find Grok Build Lab files.\n\n{e}\n\nSet ARCH_LAB_ROOT or re-run native/build-mac-app.sh"
            ));
            return Err(e);
        }
    };
    let repo = resolve_git_repo(&root);

    let control = Arc::new(ControlBus::new());
    let base_url = Arc::new(std::sync::Mutex::new(String::new()));
    let state = Arc::new(LabState {
        root: root.clone(),
        repo,
        control: control.clone(),
        base_url: base_url.clone(),
    });

    // Bind server — never crash the .app just because :8765 is taken by serve.sh
    let listener = match bind_listener(&args.host, args.port, args.prefer_port).await {
        Ok(l) => l,
        Err(e) => {
            fatal_dialog(&format!(
                "Could not start local lab server.\n\n{e}\n\nQuit other Grok Build Lab / serve.sh instances and try again."
            ));
            return Err(e);
        }
    };
    let addr = listener.local_addr()?;
    let url = format!("http://{addr}/");
    *base_url.lock().unwrap() = url.clone();

    if args.print_url {
        println!("{url}");
        return Ok(());
    }

    tracing::info!(%url, root = %root.display(), "architecture-lab native");
    println!("architecture-lab control API: {url}api/control");
    println!("  POST {{\"action\":\"show_chat\"|\"hide_chat\"|\"pin\"|\"center\"|\"eval\"|…}}");

    let app = api::router(state.clone());
    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
    });

    // Wait until health responds
    if let Err(e) = wait_ready(&url).await {
        fatal_dialog(&format!("Lab server started but health check failed.\n\n{e}"));
        let _ = shutdown_tx.send(());
        return Err(e);
    }

    match args.mode {
        Mode::Tui => {
            tui::run(&url, &root).await?;
            let _ = shutdown_tx.send(());
        }
        Mode::Float | Mode::Lab => {
            let float = matches!(args.mode, Mode::Float);
            // Dual windows (lab + chat) on main thread
            if let Err(e) = window::run_blocking(&url, float, &root, control.clone()) {
                fatal_dialog(&format!("Window failed to open.\n\n{e}"));
                control.push_error(format!("{e}"), "window");
                let _ = shutdown_tx.send(());
                return Err(e);
            }
            let _ = shutdown_tx.send(());
        }
    }

    let _ = server.await;
    Ok(())
}

async fn bind_listener(
    host: &str,
    port: u16,
    prefer: u16,
) -> Result<tokio::net::TcpListener> {
    // Explicit --port 0 → pure ephemeral
    if port == 0 {
        // Try preferred first (play nice with bookmarks), then any free port
        if prefer != 0 {
            if let Ok(l) = tokio::net::TcpListener::bind((host, prefer)).await {
                return Ok(l);
            }
            tracing::warn!(prefer, "preferred port busy — using ephemeral");
        }
        return tokio::net::TcpListener::bind((host, 0u16))
            .await
            .with_context(|| format!("bind {host}:0"));
    }
    // Explicit non-zero port — try it, then fallback ephemeral with warning
    match tokio::net::TcpListener::bind((host, port)).await {
        Ok(l) => Ok(l),
        Err(e) => {
            tracing::warn!(port, error = %e, "port busy — falling back to ephemeral");
            tokio::net::TcpListener::bind((host, 0u16))
                .await
                .with_context(|| format!("bind {host}:0 after {port} failed: {e}"))
        }
    }
}

fn resolve_git_repo(root: &std::path::Path) -> PathBuf {
    // Prefer monorepo roots relative to lab
    for rel in ["../..", "../../..", "."] {
        let cand = root.join(rel);
        if cand.join(".git").exists() || cand.join("Cargo.toml").exists() {
            if let Ok(c) = cand.canonicalize() {
                return c;
            }
        }
    }
    if let Ok(h) = std::env::var("HOME") {
        let p = PathBuf::from(h).join("Projects/grok-build");
        if p.exists() {
            return p;
        }
    }
    root.to_path_buf()
}

/// macOS user-visible error (Dock bounce with no window is worse than a dialog).
fn fatal_dialog(msg: &str) {
    eprintln!("architecture-lab fatal: {msg}");
    #[cfg(target_os = "macos")]
    {
        let escaped = msg.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"display dialog "{escaped}" with title "Grok Build Lab" buttons {{"OK"}} default button "OK" with icon stop"#
        );
        let _ = std::process::Command::new("osascript")
            .args(["-e", &script])
            .status();
    }
}

fn resolve_lab_root(explicit: Option<PathBuf>) -> Result<PathBuf> {
    if let Some(p) = explicit {
        let p = if p.as_os_str().is_empty() || p == PathBuf::from(".") {
            // wrapper sometimes passed "." when ARCH_LAB_ROOT unset — ignore
            None
        } else {
            Some(p)
        };
        if let Some(p) = p {
            let c = p
                .canonicalize()
                .with_context(|| format!("lab root {}", p.display()))?;
            if c.join("index.html").is_file() {
                return Ok(c);
            }
            anyhow::bail!("lab root missing index.html: {}", c.display());
        }
    }
    if let Ok(env) = std::env::var("ARCH_LAB_ROOT") {
        let c = PathBuf::from(&env)
            .canonicalize()
            .with_context(|| format!("ARCH_LAB_ROOT={env}"))?;
        if c.join("index.html").is_file() {
            return Ok(c);
        }
        anyhow::bail!("ARCH_LAB_ROOT missing index.html: {}", c.display());
    }
    // native/ is inside architecture-lab/
    let here = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let parent = here
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or(here.clone());
    let c = parent
        .canonicalize()
        .with_context(|| format!("lab root {}", parent.display()))?;
    if !c.join("index.html").is_file() {
        anyhow::bail!("no index.html under {}", c.display());
    }
    Ok(c)
}

async fn wait_ready(url: &str) -> Result<()> {
    let client = reqwest_lite();
    let health = format!("{url}api/health");
    for _ in 0..50 {
        if let Ok(r) = client.get(&health).await {
            if r.status().is_success() {
                return Ok(());
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    anyhow::bail!("server not ready at {health}")
}

/// Minimal HTTP GET without pulling full reqwest if we can avoid it —
/// use hyper via axum's ecosystem: actually use std + tokio TcpStream is heavy.
/// Add reqwest as dep for health probe only — or use hyper.
fn reqwest_lite() -> SimpleClient {
    SimpleClient
}

struct SimpleClient;

impl SimpleClient {
    async fn get(&self, url: &str) -> Result<SimpleResponse> {
        // Use tokio::process curl as last resort-free: pure TCP HTTP/1.0 GET
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpStream;
        let u = url::Url::parse(url)?;
        let host = u.host_str().unwrap_or("127.0.0.1");
        let port = u.port_or_known_default().unwrap_or(80);
        let path = if u.path().is_empty() {
            "/"
        } else {
            u.path()
        };
        let mut stream = TcpStream::connect((host, port)).await?;
        let req = format!(
            "GET {path} HTTP/1.0\r\nHost: {host}\r\nConnection: close\r\n\r\n"
        );
        stream.write_all(req.as_bytes()).await?;
        let mut buf = Vec::new();
        stream.read_to_end(&mut buf).await?;
        let text = String::from_utf8_lossy(&buf);
        let status = text
            .lines()
            .next()
            .and_then(|l| l.split_whitespace().nth(1))
            .and_then(|s| s.parse::<u16>().ok())
            .unwrap_or(0);
        Ok(SimpleResponse { status })
    }
}

struct SimpleResponse {
    status: u16,
}

impl SimpleResponse {
    fn status(&self) -> StatusWrap {
        StatusWrap(self.status)
    }
}

struct StatusWrap(u16);
impl StatusWrap {
    fn is_success(&self) -> bool {
        (200..300).contains(&self.0)
    }
}
