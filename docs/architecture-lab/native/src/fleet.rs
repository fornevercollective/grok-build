//! Fleet integration: Panda terminal host + Lab bus (Mu-class product path).
//!
//! Native shell (tao/wry) orchestrates; Panda owns multi-pane PTYs; grok is the brain.
//! Patterns from GrokPtah (multi-PTY), agent-tui dual-home (~/.panda), our triple-shell bus.

use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const FLEET_SESSION: &str = "lab-fleet";

pub fn panda_home() -> PathBuf {
    if let Ok(p) = std::env::var("PANDA_HOME") {
        return PathBuf::from(p);
    }
    dirs_home().join(".panda")
}

fn dirs_home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Locate `panda` binary: PATH, then monorepo release/debug builds.
pub fn find_panda(repo: &Path) -> Option<PathBuf> {
    if let Some(p) = which("panda") {
        return Some(PathBuf::from(p));
    }
    let candidates = [
        repo.join("target/release/panda"),
        repo.join("target/debug/panda"),
        // native crate lives at docs/architecture-lab/native — repo is monorepo root
        repo.join("docs/architecture-lab/../../target/release/panda"),
    ];
    for c in candidates {
        if let Ok(c) = c.canonicalize() {
            if c.is_file() {
                return Some(c);
            }
        } else if c.is_file() {
            return Some(c);
        }
    }
    None
}

