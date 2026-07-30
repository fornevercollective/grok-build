//! Live **lens** pop-out — HDRI / anamorphic / tiny-bug-world vision.
//!
//! **fornevercollective** · `fc-lens-bug-v1`
//!
//! Memory Glass `lens.js` FOV/anamorphic grammar, realized as live `ffplay`
//! filter graphs so Grok can pop an OS window that feels like:
//! - compound-eye / 360 fisheye
//! - anamorphic squeeze plate
//! - miniature “tiny world” tilt-shift
//! - HDR-ish tone (lifted shadows, packed highlights, lush sat)
//!
//! Sources: laptop webcam · phone still-pipe · dual · optional 360 equirect.
//!
//! ```text
//! /lens                  bug world from dual/you cam
//! /lens bug · tiny · hdri · anamorphic · 360
//! /cam phone  then  L    live lens pop-out while watch open
//! ```

use super::camera::{cam_capture_size, cam_device, cam_mirror_default, cam_source, cam_still_path};
use super::popout::{spawn_ffplay_camera, spawn_ffplay_still};
use std::process::{Command, Stdio};
use std::thread;

/// Binary feature stamp.
pub const FEATURE_ID: &str = "fc-lens-bug-v1";

pub const TOAST_LENS: &str =
    "LENS · bug-world / HDRI anamorphic pop-out (L key · /lens · 360 fisheye)";

/// Named live-lens look.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LensProfile {
    /// Default: fisheye + anamorphic + tiny-world + HDR tone (insect vision).
    BugWorld,
    /// Strong dual-fisheye / 360-style compound eye.
    Compound360,
    /// Cinema 2x anamorphic desqueeze plate + mild macro.
    Anamorphic,
    /// Tilt-shift miniature only (tiny planet / diorama).
    TinyWorld,
    /// HDR tone + bloom-ish unsharp without heavy geometry.
    Hdri,
}

impl LensProfile {
    pub fn id(self) -> &'static str {
        match self {
            LensProfile::BugWorld => "bug",
            LensProfile::Compound360 => "360",
            LensProfile::Anamorphic => "anamorphic",
            LensProfile::TinyWorld => "tiny",
            LensProfile::Hdri => "hdri",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            LensProfile::BugWorld => "tiny bug world · HDRI anamorphic",
            LensProfile::Compound360 => "360 compound eye · dual fisheye",
            LensProfile::Anamorphic => "2× anamorphic plate",
            LensProfile::TinyWorld => "tilt-shift tiny world",
            LensProfile::Hdri => "HDRI tone map",
        }
    }
}

/// Where the lens reads frames.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LensInput {
    /// Local laptop / desktop webcam.
    Webcam,
    /// Phone still-pipe live.jpg.
    PhoneStill,
    /// Both OS windows (you + phone) with same lens.
    Dual,
    /// Treat input as 360 equirectangular (v360 path when available).
    Equirect360,
}

/// Parse `/lens …` args → profile + input.
pub fn parse_lens_args(raw: &str) -> (LensProfile, LensInput) {
    let t = raw.trim().to_ascii_lowercase();
    let tokens: Vec<&str> = t.split_whitespace().collect();

    let profile = if tokens.iter().any(|x| {
        matches!(
            *x,
            "360" | "compound" | "fisheye" | "equirect" | "vr" | "omni"
        )
    }) {
        LensProfile::Compound360
    } else if tokens
        .iter()
        .any(|x| matches!(*x, "ana" | "anamorphic" | "scope" | "2x" | "2.39"))
    {
        LensProfile::Anamorphic
    } else if tokens.iter().any(|x| {
        matches!(
            *x,
            "tiny" | "mini" | "miniature" | "tilt" | "tiltshift" | "diorama"
        )
    }) {
        LensProfile::TinyWorld
    } else if tokens
        .iter()
        .any(|x| matches!(*x, "hdri" | "hdr" | "tone" | "irradiance"))
    {
        LensProfile::Hdri
    } else {
        // bug / insect / default
        LensProfile::BugWorld
    };

    // Input selection: dual / phone / you beat bare "360".
    // `/lens 360 dual` → Compound360 profile + Dual windows (flat compound barrel).
    // `/lens equirect` or `LIVE_DEMUX_LENS_360=1` → true equirect v360 path.
    // Bare `/lens 360` follows current cam source (often dual desk when phone is live).
    let input = if tokens.iter().any(|x| {
        matches!(
            *x,
            "dual" | "both" | "you+phone" | "sidebyside" | "sbs" | "pair"
        )
    }) {
        LensInput::Dual
    } else if tokens.iter().any(|x| {
        matches!(
            *x,
            "phone" | "still" | "stillpipe" | "tether" | "pwa" | "live.jpg"
        )
    }) {
        LensInput::PhoneStill
    } else if tokens
        .iter()
        .any(|x| matches!(*x, "you" | "local" | "webcam" | "laptop" | "desktop" | "self"))
    {
        LensInput::Webcam
    } else if tokens.iter().any(|x| {
        matches!(
            *x,
            "equirect" | "equirectangular" | "panorama" | "pano"
        )
    }) {
        LensInput::Equirect360
    } else {
        // Follow current cam source when in /watch dual/phone.
        match cam_source() {
            super::camera::CamSource::Dual => LensInput::Dual,
            super::camera::CamSource::PhoneStill => LensInput::PhoneStill,
            super::camera::CamSource::Local => LensInput::Webcam,
        }
    };

    (profile, input)
}

