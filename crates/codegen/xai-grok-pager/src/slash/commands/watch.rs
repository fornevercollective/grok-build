//! `/watch [channel|url]` / `/gmux [channel|url]` — fornevercollective live demux → half-block TTY.
//!
//! Named channels:
//!   `/watch bloomberg`  `/watch cnn`  `/watch vevo`  `/watch list`
//!
//! Browse (A–Z guide + regions):
//!   `/watch news`  `/watch us`  `/watch europe`  `/watch world`  `/watch all`
//!   In player: **g** / Tab guide · a–z hop · 0–6 filter · n/p station zap (news)
//!
//! **Pop-out** (external `ffplay` window — first-class ability):
//!   `/watch popout bloomberg`  `/watch out cnn`  `/watch vevo --popout`
//!   (aliases: `pop-out`, `external`, `ffplay`, `-o`)
//!   Inside the TTY modal: press **`o`** to pop the current track out.
//!
//! **Camera pop-out** (Zoom-style self / multi-cam OS windows):
//!   `/watch camout`     primary cam (FaceTime / `LIVE_DEMUX_CAM_DEVICE`)
//!   `/watch cameras`    every real camera, one window each
//!   `/watch mosaic`     single gallery grid (xstack)
//!   `/watch popout camera` · `/watch out cam`
//!   Modal: **`Y`** selfie · **`O`** all cams · **`c`** TTY PiP · **`m`** mirror
//!
//! **X.com live** (from + to):
//!   `/watch x` · paste `https://x.com/i/broadcasts/…` or `/status/…`
//!   `/watch golive` · **`U`** in player — HLS uplink (x-media-studio-hls → studio.x.com)
//!
//! VEVO Friday playlist opens as music TV — n/p skip tracks, Space pause, auto-next on end.
//! Bare `/watch` defaults to VEVO Friday.

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

/// Open live demux player modal (or external pop-out).
pub struct WatchCommand;

impl SlashCommand for WatchCommand {
    fn name(&self) -> &str {
        "watch"
    }

    fn aliases(&self) -> &[&str] {
        &["gmux", "tv", "live"]
    }

    fn description(&self) -> &str {
        "Watch news / music / X live / cam (U go-live · o pop-out · / search)"
    }

    fn usage(&self) -> &str {
        "/watch [x|golive|camout|popout|bloomberg|list|x.com/i/broadcasts/…]"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("camout | cameras | mosaic | bloomberg | popout | list")
    }

    fn visible(&self, _ctx: &AppCtx) -> bool {
        true
    }

    fn session_scoped(&self) -> bool {
        true
    }

    fn suggest_args(&self, _ctx: &AppCtx, args_query: &str) -> Option<Vec<ArgItem>> {
        let q = args_query.trim().to_ascii_lowercase();
        let mut items: Vec<ArgItem> = Vec::new();

        // Always surface pop-out + camera + X + shuffle as first-class abilities.
        let ability_hints: &[(&str, &str)] = &[
            ("camout", "Zoom self-view — primary cam → OS ffplay window"),
            ("cameras", "all local cams — one OS window each (Zoom tiles)"),
            ("mosaic", "all cams in one gallery grid window"),
            ("popout", "external ffplay window (stream · not TTY half-block)"),
            ("out", "alias for popout"),
            ("x", "X.com live hub — paste broadcast/status URL"),
            ("twitter", "alias for x (from x.com)"),
            ("golive", "start HLS → go live to x.com (studio.x.com)"),
            ("x-out", "alias for golive (to x.com)"),
            ("trailers", "movie trailers shuffle feed (s = random)"),
            ("movies", "alias for trailers"),
            ("shuffle", "open with shuffle mode on"),
        ];
        for (id, label) in ability_hints {
            if q.is_empty()
                || id.contains(&q)
                || label.to_ascii_lowercase().contains(&q)
                || "external".contains(&q)
                || "ffplay".contains(&q)
                || "trailer".contains(&q)
                || "movie".contains(&q)
                || "camera".contains(&q)
                || "cam".contains(&q)
                || "zoom".contains(&q)
                || "webcam".contains(&q)
                || "twitter".contains(&q)
                || "broadcast".contains(&q)
                || "golive".contains(&q)
            {
                items.push(ArgItem {
                    display: (*id).into(),
                    match_text: (*id).into(),
                    insert_text: (*id).into(),
                    description: (*label).into(),
                });
            }
        }

        items.extend(
            crate::live_demux::channel_suggest_items()
                .into_iter()
                .filter(|(id, label)| {
                    if q.is_empty() {
                        return true;
                    }
                    // Allow "popout blo" style partials on the last token.
                    let last = q.split_whitespace().last().unwrap_or(&q);
                    id.contains(last) || label.to_ascii_lowercase().contains(last)
                })
                .map(|(id, label)| ArgItem {
                    display: id.into(),
                    match_text: id.into(),
                    insert_text: id.into(),
                    description: label.into(),
                }),
        );

        if items.is_empty() {
            None
        } else {
            Some(items)
        }
    }

