//! `/drone` — standalone multi-unit drone HUD control surface.
//!
//! **fc-webgrid-drone-hud-v1** · own slash (not nested under `/webgrid` or `/watch`).
//! Opens the offline drone HUD pop-out (browser + Memory Glass): fleet FPV mosaic,
//! flight path / RTH / retrieve, sticks, maintenance, backend probes
//! (DeckTX · ELRS · MAVLink Anywhere · smart-wifi · drone.ugrad.ai).
//!
//! ```text
//! /drone                      open HUD (sim · 4 units)
//! /drone popout               same (explicit)
//! /drone units 6              6-unit fleet mosaic
//! /drone ugrad | viewer       open + prefer drone.ugrad.ai viewer backend
//! /drone mavlink | elrs       probe companion backends
//! /drone rth | map | help
//! ```

use crate::slash::command::{AppCtx, ArgItem, CommandExecCtx, CommandResult, SlashCommand};

/// Standalone drone HUD control instrument.
pub struct DroneCommand;

impl SlashCommand for DroneCommand {
    fn name(&self) -> &str {
        "drone"
    }

    fn aliases(&self) -> &[&str] {
        // free names — first-class, not nested under /webgrid
        &[
            "hud",
            "drone-hud",
            "dronehud",
            "fleet-hud",
            "webgrid-drone",
            "ugrad-drone",
            "fc-drone",
        ]
    }

    fn description(&self) -> &str {
        "Drone HUD · multi-unit FPV · path/RTH · maint (standalone pop-out)"
    }

    fn usage(&self) -> &str {
        "/drone [popout|units N|ugrad|mavlink|elrs|rth|help]"
    }

    fn takes_args(&self) -> bool {
        true
    }

    fn arg_placeholder(&self) -> Option<&str> {
        Some("popout | units 4 | ugrad | mavlink | elrs | rth | help")
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
            ("popout", "open drone HUD in browser / Memory Glass (default)"),
            ("units", "fleet size · e.g. units 6"),
            ("4", "4-unit mosaic (default)"),
            ("6", "6-unit mosaic"),
            ("sim", "offline sim backend (default)"),
            ("ugrad", "drone.ugrad.ai viewer backend"),
            ("viewer", "open ugrad mixed/demo rows viewer"),
            ("mavlink", "probe MAVLink Anywhere :9070"),
            ("elrs", "probe ELRS joystick / DeckTX path"),
            ("wifi", "probe smart-wifi-manager :9080"),
            ("mixed", "probe all backends"),
            ("track", "enable motion track plane"),
            ("sam", "Segment Anything style track mode"),
            ("dino", "DINO embed track mode"),
            ("slam", "SLAM keypoint path mode"),
            ("gsplat", "live gsplat calibration pipe (LAFR/3DGS-Calib hooks)"),
            ("clock", "force fc-timesync clock payload"),
            ("rth", "HUD with return-to-home focus toast"),
            ("map", "flight path · Carto dark tiles"),
            ("help", "show /drone help"),
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
            return CommandResult::Message(help_text());
        }

        // Optional: one-shot URL with units/backend (no process-wide env mutation).
        let toast = if let Some(url) = build_drone_url_override(&lower) {
            crate::live_demux::launch_webgrid_drone_popout_url_async(url)
        } else {
            crate::live_demux::launch_webgrid_drone_popout_async()
        };
        eprintln!("[fc-drone] {toast}");

        let mut extra = String::new();
        if lower.split_whitespace().any(|t| matches!(t, "rth" | "return" | "home")) {
            extra.push_str(" · RTH ready (press R in HUD)");
        }
        if lower.split_whitespace().any(|t| matches!(t, "map" | "path" | "mission")) {
            extra.push_str(" · map tiles (click pin · PRE/GO)");
        }
        if lower
            .split_whitespace()
            .any(|t| matches!(t, "track" | "sam" | "dino" | "slam" | "gsplat"))
        {
            extra.push_str(" · track plane armed");
        }
        if lower.split_whitespace().any(|t| matches!(t, "clock" | "zulu" | "timesync")) {
            extra.push_str(" · fc-timesync clock payload");
        }
        if lower
            .split_whitespace()
            .any(|t| matches!(t, "ugrad" | "viewer" | "mavlink" | "elrs" | "wifi" | "mixed"))
        {
            extra.push_str(" · backend probe on open");
        }

        CommandResult::Message(format!("{toast}{extra}"))
    }
}