/// Display size for lens windows (`LIVE_DEMUX_LENS_SIZE`, default 1280x720).
fn lens_display_size() -> (u32, u32) {
    if let Ok(s) = std::env::var("LIVE_DEMUX_LENS_SIZE") {
        if let Some((a, b)) = s.split_once('x') {
            if let (Ok(w), Ok(h)) = (a.parse::<u32>(), b.parse::<u32>()) {
                return (w.max(640), h.max(360));
            }
        }
    }
    (1280, 720)
}

fn lens_fps() -> u32 {
    std::env::var("LIVE_DEMUX_LENS_FPS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(24)
        .clamp(8, 60)
}

/// Build ffmpeg `-vf` chain for a profile.
///
/// Geometry is approximate “insect / anamorphic / tiny world” using filters
/// available in stock ffmpeg (no custom GLSL). 360 path prefers `v360` when
/// the graph is labeled equirect; flat cams use barrel `lenscorrection`.
pub fn lens_vf(profile: LensProfile, equirect: bool, w: u32, h: u32) -> String {
    let (w, h) = (w.max(640), h.max(360));
    // Common HDR-ish grade: lift shadows, roll highlights, lush sat, slight green.
    let grade = "eq=contrast=1.12:brightness=0.03:saturation=1.45:gamma=1.05,\
colorbalance=rs=-0.04:gs=0.06:bs=-0.03:rm=0.02:gm=0.04:bm=-0.02,\
unsharp=5:5:0.6:5:5:0.0";

    // Anamorphic horizontal squeeze feel → letterbox cinema plate.
    let ana = format!(
        "scale=iw*0.52:ih,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x05080c"
    );
    // Stronger 2x plate.
    let ana2 = format!(
        "scale=iw*0.42:ih,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x05080c"
    );

    // Tiny-world: soft top/bottom blur bands (tilt-shift proxy).
    let tiny = format!(
        "split[a][b];\
[a]boxblur=8:2[blur];\
[b]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(between(Y,H*0.28,H*0.72),255,0)'[mask];\
[blur][mask]alphamerge[blura];\
[b][blura]overlay"
    );
    // Simpler tiny (more portable): vignette + slight zoom center.
    let tiny_simple = "crop=iw*0.92:ih*0.92,scale=iw*1.08:ih*1.08,crop=iw:ih,vignette=PI/5";

    // Flat → bug fisheye (barrel).
    let barrel = "lenscorrection=k1=0.28:k2=0.12:cx=0.5:cy=0.5";
    // Stronger compound.
    let barrel_hard = "lenscorrection=k1=0.42:k2=0.18:cx=0.5:cy=0.5";

    // 360 equirect → dual fisheye or rectilinear “bug stare”.
    // v360 may be missing on some builds — caller can fall back.
    let v360_bug = format!(
        "v360=input=e:output=dfisheye:h_fov=190:v_fov=190,scale={w}:{h}"
    );
    let v360_flat = format!(
        "v360=input=e:output=flat:yaw=0:pitch=-18:roll=0:h_fov=110:v_fov=70,scale={w}:{h}"
    );

    let base_scale = format!("scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2");

    let chain = match (profile, equirect) {
        (LensProfile::Compound360, true) => {
            format!("{v360_bug},{grade},vignette=PI/3.2")
        }
        (LensProfile::Compound360, false) => {
            format!("{base_scale},{barrel_hard},{grade},vignette=PI/3,{ana}")
        }
        (LensProfile::Anamorphic, true) => {
            format!("{v360_flat},{grade},{ana2}")
        }
        (LensProfile::Anamorphic, false) => {
            format!("{base_scale},{barrel},{grade},{ana2}")
        }
        (LensProfile::TinyWorld, true) => {
            format!("{v360_flat},{tiny_simple},{grade}")
        }
        (LensProfile::TinyWorld, false) => {
            // Prefer simple tiny; complex alphamerge can fail on some ffplay builds.
            let _ = tiny;
            format!("{base_scale},{tiny_simple},{grade},hue=h=18:s=1.1")
        }
        (LensProfile::Hdri, true) => {
            format!(
                "{v360_flat},{grade},curves=all='0/0 0.25/0.2 0.5/0.55 0.75/0.82 1/1',vignette=PI/6"
            )
        }
        (LensProfile::Hdri, false) => {
            format!(
                "{base_scale},{grade},curves=all='0/0 0.25/0.2 0.5/0.55 0.75/0.82 1/1',vignette=PI/6"
            )
        }
        (LensProfile::BugWorld, true) => {
            // Full recipe: 360 dual-fisheye + anamorphic + tiny + HDR.
            format!("{v360_bug},{tiny_simple},{grade},{ana},vignette=PI/3.5,hue=h=22:s=1.15")
        }
        (LensProfile::BugWorld, false) => {
            format!(
                "{base_scale},{barrel_hard},{tiny_simple},{grade},{ana},vignette=PI/3.5,hue=h=22:s=1.15"
            )
        }
    };

    // Optional env override full graph.
    if let Ok(extra) = std::env::var("LIVE_DEMUX_LENS_VF") {
        if !extra.trim().is_empty() {
            return extra;
        }
    }
    chain
}

fn use_v360_pref() -> bool {
    !matches!(
        std::env::var("LIVE_DEMUX_LENS_NO_V360").as_deref(),
        Ok("1") | Ok("true") | Ok("yes")
    )
}

/// Spawn lens ffplay from a local camera device index/name.
pub fn spawn_lens_webcam(profile: LensProfile, equirect: bool) -> Result<u32, String> {
    let device = cam_device();
    let (cap_w, cap_h) = cam_capture_size();
    let (disp_w, disp_h) = lens_display_size();
    let fps = lens_fps();
    let mirror = cam_mirror_default() && !equirect;
    let mut vf = lens_vf(profile, equirect && use_v360_pref(), disp_w, disp_h);
    if mirror {
        vf = format!("hflip,{vf}");
    }
    let title = format!("lens · {} · [{device}]", profile.label());

    let mut cmd = Command::new("ffplay");
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-framedrop",
        "-window_title",
        &title,
    ]);

    if cfg!(target_os = "macos") {
        cmd.args([
            "-f",
            "avfoundation",
            "-framerate",
            &format!("{fps}"),
            "-video_size",
            &format!("{cap_w}x{cap_h}"),
            "-i",
            &format!("{device}:none"),
            "-an",
            "-vf",
            &vf,
        ]);
    } else if cfg!(target_os = "linux") {
        let dev = if device.starts_with('/') {
            device.clone()
        } else {
            format!("/dev/video{device}")
        };
        cmd.args([
            "-f",
            "v4l2",
            "-framerate",
            &format!("{fps}"),
            "-video_size",
            &format!("{cap_w}x{cap_h}"),
            "-i",
            &dev,
            "-an",
            "-vf",
            &vf,
        ]);
    } else {
        return Err("lens webcam only on macOS / Linux".into());
    }

    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);

    let child = cmd
        .spawn()
        .map_err(|e| format!("ffplay lens webcam spawn failed: {e}"))?;
    Ok(child.id())
}

