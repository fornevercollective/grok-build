#!/usr/bin/env python3
"""Offline trainer on unified WebGrid + flip trials (pure Python, no numpy).

Reads:  ~/.panda/mg-soak/train/trials.jsonl
Writes: ~/.panda/mg-soak/train/model.json
        ~/.panda/mg-soak/train/metrics.jsonl  (append each run)

Usage:
  python3 scripts/train-trial-bus.py
  python3 scripts/train-trial-bus.py --epochs 40 --lr 0.08
"""
from __future__ import annotations

import argparse
import json
import math
import random
import time
from pathlib import Path
from typing import Any

OUT = Path.home() / ".panda" / "mg-soak" / "train"
TRIALS = OUT / "trials.jsonl"
MODEL = OUT / "model.json"
METRICS = OUT / "metrics.jsonl"

# Shared feature bus (must match flip-train-bridge.py)
FEAT_KEYS = [
    "signal_strength",
    "event_rate",
    "resolution",
    "accuracy",
    "exposure",
    "rsi_proxy",
    "macd_hist_proxy",
    "bb_width_proxy",
]


def load_trials(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            o = json.loads(line)
        except Exception:
            continue
        f = o.get("features") or {}
        if not isinstance(f, dict):
            continue
        y = 1 if o.get("label") else 0
        x = [float(f.get(k) or 0.0) for k in FEAT_KEYS]
        # clamp
        x = [max(0.0, min(1.0, v)) if math.isfinite(v) else 0.0 for v in x]
        rows.append({"x": x, "y": y, "domain": o.get("domain") or "?", "meta": o.get("meta")})
    return rows


def sigmoid(z: float) -> float:
    if z >= 20:
        return 1.0
    if z <= -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-z))


def train_logreg(
    rows: list[dict],
    epochs: int = 25,
    lr: float = 0.05,
    l2: float = 1e-4,
    seed: int = 42,
) -> dict[str, Any]:
    rng = random.Random(seed)
    n_f = len(FEAT_KEYS)
    w = [rng.uniform(-0.05, 0.05) for _ in range(n_f)]
    b = 0.0
    if not rows:
        return {"w": w, "b": b, "epochs": 0, "n": 0}

    history = []
    for ep in range(epochs):
        rng.shuffle(rows)
        loss_sum = 0.0
        correct = 0
        for r in rows:
            x, y = r["x"], r["y"]
            z = b + sum(wi * xi for wi, xi in zip(w, x))
            p = sigmoid(z)
            # binary cross-entropy
            loss_sum += -(y * math.log(p + 1e-9) + (1 - y) * math.log(1 - p + 1e-9))
            pred = 1 if p >= 0.5 else 0
            if pred == y:
                correct += 1
            # gradient
            err = p - y
            for i in range(n_f):
                w[i] -= lr * (err * x[i] + l2 * w[i])
            b -= lr * err
        n = max(1, len(rows))
        history.append(
            {
                "epoch": ep + 1,
                "loss": round(loss_sum / n, 6),
                "acc": round(correct / n, 6),
            }
        )
    return {
        "w": w,
        "b": b,
        "epochs": epochs,
        "n": len(rows),
        "history": history[-5:],
        "final": history[-1] if history else {},
    }


def eval_by_domain(rows: list[dict], w: list[float], b: float) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for dom in ("webgrid", "flip", "all"):
        subset = rows if dom == "all" else [r for r in rows if r["domain"] == dom]
        if not subset:
            out[dom] = {"n": 0}
            continue
        correct = 0
        pos = 0
        tp = fp = tn = fn = 0
        for r in subset:
            z = b + sum(wi * xi for wi, xi in zip(w, r["x"]))
            p = sigmoid(z)
            pred = 1 if p >= 0.5 else 0
            y = r["y"]
            if pred == y:
                correct += 1
            if y == 1:
                pos += 1
                if pred == 1:
                    tp += 1
                else:
                    fn += 1
            else:
                if pred == 1:
                    fp += 1
                else:
                    tn += 1
        n = len(subset)
        out[dom] = {
            "n": n,
            "acc": round(correct / n, 4),
            "pos_rate": round(pos / n, 4),
            "tp": tp,
            "fp": fp,
            "tn": tn,
            "fn": fn,
        }
    return out


def top_weights(w: list[float]) -> list[dict[str, Any]]:
    pairs = sorted(
        [{"feature": k, "w": round(wi, 5)} for k, wi in zip(FEAT_KEYS, w)],
        key=lambda d: abs(d["w"]),
        reverse=True,
    )
    return pairs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--trials", type=Path, default=TRIALS)
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--lr", type=float, default=0.06)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    rows = load_trials(args.trials)
    if len(rows) < 10:
        print(json.dumps({"ok": False, "error": "too_few_trials", "n": len(rows)}))
        return 1

    # hold-out 15%
    rng = random.Random(args.seed)
    shuffled = rows[:]
    rng.shuffle(shuffled)
    cut = max(1, int(0.15 * len(shuffled)))
    test, train = shuffled[:cut], shuffled[cut:]

    result = train_logreg(train, epochs=args.epochs, lr=args.lr, seed=args.seed)
    w, b = result["w"], result["b"]
    train_ev = eval_by_domain(train, w, b)
    test_ev = eval_by_domain(test, w, b)

    model = {
        "type": "logreg_pure_python",
        "features": FEAT_KEYS,
        "w": w,
        "b": b,
        "trained_at": time.time(),
        "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "n_train": len(train),
        "n_test": len(test),
        "train_eval": train_ev,
        "test_eval": test_ev,
        "top_weights": top_weights(w),
        "history_tail": result.get("history"),
        "honest_note": "WebGrid=synthetic pointer skill; flip=MACD/BB board — timing under noise",
    }
    MODEL.write_text(json.dumps(model, indent=2))

    metrics = {
        "t": time.time(),
        "iso": model["iso"],
        "n_train": len(train),
        "n_test": len(test),
        "test_acc_all": (test_ev.get("all") or {}).get("acc"),
        "test_acc_webgrid": (test_ev.get("webgrid") or {}).get("acc"),
        "test_acc_flip": (test_ev.get("flip") or {}).get("acc"),
        "train_loss": (result.get("final") or {}).get("loss"),
        "top": top_weights(w)[:3],
    }
    with METRICS.open("a") as f:
        f.write(json.dumps(metrics, separators=(",", ":")) + "\n")

    print(json.dumps(metrics, indent=2))
    print(f"model → {MODEL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
