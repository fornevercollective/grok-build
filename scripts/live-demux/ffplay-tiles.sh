#!/usr/bin/env bash
# fornevercollective · independent ffplay tile plane (fc-tile-plane-v1)
# Load / place / close / crash-isolate windows independent of Grok main bg.
#
# Usage:
#   bash scripts/live-demux/ffplay-tiles.sh list
#   bash scripts/live-demux/ffplay-tiles.sh status
#   bash scripts/live-demux/ffplay-tiles.sh load 12 'https://x.com/zanelowe/media'
#   bash scripts/live-demux/ffplay-tiles.sh load A3 'https://…' [--id tA3]
#   bash scripts/live-demux/ffplay-tiles.sh load 5 null          # color placeholder
#   bash scripts/live-demux/ffplay-tiles.sh place t12 7
#   bash scripts/live-demux/ffplay-tiles.sh move t12 100 80
#   bash scripts/live-demux/ffplay-tiles.sh close t12
#   bash scripts/live-demux/ffplay-tiles.sh close all
#   bash scripts/live-demux/ffplay-tiles.sh reap
#   bash scripts/live-demux/ffplay-tiles.sh from-select          # open null tiles on align selected cells
#   bash scripts/live-demux/ffplay-tiles.sh geometry
#
# Env:
#   LIVE_DEMUX_TILES_DIR     default ~/.panda/vision/tiles
#   LIVE_DEMUX_ALIGN_JSON    default ~/.panda/vision/cast/align-chart.json
#   LIVE_DEMUX_TILE_W/H      override cell size (else from align)
#   LIVE_DEMUX_TILE_ORIGIN_X/Y  screen offset (menu bar / bezel)
#   LIVE_DEMUX_TILE_CLIP_SEC    seconds per x-media / playlist clip (default 12)
#   YTDLP_COOKIES* / X_COOKIES* same as watch / x-media-feed
#
# Docs: docs/fornever-ledger/FC-BROADCAST-TILE-PLANE.md
# Explicit only — see NO-AUTO-LAUNCH.md
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TILES_DIR="${LIVE_DEMUX_TILES_DIR:-$HOME/.panda/vision/tiles}"
REG="$TILES_DIR/registry.json"
ALIGN_JSON="${LIVE_DEMUX_ALIGN_JSON:-$HOME/.panda/vision/cast/align-chart.json}"
X_MEDIA_PY="$ROOT/scripts/live-demux/x-media-feed.py"
CLIP_SEC="${LIVE_DEMUX_TILE_CLIP_SEC:-12}"
ORIGIN_X="${LIVE_DEMUX_TILE_ORIGIN_X:-0}"
ORIGIN_Y="${LIVE_DEMUX_TILE_ORIGIN_Y:-28}"
# Fallback grid if no align JSON
FB_COLS="${LIVE_DEMUX_CAST_ALIGN_COLS:-8}"
FB_ROWS="${LIVE_DEMUX_CAST_ALIGN_ROWS:-4}"
FB_W="${LIVE_DEMUX_CAST_W:-1920}"
FB_H="${LIVE_DEMUX_CAST_H:-1080}"

mkdir -p "$TILES_DIR"

CMD="${1:-help}"
shift || true

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: need $1 on PATH"; exit 1; }; }

ensure_reg() {
  if [[ ! -f "$REG" ]]; then
    echo '{"version":1,"tiles":{}}' >"$REG"
  fi
}

