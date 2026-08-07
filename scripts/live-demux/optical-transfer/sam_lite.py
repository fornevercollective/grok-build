#!/usr/bin/env python3
"""SAM-lite person mask for mix-pipe (Mac Mini friendly).

Reads MIX_SNAP (JPEG), writes MIX_MASK (grayscale PNG):
  0   = occlude (talent / person) — no TX modules
  255 = free for layered optical TX

Methods (first success):
  1) MediaPipe Selfie Segmentation (if installed)
  2) OpenCV: skin + center prior + grabcut-lite flood
  3) heuristic oval (always works, no deps beyond stdlib via broadcast_layout)

Usage:
  MIX_SNAP=... MIX_MASK=... python3 sam_lite.py
  export MIX_SAM_CMD='…/sam_lite.py'   # or bash -c with venv python
"""
from __future__ import annotations

import os
import struct
import sys
import time
import zlib
from pathlib import Path


def _png_gray(path: Path, w: int, h: int, pixels: bytes) -> None:
    assert len(pixels) == w * h

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b""
    for y in range(h):
        raw += b"\x00" + pixels[y * w : (y + 1) * w]
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )


def heuristic(w: int, h: int) -> bytes:
    out = bytearray(w * h)
    cx, cy = w * 0.42, h * 0.38
    rx, ry = w * 0.22, h * 0.34
    for y in range(h):
        for x in range(w):
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            out[y * w + x] = 0 if (nx * nx + ny * ny) <= 1.0 else 255
    return bytes(out)


def mediapipe_mask(bgr) -> bytes | None:
    try:
        import mediapipe as mp  # type: ignore
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        return None
    try:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        h, w = bgr.shape[:2]
        with mp.solutions.selfie_segmentation.SelfieSegmentation(
            model_selection=1
        ) as seg:
            res = seg.process(rgb)
            if res.segmentation_mask is None:
                return None
            # person high → occlude 0
            m = (res.segmentation_mask < 0.45).astype("uint8") * 255
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
            m = cv2.erode(m, k)
            return m.tobytes()
    except Exception:
        return None


def opencv_sam_lite(bgr) -> bytes | None:
    """Fast person-ish mask without neural net weights download."""
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        return None
    h, w = bgr.shape[:2]
    # YCrCb skin
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    cr, cb = ycrcb[:, :, 1], ycrcb[:, :, 2]
    skin = ((cr > 133) & (cr < 173) & (cb > 77) & (cb < 127)).astype("uint8") * 255
    # Multi-host prior: three wide ovals (L / C / R talking heads) + full mid band
    yy, xx = np.mgrid[0:h, 0:w]
    prior = np.zeros((h, w), dtype=np.uint8)
    for cx_f, cy_f, rx_f, ry_f in (
        (0.28, 0.42, 0.18, 0.38),  # left host
        (0.50, 0.40, 0.20, 0.40),  # center
        (0.72, 0.42, 0.18, 0.38),  # right host
    ):
        cx, cy = cx_f * w, cy_f * h
        rx, ry = rx_f * w, ry_f * h
        prior |= (
            ((xx - cx) / max(rx, 1)) ** 2 + ((yy - cy) / max(ry, 1)) ** 2 < 1.0
        ).astype("uint8") * 255
    # wide mid-frame band for 2–3 person desk
    prior[int(0.12 * h) : int(0.70 * h), int(0.12 * w) : int(0.88 * w)] = np.maximum(
        prior[int(0.12 * h) : int(0.70 * h), int(0.12 * w) : int(0.88 * w)],
        180,
    )
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    person = cv2.bitwise_or(skin, prior)
    person = cv2.bitwise_or(
        person, cv2.dilate(cv2.bitwise_and(edges, prior), np.ones((7, 7), np.uint8))
    )
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
    person = cv2.morphologyEx(person, cv2.MORPH_CLOSE, k)
    person = cv2.dilate(person, k)
    # free = 255 where not person
    free = np.where(person > 100, 0, 255).astype("uint8")
    # force free lower-third + pillars for TX (broadcast safety)
    free[int(0.72 * h) :, :] = 255
    free[:, : int(0.10 * w)] = 255
    free[:, int(0.90 * w) :] = 255
    free[: int(0.06 * h), :] = 255
    return free.tobytes()


def main() -> int:
    t0 = time.time()
    snap = Path(os.environ.get("MIX_SNAP", str(Path.home() / ".panda/vision/cast/mix-latest.jpg")))
    mask_path = Path(os.environ.get("MIX_MASK", str(Path.home() / ".panda/vision/cast/mix-mask.png")))
    meta_path = Path(os.environ.get("MIX_MASK_META", str(mask_path.with_suffix(".meta.json"))))

    if not snap.is_file():
        print(f"sam_lite: no snap {snap}", file=sys.stderr)
        return 2

    method = "heuristic"
    w = h = 0
    pix: bytes | None = None

    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        data = np.fromfile(str(snap), dtype=np.uint8)
        bgr = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if bgr is not None:
            h, w = bgr.shape[:2]
            pix = mediapipe_mask(bgr)
            if pix is not None:
                method = "mediapipe"
            else:
                pix = opencv_sam_lite(bgr)
                if pix is not None:
                    method = "opencv_sam_lite"
    except Exception as e:
        print(f"sam_lite: decode {e}", file=sys.stderr)

    if pix is None or w <= 0:
        # size from jpeg header crude default
        w, h = 960, 540
        try:
            from broadcast_layout import heuristic_person_mask  # type: ignore

            pix = heuristic_person_mask(w, h)
            method = "heuristic_oval"
        except Exception:
            pix = heuristic(w, h)
            method = "heuristic_inline"

    _png_gray(mask_path, w, h, pix)
    free = sum(1 for b in pix if b > 127)
    total = w * h
    meta = {
        "schema": "fc-sam-lite-v1",
        "method": method,
        "width": w,
        "height": h,
        "free_px": free,
        "free_frac": round(free / total, 4) if total else 0,
        "ms": int((time.time() - t0) * 1000),
        "snap": str(snap),
        "mask": str(mask_path),
    }
    try:
        import json

        meta_path.write_text(json.dumps(meta, indent=2) + "\n")
    except OSError:
        pass
    print(f"sam_lite · {method} · free={meta['free_frac']:.1%} · {meta['ms']}ms → {mask_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
