# /cam · talk · waveform · tracking — plan

| | |
|--|--|
| **Owner** | fornevercollective |
| **Feature** | `fc-cam-talk-v1` (extends `fc-live-demux-v1`) |
| **Refs** | Memory Glass `phone-wave.js` · `/audio-levels` · GY multi-chat · `/cam` |

## Problem

`/cam` today is **video-only** (ffmpeg RGB ring → half-block). Memory Glass already has:

- L/R/M **waveform** strip (`phone-wave.js` · hub `/wave`)
- **Talk** path (phone-talk / speak / whisper dial-in)
- **Tracking** pose bridge (`track_pose` inspect→main)

Grok’s agent modal needs the same *interaction grammar* without WKWebView.

## Goals (this pass)

1. **Live audio waveform** under the cam tile (TTY bars from mic RMS).
2. **Talk / chat strip** inside `/watch` when cam is on (local notes → HUD; optional mesh later).
3. **Tracking interaction** — motion energy from cam frames + HUD meters; keys to focus cam/talk.
4. Bridge **optional**: if MG hub is up (`:9877/wave`), prefer hub levels (MG camera talk → terminal).

## Non-goals (yet)

- Full STT/whisper in-pager (use MG dial-in or external).
- Real face mesh in TTY (motion proxy only).
- Reimplement GY mesh in Grok (spawn/gyst only).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  LiveWatch modal                                        │
│  ┌──────────┐  ┌─────────────────────────────────────┐  │
│  │  CAM ▀   │  │  STREAM half-block                  │  │
│  │  wave ▮▮ │  │                                     │  │
│  │  mot ·%  │  │                                     │  │
│  └──────────┘  └─────────────────────────────────────┘  │
│  talk › hello  (t focus · Enter send · Esc unfocus)     │
└─────────────────────────────────────────────────────────┘
         │ mic RMS              │ frame Δ
         ▼                      ▼
   MicLevelFeed            motion tracker
   ffmpeg avfoundation     (prev RGB vs curr)
   none:0 → f32le
         │
         ▼ optional
   GET localhost:9877/wave  (Memory Glass hub)
```

## Keys (cam-on)

| Key | Action |
|-----|--------|
| `c` | cam on/off (existing) |
| `m` | mirror (existing) |
| `a` | mic / waveform on/off |
| `t` | talk strip focus |
| Enter | commit talk line (when talk focused) |
| Esc | unfocus talk · then close modal |

## Env

| Var | Role |
|-----|------|
| `LIVE_DEMUX_MIC=1` | auto-enable mic with cam |
| `LIVE_DEMUX_MIC_DEVICE=0` | AVFoundation audio index |
| `MG_WAVE_URL=http://127.0.0.1:9877/wave` | optional MG hub levels |

## Ship checklist

- [x] Plan
- [x] `mic.rs` MicLevelFeed (local ffmpeg + optional MG `/wave`)
- [x] Wire LiveWatchState paint + keys (`a` mic · `t` talk)
- [x] Motion from cam RGB deltas
- [x] Optional MG wave pull (`MG_WAVE_URL`)
- [x] Unit tests (talk commit · motion · bar line) — **70/70** `live_demux::` green
- [x] Compile fixes (`Result::unwrap_or_else(|_| …)` · HUD cam `String` branches)
- [ ] Doctor / skill note (follow-up)
- [ ] Mesh gyst fan-out of talk lines (follow-up)

## Try it

**Main Terminal deploy** (so `grok` in a new Terminal is the fork, not stock x.ai 0.2.x):

```bash
bash scripts/deploy-fc-grok.sh              # install ~/.grok/bin/grok with stamps
bash scripts/deploy-fc-grok.sh --open /cam  # + open Terminal.app with cam
bash scripts/deploy-fc-grok.sh --restore    # official binary back
```

```text
/cam                  # large side cam + auto mic (LIVE_DEMUX_MIC default on)
  a / A               # mic / waveform toggle
  t / T               # talk strip focus
  Enter               # commit talk line (stderr: [fc-cam-talk] …)
  Esc                 # unfocus talk · then close
  c / m               # cam · mirror (existing)
```

Optional Memory Glass hub levels:

```bash
export MG_WAVE_URL=http://127.0.0.1:9877/wave
```
