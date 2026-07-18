# Voice dial-in notes (from session export 2026-07-17)

## False positives tightened in voice-bridge dial-in v2

| Heard | Action |
|-------|--------|
| `[BLANK_AUDIO]` | drop tag pattern |
| `(dramatic music)` | drop paren/music tags |
| `Indo.` | short/filler token |
| `Hey Grock…` | echo / Grok mishear |
| `angry glasses live` | TTS echo of “Memory Glass” |
| `I hear you… What should we change?` | agent TTS echo |
| `Using local detection, mesh markers…` | agent TTS echo |
| pure `you` / `ok` / `yeah` | fillers |

## Filters applied

- bracket/paren-only tags
- media hallucination keywords
- agent self-talk substring list
- improved spoken.log fuzzy echo (token overlap)
- mute checked **before** ffmpeg while user.mute set (saves CPU)
- prefer large-v3-turbo model if present when small missing

## Knobs

```bash
export WHISPER_MODEL=$HOME/models/audio/whisper/ggml/ggml-large-v3-turbo-q5_0.bin
export GY_VOICE_CLIP_SEC=2.8
export GY_MIC_INDEX=0   # or 1 for external
bash ~/.panda/voice/mute.sh on   # while typing
bash ~/.panda/voice/session-export.sh
```

## Next

- Mark more FPs in latest.md Dial-in notes after next unmuted session
- Optional: Lab POST /api/stt cloud path
- Optional: GY_VOICE_STS=1 once Voice Agent WS schema confirmed
