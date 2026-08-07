# WIP media / webgrid push readiness

| | |
|--|--|
| **Status** | Ready to push **this WIP branch** — **not** ready for full version bump / path-checkout |
| **Branch intent** | Land FC media suite + `/webgrid` before any `sync/0.2.121` path-checkout |
| **Fork shell** | still **0.2.111** · SOURCE_REV pin unchanged |
| **OSS tip** | 0.2.121 (do **not** merge upstream/main) |
| **Official binary** | 1.0.0 install is orthogonal — keep FC as `grok-fc` |

## What this commit freezes

- `/webgrid` slash + live_demux webgrid feed (fc-webgrid-tty-v1)
- live_demux: optical / glyph_watch / channels / popout wiring
- launch scripts: `launch-webgrid.sh`, `launch-watch.sh` updates
- Memory Glass: race-shell, webgrid-ugrad PWA, launchers, hotpipe
- plugins/fc-media-suite skills + `.grok/skills` symlinks
- fornever-ledger notes (no giant fork JSON data dumps)

## Explicitly **not** in this push

- Path-checkout to upstream 0.2.121
- Commercial 1.0.0 as default PATH (optional separate relink)
- Lab marketing version bump (0.4.0 / version.json)
- Rewriting SOURCE_REV / FORK_SYNC pins (do after re-apply)

## After push (sync ladder)

1. This branch is the re-apply source for media suite.
2. Branch `sync/0.2.121` → path-checkout upstream.
3. Cherry-pick / re-apply this branch onto sync base.
4. `cargo build -p xai-grok-pager-bin --release` → install `grok-fc`.
5. Then refresh docs pins.

Policy: path-checkout only · never `git merge upstream/main` · preserve `docs/architecture-lab/` + `experiments/`.
