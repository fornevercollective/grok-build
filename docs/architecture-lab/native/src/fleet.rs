//! Fleet integration: Panda terminal host + Lab bus (Mu-class product path).
//!
//! Native shell (tao/wry) orchestrates; Panda owns multi-pane PTYs; grok is the brain.
//! Fat handoff packs ride `~/.panda/lab-handoff.json` + `~/.panda/packs/` so context
//! flows: prompt → iterate → α/β/γ handoff → Panda panes → back to Lab.

use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const FLEET_SESSION: &str = "lab-fleet";
const MAX_LOOP: u64 = 5;
const MAX_ITERATE_CHARS: usize = 16_000;
const MAX_SUMMARY_CHARS: usize = 2_000;
const MAX_PACK_FILES: usize = 40;

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

fn chrono_like_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}…[truncated {} chars]", &s[..max], s.len())
    }
}

fn empty_shells() -> Value {
    json!({
        "plan": { "id": "plan", "label": "α Plan", "status": "idle", "role": "plan" },
        "build": { "id": "build", "label": "β Build", "status": "idle", "role": "build" },
        "verify": { "id": "verify", "label": "γ Verify", "status": "idle", "role": "verify" },
    })
}

fn default_state() -> Value {
    json!({
        "ok": true,
        "version": "lab.handoff.v2",
        "queue": [],
        "active": null,
        "last_pack": null,
        "last_iterate": null,
        "shells": empty_shells(),
        "max_loop": MAX_LOOP,
        "updated_at": chrono_like_now(),
    })
}

// ── Profiles + auto role shells ──────────────────────────────────────

/// Ensure ~/.panda layout + role profiles + per-pane auto-role shells.
pub fn ensure_panda_profiles(repo: &Path) -> Result<PathBuf, String> {
    let home = panda_home();
    let profiles = home.join("profiles");
    let packs = home.join("packs");
    fs::create_dir_all(&profiles).map_err(|e| e.to_string())?;
    fs::create_dir_all(&packs).map_err(|e| e.to_string())?;

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

    let fleet_env = format!(
        r#"# Lab fleet shared env (sourced by panda / Terminal panes when LAB_FLEET=1)
export LAB_REPO="{repo}"
export LAB_HANDOFF="${{PANDA_HOME:-$HOME/.panda}}/lab-handoff.json"
export LAB_PACK_DIR="${{PANDA_HOME:-$HOME/.panda}}/packs"
export LAB_LAST_PACK="${{LAB_PACK_DIR}}/last.json"
export LAB_FLEET=1
export GROK_MODEL="${{GROK_MODEL:-grok-build}}"
export PANDA_MODEL="${{PANDA_MODEL:-grok-build}}"
export PANDA_MODEL_LABEL="${{PANDA_MODEL_LABEL:-Grok Build}}"
export PANDA_MODEL_BACKEND="${{PANDA_MODEL_BACKEND:-cloud}}"
export PANDA_ROLE="${{PANDA_ROLE:-build}}"
lab_show_pack() {{
  local p="${{LAB_LAST_PACK:-}}"
  if [ -f "$p" ]; then
    echo "── fat pack (last) ──"
    head -c 1200 "$p" 2>/dev/null; echo
    echo "── full: cat $p · jq . $p ──"
  elif [ -f "$LAB_HANDOFF" ]; then
    echo "── handoff ──"
    head -c 400 "$LAB_HANDOFF" 2>/dev/null; echo
  fi
}}
"#,
        repo = repo.display()
    );
    write_if_changed(home.join("fleet.env"), &fleet_env)?;

    // Per-role pane entrypoints — auto-source profile + show fat pack (no manual source).
    for role in ["plan", "build", "verify"] {
        let glyph = match role {
            "plan" => "α PLAN",
            "build" => "β BUILD",
            "verify" => "γ VERIFY",
            _ => role,
        };
        let pane_sh = format!(
            r#"#!/bin/bash
# Auto role shell for {role} — Lab fleet pane entry
export PANDA_HOME="${{PANDA_HOME:-$HOME/.panda}}"
export LAB_PANE_ROLE="{role}"
export PANDA_ROLE="{role}"
export LAB_SHELL="{role}"
# shellcheck disable=SC1090
[ -f "$PANDA_HOME/fleet.env" ] && . "$PANDA_HOME/fleet.env"
[ -f "$PANDA_HOME/profiles/{role}.env" ] && . "$PANDA_HOME/profiles/{role}.env"
cd "${{LAB_REPO:-$HOME}}" 2>/dev/null || true
echo "════════════════════════════════════════"
echo "  {glyph} · auto-role pane"
echo "  repo=$LAB_REPO"
echo "  handoff=$LAB_HANDOFF"
echo "════════════════════════════════════════"
type lab_show_pack >/dev/null 2>&1 && lab_show_pack
echo "Tips: grok · cargo test · POST handoff via Lab Agent / Ship"
echo "      jq . \"$LAB_LAST_PACK\" 2>/dev/null | head"
echo
exec "${{SHELL:-/bin/zsh}}" -i
"#,
            role = role,
            glyph = glyph,
        );
        let path = home.join(format!("pane-{role}.sh"));
        fs::write(&path, pane_sh).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&path).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&path, perms).map_err(|e| e.to_string())?;
        }
    }

    // Generic fleet shell: auto-pick role from LAB_PANE_ROLE or PANDA_PANE_INDEX (0/1/2).
    let fleet_sh = r#"#!/bin/bash
