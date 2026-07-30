#!/usr/bin/env python3
"""Interactive cast-align hub — HTML surface + shared selection state.

Serves:
  GET  /                 → align-chart.html
  GET  /align-chart.html
  GET  /parallax         → parallax-surface.html (infinite window)
  GET  /box              → box-surface.html (grid + depth cube + center loop + L3)
  GET  /news             → news-wall.html (mosaic + audio strip + L3)
  GET  /media/...        → LAN media (e.g. zane-center.mp4)
  GET  /api/state        → {selected, viewer, …}
  POST /api/state        → merge selection / viewer pose (phone → TV)
  GET  /api/clock        → fc-timesync-v1 (L3 lower-thirds stamp)
  GET  /api/transcript   → live caption bus (blank · train · overview scaffold)
  POST /api/transcript   → inject lines / action=demo|clear · JSONL pipe
  GET  /api/stream/plan  → scaled per-feed budget (fc-stream-plan-v1)
  POST /api/stream/cmd   → light TV tweaks (mode/pgm/quality/pause)
  GET  /tv               → TV-native PWA shell (panel-side decode)
  GET  /gpu              → WebGL GPU environment (TV stream test)
  GET  /crazy            → multi-device augmented perspective (phone/quest → TV)
  GET  /devices          → device lab (Chrome/Safari/Firefox DevTools presets)
  GET  /api/devices      → browser matrix + cast profiles + presets
  GET  /api/refs         → SuperMap · Parallel Stereo · SHELLS · BOX
  GET  /health

Usage:
  python3 align-hub.py --bind 0.0.0.0 --port 8765
  # then: catt -d 'Smart TV' cast_site 'http://LAN:8765/?tv=1'
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
HTML = HERE / "align-chart.html"
PARALLAX = HERE / "parallax-surface.html"
BOX = HERE / "box-surface.html"
NEWS = HERE / "news-wall.html"
NEWS_CATALOG = HERE / "news-catalog.json"
STREAM_POLICY = HERE / "stream-policy.json"
TV_SHELL = HERE / "tv-shell.html"
GPU_ENV = HERE / "gpu-env.html"
CRAZY = HERE / "crazy.html"
DEVICES_HTML = HERE / "devices.html"
DEVICE_KIT = HERE / "device-kit.js"
DEVICES_DIR = HERE.parent / "devices"
BROWSER_MATRIX = DEVICES_DIR / "browser-matrix.json"
DEVTOOLS_PRESETS = DEVICES_DIR / "devtools-presets.json"
QR_JS = HERE / "qrcode-generator.js"
_device_clients: list[dict] = []  # last-N hello beacons from surfaces
STATUS_PIPE = Path(
    os.environ.get("CAST_STATUS_PIPE", Path.home() / ".panda/packs/cast-status.jsonl")
)
MAPTRACE_HINT = Path(
    os.environ.get("MAPTRACE_PIPE", Path.home() / ".panda/packs/maptrace-cast.jsonl")
)
# Live transcript bus — blank captions · train themes · overview compare · L3 chrome
TRANSCRIPT_PIPE = Path(
    os.environ.get(
        "CAST_TRANSCRIPT_PIPE",
        Path.home() / ".panda/vision/cast/transcript.jsonl",
    )
)
TRANSCRIPT_MAX = int(os.environ.get("CAST_TRANSCRIPT_MAX", "200"))
MEDIA_ROOT = Path(
    os.environ.get("LIVE_DEMUX_CAST_DIR", Path.home() / ".panda/vision/cast")
)
STATE_PATH = Path(os.environ.get("LIVE_DEMUX_ALIGN_STATE", Path.home() / ".panda/vision/cast/align-state.json"))
# Optional public/dev front for control app (else LAN IP:port)
# LIVE_DEMUX_CAST_PUBLIC_CTRL=https://dev.example/box

DEFAULT_STATE = {
    "version": 1,
    "cols": 8,
    "rows": 4,
    "w": 1920,
    "h": 1080,
    "labels": "number",
    "safe": 5,
    "selected": [],
    "focus": 1,
    "title": "CAST ALIGN · interactive",
    "updated": 0.0,
    "pose_seq": 0,  # monotonic — TV applies only when this increases
    "controller": None,
    # phone-as-viewer for infinite-window / parallax surface
    "viewer": {
        "yaw": 0.0,
        "pitch": 0.0,
        "roll": 0.0,
        "x": 0.0,
        "y": 0.0,
        "z": 1.0,
        "source": None,
        "t": 0.0,
        "seq": 0,
        "lat": None,  # phone geo → living parallax / distance (no cam-relay)
        "lon": None,
    },
    "surface": "align",  # align | parallax | box
    "variation": "default",
    # cell number (str) → cam slug or url  e.g. {"1":"cam0","8":"cam1","25":"phone"}
    "cam_map": {},
    # House calibration (measured 2026-07-30):
    #   floor → seated horizon (eye line): 62" = 157.5 cm
    #   floor → TV center mark:            60.5" = 153.7 cm
    #   eye above center when seated:      +1.5" = +3.8 cm
    # Couch distance TBD (move around / multi-seat) — default ~9 ft
    "vantage": {
        "user": "you",
        "mode": "seat",  # floor | crouch | seat | chair | stand | play | pet
        "horizon_norm": 0.47,  # eye line on panel (0=top … 1=bottom)
        "tv_center_height_cm": 153.7,  # 60.5" measured center mark
        "tv_height_cm": 153.7,  # alias used by older clients
        "eye_height_cm": 157.5,  # 62" seated horizon
        "eye_above_center_cm": 3.8,
        "seat_distance_cm": 274,  # ~9 ft provisional — refine with Zero+walk
        "yaw0": 0.0,
        "pitch0": 0.0,
        "gain": 1.35,
        "smooth": 0.35,  # 0=raw 1=heavy (partner short sessions)
        "stability": "normal",  # normal | calm | play | pet
        "posture": "seat",
        "motion": "still",  # still | shift | roam | play
        "height_track_cm": 157.5,  # live estimate from phone
        "users": {
            "you": {
                "label": "You",
                "mode": "seat",
                "eye_height_cm": 157.5,
                "stand_eye_cm": 170,
                "crouch_eye_cm": 110,
                "floor_eye_cm": 30,
                "chair_eye_cm": 145,
                "seat_distance_cm": 274,
                "gain": 1.4,
                "smooth": 0.25,
                "stability": "normal",
            },
            "partner": {
                "label": "Partner",
                "mode": "seat",
                "eye_height_cm": 150,
                "stand_eye_cm": 165,
                "seat_distance_cm": 274,
                "gain": 1.05,
                "smooth": 0.55,
                "stability": "calm",
                "note": "Short valuable sessions — prefer calm gain, no glitch idle",
            },
            "kid": {
                "label": "Kid (10)",
                "mode": "play",
                "eye_height_cm": 115,
                "stand_eye_cm": 140,
                "floor_eye_cm": 25,
                "seat_distance_cm": 200,
                "gain": 1.65,
                "smooth": 0.15,
                "stability": "play",
                "note": "Lay/roll/chase — second phone can augment; PiP/games friendly",
            },
            "dog": {
                "label": "Dog",
                "mode": "pet",
                "eye_height_cm": 40,
                "stand_eye_cm": 55,
                "floor_eye_cm": 15,
                "seat_distance_cm": 180,
                "gain": 1.2,
                "smooth": 0.2,
                "stability": "pet",
                "note": "Changing eyeline — field-shift / pet content layer later",
            },
        },
        "house": {
            "horizon_seat_in": 62,
            "center_mark_in": 60.5,
            "horizon_seat_cm": 157.5,
            "center_mark_cm": 153.7,
            "measured": "2026-07-30",
            "couch_distance_cm": None,
            "notes": "Multi-seat roam; calibrate distance with Zero vantage + walk later",
        },
    },
    "color_test": {
        "enabled": False,
        "mode": "complementary",  # complementary | tertiary | primaries | grayscale | painting
    },
    # TV surface control (phone → Mac hub → DashCast page)
    "tv_cmd": {
        "reload_token": 0,  # TV page reloads when this increments
        "last_recast": 0.0,
        "last_error": None,
        # light tweaks for TV-native PWA (no full recast)
        "stream_mode": None,  # economy | balanced | tv-native | studio
        "pause_feeds": False,
        "quality_delta": 0,  # -1 drop · 0 · +1 bump (applied to plan heights)
        "cmd_seq": 0,  # monotonic for TV poll
        "last_cmd": None,
        "last_cmd_t": 0.0,
    },
    # Scaled stream budget — control Mac vs TV-native offload
    "stream_policy": {
        "schema": "fc-stream-policy-v1",
        "mode_control": "economy",
        "mode_tv": "tv-native",
        "active_role": "auto",  # auto | control | tv
        "max_live_override": None,
        "paused": False,
        "quality_delta": 0,
        "updated": 0.0,
    },
}

REFS = [
    {
        "id": "supermap",
        "title": "SuperMap — living spatial memory (RSS 2026)",
        "url": "https://github.com/superxslam/SuperMap",
        "page": "https://superodometry.com/supermap",
        "note": "4D scene graph · SLAM + open-vocab · VLN later L6",
    },
    {
        "id": "parallel-stereo",
        "title": "Parallel Stereo Visualization",
        "url": "https://csprofkgd.github.io/parallel-stereo-visualization/",
        "note": "Stereo / multi-view spatial viz reference",
    },
    {
        "id": "shells",
        "title": "SHELLS (Syntec Research)",
        "url": "https://syntec-research.github.io/SHELLS/",
        "note": "Shell / layered spatial structure reference",
    },
    {
        "id": "gmunk-box",
        "title": "GMUNK · BOX (Bot & Dolly)",
        "url": "https://gmunk.com/BOX",
        "note": "Projection-mapped depth cube / illusion principles · uncanny valley target",
    },
]

_lock = threading.RLock()  # RLock: pose + transcript helpers may nest notify
_pose_cv = threading.Condition(_lock)
_pose_seq = 0
_transcript_cv = threading.Condition(_lock)
_transcript_seq = 0
_transcript_lines: list[dict] = []  # ring buffer of fc-transcript-v1 lines
_transcript_meta: dict = {
    "program": None,
    "source": None,
    "project": None,  # blank | train | overview | vwall | grok-cli | null
    "lang": "en",
    "mode": "live",  # live | scene | custom | idle
}
_TIMESYNC_PY = Path(__file__).resolve().parents[1] / "timesync-world-clock.py"
# also allow monorepo scripts path
if not _TIMESYNC_PY.is_file():
    _TIMESYNC_PY = Path(__file__).resolve().parents[2] / "timesync-world-clock.py"
_clock_cache: dict = {"t": 0.0, "snap": None}

# Demo seed lines (blank-style captions for L3 smoke)
_DEMO_TRANSCRIPT = [
    {"text": "GrokCast live · lower thirds online", "speaker": "SYS", "source": "demo"},
    {"text": "Timesync parked in broadcast info strip", "speaker": "SYS", "source": "demo"},
    {
        "text": "Transcript bus mirrors blank captions · train themes · overview compare",
        "speaker": "PGM",
        "source": "demo",
        "project": "blank",
        "themes": ["broadcast", "captions", "l3"],
    },
    {
        "text": "Pipe → ~/.panda/vision/cast/transcript.jsonl · POST /api/transcript",
        "speaker": "HUB",
        "source": "demo",
        "project": "grok-cli",
    },
]


def lan_ip() -> str:
    try:
        import socket

        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    for envk in ("LIVE_DEMUX_LAN_IP", "HOST_IP"):
        if os.environ.get(envk):
            return os.environ[envk]
    return "127.0.0.1"


def https_port() -> int:
    return int(os.environ.get("LIVE_DEMUX_CAST_HTTPS_PORT", "8766"))


def glyph_addresses(port: int | None = None) -> dict:
    """LAN cast control addresses for QR quick-launch (phone remote PWA).

    QR prefers HTTPS so Safari treats the control as a secure streaming app
    (getUserMedia · Add to Home Screen). TV DashCast stays on HTTP.

    Whitespace / binary glyph codec is separate (GrokYtalkY) — not kbatch.
    """
    port = int(port or os.environ.get("LIVE_DEMUX_CAST_PORT", "8765"))
    hport = https_port()
    ip = lan_ip()
    hub_http = f"http://{ip}:{port}"
    hub_https = f"https://{ip}:{hport}" if hport > 0 else hub_http
    # Phone app / PWA entry (secure)
    ctrl = f"{hub_https}/box?pwa=1"
    ctrl_http = f"{hub_http}/box"
    # TV program stays cleartext (DashCast)
    tv = f"{hub_http}/news?tv=1"
    tv_box = f"{hub_http}/box?tv=1&src=/media/zane-center.mp4"
    public_ctrl = os.environ.get("LIVE_DEMUX_CAST_PUBLIC_CTRL", "").strip()
    scan = public_ctrl or ctrl
    return {
        # primary scannable target = HTTPS phone control PWA
        "scan": scan,
        "qr": scan,
        "direct": scan,
        "ctrl": ctrl,
        "ctrl_http": ctrl_http,
        "hub": hub_http,
        "hub_https": hub_https,
        "tv": tv,
        "tv_box": tv_box,
        "lan": ip,
        "port": port,
        "https_port": hport,
        "app": "box",
        "v": 1,
        "secure": hport > 0,
        "setup": f"{hub_https}/setup.html",
        "manifest": f"{hub_https}/manifest.webmanifest",
        "glyph_codec": "whitespace · blank coins · glyph-in-spaces · pcap",
        "glyph_note": "Whitespace binary glyph is mesh-side (GrokYtalkY), not kbatch redirect.",
        "note": "Scan QR → HTTPS phone PWA (secure) · TV uses HTTP DashCast.",
    }


def load_state() -> dict:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if STATE_PATH.is_file():
        try:
            data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            out = dict(DEFAULT_STATE)
            out.update(data)
            return out
        except Exception:
            pass
    return dict(DEFAULT_STATE)


def save_state(state: dict, *, bump_pose: bool = False) -> None:
    global _pose_seq
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    state["updated"] = time.time()
    if bump_pose:
        _pose_seq += 1
        state["pose_seq"] = _pose_seq
        v = dict(state.get("viewer") or {})
        v["seq"] = _pose_seq
        state["viewer"] = v
        _pose_cv.notify_all()
    else:
        state["pose_seq"] = max(int(state.get("pose_seq") or 0), _pose_seq)
    STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def clock_snapshot(force: bool = False) -> dict:
    """fc-timesync-v1 snapshot — same source as terminal /clock."""
    now = time.time()
    if not force and _clock_cache["snap"] and now - _clock_cache["t"] < 0.4:
        return _clock_cache["snap"]  # type: ignore

    snap = None
    # Prefer full --json (matches terminal schema) unless pipe is very fresh
    pipe = Path(os.environ.get("TIMESYNC_PIPE", Path.home() / ".panda/packs/timesync.jsonl"))
    pipe_age = 1e9
    if pipe.is_file():
        try:
            pipe_age = time.time() - pipe.stat().st_mtime
        except Exception:
            pipe_age = 1e9

    py = Path(__file__).resolve().parents[2] / "timesync-world-clock.py"
    if not py.is_file():
        py = Path.home() / "Projects/grok-build/scripts/timesync-world-clock.py"
    try:
        r = subprocess.run(
            [sys_executable(), str(py), "--json"],
            capture_output=True,
            timeout=8,
            text=True,
            check=False,
        )
        if r.returncode == 0 and r.stdout.strip():
            snap = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:
        snap = None
        err = str(e)
    else:
        err = None

    # fallback to pipe (compact) if --json failed
    if snap is None and pipe.is_file() and pipe_age < 30:
        try:
            lines = pipe.read_text(encoding="utf-8", errors="replace").strip().splitlines()
            if lines:
                snap = json.loads(lines[-1])
        except Exception:
            pass

    if snap is None and err:
        snap = {"schema": "fc-timesync-v1", "error": err, "ok": False}

    if not isinstance(snap, dict):
        # minimal fallback
        import datetime as _dt

        utc = _dt.datetime.now(_dt.timezone.utc)
        snap = {
            "schema": "fc-timesync-v1",
            "ok": False,
            "zulu": utc.strftime("%H%M%SZ"),
            "iso_utc": utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "unix": int(now),
            "tier": {"level": 3, "label": "L3 FREE-RUN"},
            "error": "timesync script unavailable",
        }

    snap["_hub_t"] = now
    _clock_cache["t"] = now
    _clock_cache["snap"] = snap
    return snap


def _hhmmss(ts: float | None = None) -> str:
    import datetime as _dt

    t = _dt.datetime.fromtimestamp(ts or time.time(), tz=_dt.timezone.utc)
    return t.strftime("%H:%M:%S")


def normalize_transcript_line(raw: dict | str, *, default_source: str = "inject") -> dict:
    """blank-style caption row + train/overview project hooks → fc-transcript-v1."""
    global _transcript_seq
    if isinstance(raw, str):
        raw = {"text": raw}
    if not isinstance(raw, dict):
        raw = {"text": str(raw)}
    text = (raw.get("text") or raw.get("line") or raw.get("caption") or "").strip()
    if not text:
        raise ValueError("transcript line requires text")
    now = time.time()
    _transcript_seq += 1
    seq = _transcript_seq
    t = float(raw.get("t") or now)
    time_label = raw.get("time") or _hhmmss(t)
    line = {
        "schema": "fc-transcript-v1",
        "id": raw.get("id") or f"t-{seq}",
        "seq": seq,
        "t": t,
        "time": time_label,
        "text": text[:2000],
        "speaker": (raw.get("speaker") or raw.get("role") or "PGM")[:48],
        "source": (raw.get("source") or default_source)[:48],
        "program": raw.get("program") or _transcript_meta.get("program"),
        "lang": raw.get("lang") or _transcript_meta.get("lang") or "en",
        "final": bool(raw.get("final", True)),
        "themes": list(raw.get("themes") or [])[:12],
        "project": raw.get("project") or _transcript_meta.get("project"),
        # overview-style columns (optional scaffold)
        "whisper": raw.get("whisper"),
        "captions": raw.get("captions"),
        "scene": raw.get("scene") or raw.get("sceneTitle"),
    }
    # drop nulls for compact pipe
    return {k: v for k, v in line.items() if v is not None}


def append_transcript_line(line: dict, *, write_pipe: bool = True) -> dict:
    """Push one line into ring + optional JSONL pipe. Caller holds _lock or not."""
    global _transcript_lines
    _transcript_lines.append(line)
    if len(_transcript_lines) > TRANSCRIPT_MAX:
        _transcript_lines = _transcript_lines[-TRANSCRIPT_MAX:]
    if write_pipe:
        try:
            TRANSCRIPT_PIPE.parent.mkdir(parents=True, exist_ok=True)
            with TRANSCRIPT_PIPE.open("a", encoding="utf-8") as f:
                f.write(json.dumps(line, ensure_ascii=False) + "\n")
        except Exception:
            pass
    with _transcript_cv:
        _transcript_cv.notify_all()
    return line


def transcript_snapshot(limit: int = 24, since_seq: int = 0) -> dict:
    """Recent lines for L3 / control (blank tv-cast slice(-24) pattern)."""
    with _lock:
        lines = list(_transcript_lines)
        meta = dict(_transcript_meta)
        seq = _transcript_seq
    if since_seq > 0:
        lines = [ln for ln in lines if int(ln.get("seq") or 0) > since_seq]
    if limit > 0:
        lines = lines[-limit:]
    return {
        "schema": "fc-transcript-v1",
        "ok": True,
        "seq": seq,
        "count": len(lines),
        "total": len(_transcript_lines),
        "meta": meta,
        "lines": lines,
        "pipe": str(TRANSCRIPT_PIPE),
        "projects": {
            "blank": "https://github.com/fornevercollective/blank",
            "train": "https://github.com/fornevercollective/train",
            "overview": "https://github.com/fornevercollective/overview",
            "vwall": "https://github.com/fornevercollective/vwall",
            "grok-cli": "https://github.com/fornevercollective/grok-cli",
        },
    }


def sys_executable() -> str:
    import sys

    return sys.executable or "python3"


def load_stream_policy_file() -> dict:
    if STREAM_POLICY.is_file():
        try:
            return json.loads(STREAM_POLICY.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"schema": "fc-stream-policy-v1", "modes": {}, "defaults": {}}


def _nearest_height(h: int, steps: list[int]) -> int:
    if h <= 0:
        return 0
    best = steps[0] if steps else 0
    for s in steps:
        if s <= h:
            best = s
    return best


def build_stream_plan(
    *,
    role: str = "control",
    mode: str | None = None,
    layout: dict | None = None,
    program: str | None = None,
    isolated: str | None = None,
    channels: list | None = None,
    quality_delta: int = 0,
    max_live_override: int | None = None,
    paused: bool = False,
) -> dict:
    """Compute per-feed scaled resolution + decode budget (fc-stream-plan-v1).

    Control Mac defaults to economy (1 live). TV role uses tv-native offload so
    Google TV WebView decodes mosaics; desk only sends tweak commands.
    """
    pol = load_stream_policy_file()
    defaults = pol.get("defaults") or {}
    modes = pol.get("modes") or {}
    tile_scale = pol.get("tile_scale") or {}
    role = (role or "control").lower()
    if role not in ("control", "tv"):
        role = "control"
    mode = mode or defaults.get(role) or ("tv-native" if role == "tv" else "economy")
    if mode not in modes:
        mode = "economy" if role == "control" else "tv-native"
    m = modes[mode]
    tiers = dict(m.get("tiers") or {})
    max_live = int(max_live_override if max_live_override is not None else m.get("max_live") or 1)
    # device hard caps
    dev_key = (
        "tcl-google-uhd"
        if role == "tv"
        else "control-mac"
    )
    devices = pol.get("devices") or {}
    hard = (devices.get(dev_key) or {}).get("max_live_hard")
    if hard is not None:
        max_live = min(max_live, int(hard))
    if paused:
        max_live = 0

    layout = layout or {"cols": 6, "rows": 3}
    cols = max(1, int(layout.get("cols") or 6))
    rows = max(1, int(layout.get("rows") or 3))
    slots = cols * rows
    panel_w = int(tile_scale.get("panel_width") or 1920)
    panel_h = int(tile_scale.get("panel_height") or 1080)
    tile_w = panel_w / cols
    tile_h = panel_h / rows
    steps = list(tile_scale.get("height_steps") or [0, 144, 180, 240, 360, 480, 720])
    min_embed = int(tile_scale.get("min_height_for_embed") or 120)

    # quality_delta shifts tier heights one step
    def apply_delta(h: int) -> int:
        if not h:
            return 0
        if quality_delta == 0 or not steps:
            return h
        try:
            i = steps.index(_nearest_height(h, steps))
        except ValueError:
            i = 0
            for j, s in enumerate(steps):
                if s <= h:
                    i = j
        i = max(0, min(len(steps) - 1, i + int(quality_delta)))
        return steps[i]

    # load channels if not provided
    if channels is None:
        channels = []
        if NEWS_CATALOG.is_file():
            try:
                cat = json.loads(NEWS_CATALOG.read_text(encoding="utf-8"))
                channels = list(cat.get("channels") or [])
            except Exception:
                channels = []
    channels = list(channels)[:slots]
    # default PGM = first catalog channel so economy still reserves one live slot
    if not program and channels:
        program = channels[0].get("id")

    # priority: pgm, iso, tag boost, cell order
    tag_boost = set((pol.get("priority") or {}).get("tag_boost") or [])

    def score(ch: dict) -> tuple:
        cid = ch.get("id")
        if cid == program:
            return (0, 0)
        if cid == isolated:
            return (1, 0)
        tags = set(ch.get("tags") or [])
        boost = 0 if tags & tag_boost else 1
        return (2 + boost, int(ch.get("cell") or 99))

    ranked = sorted(channels, key=score)
    feeds = []
    live_used = 0
    total_kbps = 0

    for rank, ch in enumerate(ranked):
        cid = ch.get("id")
        if cid == program:
            role_tier = "pgm"
        elif cid == isolated:
            role_tier = "iso"
        elif rank < max_live + 2:
            role_tier = "near"
        else:
            role_tier = "far"

        tier = dict(tiers.get(role_tier) or tiers.get("far") or {})
        want_h = apply_delta(int(tier.get("height") or 0))
        # never request more than ~tile height (scaled resolution)
        cap_h = int(tile_h * float(tile_scale.get("scale_factor") or 1.0))
        want_h = min(want_h, cap_h) if want_h else 0
        want_h = _nearest_height(want_h, steps)

        decode = tier.get("decode") or "poster"
        if want_h < min_embed:
            decode = "poster"
            want_h = 0

        # budget: only top max_live get embed/lite
        if decode in ("embed", "lite") and live_used >= max_live:
            decode = "poster"
            want_h = 0
        if decode in ("embed", "lite") and want_h > 0:
            live_used += 1
            kbps = int(tier.get("bitrate_kbps") or 0)
            # scale bitrate roughly with height
            if int(tier.get("height") or 0) > 0 and want_h:
                kbps = int(kbps * (want_h / max(1, int(tier["height"]))))
            total_kbps += kbps
        else:
            kbps = 0
            decode = "poster"

        feeds.append(
            {
                "id": cid,
                "label": ch.get("label"),
                "role": role_tier,
                "decode": decode,
                "height": want_h,
                "width": int(want_h * 16 / 9) if want_h else 0,
                "fps": int(tier.get("fps") or 0) if decode != "poster" else 0,
                "bitrate_kbps": kbps,
                "tile": {"w": round(tile_w, 1), "h": round(tile_h, 1)},
                "url": ch.get("url"),
                "channel_id": ch.get("channel_id"),
                "video_id": ch.get("video_id"),
                "priority": rank,
            }
        )

    # stable order by original cell / list
    by_id = {f["id"]: f for f in feeds}
    ordered = []
    for ch in channels:
        if ch.get("id") in by_id:
            ordered.append(by_id[ch["id"]])

    return {
        "schema": "fc-stream-plan-v1",
        "ok": True,
        "role": role,
        "mode": mode,
        "mode_label": m.get("label"),
        "offload": m.get("offload") or ("tv" if role == "tv" else "local"),
        "layout": {"cols": cols, "rows": rows, "slots": slots},
        "budget": {
            "max_live": max_live,
            "live_used": live_used,
            "max_audio": int(m.get("max_audio") or 1),
            "max_decode_mbps": float(m.get("max_decode_mbps") or 0),
            "estimate_mbps": round(total_kbps / 1000.0, 2),
            "paused": paused,
            "quality_delta": int(quality_delta),
            "stagger_ms": int(m.get("stagger_ms") or 400),
        },
        "panel": {"w": panel_w, "h": panel_h, "tile_w": round(tile_w, 1), "tile_h": round(tile_h, 1)},
        "program": program,
        "isolated": isolated,
        "feeds": ordered,
        "control_commands": pol.get("control_commands") or [],
        "warn": m.get("warn"),
        "t": time.time(),
    }


def body_role_default(qs: dict, st: dict) -> str:
    """Infer role from query or stream_policy.active_role."""
    sp = st.get("stream_policy") or {}
    ar = (sp.get("active_role") or "auto").lower()
    if ar in ("control", "tv"):
        return ar
    # auto: tv if client hints via query already handled; default control
    return "control"


def apply_stream_cmd(body: dict) -> dict:
    """Minor TV/control tweaks — no recast required for most."""
    cmd = (body.get("cmd") or body.get("action") or "").lower().strip()
    with _lock:
        st = load_state()
        sp = dict(st.get("stream_policy") or DEFAULT_STATE["stream_policy"])
        tc = dict(st.get("tv_cmd") or {})
        news = dict(st.get("news") or {})
        audio = dict(st.get("audio") or {})
        applied = cmd or "noop"

        if cmd in ("set_mode", "mode"):
            mode = body.get("mode") or body.get("value")
            role = (body.get("role") or "tv").lower()
            if mode:
                if role == "control":
                    sp["mode_control"] = mode
                else:
                    sp["mode_tv"] = mode
                tc["stream_mode"] = mode
        elif cmd in ("set_pgm", "pgm", "program"):
            pid = body.get("program") or body.get("id") or body.get("value")
            if pid:
                news["program"] = pid
                st["news"] = news
        elif cmd in ("set_iso", "iso"):
            iid = body.get("isolated") or body.get("id") or body.get("value")
            news["isolated"] = iid  # may be null to clear
            st["news"] = news
        elif cmd in ("set_budget", "budget"):
            if body.get("max_live") is not None:
                sp["max_live_override"] = int(body["max_live"])
        elif cmd in ("pause_all", "pause"):
            sp["paused"] = True
            tc["pause_feeds"] = True
        elif cmd in ("resume", "unpause"):
            sp["paused"] = False
            tc["pause_feeds"] = False
        elif cmd in ("bump_quality", "quality_up", "hq"):
            sp["quality_delta"] = min(2, int(sp.get("quality_delta") or 0) + 1)
            tc["quality_delta"] = sp["quality_delta"]
        elif cmd in ("drop_quality", "quality_down", "lq"):
            sp["quality_delta"] = max(-2, int(sp.get("quality_delta") or 0) - 1)
            tc["quality_delta"] = sp["quality_delta"]
        elif cmd in ("duck",):
            audio["ducking"] = bool(body.get("value", True))
            news["ducking"] = audio["ducking"]
            st["audio"] = audio
            st["news"] = news
        elif cmd in ("layout",):
            if body.get("cols") or body.get("rows"):
                lay = dict(news.get("layout") or {"cols": 6, "rows": 3})
                if body.get("cols"):
                    lay["cols"] = int(body["cols"])
                if body.get("rows"):
                    lay["rows"] = int(body["rows"])
                news["layout"] = lay
                st["news"] = news
        elif cmd in ("reload", "refresh"):
            tc["reload_token"] = int(tc.get("reload_token") or 0) + 1
        elif cmd in ("noop", "", "status"):
            applied = "status"
        else:
            return {"ok": False, "error": f"unknown cmd {cmd}", "commands": (load_stream_policy_file().get("control_commands") or [])}

        sp["updated"] = time.time()
        tc["cmd_seq"] = int(tc.get("cmd_seq") or 0) + 1
        tc["last_cmd"] = applied
        tc["last_cmd_t"] = time.time()
        st["stream_policy"] = sp
        st["tv_cmd"] = tc
        if "news" not in st or news:
            st["news"] = news
        save_state(st, bump_pose=False)
        return {
            "ok": True,
            "cmd": applied,
            "cmd_seq": tc["cmd_seq"],
            "stream_policy": sp,
            "tv_cmd": tc,
            "news": st.get("news"),
        }


class Handler(BaseHTTPRequestHandler):
    server_version = "align-hub/1"

    def log_message(self, fmt: str, *args) -> None:
        # quiet unless ALIGN_HUB_VERBOSE=1
        if os.environ.get("ALIGN_HUB_VERBOSE") == "1":
            super().log_message(fmt, *args)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def _json(self, code: int, obj) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, code: int, data: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self._cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        u = urlparse(self.path)
        path = u.path.rstrip("/") or "/"

        if path in ("/", "/align-chart.html", "/index.html"):
            if not HTML.is_file():
                self._json(500, {"error": f"missing {HTML}"})
                return
            data = HTML.read_bytes()
            self._bytes(200, data, "text/html; charset=utf-8")
            return

        if path in ("/parallax", "/parallax-surface.html", "/window"):
            if not PARALLAX.is_file():
                self._json(500, {"error": f"missing {PARALLAX}"})
                return
            self._bytes(200, PARALLAX.read_bytes(), "text/html; charset=utf-8")
            return

        if path in ("/box", "/box-surface.html", "/depth"):
            if not BOX.is_file():
                self._json(500, {"error": f"missing {BOX}"})
                return
            self._bytes(200, BOX.read_bytes(), "text/html; charset=utf-8")
            return

        if path in ("/news", "/news-wall.html", "/news-wall"):
            if not NEWS.is_file():
                self._json(500, {"error": f"missing {NEWS}"})
                return
            self._bytes(200, NEWS.read_bytes(), "text/html; charset=utf-8")
            return

        # TV-native PWA shell — Google TV WebView does decode; desk sends light cmds
        if path in ("/tv", "/tv-shell", "/tv-shell.html", "/tv-pwa"):
            if TV_SHELL.is_file():
                self._bytes(200, TV_SHELL.read_bytes(), "text/html; charset=utf-8")
                return
            # fallback: news wall in tv mode
            if NEWS.is_file():
                self._bytes(200, NEWS.read_bytes(), "text/html; charset=utf-8")
                return
            self._json(500, {"error": "tv-shell missing"})
            return

        # WebGL GPU environment — living forest/depth for DashCast TV stream test
        if path in ("/gpu", "/gpu-env", "/gpu-env.html", "/gpu-test"):
            if GPU_ENV.is_file():
                self._bytes(200, GPU_ENV.read_bytes(), "text/html; charset=utf-8")
                return
            self._json(500, {"error": "gpu-env.html missing"})
            return

        # Multi-device crazy cast — phones + Quest browser → TV perspective
        if path in ("/crazy", "/crazy.html", "/crazy-cast"):
            if CRAZY.is_file():
                self._bytes(200, CRAZY.read_bytes(), "text/html; charset=utf-8")
                return
            self._json(500, {"error": "crazy.html missing"})
            return

        if path in ("/devices", "/devices.html", "/device-lab"):
            if DEVICES_HTML.is_file():
                self._bytes(200, DEVICES_HTML.read_bytes(), "text/html; charset=utf-8")
                return
            self._json(500, {"error": "devices.html missing"})
            return

        if path in ("/device-kit.js", "/vendor/device-kit.js"):
            if DEVICE_KIT.is_file():
                self._bytes(200, DEVICE_KIT.read_bytes(), "application/javascript; charset=utf-8")
                return
            self._json(404, {"error": "device-kit.js missing"})
            return

        if path in ("/api/devices", "/api/device"):
            matrix = {}
            presets = {}
            if BROWSER_MATRIX.is_file():
                try:
                    matrix = json.loads(BROWSER_MATRIX.read_text(encoding="utf-8"))
                except Exception as e:
                    matrix = {"error": str(e)}
            if DEVTOOLS_PRESETS.is_file():
                try:
                    presets = json.loads(DEVTOOLS_PRESETS.read_text(encoding="utf-8"))
                except Exception as e:
                    presets = {"error": str(e)}
            cast_profiles = []
            if DEVICES_DIR.is_dir():
                for p in sorted(DEVICES_DIR.glob("*.json")):
                    if p.name in ("browser-matrix.json", "devtools-presets.json"):
                        continue
                    try:
                        cast_profiles.append(json.loads(p.read_text(encoding="utf-8")))
                    except Exception:
                        cast_profiles.append({"id": p.stem, "error": "parse"})
            with _lock:
                clients = list(_device_clients[-24:])
            self._json(
                200,
                {
                    "schema": "fc-devices-v1",
                    "ok": True,
                    "matrix": matrix,
                    "presets": presets,
                    "cast_profiles": cast_profiles,
                    "clients": clients,
                    "endpoints": {
                        "lab": "/devices",
                        "matrix": "/api/devices/matrix",
                        "presets": "/api/devices/presets",
                        "hello": "POST /api/devices/hello",
                    },
                },
            )
            return

        if path in ("/api/devices/matrix", "/api/browser/matrix"):
            if BROWSER_MATRIX.is_file():
                try:
                    self._json(200, json.loads(BROWSER_MATRIX.read_text(encoding="utf-8")))
                    return
                except Exception as e:
                    self._json(500, {"error": str(e)})
                    return
            self._json(404, {"error": "browser-matrix.json missing"})
            return

        if path in ("/api/devices/presets", "/api/devtools/presets"):
            if DEVTOOLS_PRESETS.is_file():
                try:
                    self._json(200, json.loads(DEVTOOLS_PRESETS.read_text(encoding="utf-8")))
                    return
                except Exception as e:
                    self._json(500, {"error": str(e)})
                    return
            self._json(404, {"error": "devtools-presets.json missing"})
            return

        if path in ("/api/news/catalog", "/api/news"):
            if NEWS_CATALOG.is_file():
                try:
                    data = json.loads(NEWS_CATALOG.read_text(encoding="utf-8"))
                    self._json(200, data)
                    return
                except Exception as e:
                    self._json(500, {"error": str(e)})
                    return
            self._json(404, {"error": "news-catalog.json missing"})
            return

        if path in ("/api/stream/policy", "/api/stream/policy.json"):
            pol = load_stream_policy_file()
            st = load_state()
            live = dict(st.get("stream_policy") or {})
            pol = dict(pol)
            pol["live"] = live
            pol["tv_cmd"] = st.get("tv_cmd")
            self._json(200, pol)
            return

        if path in ("/api/stream/plan", "/api/stream/budget"):
            qs = parse_qs(u.query)
            st = load_state()
            sp = st.get("stream_policy") or {}
            news = st.get("news") or {}
            role = (qs.get("role") or [None])[0] or body_role_default(qs, st)
            mode = (qs.get("mode") or [None])[0]
            if not mode:
                mode = (
                    sp.get("mode_tv")
                    if role == "tv"
                    else sp.get("mode_control")
                )
            try:
                qdelta = int((qs.get("qd") or [None])[0] or sp.get("quality_delta") or 0)
            except (TypeError, ValueError):
                qdelta = int(sp.get("quality_delta") or 0)
            layout = news.get("layout") or {"cols": 6, "rows": 3}
            if qs.get("cols") or qs.get("rows"):
                layout = {
                    "cols": int((qs.get("cols") or [layout.get("cols") or 6])[0]),
                    "rows": int((qs.get("rows") or [layout.get("rows") or 3])[0]),
                }
            plan = build_stream_plan(
                role=role,
                mode=mode,
                layout=layout,
                program=(qs.get("pgm") or [None])[0] or news.get("program"),
                isolated=(qs.get("iso") or [None])[0] or news.get("isolated"),
                quality_delta=qdelta,
                max_live_override=sp.get("max_live_override"),
                paused=bool(sp.get("paused") or (st.get("tv_cmd") or {}).get("pause_feeds")),
            )
            self._json(200, plan)
            return

        if path in ("/api/stream/cmd", "/api/tv/cmd"):
            # GET = last cmd status (TV poll)
            st = load_state()
            self._json(
                200,
                {
                    "ok": True,
                    "tv_cmd": st.get("tv_cmd"),
                    "stream_policy": st.get("stream_policy"),
                    "news": st.get("news"),
                    "audio": st.get("audio"),
                },
            )
            return

        if path in ("/api/status", "/api/vendor"):
            # maptrace / fleet snapshot for /map and device vendor updates
            st = load_state()
            port = self.server.server_address[1]
            addrs = glyph_addresses(port)
            sp = st.get("stream_policy") or {}
            snap = {
                "schema": "fc-cast-status-v1",
                "t": time.time(),
                "hub": addrs,
                "pose_seq": st.get("pose_seq"),
                "surface": st.get("surface"),
                "viewer": st.get("viewer"),
                "vantage": {
                    "user": (st.get("vantage") or {}).get("user"),
                    "posture": (st.get("vantage") or {}).get("posture")
                    or (st.get("vantage") or {}).get("mode"),
                    "eye_height_cm": (st.get("vantage") or {}).get("eye_height_cm"),
                    "tv_center_height_cm": (st.get("vantage") or {}).get("tv_center_height_cm")
                    or (st.get("vantage") or {}).get("tv_height_cm"),
                    "stability": (st.get("vantage") or {}).get("stability"),
                },
                "news": st.get("news"),
                "audio": st.get("audio"),
                "tv_cmd": st.get("tv_cmd"),
                "stream_policy": sp,
                "stream_plan_hint": {
                    "control_mode": sp.get("mode_control") or "economy",
                    "tv_mode": sp.get("mode_tv") or "tv-native",
                    "offload": "tv",
                },
                "cam_map": st.get("cam_map"),
                "devices": {
                    "cast_default": os.environ.get("LIVE_DEMUX_CAST_DEVICE", "Smart TV"),
                    "ffmpeg": True,
                    "ffplay": True,
                    "dashcast": "84912283",
                    "profile": os.environ.get("LIVE_DEMUX_CAST_TV_MODEL", "tcl-google-uhd"),
                },
                "pipes": {
                    "cast_status": str(STATUS_PIPE),
                    "maptrace": str(MAPTRACE_HINT),
                    "timesync": str(
                        Path(os.environ.get("TIMESYNC_PIPE", Path.home() / ".panda/packs/timesync.jsonl"))
                    ),
                    "transcript": str(TRANSCRIPT_PIPE),
                },
                "future": {
                    "space_lidar": "pointcloud desk/TV room from chat furniture measures → auto vantage",
                    "vendor_matrix": "per-device encode envelopes (TCL/Hisense/Quest)",
                    "tv_pwa": "persistent Google TV shell at /tv — native decode + light control cmds",
                },
            }
            self._json(200, snap)
            return

        if path in ("/qrcode-generator.js", "/vendor/qrcode-generator.js"):
            if not QR_JS.is_file():
                self._json(500, {"error": "qrcode-generator.js missing"})
                return
            self._bytes(200, QR_JS.read_bytes(), "application/javascript; charset=utf-8")
            return

        if path in ("/manifest.webmanifest", "/manifest.json"):
            man = HERE / "cast-manifest.webmanifest"
            if man.is_file():
                self._bytes(200, man.read_bytes(), "application/manifest+json; charset=utf-8")
                return
            self._json(404, {"error": "manifest missing"})
            return

        if path in ("/sw.js", "/cast-sw.js"):
            sw = HERE / "cast-sw.js"
            if sw.is_file():
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Service-Worker-Allowed", "/")
                self._cors()
                data = sw.read_bytes()
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            self._json(404, {"error": "sw missing"})
            return

        if path in ("/setup.html", "/trust.html"):
            setup = HERE / "setup.html"
            if setup.is_file():
                self._bytes(200, setup.read_bytes(), "text/html; charset=utf-8")
                return

        # icons — fall back to Memory Glass pack (yesterday PWA)
        if path.startswith("/icons/") or path in ("/apple-touch-icon.png", "/favicon.png"):
            name = Path(path).name
            candidates = [
                Path.home() / ".panda/vision" / path.lstrip("/"),
                Path.home() / ".panda/vision" / name,
                Path.home() / ".panda/vision/icons" / name,
                HERE / "icons" / name,
            ]
            for cand in candidates:
                if cand.is_file():
                    ctype = "image/png" if cand.suffix.lower() == ".png" else "application/octet-stream"
                    self._bytes(200, cand.read_bytes(), ctype)
                    return
            self._json(404, {"error": "icon missing", "path": path})
            return

        if path in ("/api/lan", "/api/glyph", "/api/address", "/api/qr"):
            # port from server (rotates with bind / LAN)
            port = self.server.server_address[1]
            addrs = glyph_addresses(port)
            if path == "/api/lan":
                self._json(
                    200,
                    {
                        "lan": addrs["lan"],
                        "port": addrs["port"],
                        "hub": addrs["hub"],
                        "phone": addrs["scan"],
                        "ctrl": addrs["ctrl"],
                        "tv": addrs["tv"],
                        "scan": addrs["scan"],
                    },
                )
                return
            self._json(200, addrs)
            return

        # /media/* → ~/.panda/vision/cast/media (or LIVE_DEMUX_CAST_DIR)
        if path.startswith("/media/"):
            rel = path[len("/media/") :]
            if ".." in rel or rel.startswith("/"):
                self._json(400, {"error": "bad path"})
                return
            # allow media/ under cast dir
            fpath = (MEDIA_ROOT / "media" / rel).resolve()
            root = (MEDIA_ROOT / "media").resolve()
            if not str(fpath).startswith(str(root)) or not fpath.is_file():
                # also try direct under cast root
                fpath2 = (MEDIA_ROOT / rel).resolve()
                if str(fpath2).startswith(str(MEDIA_ROOT.resolve())) and fpath2.is_file():
                    fpath = fpath2
                else:
                    self._json(404, {"error": "media not found", "path": rel})
                    return
            ctype = "application/octet-stream"
            if fpath.suffix.lower() == ".mp4":
                ctype = "video/mp4"
            elif fpath.suffix.lower() in (".webm",):
                ctype = "video/webm"
            elif fpath.suffix.lower() in (".jpg", ".jpeg"):
                ctype = "image/jpeg"
            elif fpath.suffix.lower() == ".png":
                ctype = "image/png"
            data = fpath.read_bytes()
            # Range support light (for video seek)
            rng = self.headers.get("Range")
            if rng and rng.startswith("bytes="):
                try:
                    start_s, end_s = rng.replace("bytes=", "").split("-", 1)
                    start = int(start_s) if start_s else 0
                    end = int(end_s) if end_s else len(data) - 1
                    end = min(end, len(data) - 1)
                    chunk = data[start : end + 1]
                    self.send_response(206)
                    self.send_header("Content-Type", ctype)
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
                    self.send_header("Content-Length", str(len(chunk)))
                    self._cors()
                    self.end_headers()
                    self.wfile.write(chunk)
                    return
                except Exception:
                    pass
            self._bytes(200, data, ctype)
            return

        if path == "/health":
            self._json(200, {"ok": True, "service": "align-hub"})
            return

        if path == "/api/cams":
            # list relay stills + phone live frame if present
            cams_dir = MEDIA_ROOT / "media" / "cams"
            cams = []
            man = cams_dir / "manifest.json"
            if man.is_file():
                try:
                    data = json.loads(man.read_text(encoding="utf-8"))
                    cams = list(data.get("cams") or [])
                except Exception:
                    cams = []
            if not cams and cams_dir.is_dir():
                for p in sorted(cams_dir.glob("cam*.jpg")):
                    cams.append(
                        {
                            "slug": p.stem,
                            "url": f"/media/cams/{p.name}",
                            "name": p.stem,
                        }
                    )
            phone = MEDIA_ROOT / "media" / "cams" / "phone.jpg"
            if phone.is_file():
                cams.append(
                    {
                        "slug": "phone",
                        "url": "/media/cams/phone.jpg",
                        "name": "Phone (browser)",
                        "source": "getUserMedia",
                    }
                )
            with _lock:
                st = load_state()
            self._json(
                200,
                {
                    "cams": cams,
                    "cam_map": st.get("cam_map") or {},
                    "dir": str(cams_dir),
                },
            )
            return

        if path == "/api/state":
            with _lock:
                st = load_state()
                st["pose_seq"] = max(int(st.get("pose_seq") or 0), _pose_seq)
            self._json(200, st)
            return

        if path in ("/api/viewer", "/api/pose"):
            # lightweight pose-only (fast path for TV)
            with _lock:
                st = load_state()
                out = {
                    "pose_seq": max(int(st.get("pose_seq") or 0), _pose_seq),
                    "updated": st.get("updated"),
                    "viewer": st.get("viewer"),
                    "vantage": st.get("vantage"),
                    "variation": st.get("variation"),
                    "controller": st.get("controller"),
                    "surface": st.get("surface"),
                    "tv_cmd": st.get("tv_cmd"),
                    "color_test": st.get("color_test"),
                    "cam_map": st.get("cam_map"),
                }
            self._json(200, out)
            return

        if path in ("/api/clock", "/api/timesync"):
            # same fc-timesync-v1 as terminal /clock
            try:
                snap = clock_snapshot(force=("force" in parse_qs(u.query)))
                self._json(200, snap)
            except Exception as e:
                self._json(500, {"schema": "fc-timesync-v1", "ok": False, "error": str(e)})
            return

        # Live transcript bus — blank captions · train themes · overview columns · L3
        if path in ("/api/transcript", "/api/captions", "/api/l3/transcript"):
            qs = parse_qs(u.query)
            try:
                limit = int((qs.get("limit") or ["24"])[0] or 24)
            except ValueError:
                limit = 24
            try:
                since = int((qs.get("since") or qs.get("seq") or ["0"])[0] or 0)
            except ValueError:
                since = 0
            self._json(200, transcript_snapshot(limit=limit, since_seq=since))
            return

        if path in ("/api/transcript/stream", "/api/captions/stream"):
            # SSE — L3 / control follow new lines
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self._cors()
            self.end_headers()
            last = 0
            try:
                while True:
                    with _transcript_cv:
                        if _transcript_seq <= last:
                            _transcript_cv.wait(timeout=15)
                        cur = _transcript_seq
                        if cur > last:
                            lines = [
                                ln
                                for ln in list(_transcript_lines)
                                if int(ln.get("seq") or 0) > last
                            ]
                            last = cur
                            payload = {
                                "schema": "fc-transcript-v1",
                                "seq": cur,
                                "meta": dict(_transcript_meta),
                                "lines": lines[-12:],
                            }
                            data = json.dumps(payload)
                            self.wfile.write(
                                f"id: {cur}\nevent: transcript\ndata: {data}\n\n".encode()
                            )
                            self.wfile.flush()
                        else:
                            self.wfile.write(b": hb\n\n")
                            self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                return

        if path == "/api/refs":
            self._json(200, {"refs": REFS})
            return

        if path == "/api/long-poll":
            # wait until pose_seq or updated advances
            qs = parse_qs(u.query)
            since = float((qs.get("since") or ["0"])[0] or 0)
            since_seq = int((qs.get("seq") or ["0"])[0] or 0)
            deadline = time.time() + 20
            with _pose_cv:
                while time.time() < deadline:
                    st = load_state()
                    seq = max(int(st.get("pose_seq") or 0), _pose_seq)
                    if seq > since_seq or float(st.get("updated") or 0) > since:
                        st["pose_seq"] = seq
                        self._json(200, st)
                        return
                    remaining = max(0.05, min(0.5, deadline - time.time()))
                    _pose_cv.wait(timeout=remaining)
                st = load_state()
                st["pose_seq"] = max(int(st.get("pose_seq") or 0), _pose_seq)
                self._json(200, st)
            return

        if path in ("/api/viewer/stream", "/api/pose/stream"):
            # Server-Sent Events — TV follows phone with low latency
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self._cors()
            self.end_headers()
            last = -1
            try:
                while True:
                    with _pose_cv:
                        st = load_state()
                        seq = max(int(st.get("pose_seq") or 0), _pose_seq)
                        if seq <= last:
                            _pose_cv.wait(timeout=15)
                            st = load_state()
                            seq = max(int(st.get("pose_seq") or 0), _pose_seq)
                        if seq > last:
                            last = seq
                            payload = {
                                "pose_seq": seq,
                                "updated": st.get("updated"),
                                "viewer": st.get("viewer"),
                                "vantage": st.get("vantage"),
                                "variation": st.get("variation"),
                                "tv_cmd": st.get("tv_cmd"),
                                "cam_map": st.get("cam_map"),
                                "color_test": st.get("color_test"),
                            }
                            data = json.dumps(payload)
                            self.wfile.write(f"id: {seq}\nevent: pose\ndata: {data}\n\n".encode())
                            self.wfile.flush()
                        else:
                            # heartbeat
                            self.wfile.write(b": hb\n\n")
                            self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                return

        self._json(404, {"error": "not found", "path": path})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        path = u.path.rstrip("/") or "/"
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""

        # phone browser uploads a JPEG frame (multipart or raw image/*)
        if path in ("/api/cam/frame", "/api/cam/phone"):
            ctype = (self.headers.get("Content-Type") or "").lower()
            body = raw
            if "multipart/form-data" in ctype:
                # crude extract first image part
                if b"\r\n\r\n" in body:
                    # find jpeg SOI
                    i = body.find(b"\xff\xd8")
                    j = body.rfind(b"\xff\xd9")
                    if i >= 0 and j > i:
                        body = body[i : j + 2]
            elif body[:1] == b"{":
                # data URL json { "image": "data:image/jpeg;base64,..." }
                try:
                    import base64

                    obj = json.loads(body.decode("utf-8"))
                    data_url = obj.get("image") or obj.get("data") or ""
                    if "," in data_url:
                        body = base64.b64decode(data_url.split(",", 1)[1])
                except Exception:
                    self._json(400, {"error": "bad frame json"})
                    return
            if len(body) < 100 or body[:2] != b"\xff\xd8":
                self._json(400, {"error": "expected jpeg bytes"})
                return
            cams_dir = MEDIA_ROOT / "media" / "cams"
            cams_dir.mkdir(parents=True, exist_ok=True)
            out = cams_dir / "phone.jpg"
            tmp = cams_dir / "phone.jpg.tmp"
            tmp.write_bytes(body)
            tmp.replace(out)
            with _lock:
                st = load_state()
                # default map phone → cell 25 if unset
                cm = dict(st.get("cam_map") or {})
                if "25" not in cm and "phone" not in cm.values():
                    cm["25"] = "phone"
                    st["cam_map"] = cm
                    save_state(st)
            self._json(200, {"ok": True, "url": "/media/cams/phone.jpg", "bytes": len(body)})
            return

        # Device hello beacon (Chrome/Safari/Firefox surfaces report capabilities)
        if path in ("/api/devices/hello", "/api/device/hello"):
            try:
                body = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except json.JSONDecodeError:
                self._json(400, {"ok": False, "error": "bad json"})
                return
            body = dict(body) if isinstance(body, dict) else {"raw": str(body)}
            body["_hub_t"] = time.time()
            body["_ip"] = self.client_address[0] if self.client_address else None
            with _lock:
                _device_clients.append(body)
                if len(_device_clients) > 48:
                    del _device_clients[:-48]
            self._json(200, {"ok": True, "received": True, "clients": len(_device_clients)})
            return

        # Stream policy / TV control commands (light tweaks, no recast)
        if path in ("/api/stream/cmd", "/api/tv/cmd", "/api/stream/policy"):
            try:
                body = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except json.JSONDecodeError:
                self._json(400, {"ok": False, "error": "bad json"})
                return
            if path == "/api/stream/policy" and not body.get("cmd"):
                # merge policy fields directly
                with _lock:
                    st = load_state()
                    sp = dict(st.get("stream_policy") or DEFAULT_STATE["stream_policy"])
                    for k in (
                        "mode_control",
                        "mode_tv",
                        "active_role",
                        "max_live_override",
                        "paused",
                        "quality_delta",
                    ):
                        if k in body:
                            sp[k] = body[k]
                    if body.get("mode") and body.get("role"):
                        if body["role"] == "control":
                            sp["mode_control"] = body["mode"]
                        else:
                            sp["mode_tv"] = body["mode"]
                    sp["updated"] = time.time()
                    st["stream_policy"] = sp
                    tc = dict(st.get("tv_cmd") or {})
                    tc["cmd_seq"] = int(tc.get("cmd_seq") or 0) + 1
                    tc["last_cmd"] = "set_policy"
                    tc["last_cmd_t"] = time.time()
                    if body.get("mode"):
                        tc["stream_mode"] = body.get("mode")
                    st["tv_cmd"] = tc
                    save_state(st, bump_pose=False)
                    self._json(200, {"ok": True, "stream_policy": sp, "tv_cmd": tc})
                return
            out = apply_stream_cmd(body)
            self._json(200 if out.get("ok") else 400, out)
            return

        # Live transcript inject / clear / demo (blank · train · overview scaffold)
        if path in ("/api/transcript", "/api/captions", "/api/l3/transcript"):
            try:
                body = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except json.JSONDecodeError:
                self._json(400, {"ok": False, "error": "bad json"})
                return
            action = (body.get("action") or "append").lower()
            if action in ("clear", "reset"):
                with _lock:
                    _transcript_lines.clear()
                    # keep seq monotonic so clients don't re-show old cache
                self._json(
                    200,
                    {
                        "ok": True,
                        "action": "clear",
                        "seq": _transcript_seq,
                        "lines": [],
                    },
                )
                return
            if action in ("demo", "seed"):
                added = []
                with _lock:
                    _transcript_meta["mode"] = "live"
                    _transcript_meta["source"] = "demo"
                    _transcript_meta["project"] = body.get("project") or "blank"
                    _transcript_meta["program"] = body.get("program") or "l3-demo"
                    for raw_ln in _DEMO_TRANSCRIPT:
                        try:
                            ln = normalize_transcript_line(raw_ln, default_source="demo")
                        except ValueError:
                            continue
                        append_transcript_line(ln)
                        added.append(ln)
                self._json(
                    200,
                    {
                        "ok": True,
                        "action": "demo",
                        "seq": _transcript_seq,
                        "added": len(added),
                        "lines": added,
                        "meta": dict(_transcript_meta),
                    },
                )
                return
            # meta-only update
            if body.get("meta") and not (
                body.get("text") or body.get("line") or body.get("lines") or body.get("captions")
            ):
                with _lock:
                    for k in ("program", "source", "project", "lang", "mode"):
                        if k in body["meta"] and body["meta"][k] is not None:
                            _transcript_meta[k] = body["meta"][k]
                self._json(200, {"ok": True, "action": "meta", "meta": dict(_transcript_meta)})
                return
            # batch or single (blank captions[] shape)
            batch = body.get("lines") or body.get("captions") or None
            if batch is None and (body.get("text") or body.get("line") or body.get("caption")):
                batch = [body]
            if not batch:
                self._json(400, {"ok": False, "error": "need text, lines[], or captions[]"})
                return
            if not isinstance(batch, list):
                batch = [batch]
            # optional meta on inject
            with _lock:
                for k in ("program", "source", "project", "lang", "mode"):
                    if body.get(k) is not None:
                        _transcript_meta[k] = body[k]
            added = []
            with _lock:
                for raw_ln in batch:
                    try:
                        ln = normalize_transcript_line(
                            raw_ln if isinstance(raw_ln, dict) else {"text": str(raw_ln)},
                            default_source=str(body.get("source") or "inject"),
                        )
                        if body.get("program") and not ln.get("program"):
                            ln["program"] = body["program"]
                        if body.get("project") and not ln.get("project"):
                            ln["project"] = body["project"]
                    except ValueError as e:
                        self._json(400, {"ok": False, "error": str(e)})
                        return
                    append_transcript_line(ln)
                    added.append(ln)
            self._json(
                200,
                {
                    "ok": True,
                    "action": "append",
                    "seq": _transcript_seq,
                    "added": len(added),
                    "lines": added[-8:],
                    "meta": dict(_transcript_meta),
                    "pipe": str(TRANSCRIPT_PIPE),
                },
            )
            return

        if path in ("/api/transcript/clear", "/api/captions/clear"):
            with _lock:
                _transcript_lines.clear()
            self._json(200, {"ok": True, "action": "clear", "seq": _transcript_seq})
            return

        if path in ("/api/transcript/demo", "/api/captions/demo"):
            try:
                body = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except json.JSONDecodeError:
                body = {}
            added = []
            with _lock:
                _transcript_meta["mode"] = "live"
                _transcript_meta["source"] = "demo"
                _transcript_meta["project"] = body.get("project") or "blank"
                _transcript_meta["program"] = body.get("program") or "l3-demo"
                for raw_ln in _DEMO_TRANSCRIPT:
                    try:
                        ln = normalize_transcript_line(raw_ln, default_source="demo")
                    except ValueError:
                        continue
                    append_transcript_line(ln)
                    added.append(ln)
            self._json(
                200,
                {
                    "ok": True,
                    "action": "demo",
                    "seq": _transcript_seq,
                    "added": len(added),
                    "lines": added,
                },
            )
            return

        # status pipe for /map + fleet (maptrace-friendly JSONL)
        if path in ("/api/status/pipe", "/api/maptrace/cast"):
            try:
                body = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except json.JSONDecodeError:
                body = {}
            st = load_state()
            port = self.server.server_address[1]
            addrs = glyph_addresses(port)
            line = {
                "schema": "fc-cast-status-v1",
                "t": time.time(),
                "hub": addrs.get("hub"),
                "lan": addrs.get("lan"),
                "surface": body.get("surface") or st.get("surface"),
                "pose_seq": st.get("pose_seq"),
                "program": (st.get("news") or {}).get("program") or body.get("program"),
                "channels": body.get("channels"),
                "layout": body.get("layout") or (st.get("news") or {}).get("layout"),
                "audio": st.get("audio"),
                "vantage_user": (st.get("vantage") or {}).get("user"),
                "device": os.environ.get("LIVE_DEMUX_CAST_DEVICE", "Smart TV"),
            }
            try:
                STATUS_PIPE.parent.mkdir(parents=True, exist_ok=True)
                with STATUS_PIPE.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(line) + "\n")
                # keep maptrace hint copy (last-n friendly)
                MAPTRACE_HINT.parent.mkdir(parents=True, exist_ok=True)
                with MAPTRACE_HINT.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(line) + "\n")
            except Exception as e:
                self._json(500, {"ok": False, "error": str(e)})
                return
            self._json(200, {"ok": True, "pipe": str(STATUS_PIPE), "line": line})
            return

        # Phone control: soft-reload TV surface (DashCast page reloads)
        if path in ("/api/tv/reload", "/api/tv/refresh"):
            with _lock:
                st = load_state()
                cmd = dict(st.get("tv_cmd") or {})
                cmd["reload_token"] = int(cmd.get("reload_token") or 0) + 1
                cmd["last_error"] = None
                st["tv_cmd"] = cmd
                save_state(st)
            self._json(200, {"ok": True, "action": "reload", "tv_cmd": st["tv_cmd"]})
            return

        # Phone control: re-cast BOX URL via catt on the Mac
        if path in ("/api/tv/recast", "/api/tv/cast"):
            try:
                body = json.loads(raw.decode("utf-8") or "{}") if raw else {}
            except json.JSONDecodeError:
                body = {}
            device = body.get("device") or os.environ.get("LIVE_DEMUX_CAST_DEVICE", "Smart TV")
            port = int(os.environ.get("LIVE_DEMUX_CAST_PORT", "8765"))
            # discover LAN IP for cast URL
            lan = "127.0.0.1"
            try:
                import socket

                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                lan = s.getsockname()[0]
                s.close()
            except Exception:
                pass
            media = body.get("src") or "/media/zane-center.mp4"
            # allow full url override (news wall, box, etc.)
            tv_url = body.get("url") or f"http://{lan}:{port}/box?tv=1&src={media}"
            catt = os.path.expanduser("~/.local/bin/catt")
            if not os.path.isfile(catt):
                catt = "catt"
            err = None
            try:
                subprocess.run(
                    [catt, "-d", device, "stop"],
                    capture_output=True,
                    timeout=15,
                    check=False,
                )
                time.sleep(0.4)
                r = subprocess.run(
                    [catt, "-d", device, "cast_site", tv_url],
                    capture_output=True,
                    timeout=60,
                    check=False,
                    text=True,
                )
                if r.returncode != 0:
                    err = (r.stderr or r.stdout or f"exit {r.returncode}")[:400]
            except Exception as e:
                err = str(e)
            with _lock:
                st = load_state()
                cmd = dict(st.get("tv_cmd") or {})
                cmd["last_recast"] = time.time()
                cmd["last_error"] = err
                cmd["reload_token"] = int(cmd.get("reload_token") or 0) + 1
                cmd["last_url"] = tv_url
                st["tv_cmd"] = cmd
                save_state(st)
            self._json(
                200 if not err else 500,
                {
                    "ok": err is None,
                    "action": "recast",
                    "device": device,
                    "url": tv_url,
                    "error": err,
                    "tv_cmd": st.get("tv_cmd"),
                },
            )
            return

        if path != "/api/state":
            self._json(404, {"error": "not found"})
            return
        try:
            patch = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "bad json"})
            return
        with _lock:
            st = load_state()
            for k in (
                "cols",
                "rows",
                "w",
                "h",
                "labels",
                "safe",
                "selected",
                "focus",
                "title",
                "controller",
                "surface",
                "variation",
                "cam_map",
                "color_test",
                "tv_cmd",
                "news",
                "audio",
                "stream_policy",
            ):
                if k in patch:
                    st[k] = patch[k]
            bump = False
            if "viewer" in patch and isinstance(patch["viewer"], dict):
                v = dict(st.get("viewer") or DEFAULT_STATE["viewer"])
                v.update(patch["viewer"])
                v["t"] = time.time()
                st["viewer"] = v
                bump = True
            if "vantage" in patch and isinstance(patch["vantage"], dict):
                vt = dict(st.get("vantage") or DEFAULT_STATE["vantage"])
                # deep-merge users
                users = dict(vt.get("users") or {})
                if isinstance(patch["vantage"].get("users"), dict):
                    users.update(patch["vantage"]["users"])
                vt.update(patch["vantage"])
                vt["users"] = users
                st["vantage"] = vt
                bump = True
            # multi-device crazy cast: merge peer poses (you / partner / quest)
            if "crazy_peers" in patch and isinstance(patch["crazy_peers"], dict):
                peers = dict(st.get("crazy_peers") or {})
                for uid, pose in patch["crazy_peers"].items():
                    if isinstance(pose, dict):
                        prev = dict(peers.get(uid) or {})
                        prev.update(pose)
                        prev["t"] = time.time()
                        peers[str(uid)] = prev
                st["crazy_peers"] = peers
                bump = True
            # normalize selected to sorted unique ints
            try:
                sel = sorted({int(x) for x in (st.get("selected") or [])})
            except Exception:
                sel = []
            st["selected"] = sel
            # cam_map keys as strings
            if isinstance(st.get("cam_map"), dict):
                st["cam_map"] = {str(k): v for k, v in st["cam_map"].items()}
            save_state(st, bump_pose=bump)
            self._json(200, st)


def _maybe_ssl(httpd, port: int) -> bool:
    """TLS for phone PWA / getUserMedia (reuse Memory Glass still certs)."""
    import ssl

    cert_dirs = [
        Path.home() / ".panda/vision/certs",
        Path(os.environ.get("LIVE_DEMUX_CAST_CERT_DIR", "")) if os.environ.get("LIVE_DEMUX_CAST_CERT_DIR") else None,
        HERE / "certs",
    ]
    cert = key = None
    for d in cert_dirs:
        if not d:
            continue
        c, k = d / "still.crt", d / "still.key"
        if c.is_file() and k.is_file():
            cert, key = c, k
            break
        c2, k2 = d / "cast.crt", d / "cast.key"
        if c2.is_file() and k2.is_file():
            cert, key = c2, k2
            break
    if not cert or not key:
        # mint self-signed with LAN SAN (same as phone-tether)
        cert_dir = Path.home() / ".panda/vision/certs"
        cert_dir.mkdir(parents=True, exist_ok=True)
        cert, key = cert_dir / "still.crt", cert_dir / "still.key"
        if not (cert.is_file() and key.is_file()):
            lan = lan_ip()
            try:
                subprocess.run(
                    [
                        "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                        "-keyout", str(key), "-out", str(cert), "-days", "825",
                        "-subj", "/CN=GrokCast/O=fornevercollective/C=US",
                        "-addext", f"subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{lan}",
                    ],
                    check=True,
                    capture_output=True,
                )
                print(f"  minted cert SAN IP:{lan} → {cert}", flush=True)
            except Exception as e:
                print(f"  warn: no TLS certs ({e})", flush=True)
                return False
    try:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(cert), str(key))
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        print(f"align-hub HTTPS https://0.0.0.0:{port}/  cert={cert}", flush=True)
        return True
    except Exception as e:
        print(f"  warn: TLS wrap failed: {e}", flush=True)
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bind", default=os.environ.get("LIVE_DEMUX_CAST_BIND", "0.0.0.0"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("LIVE_DEMUX_CAST_PORT", "8765")))
    ap.add_argument(
        "--https-port",
        type=int,
        default=int(os.environ.get("LIVE_DEMUX_CAST_HTTPS_PORT", "8766")),
        help="HTTPS for phone PWA (0=disable). TV DashCast stays on --port HTTP.",
    )
    args = ap.parse_args()

    # seed state file
    with _lock:
        st = load_state()
        if not st.get("updated"):
            save_state(st)

    httpd = ThreadingHTTPServer((args.bind, args.port), Handler)
    lan = lan_ip()
    print(f"align-hub · http://{args.bind}:{args.port}/", flush=True)
    print(f"  tv (DashCast):  http://{lan}:{args.port}/news?tv=1", flush=True)
    print(f"  state:          {STATE_PATH}", flush=True)

    # HTTPS thread for phone PWA / secure QR
    if args.https_port and args.https_port > 0:
        httpsd = ThreadingHTTPServer((args.bind, args.https_port), Handler)
        if _maybe_ssl(httpsd, args.https_port):
            print(f"  phone PWA:      https://{lan}:{args.https_port}/box?pwa=1", flush=True)
            print(f"  setup/trust:    https://{lan}:{args.https_port}/setup.html", flush=True)
            print(f"  QR encodes HTTPS control (not plain http)", flush=True)
            threading.Thread(target=httpsd.serve_forever, daemon=True, name="cast-https").start()
        else:
            print("  warn: HTTPS disabled — phone will not get secure context", flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstop", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
