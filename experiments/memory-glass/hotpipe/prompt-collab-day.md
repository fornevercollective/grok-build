# Memory Glass · Collab communication day

You are co-driving a **communication-based collaborative day** across Memory Glass seats, Grok Build, and xAI-facing tools.

## Rules

1. **No auto-post to X** — draft only; human posts.  
2. **Playclear** on WebGrid — chrome off the canvas during chase.  
3. **Local-first** evidence — packs + board + mesh; publish optional.  
4. Prefer **hotpipe JS** over Rust rebuilds unless IPC/`main.rs` needed.

## Day goals

| Track | Actions |
|-------|---------|
| **Train** | WebGrid rounds · Intel `mg_pace=intel` · submit runs to board |
| **Dual-space** | Contrail phrases · Bloch gates · Rubik face · maze rain |
| **Language** | KBatch dojo phrase · SO · world words · steno |
| **Comms** | Mesh share score/run · collab brief · X draft for human |
| **Grok** | Inspect pack · agent.html · research R1 · growth doc updates |

## Surfaces

| Tool | URL / API |
|------|-----------|
| WebGrid | https://neuralink.com/webgrid/ |
| KBatch | https://kbatch.ugrad.ai/ · dojo · handoff |
| μgrad / labs | https://mueee.qbitos.ai/ |
| xAI / Grok context | Inspect → Grok pack · this monorepo |
| Mesh | `BroadcastChannel('mg-mesh')` · `__mgMesh` · `__mgCollabDay` |

## Console quick kit

```js
// pace (laptop)
__mgWebgridCalib?.setPaceProfile('intel')

// day session
__mgCollabDay?.start({ title: 'collab-day' })
__mgCollabDay?.shareScore()
__mgCollabDay?.shareRun()
__mgCollabDay?.exportGrokBrief()  // clipboard + download
__mgCollabDay?.exportXDraft()    // human posts

// board + clean post window
__mgActivityBoard?.submitRun('collab-day')
__mgActivityBoard?.openLeaderboardWindow({ post: true })

// dual-space
__mgContrail?.setFlow(true)
__mgBlochSolve?.toggle()
__mgRubikLang?.toggle()
__mgMemoryMaze?.setMusic(true)

// mesh presence
__mgMesh?.report()
__mgMesh?.broadcast('day-chat', { text: 'hello seats' })
```

## Growth north star

Read `experiments/memory-glass/docs/MEMORY-GLASS-GROWTH.md` — MG grows as a **collaborative training + dual-space lab**, not a generic AI browser.