# Panda fleet pane entry — auto role by index when multi-pane
export PANDA_HOME="${PANDA_HOME:-$HOME/.panda}"
# shellcheck disable=SC1090
[ -f "$PANDA_HOME/fleet.env" ] && . "$PANDA_HOME/fleet.env"

# Resolve role: explicit > pane index > default build
ROLE="${LAB_PANE_ROLE:-${PANDA_ROLE:-}}"
if [ -z "$ROLE" ] || [ "$ROLE" = "build" ]; then
  # Prefer index when set by Lab launcher (0=plan 1=build 2=verify)
  IDX="${LAB_PANE_INDEX:-${PANDA_PANE_INDEX:-}}"
  case "$IDX" in
    0|plan) ROLE=plan ;;
    1|build) ROLE=build ;;
    2|verify) ROLE=verify ;;
  esac
fi
ROLE="${ROLE:-build}"
export PANDA_ROLE="$ROLE"
export LAB_SHELL="$ROLE"
export LAB_PANE_ROLE="$ROLE"
[ -f "$PANDA_HOME/profiles/$ROLE.env" ] && . "$PANDA_HOME/profiles/$ROLE.env"
cd "${LAB_REPO:-$HOME}" 2>/dev/null || true
echo "── fleet pane · role=$ROLE · $LAB_REPO ──"
type lab_show_pack >/dev/null 2>&1 && lab_show_pack
exec "${SHELL:-/bin/zsh}" -i
"#;
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

// ── Handoff state + fat packs ────────────────────────────────────────

pub fn handoff_path() -> PathBuf {
    panda_home().join("lab-handoff.json")
}

pub fn packs_dir() -> PathBuf {
    panda_home().join("packs")
}

pub fn last_pack_path() -> PathBuf {
    packs_dir().join("last.json")
}

pub fn read_handoff() -> Value {
    let p = handoff_path();
    if let Ok(s) = fs::read_to_string(p) {
        if let Ok(mut v) = serde_json::from_str::<Value>(&s) {
            // migrate thin v1 → v2 fields
            if v.get("version").is_none() {
                v["version"] = json!("lab.handoff.v2");
            }
            if v.get("last_pack").is_none() {
                v["last_pack"] = Value::Null;
            }
            if v.get("max_loop").is_none() {
                v["max_loop"] = json!(MAX_LOOP);
            }
            return v;
        }
    }
    default_state()
}

pub fn write_handoff(v: &Value) -> Result<(), String> {
    let home = panda_home();
    fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    let p = handoff_path();
    let pretty = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    fs::write(p, pretty + "\n").map_err(|e| e.to_string())
}

