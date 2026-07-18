#!/usr/bin/env python3
"""Export slim filmstrip board for Memory Glass MKT rail + agent inject.

Reads full flip-board rows.json (RH ∪ X) and writes:
  ~/.panda/mg-soak/flip-board-live/filmstrip.json
  hotpipe/data/filmstrip-board.json (optional --hotpipe)

Slim schema keeps sector, day MACD/BB, flip recency — enough for iron-condor proxy.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

PANDA = Path.home() / ".panda" / "mg-soak" / "flip-board-live"
DEFAULT_ROWS = PANDA / "rows.json"
DEFAULT_OUT = PANDA / "filmstrip.json"


def slim_row(r: dict) -> dict:
    frames = r.get("frames") or {}
    day = frames.get("day") or frames.get("live") or {}
    return {
        "id": r.get("id") or r.get("yahoo"),
        "name": r.get("name") or r.get("id"),
        "sector": r.get("sector") or "",
        "lists": (r.get("lists") or [])[:6],
        "frames": {
            "day": {
                "asOf": day.get("asOf"),
                "close": day.get("close"),
                "macdBias": day.get("macdBias"),
                "histogramBias": day.get("histogramBias"),
                "bbPosition": day.get("bbPosition"),
                "daysSinceFlip": day.get("daysSinceFlip"),
                "lastFlip": day.get("lastFlip"),
            }
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=Path, default=DEFAULT_ROWS)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--hotpipe", type=Path, default=None, help="Write hotpipe/data/filmstrip-board.json")
    ap.add_argument("--limit", type=int, default=0, help="0 = all")
    ap.add_argument("--prefer-stable", action="store_true")
    args = ap.parse_args()

    if not args.rows.exists():
        print(f"missing {args.rows}")
        return 1

    rows = json.loads(args.rows.read_text(encoding="utf-8"))
    slim = [slim_row(r) for r in rows if r.get("id") or r.get("yahoo")]
    if args.limit and args.limit > 0:
        # prefer recent flips
        slim.sort(key=lambda r: (r.get("frames") or {}).get("day", {}).get("daysSinceFlip") or 999)
        slim = slim[: args.limit]

    as_of = Counter(
        str(((r.get("frames") or {}).get("day") or {}).get("asOf") or "?") for r in slim
    )
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(args.rows),
        "n": len(slim),
        "asOf": as_of.most_common(8),
        "rows": slim,
        "note": "paper research only — no auto-trade",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload), encoding="utf-8")
    print(f"wrote {args.out} n={len(slim)} asOf={as_of.most_common(3)}")

    if args.hotpipe:
        args.hotpipe.parent.mkdir(parents=True, exist_ok=True)
        # cap for repo/hotpipe size
        hot = dict(payload)
        if len(hot["rows"]) > 1200:
            hot["rows"] = hot["rows"][:1200]
            hot["n"] = len(hot["rows"])
            hot["truncated"] = True
        args.hotpipe.write_text(json.dumps(hot), encoding="utf-8")
        print(f"wrote {args.hotpipe} n={hot['n']}")

    # stamp for morning brief
    stamp = {
        "filmstripAt": payload["generatedAt"],
        "n": len(slim),
        "asOf": dict(as_of),
        "path": str(args.out),
    }
    (PANDA / "FILMSTRIP_STAMP.json").write_text(json.dumps(stamp, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
