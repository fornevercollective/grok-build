# fornevercollective · TIMESYNC world clock

| | |
|--|--|
| **Owner** | **fornevercollective** |
| **Feature id** | `fc-timesync-v1` |
| **Scripts** | `scripts/timesync-world-clock.py` · `scripts/launch-timesync.sh` |
| **Pipe** | `~/.panda/packs/timesync.jsonl` (default) |
| **Companions** | `/gmux` · `/watch` · `/gboom` side-terminal |

## Why

Broadcast / tier-1 ops surface next to live demux:

1. **Unix · epoch · drift** — wall↔mono wander (same class as GrokYtalkY `clock.go`)
2. **Naval command time** — Zulu = UTC; quality tiers L0–L3 mapped from NTP stratum
3. **Markets wall** — major equity sessions with open / pre / AH / closed
4. **Adaptive layout** — dense **80×24** or elongated full wall (mil letter zones)
5. **Hot pipe** — JSONL for future **maptrace** geospatial + **/gboom** pixel stamp

## Launch (in-Grok modal — preferred)

Same class as `/watch` / `/gboom`: opens **inside** the Grok agent view so resize
is handled by ratatui every paint (no stretch ghosting).

```bash
# Open Grok TUI (cargo if binary lacks fc-timesync-v1)
bash scripts/launch-timesync.sh
# then type in agent composer:
/timesync
```

Aliases: `/clock` · `/zulu` · `/worldclock` · `/epoch`

In-modal keys: `Esc`/`q` close · `m` layout · `r` reset-drift · `n` force NTP

### Standalone Python (side terminal only)

Resize-safe alt-screen + SIGWINCH full clear — use when you want a separate pane,
not the Grok modal.

```bash
bash scripts/launch-timesync.sh --standalone
bash scripts/launch-timesync.sh --once
bash scripts/launch-timesync.sh --json | head
bash scripts/launch-timesync.sh --standalone --full
```

Standalone keys: `q` quit · `r` · `n` · `m` · `p` pipe tick

## USNO / naval time levels (effective local tier)

| Level | Meaning | How we claim it |
|-------|---------|-----------------|
| **L0** | USNO Master Clock ensemble (cesium/masers) · DoD primary | **Never claimed locally** — shown as remote reference only |
| **L1** | Traceable to L0 via GPS / USNO public / NTP stratum-1 | `sntp` stratum ≤1 and \|offset\| < 50 ms |
| **L2** | Network / facility follow (stratum-2, BC, software) | stratum ≤2 or larger offset |
| **L3** | Free-run wall clock | no NTP / sntp missing |

Command time for tier1+ ops: **Zulu (Z) = UTC**. Military letter zones (A–Y, Z) are displayed on the full wall.

Also shown:

- **TAI−UTC** leap seconds (currently +37 s)
- **GPS−UTC** offset (+18 s)
- **unix** fractional + ms
- **Δ** wall−mono epoch drift (ms)
- **NTP** offset / stratum / peer / refid (`sntp -d`, default `time.apple.com`)

Env: `TIMESYNC_NTP_PEER=time.nist.gov` to pin peer · `TIMESYNC_PIPE=` path override for launcher.

## Markets

Approximate RTH (weekends only — **no full holiday calendar**):

| Region | Exchanges |
|--------|-----------|
| Americas | NYSE · NASDAQ · CME · TSX · B3 |
| EMEA | LSE · XETRA · Euronext · SIX · JSE |
| APAC | TSE · HKEX · SSE · SGX · ASX · NSE · KRX · TWSE |

US names include pre (04:00) and AH (20:00) ET windows.

## Pipe schema (`fc-timesync-v1`)

Each tick (default 1 Hz) appends one JSON line:

```json
{
  "schema": "fc-timesync-v1",
  "t": 1785356015.518,
  "unix": 1785356015,
  "unix_ms": 1785356015518,
  "iso_utc": "2026-07-29T…Z",
  "zulu": "153015Z",
  "epoch_drift_ms": 0.12,
  "tier": 1,
  "tier_label": "L1 TRACEABLE",
  "ntp_offset_ms": 1.2,
  "ntp_stratum": 1,
  "markets_open": ["lse", "xetra"],
  "market_counts": {"open": 2, "pre": 0, "ah": 0, "total": 18},
  "cities": {"UTC/Z": "15:30:15", "NYC": "11:30:15"}
}
```

Full snapshot: `python3 scripts/timesync-world-clock.py --json --pretty`

### Future: maptrace · gboom pixel pipe

| Consumer | Use |
|----------|-----|
| **maptrace** (`dev/maptrace`) | Stamp hop / orbital overlays with authoritative `unix_ms` + city offsets; TUI map can tail JSONL |
| **/gboom** half-block | Pixel-level HUD: Zulu + Δdrift + tier glyph painted into RGB frame before `▀` cells |
| **Memory Glass LARK** | Same unix/epoch/hops grammar as governance rail |

### Shipped companion: `/map` (`fc-maptrace-v1`)

In-Grok map modal **tails** the timesync JSONL for Zulu/tier/age on the HUD.
Pop-out parity with `/watch`: `/map popout host` · **`o`** / **`w`** keys ·
`scripts/launch-map.sh`. See [MAPTRACE-MODAL.md](./MAPTRACE-MODAL.md).

Still open:

1. `maptrace` CLI flag `--timesync-pipe ~/.panda/packs/timesync.jsonl` (external stack)
2. `/gboom` or live-demux post-paint: read last JSONL line → stamp 8×8 glyph bar

## Layout

| Window | Mode |
|--------|------|
| **80×24** preset | `compact` — big Zulu line, city strip, market glyph grid |
| **≥100 cols or ≥30 rows** | `full` — digit banner, market table, mil letter zones |
| Toggle live | `m` |

## Relation to GY / ST 2110

- Drift indicator mirrors GrokYtalkY `EpochDriftNs` / `FormatUnixClockLine`
- Does **not** claim ST 2110 PTP lock; tier labels are honest about public NTP
- For facility PTP: set peer / future `GY_PTP_OFFSET_NS` bridge (out of scope for v1)

## Verify

```bash
python3 scripts/timesync-world-clock.py --once --cols 80 --rows 24
python3 scripts/timesync-world-clock.py --once --mode full --cols 120 --rows 40
python3 scripts/timesync-world-clock.py --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["schema"])'
```
