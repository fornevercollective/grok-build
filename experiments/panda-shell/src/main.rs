//! panda — standalone glass multi-terminal shell.
//!
//! Session daemon (detach/reattach) · model routing strip · hybrid Metal frost window.
//!
//! Important: `panda window` must NOT run under an active Tokio runtime. Winit
//! owns the macOS main thread; nesting `Runtime::block_on` inside that context
//! aborts with "Cannot start a runtime from within a runtime".

mod accel;
mod client;
mod daemon;
mod engine;
mod frost;
mod input;
mod layout;
mod models;
mod pane;
mod paths;
mod protocol;
mod theme;
mod window_mode;

use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "panda",
    about = "Standalone glass multi-terminal shell — detach/reattach, model strip, Metal frost.",
    version,
    propagate_version = true
)]
struct Cli {
    #[command(subcommand)]
    cmd: Option<Cmd>,

    /// Session name for the default attach/new path when no subcommand is given.
    #[arg(long, short = 'n', global = true)]
    name: Option<String>,

    /// Shell for new panes.
    #[arg(long, short = 's', global = true)]
    shell: Option<String>,

    /// Working directory for new panes.
    #[arg(long, short = 'C', global = true)]
    cwd: Option<PathBuf>,

    /// Starter splits when creating a session (0–4).
    #[arg(long, global = true, default_value_t = 0)]
    splits: u8,
}