fn help_text() -> String {
    "/drone · fc-webgrid-drone-hud-v2 · Oblivion/DJI FPV ops surface\n\
     /drone                     open HUD (sim · 4 units · motion track)\n\
     /drone units 6             fleet size 1–8\n\
     /drone ugrad | mavlink | elrs | mixed\n\
     /drone track | sam | dino | slam | gsplat\n\
     /drone clock               Zulu / fc-timesync stamps\n\
     /drone rth | map           RTH / tile map focus\n\
     /drone help\n\
     \n\
     keys: WASD sticks · Q/E yaw · Z/C thr · Space arm · Esc disarm\n\
           R RTH · H hold · L land · P preload · G go · T track · S SAM\n\
           M pin · C clock · 1–4 unit\n\
     page: http://127.0.0.1:8790/webgrid-drone-hud.html\n\
     map: Carto dark tiles (not black) · particle-earth / map-hub links\n\
     track: MOTION/SAM/DINO/SLAM/GSPLAT · hotpipe JSONL\n\
     gsplat: live cal residual · LAFR + 3DGS-Calib hooks\n\
     clock: tools.ugrad.ai/clock · timesync payload on events\n\
     TX path: DeckTX · ELRS · MAVLink Anywhere · smart-wifi\n\
     env: LIVE_DEMUX_WEBGRID_DRONE_URL\n\
     not a /watch channel · prefer /drone over /webgrid drone"
        .into()
}

/// Build a one-shot HUD URL from slash args (units / backend / track).
fn build_drone_url_override(lower: &str) -> Option<String> {
    let mut units: u32 = 4;
    let mut backend = "sim".to_string();
    let mut track: Option<String> = None;
    let mut saw = false;
    let toks: Vec<&str> = lower.split_whitespace().collect();
    let mut i = 0;
    while i < toks.len() {
        let t = toks[i];
        match t {
            "units" | "n" | "fleet" if i + 1 < toks.len() => {
                if let Ok(v) = toks[i + 1].parse::<u32>() {
                    units = v.clamp(1, 8);
                    saw = true;
                    i += 2;
                    continue;
                }
            }
            t if t.parse::<u32>().is_ok() && (1..=8).contains(&t.parse::<u32>().unwrap_or(0)) => {
                units = t.parse().unwrap_or(4);
                saw = true;
            }
            "sim" => {
                backend = "sim".into();
                saw = true;
            }
            "ugrad" | "viewer" => {
                backend = "ugrad".into();
                saw = true;
            }
            "mavlink" | "mav" => {
                backend = "mavlink".into();
                saw = true;
            }
            "elrs" | "decktx" | "crsf" => {
                backend = "elrs".into();
                saw = true;
            }
            "wifi" | "swm" | "mixed" => {
                backend = "mixed".into();
                saw = true;
            }
            "track" | "motion" => {
                track = Some("motion".into());
                saw = true;
            }
            "sam" => {
                track = Some("sam".into());
                saw = true;
            }
            "dino" => {
                track = Some("dino".into());
                saw = true;
            }
            "slam" => {
                track = Some("slam".into());
                saw = true;
            }
            "gsplat" | "splat" | "gauss" => {
                track = Some("gsplat".into());
                saw = true;
            }
            "clock" | "zulu" | "timesync" | "rth" | "map" | "path" => {
                saw = true;
            }
            _ => {}
        }
        i += 1;
    }
    if !saw {
        // Always open with explicit v2 defaults so assets sync
        return Some(format!(
            "http://127.0.0.1:8790/webgrid-drone-hud.html?backend=sim&units=4&demo=rows&track=motion"
        ));
    }
    let mut url = format!(
        "http://127.0.0.1:8790/webgrid-drone-hud.html?backend={backend}&units={units}&demo=rows"
    );
    if let Some(tr) = track {
        url.push_str(&format!("&track={tr}"));
    }
    Some(url)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acp::model_state::ModelState;
    use crate::slash::commands::tests::make_ctx;

    #[test]
    fn bare_launches_message() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match DroneCommand.run(&mut ctx, "") {
            CommandResult::Message(m) => {
                assert!(
                    m.contains("drone")
                        || m.contains("DRONE")
                        || m.contains("opening browser")
                        || m.contains("pop-out")
                        || m.contains("popout"),
                    "msg={m}"
                );
            }
            other => panic!("expected Message, got {other:?}"),
        }
    }

    #[test]
    fn help_message() {
        let models = ModelState::default();
        let mut ctx = make_ctx(&models);
        match DroneCommand.run(&mut ctx, "help") {
            CommandResult::Message(m) => {
                assert!(m.contains("fc-webgrid-drone-hud"), "msg={m}");
                assert!(m.contains("/drone"), "msg={m}");
            }
            other => panic!("expected Message, got {other:?}"),
        }
    }

    #[test]
    fn url_override_units_backend() {
        let u = build_drone_url_override("units 6 ugrad").expect("url");
        assert!(u.contains("units=6"), "{u}");
        assert!(u.contains("backend=ugrad"), "{u}");
    }

    #[test]
    fn name_and_aliases() {
        assert_eq!(DroneCommand.name(), "drone");
        assert!(DroneCommand.aliases().contains(&"hud"));
        assert!(DroneCommand.aliases().contains(&"drone-hud"));
    }
}
