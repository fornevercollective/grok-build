//! Embedded lab HTTP API + static files (axum).
//! Replaces Python serve.sh for the native binary path; same routes the SPA expects.

use crate::LabState;
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::process::Command;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

pub fn router(state: Arc<LabState>) -> Router {
    let static_root = state.root.clone();
    Router::new()
        .route("/api/health", get(health))
        .route("/api/version", get(version))
        .route("/api/processes", get(processes))
        .route("/api/events", get(events_get).post(events_post))
        .route("/api/git-log", get(git_log))
        .route("/api/summon-grok", get(summon_get).post(summon_post))
        .route("/api/mitigate", get(mitigate_get).post(mitigate_post))
        .route("/api/media/tools", get(media_tools))
        .fallback_service(ServeDir::new(static_root).append_index_html_on_directories(true))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state)
}

async fn health(State(st): State<Arc<LabState>>) -> Json<Value> {
    Json(json!({
        "ok": true,
        "native": true,
        "shell": "architecture-lab-native",
        "webview": "system", // WKWebView / WebView2 / WebKitGTK
        "root": st.root.display().to_string(),
        "repo": st.repo.display().to_string(),
        "grok": which("grok").or_else(|| which("xai-grok-pager")),
        "gy": which("gy"),
        "ts": now_secs(),
    }))
}

async fn version(State(st): State<Arc<LabState>>) -> Json<Value> {
    let (sha, short, r#ref) = git_rev(&st.repo);
    Json(json!({
        "ok": true,
        "sha": sha,
        "short": short,
        "ref": r#ref,
        "source": "native-rust",
        "built_at": chrono_like(),
    }))
}

async fn processes() -> Json<Value> {
    let out = Command::new("ps")
        .args(["-axo", "pid=,pcpu=,pmem=,etime=,state=,command="])
        .output();
    let mut processes = Vec::new();
    if let Ok(o) = out {
        let text = String::from_utf8_lossy(&o.stdout);
        for line in text.lines() {
            let bits: Vec<&str> = line.split_whitespace().collect();
            if bits.len() < 6 {
                continue;
            }
            let cmd = bits[5..].join(" ");
            let low = cmd.to_ascii_lowercase();
            if !(low.contains("grok")
                || low.contains("ffmpeg")
                || low.contains("architecture-lab")
                || low.contains("xai-grok")
                || low.contains("grokytalky"))
            {
                continue;
            }
            processes.push(json!({
                "pid": bits[0].parse::<i32>().unwrap_or(0),
                "cpu": bits[1].parse::<f64>().unwrap_or(0.0),
                "state": bits[4],
                "kind": classify(&cmd),
                "cmd": cmd,
            }));
        }
    }
    Json(json!({
        "ok": true,
        "processes": processes,
        "errors": [],
        "bins": {
            "grok": which("grok"),
            "gy": which("gy"),
        }
    }))
}

fn classify(cmd: &str) -> &'static str {
    let c = cmd.to_ascii_lowercase();
    if c.contains("ffmpeg") {
        "ffmpeg"
    } else if c.contains("xai-grok") || c.contains("grok") {
        "grok"
    } else if c.contains("gy") || c.contains("grokytalky") {
        "gy"
    } else {
        "other"
    }
}

async fn events_get() -> Json<Value> {
    Json(json!({ "ok": true, "events": [] }))
}

#[derive(Deserialize)]
struct EventBody {
    level: Option<String>,
    msg: Option<String>,
    source: Option<String>,
}

async fn events_post(Json(body): Json<EventBody>) -> Json<Value> {
    tracing::info!(
        level = body.level.as_deref().unwrap_or("info"),
        msg = body.msg.as_deref().unwrap_or(""),
        source = body.source.as_deref().unwrap_or(""),
        "event"
    );
    Json(json!({ "ok": true }))
}

#[derive(Deserialize)]
struct GitQ {
    limit: Option<usize>,
    repo: Option<String>,
}

