#!/usr/bin/env python3
"""
timesync-world-clock · fornevercollective
Broadcast-quality world clock for side-terminal launch next to /gmux · /watch · /gboom.

  · UTC / Zulu (USNO naval command reference)
  · Unix epoch + wall↔mono drift
  · Time quality tiers (USNO-style L0–L3 + NTP stratum)
  · Global market sessions (RTH / pre / AH)
  · Adaptive: 80×24 compact · elongated full wall
  · Hot pipe: JSONL on stdout or --pipe path (maptrace / gboom pixel future)

Usage:
  python3 scripts/timesync-world-clock.py
  python3 scripts/timesync-world-clock.py --once          # single frame
  python3 scripts/timesync-world-clock.py --json          # one JSON object
  python3 scripts/timesync-world-clock.py --pipe /tmp/ts.jsonl
  python3 scripts/timesync-world-clock.py --cols 120 --rows 40
  bash scripts/launch-timesync.sh
"""
from __future__ import annotations

import argparse
import json
import os
import re
import select
import shutil
import signal
import subprocess
import sys
import termios
import time
import tty
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

# ── ANSI ──────────────────────────────────────────────────────────────────────

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
INV = "\033[7m"
HIDE = "\033[?25l"
SHOW = "\033[?25h"
CLR = "\033[2J\033[H"
HOME = "\033[H"

# truecolor helpers
def fg(r: int, g: int, b: int) -> str:
    return f"\033[38;2;{r};{g};{b}m"


def bg(r: int, g: int, b: int) -> str:
    return f"\033[48;2;{r};{g};{b}m"


C_UTC = fg(0, 220, 255)
C_GOOD = fg(80, 255, 140)
C_WARN = fg(255, 200, 60)
C_BAD = fg(255, 90, 90)
C_MUTE = fg(120, 130, 145)
C_MKT_OPEN = fg(0, 255, 160)
C_MKT_PRE = fg(255, 190, 70)
C_MKT_AH = fg(160, 140, 255)
C_MKT_CLOSED = fg(100, 105, 120)
C_HDR = fg(200, 210, 230)
C_ZULU = fg(255, 230, 80)
C_TIER0 = fg(255, 255, 255)
C_TIER1 = fg(0, 255, 200)
C_ACCENT = fg(90, 160, 255)

# ── USNO / naval time quality model (tier1+ command reference) ────────────────
# L0  USNO Master Clock ensemble (primary cesium/masers) — DoD source of truth
# L1  GPS · USNO public time · NTP stratum-1 / PTP GM (traceable to L0)
# L2  Facility / network clients locked to L1 (stratum-2, BC, software follow)
# L3  Free-run / unsynced wall clock (software mono only)

TAI_UTC_LEAP_SECONDS = 37  # frozen until next leap (still 37 as of 2026)
# Approximate GPS-UTC = 18 s (GPS epoch not including leap seconds since 1980)
GPS_UTC_OFFSET_S = 18

# Military letter zones (NATO / USN common use). Z = Zulu = UTC.
MIL_ZONES: list[tuple[str, str, int]] = [
    ("Z", "Zulu", 0),
    ("A", "Alpha", 1),
    ("B", "Bravo", 2),
    ("C", "Charlie", 3),
    ("D", "Delta", 4),
    ("E", "Echo", 5),
    ("F", "Foxtrot", 6),
    ("G", "Golf", 7),
    ("H", "Hotel", 8),
    ("I", "India", 9),
    ("K", "Kilo", 10),
    ("L", "Lima", 11),
    ("M", "Mike", 12),
    ("N", "November", -1),
    ("O", "Oscar", -2),
    ("P", "Papa", -3),
    ("Q", "Quebec", -4),
    ("R", "Romeo", -5),
    ("S", "Sierra", -6),
    ("T", "Tango", -7),
    ("U", "Uniform", -8),
    ("V", "Victor", -9),
    ("W", "Whiskey", -10),
    ("X", "X-ray", -11),
    ("Y", "Yankee", -12),
]

# ── Markets (approximate RTH; weekends only — no full holiday calendar) ───────

@dataclass
class Market:
    id: str
    label: str
    region: str
    tz: str
    open_m: int  # minutes from local midnight
    close_m: int
    pre_m: Optional[int] = None
    ah_m: Optional[int] = None
    kind: str = "equity"


