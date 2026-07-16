#!/usr/bin/env bash
# Architecture Lab — static + ops APIs
# Usage: ./serve.sh [port]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8765}"
HOST="${HOST:-127.0.0.1}"
cd "$ROOT"
command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }

echo ""
echo "  Grok Build Lab"
echo "  http://${HOST}:${PORT}"
echo "  Pages: https://fornevercollective.github.io/grok-build/  (auto-deploy on push)"
echo "  APIs: /api/health · /api/processes · /api/git-log · /api/summon-grok · /api/mitigate"
echo "        /api/voices · /api/tts  (SpaceXAI Grok Voice spheres)"
echo "        /api/media/tools · resolve · stop · ffplay · hls/*  (yt-dlp · ffmpeg · blank · gy)"
echo ""

# Desktop shell sets LAB_DESKTOP=1 — never open a browser tab for localhost
if [[ -z "${LAB_DESKTOP:-}" ]] && command -v open >/dev/null 2>&1; then
  (sleep 0.35 && open "http://${HOST}:${PORT}/") >/dev/null 2>&1 || true
fi

exec python3 - "$HOST" "$PORT" "$ROOT" <<'PY'
import json, os, re, shutil, subprocess, sys, time, tempfile, threading, uuid, mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, quote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

HOST, PORT, ROOT = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])
REPO = (ROOT / "../..").resolve()  # grok-build root
GY_REPO = Path.home() / "Projects" / "GrokYtalkY"
LOG_BUF = []  # in-memory event log
MAX_LOG = 400

# ── Media (yt-dlp · ffmpeg · ffplay · blank · gy hub) ─────────
HLS_ROOT = Path(tempfile.gettempdir()) / "architecture-lab-hls"
HLS_ROOT.mkdir(parents=True, exist_ok=True)
HLS_JOBS = {}  # job_id -> dict
MEDIA_HISTORY = []
MEDIA_LOCK = threading.Lock()
GY_HUB = os.environ.get("GY_HUB", "http://127.0.0.1:9876").rstrip("/")
BLANK_URL = os.environ.get("GY_BLANK_URL", "http://127.0.0.1:5173").rstrip("/")


def log_event(level, msg, **extra):
    entry = {
        "t": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "level": level,
        "msg": msg,
        **extra,
    }
    LOG_BUF.append(entry)
    if len(LOG_BUF) > MAX_LOG:
        del LOG_BUF[: len(LOG_BUF) - MAX_LOG]
    return entry


def find_grok():
    env = os.environ.get("GROK_BIN")
    if env and Path(env).is_file() and os.access(env, os.X_OK):
        return env
    for name in ("grok", "xai-grok-pager"):
        p = shutil.which(name)
        if p:
            return p
    home = Path.home()
    for c in [
        home / ".grok" / "bin" / "grok",
        home / ".local" / "bin" / "grok",
        home / "Projects" / "grok-build" / "target" / "debug" / "xai-grok-pager",
        home / "Projects" / "grok-build" / "target" / "release" / "xai-grok-pager",
    ]:
        if c.is_file() and os.access(c, os.X_OK):
            return str(c)
    return None


def find_gy():
    for name in ("gy", "grokytalky"):
        p = shutil.which(name)
        if p:
            return p
    home = Path.home()
    for c in [home / "go" / "bin" / "gy", home / "go" / "bin" / "grokytalky"]:
        if c.is_file() and os.access(c, os.X_OK):
            return str(c)
    return None


def find_bin(*names):
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def find_ytdlp():
    return find_bin("yt-dlp", "yt_dlp", "youtube-dl")


def find_ffmpeg():
    return find_bin("ffmpeg")


def find_ffplay():
    return find_bin("ffplay")


def http_json(url, method="GET", body=None, timeout=12):
    data = None
    headers = {"Accept": "application/json", "User-Agent": "architecture-lab/1.0"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method)
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read(2 << 20)
        return json.loads(raw.decode("utf-8") or "{}")


def reachable(url, timeout=0.45):
    try:
        req = Request(url, method="GET", headers={"User-Agent": "architecture-lab/1.0"})
        with urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 500
    except Exception:
        return False


def media_tools():
    blank = reachable(BLANK_URL + "/")
    gy = reachable(GY_HUB + "/") or reachable(GY_HUB + "/api/lan")
    return {
        "ok": True,
        "ytdlp": find_ytdlp(),
        "ffmpeg": find_ffmpeg(),
        "ffplay": find_ffplay(),
        "blank": blank,
        "blank_url": BLANK_URL if blank else None,
        "gy_hub": gy,
        "gy_hub_url": GY_HUB if gy else None,
        "gy_bin": find_gy(),
        "hls_root": str(HLS_ROOT),
        "jobs": list(HLS_JOBS.keys()),
    }


