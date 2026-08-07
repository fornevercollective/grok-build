#!/usr/bin/env python3
"""Layered fuzz compositor over mix-pipe (Mac Mini rebroadcast preview).

Pulls program frames from mix-pipe, applies:
  · region boxes (L3 / pillars / bug)
  · optional mask-aware free-zone hatch
  · anaglyph residual stripe
  · quick pulse overlay (session bits)
  · soft watermark-style noise in free mask
  · side-bar barcode modules
  · optional secondary still (phone/glasses alt feed) blended in free zones

Serves:
  http://127.0.0.1:8791/preview.mjpg
  http://127.0.0.1:8791/preview.jpg
  http://127.0.0.1:8791/budget.json
  http://127.0.0.1:8791/metrics.json   · full pipeline metrics
  http://127.0.0.1:8791/metrics        · live HTML dashboard
  http://127.0.0.1:8791/packets.json   · ticket / gluelam §00–§0D
  http://127.0.0.1:8791/quantum-gutter.json · Quantum Gutter JSON (mueee live)
  http://127.0.0.1:8791/before.jpg     · last pre-overlay (mix in)
  http://127.0.0.1:8791/after.jpg      · alias of preview.jpg
  http://127.0.0.1:8791/send.jpg       · optical TX content (what we send)
  http://127.0.0.1:8791/rx.jpg         · after transfer (decoded result)

  MIX_URL=http://127.0.0.1:8790/mix.jpg python3 layered_fuzz.py
  python3 layered_fuzz.py --seconds 45 --payload 'fc-alt-media-v1'
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import struct
import sys
import threading
import time
import urllib.request
import zlib
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from protocol import LTEncoder, LTDecoder, pack_frame, frame_indices  # type: ignore
except Exception:  # pragma: no cover
    LTEncoder = LTDecoder = None  # type: ignore
    pack_frame = frame_indices = None  # type: ignore

DIR = Path(os.environ.get("LIVE_DEMUX_OPTICAL_DIR", Path.home() / ".panda/vision/cast"))
MIX_URL = os.environ.get("MIX_URL", "http://127.0.0.1:8790/mix.jpg")
MASK_URL = os.environ.get("MASK_URL", "http://127.0.0.1:8790/mask.png")
REGIONS_URL = os.environ.get("REGIONS_URL", "http://127.0.0.1:8790/regions.json")
MIX_STATUS_URL = os.environ.get("MIX_STATUS_URL", "http://127.0.0.1:8790/status.json")
ALT_STILL = os.environ.get("LAYERED_ALT_STILL", str(Path.home() / ".panda/vision/live.jpg"))
# Extra live mixes under main preview (other sources)
# Mix2 must NOT default to MIX_URL (that duplicates before/upstream).
# Default: alt still plate (outside-eden / LAYERED_MIX2_STILL) — different content path.
_MIX2_DEFAULT = str(Path.home() / ".panda/vision/outside-eden.jpg")
if not Path(_MIX2_DEFAULT).is_file():
    _MIX2_DEFAULT = str(Path.home() / ".panda/vision/grok-starry-lilies-gsplat.jpg")
MIX2_URL = os.environ.get(
    "MIX2_URL",
    os.environ.get("MIX_URL_B", os.environ.get("LAYERED_MIX2_STILL", _MIX2_DEFAULT)),
)
MIX2_LABEL = os.environ.get("MIX2_LABEL", "Mix 2 · Vatican (compressed)")
MIX3_URL = os.environ.get("MIX3_URL", os.environ.get("MIX_URL_C", ""))
MIX3_LABEL = os.environ.get("MIX3_LABEL", "Mix 3 · Venice (compressed)")
# broadcast = TX only in chrome (L3/pillars/bug); full = free-mask snow demo
LAYERED_MODE = os.environ.get("LAYERED_MODE", "broadcast").strip().lower()
# Resource guardrails (Mac Mini / low-RAM hosts)
LAYERED_LITE = os.environ.get("LAYERED_LITE", "1").strip().lower() not in ("0", "false", "no")
LAYERED_TARGET_FPS = float(os.environ.get("LAYERED_TARGET_FPS", "6" if LAYERED_LITE else "15"))
LAYERED_HEAVY_EVERY = max(1, int(os.environ.get("LAYERED_HEAVY_EVERY", "4" if LAYERED_LITE else "1")))
LAYERED_WRITE_LAKE = os.environ.get("LAYERED_WRITE_LAKE", "0" if LAYERED_LITE else "1").strip().lower() not in ("0", "false", "no")
# fc-timesync-v1 script (same as /clock)
_TIMESYNC_PY = Path(__file__).resolve().parents[2] / "timesync-world-clock.py"
if not _TIMESYNC_PY.is_file():
    _TIMESYNC_PY = Path(__file__).resolve().parents[3] / "scripts" / "timesync-world-clock.py"

# Mutable listen port (CLI can override)
_CFG = {"port": int(os.environ.get("LAYERED_PORT", "8791")), "mode": LAYERED_MODE}

# Dashboard / process version (bump when metrics UI or mint PCP changes)
LAYERED_VERSION = os.environ.get("LAYERED_VERSION", "fc-layered-0.6.2")
DROP_ROOT = Path(
    os.environ.get(
        "LAYERED_DROP_DIR",
        str(Path.home() / ".panda/vision/cast/dropbox"),
    )
)
DROP_IN = DROP_ROOT / "in"
DROP_OUT = DROP_ROOT / "out"
GLYPH_N = 13  # kbatch glyph / steno grid size
try:
    import subprocess as _sp

    _git = _sp.check_output(
        ["git", "-C", str(Path(__file__).resolve().parents[3]), "rev-parse", "--short", "HEAD"],
        stderr=_sp.DEVNULL,
        text=True,
        timeout=1.5,
    ).strip()
    if _git:
        LAYERED_VERSION = f"{LAYERED_VERSION}+{_git}"
except Exception:
    pass

_timesync_cache: dict = {"t": 0.0, "data": {}}
_qg_metrics_cache: dict = {"t": 0.0, "data": {}}



def fetch(url: str, timeout: float = 2.0) -> bytes | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None



def load_mix_source(url_or_path: str) -> bytes | None:
    """Fetch JPEG from http(s) URL or local file path."""
    if not url_or_path:
        return None
    u = str(url_or_path).strip()
    if u.startswith("http://") or u.startswith("https://"):
        poll = u
        if poll.rstrip("/").endswith((".mjpg", ".mjpeg")):
            # single-frame poll: mix.mjpg → mix.jpg when possible
            if poll.rstrip("/").endswith("/mix.mjpg") or poll.rstrip("/").endswith("/mix.mjpeg"):
                poll = poll.rsplit("/", 1)[0] + "/mix.jpg"
            else:
                poll = re.sub(r"\.mjpe?g$", ".jpg", poll, flags=re.I)
        return fetch(poll, timeout=1.5)
    p = Path(u)
    if p.is_file():
        try:
            return p.read_bytes()
        except OSError:
            return None
    return None


def fetch_json(url: str, timeout: float = 1.5) -> dict:
    raw = fetch(url, timeout=timeout)
    if not raw:
        return {}
    try:
        return json.loads(raw.decode())
    except Exception:
        return {}


def timesync_snapshot(force: bool = False) -> dict:
    """fc-timesync-v1 (/clock level) — cached ~0.8s; falls back to local wall."""
    now = time.time()
    if not force and _timesync_cache["data"] and now - _timesync_cache["t"] < 0.8:
        return dict(_timesync_cache["data"])

    data: dict = {}
    if _TIMESYNC_PY.is_file():
        try:
            import subprocess

            r = subprocess.run(
                [sys.executable, str(_TIMESYNC_PY), "--json"],
                capture_output=True,
                timeout=2.5,
                text=True,
            )
            if r.returncode == 0 and r.stdout.strip():
                data = json.loads(r.stdout.strip().splitlines()[0])
        except Exception as e:
            data = {"err": str(e)}

    if not data or data.get("schema") != "fc-timesync-v1":
        # minimal local fallback
        from datetime import datetime, timezone

        dt = datetime.now(timezone.utc)
        data = {
            "schema": "fc-timesync-v1",
            "t": now,
            "unix": int(now),
            "unix_ms": int(now * 1000),
            "iso_utc": dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(dt.microsecond/1000):03d}Z",
            "zulu": dt.strftime("%H%M%SZ"),
            "zulu_long": dt.strftime("%d%H%MZ %b %Y").upper(),
            "epoch_drift_ms": 0.0,
            "tier": {"level": 3, "label": "L3 FREE-RUN", "note": "timesync script unavailable"},
            "ntp": {"ok": False},
            "markets": [],
            "fallback": True,
        }

    # attach pipeline packet time sync (in/out) — re-sample wall after NTP probe
    wall = time.time()
    in_ts = getattr(ST, "last_in_ts", 0.0) or 0.0
    out_ts = getattr(ST, "last_out_ts", 0.0) or 0.0
    mono = time.monotonic()
    data["pipeline"] = {
        "in_unix": in_ts,
        "out_unix": out_ts,
        "in_iso": _unix_iso(in_ts) if in_ts else None,
        "out_iso": _unix_iso(out_ts) if out_ts else None,
        "in_age_ms": round(max(0.0, wall - in_ts) * 1000, 1) if in_ts else None,
        "out_age_ms": round(max(0.0, wall - out_ts) * 1000, 1) if out_ts else None,
        "inout_delta_ms": round((out_ts - in_ts) * 1000, 2) if in_ts and out_ts else None,
        "proc_ms_ema": round(getattr(ST, "proc_ms_ema", 0.0), 2),
        "mono_s": mono,
        "wall_unix": wall,
    }
    _timesync_cache["t"] = wall
    _timesync_cache["data"] = data
    return dict(data)


def _unix_iso(ts: float) -> str:
    from datetime import datetime, timezone

    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(dt.microsecond/1000):03d}Z"


# ── stenoSTRIP 13-space alphabet (kbatch.ugrad.ai / qbit-codec) ─────────────
# Same as experiments/memory-glass/hotpipe/kbatch-dojo-bridge.js STENO_SPACES
STENO_SPACES = [
    "\u0020",  # SPACE
    "\u00a0",  # NBSP
    "\u2000",  # EN QUAD
    "\u2001",  # EM QUAD
    "\u2002",  # EN SPACE
    "\u2003",  # EM SPACE
    "\u2004",  # THREE-PER-EM
    "\u2005",  # FOUR-PER-EM
    "\u2006",  # SIX-PER-EM
    "\u2007",  # FIGURE SPACE
    "\u2008",  # PUNCTUATION SPACE
    "\u2009",  # THIN SPACE
    "\u200a",  # HAIR SPACE
]
STENO_LABELS = [
    "SP",
    "NBSP",
    "ENQ",
    "EMQ",
    "EN",
    "EM",
    "3/EM",
    "4/EM",
    "6/EM",
    "FIG",
    "PUN",
    "THIN",
    "HAIR",
]
STENO_BASE = len(STENO_SPACES)  # 13
# mint PCP path (protocol control packet) — fc-mint-pcp-v1
MINT_MAGIC = b"MINT"
MINT_CODEC_STENO13 = 0x01
MINT_CODEC_ZW2 = 0x02
MINT_CODEC_OPTICAL_L3 = 0x03


def _fnv1a32(data: bytes) -> int:
    h = 0x811C9DC5
    for b in data:
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def bits_from_bytes(data: bytes) -> list[int]:
    bits: list[int] = []
    for b in data:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    return bits


def steno_strip_encode(data: bytes) -> str:
    """kbatch stenoSTRIP: pack 4 bits → symbol mod 13."""
    bits = bits_from_bytes(data)
    out: list[str] = []
    for i in range(0, len(bits), 4):
        n = 0
        for k in range(4):
            if i + k < len(bits):
                n = (n << 1) | bits[i + k]
            else:
                n <<= 1
        out.append(STENO_SPACES[n % STENO_BASE])
    return "".join(out)


def steno_strip_decode(text: str) -> bytes:
    idx = {c: i for i, c in enumerate(STENO_SPACES)}
    bits: list[int] = []
    for ch in text:
        if ch not in idx:
            continue
        n = idx[ch]
        # invert 4-bit packing (lossy for n>15 but alphabet is 0..12)
        for k in range(3, -1, -1):
            bits.append((n >> k) & 1)
    out = bytearray()
    for i in range(0, len(bits) - 7, 8):
        b = 0
        for j in range(8):
            b = (b << 1) | bits[i + j]
        out.append(b)
    return bytes(out)


def steno_visual_labels(steno: str, max_syms: int = 48) -> list[str]:
    idx = {c: i for i, c in enumerate(STENO_SPACES)}
    labels = []
    for ch in steno[:max_syms]:
        labels.append(STENO_LABELS[idx[ch]] if ch in idx else "?")
    return labels


def zw2_encode(data: bytes) -> str:
    """2-bit zero-width inserts (fc-whitespace-steno zw path)."""
    zw = ["\u200b", "\u200c", "\u200d", "\u2060"]
    bits = bits_from_bytes(data)
    if len(bits) % 2:
        bits.append(0)
    out = []
    for i in range(0, len(bits), 2):
        out.append(zw[(bits[i] << 1) | bits[i + 1]])
    return "".join(out)


def mint_pcp_frame(
    *,
    seq: int,
    payload: bytes,
    optical_l3_bytes: int,
    codec: int = MINT_CODEC_STENO13,
) -> dict:
    """fc-mint-pcp-v1 · mint Protocol Control Packet for whitespace/optical path.

    Wire (binary header 16 B + body):
      0  magic 'MINT'
      4  u16  version=1
      6  u8   codec  (1=steno13 2=zw2 3=optical-l3)
      7  u8   flags
      8  u32  seq
      12 u32  payload FNV-1a
      16 body — stenoSTRIP / ZW / or optical summary
    """
    version = 1
    flags = 0
    payload_fnv = _fnv1a32(payload)
    if codec == MINT_CODEC_STENO13:
        body_text = steno_strip_encode(payload)
        body_bytes = body_text.encode("utf-8")
        codec_name = "stenoSTRIP-13"
    elif codec == MINT_CODEC_ZW2:
        body_text = zw2_encode(payload)
        body_bytes = body_text.encode("utf-8")
        codec_name = "zw2"
    else:
        body_text = ""
        body_bytes = struct.pack(">I", optical_l3_bytes) + payload[:32]
        codec_name = "optical-l3"

    header = (
        MINT_MAGIC
        + struct.pack(">H", version)
        + struct.pack("BB", codec & 0xFF, flags & 0xFF)
        + struct.pack(">I", seq & 0xFFFFFFFF)
        + struct.pack(">I", payload_fnv)
    )
    frame = header + body_bytes
    labels = steno_visual_labels(body_text, 64) if body_text else []
    # hex dump fixed width
    hx = frame[:64].hex()
    hx_spaced = " ".join(hx[i : i + 2] for i in range(0, len(hx), 2))
    return {
        "schema": "fc-mint-pcp-v1",
        "path": "mint → stenoSTRIP|zw|optical → carrier (prompt/doc/L3)",
        "ref": "kbatch.ugrad.ai steno-strip · qbit-codec · fc-whitespace-steno",
        "magic": "MINT",
        "version": version,
        "codec": codec_name,
        "codec_id": codec,
        "seq": seq & 0xFFFFFFFF,
        "payload_fnv": f"{payload_fnv:08x}",
        "payload_utf8": payload.decode("utf-8", errors="replace"),
        "payload_len": len(payload),
        "header_hex": header.hex(),
        "frame_len": len(frame),
        "frame_hex_64": hx_spaced,
        "steno_len": len(body_text),
        "steno_labels": labels,
        "steno_labels_line": " ".join(labels[:48]),
        "steno_bits_approx": round(len(body_text) * math.log2(STENO_BASE), 1)
        if body_text
        else 0,
        "optical_l3_B_frame": optical_l3_bytes,
        "wire": {
            "0_3": "MINT",
            "4_5": "u16 version",
            "6": "u8 codec",
            "7": "u8 flags",
            "8_11": "u32 seq",
            "12_15": "u32 fnv1a(payload)",
            "16_": "body steno/zw/optical",
        },
    }


# ── qbitOS / gluelam stack · numbered sections (ticket stub packet) ─────────
# Order mirrors Compliance: prefixes → DAC → steno → .qbit / preflight
# Refs: qbitos-gluelam · qbitos-iron-line · kbatch.ugrad.ai · qbit-codec.js

QBIT_PREFIX_SYMBOLS = [
    "n:",
    "+1:",
    "-n:",
    "+0:",
    "0:",
    "-1:",
    "+n:",
    "+2:",
    "-0:",
    "+3:",
    "1:",
]
QBIT_GATES = ["SWAP", "H", "M", "Rz", "I", "X", "T", "CZ", "S", "Y", "CNOT"]
QBIT_CATEGORIES = [
    "shebang",
    "comment",
    "import",
    "class",
    "function",
    "error",
    "condition",
    "loop",
    "return",
    "output",
    "variable",
]
GUTTER_SYM = ["n:", "+1:", "-n:", "+0:", "0:", "-1:", "+n:", "+2:", "-0:", "+3:", "1:"]
IRON_LINE_LAYERS = [
    {"id": "L0", "name": "gutter / night-watch", "budget": "raw"},
    {"id": "L1", "name": "prefix classify", "budget": "µs"},
    {"id": "L2", "name": "DAC+ tracks", "budget": "µs"},
    {"id": "L3", "name": "qbit codec / steno", "budget": "gate µs"},
    {"id": "L4", "name": "gluelam bind", "budget": "ms"},
    {"id": "L5", "name": "preflight", "budget": "ms"},
    {"id": "L6", "name": "cortical loop", "budget": "24ms"},
    {"id": "L7", "name": "capsule / language", "budget": "human"},
]
GLUELAM_PIPELINE = [
    "§01 prefixes",
    "§02 DAC",
    "§03 quantum_gutter",
    "§04 iron_line",
    "§05 gluelam",
    "§06 stenoSTRIP",
    "§07 qbit_codec",
    "§08 mint_pcp",
    "§09 optical_l3",
    "§0A slivers_shims",
    "§0B blobs_globs_lakes",
    "§0C ticket_stub",
    "§0D capsule_language",
]


def _line_depth(line: str) -> int:
    n = 0
    for ch in line:
        if ch == " ":
            n += 1
        elif ch == "\t":
            n += 2
        else:
            break
    return min(12, n // 2)


def _classify_line(line: str) -> dict:
    """Dedicated delineation path — O(11 rules) per line, not full-stream search.

    Same RULE order as concepts/qbit-codec.js / quantum-gutter live demo:
    shebang → comment → import → class → function → error → condition →
    loop → return → output → variable → neutral.
    """
    import re

    depth = _line_depth(line)
    s = line.strip()
    rules: list[tuple[int, bool]] = [
        (0, bool(re.match(r"^#!", line))),  # n: shebang
        (1, bool(re.match(r"^(//|#(?!!)|--|<!--|/\*|\*)", s))),  # +1: comment
        (
            2,
            bool(
                re.match(
                    r"^(import\b|from\b|use\b|require\s*\(|include\b|#include\b|using\b)",
                    s,
                )
            ),
        ),  # -n: import
        (
            3,
            bool(
                re.match(
                    r"^(class\b|struct\b|interface\b|trait\b|enum\b|impl\b|type\s+\w)",
                    s,
                )
            ),
        ),  # +0: class
        (
            4,
            bool(
                re.match(
                    r"^(async\s+def\b|async\s+fn\b|pub\s+fn\b|const\s+fn\b|def\b|fn\b|func\b|function\b|fun\b|method\b)",
                    s,
                )
            ),
        ),  # 0: function
        (
            5,
            bool(
                re.match(
                    r"^(throw\b|raise\b|panic!\s*|Error\s*\(|except\b|catch\b|err\b)",
                    s,
                )
            ),
        ),  # -1: error
        (
            6,
            bool(
                re.match(
                    r"^(if\b|else\b|elif\b|unless\b|when\b|match\b|switch\b|case\b)",
                    s,
                )
            ),
        ),  # +n: condition
        (
            7,
            bool(
                re.match(
                    r"^(for\b|while\b|loop\b|forEach\b|each\b|map\s*\(|\.map\b)",
                    s,
                )
            ),
        ),  # +2: loop
        (8, bool(re.match(r"^(return\b|yield\b|break\b|continue\b)", s))),  # -0: return
        (
            9,
            bool(
                re.match(
                    r"^(print\b|console\.|log\s*\(|fmt\.|puts\b|echo\b|println!\s*)",
                    s,
                )
            ),
        ),  # +3: output
        (
            10,
            bool(re.match(r"^(let\b|var\b|const\b|val\b|mut\b|\w+\s*=(?!=))", s)),
        ),  # 1: variable
    ]
    for idx, hit in rules:
        if hit:
            return {
                "index": idx,
                "symbol": QBIT_PREFIX_SYMBOLS[idx],
                "gate": QBIT_GATES[idx],
                "category": QBIT_CATEGORIES[idx],
                "depth": depth,
            }
    return {
        "index": -1,
        "symbol": " ",
        "gate": "",
        "category": "neutral",
        "depth": depth,
    }


def classify_source(content: str, max_lines: int = 64) -> dict:
    """Quantum-gutter style: left = code lines, right = prefix stream.

    Dedicated path: for each line, first matching rule wins (max 11 tests).
    Never scans whole blobs for structure — only line starts.
    Live analogue: https://mueee.qbitos.ai/quantum-gutter.html
    """
    lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    rows = []
    hist = {s: 0 for s in QBIT_PREFIX_SYMBOLS}
    hist[" "] = 0
    for i, code in enumerate(lines[:max_lines]):
        cl = _classify_line(code)
        hist[cl["symbol"]] = hist.get(cl["symbol"], 0) + 1
        rows.append(
            {
                "line": i + 1,
                "sym": cl["symbol"],
                "gate": cl["gate"],
                "category": cl["category"],
                "depth": cl["depth"],
                "index": cl["index"],
                "code": code[:120],
            }
        )
    # majority symbol (skip neutral if anything classified)
    classified = [r for r in rows if r["index"] >= 0]
    if classified:
        from collections import Counter

        maj = Counter(r["sym"] for r in classified).most_common(1)[0][0]
        maj_i = QBIT_PREFIX_SYMBOLS.index(maj)
        active = {
            "index": maj_i,
            "symbol": maj,
            "gate": QBIT_GATES[maj_i],
            "category": QBIT_CATEGORIES[maj_i],
        }
    else:
        active = {
            "index": -1,
            "symbol": " ",
            "gate": "",
            "category": "neutral",
        }
    gutter_stream = " ".join(r["sym"].strip() or "·" for r in rows)
    return {
        "path": "dedicated_line_classifier",
        "complexity": "O(lines × 11_rules) — not O(stream_bytes)",
        "url": "https://mueee.qbitos.ai/quantum-gutter.html",
        "note": "Edit left (code) · gutter classifies every line in real time (right path)",
        "lines_total": len(lines),
        "lines_classified": len(classified),
        "coverage_pct": round(100.0 * len(classified) / max(1, min(len(lines), max_lines)), 1),
        "active": active,
        "histogram": {k: v for k, v in hist.items() if v},
        "gutter_stream": gutter_stream[:200],
        "rows": rows,
        # ticket stub faces
        "left_code": [r["code"] for r in rows[:16]],
        "right_gutter": [
            f"{r['line']:03d} {r['sym']:<3} {r['gate']:<4} {r['category']}"
            for r in rows[:16]
        ],
        "sort_table": [
            {
                "i": i,
                "symbol": QBIT_PREFIX_SYMBOLS[i],
                "gate": QBIT_GATES[i],
                "category": QBIT_CATEGORIES[i],
                "count": hist.get(QBIT_PREFIX_SYMBOLS[i], 0),
            }
            for i in range(11)
        ],
    }


# Canonical Quantum Gutter demo (matches https://mueee.qbitos.ai/quantum-gutter.html)
QG_LIVE_URL = "https://mueee.qbitos.ai/quantum-gutter.html"
QG_DEMO_LANG = "python"
QG_DEMO_SOURCE = (
    "#!/usr/bin/env python3\n"
    "# Quantum prefix classification engine\n"
    "import numpy as np\n"
    "from tinygrad.tensor import Tensor\n"
    "\n"
    "class QuantumState:\n"
    '    """Represents a quantum state vector."""\n'
    "\n"
    "    def __init__(self, qubits=3):\n"
    "        self.n = qubits\n"
    "        self.state = Tensor.randn(2 ** qubits)\n"
    "\n"
    "    def normalize(self):\n"
    "        return self.state / self.state.norm()\n"
    "\n"
    "    def measure(self):\n"
    "        try:\n"
    "            probs = (self.state ** 2).numpy()\n"
    "            for i in range(len(probs)):\n"
    "                if probs[i] > 0.5:\n"
    "                    return i\n"
    "            return probs\n"
    "        except Exception as e:\n"
    '            print(f"Measurement error: {e}")\n'
    "            raise\n"
)


def _read_drop_text(side: str, limit: int = 64_000) -> tuple[str | None, str | None]:
    """Return (text, filename) for latest text-ish drop slot, else (None, None)."""
    slot = _scan_slot(side)
    p = slot.get("path")
    if not p or not Path(p).is_file():
        return None, None
    name = slot.get("name") or Path(p).name
    try:
        raw = Path(p).read_bytes()[:limit]
    except OSError:
        return None, None
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = raw.decode("latin-1")
        except Exception:
            return None, None
    if not text.strip():
        return None, None
    return text, name


def resolve_gutter_source(prefer: str | None = None, body_text: str | None = None) -> dict:
    """Pick source code for quantum gutter classify.

    prefer: demo | payload | in | out | bound | auto
    """
    pref = (prefer or "auto").strip().lower()
    if body_text is not None and body_text.strip():
        return {
            "source": body_text,
            "origin": "post_body",
            "name": "upload",
            "lang": QG_DEMO_LANG,
        }
    if pref == "demo":
        return {
            "source": QG_DEMO_SOURCE,
            "origin": "demo",
            "name": "qg-demo.py",
            "lang": QG_DEMO_LANG,
        }
    if pref in ("in", "out"):
        text, name = _read_drop_text(pref)
        if text:
            return {"source": text, "origin": f"drop_{pref}", "name": name, "lang": "auto"}
        # missing drop → fall through to demo
    if pref in ("bound", "payload"):
        pay = getattr(ST, "bound_payload", None) or getattr(ST, "payload_text", "") or ""
        if isinstance(pay, bytes):
            try:
                pay = pay.decode("utf-8")
            except UnicodeDecodeError:
                pay = pay.decode("latin-1", errors="replace")
        if str(pay).strip() and "\n" in str(pay):
            return {
                "source": str(pay),
                "origin": "payload",
                "name": "session_payload",
                "lang": "auto",
            }
    if pref in ("auto", "", "payload", "bound", "in", "out"):
        for side in ("out", "in"):
            text, name = _read_drop_text(side)
            if text and ("\n" in text or len(text) > 40):
                return {
                    "source": text,
                    "origin": f"drop_{side}",
                    "name": name,
                    "lang": "auto",
                }
        pay = getattr(ST, "payload_text", "") or ""
        if isinstance(pay, bytes):
            try:
                pay = pay.decode("utf-8", errors="replace")
            except Exception:
                pay = ""
        if str(pay).count("\n") >= 2:
            return {
                "source": str(pay),
                "origin": "payload",
                "name": "session_payload",
                "lang": "auto",
            }
    return {
        "source": QG_DEMO_SOURCE,
        "origin": "demo",
        "name": "qg-demo.py",
        "lang": QG_DEMO_LANG,
    }


def _qg_bridge_path() -> Path:
    return Path(__file__).resolve().parent / "qg_classify.mjs"


def _run_uvspeed_gutter(
    source: str,
    *,
    lang: str | None = None,
    section: str | None = None,
    category: str | None = None,
) -> dict | None:
    """Call real uvspeed quantum-prefixes.js via node bridge (structural index)."""
    bridge = _qg_bridge_path()
    if not bridge.is_file():
        return None
    import subprocess
    import tempfile

    cmd = ["node", str(bridge)]
    if lang:
        cmd += ["--lang", lang]
    if section:
        cmd += ["--section", section]
    if category:
        cmd += ["--category", category]
    try:
        # Prefer stdin to avoid temp files for small sources; use temp for large
        r = subprocess.run(
            cmd,
            input=source.encode("utf-8", errors="replace"),
            capture_output=True,
            timeout=4.0,
        )
        if r.returncode != 0 or not r.stdout.strip():
            return None
        return json.loads(r.stdout.decode("utf-8", errors="replace"))
    except Exception:
        return None


def build_quantum_gutter_json(
    *,
    prefer: str | None = None,
    body_text: str | None = None,
    max_lines: int = 512,
    lang: str | None = None,
    section: str | None = None,
    category: str | None = None,
) -> dict:
    """fc-quantum-gutter-v2 — organization system, not just prefix names.

    Uses uvspeed/web/quantum-prefixes.js (59+ languages) when node is available.
    Returns structural sections (class/function/div cards) so you can navigate
    data lakes without spooling the whole blob — like asking for a card path
    instead of raw line numbers with no map.

    Live: https://mueee.qbitos.ai/quantum-gutter.html
    Source: uvspeed/web/quantum-prefixes.js · iron-line L3 · plans/throughline
    """
    picked = resolve_gutter_source(prefer=prefer, body_text=body_text)
    source = picked["source"]
    # cap for engine (still full structure; rows may be sliced by section filter)
    if max_lines and source.count("\n") + 1 > max_lines:
        source = "\n".join(source.splitlines()[:max_lines])

    eng = _run_uvspeed_gutter(
        source, lang=lang, section=section, category=category
    )
    if eng and eng.get("schema") == "fc-quantum-gutter-v2":
        eng["version"] = LAYERED_VERSION
        eng["ts"] = time.time()
        eng["origin"] = picked.get("origin")
        eng["name"] = picked.get("name") or eng.get("name")
        eng["live_demo"] = QG_LIVE_URL
        eng["howto"] = (
            "Organization system: prefixes address structure across languages. "
            "Navigate by section path (class/function/div card) or category — "
            "not bare line numbers. "
            "GET ?section=QuantumState · ?category=function · source=demo|out|in"
        )
        eng["endpoints"] = {
            "self": "/quantum-gutter.json",
            "demo": "/quantum-gutter.json?source=demo",
            "drop_out": "/quantum-gutter.json?source=out",
            "drop_in": "/quantum-gutter.json?source=in",
            "section": "/quantum-gutter.json?section=Name",
            "category": "/quantum-gutter.json?category=function",
            "live": QG_LIVE_URL,
            "engine": "uvspeed/web/quantum-prefixes.js",
            "plans": "uvspeed/plans · iron-line · throughline",
        }
        # active = majority non-default
        counts = eng.get("prefix_counts") or {}
        non_def = [(k, v) for k, v in counts.items() if k not in ("default", " ")]
        if non_def:
            top = max(non_def, key=lambda kv: kv[1])[0]
            # map category → symbol
            cat_to_sym = {
                "shebang": "n:", "comment": "+1:", "import": "-n:", "class": "+0:",
                "function": "0:", "error": "-1:", "condition": "+n:", "loop": "+2:",
                "return": "-0:", "output": "+3:", "variable": "1:",
            }
            sym = cat_to_sym.get(top, "0:")
            try:
                idx = QBIT_PREFIX_SYMBOLS.index(sym)
            except ValueError:
                idx = 4
            eng["active"] = {
                "index": idx,
                "symbol": sym,
                "gate": QBIT_GATES[idx],
                "category": top,
            }
        eng["schema_prev"] = "fc-quantum-gutter-v1"
        return eng

    # ── fallback: local classify_source (thin) ──
    g = classify_source(source, max_lines=max_lines)
    rows = g.get("rows") or []
    return {
        "schema": "fc-quantum-gutter-v2",
        "ok": True,
        "engine": {"name": "layered_fuzz.classify_source", "fallback": True},
        "version": LAYERED_VERSION,
        "ts": time.time(),
        "live_demo": QG_LIVE_URL,
        "howto": "Fallback classifier — install node + uvspeed/web/quantum-prefixes.js for full multi-lang organization.",
        "origin": picked.get("origin"),
        "name": picked.get("name"),
        "language": lang or "python",
        "coverage_pct": g.get("coverage_pct"),
        "lines_total": g.get("lines_total"),
        "lines_classified": g.get("lines_classified"),
        "active": g.get("active"),
        "histogram": g.get("histogram"),
        "gutter_stream": g.get("gutter_stream"),
        "rows": rows,
        "sections": [],
        "index_by_category": {},
        "navigate": {
            "list_sections": [],
            "howto": "Engine fallback — structural sections unavailable",
        },
        "left": {
            "role": "source_code",
            "lang": lang or "python",
            "lines": [r.get("code", "") for r in rows],
            "raw": source[:16_000],
        },
        "right": {
            "role": "quantum_gutter",
            "title": f"{g.get('lines_classified', 0)}/{g.get('lines_total', 0)} · {g.get('coverage_pct', 0)}%",
            "symbols": rows,
        },
        "symbols_table": [
            {
                "i": i,
                "symbol": QBIT_PREFIX_SYMBOLS[i],
                "gate": QBIT_GATES[i],
                "category": QBIT_CATEGORIES[i],
            }
            for i in range(11)
        ],
        "endpoints": {
            "self": "/quantum-gutter.json",
            "live": QG_LIVE_URL,
            "engine": "fallback",
        },
    }



def _classify_payload_prefix(payload: bytes) -> dict:
    """Run line classifier on payload text; fall back to hash only if empty."""
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        text = payload[:256].decode("latin-1", errors="replace")
    if not text.strip():
        h = _fnv1a32(payload)
        idx = h % len(QBIT_PREFIX_SYMBOLS)
        return {
            "index": idx,
            "symbol": QBIT_PREFIX_SYMBOLS[idx],
            "gate": QBIT_GATES[idx],
            "category": QBIT_CATEGORIES[idx],
            "table": [
                {
                    "i": i,
                    "symbol": QBIT_PREFIX_SYMBOLS[i],
                    "gate": QBIT_GATES[i],
                    "category": QBIT_CATEGORIES[i],
                }
                for i in range(11)
            ],
            "via": "fnv_fallback",
        }
    g = classify_source(text)
    active = g["active"]
    active["table"] = g["sort_table"]
    active["via"] = "line_classifier"
    active["gutter"] = g
    return active


def _quantum_gutter(payload: bytes, n: int = 24) -> dict:
    """Gutter stream = prefix symbols per line (real classifier), not random bits."""
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        text = ""
    if text.strip():
        g = classify_source(text, max_lines=n)
        return {
            "bit_count": g["lines_total"],
            "ones": g["lines_classified"],
            "gutter_preview": g["gutter_stream"][:120],
            "symbols_used": sorted(g["histogram"].keys()),
            "url": "https://mueee.qbitos.ai/quantum-gutter.html",
            "lane": "L3",
            "path": "dedicated_line_classifier",
            "complexity": g["complexity"],
            "rows_preview": g["rows"][:12],
            "left_code": g["left_code"][:8],
            "right_gutter": g["right_gutter"][:8],
            "coverage_pct": g["coverage_pct"],
        }
    # binary blob → bit gutter (legacy fallback)
    bits = bits_from_bytes(payload[:64])
    stream = []
    for i, b in enumerate(bits[:n]):
        stream.append(
            GUTTER_SYM[10 if (b and i % 2 == 0) else (1 if b else (8 if i % 2 == 0 else 3))]
        )
    return {
        "bit_count": len(bits),
        "ones": sum(bits),
        "gutter_preview": " ".join(stream),
        "symbols_used": sorted(set(stream)),
        "url": "https://mueee.qbitos.ai/quantum-gutter.html",
        "lane": "L3",
        "path": "binary_fallback",
    }


def _so_sequence(text: str) -> str:
    vowels = set("aeiouyàáâäæãåāèéêëēėęîïíīįìôöòóœøōõûüùúūůűñ")
    out = []
    for ch in text.lower():
        if "a" <= ch <= "z" or ch in vowels:
            out.append("O" if ch in vowels else "S")
    return "".join(out)


def build_packet_view(
    *,
    payload: bytes,
    seq: int,
    optical_B_frame: int,
    l3_bits: int,
    ber_pct: float | None,
    mode: str = "broadcast",
    w: int = 960,
    h: int = 540,
) -> dict:
    """fc-ticket-packet-v1 · numbered gluelam sections · ticket stub L/R layout.

    Follows qbitos-gluelam / iron-line / kbatch capsule sectioning so
    slivers·shims·blobs·globs·lakes read like ticket stubs:
      left  = QR + DAT + steno strip (machine scan)
      right = prefixes · DAC · gutter · iron line · meta (human ops)
    """
    pcp = mint_pcp_frame(
        seq=seq, payload=payload, optical_l3_bytes=optical_B_frame, codec=MINT_CODEC_STENO13
    )
    pcp_opt = mint_pcp_frame(
        seq=seq, payload=payload, optical_l3_bytes=optical_B_frame, codec=MINT_CODEC_OPTICAL_L3
    )
    dens = []
    for lab in pcp["steno_labels"][:48]:
        try:
            dens.append(STENO_LABELS.index(lab))
        except ValueError:
            dens.append(0)

    text = pcp["payload_utf8"]
    pref = _classify_payload_prefix(payload)
    gutter = _quantum_gutter(payload)
    # full source classify for §07 (dedicated path demo)
    try:
        src_view = classify_source(text if text.strip() else "print(1)\n# hi\ndef f():\n  return 0\n")
    except Exception:
        src_view = classify_source("print(1)\n")
    so = _so_sequence(text)
    ticket_id = f"FC-{seq & 0xFFFF:04X}-{pcp['payload_fnv'][:8].upper()}"
    # QR payload: compact URI-like stub for kbatch/optical scanners
    qr_payload = (
        f"fc://ticket/{ticket_id}"
        f"?seq={seq}&fnv={pcp['payload_fnv']}&codec=steno13"
        f"&optB={optical_B_frame}&ber={ber_pct if ber_pct is not None else -1}"
        f"&sym={pref['symbol']}&gate={pref['gate']}"
    )
    # DAT (Data Matrix-style short form) — fixed fields for lake/shim routing
    dat = {
        "tid": ticket_id,
        "seq": seq,
        "fnv": pcp["payload_fnv"],
        "pfx": pref["symbol"],
        "gate": pref["gate"],
        "opt_B": optical_B_frame,
        "l3_bits": l3_bits,
        "ber_pct": ber_pct,
        "mode": mode,
        "wh": f"{w}x{h}",
    }

    # material forms (slivers → lakes)
    steno_body = steno_strip_encode(payload)
    materials = {
        "sliver": {
            "kind": "sliver",
            "desc": "atomic wire header (16 B mint PCP)",
            "bytes": 16,
            "hex": pcp["header_hex"],
        },
        "shim": {
            "kind": "shim",
            "desc": "prefix+DAC gate shim for gluelam bind",
            "symbol": pref["symbol"],
            "gate": pref["gate"],
            "category": pref["category"],
            "bytes": 2,
        },
        "blob": {
            "kind": "blob",
            "desc": "opaque optical L3 module payload this frame",
            "bytes": optical_B_frame,
            "bits": l3_bits,
        },
        "glob": {
            "kind": "glob",
            "desc": "stenoSTRIP symbol run (whitespace glob)",
            "symbols": len(steno_body),
            "labels_preview": pcp["steno_labels_line"][:80],
            "bits_approx": pcp["steno_bits_approx"],
        },
        "data_lake": {
            "kind": "data_lake",
            "desc": "session ticket lake record (append-only JSONL path)",
            "path": str(DIR / "layered-ticket-lake.jsonl"),
            "record_schema": "fc-ticket-packet-v1",
        },
    }

    sections = {
        "§00_envelope": {
            "section": "00",
            "name": "envelope",
            "schema": "fc-ticket-packet-v1",
            "version": LAYERED_VERSION,
            "ticket_id": ticket_id,
            "ts": time.time(),
            "pipeline": GLUELAM_PIPELINE,
            "refs": {
                "gluelam": "https://github.com/fornevercollective — qbitos-gluelam",
                "iron_line": "qbitos-iron-line · IRON L0–L7",
                "kbatch": "https://kbatch.ugrad.ai/",
                "gutter": "https://mueee.qbitos.ai/quantum-gutter.html",
                "qbit_codec": "experiments/memory-glass/hotpipe/concepts/qbit-codec.js",
            },
        },
        "§01_prefixes": {
            "section": "01",
            "name": "quantum_prefixes",
            "count": 11,
            "role": "DELINEATION_LAYER · dedicated classify path (not full-stream sort)",
            "complexity": "O(lines × 11) first-match rules · never walks whole page/blob",
            "active": {
                "index": pref.get("index"),
                "symbol": pref.get("symbol"),
                "gate": pref.get("gate"),
                "category": pref.get("category"),
                "via": pref.get("via"),
            },
            # fixed sort order 0–10 (JSON array order = table index, not alpha)
            "sort_order": "index_0_to_10",
            "symbols": [
                {
                    "i": i,
                    "symbol": QBIT_PREFIX_SYMBOLS[i],
                    "gate": QBIT_GATES[i],
                    "category": QBIT_CATEGORIES[i],
                    "count": (src_view.get("histogram") or {}).get(QBIT_PREFIX_SYMBOLS[i], 0),
                }
                for i in range(11)
            ],
            "note": "Same table as quantum-gutter live: left=code, right=sym/gate/category",
            "url": "https://mueee.qbitos.ai/quantum-gutter.html",
        },
        "§02_dac": {
            "section": "02",
            "name": "DAC+",
            "role": "tracks / stripes / complexity · unified .qbit codec face",
            "track": pref.get("category") or "neutral",
            "stripe": pref.get("gate") or "",
            "complexity": round(len(payload) * math.log2(max(STENO_BASE, 2)) / 8, 2),
            "qbit_codec_version": "1.0.0",
            "deploy_toggle": ["full", "prefix-only", "off"],
            "note": "qbit-dac.js isomorphic · DAC+ before steno · uses §01 index as track id",
            "track_index": pref.get("index"),
        },
        "§03_quantum_gutter": {
            "section": "03",
            "name": "quantum_gutter",
            **gutter,
            "so_sequence": so[:48],
            "rubik_faces": [
                "U:written",
                "D:spoken",
                "F:movement",
                "B:digital",
                "L:analog",
                "R:thought",
            ],
            "live_demo": "https://mueee.qbitos.ai/quantum-gutter.html",
            "howto": "Try it live: edit code on the left — watch the quantum gutter classify every line in real time.",
        },
        "§04_iron_line": {
            "section": "04",
            "name": "iron_line",
            "layers": IRON_LINE_LAYERS,
            "active_layer": "L3",
            "cortical_budget_ms": 24,
            "note": "prefixes→DAC→steno before preflight (COMPLIANCE path)",
        },
        "§05_gluelam": {
            "section": "05",
            "name": "gluelam",
            "principle": "quantum-prefixes + qbit-dac + qbit-steno (+ preflight) — single SoT",
            "bind_order": [
                "prefixes",
                "DAC",
                "steno",
                "qbit_codec",
                "preflight",
            ],
            "consumers": [
                "PWA",
                "Node",
                "Rust prefix-engine",
                "Cursor extension",
                "MCP",
                "fc-layered optical",
            ],
        },
        "§06_steno_strip": {
            "section": "06",
            "name": "stenoSTRIP-13",
            "alphabet": STENO_LABELS,
            "base": STENO_BASE,
            "symbols": pcp["steno_len"],
            "bits_approx": pcp["steno_bits_approx"],
            "labels_line": pcp["steno_labels_line"],
            "density": dens,
            "space_chars_unicode": [f"U+{ord(c):04X}" for c in STENO_SPACES],
            "ref": "kbatch steno-strip.js · qbit-steno.js · 19-bit DAC/line class",
        },
        "§07_qbit_codec": {
            "section": "07",
            "name": "qbit_codec",
            "version": "1.0.0",
            "format": ".qbit",
            "why": (
                "The 11 symbols are NOT a decorative list — they are the fixed "
                "delineation index for sorting/routing lines. Dedicated path: "
                "split → classifyLine(11 rules) → prefix stream. You never scan "
                "entire pages/blobs looking for structure; the gutter is the index."
            ),
            "dedicated_path": {
                "steps": [
                    "1 split content on newlines",
                    "2 for each line: first matching RULE (max 11 tests)",
                    "3 emit {line, sym, gate, category, depth}",
                    "4 optional: 5-char steno prefix inject (SPACE_CHARS)",
                ],
                "complexity": "O(L × R) L=lines R≤11 — independent of file size beyond L",
                "vs_full_scan": "No regex over whole buffer for structure; no tree walk",
            },
            # indexed 0–10 only — preserve order for consumers (do not alpha-sort)
            "symbols": [
                {
                    "i": i,
                    "symbol": QBIT_PREFIX_SYMBOLS[i],
                    "gate": QBIT_GATES[i],
                    "category": QBIT_CATEGORIES[i],
                    "hits": (src_view.get("histogram") or {}).get(QBIT_PREFIX_SYMBOLS[i], 0),
                }
                for i in range(11)
            ],
            "active_index": pref.get("index"),
            "active_symbol": pref.get("symbol"),
            "gutter_classify": {
                "coverage_pct": src_view.get("coverage_pct"),
                "gutter_stream": src_view.get("gutter_stream"),
                "rows": src_view.get("rows", [])[:24],
                "left_code": src_view.get("left_code", [])[:12],
                "right_gutter": src_view.get("right_gutter", [])[:12],
            },
            "layers": ["prefix_index", "stego_space", "payload"],
            "url": "https://mueee.qbitos.ai/quantum-gutter.html",
            "ref": "experiments/memory-glass/hotpipe/concepts/qbit-codec.js",
        },
        "§08_mint_pcp": {
            "section": "08",
            "name": "mint_pcp",
            **pcp,
        },
        "§09_optical_l3": {
            "section": "09",
            "name": "optical_l3",
            "B_frame": optical_B_frame,
            "bits": l3_bits,
            "ber_pct": ber_pct,
            "mint_codec": pcp_opt["codec"],
            "geometry": {"w": w, "h": h},
            "mode": mode,
            "preview": f"http://127.0.0.1:{_CFG['port']}/preview.mjpg",
        },
        "§0A_slivers_shims": {
            "section": "0A",
            "name": "slivers_shims",
            "sliver": materials["sliver"],
            "shim": materials["shim"],
        },
        "§0B_blobs_globs_lakes": {
            "section": "0B",
            "name": "blobs_globs_lakes",
            "blob": materials["blob"],
            "glob": materials["glob"],
            "data_lake": materials["data_lake"],
        },
        "§0C_ticket_stub": {
            "section": "0C",
            "name": "ticket_stub",
            "layout": "left=scan · right=ops",
            "left": {
                "role": "machine scan face",
                "qr": {
                    "ecc": "M",
                    "payload": qr_payload,
                    "payload_len": len(qr_payload),
                    "hint": "encode with any QR lib / phone scanner",
                },
                "dat": dat,
                "steno_strip_preview": pcp["steno_labels_line"][:64],
                "hex_sliver": pcp["header_hex"],
            },
            "right": {
                "role": "human ops face",
                "ticket_id": ticket_id,
                "payload": text[:120],
                "prefix": pref["symbol"],
                "gate": pref["gate"],
                "category": pref["category"],
                "dac_track": pref["category"],
                "iron_layer": "L3",
                "gutter": gutter["gutter_preview"][:80],
                "so": so[:32],
                "optical": f"{optical_B_frame}B/{l3_bits}b ber={ber_pct}",
                "mint_seq": seq,
                "fnv": pcp["payload_fnv"],
                "kbatch": "https://kbatch.ugrad.ai/",
                "capsule_hint": "language/layout shadows · strain · path geometry",
            },
        },
        "§0D_capsule_language": {
            "section": "0D",
            "name": "capsule_language",
            "site": "https://kbatch.ugrad.ai/",
            "for_ai": "https://kbatch.ugrad.ai/for-ai",
            "so_sequence": so[:64],
            "layouts_shadow": [
                "qwerty",
                "dvorak",
                "colemak",
                "azerty",
                "qwertz",
                "ru",
                "ko",
                "he",
                "ar",
                "hi",
            ],
            "note": "capsule = path geometry + steno + gutter + prefix bind for LLM/MCP",
        },
    }

    return {
        "schema": "fc-ticket-packet-v1",
        "schema_prev": "fc-packet-viewer-v1",
        "version": LAYERED_VERSION,
        "ticket_id": ticket_id,
        "section_order": list(sections.keys()),
        "sections": sections,
        # ── flat convenience (dashboard + scanners) ──
        "ticket": sections["§0C_ticket_stub"],
        "materials": materials,
        "hex_line": pcp["frame_hex_64"],
        "ascii_payload": text[:80],
        "paths": {
            "optical_l3": sections["§09_optical_l3"],
            "steno_strip": sections["§06_steno_strip"],
            "mint_pcp": sections["§08_mint_pcp"],
            "prefixes": sections["§01_prefixes"],
            "dac": sections["§02_dac"],
            "quantum_gutter": sections["§03_quantum_gutter"],
            "iron_line": sections["§04_iron_line"],
            "gluelam": sections["§05_gluelam"],
            "qbit_codec": sections["§07_qbit_codec"],
            "capsule": sections["§0D_capsule_language"],
        },
    }


# ── live dropbox · glyph IN/OUT pads (kbatch 13×13) ─────────────────────────


def _ensure_drop_dirs() -> None:
    DROP_IN.mkdir(parents=True, exist_ok=True)
    DROP_OUT.mkdir(parents=True, exist_ok=True)


def _kind_from_name(name: str) -> str:
    n = (name or "").lower()
    if n.endswith((".mp4", ".webm", ".mov", ".mkv", ".m3u8", ".ts")):
        return "video"
    if n.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp")):
        return "image"
    if n.endswith((".json", ".jsonl", ".txt", ".md", ".csv", ".html")):
        return "text"
    if n.endswith((".bin", ".qbit", ".dat", ".pcap")):
        return "blob"
    if n.startswith("http://") or n.startswith("https://"):
        return "stream"
    return "file"


def glyph_bits_from_bytes(data: bytes, n: int = GLYPH_N) -> list[int]:
    """13×13 glyph bits from content (image downsample or hash lattice)."""
    size = n * n
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        arr = np.frombuffer(data, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if im is not None:
            small = cv2.resize(im, (n, n), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            bits = (gray.flatten() < 140).astype(int).tolist()
            return bits[:size]
    except Exception:
        pass
    # hash lattice fallback
    h = hashlib.sha256(data).digest()
    bits = []
    i = 0
    while len(bits) < size:
        b = h[i % len(h)]
        for k in range(8):
            bits.append((b >> k) & 1)
            if len(bits) >= size:
                break
        i += 1
        h = hashlib.sha256(h + bytes([i & 0xFF])).digest()
    return bits[:size]


def glyph_png_bytes(bits: list[int], n: int = GLYPH_N, scale: int = 10) -> bytes:
    """Render glyph grid PNG (no deps beyond zlib/struct)."""
    import struct
    import zlib

    w = h = n * scale
    # RGB
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter
        gy = y // scale
        for x in range(w):
            gx = x // scale
            on = bits[gy * n + gx] if gy * n + gx < len(bits) else 0
            if on:
                raw.extend((230, 240, 255))
            else:
                raw.extend((18, 22, 32))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 6))
        + chunk(b"IEND", b"")
    )


def glyph_bits_animated(data: bytes, n: int = GLYPH_N, t: float = 0.0, frame: int = 0) -> list[int]:
    """Live glyph lattice (kbatch-style pixel compression) — not a static QR.

    For images: pan/zoom a crop window over the still so the 13×13 modules
    stream like /watch glyph. For arbitrary bytes: time-sliced hash lattice
    so each frame is a *portion* of the payload space.
    """
    size = n * n
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        arr = np.frombuffer(data, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if im is not None:
            h, w = im.shape[:2]
            # pan window over image (circular)
            phase = (t * 0.35 + frame * 0.07) % 1.0
            win = max(n * 4, int(min(h, w) * (0.45 + 0.25 * abs((phase * 2) - 1))))
            win = min(win, h, w)
            cx = int((w - win) * (0.5 + 0.45 * math.sin(phase * math.pi * 2)))
            cy = int((h - win) * (0.5 + 0.45 * math.cos(phase * math.pi * 2 * 0.7)))
            cx = max(0, min(w - win, cx))
            cy = max(0, min(h - win, cy))
            crop = im[cy : cy + win, cx : cx + win]
            small = cv2.resize(crop, (n, n), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            # adaptive threshold for compression lattice
            thr = float(np.median(gray))
            bits = (gray.flatten() < thr).astype(int).tolist()
            # finder corners always on (glyph identity, not QR ECC)
            for i in range(min(3, n)):
                bits[i] = 1
                bits[i * n] = 1
                bits[(n - 1) * n + i] = 1
            return bits[:size]
    except Exception:
        pass
    # byte-window lattice: each frame encodes a slice of the file
    if not data:
        return [0] * size
    step = max(1, len(data) // max(8, n))
    off = (int(t * 4) + frame * step) % max(1, len(data))
    window = data[off : off + max(32, n * n)]
    if len(window) < 32:
        window = (window * 4)[:64]
    h = hashlib.sha256(window + bytes([frame & 0xFF, int(t) & 0xFF])).digest()
    bits = []
    i = 0
    while len(bits) < size:
        b = h[i % len(h)]
        for k in range(8):
            bits.append((b >> k) & 1)
            if len(bits) >= size:
                break
        i += 1
        h = hashlib.sha256(h + bytes([i & 0xFF])).digest()
    for i in range(min(3, n)):
        bits[i] = 1
        bits[i * n] = 1
    return bits[:size]


def glyph_png_multiscale(bits: list[int], n: int = GLYPH_N, scale: int = 12) -> bytes:
    """Pixel-compressed glyph plate with soft module edges (kbatch lattice look)."""
    # reuse glyph_png_bytes but larger scale for live dropbox
    return glyph_png_bytes(bits, n=n, scale=scale)


def tick_fountain(payload: bytes, ber_pct: float | None, t: float) -> dict:
    """Advance Decimen-compatible LT fountain TX/RX — capture is always a portion.

    Progress UX tracks frames *collected* (not blocks solved), matching decimen
    receive app notes: peel cascade back-loads then teleports if you watch
    blocks-only.
    """
    if LTEncoder is None or LTDecoder is None:
        return {"ok": False, "err": "protocol.LT* unavailable"}
    # bind payload: prefer OUT drop raw if present
    key = payload[:2048]
    try:
        out_slot = _scan_slot("out")
        if out_slot.get("path") and Path(out_slot["path"]).is_file():
            raw = Path(out_slot["path"]).read_bytes()[:64_000]
            if raw:
                key = raw
    except Exception:
        pass
    if not key:
        key = b"fc-empty"
    # (re)init session when payload changes
    if ST.fountain_enc is None or ST.fountain_payload_key != key:
        block_len = 64 if len(key) < 2048 else 128
        sid = (hashlib.sha256(key).digest()[0] << 8 | hashlib.sha256(key).digest()[1]) & 0xFFFF
        ST.fountain_enc = LTEncoder(key, block_len=block_len, session_id=sid or 1)
        ST.fountain_dec = LTDecoder(
            ST.fountain_enc.k,
            ST.fountain_enc.block_len,
            ST.fountain_enc.session_id,
            ST.fountain_enc.total_len,
        )
        ST.fountain_payload_key = key
        ST.fountain_seq = 0
        ST.fountain_scatter = []
    enc: LTEncoder = ST.fountain_enc
    dec: LTDecoder = ST.fountain_dec
    # emit several fountain frames per compositor tick
    n_emit = 3
    ber = (ber_pct or 0.0) / 100.0
    for _ in range(n_emit):
        seq = ST.fountain_seq
        ST.fountain_seq += 1
        block = enc.encode(seq)
        # simulate channel drop from optical BER
        drop = False
        if ber > 0:
            # deterministic-ish drop from seq + ber
            h = (seq * 2654435761) & 0xFFFFFFFF
            drop = (h / 0xFFFFFFFF) < min(0.85, ber * 1.8)
        degree = 0
        if not drop:
            idxs = frame_indices(enc.k, enc.cdf, enc.session_id, seq) if frame_indices else []
            degree = len(idxs)
            dec.add_frame(seq, block)
        # scatter point: x=seq%64, y=degree or -1 if dropped
        ST.fountain_scatter.append(
            {
                "seq": seq,
                "x": seq % 48,
                "y": degree if not drop else -1,
                "degree": degree,
                "dropped": drop,
                "t": t,
            }
        )
        if len(ST.fountain_scatter) > 120:
            ST.fountain_scatter = ST.fountain_scatter[-120:]
    # progress = frames collected / (k * overhead) — decimen receive style
    overhead = 1.35
    frames_new = dec.frames_new
    progress = min(0.99, frames_new / max(1.0, enc.k * overhead))
    if dec.is_complete:
        progress = 1.0
    blocks = [1 if dec.solved[i] is not None else 0 for i in range(enc.k)]
    assembled = dec.assemble()
    status = {
        "ok": True,
        "schema": "fc-fountain-progress-v1",
        "engine": "protocol.LTEncoder/LTDecoder · decimen-compatible",
        "session_id": enc.session_id,
        "k": enc.k,
        "block_len": enc.block_len,
        "total_len": enc.total_len,
        "payload_fnv": f"{enc.payload_fnv:08x}",
        "seq": ST.fountain_seq,
        "frames_new": frames_new,
        "frames_dup": dec.frames_dup,
        "solved_count": dec.solved_count,
        "pending": len(dec.pending),
        "progress_pct": round(progress * 100, 2),
        "overhead_est": overhead,
        "complete": dec.is_complete,
        "assembled_bytes": len(assembled) if assembled else 0,
        "bytes_captured": min(enc.total_len, int(progress * enc.total_len)),
        "blocks": blocks[:128],  # cap UI
        "scatter": list(ST.fountain_scatter[-64:]),
        "note": "Any captured frame is a XOR portion of source blocks — not a whole file until peel completes",
        "ber_channel_pct": ber_pct,
    }
    # loop demo: after complete + margin, reseat so scatter keeps showing portion capture
    if dec.is_complete and frames_new > int(enc.k * overhead) + enc.k:
        ST.fountain_enc = None
        ST.fountain_dec = None
        status["resetting"] = True
    ST.fountain_status = status
    return status



def _scan_slot(side: str) -> dict:
    """Latest file in drop in/out dir → slot meta + glyph."""
    folder = DROP_IN if side == "in" else DROP_OUT
    _ensure_drop_dirs()
    files = sorted(
        [p for p in folder.iterdir() if p.is_file() and not p.name.startswith(".")],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not files:
        empty_bits = [0] * (GLYPH_N * GLYPH_N)
        # corner finder pattern
        for i in range(3):
            empty_bits[i] = 1
            empty_bits[i * GLYPH_N] = 1
        return {
            "side": side,
            "name": None,
            "bytes": 0,
            "kind": "empty",
            "ts": 0.0,
            "path": None,
            "glyph_bits": empty_bits,
            "glyph_url": f"/drop/{side}/glyph.png",
            "status": "idle",
        }
    p = files[0]
    try:
        data = p.read_bytes()
    except OSError:
        data = b""
    # live lattice (kbatch pixel compress) — pan over image / slice file
    t_now = time.time()
    frame_i = int(getattr(ST, "glyph_frame_i", 0))
    bits = glyph_bits_animated(data, GLYPH_N, t_now, frame_i)
    # write glyph cache (larger scale for dropbox)
    try:
        gpath = folder / f".glyph-{side}.png"
        gpath.write_bytes(glyph_png_multiscale(bits, GLYPH_N, 14))
        # also write multi-frame lattice strip for streaming clients
        frames = []
        for fi in range(4):
            b2 = glyph_bits_animated(data, GLYPH_N, t_now, frame_i + fi * 3)
            frames.append(b2)
        slot_extra_frames = frames
    except OSError:
        slot_extra_frames = []
    return {
        "side": side,
        "name": p.name,
        "bytes": p.stat().st_size,
        "kind": _kind_from_name(p.name),
        "ts": p.stat().st_mtime,
        "path": str(p),
        "glyph_bits": bits,
        "glyph_frames": locals().get("slot_extra_frames") or [bits],
        "glyph_url": f"/drop/{side}/glyph.png?_={int(time.time()*10)}",
        "glyph_mjpg": f"/drop/{side}/glyph.mjpg",
        "glyph_mode": "kbatch-pixel-lattice-13",
        "status": "ready",
        "sha256": hashlib.sha256(data[: min(len(data), 1024 * 1024)]).hexdigest()[:16],
    }


def dropbox_status() -> dict:
    _ensure_drop_dirs()
    inn = _scan_slot("in")
    out = _scan_slot("out")

    def _enrich_slot(slot: dict) -> dict:
        slot = dict(slot or {})
        data = None
        p = slot.get("path")
        if p and Path(p).is_file():
            try:
                # cap read for potential stills; video = header only for kind
                raw = Path(p).read_bytes()
                if slot.get("kind") == "video" or (slot.get("name") or "").lower().endswith(
                    (".mp4", ".mov", ".webm", ".mkv")
                ):
                    data = raw[:64]  # magic only
                    pot = analyze_feed_payload_potential(
                        None,
                        label=slot.get("name") or "drop",
                        url=slot.get("path") or "",
                        kind="video",
                        name=slot.get("name"),
                    )
                    pot["ok"] = True
                    pot["bytes"] = slot.get("bytes") or len(raw)
                    pot["kind"] = "video"
                    pot["summary"] = (
                        f"video · {pot['bytes']} B · est optical "
                        f"{transfer_resolution_table(960, 540, 12, 0.3).get('decimen_qr_v27', {}).get('kbps', 0)} KB/s @960×540"
                    )
                    pot["payload_potential"] = {
                        k: v
                        for k, v in transfer_resolution_table(960, 540, 12, 0.3).items()
                        if not str(k).startswith("_")
                    }
                    slot["payload_potential"] = pot
                    slot["potential_summary"] = pot["summary"]
                    return slot
                # images / text / bin — try full or first 4MB as still
                data = raw[: min(len(raw), 4_000_000)]
            except OSError:
                data = None
        pot = analyze_feed_payload_potential(
            data if data and data[:3] == bytes([0xFF, 0xD8, 0xFF]) or (data and data[:4] == b"\x89PNG") else (
                data if data and len(data) > 100 else None
            ),
            label=slot.get("name") or slot.get("side") or "drop",
            url=slot.get("path") or "",
            kind=slot.get("kind") or "file",
            name=slot.get("name"),
            fps=12.0,
            tx_frac=0.3,
        )
        # text payloads: estimate from steno/optical as small module grid
        if (slot.get("kind") == "text" or (slot.get("name") or "").endswith((".txt", ".py", ".json", ".md"))):
            try:
                raw = Path(p).read_bytes() if p else b""
                text = raw.decode("utf-8", errors="replace")
                pot["kind"] = "text"
                pot["bytes"] = len(raw)
                pot["payload_utf8_preview"] = text[:120]
                # optical potential as if drawn on 960x540 plate
                xfer = transfer_resolution_table(960, 540, 12, 0.25)
                pot["payload_potential"] = {
                    k: v for k, v in xfer.items() if not str(k).startswith("_")
                }
                pot["summary"] = (
                    f"text · {len(raw)} B · optical plate est "
                    f"{xfer.get('visible_module_grid', {}).get('kbps', 0)} KB/s L3-class"
                )
                pot["ok"] = True
            except Exception:
                pass
        slot["payload_potential"] = pot
        slot["potential_summary"] = pot.get("summary") or ""
        return slot

    inn = _enrich_slot(inn)
    out = _enrich_slot(out)
    return {
        "schema": "fc-live-dropbox-v1",
        "glyph_n": GLYPH_N,
        "root": str(DROP_ROOT),
        "in": inn,
        "out": out,
        "note": "glyph-sized IN/OUT pads · drop files/streams like live Dropbox · kbatch 13×13",
        "endpoints": {
            "status": "/dropbox.json",
            "in_upload": "POST /drop/in",
            "out_upload": "POST /drop/out",
            "in_glyph": "/drop/in/glyph.png",
            "out_glyph": "/drop/out/glyph.png",
            "in_file": "/drop/in/file",
            "out_file": "/drop/out/file",
        },
    }


def save_drop(side: str, filename: str, data: bytes) -> dict:
    _ensure_drop_dirs()
    folder = DROP_IN if side == "in" else DROP_OUT
    # sanitize name
    safe = "".join(c if c.isalnum() or c in "._-+" else "_" for c in (filename or "upload.bin"))
    safe = safe[:120] or "upload.bin"
    path = folder / safe
    path.write_bytes(data)
    # also mirror OUT when sending (content we transmit)
    if side == "out":
        pass
    slot = _scan_slot(side)
    if hasattr(ST, "dropbox"):
        ST.dropbox[side] = slot
        ST.dropbox["transfers"] = int(ST.dropbox.get("transfers") or 0) + 1
    return slot


def transfer_resolution_table(w: int, h: int, fps: float, tx_frac: float) -> dict:
    """Potential optical transfer rates by encoding class @ current geometry."""
    free_px = max(1, int(w * h * max(tx_frac, 0.01)))
    fps = max(fps, 0.1)
    # Bits/pixel effective after cam capture (order-of-magnitude)
    classes = {
        "visible_module_grid": {"bpp_eff": 0.08, "note": "8px modules, high contrast (current L3)"},
        "decimen_qr_v27": {"bpp_eff": 0.35, "note": "~1465 B/frame plate @24fps propped"},
        "decimen_qr_v40": {"bpp_eff": 0.55, "note": "~2953 B/frame dense QR"},
        "soft_watermark_meta_class": {"bpp_eff": 0.002, "note": "near-invisible; often dies screen→cam"},
        "google_blur_synthid_class": {"bpp_eff": 0.008, "note": "soft residual; partial cam survival"},
        "pulse_ook_control": {"bpp_eff": 0.00005, "note": "strobe bug control plane"},
        "anaglyph_chroma": {"bpp_eff": 0.015, "note": "R/B residual; glasses or split RX"},
    }
    out = {}
    for name, c in classes.items():
        bps = free_px * c["bpp_eff"] * fps / 8.0
        out[name] = {
            "bytes_per_sec": round(bps, 1),
            "kbps": round(bps / 1024, 2),
            "bytes_per_frame": round(free_px * c["bpp_eff"] / 8.0, 1),
            "note": c["note"],
        }
    # Literature ceilings (geometry-independent propped phone)
    out["_ceilings"] = {
        "decimen_handheld_KBps": 128,
        "decimen_propped_KBps": 186,
        "source": "vendor/decimen-optical-transfer README",
    }
    out["_geometry"] = {
        "width": w,
        "height": h,
        "fps": round(fps, 2),
        "tx_frac": round(tx_frac, 4),
        "tx_pixels": free_px,
        "preview_url": f"http://127.0.0.1:{_CFG['port']}/preview.mjpg",
    }
    return out


def analyze_feed_payload_potential(
    jpg: bytes | None,
    *,
    label: str,
    url: str,
    kind: str = "image",
    fps: float = 12.0,
    tx_frac: float = 0.25,
    name: str | None = None,
) -> dict:
    """Payload output potential resolution for a live feed or dropped file/image/video."""
    meta: dict = {
        "label": label,
        "url": url,
        "name": name,
        "kind": kind,
        "ok": bool(jpg),
        "bytes": len(jpg) if jpg else 0,
        "w": None,
        "h": None,
        "fps_assumed": fps,
        "tx_frac": tx_frac,
        "payload_potential": {},
        "top_class": None,
        "summary": "no signal",
    }
    if not jpg:
        return meta
    if name:
        k = _kind_from_name(name)
        if k not in ("file", "empty"):
            meta["kind"] = k
    if len(jpg) >= 3 and jpg[0:3] == bytes([0xFF, 0xD8, 0xFF]):
        if meta["kind"] in ("file", "auto", "image", None):
            meta["kind"] = "image"
    elif len(jpg) >= 8 and jpg[0:8] == b"\x89PNG\r\n\x1a\n":
        meta["kind"] = "image"
    elif len(jpg) >= 12 and jpg[4:8] == b"ftyp":
        meta["kind"] = "video"
    try:
        im = load_jpeg(jpg)
        if im is not None:
            h, w = int(im.shape[0]), int(im.shape[1])
            meta["w"], meta["h"] = w, h
            xfer = transfer_resolution_table(w, h, fps, tx_frac)
            classes = {k: v for k, v in xfer.items() if not str(k).startswith("_")}
            meta["payload_potential"] = classes
            meta["geometry"] = xfer.get("_geometry")
            meta["ceilings"] = xfer.get("_ceilings")
            ranking = [
                ("visible_module_grid", classes.get("visible_module_grid")),
                ("decimen_qr_v27", classes.get("decimen_qr_v27")),
                ("decimen_qr_v40", classes.get("decimen_qr_v40")),
            ]
            ranked = [(n, c) for n, c in ranking if c]
            if ranked:
                best_n, best_c = max(ranked, key=lambda t: t[1].get("kbps", 0))
                meta["top_class"] = best_n
                meta["summary"] = (
                    f"{w}×{h} · {meta['kind']} · {best_n} "
                    f"{best_c.get('kbps', 0)} KB/s · "
                    f"{best_c.get('bytes_per_frame', 0)} B/f @ {fps:.0f}fps"
                )
            else:
                meta["summary"] = f"{w}×{h} · {meta['kind']} · {len(jpg)} B"
        else:
            # non-jpeg blob (video/bin) — still report size/kind
            meta["summary"] = f"{meta['kind']} · {len(jpg)} B (raw / no still decode)"
            # estimate potential as if 960x540 for video containers
            if meta["kind"] == "video":
                xfer = transfer_resolution_table(960, 540, fps, tx_frac)
                meta["payload_potential"] = {
                    k: v for k, v in xfer.items() if not str(k).startswith("_")
                }
                meta["w"], meta["h"] = 960, 540
                meta["summary"] = (
                    f"video · est 960×540 · decimen_qr_v27 "
                    f"{meta['payload_potential'].get('decimen_qr_v27', {}).get('kbps', 0)} KB/s"
                )
    except Exception as e:
        meta["summary"] = f"err {e}"
        meta["ok"] = False
    return meta


def load_jpeg(data: bytes):
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    arr = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def load_mask_png(data: bytes, w: int, h: int):
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    arr = np.frombuffer(data, dtype=np.uint8)
    m = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if m is None:
        return np.full((h, w), 255, np.uint8)
    if m.shape[1] != w or m.shape[0] != h:
        m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
    return m


def encode_jpeg(bgr, q: int = 75) -> bytes:
    import cv2  # type: ignore

    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), q])
    return buf.tobytes() if ok else b""


def modules_for_payload(payload: bytes, n: int) -> list[int]:
    """Deterministic pseudo-random bits expanded from payload."""
    out = []
    seed = hashlib.sha256(payload).digest()
    i = 0
    while len(out) < n:
        block = hashlib.sha256(seed + i.to_bytes(4, "big")).digest()
        for b in block:
            for bit in range(8):
                out.append((b >> bit) & 1)
                if len(out) >= n:
                    return out
        i += 1
    return out


def bits_to_bytes(bits: list[int]) -> bytes:
    out = bytearray()
    for i in range(0, len(bits) - 7, 8):
        b = 0
        for j in range(8):
            b = (b << 1) | (bits[i + j] & 1)
        out.append(b)
    return bytes(out)


def l3_geometry(h: int, w: int, cell: int = 8) -> dict:
    y0, y1 = int(0.74 * h), int(0.90 * h)
    x0, x1 = int(0.04 * w), int(0.96 * w)
    plate_h, plate_w = y1 - y0, x1 - x0
    rows, cols = max(1, plate_h // cell), max(1, plate_w // cell)
    return {
        "y0": y0,
        "y1": y1,
        "x0": x0,
        "x1": x1,
        "cell": cell,
        "rows": rows,
        "cols": cols,
        "n": rows * cols,
    }


def expected_l3_bits(payload: bytes, t: float, n: int) -> list[int]:
    return modules_for_payload(payload + b"L3" + struct.pack(">H", int(t) % 65535), n)


def render_send_plate(
    w: int,
    h: int,
    payload: bytes,
    t: float,
    free_mask=None,
) -> tuple[bytes, dict]:
    """Clean TX content plate (what we are sending) — no program video."""
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    plate = np.zeros((h, w, 3), dtype=np.uint8)
    plate[:] = (12, 12, 18)
    g = l3_geometry(h, w, 8)
    bits = expected_l3_bits(payload, t, g["n"])
    y0, x0, cell = g["y0"], g["x0"], g["cell"]
    bi = 0
    drawn = 0
    for r in range(g["rows"]):
        for c in range(g["cols"]):
            if bi >= len(bits):
                break
            yy, xx = y0 + r * cell, x0 + c * cell
            if free_mask is not None and free_mask[min(yy, h - 1), min(xx, w - 1)] < 128:
                bi += 1
                continue
            v = 230 if bits[bi] else 25
            plate[yy : yy + cell - 1, xx : xx + cell - 1] = (v, v, v)
            drawn += 1
            bi += 1
    # side bars
    side_bits = modules_for_payload(
        payload + struct.pack(">I", int(t * 15) % 0xFFFFFFFF), 128
    )
    sc = max(3, h // 64)
    for x0s in (2, w - 10):
        y = int(0.08 * h)
        for b in side_bits[:64]:
            if y + sc >= int(0.70 * h):
                break
            color = (240, 240, 240) if b else (20, 20, 20)
            plate[y : y + sc - 1, x0s : x0s + 6] = color
            y += sc
    # pulse bug
    bit_i = int(t * 4) % (8 * max(1, len(payload)))
    byte = payload[bit_i // 8 % len(payload)]
    on = ((byte >> (7 - (bit_i % 8))) & 1) == 1
    bx0, by0 = int(0.93 * w), int(0.04 * h)
    bx1, by1 = int(0.98 * w), int(0.12 * h)
    plate[by0:by1, bx0:bx1] = (40, 40, 255) if on else (30, 30, 30)
    # labels + payload text
    try:
        text = payload.decode("utf-8", errors="replace")
    except Exception:
        text = payload.hex()
    cv2.putText(
        plate,
        "SEND · optical TX content (no program)",
        (12, 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (110, 255, 180),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        plate,
        f"payload: {text[:72]}",
        (12, 52),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (200, 210, 255),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        plate,
        f"L3 modules {g['rows']}x{g['cols']} cell={cell} drawn={drawn} · t={t:.1f}s",
        (12, h - 16),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        (160, 160, 180),
        1,
        cv2.LINE_AA,
    )
    cv2.rectangle(plate, (g["x0"], g["y0"]), (g["x1"], g["y1"]), (80, 200, 80), 1)
    meta = {
        "payload_utf8": text,
        "payload_hex": payload.hex(),
        "payload_bytes": len(payload),
        "l3_modules_drawn": drawn,
        "l3_bits": g["n"],
        "geometry": g,
        "pulse_on": on,
    }
    return encode_jpeg(plate, 85), meta


def simulate_rx_from_frame(
    img,
    payload: bytes,
    t: float,
    free_mask=None,
    cam_noise: float = 0.0,
) -> tuple[bytes, dict]:
    """Recover L3 modules from composited frame → after-transfer result.

    Samples mean luminance per cell; compares to expected bits for BER.
    Optional cam_noise simulates phone capture blur/noise on a copy.
    """
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    h, w = img.shape[:2]
    work = img.copy()
    if cam_noise > 0:
        # mild JPEG recompress + blur + noise ≈ screen→cam
        blur = cv2.GaussianBlur(work, (3, 3), 0.6)
        noise = np.random.default_rng(int(t * 10) % 10000).normal(
            0, cam_noise * 25, size=blur.shape
        )
        work = np.clip(blur.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        # re-jpeg
        ok, buf = cv2.imencode(".jpg", work, [int(cv2.IMWRITE_JPEG_QUALITY), 55])
        if ok:
            work = cv2.imdecode(buf, cv2.IMREAD_COLOR)

    g = l3_geometry(h, w, 8)
    expected = expected_l3_bits(payload, t, g["n"])
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    y0, x0, cell = g["y0"], g["x0"], g["cell"]
    # adaptive threshold from L3 plate histogram (mid of dark/bright modules)
    plate_roi = gray[y0 : g["y1"], x0 : g["x1"]]
    thr = float(np.median(plate_roi)) if plate_roi.size else 120.0
    # also try Otsu if contrast ok
    try:
        otsu, _ = cv2.threshold(plate_roi, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if 40 < otsu < 220:
            thr = 0.5 * thr + 0.5 * float(otsu)
    except Exception:
        pass

    recovered: list[int] = []
    rx_plate = np.zeros((h, w, 3), dtype=np.uint8)
    rx_plate[:] = (10, 14, 12)
    # show dim program under L3 for context
    rx_plate[y0 : g["y1"], x0 : g["x1"]] = (
        work[y0 : g["y1"], x0 : g["x1"]].astype(np.float32) * 0.25
    ).astype(np.uint8)

    correct = 0
    total = 0
    bi = 0
    means: list[float] = []
    for r in range(g["rows"]):
        for c in range(g["cols"]):
            if bi >= len(expected):
                break
            yy, xx = y0 + r * cell, x0 + c * cell
            if free_mask is not None and free_mask[min(yy, h - 1), min(xx, w - 1)] < 128:
                recovered.append(-1)  # skipped
                bi += 1
                continue
            # sample center of cell (avoid border bleed)
            yy2, xx2 = yy + 1, xx + 1
            patch = gray[yy2 : yy + cell - 2, xx2 : xx + cell - 2]
            if patch.size == 0:
                patch = gray[yy : yy + cell - 1, xx : xx + cell - 1]
            if patch.size == 0:
                recovered.append(0)
                bi += 1
                continue
            mean = float(patch.mean())
            means.append(mean)
            bit = 1 if mean > thr else 0
            recovered.append(bit)
            exp = expected[bi]
            if bit == exp:
                correct += 1
                col = (40, 220, 120) if bit else (30, 80, 50)
            else:
                col = (40, 40, 240)  # red = bit error
            rx_plate[yy : yy + cell - 1, xx : xx + cell - 1] = col
            total += 1
            bi += 1

    # valid bits only for byte recovery
    valid_bits = [b for b in recovered if b >= 0]
    # Align to expected for payload-ish display: use expected→bytes when BER high
    ber = 1.0 - (correct / total) if total else 1.0
    recovered_bytes = bits_to_bytes(valid_bits[: 8 * 64])
    try:
        # show printable slice
        rec_txt = "".join(chr(b) if 32 <= b < 127 else "." for b in recovered_bytes[:48])
    except Exception:
        rec_txt = recovered_bytes[:24].hex()
    try:
        expect_txt = payload.decode("utf-8", errors="replace")
    except Exception:
        expect_txt = payload.hex()

    # match score against raw payload bytes as bit stream
    exp_payload_bits = []
    for b in payload:
        for i in range(7, -1, -1):
            exp_payload_bits.append((b >> i) & 1)
    # fountain-style: we don't embed payload raw in L3 (we embed hash stream).
    # Recovery "content" = reconstructed module image + BER vs TX plate.
    status = "ok" if ber < 0.08 else ("degraded" if ber < 0.25 else "fail")

    cv2.putText(
        rx_plate,
        "RX · after transfer (decoded L3 from composited frame)",
        (12, 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (120, 255, 200),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        rx_plate,
        f"BER {ber*100:.1f}% · correct {correct}/{total} · status={status}",
        (12, 52),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.48,
        (255, 220, 120) if status != "fail" else (80, 80, 255),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        rx_plate,
        f"sent payload: {expect_txt[:56]}",
        (12, 74),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (180, 190, 210),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        rx_plate,
        f"rx bit-bytes ascii: {rec_txt[:56]}",
        (12, 94),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (160, 200, 255),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        rx_plate,
        "green=match TX · red=bit error · cam_noise=%.2f" % cam_noise,
        (12, h - 16),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.4,
        (150, 150, 160),
        1,
        cv2.LINE_AA,
    )
    cv2.rectangle(rx_plate, (g["x0"], g["y0"]), (g["x1"], g["y1"]), (80, 200, 80), 1)

    meta = {
        "status": status,
        "ber": round(ber, 4),
        "ber_pct": round(ber * 100, 2),
        "bits_correct": correct,
        "bits_total": total,
        "threshold": round(thr, 1),
        "mean_luma_range": [round(min(means), 1), round(max(means), 1)] if means else [0, 0],
        "cam_noise": cam_noise,
        "sent_payload": expect_txt,
        "rx_ascii_preview": rec_txt,
        "rx_bytes_hex": recovered_bytes[:32].hex(),
        "throughput_note": "L3 module BER vs known TX plate; Decimen QR would replace module grid for file RX",
    }
    return encode_jpeg(rx_plate, 85), meta


def draw_sidebar_code(img, free_mask, payload: bytes, t: float) -> int:
    """Thin vertical modules in left/right pillars. Returns bytes-equivalent this frame."""
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    h, w = img.shape[:2]
    bits = modules_for_payload(payload + struct.pack(">I", int(t * 15) % 0xFFFFFFFF), 256)
    cell = max(3, h // 64)
    n = 0
    for side, x0 in (("L", 2), ("R", w - 10)):
        x = x0
        y = int(0.08 * h)
        for b in bits[:64]:
            if y + cell >= int(0.70 * h):
                break
            color = (240, 240, 240) if b else (20, 20, 20)
            # only draw where free
            roi = free_mask[y : y + cell, x : x + 6]
            if roi.size and roi.mean() > 128:
                cv2.rectangle(img, (x, y), (x + 6, y + cell - 1), color, -1)
                n += 1
            y += cell
    return max(1, n // 8)


def draw_lower_third_plate(img, free_mask, payload: bytes, t: float) -> int:
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    h, w = img.shape[:2]
    y0, y1 = int(0.74 * h), int(0.90 * h)
    x0, x1 = int(0.04 * w), int(0.96 * w)
    plate_h, plate_w = y1 - y0, x1 - x0
    if plate_h < 8 or plate_w < 8:
        return 0
    # soft dark plate (human still reads chyron-like bar)
    roi = img[y0:y1, x0:x1]
    dark = (roi.astype(np.float32) * 0.45).astype(np.uint8)
    # module grid ~ QR density light
    cell = 8
    rows, cols = plate_h // cell, plate_w // cell
    bits = modules_for_payload(payload + b"L3" + struct.pack(">H", int(t) % 65535), rows * cols)
    bi = 0
    for r in range(rows):
        for c in range(cols):
            if bi >= len(bits):
                break
            yy, xx = r * cell, c * cell
            if free_mask[y0 + yy, x0 + xx] < 128:
                bi += 1
                continue
            v = 210 if bits[bi] else 40
            dark[yy : yy + cell - 1, xx : xx + cell - 1] = (
                dark[yy : yy + cell - 1, xx : xx + cell - 1].astype(np.float32) * 0.35
                + v * 0.65
            ).astype(np.uint8)
            bi += 1
    img[y0:y1, x0:x1] = dark
    # label
    cv2.putText(
        img,
        "L3 TX · layered",
        (x0 + 8, y1 - 8),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (180, 220, 255),
        1,
        cv2.LINE_AA,
    )
    return max(1, (rows * cols) // 8)


def draw_anaglyph_ghost(img, free_mask, payload: bytes, t: float) -> int:
    import numpy as np  # type: ignore

    h, w = img.shape[:2]
    shift = int(3 + 2 * math.sin(t * 2.2))
    ghost = np.roll(img, shift, axis=1)
    # encode payload into red-cyan residual amplitude
    amp = 0.12 + 0.04 * ((payload[0] % 5) / 5.0)
    free = (free_mask > 128)[:, :, None]
    blend = img.astype(np.float32)
    g = ghost.astype(np.float32)
    # R from ghost, B from original (anaglyph-ish)
    out = blend.copy()
    out[:, :, 2] = np.clip(blend[:, :, 2] * (1 - amp) + g[:, :, 2] * amp, 0, 255)
    out[:, :, 0] = np.clip(blend[:, :, 0] * (1 - amp * 0.7) + g[:, :, 0] * amp * 0.5, 0, 255)
    img[:] = np.where(free, out, blend).astype(np.uint8)
    return 32  # ~fixed small residual payload hint


def draw_pulse(img, free_mask, payload: bytes, t: float) -> int:
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    # 4 Hz bit clock in logo bug region
    bit_i = int(t * 4) % (8 * max(1, len(payload)))
    byte = payload[bit_i // 8 % len(payload)]
    on = ((byte >> (7 - (bit_i % 8))) & 1) == 1
    h, w = img.shape[:2]
    x0, y0 = int(0.93 * w), int(0.04 * h)
    x1, y1 = int(0.98 * w), int(0.12 * h)
    color = (40, 40, 255) if on else (30, 30, 30)
    if free_mask[y0:y1, x0:x1].mean() > 100:
        cv2.rectangle(img, (x0, y0), (x1, y1), color, -1)
        cv2.rectangle(img, (x0, y0), (x1, y1), (200, 200, 200), 1)
    return 1 if on else 0


def chrome_band_mask(h: int, w: int):
    """TX-allowed chrome only: L3 + ticker + pillars + top bugs (not picture)."""
    import numpy as np  # type: ignore

    m = np.zeros((h, w), dtype=np.uint8)
    # lower-third + ticker
    m[int(0.72 * h) :, :] = 255
    # pillars
    m[:, : int(0.10 * w)] = 255
    m[:, int(0.90 * w) :] = 255
    # top strip for bug / strobe
    m[: int(0.16 * h), int(0.70 * w) :] = 255
    m[: int(0.08 * h), :] = 255
    return m


def restrict_tx_mask(free_mask, mode: str):
    """Intersect free mask with chrome band in broadcast mode."""
    import numpy as np  # type: ignore

    if mode not in ("broadcast", "chrome", "news"):
        return free_mask
    h, w = free_mask.shape[:2]
    chrome = chrome_band_mask(h, w)
    # free AND chrome; picture stays clean even if SAM free-zone is huge
    return np.where((free_mask > 128) & (chrome > 128), 255, 0).astype(np.uint8)


def draw_watermark_noise(img, free_mask, payload: bytes, strength: float = 0.04) -> int:
    """Soft residual noise (Google-blurry / Meta-class *visible-lite* demo)."""
    import numpy as np  # type: ignore

    h, w = img.shape[:2]
    seed = int.from_bytes(hashlib.sha256(payload).digest()[:4], "big")
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 12, size=(h, w, 1)).astype(np.float32)
    free = (free_mask > 128)[:, :, None]
    base = img.astype(np.float32)
    out = np.clip(base + noise * strength * 255 * free, 0, 255)
    img[:] = out.astype(np.uint8)
    # effective bits: very rough
    free_px = int((free_mask > 128).sum())
    return max(1, int(free_px * strength * 0.02 / 8))


def blend_alt_still(img, free_mask, still_path: str, alpha: float = 0.35) -> int:
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    p = Path(still_path)
    if not p.is_file():
        return 0
    alt = cv2.imread(str(p))
    if alt is None:
        return 0
    h, w = img.shape[:2]
    alt = cv2.resize(alt, (w, h))
    free = (free_mask > 128)[:, :, None].astype(np.float32)
    # only lower third + pillars for alt media peek
    band = np.zeros_like(free)
    band[int(0.72 * h) :, :] = 1
    band[:, : int(0.10 * w)] = 1
    band[:, int(0.90 * w) :] = 1
    m = free * band
    out = img.astype(np.float32) * (1 - m * alpha) + alt.astype(np.float32) * (m * alpha)
    img[:] = out.astype(np.uint8)
    return int(m.sum() / 3)


def draw_region_outlines(img, regions: dict | None) -> None:
    import cv2  # type: ignore

    if not regions:
        return
    h, w = img.shape[:2]
    for r in regions.get("regions") or []:
        box = r.get("box") or [0, 0, 0, 0]
        x, y, bw, bh = box
        x0, y0 = int(x * w), int(y * h)
        x1, y1 = int((x + bw) * w), int((y + bh) * h)
        role = r.get("role", "")
        color = (80, 200, 80) if role.startswith("tx") or role == "beacon" else (80, 80, 200)
        if role == "occlude":
            color = (0, 0, 220)
        if role == "strobe":
            color = (0, 200, 255)
        cv2.rectangle(img, (x0, y0), (x1, y1), color, 1)


class RateWin:
    """Sliding 1s byte/frame counters."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.events: deque[tuple[float, int, int]] = deque()  # t, bytes, frames

    def add(self, n_bytes: int, n_frames: int = 1) -> None:
        now = time.time()
        with self.lock:
            self.events.append((now, n_bytes, n_frames))
            self._trim(now)

    def _trim(self, now: float) -> None:
        while self.events and now - self.events[0][0] > 1.0:
            self.events.popleft()

    def rates(self) -> dict:
        now = time.time()
        with self.lock:
            self._trim(now)
            b = sum(e[1] for e in self.events)
            f = sum(e[2] for e in self.events)
            if not self.events:
                return {"Bps": 0.0, "fps": 0.0, "window_s": 1.0}
            span = max(now - self.events[0][0], 1e-3)
            return {
                "Bps": round(b / span, 1),
                "KBps": round(b / span / 1024, 2),
                "fps": round(f / span, 2),
                "window_s": round(span, 3),
            }


