"""Flash notes — printed only when linux-gate ready. Brick never passes."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .devices import Device, brick_never_flash
from .gate import flash_gate_ok, read_gate


def flash_notes(device: Device, stamp: Path, vault: Path, gate: dict[str, Any] | None = None) -> str:
    gate = gate if gate is not None else read_gate(stamp)
    ok, reason = flash_gate_ok(gate, device)
    if brick_never_flash(device) or not ok:
        return (
            "FLASH REFUSED\n"
            f"  device: {device.alias or device.name}\n"
            f"  reason: {reason}\n"
            "  Brick (daily iPhone 14 class / Continuity) is preserve-only and can never pass this gate.\n"
            "  GrokBotBaby is the iPhone 7 Plus linux-test device — preserve, then gated flash.\n"
        )
    flavor = device.flavor or "postmarketos"
    images = vault / "images" / flavor
    return (
        f"GrokBotBaby flash notes (linux-gate ready)\n"
        f"==========================================\n"
        f"device:  {device.alias or device.name}\n"
        f"flavor:  {flavor}\n"
        f"role:    linux-test\n"
        f"vault:   {vault}\n"
        f"stamp:   {stamp}\n"
        f"images:  {images}\n"
        "\n"
        "This command prints notes only. It does not start Elffin, embed WebKit,\n"
        "add a second GPU host, or run fastboot/dd.\n"
        "\n"
        "1. Confirm the device is GrokBotBaby (linux-test), not Brick.\n"
        "2. Enter fastboot only if you intend to write an image later.\n"
        f"3. Look for a postmarketOS image under {images}\n"
        "4. After a real flash, re-run: fcs preserve backup GrokBotBaby\n"
    )
