//! Dev playpen — Grok's local room to manage · explore · mitigate · research · voice.
//!
//! One Rust surface for the agent to grow and communicate from:
//! - **manage** — windows, fleet, handoff, session health
//! - **explore** — git, processes, packs, lab tree, bins
//! - **mitigate** — crash/runaway recovery (ffmpeg, stuck state, reset bus)
//! - **research** — structured snapshot for plan/build reasoning
//! - **voice** — /voice catalog + speak (xAI TTS or macOS `say`) + listen intents
//!
//! Pair with cloud Automations (grok.com/automations) for schedule; this is the
//! local Mac playpen the schedule can kick via HTTP.

use crate::fleet;
use serde_json::{json, Map, Value};
use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const EVENT_CAP: usize = 200;

static EVENTS: Mutex<VecDeque<Value>> = Mutex::new(VecDeque::new());

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
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

/// Append a playpen event (also used by crash/mitigate paths).
pub fn push_event(level: &str, msg: &str, source: &str, extra: Option<Value>) {
    let mut e = json!({
        "ts": now_secs(),
        "level": level,
        "msg": msg,
        "source": source,
    });
    if let Some(Value::Object(m)) = extra {
        if let Some(obj) = e.as_object_mut() {
            for (k, v) in m {
                obj.insert(k, v);
            }
        }
    }
    if let Ok(mut q) = EVENTS.lock() {
        q.push_back(e);
        while q.len() > EVENT_CAP {
            q.pop_front();
        }
    }
    match level {
        "error" | "err" => tracing::error!(%msg, %source, "playpen"),
        "warn" => tracing::warn!(%msg, %source, "playpen"),
        _ => tracing::info!(%msg, %source, "playpen"),
    }
}

pub fn list_events(limit: usize) -> Vec<Value> {
    let lim = limit.clamp(1, EVENT_CAP);
    EVENTS
        .lock()
        .map(|q| q.iter().rev().take(lim).cloned().collect())
        .unwrap_or_default()
}

// ── Catalog ──────────────────────────────────────────────────────────

pub fn catalog() -> Value {
    json!({
        "ok": true,
        "name": "Grok Build Lab · Dev Playpen",
        "version": "lab.playpen.v1",
        "purpose": "Local Rust playpen for Grok to manage, explore, mitigate crashes, research, and speak/listen",
        "cloud_pair": "https://grok.com/automations",
        "domains": {
            "manage": ["status", "windows", "fleet", "handoff", "arrange", "session"],
            "explore": ["git", "processes", "tree", "pack", "bins", "health", "events"],
            "mitigate": [
                "kill-ffmpeg", "reap-cam", "clear-errors", "reset-handoff",
                "soft-recover", "diagnose", "summon-grok", "open-panda"
            ],
            "research": ["snapshot", "git-log", "content", "handoff-pack", "lts-hint"],
            "voice": ["catalog", "speak", "status", "listen-hint", "say-status"]
        },
        "http": {
            "status": "GET /api/playpen",
            "dispatch": "POST /api/playpen {domain, action, ...}",
            "voice": "GET|POST /api/voice",
            "mitigate": "POST /api/mitigate {action}",
            "chain": "POST /api/agent/chain",
            "control": "POST /api/control {action}"
        },
        "voice_slash": "/voice — speak, catalog, status, say-status",
        "safety": [
            "No product YOLO by default",
            "Mitigate is ops-only (pkill ffmpeg, reset bus)",
            "Research is read-oriented",
            "TTS never logs API keys"
        ]
    })
}

// ── Status snapshot ──────────────────────────────────────────────────

