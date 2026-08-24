"""linux-gate.json — ready:true only when every honesty bit is true.

A 388 MB stub with backup_ok false must never look like success.
Brick can complete a backup (ready may be true) but can never pass the flash gate.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .devices import Device, brick_never_flash
from .extract import find_manifest_db
from .stamp import write_json

SCHEMA = "fc-preserve-linux-gate-v1"
STUB_BYTES = 388 * 1024 * 1024


def compute_gate(
    device: Device,
    stamp: Path,
    *,
    backup_ok: bool,
    domains_extracted: bool,
    hashes_written: bool,
    bytes_copied: int = 0,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    manifest = find_manifest_db(stamp / "backup") is not None or (stamp / "extract" / "Manifest.db").is_file()
    if device.platform in ("linux", "android"):
        # linux-test has no iOS Manifest.db; system extract stands in
        manifest = manifest or (stamp / "extract" / "system" / "os-release").is_file()

    ready = bool(backup_ok and manifest and domains_extracted and hashes_written)
    gated = device.flash == "gated" or device.role == "linux-test"
    flash_allowed = bool(ready and not brick_never_flash(device) and gated)
    looks_like_success = bool(ready)
    # size is never a success signal
    if bytes_copied and bytes_copied >= STUB_BYTES and not ready:
        looks_like_success = False

    gate = {
        "schema": SCHEMA,
        "ready": ready,
        "backup_ok": bool(backup_ok),
        "manifest_db": bool(manifest),
        "domains_extracted": bool(domains_extracted),
        "hashes_written": bool(hashes_written),
        "device": device.alias or device.name,
        "udid": device.udid,
        "platform": device.platform,
        "flavor": device.flavor,
        "preserve_only": brick_never_flash(device),
        "flash_allowed": flash_allowed,
        "flash_refused_reason": (
            "Brick is the daily iPhone — preserve only, NEVER flash."
            if brick_never_flash(device)
            else (None if flash_allowed else "linux-gate ready is false")
        ),
        "stamp": stamp.name,
        "bytes": int(bytes_copied),
        "looks_like_success": looks_like_success,
    }
    if extra:
        gate.update(extra)
    if brick_never_flash(device):
        gate["flash_allowed"] = False
        gate["flash_refused_reason"] = "Brick is the daily iPhone — preserve only, NEVER flash."
    return gate


def write_gate(stamp: Path, gate: dict[str, Any]) -> Path:
    path = stamp / "linux-gate.json"
    write_json(path, gate)
    return path


def read_gate(stamp: Path) -> dict[str, Any]:
    path = stamp / "linux-gate.json"
    if not path.is_file():
        return {}
    import json

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def flash_gate_ok(gate: dict[str, Any], device: Device) -> tuple[bool, str]:
    if brick_never_flash(device):
        return False, "Brick is the daily iPhone — preserve only, NEVER flash."
    if not gate.get("ready"):
        return False, "linux-gate ready is false — backup/verify/hashes incomplete"
    if not gate.get("flash_allowed"):
        return False, str(gate.get("flash_refused_reason") or "flash not allowed")
    return True, "ok"
