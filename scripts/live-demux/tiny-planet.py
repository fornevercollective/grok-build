#!/usr/bin/env python3
"""Stereographic tiny planet / rabbit hole from equirectangular (or wide) stills.

Matches the OpenCV polar remap used in 360 filmmaking:
  θ (angle) → panorama X,  R (radius) → panorama Y.

Usage (explicit only — never auto-run):
  python3 scripts/live-demux/tiny-planet.py panorama.jpg -o planet.jpg
  python3 scripts/live-demux/tiny-planet.py panorama.jpg --invert -o rabbit.jpg
  python3 scripts/live-demux/tiny-planet.py ~/.panda/vision/live.jpg --size 1200

Requires: opencv-python (cv2), numpy.
Live lens pop-out uses ffmpeg v360 stereographic (see lens.rs / lens-popout.sh).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def create_tiny_planet(img, output_size: int = 1000, invert: bool = False):
    import cv2
    import numpy as np

    if invert:
        img = cv2.flip(img, 0)

    h, w = img.shape[:2]
    r_max = output_size / 2.0
    x = np.arange(output_size)
    y = np.arange(output_size)
    X, Y = np.meshgrid(x, y)
    Xc = X - r_max
    Yc = Y - r_max
    R = np.sqrt(Xc * Xc + Yc * Yc)
    Theta = np.arctan2(Yc, Xc)
    map_x = ((Theta + np.pi) / (2 * np.pi)) * (w - 1)
    map_y = (R / r_max) * (h - 1)
    mask = R > r_max
    map_x[mask] = 0
    map_y[mask] = 0
    return cv2.remap(
        img,
        map_x.astype(np.float32),
        map_y.astype(np.float32),
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0),
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Tiny planet / rabbit hole from panorama")
    ap.add_argument("input", help="equirectangular or wide still (jpg/png)")
    ap.add_argument("-o", "--output", default="", help="output path (default: *-planet.jpg)")
    ap.add_argument("--size", type=int, default=1000, help="square output size")
    ap.add_argument(
        "--invert",
        action="store_true",
        help="rabbit hole (sky center) instead of planet",
    )
    args = ap.parse_args()

    try:
        import cv2
    except ImportError:
        print("error: need opencv-python  (pip install opencv-python-headless)", file=sys.stderr)
        return 1

    src = Path(args.input).expanduser()
    img = cv2.imread(str(src))
    if img is None:
        print(f"error: cannot read {src}", file=sys.stderr)
        return 1

    out = create_tiny_planet(img, output_size=max(256, args.size), invert=args.invert)
    dest = Path(args.output).expanduser() if args.output else src.with_name(
        src.stem + ("-rabbit" if args.invert else "-planet") + ".jpg"
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(dest), out)
    print(f"wrote {dest}  ({args.size}x{args.size} {'rabbit' if args.invert else 'planet'})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