#[derive(Debug, Subcommand)]
enum Cmd {
    /// Create a session (if needed) and attach the TUI (default).
    New {
        /// Session name (default: main).
        name: Option<String>,
    },
    /// Attach to an existing detached session.
    Attach { name: String },
    /// List sessions in the daemon.
    #[command(visible_alias = "ls")]
    List,
    /// Kill a session.
    Kill { name: String },
    /// Run the session daemon in the foreground.
    Daemon,
    /// Ensure daemon is running (auto-spawn if needed).
    Start,
    /// Hybrid windowed Metal frost UI (native window).
    Window {
        /// Session to display (created if missing).
        name: Option<String>,
    },
    /// Print compute backends (CPU / Metal / GPU).
    Accel,
    /// Print standalone paths and install hint.
    Info,
    /// Install `panda` onto PATH (~/.local/bin or /usr/local/bin).
    Install {
        /// Install prefix (default: ~/.local/bin).
        #[arg(long)]
        prefix: Option<PathBuf>,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Window path: ephemeral Tokio for setup only, then FULLY drop the runtime
    // before entering winit. Never call run_hybrid under #[tokio::main].
    if let Some(Cmd::Window { name }) = &cli.cmd {
        let session = name
            .clone()
            .or_else(|| cli.name.clone())
            .unwrap_or_else(|| "main".into());
        let shell = cli.shell.clone();
        let cwd = cli.cwd.clone().or_else(|| std::env::current_dir().ok());
        let splits = cli.splits;

        {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .thread_name("panda-setup")
                .build()
                .context("tokio setup runtime")?;
            rt.block_on(async {
                daemon::ensure_running().await?;
                let mut stream = daemon::connect().await?;
                protocol::write_msg(
                    &mut stream,
                    &protocol::ClientMsg::Attach {
                        name: session.clone(),
                        shell,
                        cwd,
                        splits,
                        create: true,
                    },
                )
                .await?;
                let _ = protocol::read_msg::<protocol::ServerMsg>(&mut stream).await?;
                // Leave session detached so the window client can attach cleanly.
                protocol::write_msg(&mut stream, &protocol::ClientMsg::Detach).await?;
                let _ = protocol::read_msg::<protocol::ServerMsg>(&mut stream).await?;
                Ok::<(), anyhow::Error>(())
            })?;
            // Runtime dropped here — no active Tokio context on this thread.
        }

        return window_mode::run_hybrid(Some(session));
    }

    // All other commands run under a normal multi-thread Tokio runtime.
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_name("panda")
        .build()
        .context("tokio runtime")?;
    rt.block_on(async_main(cli))
}

async fn async_main(cli: Cli) -> Result<()> {
    let default_name = cli.name.clone().unwrap_or_else(|| "main".into());
    let cwd = cli.cwd.or_else(|| std::env::current_dir().ok());

    match cli.cmd {
        None | Some(Cmd::New { .. }) => {
            let name = match &cli.cmd {
                Some(Cmd::New { name }) => name.clone().unwrap_or(default_name),
                _ => default_name,
            };
            client::run_attached(client::AttachOpts {
                name,
                shell: cli.shell,
                cwd,
                splits: cli.splits,
                create: true,
            })
            .await
        }
        Some(Cmd::Attach { name }) => {
            client::run_attached(client::AttachOpts {
                name,
                shell: cli.shell,
                cwd,
                splits: 0,
                create: false,
            })
            .await
        }
        Some(Cmd::List) => client::list_sessions().await,
        Some(Cmd::Kill { name }) => client::kill_session(&name).await,
        Some(Cmd::Daemon) => daemon::run_foreground().await,
        Some(Cmd::Start) => {
            daemon::ensure_running().await?;
            println!("daemon ready · {}", paths::socket_path().display());
            Ok(())
        }
        Some(Cmd::Window { .. }) => unreachable!("window handled in main()"),
        Some(Cmd::Accel) => {
            let report = accel::detect();
            println!("panda compute backends");
            println!("  primary: {}", report.primary);
            for b in &report.backends {
                let mark = if b.available { "✓" } else { "·" };
                println!(
                    "  {mark} {:<6}  {} — {}",
                    b.kind.to_string(),
                    b.name,
                    b.detail
                );
            }
            let frost = frost::select_backend();
            println!("  frost:  {} — {}", frost.kind, frost.label);
            Ok(())
        }
        Some(Cmd::Info) => {
            let home = paths::ensure_home()?;
            println!("panda standalone");
            println!("  home:    {}", home.display());
            println!("  socket:  {}", paths::socket_path().display());
            println!("  pid:     {}", paths::pid_path().display());
            println!("  log:     {}", paths::log_path().display());
            println!("  binary:  {}", paths::current_exe()?.display());
            println!();
            println!("quickstart:");
            println!("  panda                  # new/attach session `main`");
            println!("  panda new dev --splits 2");
            println!("  # Ctrl-a d to detach");
            println!("  panda attach dev");
            println!("  panda ls");
            println!("  panda window dev       # hybrid Metal frost window");
            println!("  panda install          # copy binary to ~/.local/bin");
            Ok(())
        }
        Some(Cmd::Install { prefix }) => install_binary(prefix),
    }
}

fn install_binary(prefix: Option<PathBuf>) -> Result<()> {
    let src = paths::current_exe()?;
    let dest_dir = prefix.unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".local/bin")
    });
    std::fs::create_dir_all(&dest_dir)?;
    let dest = dest_dir.join("panda");
    std::fs::copy(&src, &dest)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&dest)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&dest, perms)?;
    }
    println!("installed {}", dest.display());
    if let Some(path) = std::env::var_os("PATH") {
        let ok = std::env::split_paths(&path).any(|p| p == dest_dir);
        if !ok {
            println!(
                "note: add {} to PATH to launch `panda` as a standalone app",
                dest_dir.display()
            );
        }
    }
    #[cfg(target_os = "macos")]
    {
        let launcher = paths::panda_home().join("Panda.command");
        // Prefer the installed path so double-click uses the fixed binary.
        let script = format!(
            "#!/bin/zsh\ncd \"$HOME\"\nexec \"{}\" window \"$@\"\n",
            dest.display()
        );
        std::fs::write(&launcher, script)?;
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&launcher)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&launcher, perms)?;
        println!("macOS launcher: {}  (opens hybrid window)", launcher.display());
    }
    Ok(())
}
