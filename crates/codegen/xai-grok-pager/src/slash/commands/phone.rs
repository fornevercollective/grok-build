//! `/phone` — tether Memory Glass phone PWA → still-pipe → Grok `/cam`.
//!
//! Same inspect grammar as Memory Glass:
//! phone HTTPS PWA → POST /upload → `~/.panda/vision/live.jpg` → cam tile.
//!
//! ```text
//! /phone              start hub (best-effort) + open /cam phone still-pipe
//! /phone hub          start still-server only (print status)
//! /phone urls         show LAN phone PWA URLs
//! /phone inspect      open live.jpg in browser
//! /phone stop         stop still-server hub
//! ```

use std::process::{Command, Stdio};

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

/// Phone tether / still-pipe entry.
pub struct PhoneCommand;

fn vision_dir() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("GY_VISION_DIR") {
        return std::path::PathBuf::from(p);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(home).join(".panda/vision")
}

fn still_port() -> u16 {
    std::env::var("MG_STILL_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(9877)
}

fn hub_health() -> Option<String> {
    let port = still_port();
    let url = format!("http://127.0.0.1:{port}/health");
    let out = Command::new("curl")
        .args(["-fsS", "--max-time", "1", &url])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Best-effort: spawn `phone-tether.sh start` or still-server.py.
fn ensure_hub() -> String {
    if let Some(body) = hub_health() {
        return format!("hub up · {body}");
    }
    // Prefer repo script if we can find it.
    let candidates = [
        std::env::var("FC_GROK_ROOT").ok().map(|r| {
            std::path::PathBuf::from(r).join("scripts/live-demux/phone-tether.sh")
        }),
        dirs_home_join("Projects/grok-build/scripts/live-demux/phone-tether.sh"),
        dirs_home_join("Projects/fornevercollective/grok-build/scripts/live-demux/phone-tether.sh"),
    ];
    for c in candidates.into_iter().flatten() {
        if c.is_file() {
            let _ = Command::new("bash")
                .arg(&c)
                .arg("start")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
            // Give hub a moment.
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Some(body) = hub_health() {
                return format!("hub started · {body}");
            }
            return format!("hub start launched · {}", c.display());
        }
    }
    // Fallback: python still-server from vision dir.
    let vision = vision_dir();
    let py = vision.join("still-server.py");
    if py.is_file() {
        let mut cmd = Command::new("python3");
        cmd.arg(&py)
            .env("MG_STILL_BIND", std::env::var("MG_STILL_BIND").unwrap_or_else(|_| "0.0.0.0".into()))
            .env("MG_STILL_PORT", still_port().to_string())
            .env("GY_VISION_DIR", &vision)
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        xai_tty_utils::detach_std_command(&mut cmd);
        match cmd.spawn() {
            Ok(_) => {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if let Some(body) = hub_health() {
                    return format!("hub started (python) · {body}");
                }
                "hub python spawn ok · waiting health".into()
            }
            Err(e) => format!("hub spawn failed: {e}"),
        }
    } else {
        "hub not found — run: bash scripts/live-demux/phone-tether.sh start".into()
    }
}

fn dirs_home_join(rel: &str) -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home).join(rel))
}

fn lan_hint() -> String {
    let port = still_port();
    let https = std::env::var("MG_STILL_HTTPS_PORT").unwrap_or_else(|_| "9878".into());
    // Best-effort en0
    let ip = Command::new("ipconfig")
        .args(["getifaddr", "en0"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if s.is_empty() {
                    None
                } else {
                    Some(s)
                }
            } else {
                None
            }
        })
        .unwrap_or_else(|| "LAN-IP".into());
    format!(
        "phone PWA: https://{ip}:{https}/phone.html  · setup: https://{ip}:{https}/phone-setup.html  · inspect: http://127.0.0.1:{port}/live.jpg"
    )
}

