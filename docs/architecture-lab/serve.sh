#!/usr/bin/env bash
# Grok Build Lab — static + ops APIs (PTY hub · shells bus · media)
# Usage: ./serve.sh [port]
# If preferred port is busy (e.g. native grok-build-lab on :8765), auto-picks next free.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
WANT_PORT="${1:-8765}"
HOST="${HOST:-127.0.0.1}"
cd "$ROOT"
command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }

port_free() {
  local p="$1"
  # Prefer python bind probe — works without lsof
  python3 - "$HOST" "$p" <<'CHK' 2>/dev/null
import socket, sys
host, port = sys.argv[1], int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind((host, port))
except OSError:
    sys.exit(1)
finally:
    s.close()
sys.exit(0)
CHK
}

PORT="$WANT_PORT"
if ! port_free "$PORT"; then
  echo "  note: :$PORT busy (native Lab often holds 8765) — searching free port…"
  found=""
  for try in $(seq "$WANT_PORT" $((WANT_PORT + 40))); do
    if port_free "$try"; then
      found="$try"
      break
    fi
  done
  if [[ -z "$found" ]]; then
    echo "  error: no free port in ${WANT_PORT}–$((WANT_PORT + 40))" >&2
    echo "  tip: quit Grok Build Lab.app / grok-build-lab, or: lsof -i :${WANT_PORT}" >&2
    exit 1
  fi
  PORT="$found"
  if [[ "$PORT" != "$WANT_PORT" ]]; then
    echo "  → using http://${HOST}:${PORT}/  (PTY hub; native may still be on :${WANT_PORT})"
  fi
fi

echo ""
echo "  Grok Build Lab · serve (PTY hub)"
echo "  http://${HOST}:${PORT}"
echo "  Surfaces:"
echo "    /workbench.html   Center agent + live αβγ xterm  ← Option B primary"
echo "    /                 Lab docs + multi-term"
echo "    /agent.html       Agent console"
echo "    /launch.html      Launch pad"
echo "    /chat.html · /stream.html"
echo "  Option A: native Lab Dock/Arrange + Multi (Panda αβγ OS terms)"
echo "  Option C: see content/24-abc-path.md (Panda/Mu host pipe)"
echo "  APIs: /api/pty/* · /api/shells · /api/panda/open · /api/health · …"
echo ""

# Desktop shell sets LAB_DESKTOP=1 — never open a browser tab for localhost
if [[ -z "${LAB_DESKTOP:-}" ]] && command -v open >/dev/null 2>&1; then
  (sleep 0.35 && open "http://${HOST}:${PORT}/workbench.html") >/dev/null 2>&1 || true
fi

exec python3 - "$HOST" "$PORT" "$ROOT" <<'PY'
import base64, fcntl, json, os, pty, re, select, shutil, struct, subprocess, sys, tempfile, termios, threading, time, uuid, mimetypes
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

# Allow fast restart if OS still holds TIME_WAIT (bind still fails if LISTEN active)
class ReuseHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True

# ── Interactive PTY hub (browser multi-term · localhost only) ─────
PTY_LOCK = threading.Lock()
PTY_SESSIONS = {}  # id -> PtySession
PTY_MAX_BUF = 2_000_000  # ~2MB ring per session


