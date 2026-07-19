# Downloads → Memory Glass harvest

**Status:** night-two churn · first extracts LIVE  
**Rule:** extract **data + patterns**, not whole Figma Make React trees. Land into `hotpipe/data/` + thin seeds.  
**SYMBOLS:** frozen — harvest never edits `QbitCodec.SYMBOLS`.

---

## Ranked shortlist (do next)

| # | Project (Downloads) | MG landing | Effort | Extract status |
|---|---------------------|------------|--------|----------------|
| 1 | 3D Global Keyboard Layout Matrix | Keys + atlas seed | 2–4 d full UI · **data done** | ✅ `data/global-keyboard-matrix.json` · atlas v2 +21 layouts |
| 2 | **lark tree** | GT / governance | 2–3 d | ✅ `data/lark-tree-extract.json` (62 nodes) · gov tree v2 CDN enrich |
| 3 | Desktop Keyboard Pop-out Menus | Dual drawers / peeks | 1–2 d | ✅ `data/key-popout-menus.json` + seed |
| 4 | audio - Neural / tadmusic | Staff + beats | 3–5 d | ✅ manifest + **`data/audio-staff-map.json`** (beat grid seed · Score→MIDI · Strudel defer) |
| 5 | cube - Neural / side - Neural | Rubik + grid play | 3–5 d | ✅ `data/cube-grid-trails.json` · rubik **v6 grid-trails** (Framer aesthetic + floor/ribbon + bus trail) |
| 6 | lark fontLab / NEUwave | Glyph / type plane | 2–4 d | ✅ `data/glyph-plane-manifest.json` (pattern only · glyph table later) |
| 7 | pyNote | Agent notebook | ~1 w | ✅ `data/pynote-manifest.json` (manifest only · desk covers notes for now) |
| 8 | Interactive Keyboard Application | Merge into #1 | 1–2 d | ⏳ merge after #1 UI |

**Best first pack (this night):** #1 matrix data · #3 popout menus · #2 lark · #4 staff map.

---

## What landed (filesystem)

```
hotpipe/data/global-keyboard-matrix.json   # 6 families · 21 layouts (qwerty…fitaly)
hotpipe/data/keyboard-language-atlas.json  # v2 · + mx_* layouts
hotpipe/data/key-popout-menus.json         # popover pattern + seedMenus
hotpipe/data/lark-tree-extract.json        # 62 nodes from mockData
hotpipe/data/lark-governance-tree.json     # v2 harvest note + CDN children
hotpipe/data/audio-neural-manifest.json    # component/service map
hotpipe/data/cube-grid-trails.json         # Framer Grid Trails + cube/side Neural patterns
hotpipe/data/audio-staff-map.json          # audio-Neural → staff/beats map + beat_grid_seed
hotpipe/data/glyph-plane-manifest.json     # fontLab + NEUwave pattern map
hotpipe/data/pynote-manifest.json          # pyNote components · desk-first
hotpipe/rubik-language-float.js            # v6 grid-trails (floor + ribbon + bus)
hotpipe/keyboard-atlas-seed.js             # rebuilt for inject
hotpipe/key-popout-menus-seed.js           # __mgKeyPopoutMenus
scripts/mg-harvest-downloads.py            # re-run extract
```

### Layout IDs (matrix)

`qwerty azerty qwertz qzerty querty dvorak colemak workman bepo jcuken bulgarian_bds ukrainian chinese_pinyin korean_dubeol japanese_jis arabic hebrew armenian alphabetical stenotype fitaly`

### Popout pattern (do not port React Popover stack)

```
key long-press / click → secondary menu
seed: home/end/page · clear/numlock · fn layer
bus (later): src:keys kind:key-menu
```

---

## Industry daily-use target (SpaceX / Tesla / Boring / Neuralink shape)

Not consumer browser chrome. Operator console for:

| Role | Daily use | MG surface |
|------|-----------|------------|
| Ops / SRE | hop latency · edge health · governance tree | GT + lark + IronLine |
| HMI / factory | multi-layout keyboard · chord/steno · dual drawers | Keys + matrix + popouts |
| Research / AI | encode plane · bus envelopes · agent notebook | Qbit + pyNote (later) |
| Audio / sim | staff · beats · neural audio packs | Staff + harvest #4 |
| Mesh fleet | multi-seat presence · score share | Mesh adapters v2 |

**AI iteration loop:** soak jsonl → STEER.md → agent patch hotpipe → sync → ⌘⇧R → menu-health 18/18 → bus report. That is the “Grokipedia-style” ops writeup target: structured status, not essay.

---

## Re-extract

```bash
cd experiments/memory-glass
python3 scripts/mg-harvest-downloads.py
bash scripts/mg-hotpipe-sync.sh
# MG → ⌘⇧R
```

---

## Next code slices (ordered)

1. **Keys UI** — lang rail shows `mx_*` matrix layouts; stenotype flag for qbit glyph plane  
2. **Popout** — float-keyboard long-press reads `__mgKeyPopoutMenus.seedMenus`  
3. **GT** — lark tree paint uses harvest CDN nodes already in gov json  
4. **Staff** — import audio-neural priority components as thin peeks (not full React)  
5. **Leave spine core** to peer if mid dual-clock / backpressure cook  

---

## Conflict rules

- Peer cooking `qbit-bus|loop|router` → **do not edit** those files  
- Adapters ok for harvest bus kinds later (`kind:key-menu`)  
- Disk tight → no full WebGrid soak while harvesting  