/// Spawn lens ffplay from phone still-pipe JPEG (looping).
///
/// Uses `image2` + framerate so each frame re-opens the path (atomic
/// `live.jpg` replace from still-server does not kill the player).
pub fn spawn_lens_still(profile: LensProfile, equirect: bool) -> Result<u32, String> {
    let still = cam_still_path();
    super::camera::ensure_still_seed_public(&still);
    let (disp_w, disp_h) = lens_display_size();
    let vf = lens_vf(profile, equirect && use_v360_pref(), disp_w, disp_h);
    let title = format!("lens · {} · phone still", profile.label());
    // Re-read path ~12×/s — matches phone upload cadence without thrashing.
    let still_fps = std::env::var("LIVE_DEMUX_LENS_STILL_FPS")
        .ok()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(12)
        .clamp(4, 30);

    let mut cmd = Command::new("ffplay");
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "nobuffer",
        "-flags",
        "low_delay",
        "-framedrop",
        "-window_title",
        &title,
        "-f",
        "image2",
        "-loop",
        "1",
        "-framerate",
        &format!("{still_fps}"),
        "-i",
        &still,
        "-an",
        "-vf",
        &vf,
    ]);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);
    let child = cmd
        .spawn()
        .map_err(|e| format!("ffplay lens still spawn failed: {e}"))?;
    Ok(child.id())
}

