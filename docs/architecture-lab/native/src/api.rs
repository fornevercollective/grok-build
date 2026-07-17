//! Embedded lab HTTP API + static files (axum).
//! Includes SpaceXAI control plane: POST /api/control

use crate::control::ControlRequest;
use crate::LabState;
use axum::{
    body::{Body, Bytes},
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
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
        // Dev playpen — Grok manage/explore/mitigate/research/voice
        .route("/api/playpen", get(playpen_get).post(playpen_post))
        .route("/api/playpen/status", get(playpen_get))
        .route("/api/voice", get(voice_get).post(voice_post))
        .route("/voice", get(voice_get).post(voice_post))
        // Chat vision · persona · AIto bridge
        .route("/api/persona", get(persona_get).post(persona_post))
        .route("/api/vision/health", get(vision_health))
        .route("/api/vision/frame", post(vision_frame_post))
        .route("/api/media/tools", get(media_tools))
        .route("/api/media/resolve", get(media_resolve_help).post(media_resolve_post))
        .route("/api/media/ffplay", get(media_ffplay_help).post(media_ffplay_post))
        .route("/api/media/stop", post(media_stop_post))
        .route("/api/media/popout", post(media_popout_post))
        // Active stream bus — chat Stream pin low-res pipe
        .route("/api/media/active", get(media_active_get).post(media_active_post).delete(media_active_clear))
        // Same-origin HLS restream (X broadcasts / CORS-hostile CDNs)
        .route("/api/media/hls/{job}/{file}", get(media_hls_get))
        // Colossus/Dojo LTS (GOJO/DOLOSUS) path resolution
        .route("/api/lts", get(lts_status))
        .route("/api/lts/status", get(lts_status))
        // Overview-style host AI hook (no client keys)
        .route("/api/agent/iterate", get(agent_iterate_help).post(agent_iterate_post))
        .route("/api/ai/iterate", get(agent_iterate_help).post(agent_iterate_post))
        // Full rocket chain: iterate → fat handoff → Panda αβγ
        .route("/api/agent/chain", get(agent_chain_help).post(agent_chain_post))
        .route("/api/ai/chain", get(agent_chain_help).post(agent_chain_post))
        // Fleet: Panda host + handoff bus (Mu-class product path)
        .route("/api/panda/open", get(panda_open_get).post(panda_open_post))
        .route("/api/panda/status", get(panda_status_get))
        .route("/api/shells", get(shells_get).post(shells_post))
        .route("/api/shells/handoff", post(shells_handoff_post))
        .route("/api/shells/pack", get(shells_pack_get).post(shells_pack_post))
        .route("/api/shells/reset", post(shells_reset_post))
        // SpaceXAI Grok Voice catalog + TTS / STT proxies
        .route("/api/voices", get(voices_list))
        .route("/api/tts", post(tts_proxy))
        .route("/api/stt", get(stt_help).post(stt_proxy))
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
        "windows": ["lab", "chat", "stream", "agent", "launch", "browser"],
        "chat_visible": st.control.chat_visible(),
        "stream_visible": st.control.stream_visible(),
        "chat_docked": st.control.chat_docked(),
        "stream_docked": st.control.stream_docked(),
        "control": format!("{url}api/control"),
        "root": st.root.display().to_string(),
        "repo": st.repo.display().to_string(),
        "grok": which("grok").or_else(|| which("xai-grok-pager")),
        "panda": crate::fleet::find_panda(&st.repo).map(|p| p.display().to_string()),
        "multi_term": "panda",
        "gy": which("gy"),
        "fleet": true,
        "playpen": true,
        "playpen_url": format!("{url}api/playpen"),
        "voice_url": format!("{url}api/voice"),
        "ts": now_secs(),
    }))
}

// ── Playpen + /voice ─────────────────────────────────────────────────

async fn playpen_get(State(st): State<Arc<LabState>>) -> Json<Value> {
    let url = st.base_url.lock().unwrap().clone();
    let mut snap = crate::playpen::status(&st.repo, &st.root, &url);
    if let Some(obj) = snap.as_object_mut() {
        obj.insert("catalog".into(), crate::playpen::catalog());
    }
    Json(snap)
}

#[derive(Deserialize, Default)]
struct PlaypenBody {
    domain: Option<String>,
    action: Option<String>,
    what: Option<String>,
    topic: Option<String>,
    text: Option<String>,
    message: Option<String>,
    prompt: Option<String>,
    voice_id: Option<String>,
    voice: Option<String>,
    limit: Option<u64>,
    /// Freeform: "mitigate diagnose" | "/voice speak hello" | "explore git"
    cmd: Option<String>,
    q: Option<String>,
}

async fn playpen_post(
    State(st): State<Arc<LabState>>,
    Json(body): Json<PlaypenBody>,
) -> Json<Value> {
    let url = st.base_url.lock().unwrap().clone();
    let (domain, action) = parse_playpen_cmd(&body);
    let mut map = serde_json::Map::new();
    if let Some(t) = body.text.or(body.message).or(body.prompt) {
        map.insert("text".into(), json!(t));
    }
    if let Some(w) = body.what.or(body.topic) {
        map.insert("what".into(), json!(w));
    }
    if let Some(v) = body.voice_id.or(body.voice) {
        map.insert("voice_id".into(), json!(v));
    }
    if let Some(l) = body.limit {
        map.insert("limit".into(), json!(l));
    }
    let payload = Value::Object(map);
    Json(crate::playpen::dispatch(
        &st.repo,
        &st.root,
        &url,
        &domain,
        &action,
        &payload,
    ))
}

fn parse_playpen_cmd(body: &PlaypenBody) -> (String, String) {
    if let Some(raw) = body.cmd.as_ref().or(body.q.as_ref()) {
        let raw = raw.trim();
        let raw = raw.strip_prefix('/').unwrap_or(raw);
        let mut parts = raw.split_whitespace();
        let first = parts.next().unwrap_or("status").to_ascii_lowercase();
        // /voice speak hello world
        if first == "voice" {
            let action = parts.next().unwrap_or("status").to_ascii_lowercase();
            return ("voice".into(), action);
        }
        let domains = [
            "manage", "explore", "mitigate", "research", "voice", "status", "help",
        ];
        if domains.contains(&first.as_str()) {
            let action = parts.next().unwrap_or("").to_ascii_lowercase();
            return (first, action);
        }
        // bare "diagnose" → mitigate diagnose
        return ("mitigate".into(), first);
    }
    (
        body.domain
            .clone()
            .unwrap_or_else(|| "status".into())
            .to_ascii_lowercase(),
        body.action
            .clone()
            .unwrap_or_default()
            .to_ascii_lowercase(),
    )
}

#[derive(Deserialize, Default)]
struct VoiceBody {
    action: Option<String>,
    text: Option<String>,
    message: Option<String>,
    voice_id: Option<String>,
    voice: Option<String>,
    cmd: Option<String>,
    /// Opt-in only — default is Grok free TTS, never macOS say.
    use_mac_say: Option<bool>,
    #[serde(rename = "useMacSay")]
    use_mac_say_alt: Option<bool>,
}