def ytdlp_format(quality: str) -> str:
    q = (quality or "1080").lower().strip()
    if q in ("best", "max", "source"):
        return "bestvideo*+bestaudio/best/best"
    if q in ("720", "720p"):
        return "best[height<=720]/bv*[height<=720]+ba/b[height<=720]/best"
    if q in ("480", "480p"):
        return "best[height<=480]/bv*[height<=480]+ba/b[height<=480]/best"
    # default 1080 high-res browser path
    return "best[height<=1080]/bv*[height<=1080]+ba/b[height<=1080]/best"


def ytdlp_resolve(url: str, quality: str = "1080"):
    bin_path = find_ytdlp()
    if not bin_path:
        return None, "yt-dlp not found — brew install yt-dlp  or  uv tool install yt-dlp"
    fmt = ytdlp_format(quality)
    try:
        # Direct playable URL(s)
        out = subprocess.check_output(
            [
                bin_path,
                "--no-playlist",
                "--no-warnings",
                "-f",
                fmt,
                "-g",
                "--",
                url,
            ],
            text=True,
            errors="replace",
            timeout=90,
            stderr=subprocess.DEVNULL,
        )
        lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
        if not lines:
            return None, "yt-dlp returned no URL"
        video = lines[0]
        audio = lines[1] if len(lines) > 1 else None
        title, live = "", False
        try:
            meta = subprocess.check_output(
                [
                    bin_path,
                    "--no-playlist",
                    "--no-warnings",
                    "--print",
                    "%(title)s",
                    "--print",
                    "%(is_live)s",
                    "--",
                    url,
                ],
                text=True,
                errors="replace",
                timeout=45,
                stderr=subprocess.DEVNULL,
            )
            mlines = [ln.strip() for ln in meta.splitlines()]
            if mlines:
                title = mlines[0]
            if len(mlines) > 1:
                live = mlines[1].lower() in ("1", "true", "yes")
        except Exception:
            pass
        kind = "hls" if (".m3u8" in video.lower() or "manifest" in video.lower()) else "progressive"
        return {
            "ok": True,
            "url": url,
            "video": video,
            "audio": audio,
            "title": title or url,
            "live": live,
            "via": "yt-dlp",
            "streamKind": kind,
            "quality": quality,
            "format": fmt,
            "raw": video,
        }, None
    except subprocess.TimeoutExpired:
        return None, "yt-dlp timed out"
    except subprocess.CalledProcessError as e:
        return None, f"yt-dlp failed (rc {e.returncode})"
    except Exception as e:
        return None, str(e)


def blank_resolve(url: str):
    if not reachable(BLANK_URL + "/"):
        return None, "blank not reachable"
    try:
        j = http_json(
            BLANK_URL + "/api/ingest/resolve",
            method="POST",
            body={"url": url},
            timeout=95,
        )
        stream = j.get("streamUrl") or j.get("video") or ""
        play_path = j.get("playPath") or ""
        play = stream
        if play_path:
            # blank-relative HLS proxy for browser
            if play_path.startswith("http"):
                play = play_path
            else:
                play = BLANK_URL + play_path
        if not play and not stream:
            return None, j.get("error") or "blank resolve empty"
        kind = j.get("streamKind") or (
            "hls" if ".m3u8" in (play or stream).lower() else "progressive"
        )
        return {
            "ok": True,
            "url": url,
            "video": play or stream,
            "play": play or stream,
            "title": j.get("title") or url,
            "live": bool(j.get("live") or kind == "hls"),
            "via": "blank",
            "streamKind": kind,
            "raw": stream,
            "blank": BLANK_URL,
        }, None
    except Exception as e:
        return None, f"blank: {e}"


def gy_hub_resolve(url: str, quality: str = "1080"):
    if not (reachable(GY_HUB + "/") or reachable(GY_HUB + "/api/lan")):
        return None, "gy hub not reachable (gy serve)"
    try:
        q = quote(url, safe="")
        # quality: hub accepts best / etc — map 1080 → best for high-res
        hq = "best" if quality in ("1080", "best", "max") else quality
        j = http_json(
            f"{GY_HUB}/api/media/resolve?url={q}&quality={quote(hq)}",
            timeout=100,
        )
        if not j.get("ok") and not j.get("video"):
            return None, j.get("error") or "gy hub resolve failed"
        video = j.get("video") or ""
        # rewrite relative play paths to absolute hub origin
        if video.startswith("/"):
            video = GY_HUB + video
        return {
            "ok": True,
            "url": url,
            "video": video,
            "play": video,
            "title": j.get("title") or url,
            "live": bool(j.get("live")),
            "via": j.get("via") or "gy-hub",
            "streamKind": j.get("streamKind") or (
                "hls" if ".m3u8" in video.lower() else "progressive"
            ),
            "raw": j.get("raw"),
            "quality": j.get("quality") or quality,
            "platform": j.get("platform"),
            "handle": j.get("handle"),
            "gy_hub": GY_HUB,
        }, None
    except Exception as e:
        return None, f"gy hub: {e}"


