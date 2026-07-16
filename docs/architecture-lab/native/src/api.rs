//! Embedded lab HTTP API + static files (axum).
//! Includes SpaceXAI control plane: POST /api/control

use crate::control::ControlRequest;
use crate::LabState;
use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, StatusCode},
    response::Response,
    routing::{get, post},
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
        // SpaceXAI Grok Voice catalog + TTS preview proxy
        .route("/api/voices", get(voices_list))
        .route("/api/tts", post(tts_proxy))
        // SpaceXAI / Grok direct control of native windows
        .route("/api/control", get(control_help).post(control_post))
        .route("/api/control/status", get(control_status))
        .route("/api/control/errors", get(control_errors).delete(control_errors_clear))
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
    let url = st.base_url.lock().unwrap().clone();
    Json(json!({
        "ok": true,
        "native": true,
        "shell": "architecture-lab-native",
        "webview": "system",
        "windows": ["lab", "chat"],
        "chat_visible": st.control.chat_visible(),
        "control": format!("{url}api/control"),
        "root": st.root.display().to_string(),
        "repo": st.repo.display().to_string(),
        "grok": which("grok").or_else(|| which("xai-grok-pager")),
        "gy": which("gy"),
        "ts": now_secs(),
    }))
}

async fn control_help() -> Json<Value> {
    Json(json!({
        "ok": true,
        "spacexai": true,
        "description": "POST JSON to drive native lab + chat windows",
        "actions": [
            "show_chat", "hide_chat", "toggle_chat", "focus_chat", "focus_lab",
            "pin", "unpin", "decorations", "minimize", "maximize", "close",
            "center", "move", "resize", "eval", "error",
            "refresh", "refresh_lab", "refresh_chat", "refresh_all",
            "check_updates", "open_chat_independent", "chat_only",
            "drag", "ping", "quit"
        ],
        "targets": ["lab", "chat", "all"],
        "examples": [
            {"action": "show_chat"},
            {"action": "refresh_all"},
            {"action": "check_updates"},
            {"action": "pin", "target": "chat", "on": true},
            {"action": "center", "target": "lab"},
            {"action": "eval", "target": "chat", "script": "LabChat.listen()"},
            {"action": "error", "message": "fix me"},
            {"action": "quit"}
        ]
    }))
}

async fn control_post(
    State(st): State<Arc<LabState>>,
    Json(body): Json<ControlRequest>,
) -> (StatusCode, Json<Value>) {
    match body.into_cmd() {
        Ok(cmd) => match st.control.send(cmd) {
            Ok(()) => (StatusCode::OK, Json(json!({ "ok": true }))),
            Err(e) => {
                st.control.push_error(&e, "control_send");
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({ "ok": false, "error": e })),
                )
            }
        },
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "ok": false, "error": e })),
        ),
    }
}

async fn control_status(State(st): State<Arc<LabState>>) -> Json<Value> {
    Json(json!({
        "ok": true,
        "chat_visible": st.control.chat_visible(),
        "status": st.control.status(),
        "base_url": st.base_url.lock().unwrap().clone(),
    }))
}

async fn control_errors(State(st): State<Arc<LabState>>) -> Json<Value> {
    Json(json!({ "ok": true, "errors": st.control.errors() }))
}

async fn control_errors_clear(State(st): State<Arc<LabState>>) -> Json<Value> {
    st.control.clear_errors();
    Json(json!({ "ok": true }))
}

/// SpaceXAI Grok Voice roster: static catalog + optional live merge.
async fn voices_list(State(st): State<Arc<LabState>>) -> Json<Value> {
    let catalog_path = st.root.join("assets/spacexai-voices.json");
    let mut voices: Vec<Value> = Vec::new();
    let mut models = json!({
        "agent": "grok-voice-latest",
        "realtime_ws": "wss://api.x.ai/v1/realtime?model=grok-voice-latest",
        "tts": "https://api.x.ai/v1/tts",
        "tts_voices": "https://api.x.ai/v1/tts/voices",
    });
    let mut live = false;

    if let Ok(raw) = std::fs::read_to_string(&catalog_path) {
        if let Ok(v) = serde_json::from_str::<Value>(&raw) {
            if let Some(arr) = v.get("voices").and_then(|x| x.as_array()) {
                voices = arr.clone();
            }
            if let Some(m) = v.get("models") {
                models = m.clone();
            }
        }
    }

    if let Some(key) = xai_api_key() {
        // Live list from SpaceXAI — best-effort via curl
        if let Ok(out) = Command::new("curl")
            .args([
                "-sS",
                "--max-time",
                "8",
                "-H",
                &format!("Authorization: Bearer {key}"),
                "https://api.x.ai/v1/tts/voices",
            ])
            .output()
        {
            if out.status.success() {
                if let Ok(v) = serde_json::from_slice::<Value>(&out.stdout) {
                    if let Some(arr) = v
                        .get("voices")
                        .or_else(|| v.as_array().map(|_| &v))
                        .and_then(|x| x.as_array())
                    {
                        live = true;
                        for item in arr {
                            let id = item
                                .get("voice_id")
                                .or_else(|| item.get("id"))
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_ascii_lowercase();
                            if id.is_empty() {
                                continue;
                            }
                            if let Some(existing) = voices.iter_mut().find(|v| {
                                v.get("id")
                                    .and_then(|x| x.as_str())
                                    .map(|s| s.eq_ignore_ascii_case(&id))
                                    .unwrap_or(false)
                            }) {
                                if let Some(n) = item.get("name").and_then(|x| x.as_str()) {
                                    existing["name"] = json!(n);
                                }
                            } else {
                                voices.push(json!({
                                    "id": id,
                                    "name": item.get("name").and_then(|x| x.as_str()).unwrap_or(&id),
                                    "gen": "flagship",
                                    "tone": item.get("description").and_then(|x| x.as_str()).unwrap_or(""),
                                    "custom": item.get("custom").and_then(|x| x.as_bool()).unwrap_or(false),
                                }));
                            }
                        }
                    }
                }
            }
        }
    }

    Json(json!({
        "ok": true,
        "live": live,
        "has_key": xai_api_key().is_some(),
        "count": voices.len(),
        "models": models,
        "voices": voices,
        "default_voice_id": "eve",
    }))
}

