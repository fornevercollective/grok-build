"""fcs preserve CLI — agent-safe, Etcher-shaped, no hung curses."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Sequence

from . import DEFAULT_VAULT, FEATURE_ID, __version__
from .config import load_default, resolve_vault
from .devices import default_non_tty_device, probe as probe_devices, resolve_requested
from .etcher import interactive, is_tty, render_devices
from .flash import flash_notes
from .gate import flash_gate_ok, read_gate
from .pipeline import latest_stamp, run_all
from .progress import RunLog


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="fcs preserve",
        description="Etcher-style device backup / gated flash (fc-preserve-etcher-v1)",
    )
    p.add_argument(
        "command",
        nargs="?",
        default=None,
        help="etcher | probe | all | backup | verify | linux | flash | resume | help",
    )
    p.add_argument("device", nargs="?", default=None, help="Brick | GrokBotBaby | UDID | adb serial")
    p.add_argument("--vault", default=None, help=f"target vault (default: {DEFAULT_VAULT})")
    p.add_argument("--source-dir", default=None, help="inject a local tree (tests / linux-test)")
    p.add_argument("--new", action="store_true", help="force a new stamp instead of resuming")
    p.add_argument("--no-afc", action="store_true", help="skip parallel AFC DCIM pull")
    p.add_argument("--json", action="store_true", help="print summary JSON")
    p.add_argument("--config", default=None, help="override default.json")
    return p


def _print_probe(result, out) -> None:
    out.write(render_devices(result) + "\n")
    if result.hotspot_ncm:
        out.write("\n" + (result.message or "") + "\n")
    elif result.message:
        out.write("\n" + result.message + "\n")
    tools = ", ".join(f"{k}={'yes' if v else 'no'}" for k, v in sorted(result.tools.items()))
    out.write(f"tools: {tools}\n")


def main(argv: Sequence[str] | None = None, *, stdin=None, stdout=None, stderr=None) -> int:
    stdin = stdin if stdin is not None else sys.stdin
    stdout = stdout if stdout is not None else sys.stdout
    stderr = stderr if stderr is not None else sys.stderr
    args = _parser().parse_args(list(argv) if argv is not None else None)

    if args.command in (None, "help", "-h"):
        if args.command in ("help", "-h"):
            stdout.write(_help_text())
            return 0
        # default: TTY → etcher; non-TTY → all GrokBotBaby
        if is_tty(stdin) and os.environ.get("FCS_AGENT", "0") != "1":
            args.command = "etcher"
        else:
            args.command = "all"
            args.device = args.device or default_non_tty_device({})

    cfg = load_default(Path(args.config) if args.config else None)
    try:
        vault = resolve_vault(cfg, args.vault)
    except ValueError as exc:
        stderr.write(f"error: {exc}\n")
        return 2

    source = Path(args.source_dir) if args.source_dir else None
    result = probe_devices(cfg)

    if args.command in ("probe", "devices"):
        _print_probe(result, stdout)
        if args.json:
            stdout.write(
                json.dumps(
                    {
                        "hotspot_ncm": result.hotspot_ncm,
                        "mux_udids": result.mux_udids,
                        "adb_serials": result.adb_serials,
                        "message": result.message,
                    },
                    indent=2,
                )
                + "\n"
            )
        return 0 if not result.hotspot_ncm else 3

    if args.command == "etcher":
        if not is_tty(stdin):
            stderr.write("etcher needs a TTY; falling back to: fcs preserve all GrokBotBaby\n")
            args.command = "all"
            args.device = args.device or "GrokBotBaby"
        else:
            try:
                device, vault, action = interactive(result, vault, stdin=stdin, stdout=stdout)
            except (RuntimeError, ValueError) as exc:
                stderr.write(f"error: {exc}\n")
                return 2
            args.command = "flash" if action == "flash" else "all"
            args.device = device.alias or device.udid or device.name

    name = args.device or default_non_tty_device(cfg)
    try:
        device = resolve_requested(result, cfg, name)
    except KeyError as exc:
        stderr.write(f"error: {exc}\n")
        return 2

    stamp_hint = latest_stamp(vault, device)
    log_path = None
    if args.command in ("all", "backup", "resume"):
        # resolve stamp up front so the run log lands in the reused folder
        from .stamp import resolve_stamp as _rs

        pre = _rs(vault, device, force_new=args.new)
        log_path = pre / "preserve.log"

    with RunLog(log_path, also=stderr) as log:
        if args.command in ("all", "backup", "resume"):
            log.line(f"{FEATURE_ID} v{__version__}")
            log.line(f"vault  {vault}")
            if result.hotspot_ncm and device.platform == "ios":
                log.line(result.message or "hotspot")
                _fail_summary(vault, device, result.message or "hotspot", stdout, args.json)
                return 3
            summary = run_all(
                cfg,
                device,
                vault,
                log,
                probe=result,
                source_dir=source,
                force_new=args.new,
                skip_afc=args.no_afc,
            )
            if args.json:
                stdout.write(json.dumps(summary, indent=2) + "\n")
            else:
                stdout.write(_human_summary(summary) + "\n")
            return 0 if summary.get("ok") else 1

        if args.command in ("verify", "gate"):
            stamp = stamp_hint
            if stamp is None:
                stderr.write("error: no stamp to verify\n")
                return 2
            from .verify import verify_stamp
            from .gate import compute_gate, write_gate
            from .custody import write_custody

            v = verify_stamp(cfg, stamp, device.platform, log)
            c = write_custody(stamp, log)
            gate = compute_gate(
                device,
                stamp,
                backup_ok=bool((stamp / "summary.json").exists()),
                domains_extracted=bool(v.get("domains_extracted")),
                hashes_written=bool(c.get("hashes_written")),
            )
            # re-read backup_ok from summary if present
            summary = {}
            sp = stamp / "summary.json"
            if sp.is_file():
                try:
                    summary = json.loads(sp.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    summary = {}
            gate = compute_gate(
                device,
                stamp,
                backup_ok=bool(summary.get("backup_ok")),
                domains_extracted=bool(v.get("domains_extracted")),
                hashes_written=bool(c.get("hashes_written")),
                bytes_copied=int(summary.get("bytes") or 0),
            )
            write_gate(stamp, gate)
            stdout.write(json.dumps({"verify": v, "gate": gate}, indent=2) + "\n")
            return 0 if gate.get("ready") else 1

        if args.command in ("linux", "flash"):
            stamp = stamp_hint
            if stamp is None:
                stderr.write("error: no stamp — run fcs preserve all first\n")
                return 2
            gate = read_gate(stamp)
            notes = flash_notes(device, stamp, vault, gate)
            stdout.write(notes)
            if args.json:
                ok, reason = flash_gate_ok(gate, device)
                stdout.write(json.dumps({"ok": ok, "reason": reason, "gate": gate}, indent=2) + "\n")
            ok, _reason = flash_gate_ok(gate, device)
            return 0 if ok else 4

    stderr.write(f"unknown command: {args.command}\n")
    return 2


def _human_summary(summary: dict[str, Any]) -> str:
    gate = summary.get("gate") or {}
    icloud = summary.get("icloud_optimize") or {}
    lines = [
        f"device     {summary.get('device')}",
        f"stamp      {summary.get('stamp')}",
        f"vault      {summary.get('vault')}",
        f"backup_ok  {summary.get('backup_ok')}",
        f"bytes      {summary.get('bytes')}",
        f"ready      {gate.get('ready')}",
        f"flash      {gate.get('flash_allowed')}",
    ]
    if icloud:
        lines.append(f"icloud     {icloud.get('note')}")
    if not summary.get("ok"):
        lines.append("RESULT     FAILED  (stub / incomplete dump is never success)")
    else:
        lines.append("RESULT     OK  linux-gate ready")
    return "\n".join(lines)


def _fail_summary(vault: Path, device, message: str, stdout, as_json: bool) -> None:
    payload = {
        "ok": False,
        "backup_ok": False,
        "looks_like_success": False,
        "device": device.alias or device.name,
        "vault": str(vault),
        "error": message,
    }
    if as_json:
        stdout.write(json.dumps(payload, indent=2) + "\n")
    else:
        stdout.write(f"FAILED  {message}\n")


def _help_text() -> str:
    return f"""fcs preserve · {FEATURE_ID} v{__version__}

