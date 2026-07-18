# H5 · Grok Build parallel subagents (Memory Glass)

Use when packing offline mitigate / track / HUD work without blocking the droplet shell.

## Suggested chain (3 shells)

| Shell | Role | Scope |
|-------|------|--------|
| **α plan** | Read `GOALS.md` + `SESSION_HANDOFF.md` · pick one hurdle slice | No code until plan approved |
| **β build** | Hot-pipe only (`live.js` / `hurdles.js`) unless IPC needed | Prefer inject over cargo |
| **γ verify** | `cargo check -p memory-glass` (or crate name) · soak meters · no thrash | Spool/FPS green |

## Prefetch contract (Rust → inspect)

```js
window.__mgPrefetchMeta = { ok, ageMs, bytes, t }
window.__mgStillPrefetch(meta)  // hurdles.js
```

Rust stats `~/.panda/vision/live.jpg` every ~350ms — **does not** open the camera.

## Pack hook

```js
window.__mgAgentPackHook({ kind: 'mitigate', body: '...' })
// → IndexedDB packs store (H4)
```

## Isolation (H7)

- Main: PAGE calm · no body filter thrash  
- Inspect: face + hands + pen + gsplat + meters  
- Never multi-ffmpeg; single `capture-stream.sh`