pub fn status(repo: &Path, root: &Path, base_url: &str) -> Value {
    let handoff = fleet::read_handoff();
    let pack = fleet::read_last_pack();
    let procs = list_lab_processes();
    let git = git_brief(repo);
    let bins = json!({
        "grok": which("grok").or_else(|| which("xai-grok-pager")),
        "panda": fleet::find_panda(repo).map(|p| p.display().to_string()),
        "gy": which("gy"),
        "say": which("say"),
        "ffplay": which("ffplay"),
        "ffmpeg": which("ffmpeg"),
    });
    let crashy = procs
        .iter()
        .filter(|p| {
            p.get("kind").and_then(|k| k.as_str()) == Some("ffmpeg")
                || p.get("cpu").and_then(|c| c.as_f64()).unwrap_or(0.0) > 80.0
        })
        .count();

    json!({
        "ok": true,
        "playpen": true,
        "ts": now_secs(),
        "base_url": base_url,
        "repo": repo.display().to_string(),
        "lab_root": root.display().to_string(),
        "bins": bins,
        "git": git,
        "handoff": {
            "path": fleet::handoff_path().display().to_string(),
            "active": handoff.get("active").cloned().unwrap_or(Value::Null),
            "queue_n": handoff.get("queue").and_then(|q| q.as_array()).map(|a| a.len()).unwrap_or(0),
            "shells": handoff.get("shells").cloned().unwrap_or(json!({})),
        },
        "pack": {
            "path": fleet::last_pack_path().display().to_string(),
            "fat": pack.is_object(),
            "summary": pack.get("summary").cloned().unwrap_or(Value::Null),
        },
        "processes": procs,
        "alerts": {
            "runaway_or_ffmpeg": crashy,
            "needs_mitigate": crashy > 0,
        },
        "events_tail": list_events(12),
        "voice": voice_status(),
        "windows": ["lab", "chat", "stream", "agent", "launch", "browser"],
        "hint": "POST /api/playpen {\"domain\":\"mitigate\",\"action\":\"diagnose\"} · /voice speak",
    })
}

fn git_brief(repo: &Path) -> Value {
    let run = |args: &[&str]| -> String {
        Command::new("git")
            .args(args)
            .current_dir(repo)
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default()
    };
    let branch = run(&["rev-parse", "--abbrev-ref", "HEAD"]);
    let short = run(&["rev-parse", "--short", "HEAD"]);
    let dirty = !run(&["status", "--porcelain"]).is_empty();
    let ahead = run(&["rev-list", "--count", "upstream/main..HEAD"]);
    json!({
        "branch": branch,
        "sha_short": short,
        "dirty": dirty,
        "ahead_upstream_main": ahead.parse::<u64>().ok(),
    })
}

pub fn list_lab_processes() -> Vec<Value> {
    let out = Command::new("ps")
        .args(["-axo", "pid=,pcpu=,pmem=,etime=,state=,command="])
        .output();
    let mut processes = Vec::new();
    let Ok(o) = out else {
        return processes;
    };
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
            || low.contains("grok-build-lab")
            || low.contains("xai-grok")
            || low.contains("grokytalky")
            || low.contains("panda")
            || low.contains("webkit") && low.contains("lab"))
        {
            continue;
        }
        processes.push(json!({
            "pid": bits[0].parse::<i32>().unwrap_or(0),
            "cpu": bits[1].parse::<f64>().unwrap_or(0.0),
            "mem": bits[2].parse::<f64>().unwrap_or(0.0),
            "etime": bits[3],
            "state": bits[4],
            "kind": classify_proc(&cmd),
            "cmd": cmd.chars().take(200).collect::<String>(),
        }));
    }
    processes
}

fn classify_proc(cmd: &str) -> &'static str {
    let c = cmd.to_ascii_lowercase();
    if c.contains("ffmpeg") {
        "ffmpeg"
    } else if c.contains("panda") {
        "panda"
    } else if c.contains("grok-build-lab") || c.contains("architecture-lab") {
        "lab"
    } else if c.contains("xai-grok") || c.contains("grok") {
        "grok"
    } else if c.contains("gy") || c.contains("grokytalky") {
        "gy"
    } else {
        "other"
    }
}

// ── Explore ──────────────────────────────────────────────────────────

