# fornevercollective · media suite ship checklist (2026-07-29)

## Feature ids

| Id | Slash | Status |
|----|-------|--------|
| `fc-halfblock-tty-video` | `/gboom` + video paint | shipped |
| `fc-live-demux-v1` | `/watch` `/gmux` `/tv` `/live` `/cam` | shipped |
| `fc-timesync-v1` | `/timesync` `/clock` `/zulu` | shipped |
| `fc-maptrace-v1` | `/map` `/maptrace` `/geomap` | shipped |

## Unit tests (pager-render)

- live_demux: **66/66**
- maptrace: **10/10** (incl. SBX / starbase honesty)
- timesync: **3/3**

## Binaries

- `target/debug/xai-grok-pager` and `target/release/xai-grok-pager` contain feature stamps.

## Launch (real TTY only)

```bash
bash scripts/launch-watch.sh      # /watch · /cam
bash scripts/launch-timesync.sh   # /clock
bash scripts/launch-map.sh        # /map starbase
```

## Push package

**Include:** product crates + slash cmds + launch/live-demux scripts + fornever ledgers (LIVE/MAP/TIMESYNC/GBOOM).

**Exclude:** `diff-artifacts-2026-07-29/`, `XAI-VS-OURS-DIFF-…` (ops report), `__pycache__/`, `letter-grid-speed-agent.js` unless wanted.

## Marketplace pack (v0.1.0)

| Piece | Path |
|-------|------|
| Plugin | `plugins/fc-media-suite/` |
| Catalog | `.grok-plugin/marketplace.json` |
| One-liner | `plugins/fc-media-suite/scripts/install.sh` |
| Doctor / update | `scripts/doctor.sh` · `scripts/update.sh` |
| Credits / version | `CREDITS.md` · `VERSION` · `CHANGELOG.md` |
| Root install doc | `INSTALL-MEDIA-SUITE.md` |

```bash
# marketplace
grok plugin marketplace add fornevercollective/grok-build
grok plugin install fornevercollective/grok-build#plugins/fc-media-suite --trust

# one-liner
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash
```

## Not this push

- path-checkout / upstream sync (stash first if/when)
- GBOOM-Web Path A (plan only)
- Official xAI marketplace PR (optional; third-party source works without it)
