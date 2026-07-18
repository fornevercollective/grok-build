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

SYSTEM = """You are Memory Glass + flip-train overnight ops. Offline only — no inventing metrics.
Write a crisp morning brief for an engineer from the evidence pack.

Priority order (highest first):
1) Train model test_eval / metrics curve / top_weights
2) Flip board refresh stamp (is rows.json live or stale?)
3) Learn/soak cycle counts and crashes
4) WebGrid agent_end peaks only (never lobby marketing)

Hard rules:
- BPS means bits per second from WebGrid formula log2(N²-1)*NTPM/60 — NOT audio bitrate.
- NTPM means net targets per minute — NOT "non-terminating pause message".
- 10.39 BPS on the public page is MARKETING (implant PR). Never call it the session score.
- 40×40 is marketing; live grids are 12×12 or 30×30 only.
- WebGrid agent is synthetic pointer skill, NOT BCI implant performance.
- Flip domain is MACD/Bollinger board timing from Yahoo (and X cashtag universe when merged).
- If evidence includes ANALYSIS_ROWS_AND_FEATURES.md or model test_eval, LEAD with that.
- Rank top 3 concrete next actions (refresh board, retrain, resign, scrape, etc.).
- Keep under ~450 words. Markdown with ## headings.
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
    learn = run_dir / "learn.jsonl"
    summary = run_dir / "summary.md"
    analysis = run_dir / "ANALYSIS_ROWS_AND_FEATURES.md"
    still = run_dir / "still-server.log"
    launch = Path.home() / "Library/Logs/MemoryGlass/launch.log"
    play = Path.home() / ".panda/mg-soak/watch/play.jsonl"
    train_metrics = Path.home() / ".panda/mg-soak/train/metrics.jsonl"
    train_model = Path.home() / ".panda/mg-soak/train/model.json"
    train_manifest = Path.home() / ".panda/mg-soak/train/manifest.json"
    refresh_stamp = Path.home() / ".panda/mg-soak/flip-board-live/REFRESH_STAMP.json"

    stats = _parse_soak(soak if soak.exists() else learn)
    peaks = _webgrid_peaks(play)

    parts = [
        f"# Run directory\n{run_dir}",
        f"\n# Parsed soak/learn stats\n```json\n{json.dumps(stats, indent=2)}\n```",
    ]
    if summary.exists():
        parts.append("\n# Existing summary.md\n" + summary.read_text(errors="replace")[:4000])
    if analysis.exists():
        parts.append(
            "\n# Analysis (stale board / features) — TRUST THIS OVER LOBBY MARKETING\n"
            + analysis.read_text(errors="replace")[:5000]
        )
    # Train bus — primary truth for overnight learn
    if train_manifest.exists():
        try:
            man = json.loads(train_manifest.read_text())
            parts.append(
                "\n# Train manifest stats (joint WebGrid+flip bus)\n```json\n"
                + json.dumps(man.get("stats") or man, indent=2)[:2000]
                + "\n```"
            )
        except Exception:
            pass
    if train_model.exists():
        try:
            mod = json.loads(train_model.read_text())
            slim = {
                "iso": mod.get("iso"),
                "n_train": mod.get("n_train"),
                "n_test": mod.get("n_test"),
                "test_eval": mod.get("test_eval"),
                "top_weights": (mod.get("top_weights") or [])[:5],
                "honest_note": mod.get("honest_note"),
            }
            parts.append(
                "\n# Final model (logreg) — primary outcome\n```json\n"
                + json.dumps(slim, indent=2)
                + "\n```"
            )
        except Exception:
            pass
    if train_metrics.exists():
        mets = _tail_lines(train_metrics, 8)
        parts.append("\n# Train metrics tail (curve)\n```\n" + "\n".join(mets) + "\n```")
    if refresh_stamp.exists():
        parts.append(
            "\n# Flip board refresh stamp\n```json\n"
            + refresh_stamp.read_text(errors="replace")[:1500]
            + "\n```"
        )
    parts.append("\n# soak/learn.jsonl tail\n```\n" + "\n".join(_tail_lines(learn if learn.exists() else soak, 30)) + "\n```")
    if still.exists():
        parts.append("\n# still-server.log tail\n```\n" + "\n".join(_tail_lines(still, 15)) + "\n```")
    if launch.exists():
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
        # only peaks with N in 12/30 or from agent_end
        clean = [
            p
            for p in peaks
            if p.get("kind") in ("agent_end", "agent_round_result", "agent_session")
            or (isinstance(p.get("peakBps"), (int, float)) and p.get("peakBps") != 10.39)
        ]
        parts.append(
            "\n# WebGrid agent peaks only (ignore marketing 10.39)\n```json\n"
            + json.dumps(clean[-8:], indent=2)[:2500]
            + "\n```"
        )
    parts.append(
        "\n# Known MG facts (do not invent)\n"
        "- WebGrid agent = synthetic pointer, NOT BCI implant\n"
        "- Marketing page text often contains 10.39 BPS and 40×40 — never treat as live score\n"
        "- Public grid sizes are 12×12 or 30×30 only\n"
        "- BPS = log2(N²-1)*NTPM/60 (bits per second), not bitrate\n"
        "- NTPM = net targets per minute, not a pause message\n"
        "- Flip board: MACD/BB multi-timeframe from Yahoo; refresh stamp tells if live\n"
        "- Codesign SIGKILL → scripts/resign-app.sh\n"
        "- Prefer train_eval/test_eval and top_weights over lobby snippets\n"
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