pub fn explore(repo: &Path, root: &Path, what: &str, limit: usize) -> Value {
    let w = what.trim().to_ascii_lowercase();
    match w.as_str() {
        "" | "status" | "snapshot" => status(repo, root, ""),
        "git" => json!({ "ok": true, "git": git_brief(repo), "log": git_log_lines(repo, limit) }),
        "git-log" | "log" => json!({ "ok": true, "log": git_log_lines(repo, limit) }),
        "processes" | "ps" => json!({ "ok": true, "processes": list_lab_processes() }),
        "pack" | "handoff-pack" => json!({
            "ok": true,
            "pack": fleet::read_last_pack(),
            "path": fleet::last_pack_path().display().to_string(),
        }),
        "handoff" => json!({
            "ok": true,
            "handoff": fleet::read_handoff(),
            "path": fleet::handoff_path().display().to_string(),
        }),
        "events" => json!({ "ok": true, "events": list_events(limit.max(20)) }),
        "bins" => json!({
            "ok": true,
            "bins": {
                "grok": which("grok").or_else(|| which("xai-grok-pager")),
                "panda": fleet::find_panda(repo).map(|p| p.display().to_string()),
                "gy": which("gy"),
                "cargo": which("cargo"),
                "say": which("say"),
            }
        }),
        "tree" | "lab-tree" => json!({
            "ok": true,
            "lab_root": root.display().to_string(),
            "entries": list_shallow(root, limit.min(80)),
        }),
        "content" => json!({
            "ok": true,
            "content": list_shallow(&root.join("content"), limit.min(60)),
        }),
        "crates" => {
            let crates = repo.join("crates");
            json!({
                "ok": true,
                "path": crates.display().to_string(),
                "entries": if crates.is_dir() { list_shallow(&crates, limit.min(80)) } else { vec![] },
            })
        }
        _ => json!({
            "ok": false,
            "error": format!("unknown explore target: {what}"),
            "known": ["status","git","git-log","processes","pack","handoff","events","bins","tree","content","crates"],
        }),
    }
}

fn git_log_lines(repo: &Path, limit: usize) -> Vec<String> {
    let n = limit.clamp(1, 40).to_string();
    Command::new("git")
        .args(["-C", repo.to_str().unwrap_or("."), "log", &format!("-{n}"), "--oneline"])
        .output()
        .ok()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default()
}

fn list_shallow(dir: &Path, limit: usize) -> Vec<Value> {
    let mut out = Vec::new();
    let Ok(rd) = fs::read_dir(dir) else {
        return out;
    };
    for e in rd.flatten().take(limit) {
        let meta = e.metadata().ok();
        out.push(json!({
            "name": e.file_name().to_string_lossy(),
            "dir": meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
            "path": e.path().display().to_string(),
        }));
    }
    out
}

// ── Mitigate ─────────────────────────────────────────────────────────

