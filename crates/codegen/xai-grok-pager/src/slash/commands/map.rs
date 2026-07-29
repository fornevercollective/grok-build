//! `/map [target]` / `/maptrace` — fornevercollective geospatial map modal.
//!
//! In-Grok ASCII world map + traceroute hops (same class as `/watch` / `/timesync`).
//!
//! **Pop-out** (external maptrace TUI/web — first-class ability):
//!   `/map popout 1.1.1.1`  `/map out example.com`  `/map web cloudflare.com`
//!   Inside the modal: press **`o`** (TUI) or **`w`** (web).

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

/// Open maptrace modal (or external pop-out).
pub struct MapCommand;

impl SlashCommand for MapCommand {
    fn name(&self) -> &str {
        "map"
    }

    fn aliases(&self) -> &[&str] {
        // à la carte original stack = maptrace TUI/web pop-out
        &["maptrace", "trace-map", "geomap", "allacarte", "a-la-carte"]
    }

    fn description(&self) -> &str {
        "Summon maptrace world map · traceroute (o = original TUI pop-out)"
    }

    fn usage(&self) -> &str {
        "/map [popout|web|original] [host|ip]  (o original maptrace · t target · r re-trace)"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("popout | web | 1.1.1.1 | example.com")
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
            ("popout", "external maptrace · traceroute if native arch fails"),
            ("original", "same as popout · full maptrace stack"),
            ("out", "alias for popout"),
            ("web", "external maptrace web UI + browser"),
            ("starbase", "SBX pin + spacex.com (CDN ≠ Boca Chica)"),
            ("sbx", "Starbase / Boca Chica TX place pin"),
            ("spacex.com", "SpaceX public edge (Cloudflare)"),
            ("1.1.1.1", "Cloudflare DNS (default demo target)"),
            ("8.8.8.8", "Google DNS"),
            ("example.com", "classic trace target"),
        ];
        let items: Vec<ArgItem> = hints
            .iter()
            .filter(|(id, label)| {
                q.is_empty()
                    || id.contains(&q)
                    || label.to_ascii_lowercase().contains(&q)
                    || q.split_whitespace().last().is_some_and(|last| {
                        id.contains(last) || label.to_ascii_lowercase().contains(last)
                    })
            })
            .map(|(id, label)| ArgItem {
                display: (*id).into(),
                match_text: (*id).into(),
                insert_text: (*id).into(),
                description: (*label).into(),
            })
            .collect();
        if items.is_empty() {
            None
        } else {
            Some(items)
        }
    }

    fn run(&self, _ctx: &mut CommandExecCtx, args: &str) -> CommandResult {
        let (popout, web, target) = crate::maptrace::parse_map_args(args.trim());
        if popout {
            return CommandResult::Action(Action::PopOutMap {
                target,
                web,
            });
        }
        CommandResult::Action(Action::OpenMap { target })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn bare_opens_default() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match MapCommand.run(&mut ctx, "") {
            CommandResult::Action(Action::OpenMap { target }) => {
                assert!(target.is_empty() || target == crate::maptrace::DEFAULT_TARGET);
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn popout_action() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match MapCommand.run(&mut ctx, "popout 8.8.8.8") {
            CommandResult::Action(Action::PopOutMap { target, web }) => {
                assert_eq!(target, "8.8.8.8");
                assert!(!web);
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn web_popout() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match MapCommand.run(&mut ctx, "web example.com") {
            CommandResult::Action(Action::PopOutMap { target, web }) => {
                assert_eq!(target, "example.com");
                assert!(web);
            }
            other => panic!("unexpected {other:?}"),
        }
    }
}
