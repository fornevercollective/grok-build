#!/usr/bin/env bash
# Memory Glass · soft overnight monitor (no hard kills)
# Prints status every N minutes; flags STEER presence; disk free; soak freshness.
#
# Usage:
#   bash scripts/mg-overnight-watch.sh              # once
#   bash scripts/mg-overnight-watch.sh --loop 5     # every 5 min
#   bash scripts/mg-overnight-watch.sh --loop 5 --log ~/.panda/mg-soak/watch/overnight-watch.log
set -euo pipefail

SOAK="${MG_SOAK:-$HOME/.panda/mg-soak}"
WATCH="$SOAK/watch"
STEER="$SOAK/STEER.md"
ACTIVE="$SOAK/OVERNIGHT_ACTIVE.txt"
STATUS="$WATCH/status.md"
PIDFILE="$SOAK/overnight-learn.pid"
LOOP_MIN=0
LOG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop|-l) LOOP_MIN="${2:-5}"; shift 2 ;;
    --log) LOG="${2:-}"; shift 2 ;;
    --once|-1) LOOP_MIN=0; shift ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *) shift ;;
  esac
done

stamp() { date -u +%Y-%m-%dT%H:%MZ; }

disk_line() {
  df -h /Users/tref /Volumes/qbitOS 2>/dev/null | awk 'NR>1 {printf "  %s  avail=%s  used=%s\n", $9, $4, $5}'
}

free_gi() {
  # macOS: Available Gi on path (approx)
  local p="$1"
  df -g "$p" 2>/dev/null | awk 'NR==2 {print $4}'
}

file_age_min() {
  local f="$1"
  if [[ ! -f "$f" ]]; then echo "-"; return; fi
  local m now
  m=$(stat -f %m "$f" 2>/dev/null || echo 0)
  now=$(date +%s)
  echo $(( (now - m) / 60 ))
}

procs() {
  # Prefer full-path product procs; drop agent shell noise
  {
    pgrep -lf 'webgrid-collector.py' 2>/dev/null || true
    pgrep -lf 'overnight-learn|overnight-soak|qbit-smoke' 2>/dev/null || true
    pgrep -lf '/Memory Glass.app/|memory-glass$' 2>/dev/null || true
  } | rg -v 'pgrep|mg-overnight-watch|dump_bash_state|GROK_SNAP|extglob' | sort -u | head -12 || true
}

peer_hint() {
  local base="$HOME/.grok/sessions/%2FUsers%2Ftref"
  if [[ ! -d "$base" ]]; then echo "  (no ~/.grok/sessions)"; return; fi
  # newest session dir by mtime of summary.json
  local newest
  newest=$(ls -t "$base"/*/summary.json 2>/dev/null | head -1 || true)
  if [[ -z "$newest" ]]; then echo "  (no summaries)"; return; fi
  local dir id title updated
  dir=$(dirname "$newest")
  id=$(basename "$dir")
  title=$(python3 -c "import json;print(json.load(open('$newest')).get('generated_title') or json.load(open('$newest')).get('session_summary') or '')" 2>/dev/null || true)
  updated=$(python3 -c "import json;print(json.load(open('$newest')).get('last_active_at') or json.load(open('$newest')).get('updated_at') or '')" 2>/dev/null || true)
  echo "  newest=$id"
  echo "  title=${title:0:80}"
  echo "  last_active=$updated"
}

once() {
  local out=""
  out+="══ mg-overnight-watch · $(stamp) ══"$'\n'
  out+="steer: $( [[ -f "$STEER" ]] && echo PRESENT || echo none )"$'\n'
  if [[ -f "$STEER" ]]; then
    out+="  first: $(head -n 3 "$STEER" | tr '\n' ' | ')"$'\n'
  fi
  out+="active: "$'\n'
  if [[ -f "$ACTIVE" ]]; then
    out+="$(sed 's/^/  /' "$ACTIVE" | tail -n 5)"$'\n'
  else
    out+="  (no OVERNIGHT_ACTIVE.txt)"$'\n'
  fi
  out+="pidfile: "
  if [[ -f "$PIDFILE" ]]; then
    local p
    p=$(cat "$PIDFILE" 2>/dev/null || true)
    if [[ -n "$p" ]] && ps -p "$p" >/dev/null 2>&1; then
      out+="pid=$p LIVE"$'\n'
    else
      out+="pid=$p dead/stale"$'\n'
    fi
  else
    out+="none"$'\n'
  fi
  out+="disk:"$'\n'
  out+="$(disk_line)"$'\n'
  local u_free q_free
  u_free=$(free_gi /Users/tref 2>/dev/null || echo "?")
  q_free=$(free_gi /Volumes/qbitOS 2>/dev/null || echo "?")
  if [[ "$u_free" =~ ^[0-9]+$ ]] && (( u_free < 10 )); then
    out+="  ⚠ /Users free ${u_free}Gi < 10 — rotate soak logs / stop thrash"$'\n'
  fi
  if [[ "$q_free" =~ ^[0-9]+$ ]] && (( q_free < 15 )); then
    out+="  ⚠ qbitOS free ${q_free}Gi < 15 — avoid large builds/archives"$'\n'
  fi
  out+="soak ages (min): play=$(file_age_min "$WATCH/play.jsonl") menu=$(file_age_min "$WATCH/menu-health.jsonl") summary=$(file_age_min "$WATCH/live-summary.json")"$'\n'
  if [[ -f "$WATCH/live-summary.json" ]]; then
    out+="  live-summary: $(head -c 220 "$WATCH/live-summary.json")"$'\n'
  fi
  if [[ -f "$WATCH/menu-health-latest.json" ]]; then
    out+="  menu-health-latest: $(head -c 180 "$WATCH/menu-health-latest.json")"$'\n'
  fi
  if [[ -f "$STATUS" ]]; then
    out+="status.md mtime age_min=$(file_age_min "$STATUS")"$'\n'
  fi
  out+="procs:"$'\n'
  local pr
  pr=$(procs)
  if [[ -n "$pr" ]]; then
    out+="$(echo "$pr" | sed 's/^/  /')"$'\n'
  else
    out+="  (none matching)"$'\n'
  fi
  out+="peer session:"$'\n'
  out+="$(peer_hint)"$'\n'
  out+="handoff: "
  if [[ -f "$HOME/.panda/lab-handoff.json" ]]; then
    out+="$(python3 -c "import json;o=json.load(open('$HOME/.panda/lab-handoff.json'));a=o.get('active') or {};print(a.get('summary','?')[:100],'|',a.get('from'),'→',a.get('to'))" 2>/dev/null || echo present)"$'\n'
  else
    out+="none"$'\n'
  fi
  out+="qbit-smoke: "
  local smoke_root="/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass"
  if [[ -f "$smoke_root/scripts/qbit-smoke.mjs" ]]; then
    out+="scripts/qbit-smoke.mjs present"$'\n'
  else
    out+="MISSING"$'\n'
  fi
  out+="════════════════════════════════════"$'\n'

  printf '%s' "$out"
  if [[ -n "$LOG" ]]; then
    mkdir -p "$(dirname "$LOG")"
    printf '%s' "$out" >> "$LOG"
  fi
}

once
if [[ "$LOOP_MIN" -gt 0 ]]; then
  echo "loop every ${LOOP_MIN}m · Ctrl-C stop · log=${LOG:-stdout only}"
  while true; do
    sleep $(( LOOP_MIN * 60 ))
    once
  done
fi
