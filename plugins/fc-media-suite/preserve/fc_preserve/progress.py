"""Line-based progress so `tail -F` of the run log is watchable.

idevicebackup2 prints `\r` status. Those carriage returns are rewritten as
newlines and flushed immediately — never left as an in-place overwrite
that `tail -F` cannot see.
"""

from __future__ import annotations

import io
import sys
import time
from pathlib import Path


class RunLog:
    def __init__(self, path: Path | None = None, also: io.TextIOBase | None = None) -> None:
        self.path = path
        self.also = also if also is not None else sys.stderr
        self._fp = None
        if path is not None:
            path.parent.mkdir(parents=True, exist_ok=True)
            self._fp = path.open("a", encoding="utf-8", buffering=1)
        self._t0 = time.monotonic()
        self._bytes = 0
        self._last_t = self._t0
        self._last_bytes = 0

    def close(self) -> None:
        if self._fp is not None:
            self._fp.close()
            self._fp = None

    def __enter__(self) -> RunLog:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def line(self, msg: str) -> None:
        text = str(msg).replace("\r", "\n")
        for part in text.split("\n"):
            part = part.rstrip()
            if part == "":
                continue
            out = part + "\n"
            if self._fp is not None:
                self._fp.write(out)
                self._fp.flush()
            if self.also is not None:
                self.also.write(out)
                self.also.flush()

    def feed_bytes(self, data: bytes) -> None:
        if not data:
            return
        self.line(data.decode("utf-8", "replace"))

    def progress(
        self,
        pct: float | None = None,
        rate_mbs: float | None = None,
        last: str = "",
        bytes_done: int | None = None,
        bytes_total: int | None = None,
    ) -> None:
        now = time.monotonic()
        if bytes_done is not None:
            self._bytes = bytes_done
            dt = max(now - self._last_t, 1e-6)
            db = max(bytes_done - self._last_bytes, 0)
            if rate_mbs is None:
                rate_mbs = (db / dt) / (1024 * 1024)
            self._last_t = now
            self._last_bytes = bytes_done
            if pct is None and bytes_total:
                pct = 100.0 * bytes_done / bytes_total
        if pct is None:
            pct = 0.0
        if rate_mbs is None:
            rate_mbs = 0.0
        last = last or "…"
        self.line(f"{pct:5.1f}%  {rate_mbs:6.2f} MB/s  {last}")


def flush_cr_stream(raw: bytes | str) -> str:
    """Turn mixed \\r / \\n vendor progress into tail -F lines."""
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    return "\n".join(p.rstrip() for p in raw.replace("\r", "\n").split("\n") if p.rstrip())
