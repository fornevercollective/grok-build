//! `/cam` — open `/watch` with a **large** local camera (chat self-view).
//!
//! Default: side-column **large** tile (48×24 half-block) + VEVO stream.
//! Smaller glyph PiP remains **`c`** inside `/watch`; this slash is the
//! Zoom-style “big me” entry under a short name.
//!
//! ```text
//! /cam              large side cam + default VEVO
//! /cam xl           bigger (64×32)
//! /cam max          fill room (leave stream gutter)
//! /cam pip          large PiP overlay (not side column)
//! /cam bloomberg    large cam + named channel
//! /cam popout       Zoom OS window (primary device)
//! /cam cameras      all cams as OS windows
//! ```

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

/// Open live watch with large camera profile.
pub struct CamCommand;

fn is_profile(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "large"
            | "big"
            | "lg"
            | "xl"
            | "huge"
            | "xlarge"
            | "xxl"
            | "max"
            | "fill"
            | "pip"
            | "overlay"
            | "inset"
            | "lean"
            | "small"
            | "mini"
            | "glyph"
            | "side"
    ) || tok.parse::<u16>().is_ok()
        || tok.contains('x')
        || tok.contains('X')
}

impl SlashCommand for CamCommand {
    fn name(&self) -> &str {
        "cam"
    }

    fn aliases(&self) -> &[&str] {
        &["camera", "selfie", "webcam"]
    }

    fn description(&self) -> &str {
        "Large camera under /watch (side tile · chat self-view · Y pop-out)"
    }

    fn usage(&self) -> &str {
        "/cam [large|xl|max|pip|popout|cameras|channel]"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("large | xl | max | pip | popout | bloomberg")
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
            ("large", "side column · 48×24 half-block (default)"),
            ("xl", "side column · 64×32"),
            ("max", "fill room · leave stream gutter"),
            ("pip", "large bottom-left overlay"),
            ("popout", "primary cam → OS ffplay (Zoom self-view)"),
            ("cameras", "all cams → OS windows"),
            ("mosaic", "all cams → one gallery window"),
            ("bloomberg", "large cam + Bloomberg live"),
            ("vevo", "large cam + VEVO Friday"),
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

        // External Zoom-style windows (no TTY half-block modal).
        if matches!(
            lower.as_str(),
            "popout"
                | "out"
                | "camout"
                | "window"
                | "ffplay"
                | "cameras"
                | "all"
                | "mosaic"
                | "zoom"
                | "gallery"
        ) || lower.starts_with("popout ")
            || lower.starts_with("out ")
        {
            let src = if matches!(lower.as_str(), "popout" | "out" | "camout" | "window" | "ffplay")
            {
                "camout".into()
            } else if matches!(lower.as_str(), "all") {
                "cameras".into()
            } else {
                raw.to_string()
            };
            return CommandResult::Action(Action::PopOutLiveWatch { url: src });
        }

        // `/cam [profile] [channel…]` — default profile = large side tile.
        let mut tokens = raw.split_whitespace().peekable();
        let profile = if tokens.peek().copied().is_some_and(is_profile) {
            tokens.next().unwrap_or("large")
        } else {
            "large"
        };
        let channel = tokens.collect::<Vec<_>>().join(" ");
        crate::live_demux::apply_cam_profile(profile);

        CommandResult::Action(Action::OpenLiveWatch { url: channel })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn bare_cam_opens_watch() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match CamCommand.run(&mut ctx, "") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                assert!(url.is_empty());
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn cam_bloomberg() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match CamCommand.run(&mut ctx, "bloomberg") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                assert_eq!(url, "bloomberg");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn cam_popout() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match CamCommand.run(&mut ctx, "popout") {
            CommandResult::Action(Action::PopOutLiveWatch { url }) => {
                assert_eq!(url, "camout");
            }
            other => panic!("unexpected {other:?}"),
        }
    }
}
