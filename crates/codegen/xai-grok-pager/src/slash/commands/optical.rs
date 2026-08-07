//! `/optical` — jawta light + Decimen fountain + optical blur.
//!
//! **Primary surface is `/watch`** — the modal half-block is the TX display.
//! Optional OS browser pop-out via `popout` / **`o`** while watching.
//!
//! fc-optical-transfer-v1 · no alias collisions with /share or /tv.

use std::process::{Command, Stdio};

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

pub struct OpticalCommand;

fn script() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let candidates = [
        std::path::PathBuf::from(&home)
            .join("Projects/grok-build/scripts/live-demux/optical-transfer/optical-transfer.sh"),
        std::path::PathBuf::from(&home).join(
            "Projects/fornevercollective/grok-build/scripts/live-demux/optical-transfer/optical-transfer.sh",
        ),
    ];
    if let Ok(root) = std::env::var("FC_GROK_ROOT") {
        let p = std::path::PathBuf::from(root)
            .join("scripts/live-demux/optical-transfer/optical-transfer.sh");
        if p.is_file() {
            return Some(p);
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn run_optical_shell(args: &[&str]) -> String {
    let Some(script) = script() else {
        return "optical script missing — expected scripts/live-demux/optical-transfer/\n\
                see scripts/live-demux/optical-transfer/README.md"
            .into();
    };
    let mut cmd = Command::new("bash");
    cmd.arg(&script).args(args);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let detach = args
        .first()
        .is_some_and(|a| matches!(*a, "serve" | "open" | "rx"));
    if detach {
        cmd.stdin(Stdio::null());
        xai_tty_utils::detach_std_command(&mut cmd);
        match cmd.spawn() {
            Ok(c) => format!(
                "optical shell · {} · pid {} · pipe ~/.panda/vision/cast/optical-pipe.jsonl",
                args.join(" "),
                c.id()
            ),
            Err(e) => format!("optical · spawn failed: {e}"),
        }
    } else {
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
                        "optical · ok".into()
                    } else {
                        format!("optical · exit {}", o.status)
                    }
                } else {
                    s
                }
            }
            Err(e) => format!("optical · spawn failed: {e}"),
        }
    }
}

impl SlashCommand for OpticalCommand {
    fn name(&self) -> &str {
        "optical"
    }

    fn aliases(&self) -> &[&str] {
        // free names only — not share/tv/cast
        &["optical-blur", "jawta-light", "light-tx"]
    }

    fn description(&self) -> &str {
        "Optical blur as /watch surface · jawta light · fountain embed (o = OS display)"
    }

