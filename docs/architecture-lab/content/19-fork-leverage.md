# Fork leverage map · community Grok Build trees

Scan of **[xai-org/grok-build forks](https://github.com/xai-org/grok-build/forks)** (~4.5k total) for **leverage tools and surfaces** — not an endorsement. Upstream **does not accept external PRs**; community trees are independent Apache-2.0 experiments.

> **Snapshot:** 2026-08-05 · re-run of xAI public history vs this fork.  
> **xai-org tip:** `ed6d543` · pager **0.2.120** · `SOURCE_REV` `d6937fe…`  
> **fornevercollective tip:** `7f88db6` · pager **0.2.111** · `SOURCE_REV` `95d84f44…` (matches upstream monorepo pin at `69f0ba8`)  
> **Forks on xai-org:** ~4.5k. Re-check live repos before adopting code.  
> **Default path still wins:** plugins · skills · hooks · MCP · ACP without forking the pager — see [Extension surfaces](#/04-extension-surfaces) and [Leverage](#/07-leverage).  
> **Pin / DotSlash / path-checkout:** [Versioning · upstream](#/28-versioning-upstream) · [Upstream tools sync](#/27-upstream-tools-sync) · [Merge · conflicts](#/20-merge-and-conflicts).

---

## xai-org vs fornevercollective · full delta (this re-run)

Public `xai-org/grok-build` is **exactly 20 commits** — monorepo dumps by `grokkybara[bot]`, not a normal linear feature branch. GitHub **compare reports no common ancestor** with our `main` (squash-sync SHAs ≠ our history), even though we are a GitHub fork. Product pin is `SOURCE_REV` + pager crate version, not merge-base.

| | **xai-org/grok-build** | **fornevercollective/grok-build** |
|--|------------------------|-----------------------------------|
| **Tip** | `ed6d543` (2026-08-04) | `7f88db6` (2026-07-31) |
| **Pager** | **0.2.120** | **0.2.111** |
| **SOURCE_REV** | `d6937fe255dce4133c3d000a50f9cb94de12f06f` | `95d84f443eddcbed6cbfd6eed22e2eafe6b3939d` |
| **History shape** | 20 “Synced from monorepo” snapshots | Lab + media / cast / optical / architecture-lab on top of older pin |
| **Tree blobs (approx)** | ~3 038 | ~3 664 |
| **Paths only here** | ~157 (security, reclaim, ACP, changelogs 0.2.112–120, …) | ~783 (lab, media suite, live_demux, gy-tty, maptrace, …) |
| **Shared paths** | ~2 881 | ~2 881 |

**Fork pin era:** our `SOURCE_REV` equals upstream’s monorepo rev at commit **`69f0ba8`** (2026-07-23, pager still **0.2.111**). Everything after that on xAI is pure upstream drift we have not path-checked out yet.

### Version ladder (xAI public tip line)

| Upstream SHA | Date | Pager version | SOURCE_REV (short) | Notes |
|--------------|------|---------------|--------------------|--------|
| `c68e39f` | 07-16 | `0.1.220-alpha.4` | — | Initial OSS publish |
| `8adf901` | 07-16 | `0.2.101` | `2ec0f0c8…` | Early security + skills |
| `98c3b24` | 07-17 | `0.2.102` | `124d85bc…` | Sandbox wave · canonical editor |
| `7cfcb20` | 07-18 | `0.2.105` | `f9736c7b…` | Default **grok-4.5** |
| `ba76b0a` | 07-19 | `0.2.106` | `ba69d70c…` | ACP session/state · import |
| `a881e67` | 07-20 | `0.2.106` | `c5c4ce03…` | Rotating tokens · signing nonce |
| `3af4d5d` | 07-21 | `0.2.109` | `0f4d7c91…` | Worktree GC · doctor · RCE gates |
| `a5727c5` | 07-22 | `0.2.110` | `30192d2e…` | Relocation · dynamic workflows |
| **`69f0ba8`** | **07-23** | **`0.2.111`** | **`95d84f44…`** | **← our fork SOURCE_REV pin** |
| `6e38642` | 07-24 | `0.2.111` | `9b8d35b4…` | Workflow overlay · web search 4.5 |
| `47348d1` | 07-25 | `0.2.112` | `d02693a8…` | Hooks/workspace security |
| `b41c75a` | 07-26 | `0.2.112` | `91d8cf30…` | Instant UI · fork memory bound |
| `02d9359` | 07-27 | `0.2.112` | `1adcd1f4…` | Subagent depth · sandbox on leader |
| `5da6962` | 07-28 | `0.2.112` | `2a818575…` | Session reclaim · MCP CLI |
| `500129c` | 07-29 | `0.2.114` | `6372e41d…` | Doom-loop recovery default |
| `dd04f39` | 07-30 | `0.2.116` | `2a28b4a8…` | `GROK_EXTRA_CA_BUNDLE` · `/undo` |
| `a422116` | 07-31 | `0.2.117` | `8d69c91f…` | Session drop · compaction tasks |
| `780d138` | 08-03 | `0.2.118` | `64c4de99…` | **rustc 1.93.0** · plan Mermaid |
| `e5478ef` | 08-03 | `0.2.119` | `27d2088a…` | **Remove project-directory picker** |
| `ed6d543` | 08-04 | **`0.2.120`** | **`d6937fe2…`** | ACP **session/resume · close** |

Missing product changelogs on this fork (files only on xAI): `0.2.112` … `0.2.120` under `crates/codegen/xai-grok-shell/changelogs/`.

---

### All 20 upstream commits (what landed)

Each public commit is titled **Synced from monorepo** (except #1). Bodies list product bullets. Summary of the series:

| # | SHA | Date | Headline changes |
|---|-----|------|------------------|
| 1 | `c68e39f` | 07-16 | **Publish harness and TUI open-source** — initial monorepo dump |
| 2 | `8adf901` | 07-16 | SSRF fix (hook redirect) · enterprise STT/voice bearer · folder-trust in minimal · skills vs client builtin collisions · OAuth workspace scopes |
| 3 | `98c3b24` | 07-17 | Sandbox website policies · gate unsafe shell / redirects / sourced scripts / project hooks · canonical **ratatui-textarea** · durable session append · single-flight auth · plugin `require_sha` · owner-only creds/crash dumps |
| 4 | `7cfcb20` | 07-18 | Default models → **grok-4.5** · canonical editing everywhere · privacy opt-out default · `web_fetch` non-public IP block · marketplace default-skills purge · `/summarize` · snap-prompt setting |
| 5 | `ba76b0a` | 07-19 | ACP `x.ai/session/state` + `session/import` · scheduler upsert · clipboard OSC52 kill switch · auto-mode deny-and-continue |
| 6 | `a881e67` | 07-20 | Custom models + rotating auth providers · managed-config signing nonce · feedback submitter identity · minimal-mode thinking |
| 7 | `3af4d5d` | 07-21 | Worktree auto-GC · **`/usage`** · doctor · security (`ps`, kubectl plugins, `env -S`, `rg --pre`, RCE via “safe” cmds) · Ctrl+B background · `max` reasoning tier · workflow runtime fixes |
| 8 | `a5727c5` | 07-22 | Doctor fixes in TUI · stationarity / 16× same-tool stop · relocation state machine · dynamic workflows default · Esc cancel · marketplace timeouts |
| 9 | `69f0ba8` | 07-23 | **`/tutorial`** · resume by title · custom provider gateways · voice shortcut setting · doctor/tmux · privacy banner · tools-server callbacks |
| 10 | `6e38642` | 07-24 | Workflow overlay live status · web search → grok-4.5 · plugin subagent MCP inherit · true-noop thrash stop · clickable idle “still running” |
| 11 | `47348d1` | 07-25 | Security: hooks + workspace confinement · managed-config signing key + remote kill-switch · SessionEnd on exit · startup FD/thread resilience |
| 12 | `b41c75a` | 07-26 | Instant UI + background model/settings fetch · bound large-session memory · stream fork/replay · plan copy `y` · herdr mux detect |
| 13 | `02d9359` | 07-27 | Configurable subagent nest depth · sandbox profile on leader process · more reclaim paths |
| 14 | `5da6962` | 07-28 | Reclaim session state/children/MCP/LSP · SuperGrok Plus surfaces · MCP CLI enable/disable · circuit-breaker · crash SIGABRT capture |
| 15 | `500129c` | 07-29 | Doom-loop recovery **default on** · delete session from inside · coding-data consent · multi-process credential wipe fix · Agent Dashboard guide |
| 16 | `dd04f39` | 07-30 | **`GROK_EXTRA_CA_BUNDLE`** · headless pager split · `/undo` → `/rewind` · ACP **session/list** · cheap fullscreen resize · cancel all subagents on stop · stream headless tool calls |
| 17 | `a422116` | 07-31 | One-drop session resource release · background tasks/subagents across compaction · delete from dashboard/welcome · protect `.grok/sandbox.toml` · stop charges auth-retry on fail-closed 401 |
| 18 | `780d138` | 08-03 | **Rust toolchain 1.93.0** · plan Mermaid · Tab cycles question answers · clickable response top ▲ · auth refresh single 7s attempt · tmux truecolor in doctor · free-form “Always allow” pattern editor |
| 19 | `e5478ef` | 08-03 | **Remove project-directory picker** · skip nested checkouts in fsnotify · optimistic pre-session model select · git-head-changed on same-branch commits |
| 20 | `ed6d543` | 08-04 | ACP **session/resume** + **session/close** · workflow live subagent cap **16** · model switch during plan approval · bearer fragment normalization · stream fork copy (bounded memory) · sandbox deny-glob large-workspace fix |

Hundreds of bullets across the series; tables above are the product-visible slice. Full messages live on [xai-org/grok-build commits](https://github.com/xai-org/grok-build/commits/main).

---

### Theme buckets (upstream only / ahead of our pin)

| Theme | Examples |
|-------|----------|
| **Security / sandbox** | SSRF redirect, `web_fetch` private IPs, `env -S` / `rg --pre` / kubectl plugins, Landlock without TTY, sandbox on leader, protected `sandbox.toml`, global hook root |
| **Session reclaim** | Reap subagents, bash/bg, hooks, LSP, MCP, full PTY trees; reclaim retained state; cancel-on-stop; parent-death child kill |
| **Auth / credentials** | Single-flight auth, sleep/wake refresh, external expired → sign-in, bearer fragment, SuperGrok Plus, rotating provider tokens, extra CA bundle |
| **Pager / TUI** | Canonical editor, doctor, `/tutorial`, `/usage`, plan Mermaid + scrollbar, response-top jump, Tab on questions, remove project picker, cheap resize |
| **ACP / headless** | `session/state`, `import`, `list`, `resume`, `close`; headless module split; stream tools over ACP |
| **Models / workflows** | Default grok-4.5, doom-loop default, dynamic workflows, subagent cap 16, tasks survive compaction, model switch in plan approval |
| **New paths on xAI** | `xai-grok-extra-ca`, fsnotify `checkout`, headless reducer tree, sampling conversation modules, remote `skills_client`, models cache/fetch |

### Paths / surfaces only on this fork (not on xAI tip)

| Area | Examples |
|------|----------|
| **Lab** | `docs/architecture-lab/**`, Pages workflows, ship deck, Memory Glass, phone PWA, triple-shell docs |
| **Media / cast** | `/cast` `/optical` `/lens` `/watch` `/phone` `/map` `/timesync` `/cam` `/gy` · live_demux · halfblock · maptrace |
| **Plugins pack** | `.grok-plugin/marketplace.json`, `fc-media-suite` |
| **GY TTY** | `gy_tty` · GrokYtalkY placeholders · burst/pins spawn |
| **Intentionally diverged** | `project_picker/` (upstream **removed** it in `e5478ef`) |

### Sync posture (do not force-merge)

```bash
git fetch upstream
# preferred — product tree only; keep Lab + experiments
./scripts/sync-upstream-path-checkout.sh ed6d543   # or omit for tip
cat SOURCE_REV
# never: git merge -X theirs upstream/main · refork-wipe · force Lab history
```

| Need | Prefer |
|------|--------|
| Security + reclaim + ACP + 0.2.120 | Path-checkout crates from `ed6d543` |
| Keep media / lab / cast | Do **not** wholesale replace `docs/architecture-lab` or media slash commands |
| Project picker | Explicit fork decision vs upstream removal |
| Publish this page | `docs/architecture-lab` → Pages (`#/19-fork-leverage`) |

Highest-value pick-and-choose from upstream if not full sync: **security gates**, **session reaping**, **auth refresh**, **ACP session methods**, **doctor / tutorial / usage**, **extra CA**, **resize / plan UX**, **rustc 1.93**.

---

## Standout · Codex path (pivot)

**Do not confuse these two:**

| Project | Org / owner | Angle |
|---------|-------------|--------|
| **[mweinbach/open-grok](https://github.com/mweinbach/open-grok)** | personal | **Codex path** — ChatGPT OAuth, Code Mode, dual install as `open-grok` beside `grok` |
| **[open-grok/open-grok](https://github.com/open-grok/open-grok)** | open-grok org | **Multi-provider design** dossier / Pi-style platform plan (runtime still maturing) |

### mweinbach/open-grok — what to support

| Surface | Notes |
|---------|--------|
| Binary | **`open-grok`** — installable **next to** official `grok` (no replace) |
| Install (Apple Silicon) | `curl -fsSL https://github.com/mweinbach/open-grok/releases/latest/download/install.sh \| bash` |
| Config / auth | Codex creds under `~/.opengrok/` (e.g. `codex-auth.json`); xAI path still available |
| Code Mode | Persistent JS `exec`/`wait` runtime (Codex-style); tools also via `tools.*` |
| Models | Live Codex catalog when signed in; Max/Ultra effort parity; compaction V2 |
| Search | Provider-aware: xAI web/X tools vs OpenAI `web_search` |
| Docs in-tree | `docs/code-mode-port.md` · `docs/codex-provider-port.md` |

**Lab posture:** treat as a **parallel harness** for Codex workflows — not a monorepo merge target. Keep official Grok Build + Grok Build Lab for xAI path; point people at open-grok when they need Codex Code Mode. Cross-link from Ship / triple-shell discussions as “provider dual-stack pattern.”

---

## Landscape

| Bucket | Reality |
|--------|---------|
| **Mirror forks** | Vast majority — stock README, no product delta (~4.5k total) |
| **Productized forks** | Handful — Codex path, privacy, desktop UI, packaging, multi-provider plans |
| **This lab** | [fornevercollective/grok-build](https://github.com/fornevercollective/grok-build) · **Grok Build Lab** under `docs/architecture-lab/` · pin table above |

**Rule of thumb:** steal **patterns and packaging**, not whole monorepos. Prefer small diffs and extension bus first. For **our** tree vs xAI, use **path-checkout**, not force-merge.

---

## Highest-signal forks

| Fork | ★ (approx) | Leverage type | What to take |
|------|------------|---------------|--------------|
| [thedavidweng/gork-build](https://github.com/thedavidweng/gork-build) | ~22 | Privacy distro | **VSCodium-style** `gork` binary: Mixpanel/`events` hard-off, no remote re-enable, no `x.ai/cli` auto-update |
| **[mweinbach/open-grok](https://github.com/mweinbach/open-grok)** | ~1 | **Codex path** | **`open-grok`**: ChatGPT OAuth, Code Mode, live Codex catalog, dual install beside `grok` |
| [open-grok/open-grok](https://github.com/open-grok/open-grok) | ~2 | Multi-provider **design** | Architecture dossier + `goals/open-grok-provider-platform/` (Pi-style providers, YAML). Different from mweinbach Codex fork |
| [chriscase/GrokPtah](https://github.com/chriscase/GrokPtah) | ~1 | **Desktop agent** | **Tauri 2 + React**: tool cards, permissions, plan mode, git, multi-tab PTY, MCP/plugins, chat search, `~/.grokptah` |
| [Jane-o-O-o-O/grok-build-gui](https://github.com/Jane-o-O-o-O/grok-build-gui) | ~1 | **Electron desktop** | Desktop over native agent via **streaming-json** — workbench, settings, model picker |
| [SurmountSystems/grok-oss](https://github.com/SurmountSystems/grok-oss) | ~1 | Community mainline | Accepts PRs; binary **`grok-oss`**; **OpenRouter** option; **AUR** + **Nix** + `sync-upstream.sh` |
| [rossnoah/grok-build-no-telemetry](https://github.com/rossnoah/grok-build-no-telemetry) | ~1 | Patch series | Quilt-style patches + releases; strip product telemetry; keep optional **external OTEL** |
| [jasonkneen/agent-tui](https://github.com/jasonkneen/agent-tui) | ~1 | Full rebrand | **`agent-tui`** binary · `~/.agent-tui` · docs which **wire contracts stay xAI-named** (auth headers, model ids) |
| [amanverasia/groky](https://github.com/amanverasia/groky) | ~2 | Telemetry / models | Claims no telemetry + open models — **verify** before relying |
| **[fornevercollective/grok-build](https://github.com/fornevercollective/grok-build)** | — | **This lab** | Architecture lab · media suite · path-checkout discipline · **not** a merge into xai-org |

---

## Leverage by category

### Desktop hosts

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| Tauri 2 + React agent UI | GrokPtah | Patterns for chat · tools · PTY · permissions vs native **Grok Build Lab** float |
| Electron + streaming-json | grok-build-gui | Alternate desktop bridge to same Rust agent |

### Privacy / telemetry

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| Product analytics hard-off | gork-build | Local product defaults |
| Patch-only telemetry strip | grok-build-no-telemetry | Small, reviewable diffs |
| Optional self-hosted OTEL | no-telemetry README | Ops observability without vendor Mixpanel |

### Packaging & dual install

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| AUR / Nix / justfile | grok-oss | Distro install for local users |
| Binary rename + branding | gork · grok-oss · agent-tui | Parallel install next to official `grok` |
| Config home split | agent-tui (`~/.agent-tui`) | Avoid clobbering `~/.grok` |

### Providers / models

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| **Codex Code Mode + OAuth** | **mweinbach/open-grok** | Parallel install `open-grok`; dual-stack next to official `grok` |
| OpenRouter Grok option | grok-oss | Extra model path when testing |
| Multi-provider plan / facts | open-grok **org** goals | Design reference — not a drop-in yet |
| Official Grok OAuth / API | upstream | Keep as first-class path · track **0.2.120** tip |

### Upstream sync process

| Tool / surface | Source | Use with Lab |
|----------------|--------|--------------|
| `FORK.md` + merge checklist | grok-oss | Track `xai-org/grok-build` when PRs are closed |
| Isolated sync PRs / architecture pins | open-grok | Evidence-based import discipline |
| **`scripts/sync-upstream-path-checkout.sh`** | **this fork** | Path-checkout crates · keep Lab · pin `SOURCE_REV` |

---

## Official adjacent (not forks)

| Surface | Role |
|---------|------|
| [x.ai/cli](https://x.ai/cli) | Official install · product |
| [status.x.ai](https://status.x.ai) | Go/no-go before big pushes · [status script](../scripts/status-xai-check.sh) |
| [xai-org/plugin-marketplace](https://github.com/xai-org/plugin-marketplace) | Plugin catalog index |
| [xai-org/grok-build](https://github.com/xai-org/grok-build) | Public monorepo mirror · 20 sync commits · tip `ed6d543` |
| Upstream extension bus | plugins · skills · hooks · MCP · ACP · subagents |

---

## What *not* to do

1. **Do not** treat random star-forks as maintained tools — most are empty mirrors.  
2. **Do not** open PRs to `xai-org/grok-build` — see upstream `CONTRIBUTING.md`.  
3. **Do not** recolor official Grok / SpaceXAI marks when borrowing UI ideas — [brand page](#/12-brand).  
4. **Do not** assume multi-provider is done — open-grok is mostly **architecture + plan** today.  
5. Prefer **extension without forking pager** before adopting a full community monorepo.  
6. **Do not** `merge -X theirs upstream/main` into this fork — no common ancestor · wipes Lab. Use path-checkout.  
7. **Do not** assume star counts = quality; re-verify before vendoring.

---

## Decision rule

| Need | Prefer |
|------|--------|
| New behavior in agent | Plugin / skill / hook / MCP / ACP |
| Catch up to xAI **0.2.120** | Path-checkout `ed6d543` · see delta tables above |
| Desktop UX ideas | GrokPtah (Tauri) or grok-build-gui (Electron) **as reference** |
| Privacy binary | gork-build or no-telemetry patches |
| Distro packages | grok-oss packaging |
| Multi-provider design | open-grok goals docs |
| Local docs + float shell | **This lab** · [Lab shells](#/15-lab-shells) |
| New multi-terminal host | **Panda** · [Panda shell](#/22-panda-shell) · `experiments/panda-shell` |

### Natural next build (fleet)

**Full execution funnel (staged tickets + exit demos):** [Fleet funnel · build order](#/23-fleet-funnel).

1. **Panda** multi-tab PTY host (this repo) + GrokPtah UX patterns — not Tauri wholesale  
2. Lab **Open in Panda** for α/β/γ triple shell  
3. gork / no-telemetry as optional child-process privacy later  
4. grok-oss-style `sync-upstream` discipline (**path-checkout** — already in-tree)  
5. agent-tui-style dual home: `~/.panda` vs `~/.grok`  
6. Optional: path-checkout **0.2.112–0.2.120** security + reclaim + ACP without discarding media/lab  

---

## Related lab pages

- [Versioning · DotSlash · SOURCE_REV](#/28-versioning-upstream)  
- [Upstream tools sync · Lab 1–4+](#/27-upstream-tools-sync)  
- [Merge · conflicts · updates](#/20-merge-and-conflicts)  
- [Fleet funnel · build order](#/23-fleet-funnel)  
- [How to leverage further](#/07-leverage)  
- [Ship everything · x.ai/cli](#/17-ship-everything)  
- [Triple shell · handoffs](#/21-triple-shell)  
- [Panda shell · new terminal app](#/22-panda-shell)  
- [Official xAI · legal · models](#/18-official-xai)  
- [Dev build · versions · forks](#/14-dev-build-and-forks)  
- [Lab shells · native vs Electron](#/15-lab-shells)  
- [Extension surfaces](#/04-extension-surfaces)  
- [Plugin catalog](#/05-plugin-catalog)  
- [GrokYtalkY companion](#/10-gy-companion)  

---

## Living note

Update this page when:

1. **xai-org** publishes a new monorepo sync (new tip / `SOURCE_REV` / pager version), or  
2. A community fork ships a **real** leverage delta (new host, packaging, provider, or privacy tool).

Star counts rot; **feature tables + SOURCE_REV pins** matter more. Last full xAI-vs-us re-run: **2026-08-05**.
