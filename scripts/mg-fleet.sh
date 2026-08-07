#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# mg-fleet — ROOT-LEVEL multi-agent control plane for Memory Glass
# ═══════════════════════════════════════════════════════════════════════════
# Lives at grok-build root so Cursor / Grok / panda panes all share one CLI.
#
#   ./scripts/mg-fleet.sh status
#   ./scripts/mg-fleet.sh monitor start|stop|status|tail
#   ./scripts/mg-fleet.sh run start|stop|status|once|tick
#   ./scripts/mg-fleet.sh dispatch <args...>   # hands → mg-dispatch.sh
#   ./scripts/mg-fleet.sh terminals            # open MONITOR + RUN panes
#   ./scripts/mg-fleet.sh panda                # ONE panda instance · 3 panes (MONITOR|RUN|HANDS)
#   ./scripts/mg-fleet.sh root-map            # machine map for multi-agents
#
# Roles (multi-agent):
#   MONITOR  — observe-only, never kills MG, writes ~/.panda/mg-monitor/
#   RUN      — growth turns (ugrad/colossus/kbatch), never pkill MG
#   BRAIN    — this Grok/Cursor chat · edits code at repo root
#   HANDS    — mg-dispatch Cmd+L / term / hot
#
# NEVER pkill memory-glass.
# ═══════════════════════════════════════════════════════════════════════════
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export LAB_REPO="${LAB_REPO:-$ROOT}"
export PANDA_HOME="${PANDA_HOME:-$HOME/.panda}"
FLEET_HOME="${MG_FLEET_HOME:-$PANDA_HOME/fleet}"
MG_SCRIPTS="$ROOT/experiments/memory-glass/scripts"
DISPATCH="$MG_SCRIPTS/mg-dispatch.sh"
WATCH="$MG_SCRIPTS/mg-watch-alive.sh"
RUNNER="$FLEET_HOME/run-loop.sh"
PANDA_BIN="${PANDA_BIN:-$ROOT/target/release/panda}"
PANDA_SHELL_MG="${PANDA_SHELL_MG:-$PANDA_HOME/fleet-shell-mg.sh}"
mkdir -p "$FLEET_HOME" "$PANDA_HOME/mg-monitor" "$PANDA_HOME/dispatch"

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "$(ts) | fleet | $*" | tee -a "$FLEET_HOME/fleet.log"; }

mg_pid() { pgrep -x memory-glass 2>/dev/null | head -1 || true; }

write_status() {
  python3 - "$FLEET_HOME/status.json" <<'PY'
import json, os, time, subprocess, sys
path = sys.argv[1]
def pidof(name):
    try:
        out = subprocess.check_output(["pgrep", "-x", name], text=True)
        return out.strip().split("\n")[0]
    except Exception:
        return None
def pgrep_f(frag):
    try:
        out = subprocess.check_output(["ps", "-axo", "pid=,command="], text=True)
        for line in out.splitlines():
            if frag in line and "grep" not in line:
                return line.strip().split(None, 1)[0]
    except Exception:
        return None
    return None
st = {
    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "lab_repo": os.environ.get("LAB_REPO"),
    "mg_pid": pidof("memory-glass"),
    "monitor_pid": None,
    "run_pid": None,
    "alive_log": os.path.expanduser("~/.panda/mg-monitor/alive.log"),
    "dispatch": os.path.expanduser("~/.panda/dispatch"),
    "roles": {
        "MONITOR": "observe-only mg-watch-alive",
        "RUN": "growth loop ugrad/colossus/kbatch",
        "BRAIN": "Grok/Cursor root edits",
        "HANDS": "mg-dispatch Cmd+L/term",
    },
}
# monitor/run pid files
for role, fn in [("monitor_pid", "MONITOR.pid"), ("run_pid", "RUN.pid")]:
    p = os.path.join(os.path.dirname(path), fn)
    if os.path.isfile(p):
        try:
            pid = open(p).read().strip()
            os.kill(int(pid), 0)
            st[role] = pid
        except Exception:
            st[role] = None
json.dump(st, open(path, "w"), indent=2)
print(json.dumps(st, indent=2))
PY
}