fn stop_hub() -> String {
    let candidates = [
        dirs_home_join("Projects/grok-build/scripts/live-demux/phone-tether.sh"),
        dirs_home_join("Projects/fornevercollective/grok-build/scripts/live-demux/phone-tether.sh"),
    ];
    for c in candidates.into_iter().flatten() {
        if c.is_file() {
            let _ = Command::new("bash").arg(&c).arg("stop").output();
            return "hub stop requested".into();
        }
    }
    "hub stop: bash scripts/live-demux/phone-tether.sh stop".into()
}

impl SlashCommand for PhoneCommand {
    fn name(&self) -> &str {
        "phone"
    }

    fn aliases(&self) -> &[&str] {
        &["tether", "stillpipe", "still-pipe", "mgphone", "phonecam"]
    }

    fn description(&self) -> &str {
        "Tether phone PWA (Memory Glass inspect) → still-pipe → /cam"
    }

    fn usage(&self) -> &str {
        "/phone [hub|urls|inspect|stop]  ·  /cam phone"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("hub | urls | inspect | stop | (open cam)")
    }

    fn visible(&self, _ctx: &AppCtx) -> bool {
        true
    }

    fn session_scoped(&self) -> bool {
        true
    }

    fn suggest_args(&self, _ctx: &AppCtx, args_query: &str) -> Option<Vec<ArgItem>> {
        let q = args_query.trim().to_ascii_lowercase();
        let hints: &[(&str, &str)] = &[
            ("", "start hub + open large /cam on phone still-pipe"),
            ("hub", "ensure still-server (0.0.0.0:9877/9878) is running"),
            ("urls", "show phone PWA + inspect URLs"),
            ("inspect", "open live.jpg in browser (inspect)"),
            ("stop", "stop still-server hub"),
        ];
        let mut items = Vec::new();
        for (id, label) in hints {
            if q.is_empty() || id.contains(&q) || label.contains(&q) {
                items.push(ArgItem {
                    display: if id.is_empty() {
                        "(open cam)".into()
                    } else {
                        (*id).into()
                    },
                    match_text: (*id).into(),
                    insert_text: (*id).into(),
                    description: (*label).into(),
                });
            }
        }
        if items.is_empty() {
            None
        } else {
            Some(items)
        }
    }

    fn run(&self, _ctx: &mut CommandExecCtx, args: &str) -> CommandResult {
        let raw = args.trim().to_ascii_lowercase();
        match raw.as_str() {
            "hub" | "start" | "up" => {
                let msg = ensure_hub();
                let urls = lan_hint();
                CommandResult::Message(format!("{msg}\n{urls}"))
            }
            "urls" | "url" | "qr" => CommandResult::Message(lan_hint()),
            "stop" | "down" => CommandResult::Message(stop_hub()),
            "inspect" | "live" => {
                let _ = ensure_hub();
                let port = still_port();
                let url = format!("http://127.0.0.1:{port}/live.jpg");
                let _ = Command::new("open").arg(&url).spawn();
                CommandResult::Message(format!("inspect · {url}\n{}", lan_hint()))
            }
            _ => {
                // Default: hub + phone cam profile + open watch.
                let hub_msg = ensure_hub();
                crate::live_demux::apply_phone_tether_profile();
                // Channel after phone token if present.
                let channel = if raw.is_empty()
                    || matches!(
                        raw.as_str(),
                        "phone" | "tether" | "cam" | "open" | "still"
                    )
                {
                    String::new()
                } else {
                    // e.g. /phone bloomberg
                    args.trim().to_string()
                };
                let urls = lan_hint();
                eprintln!("[fc-phone-tether] {hub_msg}");
                eprintln!("[fc-phone-tether] {urls}");
                CommandResult::Action(Action::OpenLiveWatch { url: channel })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn bare_phone_opens_watch() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match PhoneCommand.run(&mut ctx, "") {
            CommandResult::Action(Action::OpenLiveWatch { .. }) => {}
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn urls_is_message() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match PhoneCommand.run(&mut ctx, "urls") {
            CommandResult::Message(m) => assert!(m.contains("phone")),
            other => panic!("unexpected {other:?}"),
        }
    }
}
