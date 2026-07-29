//! `/gy` — fornevercollective GrokYtalkY TTY placeholders.
//!
//! Visible companion to the half-block graphics tier. Surfaces are stubs that
//! mirror GY concepts (burst, wave, chat, pins, tools, stream) without
//! reimplementing the mesh — real multi-user/phone cast stays in the `gy` CLI.

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

/// Subcommand name/description pairs (single source for run + suggestions).
const SUBCOMMANDS: &[(&str, &str)] = &[
    ("status", "Catalog of GY TTY surfaces + shipped half-block tier"),
    ("burst", "Orb demo · Space → external gy burst when on PATH"),
    ("wave", "Waveform / walkie level placeholder"),
    ("chat", "Mesh chat rail placeholder"),
    ("pins", "Pin tiles · Space → external gy pins-dock when on PATH"),
    ("tools", "PATH probe · y/c copy install or run lines"),
    ("stream", ".gyst / binary stream notes"),
    ("help", "Keys + boundary rules"),
];

/// Open GY TTY placeholder panel.
pub struct GyCommand;

impl SlashCommand for GyCommand {
    fn name(&self) -> &str {
        "gy"
    }

    fn description(&self) -> &str {
        "GrokYtalkY TTY placeholders (burst/wave/chat/pins)"
    }

    fn usage(&self) -> &str {
        "/gy [status|burst|wave|chat|pins|tools|stream|help]"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("status | burst | wave | chat | pins | tools | stream | help")
    }

    fn visible(&self, _ctx: &AppCtx) -> bool {
        true
    }

    fn session_scoped(&self) -> bool {
        true
    }

    fn suggest_args(&self, _ctx: &AppCtx, _args_query: &str) -> Option<Vec<ArgItem>> {
        Some(
            SUBCOMMANDS
                .iter()
                .map(|&(name, desc)| ArgItem {
                    display: name.to_string(),
                    match_text: name.to_string(),
                    insert_text: name.to_string(),
                    description: desc.to_string(),
                })
                .collect(),
        )
    }

    fn run(&self, _ctx: &mut CommandExecCtx, args: &str) -> CommandResult {
        let surface = args.trim();
        if surface.is_empty() {
            return CommandResult::Action(Action::OpenGyTty {
                surface: "status".into(),
            });
        }
        // Unknown subcommand → still open panel help so users discover options.
        let id = if crate::gy_tty::Surface::parse(surface).is_some() {
            // Normalize aliases to canonical id.
            crate::gy_tty::Surface::parse(surface)
                .map(|s| s.id().to_string())
                .unwrap_or_else(|| surface.to_string())
        } else {
            "help".into()
        };
        CommandResult::Action(Action::OpenGyTty { surface: id })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn bare_opens_status() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match GyCommand.run(&mut ctx, "") {
            CommandResult::Action(Action::OpenGyTty { surface }) => {
                assert_eq!(surface, "status");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn burst_alias() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match GyCommand.run(&mut ctx, "b") {
            CommandResult::Action(Action::OpenGyTty { surface }) => {
                assert_eq!(surface, "burst");
            }
            other => panic!("unexpected {other:?}"),
        }
    }
}