def expand_media_input(raw: str) -> str:
    """Normalize handles / shortcuts into resolvable URLs or device refs."""
    s = (raw or "").strip()
    if not s:
        return s
    # device: / cam: already facility style
    if re.match(r"^(device|cam|uvc):", s, re.I):
        return s
    # bare @handle → youtube live-first (GY social style)
    if s.startswith("@") and " " not in s and "://" not in s:
        h = s[1:]
        return f"https://www.youtube.com/@{h}/live"
    # platform:handle
    m = re.match(r"^(youtube|yt|twitch|tiktok|x|twitter):(@?)([\w.-]+)$", s, re.I)
    if m:
        plat, _, handle = m.group(1).lower(), m.group(2), m.group(3)
        if plat in ("youtube", "yt"):
            return f"https://www.youtube.com/@{handle}/live"
        if plat == "twitch":
            return f"https://www.twitch.tv/{handle}"
        if plat == "tiktok":
            return f"https://www.tiktok.com/@{handle}/live"
        if plat in ("x", "twitter"):
            return f"https://x.com/{handle}"
    return s


def _kill_job_proc(job):
    proc = job.get("proc") if job else None
    if proc and proc.poll() is None:
        try:
            proc.terminate()
            try:
                proc.wait(timeout=1.5)
            except subprocess.TimeoutExpired:
                proc.kill()
        except Exception:
            pass


def stop_hls_job(job_id=None):
    with MEDIA_LOCK:
        ids = [job_id] if job_id else list(HLS_JOBS.keys())
        stopped = []
        for jid in ids:
            if not jid:
                continue
            job = HLS_JOBS.pop(jid, None)
            if not job:
                continue
            _kill_job_proc(job)
            stopped.append(jid)
        return stopped


