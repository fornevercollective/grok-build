---
name: clock
description: >
  /clock /timesync world clock — Zulu, markets, NTP tier, unix/epoch drift.
  Triggers: /clock, /timesync, /zulu, world clock, Zulu time, market hours.
---

# /clock · fc-timesync-v1

```bash
bash scripts/launch-timesync.sh
/timesync
# aliases: /clock /zulu /worldclock /epoch
```

Keys: Esc quit · m layout · r reset drift · n force NTP.  
Pipe: `~/.panda/packs/timesync.jsonl` for `/map` HUD stamp.  
Standalone: `bash scripts/launch-timesync.sh --standalone`