    fn usage(&self) -> &str {
        "/optical [blur|light|glyph|qr|popout|serve|rx|test|help] [text…]"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("blur | light timesync | popout | serve | test | help")
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
            ("blur", "open /watch optical blur surface (default)"),
            ("light", "open /watch optical light · jawta pulse"),
            ("glyph", "open /watch + Decimen OS QR (load-tested)"),
            (
                "qr",
                "Decimen fountain QR browser (BashAlarmist · load-tested)",
            ),
            ("decimen", "same as qr · vendored send/receive HTTPS"),
            ("popout", "open /watch optical + OS browser display"),
            ("watch", "same as blur — force /watch surface"),
            ("serve", "fc HTTP pages only (shell · port 8767)"),
            ("rx", "receive page / luminance OOK (shell)"),
            ("test", "fountain round-trip unit check (shell)"),
            ("help", "show optical help"),
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
        if matches!(lower.as_str(), "help" | "?") {
            return CommandResult::Message(
                "/optical · fc-optical-transfer-v1 · **primary surface = /watch**\n\
                 /optical                 open /watch optical blur (half-block TX)\n\
                 /optical blur [text]     soft field + jawta OOK + corner embed\n\
                 /optical light timesync  jawta light pulse = Zulu/unix (sos alias)\n\
                 /optical bloomberg       mix-pipe = /watch bloomberg ffplay stream + Decimen\n\
                 /optical qr              **Decimen** load-tested browser QR (BashAlarmist)\n\
                 /optical decimen         same · HTTPS Vite · phone RX /receive/\n\
                 /optical popout [text]   /watch + OS display (qr→Decimen)\n\
                 /watch optical           half-block · o key = OS\n\
                 /optical serve|test      shell helpers\n\
                 Decimen: vendor/decimen-optical-transfer (MIT)\n\
                 upstream: github.com/bashalarmistalt/decimen-optical-transfer\n\
                 jawta light: https://mueee.qbitos.ai/jawta-audio.html"
                    .into(),
            );
        }

        // Shell-only subcommands (do not open watch).
        let first = lower.split_whitespace().next().unwrap_or("");
        // Bloomberg / channel mix-pipe: same stream as /watch popout ffplay + Decimen mix.
        if matches!(
            first,
            "bloomberg" | "bbg" | "cnn" | "cnbc" | "nasa" | "mix" | "mix-pipe" | "watch-pipe"
        ) {
            let ch = if matches!(first, "mix" | "mix-pipe" | "watch-pipe") {
                lower
                    .split_whitespace()
                    .nth(1)
                    .unwrap_or("bloomberg")
            } else {
                first
            };
            let out = run_optical_shell(&["bloomberg", ch]);
            let _ = run_optical_shell(&["qr", "dev"]);
            eprintln!("[fc-optical] mix-pipe {ch} · {out}");
            unsafe {
                std::env::set_var("LIVE_DEMUX_OPTICAL_MODE", "qr");
                std::env::set_var("LIVE_DEMUX_OPTICAL_DECIMEN", "1");
                std::env::set_var("LIVE_DEMUX_OPTICAL_MIX", "watch");
            }
            let url = crate::live_demux::optical_url(crate::live_demux::OpticalMode::Qr);
            return CommandResult::Action(Action::OpenLiveWatch { url });
        }
        // Decimen browser app — load-tested fountain QR (not our glyph stub).
        if matches!(first, "qr" | "decimen" | "fountain") {
            let out = run_optical_shell(&["qr", "dev"]);
            eprintln!("[fc-optical] decimen · {out}");
            // Also open /watch glyph preview surface so TTY has a live pane.
            unsafe {
                std::env::set_var("LIVE_DEMUX_OPTICAL_MODE", "qr");
                std::env::set_var("LIVE_DEMUX_OPTICAL_DECIMEN", "1");
            }
            let url = crate::live_demux::optical_url(crate::live_demux::OpticalMode::Qr);
            return CommandResult::Action(Action::OpenLiveWatch { url });
        }
        if matches!(first, "serve" | "open" | "rx" | "test" | "doctor") {
            let parts: Vec<&str> = raw.split_whitespace().collect();
            let out = run_optical_shell(&parts);
            eprintln!("[fc-optical] {out}");
            return CommandResult::Message(out);
        }

        // Default path: open /watch as the optical display surface.
        let want_popout = lower.split_whitespace().any(|t| {
            matches!(
                t,
                "popout" | "pop-out" | "out" | "external" | "window" | "os"
            )
        });
        // Build optical args string for parse_optical_args
        let optical_input = if raw.is_empty() {
            "optical blur".to_string()
        } else if lower
            .split_whitespace()
            .any(|t| crate::live_demux::is_optical_token(t) || t == "optical")
        {
            format!("optical {raw}")
        } else {
            format!("optical {raw}")
        };
        let (mode, text) = crate::live_demux::parse_optical_args(&optical_input);
        // SAFETY: single-threaded slash dispatch before watch open.
        unsafe {
            std::env::set_var("LIVE_DEMUX_OPTICAL_MODE", mode.id());
            std::env::set_var("LIVE_DEMUX_OPTICAL_TEXT", &text);
            if matches!(
                mode,
                crate::live_demux::OpticalMode::Qr | crate::live_demux::OpticalMode::Glyph
            ) {
                std::env::set_var("LIVE_DEMUX_OPTICAL_DECIMEN", "1");
            }
        }
        let url = crate::live_demux::optical_url(mode);
        // Qr/glyph always launch Decimen OS display; blur/light only if popout.
        if want_popout
            || matches!(
                mode,
                crate::live_demux::OpticalMode::Qr | crate::live_demux::OpticalMode::Glyph
            )
        {
            let toast = crate::live_demux::launch_optical_popout_async(mode, &text);
            eprintln!("[fc-optical] {toast}");
        }
        eprintln!(
            "[fc-optical] /watch surface · {} · text={}",
            mode.id(),
            text.chars().take(48).collect::<String>()
        );
        CommandResult::Action(Action::OpenLiveWatch { url })
    }
}
