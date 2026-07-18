#!/usr/bin/env bash
# Live MENU_HEALTH tail + summary for Memory Glass.
# Usage:
#   ./scripts/mg-menu-monitor.sh           # follow launch.log
#   ./scripts/mg-menu-monitor.sh --once    # last N health lines
#   ./scripts/mg-menu-monitor.sh --status  # pass/fail summary
set -euo pipefail

LOG="${MG_LAUNCH_LOG:-$HOME/Library/Logs/MemoryGlass/launch.log}"
JSONL="${MG_MENU_JSONL:-$HOME/.panda/mg-soak/watch/menu-health.jsonl}"
MODE="${1:---follow}"

summarize() {
  local n="${1:-40}"
  if command -v python3 >/dev/null 2>&1 && [[ -f "$JSONL" ]]; then
    python3 - <<'PY' "$JSONL" "$n"
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); n=int(sys.argv[2])
lines=p.read_text().splitlines()[-n:] if p.exists() else []
last=None; last_ex=None
for line in lines:
  try: o=json.loads(line)
  except Exception: continue
  if o.get("kind")=="menu_health" and "pass" in o: last=o
  if o.get("kind")=="menu_exercise_done": last_ex=o
if not last:
  print("NO_MENU_HEALTH_YET · relaunch Memory Glass or wait ~1s for first probe")
  raise SystemExit(1)
ok=last.get("ok"); pass_=last.get("pass"); total=last.get("total")
print(f"STATUS  {'GREEN' if ok else 'RED'}  {pass_}/{total}  ver={last.get('ver')}")
fails=last.get("fails") or []
if fails: print("FAILS  ", ", ".join(fails))
else: print("FAILS   none")
print("product=", last.get("product"), "userChrome=", last.get("userChrome"), "healed=", last.get("healed"))
if last_ex:
  print(f"EXERCISE open={last_ex.get('openOk')} close={last_ex.get('closeOk')} hits={last_ex.get('hitsOk')} ok={last_ex.get('ok')}")
print("API     window.__mgMenus.open|close|toggle|openAll|closeAll|probe|exercise")
print("file   ", p)
PY
    return $?
  fi
  if [[ ! -f "$LOG" ]]; then
    echo "no log yet: $LOG" >&2
    return 1
  fi
  local lines
  lines=$(rg -n "MENU_HEALTH" "$LOG" 2>/dev/null | tail -n "$n" || true)
  if [[ -z "$lines" ]]; then
    echo "NO_MENU_HEALTH_YET · is menu-health-monitor.js injected? relaunch app"
    return 1
  fi
  echo "$lines" | tail -5
}

case "$MODE" in
  --once|-1)
    summarize 30
    ;;
  --status|-s)
    summarize 80
    ;;
  --follow|*)
    echo "watching $LOG for MENU_HEALTH (Ctrl-C stop)"
    summarize 10 || true
    echo "── live ──"
    tail -n0 -F "$LOG" 2>/dev/null | while IFS= read -r line; do
      if [[ "$line" == *MENU_HEALTH* ]]; then
        ts=$(date +%H:%M:%S)
        echo "[$ts] $line" | sed 's/.*"msg":"MENU_HEALTH /MENU_HEALTH /' | head -c 2000
        echo
        # quick ok parse
        if [[ "$line" == *'"ok":true'* ]] || [[ "$line" == *'"ok": true'* ]]; then
          echo "  → GREEN"
        elif [[ "$line" == *'"ok":false'* ]] || [[ "$line" == *'"ok": false'* ]]; then
          echo "  → RED (heal cycle will retry)"
        fi
      fi
    done
    ;;
esac