# ── MONITOR ───────────────────────────────────────────────────────────────
cmd_monitor() {
  local sub="${1:-status}"
  shift || true
  case "$sub" in
    start)
      # stop prior monitor bash only
      if [[ -f "$FLEET_HOME/MONITOR.pid" ]]; then
        local op
        op="$(cat "$FLEET_HOME/MONITOR.pid" 2>/dev/null || true)"
        if [[ -n "$op" ]] && kill -0 "$op" 2>/dev/null; then
          echo "monitor already pid=$op"
          return 0
        fi
      fi
      nohup bash "$WATCH" --loop --interval "${MG_MONITOR_INTERVAL:-20}" \
        >>"$PANDA_HOME/mg-monitor/alive.log" 2>&1 &
      echo $! >"$FLEET_HOME/MONITOR.pid"
      log "monitor start pid=$!"
      echo "MONITOR started pid=$! → ~/.panda/mg-monitor/alive.log"
      ;;
    stop)
      if [[ -f "$FLEET_HOME/MONITOR.pid" ]]; then
        local op
        op="$(cat "$FLEET_HOME/MONITOR.pid")"
        # only kill if cmdline is watch
        if [[ -n "$op" ]] && ps -p "$op" -o command= 2>/dev/null | grep -q mg-watch-alive; then
          kill "$op" 2>/dev/null || true
          log "monitor stop pid=$op"
        fi
        rm -f "$FLEET_HOME/MONITOR.pid"
      fi
      # also clear stray watches (never memory-glass)
      for pid in $(pgrep -x bash 2>/dev/null); do
        cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
        case "$cmd" in
          *mg-watch-alive*) kill "$pid" 2>/dev/null; log "monitor stop stray $pid";;
        esac
      done
      echo "MONITOR stopped"
      ;;
    status)
      write_status
      echo "--- last alive ---"
      tail -5 "$PANDA_HOME/mg-monitor/alive.log" 2>/dev/null || echo "(no log)"
      cat "$PANDA_HOME/mg-monitor/LATEST-alive.json" 2>/dev/null || true
      ;;
    tail)
      tail -f "$PANDA_HOME/mg-monitor/alive.log"
      ;;
    *)
      echo "monitor start|stop|status|tail"; return 2
      ;;
  esac
}

# ── RUN growth loop ───────────────────────────────────────────────────────
# Writes run-loop.sh once, then backgrounds it
ensure_runner() {
  cat >"$RUNNER" <<'RUNEOF'
#!/usr/bin/env bash
# MG RUN instance — growth every interval (never kills MG)
set -u
ROOT="${LAB_REPO:-/Volumes/qbitOS/00.dev/projects/grok-build}"
DISPATCH="$ROOT/experiments/memory-glass/scripts/mg-dispatch.sh"
LOG="${MG_FLEET_HOME:-$HOME/.panda/fleet}/run.log"
INTERVAL="${MG_RUN_INTERVAL:-180}"
PACK="${MG_RUN_PACK:-ugrad}"
mkdir -p "$(dirname "$LOG")"
ts(){ date -u +%Y-%m-%dT%H:%M:%SZ; }
log(){ echo "$(ts) | RUN | $*" | tee -a "$LOG"; }

if ! pgrep -x memory-glass >/dev/null; then
  log "ABORT MG not running"
  exit 1
fi

n=0
while true; do
  n=$((n+1))
  log "turn $n pack=$PACK"
  if ! pgrep -x memory-glass >/dev/null; then
    log "MG died — exit RUN (will not relaunch without human)"
    exit 2
  fi
  case "$PACK" in
    ugrad)
      # prefer local if up
      if curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8787/ugrad.html 2>/dev/null | grep -q 200; then
        bash "$DISPATCH" nav "http://127.0.0.1:8787/ugrad.html" || true
      else
        bash "$DISPATCH" nav "https://mueee.qbitos.ai/ugrad.html" || true
      fi
      sleep 2
      bash "$DISPATCH" term "grow run-turn-$n" || true
      sleep 0.6
      bash "$DISPATCH" term "status" || true
      sleep 0.5
      bash "$DISPATCH" term "tensor" || true
      sleep 1.2
      bash "$DISPATCH" term "export colossus" || true
      sleep 0.8
      ;;
    kbatch)
      bash "$DISPATCH" nav "https://kbatch.ugrad.ai/for-ai.html#ugrad-colossus" || true
      sleep 2
      bash "$DISPATCH" nav "https://kbatch.ugrad.ai/dojo/" || true
      sleep 2
      ;;
    mixed)
      bash "$DISPATCH" nav "http://127.0.0.1:8787/ugrad-hub.html" || true
      sleep 2
      bash "$DISPATCH" nav "http://127.0.0.1:8787/ugrad.html" || true
      sleep 1.5
      bash "$DISPATCH" term "grow mixed-$n" || true
      sleep 0.5
      bash "$DISPATCH" term "dojo" || true
      sleep 1
      ;;
    *)
      log "unknown pack $PACK"
      ;;
  esac
  bash "$DISPATCH" loop tick "RUN turn $n pack=$PACK" || true
  log "sleep ${INTERVAL}s"
  sleep "$INTERVAL"
done
RUNEOF
  chmod +x "$RUNNER"
}

