# Credits · fc-media-suite

| | |
|--|--|
| **Product** | fornevercollective media suite |
| **Version** | see `VERSION` / `plugin.json` |
| **Feature ids** | `fc-live-demux-v1` · `fc-timesync-v1` · `fc-maptrace-v1` · `fc-halfblock-tty-video` |
| **Repo** | https://github.com/fornevercollective/grok-build |
| **Homepage** | https://fornevercollective.github.io/grok-build/ |

## Ownership

| Layer | Owner |
|-------|--------|
| Media suite design + implementation (`/watch` `/cam` `/clock` `/map`, half-block, pop-out, X live, trailers shuffle, Starbase map honesty) | **fornevercollective** |
| Base Grok Build harness (agent, tools, pager shell, marketplace runtime) | **xAI** (`xai-org/grok-build`) |
| Official plugin marketplace index | **xAI** (`xai-org/plugin-marketplace`) — third-party plugins are AS-IS |

fornevercollective ships **on top of** the xAI harness via a public fork + this plugin pack. We do **not** claim xAI authorship of base Grok Build.

## Ecosystem leverage (intended consumers)

Install path is designed so any of these can adopt the pack without a monorepo merge:

- **SpaceXAI** / **xAI Grok** — coding agent TUI + media wall
- **x.com** — live broadcast ingest + go-live path (`/watch` X paste · `U` uplink)
- **SpaceX** — `/map starbase` honesty pin (CDN edge ≠ Boca Chica)
- **Tesla / Neuralink / related ops** — same TTY media + clock + map surfaces

Keywords and marketplace domains below are discovery aids, not official endorsement.

## Third-party tools (runtime deps)

| Tool | Role |
|------|------|
| **yt-dlp** | Resolve YouTube / X / playlist streams |
| **ffmpeg / ffplay** | Demux RGB pipe · cam capture · OS pop-out windows |
| **sntp** (optional) | NTP sample for `/clock` tiers |
| **maptrace** (optional) | Full external map TUI/web pop-out (`dev/maptrace`) |
| **traceroute** | Fallback hop discovery for in-Grok `/map` |

## Honesty

- In-TTY paint is geometric half-block / ASCII — not a full browser player.
- X go-live still requires Media Studio Producer + your tunnel; we spawn the local HLS pipeline only.
- Starbase map pin is coordinates + aliases; hop geolocation is approximate.
- Upstream xAI may rename/move surfaces; this pack tracks **feature ids** for doctor checks.

## License

Upstream Grok Build: see repo root `LICENSE` / `THIRD-PARTY-NOTICES`.  
fornevercollective contributions: same dual-path policy as the fork — product islands under `plugins/`, `docs/fornever-ledger/`, `scripts/`, `experiments/`.