class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.jpeg: bytes | None = None  # after overlay (mix out)
        self.before_jpeg: bytes | None = None  # before overlay (mix in)
        self.send_jpeg: bytes | None = None  # optical TX content plate
        self.rx_jpeg: bytes | None = None  # after-transfer decode result
        self.mix2_jpeg: bytes | None = None  # extra mix (upstream/other)
        self.mix3_jpeg: bytes | None = None  # extra mix (phone/alt live)
        self.mix2_meta: dict = {"label": MIX2_LABEL, "url": MIX2_URL, "ok": False}
        self.mix3_meta: dict = {"label": MIX3_LABEL, "url": MIX3_URL or ALT_STILL, "ok": False}
        # Decimen-style LT fountain progress (bytes built as portions)
        self.fountain_enc = None
        self.fountain_dec = None
        self.fountain_seq = 0
        self.fountain_payload_key = b""
        self.fountain_scatter: list = []  # recent frames for scatter plot
        self.fountain_status: dict = {}
        self.glyph_frame_i = 0
        self.send_meta: dict = {}
        self.rx_meta: dict = {}
        self.budget: dict = {}
        self.metrics: dict = {}
        self.frames = 0
        self.t0 = time.time()
        self.stop = threading.Event()
        # packet / stage rates
        self.in_win = RateWin()  # bytes pulled from mix.jpg
        self.out_win = RateWin()  # bytes encoded to preview
        self.client_win = RateWin()  # bytes pushed to mjpg/jpg clients
        self.proc_ms_ema = 0.0
        self.last_in_bytes = 0
        self.last_out_bytes = 0
        self.last_wh = (960, 540)
        self.clients_mjpg = 0
        self.clients_total_served = 0
        self.drop_no_input = 0
        self.mix_upstream: dict = {}
        self.payload_text = ""
        self.last_in_ts = 0.0
        self.last_out_ts = 0.0
        self.packet_view: dict = {}
        self.packet_seq = 0
        self.dropbox: dict = {
            "in": {"name": None, "bytes": 0, "kind": "empty", "ts": 0.0, "glyph": None},
            "out": {"name": None, "bytes": 0, "kind": "empty", "ts": 0.0, "glyph": None},
            "transfers": 0,
        }
        self.bound_payload: bytes | None = None  # OUT drop bind → optical/steno payload


