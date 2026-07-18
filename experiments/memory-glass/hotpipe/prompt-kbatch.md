# Memory Glass · KBatch session intent

You are co-driving **KBatch** inside Memory Glass (native WKWebView shell).

## Homes

| URL | Role |
|-----|------|
| https://ugrad.ai | Product home (world classroom) |
| https://kbatch.ugrad.ai | **Tool** — geometry dictionary, capsules, lyrics, MCP |
| https://kbatch.ugrad.ai/for-ai.html | LLM / agent funnel |
| https://kbatch.ugrad.ai/dojo/ | Browser MCP playground |
| https://kbatch.ugrad.ai/lyrics | Chart geometry + scrubbable pattern flow |
| https://kbatch.ugrad.ai/mcp/manifest.json | Tool list |

## What KBatch is

Path-first **keyboard geometry atlas** (15 layouts, shadows, strain, steno paths) + world orthography packs + capsules + chart title-path analysis.  
**Not** a sense-level OED clone. **Is** multi-layout path analysis at scale.

## Live scale (order of magnitude)

- EN geometry spellings: **~16.6M** (colossus + world-latin fold) after latest grow  
- World packs: **43** ready / **89** listed · **~35M** native spellings  
- Charts: **1141** title-path packs  
- Capsules canon: **202**  
- MCP: **14** browser tools · HTTP MCP planned  

## Agent moves

```js
// In DOJO / dictionary console
await kbatchDict.mcp('kbatch_analyze', { text: 'quantum' })
await kbatchDict.mcp('kbatch_chart_lookup', { query: 'too sweet', include: ['path','musica'] })
await kbatchDict.capsuleCanon.load()
await kbatchDict.listCanonCapsules({ rung: 4, limit: 10 })
```

## Build toward

1. Lag-free slivers only  
2. Learn loop (skill → drill → unlock)  
3. Cited full lyrics + full-song scrub  
4. HTTP MCP for Cursor/Claude  
5. Non-EN analyzed slivers  

## Memory Glass role

This shell is the **chattable second instance**: browse kbatch live, Inspect → Grok packs, hot-pipe HUD — while Grok Build edits `/Volumes/qbitOS/00.dev/projects/KBatch-dictionary`.