pub fn mitigate(repo: &Path, action: &str) -> Value {
    let a = action.trim().to_ascii_lowercase();
    push_event("info", &format!("mitigate:{a}"), "playpen", None);

    match a.as_str() {
        "" | "help" | "list" => json!({
            "ok": true,
            "known": [
                "diagnose", "soft-recover", "kill-ffmpeg", "reap-cam",
                "clear-errors", "reset-handoff", "summon-grok", "open-panda",
                "arrange-hint", "status"
            ],
            "hint": "POST /api/mitigate {\"action\":\"diagnose\"}",
        }),
        "status" | "diagnose" => {
            let procs = list_lab_processes();
            let ffmpeg: Vec<_> = procs
                .iter()
                .filter(|p| p.get("kind").and_then(|k| k.as_str()) == Some("ffmpeg"))
                .cloned()
                .collect();
            let hot: Vec<_> = procs
                .iter()
                .filter(|p| p.get("cpu").and_then(|c| c.as_f64()).unwrap_or(0.0) > 50.0)
                .cloned()
                .collect();
            let handoff = fleet::read_handoff();
            let recs = {
                let mut r = Vec::new();
                if !ffmpeg.is_empty() {
                    r.push("kill-ffmpeg — reap camera/ffmpeg hang");
                }
                if hot.len() > 3 {
                    r.push("soft-recover — clear bus + re-arrange windows via control");
                }
                if handoff
                    .get("queue")
                    .and_then(|q| q.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0)
                    > 10
                {
                    r.push("reset-handoff — clear stalled αβγ loop");
                }
                if r.is_empty() {
                    r.push("playpen healthy — research or /voice say-status");
                }
                r
            };
            json!({
                "ok": true,
                "action": "diagnose",
                "ffmpeg": ffmpeg,
                "hot": hot,
                "process_n": procs.len(),
                "handoff_queue": handoff.get("queue").and_then(|q| q.as_array()).map(|a| a.len()),
                "events": list_events(8),
                "recommend": recs,
                "git": git_brief(repo),
            })
        }
        "kill-ffmpeg" | "pkill-ffmpeg" | "reap-cam" => {
            let _ = Command::new("pkill").args(["-x", "ffmpeg"]).status();
            let _ = Command::new("pkill").args(["-9", "-x", "ffmpeg"]).status();
            push_event("warn", "killed ffmpeg", "mitigate", None);
            json!({ "ok": true, "action": "kill-ffmpeg", "message": "pkill -x ffmpeg" })
        }
        "reset-handoff" | "clear-handoff" => match fleet::reset_handoff() {
            Ok(s) => {
                push_event("warn", "handoff bus reset", "mitigate", None);
                json!({ "ok": true, "action": "reset-handoff", "state": s })
            }
            Err(e) => json!({ "ok": false, "error": e }),
        },
        "clear-errors" => {
            push_event("info", "errors cleared (playpen ring kept last 20)", "mitigate", None);
            // trim ring but keep tail for research
            if let Ok(mut q) = EVENTS.lock() {
                while q.len() > 20 {
                    q.pop_front();
                }
            }
            json!({
                "ok": true,
                "action": "clear-errors",
                "message": "playpen event ring trimmed; POST /api/control/errors DELETE for UI bus",
                "control_hint": "DELETE /api/control/errors",
            })
        }
        "soft-recover" | "recover" => {
            let kill = mitigate(repo, "kill-ffmpeg");
            let diag = mitigate(repo, "diagnose");
            push_event("warn", "soft-recover run", "mitigate", None);
            json!({
                "ok": true,
                "action": "soft-recover",
                "steps": {
                    "kill_ffmpeg": kill,
                    "diagnose": diag,
                    "chat": {
                        "show": "POST /api/control {\"action\":\"show_chat\"}",
                        "standalone": "POST /api/control {\"action\":\"open_chat_independent\"}",
                        "cam": "LabChatVision.openCam()",
                        "recover_ui": "LabChatVision.recover(reason)"
                    },
                    "next": [
                        "POST /api/control {\"action\":\"arrange\"}",
                        "POST /api/control {\"action\":\"show_chat\"}",
                        "POST /api/agent/chain {\"prompt\":\"recover session\",\"open_fleet\":false}",
                        "/voice say-status"
                    ]
                },
                "message": "ffmpeg reaped · diagnose · reopen chat/cam · arrange recommended",
            })
        }
        "open-chat" | "show-chat" | "chat" => json!({
            "ok": true,
            "action": "open-chat",
            "control": [
                {"action": "show_chat"},
                {"action": "open_chat_independent"}
            ],
            "message": "POST /api/control show_chat or open_chat_independent",
        }),
        "summon-grok" | "grok" => {
            // Open Terminal with grok when possible
            #[cfg(target_os = "macos")]
            {
                if let Some(bin) = which("grok").or_else(|| which("xai-grok-pager")) {
                    let script = format!(
                        r#"tell application "Terminal"
                          activate
                          do script "exec {bin}"
                          set custom title of front window to "Grok · playpen"
                        end tell"#,
                        bin = bin.replace('\\', "\\\\").replace('"', "\\\"")
                    );
                    let _ = Command::new("osascript").args(["-e", &script]).spawn();
                    return json!({ "ok": true, "action": "summon-grok", "via": "Terminal.app", "bin": bin });
                }
            }
            json!({
                "ok": false,
                "action": "summon-grok",
                "message": "grok not on PATH",
                "mitigation": "install grok / cargo build -p xai-grok-pager-bin",
            })
        }
        "open-panda" | "panda" | "fleet" => {
            let out = fleet::open_panda_fleet(repo, 3);
            push_event("info", "open panda fleet", "mitigate", None);
            out
        }
        "arrange-hint" => json!({
            "ok": true,
            "action": "arrange-hint",
            "control": {"action": "arrange"},
            "message": "POST /api/control {\"action\":\"arrange\"} to fit windows to display",
        }),
        _ => json!({
            "ok": false,
            "message": format!("unknown mitigate action: {action}"),
            "known": ["diagnose","soft-recover","kill-ffmpeg","reset-handoff","clear-errors","summon-grok","open-panda"],
        }),
    }
}

