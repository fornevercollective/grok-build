#!/usr/bin/env python3
"""Unit tests for fc-preserve-etcher-v1 — no USB hardware required."""

from __future__ import annotations

import hashlib
import io
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from fc_preserve import DEFAULT_VAULT, GROKBOTBABY_SERIAL, GROKBOTBABY_UDID
from fc_preserve.backup import BackupError, detect_icloud_optimize, refuse_if_hotspot, run_idevicebackup2
from fc_preserve.catalog import write_catalog
from fc_preserve.config import is_forbidden_vault, load_default, resolve_vault
from fc_preserve.custody import write_custody
from fc_preserve.devices import Device, NetIface, ProbeResult, UsbNode, detect_hotspot_ncm, probe, resolve_requested
from fc_preserve.etcher import is_tty, pick_device, render_devices
from fc_preserve.extract import extract_domains
from fc_preserve.flash import flash_notes
from fc_preserve.gate import STUB_BYTES, compute_gate, flash_gate_ok, write_gate
from fc_preserve.pipeline import run_all
from fc_preserve.progress import RunLog, flush_cr_stream
from fc_preserve.stamp import already_received, find_incomplete, resolve_stamp
from fc_preserve.verify import verify_stamp


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()


def _write(path: Path, data: bytes | str = b"x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8")
    else:
        path.write_bytes(data)


def _ios_backup(root: Path) -> Path:
    """Minimal unencrypted iOS backup with required domains on disk."""
    files = [
        ("CameraRollDomain", "Media/DCIM/100APPLE/IMG_0001.HEIC", b"photo-bytes"),
        ("HomeDomain", "Library/SMS/sms.db", b"sms-db"),
        ("HomeDomain", "Library/AddressBook/AddressBook.sqlitedb", b"ab-db"),
        ("AppDomain-com.atebits.Tweetie2", "Library/Preferences/com.atebits.Tweetie2.plist", b"x-app"),
    ]
    root.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(root / "Manifest.db")
    con.execute(
        "CREATE TABLE Files (fileID TEXT PRIMARY KEY, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB)"
    )
    for domain, rel, blob in files:
        fid = _sha1(f"{domain}-{rel}")
        con.execute(
            "INSERT INTO Files (fileID, domain, relativePath, flags, file) VALUES (?,?,?,?,?)",
            (fid, domain, rel, 1, None),
        )
        _write(root / fid[:2] / fid, blob)
    con.commit()
    con.close()
    _write(root / "Status.plist", "complete")
    _write(root / "Info.plist", "GrokBotBaby")
    return root


class ConfigTests(unittest.TestCase):
    def test_default_vault_is_data_volume(self) -> None:
        cfg = load_default()
        self.assertEqual(cfg["vault_root"], DEFAULT_VAULT)
        self.assertEqual(DEFAULT_VAULT, "/Volumes/MacBookPro - Data/FC-Preserve")
        self.assertNotIn("Documents", DEFAULT_VAULT)

    def test_refuses_documents_vault(self) -> None:
        self.assertTrue(is_forbidden_vault(Path.home() / "Documents" / "FC-Preserve"))
        with self.assertRaises(ValueError):
            resolve_vault(load_default(), str(Path.home() / "Documents" / "FC-Preserve"))

    def test_aliases_are_not_swapped(self) -> None:
        cfg = load_default()
        baby = cfg["devices"]["GrokBotBaby"]
        brick = cfg["devices"]["Brick"]
        self.assertEqual(baby["udid"], GROKBOTBABY_UDID)
        self.assertEqual(baby["serial"], GROKBOTBABY_SERIAL)
        self.assertEqual(baby["product"], "iPhone9,4")
        self.assertEqual(baby["hardware"], "D111AP")
        self.assertEqual(baby["role"], "linux-test")
        self.assertEqual(baby["flash"], "gated")
        self.assertFalse(baby["preserve_only"])
        self.assertNotEqual(brick.get("udid"), GROKBOTBABY_UDID)
        self.assertNotIn("4ea7e05b3045f0e9036275125a85225dd6dd9bb9", json.dumps(brick))
        self.assertTrue(brick["preserve_only"])
        self.assertEqual(brick["flash"], False)
        self.assertEqual(cfg["vault_root"], DEFAULT_VAULT)

    def test_password_default_unset(self) -> None:
        from fc_preserve.config import backup_password

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("FC_PRESERVE_BACKUP_PASSWORD", None)
            self.assertIsNone(backup_password(load_default()))
        with patch.dict(os.environ, {"FC_PRESERVE_BACKUP_PASSWORD": "secret"}):
            self.assertEqual(backup_password(load_default()), "secret")


