//! Compute backend detection — CPU, Apple Metal, and generic GPU hints.
//!
//! Panda surfaces these so the status rail can show which accelerators are
//! available. Terminal cell compositing stays CPU-side (ratatui); Metal is
//! reported for host capability and future GPU-offloaded effects.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendKind {
    Cpu,
    Metal,
    Gpu,
}

impl fmt::Display for BackendKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Cpu => write!(f, "CPU"),
            Self::Metal => write!(f, "Metal"),
            Self::Gpu => write!(f, "GPU"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct BackendInfo {
    pub kind: BackendKind,
    pub name: String,
    pub detail: String,
    pub available: bool,
}

#[derive(Debug, Clone)]
pub struct AccelReport {
    pub backends: Vec<BackendInfo>,
    pub primary: BackendKind,
}

impl AccelReport {
    pub fn summary_line(&self) -> String {
        let live: Vec<_> = self
            .backends
            .iter()
            .filter(|b| b.available)
            .map(|b| b.kind.to_string())
            .collect();
        if live.is_empty() {
            "CPU".into()
        } else {
            live.join(" · ")
        }
    }
}

pub fn detect() -> AccelReport {
    let mut backends = Vec::new();

    let cpus = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let arch = std::env::consts::ARCH;
    backends.push(BackendInfo {
        kind: BackendKind::Cpu,
        name: format!("{arch} ×{cpus}"),
        detail: format!("{cpus} logical cores ({arch})"),
        available: true,
    });

    #[cfg(target_os = "macos")]
    {
        let metal = detect_metal();
        backends.push(metal);
    }

    #[cfg(not(target_os = "macos"))]
    {
        backends.push(BackendInfo {
            kind: BackendKind::Metal,
            name: "Metal".into(),
            detail: "macOS only".into(),
            available: false,
        });
    }

    // Generic GPU hint from env / common markers (no heavy deps).
    let gpu = detect_gpu_hint();
    backends.push(gpu);

    let primary = if backends
        .iter()
        .any(|b| b.kind == BackendKind::Metal && b.available)
    {
        BackendKind::Metal
    } else if backends
        .iter()
        .any(|b| b.kind == BackendKind::Gpu && b.available)
    {
        BackendKind::Gpu
    } else {
        BackendKind::Cpu
    };

    AccelReport { backends, primary }
}

#[cfg(target_os = "macos")]
fn detect_metal() -> BackendInfo {
    // On modern macOS the Metal dylib often lives only in the dyld shared cache,
    // so a plain file exists()-check on Metal.framework/Metal is unreliable.
    // Treat macOS as Metal-capable when the framework bundle is present OR the
    // host reports a GPU via system_profiler / sysctl.
    let bundle = std::path::Path::new("/System/Library/Frameworks/Metal.framework");
    let bundle_ok = bundle.exists();
    let gpu_name = std::env::var("PANDA_METAL_NAME")
        .ok()
        .or_else(read_gpu_name)
        .or_else(|| read_sysctl_string("machdep.cpu.brand_string"));
    // macOS 10.11+ ships Metal; if we are compiling for macos we assume yes
    // unless the user forces off via PANDA_NO_METAL=1.
    let forced_off = std::env::var_os("PANDA_NO_METAL").is_some();
    let available = !forced_off && (bundle_ok || gpu_name.is_some() || cfg!(target_os = "macos"));
    let detail = match (&gpu_name, available) {
        (Some(n), true) => format!("ready · {n}"),
        (None, true) => "ready · Apple Metal".into(),
        (_, false) => "disabled".into(),
    };
    BackendInfo {
        kind: BackendKind::Metal,
        name: "Metal".into(),
        detail,
        available,
    }
}

#[cfg(target_os = "macos")]
fn read_sysctl_string(name: &str) -> Option<String> {
    use std::process::Command;
    let out = Command::new("sysctl").args(["-n", name]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

#[cfg(target_os = "macos")]
fn read_gpu_name() -> Option<String> {
    use std::process::Command;
    // Cheap one-shot; fails silently in restricted environments.
    let out = Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-detailLevel", "mini"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("Chipset Model:") {
            let name = rest.trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    None
}

fn detect_gpu_hint() -> BackendInfo {
    // Lightweight, non-invasive: respect explicit override, else OS-level hints.
    if let Ok(name) = std::env::var("PANDA_GPU") {
        return BackendInfo {
            kind: BackendKind::Gpu,
            name: name.clone(),
            detail: "from PANDA_GPU".into(),
            available: true,
        };
    }

    #[cfg(target_os = "macos")]
    {
        let metal = detect_metal();
        return BackendInfo {
            kind: BackendKind::Gpu,
            name: metal
                .detail
                .strip_prefix("ready · ")
                .unwrap_or("Apple GPU")
                .to_string(),
            detail: if metal.available {
                "via Metal".into()
            } else {
                "Metal unavailable".into()
            },
            available: metal.available,
        };
    }

    #[cfg(not(target_os = "macos"))]
    {
        BackendInfo {
            kind: BackendKind::Gpu,
            name: "GPU".into(),
            detail: "set PANDA_GPU to label your device".into(),
            available: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn always_has_cpu() {
        let r = detect();
        assert!(r.backends.iter().any(|b| b.kind == BackendKind::Cpu && b.available));
        assert!(!r.summary_line().is_empty());
    }
}
