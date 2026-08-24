"""Optional 3-step TTY flow. No curses — agent shells must never hang."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, TextIO

from .devices import Device, ProbeResult
from . import DEFAULT_VAULT


def is_tty(stdin: TextIO | None = None) -> bool:
    stream = stdin if stdin is not None else sys.stdin
    try:
        return bool(stream.isatty())
    except Exception:
        return False


def render_devices(probe: ProbeResult) -> str:
    lines = ["SELECT DEVICE"]
    if probe.hotspot_ncm:
        lines.append(f"  ! HOTSPOT/NCM  {probe.message}")
    for i, d in enumerate(probe.devices, 1):
        flag = "PRESERVE-ONLY" if d.preserve_only else (d.flavor or d.platform)
        present = "usb" if d.present else "configured"
        extra = d.udid[:12] + ("…" if len(d.udid) > 12 else "") if d.udid else "—"
        lines.append(f"  [{i}] {d.label:<16} {d.product or d.platform:<12} {flag:<16} {present}  {extra}")
    return "\n".join(lines)


def pick_device(probe: ProbeResult, raw: str) -> Device:
    raw = raw.strip()
    if raw.isdigit():
        idx = int(raw)
        if 1 <= idx <= len(probe.devices):
            return probe.devices[idx - 1]
        raise ValueError(f"device index {idx} out of range")
    found = probe.by_alias(raw)
    if found:
        return found
    raise ValueError(f"unknown device {raw!r}")


def interactive(
    probe: ProbeResult,
    vault: Path,
    *,
    stdin: TextIO | None = None,
    stdout: TextIO | None = None,
) -> tuple[Device, Path, str]:
    """Returns (device, vault, action) where action is backup|flash."""
    inp = stdin if stdin is not None else sys.stdin
    out = stdout if stdout is not None else sys.stdout
    if not is_tty(inp):
        raise RuntimeError("etcher interactive requires a TTY; use: fcs preserve all GrokBotBaby")

    def ask(prompt: str) -> str:
        out.write(prompt)
        out.flush()
        return inp.readline()

    out.write("fcs preserve · etcher\n")
    out.write("1) SELECT DEVICE   2) SELECT TARGET   3) BACKUP / FLASH\n\n")
    out.write(render_devices(probe) + "\n")
    default_idx = "1"
    for i, d in enumerate(probe.devices, 1):
        if d.present:
            default_idx = str(i)
            break
    choice = ask(f"device [{default_idx}]: ").strip() or default_idx
    device = pick_device(probe, choice)

    out.write("\nSELECT TARGET vault\n")
    out.write(f"  default: {vault}\n")
    if str(vault) != DEFAULT_VAULT and DEFAULT_VAULT.startswith("/Volumes/"):
        out.write(f"  configured default remains: {DEFAULT_VAULT}\n")
    raw_vault = ask(f"vault [{vault}]: ").strip()
    target = Path(raw_vault) if raw_vault else vault

    out.write("\nBACKUP or FLASH\n")
    if device.preserve_only:
        out.write("  Brick is preserve-only — FLASH is refused.\n")
    action_default = "backup"
    raw_action = ask(f"action [backup]: ").strip().lower() or action_default
    if raw_action in ("f", "flash", "linux"):
        action = "flash"
    else:
        action = "backup"
    return device, target, action