class HotspotTests(unittest.TestCase):
    def test_usb_plus_empty_mux_plus_en9_is_hotspot(self) -> None:
        self.assertTrue(
            detect_hotspot_ncm(
                [UsbNode(name="iPhone")],
                [],
                [NetIface(name="en9", up=True, addrs=["169.254.12.34"])],
            )
        )

    def test_mux_present_is_not_hotspot(self) -> None:
        self.assertFalse(
            detect_hotspot_ncm(
                [UsbNode(name="iPhone")],
                [GROKBOTBABY_UDID],
                [NetIface(name="en9", up=True, addrs=["169.254.12.34"])],
            )
        )

    def test_probe_message_is_hotspot_not_brew(self) -> None:
        cfg = load_default()
        result = probe(
            cfg,
            mux=lambda: [],
            adb=lambda: [],
            usb=lambda: [UsbNode(name="iPhone 7 Plus")],
            ifaces=lambda: [NetIface(name="en9", up=True, addrs=["169.254.1.2"])],
        )
        self.assertTrue(result.hotspot_ncm)
        self.assertIn("Personal Hotspot", result.message or "")
        self.assertIn("unplug", (result.message or "").lower())
        self.assertNotIn("brew install libimobiledevice until", (result.message or "")[:40])
        # brew is mentioned only as "do not brew install"
        self.assertIn("do not brew install", result.message or "")
        with self.assertRaises(BackupError) as ctx:
            refuse_if_hotspot(result)
        self.assertEqual(ctx.exception.kind, "hotspot")


