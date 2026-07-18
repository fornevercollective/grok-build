# Memory Glass browser

**Native app:** `experiments/memory-glass` (standalone Cargo workspace — **not** a monorepo crate member)  
**Growth brief:** [`experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md`](../../../experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md)  
**Lab chrome (optional):** [`browser.html`](../browser.html) · **GitHub Pages:** [fornevercollective.github.io/grok-build](https://fornevercollective.github.io/grok-build/) (this Lab, not a second monorepo)

---

## Sites map (what exists vs what does not)

| Surface | URL / path | Role |
|---------|------------|------|
| **Grok Build Lab (Pages)** | https://fornevercollective.github.io/grok-build/ | Static Lab from `docs/architecture-lab/` only |
| **Memory Glass app** | Local `Memory Glass.app` · source `experiments/memory-glass/` | Dual-pane WK training shell |
| **Memory Glass docs (in-repo)** | `experiments/memory-glass/docs/*` · this Lab page **32** | Agent handoff · growth · no separate `*.github.io/memory-glass` yet |
| **μgrad sports field** | https://mueee.qbitos.ai/sports-field-ugrad.html | Live pitch · brackets spirit · telemetry · hexcast |
| **Train predictions** | https://github.com/fornevercollective/train · local `/Volumes/qbitOS/00.dev/cursor/train` | Stocks + sports hexbin · wind/eind-style topology viz · game console bridge |
| **KBatch** | https://kbatch.ugrad.ai | Language geometry body |
| **Upstream product** | https://github.com/xai-org/grok-build | Harness TUI · crates · **path-checkout only** |

There is **no** dedicated `fornevercollective.github.io/…/memory-glass` site today. Public web for this monorepo fork is **Grok Build Lab** Pages. Memory Glass ships as a **native experiment** under `experiments/` (sync-safe).

---

## Stay friends with parent xai-org / grokkybara

`grokkybara[bot]` **Synced from monorepo** only refreshes the **open-source product tree** (crates, bin, SOURCE_REV, …). Our Lab fork is **unrelated history** — badge “N commits behind” is normal.

### Safe zone (preserved on path-checkout)

- `experiments/**` including **memory-glass**
- `docs/architecture-lab/**` (Pages)
- `docs/fornever-ledger/**`
- `scripts/sync-upstream-path-checkout.sh` · `verify-upstream-sync.sh`

### Never do

1. `git merge upstream/main` / `--allow-unrelated-histories` into product `main`
2. Put Memory Glass **into monorepo `crates/`** or root workspace members
3. Overwrite `crates/`, `Cargo.toml`, `SOURCE_REV`, `bin/` by hand instead of path-checkout
4. Commit secrets, exploit tooling, or claim official xAI product status

### Stay current (product tools only)

```bash
git fetch upstream
./scripts/sync-upstream-path-checkout.sh upstream/main
./scripts/verify-upstream-sync.sh
# review, commit, push — experiments/ untouched
```

Policy: [`docs/FORK_SYNC.md`](../../FORK_SYNC.md) · [`docs/fornever-ledger/UPSTREAM_CHERRY.md`](../../fornever-ledger/UPSTREAM_CHERRY.md)

---

## What Memory Glass is growing into

**Not** Dia/Comet. **Is** native dual-pane **training + dual-space lab**:

- WebGrid BPS instrument (+ Intel pace / play-lab floats live)
- Contrail · Bloch · Rubik language · maze rain · beats **staff** · sportsfield-style board
- Collab day mesh · Grok brief · human X draft only
- Optional bridges: KBatch · mueee sports-field · train predictions (educational)

Full pillars: **MEMORY-GLASS-GROWTH.md**

---

## Sports field · train · eind/wind · geo scavenger (extension path)

| Piece | Where | How MG uses it |
|-------|--------|----------------|
| Pitch / players / telemetry | [sports-field-ugrad.html](https://mueee.qbitos.ai/sports-field-ugrad.html) | Capsule **FIELD** · `__mgSportsField` |
| Brackets · sports hexbin · game desk | `train` repo predictions | Link only; not vendored into monorepo crates |
| Stocks / wind topology (“eind tunnel”) | train `topology-predictions-viz` | Educational viz only; no auto-trading |
| **USGS earthquake paths** | [earthquake.usgs.gov map](https://earthquake.usgs.gov/earthquakes/map/) + public GeoJSON feeds | **`__mgGeoPattern`** · Pattern Flow (mag×t) like KBatch · map trail · → maze |
| **Portland Maps–style data card** | [portlandmaps.com](https://www.portlandmaps.com/) · sample Airport Way parcel | Scavenger **HUNT** clues · property-style stats table |
| MG sportsfield rank | `activity-leaderboard.js` | Live BPS/ELO-style rank during WebGrid |

```js
__mgGeoPattern.open()   // Pattern Flow / Map trail / Data card
__mgGeoPattern.hunt()   // random quake or PDX property clue
__mgGeoPattern.load()   // refresh USGS feed
```

**Rule:** bridge by **URL + BroadcastChannel + thin hotpipe JS** — do **not** copy the whole train Astro app into `crates/`.

---

## SpaceX design approach (chrome)

| Principle | In the UI |
|-----------|-----------|
| Float above the drawing board | Blueprint / glass floats over playfield |
| Mission-control telemetry | Cyan contrails, solve HUD, board ticker |
| Soft aperture | Glass capsule · maze · orbs — not stacked solid cards |
| Instrument, not player | Measure BPS / strain / gates; human posts X |

---

## Quick ops

```bash
# App
open -n "$HOME/Applications/Memory Glass.app"
# or laptop WebGrid
bash experiments/memory-glass/scripts/launch-webgrid-laptop.sh --large --rounds 3

# Hotpipe edit → copy into app Resources when running .app
cp experiments/memory-glass/hotpipe/*.js \
  "$HOME/Applications/Memory Glass.app/Contents/Resources/hotpipe/"
```

```js
// Floats live on WebGrid
// Capsule: FLOATS · DAY · BOARD · BEATS
__mgActivityBoard?.open()
__mgMemoryMaze?.open()
__mgSportsField?.open()  // if sportsfield-bridge loaded
```

---

## Grok restart

```text
Read experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md
and docs/architecture-lab/content/32-memory-glass-browser.md.
Path-checkout only for upstream crates. Never merge upstream/main.
experiments/memory-glass is standalone. No auto-X.
```
