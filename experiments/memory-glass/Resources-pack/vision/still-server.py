#!/usr/bin/env python3
"""Memory Glass still-pipe + ego batch server.

Serves ~/.panda/vision (live.jpg, glass.jpg, ego/*).
POST /upload          — phone cam JPEG → live.jpg
POST /ego/frame       — append ego batch frame (JPEG body or multipart)
POST /ego/end         — finalize batch manifest
GET  /ego/latest.json — latest batch summary
GET  /health          — status JSON
GET  /fleet           — multi-device peers (phone · mini hub · laptop)
POST /fleet           — register / heartbeat peer
GET  /tts/latest.m4a  — last spoken assistant audio for phone loud play
POST /reply           — assistant text (+ optional TTS synth for phone)

Env:
  MG_STILL_PORT=9877
  MG_STILL_BIND=0.0.0.0  (LAN: Mini hub for phone + laptop upstairs)
  GY_VISION_DIR=~/.panda/vision
  MG_FLEET_ID / MG_FLEET_ROLE / MG_FLEET_NAME — this host's identity
"""
from __future__ import annotations

import json
import os
import re
import socket
import subprocess
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(os.environ.get("GY_VISION_DIR", os.path.expanduser("~/.panda/vision"))).resolve()
ROOT.mkdir(parents=True, exist_ok=True)
EGO = ROOT / "ego"
EGO.mkdir(parents=True, exist_ok=True)
SHARES = ROOT / "shares"
SHARES.mkdir(parents=True, exist_ok=True)
SNAPS = ROOT / "snaps"
SNAPS.mkdir(parents=True, exist_ok=True)
VOICE = Path(os.environ.get("GY_VOICE_DIR", os.path.expanduser("~/.panda/voice"))).resolve()
VOICE.mkdir(parents=True, exist_ok=True)
TTS_DIR = VOICE / "tts"
TTS_DIR.mkdir(parents=True, exist_ok=True)
CONV = VOICE / "conversation.jsonl"
FLEET_PATH = VOICE / "fleet-peers.json"
PORT = int(os.environ.get("MG_STILL_PORT", "9877"))
BIND = os.environ.get("MG_STILL_BIND", "127.0.0.1")
HTTPS_PORT = int(os.environ.get("MG_STILL_HTTPS_PORT", "9878"))
FLEET_ID = os.environ.get("MG_FLEET_ID") or f"hub-{socket.gethostname().split('.')[0]}"
FLEET_ROLE = os.environ.get("MG_FLEET_ROLE", "hub")  # hub | laptop | phone | agent
FLEET_NAME = os.environ.get("MG_FLEET_NAME") or socket.gethostname()
_FLEET_LOCK = threading.Lock()
_TTS_LOCK = threading.Lock()

_active_batch: dict | None = None