#[derive(Debug, Deserialize)]
struct TtsBody {
    text: Option<String>,
    voice_id: Option<String>,
    language: Option<String>,
}

/// Proxy TTS so the browser never sees XAI_API_KEY.
async fn tts_proxy(Json(body): Json<TtsBody>) -> Response {
    let Some(key) = xai_api_key() else {
        return json_err(
            StatusCode::SERVICE_UNAVAILABLE,
            "XAI_API_KEY not set — export key or run with SpaceXAI auth for TTS preview",
        );
    };
    let text = body
        .text
        .as_deref()
        .unwrap_or("")
        .trim()
        .chars()
        .take(500)
        .collect::<String>();
    if text.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "text required");
    }
    let voice = body
        .voice_id
        .as_deref()
        .unwrap_or("eve")
        .trim()
        .to_ascii_lowercase();
    let lang = body.language.as_deref().unwrap_or("en");
    let payload = json!({
        "text": text,
        "voice_id": voice,
        "language": lang,
    });
    let tmp = std::env::temp_dir().join(format!(
        "archlab-tts-{}-{}.mp3",
        voice,
        now_secs()
    ));
    let payload_s = payload.to_string();
    let out = Command::new("curl")
        .args([
            "-sS",
            "--max-time",
            "30",
            "-X",
            "POST",
            "https://api.x.ai/v1/tts",
            "-H",
            &format!("Authorization: Bearer {key}"),
            "-H",
            "Content-Type: application/json",
            "-d",
            &payload_s,
            "-o",
            tmp.to_str().unwrap_or("/tmp/archlab-tts.mp3"),
            "-w",
            "%{http_code}",
        ])
        .output();

    match out {
        Ok(o) => {
            let code = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if code != "200" {
                let _ = std::fs::remove_file(&tmp);
                return json_err(
                    StatusCode::BAD_GATEWAY,
                    &format!("TTS upstream HTTP {code}"),
                );
            }
            match std::fs::read(&tmp) {
                Ok(bytes) if !bytes.is_empty() => {
                    let _ = std::fs::remove_file(&tmp);
                    Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, "audio/mpeg")
                        .header(header::CACHE_CONTROL, "no-store")
                        .body(Body::from(bytes))
                        .unwrap_or_else(|_| {
                            json_err(StatusCode::INTERNAL_SERVER_ERROR, "response build failed")
                        })
                }
                _ => {
                    let _ = std::fs::remove_file(&tmp);
                    json_err(StatusCode::BAD_GATEWAY, "empty TTS audio")
                }
            }
        }
        Err(e) => json_err(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("curl failed: {e}"),
        ),
    }
}

fn xai_api_key() -> Option<String> {
    for k in ["XAI_API_KEY", "GROK_API_KEY", "XAI_KEY"] {
        if let Ok(v) = std::env::var(k) {
            let t = v.trim().to_string();
            if !t.is_empty() {
                return Some(t);
            }
        }
    }
    // Optional: ~/.grok/auth.json common shapes
    if let Ok(home) = std::env::var("HOME") {
        let p = std::path::PathBuf::from(home).join(".grok/auth.json");
        if let Ok(raw) = std::fs::read_to_string(p) {
            if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                for path in [
                    v.pointer("/api_key"),
                    v.pointer("/xai_api_key"),
                    v.pointer("/token"),
                    v.pointer("/access_token"),
                ] {
                    if let Some(s) = path.and_then(|x| x.as_str()) {
                        let t = s.trim();
                        if !t.is_empty() {
                            return Some(t.into());
                        }
                    }
                }
            }
        }
    }
    None
}

fn json_err(status: StatusCode, msg: &str) -> Response {
    let body = json!({ "ok": false, "error": msg }).to_string();
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .unwrap_or_else(|_| {
            Response::new(Body::from(r#"{"ok":false,"error":"err"}"#))
        })
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