MARKETS: list[Market] = [
    Market("nyse", "NYSE", "Americas", "America/New_York", 9 * 60 + 30, 16 * 60, 4 * 60, 20 * 60),
    Market("nasdaq", "NASDAQ", "Americas", "America/New_York", 9 * 60 + 30, 16 * 60, 4 * 60, 20 * 60),
    Market("cme", "CME", "Americas", "America/Chicago", 8 * 60 + 30, 15 * 60 + 15),  # equity index approx
    Market("tsx", "TSX", "Americas", "America/Toronto", 9 * 60 + 30, 16 * 60),
    Market("bovespa", "B3", "Americas", "America/Sao_Paulo", 10 * 60, 17 * 60 + 55),
    Market("lse", "LSE", "EMEA", "Europe/London", 8 * 60, 16 * 60 + 30),
    Market("xetra", "XETRA", "EMEA", "Europe/Berlin", 9 * 60, 17 * 60 + 30),
    Market("euronext", "Euronext", "EMEA", "Europe/Paris", 9 * 60, 17 * 60 + 30),
    Market("six", "SIX", "EMEA", "Europe/Zurich", 9 * 60, 17 * 60 + 30),
    Market("jse", "JSE", "EMEA", "Africa/Johannesburg", 9 * 60, 17 * 60),
    Market("tse", "TSE", "APAC", "Asia/Tokyo", 9 * 60, 15 * 60),  # lunch simplified continuous
    Market("hkex", "HKEX", "APAC", "Asia/Hong_Kong", 9 * 60 + 30, 16 * 60),
    Market("sse", "SSE", "APAC", "Asia/Shanghai", 9 * 60 + 30, 15 * 60),
    Market("sgx", "SGX", "APAC", "Asia/Singapore", 9 * 60, 17 * 60),
    Market("asx", "ASX", "APAC", "Australia/Sydney", 10 * 60, 16 * 60),
    Market("nse", "NSE", "APAC", "Asia/Kolkata", 9 * 60 + 15, 15 * 60 + 30),
    Market("krx", "KRX", "APAC", "Asia/Seoul", 9 * 60, 15 * 60 + 30),
    Market("twse", "TWSE", "APAC", "Asia/Taipei", 9 * 60, 13 * 60 + 30),
]

# World cities for zone wall
CITIES: list[tuple[str, str, str]] = [
    ("UTC/Z", "UTC", "Z"),
    ("NYC", "America/New_York", "R"),
    ("CHI", "America/Chicago", "S"),
    ("DEN", "America/Denver", "T"),
    ("LAX", "America/Los_Angeles", "U"),
    ("LON", "Europe/London", "Z/A"),
    ("PAR", "Europe/Paris", "A/B"),
    ("ZRH", "Europe/Zurich", "A/B"),
    ("DXB", "Asia/Dubai", "D"),
    ("DEL", "Asia/Kolkata", "E"),
    ("SIN", "Asia/Singapore", "H"),
    ("HKG", "Asia/Hong_Kong", "H"),
    ("TYO", "Asia/Tokyo", "I"),
    ("SYD", "Australia/Sydney", "K/L"),
]

# NTP peers for optional sntp sample (Apple / NIST / USNO-ish public)
NTP_PEERS = [
    "time.apple.com",
    "time.nist.gov",
    "time.cloudflare.com",
]


# ── Clock epoch / drift ───────────────────────────────────────────────────────

class EpochDrift:
    """Wall−mono drift since process start (GY clock.go pattern)."""

    def __init__(self) -> None:
        self.wall0 = time.time_ns()
        self.mono0 = time.monotonic_ns()

    def reset(self) -> None:
        self.wall0 = time.time_ns()
        self.mono0 = time.monotonic_ns()

    def drift_ns(self) -> int:
        return (time.time_ns() - self.wall0) - (time.monotonic_ns() - self.mono0)

    def drift_ms(self) -> float:
        return self.drift_ns() / 1e6


@dataclass
class NtpSample:
    peer: str = ""
    offset_s: Optional[float] = None
    delay_s: Optional[float] = None
    stratum: Optional[int] = None
    refid: str = ""
    ok: bool = False
    error: str = ""
    at: float = 0.0


_ntp_cache: NtpSample = NtpSample()
_ntp_cache_ttl = 8.0


