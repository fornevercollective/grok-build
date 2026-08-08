---
description: Open live demux player docs — /watch in fornevercollective binary
argument-hint: "[channel|popout|trailers|list]"
---

# /watch helper (plugin)

**Universal (any terminal · any AI):**

```bash
fcs watch bloomberg
fcs watch popout cnn
fcs /watch trailers
```

In the **fornevercollective** binary, agent composer still accepts:

```
/watch
/watch bloomberg
/watch trailers
/watch popout cnn
```

Plain shell (after `fcs install`): `/watch bloomberg` via zsh/bash hook.  
Launch TUI: `bash scripts/launch-watch.sh` or `fcs watch --tui`  
Full skill: media-suite / watch SKILL.md · agent-packs/generic/SKILL.md  
Args: $ARGUMENTS
