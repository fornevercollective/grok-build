"""Live USB probe + known aliases (Brick, GrokBotBaby).

Hotspot / USB-NCM is a production Mini failure mode: iPhone 7 Plus
enumerates on USB but usbmux count is 0 because Personal Hotspot stole
the cable (en9 169.254). That must print the hotspot hint — never
"no phone / brew install libimobiledevice".
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Any, Callable

from . import GROKBOTBABY_SERIAL, GROKBOTBABY_UDID
from .config import device_alias

USB_ETH_RE = re.compile(r"^(en[7-9]|en1[0-9]|usb\d+|enx|ncm|rndis)", re.I)
APPLE_USB_RE = re.compile(r"iPhone|Apple Mobile Device|iPad", re.I)
LINK_LOCAL_PREFIX = "169.254."

HOTSPOT_MSG = (
    "iPhone is on USB but usbmux sees 0 devices. "
    "Personal Hotspot / USB-NCM likely stole the cable "
    "(link-local 169.254 on a USB ethernet iface). "
    "Turn OFF Personal Hotspot, then unplug and replug the Lightning cable "
    "(prefer a direct port, not a USB hub). "
    "This is not a missing-tool problem — do not brew install libimobiledevice "
    "until idevice_id -l lists the phone."
)

MISSING_TOOLS_MSG = (
    "no phone on usbmux and no Apple USB node. "
    "If you expected a device: brew install libimobiledevice (and/or android-platform-tools)."
)


@dataclass
class UsbNode:
    vendor: str = ""
    product: str = ""
    name: str = ""


@dataclass
class NetIface:
    name: str
    up: bool
    addrs: list[str] = field(default_factory=list)

    @property
    def link_local(self) -> bool:
        return any(a.startswith(LINK_LOCAL_PREFIX) for a in self.addrs)

    @property
    def looks_usb_eth(self) -> bool:
        return bool(USB_ETH_RE.match(self.name))


@dataclass
class Device:
    alias: str | None
    platform: str
    udid: str
    product: str = ""
    name: str = ""
    ios: str | None = None
    flavor: str | None = None
    serial: str = ""
    hardware: str = ""
    preserve_only: bool = False
    present: bool = False
    source: str = "alias"
    flash: Any = False
    role: str = ""

    @property
    def label(self) -> str:
        return self.alias or self.name or self.udid or "?"


@dataclass
class ProbeResult:
    devices: list[Device] = field(default_factory=list)
    usb_iphones: list[UsbNode] = field(default_factory=list)
    mux_udids: list[str] = field(default_factory=list)
    adb_serials: list[str] = field(default_factory=list)
    ifaces: list[NetIface] = field(default_factory=list)
    hotspot_ncm: bool = False
    message: str | None = None
    tools: dict[str, bool] = field(default_factory=dict)

    def by_alias(self, name: str) -> Device | None:
        want = name.lower()
        for d in self.devices:
            if (d.alias or "").lower() == want:
                return d
            if d.udid.lower() == want:
                return d
            if (d.name or "").lower() == want:
                return d
            if (d.serial or "").lower() == want:
                return d
        return None


def _run(cmd: list[str], timeout: float = 8.0) -> str:
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return ""
    return (proc.stdout or "") + "\n" + (proc.stderr or "")


def list_mux_udids() -> list[str]:
    out = _run(["idevice_id", "-l"])
    udids = []
    for line in out.splitlines():
        token = line.strip()
        if re.fullmatch(r"[0-9a-fA-F]{24,64}", token):
            udids.append(token.lower())
    return udids


def list_adb_serials() -> list[str]:
    out = _run(["adb", "devices"])
    serials = []
    for line in out.splitlines():
        if line.startswith("List of"):
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1] in ("device", "recovery", "sideload"):
            serials.append(parts[0])
    return serials


def list_usb_iphones() -> list[UsbNode]:
    nodes: list[UsbNode] = []
    if shutil.which("system_profiler"):
        out = _run(["system_profiler", "SPUSBDataType"], timeout=20.0)
        for block in re.split(r"\n\n+", out):
            if APPLE_USB_RE.search(block):
                name = ""
                m = re.search(r"^\s*([^:\n]+):\s*$", block, re.M)
                if m:
                    name = m.group(1).strip()
                nodes.append(UsbNode(vendor="05ac", product="iphone", name=name or "iPhone"))
    elif shutil.which("lsusb"):
        out = _run(["lsusb"])
        for line in out.splitlines():
            if re.search(r"05ac:|iPhone|Apple", line, re.I):
                nodes.append(UsbNode(vendor="05ac", product="iphone", name=line.strip()))
    return nodes


def list_ifaces() -> list[NetIface]:
    ifaces: list[NetIface] = []
    if shutil.which("ifconfig"):
        out = _run(["ifconfig"])
        current = None
        for line in out.splitlines():
            head = re.match(r"^([A-Za-z0-9._-]+):", line)
            if head:
                current = NetIface(name=head.group(1), up="UP" in line or "RUNNING" in line)
                ifaces.append(current)
                continue
            if current is None:
                continue
            if "status: active" in line:
                current.up = True
            inet = re.search(r"inet\s+(\d+\.\d+\.\d+\.\d+)", line)
            if inet:
                current.addrs.append(inet.group(1))
        return ifaces
    if shutil.which("ip"):
        out = _run(["ip", "-4", "-o", "addr"])
        by_name: dict[str, NetIface] = {}
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 4:
                name = parts[1]
                addr = parts[3].split("/")[0]
                rec = by_name.setdefault(name, NetIface(name=name, up=True))
                rec.addrs.append(addr)
        return list(by_name.values())
    return ifaces


def detect_hotspot_ncm(
    usb_iphones: list[UsbNode],
    mux_udids: list[str],
    ifaces: list[NetIface],
) -> bool:
    if not usb_iphones or mux_udids:
        return False
    for iface in ifaces:
        if iface.up and iface.link_local and iface.looks_usb_eth:
            return True
    return False


def _ios_info(udid: str) -> tuple[str, str, str, str, str]:
    out = _run(["ideviceinfo", "-u", udid])
    product = ""
    version = ""
    serial = ""
    hardware = ""
    name = ""
    for line in out.splitlines():
        if line.startswith("ProductType:"):
            product = line.split(":", 1)[1].strip()
        if line.startswith("ProductVersion:"):
            version = line.split(":", 1)[1].strip()
        if line.startswith("SerialNumber:"):
            serial = line.split(":", 1)[1].strip()
        if line.startswith("HardwareModel:"):
            hardware = line.split(":", 1)[1].strip()
        if line.startswith("DeviceName:"):
            name = line.split(":", 1)[1].strip()
    return product, version, serial, hardware, name


def _apply_alias(dev: Device, spec: dict[str, Any]) -> Device:
    dev.alias = spec.get("alias") or spec.get("name") or dev.alias
    dev.platform = str(spec.get("platform") or dev.platform)
    dev.product = str(spec.get("product") or dev.product)
    dev.name = str(spec.get("name") or dev.name)
    dev.ios = spec.get("ios") or dev.ios
    dev.flavor = spec.get("flavor") or dev.flavor
    dev.serial = str(spec.get("serial") or dev.serial)
    dev.hardware = str(spec.get("hardware") or dev.hardware)
    dev.preserve_only = bool(spec.get("preserve_only", dev.preserve_only))
    dev.flash = spec.get("flash", dev.flash)
    dev.role = str(spec.get("role") or dev.role)
    if spec.get("udid") and not dev.udid:
        dev.udid = str(spec["udid"])
    return dev


def configured_aliases(cfg: dict[str, Any]) -> list[Device]:
    out: list[Device] = []
    for alias, spec in (cfg.get("devices") or {}).items():
        out.append(
            Device(
                alias=alias,
                platform=str(spec.get("platform") or "unknown"),
                udid=str(spec.get("udid") or ""),
                product=str(spec.get("product") or ""),
                name=str(spec.get("name") or alias),
                ios=spec.get("ios"),
                flavor=spec.get("flavor"),
                serial=str(spec.get("serial") or ""),
                hardware=str(spec.get("hardware") or ""),
                preserve_only=bool(spec.get("preserve_only", False)),
                present=False,
                source="alias",
                flash=spec.get("flash", False),
                role=str(spec.get("role") or ""),
            )
        )
    return out


def _is_grokbotbaby(cfg: dict[str, Any], udid: str, serial: str = "") -> bool:
    spec = device_alias(cfg, "GrokBotBaby") or {}
    want_udid = str(spec.get("udid") or GROKBOTBABY_UDID).lower()
    want_serial = str(spec.get("serial") or GROKBOTBABY_SERIAL).upper()
    if udid and udid.lower() == want_udid:
        return True
    if serial and serial.upper() == want_serial:
        return True
    return False


def _is_brick_name(cfg: dict[str, Any], device_name: str) -> bool:
    spec = device_alias(cfg, "Brick") or {}
    hints = [str(h).lower() for h in (spec.get("name_hints") or ["Brick"])]
    low = (device_name or "").lower()
    return any(h and h in low for h in hints)


def probe(
    cfg: dict[str, Any],
    *,
    mux: Callable[[], list[str]] | None = None,
    adb: Callable[[], list[str]] | None = None,
    usb: Callable[[], list[UsbNode]] | None = None,
    ifaces: Callable[[], list[NetIface]] | None = None,
) -> ProbeResult:
    tools = {
        "idevice_id": bool(shutil.which("idevice_id")),
        "idevicebackup2": bool(shutil.which("idevicebackup2")),
        "ideviceinfo": bool(shutil.which("ideviceinfo")),
        "adb": bool(shutil.which("adb")),
    }
    mux_udids = list(mux() if mux else (list_mux_udids() if tools["idevice_id"] else []))
    adb_serials = list(adb() if adb else (list_adb_serials() if tools["adb"] else []))
    usb_nodes = list(usb() if usb else list_usb_iphones())
    net = list(ifaces() if ifaces else list_ifaces())
    hotspot = detect_hotspot_ncm(usb_nodes, mux_udids, net)

    aliases = {d.alias: d for d in configured_aliases(cfg) if d.alias}
    devices: list[Device] = []

    for udid in mux_udids:
        product, version, serial, hardware, dev_name = (
            _ios_info(udid) if tools.get("ideviceinfo") else ("", "", "", "", "")
        )
        alias = None
        spec = None
        if _is_grokbotbaby(cfg, udid, serial):
            alias = "GrokBotBaby"
            spec = device_alias(cfg, "GrokBotBaby") or {}
        elif _is_brick_name(cfg, dev_name):
            alias = "Brick"
            spec = device_alias(cfg, "Brick") or {}
        dev = Device(
            alias=alias,
            platform="ios",
            udid=udid,
            product=product or (spec or {}).get("product") or "",
            name=(spec or {}).get("name") or dev_name or product or "iPhone",
            ios=version or (spec or {}).get("ios"),
            serial=serial or str((spec or {}).get("serial") or ""),
            hardware=hardware or str((spec or {}).get("hardware") or ""),
            preserve_only=bool((spec or {}).get("preserve_only", False)),
            present=True,
            source="mux",
            flash=(spec or {}).get("flash", False),
            role=str((spec or {}).get("role") or ""),
        )
        if spec:
            _apply_alias(dev, spec)
        devices.append(dev)
        if alias and alias in aliases:
            aliases[alias].present = True
            aliases[alias].udid = udid

    baby = aliases.get("GrokBotBaby")
    baby_hints = [h.lower() for h in (cfg.get("devices", {}).get("GrokBotBaby", {}).get("adb_hints") or [])]
    claimed_gbb = False
    for serial in adb_serials:
        hint_hit = any(h in serial.lower() for h in baby_hints)
        # After a postmarketOS flash GrokBotBaby may appear on adb — only claim on hints.
        take_gbb = baby is not None and not claimed_gbb and hint_hit
        if take_gbb and baby is not None:
            claimed_gbb = True
            baby.present = True
            baby.udid = serial
            baby.source = "adb"
            devices.append(
                Device(
                    alias="GrokBotBaby",
                    platform="linux",
                    udid=serial,
                    product=baby.product,
                    name=baby.name,
                    flavor=baby.flavor,
                    preserve_only=False,
                    present=True,
                    source="adb",
                    flash=baby.flash,
                    role=baby.role,
                )
            )
            continue
        if not any(d.udid == serial for d in devices):
            devices.append(
                Device(
                    alias=None,
                    platform="android",
                    udid=serial,
                    name=serial,
                    present=True,
                    source="adb",
                )
            )

    for alias, spec_dev in aliases.items():
        if not any(d.alias == alias for d in devices):
            devices.append(spec_dev)

    message = None
    if hotspot:
        message = (cfg.get("hotspot_ncm") or {}).get("message") or HOTSPOT_MSG
    elif not mux_udids and not adb_serials and not any(d.present for d in devices):
        if not usb_nodes:
            message = MISSING_TOOLS_MSG

    return ProbeResult(
        devices=devices,
        usb_iphones=usb_nodes,
        mux_udids=mux_udids,
        adb_serials=adb_serials,
        ifaces=net,
        hotspot_ncm=hotspot,
        message=message,
        tools=tools,
    )


def resolve_requested(probe_result: ProbeResult, cfg: dict[str, Any], name: str) -> Device:
    found = probe_result.by_alias(name)
    if found:
        return found
    spec = device_alias(cfg, name)
    if spec:
        return Device(
            alias=spec.get("alias") or name,
            platform=str(spec.get("platform") or "unknown"),
            udid=str(spec.get("udid") or ""),
            product=str(spec.get("product") or ""),
            name=str(spec.get("name") or name),
            ios=spec.get("ios"),
            flavor=spec.get("flavor"),
            serial=str(spec.get("serial") or ""),
            hardware=str(spec.get("hardware") or ""),
            preserve_only=bool(spec.get("preserve_only", False)),
            present=False,
            source="alias",
            flash=spec.get("flash", False),
            role=str(spec.get("role") or ""),
        )
    raise KeyError(f"unknown device {name!r}")


def brick_never_flash(device: Device) -> bool:
    """Brick is the daily iPhone 14-class Continuity phone — never the 7 Plus."""
    if (device.alias or "").lower() == "brick":
        return True
    if _is_grokbotbaby({}, device.udid, device.serial):
        return False
    return bool(device.preserve_only)


def default_non_tty_device(cfg: dict[str, Any]) -> str:
    _ = cfg
    return os.environ.get("FC_PRESERVE_DEVICE") or "GrokBotBaby"