def sample_ntp(force: bool = False) -> NtpSample:
    global _ntp_cache
    now = time.time()
    if not force and _ntp_cache.at and (now - _ntp_cache.at) < _ntp_cache_ttl:
        return _ntp_cache

    sntp = shutil.which("sntp")
    if not sntp:
        _ntp_cache = NtpSample(error="sntp not found", at=now)
        return _ntp_cache

    peer = os.environ.get("TIMESYNC_NTP_PEER", NTP_PEERS[0])
    try:
        # sntp -d prints exchange block with offset/stratum
        proc = subprocess.run(
            [sntp, "-d", peer],
            capture_output=True,
            text=True,
            timeout=4.0,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        sample = NtpSample(peer=peer, at=now)
        # offset:  ... (0.127823297)
        m_off = re.search(r"offset:\s+\S+\s+\(([-+0-9.eE]+)\)", out)
        m_del = re.search(r"\bdelay:\s+\S+\s+\(([-+0-9.eE]+)\)", out)
        # second delay line is round-trip; take last delay match if two
        delays = re.findall(r"\bdelay:\s+\S+\s+\(([-+0-9.eE]+)\)", out)
        m_str = re.search(r"stratum:\s+(\d+)", out)
        m_ref = re.search(r'ref:\s+\S+\s+\("?([^"\n)]+)"?\)', out)
        if m_off:
            sample.offset_s = float(m_off.group(1))
            sample.ok = True
        if delays:
            sample.delay_s = float(delays[-1])
        elif m_del:
            sample.delay_s = float(m_del.group(1))
        if m_str:
            sample.stratum = int(m_str.group(1))
        if m_ref:
            sample.refid = m_ref.group(1).strip()
        if not sample.ok:
            # some sntp print one-line: +0.001234 +/- 0.00… seconds
            m2 = re.search(r"([-+]?[0-9.]+)\s*\+/-\s*[0-9.]+\s*seconds", out)
            if m2:
                sample.offset_s = float(m2.group(1))
                sample.ok = True
        if not sample.ok:
            sample.error = "parse failed"
        _ntp_cache = sample
        return sample
    except Exception as e:  # noqa: BLE001
        _ntp_cache = NtpSample(peer=peer, error=str(e), at=now)
        return _ntp_cache


def classify_tier(ntp: NtpSample, drift_ms: float) -> dict[str, Any]:
    """
    Map observed sync state → USNO-style naval time quality level.
    L0 cannot be claimed without a real Master Clock link; we report the
    *effective local tier* from NTP stratum + drift.
    """
    # Public-internet NTP often sits 20–200ms off; still L1 *path* if stratum-1.
    # Tight lock (<5ms) is noted separately — true L0 remains USNO-only.
    off = abs(ntp.offset_s or 99.0)
    if ntp.ok and ntp.stratum is not None:
        if ntp.stratum <= 1 and off < 0.250:
            tier = 1
            if off < 0.005:
                label = "L1 LOCKED"
                note = "NTP stratum-1 · tight lock (<5ms) · GPS/USNO-class path"
            else:
                label = "L1 TRACEABLE"
                note = f"NTP stratum-1 · public path offset {off*1000:.1f}ms (not facility PTP)"
            color = C_TIER1
        elif ntp.stratum <= 3 and off < 0.500:
            tier = 2
            label = "L2 NETWORK"
            note = f"NTP stratum-{ntp.stratum} · locked to upstream"
            color = C_GOOD
        elif ntp.ok:
            tier = 2
            label = "L2 DEGRADED"
            note = f"NTP offset large ({off*1000:.0f}ms) or stratum {ntp.stratum}"
            color = C_WARN
        else:
            tier = 3
            label = "L3 FREE-RUN"
            note = "NTP sample incomplete"
            color = C_WARN
    else:
        tier = 3
        label = "L3 FREE-RUN"
        note = ntp.error or "no NTP lock — wall clock only"
        color = C_BAD

    # wall↔mono wander escalates caution
    if abs(drift_ms) > 50:
        note += f" · wallΔ {drift_ms:+.1f}ms"
        if tier < 3:
            label += " · WANDER"
            color = C_WARN

    return {
        "tier": tier,
        "label": label,
        "note": note,
        "color": color,
        "reference": "UTC(USNO) · DoD Master Clock (L0 primary — not local)",
        "command_time": "Zulu (Z) = UTC",
    }


# ── Market status ─────────────────────────────────────────────────────────────

def _local_minutes(tz_name: str, now_utc: datetime) -> tuple[int, int, bool]:
    local = now_utc.astimezone(ZoneInfo(tz_name))
    mins = local.hour * 60 + local.minute
    return mins, local.weekday(), True  # weekday 0=Mon


def market_status(m: Market, now_utc: datetime) -> dict[str, Any]:
    mins, weekday, _ = _local_minutes(m.tz, now_utc)
    weekend = weekday >= 5
    if weekend:
        status = "closed"
        phase = "weekend"
    elif m.open_m <= mins < m.close_m:
        status = "open"
        remain = m.close_m - mins
        if remain <= 30:
            phase = "near close"
        elif mins - m.open_m <= 30:
            phase = "open"
        else:
            phase = "mid"
    elif m.pre_m is not None and m.pre_m <= mins < m.open_m:
        status = "pre"
        phase = "pre-market"
    elif m.ah_m is not None and m.close_m <= mins < m.ah_m:
        status = "ah"
        phase = "after-hours"
    else:
        status = "closed"
        phase = "closed"

    local = now_utc.astimezone(ZoneInfo(m.tz))
    return {
        "id": m.id,
        "label": m.label,
        "region": m.region,
        "status": status,
        "phase": phase,
        "local": local.strftime("%H:%M"),
        "tz": m.tz,
        "hours": f"{m.open_m // 60:02d}:{m.open_m % 60:02d}–{m.close_m // 60:02d}:{m.close_m % 60:02d}",
    }


def status_color(status: str) -> str:
    return {
        "open": C_MKT_OPEN,
        "pre": C_MKT_PRE,
        "ah": C_MKT_AH,
        "closed": C_MKT_CLOSED,
    }.get(status, C_MUTE)


def status_glyph(status: str) -> str:
    return {"open": "●", "pre": "◐", "ah": "◑", "closed": "○"}.get(status, "·")


# ── Snapshot ──────────────────────────────────────────────────────────────────

def build_snapshot(drift: EpochDrift, ntp: NtpSample) -> dict[str, Any]:
    wall_ns = time.time_ns()
    mono_ns = time.monotonic_ns()
    unix = wall_ns / 1e9
    now_utc = datetime.fromtimestamp(unix, tz=timezone.utc)
    drift_ms = drift.drift_ms()
    tier = classify_tier(ntp, drift_ms)

    markets = [market_status(m, now_utc) for m in MARKETS]
    open_n = sum(1 for x in markets if x["status"] == "open")
    pre_n = sum(1 for x in markets if x["status"] == "pre")
    ah_n = sum(1 for x in markets if x["status"] == "ah")

    cities = []
    for name, tz, mil in CITIES:
        if tz == "UTC":
            t = now_utc
        else:
            t = now_utc.astimezone(ZoneInfo(tz))
        cities.append(
            {
                "name": name,
                "tz": tz,
                "mil": mil,
                "hhmmss": t.strftime("%H:%M:%S"),
                "hhmm": t.strftime("%H:%M"),
                "date": t.strftime("%Y-%m-%d"),
                "offset": t.strftime("%z"),
            }
        )

    mil_now = []
    for letter, word, hours in MIL_ZONES:
        t = now_utc + timedelta(hours=hours)
        mil_now.append(
            {
                "letter": letter,
                "word": word,
                "offset_h": hours,
                "hhmm": t.strftime("%H%M"),
                "hhmmss": t.strftime("%H%M%S"),
            }
        )

    tai = unix + TAI_UTC_LEAP_SECONDS
    gps = unix + GPS_UTC_OFFSET_S

    return {
        "schema": "fc-timesync-v1",
        "t": unix,
        "unix": int(unix),
        "unix_ms": int(unix * 1000),
        "unix_frac": f"{unix:.6f}",
        "iso_utc": now_utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
        "zulu": now_utc.strftime("%H%M%SZ"),
        "zulu_long": now_utc.strftime("%d%H%MZ %b %Y").upper(),
        "epoch_drift_ms": round(drift_ms, 3),
        "epoch_drift_ns": drift.drift_ns(),
        "mono_ns": mono_ns,
        "wall_ns": wall_ns,
        "tai_unix": tai,
        "gps_unix": gps,
        "leap_tai_utc_s": TAI_UTC_LEAP_SECONDS,
        "gps_utc_offset_s": GPS_UTC_OFFSET_S,
        "tier": {
            "level": tier["tier"],
            "label": tier["label"],
            "note": tier["note"],
            "reference": tier["reference"],
            "command_time": tier["command_time"],
        },
        "ntp": {
            "ok": ntp.ok,
            "peer": ntp.peer,
            "offset_s": ntp.offset_s,
            "offset_ms": None if ntp.offset_s is None else round(ntp.offset_s * 1000, 3),
            "delay_s": ntp.delay_s,
            "stratum": ntp.stratum,
            "refid": ntp.refid,
            "error": ntp.error,
        },
        "markets": markets,
        "market_counts": {"open": open_n, "pre": pre_n, "ah": ah_n, "total": len(markets)},
        "cities": cities,
        "military_zones": mil_now,
        "pipe": {
            "maptrace": "lat/lon + epoch for geospatial overlay",
            "gboom": "pixel-clock hot pipe (RGB stamp frame future)",
        },
    }


# ── Layout / render ───────────────────────────────────────────────────────────

def term_size(cols_override: Optional[int], rows_override: Optional[int]) -> tuple[int, int]:
    size = shutil.get_terminal_size(fallback=(80, 24))
    cols = cols_override or size.columns
    rows = rows_override or size.lines
    return max(40, cols), max(12, rows)


_ANSI_RE = re.compile(r"\033\[[0-9;]*m")


def bare_len(s: str) -> int:
    return len(_ANSI_RE.sub("", s))


def pad(s: str, width: int) -> str:
    n = bare_len(s)
    if n >= width:
        return s
    return s + (" " * (width - n))


def trunc(s: str, width: int) -> str:
    """Truncate by visible width; drop ANSI rather than mid-sequence slice."""
    if bare_len(s) <= width:
        return pad(s, width)
    out: list[str] = []
    vis = 0
    i = 0
    while i < len(s) and vis < width - 1:
        if s[i] == "\033":
            m = _ANSI_RE.match(s, i)
            if m:
                out.append(m.group(0))
                i = m.end()
                continue
        out.append(s[i])
        vis += 1
        i += 1
    return "".join(out) + "…" + RESET


def big_zulu_lines(zulu_hhmmss: str) -> list[str]:
    """Simple 3-row digit banner for broadcast look (fits 80 cols)."""
    # Compact seven-segment-ish using block elements — only digits + Z + :
    glyphs = {
        "0": ["███", "█ █", "███"],
        "1": ["  █", "  █", "  █"],
        "2": ["███", " ██", "███"],
        "3": ["███", " ██", "███"],
        "4": ["█ █", "███", "  █"],
        "5": ["███", "██ ", "███"],
        "6": ["███", "██ ", "███"],
        "7": ["███", "  █", "  █"],
        "8": ["███", "███", "███"],
        "9": ["███", "███", "  █"],
        ":": [" · ", " · ", " · "],
        "Z": ["███", " █ ", "███"],
        " ": ["   ", "   ", "   "],
    }
    rows = ["", "", ""]
    for ch in zulu_hhmmss:
        g = glyphs.get(ch, [" ? ", " ? ", " ? "])
        for i in range(3):
            rows[i] += g[i] + " "
    return rows


def render_frame(snap: dict[str, Any], cols: int, rows: int, mode: str) -> list[str]:
    """mode: auto|compact|full  — auto picks from cols/rows. Returns lines (not joined)."""
    if mode == "auto":
        mode = "full" if cols >= 100 or rows >= 30 else "compact"

    lines: list[str] = []
    tier = snap["tier"]
    ntp = snap["ntp"]
    drift = snap["epoch_drift_ms"]
    drift_c = C_GOOD if abs(drift) < 5 else (C_WARN if abs(drift) < 50 else C_BAD)
    tier_c = C_TIER1 if tier["level"] <= 1 else (C_GOOD if tier["level"] == 2 else C_WARN)

    # Header (visible-width safe — never slice mid-ANSI)
    title = (
        f"{BOLD}{C_HDR}TIMESYNC{RESET} {C_MUTE}·{RESET} "
        f"{C_UTC}UTC{RESET}/{C_ZULU}ZULU{RESET} {C_MUTE}·{RESET} "
        f"{tier_c}{tier['label']}{RESET}"
    )
    right = f"{C_MUTE}fc-timesync-v1{RESET}"
    gap = max(1, cols - bare_len(title) - bare_len(right))
    lines.append(trunc(title + (" " * gap) + right, cols))

    # Big Zulu
    zulu = snap["zulu"]  # HHMMSSZ
    display = f"{zulu[0:2]}:{zulu[2:4]}:{zulu[4:6]} Z"
    if mode == "full" and cols >= 72:
        for row in big_zulu_lines(display.replace(" ", "")):
            lines.append(f"{C_ZULU}{BOLD}{row}{RESET}")
        lines.append(f"{C_MUTE}  {snap['zulu_long']}  ·  command time Zulu = UTC(USNO ref){RESET}")
    else:
        lines.append(f"{C_ZULU}{BOLD}  {display}{RESET}  {C_MUTE}{snap['iso_utc']}{RESET}")

    # Epoch / drift / scales
    off_ms = ntp.get("offset_ms")
    off_s = "n/a" if off_ms is None else f"{off_ms:+.2f}ms"
    strat = ntp.get("stratum")
    strat_s = "—" if strat is None else str(strat)
    peer = ntp.get("peer") or "—"
    refid = ntp.get("refid") or ""

    lines.append(
        f"{C_ACCENT}unix{RESET} {BOLD}{snap['unix_frac']}{RESET}  "
        f"{C_MUTE}ms{RESET} {snap['unix_ms']}  "
        f"{drift_c}Δ{drift:+.2f}ms{RESET}  "
        f"{C_MUTE}ntp{RESET} {off_s}  "
        f"{C_MUTE}stratum{RESET} {strat_s}  "
        f"{C_MUTE}{peer}{RESET}"
        + (f" {C_MUTE}({refid}){RESET}" if refid else "")
    )
    lines.append(
        f"{C_MUTE}TAI{RESET} {snap['tai_unix']:.3f}  "
        f"{C_MUTE}GPS{RESET} {snap['gps_unix']:.3f}  "
        f"{C_MUTE}TAI−UTC{RESET} +{snap['leap_tai_utc_s']}s  "
        f"{C_MUTE}GPS−UTC{RESET} +{snap['gps_utc_offset_s']}s  "
        f"{C_MUTE}L0{RESET} USNO Master Clock (remote primary)"
    )
    lines.append(f"{C_MUTE}{tier['note']}{RESET}")

    # Cities strip
    lines.append(f"{DIM}{'─' * min(cols, 120)}{RESET}")
    city_chunks: list[str] = []
    for c in snap["cities"]:
        city_chunks.append(
            f"{C_HDR}{c['name']:<6}{RESET}{C_UTC}{c['hhmmss']}{RESET}{C_MUTE}/{c['mil']}{RESET}"
        )
    # wrap cities
    row = "  "
    for ch in city_chunks:
        if bare_len(row) + bare_len(ch) + 2 > cols - 1:
            lines.append(row.rstrip())
            row = "  "
        row += ch + "  "
    if row.strip():
        lines.append(row.rstrip())

    # Markets
    mc = snap["market_counts"]
    lines.append(f"{DIM}{'─' * min(cols, 120)}{RESET}")
    lines.append(
        f"{BOLD}{C_HDR}MARKETS{RESET}  "
        f"{C_MKT_OPEN}●{mc['open']} open{RESET}  "
        f"{C_MKT_PRE}◐{mc['pre']} pre{RESET}  "
        f"{C_MKT_AH}◑{mc['ah']} AH{RESET}  "
        f"{C_MUTE}○ closed · weekends only (no holiday cal){RESET}"
    )

    if mode == "compact":
        # one dense line-ish grid: label glyph status local
        cell_w = 18
        per_row = max(1, cols // cell_w)
        row_cells: list[str] = []
        for m in snap["markets"]:
            col = status_color(m["status"])
            cell = f"{col}{status_glyph(m['status'])}{m['label']:<7}{m['local']}{RESET}"
            row_cells.append(cell)
            if len(row_cells) >= per_row:
                lines.append(" " + " ".join(row_cells))
                row_cells = []
        if row_cells:
            lines.append(" " + " ".join(row_cells))
    else:
        # table
        hdr = f"  {'EXCH':<8} {'REG':<8} {'STAT':<10} {'LOCAL':>5}  HOURS"
        lines.append(f"{C_MUTE}{hdr}{RESET}")
        by_region: dict[str, list] = {}
        for m in snap["markets"]:
            by_region.setdefault(m["region"], []).append(m)
        for region in ("Americas", "EMEA", "APAC"):
            for m in by_region.get(region, []):
                col = status_color(m["status"])
                lines.append(
                    f"  {col}{status_glyph(m['status'])} {m['label']:<7}{RESET} "
                    f"{C_MUTE}{m['region']:<8}{RESET} "
                    f"{col}{m['phase']:<10}{RESET} "
                    f"{m['local']:>5}  {C_MUTE}{m['hours']}{RESET}"
                )

    # Military zones (full only, if room)
    if mode == "full" and rows >= 28:
        lines.append(f"{DIM}{'─' * min(cols, 120)}{RESET}")
        lines.append(
            f"{BOLD}{C_HDR}NAVAL / MIL LETTER ZONES{RESET} "
            f"{C_MUTE}(Z=Zulu=UTC · L0 command reference){RESET}"
        )
        row = "  "
        for z in snap["military_zones"]:
            mark = C_ZULU if z["letter"] == "Z" else C_MUTE
            piece = f"{mark}{z['letter']}{RESET}{z['hhmm']} "
            if bare_len(row + piece) > cols - 1:
                lines.append(row.rstrip())
                row = "  "
            row += piece
        if row.strip():
            lines.append(row.rstrip())

    # Footer / hotkeys
    lines.append(f"{DIM}{'─' * min(cols, 120)}{RESET}")
    lines.append(
        f"{C_MUTE}q quit · r reset-drift · n ntp-refresh · m compact/full · "
        f"p pipe-tick · maptrace/gboom pipe: --pipe PATH{RESET}"
    )

    # Fit rows — each line is already visual content; paint path truncates to cols
    if len(lines) > rows - 1:
        lines = lines[: rows - 2] + [f"{C_MUTE}… resize · m compact · or stretch taller{RESET}"]
    while len(lines) < rows - 1:
        lines.append("")
    return lines


def paint_lines(lines: list[str], cols: int, rows: int, *, full_clear: bool) -> None:
    """
    Resize-safe paint: home cursor, write each line clipped to cols + clear-to-EOL,
    then clear rest of screen. Full clear on SIGWINCH / size change so stretch
    never leaves ghost glyphs from the previous geometry.
    """
    out: list[str] = []
    if full_clear:
        out.append(CLR)
    else:
        out.append(HOME)
    n = min(len(lines), max(1, rows))
    for i in range(n):
        # Clear-to-EOL after each row kills leftover cells when width shrinks.
        out.append(trunc(lines[i], cols))
        out.append("\033[K")
        if i < n - 1:
            out.append("\n")
    # Wipe anything below the frame (height grew, then shrunk).
    out.append("\033[J")
    sys.stdout.write("".join(out))
    sys.stdout.flush()


# ── Interactive loop ──────────────────────────────────────────────────────────

# Set by SIGWINCH — next paint does a full clear.
_resize_pending = False


def _on_winch(_signum: int, _frame: Any) -> None:
    global _resize_pending
    _resize_pending = True


class App:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.drift = EpochDrift()
        self.mode = args.mode
        self.running = True
        self.pipe_fp = None
        if args.pipe:
            self.pipe_fp = open(args.pipe, "a", buffering=1)  # noqa: SIM115
        self._last_pipe = 0.0
        self._last_size: tuple[int, int] = (0, 0)

    def close(self) -> None:
        if self.pipe_fp:
            self.pipe_fp.close()
            self.pipe_fp = None

    def tick_pipe(self, snap: dict[str, Any]) -> None:
        if not self.pipe_fp:
            return
        interval = self.args.pipe_interval
        now = time.time()
        if now - self._last_pipe < interval:
            return
        self._last_pipe = now
        # slim frame for maptrace/gboom
        slim = {
            "schema": "fc-timesync-v1",
            "t": snap["t"],
            "unix": snap["unix"],
            "unix_ms": snap["unix_ms"],
            "iso_utc": snap["iso_utc"],
            "zulu": snap["zulu"],
            "epoch_drift_ms": snap["epoch_drift_ms"],
            "tier": snap["tier"]["level"],
            "tier_label": snap["tier"]["label"],
            "ntp_offset_ms": snap["ntp"].get("offset_ms"),
            "ntp_stratum": snap["ntp"].get("stratum"),
            "markets_open": [m["id"] for m in snap["markets"] if m["status"] == "open"],
            "market_counts": snap["market_counts"],
            "cities": {c["name"]: c["hhmmss"] for c in snap["cities"]},
        }
        self.pipe_fp.write(json.dumps(slim, separators=(",", ":")) + "\n")

    def run_once(self) -> int:
        ntp = sample_ntp(force=True)
        snap = build_snapshot(self.drift, ntp)
        if self.args.json:
            print(json.dumps(snap, indent=2 if self.args.pretty else None))
            return 0
        cols, rows = term_size(self.args.cols, self.args.rows)
        lines = render_frame(snap, cols, rows, self.mode)
        sys.stdout.write("\n".join(lines) + "\n")
        self.tick_pipe(snap)
        return 0

    def run_loop(self) -> int:
        global _resize_pending
        if not sys.stdin.isatty() or not sys.stdout.isatty():
            print("error: timesync needs a TTY (use --once/--json for pipes)", file=sys.stderr)
            print("  Prefer in-Grok:  /timesync   (or bash scripts/launch-timesync.sh)", file=sys.stderr)
            return 6

        old = termios.tcgetattr(sys.stdin.fileno())
        # Alternate screen buffer isolates scrollback + prevents stretch garbage.
        ALT_ON = "\033[?1049h"
        ALT_OFF = "\033[?1049l"
        try:
            try:
                signal.signal(signal.SIGWINCH, _on_winch)
            except (ValueError, OSError):
                pass
            tty.setcbreak(sys.stdin.fileno())
            sys.stdout.write(HIDE + ALT_ON + CLR)
            sys.stdout.flush()
            ntp = sample_ntp(force=True)
            while self.running:
                cols, rows = term_size(self.args.cols, self.args.rows)
                size = (cols, rows)
                full_clear = _resize_pending or size != self._last_size
                _resize_pending = False
                self._last_size = size

                # auto mode re-evaluates every paint from current geometry
                mode = self.mode
                snap = build_snapshot(self.drift, ntp)
                lines = render_frame(snap, cols, rows, mode)
                paint_lines(lines, cols, rows, full_clear=full_clear)
                self.tick_pipe(snap)

                r, _, _ = select.select([sys.stdin], [], [], self.args.interval)
                if r:
                    ch = sys.stdin.read(1)
                    if ch in ("q", "Q", "\x03"):
                        self.running = False
                    elif ch in ("r", "R"):
                        self.drift.reset()
                    elif ch in ("n", "N"):
                        ntp = sample_ntp(force=True)
                    elif ch in ("m", "M"):
                        # cycle auto → compact → full → auto
                        self.mode = {
                            "auto": "compact",
                            "compact": "full",
                            "full": "auto",
                        }.get(self.mode, "auto")
                        _resize_pending = True  # force clean repaint
                    elif ch in ("p", "P"):
                        self.tick_pipe(snap)
                        if self.pipe_fp:
                            self.pipe_fp.flush()
                else:
                    if time.time() - ntp.at > _ntp_cache_ttl:
                        ntp = sample_ntp(force=False)
        finally:
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, old)
            sys.stdout.write(ALT_OFF + SHOW + RESET)
            sys.stdout.flush()
            self.close()
        return 0


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Broadcast timesync world clock (fornevercollective)")
    p.add_argument("--once", action="store_true", help="print one frame and exit")
    p.add_argument("--json", action="store_true", help="emit full JSON snapshot")
    p.add_argument("--pretty", action="store_true", help="pretty-print JSON")
    p.add_argument("--mode", choices=("auto", "compact", "full"), default="auto")
    p.add_argument("--cols", type=int, default=None)
    p.add_argument("--rows", type=int, default=None)
    p.add_argument("--interval", type=float, default=0.25, help="refresh seconds")
    p.add_argument("--pipe", type=str, default=None, help="append JSONL ticks (maptrace/gboom)")
    p.add_argument("--pipe-interval", type=float, default=1.0)
    p.add_argument("--no-ntp", action="store_true", help="skip sntp sampling")
    return p.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    if args.no_ntp:
        global sample_ntp

        def sample_ntp(force: bool = False) -> NtpSample:  # type: ignore[misc]
            return NtpSample(error="disabled", at=time.time())

    app = App(args)

    def _sig(_s, _f) -> None:
        app.running = False

    signal.signal(signal.SIGINT, _sig)
    signal.signal(signal.SIGTERM, _sig)

    if args.once or args.json:
        try:
            return app.run_once()
        finally:
            app.close()
    return app.run_loop()


if __name__ == "__main__":
    sys.exit(main())
