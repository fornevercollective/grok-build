//! fc-gpu-pipe · fornevercollective
//!
//! Throttle **laptop** bare-metal GPU encode (VideoToolbox / Metal path via ffmpeg)
//! and pipe a Cast-safe H.264 file for the TV — so we are **not** stuck at
//! DashCast WebView ~960×540 @ 12fps.
//!
//! Architecture:
//! ```text
//!   policy (tier / battery) ──► frame budget (W×H×fps×bitrate)
//!           │
//!           ▼
//!   ffmpeg lavfi Imagine field ──► h264_videotoolbox (GPU encode)
//!           │
//!           ▼
//!   ~/.panda/vision/cast/gpu-pipe.mp4 ──► catt cast  (TCL Default Media Receiver)
//! ```
//!
//! The Rust process owns **pacing + adaptive throttle**: if encode overruns
//! realtime, drop fps/res next segment. No cam-relay. No DashCast WebGL.

use clap::{Parser, ValueEnum};
use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, ValueEnum)]
enum Tier {
    /// Intel-friendly battery: soft res / fps / bitrate
    Battery,
    /// Default promo: 720p24 VT
    Wow,
    /// Plugged-in: 1080p30 VT
    Insane,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum PowerPref {
    /// Prefer VideoToolbox realtime + lower tier if lagging
    Auto,
    /// Cap hard for battery (never above wow)
    Low,
    /// Allow insane
    High,
}

#[derive(Parser, Debug)]
#[command(
    name = "fc-gpu-pipe",
    about = "Throttle laptop GPU encode → Cast TV (bypass DashCast WebGL)",
    long_about = None
)]
struct Args {
    /// Power / quality tier
    #[arg(long, value_enum, default_value_t = Tier::Wow, env = "FC_GPU_PIPE_TIER")]
    tier: Tier,

    /// Power preference (auto adapts on encode lag)
    #[arg(long, value_enum, default_value_t = PowerPref::Auto, env = "FC_GPU_PIPE_POWER")]
    power: PowerPref,

    /// Override width
    #[arg(long, env = "FC_GPU_PIPE_W")]
    w: Option<u32>,

    /// Override height
    #[arg(long, env = "FC_GPU_PIPE_H")]
    h: Option<u32>,

    /// Override fps
    #[arg(long, env = "FC_GPU_PIPE_FPS")]
    fps: Option<u32>,

    /// Bitrate kbps (VideoToolbox)
    #[arg(long, env = "FC_GPU_PIPE_BITRATE")]
    bitrate: Option<u32>,

    /// Segment duration seconds (each segment is one encode job)
    #[arg(long, default_value_t = 12.0, env = "FC_GPU_PIPE_SECS")]
    secs: f64,

    /// How many segments (0 = forever until Ctrl-C)
    #[arg(long, default_value_t = 1, env = "FC_GPU_PIPE_SEGMENTS")]
    segments: u32,

    /// Output mp4 path
    #[arg(long, env = "FC_GPU_PIPE_OUT")]
    out: Option<PathBuf>,

    /// Status JSONL pipe
    #[arg(long, env = "FC_GPU_PIPE_STATUS")]
    status: Option<PathBuf>,

    /// After encode, catt cast to this device (empty = no cast)
    #[arg(long, default_value = "", env = "LIVE_DEMUX_CAST_DEVICE")]
    cast_device: String,

    /// Visual mode tag (imagine | portal | tunnel) — filtergraph family
    #[arg(long, default_value = "imagine", env = "FC_GPU_PIPE_MODE")]
    mode: String,

    /// Dry-run: print ffmpeg argv only
    #[arg(long)]
    dry_run: bool,

    /// Prefer software libx264 if videotoolbox missing
    #[arg(long, default_value_t = false)]
    allow_sw: bool,
}

#[derive(Clone, Debug)]
struct Budget {
    w: u32,
    h: u32,
    fps: u32,
    bitrate_k: u32,
    label: String,
}

impl Budget {
    fn from_tier(tier: Tier) -> Self {
        match tier {
            Tier::Battery => Budget {
                w: 960,
                h: 540,
                fps: 20,
                bitrate_k: 2500,
                label: "battery".into(),
            },
            Tier::Wow => Budget {
                w: 1280,
                h: 720,
                fps: 24,
                bitrate_k: 5500,
                label: "wow".into(),
            },
            Tier::Insane => Budget {
                w: 1920,
                h: 1080,
                fps: 30,
                bitrate_k: 9000,
                label: "insane".into(),
            },
        }
    }

    fn apply_overrides(mut self, a: &Args) -> Self {
        if let Some(w) = a.w {
            self.w = w;
        }
        if let Some(h) = a.h {
            self.h = h;
        }
        if let Some(f) = a.fps {
            self.fps = f.max(1);
        }
        if let Some(b) = a.bitrate {
            self.bitrate_k = b.max(500);
        }
        self
    }

