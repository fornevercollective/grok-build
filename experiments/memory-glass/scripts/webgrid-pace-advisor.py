#!/usr/bin/env python3
"""Live WebGrid pacing advisor via llama3.2:1b (offline Ollama).

Reads ~/.panda/mg-soak/watch/play.jsonl tails, writes pace.json for the
collector to serve at GET http://127.0.0.1:9880/pace

webgrid-play.js polls /pace when ?mg_local_llm=1 or localStorage mg.local_llm=1.

Usage:
  MG_LOCAL_LLM=1 python3 scripts/webgrid-pace-advisor.py
  MG_LOCAL_LLM=1 python3 scripts/webgrid-pace-advisor.py --once
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mg_local_llm as llm  # noqa: E402

OUT = Path.home() / ".panda/mg-soak/watch"
JSONL = OUT / "play.jsonl"
PACE = OUT / "pace.json"

SYSTEM = """You tune a WebGrid click agent. Reply with ONLY one JSON object, no markdown:
{"sleep_ms":N,"wait_loops":N,"note":"short","mode":"aggro|steady|safe"}
Rules:
- sleep_ms: 2..40 (delay after each hit scan step)
- wait_loops: 4..30 (how long to wait for blue cell to move)
- If NTPM high and climbing: slightly more aggro (lower sleep)
- If missGuess high or BPS falling: safer (higher sleep)
- 12x12 vs 30x30: 12 can be slightly more aggro
- Never invent scores; use provided numbers only.
"""


def recent_samples(n: int = 25) -> list[dict]:
    if not JSONL.exists():
        return []
    lines = JSONL.read_text(encoding="utf-8", errors="replace").splitlines()[-n:]
    out = []
    for line in lines:
        try:
            out.append(json.loads(line))
        except Exception:
            continue
    return out


def _clean_n(raw) -> int | None:
    """Public WebGrid only 12 or 30 — never marketing 40."""
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return None
    return n if n in (12, 30) else None


def _clean_bps(bps, ntpm, phase: str | None) -> float | None:
    """Drop marketing 10.39 when not a real playing sample."""
    if not isinstance(bps, (int, float)):
        return None
    if phase not in ("playing", None) and phase != "playing":
        # allow agent_tick without phase
        pass
    # classic marketing bar without NTPM
    if abs(float(bps) - 10.39) < 0.001 and not isinstance(ntpm, (int, float)):
        return None
    return float(bps)


def digest(samples: list[dict]) -> dict:
    # Prefer agent_tick / samples with timer (live play), not lobby
    ticks = [s for s in samples if s.get("kind") == "agent_tick"]
    playing = [
        s
        for s in samples
        if s.get("phase") == "playing"
        or (s.get("timer") and str(s.get("timer")).count(":") == 1)
    ]
    pool = ticks or playing or []
    last = pool[-1] if pool else {}
    bps = _clean_bps(last.get("bps"), last.get("ntpm"), last.get("phase"))
    ntpm = last.get("ntpm") if isinstance(last.get("ntpm"), (int, float)) else None
    grid = last.get("grid")
    timer = last.get("timer")
    bps_series = [
        _clean_bps(s.get("bps"), s.get("ntpm"), s.get("phase"))
        for s in pool
    ]
    bps_series = [x for x in bps_series if x is not None]
    trend = "flat"
    if len(bps_series) >= 3:
        if bps_series[-1] > bps_series[0] * 1.05:
            trend = "up"
        elif bps_series[-1] < bps_series[0] * 0.95:
            trend = "down"
    N = None
    if grid and re.match(r"^\d+x\d+$", str(grid)):
        N = _clean_n(str(grid).split("x")[0])
    if N is None:
        N = _clean_n(last.get("N"))
    return {
        "bps": bps,
        "ntpm": ntpm,
        "grid": f"{N}x{N}" if N else None,
        "N": N,
        "timer": timer,
        "trend": trend,
        "last_kind": last.get("kind"),
        "clicks": last.get("clicks"),
        "missGuess": last.get("missGuess"),
        "truth": True,
    }


def heuristic(d: dict) -> dict:
    """Fallback if LLM down — deterministic pace."""
    N = d.get("N") or 30
    trend = d.get("trend") or "flat"
    sleep_ms = 8 if N == 12 else 10
    wait_loops = 12 if N == 12 else 16
    if trend == "up":
        sleep_ms = max(3, sleep_ms - 2)
        wait_loops = max(6, wait_loops - 2)
    if trend == "down":
        sleep_ms = min(28, sleep_ms + 4)
        wait_loops = min(28, wait_loops + 4)
    return {
        "sleep_ms": sleep_ms,
        "wait_loops": wait_loops,
        "note": f"heuristic trend={trend} N={N}",
        "mode": "steady",
        "source": "heuristic",
        "t": time.time(),
        "digest": d,
    }


def ask_llm(d: dict) -> dict:
    prompt = "Current WebGrid telemetry:\n" + json.dumps(d)
    raw = llm.chat(prompt, system=SYSTEM, kind="pace", temperature=0.1)
    # extract JSON
    m = re.search(r"\{[^{}]+\}", raw, re.S)
    if not m:
        h = heuristic(d)
        h["note"] = "llm_no_json; " + h["note"]
        h["raw"] = raw[:200]
        return h
    try:
        o = json.loads(m.group(0))
    except Exception:
        h = heuristic(d)
        h["raw"] = raw[:200]
        return h
    sleep_ms = int(o.get("sleep_ms", 10))
    wait_loops = int(o.get("wait_loops", 16))
    sleep_ms = max(2, min(40, sleep_ms))
    wait_loops = max(4, min(30, wait_loops))
    mode = str(o.get("mode") or "steady")
    if mode not in ("aggro", "steady", "safe"):
        mode = "steady"
    return {
        "sleep_ms": sleep_ms,
        "wait_loops": wait_loops,
        "note": str(o.get("note") or "")[:120],
        "mode": mode,
        "source": "ollama",
        "model": llm.model("pace"),
        "t": time.time(),
        "digest": d,
    }


def write_pace(obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PACE.write_text(json.dumps(obj, indent=2))
    print(
        f"PACE sleep_ms={obj.get('sleep_ms')} wait={obj.get('wait_loops')} "
        f"mode={obj.get('mode')} src={obj.get('source')} note={obj.get('note')}",
        flush=True,
    )


def once(force: bool = False) -> int:
    if not force and not llm.enabled():
        print("MG_LOCAL_LLM not set — skip")
        return 0
    d = digest(recent_samples())
    if not d.get("bps") and not d.get("timer") and not d.get("grid"):
        obj = heuristic({"trend": "flat", "N": 30})
        obj["note"] = "no telemetry yet; default"
        write_pace(obj)
        return 0
    if llm.alive():
        try:
            obj = ask_llm(d)
        except Exception as e:
            obj = heuristic(d)
            obj["note"] = f"llm_err {e}; " + obj["note"]
    else:
        obj = heuristic(d)
        obj["note"] = "ollama_down; " + obj["note"]
    write_pace(obj)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--interval", type=float, default=8.0)
    args = ap.parse_args()
    if args.once:
        return once(force=args.force)
    if not args.force and not llm.enabled():
        print("Set MG_LOCAL_LLM=1 or pass --force", file=sys.stderr)
        return 1
    print(f"pace advisor loop interval={args.interval}s → {PACE}", flush=True)
    while True:
        try:
            once(force=True)
        except Exception as e:
            print("pace_err", e, flush=True)
        time.sleep(max(3.0, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
