# Overnight sandboxed free reign · test plan

**Goal:** continuous, unattended evidence for competitive claims.  
**Sandbox:** Mac Mini or spare Mac · no personal cookies · allowlist network · camera optional.

## Layout

```
~/.panda/mg-soak/
  run-<epoch>/
    soak.jsonl          # heartbeat lines
    health.jsonl        # still-server
    h6.jsonl            # if inspect can export
    screenshots/        # Drop lip samples
    summary.md          # morning report
```

## Runner

```bash
# from experiments/memory-glass
bash scripts/overnight-soak.sh --hours 8 --url https://www.spacex.com/
```

Env:

| Var | Default | Meaning |
|-----|---------|---------|
| `MG_SOAK_HOURS` | 8 | duration |
| `MG_SOAK_URL` | spacex.com | start URL |
| `MG_SOAK_DIR` | `~/.panda/mg-soak` | output |
| `MG_STILL_URL` | `http://127.0.0.1:9877` | health |
| `MG_APP` | `~/Applications/Memory Glass.app` | bundle |

## Phases in one night (default schedule)

| Hour | Phase | Actions |
|------|-------|---------|
| 0 | boot | start still-server · launch MG · baseline RSS |
| 0–2 | steady | health poll 30s · process alive |
| 2–4 | inject | touch hotpipe/live.js every 5m · verify inject log |
| 4–5 | drop stills | optional screencapture Drop positions |
| 5–7 | thrash | relaunch every 20m · check clean exit |
| 7–8 | summary | write summary.md · kill cleanly |

## Pass / fail (morning)

| Check | Pass |
|-------|------|
| Process crashes | 0 unexpected |
| Still-server health | ≥99% ok samples |
| RSS growth | slope logged; flag if &gt;50 MB/h sustained |
| Hot-pipe inject | ≥1 success/hour when touched |
| Zombies | 0 orphan memory-glass |

## Competitive add-on (optional Night 2+)

```bash
# first paint proxy: time to process + log stamp
# compare Safari open same URL timing (wall clock only — not engine bench)
```

## What this does *not* do

- Speedometer / JetStream (use WebKit nightly benches separately)  
- Multiproc fuzzing  
- Real Neuralink BCI  

## Free-reign upgrade path

1. Wire inspect to POST H6 EMA to `http://127.0.0.1:9877/soak` (add endpoint)  
2. Playwright-free: AppleScript click Drop slider positions  
3. CI Mac mini green badge on fornevercollective  