fn which(name: &str) -> Option<String> {
    Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Ensure ~/.panda layout + role profile snippets for α/β/γ.
pub fn ensure_panda_profiles(repo: &Path) -> Result<PathBuf, String> {
    let home = panda_home();
    let profiles = home.join("profiles");
    fs::create_dir_all(&profiles).map_err(|e| e.to_string())?;

    let plan = r#"# α Plan — read/explore (prefer no product writes)
export PANDA_ROLE=plan
export LAB_SHELL=plan
export GROK_MODEL="${GROK_MODEL:-grok-build}"
export PANDA_MODEL="${PANDA_MODEL:-grok-build}"
export PANDA_MODEL_LABEL="${PANDA_MODEL_LABEL:-Grok Build}"
export PANDA_MODEL_BACKEND="${PANDA_MODEL_BACKEND:-cloud}"
echo "α PLAN · role=$PANDA_ROLE · model=$PANDA_MODEL · repo=$LAB_REPO"
"#;
    let build = r#"# β Build — implement (worktree preferred)
export PANDA_ROLE=build
export LAB_SHELL=build
export GROK_MODEL="${GROK_MODEL:-grok-build}"
export PANDA_MODEL="${PANDA_MODEL:-grok-build}"
export PANDA_MODEL_LABEL="${PANDA_MODEL_LABEL:-Grok Build}"
export PANDA_MODEL_BACKEND="${PANDA_MODEL_BACKEND:-cloud}"
echo "β BUILD · role=$PANDA_ROLE · model=$PANDA_MODEL · repo=$LAB_REPO"
"#;
    let verify = r#"# γ Verify — sandbox tests / review
export PANDA_ROLE=verify
export LAB_SHELL=verify
export GROK_MODEL="${GROK_MODEL:-grok-build}"
export PANDA_MODEL="${PANDA_MODEL:-grok-build}"
export PANDA_MODEL_LABEL="${PANDA_MODEL_LABEL:-Grok Build}"
export PANDA_MODEL_BACKEND="${PANDA_MODEL_BACKEND:-cloud}"
echo "γ VERIFY · role=$PANDA_ROLE · model=$PANDA_MODEL · repo=$LAB_REPO"
"#;

    write_if_changed(profiles.join("plan.env"), plan)?;
    write_if_changed(profiles.join("build.env"), build)?;
    write_if_changed(profiles.join("verify.env"), verify)?;

    // Wrapper shell that sources a rotating role file based on pane index is future work;
    // fleet.env sets shared context + points at handoff file.
    let fleet_env = format!(
        r#"# Lab fleet shared env (sourced by panda panes when LAB_FLEET=1)
export LAB_REPO="{repo}"
export LAB_HANDOFF="${{PANDA_HOME:-$HOME/.panda}}/lab-handoff.json"
export LAB_FLEET=1
export GROK_MODEL="${{GROK_MODEL:-grok-build}}"
export PANDA_MODEL="${{PANDA_MODEL:-grok-build}}"
export PANDA_MODEL_LABEL="${{PANDA_MODEL_LABEL:-Grok Build}}"
export PANDA_MODEL_BACKEND="${{PANDA_MODEL_BACKEND:-cloud}}"
# Default role for new panes; operators can `source ~/.panda/profiles/{{plan,build,verify}}.env`
export PANDA_ROLE="${{PANDA_ROLE:-build}}"
if [ -f "$LAB_HANDOFF" ]; then
  echo "lab-handoff: $(head -c 200 "$LAB_HANDOFF" 2>/dev/null)"
fi
"#,
        repo = repo.display()
    );
    write_if_changed(home.join("fleet.env"), &fleet_env)?;

    // Login shell that loads fleet.env then interactive shell
    let fleet_sh = format!(
        r#"#!/bin/bash
# Panda fleet pane entry — Mu-class host + Lab bus context
export PANDA_HOME="${{PANDA_HOME:-$HOME/.panda}}"
# shellcheck disable=SC1090
[ -f "$PANDA_HOME/fleet.env" ] && . "$PANDA_HOME/fleet.env"
cd "${{LAB_REPO:-$HOME}}" 2>/dev/null || true
exec "${{SHELL:-/bin/zsh}}" -i
"#
    );
    let sh_path = home.join("fleet-shell.sh");
    fs::write(&sh_path, fleet_sh).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&sh_path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&sh_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(home)
}

fn write_if_changed(path: PathBuf, content: &str) -> Result<(), String> {
    if path.is_file() {
        if let Ok(existing) = fs::read_to_string(&path) {
            if existing == content {
                return Ok(());
            }
        }
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn handoff_path() -> PathBuf {
    panda_home().join("lab-handoff.json")
}

pub fn read_handoff() -> Value {
    let p = handoff_path();
    if let Ok(s) = fs::read_to_string(p) {
        if let Ok(v) = serde_json::from_str(&s) {
            return v;
        }
    }
    json!({
        "ok": true,
        "queue": [],
        "active": null,
        "shells": {
            "plan": { "id": "plan", "label": "α Plan", "status": "idle" },
            "build": { "id": "build", "label": "β Build", "status": "idle" },
            "verify": { "id": "verify", "label": "γ Verify", "status": "idle" },
        }
    })
}

pub fn write_handoff(v: &Value) -> Result<(), String> {
    let home = panda_home();
    fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    let p = handoff_path();
    let pretty = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    fs::write(p, pretty + "\n").map_err(|e| e.to_string())
}

pub fn handoff(from: &str, to: &str, summary: &str) -> Result<Value, String> {
    let from = from.trim().to_ascii_lowercase();
    let to = to.trim().to_ascii_lowercase();
    if !matches!(from.as_str(), "plan" | "build" | "verify")
        || !matches!(to.as_str(), "plan" | "build" | "verify")
    {
        return Err("from/to must be plan|build|verify".into());
    }
    if from == to {
        return Err("from and to must differ".into());
    }
    let mut state = read_handoff();
    let queue = state
        .get_mut("queue")
        .and_then(|q| q.as_array_mut())
        .cloned()
        .unwrap_or_default();
    let mut queue = queue;
    let loop_n = queue
        .last()
        .and_then(|a| a.get("loop"))
        .and_then(|l| l.as_u64())
        .unwrap_or(0);
    let loop_n = if matches!(
        (from.as_str(), to.as_str()),
        ("verify", "build") | ("verify", "plan") | ("build", "plan")
    ) {
        loop_n + 1
    } else {
        loop_n
    };
    if loop_n > 5 {
        return Err("max handoff loop 5 — revise plan or reset".into());
    }
    let id = format!(
        "act-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        queue.len() + 1
    );
    let activity = json!({
        "id": id,
        "from": from,
        "to": to,
        "summary": summary,
        "loop": loop_n,
        "status": "pending",
        "created_at": chrono_like_now(),
    });
    queue.push(activity.clone());
    state["queue"] = json!(queue);
    state["active"] = activity.clone();
    if let Some(shells) = state.get_mut("shells").and_then(|s| s.as_object_mut()) {
        if let Some(f) = shells.get_mut(&from) {
            f["status"] = json!("done");
            f["last_activity"] = activity["id"].clone();
        }
        if let Some(t) = shells.get_mut(&to) {
            t["status"] = json!("running");
            t["last_activity"] = activity["id"].clone();
        }
    }
    write_handoff(&state)?;
    Ok(json!({ "ok": true, "activity": activity, "state": state, "path": handoff_path().display().to_string() }))
}

pub fn reset_handoff() -> Result<Value, String> {
    let state = json!({
        "ok": true,
        "queue": [],
        "active": null,
        "shells": {
            "plan": { "id": "plan", "label": "α Plan", "status": "idle" },
            "build": { "id": "build", "label": "β Build", "status": "idle" },
            "verify": { "id": "verify", "label": "γ Verify", "status": "idle" },
        },
        "updated_at": chrono_like_now(),
    });
    write_handoff(&state)?;
    Ok(state)
}

fn chrono_like_now() -> String {
    // RFC3339-ish without chrono dep
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

/// Open Panda fleet: 3-pane multi-terminal with Lab/Mu product context.
pub fn open_panda_fleet(repo: &Path, splits: u8) -> Value {
    let splits = splits.clamp(1, 4);
    let Some(panda) = find_panda(repo) else {
        return json!({
            "ok": false,
            "launched": false,
            "message": "panda binary not found",
            "mitigation": "cargo build -p panda-shell --release  (or panda install)",
            "searched": ["PATH", "target/release/panda", "target/debug/panda"],
        });
    };

    let home = match ensure_panda_profiles(repo) {
        Ok(h) => h,
        Err(e) => {
            return json!({ "ok": false, "launched": false, "message": e });
        }
    };

    // Seed handoff so Panda panes can cat ~/.panda/lab-handoff.json
    let _ = write_handoff(&json!({
        "ok": true,
        "queue": [],
        "active": null,
        "session": FLEET_SESSION,
        "shells": {
            "plan": { "id": "plan", "label": "α Plan", "status": "idle", "role": "plan" },
            "build": { "id": "build", "label": "β Build", "status": "idle", "role": "build" },
            "verify": { "id": "verify", "label": "γ Verify", "status": "idle", "role": "verify" },
        },
        "hint": "source ~/.panda/profiles/{plan,build,verify}.env in a pane · handoff via Lab Ship or POST /api/shells/handoff",
        "updated_at": chrono_like_now(),
    }));

    let fleet_shell = home.join("fleet-shell.sh");
    let panda_s = panda.display().to_string();
    let cwd = repo.display().to_string();
    let shell_s = fleet_shell.display().to_string();

    // Interactive TUI needs a real terminal — macOS Terminal.app; else spawn and hope.
    #[cfg(target_os = "macos")]
    {
        let cmd = format!(
            "export PANDA_HOME={home:?}; cd {cwd:?} && exec {panda:?} new {session} --splits {splits} -C {cwd:?} -s {shell:?}",
            home = home.display().to_string(),
            cwd = cwd,
            panda = panda_s,
            session = FLEET_SESSION,
            splits = splits,
            shell = shell_s,
        );
        let esc = cmd.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!(
            r#"tell application "Terminal"
              activate
              do script "{esc}"
              set custom title of front window to "Panda · lab-fleet αβγ"
            end tell"#
        );
        match Command::new("osascript").args(["-e", &script]).spawn() {
            Ok(_) => {
                return json!({
                    "ok": true,
                    "launched": true,
                    "via": "Terminal.app",
                    "panda": panda_s,
                    "session": FLEET_SESSION,
                    "splits": splits,
                    "cwd": cwd,
                    "shell": shell_s,
                    "handoff": handoff_path().display().to_string(),
                    "profiles": home.join("profiles").display().to_string(),
                    "message": "Panda lab-fleet opening — 3 panes · fleet-shell · handoff file ready",
                    "fleet": true,
                    "native": true,
                });
            }
            Err(e) => {
                return json!({
                    "ok": false,
                    "launched": false,
                    "message": format!("osascript failed: {e}"),
                    "panda": panda_s,
                });
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let status = Command::new(&panda)
            .args([
                "new",
                FLEET_SESSION,
                "--splits",
                &splits.to_string(),
                "-C",
                &cwd,
                "-s",
                &shell_s,
            ])
            .env("PANDA_HOME", &home)
            .spawn();
        match status {
            Ok(_) => json!({
                "ok": true,
                "launched": true,
                "via": "spawn",
                "panda": panda_s,
                "session": FLEET_SESSION,
                "splits": splits,
                "handoff": handoff_path().display().to_string(),
                "fleet": true,
                "native": true,
            }),
            Err(e) => json!({
                "ok": false,
                "launched": false,
                "message": e.to_string(),
                "panda": panda_s,
            }),
        }
    }
}

pub fn panda_status(repo: &Path) -> Value {
    let panda = find_panda(repo);
    let handoff = read_handoff();
    let home = panda_home();
    json!({
        "ok": true,
        "panda": panda.as_ref().map(|p| p.display().to_string()),
        "panda_home": home.display().to_string(),
        "handoff_path": handoff_path().display().to_string(),
        "handoff": handoff,
        "session": FLEET_SESSION,
        "profiles": ["plan", "build", "verify"],
        "native": true,
        "fleet": true,
    })
}
