# Site Atlas · Figma-files panel for the live web (not Wayback rebuild)

## Intent

Like Figma’s project file tree (see all main files · download · orient instantly), but for the **open page / site surface**:

1. **Inventory** scripts, styles, links, structure, stack hints  
2. **Score & rank** for *project usefulness* (not SEO vanity)  
3. **Keep / drop** lists  
4. **Instant path** through the page for an agent to learn  
5. **Grok could build better** suggestions  

**Explicitly not:** full site clone / Kimi-style offline rebuild.  
**Is:** cartography + curriculum for Memory Glass + multiagent work.

## API

```js
__mgSiteAtlas.scan({ topic: "optional research topic" })
__mgSiteAtlas.open()      // panel
__mgSiteAtlas.exportMarkdown()
__mgSiteAtlas.last()
```

Search dock (optional): type `atlas` once wired in search-comms.

## Score heuristics (v1)

| Boost | Signal |
|-------|--------|
| + | same-origin app scripts, modules, main/nav, docs/api links, stack detect |
| − | analytics/pixels, low-value chrome links |
| + | research pack topic token overlap |

## Handoff / multiagent

| Agent | Work |
|-------|------|
| A | Same-origin JS AST parse (light) for component names |
| B | Multi-page BFS (depth 1–2, same-origin only, rate-limited) |
| C | Wire `atlas` command in search-comms + TOOLS entry |
| D | Feed path into Grok inspect pack automatically |
| E | qbit-bus: every scan publishes `kind:"atlas"` (already) |

## Relation to qbit / fleet

- Scan publishes on `__mgQbitBus`  
- Export MD joins research pack / inspect pack  
- Fleet machines share the same atlas schema for compare later  

## Success metric

Agent (or human) opens a foreign docs site → **&lt;2s** sees ranked path of 10–15 nodes → knows what to keep, drop, and rebuild.