def _lan_guess() -> str | None:
    """Best-effort primary LAN IPv4 for fleet join URLs."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127."):
                return ip
    except Exception:
        pass
    return None


def _fleet_load() -> dict:
    if FLEET_PATH.is_file():
        try:
            return json.loads(FLEET_PATH.read_text())
        except Exception:
            pass
    return {"schema": "mg.fleet/v1", "peers": {}, "updated": 0}


def _fleet_save(data: dict) -> None:
    data["updated"] = time.time()
    data["schema"] = "mg.fleet/v1"
    tmp = FLEET_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n")
    tmp.replace(FLEET_PATH)


def _fleet_touch_self() -> dict:
    """Ensure hub self-entry is present."""
    with _FLEET_LOCK:
        data = _fleet_load()
        peers = data.setdefault("peers", {})
        lan = _lan_guess()
        peers[FLEET_ID] = {
            "id": FLEET_ID,
            "role": FLEET_ROLE,
            "name": FLEET_NAME,
            "host": lan or "127.0.0.1",
            "ports": {"http": PORT, "https": HTTPS_PORT},
            "caps": ["still", "voice", "hub", "tts", "fleet"],
            "seen": time.time(),
            "bind": BIND,
        }
        data["hub"] = {
            "id": FLEET_ID,
            "host": lan or "127.0.0.1",
            "http": PORT,
            "https": HTTPS_PORT,
            "phone": f"https://{lan or 'HOST'}:{HTTPS_PORT}/phone.html" if lan else None,
            "fleet": f"https://{lan or 'HOST'}:{HTTPS_PORT}/fleet.html" if lan else None,
            "chat": f"https://{lan or 'HOST'}:{HTTPS_PORT}/phone-chat.html" if lan else None,
        }
        # Drop peers not seen in 15 min
        cutoff = time.time() - 900
        data["peers"] = {
            k: v for k, v in peers.items() if float(v.get("seen") or 0) >= cutoff or k == FLEET_ID
        }
        _fleet_save(data)
        return data


def _fleet_register(obj: dict) -> dict:
    with _FLEET_LOCK:
        data = _fleet_load()
        peers = data.setdefault("peers", {})
        pid = str(obj.get("id") or obj.get("device_id") or uuid.uuid4().hex[:10])
        prev = peers.get(pid) or {}
        peers[pid] = {
            "id": pid,
            "role": str(obj.get("role") or prev.get("role") or "peer"),
            "name": str(obj.get("name") or prev.get("name") or pid),
            "host": str(obj.get("host") or prev.get("host") or ""),
            "ports": obj.get("ports") or prev.get("ports") or {},
            "caps": obj.get("caps") or prev.get("caps") or [],
            "ua": str(obj.get("ua") or prev.get("ua") or "")[:160],
            "seen": time.time(),
            "meta": obj.get("meta") if isinstance(obj.get("meta"), dict) else prev.get("meta") or {},
        }
        _fleet_save(data)
        return peers[pid]


def _synth_tts(text: str) -> dict | None:
    """macOS `say` → m4a under voice/tts for phone loud playback.

    Returns {url, path, bytes} or None.
    """
    text = (text or "").strip()
    if not text or len(text) < 1:
        return None
    # Keep TTS short for latency / iOS autoplay
    clean = re.sub(r"[`*#_]+", " ", text)
    clean = re.sub(r"\s+", " ", clean).strip()[:500]
    if not clean:
        return None
    with _TTS_LOCK:
        tid = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
        aiff = TTS_DIR / f"{tid}.aiff"
        m4a = TTS_DIR / f"{tid}.m4a"
        latest_m4a = TTS_DIR / "latest.m4a"
        latest_json = TTS_DIR / "latest.json"
        voice = os.environ.get("GY_SAY_VOICE", "Samantha")
        try:
            subprocess.run(
                ["say", "-v", voice, "-o", str(aiff), clean],
                check=True,
                timeout=45,
                capture_output=True,
            )
        except Exception as e:
            print(f"tts say fail: {e}", flush=True)
            return None
        # Prefer m4a for iOS Safari
        ok_m4a = False
        if aiff.is_file() and aiff.stat().st_size > 32:
            try:
                subprocess.run(
                    ["afconvert", "-f", "m4af", "-d", "aac", str(aiff), str(m4a)],
                    check=True,
                    timeout=30,
                    capture_output=True,
                )
                ok_m4a = m4a.is_file() and m4a.stat().st_size > 32
            except Exception:
                # Fallback: leave aiff (desktop may play; iOS prefers m4a)
                ok_m4a = False
        out_path = m4a if ok_m4a else aiff
        if not out_path.is_file():
            return None
        try:
            if ok_m4a:
                latest_m4a.write_bytes(m4a.read_bytes())
            meta = {
                "id": tid,
                "text": clean,
                "url": f"/tts/{out_path.name}",
                "latest": "/tts/latest.m4a" if ok_m4a else f"/tts/{out_path.name}",
                "bytes": out_path.stat().st_size,
                "t": time.time(),
                "voice": voice,
            }
            latest_json.write_text(json.dumps(meta, indent=2) + "\n")
            # pointer file for voice dir consumers
            (VOICE / "tts-latest.url").write_text(meta["latest"] + "\n")
            return meta
        except Exception as e:
            print(f"tts write fail: {e}", flush=True)
            return None


def _live_age_s() -> float | None:
    """Seconds since last still-pipe frame; None if unknown."""
    stamp = ROOT / "live.stamp"
    if not stamp.is_file():
        return None
    try:
        return max(0.0, time.time() - float(stamp.read_text().strip() or "0"))
    except Exception:
        return None


def _stream_conv_to_terminal(row: dict) -> None:
    """When phone is live (or always for speech), print CONV line + stream log.

    Still-server stdout is tailed into the agent terminal via convo-stream.sh.
    """
    role = (row.get("role") or "?").lower()
    kind = row.get("kind") or "text"
    text = (row.get("text") or "").replace("\n", " ").strip()
    img = row.get("image") or ""
    link = row.get("link") or ""
    src = row.get("src") or ""
    ts = (row.get("ts") or "")[11:19] or "??:??:??"
    who = {"user": "YOU", "assistant": "MINI", "system": "SYS"}.get(role, role.upper())
    bits = [f"CONV {ts} {who}"]
    if kind and kind != "text":
        bits.append(f"[{kind}]")
    if text:
        bits.append(text[:280])
    if img:
        bits.append(f"· {img}")
    if link and link not in text:
        bits.append(f"· {link}")
    if src and src not in ("phone-transcript", "speak-local", "phone-share"):
        bits.append(f"({src})")
    line = " ".join(bits)
    # Always print speech / assistant; photos too when still-pipe is live
    age = _live_age_s()
    live = age is not None and age <= 45.0
    important = role in ("user", "assistant", "system") and (
        kind in ("text", "link") or bool(text) or live
    )
    if not important:
        return
    print(line, flush=True)
    try:
        with (VOICE / "convo-stream.log").open("a") as sf:
            sf.write(line + "\n")
    except Exception:
        pass
    # bus for deploy desk when live
    if live:
        try:
            bus = Path(os.path.expanduser("~/.panda/kbatch-mg-collab/bus.jsonl"))
            bus.parent.mkdir(parents=True, exist_ok=True)
            with bus.open("a") as bf:
                bf.write(
                    json.dumps(
                        {
                            "t": int(time.time()),
                            "from": "still-server",
                            "kind": "chat",
                            "role": role,
                            "text": text[:240],
                            "image": img or None,
                            "src": src,
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass


def _append_conv(
    role: str,
    text: str,
    src: str = "",
    *,
    kind: str = "text",
    image: str | None = None,
    link: str | None = None,
    extra: dict | None = None,
) -> dict:
    """Shared chat log: phone UI + terminal agent + speak-local.

    kind: text | photo | link | snapshot
    image: web path under vision root, e.g. /shares/foo.jpg or /snaps/bar.jpg
    link: shared URL
    """
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    epoch = int(time.time())
    row = {
        "ts": ts,
        "epoch": epoch,
        "role": role,  # user | assistant | system
        "text": text or "",
        "src": src or role,
        "kind": kind or "text",
    }
    if image:
        row["image"] = image
    if link:
        row["link"] = link
    if extra:
        row.update(extra)
    with CONV.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    try:
        _stream_conv_to_terminal(row)
    except Exception:
        pass
    return row


def _new_batch(meta: dict | None = None) -> dict:
    bid = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    bdir = EGO / bid
    bdir.mkdir(parents=True, exist_ok=True)
    batch = {
        "id": bid,
        "dir": str(bdir),
        "started": time.time(),
        "frames": 0,
        "meta": meta or {},
        "ended": None,
    }
    (bdir / "manifest.json").write_text(json.dumps(batch, indent=2))
    (ROOT / "ego-latest.json").write_text(json.dumps({"id": bid, "frames": 0, "dir": str(bdir)}))
    return batch


def _write_live(data: bytes) -> None:
    live = ROOT / "live.jpg"
    # Unique tmp avoids races when two uploads land together
    tmp = ROOT / f"live.jpg.{uuid.uuid4().hex[:8]}.tmp"
    try:
        tmp.write_bytes(data)
        tmp.replace(live)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
    (ROOT / "live.stamp").write_text(str(time.time()))


def _save_bytes(folder: Path, data: bytes, prefix: str, ext: str = "jpg") -> str:
    """Write media under vision root; return web path like /shares/name.jpg."""
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{prefix}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}.{ext}"
    path = folder / name
    path.write_bytes(data)
    return f"/{folder.name}/{name}"


def _snapshot_live(prefix: str = "snap") -> str | None:
    """Copy current live.jpg into snaps/; return web path or None."""
    live = ROOT / "live.jpg"
    if not live.is_file() or live.stat().st_size < 32:
        return None
    try:
        data = live.read_bytes()
    except OSError:
        return None
    return _save_bytes(SNAPS, data, prefix, "jpg")


class H(SimpleHTTPRequestHandler):
    # iOS profile + cert install (HTTP download — no click-through needed)
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, "extensions_map", {}),
        ".html": "text/html",
        ".htm": "text/html",
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".crt": "application/x-x509-ca-cert",
        ".cer": "application/pkix-cert",
        ".mobileconfig": "application/x-apple-aspen-config",
        ".pem": "application/x-pem-file",
        ".woff2": "font/woff2",
    }

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-MG-Meta")
        # Shell assets: short cache so SW can store offline; live paths still no-store
        path = urlparse(getattr(self, "path", "") or "").path
        live = path in (
            "/upload",
            "/health",
            "/live.jpg",
            "/glass.jpg",
            "/audio",
            "/mic",
            "/upload-audio",
            "/transcript",
            "/stt",
            "/say",
            "/reply",
            "/conversation",
            "/chat",
            "/conv",
            "/fleet",
            "/peers",
        ) or path.startswith(("/ego/", "/shares/", "/snaps/", "/live", "/tts/"))
        if live or "phone-live" in path or path in (
            "/audio-levels",
            "/levels",
            "/wave",
            "/fleet",
            "/peers",
            "/bus",
            "/chat-log",
            "/deploy-log",
            "/goals",
            "/plan",
        ):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        elif path.endswith(
            (".html", ".js", ".css", ".webmanifest", ".png", ".svg", ".json")
        ) or path in ("/sw.js", "/manifest.webmanifest", "/phone-pwa.js"):
            # service worker must revalidate; shell can be cached briefly
            if path.endswith("sw.js"):
                self.send_header("Cache-Control", "no-cache, must-revalidate")
                self.send_header("Service-Worker-Allowed", "/")
            else:
                self.send_header("Cache-Control", "public, max-age=60, must-revalidate")
        else:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n > 0 else b""

    def do_GET(self):
        path = urlparse(self.path).path
        qs = parse_qs(urlparse(self.path).query or "")
        if path in ("/health", "/ego/health"):
            live = ROOT / "live.jpg"
            age = None
            if live.exists():
                age = time.time() - live.stat().st_mtime
            audio = VOICE / "phone-live.audio"
            aage = None
            if audio.exists():
                aage = time.time() - audio.stat().st_mtime
            inbox = VOICE / "inbox.jsonl"
            levels = VOICE / "audio-levels.json"
            lage = None
            if levels.exists():
                lage = time.time() - levels.stat().st_mtime
            tts_meta = None
            latest_json = TTS_DIR / "latest.json"
            if latest_json.is_file():
                try:
                    tts_meta = json.loads(latest_json.read_text())
                except Exception:
                    tts_meta = None
            fleet = _fleet_touch_self()
            lan = (fleet.get("hub") or {}).get("host")
            self._json(
                200,
                {
                    "ok": True,
                    "root": str(ROOT),
                    "live": live.exists(),
                    "live_age_s": age,
                    "audio": audio.exists(),
                    "audio_age_s": aage,
                    "levels": levels.exists(),
                    "levels_age_s": lage,
                    "inbox": inbox.exists(),
                    "active_batch": _active_batch["id"] if _active_batch else None,
                    "frames": _active_batch["frames"] if _active_batch else 0,
                    "fleet_id": FLEET_ID,
                    "fleet_role": FLEET_ROLE,
                    "lan": lan,
                    "tts": tts_meta,
                    "peers": len((fleet.get("peers") or {})),
                },
            )
            return
        # Multi-device fleet map (Mini hub · phone · laptop upstairs)
        if path in ("/fleet", "/peers", "/fleet/status"):
            data = _fleet_touch_self()
            self._json(
                200,
                {
                    "ok": True,
                    "schema": "mg.fleet/v1",
                    "self": FLEET_ID,
                    "role": FLEET_ROLE,
                    "hub": data.get("hub"),
                    "peers": list((data.get("peers") or {}).values()),
                    "n": len(data.get("peers") or {}),
                    "updated": data.get("updated"),
                },
            )
            return
        # TTS assets for phone loud speaker (and laptop preview)
        if path in ("/tts/latest", "/tts/latest.m4a", "/tts/latest.json"):
            if path.endswith(".json") or path == "/tts/latest.json":
                p = TTS_DIR / "latest.json"
                if p.is_file():
                    self._json(200, json.loads(p.read_text()))
                else:
                    self._json(404, {"ok": False, "err": "no tts yet"})
                return
            # Prefer m4a, fall back to any latest pointer
            for name in ("latest.m4a",):
                p = TTS_DIR / name
                if p.is_file():
                    self.path = f"/../voice-forbidden"  # avoid static map
                    data = p.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/mp4")
                    self.send_header("Content-Length", str(len(data)))
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    self.wfile.write(data)
                    return
            # last resort: newest m4a/aiff in tts dir
            files = sorted(TTS_DIR.glob("*.m4a"), key=lambda x: x.stat().st_mtime, reverse=True)
            if not files:
                files = sorted(TTS_DIR.glob("*.aiff"), key=lambda x: x.stat().st_mtime, reverse=True)
            if files:
                data = files[0].read_bytes()
                ctype = "audio/mp4" if files[0].suffix == ".m4a" else "audio/aiff"
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
                return
            self._json(404, {"ok": False, "err": "no tts"})
            return
        if path.startswith("/tts/") and path != "/tts/":
            name = path[len("/tts/") :].split("?")[0]
            if ".." in name or "/" in name or "\\" in name:
                self._json(400, {"ok": False, "err": "bad name"})
                return
            p = TTS_DIR / name
            if not p.is_file():
                self._json(404, {"ok": False, "err": "missing"})
                return
            data = p.read_bytes()
            ctype = {
                ".m4a": "audio/mp4",
                ".mp3": "audio/mpeg",
                ".aiff": "audio/aiff",
                ".wav": "audio/wav",
                ".json": "application/json",
            }.get(p.suffix.lower(), "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return
        # Live L/R/M waveform levels from phone PWA (or inspect mic)
        if path in ("/audio-levels", "/levels", "/wave"):
            p = VOICE / "audio-levels.json"
            if p.exists():
                try:
                    obj = json.loads(p.read_text())
                    obj["ok"] = True
                    obj["age_s"] = time.time() - p.stat().st_mtime
                    self._json(200, obj)
                    return
                except Exception:
                    pass
            self._json(
                200,
                {
                    "ok": True,
                    "t": time.time(),
                    "age_s": None,
                    "L": 0,
                    "R": 0,
                    "M": 0,
                    "wave": {"L": [], "R": [], "M": []},
                    "src": "none",
                },
            )
            return
        if path in ("/ego/latest.json", "/ego/latest"):
            p = ROOT / "ego-latest.json"
            if p.exists():
                self._json(200, json.loads(p.read_text()))
            else:
                self._json(200, {"id": None, "frames": 0})
            return
        # Conversation log for phone chat UI (user + assistant turns)
        if path in ("/conversation", "/chat", "/conv"):
            rows = []
            if CONV.exists():
                for line in CONV.read_text(errors="replace").splitlines()[-200:]:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        rows.append(json.loads(line))
                    except Exception:
                        pass
            self._json(200, {"ok": True, "n": len(rows), "messages": rows})
            return
        # Collab bus + inbox merge for deploy desk chat log
        if path in ("/bus", "/chat-log", "/deploy-log"):
            bus_path = Path(os.path.expanduser("~/.panda/kbatch-mg-collab/bus.jsonl"))
            inbox = VOICE / "inbox.jsonl"
            bus_rows = []
            if bus_path.is_file():
                for line in bus_path.read_text(errors="replace").splitlines()[-80:]:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        bus_rows.append(json.loads(line))
                    except Exception:
                        pass
            inbox_rows = []
            if inbox.is_file():
                for line in inbox.read_text(errors="replace").splitlines()[-40:]:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        o = json.loads(line)
                        inbox_rows.append(
                            {
                                "t": o.get("epoch") or o.get("t"),
                                "from": "phone",
                                "kind": "user",
                                "text": o.get("text") or "",
                                "src": o.get("src") or "inbox",
                            }
                        )
                    except Exception:
                        pass
            conv_rows = []
            if CONV.exists():
                for line in CONV.read_text(errors="replace").splitlines()[-80:]:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        o = json.loads(line)
                        conv_rows.append(
                            {
                                "t": o.get("epoch") or o.get("t"),
                                "from": o.get("role") or o.get("src") or "?",
                                "kind": o.get("kind") or o.get("role") or "msg",
                                "text": o.get("text") or "",
                                "src": o.get("src") or "",
                                "tts": o.get("tts") or o.get("tts_latest"),
                            }
                        )
                    except Exception:
                        pass
            self._json(
                200,
                {
                    "ok": True,
                    "bus": bus_rows,
                    "inbox": inbox_rows,
                    "conversation": conv_rows,
                    "n_bus": len(bus_rows),
                    "n_inbox": len(inbox_rows),
                    "n_conv": len(conv_rows),
                },
            )
            return
        # Plan / goals snapshot for deploy + agent desks
        if path in ("/goals", "/plan", "/goals.json"):
            for p in (
                ROOT / "goals.json",
                VOICE / "goals.json",
                Path(os.path.expanduser("~/.panda/kbatch-mg-collab/goals.json")),
            ):
                if p.is_file():
                    try:
                        self._json(200, json.loads(p.read_text()))
                        return
                    except Exception:
                        pass
            self._json(
                200,
                {
                    "ok": True,
                    "schema": "mg.goals/v1",
                    "source": "builtin",
                    "northStar": "Native WKWebView lab droplet · still-pipe · fleet · dual-space train",
                    "goals": [],
                },
            )
            return
        # Friendly root → cert setup for phones (HTTP, no click-through)
        if path in ("/", "/index.html"):
            self.path = "/phone-setup.html"
        return super().do_GET()

    def do_POST(self):
        global _active_batch
        path = urlparse(self.path).path

        # Phone / inspect → live L/R/M waveform samples for the other side
        if path in ("/audio-levels", "/levels", "/wave"):
            raw = self._read_body()
            try:
                obj = json.loads(raw.decode("utf-8", errors="replace") or "{}")
            except Exception:
                self._json(400, {"ok": False, "err": "bad json"})
                return
            if not isinstance(obj, dict):
                self._json(400, {"ok": False, "err": "need object"})
                return
            # Normalize fields
            def _f(k, default=0.0):
                try:
                    return float(obj.get(k, default))
                except Exception:
                    return default

            def _wave(k):
                w = obj.get("wave") or {}
                arr = w.get(k) if isinstance(w, dict) else None
                if not isinstance(arr, list):
                    arr = obj.get(k + "wave") or obj.get(k + "s") or []
                out = []
                if isinstance(arr, list):
                    for x in arr[:128]:
                        try:
                            out.append(max(-1.0, min(1.0, float(x))))
                        except Exception:
                            out.append(0.0)
                return out

            payload = {
                "ok": True,
                "t": time.time(),
                "src": str(obj.get("src") or "phone")[:48],
                "L": _f("L", _f("l", 0)),
                "R": _f("R", _f("r", 0)),
                "M": _f("M", _f("m", 0)),
                "peak": _f("peak", 0),
                "wave": {
                    "L": _wave("L") or _wave("l"),
                    "R": _wave("R") or _wave("r"),
                    "M": _wave("M") or _wave("m"),
                },
            }
            # If only RMS given, synthesize a short wave for display
            for ch in ("L", "R", "M"):
                if not payload["wave"][ch]:
                    amp = max(0.0, min(1.0, abs(float(payload[ch]))))
                    payload["wave"][ch] = [
                        amp * __import__("math").sin(i * 0.35 + amp * 4) for i in range(64)
                    ]
            try:
                VOICE.mkdir(parents=True, exist_ok=True)
                (VOICE / "audio-levels.json").write_text(json.dumps(payload))
            except OSError as e:
                self._json(500, {"ok": False, "err": str(e)})
                return
            self._json(200, {"ok": True, "t": payload["t"]})
            return

        if path in ("/upload", "/cam", "/live"):
            data = self._read_multipart_or_raw()
            if not data:
                self._json(400, {"ok": False, "err": "empty body"})
                return
            _write_live(data)
            # also append to active ego batch if recording
            if _active_batch:
                self._append_ego_frame(data)
            self._json(200, {"ok": True, "bytes": len(data), "ego": bool(_active_batch)})
            return

        # Phone mic: raw audio blob (webm/mp4/wav) → voice dir for whisper / bridge
        if path in ("/audio", "/mic", "/upload-audio"):
            data = self._read_multipart_or_raw()
            if not data:
                self._json(400, {"ok": False, "err": "empty audio"})
                return
            ctype = (self.headers.get("Content-Type") or "").lower()
            ext = "webm"
            if "mp4" in ctype or "m4a" in ctype or "aac" in ctype:
                ext = "m4a"
            elif "wav" in ctype or "wave" in ctype:
                ext = "wav"
            elif "ogg" in ctype or "opus" in ctype:
                ext = "ogg"
            elif "mpeg" in ctype or "mp3" in ctype:
                ext = "mp3"
            live_a = VOICE / "phone-live.audio"
            tmp = VOICE / f"phone-live.audio.tmp"
            tmp.write_bytes(data)
            tmp.replace(live_a)
            named = VOICE / f"phone-live.{ext}"
            named.write_bytes(data)
            (VOICE / "phone-live.stamp").write_text(str(time.time()))
            # queue clip for bridge (rotating)
            clip = VOICE / f"phone-clip.{ext}"
            clip.write_bytes(data)
            self._json(200, {"ok": True, "bytes": len(data), "ext": ext, "path": str(clip)})
            return

        # Phone SpeechRecognition transcript → inbox (no whisper on Mini required)
        if path in ("/transcript", "/stt", "/say"):
            raw = self._read_body()
            text = ""
            try:
                if raw:
                    obj = json.loads(raw.decode("utf-8", errors="replace"))
                    if isinstance(obj, dict):
                        text = str(obj.get("text") or obj.get("transcript") or "").strip()
                    else:
                        text = str(obj).strip()
            except Exception:
                text = raw.decode("utf-8", errors="replace").strip()
            if not text:
                self._json(400, {"ok": False, "err": "empty text"})
                return
            # drop tiny noise
            if len(text) < 2:
                self._json(200, {"ok": True, "dropped": True})
                return
            ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            epoch = int(time.time())
            line = json.dumps(
                {"ts": ts, "epoch": epoch, "text": text, "src": "phone-transcript"},
                ensure_ascii=False,
            )
            inbox = VOICE / "inbox.jsonl"
            with inbox.open("a") as f:
                f.write(line + "\n")
            _append_conv("user", text, "phone-transcript")
            (VOICE / "last.txt").write_text(text + "\n")
            (VOICE / "phone-transcript.stamp").write_text(str(time.time()))
            print(f"USER_SAID {text}", flush=True)
            self._json(200, {"ok": True, "text": text, "inbox": str(inbox)})
            return

        # Fleet peer heartbeat / register (phone · laptop · agent)
        if path in ("/fleet", "/peers", "/fleet/register"):
            raw = self._read_body()
            try:
                obj = json.loads(raw.decode("utf-8", errors="replace") or "{}")
            except Exception:
                obj = {}
            if not isinstance(obj, dict):
                self._json(400, {"ok": False, "err": "need object"})
                return
            # fill host from client if missing
            if not obj.get("host"):
                obj["host"] = self.client_address[0] if self.client_address else ""
            peer = _fleet_register(obj)
            data = _fleet_touch_self()
            self._json(
                200,
                {
                    "ok": True,
                    "peer": peer,
                    "hub": data.get("hub"),
                    "n": len(data.get("peers") or {}),
                },
            )
            return

        # Assistant / terminal reply → phone chat UI + loud TTS on phone
        # JSON: { text, snapshot?, image?, link?, src?, tts?: bool, speak?: bool }
        # Or raw image body with X-MG-Meta: {"text":"...","snapshot":false}
        if path in ("/reply", "/assistant", "/speak-log"):
            ctype = (self.headers.get("Content-Type") or "").lower()
            raw = self._read_body()
            text = ""
            src = "speak-local"
            want_snap = False
            want_tts = True  # default: synthesize for phone speaker
            link = None
            image_path = None
            kind = "text"
            obj: dict | None = None
            try:
                if raw and ("json" in ctype or (raw[:1] in (b"{", b"["))):
                    parsed = json.loads(raw.decode("utf-8", errors="replace"))
                    if isinstance(parsed, dict):
                        obj = parsed
                        text = str(obj.get("text") or obj.get("reply") or "").strip()
                        src = str(obj.get("src") or src)
                        want_snap = bool(obj.get("snapshot") or obj.get("snap") or obj.get("attach_live"))
                        if "tts" in obj or "speak" in obj:
                            want_tts = bool(obj.get("tts", obj.get("speak", True)))
                        link = (obj.get("link") or obj.get("url") or None)
                        if link:
                            link = str(link).strip() or None
                        if obj.get("image") and isinstance(obj["image"], str) and obj["image"].startswith("/"):
                            image_path = obj["image"]
                        # optional base64 jpeg
                        b64 = obj.get("image_b64") or obj.get("jpeg_b64")
                        if b64 and isinstance(b64, str):
                            import base64

                            try:
                                blob = base64.b64decode(b64.split(",")[-1])
                                image_path = _save_bytes(SNAPS, blob, "reply", "jpg")
                            except Exception:
                                pass
                    else:
                        text = str(parsed).strip()
                elif raw and ("image" in ctype or raw[:2] == b"\xff\xd8"):
                    data = raw
                    if "multipart" in ctype:
                        j = raw.find(b"\xff\xd8")
                        if j >= 0:
                            k = raw.find(b"\xff\xd9", j)
                            data = raw[j : k + 2] if k > j else raw[j:]
                    if data and data[:2] == b"\xff\xd8":
                        image_path = _save_bytes(SNAPS, data, "reply", "jpg")
                    meta_h = self.headers.get("X-MG-Meta") or ""
                    if meta_h:
                        try:
                            m = json.loads(meta_h)
                            text = str(m.get("text") or "").strip()
                            src = str(m.get("src") or src)
                            want_snap = bool(m.get("snapshot") or want_snap)
                        except Exception:
                            pass
                else:
                    text = raw.decode("utf-8", errors="replace").strip() if raw else ""
            except Exception:
                text = raw.decode("utf-8", errors="replace").strip() if raw else ""

            if want_snap and not image_path:
                image_path = _snapshot_live("mini")
            if link and not text:
                text = link
            if image_path and not text:
                text = "snapshot" if want_snap else "photo"
            if not text and not image_path and not link:
                self._json(400, {"ok": False, "err": "empty reply"})
                return
            if image_path and want_snap:
                kind = "snapshot"
            elif image_path:
                kind = "photo"
            elif link:
                kind = "link"
            else:
                kind = "text"

            tts_meta = None
            if want_tts and text and kind == "text":
                tts_meta = _synth_tts(text)

            extra = {"speak": True, "phone_loud": True}
            if tts_meta:
                extra["tts"] = tts_meta.get("url")
                extra["tts_latest"] = tts_meta.get("latest")
                extra["tts_id"] = tts_meta.get("id")

            row = _append_conv(
                "assistant",
                text or "",
                src,
                kind=kind,
                image=image_path,
                link=link,
                extra=extra,
            )
            self._json(200, {"ok": True, "message": row, "tts": tts_meta})
            return

        # Phone share: photo (multipart/raw jpeg) and/or link + caption
        # POST /share  JSON { text?, link? }  OR image body / multipart
        # Also accepts multipart with fields: file, text, link
        if path in ("/share", "/photo", "/upload-share"):
            ctype = (self.headers.get("Content-Type") or "").lower()
            raw = self._read_body()
            text = ""
            link = None
            image_path = None
            src = "phone-share"

            # Peek meta header
            meta_h = self.headers.get("X-MG-Meta") or ""
            if meta_h:
                try:
                    m = json.loads(meta_h)
                    text = str(m.get("text") or m.get("caption") or "").strip()
                    link = (m.get("link") or m.get("url") or None)
                    if link:
                        link = str(link).strip() or None
                    src = str(m.get("src") or src)
                except Exception:
                    pass

            if raw and "json" in ctype:
                try:
                    obj = json.loads(raw.decode("utf-8", errors="replace"))
                    if isinstance(obj, dict):
                        text = str(obj.get("text") or obj.get("caption") or text).strip()
                        link = obj.get("link") or obj.get("url") or link
                        if link:
                            link = str(link).strip() or None
                        src = str(obj.get("src") or src)
                        # optional data-url / b64
                        b64 = obj.get("image_b64") or obj.get("jpeg_b64")
                        if b64 and isinstance(b64, str):
                            import base64

                            try:
                                blob = base64.b64decode(b64.split(",")[-1])
                                image_path = _save_bytes(SHARES, blob, "share", "jpg")
                            except Exception:
                                pass
                except Exception:
                    pass
            elif raw:
                # image or multipart
                data = b""
                if "multipart/form-data" in ctype:
                    # extract jpeg + try to find text fields
                    j = raw.find(b"\xff\xd8")
                    if j >= 0:
                        k = raw.find(b"\xff\xd9", j)
                        data = raw[j : k + 2] if k > j else raw[j:]
                    # naive text field scrape
                    for key in (b'name="text"', b'name="caption"', b'name="link"', b'name="url"'):
                        idx = raw.find(key)
                        if idx < 0:
                            continue
                        m = re.search(rb"\r\n\r\n(.*?)\r\n--", raw[idx:], re.S)
                        if m:
                            val = m.group(1).decode("utf-8", errors="replace").strip()
                            if b"link" in key or b"url" in key:
                                link = val or link
                            else:
                                text = val or text
                elif raw[:2] == b"\xff\xd8" or "image" in ctype:
                    data = raw if raw[:2] == b"\xff\xd8" else raw
                if data and data[:2] == b"\xff\xd8":
                    image_path = _save_bytes(SHARES, data, "share", "jpg")
                    # also warm still-pipe so Mini/desktop sees it
                    try:
                        _write_live(data)
                    except Exception:
                        pass

            kind = "text"
            if image_path and link:
                kind = "photo"
            elif image_path:
                kind = "photo"
            elif link:
                kind = "link"
            if not text and link:
                text = link
            if not text and image_path:
                text = "photo"
            if not text and not image_path and not link:
                self._json(400, {"ok": False, "err": "empty share"})
                return

            # also push text shares into transcript inbox so agent monitor sees them
            if text and (kind in ("text", "link") or image_path):
                try:
                    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    epoch = int(time.time())
                    note = text
                    if image_path:
                        note = f"{text} [photo {image_path}]"
                    if link and link not in note:
                        note = f"{note} {link}".strip()
                    line = json.dumps(
                        {
                            "ts": ts,
                            "epoch": epoch,
                            "text": note,
                            "src": src,
                            "image": image_path,
                            "link": link,
                            "kind": kind,
                        },
                        ensure_ascii=False,
                    )
                    with (VOICE / "inbox.jsonl").open("a") as f:
                        f.write(line + "\n")
                    print(f"USER_SHARE {note}", flush=True)
                except Exception:
                    pass

            row = _append_conv(
                "user",
                text or "",
                src,
                kind=kind,
                image=image_path,
                link=link,
            )
            self._json(200, {"ok": True, "message": row})
            return

        if path in ("/ego/start",):
            meta = {}
            try:
                raw = self._read_body()
                if raw:
                    meta = json.loads(raw.decode("utf-8", errors="replace"))
            except Exception:
                meta = {}
            _active_batch = _new_batch(meta)
            self._json(200, {"ok": True, "batch": _active_batch["id"]})
            return

        if path in ("/ego/frame", "/ego/append"):
            data = self._read_multipart_or_raw()
            if not data:
                self._json(400, {"ok": False, "err": "empty frame"})
                return
            if not _active_batch:
                _active_batch = _new_batch({"auto": True})
            _write_live(data)  # keep inspect feed warm
            info = self._append_ego_frame(data)
            self._json(200, {"ok": True, **info})
            return

        if path in ("/ego/end", "/ego/stop"):
            if not _active_batch:
                self._json(200, {"ok": True, "batch": None})
                return
            _active_batch["ended"] = time.time()
            bdir = Path(_active_batch["dir"])
            (bdir / "manifest.json").write_text(json.dumps(_active_batch, indent=2))
            (ROOT / "ego-latest.json").write_text(
                json.dumps(
                    {
                        "id": _active_batch["id"],
                        "frames": _active_batch["frames"],
                        "dir": _active_batch["dir"],
                        "ended": _active_batch["ended"],
                    }
                )
            )
            done = _active_batch
            _active_batch = None
            self._json(200, {"ok": True, "batch": done})
            return

        self._json(404, {"ok": False, "err": "unknown path"})

    def _append_ego_frame(self, data: bytes) -> dict:
        global _active_batch
        assert _active_batch
        bdir = Path(_active_batch["dir"])
        i = _active_batch["frames"]
        fp = bdir / f"frame_{i:05d}.jpg"
        fp.write_bytes(data)
        _active_batch["frames"] = i + 1
        # lightweight index line
        with (bdir / "frames.jsonl").open("a") as f:
            f.write(json.dumps({"i": i, "t": time.time(), "bytes": len(data), "file": fp.name}) + "\n")
        (bdir / "manifest.json").write_text(json.dumps(_active_batch, indent=2))
        (ROOT / "ego-latest.json").write_text(
            json.dumps(
                {
                    "id": _active_batch["id"],
                    "frames": _active_batch["frames"],
                    "dir": _active_batch["dir"],
                }
            )
        )
        return {"batch": _active_batch["id"], "frame": i, "bytes": len(data)}

    def _read_multipart_or_raw(self) -> bytes:
        """Raw body or naive multipart extract (no cgi — removed in Py3.13+)."""
        ctype = self.headers.get("Content-Type", "")
        raw = self._read_body()
        if not raw:
            return b""
        if "multipart/form-data" not in ctype:
            return raw
        # Extract first file part between boundaries (JPEG starts with FFD8)
        m = re.search(rb"\r\n\r\n", raw)
        if not m:
            # try find JPEG magic anywhere
            j = raw.find(b"\xff\xd8")
            return raw[j:] if j >= 0 else raw
        # walk parts
        j = raw.find(b"\xff\xd8")
        if j >= 0:
            k = raw.find(b"\xff\xd9", j)
            if k > j:
                return raw[j : k + 2]
            return raw[j:]
        return raw[m.end() :]


def _maybe_ssl(httpd, port: int):
    """Wrap socket with TLS when certs exist (phone cam needs HTTPS for getUserMedia)."""
    cert = Path(os.environ.get("MG_STILL_CERT", str(ROOT / "certs" / "still.crt")))
    key = Path(os.environ.get("MG_STILL_KEY", str(ROOT / "certs" / "still.key")))
    if not (cert.is_file() and key.is_file()):
        return False
    import ssl

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cert), str(key))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"still-server HTTPS https://{BIND}:{port}/  cert={cert}", flush=True)
    return True


if __name__ == "__main__":
    import threading

    # HTTP (inspect on Mini + Snap fallback) — always
    httpd = ThreadingHTTPServer((BIND, PORT), H)
    print(
        f"still-server HTTP  http://{BIND}:{PORT}/  live.jpg · /upload · /phone.html",
        flush=True,
    )
    threading.Thread(target=httpd.serve_forever, daemon=True, name="still-http").start()

    # HTTPS (iPhone live cam — getUserMedia requires secure context)
    # Default 9878 so both can run; set MG_STILL_HTTPS_PORT=0 to disable
    https_port = int(os.environ.get("MG_STILL_HTTPS_PORT", "9878"))
    if https_port > 0:
        httpsd = ThreadingHTTPServer((BIND, https_port), H)
        if _maybe_ssl(httpsd, https_port):
            print(
                f"  phone live cam: https://<mini-lan>:{https_port}/phone.html  (trust self-signed once)",
                flush=True,
            )
            try:
                httpsd.serve_forever()
            except KeyboardInterrupt:
                pass
        else:
            print(
                "  WARN: no certs at ~/.panda/vision/certs/still.{crt,key} — iPhone live cam blocked on HTTP",
                flush=True,
            )
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass
    else:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