async fn git_log(State(st): State<Arc<LabState>>, Query(q): Query<GitQ>) -> Json<Value> {
    let limit = q.limit.unwrap_or(80).min(200);
    let path = if q.repo.as_deref() == Some("gy") {
        dirs_home()
            .map(|h| h.join("Projects/GrokYtalkY"))
            .unwrap_or_else(|| st.repo.clone())
    } else {
        st.repo.clone()
    };
    let out = Command::new("git")
        .args([
            "-C",
            path.to_str().unwrap_or("."),
            "log",
            &format!("-{limit}"),
            "--pretty=format:%H%x09%h%x09%an%x09%ae%x09%aI%x09%s",
        ])
        .output();
    let mut commits = Vec::new();
    if let Ok(o) = out {
        for line in String::from_utf8_lossy(&o.stdout).lines() {
            let p: Vec<&str> = line.splitn(6, '\t').collect();
            if p.len() < 6 {
                continue;
            }
            commits.push(json!({
                "hash": p[0],
                "short": p[1],
                "author": p[2],
                "email": p[3],
                "date": p[4],
                "subject": p[5],
            }));
        }
    }
    let head = commits
        .first()
        .and_then(|c| c.get("short"))
        .cloned()
        .unwrap_or(Value::Null);
    Json(json!({
        "ok": true,
        "repo": path.display().to_string(),
        "commits": commits,
        "head": head,
    }))
}

async fn summon_get() -> Json<Value> {
    summon_impl("GET")
}

#[derive(Deserialize)]
struct SummonBody {
    phrase: Option<String>,
    multi: Option<bool>,
}

async fn summon_post(Json(body): Json<SummonBody>) -> Json<Value> {
    let _ = body.multi;
    summon_impl(body.phrase.as_deref().unwrap_or("ui"))
}

fn summon_impl(phrase: &str) -> Json<Value> {
    let bin = which("grok").or_else(|| which("xai-grok-pager"));
    let Some(bin) = bin else {
        return Json(json!({
            "ok": true,
            "launched": false,
            "message": "grok binary not found",
            "mitigation": "install grok / cargo build -p xai-grok-pager-bin",
            "panes": [],
        }));
    };
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"tell application "Terminal"
              activate
              do script "exec {bin}"
              set custom title of front window to "Grok"
            end tell"#,
            bin = bin.replace('\\', "\\\\").replace('"', "\\\"")
        );
        let _ = Command::new("osascript").args(["-e", &script]).spawn();
        return Json(json!({
            "ok": true,
            "launched": true,
            "via": "Terminal.app",
            "bin": bin,
            "phrase": phrase,
            "panes": [{"id":"grok","title":"Grok","kind":"app","cmd": bin}],
            "multi": true,
            "native": true,
        }));
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = Command::new(&bin).spawn();
        Json(json!({
            "ok": true,
            "launched": true,
            "via": "detach",
            "bin": bin,
            "phrase": phrase,
            "native": true,
        }))
    }
}

#[derive(Deserialize)]
struct MitBody {
    action: Option<String>,
}

async fn mitigate_get(Query(q): Query<MitBody>) -> Json<Value> {
    mitigate_impl(q.action.as_deref().unwrap_or(""))
}

async fn mitigate_post(Json(body): Json<MitBody>) -> Json<Value> {
    mitigate_impl(body.action.as_deref().unwrap_or(""))
}

fn mitigate_impl(action: &str) -> Json<Value> {
    let a = action.trim().to_ascii_lowercase();
    if a == "kill-ffmpeg" || a == "pkill-ffmpeg" || a == "reap-cam" {
        let _ = Command::new("pkill").args(["-x", "ffmpeg"]).status();
        let _ = Command::new("pkill").args(["-9", "-x", "ffmpeg"]).status();
        return Json(json!({
            "ok": true,
            "action": "kill-ffmpeg",
            "message": "pkill -x ffmpeg",
        }));
    }
    if a == "summon-grok" || a == "grok" {
        return summon_impl("mitigate");
    }
    Json(json!({
        "ok": false,
        "message": format!("unknown action {action}"),
        "known": ["kill-ffmpeg", "summon-grok"],
    }))
}

async fn media_tools() -> Json<Value> {
    Json(json!({
        "ok": true,
        "ytdlp": which("yt-dlp"),
        "ffmpeg": which("ffmpeg"),
        "ffplay": which("ffplay"),
        "blank": false,
        "gy_hub": false,
        "gy_bin": which("gy"),
        "native": true,
    }))
}

fn which(name: &str) -> Option<String> {
    Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}

fn git_rev(repo: &std::path::Path) -> (String, String, String) {
    let run = |args: &[&str]| -> String {
        Command::new("git")
            .args(args)
            .current_dir(repo)
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|| "unknown".into())
    };
    (
        run(&["rev-parse", "HEAD"]),
        run(&["rev-parse", "--short", "HEAD"]),
        run(&["rev-parse", "--abbrev-ref", "HEAD"]),
    )
}

fn dirs_home() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME").map(std::path::PathBuf::from)
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn chrono_like() -> String {
    // ISO-ish without chrono dep
    let t = now_secs();
    format!("{t}")
}
