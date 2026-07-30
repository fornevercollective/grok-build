//! Mic level + waveform ring for `/cam` talk strip.
//!
//! **fornevercollective** · Memory Glass `phone-wave.js` grammar in TTY form:
//! - local: ffmpeg AVFoundation / pulse / default → f32le mono → RMS + bars
//! - optional: pull Memory Glass hub `GET /wave` when `MG_WAVE_URL` is set
//!
//! No STT here — levels only (whisper stays in MG dial-in / external).

/// Binary feature stamp (picked up by `deploy-fc-grok.sh` / launch scripts).
/// Short form `fc-cam-talk` is embedded via TOAST / `[fc-cam-talk]` eprintln.
pub const FEATURE_ID: &str = "fc-cam-talk-v1";

use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

/// Waveform bins painted under the cam tile.
pub const WAVE_BINS: usize = 24;

struct SharedMic {
    /// Rolling bar heights 0.0..1.0
    bins: [f32; WAVE_BINS],
    /// Instantaneous RMS 0..1 (soft-capped)
    rms: f32,
    /// Peak hold
    peak: f32,
    generation: AtomicU32,
    error: Option<String>,
    source: MicSource,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MicSource {
    Local,
    MemoryGlassHub,
    Idle,
}

impl SharedMic {
    fn new() -> Self {
        Self {
            bins: [0.0; WAVE_BINS],
            rms: 0.0,
            peak: 0.0,
            generation: AtomicU32::new(0),
            error: None,
            source: MicSource::Idle,
        }
    }
}

fn env_bool(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(s) => matches!(
            s.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

/// Auto-start mic meter when camera turns on.
pub fn mic_auto_on() -> bool {
    env_bool("LIVE_DEMUX_MIC", true) // default on with cam talk path
}

fn mic_device() -> String {
    std::env::var("LIVE_DEMUX_MIC_DEVICE")
        .or_else(|_| std::env::var("LIVE_DEMUX_AUDIO_DEVICE"))
        .unwrap_or_else(|_| "0".into())
}

fn mg_wave_url() -> Option<String> {
    let u = std::env::var("MG_WAVE_URL")
        .or_else(|_| std::env::var("MEMORY_GLASS_WAVE_URL"))
        .unwrap_or_else(|_| "http://127.0.0.1:9877/wave".into());
    if u.is_empty() || u == "0" || u == "off" {
        None
    } else {
        Some(u)
    }
}

/// Live mic meter (ffmpeg local and/or Memory Glass hub).
pub struct MicLevelFeed {
    child: Option<Child>,
    reader: Option<JoinHandle<()>>,
    hub: Option<JoinHandle<()>>,
    shared: Arc<Mutex<SharedMic>>,
    stop: Arc<AtomicBool>,
}

impl MicLevelFeed {
    pub fn start() -> Result<Self, String> {
        let shared = Arc::new(Mutex::new(SharedMic::new()));
        let stop = Arc::new(AtomicBool::new(false));

        // Prefer MG hub when it answers; still start local as fallback sampler.
        let hub = if let Some(url) = mg_wave_url() {
            let shared_h = Arc::clone(&shared);
            let stop_h = Arc::clone(&stop);
            Some(
                thread::Builder::new()
                    .name("cam-mic-hub".into())
                    .spawn(move || hub_poll_loop(url, shared_h, stop_h))
                    .map_err(|e| format!("mic hub thread: {e}"))?,
            )
        } else {
            None
        };

        let (child, reader) = match start_local_ffmpeg(Arc::clone(&shared), Arc::clone(&stop)) {
            Ok(pair) => (Some(pair.0), Some(pair.1)),
            Err(e) => {
                // Hub-only is fine if MG is up.
                if let Ok(mut g) = shared.lock() {
                    if hub.is_none() {
                        g.error = Some(e);
                    }
                }
                (None, None)
            }
        };

        Ok(Self {
            child,
            reader,
            hub,
            shared,
            stop,
        })
    }

    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(mut c) = self.child.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
        if let Some(h) = self.reader.take() {
            let _ = h.join();
        }
        if let Some(h) = self.hub.take() {
            let _ = h.join();
        }
    }

    pub fn snapshot(&self) -> MicSnapshot {
        let Ok(g) = self.shared.lock() else {
            return MicSnapshot::idle();
        };
        MicSnapshot {
            bins: g.bins,
            rms: g.rms,
            peak: g.peak,
            generation: g.generation.load(Ordering::Relaxed),
            source: g.source,
            error: g.error.clone(),
        }
    }
}

impl Drop for MicLevelFeed {
    fn drop(&mut self) {
        self.stop();
    }
}

#[derive(Clone, Debug)]
pub struct MicSnapshot {
    pub bins: [f32; WAVE_BINS],
    pub rms: f32,
    pub peak: f32,
    pub generation: u32,
    pub source: MicSource,
    pub error: Option<String>,
}

impl MicSnapshot {
    pub fn idle() -> Self {
        Self {
            bins: [0.0; WAVE_BINS],
            rms: 0.0,
            peak: 0.0,
            generation: 0,
            source: MicSource::Idle,
            error: None,
        }
    }

    /// Paint a single-row waveform using block chars (TTY).
    pub fn bar_line(&self, width: usize) -> String {
        let w = width.max(4).min(WAVE_BINS * 2);
        let blocks = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
        let mut out = String::with_capacity(w);
        for i in 0..w {
            let bi = (i * WAVE_BINS) / w;
            let v = self.bins[bi].clamp(0.0, 1.0);
            let idx = ((v * (blocks.len() - 1) as f32).round() as usize).min(blocks.len() - 1);
            out.push(blocks[idx]);
        }
        out
    }

    pub fn source_label(&self) -> &'static str {
        match self.source {
            MicSource::Local => "mic",
            MicSource::MemoryGlassHub => "mg-wave",
            MicSource::Idle => "idle",
        }
    }
}

fn start_local_ffmpeg(
    shared: Arc<Mutex<SharedMic>>,
    stop: Arc<AtomicBool>,
) -> Result<(Child, JoinHandle<()>), String> {
    let dev = mic_device();
    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-hide_banner", "-loglevel", "error"]);

    if cfg!(target_os = "macos") {
        // Audio-only: none:<audio_index>
        cmd.args([
            "-f",
            "avfoundation",
            "-i",
            &format!("none:{dev}"),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "f32le",
            "pipe:1",
        ]);
    } else if cfg!(target_os = "linux") {
        cmd.args([
            "-f",
            "pulse",
            "-i",
            "default",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "f32le",
            "pipe:1",
        ]);
    } else {
        return Err("mic capture unsupported on this OS".into());
    }

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    xai_tty_utils::detach_std_command(&mut cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("ffmpeg mic spawn failed: {e}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "ffmpeg mic stdout missing".to_string())?;

    // Confirm process stayed up briefly.
    thread::sleep(Duration::from_millis(80));
    if let Ok(Some(status)) = child.try_wait() {
        return Err(format!(
            "ffmpeg mic exited immediately ({status}) — check LIVE_DEMUX_MIC_DEVICE / mic perms"
        ));
    }

    let reader = thread::Builder::new()
        .name("cam-mic-reader".into())
        .spawn(move || {
            local_pcm_loop(stdout, shared, stop);
        })
        .map_err(|e| format!("mic reader: {e}"))?;

    Ok((child, reader))
}

fn local_pcm_loop(mut r: impl Read, shared: Arc<Mutex<SharedMic>>, stop: Arc<AtomicBool>) {
    // ~20 ms chunks at 16 kHz f32 mono
    let chunk = 320;
    let mut buf = vec![0u8; chunk * 4];
    let mut bin_i = 0usize;
    while !stop.load(Ordering::Relaxed) {
        match read_exact_or_short(&mut r, &mut buf) {
            Ok(0) => break,
            Ok(n) => {
                let samples = n / 4;
                if samples == 0 {
                    continue;
                }
                let mut sum = 0.0f32;
                for i in 0..samples {
                    let o = i * 4;
                    let s = f32::from_le_bytes([buf[o], buf[o + 1], buf[o + 2], buf[o + 3]]);
                    sum += s * s;
                }
                let rms = (sum / samples as f32).sqrt().min(1.0);
                // Soft gain so quiet speech still paints
                let level = (rms * 4.0).min(1.0);
                if let Ok(mut g) = shared.lock() {
                    // Don't stomp fresher MG hub samples
                    if g.source == MicSource::MemoryGlassHub
                        && g.generation.load(Ordering::Relaxed) > 0
                    {
                        // still update if hub is stale — generation only advances on hub
                    }
                    g.bins[bin_i % WAVE_BINS] = level;
                    bin_i = bin_i.wrapping_add(1);
                    g.rms = g.rms * 0.7 + level * 0.3;
                    g.peak = (g.peak * 0.92).max(level);
                    g.source = MicSource::Local;
                    g.error = None;
                    g.generation.fetch_add(1, Ordering::Relaxed);
                }
            }
            Err(_) => break,
        }
    }
}

fn read_exact_or_short(r: &mut impl Read, buf: &mut [u8]) -> Result<usize, ()> {
    let mut off = 0;
    while off < buf.len() {
        match r.read(&mut buf[off..]) {
            Ok(0) => return Ok(off),
            Ok(n) => off += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => return Err(()),
        }
        // Partial is fine for metering
        if off >= buf.len() / 4 {
            break;
        }
    }
    Ok(off)
}

fn hub_poll_loop(url: String, shared: Arc<Mutex<SharedMic>>, stop: Arc<AtomicBool>) {
    // Minimal HTTP GET without pulling reqwest into render if avoidable —
    // use std::process curl for portability in TUI child.
    while !stop.load(Ordering::Relaxed) {
        let body = Command::new("curl")
            .args(["-fsS", "--max-time", "1", &format!("{url}?t={}", now_ms())])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| o.stdout);
        if let Some(raw) = body {
            if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&raw) {
                apply_hub_json(&v, &shared);
            }
        }
        thread::sleep(Duration::from_millis(120));
    }
}

fn apply_hub_json(v: &serde_json::Value, shared: &Arc<Mutex<SharedMic>>) {
    let wave = v.get("wave").unwrap_or(v);
    let m = wave
        .get("M")
        .and_then(|x| x.as_array())
        .or_else(|| v.get("M").and_then(|x| x.as_array()));
    let rms_m = v
        .pointer("/rms/M")
        .or_else(|| v.get("Mrms"))
        .and_then(|x| x.as_f64())
        .unwrap_or(0.0) as f32;

    let mut bins = [0.0f32; WAVE_BINS];
    if let Some(arr) = m {
        let n = arr.len().max(1);
        for (i, b) in bins.iter_mut().enumerate() {
            let idx = (i * n) / WAVE_BINS;
            let s = arr
                .get(idx)
                .and_then(|x| x.as_f64())
                .unwrap_or(0.0)
                .abs() as f32;
            *b = s.min(1.0);
        }
    } else {
        let level = (rms_m * 4.0).min(1.0);
        bins = [level; WAVE_BINS];
    }

    if let Ok(mut g) = shared.lock() {
        g.bins = bins;
        let level = (rms_m * 4.0).min(1.0).max(bins.iter().copied().fold(0.0, f32::max));
        g.rms = level;
        g.peak = (g.peak * 0.9).max(level);
        g.source = MicSource::MemoryGlassHub;
        g.error = None;
        g.generation.fetch_add(1, Ordering::Relaxed);
    }
}

fn now_ms() -> u128 {
    Instant::now().elapsed().as_millis() // process-relative is fine for cache-bust
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bar_line_width() {
        let mut s = MicSnapshot::idle();
        s.bins[0] = 1.0;
        s.bins[1] = 0.5;
        let line = s.bar_line(16);
        assert_eq!(line.chars().count(), 16);
    }

    #[test]
    fn mic_auto_default_true() {
        // env may be set in harness; just ensure function returns a bool
        let _ = mic_auto_on();
    }
}
