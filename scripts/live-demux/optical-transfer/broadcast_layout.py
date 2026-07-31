#!/usr/bin/env python3
"""Broadcast layout + person occlusion masks for optical TX.

Produces:
  regions.json  — isolate boxes (normalized 0..1) for L3, pillars, bug
  mask.png      — grayscale: 0 = occlude (talent), 255 = free for TX

Person mask:
  1) MediaPipe Selfie Segmentation if installed
  2) else center-weighted oval heuristic (talking-head safe default)

SAM hook: set MIX_SAM_CMD to a shell that reads $MIX_SNAP and writes
$MIX_MASK (optional future FastSAM/SAM2).
"""
from __future__ import annotations

import json
import os
import struct
import subprocess
import zlib
from pathlib import Path
from typing import Any, Optional

# ── default broadcast isolates (16:9 news) ─────────────────────────────
# y grows downward. Prefer chrome; keep talent center clear.


def default_regions() -> list[dict[str, Any]]:
    return [
        {
            "id": "lower_third",
            "role": "tx_primary",
            "label": "lower-third plate",
            "box": [0.02, 0.72, 0.96, 0.18],  # x,y,w,h norm
            "priority": 10,
            "finder_ok": True,
        },
        {
            "id": "ticker",
            "role": "tx_secondary",
            "label": "ticker strip",
            "box": [0.0, 0.90, 1.0, 0.10],
            "priority": 8,
            "finder_ok": False,
        },
        {
            "id": "left_pillar",
            "role": "tx_secondary",
            "label": "left pillar",
            "box": [0.0, 0.08, 0.10, 0.62],
            "priority": 6,
            "finder_ok": True,
        },
        {
            "id": "right_pillar",
            "role": "tx_secondary",
            "label": "right pillar",
            "box": [0.90, 0.08, 0.10, 0.62],
            "priority": 5,
            "finder_ok": True,
        },
        {
            "id": "bug",
            "role": "beacon",
            "label": "corner bug / QR beacon",
            "box": [0.72, 0.04, 0.12, 0.14],
            "priority": 4,
            "finder_ok": True,
        },
        {
            # Bloomberg-scale network bug (top-right) — small plate, not a large orb
            "id": "logo_sphere",
            "role": "strobe",
            "label": "logo strobe bug",
            "box": [0.935, 0.035, 0.048, 0.085],
            "priority": 12,
            "finder_ok": False,
        },
        {
            "id": "talent",
            "role": "occlude",
            "label": "talent / talking head (occlude)",
            "box": [0.18, 0.06, 0.64, 0.68],
            "priority": 0,
            "finder_ok": False,
        },
    ]


def write_regions(path: Path, w: int, h: int, extra: Optional[dict] = None) -> dict:
    regs = default_regions()
    body = {
        "schema": "fc-broadcast-regions-v1",
        "width": w,
        "height": h,
        "aspect": "16:9",
        "regions": regs,
        "tx_union": [r["id"] for r in regs if r["role"].startswith("tx") or r["role"] == "beacon"],
        "occlude": [r["id"] for r in regs if r["role"] == "occlude"],
        **(extra or {}),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body, indent=2) + "\n")
    return body


def _png_gray(path: Path, w: int, h: int, pixels: bytes) -> None:
    """Write 8-bit grayscale PNG (no deps)."""
    assert len(pixels) == w * h

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b""
    row = w
    for y in range(h):
        raw += b"\x00" + pixels[y * row : (y + 1) * row]
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def heuristic_person_mask(w: int, h: int) -> bytes:
    """Center oval — talking-head default when no ML."""
    out = bytearray(w * h)
    cx, cy = w * 0.42, h * 0.38
    rx, ry = w * 0.22, h * 0.34
    for y in range(h):
        for x in range(w):
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            # 0 = occlude (person), 255 = free
            if nx * nx + ny * ny <= 1.0:
                out[y * w + x] = 0
            else:
                out[y * w + x] = 255
    # also clear hard talent box a bit softer edges already from oval
    return bytes(out)


def try_mediapipe_mask(jpeg: bytes, w: int, h: int) -> Optional[bytes]:
    try:
        import mediapipe as mp  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        return None
    try:
        import cv2  # type: ignore

        arr = np.frombuffer(jpeg, dtype=np.uint8)
        bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if bgr is None:
            return None
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        with mp.solutions.selfie_segmentation.SelfieSegmentation(
            model_selection=1
        ) as seg:
            res = seg.process(rgb)
            if res.segmentation_mask is None:
                return None
            mask = res.segmentation_mask  # float 0..1 person
            # person high → occlude (0); free → 255
            m = (mask < 0.45).astype("uint8") * 255
            if m.shape[1] != w or m.shape[0] != h:
                m = cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST)
            # dilate slightly so hair/shoulders stay clear of modules
            k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
            m = cv2.erode(m, k)  # shrink free area near person
            return m.tobytes()
    except Exception:
        return None


def try_sam_hook(snap: Path, mask_path: Path) -> bool:
    cmd = os.environ.get("MIX_SAM_CMD", "").strip()
    if not cmd:
        return False
    env = os.environ.copy()
    env["MIX_SNAP"] = str(snap)
    env["MIX_MASK"] = str(mask_path)
    try:
        r = subprocess.run(cmd, shell=True, env=env, timeout=8)
        return r.returncode == 0 and mask_path.is_file()
    except Exception:
        return False


def update_masks_from_jpeg(
    jpeg: bytes,
    snap: Path,
    mask_path: Path,
    regions_path: Path,
    w: int = 960,
    h: int = 540,
) -> dict:
    """Write mask.png + regions.json; return meta for status.json."""
    # try decode size if opencv available
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        arr = np.frombuffer(jpeg, dtype=np.uint8)
        im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if im is not None:
            h, w = im.shape[:2]
    except Exception:
        pass

    regions = write_regions(regions_path, w, h)

    # SAM hook first if configured
    if try_sam_hook(snap, mask_path):
        method = "sam_hook"
    else:
        pix = try_mediapipe_mask(jpeg, w, h)
        if pix is not None:
            method = "mediapipe"
            _png_gray(mask_path, w, h, pix)
        else:
            method = "heuristic_oval"
            _png_gray(mask_path, w, h, heuristic_person_mask(w, h))

    # Union free TX: start from person mask, force occlude talent box slightly
    # (browser also applies regions — server mask is person-focused)
    return {
        "mask": str(mask_path),
        "regions": str(regions_path),
        "mask_method": method,
        "width": w,
        "height": h,
        "tx_regions": regions["tx_union"],
    }
