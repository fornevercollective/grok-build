#!/usr/bin/env python3
"""Generate offline morning brief for an MG soak run via Ollama.

Usage:
  MG_LOCAL_LLM=1 python3 scripts/soak-morning-brief.py ~/.panda/mg-soak/run-<epoch>
  python3 scripts/soak-morning-brief.py --run-dir PATH [--force]

Writes:
  <run>/morning-brief.md
  <run>/morning-brief.json  (meta: model, tokens estimate, ts)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

# allow sibling import
sys.path.insert(0, str(Path(__file__).resolve().parent))
import mg_local_llm as llm  # noqa: E402

SYSTEM = """You are Memory Glass overnight ops. Offline only — no cloud, no inventing metrics.
Given soak telemetry, write a crisp morning brief for an engineer.
Rules:
- Use ONLY numbers present in the evidence. If missing, say unknown.
- Classify crashes: codesign / glass-reassert / OOM-ish RSS / WebKit / unknown.
- Rank top 3 concrete fixes for today (actionable, files/scripts if known).
- Separate shell liveness from browser quality (Speedometer etc. not claimed).
- Keep under ~400 words. Markdown with ## headings.
"""


def _tail_lines(path: Path, n: int = 80) -> list[str]:
    if not path.exists():
        return []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return lines[-n:]
    except Exception:
        return []


def _parse_soak(jsonl: Path) -> dict:
    kinds: Counter[str] = Counter()
    crashes = 0
    injects = 0
    relaunches = 0
    rss_vals: list[float] = []
    samples = 0
    for line in _tail_lines(jsonl, 5000) if jsonl.exists() else []:
        # full file for small runs
        pass
    if jsonl.exists():
        try:
            raw = jsonl.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            raw = []
        for line in raw:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            k = o.get("kind") or "?"
            kinds[k] += 1
            samples += 1
            msg = str(o.get("msg") or "")
            if k == "crash":
                crashes += 1
            if k == "inject":
                injects += 1
            if k == "relaunch":
                relaunches += 1
            m = re.search(r"rss_mb=([\d.]+)", msg)
            if m:
                try:
                    rss_vals.append(float(m.group(1)))
                except ValueError:
                    pass
    return {
        "kinds": dict(kinds),
        "crashes": crashes,
        "injects": injects,
        "relaunches": relaunches,
        "samples": samples,
        "rss_min": min(rss_vals) if rss_vals else None,
        "rss_max": max(rss_vals) if rss_vals else None,
        "rss_last": rss_vals[-1] if rss_vals else None,
    }


def _webgrid_peaks(play_jsonl: Path) -> list[dict]:
    peaks = []
    if not play_jsonl.exists():
        return peaks
    try:
        lines = play_jsonl.read_text(encoding="utf-8", errors="replace").splitlines()[-400:]
    except Exception:
        return peaks
    for line in lines:
        try:
            o = json.loads(line)
        except Exception:
            continue
        if o.get("kind") in ("agent_end", "agent_round_result", "agent_session"):
            peaks.append(
                {
                    "kind": o.get("kind"),
                    "peakBps": o.get("peakBps") or (o.get("peak") or {}).get("bps"),
                    "peakNtpm": o.get("peakNtpm") or (o.get("peak") or {}).get("ntpm"),
                    "N": o.get("N"),
                    "grid": o.get("grid"),
                    "bestBps": o.get("bestBps"),
                    "clicks": o.get("clicks"),
                    "beatPrior": o.get("beatPrior"),
                }
            )
        sn = o.get("snippet") or ""
        m = re.search(
            r"peak score:\s*([\d.]+)\s*BPS\s*\(([\d.]+)\s*NTPM\)", sn, re.I
        )
        if m and o.get("phase") == "end":
            peaks.append(
                {
                    "kind": "page_peak",
                    "peakBps": float(m.group(1)),
                    "peakNtpm": float(m.group(2)),
                }
            )
    return peaks[-12:]


def build_evidence(run_dir: Path) -> str:
    soak = run_dir / "soak.jsonl"
    summary = run_dir / "summary.md"
    still = run_dir / "still-server.log"
    launch = Path.home() / "Library/Logs/MemoryGlass/launch.log"
    play = Path.home() / ".panda/mg-soak/watch/play.jsonl"

    stats = _parse_soak(soak)
    peaks = _webgrid_peaks(play)

    parts = [
        f"# Run directory\n{run_dir}",
        f"\n# Parsed soak stats\n```json\n{json.dumps(stats, indent=2)}\n```",
    ]
    if summary.exists():
        parts.append("\n# Existing summary.md\n" + summary.read_text(errors="replace")[:4000])
    parts.append("\n# soak.jsonl tail\n```\n" + "\n".join(_tail_lines(soak, 40)) + "\n```")
    if still.exists():
        parts.append("\n# still-server.log tail\n```\n" + "\n".join(_tail_lines(still, 15)) + "\n```")
    if launch.exists():
        # only MG-relevant tails
        tail = _tail_lines(launch, 200)
        filt = [
            ln
            for ln in tail
            if any(
                x in ln
                for x in (
                    "page_zoom",
                    "webgrid layout",
                    "hotpipe",
                    "crash",
                    "SIG",
                    "Codesign",
                    "MG_WATCH",
                    "AGENT",
                )
            )
        ][-40:]
        if filt:
            parts.append("\n# launch.log filtered tail\n```\n" + "\n".join(filt) + "\n```")
    if peaks:
        parts.append(
            "\n# Recent WebGrid agent/page peaks\n```json\n"
            + json.dumps(peaks, indent=2)[:3000]
            + "\n```"
        )
    parts.append(
        "\n# Known MG context (facts)\n"
        "- WebGrid: 12×12 if viewport mobile (w≤751|h≤600), else 30×30\n"
        "- Agent peaks (historical): ~483 BPS 30×30, ~402 BPS 12×12 (synthetic pointer, not BCI)\n"
        "- Invalid code signature → taskgated SIGKILL; fix with scripts/resign-app.sh\n"
        "- Public BCI bar ~10.39 BPS is marketing implant path, not mouse agent\n"
    )
    return "\n".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("run_dir", nargs="?", help="path to run-* directory")
    ap.add_argument("--run-dir", dest="run_dir_opt")
    ap.add_argument("--force", action="store_true", help="run even if MG_LOCAL_LLM unset")
    ap.add_argument(
        "--reason",
        action="store_true",
        help="use deepseek-r1 style reason model",
    )
    args = ap.parse_args()
    run_dir = Path(args.run_dir_opt or args.run_dir or "").expanduser()
    if not run_dir.is_dir():
        # latest run
        root = Path.home() / ".panda/mg-soak"
        runs = sorted(root.glob("run-*"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not runs:
            print("no run dir", file=sys.stderr)
            return 1
        run_dir = runs[0]
        print(f"using latest {run_dir}")

    if not args.force and not llm.enabled():
        print("MG_LOCAL_LLM not set — skip brief (use --force or MG_LOCAL_LLM=1)")
        return 0

    out_md = run_dir / "morning-brief.md"
    out_meta = run_dir / "morning-brief.json"

    if not llm.alive():
        stub = (
            "# Morning brief (offline LLM unavailable)\n\n"
            f"Ollama not reachable at {llm.HOST}.\n\n"
            "Start: `ollama serve` then re-run:\n"
            f"`MG_LOCAL_LLM=1 python3 scripts/soak-morning-brief.py {run_dir}`\n\n"
            "## Raw summary\n\n"
            + (
                (run_dir / "summary.md").read_text(errors="replace")
                if (run_dir / "summary.md").exists()
                else "_no summary.md_"
            )
        )
        out_md.write_text(stub)
        out_meta.write_text(
            json.dumps(
                {"ok": False, "error": "ollama_down", "host": llm.HOST, "t": time.time()},
                indent=2,
            )
        )
        print(stub[:500])
        return 2

    kind = "reason" if args.reason else "brief"
    evidence = build_evidence(run_dir)
    # Cap evidence — huge prompts slow cold-start models
    prompt = (
        "Write the morning brief from this evidence.\n\n" + evidence[:14000]
    )
    # Prefer configured model; fall back to smaller if timeout
    candidates = [llm.model(kind)]
    for fb in ("granite3.2:latest", "mistral:latest", "llama3.2:1b"):
        if fb not in candidates:
            candidates.append(fb)
    t0 = time.time()
    text = ""
    m = candidates[0]
    last_err: Exception | None = None
    for cand in candidates:
        m = cand
        try:
            print(f"brief trying model={m} …", flush=True)
            text = llm.chat(prompt, system=SYSTEM, model_name=m, temperature=0.15)
            if text:
                break
        except Exception as e:
            last_err = e
            print(f"brief model={m} failed: {e}", flush=True)
            continue
    if not text:
        err = f"# Morning brief failed\n\n`{last_err}`\n"
        out_md.write_text(err)
        out_meta.write_text(
            json.dumps({"ok": False, "error": str(last_err), "t": time.time()}, indent=2)
        )
        print(err, file=sys.stderr)
        return 3

    header = (
        f"<!-- mg morning-brief model={m} host={llm.HOST} "
        f"elapsed_s={time.time() - t0:.1f} -->\n\n"
    )
    out_md.write_text(header + text + "\n")
    out_meta.write_text(
        json.dumps(
            {
                "ok": True,
                "model": m,
                "kind": kind,
                "host": llm.HOST,
                "elapsed_s": round(time.time() - t0, 2),
                "run_dir": str(run_dir),
                "t": time.time(),
            },
            indent=2,
        )
    )
    print(f"wrote {out_md} ({m}, {time.time() - t0:.1f}s)")
    print(text[:800])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
