//! `/lens` — live HDRI anamorphic / tiny-bug-world pop-out (360-capable).
//!
//! Memory Glass lens grammar → ffmpeg filter graph → detached ffplay OS window.
//!
//! ```text
//! /lens                 bug world from current cam (dual if /cam phone)
//! /lens bug dual        you + phone, insect vision both windows
//! /lens 360             compound dual-fisheye (equirect / 360 cams)
//! /lens anamorphic
//! /lens tiny · /lens hdri
//! /lens bug phone       phone still-pipe only
//! ```

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

pub struct LensCommand;

impl SlashCommand for LensCommand {
    fn name(&self) -> &str {
        "lens"
    }

    fn aliases(&self) -> &[&str] {
        &[
            "bug",
            "bugworld",
            "insect",
            "hdri",
            "anamorphic",
            "tinyworld",
            "compound",
        ]
    }

    fn description(&self) -> &str {
        "Live lens pop-out · tiny bug world · HDRI anamorphic · 360 fisheye"
    }

    fn usage(&self) -> &str {
        "/lens [bug|360|anamorphic|tiny|hdri] [dual|phone|you]  (L in /watch)"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("bug | 360 | anamorphic | tiny | hdri · dual | phone | you")
    }

    fn visible(&self, _ctx: &AppCtx) -> bool {
        true
    }

    fn session_scoped(&self) -> bool {
        true
    }

    fn suggest_args(&self, _ctx: &AppCtx, args_query: &str) -> Option<Vec<ArgItem>> {
        let q = args_query.trim().to_ascii_lowercase();
        let last = q.split_whitespace().last().unwrap_or(&q);
        let hints: &[(&str, &str)] = &[
            (
                "bug",
                "default · fisheye + anamorphic + tiny-world + HDRI (insect vision)",
            ),
            (
                "360",
                "compound dual-fisheye · equirect/360 cams (v360 when available)",
            ),
            (
                "anamorphic",
                "2× cinema plate desqueeze + mild barrel",
            ),
            (
                "tiny",
                "tilt-shift miniature / diorama tiny world",
            ),
            (
                "hdri",
                "HDR tone map · lush sat · soft vignette",
            ),
            (
                "dual",
                "two OS windows · laptop + phone still with same lens",
            ),
            (
                "phone",
                "phone still-pipe live.jpg only",
            ),
            (
                "you",
                "laptop / desktop webcam only",
            ),
            (
                "bug dual",
                "ffplay only · you+phone bug-world (no desk unless +desk)",
            ),
            (
                "bug dual desk",
                "ffplay + desk TUI you|phone",
            ),
            (
                "360 dual",
                "compound eye on both feeds (ffplay only)",
            ),
        ];
        let mut items = Vec::new();
        for (id, label) in hints {
            if q.is_empty()
                || id.contains(last)
                || label.to_ascii_lowercase().contains(last)
                || "fisheye".contains(last)
                || "insect".contains(last)
                || "hdr".contains(last)
            {
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
        // Help
        if matches!(raw.to_ascii_lowercase().as_str(), "help" | "?" | "keys") {
            return CommandResult::Message(
                "/lens · live bug-world / HDRI anamorphic pop-out (fc-lens-bug-v1)\n\
                 profiles: bug · 360 · anamorphic · tiny · hdri\n\
                 inputs:   dual · phone · you  (default follows /cam source)\n\
                 in /watch: L = bug lens pop-out · Y = clean dual cam pop-out\n\
                 shell: bash scripts/live-demux/lens-popout.sh bug dual\n\
                 360 cam: LIVE_DEMUX_CAM_DEVICE=<idx> /lens 360"
                    .into(),
            );
        }

        let lower = raw.to_ascii_lowercase();
        let (profile, input) = crate::live_demux::parse_lens_args(raw);

        // Explicit only: ffplay OS windows when user runs /lens (or L key).
        // Never open Continuity/FaceTime/Camera.app. Never spawn still-server.
        // Desk TUI only if args contain `desk` or LIVE_DEMUX_LENS_OPEN_DESK=1.
        let want_desk = lower.split_whitespace().any(|t| t == "desk")
            || matches!(
                std::env::var("LIVE_DEMUX_LENS_OPEN_DESK")
                    .unwrap_or_default()
                    .trim()
                    .to_ascii_lowercase()
                    .as_str(),
                "1" | "true" | "yes" | "on"
            );

        let toast = crate::live_demux::launch_lens_async(profile, input);
        eprintln!("[fc-lens-bug] {toast}");

        if want_desk {
            crate::live_demux::apply_phone_tether_profile();
            return CommandResult::Action(Action::OpenLiveWatch {
                url: "desk".into(),
            });
        }

        CommandResult::Message(format!(
            "{toast}\n{} · {:?}\n\
             (desk TUI: /lens bug dual desk  or  /cam phone first · no auto hub/browser)",
            profile.label(),
            input
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn lens_help_message() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match LensCommand.run(&mut ctx, "help") {
            CommandResult::Message(m) => assert!(m.contains("bug")),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn suggest_lists_bug() {
        let models = ModelState::default();
        let ctx = make_ctx(&models);
        let items = LensCommand.suggest_args(&ctx, "").expect("items");
        assert!(items.iter().any(|i| i.insert_text == "bug"));
        assert!(items.iter().any(|i| i.insert_text == "360"));
    }
}
