#!/usr/bin/env bash
# Monthly (or weekly) re-scan of xai-org/grok-build forks → update GO/NOGO tables.
# Usage:
#   bash docs/fornever-ledger/scripts/recheck-forks.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
DATA="$REPO/docs/fornever-ledger/data"
mkdir -p "$DATA"
cd "$REPO"

echo "== fetch fork list =="
gh api --paginate "repos/xai-org/grok-build/forks?per_page=100" > "$DATA/xai-grok-build-forks-raw.jsonl"

python3 - <<'PY'
import json, csv
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone

DATA = Path("docs/fornever-ledger/data")
raw = (DATA / "xai-grok-build-forks-raw.jsonl").read_text()
items = []
dec = json.JSONDecoder()
i = 0
s = raw.strip()
while i < len(s):
    while i < len(s) and s[i].isspace():
        i += 1
    if i >= len(s):
        break
    obj, end = dec.raw_decode(s, i)
    if isinstance(obj, list):
        items.extend(obj)
    elif isinstance(obj, dict):
        items.append(obj)
    i = end
seen = {r["full_name"]: r for r in items}
forks = list(seen.values())
(DATA / "xai-grok-build-forks.json").write_text(json.dumps(forks))

DEFAULT_PREFIXES = ("SpaceXAI's coding agent harness", "SpaceXAI's coding agent")

def is_default_desc(d):
    d = (d or "").strip()
    if not d:
        return True
    if d.startswith(DEFAULT_PREFIXES) and not any(
        k in d for k in ("Devil", "Super AI", "Seerist", "training", "desktop", "spyware", "tweaks", "kraft", "byxai", "lhc")
    ):
        # allow "desktop" only in desc if intentional — default prefix still default
        if "desktop" in d.lower() and not d.startswith(DEFAULT_PREFIXES):
            return False
        return True
    return False

NAME_KW = (
    "desktop", "privacy", "plugin", "switch", "vscode", "oh-my", "sandbox",
    "agent", "matrix", "persona", "workflow", "hack", "tweak", "out", "kraft",
    "seerist", "spyware", "exfil", "hard", "gork", "open-grok", "forge", "axon",
)

def classify(r):
    name = r["full_name"]
    if name.lower() == "fornevercollective/grok-build":
        return "GO", "our_fork", "week"
    stars = r.get("stargazers_count") or 0
    desc = r.get("description") or ""
    unique = not is_default_desc(desc)
    nl = name.lower()
    name_sig = any(k in nl for k in NAME_KW)
    reasons = []
    if stars:
        reasons.append(f"stars={stars}")
    if unique:
        reasons.append("unique_desc")
    if name_sig:
        reasons.append("name_signal")
    if unique or stars >= 5 or (name_sig and (unique or stars >= 1)):
        return "MAYBE", ",".join(reasons) or "signal", "month"
    if stars >= 1 and not unique and not name_sig:
        return "NOGO", "star_mirror_default_desc", "never"
    return "NOGO", "standard_mirror", "never"

rows = []
counts = Counter()
for r in forks:
    v, reason, rec = classify(r)
    counts[v] += 1
    rows.append({
        "full_name": r["full_name"],
        "verdict": v,
        "reason": reason,
        "stars": r.get("stargazers_count") or 0,
        "pushed_at": r.get("pushed_at") or "",
        "updated_at": r.get("updated_at") or "",
        "description": (r.get("description") or "")[:200],
        "default_branch": r.get("default_branch") or "main",
        "html_url": r.get("html_url") or "",
        "size_kb": r.get("size") or 0,
        "recheck": rec,
    })
order = {"GO": 0, "MAYBE": 1, "NOGO": 2}
rows.sort(key=lambda x: (order[x["verdict"]], -int(x["stars"]), x["full_name"]))

with (DATA / "FORK_GONOGO.csv").open("w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
with (DATA / "FORK_GONOGO.jsonl").open("w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")

meta = {
    "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "upstream": "xai-org/grok-build",
    "forks_classified": len(rows),
    "counts": dict(counts),
    "method": "recheck-forks.sh metadata heuristics",
}
(DATA / "FORK_GONOGO_META.json").write_text(json.dumps(meta, indent=2))
print(json.dumps(meta, indent=2))
print("MAYBE top 15:")
for r in [x for x in rows if x["verdict"] == "MAYBE"][:15]:
    print(f"  ★{r['stars']:3} {r['full_name']}")
PY

echo "== done =="
echo "  data: $DATA/FORK_GONOGO.csv"
echo "  doc:  docs/fornever-ledger/FORK_CENSUS_GONOGO.md"
)
