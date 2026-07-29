#!/usr/bin/env python3
"""
terminal-fleet-status · fornevercollective
Snapshot of active Grok / clock / map / watch / maptrace terminals and work dirs.

  python3 scripts/terminal-fleet-status.py           # human
  python3 scripts/terminal-fleet-status.py --json    # machine
  python3 scripts/terminal-fleet-status.py --events  # one-shot monitor lines (DONE)

Used by `/monitor` slash and agent `monitor` tool (emit only DONE/FAILED).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

HOME = Path.home()
ACTIVE = HOME / ".grok" / "active_sessions.json"
SESSIONS_ROOT = HOME / ".grok" / "sessions"
TIMESYNC_PIPE = HOME / ".panda" / "packs" / "timesync.jsonl"

# Process patterns → surface label
SURFACES = [
    (r"xai-grok-pager|[/ ]grok(?:\s|$)|xai-grok-pager-bin", "grok"),
    (r"timesync-world-clock|fc-timesync|/clock|/timesync", "clock"),
    (r"maptrace|fc-maptrace|/map\b", "map"),
    (r"live.?demux|/watch|/gmux|yt-dlp|ffmpeg", "watch"),
    (r"/gboom|gboom", "gboom"),
    (r"grokytalky|\bgy\b", "gy"),
    (r"cargo run -p xai-grok-pager", "grok-build"),
]


def run_ps() -> list[dict[str, Any]]:
    try:
        out = subprocess.check_output(
            ["ps", "-axo", "pid=,ppid=,pcpu=,state=,tty=,etime=,command="],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        # pid ppid pcpu state tty etime command...
        m = re.match(
            r"^(\d+)\s+(\d+)\s+([0-9.]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$",
            line,
        )
        if not m:
            continue
        pid, ppid, pcpu, state, tty, etime, cmd = m.groups()
        if "rg " in cmd or "terminal-fleet-status" in cmd or "grep" in cmd:
            continue
        label = None
        for pat, name in SURFACES:
            if re.search(pat, cmd, re.I):
                label = name
                break
        if not label:
            continue
        # cwd via lsof (best-effort, macOS)
        cwd = cwd_of(int(pid))
        rows.append(
            {
                "pid": int(pid),
                "ppid": int(ppid),
                "pcpu": float(pcpu),
                "state": state,
                "tty": tty if tty != "??" else "—",
                "etime": etime,
                "surface": label,
                "cwd": cwd or "—",
                "cmd": cmd[:160],
            }
        )
    return rows


def cwd_of(pid: int) -> str | None:
    try:
        out = subprocess.check_output(
            ["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=0.4,
        )
        for line in out.splitlines():
            if line.startswith("n"):
                return line[1:]
    except Exception:
        pass
    return None


def load_sessions() -> list[dict[str, Any]]:
    if not ACTIVE.exists():
        return []
    try:
        data = json.loads(ACTIVE.read_text())
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def pipe_tail() -> dict[str, Any] | None:
    if not TIMESYNC_PIPE.exists():
        return None
    try:
        # last non-empty line
        lines = TIMESYNC_PIPE.read_text().strip().splitlines()
        if not lines:
            return None
        return json.loads(lines[-1])
    except Exception:
        return None


def classify_work(cmd: str, surface: str) -> str:
    c = cmd.lower()
    if surface == "watch" or "/watch" in c or "yt-dlp" in c:
        return "live demux / media"
    if surface == "clock" or "timesync" in c:
        return "timesync world clock"
    if surface == "map" or "maptrace" in c:
        return "maptrace geospatial"
    if surface == "gboom":
        return "gboom raycaster"
    if "cargo run" in c or "cargo build" in c:
        return "building / cargo run pager"
    if surface == "grok" or surface == "grok-build":
        return "Grok agent TUI"
    if surface == "gy":
        return "GrokYtalkY / mesh"
    return "unknown"


def build_snapshot() -> dict[str, Any]:
    procs = run_ps()
    sessions = load_sessions()
    # enrich sessions with alive?
    enriched = []
    for s in sessions:
        pid = s.get("pid")
        alive = False
        if isinstance(pid, int):
            try:
                os.kill(pid, 0)
                alive = True
            except OSError:
                alive = False
        enriched.append({**s, "alive": alive})
    ts = pipe_tail()
    by_surface: dict[str, int] = {}
    for p in procs:
        by_surface[p["surface"]] = by_surface.get(p["surface"], 0) + 1
    return {
        "schema": "fc-terminal-fleet-v1",
        "t": time.time(),
        "host": os.uname().nodename if hasattr(os, "uname") else "local",
        "surfaces": by_surface,
        "processes": procs,
        "sessions": enriched,
        "timesync_pipe": ts,
        "hints": {
            "clock": "/clock  (or /timesync)",
            "map": "/map  ·  /map original 1.1.1.1  ·  /map popout",
            "watch": "/watch · /gmux",
            "monitor": "/monitor  refresh this board",
        },
    }


def format_human(snap: dict[str, Any]) -> str:
    lines = []
    lines.append("TERMINAL FLEET · fc-terminal-fleet-v1")
    lines.append(f"host {snap['host']} · t {time.strftime('%H:%M:%S', time.localtime(snap['t']))}")
    surf = snap.get("surfaces") or {}
    if surf:
        parts = "  ".join(f"{k}×{v}" for k, v in sorted(surf.items()))
        lines.append(f"surfaces  {parts}")
    else:
        lines.append("surfaces  (none matching grok/clock/map/watch)")
    lines.append("─" * 56)
    lines.append(f"{'PID':>7} {'TTY':<6} {'SURF':<10} {'WHERE / WORK'}")
    for p in snap.get("processes") or []:
        work = classify_work(p["cmd"], p["surface"])
        where = p["cwd"] if p["cwd"] != "—" else p["cmd"][:40]
        lines.append(
            f"{p['pid']:>7} {p['tty']:<6} {p['surface']:<10} {where}"
        )
        lines.append(f"{'':>7} {'':<6} {'':<10} → {work} · {p['etime']} · cpu {p['pcpu']}%")
    lines.append("─" * 56)
    lines.append("GROK SESSIONS (~/.grok/active_sessions.json)")
    sess = snap.get("sessions") or []
    if not sess:
        lines.append("  (none registered)")
    for s in sess:
        mark = "●" if s.get("alive") else "○"
        lines.append(
            f"  {mark} pid {s.get('pid')}  cwd {s.get('cwd')}  "
            f"id {(s.get('session_id') or '')[:12]}…  opened {s.get('opened_at', '')}"
        )
    ts = snap.get("timesync_pipe")
    if ts:
        lines.append("─" * 56)
        lines.append(
            f"timesync pipe  zulu {ts.get('zulu')}  tier {ts.get('tier')}  "
            f"Δ{ts.get('epoch_drift_ms')}ms  markets_open {ts.get('markets_open')}"
        )
    lines.append("─" * 56)
    h = snap.get("hints") or {}
    lines.append(f"summon  {h.get('clock')}  ·  {h.get('map')}")
    lines.append(f"        {h.get('watch')}  ·  {h.get('monitor')}")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--events", action="store_true", help="emit DONE for agent monitor")
    ap.add_argument("--watch", type=float, default=0, help="repeat every N seconds (0=once)")
    args = ap.parse_args()

    def once() -> None:
        snap = build_snapshot()
        if args.json:
            print(json.dumps(snap, indent=2 if not args.events else None))
        elif args.events:
            # agent monitor: single status line then DONE
            n = len(snap.get("processes") or [])
            s = len([x for x in (snap.get("sessions") or []) if x.get("alive")])
            surfaces = ",".join(f"{k}:{v}" for k, v in sorted((snap.get("surfaces") or {}).items()))
            print(f"fleet n={n} sessions_alive={s} surfaces={surfaces or 'none'}")
            print("DONE")
        else:
            print(format_human(snap))

    if args.watch and args.watch > 0:
        try:
            while True:
                if not args.events:
                    print("\033[2J\033[H", end="")
                once()
                if args.events:
                    break  # events mode is one-shot for agent monitor
                time.sleep(args.watch)
        except KeyboardInterrupt:
            return 0
    else:
        once()
    return 0


if __name__ == "__main__":
    sys.exit(main())