    fn step_down(&self) -> Self {
        if self.w >= 1600 {
            return Budget {
                w: 1280,
                h: 720,
                fps: 24,
                bitrate_k: 5500,
                label: format!("{}↓wow", self.label),
            };
        }
        if self.w >= 1100 {
            return Budget {
                w: 960,
                h: 540,
                fps: 20,
                bitrate_k: 2800,
                label: format!("{}↓battery", self.label),
            };
        }
        Budget {
            w: self.w,
            h: self.h,
            fps: (self.fps.saturating_sub(4)).max(12),
            bitrate_k: (self.bitrate_k * 8 / 10).max(1200),
            label: format!("{}↓fps", self.label),
        }
    }
}

#[derive(Serialize)]
struct StatusLine {
    schema: &'static str,
    t: f64,
    event: String,
    tier: String,
    w: u32,
    h: u32,
    fps: u32,
    bitrate_k: u32,
    secs: f64,
    encode_secs: f64,
    realtime_ratio: f64,
    out: String,
    mode: String,
    note: String,
}

fn now_unix() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

fn home_cast_dir() -> PathBuf {
    dirs_fallback().join(".panda/vision/cast")
}

fn dirs_fallback() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn append_status(path: &Path, line: &StatusLine) {
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        if let Ok(s) = serde_json::to_string(line) {
            let _ = writeln!(f, "{s}");
        }
    }
}

fn has_videotoolbox() -> bool {
    Command::new("ffmpeg")
        .args(["-hide_banner", "-encoders"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("h264_videotoolbox"))
        .unwrap_or(false)
}

/// lavfi graph: Imagine field. Fast filters only — VT stays ≥ realtime on Intel UHD.
/// (Per-pixel `geq` was ~0.3× realtime and forced 540p throttle.)
fn lavfi_imagine(b: &Budget, secs: f64, mode: &str) -> String {
    let s = format!("{}x{}", b.w, b.h);
    let r = b.fps;
    let d = secs;
    match mode {
        "portal" | "box" => format!(
            "gradients=s={s}:c0=0x1a1040:c1=0x050510:x0=0:y0=0:x1=1:y1=1:r={r}:d={d},\
hue=h=55:s=1.4,eq=contrast=1.15:saturation=1.35:brightness=0.02,\
vignette=PI/4,noise=alls=5:allf=t,format=yuv420p"
        ),
        "tunnel" => format!(
            "gradients=s={s}:c0=0x301860:c1=0x020208:x0=0.5:y0=0.5:x1=0:y1=0:r={r}:d={d},\
hue=h=200:s=1.45,eq=contrast=1.18:saturation=1.4,\
vignette=PI/5,noise=alls=6:allf=t,format=yuv420p"
        ),
        // imagine (default) — Grok promo purple void + cyan edge + grain
        _ => format!(
            "gradients=s={s}:c0=0x2a1850:c1=0x050510:x0=0:y0=0:x1=1:y1=1:r={r}:d={d},\
hue=h=48:s=1.45,eq=contrast=1.12:saturation=1.4:brightness=0.025,\
vignette=PI/4.2,noise=alls=5:allf=t,format=yuv420p"
        ),
    }
}

fn build_ffmpeg_cmd(b: &Budget, secs: f64, out: &Path, mode: &str, use_vt: bool) -> Command {
    let lavfi = lavfi_imagine(b, secs, mode);
    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i"])
        .arg(&lavfi);

    if use_vt {
        // VideoToolbox = GPU hardware encode on this Mac (Intel/AMD/Apple)
        cmd.args([
            "-c:v",
            "h264_videotoolbox",
            "-b:v",
            &format!("{}k", b.bitrate_k),
            "-realtime",
            "1",
            "-pix_fmt",
            "yuv420p",
        ]);
    } else {
        cmd.args([
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-b:v",
            &format!("{}k", b.bitrate_k),
            "-pix_fmt",
            "yuv420p",
            "-tune",
            "zerolatency",
        ]);
    }
    cmd.args(["-movflags", "+faststart", "-an"]).arg(out);
    cmd
}

fn run_encode(cmd: &mut Command) -> Result<Duration, String> {
    let t0 = Instant::now();
    let status = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("spawn ffmpeg: {e}"))?;
    let dt = t0.elapsed();
    if !status.success() {
        return Err(format!("ffmpeg exit {status} after {dt:?}"));
    }
    Ok(dt)
}

