# Memory Glass · Mac Mini bring-up (R1 testing)

Pull this repo on Mini, build, run, churn research packs.

## 1. Update repo

```bash
cd ~/Projects/grok-build   # or your clone path
git fetch origin
git checkout main
git pull --ff-only origin main
```

Tip of interest: **R1 research + hurdles** (`research-v1`, `live-v18-hurdles`, `hurdles-v1`).

## 2. Build app

```bash
cd experiments/memory-glass
bash build-mac-app.sh
open -n "$HOME/Applications/Memory Glass.app"
```

Hot-pipe injects: `live.js` → `hurdles.js` → `research.js`.

## 3. Optional still-pipe (face HUD only — not required for research)

```bash
# no built-in cam: phone POST, or skip entirely for research
MG_STILL_BIND=0.0.0.0 python3 ~/.panda/vision/still-server.py &
# only if USB cam present — never multi-ffmpeg:
# bash ~/.panda/vision/capture-stream.sh &
```

Research uses **PAGE** default; leave cam off if Spool is noisy.

## 4. Research + ego smoke test

```bash
# install enhanced still-server (upload + /ego/*)
bash scripts/mg-install-still-server.sh
pkill -f still-server.py 2>/dev/null || true
MG_STILL_BIND=0.0.0.0 python3 ~/.panda/vision/still-server.py &
```

On **main** (any page):

- Inspect **TOPIC** / auto-seed CV URLs on boot (`research-v3`)
- **⌥⌘R** — capture + export · **⌥⌘N** — next queue URL
- `window.__mgResearch.ingestGrokReply(paste)` after Grok

On **inspect**:

- **SEED** · **NEXT** · **EXPORT** · **GROK←** · **CHURN**
- **EGO REC** / **EGO STOP** / **EGO→PACK** — still-pipe batch + hand taxonomy → pack
- Optional API: `localStorage.setItem('mg.perceptron.key', '…')`

## 5. Queue file (unattended scaffold)

```bash
mkdir -p ~/.panda/research
echo '{"t":'$(date +%s000)',"topic":"spacex starship updates","urls":[]}' >> ~/.panda/research/queue.jsonl
```

Agent/read loop can pop this later; `window.__mgResearch.enqueue(url)` also works live.

## 6. grokpool handoff (when SSH works)

From laptop (after Mini online + Remote Login):

```bash
export PATH="$HOME/.grok/bin:$PATH"
# fix IP in ~/.grok/pool/machines.json if needed
grokpool setup-ssh
grokpool status
grokpool push ~/Projects/grok-build   # or rsync
# on mini: pull + build as above
grokpool agent start --on mini
```

## 7. Health

| Signal | OK |
|--------|-----|
| App opens PAGE | no thrash |
| Inspect strip | hurdles-v1 · R1 chip |
| ⌥⌘R | pack in clipboard / out |
| Spool | ignore if no cam |

## Anti-patterns

- `snap-loop.sh` / multi-ffmpeg
- DEPTH + hands on Mini for pure research (wastes budget)
- Force-merge upstream monorepo history