    fn run(&self, _ctx: &mut CommandExecCtx, args: &str) -> CommandResult {
        let raw = args.trim();
        let (popout, after_pop) = crate::live_demux::parse_watch_args(raw);
        let (go_live, channel) = crate::live_demux::parse_go_live_args(&after_pop);
        let lower = channel.to_ascii_lowercase();
        if matches!(
            lower.as_str(),
            "list" | "channels" | "help" | "?" | "ls"
        ) {
            return CommandResult::Message(crate::live_demux::format_channel_list());
        }

        // `/watch golive` — uplink camera/mic to X Media Studio (to x.com).
        if go_live && channel.is_empty() && !popout {
            return match crate::live_demux::launch_go_live_async() {
                Ok(msg) => {
                    let _ = crate::live_demux::open_x_studio();
                    CommandResult::Message(format!(
                        "{msg}\n\n{}",
                        crate::live_demux::TOAST_GO_LIVE
                    ))
                }
                Err(e) => CommandResult::Error(e),
            };
        }

        // Bare `/watch popout` (no channel) still goes to default VEVO via empty string.
        if popout {
            return CommandResult::Action(Action::PopOutLiveWatch {
                url: channel,
            });
        }

        // Pass the raw token (or empty / URL) through. LiveWatchState::open
        // runs resolve_watch_source so channel kind (music TV vs news) is kept.
        // X broadcast/status URLs and `x` hub are handled there.
        CommandResult::Action(Action::OpenLiveWatch {
            url: channel,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn bare_opens_default_source() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                // Empty input → LiveWatchState defaults to VEVO.
                assert!(url.is_empty());
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn bloomberg_alias() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "bloomberg") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                assert_eq!(url, "bloomberg");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn popout_bloomberg() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "popout bloomberg") {
            CommandResult::Action(Action::PopOutLiveWatch { url }) => {
                assert_eq!(url, "bloomberg");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn bloomberg_popout_suffix() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "bloomberg --popout") {
            CommandResult::Action(Action::PopOutLiveWatch { url }) => {
                assert_eq!(url, "bloomberg");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn out_cnn() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "out cnn") {
            CommandResult::Action(Action::PopOutLiveWatch { url }) => {
                assert_eq!(url, "cnn");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn list_returns_message() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "list") {
            CommandResult::Message(m) => {
                assert!(m.contains("bloomberg"));
                assert!(m.contains("vevo"));
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn custom_url() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "https://example.com/v") {
            CommandResult::Action(Action::OpenLiveWatch { url }) => {
                assert_eq!(url, "https://example.com/v");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn aliases_include_gmux_and_tv() {
        let a = WatchCommand.aliases();
        assert!(a.contains(&"gmux"));
        assert!(a.contains(&"tv"));
    }

    #[test]
    fn camout_is_popout_action() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "camout") {
            CommandResult::Action(Action::PopOutLiveWatch { url }) => {
                assert_eq!(url, "camout");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn cameras_popout() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "cameras") {
            CommandResult::Action(Action::PopOutLiveWatch { url }) => {
                assert_eq!(url, "cameras");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn popout_camera() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match WatchCommand.run(&mut ctx, "popout camera") {
            CommandResult::Action(Action::PopOutLiveWatch { url }) => {
                assert_eq!(url, "camera");
            }
            other => panic!("unexpected {other:?}"),
        }
    }
}