cmd_run() {
  local sub="${1:-status}"
  shift || true
  case "$sub" in
    start)
      ensure_runner
      if [[ -f "$FLEET_HOME/RUN.pid" ]]; then
        local op
        op="$(cat "$FLEET_HOME/RUN.pid" 2>/dev/null || true)"
        if [[ -n "$op" ]] && kill -0 "$op" 2>/dev/null; then
          echo "run already pid=$op"
          return 0
        fi
      fi
      if ! pgrep -x memory-glass >/dev/null; then
        echo "MG not running — start Memory Glass first"; return 1
      fi
      MG_RUN_INTERVAL="${MG_RUN_INTERVAL:-180}" MG_RUN_PACK="${MG_RUN_PACK:-ugrad}" \
        LAB_REPO="$ROOT" MG_FLEET_HOME="$FLEET_HOME" \
        nohup bash "$RUNNER" >>"$FLEET_HOME/run.log" 2>&1 &
      echo $! >"$FLEET_HOME/RUN.pid"
      log "run start pid=$! pack=${MG_RUN_PACK:-ugrad} interval=${MG_RUN_INTERVAL:-180}"
      echo "RUN started pid=$! → $FLEET_HOME/run.log"
      echo "  packs: ugrad|kbatch|mixed   env MG_RUN_PACK MG_RUN_INTERVAL"
      ;;
    stop)
      if [[ -f "$FLEET_HOME/RUN.pid" ]]; then
        local op
        op="$(cat "$FLEET_HOME/RUN.pid")"
        if [[ -n "$op" ]] && ps -p "$op" -o command= 2>/dev/null | grep -qE 'run-loop|mg-fleet|RUN'; then
          kill "$op" 2>/dev/null || true
        fi
        # kill runner children carefully
        for pid in $(pgrep -x bash 2>/dev/null); do
          cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
          case "$cmd" in
            *fleet/run-loop.sh*) kill "$pid" 2>/dev/null; log "run stop $pid";;
          esac
        done
        rm -f "$FLEET_HOME/RUN.pid"
      fi
      echo "RUN stopped"
      ;;
    once)
      ensure_runner
      # single turn: interval 0 exit after one - inline
      if ! pgrep -x memory-glass >/dev/null; then echo "MG down"; return 1; fi
      bash "$DISPATCH" loop learn >/dev/null || true
      if curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8787/ugrad.html 2>/dev/null | grep -q 200; then
        bash "$DISPATCH" nav "http://127.0.0.1:8787/ugrad.html"
      else
        bash "$DISPATCH" nav "https://mueee.qbitos.ai/ugrad.html"
      fi
      sleep 1.5
      bash "$DISPATCH" term "grow once"
      sleep 0.5
      bash "$DISPATCH" term "status"
      sleep 0.5
      bash "$DISPATCH" term "tensor"
      sleep 1
      bash "$DISPATCH" loop tick "RUN once · root fleet"
      echo "RUN once complete"
      ;;
    tick)
      bash "$DISPATCH" loop tick "${*:-fleet manual tick}"
      ;;
    status)
      write_status
      echo "--- run log ---"
      tail -12 "$FLEET_HOME/run.log" 2>/dev/null || echo "(no run log)"
      ;;
    *)
      echo "run start|stop|status|once|tick"; return 2
      ;;
  esac
}

cmd_dispatch() {
  bash "$DISPATCH" "$@"
}

cmd_terminals() {
  # Open two Terminal.app windows: MONITOR + RUN
  osascript <<AS 2>&1 || true
tell application "Terminal"
  activate
  do script "cd '$ROOT'; clear; echo '═══ MG FLEET · MONITOR ═══'; ./scripts/mg-fleet.sh monitor start; ./scripts/mg-fleet.sh monitor status; echo; echo 'tail: ./scripts/mg-fleet.sh monitor tail'; exec bash -l"
  set custom title of front window to "MG-MONITOR"
  delay 0.4
  do script "cd '$ROOT'; clear; echo '═══ MG FLEET · RUN ═══'; echo 'once:  ./scripts/mg-fleet.sh run once'; echo 'loop:  MG_RUN_INTERVAL=180 MG_RUN_PACK=ugrad ./scripts/mg-fleet.sh run start'; echo 'stop:  ./scripts/mg-fleet.sh run stop'; echo; ./scripts/mg-fleet.sh status; exec bash -l"
  set custom title of front window to "MG-RUN"
end tell
AS
  log "terminals MONITOR+RUN opened"
  echo "Opened Terminal panes: MG-MONITOR · MG-RUN"
}

