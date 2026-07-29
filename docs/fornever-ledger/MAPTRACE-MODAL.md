# fornevercollective · MAPTRACE in-Grok modal + pop-out

| | |
|--|--|
| **Owner** | **fornevercollective** |
| **Feature id** | `fc-maptrace-v1` |
| **Module** | `xai-grok-pager-render::maptrace` |
| **Slash** | `/map` · `/maptrace` · `/trace-map` · `/geomap` |
| **Companions** | `/watch` pop-out · `/timesync` JSONL stamp · `dev/maptrace` |

## Product class (parity with `/clock` + `/watch`)

| Ability | `/watch` | `/timesync` (`/clock`) | `/map` |
|---------|----------|------------------------|--------|
| In-Grok modal | half-block demux | world clock wall | ASCII equirectangular map + hops |
| Reflow every paint | yes | yes | yes |
| Pop-out external | `ffplay` · **`o`** · `/watch popout` | standalone python / side pane | `maptrace` TUI/web · **`o`/`w`** · `/map popout` |
| Launch script | `scripts/launch-watch.sh` | `scripts/launch-timesync.sh` | `scripts/launch-map.sh` |
| Toast identity | `fc-live-demux-v1` | `fc-timesync-v1` | `fc-maptrace-v1` |

## In-Grok (`/map [host|place]`)

```text
/map
/map 1.1.1.1
/map example.com
/map starbase          # SBX pin + spacex.com
/map spacex.com
```

### Place aliases

| Alias | Traces | Pin |
|-------|--------|-----|
| `starbase` · `sbx` · `boca chica` · `spacex-texas` | `spacex.com` | **X** SBX 25.997°N 97.157°W |
| `spacex` | `spacex.com` | SBX + honesty line |

**Honesty:** public edge is Cloudflare CDN, not a physical path to Boca Chica.

Keys:

| Key | Action |
|-----|--------|
| **Esc** / **q** | close |
| **o** | pop-out → external maptrace TUI |
| **w** | pop-out → maptrace web UI |
| **t** | edit target (Enter confirm) |
| **r** | re-run traceroute |
| **c** | toggle city glyphs |
| **h** | toggle hop markers |

HUD stamps last line of `~/.panda/packs/timesync.jsonl` when present (`fc-timesync-v1`).

## Pop-out

```text
/map popout 1.1.1.1
/map out example.com
/map web cloudflare.com
bash scripts/launch-map.sh popout 1.1.1.1
bash scripts/launch-map.sh web example.com
```

Resolve order for external binary:

1. `MAPTRACE_BIN`
2. `which maptrace`
3. `~/dev/maptrace/bin/maptrace.js`
4. **Hard-fail** if sqlite3 native arch ≠ Node arch (e.g. arm64 `.node` under x86_64 Node)
5. macOS Terminal + `traceroute -n` fallback (always)

## Honesty

| Is | Is not |
|----|--------|
| Local geometric TTY map + best-effort traceroute | Full MapLibre/Cesium fidelity in-Grok |
| Hop positions **approximate** when no geo DB | Authoritative IP geolocation |
| Pop-out to full maptrace when installed | Reimplementation of maptrace mesh |
| SBX pin for Starbase place aliases | Claim that hops reach Boca Chica |
| Traceroute fallback when maptrace broken | Silent crash on arch mismatch |

## Try

```bash
cargo build -p xai-grok-pager-bin --release
bash scripts/launch-map.sh
# /map
```

## Related

- [TIMESYNC-WORLD-CLOCK.md](./TIMESYNC-WORLD-CLOCK.md) — pipe schema
- [LIVE-DEMUX-PIPELINE.md](./LIVE-DEMUX-PIPELINE.md) — pop-out pattern
- `dev/maptrace` — external TUI/web stack