async fn voice_get() -> Json<Value> {
    Json(crate::playpen::voice_status())
}

fn persona_path() -> PathBuf {
    crate::fleet::panda_home().join("personas.json")
}

async fn persona_get() -> Json<Value> {
    let p = persona_path();
    if let Ok(raw) = std::fs::read_to_string(&p) {
        if let Ok(v) = serde_json::from_str::<Value>(&raw) {
            return Json(json!({ "ok": true, "persona": v, "path": p.display().to_string() }));
        }
    }
    Json(json!({
        "ok": true,
        "persona": {
            "id": "you",
            "name": "You",
            "traits": [],
            "samples": 0
        },
        "path": p.display().to_string(),
    }))
}

async fn persona_post(Json(body): Json<Value>) -> Json<Value> {
    let p = persona_path();
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // Accept full persona object or wrap
    let persona = if body.get("name").is_some() || body.get("traits").is_some() {
        body
    } else {
        body.get("persona").cloned().unwrap_or(body)
    };
    match serde_json::to_string_pretty(&persona) {
        Ok(s) => match std::fs::write(&p, s + "\n") {
            Ok(()) => {
                crate::playpen::push_event("info", "persona updated", "vision", None);
                Json(json!({ "ok": true, "path": p.display().to_string(), "persona": persona }))
            }
            Err(e) => Json(json!({ "ok": false, "error": e.to_string() })),
        },
        Err(e) => Json(json!({ "ok": false, "error": e.to_string() })),
    }
}

async fn vision_health() -> Json<Value> {
    let base = std::env::var("GY_VISION_AITO_URL")
        .or_else(|_| std::env::var("AITO_URL"))
        .unwrap_or_else(|_| "http://127.0.0.1:8766".into());
    let base = base.trim_end_matches('/').to_string();
    let url = format!("{base}/health");
    let out = Command::new("curl")
        .args(["-sS", "--max-time", "1", "-o", "/dev/null", "-w", "%{http_code}", &url])
        .output();
    let code = out
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    let ok = code == "200" || code == "204";
    Json(json!({
        "ok": ok,
        "aito": base,
        "http": code,
        "message": if ok { "AIto vision sidecar up" } else { "AIto offline — start aito-mac / set GY_VISION_AITO_URL" },
        "mock": std::env::var("GY_VISION_AITO_MOCK").ok(),
    }))
}

#[derive(Deserialize)]
struct VisionFrameBody {
    image: Option<String>,
    persona: Option<Value>,
    mode: Option<String>,
}

async fn vision_frame_post(Json(body): Json<VisionFrameBody>) -> Json<Value> {
    // Local light recognition: if AIto up, forward; else grow persona from client payload.
    let base = std::env::var("GY_VISION_AITO_URL")
        .or_else(|_| std::env::var("AITO_URL"))
        .unwrap_or_else(|_| "http://127.0.0.1:8766".into());
    let base = base.trim_end_matches('/').to_string();
    let mode = body.mode.unwrap_or_else(|| "recognize".into());
    let mut summary = "local persona sample".to_string();
    let mut traits: Vec<String> = Vec::new();
    let mut name: Option<String> = None;

    if let Some(ref p) = body.persona {
        if let Some(n) = p.get("name").and_then(|v| v.as_str()) {
            name = Some(n.to_string());
        }
        if let Some(arr) = p.get("traits").and_then(|v| v.as_array()) {
            for t in arr {
                if let Some(s) = t.as_str() {
                    traits.push(s.to_string());
                }
            }
        }
        let samples = p.get("samples").and_then(|v| v.as_u64()).unwrap_or(0);
        if samples > 30 {
            traits.push("known-user".into());
            summary = format!("Recognized familiar user ({samples} samples)");
        } else {
            summary = format!("Learning look · {samples} samples");
        }
    }

    // Best-effort AIto pose/segment if image present
    let mut aito: Option<Value> = None;
    if body.image.as_ref().map(|s| s.len() > 32).unwrap_or(false) {
        let payload = json!({
            "image": body.image,
            "mode": mode,
            "persona": body.persona,
        });
        let tmp_body = payload.to_string();
        let url = format!("{base}/pose");
        let out = Command::new("curl")
            .args([
                "-sS",
                "--max-time",
                "4",
                "-X",
                "POST",
                &url,
                "-H",
                "Content-Type: application/json",
                "-d",
                &tmp_body,
            ])
            .output();
        if let Ok(o) = out {
            if o.status.success() {
                if let Ok(v) = serde_json::from_slice::<Value>(&o.stdout) {
                    aito = Some(v);
                    summary.push_str(" · AIto pose ok");
                    traits.push("aito-seen".into());
                }
            }
        }
    }

    crate::playpen::push_event("info", &summary, "vision", None);
    Json(json!({
        "ok": true,
        "mode": mode,
        "name": name.unwrap_or_else(|| "You".into()),
        "traits": traits,
        "summary": summary,
        "note": format!("vision@{now}", now = now_secs()),
        "aito": aito,
        "sidecar": base,
    }))
}

async fn voice_post(Json(body): Json<VoiceBody>) -> Json<Value> {
    let mut action = body.action.unwrap_or_else(|| "status".into());
    let mut text = body.text.or(body.message);
    if let Some(cmd) = body.cmd {
        let cmd = cmd.trim().trim_start_matches('/');
        let mut parts = cmd.split_whitespace();
        let first = parts.next().unwrap_or("status");
        if first.eq_ignore_ascii_case("voice") {
            action = parts.next().unwrap_or("status").to_string();
            let rest: Vec<&str> = parts.collect();
            if !rest.is_empty() {
                text = Some(rest.join(" "));
            }
        } else if first.eq_ignore_ascii_case("speak") || first.eq_ignore_ascii_case("say") {
            action = "speak".into();
            let rest: Vec<&str> = parts.collect();
            if !rest.is_empty() {
                text = Some(rest.join(" "));
            }
        } else {
            action = first.to_string();
            let rest: Vec<&str> = parts.collect();
            if !rest.is_empty() {
                text = Some(rest.join(" "));
            }
        }
    }
    let voice_id = body.voice_id.or(body.voice);
    let use_mac = body
        .use_mac_say
        .or(body.use_mac_say_alt)
        .unwrap_or(false);
    Json(crate::playpen::voice_dispatch_opts(
        &action,
        text.as_deref(),
        voice_id.as_deref(),
        use_mac,
    ))
}

