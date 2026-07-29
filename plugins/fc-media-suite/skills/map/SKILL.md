---
name: map
description: >
  /map maptrace world map + traceroute; Starbase/SBX honesty pin.
  Triggers: /map, /maptrace, starbase, sbx, boca chica, traceroute map, geomap.
---

# /map · fc-maptrace-v1

```bash
bash scripts/launch-map.sh
/map
/map starbase
/map popout 1.1.1.1
/map web example.com
```

Keys: Esc · o pop-out TUI · w web · t target · r re-trace · c cities · h hops.  
Honesty: Starbase pin is 25.997°N 97.157°W; CDN edges are **not** Boca Chica.  
Optional: full `maptrace` at `~/dev/maptrace` (`MAPTRACE_BIN`).
