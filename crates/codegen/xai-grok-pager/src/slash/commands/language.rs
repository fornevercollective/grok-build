//! `/language` — simultaneous multi-language keyboard translation streams.
//!
//! **fc-language-stream-v1** · Memory Glass keyboard/language plane in-TTY.
//! Type once; many layout / translate / codec streams update live.

use crate::app::actions::Action;
use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

pub struct LanguageCommand;

impl SlashCommand for LanguageCommand {
    fn name(&self) -> &str {
        "language"
    }

    fn aliases(&self) -> &[&str] {
        &["lang", "translate", "i18n", "polyglot", "kb-lang", "multilang"]
    }

    fn description(&self) -> &str {
        "Multi-language simultaneous keyboard streams (layout · translate · codec)"
    }

    fn usage(&self) -> &str {
        "/language [all|layout|translate|codec|popout|help]"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("all | layout | translate | codec | popout | help")
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
            ("all", "all stream kinds (default)"),
            ("layout", "qwerty→ru/he/ar/dvorak/azerty only"),
            ("translate", "ES/FR/DE/JA/ZH offline + optional trans CLI"),
            ("codec", "hex · steno · braille · reverse"),
            ("popout", "open MG keyboard plane in browser"),
            ("help", "show help"),
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
        Some(items)
    }

    fn run(&self, _ctx: &mut CommandExecCtx, args: &str) -> CommandResult {
        let raw = args.trim().to_ascii_lowercase();
        if matches!(raw.as_str(), "help" | "?" | "list") {
            return CommandResult::Message(
                "/language · fc-language-stream-v1 · simultaneous keyboard streams\n\
                 /language              all streams (layout + translate + codec)\n\
                 /language layout       physical key remaps (ru/he/ar/dvorak/azerty)\n\
                 /language translate    ES/FR/DE/JA/ZH (+ `trans` CLI if installed)\n\
                 /language codec        hex · steno · braille · reverse\n\
                 /language popout       Memory Glass keyboard plane (?mg_kb=1)\n\
                 keys: type live · Tab focus · Ctrl+m mode · Ctrl+r clear · Ctrl+o MG · Esc\n\
                 lineage: experiments/memory-glass KEYBOARD-PLANE · lang-codec-plane\n\
                 fcs language           agent-universal CLI"
                    .into(),
            );
        }
        if raw.split_whitespace().any(|t| {
            matches!(t, "popout" | "out" | "external" | "browser" | "mg" | "keyboard")
        }) {
            let msg = xai_grok_pager_render::language::launch_language_popout();
            eprintln!("[fc-language] {msg}");
            // still open TTY modal
        }
        // mode encoded via env for open
        let mode = if raw.contains("layout") {
            "layout"
        } else if raw.contains("translate") || raw.contains("xl8") {
            "translate"
        } else if raw.contains("codec") {
            "codec"
        } else {
            "all"
        };
        unsafe {
            std::env::set_var("FC_LANGUAGE_MODE", mode);
        }
        CommandResult::Action(Action::OpenLanguage)
    }
}
