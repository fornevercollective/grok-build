#!/usr/bin/env bash
# Refresh flip board: Robinhood universe + X $ cashtags → Yahoo MACD/BB rebuild
# then re-bridge + retrain for MG learn bus.
#
# Usage:
#   bash scripts/refresh-flip-board-live.sh
#   bash scripts/refresh-flip-board-live.sh --limit 500   # faster smoke
#   bash scripts/refresh-flip-board-live.sh --full        # all RH symbols (slow)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RH="${ROBINHOOD_AGENTIC:-/Volumes/qbitOS/00.dev/cursor/robinhood-agentic}"
CROSS="${CROSSOVER_DIR:-/Volumes/qbitOS/00.dev/cursor/crossover}"
PY="$RH/.venv-analysis/bin/python3"
OUT_LIVE="$HOME/.panda/mg-soak/flip-board-live"
MERGE_WL="$OUT_LIVE/watchlists-rh-x.json"
XJSON="$OUT_LIVE/x-cashtags.json"
SEED="$SCRIPT_DIR/seeds/x-cashtags-seed.txt"
LIMIT=0
FULL=0
SKIP_TRAIN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="${2:-0}"; shift 2 ;;
    --full) FULL=1; shift ;;
    --skip-train) SKIP_TRAIN=1; shift ;;
    *) shift ;;
  esac
done

mkdir -p "$OUT_LIVE" "$SCRIPT_DIR/seeds"
[[ -x "$PY" ]] || { echo "missing venv python: $PY"; exit 1; }
[[ -f "$RH/scripts/build_flip_board.py" ]] || { echo "missing build_flip_board.py"; exit 1; }

# seed file for cashtags
if [[ ! -f "$SEED" ]]; then
  cat >"$SEED" <<'EOF'
# X cashtag seed — liquid names + session harvest (not financial advice)
$TSLA $NVDA $AAPL $MSFT $META $GOOGL $AMZN $AMD $ORCL $NFLX $UBER $PDD $APP
$MU $QQQ $SPY $IWM $BABA $SOFI $PLTR $UNH $HIMS $ASTS $OSCR $SE $JOBY $QCOM
$GM $COIN $HOOD $RIVN $ARM $AVGO $TSM $SMCI $DELL $INTC $CRM $SNOW $NET $CRWD
$SHOP $JPM $BAC $XOM $CVX $CAT $BA $DIS $WMT $COST $NKE $TGT $GE $PANW $DDOG
EOF
fi

echo "==> harvest X cashtags"
"$PY" "$SCRIPT_DIR/harvest_x_cashtags.py" --seed "$SEED" -o "$XJSON"

echo "==> merge RH watchlists + X cashtags"
"$PY" - <<PY
import json
from pathlib import Path
from datetime import datetime, timezone

rh_path = Path("$RH/data/robinhood-watchlists.json")
cross_path = Path("$CROSS/data/watchlists.json")
x_path = Path("$XJSON")
out = Path("$MERGE_WL")

base = {}
for p in (rh_path, cross_path):
    if p.exists():
        base = json.loads(p.read_text())
        break
if not base:
    base = {"symbolToLists": {}, "lists": [], "sections": [], "catalog": {}}

stl = dict(base.get("symbolToLists") or {})
x = json.loads(x_path.read_text())
added = 0
for t, lists in (x.get("symbolToLists") or {}).items():
    if t not in stl:
        stl[t] = lists
        added += 1
    else:
        merged = list(dict.fromkeys(list(stl[t]) + list(lists)))
        stl[t] = merged

base["symbolToLists"] = stl
base["exportedAt"] = datetime.now(timezone.utc).isoformat()
base["mergedX"] = {
    "added": added,
    "x_tickers": x.get("n"),
    "total_symbols": len(stl),
    "source": "harvest_x_cashtags + robinhood-watchlists",
}
out.write_text(json.dumps(base, indent=2))
print(f"merged watchlists → {out}")
print(f"  total_symbols={len(stl)}  x_new={added}  x_total={x.get('n')}")
PY

