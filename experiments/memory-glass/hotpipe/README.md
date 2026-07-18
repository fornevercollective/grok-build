# Memory Glass · hot-pipe

Live work loop for Grok + Memory Glass **without full app rebuild/relaunch**.

**Growth north star (read first):** [`../docs/MEMORY-GLASS-GROWTH.md`](../docs/MEMORY-GLASS-GROWTH.md)  
**Collab day:** `prompt-collab-day.md` · `collab-day.js` · capsule **DAY / GROK↦ / MESH+**

## Layout

| Path | Role |
|------|------|
| `live.js` | Injected into the main WKWebView when mtime changes (~1s poll) |
| `GOALS.md` | North-star · hurdles · ironline · ugrad · collab |
| `SESSION_HANDOFF.md` | Restart ops + known issues |
| `MEMORY-GLASS-GROWTH.md` | *(parent docs/)* what MG is growing into |
| `prompt-collab-day.md` | Communication collab day for Grok / multi-seat |
| `collab-day.js` | Mesh share score/run · Grok brief · X draft (human) |
| `webgrid-play.js` | Agent chase · **Intel pace** · play-perf mode |
| `activity-leaderboard.js` | Local board + open clean `leaderboard.html` |
| `X_WRITEUP.md` | Public speed / goal language for X–Grok |
| `prompt.md` | Current agent prompt / intent Grok should extend |
| `loop.json` | Lightweight loop state (iteration, last pack, last mitigation) |
| `agent.html` | In-browser agent / prompt surface (navigate via Inspect **Agent**) |
| `mitigations/*.js` | Auto-applied when inspect errors match a pattern |
| `data/` | Bench JSON · music packs · filmstrip sample |
| `out/` | Inspect packs written for Grok Build submit |
## Workflow

1. Leave Memory Glass running.
2. Edit `hotpipe/live.js` (or a mitigation).
3. App injects it live — check Inspect for `hotpipe · applied`.
4. On inspect **err/warn**: Copy or **→ Grok** to write a fat pack + clipboard.
5. Open **Agent** for the local loop/prompt page (same hot-pipe root).

## Pack path

- Local: `hotpipe/out/inspect-pack-*.md`
- Fleet: `~/.panda/packs/mg-inspect.json` (when present for Lab chain)

## Mitigations

Filename stem is the pattern key. Example: `camera_denied.js` runs when a log line contains `NotAllowedError` or `Camera denied`.

Each mitigation is plain JS executed once per match burst (cooldown in app).

## Soft reload API (page)

```js
window.__mgHotPipe.reload()      // re-fetch live.js via native
window.__mgHotPipe.apply(js)    // eval a string patch now
window.__mgHotPipe.mitigate()   // ask native to scan errors → mitigations
window.__mgHotPipe.submit()     // inspect pack → Grok Build
```
