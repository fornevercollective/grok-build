#!/usr/bin/env python3
"""fcs preserve — Etcher-style device backup / gated flash (fc-preserve-etcher-v1)."""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from fc_preserve.cli import main  # noqa: E402


if __name__ == "__main__":
    sys.exit(main())
