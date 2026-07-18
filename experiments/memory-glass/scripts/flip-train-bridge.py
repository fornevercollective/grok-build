#!/usr/bin/env python3
"""Bridge WebGrid agent training ↔ live stock RSI/MACD/Bollinger flip training.

Unified trial schema so both domains train the same sequential "signal skill":

  domain=webgrid | flip
  t, features[], label, meta{}

WebGrid source:  ~/.panda/mg-soak/watch/play.jsonl  (agent_tick / agent_end)
Flip source:     crossover data/rows.json  (MACD/BB frames + potentials)

Outputs:
  ~/.panda/mg-soak/train/trials.jsonl     — unified trials
  ~/.panda/mg-soak/train/manifest.json    — counts + paths
  ~/.panda/mg-soak/train/flip_live.jsonl  — flip trials only (live board snapshot)

Usage:
  python3 scripts/flip-train-bridge.py
  python3 scripts/flip-train-bridge.py --rows /path/to/crossover/data/rows.json
  python3 scripts/flip-train-bridge.py --webgrid-only

Does not delete any project data. Read-only on sources.
"""
from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path
from typing import Any

PANDA = Path.home() / ".panda" / "mg-soak"
PLAY = PANDA / "watch" / "play.jsonl"
OUT_DIR = PANDA / "train"
DEFAULT_ROWS = Path("/Volumes/qbitOS/00.dev/cursor/crossover/data/rows.json")


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def webgrid_trials(path: Path, limit: int = 20000) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    # Prefer agent_* events; fall back to playing samples with timer
    raw_lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    lines = raw_lines[-limit:]
    out: list[dict[str, Any]] = []
    for line in lines:
        try:
            o = json.loads(line)
        except Exception:
            continue
        kind = o.get("kind")
        # Contrail path phrasing (kbatch-style movement tokens) → predictive features
        if kind in ("contrail_stroke", "contrail_summary"):
            feats = o.get("features") or []
            if not isinstance(feats, list) or len(feats) < 3:
                st = o.get("stats") or {}
                feats = [
                    float(st.get("samples") or o.get("n") or 0),
                    float(st.get("strokes") or o.get("turns") or 0),
                    float(st.get("totalLen") or o.get("len") or 0),
                    float(st.get("meanV") or o.get("meanV") or 0),
                    float(st.get("maxV") or o.get("maxV") or 0),
                    float(st.get("turnRate") or o.get("turnRate") or 0),
                ]
            while len(feats) < 6:
                feats.append(0.0)
            out.append(
                {
                    "domain": "webgrid_contrail",
                    "t": o.get("t") or time.time(),
                    "kind": kind,
                    "features": {
                        "signal_strength": _clamp01(float(feats[3]) / 3.0),
                        "event_rate": _clamp01(float(feats[5])),
                        "resolution": _clamp01(float(feats[0]) / 200.0),
                        "accuracy": _clamp01(1.0 - min(1.0, float(feats[5]))),
                        "exposure": _clamp01(float(feats[1]) / 40.0),
                        "rsi_proxy": _clamp01(float(feats[2]) * 2.0),
                        "macd_hist_proxy": _clamp01(float(feats[4]) / 4.0),
                        "bb_width_proxy": _clamp01(float(o.get("hops") or 0) / 20.0),
                    },
                    "label": int(o.get("label") if o.get("label") is not None else 1),
                    "meta": {
                        "phrase": (o.get("phrase") or (o.get("stats") or {}).get("lastPhrase") or "")[
                            :64
                        ],
                        "turns": o.get("turns"),
                        "hops": o.get("hops"),
                        "kbatch_style": True,
                    },
                }
            )
            continue
        if kind not in ("agent_tick", "agent_end", "agent_round_result", "sample"):
            continue
        # Truth filter (P-001)
        phase = o.get("phase")
        timer = o.get("timer")
        bps = o.get("bps")
        ntpm = o.get("ntpm")
        N = o.get("N")
        grid = o.get("grid")
        if isinstance(grid, str) and "x" in grid:
            try:
                N = int(grid.split("x")[0])
            except ValueError:
                pass
        if N is not None and N not in (12, 30):
            N = None
            grid = None
        if isinstance(bps, (int, float)) and abs(float(bps) - 10.39) < 0.001:
            if phase == "lobby" or not timer:
                continue
        if kind == "sample":
            if phase == "lobby":
                continue
            if phase != "playing" and not timer:
                continue
            # skip pure marketing peaks without live timer
            if not timer and not (o.get("peak") and phase == "end"):
                continue

        # Features aligned to skill channel (rate / accuracy / scale)
        # Map: bps→signal_strength, ntpm→event_rate, N→resolution, clicks→exposure
        clicks = o.get("clicks") or 0
        miss = o.get("missGuess") or o.get("misses") or 0
        hits = o.get("hitsGuess") or o.get("hits") or max(0, int(clicks) - int(miss))
        denom = max(1, int(hits) + int(miss))
        acc = hits / denom
        bps_f = float(bps) if isinstance(bps, (int, float)) else 0.0
        ntpm_f = float(ntpm) if isinstance(ntpm, (int, float)) else 0.0
        # normalize loosely for joint training
        feat = {
            "signal_strength": _clamp01(bps_f / 500.0),  # agent can be high
            "event_rate": _clamp01(ntpm_f / 3000.0),
            "resolution": 0.0 if N == 12 else (1.0 if N == 30 else 0.5),
            "accuracy": _clamp01(acc),
            "exposure": _clamp01(float(clicks) / 4000.0),
            "rsi_proxy": _clamp01(acc),  # skill "conviction"
            "macd_hist_proxy": _clamp01(bps_f / 250.0),
            "bb_width_proxy": 0.3 if N == 12 else 0.7,
        }
        # Label: improving if end peak high relative to session
        peak = o.get("peak") or {}
        peak_bps = peak.get("bps") if isinstance(peak, dict) else o.get("peakBps")
        label = 0
        if isinstance(peak_bps, (int, float)) and peak_bps > 50:
            label = 1
        if kind == "agent_end" and isinstance(bps_f, float) and bps_f > 80:
            label = 1
        if acc > 0.85 and ntpm_f > 200:
            label = 1

        out.append(
            {
                "domain": "webgrid",
                "t": o.get("t") or o.get("_recv") or time.time(),
                "kind": kind,
                "features": feat,
                "label": label,
                "meta": {
                    "N": N,
                    "bps": bps_f,
                    "ntpm": ntpm_f,
                    "timer": timer,
                    "phase": phase,
                    "grid": grid,
                    "channel": "synthetic_pointer",  # not BCI
                },
            }
        )
    return out


