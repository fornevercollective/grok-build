# Grok Build fork census · GO / NOGO (cycle ledger)

**Checked:** 2026-07-24T02:13Z  
**Upstream:** `xai-org/grok-build` · ~**4,170** forks (API) · **4,150** classified this pass  
**Policy:** Prefer **patterns + path-checkout**, never mass-merge forks into Lab/`experiments/`.

## Data files (machine-readable)

| File | Contents |
|------|----------|
| `data/xai-grok-build-forks.json` | Full fork metadata dump (~4.1k) |
| `data/FORK_GONOGO.csv` | Per-fork verdict + recheck cadence |
| `data/FORK_GONOGO.jsonl` | Same as CSV, line-JSON |
| `data/FORK_GONOGO_META.json` | Counts + method |
| `data/ECOSYSTEM_GONOGO.json` | Non-fork / ecosystem tools (browser, sandbox, goals) |
| `scripts/recheck-forks.sh` | Monthly metadata rescan helper |

## Verdict legend

| Verdict | Meaning | Recheck |
|---------|---------|---------|
| **GO** | Our active tree / keep close | **weekly** |
| **MAYBE** | Unique desc, ≥5★, or name-signal — deep-compare on cycle | **monthly** (top ★ weekly-ish) |
| **NOGO** | Standard mirror / star-noise | **never** (unless monthly rescan promotes it) |

### This pass counts

| Verdict | N | % |
|---------|---|---|
| GO | **1** | ~0% |
| MAYBE | **104** | ~2.5% |
| NOGO | **4,045** | ~97.5% |

**Implication:** ~97.5% of forks can be ignored forever unless metadata changes. Effort belongs in **MAYBE top-20 + ecosystem non-forks**.

---

## GO (fork tree)

| Repo | Why |
|------|-----|
| **fornevercollective/grok-build** | Our Lab + Memory Glass + path-checkout product tree |

---

## MAYBE · deep-compare shortlist (2026-07-24)

`ahead` = commits on fork not on `xai-org/grok-build:main` (when compare API works).  
Unrelated histories / renames → `error` — treat as **pattern-only**, not merge.

| Repo | ★ | Ahead | Signal | Steal? |
|------|---|-------|--------|--------|
| **thedavidweng/gork-build** | 39 | 61 diverged | **Privacy distro** (VSCodium-style hard-off telemetry/research upload/auto-update) | **YES patterns** for sandbox defaults |
| **mweinbach/open-grok** | 33 | compare err | **Codex dual path** · Code Mode · install beside `grok` | **YES parallel binary** (not merge) |
| **DaviRain-Su/hyper-grok-build** | 18 | 73 ahead | Multi-provider community build | **MAYBE** provider mesh patterns |
| **Dwsy/grok-pi** | 6 | 137 diverged | Pi agent core in Grok TUI | **MAYBE** ACP/Pi interop |
| **josepha-mayo/oh-my-grok-build** | 0 | 142 diverged | Plugin/swarm/cron tree | **YES skills patterns** |
| **amanverasia/groky** | 3 | 96 diverged | Claims open models/telemetry — **verify** | CAUTION |
| **failure-fail/failure-build** | 9 | 62 diverged | Rebrand harness | LOW |
| **DeveshParagiri/forge** | 6 | 46 diverged | Multi-model multi-harness TUI | **MAYBE** |
| **SeatownSin/axon** | 2 | 25 diverged | Local-first privacy agent | **MAYBE privacy** |
| **ZhangHanDong/grok-build** | 14 | 20 diverged | Starred mirror-ish | LOW unless README claims tech |
| **Pikachubolk/grok-build-desktop** | 0 | 11 diverged | Desktop rename | LOW (MG is not Electron) |
| **anxkhn/grok-build** | 2 | 3 | Privacy-hardened claim | **MAYBE** patch ideas |
| **daniel-farina/grok-build** | 16 | 3 | Stars; owner also ships **xplorer** browser | Prefer **xplorer** not this fork |
| **9thLevelSoftware/grok-out** | 0 | 5 ahead | “Devil’s tweaks” | LOW |
| **askariasr-s-r/kraftaria** | 0 | 0 behind | Training weights claim | **NOGO product** |
| **Jane-o-O-o-O/grok-build-gui** | 7 | err | Electron GUI | Pattern only · **no Electron for MG** |
| **chriscase/GrokPtah** | 1 | err | Tauri desktop | **YES HUD patterns** |
| **SurmountSystems/grok-oss** | 1 | err | OpenRouter + packaging | **MAYBE packaging** |
| **open-grok/open-grok** | 5 | err | Multi-provider design dossier | Docs only |
| **rossnoah/grok-build-no-telemetry** | 3 | err | Quilt telemetry patches | **YES small patches** |
| **jasonkneen/agent-tui** | 7 | err | Full rebrand | LOW (wire contracts still xAI) |

---

## NOGO bulk (4,045)

Criteria: default SpaceXAI description, no meaningful name signal, and not high-signal stars.

**Recheck:** never open them one-by-one.  
**Monthly:** re-fetch fork list → auto-promote if `stars≥5` or description leaves default prefix.

---

## Ecosystem (mostly **not** forks) — better than forks for day-long loops

See `data/ECOSYSTEM_GONOGO.json` and [PERSONA_TENSOR_PATH.md](./PERSONA_TENSOR_PATH.md).

| Tier | Examples | Use |
|------|----------|-----|
| **Day-long terminal** | `tlbx-ai/tlbx`, playpen, `/goal` + goal-engineering | Persist agent sessions |
| **Sandbox / parallel** | `madarco/agentbox`, worktree isolation, MG product-core lean | Qubos-style isolate |
| **Browser body** | Memory Glass, `daniel-farina/xplorer` CDP patterns | Open/close browse + agent |
| **Persona cast** | fable-mythos roles, panda α/β/γ, oh-my loops | Scout/critic/verifier |
| **Memory** | `vshulcz/deja-vu` | Cross-session recall |
| **Privacy** | gork-build, wetlink, exfil-repro (defensive) | Trust boundary |
| **Tensor loop** | KBatch, ugrad, tinygrad, WebGrid contrails | Train/score geometry |
| **Router** | grok-build-switch, CLIProxyAPI, cc-switch | Multi-model soak |
| **Awesome list** | `DominikTobureto/awesome-grok-build` | Skills/hooks templates |
| **Avoid as product** | grok2api multi-account pools, register farms | ToS/risk |

---

## Cycle procedure

### Weekly (GO only)
1. `./scripts/verify-upstream-sync.sh`
2. MG WebGrid smoke if hotpipe changed
3. Skim top ★ MAYBE for sudden leaps (gork / open-grok / hyper)

### Monthly (MAYBE + metadata)
```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
bash docs/fornever-ledger/scripts/recheck-forks.sh
# Review promoted rows in data/FORK_GONOGO_META.json
```

### Never again
Any row with `recheck=never` until the monthly script promotes it.

---

## Related

- [PERSONA_TENSOR_PATH.md](./PERSONA_TENSOR_PATH.md) — Iron Man / Ender / Blade Runner / persona + tensor path  
- [PATTERN_STEAL.md](./PATTERN_STEAL.md) · [XAI-GROK-BUILD-VS-MG-TRAJECTORY.md](./XAI-GROK-BUILD-VS-MG-TRAJECTORY.md)  
- Lab pages: `docs/architecture-lab/content/19-fork-leverage.md` · `14-dev-build-and-forks.md` · `30-playpen.md`
)