ST = State()


def build_metrics(
    *,
    mode: str,
    meas_fps: float,
    free_raw_frac: float,
    tx_frac: float,
    w: int,
    h: int,
    b_l3: int,
    b_side: int,
    b_ana: int,
    b_pulse: int,
    b_wm: int,
    b_alt: int,
    in_bytes: int,
    out_bytes: int,
    proc_ms: float,
) -> dict:
    fps = max(meas_fps, 0.1)
    optical_B_frame = b_l3 + b_side + b_wm + b_ana
    optical_Bps = optical_B_frame * fps
    pulse_bps = b_pulse * 4  # draw_pulse uses ~4 Hz bit clock
    in_r = ST.in_win.rates()
    out_r = ST.out_win.rates()
    cli_r = ST.client_win.rates()
    xfer = transfer_resolution_table(w, h, fps, tx_frac)
    uptime = time.time() - ST.t0

    stages = {
        "before": {
            "label": "IN · mix-pipe program (pre-overlay)",
            "url": MIX_URL,
            "snapshot": f"http://127.0.0.1:{_CFG['port']}/before.jpg",
            "last_packet_bytes": in_bytes,
            "rate": in_r,
            "resolution": {"w": w, "h": h},
            "codec": "image/jpeg",
            "source": "yt-dlp → ffmpeg mjpeg → mix_pipe_server → mix.jpg",
            "upstream_mix": ST.mix_upstream,
        },
        "overlay": {
            "label": "OVERLAY · optical layers on chrome/free mask",
            "mode": mode,
            "proc_ms_ema": round(ST.proc_ms_ema, 2),
            "proc_ms_last": round(proc_ms, 2),
            "tx_frac": round(tx_frac, 4),
            "free_frac_raw": round(free_raw_frac, 4),
            "packets_optical_B_frame": {
                "lower_third_modules": b_l3,
                "sidebar_modules": b_side,
                "anaglyph": b_ana,
                "watermark_noise": b_wm,
                "pulse_bits_this_frame": b_pulse,
                "alt_still_px": b_alt,
                "sum_data_B_frame": optical_B_frame,
            },
            "packets_optical_out_Bps": {
                "modules_stacked": round(optical_Bps, 1),
                "modules_stacked_KBps": round(optical_Bps / 1024, 2),
                "pulse_control_bps": pulse_bps,
            },
        },
        "mix": {
            "label": "OUT · layered rebroadcast (preview)",
            "url": f"http://127.0.0.1:{_CFG['port']}/preview.mjpg",
            "snapshot": f"http://127.0.0.1:{_CFG['port']}/preview.jpg",
            "last_packet_bytes": out_bytes,
            "rate_encode": out_r,
            "rate_clients": cli_r,
            "resolution": {"w": w, "h": h},
            "codec": "image/jpeg q≈78 · multipart mjpeg",
            "mjpg_clients": ST.clients_mjpg,
            "http_packets_served": ST.clients_total_served,
        },
    }

    # compression / packet expansion
    expand = (out_bytes / in_bytes) if in_bytes else 0.0
    return {
        "schema": "fc-layered-metrics-v1",
        "ok": True,
        "ts": time.time(),
        "uptime_s": round(uptime, 1),
        "mode": mode,
        "frame": ST.frames,
        "measured_composite_fps": round(meas_fps, 2),
        "packets": {
            "in": {
                "last_B": in_bytes,
                "Bps": in_r.get("Bps", 0),
                "KBps": in_r.get("KBps", 0),
                "fps": in_r.get("fps", 0),
                "total_frames": ST.frames,
                "drops_no_input": ST.drop_no_input,
            },
            "out": {
                "last_B": out_bytes,
                "Bps": out_r.get("Bps", 0),
                "KBps": out_r.get("KBps", 0),
                "fps": out_r.get("fps", 0),
                "jpeg_expand_ratio": round(expand, 3),
            },
            "clients": {
                "Bps": cli_r.get("Bps", 0),
                "KBps": cli_r.get("KBps", 0),
                "mjpg_viewers": ST.clients_mjpg,
                "http_serves": ST.clients_total_served,
            },
            "optical_sidechannel": {
                "B_frame": optical_B_frame,
                "Bps": round(optical_Bps, 1),
                "KBps": round(optical_Bps / 1024, 2),
                "channels": {
                    "l3": b_l3,
                    "sidebar": b_side,
                    "anaglyph": b_ana,
                    "watermark": b_wm,
                    "pulse_bit": b_pulse,
                },
            },
        },
        "stages": stages,
        "transfer_resolution": xfer,
        "endpoints": {
            "preview_mjpg": f"http://127.0.0.1:{_CFG['port']}/preview.mjpg",
            "preview_jpg": f"http://127.0.0.1:{_CFG['port']}/preview.jpg",
            "before_jpg": f"http://127.0.0.1:{_CFG['port']}/before.jpg",
            "after_jpg": f"http://127.0.0.1:{_CFG['port']}/after.jpg",
            "send_jpg": f"http://127.0.0.1:{_CFG['port']}/send.jpg",
            "rx_jpg": f"http://127.0.0.1:{_CFG['port']}/rx.jpg",
            "mix2_jpg": f"http://127.0.0.1:{_CFG['port']}/mix2.jpg",
            "mix3_jpg": f"http://127.0.0.1:{_CFG['port']}/mix3.jpg",
            "metrics_json": f"http://127.0.0.1:{_CFG['port']}/metrics.json",
            "metrics_html": f"http://127.0.0.1:{_CFG['port']}/metrics",
            "budget_json": f"http://127.0.0.1:{_CFG['port']}/budget.json",
            "mix_in": MIX_URL,
            "mix_status": MIX_STATUS_URL,
        },
        "transfer": {
            "send": ST.send_meta,
            "rx": ST.rx_meta,
            "payload": ST.payload_text,
        },
        "timesync": timesync_snapshot(),
        "packets_view": ST.packet_view,
        "dropbox": dropbox_status(),
        "quantum_gutter": (
            _qg_metrics_cache["data"]
            if (time.time() - _qg_metrics_cache["t"] < (2.5 if LAYERED_LITE else 0.8)
                and _qg_metrics_cache["data"])
            else (
                _qg_metrics_cache.update(
                    {"t": time.time(), "data": build_quantum_gutter_json(prefer="auto", max_lines=32 if LAYERED_LITE else 48)}
                )
                or _qg_metrics_cache["data"]
            )
        ),
        "fountain": getattr(ST, "fountain_status", None) or {},
        "mixes": {
            "main": {
                **(
                    analyze_feed_payload_potential(
                        ST.jpeg,
                        label="Live preview · mix out (layered)",
                        url=f"http://127.0.0.1:{_CFG['port']}/preview.mjpg",
                        kind="image",
                        fps=max(meas_fps, 1.0),
                        tx_frac=tx_frac if tx_frac else 0.25,
                        name="preview",
                    )
                    if not LAYERED_LITE
                    else {
                        "label": "Live preview · mix out (layered)",
                        "ok": bool(ST.jpeg),
                        "bytes": len(ST.jpeg) if ST.jpeg else 0,
                        "summary": f"{w}×{h} · lite",
                    }
                ),
                "mjpg": f"http://127.0.0.1:{_CFG['port']}/preview.mjpg",
                "jpg": f"http://127.0.0.1:{_CFG['port']}/preview.jpg",
            },
            "mix2": {
                **(getattr(ST, "mix2_meta", None) or {}),
                "mjpg": f"http://127.0.0.1:{_CFG['port']}/mix2.mjpg",
                "jpg": f"http://127.0.0.1:{_CFG['port']}/mix2.jpg",
            },
            "mix3": {
                **(getattr(ST, "mix3_meta", None) or {}),
                "mjpg": f"http://127.0.0.1:{_CFG['port']}/mix3.mjpg",
                "jpg": f"http://127.0.0.1:{_CFG['port']}/mix3.jpg",
            },
        },
        "version": LAYERED_VERSION,
    }