def start_hls_job(src: str, title: str = "", live: bool = False):
    """ffmpeg restream → same-origin HLS (CORS-safe high-res browser path)."""
    ff = find_ffmpeg()
    if not ff:
        return None, "ffmpeg not found — brew install ffmpeg"
    job_id = uuid.uuid4().hex[:12]
    out_dir = HLS_ROOT / job_id
    out_dir.mkdir(parents=True, exist_ok=True)
    index = out_dir / "index.m3u8"
    seg = str(out_dir / "seg_%03d.ts")

    # Input: local camera, or remote URL
    args = [ff, "-hide_banner", "-loglevel", "error", "-y"]
    low = src.lower()
    is_device = low.startswith("device:") or low.startswith("cam:") or low.startswith("uvc:")
    if is_device:
        ref = src.split(":", 1)[1].strip() or "0"
        if sys.platform == "darwin":
            args += ["-f", "avfoundation", "-framerate", "30", "-video_size", "1280x720", "-i", f"{ref}:none"]
        else:
            dev = ref if ref.startswith("/dev/") else f"/dev/video{ref}"
            args += ["-f", "v4l2", "-framerate", "30", "-video_size", "1280x720", "-i", dev]
        live = True
    else:
        # Network / HLS: no -re (faster first segment). Local files only: pace with -re.
        if not live and not src.startswith("http") and Path(src).is_file():
            args += ["-re"]
        args += ["-i", src]

    args += [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-maxrate", "6M", "-bufsize", "12M",
        "-vf", "scale=-2:'min(1080,ih)'",
        "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000",
        "-f", "hls", "-hls_time", "2", "-hls_list_size", "8",
        "-hls_flags", "delete_segments+append_list",
        "-hls_segment_filename", seg, str(index),
    ]

    try:
        proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    except Exception as e:
        return None, str(e)

    time.sleep(0.6)
    if proc.poll() is not None:
        err = (proc.stderr.read() or b"").decode("utf-8", "replace")[:400]
        args_v = [ff, "-hide_banner", "-loglevel", "error", "-y"]
        if is_device:
            ref = src.split(":", 1)[1].strip() or "0"
            if sys.platform == "darwin":
                args_v += ["-f", "avfoundation", "-framerate", "30", "-video_size", "1280x720", "-i", f"{ref}:none"]
            else:
                dev = ref if ref.startswith("/dev/") else f"/dev/video{ref}"
                args_v += ["-f", "v4l2", "-i", dev]
        else:
            if not live and not src.startswith("http") and Path(src).is_file():
                args_v += ["-re"]
            args_v += ["-i", src]
        args_v += [
            "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-vf", "scale=-2:'min(1080,ih)'",
            "-f", "hls", "-hls_time", "2", "-hls_list_size", "8",
            "-hls_flags", "delete_segments+append_list",
            "-hls_segment_filename", seg, str(index),
        ]
        try:
            proc = subprocess.Popen(args_v, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e2:
            return None, f"ffmpeg failed: {err or e2}"

    job = {
        "id": job_id,
        "proc": proc,
        "dir": str(out_dir),
        "src": src,
        "title": title,
        "started": time.time(),
        "play": f"/api/media/hls/{job_id}/index.m3u8",
    }
    # Evict oldest without nested lock
    with MEDIA_LOCK:
        while len(HLS_JOBS) >= 3:
            old = next(iter(HLS_JOBS))
            old_job = HLS_JOBS.pop(old)
            _kill_job_proc(old_job)
        HLS_JOBS[job_id] = job

    for _ in range(40):
        if index.is_file() and index.stat().st_size > 20:
            break
        if proc.poll() is not None:
            with MEDIA_LOCK:
                HLS_JOBS.pop(job_id, None)
            return None, "ffmpeg exited before HLS ready"
        time.sleep(0.25)
    if not index.is_file():
        return None, "HLS playlist not ready (ffmpeg still buffering? retry)"

    log_event("media", f"hls job {job_id}", src=src[:120], title=title)
    return job, None


def push_media_history(entry):
    MEDIA_HISTORY.insert(0, entry)
    del MEDIA_HISTORY[40:]


def resolve_media(url: str, quality: str = "1080", restream: bool = True, prefer_blank=False, prefer_gy=True):
    raw_in = url
    url = expand_media_input(url)
    if not url:
        return {"ok": False, "error": "missing url"}

    # Local device always goes through ffmpeg HLS
    if re.match(r"^(device|cam|uvc):", url, re.I):
        job, err = start_hls_job(url, title="Camera", live=True)
        if err:
            return {"ok": False, "error": err, "url": url}
        out = {
            "ok": True,
            "url": raw_in,
            "resolved": url,
            "title": "Camera",
            "via": "ffmpeg-device",
            "streamKind": "hls",
            "play": job["play"],
            "video": job["play"],
            "jobId": job["id"],
            "live": True,
            "quality": quality,
        }
        push_media_history(out)
        return out

    result = None
    errors = []

    # 1) Prefer GY hub blank-lite (CORS play proxy) when up
    if prefer_gy:
        r, err = gy_hub_resolve(url, quality)
        if r:
            result = r
        elif err:
            errors.append(err)

    # 2) blank node ingest
    if result is None and (prefer_blank or True):
        r, err = blank_resolve(url)
        if r:
            result = r
        elif err:
            errors.append(err)

    # 3) local yt-dlp
    if result is None:
        r, err = ytdlp_resolve(url, quality)
        if r:
            result = r
        elif err:
            errors.append(err)

    if result is None:
        return {
            "ok": False,
            "error": "; ".join(errors) or "resolve failed",
            "url": url,
            "tools": media_tools(),
        }

    play = result.get("play") or result.get("video") or ""
    kind = result.get("streamKind") or ""
    via = result.get("via") or ""
    play_l = play.lower()

    # Same-origin restream for CORS-hostile CDNs (YouTube etc.).
    # Public demo HLS (mux, etc.) and hub/blank proxies play direct.
    cors_friendly = any(
        h in play_l
        for h in (
            "mux.dev",
            "cloudfront.net",
            "akamai",
            "cloudflare",
            GY_HUB.lower(),
            BLANK_URL.lower(),
        )
    )
    needs_restream = restream and (
        "googlevideo.com" in play_l
        or "manifest.googlevideo" in play_l
        or ("youtube" in play_l and "m3u8" in play_l)
        or (via == "yt-dlp" and not cors_friendly and kind in ("hls", "progressive"))
    )
    # Hub/blank already CORS-proxied — use direct
    if via in ("gy-hub", "blank") or play.startswith("/api/media/"):
        needs_restream = False
    if play.startswith(GY_HUB) or play.startswith(BLANK_URL):
        needs_restream = False

    job_id = None
    if needs_restream and find_ffmpeg():
        # Prefer raw URL for ffmpeg input
        src = result.get("raw") or play
        job, err = start_hls_job(src, title=result.get("title") or "", live=bool(result.get("live")))
        if job:
            play = job["play"]
            job_id = job["id"]
            result["via"] = (result.get("via") or "") + "+ffmpeg-hls"
            result["streamKind"] = "hls"
        elif err:
            result["restream_error"] = err

    result["play"] = play
    result["video"] = play
    result["jobId"] = job_id
    result["resolved"] = url
    result["input"] = raw_in
    push_media_history(
        {
            "t": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "url": raw_in,
            "title": result.get("title"),
            "via": result.get("via"),
        }
    )
    log_event("media", f"resolve {result.get('via')}", url=raw_in[:100], title=str(result.get("title") or "")[:80])
    return result


def launch_ffplay(url: str, quality: str = "1080"):
    fp = find_ffplay()
    if not fp:
        return {"ok": False, "error": "ffplay not found — brew install ffmpeg"}
    url = expand_media_input(url)
    # Resolve first if page URL
    src = url
    if not re.match(r"^(device|cam|uvc):", url, re.I) and not re.search(
        r"\.(m3u8|mp4|webm|mkv|mov)(\?|$)", url, re.I
    ):
        r, err = ytdlp_resolve(url, quality)
        if r:
            src = r.get("raw") or r.get("video") or url
        # also try hub/blank quickly
        if err:
            gr, _ = gy_hub_resolve(url, quality)
            if gr and gr.get("raw"):
                src = gr["raw"]
            else:
                br, _ = blank_resolve(url)
                if br and br.get("raw"):
                    src = br["raw"]

    args = [
        fp,
        "-hide_banner",
        "-loglevel",
        "error",
        "-autoexit",
        "-window_title",
        "Architecture Lab · ffplay",
        src,
    ]
    try:
        subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log_event("media", "ffplay launched", src=src[:120])
        return {"ok": True, "message": "ffplay launched", "src": src[:200]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def serve_hls_file(handler, job_id: str, rel: str):
    """Serve HLS playlist/segments from job dir."""
    job = HLS_JOBS.get(job_id)
    if not job:
        return handler._json(404, {"ok": False, "error": "unknown job"})
    # sanitize path
    rel = rel.lstrip("/").replace("..", "")
    base = Path(job["dir"]).resolve()
    path = (base / rel).resolve()
    if not str(path).startswith(str(base)) or not path.is_file():
        return handler._json(404, {"ok": False, "error": "missing segment"})
    ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    if path.suffix == ".m3u8":
        ctype = "application/vnd.apple.mpegurl"
    elif path.suffix == ".ts":
        ctype = "video/mp2t"
    data = path.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", ctype)
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


def summon_grok(phrase="", multi=True):
    """Launch Grok; on macOS open multi Terminal panes (Grok + process watch + lab API)."""
    bin_path = find_grok()
    if not bin_path:
        log_event("error", "summon failed: grok not found")
        return {
            "ok": True,
            "launched": False,
            "message": "grok binary not found — install or set GROK_BIN",
            "mitigation": "curl -fsSL https://x.ai/cli/install.sh | bash  OR  cargo build -p xai-grok-pager-bin",
            "panes": [],
        }
    panes = []
    try:
        if sys.platform == "darwin" and shutil.which("osascript"):
            # Pane 1: Grok interactive TUI
            # Pane 2: process watch (grok/ffmpeg/gy)
            # Pane 3: lab health poll
            gy = find_gy() or "gy"
            watch_cmd = (
                "while true; do clear; date; "
                "echo '── grok / gy / ffmpeg ──'; "
                "ps -axo pid,pcpu,state,command | grep -E 'grok|xai-grok|ffmpeg|grokytalky|\\\\bgy\\\\b' | grep -v grep | head -40; "
                "sleep 2; done"
            )
            health_cmd = (
                f"while true; do clear; date; "
                f"curl -s http://127.0.0.1:{PORT}/api/health; echo; "
                f"curl -s http://127.0.0.1:{PORT}/api/processes | head -c 1200; echo; "
                f"sleep 3; done"
            )
            # Escape for AppleScript
            def esc(s):
                return s.replace("\\", "\\\\").replace('"', '\\"')

            script = f'''
            tell application "Terminal"
              activate
              set w to do script "exec {esc(bin_path)}"
              set custom title of front window to "Grok"
              delay 0.25
              do script "{esc(watch_cmd)}"
              set custom title of front window to "Processes"
              delay 0.2
              do script "{esc(health_cmd)}"
              set custom title of front window to "Lab API"
            end tell
            '''
            subprocess.Popen(
                ["osascript", "-e", script],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            panes = [
                {"id": "grok", "title": "Grok", "kind": "app", "cmd": bin_path},
                {"id": "procs", "title": "Processes", "kind": "watch", "cmd": "ps watch"},
                {"id": "api", "title": "Lab API", "kind": "watch", "cmd": f"curl :{PORT}/api"},
            ]
            log_event("info", "summoned multi-terminal Grok", bin=bin_path, phrase=phrase)
            return {
                "ok": True,
                "launched": True,
                "via": "Terminal.app-multi",
                "bin": bin_path,
                "phrase": phrase,
                "panes": panes,
                "multi": True,
            }
        # Non-macOS: detach grok only
        subprocess.Popen(
            [bin_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        panes = [{"id": "grok", "title": "Grok", "kind": "app", "cmd": bin_path}]
        log_event("info", "summoned grok detach", bin=bin_path)
        return {
            "ok": True,
            "launched": True,
            "via": "detach",
            "bin": bin_path,
            "panes": panes,
            "multi": False,
        }
    except Exception as e:
        log_event("error", f"summon exception: {e}")
        return {
            "ok": False,
            "launched": False,
            "message": str(e),
            "mitigation": "Run manually: grok   or  open Terminal and exec GROK_BIN",
            "panes": [],
        }


def list_processes():
    """Snapshot of lab-relevant processes + heuristics for errors/mitigations."""
    interesting = re.compile(
        r"grok|xai-grok|ffmpeg|gy |grokytalky|python3.*8765|http\.server",
        re.I,
    )
    procs = []
    try:
        out = subprocess.check_output(
            ["ps", "-axo", "pid=,pcpu=,pmem=,etime=,state=,command="],
            text=True,
            errors="replace",
        )
    except Exception as e:
        return {
            "ok": False,
            "processes": [],
            "errors": [{"code": "ps_failed", "msg": str(e), "mitigation": "macOS/Linux ps required"}],
        }

    ffmpeg_count = 0
    for line in out.splitlines():
        line = line.strip()
        if not line or not interesting.search(line):
            continue
        # skip self noise lightly
        parts = line.split(None, 5)
        if len(parts) < 6:
            continue
        pid, pcpu, pmem, etime, state, cmd = parts
        kind = "other"
        cl = cmd.lower()
        if "ffmpeg" in cl:
            kind = "ffmpeg"
            ffmpeg_count += 1
        elif "xai-grok" in cl or re.search(r"\bgrok\b", cl):
            kind = "grok"
        elif "grokytalky" in cl or re.search(r"\bgy\b", cl):
            kind = "gy"
        elif "8765" in cl or "architecture-lab" in cl:
            kind = "lab-server"
        procs.append(
            {
                "pid": int(pid),
                "cpu": float(pcpu),
                "mem": float(pmem),
                "etime": etime,
                "state": state,
                "cmd": cmd[:220],
                "kind": kind,
            }
        )

    errors = []
    # stuck ffmpeg high CPU
    for p in procs:
        if p["kind"] == "ffmpeg" and p["cpu"] > 80:
            errors.append(
                {
                    "code": "ffmpeg_hot",
                    "pid": p["pid"],
                    "msg": f"ffmpeg pid {p['pid']} at {p['cpu']}% CPU — possible wedged avfoundation cam",
                    "mitigation": "POST /api/mitigate {\"action\":\"kill-ffmpeg\"}  or  killall ffmpeg",
                    "severity": "warn",
                }
            )
    if ffmpeg_count > 4:
        errors.append(
            {
                "code": "ffmpeg_swarm",
                "msg": f"{ffmpeg_count} ffmpeg processes — camera spool risk",
                "mitigation": "POST /api/mitigate {\"action\":\"kill-ffmpeg\"}",
                "severity": "warn",
            }
        )
    if not any(p["kind"] == "grok" for p in procs):
        errors.append(
            {
                "code": "grok_not_running",
                "msg": "No grok process in snapshot",
                "mitigation": "POST /api/summon-grok  or  say “hey grok” with Listen on",
                "severity": "info",
            }
        )

    return {
        "ok": True,
        "ts": time.time(),
        "processes": procs,
        "errors": errors,
        "bins": {"grok": find_grok(), "gy": find_gy()},
    }


def git_log(limit=40, repo=None):
    path = Path(repo) if repo else REPO
    if not (path / ".git").exists():
        return {"ok": False, "commits": [], "message": f"no git repo at {path}"}
    try:
        out = subprocess.check_output(
            [
                "git",
                "-C",
                str(path),
                "log",
                f"-{int(limit)}",
                "--pretty=format:%H|%h|%an|%ae|%ad|%s",
                "--date=iso-strict",
            ],
            text=True,
            errors="replace",
        )
    except Exception as e:
        return {"ok": False, "commits": [], "message": str(e)}
    commits = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 5)
        if len(parts) < 6:
            continue
        full, short, author, email, date, subject = parts
        commits.append(
            {
                "hash": full,
                "short": short,
                "author": author,
                "email": email,
                "date": date,
                "subject": subject,
            }
        )
    return {
        "ok": True,
        "repo": str(path),
        "commits": commits,
        "head": commits[0]["short"] if commits else None,
    }


def mitigate(action: str):
    action = (action or "").strip().lower()
    if action in ("kill-ffmpeg", "pkill-ffmpeg", "reap-cam"):
        # soft then hard — matches gy ExitMediaCleanup spirit
        r1 = subprocess.run(["pkill", "-x", "ffmpeg"], capture_output=True, text=True)
        time.sleep(0.08)
        r2 = subprocess.run(["pkill", "-9", "-x", "ffmpeg"], capture_output=True, text=True)
        log_event("mitigate", "kill-ffmpeg", rc1=r1.returncode, rc2=r2.returncode)
        return {
            "ok": True,
            "action": "kill-ffmpeg",
            "message": "pkill -x ffmpeg (TERM then KILL)",
            "rc": [r1.returncode, r2.returncode],
        }
    if action in ("summon-grok", "grok"):
        return summon_grok("mitigate")
    if action == "clear-log":
        LOG_BUF.clear()
        return {"ok": True, "action": "clear-log"}
    return {
        "ok": False,
        "message": f"unknown action {action}",
        "known": ["kill-ffmpeg", "summon-grok", "clear-log"],
    }


def xai_api_key():
    for k in ("XAI_API_KEY", "GROK_API_KEY", "XAI_KEY"):
        v = (os.environ.get(k) or "").strip()
        if v:
            return v
    auth = Path.home() / ".grok" / "auth.json"
    try:
        data = json.loads(auth.read_text(encoding="utf-8"))
        for key in ("api_key", "xai_api_key", "token", "access_token"):
            v = data.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
    except Exception:
        pass
    return None


def list_spacexai_voices():
    """Static catalog + optional live merge from SpaceXAI TTS voices API."""
    catalog_path = ROOT / "assets" / "spacexai-voices.json"
    voices = []
    models = {
        "agent": "grok-voice-latest",
        "realtime_ws": "wss://api.x.ai/v1/realtime?model=grok-voice-latest",
        "tts": "https://api.x.ai/v1/tts",
        "tts_voices": "https://api.x.ai/v1/tts/voices",
    }
    live = False
    try:
        cat = json.loads(catalog_path.read_text(encoding="utf-8"))
        voices = list(cat.get("voices") or [])
        if cat.get("models"):
            models = cat["models"]
    except Exception:
        voices = [
            {"id": x, "name": x.capitalize(), "gen": "original"}
            for x in ("ara", "eve", "leo", "rex", "sal")
        ]
    key = xai_api_key()
    if key:
        try:
            import urllib.request

            req = urllib.request.Request(
                "https://api.x.ai/v1/tts/voices",
                headers={"Authorization": f"Bearer {key}"},
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            arr = payload.get("voices") if isinstance(payload, dict) else payload
            if isinstance(arr, list):
                live = True
                by_id = {
                    str(v.get("id") or "").lower(): v
                    for v in voices
                    if isinstance(v, dict)
                }
                for item in arr:
                    if not isinstance(item, dict):
                        continue
                    vid = str(item.get("voice_id") or item.get("id") or "").lower()
                    if not vid:
                        continue
                    if vid in by_id:
                        if item.get("name"):
                            by_id[vid]["name"] = item["name"]
                    else:
                        by_id[vid] = {
                            "id": vid,
                            "name": item.get("name") or vid,
                            "gen": "flagship",
                            "tone": item.get("description") or "",
                            "custom": bool(item.get("custom")),
                        }
                voices = list(by_id.values())
        except Exception as e:
            log_event("voices", f"live merge failed: {e}")
    return {
        "ok": True,
        "live": live,
        "has_key": bool(key),
        "count": len(voices),
        "models": models,
        "voices": voices,
        "default_voice_id": "eve",
    }


def tts_proxy(data: dict):
    """Proxy SpaceXAI TTS so the browser never sees the API key."""
    key = xai_api_key()
    if not key:
        return {
            "ok": False,
            "error": "XAI_API_KEY not set — export key for TTS preview",
            "status": 503,
        }
    text = str(data.get("text") or "").strip()[:500]
    if not text:
        return {"ok": False, "error": "text required", "status": 400}
    voice = str(data.get("voice_id") or "eve").strip().lower()
    lang = str(data.get("language") or "en")
    payload = json.dumps(
        {"text": text, "voice_id": voice, "language": lang}
    ).encode("utf-8")
    try:
        import urllib.request

        req = urllib.request.Request(
            "https://api.x.ai/v1/tts",
            data=payload,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            audio = resp.read()
            ctype = resp.headers.get("Content-Type") or "audio/mpeg"
        return {"ok": True, "audio": audio, "content_type": ctype}
    except Exception as e:
        return {"ok": False, "error": f"TTS failed: {e}", "status": 502}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, code, obj):
        body = json.dumps(obj, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path
        q = parse_qs(u.query)

        if path == "/api/health":
            ver = {}
            try:
                ver = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
            except Exception:
                ver = {"source": "local"}
            return self._json(
                200,
                {
                    "ok": True,
                    "grok": find_grok(),
                    "gy": find_gy(),
                    "repo": str(REPO),
                    "media": media_tools(),
                    "version": ver,
                    "ts": time.time(),
                },
            )
        if path == "/api/version" or path == "/version.json":
            # Live git stamp so lab-update.js reloads when HEAD moves (local)
            sha, short, ref = "local", "local", "local"
            try:
                sha = subprocess.check_output(
                    ["git", "-C", str(REPO), "rev-parse", "HEAD"],
                    text=True,
                    stderr=subprocess.DEVNULL,
                ).strip()
                short = subprocess.check_output(
                    ["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"],
                    text=True,
                    stderr=subprocess.DEVNULL,
                ).strip()
                ref = subprocess.check_output(
                    ["git", "-C", str(REPO), "rev-parse", "--abbrev-ref", "HEAD"],
                    text=True,
                    stderr=subprocess.DEVNULL,
                ).strip()
            except Exception:
                pass
            # Also surface dirty tree so local edits can trigger refresh
            dirty = False
            try:
                st = subprocess.check_output(
                    ["git", "-C", str(REPO), "status", "--porcelain"],
                    text=True,
                    stderr=subprocess.DEVNULL,
                )
                dirty = bool(st.strip())
            except Exception:
                pass
            return self._json(
                200,
                {
                    "ok": True,
                    "sha": sha + ("-dirty" if dirty else ""),
                    "short": short + ("*" if dirty else ""),
                    "ref": ref,
                    "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "source": "local-serve",
                    "dirty": dirty,
                    "url": f"http://{HOST}:{PORT}/",
                },
            )
        if path == "/api/processes":
            return self._json(200, list_processes())
        if path == "/api/events":
            return self._json(200, {"ok": True, "events": LOG_BUF[-200:]})
        if path == "/api/git-log":
            limit = int((q.get("limit") or ["40"])[0])
            which = (q.get("repo") or ["grok-build"])[0]
            repo = REPO if which != "gy" else GY_REPO
            return self._json(200, git_log(limit, repo))
        if path == "/api/summon-grok":
            multi = (q.get("multi") or ["1"])[0] != "0"
            return self._json(200, summon_grok("GET", multi=multi))
        if path == "/api/mitigate":
            action = (q.get("action") or [""])[0]
            return self._json(200, mitigate(action))
        if path == "/api/media/tools":
            return self._json(200, media_tools())
        if path == "/api/media/history":
            return self._json(200, {"ok": True, "history": MEDIA_HISTORY[:40]})
        if path == "/api/voices":
            return self._json(200, list_spacexai_voices())
        if path == "/api/media/resolve":
            url = (q.get("url") or q.get("q") or [""])[0]
            quality = (q.get("quality") or ["1080"])[0]
            restream = (q.get("restream") or ["1"])[0] != "0"
            return self._json(
                200,
                resolve_media(url, quality=quality, restream=restream),
            )
        if path.startswith("/api/media/hls/"):
            # /api/media/hls/{job_id}/index.m3u8 or seg_000.ts
            rest = path[len("/api/media/hls/") :]
            parts = rest.split("/", 1)
            if len(parts) < 2:
                return self._json(400, {"ok": False, "error": "need /api/media/hls/{id}/file"})
            return serve_hls_file(self, parts[0], parts[1])
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        data = self._read_json()
        if path == "/api/summon-grok":
            multi = data.get("multi", True)
            return self._json(
                200,
                summon_grok(str(data.get("phrase") or ""), multi=bool(multi)),
            )
        if path == "/api/mitigate":
            return self._json(200, mitigate(str(data.get("action") or "")))
        if path == "/api/events":
            log_event(
                str(data.get("level") or "info"),
                str(data.get("msg") or ""),
                source=data.get("source") or "client",
            )
            return self._json(200, {"ok": True})
        if path == "/api/media/resolve":
            url = str(data.get("url") or data.get("q") or "")
            quality = str(data.get("quality") or "1080")
            restream = bool(data.get("restream", True))
            prefer_blank = bool(data.get("prefer_blank", False))
            prefer_gy = bool(data.get("prefer_gy", True))
            out = resolve_media(
                url,
                quality=quality,
                restream=restream,
                prefer_blank=prefer_blank,
                prefer_gy=prefer_gy,
            )
            code = 200 if out.get("ok") else 502
            return self._json(code, out)
        if path == "/api/media/stop":
            jid = data.get("jobId") or data.get("job_id")
            stopped = stop_hls_job(jid if jid else None)
            return self._json(200, {"ok": True, "stopped": stopped})
        if path == "/api/media/ffplay":
            return self._json(
                200,
                launch_ffplay(
                    str(data.get("url") or ""),
                    quality=str(data.get("quality") or "1080"),
                ),
            )
        if path == "/api/tts":
            out = tts_proxy(data if isinstance(data, dict) else {})
            if not out.get("ok"):
                return self._json(int(out.get("status") or 502), out)
            audio = out["audio"]
            self.send_response(200)
            self.send_header("Content-Type", out.get("content_type") or "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
            return
        return self._json(404, {"ok": False, "message": "not found"})


httpd = ThreadingHTTPServer((HOST, PORT), Handler)
print(f"serving {ROOT} on http://{HOST}:{PORT}", flush=True)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nbye", flush=True)
PY
