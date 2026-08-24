"""Load preserve config. Vault default is the external Data volume — never Documents."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from . import DEFAULT_VAULT

HERE = Path(__file__).resolve().parent.parent
DEFAULT_JSON = HERE / "default.json"

FORBIDDEN_VAULT_MARKERS = (
    "/Documents",
    "Documents/FC-Preserve",
)


def load_default(path: Path | None = None) -> dict[str, Any]:
    src = path or DEFAULT_JSON
    with src.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if data.get("vault_root") != DEFAULT_VAULT:
        raise ValueError(
            f"default.json vault_root must be {DEFAULT_VAULT!r}, got {data.get('vault_root')!r}"
        )
    return data


def expand_user(raw: str) -> Path:
    return Path(os.path.expandvars(os.path.expanduser(raw)))


def is_forbidden_vault(path: Path) -> bool:
    text = str(path)
    home_docs = str(Path.home() / "Documents")
    if text == home_docs or text.startswith(home_docs + os.sep):
        return True
    return any(m in text for m in FORBIDDEN_VAULT_MARKERS) and "MacBookPro" not in text


def resolve_vault(cfg: dict[str, Any], override: str | None = None) -> Path:
    raw = override or os.environ.get("FC_PRESERVE_VAULT") or cfg.get("vault_root") or DEFAULT_VAULT
    path = expand_user(str(raw))
    if is_forbidden_vault(path):
        raise ValueError(
            f"refusing vault {path} — Internal Documents is too tight; "
            f"use {DEFAULT_VAULT} or set FC_PRESERVE_VAULT to the Data volume"
        )
    return path


def backup_password(cfg: dict[str, Any] | None = None) -> str | None:
    env_name = "FC_PRESERVE_BACKUP_PASSWORD"
    if cfg:
        env_name = str(cfg.get("ios", {}).get("password_env") or env_name)
    val = os.environ.get(env_name, "")
    return val if val else None


def device_alias(cfg: dict[str, Any], name: str) -> dict[str, Any] | None:
    devices = cfg.get("devices") or {}
    key = name.strip()
    if key in devices:
        return dict(devices[key])
    lower = key.lower()
    for alias, spec in devices.items():
        if alias.lower() == lower:
            return dict(spec)
        if str(spec.get("udid", "")).lower() == lower:
            return dict(spec)
        if str(spec.get("serial", "")).upper() == key.upper():
            return dict(spec)
    return None
