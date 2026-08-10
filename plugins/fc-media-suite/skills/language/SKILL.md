---
name: language
description: >
  /language multi-lang stream handler and chat desk: captions under users, full
  transcript, any AI (SpaceXAI default), GrokYtalkY live/livenews, /cast aggregate
  captions. Triggers: /language, /lang, chat /cam from en - fr - ja, GrokYtalkY,
  multi-lang captions, language cast.
---

# /language · ONE construct (TTY-first)

**All tools in one surface** — no launch to GrokYtalkY / kbatch / other sites.  
Terminal is the **fast path** (offline type → captions → transcript). Browser desk is an optional mirror of the same construct.

```text
/language chat /cam from en - fr - ja
/language chat from en to fr,ja,zh
/language live from en - fr - ja
/language cast from en - fr - ja
```

| Unit (in construct) | Role |
|---------------------|------|
| **Captions under users** | Each lang is a “seat” with live caption |
| **Main transcript** | Full conversation readout |
| **Cam** | Armed in construct (Ctrl+c) · desk uses getUserMedia |
| **Live mesh** | In-page glyph strip (Ctrl+l) — not external GrokYtalkY |
| **Cast aggregate** | Local pack/transcript bus (Ctrl+k) |
| **Any AI** | Ctrl+g only (not on every key) |

## Any AI

| Provider | Env |
|----------|-----|
| **spacexai** (default) | `XAI_API_KEY` · `https://api.x.ai/v1` · `grok-4.5` |
| **openai_compat** | `FC_LANGUAGE_BASE_URL` · `FC_LANGUAGE_API_KEY` · `FC_LANGUAGE_MODEL` |
| **ollama** | `FC_LANGUAGE_PROVIDER=ollama` · local OpenAI-compat |
| **offline** | phrase map (always live) |

```bash
export XAI_API_KEY=…
python3 scripts/language/lang-chat-bridge.py say "hello everyone" --from en --to fr,ja --aggregate
bash scripts/language/lang-chat-launch.sh from en to fr,ja --cam --live --cast
```

## kbatch.ugrad.ai-level page

| URL | Role |
|-----|------|
| **http://127.0.0.1:8790/lang-chat-desk.html** | Production desk · captions · transcript · `window.__fcLanguageDesk` |
| **http://127.0.0.1:8790/lang-lattice.html** | Lattice v7 · **Composer** plays all refs · **live translate** · organic + world-flow + **Bloch atom codex** · `window.__fcLanguageLattice` |
| **http://127.0.0.1:8790/lang-organic-mesh.js** | `fc-language-organic-mesh-v1` · tokenize · SPACE_CHARS stego · cross-lang edges · paint |
| **http://127.0.0.1:8790/lang-world-flow.js** | `fc-language-world-flow-v1` · kbatch capsule path · letter dirs · rhythm · dance · flowSim · echarts series |
| **http://127.0.0.1:8790/lang-composer.js** | `fc-language-composer-v1` · play all refs · MyMemory/Libre/Lingva · analyzeTick |
| **http://127.0.0.1:8790/lang-bloch-codex.js** | `fc-language-bloch-codex-v1` · letter→gate→θφ · multi-lang register · uvqbit lineage |
| **http://127.0.0.1:8790/stream-stack.html** | **Stream with** · drone flayer A+B (PIP/split/blend) · platforms + captions |
| http://127.0.0.1:8790/lang-chat-for-ai.html | Agent funnel (for-ai style) |
| http://127.0.0.1:8790/data/language/manifest.json | Surface map + tools |
| http://127.0.0.1:8790/llms-language.txt | LLM/agent contract |
| Pair | https://kbatch.ugrad.ai/for-ai.html · lang-tree · typing · learn · dojo |

## Stream stack · flayer (drone HUD + platforms)

Compose **A with B** using the same optics z-stack as `webgrid-drone-hud` (base · mix · mesh · captions · hud).

```bash
bash scripts/language/stream-stack-launch.sh
bash scripts/language/stream-stack-launch.sh with news+cam
bash scripts/language/stream-stack-launch.sh a vevo b cam mode blend
# open:
# http://127.0.0.1:8790/stream-stack.html?with=vevo+cam&mode=pip
```

| Layout | Meaning |
|--------|---------|
| **PIP** | A full · B picture-in-picture (stream with) |
| **SPLIT** | A \| B side by side |
| **BLEND** | B over A with opacity / screen blend |
| **SINGLE** | A only |

| Platform | Source |
|----------|--------|
| YouTube | embed / live handles (vevo bloomberg nasa cnn spacex lofi) |
| Twitch | player.twitch.tv + parent host |
| HLS / mp4 | `<video>` |
| Cam | getUserMedia |
| mix.mjpg | optical / mix-pipe on :8790 |
| iframe / X | generic embed |

```js
const S = window.__fcStreamStack
S.streamWith("vevo", "cam")
S.setMode("blend")
S.fanout("hello everyone")
S.snapshot()
```

```js
const D = window.__fcLanguageDesk
await D.fanout("hello everyone")
D.setLangs("en", ["fr","ja","zh"])
D.snapshot()
D.openGy("glyph")
```

## Packs / buses

| Path | Role |
|------|------|
| `~/.panda/packs/language-chat-latest.json` | last multi-lang turn |
| `~/.panda/language/conversation.jsonl` | full conversation log |
| `POST /api/transcript` + `captions: {en,fr,ja}` | L3 / cast lower-thirds |
| `~/.panda/vision/cast/transcript.jsonl` | offline pipe |

## TTY keys (stream handler)

type offline · **Ctrl+g** AI · **Ctrl+t** provider · **+/**− langs · Esc
