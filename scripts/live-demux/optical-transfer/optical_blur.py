#!/usr/bin/env python3
"""fc-optical-blur — jawta light + Decimen fountain + glyph embed optical tool.

Modes (TX are screen→camera light paths; no network between devices):

  blur     Optical blur tool (default): soft field + temporal OOK + corner glyph/QR
  light    Jawta full-screen light pulse (morse / pulse library)
  qr       Fountain-coded binary frames as QR (browser preferred) / glyph modules
  glyph    Pure glyph-grid fountain embed
  rx       Receive: luminance OOK and/or glyph frame peel
  serve    HTTPS-friendly static server for send.html / receive.html
  test     Round-trip fountain unit check

Jawta optical TX concept: https://mueee.qbitos.ai/jawta-audio.html
  Light Pulse · dit/dah · pulse library · air-gap light beam

Decimen: https://github.com/bashalarmistalt/decimen-optical-transfer
  Luby transform fountain · self-describing frames · any-order peel

Usage:
  python3 optical_blur.py blur --text 'hello from light'
  python3 optical_blur.py light --pulse timesync --wpm 20
  python3 optical_blur.py light --text 'CQ CQ DE FC' --fullscreen
  python3 optical_blur.py qr --file ./note.bin --block 200
  python3 optical_blur.py glyph --file ./note.bin
  python3 optical_blur.py rx --mode light
  python3 optical_blur.py serve --port 8767
  python3 optical_blur.py test
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import os
import random
import socket
import struct
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from protocol import (  # noqa: E402
    HEADER_LEN,
    LTDecoder,
    LTEncoder,
    PULSE_LIBRARY,
    resolve_pulse,
    timesync_pulse_text,
    bytes_to_ook_bits,
    dit_ms,
    fnv1a,
    morse_timeline,
    pack_frame,
    parse_frame,
    text_to_morse,
)

PIPE_DIR = Path(
    os.environ.get(
        "LIVE_DEMUX_OPTICAL_DIR",
        Path.home() / ".panda/vision/cast",
    )
)
PIPE = PIPE_DIR / "optical-pipe.jsonl"
STATE = PIPE_DIR / "optical-state.json"


def log_event(ev: dict) -> None:
    PIPE_DIR.mkdir(parents=True, exist_ok=True)
    ev = dict(ev)
    ev.setdefault("t", time.time())
    ev.setdefault("schema", "fc-optical-transfer-v1")
    line = json.dumps(ev, separators=(",", ":"))
    with PIPE.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    try:
        STATE.write_text(json.dumps(ev, indent=2) + "\n", encoding="utf-8")
    except OSError:
        pass
    print(f"[optical] {ev.get('kind', '?')} · {ev.get('msg', '')}", flush=True)


# ── Glyph grid encode (stdlib, no QR lib required) ──────────────────────

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def glyph_modules(payload: bytes, n: int = 29) -> List[List[int]]:
    """Pack bytes into n×n modules with finder corners (human + machine)."""
    n = max(15, n | 1)  # odd
    grid = [[0] * n for _ in range(n)]
    # finder 7×7 at corners
    def place_finder(r0: int, c0: int) -> None:
        for r in range(7):
            for c in range(7):
                edge = r in (0, 6) or c in (0, 6)
                inner = 2 <= r <= 4 and 2 <= c <= 4
                grid[r0 + r][c0 + c] = 1 if (edge or inner) else 0

    place_finder(0, 0)
    place_finder(0, n - 7)
    place_finder(n - 7, 0)
    # timing rings
    for i in range(n):
        grid[6][i] = i & 1
        grid[i][6] = i & 1
    # data bits row-major, skip reserved
    reserved = set()
    for r in range(7):
        for c in range(7):
            reserved.add((r, c))
            reserved.add((r, n - 7 + c))
            reserved.add((n - 7 + r, c))
    for i in range(n):
        reserved.add((6, i))
        reserved.add((i, 6))
    bits: List[int] = []
    # length prefix + data
    ln = len(payload)
    bits.extend([(ln >> (8 * (1 - i))) & 1 for i in range(2) for _ in [0]])  # placeholder
    bits = []
    for b in struct.pack(">H", min(ln, 0xFFFF)) + payload:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    bi = 0
    for r in range(n):
        for c in range(n):
            if (r, c) in reserved:
                continue
            grid[r][c] = bits[bi] if bi < len(bits) else 0
            bi += 1
    return grid


def render_glyph_ppm(grid: List[List[int]], cell: int = 12, margin: int = 2) -> bytes:
    n = len(grid)
    w = (n + 2 * margin) * cell
    h = w
    rows = []
    for y in range(h):
        gy = y // cell - margin
        row = bytearray()
        for x in range(w):
            gx = x // cell - margin
            if 0 <= gx < n and 0 <= gy < n:
                v = 0 if grid[gy][gx] else 255
            else:
                v = 255
            row.extend((v, v, v))
        rows.append(bytes(row))
    header = f"P6\n{w} {h}\n255\n".encode("ascii")
    return header + b"".join(rows)


def soft_blur_field_ppm(
    w: int,
    h: int,
    t: float,
    on: float = 0.0,
    seed: int = 1,
) -> bytes:
    """Soft optical blur field with optional global luminance lift (jawta OOK).

    Humans see a soft defocused gradient; cameras see mean luminance shifts.
    """
    rnd = random.Random(seed)
    # precompute a few soft blobs
    blobs = [
        (rnd.random(), rnd.random(), 0.15 + 0.25 * rnd.random(), 0.3 + 0.5 * rnd.random())
        for _ in range(7)
    ]
    rows = []
    # slow drift
    drift = 0.08 * math.sin(t * 0.7)
    base = 48 + 40 * on  # idle dim · on lifts whole field (optical blur pulse)
    for y in range(h):
        row = bytearray()
        v = y / max(1, h - 1)
        for x in range(w):
            u = x / max(1, w - 1)
            lum = base
            for bx, by, br, amp in blobs:
                dx = u - (bx + drift)
                dy = v - by
                g = math.exp(-(dx * dx + dy * dy) / (2 * br * br))
                lum += 90 * amp * g
            # gentle chromatic-ish split without numpy
            r = int(min(255, max(0, lum + 8 * math.sin(u * 6 + t))))
            g = int(min(255, max(0, lum)))
            b = int(min(255, max(0, lum + 12 * math.cos(v * 5 - t))))
            # soft vignette
            cx, cy = u - 0.5, v - 0.5
            vig = 1.0 - 0.35 * (cx * cx + cy * cy) * 4
            r = int(r * vig)
            g = int(g * vig)
            b = int(b * vig)
            row.extend((r, g, b))
        rows.append(bytes(row))
    header = f"P6\n{w} {h}\n255\n".encode("ascii")
    return header + b"".join(rows)


def write_ppm(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def try_ffplay(path: Path, title: str = "optical-blur") -> Optional[int]:
    import subprocess

    ffplay = shutil_which("ffplay")
    if not ffplay:
        return None
    env = os.environ.copy()
    cmd = [
        ffplay,
        "-hide_banner",
        "-loglevel",
        "error",
        "-window_title",
        title,
        "-loop",
        "0",
        str(path),
    ]
    try:
        p = subprocess.Popen(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return p.pid
    except OSError:
        return None


def shutil_which(cmd: str) -> Optional[str]:
    from shutil import which

    return which(cmd)


# ── TX: jawta light (fullscreen HTML flash or PPM pulse train) ──────────

def cmd_light(args: argparse.Namespace) -> int:
    text = args.text
    if args.pulse:
        text = resolve_pulse(args.pulse)
    elif not text:
        # default feed = timesync (replaces legacy SOS default)
        text = timesync_pulse_text()
    if not text:
        print("need --text or --pulse", file=sys.stderr)
        return 2
    morse = text_to_morse(text)
    events = morse_timeline(morse, args.wpm)
    log_event(
        {
            "kind": "tx-light",
            "msg": f"jawta light · {text!r} · wpm={args.wpm}",
            "morse": morse,
            "events": len(events),
            "mode": "light",
        }
    )
    # Prefer HTML fullscreen flash (accurate + castable)
    html = HERE / "light-tx.html"
    if html.is_file() and not args.ppm_only:
        q = f"?text={_urlquote(text)}&wpm={args.wpm}&loop={1 if args.loop else 0}"
        if args.serve_inline:
            return _serve_and_open(f"/light-tx.html{q}", args.port)
        # file:// may block; write a one-shot state for the page
        state = {
            "text": text,
            "wpm": args.wpm,
            "loop": bool(args.loop),
            "morse": morse,
            "t": time.time(),
        }
        (PIPE_DIR / "jawta-light-tx.json").write_text(
            json.dumps(state, indent=2), encoding="utf-8"
        )
        print(f"morse: {morse}")
        print(f"open:  file://{html}  (or: python3 optical_blur.py serve --port {args.port})")
        print(f"then:  http://127.0.0.1:{args.port}/light-tx.html{q}")
        if args.open:
            webbrowser.open(f"file://{html}{q}")
        if not args.ppm_only:
            # also emit PPM pulse train for headless / cast still path
            return _ppm_pulse_train(events, args, title=f"jawta-light · {text}")
    return _ppm_pulse_train(events, args, title=f"jawta-light · {text}")


def _urlquote(s: str) -> str:
    from urllib.parse import quote

    return quote(s, safe="")


def _ppm_pulse_train(
    events: List[tuple[float, float, int]],
    args: argparse.Namespace,
    title: str,
) -> int:
    """Render ON/OFF frames for jawta light into cast dir + optional ffplay."""
    out_on = PIPE_DIR / "optical-light-on.ppm"
    out_off = PIPE_DIR / "optical-light-off.ppm"
    out_cur = PIPE_DIR / "optical-light.ppm"
    w, h = args.width, args.height
    # bright / dark full fields
    on = soft_blur_field_ppm(w, h, t=0.0, on=1.0, seed=2)
    off = soft_blur_field_ppm(w, h, t=0.0, on=0.0, seed=2)
    write_ppm(out_on, on)
    write_ppm(out_off, off)
    write_ppm(out_cur, off)
    pid = try_ffplay(out_cur, title=title) if args.ffplay else None
    t0 = time.time()
    # scale event times (events in ms from 0)
    scale = 1.0
    total_ms = (events[-1][0] + events[-1][1]) if events else 0
    print(f"jawta light pulse · {len(events)} marks · {total_ms/1000:.2f}s · ppm {out_cur}")
    if pid:
        print(f"ffplay pid {pid}")
    try:
        for start, dur, _on in events:
            # wait until start
            while (time.time() - t0) * 1000 < start * scale:
                time.sleep(0.002)
            write_ppm(out_cur, on)
            time.sleep(max(0.001, dur / 1000.0 * scale))
            write_ppm(out_cur, off)
        if args.loop:
            return _ppm_pulse_train(events, args, title=title)
    except KeyboardInterrupt:
        print("stop")
    log_event({"kind": "tx-light-done", "msg": "pulse train finished", "pid": pid})
    return 0


# ── TX: optical blur (default tool) ─────────────────────────────────────

def cmd_blur(args: argparse.Namespace) -> int:
    """Soft optical blur field + jawta temporal OOK + corner glyph modules.

    This is the combined 'optical blur tool':
      - human sees bokeh/defocus gradients (aesthetic blur)
      - camera sees mean-luminance OOK (jawta light) and/or corner glyph payload
    """
    text = args.text or "FC OPTICAL BLUR"
    if args.pulse:
        text = resolve_pulse(args.pulse)
    payload = text.encode("utf-8")
    if args.file:
        payload = Path(args.file).read_bytes()
        text = f"file:{args.file}"

    morse = text_to_morse(text if len(payload) < 80 else "DATA")
    events = morse_timeline(morse, args.wpm)

    # fountain for larger payloads as glyph frames
    session = random.randint(1, 0xFFFE)
    block_len = args.block
    enc = LTEncoder(payload, block_len=block_len, session_id=session)

    log_event(
        {
            "kind": "tx-blur",
            "msg": f"optical blur · {len(payload)} B · k={enc.k} · wpm={args.wpm}",
            "session": session,
            "k": enc.k,
            "blockLen": block_len,
            "totalLen": enc.total_len,
            "fnv": enc.payload_fnv,
            "mode": "blur",
        }
    )

    # Prefer browser UI
    if not args.ppm_only and (HERE / "send.html").is_file():
        print("optical blur tool")
        print(f"  payload {len(payload)} B · session {session} · k={enc.k}")
        print(f"  serve: python3 {HERE/'optical_blur.py'} serve --port {args.port}")
        print(f"  open:  http://127.0.0.1:{args.port}/send.html?mode=blur")
        print(f"  pipe:  {PIPE}")
        # write payload for the page
        b64 = base64.b64encode(payload).decode("ascii")
        (PIPE_DIR / "optical-tx-payload.json").write_text(
            json.dumps(
                {
                    "mode": "blur",
                    "text": text if len(text) < 200 else text[:200],
                    "b64": b64,
                    "session": session,
                    "blockLen": block_len,
                    "wpm": args.wpm,
                    "fnv": enc.payload_fnv,
                    "k": enc.k,
                    "totalLen": enc.total_len,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        if args.open or args.serve_inline:
            return _serve_and_open(f"/send.html?mode=blur&wpm={args.wpm}", args.port)

    # PPM path: blur field + corner glyph + temporal OOK
    w, h = args.width, args.height
    corner_n = args.glyph_n
    out = PIPE_DIR / "optical-blur.ppm"
    t0 = time.time()
    seq = 0
    print(f"blur TX · ppm {out} · Ctrl+C stop")
    pid = None
    try:
        while True:
            now = time.time() - t0
            # jawta OOK level from repeating morse timeline
            on_level = 0.0
            if events:
                cycle = (events[-1][0] + events[-1][1]) / 1000.0
                if cycle > 0:
                    mt = (now % cycle) * 1000.0
                    for start, dur, _ in events:
                        if start <= mt < start + dur:
                            on_level = 1.0
                            break
            field = soft_blur_field_ppm(w, h, t=now, on=on_level * 0.85, seed=3)
            # stamp corner glyph with fountain frame
            frame = enc.pack(seq)
            grid = glyph_modules(frame, n=corner_n)
            cell = max(4, min(w, h) // (corner_n + 8))
            glyph_ppm = render_glyph_ppm(grid, cell=cell, margin=1)
            # composite glyph into bottom-right of field (manual PPM stitch)
            field = _composite_ppm_br(field, glyph_ppm, w, h)
            write_ppm(out, field)
            if pid is None and args.ffplay:
                pid = try_ffplay(out, title="optical-blur · jawta+glyph")
                if pid:
                    print(f"ffplay pid {pid}")
            if seq % 24 == 0:
                log_event(
                    {
                        "kind": "tx-blur-frame",
                        "msg": f"seq={seq} on={on_level:.0f}",
                        "seq": seq,
                        "session": session,
                    }
                )
            seq += 1
            time.sleep(1.0 / max(1.0, args.fps))
            if not args.loop and seq > enc.k * 3:
                # enough overshoot for fountain
                if seq > enc.k * 4:
                    break
    except KeyboardInterrupt:
        print("stop")
    log_event({"kind": "tx-blur-done", "msg": f"seq={seq}", "seq": seq, "session": session})
    return 0


def _composite_ppm_br(base: bytes, overlay: bytes, bw: int, bh: int) -> bytes:
    """Paste overlay PPM into bottom-right of base PPM (both P6)."""
    def parse(ppm: bytes):
        if not ppm.startswith(b"P6"):
            raise ValueError("not P6")
        i = 2
        while i < len(ppm) and ppm[i] in b" \t\r\n":
            i += 1
        # skip comments
        while i < len(ppm) and ppm[i] == ord("#"):
            while i < len(ppm) and ppm[i] not in b"\n":
                i += 1
            i += 1
        parts = []
        while len(parts) < 3 and i < len(ppm):
            while i < len(ppm) and ppm[i] in b" \t\r\n":
                i += 1
            j = i
            while j < len(ppm) and ppm[j] not in b" \t\r\n":
                j += 1
            parts.append(ppm[i:j])
            i = j
        w, h, _mx = int(parts[0]), int(parts[1]), int(parts[2])
        while i < len(ppm) and ppm[i] in b" \t\r\n":
            i += 1
        return w, h, bytearray(ppm[i : i + w * h * 3])

    bw2, bh2, bpx = parse(base)
    ow, oh, opx = parse(overlay)
    x0 = max(0, bw2 - ow - 8)
    y0 = max(0, bh2 - oh - 8)
    for y in range(oh):
        if y0 + y >= bh2:
            break
        for x in range(ow):
            if x0 + x >= bw2:
                break
            bi = ((y0 + y) * bw2 + (x0 + x)) * 3
            oi = (y * ow + x) * 3
            bpx[bi : bi + 3] = opx[oi : oi + 3]
    header = f"P6\n{bw2} {bh2}\n255\n".encode("ascii")
    return header + bytes(bpx)


# ── TX: glyph fountain only ─────────────────────────────────────────────

def cmd_glyph(args: argparse.Namespace) -> int:
    payload = (args.text or "glyph").encode("utf-8")
    if args.file:
        payload = Path(args.file).read_bytes()
    session = random.randint(1, 0xFFFE)
    enc = LTEncoder(payload, block_len=args.block, session_id=session)
    out = PIPE_DIR / "optical-glyph.ppm"
    log_event(
        {
            "kind": "tx-glyph",
            "msg": f"glyph fountain · k={enc.k} · {len(payload)} B",
            "session": session,
            "k": enc.k,
        }
    )
    seq = 0
    pid = None
    try:
        while True:
            frame = enc.pack(seq)
            grid = glyph_modules(frame, n=args.glyph_n)
            write_ppm(out, render_glyph_ppm(grid, cell=args.cell))
            if pid is None and args.ffplay:
                pid = try_ffplay(out, title="optical-glyph")
            seq += 1
            time.sleep(1.0 / max(1.0, args.fps))
            if not args.loop and seq > enc.k * 3:
                break
    except KeyboardInterrupt:
        print("stop")
    return 0


def cmd_qr(args: argparse.Namespace) -> int:
    """QR fountain — browser path; glyph fallback encodes same protocol bytes."""
    print("QR fountain: use browser send.html (node-qrcode/zxing on RX).")
    print("Same payload also streams as glyph modules (stdlib fallback).")
    args.mode = "qr"
    return cmd_glyph(args)


# ── RX: luminance OOK (simple) ──────────────────────────────────────────

def cmd_rx(args: argparse.Namespace) -> int:
    """Receive from still pipe or webcam luminance.

    light mode: threshold mean luminance of LIVE_DEMUX still / optical-blur.ppm
    glyph mode: peel LT frames from optical-glyph.ppm (manual / external decoder)
    """
    mode = args.mode
    log_event({"kind": "rx-start", "msg": f"rx mode={mode}", "mode": mode})
    if mode == "light":
        return _rx_light(args)
    if mode in ("glyph", "blur", "qr"):
        print("glyph/QR peel: open receive.html or feed frames into LTDecoder via --import")
        if args.import_frames:
            return _rx_import(args)
        print(f"  browser: python3 optical_blur.py serve --port {args.port}")
        print(f"  open:    http://127.0.0.1:{args.port}/receive.html")
        if args.open or args.serve_inline:
            return _serve_and_open("/receive.html", args.port)
        return 0
    print(f"unknown rx mode {mode}", file=sys.stderr)
    return 2


def _rx_light(args: argparse.Namespace) -> int:
    """Sample mean luminance of optical-blur.ppm / still as OOK bitstream → morse-ish."""
    src = Path(
        args.source
        or os.environ.get("LIVE_DEMUX_OPTICAL_RX", PIPE_DIR / "optical-blur.ppm")
    )
    print(f"rx light · watching {src} · Ctrl+C stop")
    last = None
    bits: List[int] = []
    dit = dit_ms(args.wpm) / 1000.0
    sample = max(0.01, dit / 3)
    high_run = 0.0
    low_run = 0.0
    state = 0
    try:
        while True:
            if not src.is_file():
                time.sleep(0.05)
                continue
            data = src.read_bytes()
            mean = _ppm_mean(data)
            on = 1 if mean > args.threshold else 0
            if last is None:
                last = on
            if on == state:
                if on:
                    high_run += sample
                else:
                    low_run += sample
            else:
                # edge
                if state == 1:
                    # ended mark
                    if high_run < dit * 2:
                        bits.append(0)  # dit → mark as 0 for debug
                        sys.stdout.write(".")
                    else:
                        bits.append(1)
                        sys.stdout.write("-")
                    sys.stdout.flush()
                high_run = 0.0
                low_run = 0.0
                state = on
            last = on
            time.sleep(sample)
    except KeyboardInterrupt:
        print("\nstop")
    log_event({"kind": "rx-light-done", "msg": f"bits={len(bits)}", "bits": len(bits)})
    return 0


def _ppm_mean(ppm: bytes) -> float:
    if not ppm.startswith(b"P6"):
        return 0.0
    # find pixel start
    i = 2
    parts = []
    while len(parts) < 3 and i < len(ppm):
        while i < len(ppm) and ppm[i] in b" \t\r\n":
            i += 1
        if i < len(ppm) and ppm[i] == ord("#"):
            while i < len(ppm) and ppm[i] not in b"\n":
                i += 1
            continue
        j = i
        while j < len(ppm) and ppm[j] not in b" \t\r\n":
            j += 1
        parts.append(ppm[i:j])
        i = j
    while i < len(ppm) and ppm[i] in b" \t\r\n":
        i += 1
    pix = ppm[i:]
    if not pix:
        return 0.0
    # sample every 32nd pixel for speed
    s = 0
    n = 0
    for k in range(0, len(pix) - 2, 96):
        s += pix[k] + pix[k + 1] + pix[k + 2]
        n += 3
    return (s / n) if n else 0.0


def _rx_import(args: argparse.Namespace) -> int:
    """Import base64 frames from JSONL and peel."""
    path = Path(args.import_frames)
    dec: Optional[LTDecoder] = None
    expect_fnv = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        raw = base64.b64decode(obj["b64"])
        parsed = parse_frame(raw)
        if not parsed:
            continue
        h, block = parsed
        if dec is None:
            dec = LTDecoder(h["k"], h["blockLen"], h["sessionId"], h["totalLen"])
            expect_fnv = h["payloadFnv"]
        elif h["sessionId"] != dec.session_id:
            dec = LTDecoder(h["k"], h["blockLen"], h["sessionId"], h["totalLen"])
            expect_fnv = h["payloadFnv"]
        dec.add_frame(h["seq"], block)
        print(
            f"\r frames={dec.frames_new} solved={dec.solved_count}/{dec.k}",
            end="",
            flush=True,
        )
        if dec.is_complete:
            data = dec.assemble()
            print()
            if data is None:
                return 1
            ok = fnv1a(data) == expect_fnv
            out = Path(args.out or (PIPE_DIR / "optical-rx.bin"))
            out.write_bytes(data)
            log_event(
                {
                    "kind": "rx-complete",
                    "msg": f"ok={ok} · {len(data)} B → {out}",
                    "fnv_ok": ok,
                    "bytes": len(data),
                }
            )
            print(f"complete · fnv_ok={ok} · wrote {out}")
            return 0 if ok else 1
    print("\nincomplete")
    return 1


# ── serve browser pages ─────────────────────────────────────────────────

def cmd_serve(args: argparse.Namespace) -> int:
    return _serve_and_open(args.path or "/send.html", args.port, open_browser=args.open)


def _serve_and_open(path: str, port: int, open_browser: bool = True) -> int:
    os.chdir(HERE)

    class H(SimpleHTTPRequestHandler):
        def log_message(self, fmt, *a):
            print(f"[http] {self.address_string()} {fmt % a}")

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()

        def do_GET(self):
            u = urlparse(self.path)
            if u.path == "/api/payload":
                p = PIPE_DIR / "optical-tx-payload.json"
                body = p.read_bytes() if p.is_file() else b"{}"
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if u.path == "/api/state":
                p = STATE if STATE.is_file() else None
                body = p.read_bytes() if p else b"{}"
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(body)
                return
            if u.path.startswith("/qrcode"):
                # reuse cast-align qrcode if present
                alt = HERE.parent / "cast-align" / "qrcode-generator.js"
                if alt.is_file():
                    data = alt.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
            return SimpleHTTPRequestHandler.do_GET(self)

    host = "0.0.0.0"
    httpd = ThreadingHTTPServer((host, port), H)
    lan = _lan_ip()
    print(f"optical-transfer serve · http://127.0.0.1:{port}/")
    print(f"  LAN: http://{lan}:{port}/")
    print(f"  TX:  http://127.0.0.1:{port}/send.html?mode=blur")
    print(f"  RX:  http://{lan}:{port}/receive.html")
    print(f"  light: http://127.0.0.1:{port}/light-tx.html")
    log_event({"kind": "serve", "msg": f"port {port}", "port": port, "lan": lan})
    if open_browser:
        webbrowser.open(f"http://127.0.0.1:{port}{path}")

    def _run():
        httpd.serve_forever()

    th = threading.Thread(target=_run, daemon=True)
    th.start()
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("stop serve")
        httpd.shutdown()
    return 0


def _lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def cmd_test(_args: argparse.Namespace) -> int:
    payload = b"fc-optical-blur / jawta + decimen / " + os.urandom(200)
    enc = LTEncoder(payload, block_len=64, session_id=0xBEEF)
    dec = LTDecoder(enc.k, enc.block_len, enc.session_id, enc.total_len)
    # Stream until peel completes (LT needs degree-1 seeds; small-k needs overhead).
    for seq in range(0, max(64, enc.k * 16)):
        if random.random() < 0.12:
            continue  # drop — fountain absorbs erasures
        raw = enc.pack(seq)
        parsed = parse_frame(raw)
        assert parsed
        h, block = parsed
        dec.add_frame(h["seq"], block)
        if dec.is_complete:
            break
    out = dec.assemble()
    ok = out == payload and fnv1a(out) == enc.payload_fnv
    print(f"fountain test · k={enc.k} frames_new={dec.frames_new} ok={ok}")
    # morse
    m = text_to_morse("SOS")
    assert "..." in m
    print(f"morse SOS → {m}")
    log_event({"kind": "test", "msg": f"ok={ok}", "ok": ok})
    return 0 if ok else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="optical_blur",
        description="Optical blur / jawta light / Decimen fountain transfer tool",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_common(sp):
        sp.add_argument("--text", default="")
        sp.add_argument("--file", default="")
        sp.add_argument("--pulse", default="", help="jawta pulse library key")
        sp.add_argument("--wpm", type=float, default=15.0)
        sp.add_argument("--fps", type=float, default=12.0)
        sp.add_argument("--block", type=int, default=200)
        sp.add_argument("--glyph-n", type=int, default=29)
        sp.add_argument("--cell", type=int, default=10)
        sp.add_argument("--width", type=int, default=640)
        sp.add_argument("--height", type=int, default=480)
        sp.add_argument("--loop", action="store_true")
        sp.add_argument("--ffplay", action="store_true", default=True)
        sp.add_argument("--no-ffplay", action="store_false", dest="ffplay")
        sp.add_argument("--ppm-only", action="store_true")
        sp.add_argument("--open", action="store_true")
        sp.add_argument("--serve-inline", action="store_true")
        sp.add_argument("--port", type=int, default=8767)
        sp.add_argument("--fullscreen", action="store_true")

    for name in ("blur", "light", "qr", "glyph"):
        sp = sub.add_parser(name)
        add_common(sp)

    sp = sub.add_parser("rx")
    add_common(sp)
    sp.add_argument("--mode", default="light", choices=["light", "glyph", "blur", "qr"])
    sp.add_argument("--source", default="")
    sp.add_argument("--threshold", type=float, default=90.0)
    sp.add_argument("--import-frames", default="")
    sp.add_argument("--out", default="")

    sp = sub.add_parser("serve")
    sp.add_argument("--port", type=int, default=8767)
    sp.add_argument("--open", action="store_true", default=True)
    sp.add_argument("--path", default="/send.html")

    sub.add_parser("test")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    cmd = args.cmd
    if cmd == "blur":
        return cmd_blur(args)
    if cmd == "light":
        return cmd_light(args)
    if cmd == "glyph":
        return cmd_glyph(args)
    if cmd == "qr":
        return cmd_qr(args)
    if cmd == "rx":
        return cmd_rx(args)
    if cmd == "serve":
        return cmd_serve(args)
    if cmd == "test":
        return cmd_test(args)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