def _bias_num(b: str | None) -> float:
    if b == "bullish":
        return 1.0
    if b == "bearish":
        return 0.0
    return 0.5


def _bb_num(p: str | None) -> float:
    # lower → 0, inside → 0.5, upper → 1
    if p == "below_lower":
        return 0.0
    if p == "above_upper":
        return 1.0
    if p == "inside":
        return 0.5
    return 0.5


def flip_trials(rows_path: Path, limit: int = 8000) -> list[dict[str, Any]]:
    if not rows_path.exists():
        return []
    try:
        rows = json.loads(rows_path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return []
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for row in rows[:limit]:
        frames = row.get("frames") or {}
        day = frames.get("day") or {}
        week = frames.get("week") or {}
        month = frames.get("month") or {}
        if not day and not week:
            continue
        pot = (row.get("potentials") or {}).get("day") or {}
        # RSI proxy from multi-TF alignment (no raw RSI in board — use bias stack)
        biases = [
            _bias_num(frames.get(tf, {}).get("macdBias"))
            for tf in ("month", "week", "day")
            if frames.get(tf)
        ]
        align = sum(biases) / max(1, len(biases))
        macd = _bias_num(day.get("macdBias"))
        hist = _bias_num(day.get("histogramBias"))
        tension = abs(macd - hist)  # hist≠macd → imminent flip
        bb = _bb_num(day.get("bbPosition"))
        dsf = day.get("daysSinceFlip")
        try:
            dsf_f = float(dsf) if dsf is not None else 999.0
        except (TypeError, ValueError):
            dsf_f = 999.0
        freshness = _clamp01(1.0 - min(dsf_f, 30.0) / 30.0)
        win = float(pot.get("winRate") or 0) / 100.0
        ev = float(pot.get("evPct") or 0)
        side = pot.get("side") or "flat"
        feat = {
            "signal_strength": _clamp01(abs(ev) / 5.0),
            "event_rate": freshness,  # recent flips = more events
            "resolution": 0.7,  # day frame
            "accuracy": _clamp01(win),
            "exposure": _clamp01(float(day.get("bars") or 0) / 1500.0),
            "rsi_proxy": align,  # multi-TF as momentum oscillator stand-in
            "macd_hist_proxy": tension,
            "bb_width_proxy": abs(bb - 0.5) * 2,  # edge of bands
            "macd_bias": macd,
            "hist_bias": hist,
            "bb_pos": bb,
            "days_since_flip": _clamp01(dsf_f / 60.0),
            "week_macd": _bias_num(week.get("macdBias")),
            "month_macd": _bias_num(month.get("macdBias")),
        }
        # Label: imminent / actionable flip
        label = 0
        if tension > 0.4:
            label = 1
        if dsf_f <= 2:
            label = 1
        if abs(ev) > 0.5 and win >= 0.35:
            label = 1
        out.append(
            {
                "domain": "flip",
                "t": time.time(),
                "kind": "board_row",
                "features": feat,
                "label": label,
                "meta": {
                    "symbol": row.get("yahoo") or row.get("id"),
                    "sector": row.get("sector"),
                    "side": side,
                    "flipType": (day.get("lastFlip") or {}).get("type"),
                    "winRate": pot.get("winRate"),
                    "evPct": pot.get("evPct"),
                    "close": day.get("close"),
                    "channel": "macd_bb_board",
                },
            }
        )
    return out


def joint_stats(trials: list[dict[str, Any]]) -> dict[str, Any]:
    by = {"webgrid": 0, "flip": 0}
    pos = {"webgrid": 0, "flip": 0}
    for t in trials:
        d = t.get("domain") or "?"
        by[d] = by.get(d, 0) + 1
        if t.get("label"):
            pos[d] = pos.get(d, 0) + 1
    return {"counts": by, "positive_labels": pos, "total": len(trials)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=Path, default=DEFAULT_ROWS)
    ap.add_argument("--play", type=Path, default=PLAY)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    ap.add_argument("--webgrid-only", action="store_true")
    ap.add_argument("--flip-only", action="store_true")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    wg: list[dict] = []
    fl: list[dict] = []
    if not args.flip_only:
        wg = webgrid_trials(args.play)
    if not args.webgrid_only:
        fl = flip_trials(args.rows)

    trials = wg + fl
    trials_path = args.out / "trials.jsonl"
    flip_path = args.out / "flip_live.jsonl"
    with trials_path.open("w") as f:
        for t in trials:
            f.write(json.dumps(t, separators=(",", ":")) + "\n")
    with flip_path.open("w") as f:
        for t in fl:
            f.write(json.dumps(t, separators=(",", ":")) + "\n")

    manifest = {
        "generatedAt": time.time(),
        "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sources": {
            "webgrid_play": str(args.play),
            "flip_rows": str(args.rows),
        },
        "outputs": {
            "trials": str(trials_path),
            "flip_live": str(flip_path),
        },
        "stats": joint_stats(trials),
        "schema": {
            "features": [
                "signal_strength",
                "event_rate",
                "resolution",
                "accuracy",
                "exposure",
                "rsi_proxy",
                "macd_hist_proxy",
                "bb_width_proxy",
            ],
            "note": "WebGrid trains sequential hit skill; flip trains MACD/BB timing — same feature bus",
        },
        "policy": "read-only sources · never delete repos · agent BPS ≠ BCI",
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest["stats"], indent=2))
    print(f"wrote {trials_path} ({len(trials)} trials)")
    print(f"  webgrid={len(wg)} flip={len(fl)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