class StampResumeTests(unittest.TestCase):
    def test_incomplete_stamp_is_reused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            device = Device(alias="Brick", platform="ios", udid="", preserve_only=True)
            first = resolve_stamp(vault, device)
            _write(first / "preserve.log", "drop 255\n")
            second = resolve_stamp(vault, device)
            self.assertEqual(first, second)
            self.assertEqual(find_incomplete(vault, device), first)

    def test_complete_stamp_opens_new(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            device = Device(
                alias="GrokBotBaby",
                platform="ios",
                udid=GROKBOTBABY_UDID,
                serial=GROKBOTBABY_SERIAL,
                flavor="postmarketos",
                role="linux-test",
                flash="gated",
            )
            first = resolve_stamp(vault, device)
            write_gate(
                first,
                compute_gate(device, first, backup_ok=True, domains_extracted=True, hashes_written=True),
            )
            from fc_preserve.stamp import write_json

            write_json(first / "summary.json", {"ok": True, "backup_ok": True})
            _write(first / "extract" / "Manifest.db", b"db")
            write_gate(
                first,
                compute_gate(device, first, backup_ok=True, domains_extracted=True, hashes_written=True),
            )
            third = resolve_stamp(vault, device)
            self.assertNotEqual(first, third)

    def test_skip_already_received(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "file.bin"
            self.assertFalse(already_received(p))
            _write(p, b"hello")
            self.assertTrue(already_received(p))


class ProgressTests(unittest.TestCase):
    def test_cr_flushed_as_newlines(self) -> None:
        raw = b"10%  file A\r20%  file B\r30%  file C\n"
        text = flush_cr_stream(raw)
        self.assertIn("10%", text)
        self.assertIn("file C", text)
        self.assertNotIn("\r", text)
        with tempfile.TemporaryDirectory() as tmp:
            log_path = Path(tmp) / "preserve.log"
            buf = io.StringIO()
            with RunLog(log_path, also=buf) as log:
                log.feed_bytes(raw)
                log.progress(pct=40.0, rate_mbs=12.5, last="HomeDomain/Library/SMS/sms.db")
            data = log_path.read_text(encoding="utf-8")
            self.assertIn("file A", data)
            self.assertIn("40.0%", data)
            self.assertIn("12.50 MB/s", data)
            self.assertIn("sms.db", data)
            self.assertGreaterEqual(data.count("\n"), 4)


class PipelineTests(unittest.TestCase):
    def test_ios_full_gate_ready(self) -> None:
        cfg = load_default()
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            src = _ios_backup(Path(tmp) / "src")
            device = Device(
                alias="GrokBotBaby",
                platform="ios",
                udid=GROKBOTBABY_UDID,
                serial=GROKBOTBABY_SERIAL,
                product="iPhone9,4",
                hardware="D111AP",
                flavor="postmarketos",
                role="linux-test",
                flash="gated",
                present=True,
            )
            buf = io.StringIO()
            with RunLog(None, also=buf) as log:
                summary = run_all(cfg, device, vault, log, source_dir=src, skip_afc=True)
            self.assertTrue(summary["backup_ok"])
            self.assertTrue(summary["gate"]["ready"])
            self.assertTrue(summary["ok"])
            self.assertTrue(summary["gate"]["flash_allowed"])
            self.assertTrue((vault / "runs").exists())
            self.assertIn("Manifest.db", (next((vault / "runs").iterdir()) / "extract" / "Manifest.db").name)

    def test_linux_gbb_ready_then_flash_notes(self) -> None:
        cfg = load_default()
        with tempfile.TemporaryDirectory() as tmp:
            vault = Path(tmp)
            src = _ios_backup(Path(tmp) / "src")
            device = Device(
                alias="GrokBotBaby",
                platform="ios",
                udid=GROKBOTBABY_UDID,
                serial=GROKBOTBABY_SERIAL,
                product="iPhone9,4",
                flavor="postmarketos",
                role="linux-test",
                flash="gated",
                present=True,
            )
            buf = io.StringIO()
            with RunLog(None, also=buf) as log:
                summary = run_all(cfg, device, vault, log, source_dir=src, skip_afc=True)
            self.assertTrue(summary["ok"])
            self.assertTrue(summary["gate"]["ready"])
            self.assertTrue(summary["gate"]["flash_allowed"])
            stamp = vault / "runs" / summary["stamp"]
            notes = flash_notes(device, stamp, vault, summary["gate"])
            self.assertIn("linux-gate ready", notes)
            self.assertIn("postmarketos", notes)
            self.assertNotIn("FLASH REFUSED", notes)

    def test_stub_388mb_never_success(self) -> None:
        cfg = load_default()
        with tempfile.TemporaryDirectory() as tmp:
            stamp = Path(tmp)
            device = Device(alias="Brick", platform="ios", udid="", preserve_only=True)
            gate = compute_gate(
                device,
                stamp,
                backup_ok=False,
                domains_extracted=False,
                hashes_written=False,
                bytes_copied=STUB_BYTES,
            )
            self.assertFalse(gate["ready"])
            self.assertFalse(gate["looks_like_success"])
            self.assertFalse(gate["backup_ok"])
            v = verify_stamp(cfg, stamp, "ios", RunLog(None, also=io.StringIO()))
            self.assertFalse(v["ok"])
            self.assertIn("Manifest.db", v["missing"])

    def test_brick_never_passes_flash_even_if_ready(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            stamp = Path(tmp)
            _write(stamp / "extract" / "Manifest.db", b"db")
            device = Device(alias="Brick", platform="ios", udid="", product="iPhone14,7", preserve_only=True)
            gate = compute_gate(device, stamp, backup_ok=True, domains_extracted=True, hashes_written=True)
            ok, reason = flash_gate_ok(gate, device)
            self.assertFalse(ok)
            self.assertIn("NEVER flash", reason)
            notes = flash_notes(device, stamp, Path(tmp), gate)
            self.assertIn("FLASH REFUSED", notes)

    def test_icloud_optimize_marked_honest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            stamp = Path(tmp)
            _write(stamp / "dcim" / "IMG_0001.HEIC", b"local")
            _write(stamp / "dcim" / "IMG_9999.HEIC.icloud", b"")
            info = detect_icloud_optimize(stamp)
            self.assertTrue(info["honest"])
            self.assertGreaterEqual(info["originals_on_device"], 1)
            self.assertGreaterEqual(info["placeholders_skipped"], 1)
            self.assertIn("not on the device", info["note"])

    def test_idevicebackup2_retries_same_dest(self) -> None:
        cfg = load_default()
        attempts: list[str] = []

        def runner(cmd, env=None):
            attempts.append(cmd[-1])
            if len(attempts) < 3:
                return subprocess.CompletedProcess(cmd, 255, stdout="mobilebackup2 -4\r12%\r", stderr="")
            return subprocess.CompletedProcess(cmd, 0, stdout="100%\n", stderr="")

        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "backup"
            device = Device(alias="GrokBotBaby", platform="ios", udid=GROKBOTBABY_UDID, serial=GROKBOTBABY_SERIAL)
            buf = io.StringIO()
            with RunLog(None, also=buf) as log:
                result = run_idevicebackup2(cfg, device, dest, log, runner=runner)
            self.assertTrue(result["backup_ok"])
            self.assertEqual(len(attempts), 3)
            self.assertEqual(len(set(attempts)), 1)


class CatalogExtractTests(unittest.TestCase):
    def test_catalog_writes_per_app_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            stamp = Path(tmp)
            _ios_backup(stamp / "backup")
            buf = io.StringIO()
            with RunLog(None, also=buf) as log:
                extract_domains(stamp, log)
                cat = write_catalog(stamp, log)
                cus = write_custody(stamp, log)
            self.assertTrue(cat["ok"])
            self.assertGreaterEqual(cat["count"], 1)
            self.assertTrue((stamp / "catalog" / "_index.json").is_file())
            tweetie = stamp / "catalog" / "com.atebits.Tweetie2.json"
            self.assertTrue(tweetie.is_file())
            rec = json.loads(tweetie.read_text(encoding="utf-8"))
            self.assertEqual(rec["bundleId"], "com.atebits.Tweetie2")
            self.assertTrue(cus["hashes_written"])
            self.assertTrue((stamp / "extract" / "photos").exists())
            self.assertTrue((stamp / "extract" / "messages" / "Library" / "SMS" / "sms.db").is_file())


class EtcherCliTests(unittest.TestCase):
    def test_non_tty_default_is_all_grokbotbaby(self) -> None:
        from fc_preserve.cli import main

        fake_in = io.StringIO("")
        fake_in.isatty = lambda: False  # type: ignore[method-assign]
        out = io.StringIO()
        err = io.StringIO()
        with tempfile.TemporaryDirectory() as tmp:
            src = _ios_backup(Path(tmp) / "src")
            rc = main(
                ["--vault", tmp, "--source-dir", str(src), "--json"],
                stdin=fake_in,
                stdout=out,
                stderr=err,
            )
        self.assertEqual(rc, 0)
        payload = json.loads(out.getvalue())
        self.assertEqual(payload["device"], "GrokBotBaby")
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["gate"]["flash_allowed"])

    def test_etcher_refuses_without_tty(self) -> None:
        from fc_preserve.cli import main

        fake_in = io.StringIO("1\n\nbackup\n")
        fake_in.isatty = lambda: False  # type: ignore[method-assign]
        out = io.StringIO()
        err = io.StringIO()
        with tempfile.TemporaryDirectory() as tmp:
            src = _ios_backup(Path(tmp) / "src")
            rc = main(
                ["etcher", "--vault", tmp, "--source-dir", str(src), "--json"],
                stdin=fake_in,
                stdout=out,
                stderr=err,
            )
        self.assertEqual(rc, 0)
        self.assertIn("GrokBotBaby", out.getvalue())

    def test_pick_device_and_render(self) -> None:
        cfg = load_default()
        result = probe(cfg, mux=lambda: [], adb=lambda: [], usb=lambda: [], ifaces=lambda: [])
        text = render_devices(result)
        self.assertIn("SELECT DEVICE", text)
        self.assertIn("Brick", text)
        self.assertIn("GrokBotBaby", text)
        self.assertIn("PRESERVE-ONLY", text)
        brick = pick_device(result, "Brick")
        self.assertEqual(brick.alias, "Brick")
        self.assertTrue(brick.preserve_only)
        self.assertNotEqual(brick.udid, GROKBOTBABY_UDID)
        baby = pick_device(result, "GrokBotBaby")
        self.assertEqual(baby.udid, GROKBOTBABY_UDID)
        self.assertEqual(baby.serial, GROKBOTBABY_SERIAL)
        self.assertEqual(baby.role, "linux-test")
        self.assertFalse(baby.preserve_only)
        self.assertFalse(is_tty(io.StringIO("")))

    def test_flash_brick_refused_without_stamp(self) -> None:
        from fc_preserve.cli import main

        out = io.StringIO()
        err = io.StringIO()
        with tempfile.TemporaryDirectory() as tmp:
            rc = main(["flash", "Brick", "--vault", tmp], stdin=io.StringIO(""), stdout=out, stderr=err)
        self.assertEqual(rc, 4)
        self.assertIn("FLASH REFUSED", out.getvalue())
        self.assertIn("NEVER flash", out.getvalue())

    def test_probe_json_hotspot_exit(self) -> None:
        from fc_preserve.cli import main

        out = io.StringIO()
        err = io.StringIO()
        with patch("fc_preserve.cli.probe_devices") as mocked:
            mocked.return_value = ProbeResult(
                devices=[],
                usb_iphones=[UsbNode(name="iPhone")],
                mux_udids=[],
                hotspot_ncm=True,
                message="Personal Hotspot / USB-NCM likely stole the cable",
                ifaces=[NetIface(name="en9", up=True, addrs=["169.254.1.1"])],
            )
            rc = main(["probe", "--json"], stdin=io.StringIO(""), stdout=out, stderr=err)
        self.assertEqual(rc, 3)
        self.assertIn("Personal Hotspot", out.getvalue())

    def test_seven_plus_udid_maps_to_grokbotbaby_not_brick(self) -> None:
        cfg = load_default()
        result = probe(
            cfg,
            mux=lambda: [GROKBOTBABY_UDID],
            adb=lambda: [],
            usb=lambda: [UsbNode(name="iPhone 7 Plus")],
            ifaces=lambda: [],
        )
        baby = result.by_alias("GrokBotBaby")
        self.assertIsNotNone(baby)
        assert baby is not None
        self.assertTrue(baby.present)
        self.assertEqual(baby.udid, GROKBOTBABY_UDID)
        self.assertNotEqual((baby.alias or "").lower(), "brick")
        brick = result.by_alias("Brick")
        self.assertIsNotNone(brick)
        assert brick is not None
        self.assertFalse(brick.present)
        self.assertNotEqual(brick.udid, GROKBOTBABY_UDID)


class FcsWireTests(unittest.TestCase):
    def test_fcs_body_dispatches_preserve(self) -> None:
        fcs = HERE.parent / "scripts" / "fcs"
        text = fcs.read_text(encoding="utf-8")
        self.assertIn("cmd_preserve", text)
        self.assertIn("preserve|etcher|backup-phone", text)
        self.assertIn("preserve/preserve.py", text)


if __name__ == "__main__":
    unittest.main()