# --- geometry: cell number or chess → x,y,w,h (screen coords) ---
cell_geom() {
  local cell="$1"
  python3 - "$cell" "$ALIGN_JSON" "$ORIGIN_X" "$ORIGIN_Y" "$FB_W" "$FB_H" "$FB_COLS" "$FB_ROWS" <<'PY'
import json, re, sys
from pathlib import Path

cell_s, align_path, ox, oy, fw, fh, cols, rows = sys.argv[1:9]
ox, oy = int(ox), int(oy)
fw, fh, cols, rows = int(fw), int(fh), int(cols), int(rows)

def col_letter_to_i(s):
    n = 0
    for ch in s.upper():
        n = n * 26 + (ord(ch) - 64)
    return n - 1

def parse_cell(s, cols, rows):
    s = s.strip()
    if re.fullmatch(r"\d+", s):
        n = int(s)
        if 1 <= n <= cols * rows:
            r = (n - 1) // cols
            c = (n - 1) % cols
            return n, c, r
        return None
    m = re.fullmatch(r"([A-Za-z]+)(\d+)", s)
    if m:
        c = col_letter_to_i(m.group(1))
        r = int(m.group(2)) - 1
        if 0 <= c < cols and 0 <= r < rows:
            return r * cols + c + 1, c, r
        return None
    m = re.fullmatch(r"[rR](\d+)[cC](\d+)", s)
    if m:
        r, c = int(m.group(1)) - 1, int(m.group(2)) - 1
        if 0 <= c < cols and 0 <= r < rows:
            return r * cols + c + 1, c, r
    return None

cells = None
p = Path(align_path)
if p.is_file():
    try:
        data = json.loads(p.read_text())
        cols = int(data.get("cols", cols))
        rows = int(data.get("rows", rows))
        fw = int(data.get("width", fw))
        fh = int(data.get("height", fh))
        cells = {c["n"]: c for c in data.get("cells", [])}
    except Exception:
        cells = None

parsed = parse_cell(cell_s, cols, rows)
if not parsed:
    print(f"error: bad cell {cell_s!r} for {cols}x{rows}", file=sys.stderr)
    sys.exit(2)
n, c, r = parsed

if cells and n in cells:
    cell = cells[n]
    x, y, w, h = cell["x"], cell["y"], cell["w"], cell["h"]
else:
    gutter = max(28, min(fw, fh) // 40)
    cw = (fw - 2 * gutter) / cols
    ch = (fh - 2 * gutter) / rows
    x = int(gutter + c * cw)
    y = int(gutter + r * ch)
    w = int(cw)
    h = int(ch)

# map align canvas → screen (1:1 default; scale if LIVE_DEMUX_TILE_SCALE set)
import os
scale = float(os.environ.get("LIVE_DEMUX_TILE_SCALE", "1"))
sx = int(ox + x * scale)
sy = int(oy + y * scale)
sw = max(160, int(w * scale))
sh = max(90, int(h * scale))
# even dimensions for yuv420
sw -= sw % 2
sh -= sh % 2
print(f"{n} {sx} {sy} {sw} {sh}")
PY
}

id_for_cell() {
  local cell="$1"
  # normalize to tN
  local geom
  geom="$(cell_geom "$cell")" || return 1
  local n
  n="$(echo "$geom" | awk '{print $1}')"
  echo "t${n}"
}

reg_get() {
  ensure_reg
  python3 - "$REG" "$1" <<'PY'
import json,sys
reg=json.load(open(sys.argv[1]))
tid=sys.argv[2]
t=reg.get("tiles",{}).get(tid)
if not t:
    sys.exit(1)
print(json.dumps(t))
PY
}

reg_put() {
  # reads tile JSON from stdin (must not use heredoc on same stdin)
  ensure_reg
  local payload
  payload="$(cat)"
  REG_PATH="$REG" TILE_JSON="$payload" python3 <<'PY'
import json, os
reg_path = os.environ["REG_PATH"]
tile = json.loads(os.environ["TILE_JSON"])
with open(reg_path) as f:
    reg = json.load(f)
reg.setdefault("tiles", {})[tile["id"]] = tile
with open(reg_path, "w") as f:
    json.dump(reg, f, indent=2)
    f.write("\n")
print(reg_path)
PY
}

reg_del() {
  ensure_reg
  python3 - "$REG" "$1" <<'PY'
import json,sys
reg=json.load(open(sys.argv[1]))
tid=sys.argv[2]
reg.get("tiles",{}).pop(tid, None)
json.dump(reg, open(sys.argv[1],"w"), indent=2)
PY
}

reg_all_ids() {
  ensure_reg
  python3 -c "import json; r=json.load(open('$REG')); print(' '.join(r.get('tiles',{}).keys()))"
}

is_alive() {
  local pid="$1"
  [[ -n "$pid" && "$pid" != "null" && "$pid" != "0" ]] && kill -0 "$pid" 2>/dev/null
}

classify_source() {
  local src="$1"
  if [[ "$src" == "null" || "$src" == "placeholder" || "$src" == "color" ]]; then
    echo "null"
  elif [[ "$src" =~ ^[0-9]+$ ]]; then
    echo "cam"
  elif [[ "$src" == *"/media"* && "$src" == *"x.com"* ]] || [[ "$src" == *"/media"* && "$src" == *"twitter.com"* ]]; then
    echo "x-media"
  elif [[ -f "$src" ]]; then
    echo "file"
  else
    echo "url"
  fi
}

# Resolve playable URL (or special null)
resolve_play() {
  local kind="$1"
  local src="$2"
  local work="$3"
  case "$kind" in
    null)
      echo "null"
      ;;
    file)
      echo "$src"
      ;;
    cam)
      echo "cam:$src"
      ;;
    x-media)
      need python3
      [[ -f "$X_MEDIA_PY" ]] || { echo "error: missing $X_MEDIA_PY" >&2; return 1; }
      local list="$work/playlist.jsonl"
      python3 "$X_MEDIA_PY" "$src" --videos-only --end 40 >"$list" 2>"$work/x-media.err" || {
        echo "error: x-media expand failed — cookies? see $work/x-media.err" >&2
        return 1
      }
      local first
      first="$(python3 -c "import json; import sys