METRICS_HTML = r"""<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>fc-layered · pipeline metrics</title>
<style>
  :root {
    --bg:#0b0c10; --card:#14161c; --ink:#e8eaef; --mut:#8b93a7;
    --acc:#6ee7b7; --warn:#fbbf24; --hot:#f87171; --zulu:#fde68a; --cyan:#67e8f9;
    --left: minmax(0, 0.95fr); --right: minmax(480px, 1.35fr);
  }
  * { box-sizing:border-box; }
  html, body { height:100%; }
  body {
    margin:0; overflow:hidden;
    font:13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    background:var(--bg); color:var(--ink);
    font-variant-numeric: tabular-nums;
  }
  header {
    height:44px; padding:0 14px; border-bottom:1px solid #222;
    display:flex; gap:10px; align-items:center; flex-wrap:nowrap; overflow:hidden;
  }
  header .brand {
    display:flex; align-items:center; gap:8px; flex:0 0 auto; min-width:0;
  }
  header h1 { margin:0; font-size:14px; font-weight:700; letter-spacing:.04em; white-space:nowrap; flex:0 0 auto; }
  header .ver {
    font-size:11px; font-weight:700; color:#a5b4fc; background:#12162a;
    border:1px solid #2a3355; border-radius:6px; padding:2px 8px;
    white-space:nowrap; font-variant-numeric: tabular-nums; letter-spacing:.03em;
  }
  header .btn-refresh {
    appearance:none; cursor:pointer;
    font: inherit; font-size:11px; font-weight:700; letter-spacing:.04em;
    color:#0b1220; background:linear-gradient(180deg,#86efac,#34d399);
    border:1px solid #166534; border-radius:6px; padding:4px 10px;
    white-space:nowrap; flex:0 0 auto;
  }
  header .btn-refresh:hover { filter:brightness(1.06); }
  header .btn-refresh:active { transform:translateY(1px); }
  header .pill {
    background:#1f2937; padding:2px 10px; border-radius:999px; color:var(--acc);
    min-width:7.5rem; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  header a { color:#93c5fd; white-space:nowrap; flex:0 0 auto; }
  header .grow { flex:1 1 auto; min-width:0; }
  main.shell {
    display:grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap:8px;
    height: calc(100vh - 44px);
    padding:8px 10px 10px; overflow:hidden;
  }
  main.shell > .tsync {
    grid-row: 1; height:auto; max-height:168px; min-height:0;
    overflow:hidden; flex:none;
  }
  main.shell > .tsync.collapsed { max-height:36px; min-height:36px; }
  main.shell > .tsync.collapsed .ts-top .zulu-sub,
  main.shell > .tsync.collapsed .io-sync,
  main.shell > .tsync.collapsed .mkts,
  main.shell > .tsync.collapsed .foot,
  main.shell > .tsync.collapsed .ntp { display:none; }
  main.shell > .tsync.collapsed .zulu-big { font-size:18px; height:22px; }

  main.shell .mid {
    grid-row: 2; min-height:0; height:100%;
    display:grid;
    grid-template-columns: var(--left) var(--right);
    gap:10px; overflow:hidden;
  }
  @media (max-width: 1100px) {
    body { overflow:auto; }
    main.shell {
      height:auto; min-height:100vh; overflow:visible;
      grid-template-rows: auto auto;
    }
    main.shell > .tsync { height:auto; max-height:none; min-height:140px; }
    main.shell .mid { grid-template-columns: 1fr; height:auto; overflow:visible; }
  }
  .col { min-width:0; min-height:0; display:flex; flex-direction:column; gap:10px; overflow:hidden; }
  .card {
    background:var(--card); border:1px solid #252830; border-radius:10px; padding:10px 12px;
    min-width:0; overflow:hidden;
  }
  .card h2 {
    margin:0 0 8px; font-size:11px; color:var(--mut); text-transform:uppercase;
    letter-spacing:.08em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .grid3 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
  .metric {
    background:#0e1016; border-radius:8px; padding:10px;
    min-height:74px; overflow:hidden;
  }
  .metric .k { color:var(--mut); font-size:10px; text-transform:uppercase; white-space:nowrap; }
  .metric .v {
    font-size:18px; font-weight:700; color:var(--acc); margin-top:4px;
    height:1.25em; line-height:1.25em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .metric .s {
    color:var(--mut); font-size:11px; margin-top:4px;
    height:1.3em; line-height:1.3em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  /* fixed image slots — no layout thrash on src swap */
  .frame {
    position:relative; width:100%; aspect-ratio:16/9;
    background:#050608; border-radius:8px; overflow:hidden; flex:0 0 auto;
  }
  .frame img {
    position:absolute; inset:0; width:100%; height:100%;
    object-fit:contain; display:block; background:#000;
  }
  .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; min-width:0; }
  .thumb-block { min-width:0; overflow:hidden; }
  .meta-line {
    color:var(--mut); font-size:11px; margin:6px 0 0;
    height:2.6em; line-height:1.3em; overflow:hidden;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  }
  /* tables with fixed row heights */
  .table-wrap { overflow:auto; max-height:100%; }
  table { width:100%; border-collapse:collapse; font-size:12px; table-layout:fixed; }
  th, td {
    text-align:left; padding:5px 6px; border-bottom:1px solid #1e222b;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; height:28px;
  }
  th { color:var(--mut); font-weight:600; }
  #stages td:nth-child(1) { width:32%; }
  #stages td:nth-child(2) { width:14%; }
  #stages td:nth-child(3) { width:22%; }
  #stages td:nth-child(4) { width:12%; }
  #stages td:nth-child(5) { width:20%; }
  #xfer td:nth-child(1) { width:34%; }
  #xfer td:nth-child(2) { width:14%; }
  #xfer td:nth-child(3) { width:12%; }
  #xfer td:nth-child(4) { width:40%; }
  #stages, #xfer { height: 3 * 28px; }
  tbody#stages tr, tbody#xfer tr { height:28px; }
  .geo-line {
    color:var(--mut); margin:8px 0 0; font-size:11px;
    height:1.4em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }
  a { color:#93c5fd; }
  /* timesync — fixed height, no reflow from markets/text */
  .tsync {
    flex:0 0 auto;
    height: 168px;
    background: linear-gradient(180deg, #0f141c 0%, #0a0c12 100%);
    border: 1px solid #2a3344;
    border-radius: 12px;
    padding: 12px 14px;
    box-shadow: 0 0 40px rgba(0,180,255,.06);
    overflow:hidden;
  }
  .tsync .ts-top {
    display:grid; grid-template-columns: 1fr minmax(160px, 34%);
    gap:10px; align-items:start; height:58px;
  }
  .tsync .zulu-big {
    font-size: 36px; font-weight: 800; letter-spacing: .06em;
    color: var(--zulu); line-height: 1; height:40px;
    font-variant-numeric: tabular-nums;
    white-space:nowrap; overflow:hidden;
  }
  .tsync .zulu-sub {
    color: var(--cyan); font-size: 12px; margin-top: 4px; height:16px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .tsync .tier {
    font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 8px;
    background: #13251f; color: var(--acc); border: 1px solid #1f4d3a;
    height:28px; line-height:18px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:right;
  }
  .tsync .tier.warn { background: #2a2010; color: var(--warn); border-color: #5c4510; }
  .tsync .tier.bad { background: #2a1212; color: var(--hot); border-color: #5c1a1a; }
  .tsync .ntp {
    margin-top:6px; font-size:11px; color:var(--mut); height:16px; text-align:right;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .tsync .io-sync {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px; height:72px;
  }
  .tsync .io-box {
    background: #0b0e14; border: 1px solid #1e2636; border-radius: 10px;
    padding: 8px 10px; overflow:hidden; min-width:0;
  }
  .tsync .io-box .lab { font-size: 10px; color: var(--mut); text-transform: uppercase; letter-spacing: .08em; height:14px; }
  .tsync .io-box .big {
    font-size: 20px; font-weight: 800; color: var(--cyan); margin-top: 2px; height:26px; line-height:26px;
    letter-spacing: .02em; white-space:nowrap; overflow:hidden; font-variant-numeric: tabular-nums;
  }
  .tsync .io-box .sub {
    font-size: 10px; color: var(--mut); margin-top: 2px; height:16px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .tsync .io-box.delta .big { color: var(--acc); }
  .tsync .mkts {
    display: grid; grid-template-columns: repeat(8, minmax(0,1fr)); gap: 4px; margin-top: 8px; height:24px;
  }
  .tsync .mkt {
    font-size: 10px; padding: 2px 4px; border-radius: 999px; background: #12161f; color: var(--mut);
    border: 1px solid #222; text-align:center; height:22px; line-height:16px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .tsync .mkt.open { color: #34d399; border-color: #14532d; }
  .tsync .mkt.pre, .tsync .mkt.ah { color: var(--warn); border-color: #5c4510; }
  .tsync .foot {
    margin-top: 6px; font-size: 10px; color: var(--mut); height:14px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .tsync .foot b { color: #c4b5fd; font-weight: 600; }
  /* left: LIVE PREVIEW first (top), timesync under it */
  .col-left .card.preview-card {
    flex:1 1 auto; min-height:0; display:flex; flex-direction:column;
  }
  .col-left .card.preview-card > .frame.main { flex:1 1 auto; min-height:120px; aspect-ratio:auto; }
  .col-left .mix-extra .frame { min-height:0; }
  .col-left .mix-extra h2 { margin:0 0 4px; font-size:10px; color:var(--mut); text-transform:uppercase; letter-spacing:.06em; }
  .col-right {
    overflow:auto; display:flex; flex-direction:column; gap:10px; min-height:0;
    scrollbar-gutter: stable;
  }
  .col-right .card.packets { flex:0 0 auto; }
  .col-right .card.stages { flex:0 0 auto; }
  .col-right .card.xfer { flex:0 0 auto; }
  .col-right .card.pktview {
    flex:1 1 auto; min-height:420px; max-height:none; display:flex; flex-direction:column;
    overflow:visible;
  }
  .col-right .card.pktview:not(.collapsed) {
    flex: 2 1 auto;
  }
  .col-right .card.pktview .card-body {
    flex:1; min-height:360px; overflow:auto; display:flex; flex-direction:column; gap:8px;
  }
  .col-right .card.pktview.collapsed {
    flex:0 0 auto; min-height:0;
  }
  /* live dropbox · large, buttons never clipped */
  .col-right .card.dropbox.drop-under {
    flex:0 0 auto; min-height:240px; height:auto; max-height:none; margin:0;
    display:flex; flex-direction:column; overflow:visible;
  }
  .col-right .card.dropbox.drop-under .card-body {
    overflow:visible; min-height:200px; padding-bottom:4px;
  }
  .col-right .card.dropbox.drop-under .drop-row {
    flex:0 0 auto; min-height:188px; height:auto;
    grid-template-columns:1fr 36px 1fr; gap:12px; align-items:stretch;
  }
  .col-right .card.dropbox.drop-under .drop-pad {
    min-height:176px; height:auto; padding:12px;
    grid-template-columns: 100px 1fr; gap:12px; align-items:start;
    overflow:visible;
  }
  .col-right .card.dropbox.drop-under .glyph-box { width:100px; height:100px; }
  /* live dropbox · glyph IN/OUT pads */
  .drop-row {
    display:grid; grid-template-columns:1fr 36px 1fr; gap:12px; align-items:stretch;
    min-height:188px; height:auto;
  }
  .drop-pad {
    border:1px dashed #3b455c; border-radius:10px; background:#0a0c12;
    min-height:176px; height:auto; padding:12px; min-width:0; overflow:visible;
    display:grid; grid-template-columns: 100px 1fr; gap:12px; align-items:start;
    transition: border-color .15s, background .15s;
  }
  .drop-pad.over { border-color:#34d399; background:#0c1814; }
  .drop-pad.in { border-color:#3b82f6; }
  .drop-pad.out { border-color:#a78bfa; }
  .glyph-box {
    width:96px; height:96px; border-radius:8px; background:#05070c;
    border:1px solid #1e293b; overflow:hidden; position:relative; flex:0 0 auto;
  }
  .glyph-box img {
    position:absolute; inset:0; width:100%; height:100%;
    image-rendering: pixelated; object-fit:contain; background:#05070c;
  }
  .glyph-box .empty {
    position:absolute; inset:0; display:grid; place-items:center;
    color:#475569; font-size:10px; text-align:center; padding:6px;
  }
  .drop-meta { min-width:0; overflow:hidden; }
  .drop-meta .lab {
    font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--mut);
  }
  .drop-meta .name {
    font-size:12px; font-weight:700; color:var(--ink); margin-top:4px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; height:1.2em;
  }
  .drop-meta .sub {
    font-size:10px; color:var(--mut); margin-top:4px; height:2.6em; overflow:hidden;
  }
  .drop-meta .acts {
    margin-top:10px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
    flex:0 0 auto; position:relative; z-index:3;
  }
  .drop-meta .pot {
    font-size:10px; color:#67e8f9; line-height:1.35; max-height:2.8em; overflow:hidden;
  }
  .drop-meta button, .drop-meta label.btn {
    appearance:none; cursor:pointer; font:inherit; font-size:12px; font-weight:700;
    color:#e2e8f0; background:#1e293b; border:1px solid #334155; border-radius:6px;
    padding:7px 14px; line-height:1.2; white-space:nowrap;
  }
  .drop-meta button.primary {
    color:#0b1220; background:linear-gradient(180deg,#86efac,#34d399); border-color:#166534;
  }
  .drop-meta button:hover, .drop-meta label.btn:hover { border-color:#64748b; }
  .drop-meta button.primary {
    color:#0b1220; background:linear-gradient(180deg,#86efac,#34d399); border-color:#166534;
  }

  .drop-meta input[type=file] { display:none; }
  .drop-arrow {
    text-align:center; color:#64748b; font-size:18px; font-weight:800; line-height:1.1;
  }
  .drop-arrow .sm { font-size:9px; color:var(--mut); letter-spacing:.06em; text-transform:uppercase; }

  /* packet viewer — full view, no squash */
  .pkt-hex {
    font-size:12px; letter-spacing:.03em; color:#a5b4fc;
    background:#0a0c12; border:1px solid #1e2230; border-radius:8px;
    padding:10px 12px; min-height:52px; max-height:120px; line-height:1.45;
    overflow:auto; white-space:pre-wrap; word-break:break-all;
    font-variant-numeric: tabular-nums; flex:0 0 auto;
  }
  .pkt-steno {
    display:grid; grid-template-columns: repeat(24, minmax(0,1fr)); gap:3px;
    min-height:36px; margin-top:4px; flex:0 0 auto;
  }
  .pkt-steno i {
    display:block; min-height:34px; border-radius:4px; background:#1a2030;
    border:1px solid #2a3348; font-style:normal; font-size:10px; color:#94a3b8;
    text-align:center; line-height:34px; overflow:hidden;
  }
  .pkt-row {
    display:grid; grid-template-columns: 96px 1fr; gap:10px; align-items:start;
    min-height:28px; margin-top:6px; min-width:0;
  }
  .pkt-row .k { color:var(--mut); font-size:11px; text-transform:uppercase; letter-spacing:.06em; padding-top:2px; }
  .pkt-row .v {
    color:var(--ink); font-size:12px; white-space:pre-wrap; word-break:break-word;
    overflow:visible; line-height:1.4; font-variant-numeric: tabular-nums;
  }
  .pkt-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; flex:0 0 auto; }
  .pkt-box {
    background:#0a0c12; border:1px solid #1e2230; border-radius:8px; padding:10px 12px;
    min-height:88px; overflow:visible;
  }
  .pkt-box .t { font-size:11px; color:var(--mut); text-transform:uppercase; letter-spacing:.08em; }
  .pkt-box .b {
    font-size:14px; color:var(--acc); margin-top:6px; min-height:1.3em;
    overflow:visible; white-space:pre-wrap; word-break:break-word; line-height:1.35;
  }
  .pkt-box .s {
    font-size:11px; color:var(--mut); margin-top:6px; min-height:2.4em;
    overflow:visible; white-space:pre-wrap; line-height:1.35;
  }
  /* ticket stub · full faces */
  .ticket {
    display:grid; grid-template-columns: 1fr 1.15fr; gap:12px; margin-top:8px;
    min-height:240px; flex:1 1 auto; overflow:visible;
  }
  .ticket .face {
    background:#0a0c12; border:1px dashed #334155; border-radius:10px; padding:12px 14px;
    min-width:0; overflow:auto; min-height:240px; max-height:none;
  }
  .ticket .face.left { border-color:#3b82f6; }
  .ticket .face.right { border-color:#34d399; }
  .ticket .face .t { font-size:11px; color:var(--mut); text-transform:uppercase; letter-spacing:.08em; }
  .ticket .face .id {
    font-size:15px; font-weight:800; color:#fde68a; margin-top:6px;
    white-space:pre-wrap; word-break:break-all; overflow:visible; line-height:1.3;
  }
  .ticket .face .qr {
    font-size:11px; color:#93c5fd; margin-top:8px; min-height:48px; max-height:none; overflow:visible;
    word-break:break-all; line-height:1.4;
  }
  .ticket .face .meta {
    font-size:12px; color:var(--ink); margin-top:8px; min-height:80px; overflow:visible;
    line-height:1.45; white-space:pre-wrap;
  }
  .sec-chips {
    display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:4px; margin-top:4px;
    min-height:28px; height:auto; flex:0 0 auto;
  }
  .sec-chips i {
    display:block; font-style:normal; font-size:10px; text-align:center; line-height:26px;
    min-height:26px; background:#12161f; border:1px solid #2a3344; border-radius:5px; color:#94a3b8;
    overflow:hidden; white-space:nowrap;
  }
  .card.qgview { flex:1 1 auto; min-height:320px; max-height:none; overflow:hidden; display:flex; flex-direction:column; }
  .card.qgview .card-body { flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
  .qg-head { display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; margin-bottom:6px; }
  .qg-head .t { font-size:12px; color:var(--cyan); font-weight:700; }
  .qg-head .o { font-size:11px; color:var(--mut); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:42%; }
  .qg-stream {
    font-size:11px; color:#a5b4fc; background:#0a0c12; border:1px solid #1e2230;
    border-radius:6px; padding:4px 8px; min-height:22px; max-height:36px; overflow:auto; white-space:normal;
    margin-bottom:6px; word-break:break-all;
  }
  .qg-secs {
    display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; max-height:44px; overflow:auto;
  }
  .qg-secs button {
    appearance:none; cursor:pointer; font:inherit; font-size:10px; font-weight:700;
    color:#e2e8f0; background:#1e293b; border:1px solid #334155; border-radius:5px;
    padding:3px 8px; white-space:nowrap;
  }
  .qg-secs button:hover { border-color:#67e8f9; color:#67e8f9; }
  .qg-secs button.kind-class { border-color:#a78bfa; color:#c4b5fd; }
  .qg-secs button.kind-function { border-color:#56d4dd; color:#67e8f9; }
  .qg-dual {
    display:grid; grid-template-columns:1.15fr 1fr; gap:8px; flex:1; min-height:240px; overflow:hidden;
  }
  .qg-face {
    background:#0a0c12; border:1px dashed #334155; border-radius:8px; padding:8px 10px;
    overflow:auto; min-height:240px; height:100%;
  }
  .qg-face.left { border-color:#3b82f6; }
  .qg-face.right { border-color:#34d399; }
  .qg-face .lab { font-size:10px; color:var(--mut); text-transform:uppercase; margin-bottom:4px; letter-spacing:.06em; }
  .qg-line {
    display:grid; grid-template-columns:48px 1fr; gap:8px; min-height:18px; margin:3px 0;
    font-size:12px; line-height:18px; overflow:hidden; white-space:nowrap;
  }
  .qg-line .sym { color:#fde68a; font-weight:700; overflow:hidden; font-variant-numeric:tabular-nums; }
  .qg-line .code, .qg-line .meta { color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; }
  .qg-foot { font-size:10px; color:var(--mut); margin-top:4px; min-height:14px; overflow:hidden; white-space:nowrap; }

  /* collapsible panels — less scroll by folding unused cards */
  .card.collapsible > .card-hd {
    margin:0 0 8px; font-size:11px; color:var(--mut); text-transform:uppercase;
    letter-spacing:.08em; cursor:pointer; user-select:none;
    display:flex; align-items:center; gap:8px; white-space:nowrap;
  }
  .card.collapsible > .card-hd .fold {
    appearance:none; cursor:pointer; font:inherit; font-size:10px; font-weight:800;
    color:#94a3b8; background:#1e293b; border:1px solid #334155; border-radius:4px;
    width:22px; height:20px; line-height:18px; padding:0; flex:0 0 auto;
  }
  .card.collapsible > .card-hd .fold:hover { color:#67e8f9; border-color:#67e8f9; }
  .card.collapsible.collapsed > .card-hd { margin-bottom:0; }
  .card.collapsible.collapsed > .card-body { display:none !important; }
  .card.collapsible.collapsed { padding-top:8px; padding-bottom:8px; min-height:0 !important; max-height:none !important; height:auto !important; flex:0 0 auto !important; }
  .card.collapsible > .card-hd .hint { margin-left:auto; font-size:9px; color:#475569; text-transform:none; letter-spacing:0; font-weight:600; }
  .card.collapsible > .card-hd a { color:#93c5fd; text-transform:none; letter-spacing:0; }
  /* timesync fold handle */
  .tsync .ts-fold {
    appearance:none; cursor:pointer; font:inherit; font-size:10px; font-weight:800;
    color:#94a3b8; background:#1e293b; border:1px solid #334155; border-radius:4px;
    width:22px; height:20px; line-height:18px; padding:0; margin-right:6px;
  }
  /* quantum gutter travel / hotpipe */
  .qg-travel {
    display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:8px;
  }
  .qg-travel input#qgFind {
    flex:1 1 140px; min-width:120px; max-width:220px;
    font:inherit; font-size:11px; color:var(--ink); background:#0a0c12;
    border:1px solid #334155; border-radius:6px; padding:5px 8px;
  }
  .qg-travel input#qgFind:focus { outline:none; border-color:#67e8f9; }
  .qg-cats {
    display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; max-height:none;
  }
  .qg-cats button {
    appearance:none; cursor:pointer; font:inherit; font-size:10px; font-weight:700;
    color:#cbd5e1; background:#12161f; border:1px solid #2a3344; border-radius:5px;
    padding:4px 8px; white-space:nowrap;
  }
  .qg-cats button .n { color:#64748b; font-weight:600; margin-left:4px; }
  .qg-cats button.on { border-color:#67e8f9; color:#67e8f9; background:#0c1a22; }
  .qg-cats button:hover { border-color:#475569; }
  .qg-secs { max-height:none; }
  .qg-secs button.on { border-color:#67e8f9; color:#67e8f9; }
  .qg-hotpipe {
    font-size:10px; color:#64748b; margin:0 0 6px;
  }
  .qg-hotpipe b { color:#a5b4fc; font-weight:600; }
  .card.collapsible > h2 { display:none; }
  .card-body > h2 { margin:0 0 6px; font-size:10px; color:var(--mut); text-transform:uppercase; letter-spacing:.06em; }

  /* Decimen-style fountain progress (after send/RX) */
  .fountain-panel {
    margin-top:10px; padding:10px 12px; border-radius:10px;
    background:#0e1016; border:1px solid #252830;
  }
  .ft-head { display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; margin-bottom:6px; }
  .ft-title { font-size:11px; color:var(--mut); text-transform:uppercase; letter-spacing:.07em; font-weight:700; }
  .ft-pct { font-size:18px; font-weight:800; color:var(--acc); min-width:3.5rem; }
  .ft-meta { font-size:10px; color:var(--cyan); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ft-bar { height:8px; background:#1a2030; border-radius:4px; overflow:hidden; margin-bottom:8px; }
  .ft-bar-fill { height:100%; width:0%; background:linear-gradient(90deg,#34d399,#67e8f9); transition:width .25s; }
  .ft-row { display:grid; grid-template-columns:1fr 140px; gap:8px; }
  .ft-row canvas {
    width:100%; height:140px; background:#05070c; border:1px solid #1e2230; border-radius:8px;
  }
  .ft-note { font-size:9px; color:#64748b; margin-top:6px; line-height:1.35; }
  .glyph-box.live { width:112px; height:112px; }
  .glyph-box .glyph-canvas {
    position:absolute; inset:0; width:100%; height:100%;
    image-rendering:pixelated; display:none;
  }
  .glyph-box.live img { opacity:1; }
</style></head>

<body>
<header>
  <div class="brand">
    <button type="button" class="btn-refresh" id="btnRefresh" title="Hard refresh dashboard">↻ Refresh</button>
    <span class="ver" id="appVer" title="layered_fuzz version">—</span>
    <h1>fc-layered · packets · stages · transfer</h1>
  </div>
  <span class="pill" id="mode">—</span>
  <span class="pill" id="fps">— fps</span>
  <span class="pill" id="uptime">up —</span>
  <span class="grow"></span>
  <a href="/preview.mjpg">preview.mjpg</a>
  <a href="/metrics.json">metrics.json</a>
  <a href="/packets.json">packets.json</a>
  <a href="/quantum-gutter.json">quantum-gutter.json</a>
  <a href="/timesync.json">timesync.json</a>
  <a href="https://mueee.qbitos.ai/quantum-gutter.html" target="_blank" rel="noopener">qg live</a>
</header>
<main class="shell">
  <div class="tsync" id="tsync">
    <div class="ts-top">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:8px">
          <button type="button" class="ts-fold" id="tsFold" title="Fold timesync">▾</button>
          <div class="zulu-big" id="zuluBig">00:00:00 Z</div>
        </div>
        <div class="zulu-sub" id="zuluSub">UTC · timesync…</div>
      </div>
      <div style="min-width:0">
        <div class="tier" id="tierPill">L1</div>
        <div class="ntp" id="ntpLine">ntp —</div>
      </div>
    </div>
    <div class="io-sync">
      <div class="io-box">
        <div class="lab">IN · packet</div>
        <div class="big" id="inTime">00:00:00 Z</div>
        <div class="sub" id="inTimeSub">age —</div>
      </div>
      <div class="io-box">
        <div class="lab">OUT · packet</div>
        <div class="big" id="outTime">00:00:00 Z</div>
        <div class="sub" id="outTimeSub">age —</div>
      </div>
      <div class="io-box delta">
        <div class="lab">IN→OUT Δ</div>
        <div class="big" id="ioDelta">0.0 ms</div>
        <div class="sub" id="ioDeltaSub">proc —</div>
      </div>
    </div>
    <div class="mkts" id="mkts"></div>
    <div class="foot" id="tsFoot">fc-timesync-v1 · /clock</div>
  </div>

  <div class="mid">
    <section class="col col-left">
      <div class="card preview-card collapsible" data-panel="preview">
        <div class="card-hd" role="button" tabindex="0">
          <button type="button" class="fold" aria-label="fold">▾</button>
          <span class="hd-label">Live preview (mix out)</span>
          <span class="hint">click to fold</span>
        </div>
        <div class="card-body">
          <div class="frame main"><img id="prev" src="/preview.mjpg" alt="preview"/></div>
          <div class="row mix-extra" style="margin-top:8px">
            <div class="thumb-block">
              <h2 id="mix2Title">Mix 2 · program (upstream)</h2>
              <div class="frame"><img id="mix2" src="/mix2.mjpg" alt="mix2"/></div>
              <p class="meta-line" id="mix2Meta">source —</p>
            </div>
            <div class="thumb-block">
              <h2 id="mix3Title">Mix 3 · alt live</h2>
              <div class="frame"><img id="mix3" src="/mix3.mjpg" alt="mix3"/></div>
              <p class="meta-line" id="mix3Meta">source —</p>
            </div>
          </div>
          <div class="row" style="margin-top:8px">
            <div class="thumb-block">
              <h2>Before (mix in · program)</h2>
              <div class="frame"><img id="before" src="/before.jpg" alt="before"/></div>
            </div>
            <div class="thumb-block">
              <h2>After · overlay rebroadcast (bloomberg compressed)</h2>
              <div class="frame"><img id="after" src="/preview.jpg" alt="after"/></div>
            </div>
          </div>
          <div class="row" style="margin-top:8px">
            <div class="thumb-block">
              <h2>Send · content we are transmitting</h2>
              <div class="frame"><img id="send" src="/send.jpg" alt="send plate"/></div>
              <p class="meta-line" id="sendMeta">payload —</p>
            </div>
            <div class="thumb-block">
              <h2>After transfer · RX result</h2>
              <div class="frame"><img id="rx" src="/rx.jpg" alt="rx decode"/></div>
              <p class="meta-line" id="rxMeta">BER —</p>
            </div>
          </div>
          <div class="fountain-panel" id="fountainPanel">
            <div class="ft-head">
              <span class="ft-title">Fountain · bytes built as portions</span>
              <span class="ft-pct" id="ftPct">0%</span>
              <span class="ft-meta" id="ftMeta">k— · frames— · solved—</span>
            </div>
            <div class="ft-bar"><div class="ft-bar-fill" id="ftBar"></div></div>
            <div class="ft-row">
              <canvas id="ftScatter" width="420" height="140" title="scatter · frame seq vs degree (dropped = below)"></canvas>
              <canvas id="ftBlocks" width="180" height="140" title="source blocks solved (portion map)"></canvas>
            </div>
            <div class="ft-note" id="ftNote">Decimen LT · each captured frame is a XOR portion — progress = frames collected, not peel cascade</div>
          </div>
        </div>
      </div>
    </section>

    <section class="col col-right">
      <div class="card packets collapsible" data-panel="packets">
        <div class="card-hd" role="button" tabindex="0">
          <button type="button" class="fold" aria-label="fold">▾</button>
          <span class="hd-label">Packets in / out</span>
          <span class="hint">click to fold</span>
        </div>
        <div class="card-body">
          <div class="grid3">
            <div class="metric"><div class="k">IN last packet</div><div class="v" id="inB">0 B</div><div class="s" id="inR">0.00 KBps · 0.00 fps</div></div>
            <div class="metric"><div class="k">OUT last packet</div><div class="v" id="outB">0 B</div><div class="s" id="outR">0.00 KBps</div></div>
            <div class="metric"><div class="k">Client serve</div><div class="v" id="cliB">0.00 KB/s</div><div class="s" id="cliR">viewers 0</div></div>
          </div>
          <div class="grid3" style="margin-top:8px">
            <div class="metric"><div class="k">Optical sidechannel</div><div class="v" id="optK">0.00</div><div class="s" id="optS">0 B/frame</div></div>
            <div class="metric"><div class="k">TX fraction</div><div class="v" id="txf">0.0%</div><div class="s">chrome/free mask</div></div>
            <div class="metric"><div class="k">Proc latency</div><div class="v" id="proc">0.00</div><div class="s">ms overlay EMA</div></div>
          </div>
        </div>
      </div>

      <div class="card stages collapsible collapsed" data-panel="stages">
        <div class="card-hd" role="button" tabindex="0">
          <button type="button" class="fold" aria-label="fold">▸</button>
          <span class="hd-label">Stages · before → overlay → mix</span>
          <span class="hint">collapsed</span>
        </div>
        <div class="card-body">
          <table>
            <thead><tr><th>Stage</th><th>Packet</th><th>Rate</th><th>Res</th><th>Notes</th></tr></thead>
            <tbody id="stages">
              <tr><td>before</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>overlay</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>mix</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card xfer collapsible collapsed" data-panel="xfer">
        <div class="card-hd" role="button" tabindex="0">
          <button type="button" class="fold" aria-label="fold">▸</button>
          <span class="hd-label">Potential transfer resolution</span>
          <span class="hint">collapsed</span>
        </div>
        <div class="card-body">
          <table>
            <thead><tr><th>Class</th><th>B/f</th><th>KB/s</th><th>Note</th></tr></thead>
            <tbody id="xfer">
              <tr><td>visible_module_grid</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>decimen_qr_v27</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>decimen_qr_v40</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>soft_watermark_meta_class</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>google_blur_synthid_class</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>pulse_ook_control</td><td>—</td><td>—</td><td>—</td></tr>
              <tr><td>anaglyph_chroma</td><td>—</td><td>—</td><td>—</td></tr>
            </tbody>
          </table>
          <p class="geo-line" id="geo">geometry —</p>
        </div>
      </div>

      <div class="card pktview collapsible" data-panel="pktview">
        <div class="card-hd" role="button" tabindex="0">
          <button type="button" class="fold" aria-label="fold">▾</button>
          <span class="hd-label">Packet viewer · ticket · gluelam §00–§0D</span>
          <span class="hint">click to fold</span>
        </div>
        <div class="card-body">
          <div class="sec-chips" id="secChips"></div>
          <div class="pkt-hex" id="pktHex">MINT —</div>
          <div class="pkt-steno" id="pktSteno"></div>
          <div class="ticket">
            <div class="face left">
              <div class="t">LEFT · QR / DAT / SCAN</div>
              <div class="id" id="tktId">FC-————</div>
              <div class="qr" id="tktQr">fc://ticket/…</div>
              <div class="meta" id="tktDat">DAT —</div>
            </div>
            <div class="face right">
              <div class="t">RIGHT · PREFIXES · DAC · GUTTER · IRON · CAPSULE</div>
              <div class="id" id="tktRightTitle">ops</div>
              <div class="meta" id="tktRight">—</div>
            </div>
          </div>
          <div class="pkt-grid2">
            <div class="pkt-box">
              <div class="t">mint PCP · steno</div>
              <div class="b" id="pktMint">fc-mint-pcp-v1</div>
              <div class="s" id="pktMintSub">seq —</div>
            </div>
            <div class="pkt-box">
              <div class="t">optical L3 · materials</div>
              <div class="b" id="pktOpt">0 B/f</div>
              <div class="s" id="pktOptSub">sliver·shim·blob</div>
            </div>
          </div>
          <div class="pkt-row"><div class="k">payload</div><div class="v" id="pktPay">—</div></div>
          <div class="pkt-row"><div class="k">steno labels</div><div class="v" id="pktLab">—</div></div>
          <div class="pkt-row"><div class="k">gluelam</div><div class="v" id="pktWire">prefixes → DAC → steno → qbit → preflight</div></div>
          <div class="pkt-row"><div class="k">refs</div><div class="v" id="pktRef">kbatch · gluelam · iron-line · qbit-codec · quantum-gutter</div></div>
        </div>
      </div>

      <div class="card dropbox drop-under collapsible" data-panel="dropbox" id="dropUnder">
        <div class="card-hd" role="button" tabindex="0">
          <button type="button" class="fold" aria-label="fold">▾</button>
          <span class="hd-label">Live dropbox · glyph IN / OUT</span>
          <span class="hint">click to fold</span>
        </div>
        <div class="card-body">
          <div class="drop-row">
            <div class="drop-pad in" id="padIn" data-side="in">
              <div class="glyph-box live">
                <img id="glyphIn" alt="IN glyph lattice" src="/drop/in/glyph.mjpg"/>
                <canvas id="glyphInLive" width="130" height="130" class="glyph-canvas"></canvas>
                <div class="empty" id="glyphInEmpty">drop IN<br/>live lattice</div>
              </div>
              <div class="drop-meta">
                <div class="lab">IN · receive</div>
                <div class="name" id="dropInName">empty · waiting</div>
                <div class="sub" id="dropInSub">video / file / stream → optical or steno</div>
                <div class="acts">
                  <label class="btn">Open<input type="file" id="fileIn" multiple/></label>
                  <button type="button" id="btnInClear">Clear</button>
                  <button type="button" class="primary" id="btnInToOut" title="promote IN → OUT">→ OUT</button>
                </div>
              </div>
            </div>
            <div class="drop-arrow">⇄<div class="sm">xfer</div></div>
            <div class="drop-pad out" id="padOut" data-side="out">
              <div class="glyph-box live">
                <img id="glyphOut" alt="OUT glyph lattice" src="/drop/out/glyph.mjpg"/>
                <canvas id="glyphOutLive" width="130" height="130" class="glyph-canvas"></canvas>
                <div class="empty" id="glyphOutEmpty">drop OUT<br/>live lattice</div>
              </div>
              <div class="drop-meta">
                <div class="lab">OUT · transmit</div>
                <div class="name" id="dropOutName">empty · idle</div>
                <div class="sub" id="dropOutSub">L3 / mint PCP / stenoSTRIP payload</div>
                <div class="acts">
                  <label class="btn">Open<input type="file" id="fileOut" multiple/></label>
                  <button type="button" id="btnOutClear">Clear</button>
                  <button type="button" class="primary" id="btnOutSend" title="bind OUT into packet payload">Bind</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card qgview collapsible" id="qgCard" data-panel="qgview">
        <div class="card-hd" role="button" tabindex="0">
          <button type="button" class="fold" aria-label="fold">▾</button>
          <span class="hd-label">Quantum Gutter · prefix stream · <a href="/quantum-gutter.json">json</a> · <a href="https://mueee.qbitos.ai/quantum-gutter.html" target="_blank" rel="noopener">live</a></span>
          <span class="hint">click to fold</span>
        </div>
        <div class="card-body">
          <div class="qg-head">
            <span class="t" id="qgTitle">— classified</span>
            <span class="o" id="qgOrigin">origin —</span>
            <span class="o" id="qgActive">active —</span>
          </div>
          <div class="qg-hotpipe">hotpipe · BroadcastChannel <b>quantum-prefixes</b> · travel by symbol · <b>window.__fcQgTravel</b>(cat|section)</div>
          <div class="qg-travel">
            <input id="qgFind" type="search" placeholder="find · class · measure · +n: · function…" autocomplete="off"/>
            <button type="button" class="fold" id="qgClear" title="clear filters" style="width:auto;padding:0 8px;height:26px">clear</button>
          </div>
          <div class="qg-cats" id="qgCats" title="Travel along classification metric"></div>
          <div class="qg-stream" id="qgStream">gutter —</div>
          <div class="qg-secs" id="qgSecs" title="Structural sections — click to navigate"></div>
          <div class="qg-dual">
            <div class="qg-face left">
              <div class="lab">LEFT · source code</div>
              <div id="qgLeft"></div>
            </div>
            <div class="qg-face right">
              <div class="lab">RIGHT · quantum gutter</div>
              <div id="qgRight"></div>
            </div>
          </div>
          <div class="qg-foot" id="qgRef">fc-quantum-gutter-v2 · /quantum-gutter.json</div>
        </div>
      </div>
    </section>
  </div>
</main>

<script>
function pad(n, w){ n=String(n); while(n.length<w) n=' '+n; return n; }
function fmtNum(n, d){ if(n==null||n!==n) return (0).toFixed(d); return Number(n).toFixed(d); }
function fmtZuluClock(iso){
  if(!iso) return '00:00:00 Z';
  const m = iso.match(/T(\d{2}):(\d{2}):(\d{2})/);
  if(!m) return '00:00:00 Z';
  return m[1]+':'+m[2]+':'+m[3]+' Z';
}
function fmtAge(ms){
  if(ms==null) return 'age —— ms';
  if(ms < 1000) return 'age '+fmtNum(ms,0)+' ms';
  return 'age '+fmtNum(ms/1000,2)+' s';
}
function setText(id, t){ const el=document.getElementById(id); if(el && el.textContent!==t) el.textContent=t; }
// top-left refresh (hard reload, bypass cache)
document.getElementById('btnRefresh')?.addEventListener('click', function(){
  const u = new URL(location.href);
  u.searchParams.set('_r', String(Date.now()));
  location.replace(u.toString());
});

function fillDropbox(db){
  if(!db) return;
  const inn = db.in || {}, out = db.out || {};
  const setSlot = (side, slot) => {
    const nameEl = document.getElementById(side==='in'?'dropInName':'dropOutName');
    const subEl = document.getElementById(side==='in'?'dropInSub':'dropOutSub');
    const img = document.getElementById(side==='in'?'glyphIn':'glyphOut');
    const empty = document.getElementById(side==='in'?'glyphInEmpty':'glyphOutEmpty');
    const ready = slot && slot.name;
    if(nameEl) nameEl.textContent = ready ? slot.name : (side==='in'?'empty · waiting':'empty · idle');
    if(subEl){
      if(ready){
        subEl.textContent = (slot.kind||'file')+' · '+(slot.bytes||0)+' B · '+(slot.sha256||'')+' · glyph '+ (db.glyph_n||13)+'×'+(db.glyph_n||13);
      } else {
        subEl.textContent = side==='in'
          ? 'drop image / video / file / stream → optical or steno'
          : 'image / video / file → L3 · mint PCP · stenoSTRIP';
      }
    }
    const potEl = document.getElementById(side==='in'?'dropInPot':'dropOutPot');
    if(potEl){
      const sum = (slot && (slot.potential_summary || (slot.payload_potential && slot.payload_potential.summary))) || '';
      potEl.textContent = ready
        ? (sum || 'payload potential — analyzing…')
        : 'payload potential — drop file/image/video';
    }
    if(img){
      img.style.opacity = ready ? '1' : '0';
      if(ready){
        // prefer live glyph stream (pixel lattice), fallback png
        const live = slot.glyph_mjpg || ('/drop/'+side+'/glyph.mjpg');
        if(img.dataset.mode !== 'mjpg'){
          img.dataset.mode = 'mjpg';
          img.src = live + '?_=' + Date.now();
          img.onerror = function(){
            img.dataset.mode = 'png';
            if(slot.glyph_url) img.src = slot.glyph_url + (slot.glyph_url.indexOf('?')>=0?'&':'?') + 't=' + Date.now();
          };
        }
      }
      if(ready && slot.glyph_bits) paintGlyphLattice(side==='in'?'glyphInLive':'glyphOutLive', slot.glyph_bits, db.glyph_n||13);
    }
    if(empty) empty.style.display = ready ? 'none' : 'grid';
  };
  setSlot('in', inn);
  setSlot('out', out);
}

async function uploadDrop(side, file){
  const fd = new FormData();
  fd.append('file', file, file.name);
  const r = await fetch('/drop/'+side, { method:'POST', body: fd });
  if(!r.ok) throw new Error('upload '+r.status);
  return r.json();
}
function wireDropPad(padId, side, fileInputId){
  const pad = document.getElementById(padId);
  const input = document.getElementById(fileInputId);
  if(!pad) return;
  ['dragenter','dragover'].forEach(ev => pad.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); pad.classList.add('over');
  }));
  ['dragleave','drop'].forEach(ev => pad.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); pad.classList.remove('over');
  }));
  pad.addEventListener('drop', async e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if(!files || !files.length) return;
    for(const f of files){ try { await uploadDrop(side, f); } catch(err){ console.warn(err); } }
    tick();
  });
  if(input){
    input.addEventListener('change', async () => {
      for(const f of input.files||[]){ try { await uploadDrop(side, f); } catch(err){ console.warn(err); } }
      input.value = '';
      tick();
    });
  }
}
wireDropPad('padIn','in','fileIn');
wireDropPad('padOut','out','fileOut');
document.getElementById('btnInClear')?.addEventListener('click', async () => {
  await fetch('/drop/in?clear=1', { method:'POST' }); tick();
});
document.getElementById('btnOutClear')?.addEventListener('click', async () => {
  await fetch('/drop/out?clear=1', { method:'POST' }); tick();
});
document.getElementById('btnInToOut')?.addEventListener('click', async () => {
  await fetch('/drop/promote', { method:'POST' }); tick();
});
document.getElementById('btnOutSend')?.addEventListener('click', async () => {
  await fetch('/drop/bind-out', { method:'POST' }); tick();
});


// ── Decimen fountain scatter / portion progress ──
function fillFountain(ft){
  if(!ft || !ft.ok){
    setText('ftPct', '—');
    setText('ftMeta', 'fountain warming…');
    return;
  }
  const pct = ft.progress_pct != null ? ft.progress_pct : 0;
  setText('ftPct', fmtNum(pct,1)+'%');
  setText('ftMeta',
    'k '+ft.k+' · frames '+ft.frames_new+' · solved '+ft.solved_count+'/'+ft.k+
    ' · cap '+(ft.bytes_captured||0)+'/'+(ft.total_len||0)+' B · seq '+(ft.seq||0)+
    (ft.complete?' · COMPLETE':'')
  );
  const bar = document.getElementById('ftBar');
  if(bar) bar.style.width = Math.min(100, pct)+'%';
  setText('ftNote',
    (ft.note||'portion capture')+' · ber '+(ft.ber_channel_pct!=null?fmtNum(ft.ber_channel_pct,2):'—')+'% · fnv '+(ft.payload_fnv||'')
  );
  // scatter: seq% vs degree
  const sc = document.getElementById('ftScatter');
  if(sc && sc.getContext){
    const ctx = sc.getContext('2d');
    const W = sc.width, H = sc.height;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0,0,W,H);
    // grid
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = 1;
    for(let i=0;i<6;i++){
      const y = 10 + i*((H-20)/5);
      ctx.beginPath(); ctx.moveTo(20,y); ctx.lineTo(W-8,y); ctx.stroke();
    }
    ctx.fillStyle = '#475569';
    ctx.font = '10px ui-monospace,monospace';
    ctx.fillText('degree ↑', 4, 12);
    ctx.fillText('frame →', W-48, H-4);
    const pts = ft.scatter || [];
    const maxD = Math.max(4, ...pts.map(p => p.degree||0), 1);
    pts.forEach((p,i) => {
      const x = 24 + ((p.x!=null?p.x:(i%48)) / 48) * (W-36);
      if(p.dropped){
        const y = H - 12;
        ctx.fillStyle = '#f87171';
        ctx.fillRect(x-1.5, y-1.5, 3, 3);
      } else {
        const y = H - 16 - ((p.degree||1)/maxD) * (H-28);
        ctx.fillStyle = p.degree<=1 ? '#34d399' : (p.degree<=3 ? '#67e8f9' : '#a78bfa');
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI*2);
        ctx.fill();
      }
    });
    // progress line
    ctx.strokeStyle = 'rgba(52,211,153,0.35)';
    ctx.beginPath();
    ctx.moveTo(24, H-16 - (pct/100)*(H-28));
    ctx.lineTo(W-8, H-16 - (pct/100)*(H-28));
    ctx.stroke();
  }
  // block portion map
  const bc = document.getElementById('ftBlocks');
  if(bc && bc.getContext){
    const ctx = bc.getContext('2d');
    const W = bc.width, H = bc.height;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0,0,W,H);
    const blocks = ft.blocks || [];
    const k = blocks.length || ft.k || 1;
    const cols = Math.ceil(Math.sqrt(k));
    const rows = Math.ceil(k / cols);
    const cell = Math.min(Math.floor((W-12)/cols), Math.floor((H-12)/rows));
    const ox = Math.floor((W - cols*cell)/2);
    const oy = Math.floor((H - rows*cell)/2);
    for(let i=0;i<k;i++){
      const r = Math.floor(i/cols), c = i%cols;
      ctx.fillStyle = blocks[i] ? '#34d399' : '#1e293b';
      ctx.fillRect(ox+c*cell+1, oy+r*cell+1, cell-2, cell-2);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '9px ui-monospace,monospace';
    ctx.fillText('blocks '+ (ft.solved_count||0)+'/'+k, 6, H-4);
  }
}

// paint kbatch lattice from glyph_bits onto canvas (fallback if mjpg soft)
function paintGlyphLattice(canvasId, bits, n){
  const cv = document.getElementById(canvasId);
  if(!cv || !cv.getContext || !bits || !bits.length) return;
  n = n || 13;
  const ctx = cv.getContext('2d');
  const s = Math.floor(Math.min(cv.width, cv.height) / n);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0,0,cv.width,cv.height);
  for(let y=0;y<n;y++){
    for(let x=0;x<n;x++){
      const on = bits[y*n+x];
      ctx.fillStyle = on ? '#e6edf3' : '#12161f';
      ctx.fillRect(x*s, y*s, s-1, s-1);
    }
  }
  cv.style.display = 'block';
}

function fillTimesync(ts){
  if(!ts) return;
  const pipe = ts.pipeline || {};
  setText('zuluBig', fmtZuluClock(ts.iso_utc) || (ts.zulu||'00:00:00 Z'));
  setText('zuluSub', (ts.iso_utc||'')+' · unix '+(ts.unix_frac||ts.unix||'—')+' · '+(ts.zulu_long||''));
  const tier = ts.tier || {};
  const el = document.getElementById('tierPill');
  const tierTxt = (tier.label||('L'+tier.level));
  if(el){
    el.textContent = tierTxt;
    el.className = 'tier' + ((tier.level||3) >= 3 ? ' bad' : (tier.level===2 ? ' warn' : ''));
    el.title = (tier.note||'');
  }
  const ntp = ts.ntp || {};
  setText('ntpLine', ntp.ok
    ? ('NTP s'+(ntp.stratum??'?')+' · '+(ntp.peer||'')+' · '+fmtNum(ntp.offset_ms,1)+' ms')
    : ('NTP '+(ntp.error||'unavailable')));
  const inIso = pipe.in_iso || '';
  const outIso = pipe.out_iso || '';
  setText('inTime', inIso ? fmtZuluClock(inIso) : '00:00:00 Z');
  setText('inTimeSub', fmtAge(pipe.in_age_ms)+' · mix pull');
  setText('outTime', outIso ? fmtZuluClock(outIso) : '00:00:00 Z');
  setText('outTimeSub', fmtAge(pipe.out_age_ms)+' · preview encode');
  const d = pipe.inout_delta_ms;
  setText('ioDelta', d!=null ? (fmtNum(d,1)+' ms') : '0.0 ms');
  setText('ioDeltaSub', 'proc '+fmtNum(pipe.proc_ms_ema,1)+' ms · drift '+fmtNum(ts.epoch_drift_ms,2)+' ms');
  // fixed 8 market slots — update text only, never rebuild DOM after first paint
  const mk = document.getElementById('mkts');
  if(mk && !mk.dataset.ready){
    mk.innerHTML = Array.from({length:8}, (_,i)=>'<span class="mkt" id="mkt'+i+'">—</span>').join('');
    mk.dataset.ready = '1';
  }
  const markets = (ts.markets||[]).slice(0, 8);
  for(let i=0;i<8;i++){
    const slot = document.getElementById('mkt'+i);
    if(!slot) continue;
    const m = markets[i];
    if(!m){ slot.textContent='—'; slot.className='mkt'; continue; }
    const st = (m.status||m.phase||'closed').toLowerCase();
    const cls = st.includes('open') ? 'open' : (st.includes('pre') ? 'pre' : (st.includes('ah')||st.includes('after') ? 'ah' : ''));
    slot.className = 'mkt '+cls;
    slot.textContent = (m.label||m.id)+' '+(m.local||'');
  }
  setText('tsFoot', 'fc-timesync-v1 · /clock · TAI−UTC +'+(ts.leap_tai_utc_s??37)+'s · GPS−UTC +'+(ts.gps_utc_offset_s??18)+'s · '+(tier.reference||'UTC(USNO)')+(ts.fallback ? ' · local fallback' : ''));
}
function fillStages(st){
  const order = ['before','overlay','mix'];
  const rows = document.querySelectorAll('#stages tr');
  order.forEach((k,i)=>{
    const s = st[k] || {};
    const rate = s.rate || s.rate_encode || {};
    const res = s.resolution ? (s.resolution.w+'×'+s.resolution.h) : '—';
    const pkt = s.last_packet_bytes!=null ? (s.last_packet_bytes+' B') :
      (s.packets_optical_B_frame ? (s.packets_optical_B_frame.sum_data_B_frame+' B opt') : '—');
    const rtxt = rate.KBps!=null ? (fmtNum(rate.KBps,2)+' KB/s @ '+fmtNum(rate.fps,1)+' fps') :
      (s.packets_optical_out_Bps ? (fmtNum(s.packets_optical_out_Bps.modules_stacked_KBps,2)+' KB/s opt') : '—');
    const note = (s.codec||s.mode||s.source||'—');
    const cells = rows[i] && rows[i].children;
    if(!cells||cells.length<5) return;
    cells[0].textContent = k;
    cells[0].title = s.label||k;
    cells[1].textContent = pkt;
    cells[2].textContent = rtxt;
    cells[3].textContent = res;
    cells[4].textContent = note;
  });
}
function fillXfer(x){
  const keys = ['visible_module_grid','decimen_qr_v27','decimen_qr_v40','soft_watermark_meta_class','google_blur_synthid_class','pulse_ook_control','anaglyph_chroma'];
  const rows = document.querySelectorAll('#xfer tr');
  keys.forEach((k,i)=>{
    const v = x[k] || {};
    const cells = rows[i] && rows[i].children;
    if(!cells||cells.length<4) return;
    cells[0].textContent = k;
    cells[1].textContent = v.bytes_per_frame!=null ? fmtNum(v.bytes_per_frame,1) : '—';
    cells[2].textContent = v.kbps!=null ? fmtNum(v.kbps,2) : '—';
    cells[3].textContent = v.note || '—';
    cells[3].title = v.note || '';
  });
}

// ── collapsible panels (persist) ──
function loadFoldState(){
  try { return JSON.parse(localStorage.getItem('fc-metrics-folds')||'{}'); } catch(e){ return {}; }
}
function saveFoldState(st){
  try { localStorage.setItem('fc-metrics-folds', JSON.stringify(st)); } catch(e){}
}
function setCardFold(card, collapsed){
  if(!card) return;
  card.classList.toggle('collapsed', !!collapsed);
  const btn = card.querySelector('.fold');
  const hint = card.querySelector('.card-hd .hint');
  if(btn) btn.textContent = collapsed ? '▸' : '▾';
  if(hint) hint.textContent = collapsed ? 'collapsed' : 'click to fold';
  const panel = card.getAttribute('data-panel');
  if(panel){
    const st = loadFoldState();
    st[panel] = !!collapsed;
    saveFoldState(st);
  }
}
function wireCollapsibles(){
  const saved = loadFoldState();
  document.querySelectorAll('.card.collapsible').forEach(card => {
    const panel = card.getAttribute('data-panel');
    if(panel && panel in saved) setCardFold(card, saved[panel]);
    const hd = card.querySelector('.card-hd');
    if(!hd || hd.dataset.wired) return;
    hd.dataset.wired = '1';
    const toggle = (e) => {
      if(e.target.closest('a')) return;
      e.preventDefault();
      setCardFold(card, !card.classList.contains('collapsed'));
    };
    hd.addEventListener('click', toggle);
    hd.addEventListener('keydown', (e) => { if(e.key==='Enter'||e.key===' ') toggle(e); });
  });
  const ts = document.getElementById('tsync');
  const tsFold = document.getElementById('tsFold');
  if(ts && tsFold && !tsFold.dataset.wired){
    tsFold.dataset.wired = '1';
    if(saved.tsync){ ts.classList.add('collapsed'); tsFold.textContent='▸'; }
    tsFold.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = !ts.classList.contains('collapsed');
      ts.classList.toggle('collapsed', c);
      tsFold.textContent = c ? '▸' : '▾';
      const st = loadFoldState(); st.tsync = c; saveFoldState(st);
    });
  }
}
wireCollapsibles();

// ── Quantum Gutter hotpipe travel ──
let __qgCache = null;   // last full qg payload
let __qgFilter = { category:null, query:'', section:null };

const QG_CAT_ORDER = [
  ['shebang','n:'],['comment','+1:'],['import','-n:'],['class','+0:'],
  ['function','0:'],['error','-1:'],['condition','+n:'],['loop','+2:'],
  ['return','-0:'],['output','+3:'],['variable','1:'],['default','·']
];

function qgBroadcast(msg){
  try {
    const bc = window.__fcQgBc || (window.__fcQgBc = new BroadcastChannel('quantum-prefixes'));
    bc.postMessage(Object.assign({ type:'fc-qg', ts:Date.now(), source:'fc-layered-metrics' }, msg));
  } catch(e){}
  try {
    const bc2 = window.__fcIronBc || (window.__fcIronBc = new BroadcastChannel('iron-line'));
    bc2.postMessage(Object.assign({ type:'fc-qg', layer:'L3', ts:Date.now() }, msg));
  } catch(e){}
  try {
    window.dispatchEvent(new CustomEvent('fc-qg-travel', { detail: msg }));
  } catch(e){}
}

function qgApplyFilter(qg){
  if(!qg) return qg;
  const cat = __qgFilter.category;
  const q = (__qgFilter.query||'').trim().toLowerCase();
  let rows = qg.rows || (qg.right && qg.right.symbols) || [];
  // prefer full unfiltered if we cached
  if(__qgCache && __qgCache._allRows) rows = __qgCache._allRows;
  let filtered = rows;
  if(cat){
    filtered = filtered.filter(r => (r.category||'') === cat || (r.sym||'').replace(/\s+/g,'') === cat);
  }
  if(q){
    filtered = filtered.filter(r => {
      const blob = ((r.sym||'')+' '+(r.category||'')+' '+(r.gate||'')+' '+(r.code||'')+' '+(r.name||'')).toLowerCase();
      return blob.indexOf(q) >= 0;
    });
  }
  const view = Object.assign({}, qg, {
    rows: filtered,
    right: Object.assign({}, qg.right||{}, {
      symbols: filtered,
      title: (cat||q)
        ? ((filtered.length)+' hit · '+(cat||'find:'+q)+' · of '+(rows.length))
        : ((qg.right&&qg.right.title)||'')
    }),
    _filtered: !!(cat||q),
  });
  return view;
}

async function qgTravel(spec){
  // spec: string category|symbol|section name, or {category,section,query}
  let category=null, section=null, query=null;
  if(typeof spec === 'string'){
    const s = spec.trim();
    const known = QG_CAT_ORDER.map(x=>x[0]);
    const syms = QG_CAT_ORDER.map(x=>x[1]);
    if(known.indexOf(s)>=0) category = s;
    else if(syms.indexOf(s)>=0){
      category = QG_CAT_ORDER.find(x=>x[1]===s)[0];
    } else if(s.indexOf(':')>=0){
      const hit = QG_CAT_ORDER.find(x=>x[1]===s || x[1].replace(':','')===s.replace(':',''));
      if(hit) category = hit[0];
      else query = s;
    } else {
      // try section first via API
      section = s;
      query = s;
    }
  } else if(spec && typeof spec === 'object'){
    category = spec.category || null;
    section = spec.section || null;
    query = spec.query || null;
  }
  __qgFilter = { category, query: query||'', section };
  qgBroadcast({ action:'travel', category, section, query });

  if(section && !category){
    try {
      const r = await fetch('/quantum-gutter.json?source=auto&section='+encodeURIComponent(section)+'&_='+Date.now(), {cache:'no-store'});
      const data = await r.json();
      if(data && data.ok !== false){
        // keep full rows cache from previous if any
        if(__qgCache && __qgCache._allRows) data._allRows = __qgCache._allRows;
        __qgCache = data;
        if(!data._allRows && data.rows) data._allRows = data.rows.slice();
        renderQuantumGutter(qgApplyFilter(data));
        return data;
      }
    } catch(e){}
  }
  if(category && !(__qgCache && __qgCache._allRows)){
    try {
      const r = await fetch('/quantum-gutter.json?source=auto&category='+encodeURIComponent(category)+'&_='+Date.now(), {cache:'no-store'});
      const data = await r.json();
      if(data && data.rows){
        renderQuantumGutter(Object.assign({}, data, {
          right: Object.assign({}, data.right||{}, { title: data.rows.length+' · '+category })
        }));
        return data;
      }
    } catch(e){}
  }
  if(__qgCache){
    renderQuantumGutter(qgApplyFilter(__qgCache));
    return __qgCache;
  }
  return null;
}

function qgFind(q){
  __qgFilter.query = (q||'').trim();
  qgBroadcast({ action:'find', query: __qgFilter.query });
  if(__qgCache) renderQuantumGutter(qgApplyFilter(__qgCache));
}

window.__fcQgTravel = qgTravel;
window.__fcQgFind = qgFind;
window.__fcQgClear = function(){
  __qgFilter = { category:null, query:'', section:null };
  const inp = document.getElementById('qgFind');
  if(inp) inp.value = '';
  document.querySelectorAll('#qgCats button').forEach(b=>b.classList.remove('on'));
  qgBroadcast({ action:'clear' });
  if(__qgCache) renderQuantumGutter(qgApplyFilter(__qgCache));
};

// listen hotpipe / other apps
try {
  const bc = window.__fcQgBc || (window.__fcQgBc = new BroadcastChannel('quantum-prefixes'));
  bc.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if(d.source === 'fc-layered-metrics') return;
    if(d.action === 'travel' || d.type === 'qg-travel' || d.category || d.section){
      qgTravel({ category:d.category, section:d.section, query:d.query });
    } else if(d.action === 'find' || d.query){
      const inp = document.getElementById('qgFind');
      if(inp && d.query!=null) inp.value = d.query;
      qgFind(d.query);
    } else if(d.action === 'clear'){
      window.__fcQgClear();
    }
  });
} catch(e){}

function renderQuantumGutter(qg){
  // core paint (shared by fill + travel)
  if(!qg) return;
  const cov = (qg.coverage_pct!=null ? qg.coverage_pct : '—');
  const title = (qg.right && qg.right.title) || ((qg.lines_classified||0)+'/'+(qg.lines_total||0)+' · '+cov+'%');
  setText('qgTitle', title);
  const eng = (qg.engine && (qg.engine.name||'')) || 'engine';
  const lang = qg.language || '';
  setText('qgOrigin', (qg.origin||'—')+' · '+(qg.name||'—')+' · '+lang+' · '+eng.replace(/^.*\//,''));
  setText('qgActive', ((qg.active&&qg.active.symbol)||'—')+' · '+((qg.active&&qg.active.gate)||'')+' · '+((qg.active&&qg.active.category)||''));
  setText('qgStream', qg.gutter_stream || '—');

  // category travel chips with counts
  const cats = document.getElementById('qgCats');
  if(cats){
    const counts = qg.prefix_counts || {};
    // also count from _allRows if present
    const all = (qg._allRows) || (__qgCache && __qgCache._allRows) || qg.rows || [];
    const live = {};
    all.forEach(r => { const c=r.category||'default'; live[c]=(live[c]||0)+1; });
    const use = Object.keys(counts).length ? counts : live;
    cats.innerHTML = QG_CAT_ORDER.map(([cat,sym]) => {
      const n = use[cat]||0;
      if(!n && cat==='default') return '';
      const on = __qgFilter.category === cat ? ' on' : '';
      return '<button type="button" class="'+on+'" data-cat="'+cat+'" title="travel · '+cat+' · '+sym+'"><span>'+sym+'</span><span class="n">'+n+'</span></button>';
    }).join('');
    if(!cats.dataset.wired){
      cats.dataset.wired = '1';
      cats.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-cat]');
        if(!btn) return;
        const cat = btn.getAttribute('data-cat');
        if(__qgFilter.category === cat){
          __qgFilter.category = null;
          cats.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
          qgBroadcast({ action:'clear', category:null });
          if(__qgCache) renderQuantumGutter(qgApplyFilter(__qgCache));
        } else {
          cats.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
          btn.classList.add('on');
          qgTravel({ category: cat });
        }
      });
    } else {
      cats.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', b.getAttribute('data-cat') === __qgFilter.category);
      });
    }
  }

  // structural section chips
  const secs = document.getElementById('qgSecs');
  if(secs){
    const list = (qg.navigate && qg.navigate.list_sections) || (qg.sections||[]).map(s=>({
      id:s.id, kind:s.kind, name:s.name, path:s.path, lines:[s.start_line,s.end_line]
    }));
    // if filtered cache has sections use full cache sections
    const fullList = (__qgCache && __qgCache.navigate && __qgCache.navigate.list_sections) || list;
    const top = fullList.slice(0, 16);
    secs.innerHTML = top.map(s => {
      const label = (s.kind==='class'?'⊕ ':'ƒ ')+(s.name||s.path||s.id);
      const span = (s.lines&&s.lines.length)?(' L'+s.lines[0]+'–'+s.lines[1]):'';
      const on = __qgFilter.section === (s.name||s.path) ? ' on' : '';
      return '<button type="button" class="kind-'+(s.kind||'')+on+'" data-section="'+(s.name||s.path||'')+'" title="'+(s.path||'')+span+'">'+label+'</button>';
    }).join('') || '<span style="color:#64748b;font-size:10px">no sections — multi-line source in drop OUT</span>';
    if(!secs.dataset.bound){
      secs.dataset.bound = '1';
      secs.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-section]');
        if(!btn) return;
        const name = btn.getAttribute('data-section');
        qgTravel({ section: name });
      });
    }
  }

  const N = 18;
  const left = document.getElementById('qgLeft');
  const right = document.getElementById('qgRight');
  if(left && left.dataset.ready !== String(N)){
    left.innerHTML = Array.from({length:N},(_,i)=>'<div class="qg-line" id="qgl'+i+'"><span class="sym" id="qgs'+i+'">·</span><span class="code" id="qgc'+i+'"></span></div>').join('');
    left.dataset.ready = String(N);
  }
  if(right && right.dataset.ready !== String(N)){
    right.innerHTML = Array.from({length:N},(_,i)=>'<div class="qg-line" id="qgr'+i+'"><span class="sym" id="qgrs'+i+'">·</span><span class="meta" id="qgrm'+i+'"></span></div>').join('');
    right.dataset.ready = String(N);
  }
  const rows = qg.rows || (qg.right && qg.right.symbols) || [];
  for(let i=0;i<N;i++){
    const r = rows[i];
    const codeEl = document.getElementById('qgc'+i);
    const symEl = document.getElementById('qgs'+i);
    const rsym = document.getElementById('qgrs'+i);
    const rmeta = document.getElementById('qgrm'+i);
    if(!r){
      if(codeEl) codeEl.textContent = '';
      if(symEl) symEl.textContent = '·';
      if(rsym) rsym.textContent = '·';
      if(rmeta) rmeta.textContent = '';
      continue;
    }
    const sym = (r.sym || r.symbol || '·').toString().trim() || '·';
    if(symEl) symEl.textContent = sym;
    if(codeEl) codeEl.textContent = (r.code||'').slice(0,96);
    if(rsym) rsym.textContent = sym;
    if(rmeta) rmeta.textContent = (r.gate||'')+' · '+(r.category||'')+' · d'+(r.depth??0)+' · L'+(r.line??'');
  }
  const nsec = ((__qgCache && __qgCache.sections) || qg.sections || []).length;
  const engine = (qg.engine && qg.engine.name) || 'fallback';
  const filt = __qgFilter.category || __qgFilter.query || __qgFilter.section || 'all';
  setText('qgRef', (qg.schema||'fc-quantum-gutter-v2')+' · '+nsec+' sections · travel:'+filt+' · '+engine);
}

// wire find box once
(function(){
  const inp = document.getElementById('qgFind');
  const clr = document.getElementById('qgClear');
  if(inp && !inp.dataset.wired){
    inp.dataset.wired = '1';
    let t=null;
    inp.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => qgFind(inp.value), 120);
    });
    inp.addEventListener('keydown', (e) => {
      if(e.key==='Enter'){
        e.preventDefault();
        // enter = travel as section or category
        qgTravel(inp.value);
      }
    });
  }
  if(clr && !clr.dataset.wired){
    clr.dataset.wired = '1';
    clr.addEventListener('click', () => window.__fcQgClear());
  }
})();


function fillQuantumGutter(qg){
  if(!qg) return;
  // stash full snapshot for client-side travel (avoid re-spool)
  if(!qg._filtered){
    const rows = qg.rows || (qg.right && qg.right.symbols) || [];
    qg._allRows = rows.slice();
    __qgCache = qg;
  }
  renderQuantumGutter(qgApplyFilter(qg));
}
function fillPacketView(pv){
  if(!pv) return;
  const paths = pv.paths || {};
  const mint = paths.mint_pcp || {};
  const steno = paths.steno_strip || {};
  const opt = paths.optical_l3 || {};
  const pref = (paths.prefixes && paths.prefixes.active) || {};
  const gut = paths.quantum_gutter || {};
  const tkt = pv.ticket || (pv.sections && pv.sections['§0C_ticket_stub']) || {};
  const left = tkt.left || {};
  const right = tkt.right || {};
  const mats = pv.materials || {};
  setText('pktHex', pv.hex_line || mint.frame_hex_64 || 'MINT —');
  // section chips §00–§0D fixed 14 slots
  const chips = document.getElementById('secChips');
  if(chips && !chips.dataset.ready){
    const ids = ['00','01','02','03','04','05','06','07','08','09','0A','0B','0C','0D'];
    chips.innerHTML = ids.map((id,i)=>'<i id="sc'+i+'">§'+id+'</i>').join('');
    chips.dataset.ready = '1';
  }
  const order = pv.section_order || [];
  for(let i=0;i<14;i++){
    const el = document.getElementById('sc'+i);
    if(!el) continue;
    const key = order[i] || '';
    el.textContent = key ? key.replace('§','').split('_')[0] : '·';
    el.title = key || '';
    el.style.color = key ? '#a5b4fc' : '#64748b';
  }
  // fixed 24 steno cells
  const strip = document.getElementById('pktSteno');
  if(strip && !strip.dataset.ready){
    strip.innerHTML = Array.from({length:24},(_,i)=>'<i id="ss'+i+'">·</i>').join('');
    strip.dataset.ready = '1';
  }
  const labs = steno.labels_line ? steno.labels_line.split(/\s+/) : (mint.steno_labels||[]);
  const dens = steno.density || [];
  for(let i=0;i<24;i++){
    const cell = document.getElementById('ss'+i);
    if(!cell) continue;
    const lab = labs[i] || '·';
    cell.textContent = lab;
    const d = dens[i]!=null ? dens[i] : 0;
    const g = 20 + d * 14;
    cell.style.background = 'rgb('+(18+d)+','+(22+d*2)+','+g+')';
    cell.title = lab;
  }
  // ticket faces
  setText('tktId', pv.ticket_id || right.ticket_id || 'FC-————');
  setText('tktQr', (left.qr && left.qr.payload) || 'fc://ticket/…');
  const dat = left.dat || {};
  setText('tktDat', 'DAT pfx='+(dat.pfx||pref.symbol||'—')+' gate='+(dat.gate||pref.gate||'—')+' fnv='+(dat.fnv||'—')+' opt='+(dat.opt_B??'—')+'B');
  setText('tktRightTitle', (pref.symbol||'—')+' · '+(pref.gate||'—')+' · '+(pref.category||'—'));
  setText('tktRight',
    'DAC '+(pref.category||'—')+' · iron L3 · gutter '+(gut.gutter_preview||'—').slice(0,40)+'\n'+
    'SO '+( (paths.capsule_language||paths.capsule||{}).so_sequence || right.so || '—')+'\n'+
    'opt '+(opt.B_frame??0)+'B/'+(opt.bits??0)+'b ber='+(opt.ber_pct!=null?fmtNum(opt.ber_pct,2):'—')+'%');
  // Quantum Gutter live face (mueee parity) — optional qg* nodes
  if(window.__qg){ /* filled by fillQuantumGutter */ }
  setText('pktMint', 'fc-mint-pcp-v1 · '+(mint.codec||'stenoSTRIP-13'));
  setText('pktMintSub', 'seq '+(mint.seq??'—')+' · fnv '+(mint.payload_fnv||'—')+' · frame '+(mint.frame_len??0)+' B · steno '+(mint.steno_len??0)+' sym · ~'+(mint.steno_bits_approx??0)+' bit');
  setText('pktOpt', (opt.B_frame??0)+' B/frame · '+(opt.bits??0)+' bits');
  setText('pktOptSub',
    'sliver '+(mats.sliver&&mats.sliver.bytes||16)+'B · shim '+(mats.shim&&mats.shim.symbol||'—')+
    ' · blob '+(mats.blob&&mats.blob.bytes||0)+'B · glob '+(mats.glob&&mats.glob.symbols||0)+' · lake jsonl');
  setText('pktPay', (pv.ascii_payload||mint.payload_utf8||'—')+' · '+(mint.payload_len??0)+' B');
  setText('pktLab', steno.labels_line || mint.steno_labels_line || '—');
  setText('pktWire', 'gluelam: prefixes → DAC → gutter → iron → steno → qbit → mint PCP → optical L3 → preflight');
  setText('pktRef', 'kbatch.ugrad.ai · qbitos-gluelam · iron-line · qbit-codec · quantum-gutter');
}
let stillTick = 0;
async function tick(){
  try {
    const r = await fetch('/metrics.json?_='+Date.now(), {cache:'no-store'});
    const m = await r.json();
    const p = m.packets||{}, st = m.stages||{}, x = m.transfer_resolution||{};
    fillTimesync(m.timesync);
    if(m.version) setText('appVer', m.version);
    setText('mode', m.mode||'—');
    setText('fps', fmtNum(m.measured_composite_fps,2)+' fps');
    setText('uptime', 'up '+fmtNum(m.uptime_s,1)+'s');
    setText('inB', (p.in?.last_B??0)+' B');
    setText('inR', fmtNum(p.in?.KBps,2)+' KBps · '+fmtNum(p.in?.fps,2)+' fps');
    setText('outB', (p.out?.last_B??0)+' B');
    setText('outR', fmtNum(p.out?.KBps,2)+' KBps · expand '+fmtNum(p.out?.jpeg_expand_ratio,3));
    setText('cliB', fmtNum(p.clients?.KBps,2)+' KB/s');
    setText('cliR', 'mjpg viewers '+(p.clients?.mjpg_viewers??0)+' · serves '+(p.clients?.http_serves??0));
    setText('optK', fmtNum(p.optical_sidechannel?.KBps,2));
    setText('optS', (p.optical_sidechannel?.B_frame??0)+' B/frame optical');
    setText('txf', fmtNum((st.overlay?.tx_frac??0)*100,1)+'%');
    setText('proc', fmtNum(st.overlay?.proc_ms_ema,2));
    fillStages(st);
    fillXfer(x);
    fillPacketView(m.packets_view || m.packet_view);
    fillQuantumGutter(m.quantum_gutter);
    // unsquish ticket RIGHT with real organization summary when packet payload is flat
    if(m.quantum_gutter && m.quantum_gutter.sections){
      const secs = m.quantum_gutter.sections || [];
      const paths = secs.slice(0,6).map(s => (s.kind||'')+':'+(s.name||'')).join(' · ');
      const act = m.quantum_gutter.active || {};
      const rightTitle = (act.symbol||'—')+' · '+(act.gate||'—')+' · '+(act.category||'—');
      setText('tktRightTitle', rightTitle);
      const cur = document.getElementById('tktRight');
      if(cur && (secs.length>0 || (cur.textContent||'').indexOf('neutral')>=0)){
        setText('tktRight',
          'org '+(m.quantum_gutter.language||'')+' · '+(m.quantum_gutter.coverage_pct??'—')+'%\n'+
          'sections '+secs.length+(paths?(' · '+paths):'')+'\n'+
          'engine '+((m.quantum_gutter.engine&&m.quantum_gutter.engine.name)||'—').replace(/^.*\//,'')
        );
      }
    }
    fillFountain(m.fountain);
    fillDropbox(m.dropbox);
    // live glyph lattice bits from dropbox status
    if(m.dropbox){
      if(m.dropbox.in && m.dropbox.in.glyph_bits) paintGlyphLattice("glyphInLive", m.dropbox.in.glyph_bits, m.dropbox.glyph_n||13);
      if(m.dropbox.out && m.dropbox.out.glyph_bits) paintGlyphLattice("glyphOutLive", m.dropbox.out.glyph_bits, m.dropbox.glyph_n||13);
    }

    const g = x._geometry||{};
    const c = x._ceilings||{};
    setText('geo', 'geometry '+(g.width||'—')+'×'+(g.height||'—')+' @ '+fmtNum(g.fps,2)+'fps · tx_px='+(g.tx_pixels??'—')+' · Decimen ceiling '+(c.decimen_handheld_KBps??128)+' / '+(c.decimen_propped_KBps??186)+' KB/s');
    // stills: refresh every 2s only (not every tick) to reduce paint churn
    stillTick++;
    if(stillTick % 2 === 0){
      const ts = Date.now();
      const b=document.getElementById('before'), a=document.getElementById('after');
      const s=document.getElementById('send'), rx=document.getElementById('rx');
      if(b) b.src = '/before.jpg?_='+ts;
      if(a) a.src = '/preview.jpg?_='+ts;
      if(s) s.src = '/send.jpg?_='+ts;
      if(rx) rx.src = '/rx.jpg?_='+ts;
      // mix2/3: if mjpg dead, fall back to polled jpg
      const m2=document.getElementById('mix2'), m3=document.getElementById('mix3');
      if(m2 && m2.dataset.fallback==='1') m2.src = '/mix2.jpg?_='+ts;
      if(m3 && m3.dataset.fallback==='1') m3.src = '/mix3.jpg?_='+ts;
    }
    const mixes = m.mixes || {};
    function mixSummary(mx){
      if(!mx) return '—';
      if(mx.summary) return (mx.ok?'live · ':'')+mx.summary;
      const pp = mx.payload_potential || {};
      const v = pp.visible_module_grid, d = pp.decimen_qr_v27;
      const bits = [];
      if(mx.w && mx.h) bits.push(mx.w+'×'+mx.h);
      if(mx.kind) bits.push(mx.kind);
      if(v) bits.push('L3 '+v.kbps+' KB/s');
      if(d) bits.push('QR27 '+d.kbps+' KB/s');
      if(mx.bytes) bits.push(mx.bytes+' B');
      return (mx.ok?'live · ':'')+(bits.join(' · ')|| (mx.url||'—'));
    }
    if(mixes.mix2){
      setText('mix2Title', mixes.mix2.label || 'Mix 2 · alt feed');
      setText('mix2Meta', mixSummary(mixes.mix2));
    }
    if(mixes.mix3){
      setText('mix3Title', mixes.mix3.label || 'Mix 3 · phone live');
      setText('mix3Meta', mixSummary(mixes.mix3));
    }
    if(mixes.main && document.getElementById('mixMainMeta')){
      setText('mixMainMeta', mixSummary(mixes.main));
    }
    const tr = m.transfer || {};
    const sm = tr.send || {}, rm = tr.rx || {};
    setText('sendMeta', 'payload: '+(tr.payload||sm.payload_utf8||'—')+' · L3 '+(sm.l3_modules_drawn??'—')+'/'+(sm.l3_bits??'—'));
    setText('rxMeta', 'BER '+fmtNum(rm.ber_pct,2)+'% · '+(rm.status||'—')+' · '+(rm.bits_correct??'?')+'/'+(rm.bits_total??'?'));
  } catch(e) {}
}
tick(); setInterval(tick, 1000);
</script>
</body></html>
"""

