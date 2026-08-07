#!/usr/bin/env python3
"""Memory Glass race · system-wide performance monitor.

Samples host + process metrics while WebGrid race runs. Maps the multi-seat
topology (terminals · browsers · side services) so we can see who steals BPS.

Writes:
  ~/.panda/mg-soak/watch/perf-race.jsonl
  ~/.panda/mg-soak/watch/perf-race-latest.json
  ~/.panda/mg-soak/watch/topology.json

Usage:
  python3 scripts/mg-race-perf-monitor.py --seconds 90
  python3 scripts/mg-race-perf-monitor.py --until-idle
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

OUT_DIR = Path.home() / ".panda/mg-soak/watch"
JSONL = OUT_DIR / "perf-race.jsonl"
LATEST = OUT_DIR / "perf-race-latest.json"
TOPO = OUT_DIR / "topology.json"


def utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run(cmd: list[str], timeout: float = 4.0) -> str:
    try:
        return subprocess.check_output(
            cmd, text=True, errors="replace", timeout=timeout
        )
    except Exception as e:
        return f"ERR:{e}"


def pgrep_lf(pattern: str) -> list[dict]:
    # Quote pattern so | and spaces are literal for pgrep
    out = run(["bash", "-lc", f"pgrep -lf -- {pattern!r} 2>/dev/null || true"])
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if not line or line.startswith("ERR:"):
            continue
        m = re.match(r"^(\d+)\s+(.*)$", line)
        if not m:
            continue
        rows.append({"pid": int(m.group(1)), "cmd": m.group(2)[:240]})
    return rows


def ps_stats(pids: list[int]) -> list[dict]:
    if not pids:
        return []
    # %cpu %mem rss vsz etime command
    q = ",".join(str(p) for p in pids)
    out = run(["ps", "-p", q, "-o", "pid=,%cpu=,%mem=,rss=,vsz=,etime=,comm="])
    rows = []
    for line in out.splitlines():
        parts = line.split(None, 6)
        if len(parts) < 6:
            continue
        try:
            rows.append(
                {
                    "pid": int(parts[0]),
                    "cpu": float(parts[1]),
                    "mem": float(parts[2]),
                    "rss_kb": int(parts[3]),
                    "vsz_kb": int(parts[4]),
                    "etime": parts[5],
                    "comm": parts[6] if len(parts) > 6 else "",
                }
            )
        except ValueError:
            continue
    return rows


def host_snapshot() -> dict:
    load = os.getloadavg() if hasattr(os, "getloadavg") else (0, 0, 0)
    # vm_stat free pages
    vm = run(["vm_stat"])
    page = 16384
    m = re.search(r"page size of (\d+)", vm)
    if m:
        page = int(m.group(1))
    free = inactive = wired = compressed = 0
    for key, name in (
        ("Pages free", "free"),
        ("Pages inactive", "inactive"),
        ("Pages wired down", "wired"),
        ("Pages occupied by compressor", "compressed"),
    ):
        mm = re.search(rf"{key}:\s+([\d.]+)", vm)
        if mm:
            n = int(float(mm.group(1)))
            if name == "free":
                free = n
            elif name == "inactive":
                inactive = n
            elif name == "wired":
                wired = n
            else:
                compressed = n
    mem = {
        "page_bytes": page,
        "free_mb": round(free * page / 1e6, 1),
        "inactive_mb": round(inactive * page / 1e6, 1),
        "wired_mb": round(wired * page / 1e6, 1),
        "compressed_mb": round(compressed * page / 1e6, 1),
    }
    # thermal / power rough (powermetrics needs root — skip if denied)
    uptime = run(["uptime"])
    return {
        "load1": load[0],
        "load5": load[1],
        "load15": load[2],
        "mem": mem,
        "uptime_line": uptime.strip()[:200],
    }


def classify_topology() -> dict:
    """Map concurrent seats: 3 terminals-ish + dual browser systems + side services."""
    groups = {
        # Binary name only — avoid matching paths containing "memory-glass"
        "memory_glass": [
            r
            for r in pgrep_lf("memory-glass")
            if "MacOS/memory-glass" in r["cmd"] or r["cmd"].endswith("memory-glass")
            or "/memory-glass " in r["cmd"]
        ],
        "webgrid_collector": pgrep_lf("webgrid-collector.py"),
        "optical_mix": pgrep_lf("mix_pipe_server") + pgrep_lf("layered_fuzz"),
        "local_8765": pgrep_lf("http.server 8765"),
        "safari": [
            r for r in pgrep_lf("Safari") if "Safari.app/Contents/MacOS/Safari" in r["cmd"]
        ],
        "chrome": pgrep_lf("Google Chrome"),
        "firefox": pgrep_lf("firefox"),
        "ollama": pgrep_lf("ollama"),
        "cursor": pgrep_lf("Cursor"),
    }
    # ports of interest
    ports = {}
    for port in (8765, 9880, 8791, 8899):
        lo = run(["bash", "-lc", f"lsof -iTCP:{port} -sTCP:LISTEN 2>/dev/null | tail -n +2"])
        ports[str(port)] = [ln.strip()[:160] for ln in lo.splitlines() if ln.strip()][:5]

    seats = {
        "browser_A_memory_glass": "WKWebView race shell (neuralink webgrid)",
        "browser_B_local_agents": "http://127.0.0.1:8765/#agents optical multi-agent debate",
        "terminal_1_grok_agent": "Grok Build / this race orchestrator",
        "terminal_2_collector_optical": "webgrid-collector :9880 + optical mix/fuzz",
        "terminal_3_static_8765": "python -m http.server 8765 research site",
    }
    return {
        "t": utc_iso(),
        "seats": seats,
        "processes": {k: v for k, v in groups.items() if v},
        "ports": ports,
        "notes": [
            "Agent BPS is MG synthetic pointer — not BCI implant",
            "Optical :8765 agents = research debate roles (Decimen, AI Fleet peel, …)",
            "Race shell strips MG lab chrome; dual browser is intentional split",
        ],
    }


def live_score() -> dict | None:
    p = OUT_DIR / "live-summary.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def sample_once() -> dict:
    topo = classify_topology()
    # focus pids
    pids: list[int] = []
    for key in ("memory_glass", "webgrid_collector", "optical_mix", "local_8765"):
        for row in topo["processes"].get(key, []):
            pids.append(row["pid"])
    pids = sorted(set(pids))
    host = host_snapshot()
    procs = ps_stats(pids)
    score = live_score()
    snap = {
        "t": time.time(),
        "iso": utc_iso(),
        "host": host,
        "procs": procs,
        "pid_count": len(pids),
        "mg_running": any(p.get("comm", "").find("memory") >= 0 or True for p in procs)
        and bool(topo["processes"].get("memory_glass")),
        "score": {
            "phase": (score or {}).get("phase"),
            "bps": (score or {}).get("bps"),
            "ntpm": (score or {}).get("ntpm"),
            "timer": (score or {}).get("timer"),
            "grid": (score or {}).get("grid"),
        }
        if score
        else None,
        "groups": {k: len(v) for k, v in topo["processes"].items()},
    }
    return snap


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=95.0)
    ap.add_argument("--interval", type=float, default=1.0)
    ap.add_argument("--until-idle", action="store_true", help="stop when MG exits")
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    topo = classify_topology()
    TOPO.write_text(json.dumps(topo, indent=2))
    print(f"topology → {TOPO}", flush=True)
    print(json.dumps({k: len(v) for k, v in topo["processes"].items()}, indent=2), flush=True)

    t0 = time.time()
    n = 0
    peaks = {"bps": 0.0, "cpu_mg": 0.0, "load1": 0.0}
    while True:
        snap = sample_once()
        with JSONL.open("a") as f:
            f.write(json.dumps(snap) + "\n")
        LATEST.write_text(json.dumps(snap, indent=2))
        n += 1
        sc = snap.get("score") or {}
        bps = float(sc.get("bps") or 0)
        if bps > peaks["bps"]:
            peaks["bps"] = bps
        for p in snap.get("procs") or []:
            if "memory" in (p.get("comm") or "").lower() or p.get("pid") in [
                r["pid"] for r in topo["processes"].get("memory_glass", [])
            ]:
                if p.get("cpu", 0) > peaks["cpu_mg"]:
                    peaks["cpu_mg"] = p["cpu"]
        if snap["host"]["load1"] > peaks["load1"]:
            peaks["load1"] = snap["host"]["load1"]
        if n % 5 == 0 or n == 1:
            print(
                f"[{n}] load={snap['host']['load1']:.2f} "
                f"bps={sc.get('bps')} phase={sc.get('phase')} "
                f"procs={snap['pid_count']} free_mb={snap['host']['mem']['free_mb']}",
                flush=True,
            )
        if args.until_idle and n > 3 and not snap.get("mg_running"):
            print("MG idle — stop", flush=True)
            break
        if time.time() - t0 >= args.seconds:
            break
        time.sleep(max(0.2, args.interval))

    summary = {
        "iso": utc_iso(),
        "samples": n,
        "seconds": round(time.time() - t0, 1),
        "peaks": peaks,
        "topology_file": str(TOPO),
        "jsonl": str(JSONL),
    }
    (OUT_DIR / "perf-race-summary.json").write_text(json.dumps(summary, indent=2))
    print("DONE", json.dumps(summary), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
