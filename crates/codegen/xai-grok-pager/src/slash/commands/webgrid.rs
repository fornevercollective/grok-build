//! `/webgrid` — offline webgrid-ugrad chase on TTY half-block.
//!
//! **fc-webgrid-tty-v1** · own surface (not a `/watch` channel or `/gboom` mode).
//!
//! Toolchain: dispatches `Action::OpenLiveWatch` with a `webgrid://…` or
//! arg string that `LiveWatchState::open` understands. Agents / scripts may
//! open the same surface via that action with `webgrid://agent` etc.
//!
//! ```text
//! /webgrid                 agent chase · N=12 default
//! /webgrid human           human cursor only
//! /webgrid 30              30×30 board
//! /webgrid turbo           lab uncap agent batch
//! /webgrid popout          browser / Memory Glass (webgrid-ugrad.html)
//! /webgrid help
//! ```

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

/// Standalone offline webgrid-ugrad instrument.
pub struct WebgridCommand;

impl SlashCommand for WebgridCommand {
    fn name(&self) -> &str {
        "webgrid"
    }

    fn aliases(&self) -> &[&str] {
        // free names — not nested under /watch or /gboom
        &["wg", "webgrid-ugrad", "ugrad-webgrid", "grid-chase"]
    }

    fn description(&self) -> &str {
        "Offline webgrid-ugrad chase · TTY half-block (our build · o = browser)"
    }

    fn usage(&self) -> &str {
        "/webgrid [agent|human|N|turbo|popout|help]"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("agent | human | 16 | turbo | popout | help")
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
            ("agent", "perfect agent auto-hit (default · sim instrument)"),
            ("human", "human cursor · arrows + space/enter"),
            ("turbo", "lab uncap agent batch (paint ceiling probe)"),
            ("12", "12×12 board (TTY-friendly default)"),
            ("16", "16×16 board"),
            ("30", "30×30 board (desktop race size)"),
            ("popout", "open offline webgrid-ugrad.html in browser / Memory Glass"),
            ("out", "alias for popout"),
            ("help", "show /webgrid help"),
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

        if matches!(lower.as_str(), "help" | "?" | "list" | "ls") {
            return CommandResult::Message(
                "/webgrid · fc-webgrid-tty-v1 · offline ugrad chase (our build)\n\
                 /webgrid                 agent ON · 12×12 half-block\n\
                 /webgrid human [N]       human cursor · arrows/hjkl · space hit\n\
                 /webgrid 30              N×N (4–30)\n\
                 /webgrid turbo           lab agent batch (paint ceiling)\n\
                 /webgrid popout          browser + Memory Glass · webgrid-ugrad.html\n\
                 keys: arrows hit · a agent · r restart · o browser · Esc\n\
                 page: http://127.0.0.1:8790/webgrid-ugrad.html  (:8787 fallback)\n\
                 toolchain: OpenLiveWatch { url: \"webgrid://agent\" } · not a /watch channel\n\
                 env: LIVE_DEMUX_WEBGRID_N · _DUR · _URL · _FPS · _SEED"
                    .into(),
            );
        }

        // Pop-out only (browser/MG) — still open TTY surface so keys match optical pattern.
        let popout = lower.split_whitespace().any(|t| {
            matches!(
                t,
                "popout" | "pop-out" | "out" | "external" | "ffplay" | "window" | "--popout" | "-o"
            )
        });

        // Strip popout tokens from open args; keep mode/N/turbo.
        let open_args: Vec<&str> = raw
            .split_whitespace()
            .filter(|t| {
                let l = t.to_ascii_lowercase();
                !matches!(
                    l.as_str(),
                    "popout"
                        | "pop-out"
                        | "out"
                        | "external"
                        | "ffplay"
                        | "window"
                        | "--popout"
                        | "-o"
                        | "webgrid"
                        | "wg"
                        | "webgrid-ugrad"
                        | "ugrad-webgrid"
                        | "grid-chase"
                        | "gridchase"
                )
            })
            .collect();

        // Toolchain open string for LiveWatchState (webgrid:// or free args).
        let open_url = if open_args.is_empty() {
            crate::live_demux::webgrid_url(crate::live_demux::WebgridMode::Agent)
        } else {
            // Prefix with webgrid so parse_webgrid_args / is_webgrid_source always match.
            format!("webgrid {}", open_args.join(" "))
        };

        if popout {
            let toast = crate::live_demux::launch_webgrid_popout_async();
            eprintln!("[fc-webgrid] {toast}");
        }

        CommandResult::Action(Action::OpenLiveWatch { url: open_url })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn bare_opens_live_watch() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WebgridCommand.run(&mut ctx, "") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                assert!(
                    url.starts_with("webgrid://") || url.starts_with("webgrid"),
                    "url={url}"
                );
            }
            other => panic!("expected OpenLiveWatch, got {other:?}"),
        }
    }

    #[test]
    fn human_n_args() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WebgridCommand.run(&mut ctx, "human 16") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                assert!(url.contains("human") || url.contains("16"), "url={url}");
            }
            other => panic!("expected OpenLiveWatch, got {other:?}"),
        }
    }

    #[test]
    fn help_message() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WebgridCommand.run(&mut ctx, "help") {
            CommandResult::Message(m) => assert!(m.contains("fc-webgrid-tty-v1")),
            other => panic!("expected Message, got {other:?}"),
        }
    }
}
