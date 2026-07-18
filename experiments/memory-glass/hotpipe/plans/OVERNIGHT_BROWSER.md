# Overnight · make Memory Glass a better browser

**Saved:** 2026-07-18 · after WebGrid 12×12/30×30, Safari zoom parity, resign, agent play.

## Already landed (this commit)

- WebGrid fill layout + Safari-like ⌘± / `mg_scale=small` → **12×12** vs large → **30×30**
- Viewport spoof when WK `pageZoom` does not shrink `innerWidth`
- Agent multi-round play (`?mg_autoplay=N`), score report → `:9880`
- Ad-hoc **re-sign after Resources edits** (`scripts/resign-app.sh`, build-mac-app post-install sign)
- No `BUILD_STAMP` in `MacOS/` (taskgated invalid signature)
- Glass reassert debounced; camera defer on webgrid
- Body pose / hotpipe / ugrad webgrid tensor / soak scripts

## Offline local LLM (wired)

| Env | Default | Role |
|-----|---------|------|
| `MG_LOCAL_LLM=1` | off | enable Ollama helpers |
| `MG_OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama |
| `MG_OLLAMA_MODEL` | `qwen3:8b` | morning brief |
| `MG_OLLAMA_REASON_MODEL` | `deepseek-r1:7b` | deep postmortem (`--reason`) |
| `MG_OLLAMA_PACE_MODEL` | `llama3.2:1b` | live WebGrid pace |
| `MG_OLLAMA_EMBED_MODEL` | `nomic-embed-text` | future RAG |

```bash
# Smoke
python3 scripts/mg_local_llm.py ping

# Morning brief for latest (or path) run
MG_LOCAL_LLM=1 python3 scripts/soak-morning-brief.py

# Live pace advisor + collector (WebGrid)
python3 scripts/webgrid-collector.py &
MG_LOCAL_LLM=1 python3 scripts/webgrid-pace-advisor.py &
# play with: ?mg_autoplay=1&mg_local_llm=1&mg_scale=small
```

Soak end writes `morning-brief.md` when `MG_LOCAL_LLM=1`.

## What to run overnight (pick one stack)

### A. Stability soak + morning brief (recommended)

```bash
cd experiments/memory-glass
# ensure ollama serve is up
MG_LOCAL_LLM=1 bash scripts/overnight-soak.sh --hours 8 \
  --url 'https://neuralink.com/webgrid/?mg_scale=small'
# → ~/.panda/mg-soak/run-*/summary.md
# → ~/.panda/mg-soak/run-*/morning-brief.md   (qwen3:8b)
```

### B. Agent WebGrid ladder (skill / BPS)

```bash
# 1) Ensure collector
python3 ~/.panda/mg-soak/watch/collector.py &

# 2) Alternate small / large every ~90s for 6–8h (wrapper sketch)
#    open app with ?mg_autoplay=3&mg_scale=small  then large 30×30
#    log peaks to ~/.panda/mg-soak/watch/play.jsonl
```

**Goal:** beat prior peaks (30×30 ~483 BPS agent; 12×12 ~402 this session) with fewer soft-misses; track miss rate vs sleep budget.

### C. Competitive browser harness (real browsing)

Use `hotpipe/plans/COMPETITIVE_HARD_TRUTH.md` checklist overnight:

| Metric | How |
|--------|-----|
| Cold start → first paint | timed launch log |
| Tab/SPA churn | auto-navigate allowlist (SpaceX, X, Neuralink, kbatch) |
| Glass survival | second monitor / Spaces FS reassert |
| Camera | still-pipe only unless user grants |
| Memory | RSS p95 over 8h |
| Hotpipe mtime inject | touch live.js every 30m without crash |

### D. Code fixes the overnight run should drive (morning PR targets)

1. **Faster canvas blue scan** — WebWorkers / ImageData step-1 only near last hit; cut 12×12 missGuess noise  
2. **Native pageZoom ↔ layout** — confirm WK pageZoom shrinks CSS px on Tahoe 26.5.x; drop spoof when redundant  
3. **Window profile API** — IPC `window_profile: small|large|fill` instead of only boot argv  
4. **Auto re-sign** — post-hotpipe-copy hook so Resource edits never SIGKILL  
5. **Score truth** — ignore marketing 10.39 / 40×40 in scrape; only sidebar `timer + BPS + NTPM · N×N`  
6. **Human calib loop** — optional dwell / reduced click rate to approach BCI-comparable ~8–17 BPS for demos  
7. **Crash taxonomy** — codesign vs glass storm vs OOM in soak summary  

## Morning readout

```bash
ls -dt ~/.panda/mg-soak/run-* | head -1 | xargs -I{} cat {}/summary.md
tail -5 ~/.panda/mg-soak/watch/play.jsonl
codesign --verify --deep --strict "$HOME/Applications/Memory Glass.app" && echo SIG_OK
```

## Do not overnight

- Force-push, credentialed external posts  
- Full-screen click storms without rate limit  
- `rm -rf` soak history  
- Leave unsigned binary drops in the `.app` without `scripts/resign-app.sh`
