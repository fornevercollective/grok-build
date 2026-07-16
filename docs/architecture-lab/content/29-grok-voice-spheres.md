# Grok Voice · spheres · variations

Official product: **[x.ai/voice](https://x.ai/voice)** · TTS: **[x.ai/voice/text-to-speech](https://x.ai/voice/text-to-speech)** · Docs: [text-to-speech](https://docs.x.ai/developers/model-capabilities/audio/text-to-speech)

Lab surface: **Chat** float window → voice constellation (orbs). Catalog: `assets/spacexai-voices.json`.

---

## Suite (x.ai/voice)

| Product | Price (public) | Lab hook |
|---------|----------------|----------|
| **Speech to Speech** | $0.05 / min | Realtime / Listen · agent voice path |
| **Speech to Text** | $0.10/hr batch · $0.20/hr stream | STT proxy when keyed |
| **Text to Speech** | $15 / 1M chars | `POST /api/tts` · sphere Preview |
| **Voice Cloning** | 30 free clones | Custom orbs when API returns clones |
| **Live Translation** | Coming soon | Link only |

Builder: [Voice Agent Builder](https://console.x.ai/team/default/voice/agents) (beta).

---

## Voice variations (visual language)

Orbs use the **official Grok logomark unaltered** + ambient hue halo (brand policy).

| Variation | Filter | Visual |
|-----------|--------|--------|
| **Original** | Original | Ara · Eve · Leo · Rex · Sal — cyan solid ring · larger orbs · “original” badge |
| **Flagship** | Flagship | Full TTS library (Carina, Zagan, Helix, …) — multi-hue soft ring · purple badge |
| **Clone** | Clone | Custom brand clones — dashed amber ring · “clone” badge |
| **STS** | STS | Voices suited to speech-to-speech / agents |
| **TTS** | TTS | Text-to-speech library |
| **Role** | Support / Wellness | Role-tinted active glow |

Click orb → select + optional TTS preview (`XAI_API_KEY` via lab env). Selection → `localStorage lab.voiceId`.

### Original five (product landing)

| ID | Tone (x.ai) |
|----|-------------|
| **ara** | Warm and friendly |
| **eve** | Energetic and upbeat · default |
| **leo** | Authoritative and strong |
| **rex** | Confident and clear |
| **sal** | Smooth and balanced |

Flagship names track [TTS page](https://x.ai/voice/text-to-speech) (Carina, Zagan, Helix, Orion, Luna, Iris, Altair, Zenith, …).

---

## Lab files

| Path | Role |
|------|------|
| `assets/spacexai-voices.json` | Static catalog + suite metadata |
| `assets/voice-spheres.js` | Constellation UI · filters · preview |
| `assets/voice-spheres.css` | Variation rings / badges |
| `GET /api/voices` | Live merge when API key present |
| `POST /api/tts` | Preview selected voice |

---

## Related

- [SpaceXAI / brand](#/12-brand)
- [Official xAI · models · pricing](#/18-official-xai)
- [Versioning · upstream](#/28-versioning-upstream)
