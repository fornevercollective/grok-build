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
//! /cam phone        tethered phone PWA still-pipe (Memory Glass inspect)
//! /cam tether       alias of phone
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
            | "phone"
            | "tether"
            | "dual"
            | "both"
            | "desk"
            | "still"
            | "stillpipe"
            | "pwa"
            | "mg"
            | "inspect"
            | "phone-only"
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
        "Cam tile under /watch · phone tether · a mic · t talk · h phone (fc-cam-talk)"
    }

    fn usage(&self) -> &str {
        "/cam [phone|tether|large|xl|pip|popout|bloomberg|…]  keys: a mic · t talk · h phone · c cam"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("phone | tether | large | xl | pip | popout | bloomberg  ·  a/t/h keys in modal")
    }

    fn visible(&self, _ctx: &AppCtx) -> bool {
        true
    }

    fn session_scoped(&self) -> bool {
        true
    }

    fn suggest_args(&self, _ctx: &AppCtx, args_query: &str) -> Option<Vec<ArgItem>> {
        // After typing `/cam ` the dropdown lists every profile + phone tether
        // + pop-out + common channels (same grammar as Memory Glass inspect).
        let q = args_query.trim().to_ascii_lowercase();
        let last = q.split_whitespace().last().unwrap_or(&q);

        // Ability / profile hints first (order = rank when query empty).
        let ability_hints: &[(&str, &str)] = &[
            (
                "phone",
                "DESK · fullscreen laptop | phone (no VEVO) · Y pop · L lens",
            ),
            (
                "tether",
                "alias of phone · desk dual you|phone only",
            ),
            (
                "dual",
                "same as /cam phone · you|phone desk (no yt-dlp stream)",
            ),
            (
                "desk",
                "same · cam://desk sentinel",
            ),
            (
                "still",
                "phone still only · ~/.panda/vision/live.jpg",
            ),
            (
                "large",
                "side column · 48×24 half-block (default self-view)",
            ),
            ("xl", "side column · 64×32"),
            ("max", "fill room · leave stream gutter"),
            ("pip", "large bottom-left overlay (not side column)"),
            ("lean", "GY dual / 80×24 compact PiP"),
            (
                "popout",
                "primary cam → OS ffplay window (Zoom self-view)",
            ),
            ("cameras", "all local cams · one OS window each"),
            ("mosaic", "all cams · one gallery grid window"),
            ("out", "alias for popout"),
            (
                "bloomberg",
                "large cam + Bloomberg live (news)",
            ),
            ("vevo", "large cam + VEVO Friday music TV"),
            ("trailers", "large cam + movie trailers shuffle"),
            ("cnn", "large cam + CNN live"),
            ("nasa", "large cam + NASA TV"),
            // Key legend rows (insert no-op-ish labels users can still pick as channel?
            // Use insert_text that is a real profile when possible; key tips are
            // description-only picks that apply default large + empty channel when
            // entered — better: only show as filtered help when q matches keys.)
        ];

        let key_hints: &[(&str, &str)] = &[
            (
                "keys",
                "in modal: c cam · m mirror · a mic wave · t talk · h phone↔local · Esc",
            ),
            (
                "mic",
                "hint · press a inside /watch for mic waveform (fc-cam-talk)",
            ),
            (
                "talk",
                "hint · press t inside /watch for talk strip · Enter posts",
            ),
            (
                "hub",
                "hint · /phone hub or: bash scripts/live-demux/phone-tether.sh start",
            ),
        ];

        let mut items: Vec<ArgItem> = Vec::new();
        let match_q = |id: &str, label: &str| -> bool {
            if q.is_empty() {
                return true;
            }
            let hay = format!("{id} {label}").to_ascii_lowercase();
            id.contains(last)
                || label.to_ascii_lowercase().contains(last)
                || hay.contains(last)
                || "phone".contains(last)
                || "tether".contains(last)
                || "still".contains(last)
                || "pwa".contains(last)
                || "wave".contains(last)
                || "talk".contains(last)
                || "mic".contains(last)
                || "zoom".contains(last)
                || "ffplay".contains(last)
                || "camera".contains(last)
        };

        for (id, label) in ability_hints {
            if match_q(id, label) {
                items.push(ArgItem {
                    display: (*id).into(),
                    match_text: (*id).into(),
                    insert_text: (*id).into(),
                    description: (*label).into(),
                });
            }
        }

        // Key / hub tips: show when empty query or when user types key-ish query.
        let show_keys = q.is_empty()
            || matches!(
                last,
                "k" | "ke"
                    | "key"
                    | "keys"
                    | "a"
                    | "mic"
                    | "wave"
                    | "t"
                    | "talk"
                    | "h"
                    | "hub"
                    | "help"
                    | "?"
            )
            || last.starts_with("key")
            || last.starts_with("mic")
            || last.starts_with("talk")
            || last.starts_with("hub");
        if show_keys {
            for (id, label) in key_hints {
                if q.is_empty() || match_q(id, label) {
                    items.push(ArgItem {
                        display: (*id).into(),
                        match_text: (*id).into(),
                        // Don't insert fake channels for help rows — insert empty
                        // would clear; insert the id so user sees the tip token.
                        insert_text: (*id).into(),
                        description: (*label).into(),
                    });
                }
            }
        }

        // Channel catalog (same source as /watch) for `/cam bloomberg` etc.
        items.extend(
            crate::live_demux::channel_suggest_items()
                .into_iter()
                .filter(|(id, label)| {
                    if q.is_empty() {
                        // Keep list short on bare `/cam ` — top channels only.
                        matches!(
                            *id,
                            "bloomberg"
                                | "vevo"
                                | "cnn"
                                | "fox"
                                | "msnbc"
                                | "nasa"
                                | "trailers"
                                | "abc"
                                | "cbs"
                                | "nbc"
                        )
                    } else {
                        id.contains(last) || label.to_ascii_lowercase().contains(last)
                    }
                })
                .map(|(id, label)| ArgItem {
                    display: (*id).into(),
                    match_text: (*id).into(),
                    insert_text: (*id).into(),
                    description: format!("large cam + {label}"),
                }),
        );

        // Dedupe by insert_text (ability + channel may both list bloomberg).
        let mut seen = std::collections::HashSet::new();
        items.retain(|it| seen.insert(it.insert_text.clone()));

        if items.is_empty() {
            None
        } else {
            Some(items)
        }
    }

    fn run(&self, _ctx: &mut CommandExecCtx, args: &str) -> CommandResult {
        let raw = args.trim();
        let lower = raw.to_ascii_lowercase();

        // Dropdown key/hub tips — print help, don't open a bogus channel.
        if matches!(
            lower.as_str(),
            "keys" | "key" | "help" | "?" | "mic" | "wave" | "talk" | "hub"
        ) {
            return CommandResult::Message(
                "/cam · keys in modal: c cam · m mirror · a mic wave · t talk · h phone↔local · Esc\n\
                 /cam phone · /cam tether — still-pipe from Memory Glass phone PWA\n\
                 /phone hub — start still-server  ·  bash scripts/live-demux/phone-tether.sh start\n\
                 args: phone | tether | large | xl | max | pip | lean | popout | cameras | mosaic | <channel>"
                    .into(),
            );
        }

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
        // Phone/tether/dual → desk (you|phone only, no yt-dlp stream).
        let mut tokens = raw.split_whitespace().peekable();
        let profile = if tokens.peek().copied().is_some_and(is_profile) {
            tokens.next().unwrap_or("large")
        } else {
            "large"
        };
        let channel = tokens.collect::<Vec<_>>().join(" ");
        crate::live_demux::apply_cam_profile(profile);

        let phone_desk = matches!(
            profile.to_ascii_lowercase().as_str(),
            "phone"
                | "tether"
                | "dual"
                | "both"
                | "still"
                | "stillpipe"
                | "pwa"
                | "mg"
                | "inspect"
                | "phone-only"
        );
        let url = if phone_desk && channel.is_empty() {
            // Fullscreen you | phone — not VEVO + cam PiP.
            "desk".to_string()
        } else if phone_desk {
            // `/cam phone bloomberg` keeps a news stream + dual cam rail;
            // clear desk so layout returns stream + dual column.
            unsafe {
                std::env::set_var("LIVE_DEMUX_CAM_DESK", "0");
            }
            channel
        } else {
            channel
        };

        CommandResult::Action(Action::OpenLiveWatch { url })
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

    #[test]
    fn cam_suggest_args_lists_phone_after_empty_query() {
        let models = ModelState::default();
        let ctx = make_ctx(&models);
        let items = CamCommand
            .suggest_args(&ctx, "")
            .expect("cam args when empty");
        let ids: Vec<_> = items.iter().map(|i| i.insert_text.as_str()).collect();
        assert!(
            ids.contains(&"phone"),
            "phone must appear after /cam : {ids:?}"
        );
        assert!(ids.contains(&"tether"), "tether: {ids:?}");
        assert!(ids.contains(&"large"), "large: {ids:?}");
        assert!(ids.contains(&"popout"), "popout: {ids:?}");
        // Key legend on bare /cam
        assert!(
            ids.iter().any(|s| *s == "keys" || *s == "mic" || *s == "talk"),
            "key hints: {ids:?}"
        );
    }

    #[test]
    fn cam_suggest_args_filters_phone() {
        let models = ModelState::default();
        let ctx = make_ctx(&models);
        let items = CamCommand
            .suggest_args(&ctx, "pho")
            .expect("filter pho");
        assert!(
            items.iter().any(|i| i.insert_text == "phone"),
            "{:?}",
            items.iter().map(|i| &i.insert_text).collect::<Vec<_>>()
        );
    }

    #[test]
    fn cam_phone_applies_dual_you_and_phone() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        unsafe {
            std::env::remove_var("LIVE_DEMUX_CAM_SOURCE");
        }
        match CamCommand.run(&mut ctx, "phone") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                // Desk mode: you|phone only — not empty VEVO default.
                assert_eq!(url, "desk");
            }
            other => panic!("unexpected {other:?}"),
        }
        assert_eq!(
            crate::live_demux::cam_source(),
            crate::live_demux::CamSource::Dual
        );
        assert!(crate::live_demux::cam_source().includes_local());
        assert!(crate::live_demux::cam_source().includes_phone());
        assert!(crate::live_demux::dual_cam_desk());
    }
}
