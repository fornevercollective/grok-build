//! Session daemon — holds PTYs across client detach/reattach.

use std::collections::HashMap;
use std::fs;
use std::sync::Arc;

use anyhow::{Context, Result, bail};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::Mutex;

use crate::engine::{SessionConfig, SessionEngine};
use crate::paths::{ensure_home, log_path, pid_path, socket_path};
use crate::protocol::{ClientMsg, ServerMsg, read_msg, write_msg};

struct DaemonState {
    sessions: HashMap<String, SessionEngine>,
}

pub async fn run_foreground() -> Result<()> {
    let home = ensure_home()?;
    let sock = socket_path();
    if sock.exists() {
        if try_ping().await.is_ok() {
            bail!("panda daemon already running at {}", sock.display());
        }
        let _ = fs::remove_file(&sock);
    }

    let listener =
        UnixListener::bind(&sock).with_context(|| format!("bind {}", sock.display()))?;
    write_pid()?;
    log_line(&format!(
        "daemon listening on {} (home {})",
        sock.display(),
        home.display()
    ));

    let state = Arc::new(Mutex::new(DaemonState {
        sessions: HashMap::new(),
    }));

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let state = state.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_client(state, stream).await {
                        log_line(&format!("client closed: {e:#}"));
                    }
                });
            }
            Err(e) => log_line(&format!("accept error: {e}")),
        }
    }
}

/// Spawn a background daemon if one is not already up.
pub async fn ensure_running() -> Result<()> {
    if try_ping().await.is_ok() {
        return Ok(());
    }
    ensure_home()?;
    let sock = socket_path();
    if sock.exists() {
        let _ = fs::remove_file(&sock);
    }

    let exe = crate::paths::current_exe()?;
    let log = log_path();
    let log_file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log)
        .with_context(|| format!("open log {}", log.display()))?;

    let mut cmd = std::process::Command::new(&exe);
    cmd.arg("daemon")
        .stdin(std::process::Stdio::null())
        .stdout(log_file.try_clone()?)
        .stderr(log_file);

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            cmd.pre_exec(|| {
                if libc::setsid() == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }

    let child = cmd.spawn().context("spawn panda daemon")?;
    log_line(&format!("spawned daemon pid {}", child.id()));

    for _ in 0..50 {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        if try_ping().await.is_ok() {
            return Ok(());
        }
    }
    bail!(
        "daemon did not become ready (see {})",
        log_path().display()
    )
}

pub async fn try_ping() -> Result<()> {
    let mut stream = UnixStream::connect(socket_path())
        .await
        .context("connect socket")?;
    write_msg(&mut stream, &ClientMsg::Ping).await?;
    match read_msg::<ServerMsg>(&mut stream).await? {
        ServerMsg::Pong => Ok(()),
        other => bail!("unexpected ping reply: {other:?}"),
    }
}

pub async fn connect() -> Result<UnixStream> {
    ensure_running().await?;
    UnixStream::connect(socket_path())
        .await
        .context("connect to panda daemon")
}

async fn handle_client(state: Arc<Mutex<DaemonState>>, mut stream: UnixStream) -> Result<()> {
    let mut attached: Option<String> = None;

    loop {
        let msg: ClientMsg = match read_msg(&mut stream).await {
            Ok(m) => m,
            Err(e) => {
                if let Some(name) = attached.take() {
                    let mut st = state.lock().await;
                    if let Some(s) = st.sessions.get_mut(&name) {
                        s.attached_clients = s.attached_clients.saturating_sub(1);
                        if s.attached_clients == 0 {
                            s.status_msg =
                                format!("detached · `panda attach {name}` to resume");
                        }
                    }
                }
                return Err(e);
            }
        };

        let reply = process_msg(&state, &mut attached, msg).await;
        write_msg(&mut stream, &reply).await?;
    }
}

