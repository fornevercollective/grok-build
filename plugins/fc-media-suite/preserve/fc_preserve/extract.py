"""OpenExtract-inspired domain export from Manifest.db (original, not a fork)."""

from __future__ import annotations

import shutil
import sqlite3
from pathlib import Path
from typing import Any, Iterable

from .progress import RunLog
from .stamp import already_received

DOMAIN_MAP = {
    "CameraRollDomain": "photos",
    "MediaDomain": "photos",
    "HomeDomain": None,  # split by path
}


def find_manifest_db(backup_root: Path) -> Path | None:
    direct = backup_root / "Manifest.db"
    if direct.is_file() and direct.stat().st_size > 0:
        return direct
    for p in backup_root.rglob("Manifest.db"):
        if p.is_file() and p.stat().st_size > 0:
            return p
    return None


def _blob_path(backup_root: Path, file_id: str) -> Path:
    return backup_root / file_id[:2] / file_id


def iter_manifest_files(manifest: Path) -> Iterable[tuple[str, str, str, int]]:
    con = sqlite3.connect(f"file:{manifest}?mode=ro", uri=True)
    try:
        cur = con.execute("SELECT fileID, domain, relativePath, flags FROM Files")
        yield from cur
    finally:
        con.close()


def _extract_bucket(domain: str, rel: str) -> str | None:
    if domain in ("CameraRollDomain", "MediaDomain"):
        return "photos"
    if domain.startswith("AppDomain"):
        return "apps"
    if "SMS" in rel or rel.endswith("sms.db"):
        return "messages"
    if "AddressBook" in rel:
        return "contacts"
    if domain == "HomeDomain":
        return "home"
    return domain.replace("Domain", "").lower() or "other"


def extract_domains(stamp: Path, log: RunLog, *, skip_existing: bool = True) -> dict[str, Any]:
    backup = stamp / "backup"
    manifest = find_manifest_db(backup)
    extract_root = stamp / "extract"
    extract_root.mkdir(parents=True, exist_ok=True)
    copied = 0
    skipped = 0
    domains: dict[str, int] = {}
    if manifest is None:
        # linux / inject trees have no Manifest.db — copy well-known paths
        linux = backup / "linux"
        src = linux if linux.exists() else backup
        for needle, bucket in (
            ("etc/os-release", "system"),
            ("usr/lib/os-release", "system"),
            ("DCIM", "photos"),
            ("Pictures", "photos"),
            ("photos", "photos"),
        ):
            hit = src / needle
            if not hit.exists():
                hits = list(src.rglob(Path(needle).name))
                hit = hits[0] if hits else hit
            if hit.exists():
                dest = extract_root / bucket / hit.name
                dest.parent.mkdir(parents=True, exist_ok=True)
                if hit.is_dir():
                    shutil.copytree(hit, extract_root / bucket, dirs_exist_ok=True)
                else:
                    if skip_existing and already_received(dest):
                        skipped += 1
                    else:
                        shutil.copy2(hit, dest)
                        copied += 1
                domains[bucket] = domains.get(bucket, 0) + 1
                log.progress(last=f"{bucket}/{hit.name}")
        return {
            "ok": copied > 0 or skipped > 0,
            "manifest_db": False,
            "copied": copied,
            "skipped": skipped,
            "domains": domains,
            "method": "linux-tree",
        }

    dest_manifest = extract_root / "Manifest.db"
    if not (skip_existing and already_received(dest_manifest)):
        shutil.copy2(manifest, dest_manifest)
        copied += 1
    backup_root = manifest.parent
    for file_id, domain, rel, flags in iter_manifest_files(manifest):
        if int(flags or 0) == 2:
            continue
        rel = rel or ""
        bucket = _extract_bucket(domain or "", rel)
        if bucket is None:
            continue
        src = _blob_path(backup_root, file_id)
        if not src.is_file():
            continue
        dest = extract_root / bucket / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if skip_existing and already_received(dest):
            skipped += 1
            continue
        shutil.copy2(src, dest)
        copied += 1
        domains[domain] = domains.get(domain, 0) + 1
        log.progress(last=f"{domain}/{rel}")
    return {
        "ok": True,
        "manifest_db": True,
        "copied": copied,
        "skipped": skipped,
        "domains": domains,
        "method": "manifest-db",
        "manifest_path": str(manifest),
    }
