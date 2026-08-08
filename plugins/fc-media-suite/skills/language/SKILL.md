---
name: language
description: >
  /language simultaneous multi-language keyboard translation streams
  (layout remap, offline+trans, hex/steno/braille). Triggers: /language, /lang,
  polyglot, multilang, keyboard translation, fcs language. Lineage: MG KEYBOARD-PLANE.
---

# /language · fc-language-stream-v1

Type once → many streams update live (not nested under `/watch`).

```bash
/language
/language layout
/language translate
/language codec
/language popout          # MG keyboard plane
fcs language
bash scripts/launch-language.sh
```

| Key | Action |
|-----|--------|
| type | source buffer |
| **Tab** | focus stream column |
| **Ctrl+m** / empty **m** | cycle mode all→layout→translate→codec |
| **Ctrl+r** | clear |
| **Ctrl+o** | open MG keyboard plane (`?mg_kb=1`) |
| **Esc** | quit |

Streams: EN + ES/FR/DE/JA/ZH · RU/HE/AR/Dvorak/AZERTY layouts · HEX/STENO/BR8/REV codecs.  
Optional: install `translate-shell` (`trans`) for better MT. Offline phrase map always works for common words.


## Hotpipe (all options)

MG inject: `hotpipe/language-hotpipe.js` after lang-codec + float-keyboard.

| Bus | Path |
|-----|------|
| BroadcastChannel | `fc-language-streams` |
| Pack | `~/.panda/packs/language-hotpipe.jsonl` · `language-hotpipe-latest.json` |
| API | `window.__mgLanguageHotpipe.fanout(text)` · `.allOptions(text)` · `.formats()` |

Fanout covers **all** lang-codec formats (ascii/hex/binary/pcap/gutter/steno/glyph/qbit) + layouts + translate targets simultaneously.

```js
__mgLanguageHotpipe.allOptions("hello")
__mgLangCodec.allViews("hello")  // codec powerhouse
__mgFloatKb.launch({ mode: "codec" })
```
