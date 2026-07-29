//! `/monitor` — active terminal fleet: grok / clock / map / watch / sessions.
//!
//! Shows **where** work is running (cwd/tty/pid) and **what** surface is open,
//! so you can summon `/clock` / `/map` / `/watch` into the right place.
//!
//! Args:
//!   (none)     human fleet board
//!   json       raw JSON snapshot
//!   watch      hint to run live loop in a side pane

use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};
use std::path::PathBuf;
use std::process::Command;

/// Terminal fleet monitor board.
pub struct MonitorCommand;

impl SlashCommand for MonitorCommand {
    fn name(&self) -> &str {
        "monitor"
    }

    fn aliases(&self) -> &[&str] {
        &["terminals", "fleet", "term-status", "who"]
    }

    fn description(&self) -> &str {
        "Active terminals · clock/map/watch · sessions · where work runs"
    }

    fn usage(&self) -> &str {
        "/monitor [json|watch]  — fleet board (summon: /clock /map /watch)"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("json | watch")
    }

    fn visible(&self, _ctx: &AppCtx) -> bool {
        true
    }

    fn session_scoped(&self) -> bool {
        // Useful on welcome/dashboard too — not session-only.
        false
    }

    fn suggest_args(&self, _ctx: &AppCtx, args_query: &str) -> Option<Vec<ArgItem>> {
        let q = args_query.trim().to_ascii_lowercase();
        let hints: &[(&str, &str)] = &[
            ("", "fleet board (default)"),
            ("json", "machine-readable snapshot"),
            ("watch", "how to run live side-pane loop"),
        ];
        let items: Vec<ArgItem> = hints
            .iter()
            .filter(|(id, label)| {
                q.is_empty() || id.contains(&q) || label.to_ascii_lowercase().contains(&q)
            })
            .map(|(id, label)| ArgItem {
                display: if id.is_empty() {
                    "(default)".into()
                } else {
                    (*id).into()
                },
                match_text: (*id).into(),
                insert_text: (*id).into(),
                description: (*label).into(),
            })
            .collect();
        Some(items)
    }

    fn run(&self, _ctx: &mut CommandExecCtx, args: &str) -> CommandResult {
        let mode = args.trim().to_ascii_lowercase();
        if mode == "watch" || mode == "live" || mode == "loop" {
            let script = fleet_script_path();
            return CommandResult::Message(format!(
                "Live fleet watch (side Terminal):\n\n\
                 ```bash\n\
                 python3 {script} --watch 2\n\
                 ```\n\n\
                 Agent `monitor` tool one-shot:\n\n\
                 ```bash\n\
                 python3 {script} --events\n\
                 ```\n\n\
                 Summon surfaces inside Grok agent composer:\n\
                 · `/clock`  timesync world clock\n\
                 · `/map`  maptrace in-Grok · `/map original 1.1.1.1` à la carte TUI\n\
                 · `/watch` / `/gmux`  live demux\n\
                 · `/monitor`  refresh this board"
            ));
        }

        let want_json = mode == "json" || mode == "--json" || mode == "-j";
        match run_fleet(want_json) {
            Ok(text) => CommandResult::Message(text),
            Err(e) => CommandResult::Message(format!(
                "monitor failed: {e}\n\
                 fallback: `python3 scripts/terminal-fleet-status.py`"
            )),
        }
    }
}

fn fleet_script_path() -> String {
    // Prefer repo-relative from CARGO or common clones; fall back to home.
    let candidates = [
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../..")
            .join("scripts/terminal-fleet-status.py"),
        PathBuf::from("/Users/qbit/Projects/grok-build/scripts/terminal-fleet-status.py"),
        dirs_home()
            .map(|h| h.join("Projects/grok-build/scripts/terminal-fleet-status.py"))
            .unwrap_or_default(),
    ];
    for c in candidates {
        if let Ok(p) = c.canonicalize() {
            if p.is_file() {
                return p.display().to_string();
            }
        }
        if c.is_file() {
            return c.display().to_string();
        }
    }
    "scripts/terminal-fleet-status.py".into()
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn run_fleet(json: bool) -> Result<String, String> {
    let script = fleet_script_path();
    let mut cmd = Command::new("python3");
    cmd.arg(&script);
    if json {
        cmd.arg("--json");
    }
    let out = cmd
        .output()
        .map_err(|e| format!("spawn python3 {script}: {e}"))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(format!("exit {} · {err}", out.status));
    }
    let mut body = String::from_utf8_lossy(&out.stdout).into_owned();
    if !json {
        body.push_str(
            "\n\n_Summon:_ `/clock` · `/map` · `/map original 1.1.1.1` · `/watch` · `/monitor watch`",
        );
    }
    Ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_is_monitor() {
        assert_eq!(MonitorCommand.name(), "monitor");
        assert!(MonitorCommand.aliases().contains(&"terminals"));
    }
}
