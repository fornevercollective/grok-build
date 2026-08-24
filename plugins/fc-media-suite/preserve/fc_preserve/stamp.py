"""Run stamps. Resume into the same incomplete stamp — never start a new empty vault on drop."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .devices import Device

STAMP_RE = re.compile(r"^\d{8}T\d{6}Z-")


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def stamp_name(device: Device, when: str | None = None) -> str:
    when = when or utc_stamp()
    alias = re.sub(r"[^A-Za-z0-9._-]+", "", device.alias or device.name or "device") or "device"
    short = (device.udid or "nousb")[:8]
    return f"{when}-{alias}-{short}"


def runs_dir(vault: Path) -> Path:
    return vault / "runs"


def stamp_path(vault: Path, name: str) -> Path:
    return runs_dir(vault) / name


def read_summary(stamp: Path) -> dict[str, Any]:
    p = stamp / "summary.json"
    if not p.is_file():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def is_complete(stamp: Path) -> bool:
    summary = read_summary(stamp)
    if summary.get("ok") is True and summary.get("backup_ok") is True:
        gate = stamp / "linux-gate.json"
        if gate.is_file():
            try:
                return bool(json.loads(gate.read_text(encoding="utf-8")).get("ready"))
            except json.JSONDecodeError:
                return False
    return False


def matches_device(name: str, device: Device) -> bool:
    alias = re.sub(r"[^A-Za-z0-9._-]+", "", device.alias or device.name or "")
    if alias and f"-{alias}-" in name:
        return True
    short = (device.udid or "")[:8]
    return bool(short and name.endswith(f"-{short}"))


def find_incomplete(vault: Path, device: Device) -> Path | None:
    root = runs_dir(vault)
    if not root.is_dir():
        return None
    candidates = sorted(
        [p for p in root.iterdir() if p.is_dir() and STAMP_RE.match(p.name) and matches_device(p.name, device)],
        key=lambda p: p.name,
        reverse=True,
    )
    for path in candidates:
        if not is_complete(path):
            return path
    return None


def resolve_stamp(vault: Path, device: Device, *, force_new: bool = False, reuse: bool = True) -> Path:
    if reuse and not force_new:
        existing = find_incomplete(vault, device)
        if existing is not None:
            return existing
    base = stamp_name(device)
    path = stamp_path(vault, base)
    n = 2
    while path.exists() and is_complete(path):
        path = stamp_path(vault, f"{base}-{n}")
        n += 1
    path.mkdir(parents=True, exist_ok=True)
    (path / "backup").mkdir(exist_ok=True)
    (path / "extract").mkdir(exist_ok=True)
    (path / "catalog").mkdir(exist_ok=True)
    (path / "dcim").mkdir(exist_ok=True)
    return path


def already_received(path: Path) -> bool:
    return path.is_file() and path.stat().st_size > 0


def point_current(vault: Path, stamp: Path) -> None:
    link = vault / "current"
    try:
        if link.is_symlink() or link.exists():
            link.unlink()
        link.symlink_to(stamp)
    except OSError:
        write_json(vault / "current.json", {"stamp": str(stamp)})