for line in open('$list'):
  if line.strip():
    print(json.loads(line).get('url') or json.loads(line).get('webpage_url','')); break
")"
      [[ -n "$first" ]] || { echo "error: empty x-media playlist" >&2; return 1; }
      echo "$first"
      ;;
    url)
      need yt-dlp
      local u
      u="$(yt-dlp -g -f 'b/bv*+ba/b' --no-playlist "$src" 2>"$work/ytdlp.err" | head -1)" || true
      if [[ -z "$u" ]]; then
        u="$(yt-dlp -g --no-playlist "$src" 2>>"$work/ytdlp.err" | head -1)" || true
      fi
      [[ -n "$u" ]] || { echo "error: yt-dlp -g failed for $src" >&2; cat "$work/ytdlp.err" >&2 | tail -5; return 1; }
      echo "$u"
      ;;
  esac
}

# Spawn isolated ffplay; write pid; never attach to caller's job control as session leader
spawn_ffplay() {
  local tid="$1" x="$2" y="$3" w="$4" h="$5" play="$6" kind="$7" title="$8"
  local work="$TILES_DIR/$tid"
  mkdir -p "$work"
  local log="$work/tile.log"
  local pidfile="$work/tile.pid"

  # kill previous if any
  if [[ -f "$pidfile" ]]; then
    local old
    old="$(cat "$pidfile" 2>/dev/null || true)"
    if is_alive "$old"; then
      kill -- -"$old" 2>/dev/null || kill "$old" 2>/dev/null || true
      sleep 0.2
    fi
  fi

  # launcher in its own process group
  (
    # new session so SIGHUP on shell exit doesn't kill tiles; crash isolation
    if command -v setsid >/dev/null 2>&1; then
      setsid bash -c '
        play="$1"; x="$2"; y="$3"; w="$4"; h="$5"; title="$6"; kind="$7"; clip="$8"; log="$9"
        exec >>"$log" 2>&1
        echo "[start] kind=$kind title=$title ${w}x${h}+${x}+${y}"
        if [[ "$play" == "null" ]]; then
          exec ffplay -hide_banner -loglevel error -alwaysontop -noborder \
            -left "$x" -top "$y" -x "$w" -y "$h" \
            -window_title "$title" \
            -f lavfi -i "color=c=0x1a2233:s=${w}x${h}:r=15" -an
        elif [[ "$play" == cam:* ]]; then
          idx="${play#cam:}"
          exec ffplay -hide_banner -loglevel error -alwaysontop \
            -left "$x" -top "$y" -x "$w" -y "$h" \
            -window_title "$title" \
            -f avfoundation -framerate 15 -video_size 640x480 \
            -i "${idx}:none" -an -vf "scale=${w}:${h}"
        else
          exec ffplay -hide_banner -loglevel error -alwaysontop \
            -left "$x" -top "$y" -x "$w" -y "$h" \
            -window_title "$title" \
            -autoexit -t "$clip" \
            -i "$play" -vf "scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2"
        fi
      ' _ "$play" "$x" "$y" "$w" "$h" "$title" "$kind" "$CLIP_SEC" "$log" &
      echo $! >"$pidfile"
    else
      # macOS: no setsid — nohup + background (independent of caller shell)
      nohup bash -c '
        play="$1"; x="$2"; y="$3"; w="$4"; h="$5"; title="$6"; kind="$7"; clip="$8"; log="$9"
        exec >>"$log" 2>&1
        echo "[start] kind=$kind title=$title ${w}x${h}+${x}+${y}"
        if [[ "$play" == "null" ]]; then
          exec ffplay -hide_banner -loglevel error -alwaysontop -noborder \
            -left "$x" -top "$y" -x "$w" -y "$h" -window_title "$title" \
            -f lavfi -i "color=c=0x1a2233:s=${w}x${h}:r=15" -an
        elif [[ "$play" == cam:* ]]; then
          idx="${play#cam:}"
          exec ffplay -hide_banner -loglevel error -alwaysontop \
            -left "$x" -top "$y" -x "$w" -y "$h" -window_title "$title" \
            -f avfoundation -framerate 15 -video_size 640x480 -i "${idx}:none" -an -vf "scale=${w}:${h}"
        else
          exec ffplay -hide_banner -loglevel error -alwaysontop \
            -left "$x" -top "$y" -x "$w" -y "$h" -window_title "$title" \
            -autoexit -t "$clip" -i "$play" \
            -vf "scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2"
        fi
      ' _ "$play" "$x" "$y" "$w" "$h" "$title" "$kind" "$CLIP_SEC" "$log" >/dev/null 2>&1 &
      echo $! >"$pidfile"
    fi
  )
  sleep 0.35
  local pid
  pid="$(cat "$pidfile" 2>/dev/null || echo 0)"
  if ! is_alive "$pid"; then
    echo "warn: tile $tid may have exited early — see $log" >&2
    echo "dead"
  else
    echo "$pid"
  fi
}

