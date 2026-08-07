# Agent stage pipe · smart layouts for AI / LLM / MCP / DOJO / Colossus

**Not** a terminal shell. **Not** production NLP scramble.  
**Is** a live broadcast staging deck agents can drive in one or two calls.

## Surfaces

| Surface | Entry |
|---------|--------|
| Glass | `TOOLS →` cube viewer + **AGENT STAGE** bar |
| API | `window.__mgCubeStage` · `window.__mgCubeViewer` |
| Pack | `/data/declaration/agent-stage-layouts.json` |
| Catalog | `/data/declaration/keyboard-lang-groups.json` (89 langs · 15 kb) |

## Pipeline (broadcast style)

```
INGEST ──► SOLVE ──► STAGE ──► BROADCAST ──► OUT
  A-live     GEO+FORM    B-hold      channels      C-out
```

| Slot | Meaning |
|------|---------|
| **A · LIVE** | current text + live solve + conf% |
| **B · HOLD** | last settled word (agents read this) |
| **C · OUT** | teleprompter / export pack |

## Smart layouts

| Layout | Best for |
|--------|----------|
| `broadcast-live` | human demo · captions · full UI |
| `agent-quick` | LLM / Cursor / Grok (compact) |
| `mcp-pack` | MCP tools · DOJO API |
| `dojo-lane` | KBatch site · pathway + nets |
| `colossus-lane` | snapshot / export |
| `teleprompter` | out-only broadcast |
| `grok-dispatch` | hotpipe from Grok terminal |

## One-liners

```js
// LLM / Grok
__mgCubeStage.setRole('llm')
__mgCubeStage.run('water', 'llm')   // push → hold → out
__mgCubeStage.snapshot()            // full JSON for tools

// MCP-oriented
__mgCubeStage.setLayout('mcp-pack')
__mgCubeStage.push(text, { role: 'mcp' })

// DOJO
__mgCubeStage.setRole('dojo')
// + fetch https://kbatch.ugrad.ai/api/mcp  tool: kbatch_rubik_language_solve

// Captions / stream
__mgCubeViewer.startCaptions()
// auto highlight + A-live updates

// Teleprompter bus
// listen: new BroadcastChannel('iron-line') type cube-viewer-teleprompter
```

## Channels

| Channel | Use |
|---------|-----|
| `hexterm` | ingest · settle · agent-ingest |
| `iron-line` | teleprompter out |
| `kbatch-agent` | MCP/LLM pack snapshots |
| `mg-agent-stage` | stage slot updates |

## URL presets

```
/cube-viewer.html?cube_viewer=1&layout=broadcast-live
/cube-viewer.html?layout=agent-quick&role=llm
/cube-viewer.html?layout=mcp-pack&role=mcp
/cube-viewer.html?layout=teleprompter&role=teleprompter
```

## Honesty

- DOJO / Colossus are **lanes** (optional reachability), not the host.
- FORM mesh + GEO path ≠ production simultaneous interpretation.
- Site pipe target: ship `agent-stage-layouts.json` + `keyboard-lang-groups.json` on kbatch.ugrad.ai (same paths as local).