/// Normalize optional pack fields into a stable fat pack object.
pub fn build_pack(
    summary: &str,
    prompt: Option<&str>,
    iterate_text: Option<&str>,
    role: Option<&str>,
    files: Option<&Value>,
    tests: Option<&Value>,
    tool_trace: Option<&Value>,
    messages: Option<&Value>,
    extra: Option<&Value>,
) -> Value {
    let mut pack = Map::new();
    pack.insert("version".into(), json!("lab.pack.v1"));
    pack.insert("created_at".into(), json!(chrono_like_now()));
    pack.insert(
        "summary".into(),
        json!(truncate(summary, MAX_SUMMARY_CHARS)),
    );
    if let Some(p) = prompt.filter(|s| !s.is_empty()) {
        pack.insert("prompt".into(), json!(truncate(p, MAX_ITERATE_CHARS)));
    }
    if let Some(t) = iterate_text.filter(|s| !s.is_empty()) {
        pack.insert(
            "iterate_text".into(),
            json!(truncate(t, MAX_ITERATE_CHARS)),
        );
    }
    if let Some(r) = role.filter(|s| !s.is_empty()) {
        pack.insert("role".into(), json!(r));
    }
    if let Some(Value::Array(arr)) = files {
        let clipped: Vec<Value> = arr.iter().take(MAX_PACK_FILES).cloned().collect();
        pack.insert("files".into(), json!(clipped));
    }
    if let Some(Value::Array(arr)) = tests {
        let clipped: Vec<Value> = arr.iter().take(MAX_PACK_FILES).cloned().collect();
        pack.insert("tests".into(), json!(clipped));
    }
    if let Some(Value::Array(arr)) = tool_trace {
        let clipped: Vec<Value> = arr.iter().take(60).cloned().collect();
        pack.insert("tool_trace".into(), json!(clipped));
    }
    if let Some(Value::Array(arr)) = messages {
        let clipped: Vec<Value> = arr.iter().rev().take(40).cloned().collect();
        pack.insert("messages".into(), json!(clipped));
    }
    if let Some(Value::Object(m)) = extra {
        for (k, v) in m {
            if !pack.contains_key(k) {
                pack.insert(k.clone(), v.clone());
            }
        }
    }
    // Strip accidental secrets keys
    for bad in ["api_key", "apiKey", "token", "authorization", "password", "secret"] {
        pack.remove(bad);
    }
    Value::Object(pack)
}

pub fn write_pack_file(pack: &Value, act_id: Option<&str>) -> Result<PathBuf, String> {
    let dir = packs_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let last = last_pack_path();
    let pretty = serde_json::to_string_pretty(pack).map_err(|e| e.to_string())?;
    fs::write(&last, pretty.clone() + "\n").map_err(|e| e.to_string())?;
    if let Some(id) = act_id {
        let named = dir.join(format!("{id}.json"));
        let _ = fs::write(&named, pretty + "\n");
        return Ok(named);
    }
    Ok(last)
}

pub fn read_last_pack() -> Value {
    let p = last_pack_path();
    if let Ok(s) = fs::read_to_string(p) {
        if let Ok(v) = serde_json::from_str(&s) {
            return v;
        }
    }
    // fall back to handoff.last_pack
    let state = read_handoff();
    state
        .get("last_pack")
        .cloned()
        .unwrap_or(Value::Null)
}

/// Record last iterate into state + last pack (called from /api/agent/iterate).
pub fn record_iterate(prompt: &str, role: &str, text: &str, via: &str) -> Result<Value, String> {
    let pack = build_pack(
        &format!("iterate · {role}"),
        Some(prompt),
        Some(text),
        Some(role),
        None,
        None,
        None,
        None,
        Some(&json!({ "via": via, "source": "agent_iterate" })),
    );
    let path = write_pack_file(&pack, None)?;
    let mut state = read_handoff();
    state["last_iterate"] = json!({
        "prompt": truncate(prompt, 2000),
        "role": role,
        "text": truncate(text, MAX_ITERATE_CHARS),
        "via": via,
        "at": chrono_like_now(),
    });
    state["last_pack"] = pack.clone();
    state["updated_at"] = json!(chrono_like_now());
    write_handoff(&state)?;
    Ok(json!({
        "ok": true,
        "pack_path": path.display().to_string(),
        "pack": pack,
    }))
}

pub fn handoff(from: &str, to: &str, summary: &str) -> Result<Value, String> {
    handoff_with_pack(from, to, summary, None)
}