// ── Research ─────────────────────────────────────────────────────────

pub fn research(repo: &Path, root: &Path, topic: &str) -> Value {
    let t = topic.trim().to_ascii_lowercase();
    push_event("info", &format!("research:{t}"), "playpen", None);
    match t.as_str() {
        "" | "snapshot" | "full" => {
            let mut m = Map::new();
            m.insert("ok".into(), json!(true));
            m.insert("kind".into(), json!("research.snapshot"));
            m.insert("ts".into(), json!(now_secs()));
            m.insert("status".into(), status(repo, root, ""));
            m.insert("git_log".into(), json!(git_log_lines(repo, 12)));
            m.insert("pack".into(), fleet::read_last_pack());
            m.insert(
                "content_index".into(),
                json!(list_shallow(&root.join("content"), 40)),
            );
            m.insert(
                "playpen_docs".into(),
                json!([
                    "content/30-playpen.md",
                    "GET /api/playpen",
                    "POST /api/playpen",
                    "GET /api/voice",
                    "https://grok.com/automations"
                ]),
            );
            m.insert(
                "automations_bridge".into(),
                json!({
                    "cloud": "https://grok.com/automations",
                    "local_kick": "POST /api/agent/chain",
                    "local_mitigate": "POST /api/mitigate {\"action\":\"diagnose\"}",
                }),
            );
            Value::Object(m)
        }
        "crash" | "crashes" => {
            let log = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".into()))
                .join("Library/Logs/GrokBuildLab/launch.log");
            let tail = fs::read_to_string(&log)
                .ok()
                .map(|s| {
                    let lines: Vec<&str> = s.lines().collect();
                    lines
                        .iter()
                        .rev()
                        .take(40)
                        .cloned()
                        .collect::<Vec<_>>()
                        .into_iter()
                        .rev()
                        .collect::<Vec<_>>()
                        .join("\n")
                })
                .unwrap_or_else(|| "(no launch.log)".into());
            json!({
                "ok": true,
                "kind": "research.crash",
                "launch_log": log.display().to_string(),
                "tail": tail,
                "events": list_events(30),
                "processes": list_lab_processes(),
                "mitigate": ["diagnose", "soft-recover", "kill-ffmpeg"],
            })
        }
        "handoff" | "fleet" => explore(repo, root, "handoff", 20),
        "voice" => voice_status(),
        _ => explore(repo, root, &t, 30),
    }
}

// ── Voice (/voice) ───────────────────────────────────────────────────

