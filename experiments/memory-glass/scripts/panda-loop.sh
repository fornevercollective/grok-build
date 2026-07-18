#!/usr/bin/env bash
# Panda loop driver — offline-friendly plan → build → verify handoff
# Does NOT delete anything. Works with or without Lab HTTP :8765.
#
# Usage:
#   bash scripts/panda-loop.sh status
#   bash scripts/panda-loop.sh init
#   bash scripts/panda-loop.sh next --from plan --to build --summary "…" --prompt "…"
#   bash scripts/panda-loop.sh advance          # active.to becomes next from
#   bash scripts/panda-loop.sh fail             # loop++ and bounce verify→build
#   bash scripts/panda-loop.sh reset
#   bash scripts/panda-loop.sh plans            # list plan catalog
set -u
PANDA_HOME="${PANDA_HOME:-$HOME/.panda}"
LAB_REPO="${LAB_REPO:-/Volumes/qbitOS/00.dev/projects/grok-build}"
HANDOFF="${LAB_HANDOFF:-$PANDA_HOME/lab-handoff.json}"
PACKS="$PANDA_HOME/packs"
PACK="$PACKS/last.json"
PLANS="$LAB_REPO/docs/fornever-ledger/plans"
LEDGER="$LAB_REPO/docs/fornever-ledger/BUG_BOUNTY_NOTES.jsonl"
MAX_LOOPS="${PANDA_LOOP_MAX:-5}"

mkdir -p "$PANDA_HOME" "$PACKS" "$PANDA_HOME/sessions" "$PANDA_HOME/profiles"

json_get() {
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get(sys.argv[2],"") or "")' "$1" "$2" 2>/dev/null
}

ensure_handoff() {
  if [[ ! -f "$HANDOFF" ]]; then
    init_handoff
  fi
}

init_handoff() {
  local now
  now=$(date +%s)
  cat >"$HANDOFF" <<EOF
{
  "session": "panda-loop",
  "ok": true,
  "updated_at": "$now",
  "hint": "source ~/.panda/profiles/{plan,build,verify}.env · panda-loop.sh next/advance",
  "active": null,
  "queue": [],
  "shells": {
    "plan":   {"id": "plan",   "label": "α Plan",   "role": "plan",   "status": "idle"},
    "build":  {"id": "build",  "label": "β Build",  "role": "build",  "status": "idle"},
    "verify": {"id": "verify", "label": "γ Verify", "role": "verify", "status": "idle"}
  },
  "loop": 0,
  "history": []
}
EOF
  echo "init → $HANDOFF"
}

cmd_status() {
  ensure_handoff
  python3 - <<'PY' "$HANDOFF"
import json,sys
from pathlib import Path
p=Path(sys.argv[1])
d=json.loads(p.read_text())
print(f"session={d.get('session')} loop={d.get('loop',0)} updated={d.get('updated_at')}")
a=d.get("active")
if a:
    print(f"active: {a.get('from')} → {a.get('to')}  [{a.get('status')}]  {a.get('summary','')[:80]}")
    print(f"  id={a.get('id')} loop={a.get('loop')}")
else:
    print("active: (none)")
print("shells:")
for k,v in (d.get("shells") or {}).items():
    print(f"  {k:6} status={v.get('status')} role={v.get('role')}")
q=d.get("queue") or []
print(f"queue: {len(q)}")
for item in q[-5:]:
    print(f"  - {item.get('from')}→{item.get('to')} {item.get('status')} {item.get('summary','')[:60]}")
PY
  if [[ -f "$PACK" ]]; then
    echo "pack: $PACK ($(wc -c <"$PACK" | tr -d ' ') bytes)"
  else
    echo "pack: (none)"
  fi
}

cmd_next() {
  ensure_handoff
  local from="plan" to="build" summary="" prompt="" files="[]" tests="[]"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --from) from="${2:-plan}"; shift 2 ;;
      --to) to="${2:-build}"; shift 2 ;;
      --summary) summary="${2:-}"; shift 2 ;;
      --prompt) prompt="${2:-}"; shift 2 ;;
      --files) files="${2:-[]}"; shift 2 ;;
      --tests) tests="${2:-[]}"; shift 2 ;;
      *) shift ;;
    esac
  done
  [[ -n "$summary" ]] || summary="handoff $from → $to"
  local now id loop
  now=$(date +%s)
  id="act-${now}-$$"
  loop=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("loop",0))' "$HANDOFF")

  python3 - <<PY
import json
from pathlib import Path
hpath = Path(r"""$HANDOFF""")
frm, to = r"""$from""", r"""$to"""
sid, summary = r"""$id""", r"""$summary"""
prompt = r"""$prompt"""
files_s, tests_s = r"""$files""", r"""$tests"""
now, loop = int("""$now"""), int("""$loop""")
d = json.loads(hpath.read_text())
item = {
  "id": sid,
  "from": frm,
  "to": to,
  "summary": summary,
  "status": "pending",
  "loop": loop,
  "created_at": str(now),
}
d["active"] = item
d.setdefault("queue", []).append(item)
d["updated_at"] = str(now)
sh = d.setdefault("shells", {})
for role in ("plan", "build", "verify"):
    sh.setdefault(role, {"id": role, "role": role, "status": "idle"})
if frm in sh:
    sh[frm]["status"] = "done"
    sh[frm]["last_activity"] = sid
