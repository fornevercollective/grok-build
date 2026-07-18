use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    let epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let iso = Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("epoch-{epoch}"));

    println!("cargo:rustc-env=MG_BUILD_EPOCH={epoch}");
    println!("cargo:rustc-env=MG_BUILD_ISO={iso}");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/main.rs");
    println!("cargo:rerun-if-changed=icons/AppIcon.icns");
    println!("cargo:rerun-if-changed=icons/app-icon-1024.png");
    println!("cargo:rerun-if-changed=hotpipe/live.js");

    if let Ok(out) = env::var("OUT_DIR") {
        let stamp = PathBuf::from(&out).join("MG_BUILD_STAMP");
        let _ = fs::write(
            &stamp,
            format!(
                "epoch={epoch}\niso={iso}\npkg={}\n",
                env!("CARGO_PKG_VERSION")
            ),
        );
        // Also mirror to crate root for humans / install scripts
        if let Ok(manifest) = env::var("CARGO_MANIFEST_DIR") {
            let _ = fs::write(
                PathBuf::from(manifest).join("BUILD_STAMP"),
                format!(
                    "epoch={epoch}\niso={iso}\npkg={}\n",
                    env!("CARGO_PKG_VERSION")
                ),
            );
        }
    }
}
