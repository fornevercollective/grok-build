# Lab tools workspace

Tabs across the top of the Grok Build Lab:

| Tab | Purpose |
|-----|---------|
| **Docs** | Markdown architecture map (this site) |
| **Ship** | x.ai/cli surface: plan · skills · plugins · Q&A · subagents rehearsal |
| **Notes** | Notebook cells (MD + JS) · funnel run · right Inspect/Search/Ask |
| **Table** | Editable data pad · CSV/JSON · section rearrange |
| **X desk** | Articles · code · discussions table |
| **Broadcast** | X Spaces bind + RTMP Media Studio (from burst) |
| **History** | Git version history (grok-build / GrokYtalkY) |

**Terminal** is a **global footer** on every page (not a tab): process readout, errors, mitigations. Collapse with ▾ / ▸.

**Left column menu** is **active on all pages** (Docs, Notes, Table, …). Use **Menu / Hide** in the top bar (or the edge **‹ / ›** control on desktop) to collapse or expand it.

## Terminal mitigations

Inspired by timeline/history ops surfaces:

| Issue | Mitigation |
|-------|------------|
| ffmpeg high CPU / swarm | **Kill ffmpeg** → `pkill -x ffmpeg` |
| grok not running | **Summon grok** / Listen “hey grok” |
| API down | Restart `./serve.sh` |

APIs: `/api/processes` · `/api/events` · `/api/mitigate` · `/api/git-log`

## Broadcast (separate tab)

Ports burst.html tools:

- Space URL bind + Open on X  
- RTMPS/RTMP ingest base  
- Stream key + `gy stream-x` / ffmpeg command template  
- Link out to full [burst.html](http://127.0.0.1:8766/burst.html) stage  

## Local storage keys

`lab.notes.v1` · `lab.table.v1` · `lab.sections.v1` · `lab.xitems.v1` · `lab.bcast.v1`

## Mobile / PWA / mesh

| Feature | How |
|---------|-----|
| **Install PWA** | Chrome/Edge “Install app” chip when eligible |
| **Offline shell** | `sw.js` precaches app shell + overview md |
| **Pull to refresh** | Drag down at top of page (mobile) |
| **Lazy load** | Docs pages + brand images `loading=lazy`; nav prefetch |
| **Share** | System share of current URL (if supported) |
| **Glyph pins** | **Idle until multi-device mesh collab** (like Overview) |
| **Join mesh** | Sidebar **Join mesh** → `BroadcastChannel('lab-mesh')` + `ugrad-live` |

Open the lab on two devices/tabs → **Join mesh** on both → pins go live when the other peer is seen.

Deep links: `#/tool/ship` · `#/tool/terminal` · `#/tool/broadcast` · `#/tool/history`

## Ship tab storage

`lab.ship.v1` — Q&A answers · plan status · subagent demo state · pinned capabilities.

Chat text turns: `lab.chat.turns.v1` (chat window).

## History scrub (mueee-style)

Not only a range slider. The **History** tab and topbar strip use a **canvas timeline**:

| Gesture | Action |
|---------|--------|
| **Drag** | Pan along commits (tape scrub) |
| **Wheel** | Zoom toward pointer |
| **Click** | Select commit → Inspect rail |
| **± / ↺** | Zoom in/out / fit all |
| **← / →** | Keyboard scrub (History mode) |
| Fine range | Optional slider under the panel timeline |

Inspired by `mueee/history.html` timeline strip (grab · pan · zoom · hover label).

## Aval ([pixel-point/aval](https://github.com/pixel-point/aval)) — evaluate, don’t wire by default

**What it is:** open-source **interactive video** format (`.avl`) + web player with state machine, hover/focus transitions, packed alpha. Technical preview; MIT.

| Fit for this lab | Notes |
|------------------|--------|
| **Enhance?** | Possible for Siri orb / walkie motion, branded hover states, short loops — not for git history scrub |
| **Security** | Treat assets as **untrusted**: strict parser, digests, bounded fetches. See their `SECURITY.md` / `THREAT-MODEL.md` |
| **Risk if bolted on** | New decoder/WebGL surface; untrusted CDN `.avl` without SRI; early preview API churn; FFmpeg only at **compile** time (publisher side) |
| **Recommendation** | **Do not add as a runtime dependency yet.** Revisit for polish motion after stable `1.x` + pinned integrity hashes + same-origin assets only |