if to in sh:
    sh[to]["status"] = "running"
    sh[to]["last_activity"] = sid
d.setdefault("history", []).append(
    {"t": now, "event": "handoff", "from": frm, "to": to, "summary": summary[:120]}
)
hpath.write_text(json.dumps(d, indent=2))
try:
    files = json.loads(files_s) if files_s.strip().startswith("[") else []
except Exception:
    files = []
try:
    tests = json.loads(tests_s) if tests_s.strip().startswith("[") else []
except Exception:
    tests = []
pack = {
  "id": sid,
  "from": frm,
  "to": to,
  "summary": summary,
  "prompt": prompt,
  "files": files,
  "tests": tests,
  "created_at": now,
  "lab_repo": r"""$LAB_REPO""",
}
Path(r"""$PACK""").write_text(json.dumps(pack, indent=2))
print("handoff %s → %s" % (frm, to))
print("  id=%s" % sid)
print("  summary=%s" % summary[:100])
print("  pack=%s" % Path(r"""$PACK"""))
print("  next: source ~/.panda/profiles/%s.env  # then work as %s" % (to, to))
PY

  # append ledger note
  if [[ -d "$(dirname "$LEDGER")" ]]; then
    printf '{"t":"%s","id":"panda-loop","event":"handoff","from":"%s","to":"%s","summary":%s}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$from" "$to" \
      "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$summary")" \
      >>"$LEDGER" 2>/dev/null || true
  fi
}

cmd_advance() {
  ensure_handoff
  local from to summary
  from=$(python3 -c 'import json; d=json.load(open("'"$HANDOFF"'")); a=d.get("active") or {}; print(a.get("to") or "build")')
  case "$from" in
    plan) to=build ;;
    build) to=verify ;;
    verify) to=plan ;; # completed cycle — back to plan for next ticket
    *) to=build ;;
  esac
  summary="${1:-advance $from → $to}"
  cmd_next --from "$from" --to "$to" --summary "$summary"
}

cmd_fail() {
  ensure_handoff
  python3 - <<'PY' "$HANDOFF" "$MAX_LOOPS"
import json, sys, time
from pathlib import Path
hpath = Path(sys.argv[1])
cap = int(sys.argv[2])
d = json.loads(hpath.read_text())
loop = int(d.get("loop") or 0) + 1
d["loop"] = loop
now = int(time.time())
d["updated_at"] = str(now)
a = d.get("active") or {}
# bounce verify → build, or build → plan if over cap
if loop >= cap:
    nxt_from, nxt_to = "verify", "plan"
    summary = f"LOOP CAP {loop}/{cap} — force re-plan"
    d["loop"] = 0
else:
    nxt_from, nxt_to = "verify", "build"
    summary = f"verify FAIL loop={loop} → rebuild"
item = {
  "id": f"act-{now}-fail",
  "from": nxt_from,
  "to": nxt_to,
  "summary": summary,
  "status": "pending",
  "loop": loop,
  "created_at": str(now),
}
d["active"] = item
d.setdefault("queue", []).append(item)
d.setdefault("history", []).append({"t": now, "event": "fail", "loop": loop, "summary": summary})
for role, st in (("verify", "done"), ("build", "running" if nxt_to=="build" else "idle"), ("plan", "running" if nxt_to=="plan" else "idle")):
    d.setdefault("shells", {}).setdefault(role, {"id": role, "role": role})
    d["shells"][role]["status"] = st
hpath.write_text(json.dumps(d, indent=2))
print(summary)
print(f"active: {nxt_from} → {nxt_to}")
PY
}

cmd_reset() {
  init_handoff
  rm -f "$PACK"
  echo "reset handoff + cleared last pack"
}

cmd_plans() {
  if [[ -d "$PLANS" ]]; then
    echo "plans → $PLANS"
    ls -1 "$PLANS"/*.md 2>/dev/null | while read -r f; do
      title=$(head -1 "$f" | sed 's/^# //')
      echo "  $(basename "$f") — $title"
    done
  else
    echo "no plans dir yet: $PLANS"
  fi
}

cmd_hint() {
  ensure_handoff
  local to
  to=$(python3 -c 'import json; d=json.load(open("'"$HANDOFF"'")); a=d.get("active") or {}; print(a.get("to") or "plan")')
  cat <<EOF
Next role: $to
  source $PANDA_HOME/profiles/${to}.env
  cd $LAB_REPO

Memory Glass verify helpers:
  bash experiments/memory-glass/scripts/resign-app.sh
  codesign --verify --deep --strict "\$HOME/Applications/Memory Glass.app"
  MG_LOCAL_LLM=1 bash experiments/memory-glass/scripts/overnight-soak.sh --hours 0.05

Ledger:
  $LAB_REPO/docs/fornever-ledger/BUG_BOUNTY_LEDGER.md
EOF
}

case "${1:-status}" in
  status) shift; cmd_status "$@" ;;
  init) shift; init_handoff ;;
  next) shift; cmd_next "$@" ;;
  advance) shift; cmd_advance "$@" ;;
  fail) shift; cmd_fail "$@" ;;
  reset) shift; cmd_reset "$@" ;;
  plans) shift; cmd_plans "$@" ;;
  hint) shift; cmd_hint "$@" ;;
  *)
    echo "Usage: panda-loop.sh {status|init|next|advance|fail|reset|plans|hint}"
    exit 1
    ;;
esac