class PtySession:
    """One interactive pseudo-terminal (bash or grok) for an in-browser column."""

    def __init__(self, sid, profile, cols=100, rows=28, cwd=None):
        self.id = sid
        self.profile = profile
        self.cols = max(40, int(cols))
        self.rows = max(10, int(rows))
        self.cwd = str(cwd or REPO)
        self.buf = bytearray()
        self.lock = threading.Lock()
        self.alive = True
        self.started_at = time.time()
        self.master_fd = None
        self.pid = None
        self.cmd = []
        self._open()

    def _env(self):
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["LAB_SHELL"] = self.id
        env["LAB_PROFILE"] = self.profile
        env["GROK_BIN"] = find_grok() or env.get("GROK_BIN", "")
        # force line discipline friendly
        env.setdefault("LANG", "en_US.UTF-8")
        return env

    def _cmd_for_profile(self):
        grok = find_grok()
        shell = os.environ.get("SHELL") or "/bin/zsh"
        if not Path(shell).is_file():
            shell = "/bin/bash"
        if self.profile == "grok" and grok:
            # Interactive TUI — best effort inside PTY
            return [grok]
        if self.profile == "build" and grok:
            # Login shell with banner + grok on PATH; user drives interact/deploy
            banner = (
                f"echo 'β BUILD · {self.cwd}'; "
                f"echo 'Interact: type commands · Deploy: lab-deploy or grok -p …'; "
                f"echo 'Upstream: tools · workspace · worktree · ptyctl'; "
                f"export PS1='β build ❯ '; exec {shell} -i"
            )
            return [shell, "-lc", banner]
        if self.profile == "verify" and grok:
            banner = (
                f"echo 'γ VERIFY · sandbox-friendly shell'; "
                f"echo 'Run tests: cargo test / npm test · grok -p for review'; "
                f"export PS1='γ verify ❯ '; exec {shell} -i"
            )
            return [shell, "-lc", banner]
        if self.profile == "plan":
            banner = (
                f"echo 'α PLAN · read/explore shell (prefer no product writes)'; "
                f"echo 'grok → interactive · grok -p \"…\" for headless plan'; "
                f"export PS1='α plan ❯ '; exec {shell} -i"
            )
            return [shell, "-lc", banner]
        # default bash/zsh interact
        return [shell, "-i"]

    def _open(self):
        self.cmd = self._cmd_for_profile()
        master, slave = pty.openpty()
        self._set_winsize(master, self.rows, self.cols)
        try:
            self.pid = os.fork()
        except OSError as e:
            os.close(master)
            os.close(slave)
            raise RuntimeError(f"fork failed: {e}") from e
        if self.pid == 0:
            # child
            try:
                os.setsid()
                os.dup2(slave, 0)
                os.dup2(slave, 1)
                os.dup2(slave, 2)
                if slave > 2:
                    os.close(slave)
                os.close(master)
                os.chdir(self.cwd)
                os.execvpe(self.cmd[0], self.cmd, self._env())
            except Exception:
                os._exit(127)
        # parent
        os.close(slave)
        flags = fcntl.fcntl(master, fcntl.F_GETFL)
        fcntl.fcntl(master, fcntl.F_SETFL, flags | os.O_NONBLOCK)
        self.master_fd = master
        t = threading.Thread(target=self._reader, name=f"pty-{self.id}", daemon=True)
        t.start()
        self._append(f"\r\n\x1b[90m[lab-pty]\x1b[0m session \x1b[36m{self.id}\x1b[0m profile=\x1b[33m{self.profile}\x1b[0m\r\n".encode())
        self._append(f"\x1b[90m[lab-pty]\x1b[0m cwd={self.cwd}\r\n".encode())
        self._append(f"\x1b[90m[lab-pty]\x1b[0m cmd={' '.join(self.cmd)}\r\n\r\n".encode())

    @staticmethod
    def _set_winsize(fd, rows, cols):
        try:
            fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
        except Exception:
            pass

    def _append(self, data: bytes):
        if not data:
            return
        with self.lock:
            self.buf.extend(data)
            if len(self.buf) > PTY_MAX_BUF:
                # drop oldest
                drop = len(self.buf) - PTY_MAX_BUF
                del self.buf[:drop]

    def _reader(self):
        while self.alive:
            try:
                if self.pid and os.waitpid(self.pid, os.WNOHANG)[0] != 0:
                    self.alive = False
                    self._append(b"\r\n\x1b[31m[lab-pty] process exited\x1b[0m\r\n")
                    break
            except ChildProcessError:
                self.alive = False
                break
            try:
                r, _, _ = select.select([self.master_fd], [], [], 0.15)
            except Exception:
                break
            if not r:
                continue
            try:
                chunk = os.read(self.master_fd, 8192)
            except OSError:
                self.alive = False
                break
            if not chunk:
                self.alive = False
                break
            self._append(chunk)
        self.alive = False

    def write(self, data: bytes):
        if not self.alive or self.master_fd is None:
            raise RuntimeError("session not alive")
        if not data:
            return 0
        return os.write(self.master_fd, data)

    def read_since(self, offset: int):
        with self.lock:
            offset = max(0, min(int(offset), len(self.buf)))
            data = bytes(self.buf[offset:])
            return data, len(self.buf), self.alive

    def resize(self, cols, rows):
        self.cols = max(40, int(cols))
        self.rows = max(10, int(rows))
        if self.master_fd is not None:
            self._set_winsize(self.master_fd, self.rows, self.cols)

    def close(self):
        self.alive = False
        try:
            if self.pid:
                try:
                    os.killpg(self.pid, 15)
                except Exception:
                    try:
                        os.kill(self.pid, 15)
                    except Exception:
                        pass
        except Exception:
            pass
        try:
            if self.master_fd is not None:
                os.close(self.master_fd)
        except Exception:
            pass
        self.master_fd = None

    def info(self):
        with self.lock:
            blen = len(self.buf)
        return {
            "id": self.id,
            "profile": self.profile,
            "alive": self.alive,
            "pid": self.pid,
            "cols": self.cols,
            "rows": self.rows,
            "cwd": self.cwd,
            "cmd": self.cmd,
            "buf_len": blen,
            "uptime_s": round(time.time() - self.started_at, 1),
        }