cmd_list() {
  ensure_reg
  reap_quiet
  python3 - "$REG" <<'PY'
import json, os, sys
reg=json.load(open(sys.argv[1]))
tiles=reg.get("tiles",{})
if not tiles:
    print("(no tiles)")
    sys.exit(0)
print(f"{'ID':8} {'ST':8} {'CELL':5} {'PID':7} {'GEOM':18} SOURCE")
for tid,t in sorted(tiles.items()):
    pid=t.get("pid")
    alive = pid and os.path.exists(f"/proc/{pid}") if os.path.isdir("/proc") else False
    # portable alive check via kill -0 not available here; trust status field + optional
    st=t.get("status","?")
    geom=f"{t.get('x',0)},{t.get('y',0)} {t.get('w',0)}x{t.get('h',0)}"
    src=(t.get("source") or "")[:48]
    print(f"{tid:8} {st:8} {str(t.get('cell','')):5} {str(pid or '-'):7} {geom:18} {src}")
PY
  # fix status with kill -0
  local tid pid
  for tid in $(reg_all_ids); do
    local raw
    raw="$(reg_get "$tid" 2>/dev/null || true)"
    [[ -n "$raw" ]] || continue
    pid="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pid') or 0)")"
    if is_alive "$pid"; then
      :
    else
      echo "$raw" | python3 -c "
import json,sys
t=json.load(sys.stdin)
t['status']='dead'
print(json.dumps(t))
" | reg_put >/dev/null
    fi
  done
  echo ""
  echo "registry: $REG"
}

reap_quiet() {
  ensure_reg
  local tid pid raw
  for tid in $(reg_all_ids); do
    raw="$(reg_get "$tid" 2>/dev/null || true)"
    [[ -n "$raw" ]] || continue
    pid="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pid') or 0)")"
    if ! is_alive "$pid"; then
      echo "$raw" | python3 -c "
import json,sys
t=json.load(sys.stdin)
t['status']='dead'
t['pid']=None
print(json.dumps(t))
" | reg_put >/dev/null
    fi
  done
}

cmd_reap() {
  reap_quiet
  echo "reaped dead tiles"
  cmd_list
}

