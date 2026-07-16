# Fleet funnel · best ideas → build order

**Not a concept catalog.** This is the **execution funnel**: what we build, in what order, from which source idea, and what “done” means.

| Layer | Owns |
|-------|------|
| **Panda** | Terminal host (panes · detach · frost · model strip) |
| **Lab** | Control plane (docs · Ship · handoffs · float chrome · `/api/*`) |
| **grok** | Agent brain (upstream crates · tools · workspace · sandbox) |

Sources (patterns only): [Fork leverage](#/19-fork-leverage) · [Panda](#/22-panda-shell) · [Triple shell](#/21-triple-shell) · [Merge/sync](#/20-merge-and-conflicts) · Mu / GrokPtah / gork / grok-oss / agent-tui.

```text
          ┌─────────────────────────────────────┐
          │  IDEA POOL (forks + our work)       │
          └─────────────────┬───────────────────┘
                            │  filter: leverage, not monorepo clone
                            ▼
          ┌─────────────────────────────────────┐
          │  FUNNEL GATE                        │
          │  ships without forking pager?       │
          │  dual-home safe? brand-safe?        │
          └─────────────────┬───────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
       Panda             Lab              grok child
     (host UX)      (orchestrate)      (agent runtime)
                            │
                            ▼
                   FLEET PRODUCT
              one operator loop: plan→build→verify
```

---

## Funnel stage 0 · Keep (already shipping)

| Idea | Source | Status | Keep as |
|------|--------|--------|---------|
| Grok Build Lab docs + Ship deck | us | ✅ | Control / marketing of the fleet |
| Triple shell bus α/β/γ | us | ✅ | Activity model for the funnel |
| Native lab float (tao/wry) | us | ✅ | Companion chrome, not the terminal host |
| lab-ship plugin | us | ✅ | Skills for plan-loop / triple-handoff |
| Upstream crate path-checkout | us + grok-oss discipline | ✅ | Brain stays current with xAI |
| Panda rescued to `experiments/` | us | ✅ | Terminal product seed |

**Gate:** do not reopen pager forks for these.

---

## Funnel stage 1 · Operator core (next 1–2 weeks)

**Goal:** one person can run plan → build → verify in **real interactive panes** without juggling bare Terminal.app.

| # | Build item | Best idea from | Implementation | Done when |
|---|------------|----------------|----------------|-----------|
| **1.1** | **Open in Panda** from Lab | GrokPtah multi-tab PTY · our panda daemon | Lab button + `serve.sh` / native: `panda new lab-fleet --splits 3` with pane titles α/β/γ | One click opens 3 live panes |
| **1.2** | **α/β/γ session profiles** | Triple shell · agent-tui dual home | Panda profiles export shell env + optional `GROK_*`; `~/.panda/profiles/{plan,build,verify}.toml` | Profiles documented + applied on spawn |
| **1.3** | **Handoff → pane status** | Lab `/api/shells` | Panda status line or pane header polls lab bus (or lab posts to panda sock later) | Handoff hop visible in Panda chrome |
| **1.4** | **Model strip → grok** | Panda strip · open-grok “provider” *as env only* | Ensure active chip sets env; document `grok` / `grok -p` in each profile | Running `echo $GROK_MODEL` in pane matches strip |

**Out of stage 1:** Tauri, Electron, full privacy binary, AUR.

**Exit demo**

```bash
# Lab running
./serve.sh
# UI: Ship → Spawn / Open in Panda
# or CLI:
cargo build -p panda-shell --release
./target/release/panda new lab-fleet --splits 3
# handoff plan→build on Ship; β pane shows hop
```

---

## Funnel stage 2 · Interact & deploy (following 2–3 weeks)

**Goal:** each column is a real **interact + deploy** surface, not a log card.

| # | Build item | Best idea from | Implementation | Done when |
|---|------------|----------------|----------------|-----------|
| **2.1** | **In-lab PTY columns** (optional path) | GrokPtah · lab multi-term | Prefer **Panda as host**; if web remains: xterm + `/api/pty` from serve.sh | Operator can type in 3 columns either in Panda **or** lab |
| **2.2** | **Deploy recipe bar** | grok-build-gui workbench · our `pty_deploy` sketches | Panda or lab: buttons Status / Test / Fmt / Handoff that inject into focused pane | One click runs recipe in β or γ |
| **2.3** | **Tool-card strip (read-only)** | GrokPtah tool cards | Lightweight overlay: last tool / last error / open files — **no** reimplement tools crate | Cards update from grok output or lab events |
| **2.4** | **Worktree badge for β** | upstream fast-worktree · triple shell | β profile documents `spawn_subagent` worktree; optional env `PANDA_ROLE=build` | Badge + docs; agent still owns worktrees |

**Exit demo:** approve plan in Ship → type in β → deploy test in γ → fail hops back to β without losing pane state (detach/reattach).

---

## Funnel stage 3 · Hardening & privacy (parallel / when needed)

| # | Build item | Best idea from | Implementation | Done when |
|---|------------|----------------|----------------|-----------|
| **3.1** | **Privacy child profile** | gork · no-telemetry | Optional wrapper script or env that launches `grok` with telemetry-hostile flags/docs — **not** a second monorepo | Documented `panda` model backend `grok-private` |
| **3.2** | **FORK.md + sync script** | grok-oss | Scriptize path-checkout from `upstream/main`; re-pin `experiments/panda-shell` workspace member | `./scripts/sync-upstream-crates.sh` works |
| **3.3** | **Install packaging** | grok-oss AUR/Nix · panda install | Improve `panda install` + optional formula later | New machine: install panda + lab serve in &lt;10 min |

---

## Funnel stage 4 · Mu-class shell (stretch)

| # | Build item | Best idea from | Implementation | Done when |
|---|------------|----------------|----------------|-----------|
| **4.1** | **Frost → real GPU path** | Mu wgpu/Metal · panda frost | Promote frost window where it earns FPS; keep softbuffer fallback | Measurable smoother frost or drop feature |
| **4.2** | **Mu docks Lab** | Mu.app + lab native | Optional: Mu opens lab URL + shares control semantics | One window manager story on Mac Mini |
| **4.3** | **Multi-provider only if needed** | open-grok design | YAML/custom models via **official** Grok config / BYOK — not open-grok runtime | Documented path; no second agent core |

---

## Explicitly **not** in the funnel

| Idea | Why cut |
|------|---------|
| Fork entire GrokPtah / Electron GUI | Host bloat; we have Lab + Panda |
| Become grok-oss mainline | We track xAI via path-checkout |
| Multi-provider rewrite of sampler | Upstream + config first |
| PR to xai-org | Policy |
| Recolor Grok marks for Panda chrome | Brand guidelines |

---

## Priority order (do in sequence)

```text
1.1 Open in Panda ──► 1.2 profiles ──► 1.3 handoff chrome ──► 1.4 model env
        │
        ▼
2.2 deploy recipes ──► 2.3 tool-card strip ──► 2.1 web PTY only if Panda gap
        │
        ▼
3.2 sync script ──► 3.1 privacy profile ──► 3.3 packaging
        │
        ▼
4.x Mu / GPU only after operator loop feels daily-driver
```

---

## Ownership matrix

| Workstream | Primary path | Secondary |
|------------|--------------|-----------|
| Pane host | `experiments/panda-shell` | Lab multi-term as viewer |
| Bus / handoffs | `docs/architecture-lab/serve.sh` `/api/shells` | Ship UI |
| Agent behavior | upstream `crates/` via sync | lab-ship skills |
| Privacy | wrapper + docs | never core fork by default |
| GPU chrome | panda frost → Mu later | lab CSS chrome stays light |

---

## Success metrics

| Metric | Target |
|--------|--------|
| Time to triple interactive shells | &lt; 30s from cold lab |
| Handoff plan→build→verify without losing PTY | 100% with detach |
| Upstream crate refresh | One script + green `cargo check -p xai-grok-pager-bin` |
| Config collision with official grok | Zero (`~/.panda` isolated) |
| Daily use | Operator prefers fleet over bare Terminal for multi-agent work |

---

## This week’s concrete tickets

1. **P1** — Lab: button **Open in Panda** → `panda new lab-fleet --splits 3` (osascript / PATH).  
2. **P1** — Panda: session titles / env `PANDA_ROLE=plan|build|verify`.  
3. **P1** — Lab handoff flash → optional write to panda status file under `~/.panda/lab-handoff.json`.  
4. **P2** — Deploy recipe commands in Panda help / slash (`:deploy test`).  
5. **P2** — `scripts/sync-upstream-crates.sh` + note to re-add `experiments/panda-shell` member.

---

## Conversation handoff (laptop)

```text
Funnel page: #/23-fleet-funnel
Stack: Panda=host · Lab=bus · grok=brain
Stage 1 next: Open in Panda + αβγ profiles + handoff chrome
Do not: adopt Tauri/Electron monorepos or PR xai-org
Code: experiments/panda-shell · docs/architecture-lab
```

## Related

- [Panda shell](#/22-panda-shell)  
- [Fork leverage](#/19-fork-leverage)  
- [Triple shell](#/21-triple-shell)  
- [Ship everything](#/17-ship-everything)  
- [Merge · conflicts](#/20-merge-and-conflicts)  
