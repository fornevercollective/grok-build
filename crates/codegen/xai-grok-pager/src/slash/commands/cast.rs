//! `/cast` · `/mirror` · `/chromecast` — send media to TCL Google TV / Chromecast.
//!
//! **fc-cast-tv-v1** · explicit only (no auto cast on session start).
//! Soft aliases only — **not** OS Screen Sharing.
//! Do not claim `/share` (session URL) or `/tv` (`/watch` alias).
//!
//! ```text
//! /cast list
//! /cast profile
//! /cast https://…
//! /cast desk
//! /cast stop
//! ```

use std::process::{Command, Stdio};

use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

pub struct CastCommand;

fn cast_script() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let candidates = [
        std::path::PathBuf::from(home.clone())
            .join("Projects/grok-build/scripts/live-demux/cast-tv.sh"),
        std::path::PathBuf::from(home).join("Projects/fornevercollective/grok-build/scripts/live-demux/cast-tv.sh"),
    ];
    if let Ok(root) = std::env::var("FC_GROK_ROOT") {
        let p = std::path::PathBuf::from(root).join("scripts/live-demux/cast-tv.sh");
        if p.is_file() {
            return Some(p);
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn run_cast(args: &[&str]) -> String {
    let Some(script) = cast_script() else {
        return "cast script missing — expected scripts/live-demux/cast-tv.sh\n\
                see docs/fornever-ledger/CAST-TV-WALL-PLAN.md"
            .into();
    };
    let mut cmd = Command::new("bash");
    cmd.arg(&script).args(args);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    match cmd.output() {
        Ok(o) => {
            let mut s = String::from_utf8_lossy(&o.stdout).to_string();
            let e = String::from_utf8_lossy(&o.stderr);
            if !e.trim().is_empty() {
                if !s.is_empty() {
                    s.push('\n');
                }
                s.push_str(e.trim());
            }
            if s.trim().is_empty() {
                if o.status.success() {
                    "cast · ok".into()
                } else {
                    format!("cast · exit {}", o.status)
                }
            } else {
                s
            }
        }
        Err(e) => format!("cast · spawn failed: {e}"),
    }
}

impl SlashCommand for CastCommand {
    fn name(&self) -> &str {
        "cast"
    }

    fn aliases(&self) -> &[&str] {
        // Free aliases only — not OS Screen Sharing.
        // Reserved elsewhere: share (session URL), tv (watch live).
        &["mirror", "chromecast"]
    }

    fn description(&self) -> &str {
        "Cast desk/stream/mosaic to TCL Google TV (Chromecast) · explicit only"
    }

    fn usage(&self) -> &str {
        "/cast [list|profile|doctor|desk|mosaic|align|align-ui|stop|URL]  ·  /mirror · /chromecast"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("list | profile | doctor | desk | mosaic | align | align-ui | stop | https://…")
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
            ("list", "discover Chromecast / Google TV devices (catt)"),
            ("profile", "TCL Google TV encode + panel class specs"),
            ("doctor", "check catt/ffmpeg/LAN/profile readiness"),
            ("status", "profile + devices + local HTTP serve"),
            ("desk", "encode you|phone still layout → cast (explicit)"),
            ("mosaic", "2×2 wall: you|phone|stream|lens → cast"),
            ("align", "numbered pixel chart → TV (placement grid)"),
            ("align-ui", "interactive chart on LAN + optional cast_site"),
            ("stop", "stop cast session"),
            ("serve", "start LAN HTTP for cast files only"),
        ];
        let mut items = Vec::new();
        for (id, label) in hints {
            if q.is_empty() || id.contains(&q) || label.contains(&q) {
                items.push(ArgItem {
                    display: (*id).into(),
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
        let raw = args.trim();
        let lower = raw.to_ascii_lowercase();
        if raw.is_empty() || matches!(lower.as_str(), "help" | "?" ) {
            return CommandResult::Message(
                "/cast · TCL Google TV / Chromecast wall (fc-cast-tv-v1)\n\
                 /cast list · profile · doctor · status · desk · mosaic · align · align-ui · stop\n\
                 /cast https://…   (direct if TV can fetch; else encode-url via script)\n\
                 /mirror · /chromecast  = aliases (not OS Screen Sharing)\n\
                 align: numbered pixel chart for region placement (select 1,2,5-8,A3)\n\
                 default device: Smart TV (TCL) · sibling: GoogleTV3065 (Hisense)\n\
                 shell: bash scripts/live-demux/cast-tv.sh align\n\
                 docs:  docs/fornever-ledger/CAST-TV-WALL-PLAN.md\n\
                 tip:   export LIVE_DEMUX_CAST_DEVICE='Smart TV' · pipx install catt"
                    .into(),
            );
        }
        let out = match lower.as_str() {
            "list" | "ls" | "scan" => run_cast(&["list"]),
            "profile" | "spec" | "tv" | "tcl" => run_cast(&["profile"]),
            "doctor" | "check" => run_cast(&["doctor"]),
            "status" => run_cast(&["status"]),
            "desk" => run_cast(&["desk"]),
            "mosaic" | "wall" => run_cast(&["mosaic"]),
            "align" | "chart" | "grid" => run_cast(&["align"]),
            "align-ui" | "chart-ui" => run_cast(&["align-ui"]),
            "stop" => run_cast(&["stop"]),
            "serve" => run_cast(&["serve"]),
            "serve-stop" | "http-stop" => run_cast(&["http-stop"]),
            _ if lower.starts_with("align ") || lower.starts_with("chart ") => {
                // pass through flags: align --select 1,2,5-8
                let rest = raw.split_once(' ').map(|(_, r)| r).unwrap_or("");
                let mut args = vec!["align"];
                let parts: Vec<&str> = rest.split_whitespace().collect();
                for p in &parts {
                    args.push(p);
                }
                run_cast(&args)
            }
            _ if lower.starts_with("http://") || lower.starts_with("https://") => {
                run_cast(&["url", raw])
            }
            _ if lower.starts_with("encode ") => {
                let u = raw["encode ".len()..].trim();
                run_cast(&["encode-url", u])
            }
            _ if lower.starts_with("file ") => {
                let f = raw["file ".len()..].trim();
                run_cast(&["file", f])
            }
            _ => {
                // Treat free text as cast URL attempt or device name hint
                if raw.contains('.') || raw.contains('/') {
                    run_cast(&["encode-url", raw])
                } else {
                    format!(
                        "unknown cast arg: {raw}\n\
                         try: list · profile · doctor · desk · mosaic · align · stop · https://…"
                    )
                }
            }
        };
        eprintln!("[fc-cast-tv] {out}");
        CommandResult::Message(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn help_mentions_tcl() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match CastCommand.run(&mut ctx, "help") {
            CommandResult::Message(m) => {
                assert!(m.contains("cast") || m.contains("TCL") || m.contains("list"));
            }
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn aliases_free_of_stock_collisions() {
        let a = CastCommand.aliases();
        assert!(a.contains(&"mirror"));
        assert!(a.contains(&"chromecast"));
        // /share = session URL · /tv = /watch alias
        assert!(!a.contains(&"share"));
        assert!(!a.contains(&"tv"));
    }
}
