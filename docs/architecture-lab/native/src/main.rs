//! Architecture Lab — native floating shell.
//!
//! * **Window**: `tao` + `wry` → macOS **WKWebView** (not Electron/Chromium)
//! * **Server**: in-process `axum` serves the lab static tree + ops APIs
//! * **TUI**: `--tui` ratatui control plane (mugrok / grok-cli terminal lineage)
//!
//! Dojo/Colossus path: one Rust binary, system webview, no Node runtime in the product path.

mod api;
mod tui;
mod window;

use anyhow::{Context, Result};
use clap::{Parser, ValueEnum};
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
    about = "Grok Build Architecture Lab — native floating shell (WKWebView / TUI)",
    long_about = "Rust native shell for the Architecture Lab.\n\
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

    /// Port (0 = ephemeral)
    #[arg(long, default_value_t = 8765)]
    port: u16,

    /// Print URL and exit (for scripting)
    #[arg(long)]
    print_url: bool,
}

#[derive(Clone)]
pub struct LabState {
    pub root: PathBuf,
    pub repo: PathBuf,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "architecture_lab=info".into()),
        )
        .init();

    let args = Args::parse();
    let root = resolve_lab_root(args.root)?;
    let repo = root
        .join("../..")
        .canonicalize()
        .unwrap_or_else(|_| root.parent().unwrap_or(&root).to_path_buf());

    let state = Arc::new(LabState {
        root: root.clone(),
        repo,
    });

    // Bind server
    let listener = tokio::net::TcpListener::bind((args.host.as_str(), args.port))
        .await
        .with_context(|| format!("bind {}:{}", args.host, args.port))?;
    let addr = listener.local_addr()?;
    let url = format!("http://{addr}/");

    if args.print_url {
        println!("{url}");
        return Ok(());
    }

    tracing::info!(%url, root = %root.display(), "architecture-lab native");

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
    wait_ready(&url).await?;

    match args.mode {
        Mode::Tui => {
            tui::run(&url, &root).await?;
            let _ = shutdown_tx.send(());
        }
        Mode::Float | Mode::Lab => {
            // Webview must run on the main thread on macOS — block here.
            let float = matches!(args.mode, Mode::Float);
            // Run window on main thread; server keeps running on tokio runtime.
            // We use a dedicated OS thread for the event loop when needed, but
            // wry/tao want the main thread on macOS — so we block_on is already
            // on main; call window::run which blocks until close.
            window::run_blocking(&url, float, &root)?;
            let _ = shutdown_tx.send(());
        }
    }

    let _ = server.await;
    Ok(())
}

fn resolve_lab_root(explicit: Option<PathBuf>) -> Result<PathBuf> {
    if let Some(p) = explicit {
        return p
            .canonicalize()
            .with_context(|| format!("lab root {}", p.display()));
    }
    if let Ok(env) = std::env::var("ARCH_LAB_ROOT") {
        return PathBuf::from(env)
            .canonicalize()
            .context("ARCH_LAB_ROOT");
    }
    // native/ is inside architecture-lab/
    let here = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let parent = here
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or(here.clone());
    parent
        .canonicalize()
        .with_context(|| format!("lab root {}", parent.display()))
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
