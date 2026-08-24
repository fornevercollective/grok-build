"""IntuneBrew-inspired per-app JSON catalog (original, not a fork)."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Any

from .extract import find_manifest_db
from .progress import RunLog


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _app_record(bundle_id: str, domain: str, files: int, bytes_: int, dest: Path | None) -> dict[str, Any]:
    rec = {
        "name": bundle_id.rsplit(".", 1)[-1],
        "bundleId": bundle_id,
        "domain": domain,
        "version": None,
        "homepage": None,
        "files": files,
        "bytes": bytes_,
        "sha256": _sha256(dest) if dest and dest.is_file() else None,
        "source": "Manifest.db",
    }
    return rec


def write_catalog(stamp: Path, log: RunLog) -> dict[str, Any]:
    catalog = stamp / "catalog"
    catalog.mkdir(parents=True, exist_ok=True)
    apps: list[dict[str, Any]] = []
    manifest = find_manifest_db(stamp / "backup")
    if manifest is not None:
        by_domain: dict[str, dict[str, Any]] = defaultdict(lambda: {"files": 0, "bytes": 0})
        con = sqlite3.connect(f"file:{manifest}?mode=ro", uri=True)
        try:
            for domain, rel, flags in con.execute("SELECT domain, relativePath, flags FROM Files"):
                if not domain or int(flags or 0) == 2:
                    continue
                by_domain[domain]["files"] += 1
                blob = manifest.parent / (rel or "")
                if blob.is_file():
                    by_domain[domain]["bytes"] += blob.stat().st_size
        finally:
            con.close()
        for domain, stats in sorted(by_domain.items()):
            bundle = domain
            if domain.startswith("AppDomain-"):
                bundle = domain.split("AppDomain-", 1)[1]
            elif domain.startswith("AppDomainGroup-"):
                bundle = domain.split("AppDomainGroup-", 1)[1]
            rec = _app_record(bundle, domain, int(stats["files"]), int(stats["bytes"]), None)
            slug = bundle.replace("/", "_")
            path = catalog / f"{slug}.json"
            path.write_text(json.dumps(rec, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            rec["catalog"] = str(path.name)
            apps.append(rec)
            log.progress(last=f"catalog/{path.name}")
    else:
        # linux-test: one catalog entry for the flavor
        rec = {
            "name": "GrokBotBaby",
            "bundleId": "org.postmarketos.grokbotbaby",
            "domain": "linux-test",
            "flavor": "postmarketos",
            "files": 0,
            "bytes": 0,
            "source": "linux-tree",
        }
        path = catalog / "org.postmarketos.grokbotbaby.json"
        path.write_text(json.dumps(rec, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        rec["catalog"] = path.name
        apps.append(rec)

    index = {
        "schema": "fc-preserve-catalog-v1",
        "inspired_by": "IntuneBrew per-app JSON (not a fork)",
        "apps": [
            {"bundleId": a.get("bundleId"), "domain": a.get("domain"), "file": a.get("catalog")} for a in apps
        ],
        "count": len(apps),
    }
    index_path = catalog / "_index.json"
    index_path.write_text(json.dumps(index, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return {"ok": True, "count": len(apps), "index": str(index_path)}