pub fn handoff_with_pack(
    from: &str,
    to: &str,
    summary: &str,
    pack: Option<Value>,
) -> Result<Value, String> {
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
    let mut queue = state
        .get("queue")
        .and_then(|q| q.as_array())
        .cloned()
        .unwrap_or_default();
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
    let max_loop = state
        .get("max_loop")
        .and_then(|v| v.as_u64())
        .unwrap_or(MAX_LOOP);
    if loop_n > max_loop {
        return Err(format!(
            "max handoff loop {max_loop} — revise plan or POST /api/shells/reset"
        ));
    }
    let id = format!(
        "act-{}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        queue.len() + 1
    );

    // Merge pack: explicit > last_pack > last_iterate derived
    let fat = if let Some(p) = pack {
        if p.is_object() {
            let mut merged =
                build_pack(summary, None, None, Some(&to), None, None, None, None, None);
            if let (Some(base), Some(over)) = (merged.as_object_mut(), p.as_object()) {
                for (k, v) in over {
                    base.insert(k.clone(), v.clone());
                }
            }
            merged["summary"] = json!(truncate(summary, MAX_SUMMARY_CHARS));
            merged["to"] = json!(&to);
            merged["from"] = json!(&from);
            merged
        } else {
            build_pack(summary, None, None, Some(&to), None, None, None, None, None)
        }
    } else if let Some(lp) = state.get("last_pack").filter(|v| v.is_object()) {
        let mut m = lp.clone();
        m["summary"] = json!(truncate(summary, MAX_SUMMARY_CHARS));
        m["from"] = json!(&from);
        m["to"] = json!(&to);
        m["handed_at"] = json!(chrono_like_now());
        m
    } else if let Some(li) = state.get("last_iterate").filter(|v| v.is_object()) {
        build_pack(
            summary,
            li.get("prompt").and_then(|v| v.as_str()),
            li.get("text").and_then(|v| v.as_str()),
            Some(&to),
            None,
            None,
            None,
            None,
            Some(&json!({ "from": from, "source": "last_iterate" })),
        )
    } else {
        build_pack(
            summary,
            None,
            None,
            Some(&to),
            None,
            None,
            None,
            None,
            Some(&json!({ "from": from })),
        )
    };

    let pack_path = write_pack_file(&fat, Some(&id))?;
    let activity = json!({
        "id": id,
        "from": from,
        "to": to,
        "summary": truncate(summary, MAX_SUMMARY_CHARS),
        "loop": loop_n,
        "status": "pending",
        "created_at": chrono_like_now(),
        "pack_path": pack_path.display().to_string(),
        "pack": {
            "summary": fat.get("summary").cloned().unwrap_or(json!("")),
            "role": fat.get("role").cloned().unwrap_or(json!(to)),
            "has_iterate": fat.get("iterate_text").is_some(),
            "has_prompt": fat.get("prompt").is_some(),
            "files_n": fat.get("files").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0),
            "tests_n": fat.get("tests").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0),
        },
    });
    queue.push(activity.clone());
    state["queue"] = json!(queue);
    state["active"] = activity.clone();
    state["last_pack"] = fat;
    state["updated_at"] = json!(chrono_like_now());
    if let Some(shells) = state.get_mut("shells").and_then(|s| s.as_object_mut()) {
        if let Some(f) = shells.get_mut(&from) {
            f["status"] = json!("done");
            f["last_activity"] = activity["id"].clone();
        }
        if let Some(t) = shells.get_mut(&to) {
            t["status"] = json!("running");
            t["last_activity"] = activity["id"].clone();
            t["pack_path"] = json!(pack_path.display().to_string());
        }
    }
    write_handoff(&state)?;
    Ok(json!({
        "ok": true,
        "activity": activity,
        "state": state,
        "path": handoff_path().display().to_string(),
        "pack_path": pack_path.display().to_string(),
        "fat": true,
    }))
}

pub fn reset_handoff() -> Result<Value, String> {
    let state = default_state();
    write_handoff(&state)?;
    Ok(state)
}

// ── Open fleet (auto-role panes) ─────────────────────────────────────

/// Open Panda fleet: 3 role Terminal panes + optional multi-pane Panda.
/// Preserves existing handoff queue / last_pack (does not wipe context).
pub fn open_panda_fleet(repo: &Path, splits: u8) -> Value {
    let splits = splits.clamp(1, 4);
    let Some(panda) = find_panda(repo) else {
        // Still open role Terminals without panda binary
        return open_role_terminals(repo, None, splits);
    };

    let home = match ensure_panda_profiles(repo) {
        Ok(h) => h,
        Err(e) => {
            return json!({ "ok": false, "launched": false, "message": e });
        }
    };

    seed_handoff_session(repo);

    open_role_terminals(repo, Some((&panda, &home, splits)), splits)
}