cmd_geometry() {
  if [[ -f "$ALIGN_JSON" ]]; then
    echo "align: $ALIGN_JSON"
    python3 -c "import json; d=json.load(open('$ALIGN_JSON')); print(f\"  {d['width']}x{d['height']}  {d['cols']}x{d['rows']}  cells={len(d.get('cells',[]))}\"); print('  selected', d.get('selected')); print('  bbox', d.get('selection_bbox'))"
  else
    echo "align JSON missing — using fallback ${FB_W}x${FB_H} ${FB_COLS}x${FB_ROWS}"
    echo "  generate: bash scripts/live-demux/cast-tv.sh align --no-cast"
  fi
  echo "origin screen offset: +${ORIGIN_X}+${ORIGIN_Y}"
}

cmd_load() {
  need ffplay
  local cell_or_id="${1:-}"
  local src="${2:-}"
  shift 2 2>/dev/null || true
  local force_id=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --id) force_id="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  [[ -n "$cell_or_id" && -n "$src" ]] || {
    echo "usage: $0 load <cell|id> <url|null|camIndex> [--id TID]"
    exit 2
  }

  local tid cell x y w h n geom
  if [[ "$cell_or_id" =~ ^t[0-9A-Za-z]+$ ]] && [[ -n "$force_id" || ! "$cell_or_id" =~ ^t[0-9]+$ ]]; then
    tid="${force_id:-$cell_or_id}"
    # if existing tile, reuse cell geom
    if raw="$(reg_get "$tid" 2>/dev/null)"; then
      n="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin).get('cell') or 1)")"
      geom="$(cell_geom "$n")"
    else
      geom="$(cell_geom 1)"
    fi
  elif [[ "$cell_or_id" =~ ^t([0-9]+)$ ]]; then
    tid="$cell_or_id"
    n="${BASH_REMATCH[1]}"
    geom="$(cell_geom "$n")"
  else
    geom="$(cell_geom "$cell_or_id")"
    n="$(echo "$geom" | awk '{print $1}')"
    tid="${force_id:-t${n}}"
  fi
  read -r n x y w h <<<"$geom"
  # optional size overrides
  if [[ -n "${LIVE_DEMUX_TILE_W:-}" ]]; then w="$LIVE_DEMUX_TILE_W"; fi
  if [[ -n "${LIVE_DEMUX_TILE_H:-}" ]]; then h="$LIVE_DEMUX_TILE_H"; fi
  w=$(( w - w % 2 )); h=$(( h - h % 2 ))

  local kind
  kind="$(classify_source "$src")"
  local work="$TILES_DIR/$tid"
  mkdir -p "$work"
  echo "==> load $tid  cell=$n  kind=$kind  ${w}x${h}+${x}+${y}"
  echo "    source: $src"

  local play
  play="$(resolve_play "$kind" "$src" "$work")" || exit 1

  local title="tile $tid · cell $n · $kind"
  local pid
  pid="$(spawn_ffplay "$tid" "$x" "$y" "$w" "$h" "$play" "$kind" "$title")"

  local status="running"
  [[ "$pid" == "dead" ]] && status="dead" && pid=null

  python3 - <<PY | reg_put >/dev/null
import json, time
print(json.dumps({
  "id": "$tid",
  "cell": $n,
  "source": """$src""",
  "kind": "$kind",
  "pid": $pid if "$pid" != "null" else None,
  "x": $x, "y": $y, "w": $w, "h": $h,
  "status": "$status",
  "started_at": time.time(),
  "play": """$play"""[:200],
  "log": "$work/tile.log",
}))
PY
  echo "  pid $pid · status $status · log $work/tile.log"
  echo "  close: $0 close $tid"
}

cmd_place() {
  local tid="${1:-}"
  local cell="${2:-}"
  [[ -n "$tid" && -n "$cell" ]] || { echo "usage: $0 place <id> <cell>"; exit 2; }
  local raw
  raw="$(reg_get "$tid")" || { echo "error: unknown tile $tid"; exit 1; }
  local src kind
  src="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin)['source'])")"
  # reload at new cell (ffplay can't move reliably without restart)
  echo "==> place $tid → cell $cell (restart)"
  cmd_load "$cell" "$src" --id "$tid"
}