def pty_open(sid, profile="bash", cols=100, rows=28, cwd=None):
    sid = str(sid or "").strip() or "plan"
    if not re.match(r"^[a-zA-Z0-9_-]{1,32}$", sid):
        return {"ok": False, "error": "invalid session id"}
    profile = str(profile or "bash").lower()
    if profile not in ("bash", "plan", "build", "verify", "grok", "shell"):
        profile = "bash"
    if profile == "shell":
        profile = "bash"
    with PTY_LOCK:
        old = PTY_SESSIONS.get(sid)
        if old:
            try:
                old.close()
            except Exception:
                pass
        try:
            sess = PtySession(sid, profile, cols=cols, rows=rows, cwd=cwd or REPO)
        except Exception as e:
            log_event("error", f"pty open failed: {e}", sid=sid)
            return {"ok": False, "error": str(e)}
        PTY_SESSIONS[sid] = sess
    log_event("info", "pty opened", sid=sid, profile=profile)
    return {"ok": True, "session": sess.info()}


def pty_write(sid, data_text=None, data_b64=None):
    with PTY_LOCK:
        sess = PTY_SESSIONS.get(sid)
    if not sess:
        return {"ok": False, "error": "no session"}
    raw = b""
    if data_b64:
        try:
            raw = base64.b64decode(data_b64)
        except Exception as e:
            return {"ok": False, "error": f"b64: {e}"}
    elif data_text is not None:
        raw = str(data_text).encode("utf-8", errors="replace")
    try:
        n = sess.write(raw)
        return {"ok": True, "wrote": n}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def pty_poll(sid, offset=0):
    with PTY_LOCK:
        sess = PTY_SESSIONS.get(sid)
    if not sess:
        return {"ok": False, "error": "no session", "offset": 0, "alive": False, "data": ""}
    data, new_off, alive = sess.read_since(offset)
    return {
        "ok": True,
        "id": sid,
        "offset": new_off,
        "alive": alive,
        "data": base64.b64encode(data).decode("ascii") if data else "",
        "bytes": len(data),
    }


def pty_resize(sid, cols, rows):
    with PTY_LOCK:
        sess = PTY_SESSIONS.get(sid)
    if not sess:
        return {"ok": False, "error": "no session"}
    sess.resize(cols, rows)
    return {"ok": True, "session": sess.info()}


def pty_close(sid):
    with PTY_LOCK:
        sess = PTY_SESSIONS.pop(sid, None)
    if sess:
        sess.close()
        log_event("info", "pty closed", sid=sid)
        return {"ok": True, "closed": sid}
    return {"ok": True, "closed": None}


def pty_list():
    with PTY_LOCK:
        items = [s.info() for s in PTY_SESSIONS.values()]
    return {"ok": True, "sessions": items}