async fn control_help() -> Json<Value> {
    Json(json!({
        "ok": true,
        "spacexai": true,
        "description": "POST JSON to drive native lab windows (dock/undock · launch pad · multi-term)",
        "actions": [
            "show_chat", "hide_chat", "toggle_chat", "focus_chat", "focus_lab",
            "show_stream", "hide_stream", "toggle_stream", "focus_stream",
            "dock_chat", "undock_chat", "dock_stream", "undock_stream",
            "link_all", "unlink_all", "arrange", "organize", "tidy", "dock", "undock",
            "pin", "unpin", "decorations", "minimize", "maximize", "close",
            "center", "move", "resize", "eval", "error",
            "refresh", "refresh_lab", "refresh_chat", "refresh_stream", "refresh_agent", "refresh_launch", "refresh_all",
            "check_updates", "open_chat_independent", "chat_only",
            "open_panda", "spawn_fleet",
            "show_agent", "hide_agent", "toggle_agent",
            "show_launch", "hide_launch", "toggle_launch", "open_launch",
            "show_browser", "hide_browser", "toggle_browser", "open_browser",
            "open_chat_independent", "chat_only", "only_chat", "solo_chat", "just_chat", "standalone_chat",
            "chat_orb", "orb", "siri_orb", "orb_chat", "mini_chat",
            "lab_ship", "labship", "ship_orb", "lab_ship_orb",
            "chat_full", "full_chat", "expand_chat",
            "navigate", "browse", "goto", "open_url",
            "drag", "ping", "quit"
        ],
        "targets": ["lab", "chat", "stream", "agent", "launch", "browser", "all"],
        "examples": [
            {"action": "show_stream"},
            {"action": "show_launch"},
            {"action": "dock_chat"},
            {"action": "undock_stream"},
            {"action": "link_all"},
            {"action": "show_chat"},
            {"action": "refresh_all"},
            {"action": "check_updates"},
            {"action": "open_panda"},
            {"action": "spawn_fleet"},
            {"action": "pin", "target": "chat", "on": true},
            {"action": "center", "target": "lab"},
            {"action": "eval", "target": "chat", "script": "LabChat.listen()"},
            {"action": "show_browser"},
            {"action": "navigate", "url": "search:SpaceX"},
            {"action": "navigate", "url": "nav:home"},
            {"action": "navigate", "url": "rail:toggle"},
            {"action": "eval", "target": "browser", "script": "LabX.search('Starship')"},
            {"action": "eval", "target": "browser", "script": "LabX.state()"},
            {"action": "error", "message": "fix me"},
            {"action": "quit"}
        ],
        "browser_shell": {
            "page": "/browser.html",
            "shipped": true,
            "classic": "/browser-classic.html",
            "api": "window.LabX",
            "open": "POST /api/control {\"action\":\"show_browser\"}",
            "commands": [
                "search:SpaceX",
                "nav:explore",
                "@SpaceX",
                "rail:open",
                "lab:stream.html",
                "back",
                "compose",
                "state"
            ],
            "eval_examples": [
                "LabX.search('from:xai')",
                "LabX.nav('notifications')",
                "LabX.run('rail:close')",
                "LabX.help()"
            ]
        }
    }))
}

async fn control_post(
    State(st): State<Arc<LabState>>,
    Json(body): Json<ControlRequest>,
) -> (StatusCode, Json<Value>) {
    // Fleet actions run off the UI thread (spawn Panda) — not window ControlCmd.
    let action = body.action.to_ascii_lowercase();
    if matches!(action.as_str(), "open_panda" | "spawn_fleet" | "panda") {
        let splits = body.splits.unwrap_or(3);
        let out = crate::fleet::open_panda_fleet(&st.repo, splits);
        let ok = out.get("ok").and_then(|v| v.as_bool()).unwrap_or(false);
        return if ok {
            (StatusCode::OK, Json(out))
        } else {
            (StatusCode::OK, Json(out)) // still 200 so UI can show mitigation
        };
    }
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
        "stream_visible": st.control.stream_visible(),
        "chat_docked": st.control.chat_docked(),
        "stream_docked": st.control.stream_docked(),
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

/// Help for STT proxy (WKWebView Web Speech often returns service-not-allowed).
async fn stt_help() -> Json<Value> {
    Json(json!({
        "ok": true,
        "endpoint": "POST /api/stt",
        "upstream": "https://api.x.ai/v1/stt",
        "body": "raw audio bytes (audio/webm, audio/mp4, audio/wav, …) or multipart file",
        "headers": {
            "Content-Type": "audio/* mime of the payload",
            "X-Language": "optional ISO language, default en",
        },
        "why": "Safari/WKWebView SpeechRecognition often errors with service-not-allowed; mic still works via getUserMedia",
        "docs": "https://docs.x.ai/developers/model-capabilities/audio/speech-to-text",
    }))
}

/// Proxy STT so the browser never sees XAI_API_KEY.
/// Accepts raw audio body with Content-Type: audio/… (preferred for MediaRecorder).
async fn stt_proxy(headers: HeaderMap, body: Bytes) -> Response {
    let Some(key) = xai_api_key() else {
        return json_err(
            StatusCode::SERVICE_UNAVAILABLE,
            "XAI_API_KEY not set — export key for Grok STT (Web Speech blocked in native WKWebView)",
        );
    };
    if body.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "empty audio body");
    }
    // Cap ~12 MB (short listen chunks; xAI allows 500 MB)
    if body.len() > 12 * 1024 * 1024 {
        return json_err(StatusCode::PAYLOAD_TOO_LARGE, "audio too large (max 12 MB)");
    }

    let ctype = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_ascii_lowercase();
    // If client sent JSON {audio_b64, mime} — support that too
    if ctype.contains("application/json") {
        return stt_from_json(&key, &body, &headers);
    }

    let lang = headers
        .get("x-language")
        .or_else(|| headers.get("x-stt-language"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("en")
        .trim()
        .to_string();
    let ext = stt_ext_for_mime(&ctype);
    let mime = if ctype.starts_with("audio/") {
        ctype.split(';').next().unwrap_or("audio/webm").trim().to_string()
    } else {
        format!("audio/{}", if ext == "webm" { "webm" } else { ext })
    };

    match stt_transcribe_file(&key, &body, ext, &mime, &lang) {
        Ok(v) => {
            let body = v.to_string();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::CACHE_CONTROL, "no-store")
                .body(Body::from(body))
                .unwrap_or_else(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "response build failed"))
        }
        Err((code, msg)) => json_err(code, &msg),
    }
}

fn stt_from_json(key: &str, body: &Bytes, headers: &HeaderMap) -> Response {
    let Ok(v) = serde_json::from_slice::<Value>(body) else {
        return json_err(StatusCode::BAD_REQUEST, "invalid JSON");
    };
    let b64 = v
        .get("audio_b64")
        .or_else(|| v.get("audio"))
        .and_then(|x| x.as_str())
        .unwrap_or("");
    if b64.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "audio_b64 required");
    }
    // strip data-URL prefix if present
    let b64_clean = b64
        .split(',')
        .next_back()
        .unwrap_or(b64)
        .trim();
    let bytes = match b64_decode(b64_clean) {
        Ok(b) => b,
        Err(e) => return json_err(StatusCode::BAD_REQUEST, &format!("base64: {e}")),
    };
    let mime = v
        .get("mime")
        .or_else(|| v.get("content_type"))
        .and_then(|x| x.as_str())
        .unwrap_or("audio/webm")
        .to_ascii_lowercase();
    let lang = v
        .get("language")
        .and_then(|x| x.as_str())
        .or_else(|| {
            headers
                .get("x-language")
                .and_then(|h| h.to_str().ok())
        })
        .unwrap_or("en");
    let ext = stt_ext_for_mime(&mime);
    match stt_transcribe_file(key, &bytes, ext, &mime, lang) {
        Ok(out) => {
            let body = out.to_string();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::CACHE_CONTROL, "no-store")
                .body(Body::from(body))
                .unwrap_or_else(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "response build failed"))
        }
        Err((code, msg)) => json_err(code, &msg),
    }
}

