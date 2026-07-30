#!/usr/bin/env python3
"""Generate a numbered pixel-alignment chart for TV cast walls.

Outputs:
  align-chart.png   — full-frame grid with numbers, rulers, safe area
  align-layout.json — cell geometry for placement recipes
  align-selected.json (optional) — subset of cells if --select given

Usage:
  python3 gen-align.py --w 1920 --h 1080 --cols 8 --rows 4 -o ~/.panda/vision/cast
  python3 gen-align.py --cols 6 --rows 4 --select 1,2,5-7,A3 --labels chess
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("error: need Pillow  (pip install pillow)", file=sys.stderr)
    sys.exit(1)


# High-contrast TV-safe palette (Rec.709-ish SDR)
BG = (12, 14, 20)
GRID = (48, 56, 72)
GRID_MAJOR = (90, 100, 120)
SAFE = (40, 180, 120)
SAFE_DIM = (28, 90, 70)
RULER = (200, 210, 220)
NUM = (240, 244, 250)
NUM_SEL = (20, 20, 24)
CROSS = (255, 200, 60)
CORNER = (255, 80, 80)
CELL_A = (28, 36, 52)
CELL_B = (18, 22, 34)
SEL_FILL = (80, 200, 255)
SEL_EDGE = (255, 220, 80)


def parse_select(spec: str, cols: int, rows: int, labels: str) -> set[int]:
    """Parse '1,2,5-7,A3,r2c4' into 1-based cell indices (row-major)."""
    if not spec or not spec.strip():
        return set()
    out: set[int] = set()
    total = cols * rows
    for part in re.split(r"[\s,;]+", spec.strip()):
        if not part:
            continue
        # range 5-12
        m = re.fullmatch(r"(\d+)\s*-\s*(\d+)", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            for n in range(min(a, b), max(a, b) + 1):
                if 1 <= n <= total:
                    out.add(n)
            continue
        # chess A1 / a1 (col letter, row number 1-based from top) — always accepted
        m = re.fullmatch(r"([A-Za-z]+)(\d+)", part)
        if m:
            col = 0
            for ch in m.group(1).upper():
                col = col * 26 + (ord(ch) - ord("A") + 1)
            col -= 1
            row = int(m.group(2)) - 1
            if 0 <= col < cols and 0 <= row < rows:
                out.add(row * cols + col + 1)
            continue
        # r2c3
        m = re.fullmatch(r"[rR](\d+)[cC](\d+)", part)
        if m:
            row, col = int(m.group(1)) - 1, int(m.group(2)) - 1
            if 0 <= col < cols and 0 <= row < rows:
                out.add(row * cols + col + 1)
            continue
        # plain number
        if part.isdigit():
            n = int(part)
            if 1 <= n <= total:
                out.add(n)
            continue
        print(f"warn: ignore select token {part!r}", file=sys.stderr)
    return out


def col_letter(i: int) -> str:
    """0-based col → A, B, … Z, AA…"""
    s = ""
    n = i + 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def cell_label(idx: int, col: int, row: int, mode: str) -> str:
    """idx is 1-based."""
    if mode == "chess":
        return f"{col_letter(col)}{row + 1}"
    if mode == "rc":
        return f"r{row + 1}c{col + 1}"
    if mode == "both":
        return f"{idx}\n{col_letter(col)}{row + 1}"
    return str(idx)


def try_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for p in candidates:
        if os.path.isfile(p):
            try:
                return ImageFont.truetype(p, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_ruler(draw: ImageDraw.ImageDraw, w: int, h: int, margin: int, font) -> None:
    # top + left pixel rulers
    step_minor, step_major = 20, 100
    for x in range(0, w, step_minor):
        ln = 8 if x % step_major else 16
        draw.line([(x, 0), (x, ln)], fill=RULER, width=1)
        if x % step_major == 0 and x > 0:
            draw.text((x + 2, ln + 1), str(x), fill=RULER, font=font)
    for y in range(0, h, step_minor):
        ln = 8 if y % step_major else 16
        draw.line([(0, y), (ln, y)], fill=RULER, width=1)
        if y % step_major == 0 and y > 0:
            draw.text((ln + 2, y - 6), str(y), fill=RULER, font=font)
    # bottom / right tick marks
    for x in range(0, w, step_major):
        draw.line([(x, h - 1), (x, h - 12)], fill=RULER, width=1)
    for y in range(0, h, step_major):
        draw.line([(w - 1, y), (w - 12, y)], fill=RULER, width=1)


def generate(
    w: int,
    h: int,
    cols: int,
    rows: int,
    labels: str,
    selected: set[int],
    safe_pct: float,
    title: str,
) -> tuple[Image.Image, dict]:
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)

    # margins for rulers (outer gutter)
    gutter = max(28, min(w, h) // 40)
    # usable grid area (inside gutter)
    gx0, gy0 = gutter, gutter
    gx1, gy1 = w - gutter, h - gutter
    gw, gh = gx1 - gx0, gy1 - gy0
    cw, ch = gw / cols, gh / rows

    # font sizes scale with cell
    num_size = max(18, int(min(cw, ch) * 0.28))
    small_size = max(12, int(min(cw, ch) * 0.12))
    font_num = try_font(num_size)
    font_small = try_font(small_size)
    font_tiny = try_font(max(11, small_size - 2))

    cells = []
    for r in range(rows):
        for c in range(cols):
            idx = r * cols + c + 1
            x0 = gx0 + c * cw
            y0 = gy0 + r * ch
            x1 = gx0 + (c + 1) * cw
            y1 = gy0 + (r + 1) * ch
            # checkerboard base
            base = CELL_A if (r + c) % 2 == 0 else CELL_B
            if idx in selected:
                # tint selection
                base = tuple(min(255, int(base[i] * 0.45 + SEL_FILL[i] * 0.55)) for i in range(3))
            draw.rectangle([x0, y0, x1 - 1, y1 - 1], fill=base)

            label = cell_label(idx, c, r, labels)
            # center text
            bbox = draw.multiline_textbbox((0, 0), label, font=font_num, align="center")
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            tx = x0 + (cw - tw) / 2
            ty = y0 + (ch - th) / 2 - 2
            fill = NUM_SEL if idx in selected else NUM
            draw.multiline_text((tx, ty), label, fill=fill, font=font_num, align="center")

            # pixel coords corner
            coord = f"{int(x0)},{int(y0)}"
            draw.text((x0 + 4, y0 + 3), coord, fill=GRID_MAJOR, font=font_tiny)
            # size tag bottom-right
            sz = f"{int(cw)}×{int(ch)}"
            sb = draw.textbbox((0, 0), sz, font=font_tiny)
            draw.text((x1 - (sb[2] - sb[0]) - 6, y1 - (sb[3] - sb[1]) - 6), sz, fill=GRID_MAJOR, font=font_tiny)

            cells.append(
                {
                    "n": idx,
                    "label": label.replace("\n", " "),
                    "row": r + 1,
                    "col": c + 1,
                    "chess": f"{col_letter(c)}{r + 1}",
                    "x": int(round(x0)),
                    "y": int(round(y0)),
                    "w": int(round(cw)),
                    "h": int(round(ch)),
                    "cx": int(round(x0 + cw / 2)),
                    "cy": int(round(y0 + ch / 2)),
                    "selected": idx in selected,
                }
            )

    # grid lines
    for c in range(cols + 1):
        x = gx0 + c * cw
        draw.line([(x, gy0), (x, gy1)], fill=GRID_MAJOR if c % 2 == 0 else GRID, width=2 if c % 2 == 0 else 1)
    for r in range(rows + 1):
        y = gy0 + r * ch
        draw.line([(gx0, y), (gx1, y)], fill=GRID_MAJOR if r % 2 == 0 else GRID, width=2 if r % 2 == 0 else 1)

    # selection outlines
    for cell in cells:
        if not cell["selected"]:
            continue
        draw.rectangle(
            [cell["x"] + 2, cell["y"] + 2, cell["x"] + cell["w"] - 3, cell["y"] + cell["h"] - 3],
            outline=SEL_EDGE,
            width=3,
        )

    # safe area (overscan guide)
    sx = w * safe_pct
    sy = h * safe_pct
    draw.rectangle([sx, sy, w - sx, h - sy], outline=SAFE, width=2)
    draw.text((sx + 6, sy + 4), f"SAFE {int((1 - 2 * safe_pct) * 100)}% action", fill=SAFE, font=font_small)

    # title bar
    draw.rectangle([gutter, 2, w - gutter, gutter - 4], fill=(8, 10, 14))
    head = f"{title}  ·  {w}×{h}  ·  {cols}×{rows}  ·  cell ~{int(cw)}×{int(ch)}px"
    draw.text((gutter + 4, 6), head, fill=RULER, font=font_small)

    # center crosshair
    cx, cy = w // 2, h // 2
    arm = max(24, min(w, h) // 30)
    draw.line([(cx - arm, cy), (cx + arm, cy)], fill=CROSS, width=2)
    draw.line([(cx, cy - arm), (cx, cy + arm)], fill=CROSS, width=2)
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], outline=CROSS, width=2)
    draw.text((cx + 8, cy + 6), f"center {cx},{cy}", fill=CROSS, font=font_tiny)

    # corner brackets (pixel alignment)
    br = max(40, min(w, h) // 25)
    for ox, oy, hx, hy in [
        (0, 0, 1, 1),
        (w - 1, 0, -1, 1),
        (0, h - 1, 1, -1),
        (w - 1, h - 1, -1, -1),
    ]:
        draw.line([(ox, oy), (ox + hx * br, oy)], fill=CORNER, width=3)
        draw.line([(ox, oy), (ox, oy + hy * br)], fill=CORNER, width=3)

    draw_ruler(draw, w, h, gutter, font_tiny)

    # selected summary strip
    if selected:
        sel_sorted = sorted(selected)
        summary = "SEL: " + ",".join(str(n) for n in sel_sorted[:24])
        if len(sel_sorted) > 24:
            summary += f"… (+{len(sel_sorted) - 24})"
        draw.rectangle([gutter, h - gutter + 2, w - gutter, h - 4], fill=(8, 10, 14))
        draw.text((gutter + 4, h - gutter + 6), summary, fill=SEL_FILL, font=font_small)

    layout = {
        "version": 1,
        "kind": "cast-align-chart",
        "width": w,
        "height": h,
        "cols": cols,
        "rows": rows,
        "labels": labels,
        "gutter": gutter,
        "safe_pct": safe_pct,
        "safe_box": {
            "x": int(sx),
            "y": int(sy),
            "w": int(w - 2 * sx),
            "h": int(h - 2 * sy),
        },
        "grid_origin": {"x": gx0, "y": gy0},
        "cell_size": {"w": round(cw, 3), "h": round(ch, 3)},
        "title": title,
        "cells": cells,
        "selected": sorted(selected),
        "placement_hint": (
            "Use cell n / chess / x,y,w,h to place wall tiles. "
            "Combine selected cells into a bounding box via --select."
        ),
    }
    if selected:
        xs = [c["x"] for c in cells if c["selected"]]
        ys = [c["y"] for c in cells if c["selected"]]
        x2 = [c["x"] + c["w"] for c in cells if c["selected"]]
        y2 = [c["y"] + c["h"] for c in cells if c["selected"]]
        layout["selection_bbox"] = {
            "x": min(xs),
            "y": min(ys),
            "w": max(x2) - min(xs),
            "h": max(y2) - min(ys),
            "cells": sorted(selected),
        }
    return img, layout


def main() -> int:
    ap = argparse.ArgumentParser(description="Numbered pixel-alignment chart for TV cast")
    ap.add_argument("--w", type=int, default=int(os.environ.get("LIVE_DEMUX_CAST_W", 1920)))
    ap.add_argument("--h", type=int, default=int(os.environ.get("LIVE_DEMUX_CAST_H", 1080)))
    ap.add_argument("--cols", type=int, default=int(os.environ.get("LIVE_DEMUX_CAST_ALIGN_COLS", 8)))
    ap.add_argument("--rows", type=int, default=int(os.environ.get("LIVE_DEMUX_CAST_ALIGN_ROWS", 4)))
    ap.add_argument(
        "--labels",
        choices=("number", "chess", "rc", "both"),
        default=os.environ.get("LIVE_DEMUX_CAST_ALIGN_LABELS", "number"),
    )
    ap.add_argument("--select", default=os.environ.get("LIVE_DEMUX_CAST_ALIGN_SELECT", ""),
                    help="cells to highlight: 1,2,5-8,A3,r2c4")
    ap.add_argument("--safe", type=float, default=0.05, help="safe-area inset fraction (0.05 = 5%%)")
    ap.add_argument("--title", default="CAST ALIGN · pixel chart")
    ap.add_argument("-o", "--outdir", default=os.path.expanduser("~/.panda/vision/cast"))
    ap.add_argument("--name", default="align-chart", help="basename without extension")
    ap.add_argument("--mp4", action="store_true", help="also write short looping mp4 via ffmpeg")
    args = ap.parse_args()

    if args.cols < 1 or args.rows < 1:
        print("error: cols/rows must be >= 1", file=sys.stderr)
        return 2
    if os.environ.get("LIVE_DEMUX_CAST_UHD") == "1" and args.w == 1920 and args.h == 1080:
        args.w, args.h = 3840, 2160

    selected = parse_select(args.select, args.cols, args.rows, args.labels)
    img, layout = generate(
        args.w, args.h, args.cols, args.rows, args.labels, selected, args.safe, args.title
    )

    outdir = Path(args.outdir).expanduser()
    outdir.mkdir(parents=True, exist_ok=True)
    png = outdir / f"{args.name}.png"
    js = outdir / f"{args.name}.json"
    img.save(png, "PNG", optimize=True)
    js.write_text(json.dumps(layout, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {png}  ({args.w}x{args.h}  {args.cols}x{args.rows})")
    print(f"wrote {js}")
    if selected:
        print(f"selected: {sorted(selected)}")
        if "selection_bbox" in layout:
            b = layout["selection_bbox"]
            print(f"bbox: x={b['x']} y={b['y']} w={b['w']} h={b['h']}")

    if args.mp4:
        mp4 = outdir / f"{args.name}.mp4"
        import subprocess

        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-loop", "1", "-i", str(png),
            "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            "-t", "30", "-r", "30", "-movflags", "+faststart",
            str(mp4),
        ]
        try:
            subprocess.run(cmd, check=True)
            print(f"wrote {mp4}")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"warn: mp4 failed: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