def pty_deploy(sid, kind="status"):
    """Send a one-shot interact/deploy helper command into a live PTY."""
    with PTY_LOCK:
        sess = PTY_SESSIONS.get(sid)
    if not sess:
        return {"ok": False, "error": "no session — open PTY first"}
    recipes = {
        "status": "echo '── lab deploy status ──'; date; git -C \"$PWD\" status -sb 2>/dev/null | head -30; echo; ls -la | head -20\n",
        "test": "echo '── lab deploy test ──'; (test -f Cargo.toml && cargo test -q -- --nocapture 2>&1 | tail -40) || (test -f package.json && npm test 2>&1 | tail -40) || echo 'no Cargo.toml/package.json tests'\n",
        "fmt": "echo '── lab deploy fmt ──'; (command -v cargo >/dev/null && cargo fmt --all 2>&1 | tail -20) || echo 'cargo fmt n/a'\n",
        "plan": "echo '── headless plan (grok) ──'; GROK=$(command -v grok || command -v xai-grok-pager); if [ -n \"$GROK\" ]; then $GROK -p \"Summarize repo structure and propose next ship steps\" --max-turns 8; else echo 'grok not on PATH'; fi\n",
        "handoff-build": "echo 'POST handoff plan→build'; curl -s -X POST http://127.0.0.1:%d/api/shells/handoff -H 'Content-Type: application/json' -d '{\"from\":\"plan\",\"to\":\"build\",\"summary\":\"deploy area handoff\"}'; echo\n"
        % PORT,
        "handoff-verify": "echo 'POST handoff build→verify'; curl -s -X POST http://127.0.0.1:%d/api/shells/handoff -H 'Content-Type: application/json' -d '{\"from\":\"build\",\"to\":\"verify\",\"summary\":\"ready for verify\"}'; echo\n"
        % PORT,
    }
    cmd = recipes.get(str(kind), recipes["status"])
    try:
        sess.write(cmd.encode("utf-8"))
        return {"ok": True, "sent": kind, "session": sess.info()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


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
        "Grok Build Lab · ffplay",
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


# ── Triple shell activity bus (α plan · β build · γ verify) ─────────
SHELLS_PATH = ROOT / ".lab-shells.json"
SHELL_LOCK = threading.Lock()
SHELL_IDS = ("plan", "build", "verify")
SHELL_META = {
    "plan": {
        "label": "α Plan",
        "role": "explore · plan mode · Q&A · no product writes",
        "upstream": "explore/plan subagents · codebase tools · memory",
        "lab": "chat · Ship plan",
    },
    "build": {
        "label": "β Build",
        "role": "implement · worktree · tools/workspace/hunks",
        "upstream": "xai-grok-tools · workspace · hunk-tracker · fast-worktree · ptyctl",
        "lab": "multi-term · summon grok",
    },
    "verify": {
        "label": "γ Verify",
        "role": "sandbox tests · review · ship gate",
        "upstream": "xai-grok-sandbox · tools · hooks · lab-review",
        "lab": "stream · terminal footer · History",
    },
}
MAX_HANDOFF_LOOP = 5


def default_shells_state():
    return {
        "ok": True,
        "version": 1,
        "max_loop": MAX_HANDOFF_LOOP,
        "shells": {
            sid: {
                "id": sid,
                **SHELL_META[sid],
                "status": "idle",  # idle | running | blocked | done
                "pid": None,
                "last_activity": None,
                "recipe": None,
            }
            for sid in SHELL_IDS
        },
        "queue": [],  # handoff activities
        "active_id": None,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }


def load_shells_state():
    with SHELL_LOCK:
        if SHELLS_PATH.is_file():
            try:
                data = json.loads(SHELLS_PATH.read_text(encoding="utf-8"))
                if isinstance(data, dict) and "shells" in data:
                    return data
            except Exception:
                pass
        return default_shells_state()


def save_shells_state(state):
    state["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with SHELL_LOCK:
        try:
            SHELLS_PATH.write_text(
                json.dumps(state, indent=2) + "\n", encoding="utf-8"
            )
        except Exception as e:
            log_event("warn", f"shells state not persisted: {e}")
    return state


def shells_spawn_recipe(shell_id, task=""):
    """Document how to spin the upstream crates for this shell (no pager fork)."""
    task = (task or "your task").replace("\n", " ")[:500]
    bin_path = find_grok() or "grok"
    repo = str(REPO)
    if shell_id == "plan":
        return {
            "shell": "plan",
            "mode": "headless-or-tui",
            "interactive": f"{bin_path}   # then /plan or Shift+Tab Plan",
            "headless": (
                f'{bin_path} -p "Explore and write an implementation plan for: {task}" '
                f'--disallowed-tools "search_replace" --max-turns 40 --cwd "{repo}"'
            ),
            "crates": [
                "xai-grok-tools (read/grep/list)",
                "xai-codebase-graph (via tools)",
                "xai-grok-memory",
                "xai-grok-subagent-resolution (explore/plan)",
            ],
            "notes": "No product file writes. Approve plan before handoff to build.",
        }
    if shell_id == "build":
        return {
            "shell": "build",
            "mode": "headless-or-tui",
            "interactive": f"{bin_path} --cwd \"{repo}\"",
            "headless": (
                f'{bin_path} -p "Implement the approved plan. Prefer worktree isolation. Task: {task}" '
                f'--cwd "{repo}" --max-turns 80'
            ),
            "crates": [
                "xai-grok-tools",
                "xai-grok-workspace",
                "xai-hunk-tracker",
                "xai-fast-worktree",
                "ptyctl / panda-shell",
            ],
            "notes": "Only shell that should mutate product code. Use spawn_subagent isolation=worktree.",
        }
    # verify
    return {
        "shell": "verify",
        "mode": "headless-sandbox",
        "interactive": f"{bin_path} --cwd \"{repo}\"   # review + run tests",
        "headless": (
            f'{bin_path} -p "Run tests and review regressions. Do not expand scope. Context: {task}" '
            f'--cwd "{repo}" --sandbox workspace-write --disallowed-tools "Agent" --max-turns 25'
        ),
        "crates": [
            "xai-grok-sandbox",
            "xai-grok-tools (test/shell)",
            "xai-grok-hooks",
            "xai-grok-workspace (status)",
        ],
        "notes": "Prefer no product edits. Fail → handoff back to build or plan.",
    }


def shells_handoff(from_s, to_s, summary="", payload=None, loop=None):
    from_s = str(from_s or "").lower().strip()
    to_s = str(to_s or "").lower().strip()
    if from_s not in SHELL_IDS or to_s not in SHELL_IDS:
        return {"ok": False, "error": "from/to must be plan|build|verify"}
    if from_s == to_s:
        return {"ok": False, "error": "from and to must differ"}
    state = load_shells_state()
    # loop from last activity or provided
    last_loop = 0
    if state["queue"]:
        last_loop = int(state["queue"][-1].get("loop") or 0)
    if loop is None:
        # same direction again after fail bumps loop when returning backward
        if (from_s, to_s) in (("verify", "build"), ("verify", "plan"), ("build", "plan")):
            loop = last_loop + 1
        else:
            loop = last_loop
    loop = int(loop)
    if loop > int(state.get("max_loop") or MAX_HANDOFF_LOOP):
        return {
            "ok": False,
            "error": f"max_loop {state.get('max_loop')} exceeded — force plan revise or reset",
            "state": state,
        }
    act_id = f"act-{int(time.time())}-{len(state['queue'])+1}"
    activity = {
        "id": act_id,
        "from": from_s,
        "to": to_s,
        "summary": str(summary or "")[:2000],
        "payload": payload if isinstance(payload, dict) else {},
        "status": "pending",
        "loop": loop,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "recipe": shells_spawn_recipe(to_s, str(summary or "")),
    }
    state["queue"].append(activity)
    state["active_id"] = act_id
    state["shells"][from_s]["status"] = "done"
    state["shells"][from_s]["last_activity"] = act_id
    state["shells"][to_s]["status"] = "running"
    state["shells"][to_s]["last_activity"] = act_id
    state["shells"][to_s]["recipe"] = activity["recipe"]
    save_shells_state(state)
    log_event(
        "info",
        f"handoff {from_s}→{to_s}",
        act=act_id,
        loop=loop,
        summary=activity["summary"][:120],
    )
    return {"ok": True, "activity": activity, "state": state}


def shells_advance(act_id=None, status="done", next_to=None, summary=""):
    state = load_shells_state()
    if not state["queue"]:
        return {"ok": False, "error": "empty queue", "state": state}
    act = None
    if act_id:
        for a in state["queue"]:
            if a.get("id") == act_id:
                act = a
                break
    else:
        act = state["queue"][-1]
    if not act:
        return {"ok": False, "error": "activity not found", "state": state}
    act["status"] = status
    act["advanced_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    to_s = act.get("to")
    if to_s in state["shells"]:
        state["shells"][to_s]["status"] = "done" if status == "done" else "blocked"
    save_shells_state(state)
    out = {"ok": True, "activity": act, "state": state}
    if next_to and status == "done":
        hop = shells_handoff(to_s, next_to, summary=summary or f"auto from {act.get('id')}")
        out["next"] = hop
        out["state"] = hop.get("state") or state
    return out


def shells_set_status(shell_id, status="idle", pid=None):
    shell_id = str(shell_id or "").lower()
    if shell_id not in SHELL_IDS:
        return {"ok": False, "error": "unknown shell"}
    state = load_shells_state()
    state["shells"][shell_id]["status"] = str(status or "idle")
    if pid is not None:
        state["shells"][shell_id]["pid"] = pid
    save_shells_state(state)
    return {"ok": True, "state": state}


def shells_reset():
    state = default_shells_state()
    save_shells_state(state)
    log_event("info", "shells bus reset")
    return state


def summon_triple_shells(task=""):
    """Open three Terminal panes documenting α/β/γ spawn recipes (macOS)."""
    bin_path = find_grok()
    if not bin_path:
        return {
            "ok": False,
            "launched": False,
            "message": "grok not found",
            "mitigation": "install grok or set GROK_BIN",
        }
    state = load_shells_state()
    recipes = {sid: shells_spawn_recipe(sid, task) for sid in SHELL_IDS}
    for sid in SHELL_IDS:
        state["shells"][sid]["status"] = "running"
        state["shells"][sid]["recipe"] = recipes[sid]
    save_shells_state(state)

    def esc(s):
        return s.replace("\\", "\\\\").replace('"', '\\"')

    # Echo recipes + start interactive grok in first pane; other panes show ready cmds
    plan_cmd = (
        f"echo 'α PLAN shell · tools read-only · /plan'; "
        f"echo '{esc(recipes['plan']['headless'][:200])}…'; "
        f"exec {esc(bin_path)}"
    )
    build_cmd = (
        f"echo 'β BUILD shell · tools/workspace/worktree'; "
        f"echo 'Run headless when plan approved:'; "
        f"echo '{esc(recipes['build']['headless'][:220])}…'; "
        f"exec {esc(bin_path)}"
    )
    verify_cmd = (
        f"echo 'γ VERIFY shell · sandbox · tests'; "
        f"echo '{esc(recipes['verify']['headless'][:220])}…'; "
        f"exec {esc(bin_path)}"
    )
    panes = [
        {"id": "plan", "title": "α Plan", "kind": "shell", "cmd": recipes["plan"]["interactive"]},
        {"id": "build", "title": "β Build", "kind": "shell", "cmd": recipes["build"]["interactive"]},
        {"id": "verify", "title": "γ Verify", "kind": "shell", "cmd": recipes["verify"]["interactive"]},
    ]
    if sys.platform == "darwin" and shutil.which("osascript"):
        script = f'''
        tell application "Terminal"
          activate
          do script "{esc(plan_cmd)}"
          set custom title of front window to "α Plan"
          delay 0.3
          do script "{esc(build_cmd)}"
          set custom title of front window to "β Build"
          delay 0.25
          do script "{esc(verify_cmd)}"
          set custom title of front window to "γ Verify"
        end tell
        '''
        try:
            subprocess.Popen(
                ["osascript", "-e", script],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            log_event("info", "summoned triple shells", task=task[:80])
            return {
                "ok": True,
                "launched": True,
                "via": "Terminal.app-triple",
                "panes": panes,
                "recipes": recipes,
                "state": state,
            }
        except Exception as e:
            log_event("error", f"triple summon failed: {e}")
            return {"ok": False, "launched": False, "message": str(e), "recipes": recipes}
    # non-macOS: single detach + recipes
    subprocess.Popen(
        [bin_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return {
        "ok": True,
        "launched": True,
        "via": "detach-single",
        "panes": panes[:1],
        "recipes": recipes,
        "state": state,
        "message": "Opened one grok; use recipes for β/γ in other terminals",
    }


def summon_grok(phrase="", multi=True, triple=False):
    """Launch Grok; on macOS open multi Terminal panes (Grok + process watch + lab API)."""
    if triple or (phrase and re.search(r"\b(triple|three shells|handoff)\b", phrase, re.I)):
        return summon_triple_shells(phrase)
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
            triple = (q.get("triple") or ["0"])[0] != "0"
            return self._json(200, summon_grok("GET", multi=multi, triple=triple))
        if path == "/api/shells":
            return self._json(200, load_shells_state())
        if path == "/api/shells/recipes":
            task = (q.get("task") or [""])[0]
            return self._json(
                200,
                {
                    "ok": True,
                    "recipes": {sid: shells_spawn_recipe(sid, task) for sid in SHELL_IDS},
                },
            )
        if path == "/api/pty/list":
            return self._json(200, pty_list())
        if path == "/api/pty/poll":
            sid = (q.get("id") or ["plan"])[0]
            off = int((q.get("offset") or ["0"])[0] or 0)
            return self._json(200, pty_poll(sid, off))
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
            triple = bool(data.get("triple") or data.get("shells") == "triple")
            return self._json(
                200,
                summon_grok(
                    str(data.get("phrase") or ""),
                    multi=bool(multi),
                    triple=triple,
                ),
            )
        if path == "/api/shells":
            # update one shell status
            sid = data.get("id") or data.get("shell")
            if sid:
                return self._json(
                    200,
                    shells_set_status(
                        sid,
                        status=str(data.get("status") or "idle"),
                        pid=data.get("pid"),
                    ),
                )
            return self._json(200, load_shells_state())
        if path == "/api/shells/handoff":
            return self._json(
                200,
                shells_handoff(
                    data.get("from"),
                    data.get("to"),
                    summary=str(data.get("summary") or data.get("msg") or ""),
                    payload=data.get("payload"),
                    loop=data.get("loop"),
                ),
            )
        if path == "/api/shells/advance":
            return self._json(
                200,
                shells_advance(
                    act_id=data.get("id") or data.get("act_id"),
                    status=str(data.get("status") or "done"),
                    next_to=data.get("next_to") or data.get("next"),
                    summary=str(data.get("summary") or ""),
                ),
            )
        if path == "/api/shells/spawn":
            if data.get("triple") or data.get("mode") == "triple":
                return self._json(
                    200, summon_triple_shells(str(data.get("task") or data.get("phrase") or ""))
                )
            sid = str(data.get("shell") or data.get("id") or "plan")
            recipe = shells_spawn_recipe(sid, str(data.get("task") or ""))
            shells_set_status(sid, "running")
            return self._json(200, {"ok": True, "recipe": recipe, "state": load_shells_state()})
        if path == "/api/shells/reset":
            return self._json(200, shells_reset())
        if path == "/api/pty/open":
            return self._json(
                200,
                pty_open(
                    data.get("id") or data.get("shell") or "plan",
                    profile=str(data.get("profile") or data.get("mode") or "plan"),
                    cols=int(data.get("cols") or 100),
                    rows=int(data.get("rows") or 28),
                    cwd=data.get("cwd"),
                ),
            )
        if path == "/api/pty/write":
            return self._json(
                200,
                pty_write(
                    str(data.get("id") or "plan"),
                    data_text=data.get("data") if data.get("data") is not None else data.get("text"),
                    data_b64=data.get("b64") or data.get("data_b64"),
                ),
            )
        if path == "/api/pty/resize":
            return self._json(
                200,
                pty_resize(
                    str(data.get("id") or "plan"),
                    cols=int(data.get("cols") or 80),
                    rows=int(data.get("rows") or 24),
                ),
            )
        if path == "/api/pty/close":
            return self._json(200, pty_close(str(data.get("id") or "plan")))
        if path == "/api/pty/deploy":
            return self._json(
                200,
                pty_deploy(
                    str(data.get("id") or data.get("shell") or "build"),
                    kind=str(data.get("kind") or data.get("action") or "status"),
                ),
            )
        if path == "/api/pty/open-triple":
            # open α plan · β build · γ verify interactive PTYs
            out = {}
            for sid, prof in (("plan", "plan"), ("build", "build"), ("verify", "verify")):
                out[sid] = pty_open(
                    sid,
                    profile=prof,
                    cols=int(data.get("cols") or 90),
                    rows=int(data.get("rows") or 26),
                    cwd=data.get("cwd"),
                )
            return self._json(200, {"ok": True, "sessions": out})
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


httpd = ReuseHTTPServer((HOST, PORT), Handler)
print(f"serving {ROOT} on http://{HOST}:{PORT}", flush=True)
print(f"workbench → http://{HOST}:{PORT}/workbench.html", flush=True)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nbye", flush=True)
PY