cmd_move() {
  local tid="${1:-}"
  local x="${2:-}"
  local y="${3:-}"
  [[ -n "$tid" && -n "$x" && -n "$y" ]] || { echo "usage: $0 move <id> <x> <y>"; exit 2; }
  local raw
  raw="$(reg_get "$tid")" || { echo "error: unknown tile $tid"; exit 1; }
  local src w h
  src="$(echo "$raw" | python3 -c "import json,sys; t=json.load(sys.stdin); print(t['source']); print(t['w']); print(t['h'])")"
  local source ww hh
  source="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin)['source'])")"
  ww="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin)['w'])")"
  hh="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin)['h'])")"
  local kind play work title pid
  kind="$(classify_source "$source")"
  work="$TILES_DIR/$tid"
  play="$(resolve_play "$kind" "$source" "$work")" || exit 1
  title="tile $tid · moved"
  pid="$(spawn_ffplay "$tid" "$x" "$y" "$ww" "$hh" "$play" "$kind" "$title")"
  local status="running"
  [[ "$pid" == "dead" ]] && status="dead" && pid=null
  local cell
  cell="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin).get('cell') or 0)")"
  python3 - <<PY | reg_put >/dev/null
import json, time
print(json.dumps({
  "id": "$tid", "cell": $cell, "source": """$source""", "kind": "$kind",
  "pid": $pid if "$pid" != "null" else None,
  "x": $x, "y": $y, "w": $ww, "h": $hh,
  "status": "$status", "started_at": time.time(), "log": "$work/tile.log",
}))
PY
  echo "moved $tid → +${x}+${y} pid $pid"
}

cmd_close() {
  local who="${1:-}"
  [[ -n "$who" ]] || { echo "usage: $0 close <id|all>"; exit 2; }
  if [[ "$who" == "all" ]]; then
    local tid
    for tid in $(reg_all_ids); do
      cmd_close "$tid" || true
    done
    return 0
  fi
  local raw pid work
  raw="$(reg_get "$who" 2>/dev/null || true)"
  if [[ -n "$raw" ]]; then
    pid="$(echo "$raw" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pid') or 0)")"
    work="$TILES_DIR/$who"
    if is_alive "$pid"; then
      kill "$pid" 2>/dev/null || true
      # also kill children ffplay
      pkill -P "$pid" 2>/dev/null || true
      sleep 0.15
      kill -9 "$pid" 2>/dev/null || true
    fi
    # kill by window title pattern
    pkill -f "window_title tile $who" 2>/dev/null || true
    reg_del "$who"
    rm -f "$work/tile.pid"
    echo "closed $who"
  else
    echo "warn: $who not in registry — pkill by title"
    pkill -f "tile $who" 2>/dev/null || true
  fi
}

cmd_from_select() {
  need ffplay
  [[ -f "$ALIGN_JSON" ]] || {
    echo "error: no $ALIGN_JSON — run: bash scripts/live-demux/cast-tv.sh align --no-cast"
    exit 1
  }
  local cells
  cells="$(python3 -c "import json; d=json.load(open('$ALIGN_JSON')); print(' '.join(str(n) for n in (d.get('selected') or [])))")"
  if [[ -z "$cells" ]]; then
    echo "no selected cells in align JSON — open align-ui, select, export, or:"
    echo "  LIVE_DEMUX_CAST_ALIGN_SELECT='1,2,5-8' bash scripts/live-demux/cast-tv.sh align --no-cast"
    exit 1
  fi
  echo "==> from-select: $cells"
  local c
  for c in $cells; do
    cmd_load "$c" "null" || true
  done
  cmd_list
}

cmd_status() {
  echo "==> tile plane · fc-tile-plane-v1"
  echo "  dir: $TILES_DIR"
  cmd_geometry
  echo ""
  cmd_list
  local n_ff
  n_ff="$(pgrep -fl ffplay 2>/dev/null | wc -l | tr -d ' ')"
  echo "ffplay processes (system): $n_ff"
}

cmd_help() {
  sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'
}

case "$CMD" in
  list|ls) cmd_list ;;
  status) cmd_status ;;
  geometry|geom|align) cmd_geometry ;;
  load|open|add) cmd_load "$@" ;;
  place|slot) cmd_place "$@" ;;
  move) cmd_move "$@" ;;
  close|kill|stop|rm) cmd_close "$@" ;;
  reap|gc|clean) cmd_reap ;;
  from-select|from_select|selected) cmd_from_select ;;
  help|-h|--help) cmd_help ;;
  *)
    echo "unknown: $CMD"
    cmd_help
    exit 2
    ;;
esac