/// Resolve SpaceXAI / Grok API key (never logged).
fn xai_api_key() -> Option<String> {
    for k in ["XAI_API_KEY", "GROK_API_KEY", "XAI_KEY"] {
        if let Ok(v) = std::env::var(k) {
            let t = v.trim().to_string();
            if !t.is_empty() {
                return Some(t);
            }
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home).join(".grok/auth.json");
        if let Ok(raw) = fs::read_to_string(p) {
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

/// Free Grok roster ids (original + common flagship) — not macOS voices.
pub fn grok_free_voice_ids() -> &'static [&'static str] {
    &[
        "ara", "eve", "leo", "rex", "sal", "carina", "zagan", "helix", "orion", "luna",
        "wellness", "support", "iris", "altair", "zenith", "perseus", "helios", "lux",
        "kepler", "rigel", "cosmo", "celeste", "ursa", "sirius", "lumen", "castor",
        "naksh", "atlas", "nova", "vega", "sol", "mira",
    ]
}

fn normalize_grok_voice(voice_id: Option<&str>) -> String {
    let v = voice_id.unwrap_or("eve").trim().to_ascii_lowercase();
    // Reject accidental macOS voice names → map to Grok free defaults
    match v.as_str() {
        "samantha" | "alex" | "daniel" | "karen" | "moira" | "tessa" | "fiona" => "eve".into(),
        "" => "eve".into(),
        other => {
            if grok_free_voice_ids().iter().any(|id| *id == other) {
                other.into()
            } else {
                // Still pass through — API may accept custom / new ids
                other.into()
            }
        }
    }
}

pub fn voice_status() -> Value {
    let has_key = xai_api_key().is_some();
    json!({
        "ok": true,
        "slash": "/voice",
        "engine": "grok-tts",
        "provider": "xAI / SpaceXAI",
        "macos_say": false,
        "macos_say_opt_in": "pass use_mac_say:true only if you really want system speech",
        "has_api_key": has_key,
        "tts_endpoint": "https://api.x.ai/v1/tts",
        "tts_proxy": "/api/tts",
        "stt_endpoint": "https://api.x.ai/v1/stt",
        "stt_proxy": "/api/stt",
        "stt_note": "WKWebView Web Speech often returns service-not-allowed; Listen falls back to Grok STT",
        "catalog": "/api/voices",
        "free_voices": grok_free_voice_ids(),
        "default_voice_id": "eve",
        "realtime_hint": "wss://api.x.ai/v1/realtime?model=grok-voice-latest",
        "docs": [
            "https://x.ai/voice",
            "https://x.ai/voice/text-to-speech",
            "https://docs.x.ai/developers/model-capabilities/audio/text-to-speech",
            "content/29-grok-voice-spheres.md"
        ],
        "intents": ["speak", "catalog", "status", "say-status", "listen-hint"],
        "message": if has_key {
            "Grok free voices ready (eve · ara · leo · …)"
        } else {
            "Set XAI_API_KEY (or ~/.grok/auth.json) for Grok TTS — macOS say is disabled by default"
        },
    })
}

/// Synthesize with **Grok free voices** via xAI TTS, play with afplay.
/// macOS `say` is **off** unless `use_mac_say` is true.
pub fn voice_speak(text: &str, voice_id: Option<&str>, use_mac_say: bool) -> Value {
    let text = text.trim();
    if text.is_empty() {
        return json!({ "ok": false, "error": "empty text" });
    }
    let clip: String = text.chars().take(2000).collect();
    let voice = normalize_grok_voice(voice_id);
    push_event(
        "info",
        &format!("voice speak {} chars · grok voice={voice}", clip.len()),
        "voice",
        Some(json!({ "voice_id": voice })),
    );

    // Primary: Grok / SpaceXAI TTS
    if let Some(key) = xai_api_key() {
        match grok_tts_play(&key, &clip, &voice, "en") {
            Ok(path) => {
                return json!({
                    "ok": true,
                    "via": "grok-tts",
                    "provider": "xAI",
                    "voice_id": voice,
                    "chars": clip.len(),
                    "file": path.display().to_string(),
                    "message": format!("speaking with Grok voice «{voice}»"),
                    "macos_say": false,
                });
            }
            Err(e) => {
                push_event("warn", &format!("grok-tts failed: {e}"), "voice", None);
                if !use_mac_say {
                    let credits = e.contains("credits")
                        || e.contains("spending limit")
                        || e.contains("permission");
                    return json!({
                        "ok": false,
                        "via": "grok-tts",
                        "voice_id": voice,
                        "error": e,
                        "credits_or_limit": credits,
                        "message": if credits {
                            "Grok TTS blocked by team credits / monthly spending limit — top up at console.x.ai (macOS say not used)"
                        } else {
                            "Grok TTS failed — check XAI_API_KEY / network (macOS say not used)"
                        },
                        "console": "https://console.x.ai",
                        "docs": "https://x.ai/voice/text-to-speech",
                        "retry": "POST /api/voice {\"action\":\"speak\",\"text\":\"…\",\"voice_id\":\"eve\"}",
                        "macos_say": false,
                    });
                }
            }
        }
    } else if !use_mac_say {
        return json!({
            "ok": false,
            "via": "grok-tts",
            "voice_id": voice,
            "error": "XAI_API_KEY not set",
            "message": "Export XAI_API_KEY for Grok free roster (eve, ara, leo, rex, sal, …). macOS system voices are disabled.",
            "docs": "https://x.ai/voice/text-to-speech",
            "console": "https://console.x.ai",
            "macos_say": false,
        });
    }

    // Explicit opt-in only
    if use_mac_say {
        if which("say").is_none() {
            return json!({ "ok": false, "via": "macos-say", "error": "say not available" });
        }
        let mac_voice = "Samantha";
        match Command::new("say").arg("-v").arg(mac_voice).arg(&clip).spawn() {
            Ok(_) => {
                return json!({
                    "ok": true,
                    "via": "macos-say",
                    "voice": mac_voice,
                    "voice_id_requested": voice,
                    "chars": clip.len(),
                    "message": "opt-in macOS say (not Grok) — set use_mac_say:false for Grok voices",
                    "macos_say": true,
                });
            }
            Err(e) => {
                return json!({ "ok": false, "via": "macos-say", "error": e.to_string() });
            }
        }
    }

    json!({
        "ok": false,
        "via": "none",
        "error": "no TTS path",
        "voice_id": voice,
    })
}

/// Call https://api.x.ai/v1/tts and play the MP3 (afplay on macOS).
fn grok_tts_play(key: &str, text: &str, voice_id: &str, language: &str) -> Result<PathBuf, String> {
    let tmp = std::env::temp_dir().join(format!(
        "lab-grok-tts-{}-{}.mp3",
        voice_id,
        now_secs()
    ));
    let payload = json!({
        "text": text,
        "voice_id": voice_id,
        "language": language,
    });
    let payload_s = payload.to_string();
    let out = Command::new("curl")
        .args([
            "-sS",
            "--max-time",
            "45",
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
            tmp.to_str().unwrap_or("/tmp/lab-grok-tts.mp3"),
            "-w",
            "%{http_code}",
        ])
        .output()
        .map_err(|e| format!("curl: {e}"))?;

    let code = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if code != "200" {
        // Error body is often written to the -o file as JSON
        let body = fs::read_to_string(&tmp).unwrap_or_default();
        let _ = fs::remove_file(&tmp);
        let err_hint = String::from_utf8_lossy(&out.stderr);
        let detail = if !body.is_empty() {
            // Prefer xAI error.message if present
            if let Ok(v) = serde_json::from_str::<Value>(&body) {
                v.get("error")
                    .and_then(|e| e.as_str())
                    .or_else(|| v.pointer("/error/message").and_then(|x| x.as_str()))
                    .unwrap_or(body.as_str())
                    .to_string()
            } else {
                body
            }
        } else {
            err_hint.to_string()
        };
        let detail: String = detail.chars().take(400).collect();
        return Err(format!("TTS HTTP {code}: {detail}"));
    }
    // Guard: if API returned JSON error with 200 (shouldn't), detect non-audio
    if let Ok(head) = fs::read(&tmp) {
        if head.starts_with(b"{") || head.starts_with(b"[") {
            let body = String::from_utf8_lossy(&head);
            let _ = fs::remove_file(&tmp);
            return Err(format!("TTS returned JSON not audio: {}", body.chars().take(300).collect::<String>()));
        }
    }
    let meta = fs::metadata(&tmp).map_err(|e| e.to_string())?;
    if meta.len() < 32 {
        let _ = fs::remove_file(&tmp);
        return Err("TTS response too small (empty audio)".into());
    }

    // Play without blocking the HTTP handler forever — detach afplay
    #[cfg(target_os = "macos")]
    {
        let path_s = tmp.display().to_string();
        let _ = Command::new("afplay").arg(&path_s).spawn();
    }
    #[cfg(not(target_os = "macos"))]
    {
        // Best-effort Linux players
        if which("ffplay").is_some() {
            let _ = Command::new("ffplay")
                .args(["-nodisp", "-autoexit", "-loglevel", "quiet"])
                .arg(&tmp)
                .spawn();
        } else if which("mpv").is_some() {
            let _ = Command::new("mpv")
                .args(["--no-video", "--really-quiet"])
                .arg(&tmp)
                .spawn();
        }
    }
    Ok(tmp)
}

pub fn voice_dispatch(action: &str, text: Option<&str>, voice_id: Option<&str>) -> Value {
    voice_dispatch_opts(action, text, voice_id, false)
}

pub fn voice_dispatch_opts(
    action: &str,
    text: Option<&str>,
    voice_id: Option<&str>,
    use_mac_say: bool,
) -> Value {
    let a = action.trim().to_ascii_lowercase();
    match a.as_str() {
        "" | "status" | "help" => voice_status(),
        "catalog" | "voices" | "list" => json!({
            "ok": true,
            "via": "grok-voices",
            "get": "/api/voices",
            "free_voices": grok_free_voice_ids(),
            "default_voice_id": "eve",
            "message": "Grok free TTS roster — eve · ara · leo · rex · sal · flagship ids",
        }),
        "speak" | "say" | "talk" => voice_speak(text.unwrap_or(""), voice_id, use_mac_say),
        "say-status" | "announce" => {
            let msg = text.unwrap_or(
                "Grok Build Lab playpen online. Manage, explore, mitigate, research, and Grok voice are ready.",
            );
            voice_speak(msg, voice_id.or(Some("eve")), use_mac_say)
        }
        "listen" | "listen-hint" => json!({
            "ok": true,
            "action": "listen-hint",
            "ui": "Lab chat listen dock · grok-listen.js",
            "control": {"action": "show_chat", "then": "LabChat.listen() if present"},
            "eval_hint": "POST /api/control {\"action\":\"eval\",\"target\":\"chat\",\"script\":\"LabChat && LabChat.listen && LabChat.listen()\"}",
            "realtime": "wss://api.x.ai/v1/realtime?model=grok-voice-latest",
            "tts": "Grok free voices via /api/voice speak — not macOS say",
            "message": "Open Chat and start listen dock; speak replies use Grok TTS",
        }),
        _ => json!({
            "ok": false,
            "error": format!("unknown /voice action: {action}"),
            "known": ["status","catalog","speak","say-status","listen-hint"],
        }),
    }
}

// ── Unified dispatch ─────────────────────────────────────────────────

pub fn dispatch(
    repo: &Path,
    root: &Path,
    base_url: &str,
    domain: &str,
    action: &str,
    body: &Value,
) -> Value {
    let d = domain.trim().to_ascii_lowercase();
    let a = action.trim().to_ascii_lowercase();
    let text = body
        .get("text")
        .or_else(|| body.get("message"))
        .or_else(|| body.get("prompt"))
        .and_then(|v| v.as_str());
    let what = body
        .get("what")
        .or_else(|| body.get("topic"))
        .or_else(|| body.get("target"))
        .and_then(|v| v.as_str())
        .unwrap_or(a.as_str());
    let limit = body
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(24) as usize;
    let voice_id = body
        .get("voice_id")
        .or_else(|| body.get("voice"))
        .and_then(|v| v.as_str());

    match d.as_str() {
        "" | "status" | "help" | "catalog" => {
            if a == "catalog" || d == "catalog" || d == "help" {
                catalog()
            } else {
                let mut s = status(repo, root, base_url);
                if let Some(obj) = s.as_object_mut() {
                    obj.insert("catalog".into(), catalog());
                }
                s
            }
        }
        "manage" => match a.as_str() {
            "status" | "" => status(repo, root, base_url),
            "fleet" | "open-panda" => fleet::open_panda_fleet(repo, 3),
            "handoff" => json!({
                "ok": true,
                "handoff": fleet::read_handoff(),
                "hint": "POST /api/shells/handoff or /api/agent/chain",
            }),
            "session" => json!({
                "ok": true,
                "session": "lab-playpen",
                "pack": fleet::read_last_pack(),
                "handoff_path": fleet::handoff_path().display().to_string(),
            }),
            "arrange" => json!({
                "ok": true,
                "control": {"action": "arrange"},
                "message": "POST /api/control {\"action\":\"arrange\"}",
            }),
            "chain" => json!({
                "ok": true,
                "hint": "POST /api/agent/chain",
                "body": {"prompt": text.unwrap_or("playpen chain"), "open_fleet": true},
            }),
            _ => json!({
                "ok": false,
                "error": format!("manage:{a}"),
                "known": ["status","fleet","handoff","session","arrange","chain"],
            }),
        },
        "explore" => explore(repo, root, what, limit),
        "mitigate" => mitigate(repo, if a.is_empty() { what } else { a.as_str() }),
        "research" => research(repo, root, if a.is_empty() { what } else { a.as_str() }),
        "voice" | "/voice" => voice_dispatch(
            if a.is_empty() { "status" } else { a.as_str() },
            text,
            voice_id,
        ),
        _ => json!({
            "ok": false,
            "error": format!("unknown domain: {domain}"),
            "domains": ["manage","explore","mitigate","research","voice","status"],
            "catalog": catalog(),
        }),
    }
}