# ── PANDA: three dispatch roles in ONE instance ───────────────────────────
cmd_panda() {
  local name="${1:-mg-fleet}"
  local splits="${2:-2}" # 2 splits → 3 panes (1 root + 2)
  chmod +x "$PANDA_SHELL_MG" 2>/dev/null || true
  if [[ ! -x "$PANDA_BIN" ]]; then
    echo "panda binary missing at $PANDA_BIN"
    echo "build: cargo build -p panda-shell --release"
    return 1
  fi
  if [[ ! -x "$PANDA_SHELL_MG" ]]; then
    echo "fleet-shell-mg missing: $PANDA_SHELL_MG"
    return 1
  fi
  # reset role assignment so three fresh panes get MONITOR/RUN/HANDS
  rm -f "$FLEET_HOME/role-assign.json" "$FLEET_HOME/role-assign.lock" 2>/dev/null || true
  # ensure daemon
  "$PANDA_BIN" start 2>/dev/null || true
  # drop prior session if requested
  if [[ "${MG_PANDA_FRESH:-1}" == "1" ]]; then
    "$PANDA_BIN" kill "$name" 2>/dev/null || true
    sleep 0.3
  fi
  log "panda new $name --splits $splits · shell=$PANDA_SHELL_MG"
  echo "Launching panda session '$name' with 3 panes:"
  echo "  1 MONITOR · 2 RUN · 3 HANDS  (auto-assigned)"
  echo "  cwd=$ROOT"
  echo ""
  # export for child shells
  export LAB_REPO="$ROOT"
  export PANDA_HOME
  export LAB_FLEET=1
  # splits=2 → three panes total
  exec "$PANDA_BIN" new "$name" \
    --splits "$splits" \
    -C "$ROOT" \
    -s "$PANDA_SHELL_MG"
}

cmd_root_map() {
  cat <<EOF
═══════════════════════════════════════════════════════════
 ROOT multi-agent map (Cursor / Grok / panda)
═══════════════════════════════════════════════════════════
LAB_REPO (dev root):
  $ROOT

Memory Glass product:
  $ROOT/experiments/memory-glass/
  scripts: mg-dispatch · mg-watch-alive · mg-active-drive
  hotpipe: ugrad-bridge · tools-drawer · quantum-section

Fleet control (this CLI):
  $ROOT/scripts/mg-fleet.sh
  state: $FLEET_HOME/

Panda plane:
  ~/.panda/dispatch/     hands log + LEARNINGS
  ~/.panda/mg-monitor/   MONITOR alive.json + log
  ~/.panda/packs/        αβγ handoff
  ~/.panda/fleet.env

Sites (local growth):
  :8787  MG PWA/ugrad  ugrad · hub · colossus
  :8899  kbatch   shadow · for-ai · dojo
  :11434 ollama   offline LLM

Roles:
  BRAIN   → Grok TUI or Cursor on $ROOT (root-level)
  MONITOR → ./scripts/mg-fleet.sh monitor start
  RUN     → ./scripts/mg-fleet.sh run start|once
  HANDS   → ./scripts/mg-fleet.sh dispatch ugrad useful

Cursor note: open folder = $ROOT (not only experiments/)
  so multi-agent sees crates + experiments + docs/fornever-ledger.

Skills: mg-dispatch · loop-iterate · memory-glass · panda-loop · mg-fleet
═══════════════════════════════════════════════════════════
EOF
}

cmd_status() {
  echo "═══ MG FLEET STATUS ═══"
  echo "root: $ROOT"
  echo "mg:   $(mg_pid || echo DEAD)"
  write_status
  echo "---"
  bash "$DISPATCH" ping 2>/dev/null || true
}

usage() {
  cat <<'EOF'
mg-fleet.sh — root multi-agent MG control

  status
  monitor start|stop|status|tail
  run     start|stop|status|once|tick
  dispatch <mg-dispatch args...>
  terminals          open MONITOR + RUN Terminal.app panes
  panda [name] [splits]
                     ONE panda instance · 3 panes MONITOR|RUN|HANDS
                     default: name=mg-fleet splits=2 (→ 3 panes)
  root-map           machine map for Cursor/Grok agents

Env:
  MG_RUN_INTERVAL=180   seconds between RUN turns
  MG_RUN_PACK=ugrad|kbatch|mixed
  MG_MONITOR_INTERVAL=20
  MG_PANDA_FRESH=1      kill prior panda session name before new
EOF
}

main() {
  local cmd="${1:-status}"
  shift || true
  case "$cmd" in
    status) cmd_status ;;
    monitor) cmd_monitor "$@" ;;
    run) cmd_run "$@" ;;
    dispatch|d|hands) cmd_dispatch "$@" ;;
    terminals|panes) cmd_terminals ;;
    panda|triple|3) cmd_panda "$@" ;;
    root-map|map) cmd_root_map ;;
    help|-h|--help) usage ;;
    *) usage; return 2 ;;
  esac
}

main "$@"
