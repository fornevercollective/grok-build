"""backup → extract → catalog → SHA-256 custody → verify → linux-gate.json."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from .backup import BackupError, refuse_if_hotspot, run_backup
from .catalog import write_catalog
from .custody import write_custody
from .devices import Device, ProbeResult
from .extract import extract_domains
from .gate import compute_gate, write_gate
from .progress import RunLog
from .stamp import point_current, read_summary, resolve_stamp, write_json
from .verify import verify_stamp


def run_all(
    cfg: dict[str, Any],
    device: Device,
    vault: Path,
    log: RunLog,
    *,
    probe: ProbeResult | None = None,
    source_dir: Path | None = None,
    force_new: bool = False,
    skip_afc: bool = False,
    runner: Callable[..., Any] | None = None,
    afc_puller: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    if probe is not None and device.platform == "ios":
        refuse_if_hotspot(probe)

    stamp = resolve_stamp(vault, device, force_new=force_new, reuse=bool(cfg.get("stamp_reuse_incomplete", True)))
    stamp.mkdir(parents=True, exist_ok=True)
    log.line(f"stamp  {stamp}  (resume into this folder on USB drop)")
    point_current(vault, stamp)

    backup_ok = False
    bytes_copied = 0
    backup_result: dict[str, Any] = {}
    verify_result: dict[str, Any] = {"ok": False, "domains_extracted": False, "missing": ["backup"]}
    custody_result: dict[str, Any] = {"ok": False, "hashes_written": False}
    extract_result: dict[str, Any] = {}
    catalog_result: dict[str, Any] = {}

    try:
        backup_result = run_backup(
            cfg,
            device,
            stamp,
            log,
            source_dir=source_dir,
            runner=runner,
            afc_puller=afc_puller,
            skip_afc=skip_afc,
        )
        backup_ok = bool(backup_result.get("backup_ok"))
        bytes_copied = int(backup_result.get("bytes") or 0)
        log.line(f"backup {'OK' if backup_ok else 'FAIL'}  {bytes_copied} bytes  method={backup_result.get('method')}")

        extract_result = extract_domains(stamp, log)
        catalog_result = write_catalog(stamp, log)
        custody_result = write_custody(stamp, log)
        verify_result = verify_stamp(cfg, stamp, device.platform, log)
    except BackupError as exc:
        log.line(f"FAILED  {exc}")
        backup_ok = False
        backup_result = {"backup_ok": False, "error": str(exc), "kind": exc.kind}

    gate = compute_gate(
        device,
        stamp,
        backup_ok=backup_ok,
        domains_extracted=bool(verify_result.get("domains_extracted")),
        hashes_written=bool(custody_result.get("hashes_written")),
        bytes_copied=bytes_copied,
        extra={
            "icloud_optimize": backup_result.get("icloud_optimize"),
            "missing_domains": verify_result.get("missing") or [],
        },
    )
    write_gate(stamp, gate)

    summary = {
        "ok": bool(gate.get("ready")),
        "backup_ok": backup_ok,
        "bytes": bytes_copied,
        "looks_like_success": bool(gate.get("looks_like_success")),
        "stamp": stamp.name,
        "device": device.alias or device.name,
        "vault": str(vault),
        "backup": backup_result,
        "extract": extract_result,
        "catalog": catalog_result,
        "custody": custody_result,
        "verify": verify_result,
        "gate": gate,
        "icloud_optimize": backup_result.get("icloud_optimize"),
    }
    write_json(stamp / "summary.json", summary)
    if gate.get("ready"):
        log.line("VERIFY OK  linux-gate ready=true")
    else:
        log.line(
            "VERIFY FAILED  linux-gate ready=false  "
            f"backup_ok={backup_ok} manifest_db={gate.get('manifest_db')} "
            f"domains={gate.get('domains_extracted')} hashes={gate.get('hashes_written')}"
        )
        log.line("a stub dump (including a 388 MB backup_ok=false tree) is never success")
    return summary


def latest_stamp(vault: Path, device: Device | None = None) -> Path | None:
    from .stamp import matches_device, runs_dir

    root = runs_dir(vault)
    if not root.is_dir():
        return None
    runs = sorted([p for p in root.iterdir() if p.is_dir()], key=lambda p: p.name, reverse=True)
    for path in runs:
        if device is None or matches_device(path.name, device):
            if (path / "linux-gate.json").exists() or (path / "summary.json").exists() or path.is_dir():
                return path
    return None


def load_summary(stamp: Path) -> dict[str, Any]:
    return read_summary(stamp)
