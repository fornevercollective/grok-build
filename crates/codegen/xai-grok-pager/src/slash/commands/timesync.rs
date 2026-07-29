//! `/clock` / `/timesync` / `/zulu` — fornevercollective broadcast world clock modal.
//!
//! **Primary summon name is `/clock`** (also `/timesync`, `/zulu`, …).
//! Opens inside the Grok agent view (same class as `/watch` / `/map` / `/gboom`).

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, CommandExecCtx, CommandResult, SlashCommand};

/// Open timesync world clock modal — summoned by `/clock` (primary).
pub struct TimesyncCommand;

impl SlashCommand for TimesyncCommand {
    fn name(&self) -> &str {
        // Primary: /clock (user-facing summon). timesync remains an alias.
        "clock"
    }

    fn aliases(&self) -> &[&str] {
        &["timesync", "zulu", "worldclock", "epoch"]
    }

    fn description(&self) -> &str {
        "Summon timesync clock · UTC/Zulu · markets · unix/epoch/drift"
    }

    fn usage(&self) -> &str {
        "/clock  (aliases: /timesync /zulu /worldclock /epoch)"
    }

    fn visible(&self, _ctx: &AppCtx) -> bool {
        true
    }

    fn session_scoped(&self) -> bool {
        // Needs agent view for the modal — but keep visible so summon is discoverable.
        true
    }

    fn run(&self, _ctx: &mut CommandExecCtx, _args: &str) -> CommandResult {
        CommandResult::Action(Action::OpenTimesync)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn opens_timesync_action() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match TimesyncCommand.run(&mut ctx, "") {
            CommandResult::Action(Action::OpenTimesync) => {}
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn primary_is_clock() {
        assert_eq!(TimesyncCommand.name(), "clock");
        let a = TimesyncCommand.aliases();
        assert!(a.contains(&"timesync"));
        assert!(a.contains(&"zulu"));
        assert!(!a.contains(&"clock"));
    }
}