fn seed_handoff_session(repo: &Path) {
    let mut state = read_handoff();
    // Keep queue/last_pack; just stamp session + repo
    state["session"] = json!(FLEET_SESSION);
    state["repo"] = json!(repo.display().to_string());
    state["hint"] = json!(
        "panes auto-source ~/.panda/profiles/{plan,build,verify}.env · fat pack: ~/.panda/packs/last.json"
    );
    state["updated_at"] = json!(chrono_like_now());
    if state.get("shells").is_none() {
        state["shells"] = empty_shells();
    }
    if state.get("queue").is_none() {
        state["queue"] = json!([]);
    }
    let _ = write_handoff(&state);
}

fn open_role_terminals(
    repo: &Path,
    panda: Option<(&Path, &Path, u8)>,
    splits: u8,
) -> Value {
    let home = match ensure_panda_profiles(repo) {
        Ok(h) => h,
        Err(e) => return json!({ "ok": false, "launched": false, "message": e }),
    };
    let cwd = repo.display().to_string();
    let home_s = home.display().to_string();
    let pack_hint = last_pack_path().display().to_string();

    #[cfg(target_os = "macos")]
    {
        let roles = [
            ("plan", "α Plan · Lab fleet", 24i32, 48i32),
            ("build", "β Build · Lab fleet", 24i32, 320i32),
            ("verify", "γ Verify · Lab fleet", 24i32, 590i32),
        ];
        let mut lines = String::from("tell application \"Terminal\"\n  activate\n");
        for (i, (role, title, x, y)) in roles.iter().enumerate() {
            let pane = home.join(format!("pane-{role}.sh"));
            let cmd = format!(
                "export PANDA_HOME={home:?}; export LAB_PANE_ROLE={role}; export LAB_PANE_INDEX={i}; \
                 export PANDA_ROLE={role}; exec {pane:?}",
                home = home_s,
                role = role,
                i = i,
                pane = pane.display().to_string(),
            );
            let esc = cmd
                .replace('\\', "\\\\")
                .replace('"', "\\\"")
                .replace('\n', "; ");
            let title_esc = title.replace('"', "\\\"");
            lines.push_str(&format!(
                "  set w to do script \"{esc}\"\n  try\n    set custom title of w to \"{title_esc}\"\n    set bounds of window 1 to {{{x}, {y}, {x2}, {y2}}}\n  end try\n  delay 0.12\n",
                esc = esc,
                title_esc = title_esc,
                x = x,
                y = y,
                x2 = x + 540,
                y2 = y + 270,
            ));
        }
        if let Some((panda_bin, _h, sp)) = panda {
            if sp >= 2 {
                let fleet_shell = home.join("fleet-shell.sh");
                let panda_cmd = format!(
                    "export PANDA_HOME={home:?}; export LAB_FLEET=1; cd {cwd:?} && exec {panda:?} new {session} --splits {splits} -C {cwd:?} -s {shell:?}",
                    home = home_s,
                    cwd = cwd,
                    panda = panda_bin.display().to_string(),
                    session = FLEET_SESSION,
                    splits = sp,
                    shell = fleet_shell.display().to_string(),
                );
                let pesc = panda_cmd.replace('\\', "\\\\").replace('"', "\\\"");
                lines.push_str(&format!(
                    "  do script \"{pesc}\"\n  try\n    set custom title of front window to \"Panda · lab-fleet multi-pane\"\n  end try\n"
                ));
            }
        }
        lines.push_str("end tell\n");
        match Command::new("osascript").args(["-e", &lines]).spawn() {
            Ok(_) => {
                return json!({
                    "ok": true,
                    "launched": true,
                    "via": "Terminal.app",
                    "mode": "auto-role-triple",
                    "panda": panda.map(|(p, _, _)| p.display().to_string()),
                    "session": FLEET_SESSION,
                    "splits": splits,
                    "roles": ["plan", "build", "verify"],
                    "auto_role": true,
                    "cwd": cwd,
                    "handoff": handoff_path().display().to_string(),
                    "last_pack": pack_hint,
                    "profiles": home.join("profiles").display().to_string(),
                    "message": "α Plan · β Build · γ Verify auto-role panes (+ Panda multi if available)",
                    "fleet": true,
                    "native": true,
                    "fat_pack": read_last_pack().is_object(),
                });
            }
            Err(e) => {
                return json!({
                    "ok": false,
                    "launched": false,
                    "message": format!("osascript failed: {e}"),
                });
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some((panda_bin, _, sp)) = panda {
            let fleet_shell = home.join("fleet-shell.sh");
            let status = Command::new(panda_bin)
                .args([
                    "new",
                    FLEET_SESSION,
                    "--splits",
                    &sp.to_string(),
                    "-C",
                    &cwd,
                    "-s",
                    &fleet_shell.display().to_string(),
                ])
                .env("PANDA_HOME", &home)
                .spawn();
            match status {
                Ok(_) => json!({
                    "ok": true,
                    "launched": true,
                    "via": "spawn",
                    "panda": panda_bin.display().to_string(),
                    "session": FLEET_SESSION,
                    "splits": sp,
                    "handoff": handoff_path().display().to_string(),
                    "last_pack": pack_hint,
                    "fleet": true,
                    "native": true,
                    "auto_role": true,
                }),
                Err(e) => json!({
                    "ok": false,
                    "launched": false,
                    "message": e.to_string(),
                }),
            }
        } else {
            json!({
                "ok": false,
                "launched": false,
                "message": "panda binary not found",
                "mitigation": "cargo build -p panda-shell --release",
            })
        }
    }
}

pub fn panda_status(repo: &Path) -> Value {
    let panda = find_panda(repo);
    let handoff = read_handoff();
    let home = panda_home();
    let pack = read_last_pack();
    json!({
        "ok": true,
        "panda": panda.as_ref().map(|p| p.display().to_string()),
        "panda_home": home.display().to_string(),
        "handoff_path": handoff_path().display().to_string(),
        "handoff": handoff,
        "last_pack": pack,
        "last_pack_path": last_pack_path().display().to_string(),
        "session": FLEET_SESSION,
        "profiles": ["plan", "build", "verify"],
        "auto_role": true,
        "fat_pack": pack.is_object(),
        "native": true,
        "fleet": true,
    })
}

/// Full rocket chain: optional iterate → fat handoff → open Panda fleet.
///
/// Default hop: plan → build (Cursor-agent start). Override with from/to.
pub fn chain_loop(
    repo: &Path,
    prompt: &str,
    role: &str,
    from: &str,
    to: &str,
    iterate_text: Option<&str>,
    open_fleet: bool,
    files: Option<&Value>,
    tests: Option<&Value>,
) -> Value {
    let summary = if prompt.is_empty() {
        format!("chain {from}→{to}")
    } else {
        truncate(prompt, 400)
    };

    let pack = build_pack(
        &summary,
        if prompt.is_empty() { None } else { Some(prompt) },
        iterate_text,
        Some(to),
        files,
        tests,
        None,
        None,
        Some(&json!({
            "source": "chain_loop",
            "role_requested": role,
            "from": from,
            "to": to,
        })),
    );
    // Always materialize auto-role pane scripts + profiles (even if fleet not opened).
    let _ = ensure_panda_profiles(repo);

    let hop = match handoff_with_pack(from, to, &summary, Some(pack)) {
        Ok(v) => v,
        Err(e) => {
            return json!({ "ok": false, "error": e, "stage": "handoff" });
        }
    };

    let fleet = if open_fleet {
        open_panda_fleet(repo, 3)
    } else {
        json!({ "ok": true, "launched": false, "skipped": true })
    };

    json!({
        "ok": true,
        "stage": "chain_complete",
        "handoff": hop,
        "fleet": fleet,
        "path": handoff_path().display().to_string(),
        "last_pack": last_pack_path().display().to_string(),
        "message": format!(
            "chain {from}→{to} · fat pack written · fleet {}",
            if fleet.get("launched").and_then(|v| v.as_bool()).unwrap_or(false) {
                "opened"
            } else {
                "skipped/pending"
            }
        ),
    })
}
