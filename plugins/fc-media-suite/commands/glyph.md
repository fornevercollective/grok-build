---
description: Glyph engine — peel, quantum-lift, broadcast TX/RX, translate, webgrid
argument-hint: "[arena|peel|popout|lift|broadcast|encode|decode|translate|webgrid|stack|doctor]"
---

# /glyph helper (plugin)

**Universal (any terminal · any AI):**

```bash
fcs glyph
fcs glyph arena
fcs glyph color chroma turbo
fcs glyph peel
fcs glyph popout [URL]
fcs glyph broadcast bloomberg
fcs glyph translate from en to es,fr,ja
fcs glyph webgrid
fcs glyph soak 30
fcs glyph stack
fcs glyph doctor
```

Color modes: hybrid | luma | rgb | chroma | anaglyph | hsv  
Heat: fc | turbo | viridis | magma

Surfaces:

- http://127.0.0.1:8790/ugrad-arena.html?mode=glyph
- http://127.0.0.1:8790/lang-chat-desk.html?from=en&to=es,fr,ja&v=22vis
- http://127.0.0.1:8790/webgrid-ugrad.html
- http://127.0.0.1:8790/llms-glyph.txt

Plain shell (after `fcs install`): `/glyph …` via zsh/bash hook.  
Launch: `bash scripts/launch-glyph.sh`  
Skill: `skills/glyph/SKILL.md` · nested: `/watch glyph`  
Args: $ARGUMENTS