Etcher-shaped device backup / gated flash. Not a fork of Etcher, Phosphor,
OpenExtract, or IntuneBrew — inspired by their UX / Manifest.db / export /
per-app JSON catalog.

Steps:
  1) SELECT DEVICE   live USB probe (iOS libimobiledevice, Android adb)
  2) SELECT TARGET   default {DEFAULT_VAULT}
  3) BACKUP or FLASH flash refused unless linux-gate ready=true

Commands:
  fcs preserve                 TTY → 3-step etcher; non-TTY → all GrokBotBaby
  fcs preserve etcher          interactive 3-step (TTY only)
  fcs preserve probe           live USB + hotspot/NCM diagnosis
  fcs preserve all GrokBotBaby backup → extract → catalog → sha256 → gate
  fcs preserve backup Brick    preserve-only (NEVER flash)
  fcs preserve linux GrokBotBaby   flash notes iff gate.ready
  fcs preserve flash Brick     always refused

Env:
  FC_PRESERVE_VAULT              override vault (never ~/Documents)
  FC_PRESERVE_BACKUP_PASSWORD    encrypted iOS backup; unset = unencrypted
  FC_PRESERVE_DEVICE             non-TTY default device (GrokBotBaby)
  FCS_AGENT=1                    force non-interactive

Aliases: GrokBotBaby (linux-test, postmarketos) · Brick (iPhone9,4 daily)
"""
