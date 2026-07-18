# Memory Glass · Native browser shell

**Rust-first · tao + wry → WKWebView · not Chrome · not Electron**

Droplet-glass concept browser for the SpaceX cool-test surface: transparent shell, flat page (no distance skew/tilt), three tabs on boot, depth HUD optional.

### Goal + next hurdle

| | |
|--|--|
| **Goal** | Native low-overhead droplet browser with ~1s hot-pipe iteration, spatial face/path instrument, and live Grok integration — lighter than Electron; stretch **sub-16ms** spatial HUD frames |
| **Baseline** | Shipped (continuous cam, inspect track, 6DOF head lock, multi-subject paths, soft mesh, meters) |
| **Next hurdle** | **Hands + in-air pointer without thrash** (inspect-first) |
| **Full ladder** | `hotpipe/GOALS.md` |

| Piece | Stack |
|-------|--------|
| Window | **tao** 0.31 |
| Web | **wry** 0.48 → macOS **WKWebView** (`transparent`) |
| Icon | Graphite shield + white singularity portal (xAI-lean aesthetic; Dock + window) |
| Bundle | `build-mac-app.sh` → `Memory Glass.app` |

## Icon

Rust-leaning superhero mark:

- Iron-oxide / rust metal rim + rivets  
- Glass droplet shield  
- Cyan energy portal (Memory Glass aperture)  
- Blueprint grid underlay  

Assets:

- `icons/app-icon-1024.png` — master  
- `icons/AppIcon.icns` — macOS Dock  
- `icons/AppIcon.iconset/` — source sizes  
- `assets/icon_128.rgba` — embedded window icon (128×128 RGBA)

## Build & run

```bash
cd experiments/memory-glass   # or this folder
cargo build --release
./target/release/memory-glass "https://www.spacex.com/"
# or
./launch.sh
```

### macOS app (Dock icon)

```bash
./build-mac-app.sh
open "Memory Glass.app"
```

| Shortcut | Action |
|----------|--------|
| ⌘T | New tab |
| ⌘N | New window |
| ⌘W | Close tab / window |
| ⌘L | Focus search |
| Corner `::` | Drag · double-click dim |
| `.....` | Search peek |

Default tabs: **spacex · starship · launches**.

## Hot-pipe (live work · no full relaunch)

Edit JS while Memory Glass is running — no cargo rebuild for HUD patches:

| Path | Role |
|------|------|
| `hotpipe/live.js` | Auto-injected when file mtime changes (~1s) |
| `hotpipe/mitigations/*.js` | Auto-applied on matching inspect errors |
| `hotpipe/agent.html` | Local agent / prompt loop page |
| `hotpipe/prompt.md` | Live intent for Grok |
| `hotpipe/out/` | Inspect packs for Grok Build |

**Inspect float** (⌘⌥I): **Copy** · **→ Grok** (pack + clipboard) · **Hot** · **Mitigate** · **Agent**

```bash
# while app is open:
$EDITOR experiments/memory-glass/hotpipe/live.js
# watch Inspect for: hotpipe live.js injected
```

Packs also land at `~/.panda/packs/mg-inspect.json` for Lab chain / handoff.

## Grok-build placement

Lives under:

```text
experiments/memory-glass/
```

Standalone Cargo workspace (`[workspace]` in this folder) — **not** a monorepo member (same pattern as `docs/architecture-lab/native`). Coexists with path-checked-out xAI harness crates under `crates/codegen/…`.

### Upstream tools (xai-org/grok-build)

Monorepo tools (pager, shell, workspace, MCP, voice, …) stay current via **path-checkout**, not merge:

```bash
# from repo root
./scripts/sync-upstream-path-checkout.sh upstream/main
./scripts/verify-upstream-sync.sh
```

**GitHub “N commits behind” is normal** — histories are unrelated. Trust root **`SOURCE_REV` + path-checkout** (see `docs/FORK_SYNC.md`).

Leverage monorepo tools in this fork:

```bash
cargo check -p xai-grok-pager-bin
cargo run -p xai-grok-pager-bin
# Memory Glass stays separate:
cd experiments/memory-glass && cargo build --release && ./build-mac-app.sh
```

Session resume: `hotpipe/SESSION_HANDOFF.md`.

Conceptual surface (DOM Memory Glass) remains:

```text
docs/architecture-lab/assets/memory-glass.{js,css}
docs/architecture-lab/content/32-memory-glass-browser.md
```

## License

Apache-2.0 (aligned with grok-build).
