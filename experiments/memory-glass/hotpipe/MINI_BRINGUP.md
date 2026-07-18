# Memory Glass · Mac Mini bring-up

**After charging / break:** start with **`BREAK_THEN_MINI.md`** (stop cams, charge, then this).

**Tip features:** inspect dock (**PIPE | CORP | R1 | EGO | CAL**), CORP vision-train seeds (xAI/Grok/Tesla/SpaceX), research-v4, ego-v1, capture-stream **nv12/uyvy422**.

---

## 1. Update repo (Mini or laptop)

```bash
cd ~/Projects/grok-build
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline
```

Must be **fornevercollective/grok-build**, not `tadericson`.

## 2. Build + start (research default = no cam)

```bash
cd experiments/memory-glass
bash scripts/mg-install-still-server.sh
bash build-mac-app.sh
bash mg-mini-start.sh
```

Inject: `live.js` → `hurdles.js` → `research.js` → `ego.js` → `inspect-dock.js`.

## 3. Still-pipe (optional)

```bash
# HTTP only
python3 ~/.panda/vision/still-server.py &
# Mini LAN phone upload:
# MG_STILL_BIND=0.0.0.0 python3 ~/.panda/vision/still-server.py &

# ONE face writer only (never snap-loop / multi-ffmpeg):
# bash ~/.panda/vision/capture-stream.sh &
# if frozen: GY_CAM_PIX_FMT=uyvy422 GY_CAM_SIZE=640x480 bash ~/.panda/vision/capture-stream.sh &
```

Health: `curl -s http://127.0.0.1:9877/health` → `live_age_s` low if cam on.

## 4. Inspect smoke (no cam required)

| Step | Action |
|------|--------|
| Dock | **PIPE** tab |
| Seed | **CORP** (or ROBOT / SPACEX / PERCEPT) |
| Browse | **NEXT** |
| Capture | main focus → **CAP** or **⌥⌘R** |
| Export | **EXP** → Grok |
| Feedback | **GROK←** paste `{"next_urls":[...],...}` |
| Loop | **CHURN** |

Pack map: `hotpipe/research-packs/corp-vision-train.md`

## 5. Ego (optional)

Inspect **EGO** → **REC** → **STOP** → **→PACK**.  
Frames: `~/.panda/vision/ego/`.

## 6. grokpool (laptop ↔ Mini)

```bash
export PATH="$HOME/.grok/bin:$PATH"
# Mini: Remote Login ON; fix IP in ~/.grok/pool/machines.json
grokpool setup-ssh
grokpool status
grokpool push ~/Projects/grok-build   # or git pull on Mini
```

## 7. Stop all cameras (break / travel)

```bash
ps -axo pid=,command= | while IFS= read -r line; do
  case "$line" in
    *still-server.py*|*capture-stream.sh*|*snap-loop*)
      kill -9 ${line%% *} 2>/dev/null ;;
    *ffmpeg*)
      case "$line" in
        *live.jpg*|*avfoundation*) kill -9 ${line%% *} 2>/dev/null ;;
      esac ;;
  esac
done
```

## Key paths

| Item | Path |
|------|------|
| App | `~/Applications/Memory Glass.app` |
| Vision | `~/.panda/vision/` · `:9877` |
| Queue | `~/.panda/research/queue.jsonl` |
| Break checklist | `hotpipe/BREAK_THEN_MINI.md` |