fn cast_file(path: &Path, device: &str) -> Result<(), String> {
    if device.is_empty() {
        return Ok(());
    }
    let catt = dirs_fallback()
        .join(".local/bin/catt")
        .exists()
        .then(|| dirs_fallback().join(".local/bin/catt"))
        .unwrap_or_else(|| PathBuf::from("catt"));

    let _ = Command::new(&catt)
        .args(["-d", device, "stop"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    thread::sleep(Duration::from_millis(400));

    let st = Command::new(&catt)
        .args(["-d", device, "cast"])
        .arg(path)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .map_err(|e| format!("catt: {e}"))?;
    if !st.success() {
        return Err(format!("catt cast failed: {st}"));
    }
    Ok(())
}

fn main() {
    let args = Args::parse();
    if Command::new("ffmpeg").arg("-version").output().is_err() {
        eprintln!("error: ffmpeg not on PATH");
        std::process::exit(1);
    }

    let mut tier = args.tier;
    match args.power {
        PowerPref::Low => {
            if matches!(tier, Tier::Insane) {
                tier = Tier::Wow;
            }
        }
        PowerPref::High | PowerPref::Auto => {}
    }

    let mut budget = Budget::from_tier(tier).apply_overrides(&args);
    let cast_dir = home_cast_dir();
    let _ = fs::create_dir_all(&cast_dir);
    let out = args
        .out
        .clone()
        .unwrap_or_else(|| cast_dir.join("gpu-pipe.mp4"));
    let status_path = args
        .status
        .clone()
        .unwrap_or_else(|| cast_dir.join("gpu-pipe.jsonl"));

    let use_vt = has_videotoolbox();
    if !use_vt && !args.allow_sw {
        eprintln!("error: h264_videotoolbox missing — pass --allow-sw for libx264");
        std::process::exit(1);
    }
    if !use_vt {
        eprintln!("warn: VideoToolbox missing — software libx264 (slower, more CPU)");
    }

    println!("fc-gpu-pipe · fornevercollective");
    println!(
        "  tier {} · {}x{} @ {}fps · {} kbps · VT={}",
        budget.label, budget.w, budget.h, budget.fps, budget.bitrate_k, use_vt
    );
    println!("  mode {} · secs {} · out {}", args.mode, args.secs, out.display());
    println!("  status {}", status_path.display());
    if !args.cast_device.is_empty() {
        println!("  cast → {}", args.cast_device);
    }

    let max_seg = if args.segments == 0 {
        u32::MAX
    } else {
        args.segments
    };
    let mut seg_i = 0u32;

    while seg_i < max_seg {
        seg_i += 1;
        let mut cmd = build_ffmpeg_cmd(&budget, args.secs, &out, &args.mode, use_vt);

        if args.dry_run {
            println!("dry-run argv: {cmd:?}");
            break;
        }

        print!(
            "  [{seg_i}] encode {}x{}@{} … ",
            budget.w, budget.h, budget.fps
        );
        let _ = std::io::stdout().flush();

        let encode_dt = match run_encode(&mut cmd) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("FAIL {e}");
                append_status(
                    &status_path,
                    &StatusLine {
                        schema: "fc-gpu-pipe-v1",
                        t: now_unix(),
                        event: "encode_fail".into(),
                        tier: budget.label.clone(),
                        w: budget.w,
                        h: budget.h,
                        fps: budget.fps,
                        bitrate_k: budget.bitrate_k,
                        secs: args.secs,
                        encode_secs: 0.0,
                        realtime_ratio: 0.0,
                        out: out.display().to_string(),
                        mode: args.mode.clone(),
                        note: e,
                    },
                );
                std::process::exit(1);
            }
        };

        let encode_secs = encode_dt.as_secs_f64();
        let ratio = if encode_secs > 0.0 {
            args.secs / encode_secs
        } else {
            0.0
        };
        println!(
            "ok in {encode_secs:.2}s (realtime {ratio:.2}x · {})",
            budget.label
        );

        append_status(
            &status_path,
            &StatusLine {
                schema: "fc-gpu-pipe-v1",
                t: now_unix(),
                event: "encode_ok".into(),
                tier: budget.label.clone(),
                w: budget.w,
                h: budget.h,
                fps: budget.fps,
                bitrate_k: budget.bitrate_k,
                secs: args.secs,
                encode_secs,
                realtime_ratio: ratio,
                out: out.display().to_string(),
                mode: args.mode.clone(),
                note: if use_vt {
                    "h264_videotoolbox".into()
                } else {
                    "libx264".into()
                },
            },
        );

        // Adaptive throttle: encode slower than realtime → step down
        if matches!(args.power, PowerPref::Auto | PowerPref::Low) && ratio < 0.85 {
            let next = budget.step_down();
            println!(
                "  throttle ↓ lagging encode → {}x{}@{} ({})",
                next.w, next.h, next.fps, next.label
            );
            budget = next;
        }

        if !args.cast_device.is_empty() {
            print!("  cast {} … ", args.cast_device);
            let _ = std::io::stdout().flush();
            match cast_file(&out, &args.cast_device) {
                Ok(()) => println!("ok"),
                Err(e) => {
                    println!("warn: {e}");
                    append_status(
                        &status_path,
                        &StatusLine {
                            schema: "fc-gpu-pipe-v1",
                            t: now_unix(),
                            event: "cast_fail".into(),
                            tier: budget.label.clone(),
                            w: budget.w,
                            h: budget.h,
                            fps: budget.fps,
                            bitrate_k: budget.bitrate_k,
                            secs: args.secs,
                            encode_secs,
                            realtime_ratio: ratio,
                            out: out.display().to_string(),
                            mode: args.mode.clone(),
                            note: e,
                        },
                    );
                }
            }
        }

        // Pace segments: if encode was faster than realtime, wait so we don't thrash GPU
        if args.segments != 1 && ratio > 1.05 {
            let wait = Duration::from_secs_f64((args.secs - encode_secs).max(0.0) * 0.25);
            if wait > Duration::from_millis(50) {
                thread::sleep(wait);
            }
        }
    }

    println!("done · {}", out.display());
}
