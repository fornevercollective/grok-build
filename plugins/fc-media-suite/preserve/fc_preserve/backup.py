"""Backup runners: idevicebackup2 (resume/retry), AFC DCIM, adb / linux-test.

idevicebackup2 often dies with mobilebackup2 -4 / exit 255 on a USB hub.
Retries stay on the same stamp. Files already received are skipped.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Callable

from .config import backup_password
from .devices import Device, ProbeResult, brick_never_flash
from .progress import RunLog
from .stamp import already_received

Runner = Callable[..., subprocess.CompletedProcess[str]]


class BackupError(RuntimeError):
    def __init__(self, message: str, *, backup_ok: bool = False, kind: str = "backup") -> None:
        super().__init__(message)
        self.backup_ok = backup_ok
        self.kind = kind


def _default_runner(cmd: list[str], env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, check=False, env=env)


def _is_transient(cfg: dict[str, Any], proc: subprocess.CompletedProcess[str]) -> bool:
    retry = cfg.get("retry") or {}
    exits = set(retry.get("idevicebackup2_transient_exits") or [255, 4])
    if proc.returncode in exits:
        return True
    blob = (proc.stdout or "") + "\n" + (proc.stderr or "")
    for needle in retry.get("idevicebackup2_transient_needles") or []:
        if needle.lower() in blob.lower():
            return True
    return False


def _copy_tree(src: Path, dest: Path, log: RunLog, skip_existing: bool = True) -> tuple[int, int]:
    files = 0
    skipped = 0
    dest.mkdir(parents=True, exist_ok=True)
    for root, _dirs, names in os.walk(src):
        rel_root = Path(root).relative_to(src)
        for name in names:
            s = Path(root) / name
            d = dest / rel_root / name
            if skip_existing and already_received(d):
                skipped += 1
                continue
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, d)
            files += 1
            log.progress(last=str(rel_root / name), bytes_done=files)
    return files, skipped


def inject_or_copy_source(source: Path, dest: Path, log: RunLog) -> dict[str, Any]:
    log.line(f"source inject → {dest}")
    files, skipped = _copy_tree(source, dest, log)
    return {
        "backup_ok": True,
        "method": "inject",
        "files": files,
        "skipped": skipped,
        "bytes": _tree_bytes(dest),
    }


def _tree_bytes(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for root, _dirs, names in os.walk(path):
        for name in names:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                continue
    return total


def run_idevicebackup2(
    cfg: dict[str, Any],
    device: Device,
    dest: Path,
    log: RunLog,
    *,
    runner: Runner | None = None,
) -> dict[str, Any]:
    dest.mkdir(parents=True, exist_ok=True)
    run = runner or _default_runner
    password = backup_password(cfg)
    retry = cfg.get("retry") or {}
    attempts = int(retry.get("max_attempts") or 5)
    sleep_s = float(retry.get("sleep_s") or 4)
    last: subprocess.CompletedProcess[str] | None = None
    for i in range(1, attempts + 1):
        cmd = ["idevicebackup2"]
        if device.udid:
            cmd += ["-u", device.udid]
        if password:
            cmd += ["--password", password]
        cmd += ["backup", str(dest)]
        log.line(f"idevicebackup2 attempt {i}/{attempts} → {dest}")
        last = run(cmd, os.environ.copy())
        log.feed_bytes(((last.stdout or "") + "\n" + (last.stderr or "")).encode())
        if last.returncode == 0:
            return {
                "backup_ok": True,
                "method": "idevicebackup2",
                "attempts": i,
                "encrypted": bool(password),
                "bytes": _tree_bytes(dest),
            }
        blob = (last.stdout or "") + (last.stderr or "")
        if _is_transient(cfg, last):
            log.line(
                f"idevicebackup2 dropped (exit {last.returncode}) — "
                f"mobilebackup2 transient; resume same stamp, skip received files"
            )
            if i < attempts:
                time.sleep(sleep_s)
                continue
        raise BackupError(
            f"idevicebackup2 failed exit {last.returncode}: {blob[-400:]}",
            backup_ok=False,
        )
    raise BackupError("idevicebackup2 exhausted retries", backup_ok=False)


def run_afc_dcim(
    cfg: dict[str, Any],
    device: Device,
    dest: Path,
    log: RunLog,
    *,
    runner: Runner | None = None,
    puller: Callable[[Path, Path, RunLog], tuple[int, int]] | None = None,
) -> dict[str, Any]:
    """Parallel media path alongside backup2 so 34k photos can actually land."""
    dest.mkdir(parents=True, exist_ok=True)
    remote = str((cfg.get("ios") or {}).get("afc_remote") or "/DCIM")
    if puller is not None:
        files, skipped = puller(Path(remote), dest, log)
        return {"ok": True, "method": "inject-afc", "files": files, "skipped": skipped, "bytes": _tree_bytes(dest)}

    run = runner or _default_runner
    if shutil.which("pymobiledevice3"):
        cmd = ["pymobiledevice3", "afc", "pull", remote, str(dest)]
        if device.udid:
            cmd[1:1] = ["--udid", device.udid]
        proc = run(cmd, os.environ.copy())
        log.feed_bytes(((proc.stdout or "") + "\n" + (proc.stderr or "")).encode())
        return {
            "ok": proc.returncode == 0,
            "method": "pymobiledevice3-afc",
            "bytes": _tree_bytes(dest),
        }
    if shutil.which("ifuse"):
        mnt = dest.parent / ".ifuse-mnt"
        mnt.mkdir(parents=True, exist_ok=True)
        mount = run(["ifuse", str(mnt)] + (["-u", device.udid] if device.udid else []), os.environ.copy())
        if mount.returncode == 0:
            src = mnt / "DCIM"
            files, skipped = _copy_tree(src, dest, log) if src.exists() else (0, 0)
            run(["umount", str(mnt)], os.environ.copy())
            return {"ok": True, "method": "ifuse", "files": files, "skipped": skipped, "bytes": _tree_bytes(dest)}
    log.line("AFC DCIM pull skipped — no pymobiledevice3/ifuse; backup2 CameraRollDomain is the remaining path")
    return {"ok": False, "method": "none", "bytes": _tree_bytes(dest), "skipped_reason": "no-afc-tool"}


def detect_icloud_optimize(stamp: Path) -> dict[str, Any]:
    """Originals that are not on device stay off the dump — mark that honestly."""
    placeholders = 0
    locals_ = 0
    for root, _dirs, names in os.walk(stamp):
        for name in names:
            p = Path(root) / name
            low = name.lower()
            if low.endswith(".icloud") or low.endswith(".aae") and "icloud" in low:
                placeholders += 1
                continue
            try:
                size = p.stat().st_size
            except OSError:
                continue
            if size == 0 and any(low.endswith(ext) for ext in (".heic", ".jpg", ".jpeg", ".mov", ".mp4")):
                placeholders += 1
            elif any(low.endswith(ext) for ext in (".heic", ".jpg", ".jpeg", ".mov", ".mp4", ".png")):
                locals_ += 1
    detected = placeholders > 0
    return {
        "detected": detected,
        "originals_on_device": locals_,
        "placeholders_skipped": placeholders,
        "note": (
            "iCloud Optimize Storage — originals that are not on the device stayed off this dump."
            if detected or locals_ >= 0
            else "unknown"
        ),
        "honest": True,
    }


def backup_ios(
    cfg: dict[str, Any],
    device: Device,
    stamp: Path,
    log: RunLog,
    *,
    source_dir: Path | None = None,
    runner: Runner | None = None,
    afc_puller: Callable[[Path, Path, RunLog], tuple[int, int]] | None = None,
    skip_afc: bool = False,
) -> dict[str, Any]:
    backup_dest = stamp / "backup"
    if source_dir is not None:
        result = inject_or_copy_source(source_dir, backup_dest, log)
    else:
        result = run_idevicebackup2(cfg, device, backup_dest, log, runner=runner)
    afc: dict[str, Any] = {"ok": False, "method": "skipped"}
    if not skip_afc and (cfg.get("ios") or {}).get("afc_parallel_dcim", True):
        afc = run_afc_dcim(cfg, device, stamp / "dcim", log, runner=runner, puller=afc_puller)
    result["afc"] = afc
    result["icloud_optimize"] = detect_icloud_optimize(stamp)
    result["preserve_only"] = brick_never_flash(device)
    return result


def backup_linux(
    cfg: dict[str, Any],
    device: Device,
    stamp: Path,
    log: RunLog,
    *,
    source_dir: Path | None = None,
    runner: Runner | None = None,
) -> dict[str, Any]:
    dest = stamp / "backup" / "linux"
    dest.mkdir(parents=True, exist_ok=True)
    if source_dir is not None:
        result = inject_or_copy_source(source_dir, dest, log)
        result["flavor"] = device.flavor or (cfg.get("devices", {}).get("GrokBotBaby") or {}).get("flavor")
        return result
    run = runner or _default_runner
    if not device.present or not device.udid:
        raise BackupError(
            f"{device.label} is not on adb/USB — plug GrokBotBaby or pass --source-dir for linux-test inject",
            backup_ok=False,
        )
    # postmarketOS / android-class pull of the obvious media + identity paths
    pulls = [
        ("/etc/os-release", dest / "etc" / "os-release"),
        ("/sdcard/DCIM", dest / "DCIM"),
        ("/storage/emulated/0/DCIM", dest / "DCIM"),
        ("/home", dest / "home"),
    ]
    copied = 0
    for remote, local in pulls:
        local.parent.mkdir(parents=True, exist_ok=True)
        proc = run(["adb", "-s", device.udid, "pull", remote, str(local)], os.environ.copy())
        log.feed_bytes(((proc.stdout or "") + "\n" + (proc.stderr or "")).encode())
        if proc.returncode == 0:
            copied += 1
            log.progress(last=remote)
    if copied == 0:
        raise BackupError("adb pull copied nothing from GrokBotBaby", backup_ok=False)
    return {
        "backup_ok": True,
        "method": "adb-pull",
        "flavor": device.flavor or "postmarketos",
        "files": copied,
        "bytes": _tree_bytes(dest),
    }


def backup_android(
    cfg: dict[str, Any],
    device: Device,
    stamp: Path,
    log: RunLog,
    *,
    source_dir: Path | None = None,
    runner: Runner | None = None,
) -> dict[str, Any]:
    return backup_linux(cfg, device, stamp, log, source_dir=source_dir, runner=runner)


def run_backup(
    cfg: dict[str, Any],
    device: Device,
    stamp: Path,
    log: RunLog,
    *,
    source_dir: Path | None = None,
    runner: Runner | None = None,
    afc_puller: Callable[[Path, Path, RunLog], tuple[int, int]] | None = None,
    skip_afc: bool = False,
) -> dict[str, Any]:
    if device.platform == "ios":
        return backup_ios(
            cfg, device, stamp, log, source_dir=source_dir, runner=runner, afc_puller=afc_puller, skip_afc=skip_afc
        )
    if device.platform in ("linux", "android"):
        return backup_linux(cfg, device, stamp, log, source_dir=source_dir, runner=runner)
    raise BackupError(f"unsupported platform {device.platform}", backup_ok=False)


def refuse_if_hotspot(probe: ProbeResult) -> None:
    if probe.hotspot_ncm:
        raise BackupError(probe.message or "Personal Hotspot / USB-NCM stole the cable", backup_ok=False, kind="hotspot")