fn stt_ext_for_mime(mime: &str) -> &'static str {
    let m = mime.split(';').next().unwrap_or(mime).trim();
    if m.contains("webm") {
        "webm"
    } else if m.contains("ogg") {
        "ogg"
    } else if m.contains("wav") || m.contains("wave") {
        "wav"
    } else if m.contains("mpeg") || m.contains("mp3") {
        "mp3"
    } else if m.contains("mp4") || m.contains("m4a") || m.contains("aac") {
        "m4a"
    } else if m.contains("flac") {
        "flac"
    } else if m.contains("opus") {
        "opus"
    } else {
        "webm"
    }
}

/// Minimal base64 decode (std only — no extra crate).
fn b64_decode(s: &str) -> Result<Vec<u8>, String> {
    // Prefer system base64 for correctness
    let mut child = Command::new("base64")
        .args(["-d"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("base64 spawn: {e}"))?;
    use std::io::Write;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(s.as_bytes())
            .map_err(|e| format!("base64 write: {e}"))?;
    }
    let out = child
        .wait_with_output()
        .map_err(|e| format!("base64 wait: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "base64 failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(out.stdout)
}

fn stt_transcribe_file(
    key: &str,
    audio: &[u8],
    ext: &str,
    mime: &str,
    language: &str,
) -> Result<Value, (StatusCode, String)> {
    let tmp = std::env::temp_dir().join(format!(
        "archlab-stt-{}-{}.{}",
        now_secs(),
        std::process::id(),
        ext
    ));
    if let Err(e) = std::fs::write(&tmp, audio) {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("write temp audio: {e}"),
        ));
    }
    let path = tmp.to_str().unwrap_or("/tmp/archlab-stt.bin");
    // file must be last form field per xAI docs
    let out = Command::new("curl")
        .args([
            "-sS",
            "--max-time",
            "45",
            "-X",
            "POST",
            "https://api.x.ai/v1/stt",
            "-H",
            &format!("Authorization: Bearer {key}"),
            "-F",
            "format=true",
            "-F",
            &format!("language={language}"),
            "-F",
            "keyterm=grok",
            "-F",
            "keyterm=hey grok",
            "-F",
            "keyterm=listen",
            "-F",
            "keyterm=summon",
            "-F",
            &format!("file=@{path};type={mime}"),
        ])
        .output();

    let _ = std::fs::remove_file(&tmp);

    match out {
        Ok(o) => {
            if !o.status.success() {
                let err = String::from_utf8_lossy(&o.stderr);
                return Err((
                    StatusCode::BAD_GATEWAY,
                    format!("curl stt failed: {err}"),
                ));
            }
            let raw = String::from_utf8_lossy(&o.stdout);
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Err((StatusCode::BAD_GATEWAY, "empty STT response".into()));
            }
            // curl may return JSON error body with 4xx — still on stdout with -sS
            match serde_json::from_str::<Value>(trimmed) {
                Ok(mut v) => {
                    if let Some(err) = v.get("error").cloned() {
                        let msg = err
                            .get("message")
                            .and_then(|m| m.as_str())
                            .or_else(|| err.as_str())
                            .unwrap_or("STT upstream error");
                        // If it looks like a real transcript envelope, keep it
                        if v.get("text").is_none() {
                            return Err((StatusCode::BAD_GATEWAY, msg.into()));
                        }
                    }
                    // Normalize envelope for the UI
                    if v.get("ok").is_none() {
                        v.as_object_mut().map(|m| {
                            m.insert("ok".into(), json!(true));
                            m.insert("via".into(), json!("grok-stt"));
                        });
                    }
                    Ok(v)
                }
                Err(_) => Err((
                    StatusCode::BAD_GATEWAY,
                    format!("STT non-JSON: {}", trimmed.chars().take(200).collect::<String>()),
                )),
            }
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("curl failed: {e}"),
        )),
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
    Json(json!({
        "ok": true,
        "events": crate::playpen::list_events(50),
        "playpen": true,
    }))
}

#[derive(Deserialize)]
struct EventBody {
    level: Option<String>,
    msg: Option<String>,
    source: Option<String>,
}

async fn events_post(Json(body): Json<EventBody>) -> Json<Value> {
    let level = body.level.as_deref().unwrap_or("info");
    let msg = body.msg.as_deref().unwrap_or("");
    let source = body.source.as_deref().unwrap_or("client");
    crate::playpen::push_event(level, msg, source, None);
    Json(json!({ "ok": true }))
}

#[derive(Deserialize)]
struct GitQ {
    limit: Option<usize>,
    repo: Option<String>,
}

fn ensure_upstream_main(repo: &std::path::Path) -> Result<String, String> {
    let check = |rev: &str| {
        Command::new("git")
            .args(["-C", repo.to_str().unwrap_or("."), "rev-parse", "--verify", rev])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    };
    for rev in ["upstream/main", "upstream/master", "xai/main"] {
        if check(rev) {
            return Ok(rev.to_string());
        }
    }
    let remotes = Command::new("git")
        .args(["-C", repo.to_str().unwrap_or("."), "remote"])
        .output();
    let has_upstream = remotes
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).split_whitespace().any(|r| r == "upstream"))
        .unwrap_or(false);
    if !has_upstream {
        let _ = Command::new("git")
            .args([
                "-C",
                repo.to_str().unwrap_or("."),
                "remote",
                "add",
                "upstream",
                "https://github.com/xai-org/grok-build.git",
            ])
            .output();
    }
    let fetch = Command::new("git")
        .args([
            "-C",
            repo.to_str().unwrap_or("."),
            "fetch",
            "upstream",
            "main",
            "--depth=120",
        ])
        .output();
    if fetch.map(|o| o.status.success()).unwrap_or(false) && check("upstream/main") {
        return Ok("upstream/main".into());
    }
    Err(
        "upstream/main missing — git remote add upstream https://github.com/xai-org/grok-build.git && git fetch upstream"
            .into(),
    )
}