/// Blocking launch for profile + input.
pub fn launch_lens_blocking(profile: LensProfile, input: LensInput) -> Result<String, String> {
    let equirect = matches!(input, LensInput::Equirect360)
        || matches!(
            std::env::var("LIVE_DEMUX_LENS_360").as_deref(),
            Ok("1") | Ok("true") | Ok("yes")
        );

    match input {
        LensInput::Webcam | LensInput::Equirect360 => {
            let pid = spawn_lens_webcam(profile, equirect)?;
            Ok(format!(
                "lens · {} · webcam · ffplay pid {pid}",
                profile.id()
            ))
        }
        LensInput::PhoneStill => {
            let pid = spawn_lens_still(profile, equirect)?;
            Ok(format!(
                "lens · {} · phone still · pid {pid}",
                profile.id()
            ))
        }
        LensInput::Dual => {
            // Two lens windows: you + phone.
            // Flat webcam/phone still never force equirect v360 — that path is
            // for real 360 cams (`LensInput::Equirect360` / LIVE_DEMUX_LENS_360).
            // Compound360 profile still applies hard barrel + grade on both.
            let you = spawn_lens_webcam(profile, false)?;
            thread::sleep(std::time::Duration::from_millis(350));
            let phone = spawn_lens_still(profile, false)?;
            Ok(format!(
                "lens · {} · dual · you pid {you} · phone pid {phone}",
                profile.id()
            ))
        }
    }
}

/// Fire-and-forget lens pop-out toast.
pub fn launch_lens_async(profile: LensProfile, input: LensInput) -> String {
    let label = format!("{} · {:?}", profile.id(), input);
    let _ = thread::Builder::new()
        .name("live-demux-lens".into())
        .spawn(move || {
            match launch_lens_blocking(profile, input) {
                Ok(msg) => eprintln!("[fc-lens-bug] {msg}"),
                Err(e) => {
                    eprintln!("[fc-lens-bug] {e}");
                    // Fall back: plain cam/still pop-out so something always opens.
                    let _ = match input {
                        LensInput::PhoneStill => spawn_ffplay_still(&cam_still_path(), "phone"),
                        LensInput::Dual => {
                            let _ = spawn_ffplay_camera(
                                &cam_device(),
                                "you",
                                cam_mirror_default(),
                            );
                            thread::sleep(std::time::Duration::from_millis(300));
                            spawn_ffplay_still(&cam_still_path(), "phone")
                        }
                        _ => spawn_ffplay_camera(&cam_device(), "lens-fallback", cam_mirror_default()),
                    };
                }
            }
        });
    format!("lens pop-out · {label} · launching bug-world / HDRI anamorphic…")
}

/// Tokens that mean lens pop-out (for /watch args or keys).
pub fn is_lens_token(tok: &str) -> bool {
    matches!(
        tok.to_ascii_lowercase().as_str(),
        "lens"
            | "bug"
            | "bugworld"
            | "bug-world"
            | "insect"
            | "compound"
            | "hdri"
            | "anamorphic"
            | "tinyworld"
            | "tiny-world"
            | "tiltshift"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_default_bug() {
        let (p, _) = parse_lens_args("");
        assert_eq!(p, LensProfile::BugWorld);
    }

    #[test]
    fn parse_360_equirect_explicit() {
        let (p, i) = parse_lens_args("360 equirect");
        assert_eq!(p, LensProfile::Compound360);
        assert_eq!(i, LensInput::Equirect360);
    }

    #[test]
    fn parse_360_dual_is_dual_not_equirect() {
        let (p, i) = parse_lens_args("360 dual");
        assert_eq!(p, LensProfile::Compound360);
        assert_eq!(i, LensInput::Dual, "/lens 360 dual must open both windows");
    }

    #[test]
    fn parse_360_phone_is_phone() {
        let (p, i) = parse_lens_args("360 phone");
        assert_eq!(p, LensProfile::Compound360);
        assert_eq!(i, LensInput::PhoneStill);
    }

    #[test]
    fn parse_bare_360_profile_only() {
        let (p, _) = parse_lens_args("360");
        assert_eq!(p, LensProfile::Compound360);
        // input follows cam_source — not forced equirect (that killed dual)
    }

    #[test]
    fn parse_anamorphic_phone() {
        let (p, i) = parse_lens_args("anamorphic phone");
        assert_eq!(p, LensProfile::Anamorphic);
        assert_eq!(i, LensInput::PhoneStill);
    }

    #[test]
    fn vf_360_flat_uses_barrel_not_v360() {
        let vf = lens_vf(LensProfile::Compound360, false, 1280, 720);
        assert!(
            vf.contains("lenscorrection"),
            "flat 360 dual should use barrel compound, got {vf}"
        );
        assert!(
            !vf.contains("v360="),
            "flat dual must not force v360 equirect, got {vf}"
        );
    }

    #[test]
    fn vf_bug_contains_lens_and_grade() {
        let vf = lens_vf(LensProfile::BugWorld, false, 1280, 720);
        assert!(vf.contains("lenscorrection") || vf.contains("scale"), "{vf}");
        assert!(vf.contains("eq=") || vf.contains("saturation"), "{vf}");
    }

    #[test]
    fn feature_stamp() {
        assert!(FEATURE_ID.contains("lens"));
    }
}