async fn process_msg(
    state: &Arc<Mutex<DaemonState>>,
    attached: &mut Option<String>,
    msg: ClientMsg,
) -> ServerMsg {
    match msg {
        ClientMsg::Ping => ServerMsg::Pong,
        ClientMsg::ListSessions => {
            let st = state.lock().await;
            let mut sessions: Vec<_> = st.sessions.values().map(|s| s.info()).collect();
            sessions.sort_by(|a, b| a.name.cmp(&b.name));
            ServerMsg::SessionList { sessions }
        }
        ClientMsg::Attach {
            name,
            shell,
            cwd,
            splits,
            create,
        } => {
            let mut st = state.lock().await;
            if !st.sessions.contains_key(&name) {
                if !create {
                    return ServerMsg::Error {
                        message: format!("no session `{name}` — try `panda new {name}`"),
                    };
                }
                return match SessionEngine::create(SessionConfig {
                    name: name.clone(),
                    shell,
                    cwd,
                    initial_splits: splits,
                })
                .await
                {
                    Ok(mut eng) => {
                        eng.attached_clients = 1;
                        st.sessions.insert(name.clone(), eng);
                        *attached = Some(name.clone());
                        ServerMsg::Attached { name }
                    }
                    Err(e) => ServerMsg::Error {
                        message: format!("create failed: {e:#}"),
                    },
                };
            }
            let eng = st.sessions.get_mut(&name).unwrap();
            eng.attached_clients = eng.attached_clients.saturating_add(1);
            eng.status_msg = format!("attached to `{name}` (clients={})", eng.attached_clients);
            *attached = Some(name.clone());
            ServerMsg::Attached { name }
        }
        ClientMsg::Detach => {
            if let Some(name) = attached.take() {
                let mut st = state.lock().await;
                if let Some(s) = st.sessions.get_mut(&name) {
                    s.attached_clients = s.attached_clients.saturating_sub(1);
                    s.status_msg = if s.attached_clients == 0 {
                        format!("detached · `panda attach {name}`")
                    } else {
                        format!("client left · {} still attached", s.attached_clients)
                    };
                }
                ServerMsg::Detached
            } else {
                ServerMsg::Error {
                    message: "not attached".into(),
                }
            }
        }
        ClientMsg::Kill { name } => {
            let mut st = state.lock().await;
            if st.sessions.remove(&name).is_some() {
                if attached.as_deref() == Some(name.as_str()) {
                    *attached = None;
                }
                ServerMsg::Ok {
                    status: format!("killed `{name}`"),
                }
            } else {
                ServerMsg::Error {
                    message: format!("no session `{name}`"),
                }
            }
        }
        ClientMsg::Action(action) => {
            let Some(name) = attached.clone() else {
                return ServerMsg::Error {
                    message: "not attached".into(),
                };
            };
            let mut st = state.lock().await;
            let Some(eng) = st.sessions.get_mut(&name) else {
                return ServerMsg::Error {
                    message: "session gone".into(),
                };
            };
            match eng.apply_remote(action).await {
                Ok(true) => {
                    st.sessions.remove(&name);
                    *attached = None;
                    ServerMsg::Ok {
                        status: "session ended".into(),
                    }
                }
                Ok(false) => ServerMsg::Ok {
                    status: eng.status_msg.clone(),
                },
                Err(e) => ServerMsg::Error {
                    message: format!("{e:#}"),
                },
            }
        }
        ClientMsg::Resize { cols, rows } => {
            let Some(name) = attached.clone() else {
                return ServerMsg::Error {
                    message: "not attached".into(),
                };
            };
            let mut st = state.lock().await;
            match st.sessions.get_mut(&name) {
                Some(eng) => match eng.resize_terminal(cols, rows).await {
                    Ok(()) => ServerMsg::Ok {
                        status: String::new(),
                    },
                    Err(e) => ServerMsg::Error {
                        message: format!("{e:#}"),
                    },
                },
                None => ServerMsg::Error {
                    message: "session gone".into(),
                },
            }
        }
        ClientMsg::Snapshot => {
            let Some(name) = attached.clone() else {
                return ServerMsg::Error {
                    message: "not attached".into(),
                };
            };
            let st = state.lock().await;
            match st.sessions.get(&name) {
                Some(eng) => ServerMsg::Frame(eng.snapshot().await),
                None => ServerMsg::Error {
                    message: "session gone".into(),
                },
            }
        }
    }
}

fn write_pid() -> Result<()> {
    ensure_home()?;
    fs::write(pid_path(), format!("{}\n", std::process::id()))
        .with_context(|| format!("write {}", pid_path().display()))
}

fn log_line(msg: &str) {
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let line = format!("[unix:{secs}] {msg}\n");
    let _ = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path())
        .and_then(|mut f| f.write_all(line.as_bytes()));
}