# Build board (Yahoo daily MACD/BB). Full RH universe is slow; default full if --full else use all with progress.
echo "==> build flip board (Yahoo) → $OUT_LIVE"
LIMIT_ARG=()
if [[ "$LIMIT" != "0" ]]; then
  LIMIT_ARG=(--limit "$LIMIT")
elif [[ "$FULL" != "1" ]]; then
  # default: full RH+X (user asked take the time). Still allow --limit for smoke.
  :
fi

# Prefer no --charts first for speed of rows.json; charts optional later
cd "$RH"
set +e
PYTHONUNBUFFERED=1 "$PY" scripts/build_flip_board.py \
  --preset robinhood \
  --watchlists "$MERGE_WL" \
  --output-dir "$OUT_LIVE" \
  "${LIMIT_ARG[@]}"
RC=$?
set -e
if [[ $RC -ne 0 ]]; then
  echo "board build failed rc=$RC"
  exit $RC
fi

# Enrich with profit potentials if possible (needs charts) — skip if no charts
if [[ -f "$OUT_LIVE/rows.json" ]]; then
  echo "==> rows built: $(python3 -c "import json;print(len(json.load(open('$OUT_LIVE/rows.json'))))") symbols"
  python3 - <<PY
import json
from pathlib import Path
from datetime import datetime
p=Path("$OUT_LIVE/rows.json")
rows=json.loads(p.read_text())
asof={}
for r in rows:
  day=(r.get("frames") or {}).get("day") or {}
  a=str(day.get("asOf") or "?")
  asof[a]=asof.get(a,0)+1
print("day.asOf distribution:", sorted(asof.items(), key=lambda x:-x[1])[:8])
print("generated path mtime ok")
# stamp
Path("$OUT_LIVE/REFRESH_STAMP.json").write_text(json.dumps({
  "refreshedAt": datetime.utcnow().isoformat()+"Z",
  "n_rows": len(rows),
  "asOf": asof,
  "watchlists": "$MERGE_WL",
}, indent=2))
PY
fi

# Publish into crossover + robinhood flip-board paths (copy, never delete originals without backup)
echo "==> publish rows.json (backup stale first)"
for DEST in \
  "$CROSS/data/rows.json" \
  "$RH/data/flip-board/rows.json" \
  "$RH/data/crossovers-full/crossover/data/rows.json"
do
  if [[ -f "$DEST" ]]; then
    cp -f "$DEST" "${DEST}.bak-pre-refresh-$(date +%Y%m%d)" 2>/dev/null || true
  fi
  mkdir -p "$(dirname "$DEST")"
  cp -f "$OUT_LIVE/rows.json" "$DEST"
  echo "  → $DEST"
done
if [[ -f "$OUT_LIVE/manifest.json" ]]; then
  cp -f "$OUT_LIVE/manifest.json" "$CROSS/data/manifest.json" 2>/dev/null || true
  cp -f "$OUT_LIVE/manifest.json" "$RH/data/flip-board/manifest.json" 2>/dev/null || true
fi

if [[ "$SKIP_TRAIN" == "1" ]]; then
  echo "skip train"
  exit 0
fi

echo "==> bridge + retrain"
"$PY" "$SCRIPT_DIR/flip-train-bridge.py" --rows "$OUT_LIVE/rows.json"
"$PY" "$SCRIPT_DIR/train-trial-bus.py" --epochs 40 --lr 0.06

echo "==> DONE live refresh"
python3 - <<'PY'
import json
from pathlib import Path
m=json.loads((Path.home()/".panda/mg-soak/train/model.json").read_text())
man=json.loads((Path.home()/".panda/mg-soak/train/manifest.json").read_text())
print("manifest stats", man.get("stats"))
print("test_eval", m.get("test_eval"))
print("top", m.get("top_weights")[:4])
print("model_iso", m.get("iso"))
PY