async fn git_log(State(st): State<Arc<LabState>>, Query(q): Query<GitQ>) -> Json<Value> {
    let limit = q.limit.unwrap_or(80).min(200);
    let which = q
        .repo
        .as_deref()
        .unwrap_or("upstream")
        .trim()
        .to_ascii_lowercase();

    let (path, rev, label, source) = if matches!(which.as_str(), "gy" | "grokytalky" | "gy-repo") {
        (
            dirs_home()
                .map(|h| h.join("Projects/GrokYtalkY"))
                .unwrap_or_else(|| st.repo.clone()),
            None,
            "GrokYtalkY".to_string(),
            "gy",
        )
    } else if matches!(
        which.as_str(),
        "upstream" | "xai" | "xai-org" | "xai-grok-build" | "xai-grok" | "official"
    ) {
        match ensure_upstream_main(&st.repo) {
            Ok(r) => (
                st.repo.clone(),
                Some(r),
                "xai-org/grok-build".to_string(),
                "upstream",
            ),
            Err(msg) => {
                return Json(json!({
                    "ok": false,
                    "commits": [],
                    "repo": st.repo.display().to_string(),
                    "label": "xai-org/grok-build",
                    "message": msg,
                }));
            }
        }
    } else {
        (
            st.repo.clone(),
            None,
            "fork · fornevercollective/grok-build".to_string(),
            "fork",
        )
    };

    let mut args = vec![
        "-C".to_string(),
        path.to_str().unwrap_or(".").to_string(),
        "log".to_string(),
        format!("-{limit}"),
        "--pretty=format:%H%x09%h%x09%an%x09%ae%x09%aI%x09%s".to_string(),
    ];
    if let Some(ref r) = rev {
        args.push(r.clone());
    }
    let out = Command::new("git").args(&args).output();
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
    let repo_disp = if let Some(ref r) = rev {
        format!("{} @ {}", path.display(), r)
    } else {
        path.display().to_string()
    };
    Json(json!({
        "ok": true,
        "repo": repo_disp,
        "label": label,
        "rev": rev,
        "source": source,
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

// ── Fleet / Panda ────────────────────────────────────────────

#[derive(Deserialize)]
struct PandaOpenBody {
    splits: Option<u8>,
    #[allow(dead_code)]
    session: Option<String>,
}

async fn panda_open_get(State(st): State<Arc<LabState>>) -> Json<Value> {
    Json(crate::fleet::open_panda_fleet(&st.repo, 3))
}

async fn panda_open_post(
    State(st): State<Arc<LabState>>,
    Json(body): Json<PandaOpenBody>,
) -> Json<Value> {
    Json(crate::fleet::open_panda_fleet(
        &st.repo,
        body.splits.unwrap_or(3),
    ))
}

async fn panda_status_get(State(st): State<Arc<LabState>>) -> Json<Value> {
    Json(crate::fleet::panda_status(&st.repo))
}

async fn shells_get() -> Json<Value> {
    let mut v = crate::fleet::read_handoff();
    if let Some(obj) = v.as_object_mut() {
        obj.insert("ok".into(), json!(true));
        obj.insert(
            "path".into(),
            json!(crate::fleet::handoff_path().display().to_string()),
        );
        obj.insert("native".into(), json!(true));
    }
    Json(v)
}

#[derive(Deserialize)]
struct ShellsBody {
    id: Option<String>,
    shell: Option<String>,
    status: Option<String>,
}

async fn shells_post(Json(body): Json<ShellsBody>) -> Json<Value> {
    // Optional status poke for a shell role
    let sid = body
        .id
        .or(body.shell)
        .unwrap_or_default()
        .to_ascii_lowercase();
    if sid.is_empty() {
        return shells_get().await;
    }
    let mut state = crate::fleet::read_handoff();
    if let Some(shells) = state.get_mut("shells").and_then(|s| s.as_object_mut()) {
        if let Some(s) = shells.get_mut(&sid) {
            if let Some(st) = body.status {
                s["status"] = json!(st);
            }
        }
    }
    let _ = crate::fleet::write_handoff(&state);
    Json(json!({ "ok": true, "state": state }))
}

#[derive(Deserialize)]
struct HandoffBody {
    from: Option<String>,
    to: Option<String>,
    summary: Option<String>,
    msg: Option<String>,
    /// Fat pack fields (optional)
    prompt: Option<String>,
    iterate_text: Option<String>,
    #[serde(rename = "iterateText")]
    iterate_text_alt: Option<String>,
    text: Option<String>,
    role: Option<String>,
    files: Option<Value>,
    tests: Option<Value>,
    tool_trace: Option<Value>,
    #[serde(rename = "toolTrace")]
    tool_trace_alt: Option<Value>,
    messages: Option<Value>,
    pack: Option<Value>,
    payload: Option<Value>,
}

async fn shells_handoff_post(Json(body): Json<HandoffBody>) -> Json<Value> {
    let from = body.from.unwrap_or_default();
    let to = body.to.unwrap_or_default();
    let summary = body
        .summary
        .or(body.msg)
        .unwrap_or_else(|| format!("{from} → {to}"));
    let iterate = body
        .iterate_text
        .or(body.iterate_text_alt)
        .or(body.text);
    let tool_trace = body.tool_trace.or(body.tool_trace_alt);
    let pack = if let Some(p) = body.pack.or(body.payload) {
        Some(p)
    } else if body.prompt.is_some()
        || iterate.is_some()
        || body.files.is_some()
        || body.tests.is_some()
        || tool_trace.is_some()
        || body.messages.is_some()
    {
        Some(crate::fleet::build_pack(
            &summary,
            body.prompt.as_deref(),
            iterate.as_deref(),
            body.role.as_deref().or(Some(to.as_str())),
            body.files.as_ref(),
            body.tests.as_ref(),
            tool_trace.as_ref(),
            body.messages.as_ref(),
            None,
        ))
    } else {
        None
    };
    match crate::fleet::handoff_with_pack(&from, &to, &summary, pack) {
        Ok(v) => Json(v),
        Err(e) => Json(json!({ "ok": false, "error": e })),
    }
}

async fn shells_pack_get() -> Json<Value> {
    let pack = crate::fleet::read_last_pack();
    Json(json!({
        "ok": true,
        "pack": pack,
        "path": crate::fleet::last_pack_path().display().to_string(),
        "handoff": crate::fleet::handoff_path().display().to_string(),
        "fat": pack.is_object(),
    }))
}

#[derive(Deserialize)]
struct PackBody {
    summary: Option<String>,
    prompt: Option<String>,
    iterate_text: Option<String>,
    text: Option<String>,
    role: Option<String>,
    files: Option<Value>,
    tests: Option<Value>,
    tool_trace: Option<Value>,
    messages: Option<Value>,
    pack: Option<Value>,
}

async fn shells_pack_post(Json(body): Json<PackBody>) -> Json<Value> {
    let summary = body.summary.unwrap_or_else(|| "manual pack".into());
    let iterate = body.iterate_text.or(body.text);
    let pack = body.pack.unwrap_or_else(|| {
        crate::fleet::build_pack(
            &summary,
            body.prompt.as_deref(),
            iterate.as_deref(),
            body.role.as_deref(),
            body.files.as_ref(),
            body.tests.as_ref(),
            body.tool_trace.as_ref(),
            body.messages.as_ref(),
            None,
        )
    });
    match crate::fleet::write_pack_file(&pack, None) {
        Ok(path) => {
            let mut state = crate::fleet::read_handoff();
            state["last_pack"] = pack.clone();
            state["updated_at"] = json!(now_secs().to_string());
            let _ = crate::fleet::write_handoff(&state);
            Json(json!({
                "ok": true,
                "path": path.display().to_string(),
                "pack": pack,
            }))
        }
        Err(e) => Json(json!({ "ok": false, "error": e })),
    }
}

async fn shells_reset_post() -> Json<Value> {
    match crate::fleet::reset_handoff() {
        Ok(v) => Json(json!({ "ok": true, "state": v })),
        Err(e) => Json(json!({ "ok": false, "error": e })),
    }
}

fn summon_impl(phrase: &str) -> Json<Value> {
    // Prefer fleet host when phrase asks for panda / triple / fleet
    let low = phrase.to_ascii_lowercase();
    if low.contains("panda") || low.contains("fleet") || low.contains("triple") {
        // repo unknown here — caller should use /api/panda/open with state
        // fall through to grok unless we have HOME-relative search
        if let Ok(cwd) = std::env::current_dir() {
            // try walk up to find Cargo workspace with experiments/panda-shell
            let mut p = cwd;
            for _ in 0..6 {
                if p.join("experiments/panda-shell").is_dir() || p.join("target/release/panda").is_file() {
                    return Json(crate::fleet::open_panda_fleet(&p, 3));
                }
                if !p.pop() {
                    break;
                }
            }
        }
    }
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

async fn mitigate_get(
    State(st): State<Arc<LabState>>,
    Query(q): Query<MitBody>,
) -> Json<Value> {
    mitigate_impl(&st.repo, q.action.as_deref().unwrap_or(""))
}

async fn mitigate_post(
    State(st): State<Arc<LabState>>,
    Json(body): Json<MitBody>,
) -> Json<Value> {
    mitigate_impl(&st.repo, body.action.as_deref().unwrap_or(""))
}

fn mitigate_impl(repo: &std::path::Path, action: &str) -> Json<Value> {
    let a = action.trim();
    if a.is_empty() {
        return Json(crate::playpen::mitigate(repo, "help"));
    }
    let out = crate::playpen::mitigate(repo, a);
    if out.get("ok").and_then(|v| v.as_bool()) == Some(false)
        && matches!(
            a.to_ascii_lowercase().as_str(),
            "summon-grok" | "grok" | "open-panda" | "panda" | "fleet"
        )
    {
        if a.to_ascii_lowercase().contains("panda") || a.eq_ignore_ascii_case("fleet") {
            return summon_impl("panda fleet");
        }
        return summon_impl("mitigate");
    }
    Json(out)
}

async fn media_tools() -> Json<Value> {
    Json(crate::media::tools_json())
}

#[derive(Deserialize, Default)]
struct MediaBody {
    url: Option<String>,
    quality: Option<String>,
    #[allow(dead_code)]
    restream: Option<bool>,
    prefer_blank: Option<bool>,
    prefer_gy: Option<bool>,
    #[serde(rename = "preferBlank")]
    prefer_blank_alt: Option<bool>,
    #[serde(default, rename = "jobId")]
    #[allow(dead_code)]
    job_id: Option<String>,
    mode: Option<String>,
}

async fn media_resolve_help() -> Json<Value> {
    Json(json!({
        "ok": true,
        "method": "POST",
        "body": {
            "url": "https://x.com/spacexai | @spacexai | x:spacexai | youtube…",
            "quality": "1080",
            "prefer_blank": true,
            "prefer_gy": true,
        },
        "via": ["gy-hub", "blank", "yt-dlp", "ffplay popout"],
    }))
}

async fn media_resolve_post(Json(body): Json<MediaBody>) -> Json<Value> {
    let url = body.url.unwrap_or_default();
    let quality = body.quality.unwrap_or_else(|| "1080".into());
    let prefer_blank = body.prefer_blank.or(body.prefer_blank_alt).unwrap_or(false);
    let prefer_gy = body.prefer_gy.unwrap_or(false);
    let restream = body.restream.unwrap_or(true);
    let url_c = url.clone();
    let q_c = quality.clone();
    let result = tokio::task::spawn_blocking(move || {
        crate::media::resolve_opts(&url_c, &q_c, prefer_blank, prefer_gy, restream)
    })
    .await;
    match result {
        Ok(v) => Json(v),
        Err(e) => Json(json!({"ok": false, "error": e.to_string()})),
    }
}

async fn media_hls_get(
    axum::extract::Path((job, file)): axum::extract::Path<(String, String)>,
) -> Response {
    match crate::media::hls_file(&job, &file) {
        Ok((bytes, ctype)) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, ctype)
            .header(header::CACHE_CONTROL, "no-store")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(bytes))
            .unwrap_or_else(|_| json_err(StatusCode::INTERNAL_SERVER_ERROR, "hls body")),
        Err(e) => json_err(StatusCode::NOT_FOUND, &e),
    }
}

async fn media_ffplay_help() -> Json<Value> {
    Json(json!({
        "ok": true,
        "method": "POST",
        "body": {"url": "…", "quality": "1080"},
        "note": "GrokYtalkY/blank-style pop-out player via ffplay",
    }))
}

async fn media_ffplay_post(Json(body): Json<MediaBody>) -> Json<Value> {
    let url = body.url.unwrap_or_default();
    let quality = body.quality.unwrap_or_else(|| "1080".into());
    let url_c = url.clone();
    let q_c = quality.clone();
    let result =
        tokio::task::spawn_blocking(move || crate::media::ffplay(&url_c, &q_c)).await;
    match result {
        Ok(v) => Json(v),
        Err(e) => Json(json!({"ok": false, "error": e.to_string()})),
    }
}

async fn media_stop_post(Json(body): Json<MediaBody>) -> Json<Value> {
    crate::media::clear_active_feed();
    if let Some(id) = body.job_id.as_deref().filter(|s| !s.is_empty()) {
        let ok = crate::media::stop_job(id);
        return Json(json!({ "ok": ok, "jobId": id }));
    }
    Json(crate::media::stop_all())
}

#[derive(Deserialize, Default)]
struct ActiveFeedBody {
    play: Option<String>,
    input: Option<String>,
    title: Option<String>,
    #[serde(default, rename = "jobId")]
    job_id: Option<String>,
    via: Option<String>,
    live: Option<bool>,
    quality: Option<String>,
    playing: Option<bool>,
}

async fn media_active_get() -> Json<Value> {
    Json(crate::media::get_active_feed())
}

async fn media_active_post(Json(body): Json<ActiveFeedBody>) -> Json<Value> {
    let playing = body.playing.unwrap_or(true);
    let play = body.play.unwrap_or_default();
    if !playing || play.is_empty() {
        crate::media::clear_active_feed();
        return Json(json!({ "ok": true, "playing": false }));
    }
    crate::media::set_active_feed(
        &play,
        body.input.as_deref().unwrap_or(""),
        body.title.as_deref().unwrap_or(""),
        body.job_id.as_deref(),
        body.via.as_deref().unwrap_or("stream"),
        body.live.unwrap_or(false),
        body.quality.as_deref().unwrap_or(""),
    );
    Json(crate::media::get_active_feed())
}

async fn media_active_clear() -> Json<Value> {
    crate::media::clear_active_feed();
    Json(json!({ "ok": true, "playing": false }))
}

/// Pop-out: prefer blank / GY URLs; also launches ffplay as OS window.
async fn media_popout_post(Json(body): Json<MediaBody>) -> Json<Value> {
    let url = body.url.unwrap_or_default();
    let mode = body.mode.unwrap_or_else(|| "auto".into());
    let quality = body.quality.unwrap_or_else(|| "1080".into());
    let expanded = crate::media::expand_input(&url);
    let tools = crate::media::tools_json();
    let blank_up = tools.get("blank").and_then(|b| b.as_bool()).unwrap_or(false);
    let gy_up = tools.get("gy_hub").and_then(|b| b.as_bool()).unwrap_or(false);

    if mode == "ffplay" || mode == "auto" {
        if mode == "ffplay" || (!blank_up && !gy_up) {
            let url_c = expanded.clone();
            let q_c = quality.clone();
            let fp = tokio::task::spawn_blocking(move || crate::media::ffplay(&url_c, &q_c))
                .await
                .unwrap_or_else(|e| json!({"ok": false, "error": e.to_string()}));
            if mode == "ffplay" {
                return Json(fp);
            }
            if fp.get("ok") == Some(&Value::Bool(true)) {
                return Json(fp);
            }
        }
    }

    let blank_pop = format!(
        "http://127.0.0.1:5173/?url={}",
        urlencoding_simple(&expanded)
    );
    let gy_pop = format!(
        "http://127.0.0.1:9876/burst.html?url={}",
        urlencoding_simple(&expanded)
    );
    Json(json!({
        "ok": true,
        "via": if blank_up { "blank" } else if gy_up { "gy-hub" } else { "url" },
        "url": expanded,
        "popout_blank": blank_pop,
        "popout_gy": gy_pop,
        "blank_up": blank_up,
        "gy_up": gy_up,
        "message": "Open popout_blank or popout_gy in browser / Lab Browser window",
    }))
}

fn urlencoding_simple(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[derive(Deserialize, Default)]
struct IterateBody {
    prompt: Option<String>,
    message: Option<String>,
    text: Option<String>,
    role: Option<String>,
    max_turns: Option<u32>,
    #[serde(rename = "maxTurns")]
    max_turns_alt: Option<u32>,
    timeout_ms: Option<u64>,
    /// When true, also write fat pack into ~/.panda (default true)
    record_pack: Option<bool>,
}

#[derive(Deserialize, Default)]
struct ChainBody {
    prompt: Option<String>,
    message: Option<String>,
    text: Option<String>,
    role: Option<String>,
    from: Option<String>,
    to: Option<String>,
    /// Precomputed iterate text (skip re-iterate when set)
    iterate_text: Option<String>,
    #[serde(rename = "iterateText")]
    iterate_text_alt: Option<String>,
    /// Run grok -p before handoff (default true unless iterate_text provided)
    iterate: Option<bool>,
    /// Open Panda / Terminal αβγ (default true)
    open_fleet: Option<bool>,
    #[serde(rename = "openFleet")]
    open_fleet_alt: Option<bool>,
    max_turns: Option<u32>,
    files: Option<Value>,
    tests: Option<Value>,
}

async fn agent_iterate_help() -> Json<Value> {
    Json(json!({
        "ok": true,
        "method": "POST",
        "contract": "overview-onAiIterate-host-hook",
        "body": {
            "prompt": "string",
            "role": "agent|plan|build|verify",
            "max_turns": 8,
            "timeout_ms": 120000,
            "record_pack": true,
        },
        "via": "grok -p when found; else stub",
        "side_effect": "writes fat pack → ~/.panda/packs/last.json + lab-handoff.json last_iterate",
        "chain": "POST /api/agent/chain for iterate→handoff→Panda",
    }))
}

async fn agent_chain_help() -> Json<Value> {
    Json(json!({
        "ok": true,
        "method": "POST",
        "contract": "lab-rocket-chain",
        "body": {
            "prompt": "string",
            "role": "agent|plan|build|verify",
            "from": "plan",
            "to": "build",
            "iterate": true,
            "open_fleet": true,
            "files": ["path…"],
            "tests": ["cmd…"],
        },
        "flow": "iterate(optional) → fat handoff pack → open_panda_fleet (αβγ auto-role)",
    }))
}

fn record_pack_side_effect(prompt: &str, role: &str, text: &str, via: &str) -> Option<Value> {
    match crate::fleet::record_iterate(prompt, role, text, via) {
        Ok(v) => Some(v),
        Err(e) => Some(json!({ "ok": false, "error": e })),
    }
}

/// Host AI iterate — same contract as serve.sh / overview onAiIterate.
async fn agent_iterate_post(Json(body): Json<IterateBody>) -> Json<Value> {
    let prompt = body
        .prompt
        .or(body.message)
        .or(body.text)
        .unwrap_or_default()
        .trim()
        .to_string();
    if prompt.is_empty() {
        return Json(json!({"ok": false, "error": "empty prompt", "via": "empty"}));
    }
    let prompt = if prompt.len() > 12000 {
        format!("{}…[truncated]", &prompt[..12000])
    } else {
        prompt
    };
    let role = body
        .role
        .unwrap_or_else(|| "agent".into())
        .trim()
        .to_lowercase();
    let max_turns = body
        .max_turns
        .or(body.max_turns_alt)
        .unwrap_or(8)
        .clamp(1, 24);
    let timeout_ms = body.timeout_ms.unwrap_or(120_000).clamp(5_000, 300_000);
    let do_record = body.record_pack.unwrap_or(true);
    let bin = which("grok").or_else(|| which("xai-grok-pager"));
    let Some(bin) = bin else {
        let text = format!(
            "[stub · grok not on PATH]\nrole={role} max_turns={max_turns}\n\nPrompt:\n{}",
            &prompt[..prompt.len().min(800)]
        );
        let pack = if do_record {
            record_pack_side_effect(&prompt, &role, &text, "stub")
        } else {
            None
        };
        return Json(json!({
            "ok": true,
            "via": "stub",
            "stub": true,
            "role": role,
            "text": text,
            "bin": Value::Null,
            "pack": pack,
        }));
    };
    let preamble = match role.as_str() {
        "plan" => "You are α plan. Explore read-only, propose a short plan, stop for approval.",
        "build" => "You are β build. Implement the approved plan; stay in scope.",
        "verify" => "You are γ verify. Test and review only; report pass/fail.",
        _ => "You are Lab center agent. Be concise; prefer actionable steps.",
    };
    let full = format!("{preamble}\n\nUser:\n{prompt}");
    let max_str = max_turns.to_string();
    let bin_c = bin.clone();
    let result = tokio::task::spawn_blocking(move || {
        Command::new(&bin_c)
            .args(["-p", &full, "--max-turns", &max_str])
            .output()
    })
    .await;

    match result {
        Ok(Ok(out)) => {
            let mut text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if text.is_empty() {
                text = String::from_utf8_lossy(&out.stderr).trim().to_string();
            }
            if text.is_empty() {
                text = format!("(no output · exit {})", out.status.code().unwrap_or(-1));
            }
            if text.len() > 24000 {
                text = format!("{}…[truncated]", &text[..24000]);
            }
            let pack = if do_record {
                record_pack_side_effect(&prompt, &role, &text, "grok-p")
            } else {
                None
            };
            Json(json!({
                "ok": out.status.success() || !text.is_empty(),
                "via": "grok-p",
                "text": text,
                "bin": bin,
                "code": out.status.code(),
                "role": role,
                "max_turns": max_turns,
                "timeout_ms": timeout_ms,
                "pack": pack,
            }))
        }
        Ok(Err(e)) => Json(json!({
            "ok": false,
            "via": "error",
            "error": e.to_string(),
            "text": "",
            "bin": bin,
            "role": role,
        })),
        Err(e) => Json(json!({
            "ok": false,
            "via": "error",
            "error": e.to_string(),
            "text": "",
            "bin": bin,
            "role": role,
        })),
    }
}

/// Rocket chain: optional iterate → fat handoff → open αβγ fleet.
async fn agent_chain_post(
    State(st): State<Arc<LabState>>,
    Json(body): Json<ChainBody>,
) -> Json<Value> {
    let prompt = body
        .prompt
        .or(body.message)
        .or(body.text)
        .unwrap_or_default()
        .trim()
        .to_string();
    let role = body
        .role
        .unwrap_or_else(|| "plan".into())
        .trim()
        .to_lowercase();
    let from = body
        .from
        .unwrap_or_else(|| "plan".into())
        .trim()
        .to_lowercase();
    let to = body
        .to
        .unwrap_or_else(|| "build".into())
        .trim()
        .to_lowercase();
    let open_fleet = body
        .open_fleet
        .or(body.open_fleet_alt)
        .unwrap_or(true);
    let pre_text = body.iterate_text.or(body.iterate_text_alt);
    let want_iterate = body.iterate.unwrap_or(pre_text.is_none()) && pre_text.is_none();

    let mut iterate_out: Option<Value> = None;
    let mut iterate_text = pre_text.unwrap_or_default();

    if want_iterate && !prompt.is_empty() {
        let iter_body = IterateBody {
            prompt: Some(prompt.clone()),
            message: None,
            text: None,
            role: Some(role.clone()),
            max_turns: body.max_turns.or(Some(6)),
            max_turns_alt: None,
            timeout_ms: Some(120_000),
            record_pack: Some(true),
        };
        let Json(j) = agent_iterate_post(Json(iter_body)).await;
        iterate_out = Some(j.clone());
        if let Some(t) = j.get("text").and_then(|v| v.as_str()) {
            iterate_text = t.to_string();
        }
    } else if !iterate_text.is_empty() {
        let _ = crate::fleet::record_iterate(
            &prompt,
            &role,
            &iterate_text,
            "chain-precomputed",
        );
    }

    let chain = crate::fleet::chain_loop(
        &st.repo,
        &prompt,
        &role,
        &from,
        &to,
        if iterate_text.is_empty() {
            None
        } else {
            Some(iterate_text.as_str())
        },
        open_fleet,
        body.files.as_ref(),
        body.tests.as_ref(),
    );

    Json(json!({
        "ok": chain.get("ok").and_then(|v| v.as_bool()).unwrap_or(false),
        "via": "agent_chain",
        "iterate": iterate_out,
        "chain": chain,
        "from": from,
        "to": to,
        "role": role,
        "message": chain.get("message").cloned().unwrap_or(json!("chain done")),
    }))
}

/// Colossus / Dojo LTS path status (aliases: GOJO / DOLOSUS).
/// Resolves public-folder · repo-template · stageforge without cloning.
async fn lts_status(State(st): State<Arc<LabState>>) -> Json<Value> {
    let home = dirs_home();
    let expand = |p: &str| -> Option<std::path::PathBuf> {
        if p.starts_with("~/") {
            home.as_ref().map(|h| h.join(&p[2..]))
        } else if !p.is_empty() {
            Some(std::path::PathBuf::from(p))
        } else {
            None
        }
    };
    let first_existing = |cands: &[&str]| -> Option<String> {
        for c in cands {
            if c.is_empty() {
                continue;
            }
            if let Some(p) = expand(c) {
                if p.is_dir() {
                    return Some(p.display().to_string());
                }
            }
        }
        None
    };

    let env_pub = std::env::var("GROK_PUBLIC_FOLDER").unwrap_or_default();
    let env_tpl = std::env::var("GROK_REPO_TEMPLATE").unwrap_or_default();
    let env_sf = std::env::var("STAGEFORGE_HOME").unwrap_or_default();

    let public = first_existing(&[
        env_pub.as_str(),
        "~/projects/grok-public-folder",
        "~/dev/projects/grok-public-folder",
        "/Volumes/qbitOS/github/grok-public-folder",
        "/Volumes/qbitOS/00.dev/projects/grok-public-folder",
    ]);
    let template = first_existing(&[
        env_tpl.as_str(),
        "~/projects/grok-repo-template",
        "~/dev/projects/grok-repo-template",
        "/Volumes/qbitOS/github/grok-repo-template",
        "/Volumes/qbitOS/00.dev/projects/grok-repo-template",
    ]);
    let stageforge_home = first_existing(&[
        env_sf.as_str(),
        "~/dev/stageforge",
        "~/Dev/stageforge",
    ]);
    let stageforge_bin = which("stageforge").or_else(|| {
        stageforge_home.as_ref().and_then(|h| {
            let p = std::path::Path::new(h).join("bin/stageforge");
            if p.is_file() {
                Some(p.display().to_string())
            } else {
                None
            }
        })
    });

    let script = st.root.join("scripts/colossus-dojo-lts.sh");
    let manifest = st.root.join("stageforge.yaml");
    let meta = st.root.join("metadata.yaml");

    Json(json!({
        "ok": true,
        "pipe": "colossus_dojo_lts",
        "alias": ["gojo", "dolosus", "colossus", "dojo"],
        "native": true,
        "paths": {
            "lab": st.root.display().to_string(),
            "repo": st.repo.display().to_string(),
            "public_folder": public,
            "repo_template": template,
            "stageforge": stageforge_home,
            "stageforge_bin": stageforge_bin,
            "script": if script.is_file() { Some(script.display().to_string()) } else { None::<String> },
            "manifest": if manifest.is_file() { Some(manifest.display().to_string()) } else { None::<String> },
            "metadata": if meta.is_file() { Some(meta.display().to_string()) } else { None::<String> },
        },
        "repos": {
            "public_folder": "https://github.com/fornevercollective/grok-public-folder",
            "repo_template": "https://github.com/fornevercollective/grok-repo-template",
            "upstream_compare": "https://github.com/fornevercollective/grok-build/compare/main...xai-org%3Agrok-build%3Amain",
            "upstream": "https://github.com/xai-org/grok-build",
        },
        "pipe_stages": [
            "imagine preset → public-folder generate",
            "Resolve 4K export",
            "repo-template train / colossus-launch / rust-dojo",
        ],
        "commands": {
            "status": "./scripts/colossus-dojo-lts.sh status",
            "up": "./scripts/colossus-dojo-lts.sh up",
            "upstream": "./scripts/colossus-dojo-lts.sh upstream",
            "stageforge": "stageforge up",
        },
        "policy": "path-checkout only · no monorepo merge · no PRs to xai-org",
        "doc": "#/25-colossus-dojo-lts",
        "ts": now_secs(),
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
