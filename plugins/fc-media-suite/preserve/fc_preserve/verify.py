"""VERIFY required domains actually exist. A stub dump is never success."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .extract import find_manifest_db
from .progress import RunLog


def _has_files(path: Path) -> bool:
    if not path.exists():
        return False
    if path.is_file():
        return path.stat().st_size > 0
    for p in path.rglob("*"):
        if p.is_file() and p.stat().st_size > 0:
            return True
    return False


def _needle_exists(root: Path, needle: str) -> bool:
    target = root / needle
    if target.exists() and _has_files(target):
        return True
    name = Path(needle).name
    for p in root.rglob(name):
        if _has_files(p):
            return True
    # path fragment
    for p in root.rglob("*"):
        if needle in p.as_posix() and p.is_file() and p.stat().st_size > 0:
            return True
    return False


def _spec_ok(stamp: Path, spec: dict[str, Any]) -> bool:
    kind = spec.get("kind") or "any"
    if spec.get("id") == "manifest" or kind == "backup_file":
        return find_manifest_db(stamp / "backup") is not None or _has_files(stamp / "extract" / "Manifest.db")
    for rel in spec.get("extract_dirs") or []:
        if _has_files(stamp / rel):
            return True
    search_roots = [stamp / "backup", stamp / "extract", stamp / "dcim"]
    for needle in spec.get("path_needles") or []:
        for root in search_roots:
            if root.exists() and _needle_exists(root, needle):
                return True
    return False


def verify_stamp(cfg: dict[str, Any], stamp: Path, platform: str, log: RunLog) -> dict[str, Any]:
    key = "linux" if platform in ("linux", "android") else "ios"
    specs = list((cfg.get("required_domains") or {}).get(key) or [])
    checks: list[dict[str, Any]] = []
    missing: list[str] = []
    for spec in specs:
        ok = _spec_ok(stamp, spec)
        label = str(spec.get("label") or spec.get("id"))
        checks.append({"id": spec.get("id"), "label": label, "ok": ok})
        log.line(f"verify  {'OK  ' if ok else 'FAIL'}  {label}")
        if not ok:
            missing.append(label)
    ok = not missing
    return {
        "ok": ok,
        "domains_extracted": ok,
        "missing": missing,
        "checks": checks,
        "platform": key,
    }
