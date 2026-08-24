"""SHA-256 chain of custody."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .progress import RunLog
from .stamp import write_json

INTERESTING = (
    "Manifest.db",
    "extract/",
    "catalog/_index.json",
    "dcim/",
    "linux-gate.json",
    "summary.json",
)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _wanted(rel: str) -> bool:
    if rel.endswith("hashes.sha256") or rel.endswith("custody.json"):
        return False
    return any(rel == i.rstrip("/") or rel.startswith(i) for i in INTERESTING) or rel.endswith(
        ("Manifest.db", "sms.db", "AddressBook.sqlitedb", "os-release")
    )


def write_custody(stamp: Path, log: RunLog) -> dict[str, Any]:
    rows: list[tuple[str, str]] = []
    for path in sorted(stamp.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(stamp).as_posix()
        if not _wanted(rel):
            continue
        digest = sha256_file(path)
        rows.append((digest, rel))
        log.progress(last=f"sha256 {rel}")
    listing = "".join(f"{d}  {rel}\n" for d, rel in rows)
    hashes = stamp / "hashes.sha256"
    hashes.write_text(listing, encoding="utf-8")
    chain = sha256_file(hashes)
    payload = {
        "algorithm": "SHA-256",
        "files": len(rows),
        "hashes_file": "hashes.sha256",
        "chain": chain,
    }
    write_json(stamp / "custody.json", payload)
    return {"ok": bool(rows), "files": len(rows), "chain": chain, "hashes_written": hashes.is_file() and hashes.stat().st_size > 0}
