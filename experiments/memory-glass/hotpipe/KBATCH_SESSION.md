# KBatch · Memory Glass session

**From:** parallel Grok instance · **2026-07-18**  
**Intent prompt:** `prompt-kbatch.md` (also copied to `prompt.md` this session)  
**Code workspace:** `/Volumes/qbitOS/00.dev/projects/KBatch-dictionary`  
**Live state:** `KBatch-dictionary/docs/SITE-STATE-AND-BENCHMARK.md`

---

## What this is

Memory Glass as the **chattable tool surface** for [kbatch.ugrad.ai](https://kbatch.ugrad.ai) — keyboard **geometry atlas** (paths, shadows, strain, steno) + world orthography + capsules + lyrics charts + browser MCP.

| Layer | |
|-------|--|
| **Product home** | https://ugrad.ai |
| **Tool** | https://kbatch.ugrad.ai |
| **Agent funnel** | https://kbatch.ugrad.ai/for-ai.html |
| **Dojo MCP** | https://kbatch.ugrad.ai/dojo/ |
| **Lyrics** | https://kbatch.ugrad.ai/lyrics |
| **MCP manifest** | https://kbatch.ugrad.ai/mcp/manifest.json · **14** browser tools |

**Not** OED sense-dictionary. **Is** multi-layout path analysis at scale (~16.6M EN geometry spellings · ~35M world · 1141 charts · 202 capsules).

---

## Launch (this shell)

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass

# Primary tool
./launch.sh "https://kbatch.ugrad.ai/"

# App bundle (Dock)
open "$HOME/Applications/Memory Glass.app" --args "https://kbatch.ugrad.ai/for-ai.html"

# Optional voice mute + still-pipe
bash ~/.panda/voice/mute.sh on
python3 ~/.panda/vision/still-server.py &
```

### Suggested tabs once open

1. https://kbatch.ugrad.ai/  
2. https://kbatch.ugrad.ai/for-ai.html  
3. https://kbatch.ugrad.ai/dojo/  
4. https://kbatch.ugrad.ai/lyrics  
5. https://kbatch.ugrad.ai/mcp/manifest.json  

### Agent moves (DOJO / console)

```js
await kbatchDict.mcp('kbatch_analyze', { text: 'quantum' })
await kbatchDict.mcp('kbatch_chart_lookup', { query: 'too sweet', include: ['path','musica'] })
await kbatchDict.capsuleCanon.load()
await kbatchDict.listCanonCapsules({ rung: 4, limit: 10 })
```

---

## Cross-links · this MG instance (ironline / ugrad / collab)

| MG track | KBatch fit |
|----------|------------|
| **L1 search / L4 notepad** (ironline) | Dict query · capsule load · chart scrub |
| **L3 qbit / steno** | Steno paths · geometry prefixes · quantum-prefixed concepts |
| **UGRAD ladder** | Same ugrad home family · train on geometry drills |
| **WebGrid BPS** | Control bandwidth for typing / air-pointer vs key path strain |
| **MESH collab** | Multi-agent dojo + pack share while editing KBatch-dictionary |
| **Soft Drop glass** | Long reading sessions on dict/lyrics without hard cookie-cutter |

Inspect dock: **UGRAD** · **IRON** · **MESH** still apply.  
Handoff: `SESSION_HANDOFF.md` · goals: `GOALS.md` · competitive: `plans/COMPETITIVE_HARD_TRUTH.md`.

---

## Build toward (KBatch product — other instance)

1. Lag-free slivers only  
2. Learn loop (skill → drill → unlock)  
3. Cited full lyrics + full-song scrub  
4. HTTP MCP for Cursor/Claude  
5. Non-EN analyzed slivers  

## Split of labor (two Grok instances)

| Instance | Owns |
|----------|------|
| **KBatch / dictionary repo** | Data grow, MCP tools, site, world packs |
| **Memory Glass (this shell)** | Native browse, inspect packs, glass UX, still-pipe, overnight soak, hot-pipe |

Edit code in `KBatch-dictionary`. **Use MG to see and drive the live tool.**
