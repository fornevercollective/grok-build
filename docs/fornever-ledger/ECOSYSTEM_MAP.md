# Fornever Collective · Year Development Ecosystem Map

**Policy:** ENUMERATE · LEARN · DOCUMENT. **Never delete repos.**  
**Saved:** 2026-07-18 · living inventory for agents + bug bounty work.  
**Fork census GO/NOGO:** [`FORK_CENSUS_GONOGO.md`](./FORK_CENSUS_GONOGO.md) · persona path [`PERSONA_TENSOR_PATH.md`](./PERSONA_TENSOR_PATH.md)  
**Upstream vs MG check:** 2026-07-23 → [`XAI-GROK-BUILD-VS-MG-TRAJECTORY.md`](./XAI-GROK-BUILD-VS-MG-TRAJECTORY.md) (product tree DRIFT · MG trajectory separate).

---

## North star stack (active daily)

| Layer | Path / repo | Role |
|-------|-------------|------|
| Agent harness (fork) | `fornevercollective/grok-build` ← **upstream `xai-org/grok-build`** | Grok Build TUI · skills · plugins |
| Droplet browser | `experiments/memory-glass/` | tao+wry WKWebView · hotpipe · WebGrid · glass |
| Phone / still-pipe | `~/.panda/vision` | JPEG relay · face / hands without multi-cam grab |
| Voice | `~/.panda/voice` + MG `Resources-pack/voice` | mute · STS · speak · dial-in |
| Offline models | Ollama + `/Volumes/qbitOS/03.models` | qwen3 · deepseek-r1 · llama3.2:1b · LFM2 · codestral · nomic |
| Soak / evidence | `~/.panda/mg-soak` | overnight JSONL + morning brief |

Local clone: `/Volumes/qbitOS/00.dev/projects/grok-build`  
Remotes: `origin` = fornevercollective · `upstream` = xai-org/grok-build  

---

## Confirmed GitHub forks (API)

| Fork | Parent | Notes |
|------|--------|--------|
| **fornevercollective/grok-build** | **xai-org/grok-build** | Primary agent platform; MG experiment lives here |

Other org repos are mostly **originals** (not GitHub-fork flag), including ports/research mirrors (igv, paint, redhawk, etc.). Treat them as **year portfolio assets**, not disposable forks.

---

## Skills inventory (enhance agents here)

### User skills (`~/.grok/skills`)
| Skill | Use for |
|-------|---------|
| check-work | Verify builds / diffs |
| code-review | Local review |
| create-skill | Scaffold new skills |
| help | TUI docs |
| imagine | Image gen discipline |

### Bundled skills (`~/.grok/bundled/skills`)
design · execute-plan · docx · pptx · game-* · pr-babysit · resume-* · review · build-with-ai · implement · …

### In-repo (grok-build)
| Path | Skill |
|------|--------|
| `experiments/memory-glass/plugin/SKILL.md` | **Memory Glass** ground rules |
| `docs/fornever-ledger/skills/panda-loop/SKILL.md` | **Panda loop** α→β→γ fleet |
| `docs/fornever-ledger/skills/bug-bounty-ledger/SKILL.md` | Breakage append-only ledger |
| `docs/fornever-ledger/plans/P-*.md` | Executable plan catalog via panda-loop |
| `docs/architecture-lab/plugin/lab-ship/skills/*` | lab-ship-orb · plan-loop · lab-review · triple-handoff · ship-checklist |
| `crates/codegen/xai-grok-shell/skills/*` | best-of-n · check-work · code-review · create-skill · help · imagine |

### Cursor skills (reference patterns, do not delete)
`~/.cursor/skills-cursor/*` — create-skill · review-security · babysit · automate · loop · …

### Plugin symlink
`~/.grok/plugins/lab-ship` → `docs/architecture-lab/plugin/lab-ship`

---

## Year portfolio clusters (qbitOS + GitHub)

### A · Agent / Grok
- grok-build (fork) · grok-cli · grok-public-folder · grok-repo-template · imagine · Mu · charm · GrokYtalkY · aito · kimi-cli

### B · Browser / vision / glass
- memory-glass · blank · ladybird · rubiks-cube-camera-solver · MagicMirrorDisplay · still-pipe panda

### C · Quantum / μ / tensor
- ugrad · tinygrad · mu.eee · Mu · composer · Qbpm · qbitos-* (dac, iron-line, kbatch, prefixes, steno, freya, preflight, gluelam, gameHUB, erika)

### D · Media / music / live
- LMCI · Eco-Phonogenesis · piano-buddy · lark* · lolo* · iEatBeats2 · kbd-audio · audioMotion-analyzer

### E · Trading / data
- crossover · train · robinhood MCP (session)

### F · Sites / culture
- fornevercollective.github.io · tadericson · ancestory · codex-regius-digital · gramerie · CVD · ogham

### G · Infra volume
- `/Volumes/qbitOS/00.dev/{uvspeed,projects,qbit*,prototypes}`  
- `/Volumes/qbitOS/03.models/{01-ollama,06-grok,05-tinygrad}`  
- `/Volumes/qbitOS/github/{qbitos-*,compliance}`  

**Local git roots (approx):** ~15 under `00.dev`, ~10 under `github/` — expand with `find … -name .git` when refreshing this map.

---

## Enhancement vectors (skills × breakage)

| Opportunity | Skill / tool to build | Feeds bug bounty |
|-------------|----------------------|------------------|
| Auto re-sign on hotpipe copy | `mg-resign` skill / hook | codesign SIGKILL |
| Soak → morning brief | already `MG_LOCAL_LLM=1` | crash taxonomy |
| WebGrid pace + score truth | pace advisor + scrape fix | false 40×40 peaks |
| Glass on 2nd monitor FS | reassert debounce tests | AppKit thrash |
| Camera multi-grab | single writer rule skill | LED thrash / auth flap |
| Upstream grok-build merge | lab-ship ship-checklist | fork drift |
| Offline RAG over year notes | nomic-embed skill | lost tribal knowledge |
| Voice offline intents | LFM2 transcript skill | mute/STS races |

---

## Agent rules for this volume

1. **Never `rm -rf` repos, model trees, or soak history** without explicit user request.  
2. Prefer **append-only ledgers** under `docs/fornever-ledger/`.  
3. Prefer **hotpipe JS** for MG UX; **Rust** only for window/IPC/native.  
4. After any `.app` binary or Resources edit → **`scripts/resign-app.sh`**.  
5. Learn from `SESSION_HANDOFF.md`, `GOALS.md`, `COMPETITIVE_HARD_TRUTH.md` before inventing architecture.  
6. Fork work on grok-build: track **upstream** periodically; keep fornever experiments under `experiments/`.  

---

## Refresh command (safe)

```bash
# enumerate only
find /Volumes/qbitOS/00.dev /Volumes/qbitOS/github -maxdepth 3 -name .git -type d
gh repo list fornevercollective --limit 100
find ~/.grok/skills ~/.grok/bundled/skills /Volumes/qbitOS/00.dev/projects/grok-build -name SKILL.md
```