def compositor_loop(payload: bytes, show_boxes: bool, seconds: float) -> None:
    import numpy as np  # type: ignore

    regions = None
    t_end = time.time() + seconds if seconds > 0 else None
    fps_n = 0
    fps_t = time.time()
    meas_fps = 0.0
    last_mix_poll = 0.0
    while not ST.stop.is_set():
        if t_end and time.time() > t_end:
            ST.stop.set()
            break
        t_loop = time.time()
        raw = fetch(MIX_URL)
        if not raw:
            ST.drop_no_input += 1
            time.sleep(0.05)
            continue
        in_bytes = len(raw)
        ST.in_win.add(in_bytes, 1)
        ST.last_in_bytes = in_bytes
        ST.last_in_ts = time.time()
        try:
            img = load_jpeg(raw)
        except Exception:
            time.sleep(0.05)
            continue
        if img is None:
            time.sleep(0.05)
            continue
        h, w = img.shape[:2]
        ST.last_wh = (w, h)
        # keep pre-overlay snapshot (program path)
        before_jpg = raw

        # extra live mixes — throttle on low-RAM / lite mode
        heavy_tick = (ST.frames % max(1, LAYERED_HEAVY_EVERY) == 0)
        if heavy_tick:
            try:
                m2 = load_mix_source(MIX2_URL)
                if m2:
                    ST.mix2_jpeg = m2
                    fps_m = max(
                        (ST.out_win.rates().get("fps") if getattr(ST, "out_win", None) else 0) or 8.0,
                        1.0,
                    )
                    if LAYERED_LITE:
                        ST.mix2_meta = {
                            "label": MIX2_LABEL,
                            "url": MIX2_URL,
                            "ok": True,
                            "bytes": len(m2),
                            "summary": f"live · {len(m2)} B",
                            "ts": time.time(),
                        }
                    else:
                        ST.mix2_meta = analyze_feed_payload_potential(
                            m2,
                            label=MIX2_LABEL,
                            url=MIX2_URL,
                            kind="image",
                            fps=fps_m,
                            tx_frac=0.35,
                            name=Path(str(MIX2_URL)).name
                            if not str(MIX2_URL).startswith("http")
                            else "mix2",
                        )
                        ST.mix2_meta["ts"] = time.time()
                else:
                    ST.mix2_meta = {
                        **(getattr(ST, "mix2_meta", None) or {}),
                        "ok": False,
                        "summary": "no signal",
                    }
            except Exception:
                pass
            try:
                m3_src = (MIX3_URL or "").strip() or ALT_STILL
                m3 = load_mix_source(m3_src)
                if m3:
                    ST.mix3_jpeg = m3
                    fps_m = max(
                        (ST.out_win.rates().get("fps") if getattr(ST, "out_win", None) else 0) or 8.0,
                        1.0,
                    )
                    if LAYERED_LITE:
                        ST.mix3_meta = {
                            "label": MIX3_LABEL,
                            "url": m3_src,
                            "ok": True,
                            "bytes": len(m3),
                            "summary": f"live · {len(m3)} B",
                            "ts": time.time(),
                        }
                    else:
                        ST.mix3_meta = analyze_feed_payload_potential(
                            m3,
                            label=MIX3_LABEL,
                            url=m3_src,
                            kind="image",
                            fps=fps_m,
                            tx_frac=0.30,
                            name=Path(str(m3_src)).name
                            if not str(m3_src).startswith("http")
                            else "mix3",
                        )
                        ST.mix3_meta["ts"] = time.time()
                else:
                    ST.mix3_meta = {
                        **(getattr(ST, "mix3_meta", None) or {}),
                        "ok": False,
                        "url": m3_src,
                        "summary": "no signal",
                    }
            except Exception:
                pass

        mraw = fetch(MASK_URL)
        if mraw:
            free_raw = load_mask_png(mraw, w, h)
        else:
            free_raw = np.full((h, w), 255, np.uint8)
            free_raw[int(0.1 * h) : int(0.7 * h), int(0.2 * w) : int(0.75 * w)] = 0
        mode = _CFG.get("mode") or "broadcast"
        free = restrict_tx_mask(free_raw, mode)
        rraw = fetch(REGIONS_URL)
        if rraw:
            try:
                regions = json.loads(rraw.decode())
            except Exception:
                pass

        # occasional upstream mix status
        if time.time() - last_mix_poll > 2.0:
            ST.mix_upstream = fetch_json(MIX_STATUS_URL)
            last_mix_poll = time.time()

        t = time.time() - ST.t0
        # OUT dropbox bind overrides session payload for steno/optical modules
        if ST.bound_payload:
            payload = ST.bound_payload[:4096]
        # broadcast: soft wm in chrome only; full: stronger free-zone snow
        wm_str = 0.018 if mode in ("broadcast", "chrome", "news") else 0.035
        ana_on = mode not in ("broadcast", "chrome", "news")
        b_l3 = draw_lower_third_plate(img, free, payload, t)
        b_side = draw_sidebar_code(img, free, payload, t) if not LAYERED_LITE else 0
        b_ana = draw_anaglyph_ghost(img, free, payload, t) if (ana_on and not LAYERED_LITE) else 0
        b_pulse = draw_pulse(img, free, payload, t)
        b_wm = draw_watermark_noise(img, free, payload, strength=wm_str) if heavy_tick else 0
        b_alt = blend_alt_still(img, free, ALT_STILL, alpha=0.22) if (not LAYERED_LITE and heavy_tick) else 0
        if show_boxes and heavy_tick:
            draw_region_outlines(img, regions)

        # HUD (single encode pass)
        import cv2  # type: ignore

        opt_B = b_l3 + b_side + b_wm + b_ana
        # provisional out size from prior frame for HUD (avoids double encode)
        prev_out = ST.last_out_bytes or in_bytes
        cv2.putText(
            img,
            f"fc-layered · {mode} · {meas_fps:.1f}fps · tx={(free > 128).mean():.0%}",
            (12, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (240, 240, 40),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            img,
            f"in {in_bytes}B · out~{prev_out}B · opt {opt_B}B/f · {w}x{h}",
            (12, 44),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (160, 200, 255),
            1,
            cv2.LINE_AA,
        )

        jpg = encode_jpeg(img, 78)
        out_bytes = len(jpg)
        ST.out_win.add(out_bytes, 1)
        ST.last_out_bytes = out_bytes
        ST.last_out_ts = time.time()

        # SEND plate (content we transmit) + RX decode (after transfer)
        if heavy_tick or not LAYERED_LITE:
            send_jpg, send_meta = render_send_plate(w, h, payload, t, free)
            cam_n = float(os.environ.get("LAYERED_RX_CAM_NOISE", "0.05" if LAYERED_LITE else "0.12"))
            rx_jpg, rx_meta = simulate_rx_from_frame(img, payload, t, free, cam_noise=cam_n)
        else:
            send_jpg, send_meta = ST.send_jpeg or jpg, ST.send_meta or {}
            rx_jpg, rx_meta = ST.rx_jpeg or jpg, ST.rx_meta or {}
        try:
            ST.payload_text = payload.decode("utf-8", errors="replace")
        except Exception:
            ST.payload_text = payload.hex()
        # available to build_metrics immediately
        ST.send_meta = send_meta
        ST.rx_meta = rx_meta
        ST.send_jpeg = send_jpg
        ST.rx_jpeg = rx_jpg
        # Decimen fountain: build payload as portions (scatter / % transfer)
        try:
            if heavy_tick:
                ber_p = rx_meta.get("ber_pct") if isinstance(rx_meta, dict) else None
                tick_fountain(payload, ber_p, t)
            ST.glyph_frame_i = (ST.glyph_frame_i + 1) & 0xFFFF
        except Exception:
            pass
        ST.packet_seq = (ST.packet_seq + 1) & 0xFFFFFFFF
        if heavy_tick or not LAYERED_LITE:
            ST.packet_view = build_packet_view(
                payload=payload,
                seq=ST.packet_seq,
                optical_B_frame=opt_B,
                l3_bits=int(send_meta.get("l3_bits") or 0),
                ber_pct=rx_meta.get("ber_pct") if isinstance(rx_meta, dict) else None,
                mode=mode,
                w=w,
                h=h,
            )
        # append-only ticket lake (stub records) — off in lite by default
        try:
            if not LAYERED_WRITE_LAKE:
                raise OSError("lake disabled")
            lake = DIR / "layered-ticket-lake.jsonl"
            stub = {
                "ts": time.time(),
                "ticket_id": ST.packet_view.get("ticket_id"),
                "seq": ST.packet_seq,
                "fnv": (ST.packet_view.get("paths") or {})
                .get("mint_pcp", {})
                .get("payload_fnv"),
                "opt_B": opt_B,
                "ber_pct": rx_meta.get("ber_pct"),
                "prefix": (ST.packet_view.get("paths") or {})
                .get("prefixes", {})
                .get("active", {})
                .get("symbol"),
            }
            with lake.open("a", encoding="utf-8") as f:
                f.write(json.dumps(stub, separators=(",", ":")) + "\n")
        except OSError:
            pass

        proc_ms = (time.time() - t_loop) * 1000.0
        ST.proc_ms_ema = (
            proc_ms if ST.proc_ms_ema <= 0 else (0.85 * ST.proc_ms_ema + 0.15 * proc_ms)
        )

        fps_n += 1
        if time.time() - fps_t >= 1.0:
            meas_fps = fps_n / (time.time() - fps_t)
            fps_n = 0
            fps_t = time.time()

        free_raw_frac = float((free_raw > 128).mean())
        tx_frac = float((free > 128).mean())
        metrics = build_metrics(
            mode=mode,
            meas_fps=meas_fps,
            free_raw_frac=free_raw_frac,
            tx_frac=tx_frac,
            w=w,
            h=h,
            b_l3=b_l3,
            b_side=b_side,
            b_ana=b_ana,
            b_pulse=b_pulse,
            b_wm=b_wm,
            b_alt=b_alt,
            in_bytes=in_bytes,
            out_bytes=out_bytes,
            proc_ms=proc_ms,
        )
        # channel budget (compat)
        budget = {
            "schema": "fc-layered-budget-v1",
            "measured_composite_fps": round(meas_fps, 2),
            "frame": ST.frames,
            "mode": mode,
            "free_frac_raw": round(free_raw_frac, 4),
            "tx_frac": round(tx_frac, 4),
            "free_frac": round(tx_frac, 4),
            "packets": metrics["packets"],
            "stages": {
                "before_B": in_bytes,
                "overlay_optical_B_frame": opt_B,
                "mix_out_B": out_bytes,
            },
            "channels": {
                "lower_third_modules_B_frame": b_l3,
                "sidebar_modules_B_frame": b_side,
                "anaglyph_hint_B_frame": b_ana,
                "pulse_bits": b_pulse,
                "watermark_noise_B_frame": b_wm,
                "alt_still_free_px": b_alt,
            },
            "sustained_estimate_Bps": {
                "lower_third_at_fps": int(b_l3 * max(meas_fps, 1)),
                "sidebar_at_fps": int(b_side * max(meas_fps, 1)),
                "stacked_optical_Bps": int((b_l3 + b_side + b_wm) * max(meas_fps, 1)),
                "stacked_optical_KBps": round((b_l3 + b_side + b_wm) * max(meas_fps, 1) / 1024, 2),
            },
            "transfer_resolution": metrics["transfer_resolution"],
            "literature_decimen_ceiling_KBps": {"handheld": 128, "propped": 186},
            "mix_url": MIX_URL,
            "preview": f"http://127.0.0.1:{_CFG['port']}/preview.mjpg",
            "metrics": f"http://127.0.0.1:{_CFG['port']}/metrics.json",
            "ts": time.time(),
        }
        with ST.lock:
            ST.jpeg = jpg
            ST.before_jpeg = before_jpg
            ST.send_jpeg = send_jpg
            ST.rx_jpeg = rx_jpg
            ST.send_meta = send_meta
            ST.rx_meta = rx_meta
            ST.budget = budget
            ST.metrics = metrics
            ST.frames += 1
        try:
            if heavy_tick or not LAYERED_LITE:
                DIR.mkdir(parents=True, exist_ok=True)
                (DIR / "layered-preview.jpg").write_bytes(jpg)
                if heavy_tick:
                    (DIR / "layered-before.jpg").write_bytes(before_jpg)
                    if send_jpg:
                        (DIR / "layered-send.jpg").write_bytes(send_jpg)
                    if rx_jpg:
                        (DIR / "layered-rx.jpg").write_bytes(rx_jpg)
                    (DIR / "layered-budget.json").write_text(
                        json.dumps(budget, separators=(",", ":")) + "\n"
                    )
                    (DIR / "layered-metrics.json").write_text(
                        json.dumps(metrics, separators=(",", ":")) + "\n"
                    )
        except OSError:
            pass
        # FPS cap — main CPU guard on low-RAM hosts
        target = max(2.0, float(LAYERED_TARGET_FPS))
        elapsed = time.time() - t_loop
        slack = (1.0 / target) - elapsed
        if slack > 0:
            time.sleep(min(slack, 0.25))
        elif LAYERED_LITE:
            time.sleep(0.01)



class H(BaseHTTPRequestHandler):
    def log_message(self, *a):  # noqa: ARG002
        return

    def _json(self, obj: dict, code: int = 200) -> None:
        body = json.dumps(obj, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, data: bytes, ctype: str) -> None:
        ST.client_win.add(len(data), 0)
        ST.clients_total_served += 1
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/metrics", "/dashboard", "/stats"):
            # inject version into static shell so it shows before first metrics poll
            html = METRICS_HTML.replace(
                '<span class="ver" id="appVer" title="layered_fuzz version">—</span>',
                f'<span class="ver" id="appVer" title="layered_fuzz version">{LAYERED_VERSION}</span>',
            )
            body = html.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path in ("/version", "/version.json"):
            self._json(
                {
                    "version": LAYERED_VERSION,
                    "feature": "fc-layered-metrics",
                    "mint_pcp": "fc-mint-pcp-v1",
                    "steno": "stenoSTRIP-13",
                }
            )
            return
        if path in ("/metrics.json", "/stats.json"):
            with ST.lock:
                body = dict(ST.metrics or {"ok": False, "err": "warming up"})
            # always refresh timesync for live clock
            try:
                body["timesync"] = timesync_snapshot()
            except Exception as e:
                body["timesync"] = {"err": str(e)}
            self._json(body)
            return
        if path in ("/timesync.json", "/clock.json", "/zulu.json"):
            try:
                self._json(timesync_snapshot(force=True))
            except Exception as e:
                self._json({"ok": False, "err": str(e)}, 500)
            return
        if path in ("/packets.json", "/packet.json", "/steno.json", "/mint-pcp.json"):
            with ST.lock:
                body = ST.packet_view or {"ok": False, "err": "warming up"}
            self._json(body)
            return
        if path in (
            "/quantum-gutter.json",
            "/gutter.json",
            "/qg.json",
            "/quantum_gutter.json",
        ):
            # ?source=demo|in|out|payload|auto  &lang=python
            from urllib.parse import parse_qs, urlparse

            qs = parse_qs(urlparse(self.path).query)
            prefer = (qs.get("source") or qs.get("src") or ["auto"])[0]
            lang = (qs.get("lang") or [None])[0]
            section = (qs.get("section") or qs.get("sec") or [None])[0]
            category = (qs.get("category") or qs.get("cat") or [None])[0]
            try:
                ml = int((qs.get("max_lines") or ["512"])[0])
            except ValueError:
                ml = 512
            try:
                self._json(
                    build_quantum_gutter_json(
                        prefer=prefer,
                        max_lines=max(8, min(ml, 4000)),
                        lang=lang,
                        section=section,
                        category=category,
                    )
                )
            except Exception as e:
                self._json({"ok": False, "schema": "fc-quantum-gutter-v1", "err": str(e)}, 500)
            return
        if path in ("/dropbox.json", "/drop/status", "/dropbox"):
            self._json(dropbox_status())
            return
        if path in ("/drop/in/glyph.png", "/drop/out/glyph.png"):
            side = "in" if "/in/" in path else "out"
            folder = DROP_IN if side == "in" else DROP_OUT
            _scan_slot(side)  # refresh animated glyph
            gpath = folder / f".glyph-{side}.png"
            if gpath.is_file():
                self._bytes(gpath.read_bytes(), "image/png")
            else:
                empty = glyph_png_bytes([0] * (GLYPH_N * GLYPH_N), GLYPH_N, 14)
                self._bytes(empty, "image/png")
            return
        if path in ("/drop/in/glyph.mjpg", "/drop/out/glyph.mjpg"):
            side = "in" if "/in/" in path else "out"
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                fi = 0
                while not ST.stop.is_set():
                    slot = _scan_slot(side)
                    data = b""
                    if slot.get("path") and Path(slot["path"]).is_file():
                        try:
                            data = Path(slot["path"]).read_bytes()[:2_000_000]
                        except OSError:
                            data = b""
                    bits = glyph_bits_animated(
                        data, GLYPH_N, time.time(), fi + int(getattr(ST, "glyph_frame_i", 0))
                    )
                    png = glyph_png_multiscale(bits, GLYPH_N, 14)
                    # multipart as PNG parts (browsers accept image/png in mjpeg-style streams inconsistently)
                    # also emit JPEG for wider support
                    try:
                        import cv2  # type: ignore
                        import numpy as np  # type: ignore
                        arr = np.frombuffer(png, dtype=np.uint8)
                        im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                        if im is not None:
                            ok, buf = cv2.imencode(".jpg", im, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                            frame = buf.tobytes() if ok else png
                            ctype = b"image/jpeg"
                        else:
                            frame, ctype = png, b"image/png"
                    except Exception:
                        frame, ctype = png, b"image/png"
                    packet = (
                        b"--frame\r\nContent-Type: " + ctype + b"\r\n\r\n" + frame + b"\r\n"
                    )
                    self.wfile.write(packet)
                    fi += 1
                    time.sleep(0.12)
            except (BrokenPipeError, ConnectionResetError):
                return
            return
        if path in ("/fountain.json", "/lt.json", "/transfer-progress.json"):
            with ST.lock:
                body = dict(getattr(ST, "fountain_status", None) or {"ok": False, "err": "warming"})
            self._json(body)
            return
        if path in ("/drop/in/file", "/drop/out/file"):
            side = "in" if "/in/" in path else "out"
            slot = _scan_slot(side)
            if not slot.get("path") or not Path(slot["path"]).is_file():
                self.send_response(404)
                self.end_headers()
                return
            data = Path(slot["path"]).read_bytes()
            self._bytes(data, "application/octet-stream")
            return
        if path in ("/", "/budget", "/budget.json"):
            with ST.lock:
                body = ST.budget or {"ok": False}
            self._json(body)
            return
        if path in ("/before.jpg", "/before.jpeg", "/in.jpg"):
            with ST.lock:
                jpg = ST.before_jpeg
            if not jpg:
                self.send_response(503)
                self.end_headers()
                return
            self._bytes(jpg, "image/jpeg")
            return
        if path in ("/send.jpg", "/tx.jpg", "/payload.jpg", "/content.jpg"):
            with ST.lock:
                jpg = ST.send_jpeg
            if not jpg:
                self.send_response(503)
                self.end_headers()
                return
            self._bytes(jpg, "image/jpeg")
            return
        if path in ("/rx.jpg", "/after-transfer.jpg", "/result.jpg", "/decoded.jpg"):
            with ST.lock:
                jpg = ST.rx_jpeg
            if not jpg:
                self.send_response(503)
                self.end_headers()
                return
            self._bytes(jpg, "image/jpeg")
            return
        if path in ("/transfer.json", "/send-rx.json"):
            with ST.lock:
                body = {
                    "send": ST.send_meta,
                    "rx": ST.rx_meta,
                    "payload": ST.payload_text,
                }
            self._json(body)
            return
        if path in ("/preview.jpg", "/preview.jpeg", "/after.jpg", "/out.jpg"):
            with ST.lock:
                jpg = ST.jpeg
            if not jpg:
                self.send_response(503)
                self.end_headers()
                return
            self._bytes(jpg, "image/jpeg")
            return
        if path in ("/preview.mjpg", "/preview.mjpeg"):
            ST.clients_mjpg += 1
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while not ST.stop.is_set():
                    with ST.lock:
                        jpg = ST.jpeg
                    if jpg:
                        packet = (
                            b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
                        )
                        self.wfile.write(packet)
                        ST.client_win.add(len(packet), 1)
                        ST.clients_total_served += 1
                    time.sleep(0.06)
            except (BrokenPipeError, ConnectionResetError):
                return
            finally:
                ST.clients_mjpg = max(0, ST.clients_mjpg - 1)
            return
        # ── extra live mixes (other sources) ──
        if path in ("/mix2.jpg", "/mix2.jpeg", "/mix-b.jpg"):
            with ST.lock:
                jpg = ST.mix2_jpeg
            if not jpg:
                jpg = load_mix_source(MIX2_URL)
            if not jpg:
                self.send_response(503)
                self.end_headers()
                return
            self._bytes(jpg, "image/jpeg")
            return
        if path in ("/mix3.jpg", "/mix3.jpeg", "/mix-c.jpg"):
            with ST.lock:
                jpg = ST.mix3_jpeg
            if not jpg:
                jpg = load_mix_source(MIX3_URL.strip() if MIX3_URL else ALT_STILL)
            if not jpg:
                self.send_response(503)
                self.end_headers()
                return
            self._bytes(jpg, "image/jpeg")
            return
        if path in ("/mix2.mjpg", "/mix2.mjpeg", "/mix-b.mjpg"):
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while not ST.stop.is_set():
                    with ST.lock:
                        jpg = ST.mix2_jpeg
                    if not jpg:
                        jpg = load_mix_source(MIX2_URL)
                        if jpg:
                            ST.mix2_jpeg = jpg
                    if jpg:
                        packet = (
                            b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
                        )
                        self.wfile.write(packet)
                    time.sleep(0.08)
            except (BrokenPipeError, ConnectionResetError):
                return
            return
        if path in ("/mix3.mjpg", "/mix3.mjpeg", "/mix-c.mjpg"):
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while not ST.stop.is_set():
                    with ST.lock:
                        jpg = ST.mix3_jpeg
                    if not jpg:
                        jpg = load_mix_source(MIX3_URL.strip() if MIX3_URL else ALT_STILL)
                        if jpg:
                            ST.mix3_jpeg = jpg
                    if jpg:
                        packet = (
                            b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
                        )
                        self.wfile.write(packet)
                    time.sleep(0.08)
            except (BrokenPipeError, ConnectionResetError):
                return
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in (
            "/quantum-gutter.json",
            "/gutter.json",
            "/qg.json",
            "/quantum_gutter.json",
            "/quantum-gutter",
            "/gutter/classify",
        ):
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n > 0 else b""
            ctype = (self.headers.get("Content-Type") or "").lower()
            body_text = None
            prefer = "auto"
            lang = None
            if "application/json" in ctype:
                try:
                    obj = json.loads(raw.decode("utf-8", errors="replace") or "{}")
                except Exception:
                    obj = {}
                body_text = obj.get("source") or obj.get("code") or obj.get("text")
                prefer = obj.get("source_pref") or obj.get("prefer") or "auto"
                lang = obj.get("lang")
            else:
                body_text = raw.decode("utf-8", errors="replace")
            try:
                self._json(
                    build_quantum_gutter_json(
                        prefer=prefer, body_text=body_text, lang=lang
                    )
                )
            except Exception as e:
                self._json({"ok": False, "err": str(e)}, 500)
            return
        qs = self.path.split("?", 1)[1] if "?" in self.path else ""
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b""

        def parse_multipart(body: bytes, content_type: str) -> tuple[str, bytes]:
            """Minimal multipart/form-data extract (file field)."""
            if "multipart/form-data" not in (content_type or ""):
                return "upload.bin", body
            bound = b""
            for part in content_type.split(";"):
                part = part.strip()
                if part.startswith("boundary="):
                    bound = ("--" + part.split("=", 1)[1].strip().strip('"')).encode()
            if not bound:
                return "upload.bin", body
            chunks = body.split(bound)
            for ch in chunks:
                if b"Content-Disposition" not in ch:
                    continue
                head, _, data = ch.partition(b"\r\n\r\n")
                if not data:
                    continue
                if data.endswith(b"\r\n"):
                    data = data[:-2]
                if data.endswith(b"--"):
                    data = data[:-2]
                if data.endswith(b"\r\n"):
                    data = data[:-2]
                name = "upload.bin"
                for line in head.split(b"\r\n"):
                    if b"filename=" in line:
                        try:
                            name = (
                                line.split(b"filename=", 1)[1]
                                .strip()
                                .strip(b'"')
                                .decode("utf-8", "replace")
                            )
                        except Exception:
                            pass
                return name or "upload.bin", data
            return "upload.bin", body

        try:
            if path in ("/drop/in", "/drop/out"):
                side = "in" if path.endswith("/in") else "out"
                if "clear=1" in qs:
                    folder = DROP_IN if side == "in" else DROP_OUT
                    _ensure_drop_dirs()
                    for p in folder.iterdir():
                        if p.is_file() and not p.name.startswith("."):
                            try:
                                p.unlink()
                            except OSError:
                                pass
                    # keep empty glyph
                    _scan_slot(side)
                    if side == "out":
                        ST.bound_payload = None
                    self._json({"ok": True, "cleared": side, **dropbox_status()})
                    return
                ctype = self.headers.get("Content-Type") or ""
                fname, data = parse_multipart(raw, ctype)
                if not data:
                    self._json({"ok": False, "err": "empty body"}, 400)
                    return
                slot = save_drop(side, fname, data)
                self._json({"ok": True, "slot": slot, **dropbox_status()})
                return
            if path == "/drop/promote":
                # copy latest IN → OUT
                inn = _scan_slot("in")
                if not inn.get("path"):
                    self._json({"ok": False, "err": "no IN file"}, 400)
                    return
                data = Path(inn["path"]).read_bytes()
                slot = save_drop("out", inn["name"] or "promoted.bin", data)
                self._json({"ok": True, "promoted": True, "slot": slot, **dropbox_status()})
                return
            if path == "/drop/bind-out":
                out = _scan_slot("out")
                if not out.get("path"):
                    self._json({"ok": False, "err": "no OUT file"}, 400)
                    return
                data = Path(out["path"]).read_bytes()
                # prefer text payload; else use name+hash as seed
                try:
                    text = data.decode("utf-8")
                    ST.bound_payload = text.encode("utf-8")[:4096]
                except UnicodeDecodeError:
                    ST.bound_payload = (
                        f"drop:{out['name']}:{out.get('sha256','')}".encode() + data[:512]
                    )[:4096]
                self._json(
                    {
                        "ok": True,
                        "bound": True,
                        "payload_preview": ST.bound_payload[:80].decode(
                            "utf-8", "replace"
                        ),
                        "bytes": len(ST.bound_payload),
                        **dropbox_status(),
                    }
                )
                return
            self._json({"ok": False, "err": f"unknown POST {path}"}, 404)
        except Exception as e:
            self._json({"ok": False, "err": str(e)}, 500)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", default="fc-alt-media-v1-session")
    ap.add_argument("--port", type=int, default=_CFG["port"])
    ap.add_argument(
        "--mode",
        choices=["broadcast", "chrome", "news", "full"],
        default=_CFG.get("mode") or "broadcast",
        help="broadcast/chrome: TX only in L3+pillars+bug; full: free-mask snow",
    )
    ap.add_argument("--seconds", type=float, default=0, help="0 = run until killed")
    ap.add_argument("--boxes", action="store_true", default=True)
    ap.add_argument("--no-boxes", action="store_true")
    ap.add_argument("--no-http", action="store_true")
    args = ap.parse_args()
    _CFG["port"] = args.port
    _CFG["mode"] = args.mode
    show_boxes = not args.no_boxes
    payload = args.payload.encode("utf-8")

    th = threading.Thread(
        target=compositor_loop, args=(payload, show_boxes, args.seconds), daemon=True
    )
    th.start()

    if args.no_http:
        th.join()
        return 0

    httpd = ThreadingHTTPServer(("0.0.0.0", args.port), H)
    # short accept timeout so --seconds can exit
    httpd.timeout = 0.5
    print(f"layered_fuzz · preview http://127.0.0.1:{args.port}/preview.mjpg")
    print(f"              budget  http://127.0.0.1:{args.port}/budget.json")
    print(f"              mix     {MIX_URL}")
    try:
        if args.seconds > 0:
            while not ST.stop.is_set():
                httpd.handle_request()
            th.join(timeout=2)
        else:
            httpd.serve_forever()
    except KeyboardInterrupt:
        ST.stop.set()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
