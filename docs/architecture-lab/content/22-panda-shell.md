# Panda shell · new terminal app experiment

**Panda** is our **standalone multi-terminal / glass Rust shell** — a product test toward a Mu-class app, **not** a fork of `xai-grok-pager`.

| | |
|--|--|
| **Code** | `experiments/panda-shell/` (binary `panda`) |
| **Config home** | `~/.panda/` — never clobbers `~/.grok` |
| **Upstream** | Uses monorepo **`ptyctl` only as a library**; not in `xai-org` tree |
| **After upstream sync** | Re-add workspace member `"experiments/panda-shell"` if `Cargo.toml` was overwritten |

---

## Product thesis

> **Grok** = agent brain (tools · workspace · sandbox · subagents).  
> **Lab** = control plane (docs · Ship · handoffs · float chrome).  
> **Panda** = kick-ass **terminal host** (panes · detach · models · frost) that can run many agents at once.

This preserves work spent on glass multi-term / daemon / frost while keeping OSS crate path-checkouts clean.

---

## Leverage map (from `#/19-fork-leverage` + our stack)

| Source | Steal | Leave |
|--------|-------|--------|
| **Panda history** | Daemon PTY sessions · model strip · frost window · chords | — |
| **GrokPtah** | Multi-tab PTY + tool-card **UX** | Full Tauri rewrite |
| **grok-build-gui** | streaming-json desktop bridge idea | Electron default |
| **agent-tui** | Separate config home dual-install | Rebranding Grok marks |
| **gork / no-telemetry** | Optional privacy for child processes | Shipping a second full monorepo |
| **grok-oss** | AUR/Nix / sync scripts later | Becoming “community mainline” |
| **open-grok** | Multi-provider design notes | Unfinished provider runtime |
| **Lab triple shell** | α plan · β build · γ verify as **named panes/sessions** | Reimplementing agent crates |
| **Mu** | Metal/wgpu / “faster shell” direction | Merging Mu monorepo into grok-build |

**Rule:** patterns and packaging — not whole monorepos. No PRs to `xai-org`. Brand rules still apply.

---

## How it fits the fleet

```text
┌────────────────────────────────────────────────────────────┐
│  Panda (terminal host · multi-pane · detach · frost)       │
│  ┌──────────┬──────────┬──────────┐                        │
│  │ α plan   │ β build  │ γ verify │  ← sessions / splits   │
│  │ grok /p  │ grok     │ tests    │                        │
│  └──────────┴──────────┴──────────┘                        │
│         ▲ handoff status via lab /api/shells               │
├────────────────────────────────────────────────────────────┤
│  Grok Build Lab (docs · Ship · chat float · control API)   │
├────────────────────────────────────────────────────────────┤
│  grok binary (xai-grok-pager + tools/workspace/sandbox)    │
└────────────────────────────────────────────────────────────┘
```

| Need | Surface |
|------|---------|
| Plan / build / verify handoffs | `#/21-triple-shell` · `/api/shells` |
| Community desktop / privacy ideas | `#/19-fork-leverage` |
| Official models / brand | `#/18-official-xai` |
| Lab float shell | `#/15-lab-shells` |
| **This shell product** | **`#/22-panda-shell`** · `experiments/panda-shell` |

---

## Build & run

```bash
cd /path/to/grok-build
cargo build -p panda-shell --release
./target/release/panda info
./target/release/panda                 # session main
./target/release/panda new fleet --splits 3
./target/release/panda window          # frost window
```

Model strip → panes get `GROK_MODEL` / `PANDA_MODEL_*` so `grok` picks up intent.

---

## Roadmap

1. [x] Rescue crate from history → `experiments/panda-shell`  
2. [x] Document product + fork leverage fit  
3. [ ] Lab button: **Open in Panda** (spawn `panda new lab-α` / `lab-β` / `lab-γ`)  
4. [ ] Map `/api/shells` handoffs to panda session titles / status line  
5. [ ] GrokPtah-inspired tool strip (optional overlay)  
6. [ ] Mu wgpu path for frost where it earns FPS  
7. [ ] Install story: `panda install` + optional brew/cask later  

---

## Related

- Code: [`experiments/panda-shell/README.md`](../../../experiments/panda-shell/README.md)  
- [Fork leverage map](#/19-fork-leverage)  
- [Triple shell](#/21-triple-shell)  
- [Lab shells](#/15-lab-shells)  
- [Merge · conflicts](#/20-merge-and-conflicts) — note: re-add workspace member after upstream `Cargo.toml` overwrite  
