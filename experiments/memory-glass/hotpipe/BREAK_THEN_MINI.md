# Charge · break · then Mac Mini

**Laptop tip when you left:** check `git log -1 --oneline` on `main` (expect `1c84459` or later: dock + CORP pipeline + capture nv12 fix).

**Cameras should be OFF for the break** — no `capture-stream`, no multi-ffmpeg, still-server optional down.

---

## Right now (laptop — low battery)

```bash
# 1) Stop camera writers (copy whole block)
ps -axo pid=,command= | while IFS= read -r line; do
  case "$line" in
    *still-server.py*|*capture-stream.sh*|*snap-loop*|*snap-fast*)
      kill -9 ${line%% *} 2>/dev/null ;;
    *ffmpeg*)
      case "$line" in
        *live.jpg*|*avfoundation*|*glass.jpg*|*screen.jpg*)
          kill -9 ${line%% *} 2>/dev/null ;;
      esac ;;
  esac
done
rm -f ~/.panda/vision/capture-stream.pid ~/.panda/vision/snap-loop.pid

# 2) Quit Memory Glass app (optional, saves battery)
# Cmd+Q Memory Glass  — or:
# killall memory-glass 2>/dev/null

# 3) Plug in · charge · stop heavy builds
```

Confirm cam quiet:

```bash
ps -axo command= | grep -E 'still-server|capture-stream|ffmpeg.*avfoundation' | grep -v grep || echo "cam quiet"
curl -s --connect-timeout 1 http://127.0.0.1:9877/health || echo "still-server down (ok)"
```

**Do not** run `build-mac-app.sh` or multi-ffmpeg until charged.

---

## After break — laptop optional smoke (plugged in)

```bash
cd /Users/qbit/Projects/grok-build
git fetch origin
git pull --ff-only origin main
git log -1 --oneline
# want: company vision dock / capture nv12 or later

cd experiments/memory-glass
bash scripts/mg-install-still-server.sh

# still-server only (HTTP); cam writer optional
python3 ~/.panda/vision/still-server.py &
# ONE camera writer only if you need face HUD:
# bash ~/.panda/vision/capture-stream.sh &
# uses nv12/uyvy422 — if stale: GY_CAM_PIX_FMT=uyvy422 GY_CAM_SIZE=640x480 bash ~/.panda/vision/capture-stream.sh &

bash build-mac-app.sh   # only if app older than tip
open -n "$HOME/Applications/Memory Glass.app"
```

Inspect: **PIPE | CORP | R1 | EGO | CAL**

- **CORP** → seed xAI / Grok / Tesla / SpaceX train URLs  
- **NEXT** → **CAP** (or ⌥⌘R on main) → **EXP** → Grok → **GROK←**  
- Research-only: **leave cam off**

---

## Mac Mini session (main event)

### A. Mini network first

1. Power on Mini (LAN and/or USB-C link-local).  
2. **System Settings → General → Sharing → Remote Login (SSH) ON**.  
3. Note IP: `ipconfig getifaddr en0` (or USB link `169.254.x.x`).

### B. Laptop → Mini (when SSH works)

```bash
export PATH="$HOME/.grok/bin:$PATH"
# edit ~/.grok/pool/machines.json if IP changed
grokpool setup-ssh
grokpool status
# green mini required
```

Or plain:

```bash
ssh-copy-id qbit@MINI_IP
ssh qbit@MINI_IP 'echo ok; uname -m'
```

### C. On Mini — pull and build

```bash
# clone once if needed:
# git clone https://github.com/fornevercollective/grok-build.git ~/Projects/grok-build

cd ~/Projects/grok-build
git fetch origin
git checkout main
git pull --ff-only origin main

cd experiments/memory-glass
bash scripts/mg-install-still-server.sh
bash build-mac-app.sh
bash mg-mini-start.sh
# research default: no cam
# phone cam later:
#   MG_STILL_BIND=0.0.0.0 python3 ~/.panda/vision/still-server.py &
#   POST JPEG → http://MINI_IP:9877/upload
```

### D. Mini research smoke (no cam required)

1. Inspect dock: **PIPE**  
2. **CORP** (or **SPACEX** / **ROBOT**)  
3. **NEXT** → page loads  
4. Focus main → **⌥⌘R** or dock **CAP**  
5. **EXP** → paste into Grok → **GROK←** with:

```json
{"next_urls":["https://x.ai","https://www.tesla.com/AI"],"open_questions":[],"notes":"mini smoke"}
```

6. **CHURN** / **NEXT** again  

### E. Optional ego (USB cam or phone upload)

```bash
# Mini with USB cam — ONE writer only
bash ~/.panda/vision/capture-stream.sh &
# Inspect EGO → REC → STOP → →PACK
```

Never run `snap-loop` or multiple ffmpeg on device 0.

---

## Key paths (bookmark)

| What | Path |
|------|------|
| Repo | `/Users/qbit/Projects/grok-build` (laptop) · same under Mini home |
| App | `~/Applications/Memory Glass.app` |
| Still-pipe | `~/.panda/vision/` · port **9877** |
| Research queue | `~/.panda/research/queue.jsonl` |
| Packs | `~/.panda/packs/` · `hotpipe/research-packs/` |
| This doc | `experiments/memory-glass/hotpipe/BREAK_THEN_MINI.md` |
| Full Mini notes | `experiments/memory-glass/hotpipe/MINI_BRINGUP.md` |
| Goals | `experiments/memory-glass/hotpipe/GOALS.md` |
| grokpool | `~/.grok/bin/grokpool` · `~/.grok/pool/machines.json` |

### Inject order (for debugging)

`live.js` → `hurdles.js` → `research.js` → `ego.js` → **`inspect-dock.js`**

### Anti-patterns

- Multi-ffmpeg / `snap-loop`  
- Building on &lt;15% battery  
- Force-merge `upstream/main` (use path-checkout for monorepo tools only)  
- Expecting Perceptron cloud without EA key (local taxonomy works offline)

---

## Resume prompt (paste next session)

```
Continue Memory Glass from experiments/memory-glass.
Read hotpipe/BREAK_THEN_MINI.md + MINI_BRINGUP.md.
Tip should include inspect-dock + CORP pipeline + capture nv12 fix.
Cam off unless needed. Next: Mini SSH + pull + mg-mini-start + CORP smoke.
No X writeups unless asked.
```

*End of break checklist. Plug in. Walk away.*
