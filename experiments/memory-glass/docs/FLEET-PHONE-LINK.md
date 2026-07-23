# Fleet · Phone loud TTS · Mini hub ↔ Laptop

**Updated:** 2026-07-20

## Roles

| Device | Role | Job |
|--------|------|-----|
| **Phone** | `phone` | Cam + mic stream → Mini · hears assistant **out loud** |
| **Mac Mini** | `hub` | still-server `0.0.0.0:9877/9878` · no cam needed · receives phone still-pipe |
| **Laptop upstairs** | `laptop` | New MG app or browser → join fleet · chat · optional cam later |

## LAN (this Mini)

Hub discovered as **192.168.0.44** (check `/fleet` if DHCP moved).

| Surface | URL |
|---------|-----|
| Fleet join | https://192.168.0.44:9878/fleet.html |
| Phone cam | https://192.168.0.44:9878/phone.html |
| Phone chat (loud TTS) | https://192.168.0.44:9878/phone-chat.html |
| Phone talk | https://192.168.0.44:9878/phone-talk.html |
| API | http://192.168.0.44:9877/health · /fleet · /tts/latest.m4a |

Trust the still cert once via phone-setup if iOS blocks getUserMedia.

## Loud phone audio

1. Agent/terminal: `bash ~/.panda/voice/speak-local.sh "hello"`  
   → Mini `say` **and** `POST /reply` with TTS m4a  
2. Phone polls `/conversation`, plays `/tts/latest.m4a` or Web Speech  
3. **Tap** Talk/Chat/Hold once (iOS autoplay unlock)

## Laptop upstairs

1. Same Wi‑Fi as Mini  
2. Open **fleet.html** (HTTPS :9878)  
3. **Join as laptop**  
4. See still-pipe live + conversation  
5. Send messages → hub inbox / phone chat  

Memory Glass on laptop:

```js
// after hot_module mg-still-fleet.js (or lab full)
__mgStillFleet.setHub('http://192.168.0.44:9877')
__mgStillFleet.register('laptop')
__mgStillFleet.openFleet()
__mgStillFleet.say('Hello from the laptop')
```

## Env (Mini hub)

```bash
export MG_STILL_BIND=0.0.0.0
export MG_STILL_PORT=9877
export MG_STILL_HTTPS_PORT=9878
export MG_FLEET_ROLE=hub
export MG_FLEET_NAME="Mac Mini hub"
```

## Files

- `still-server.py` — `/fleet`, `/tts/*`, reply TTS synth  
- `phone-speak.js` — phone loud play + fleet heartbeat  
- `fleet.html` — multi-device join desk  
- `speak-local.sh` — Mini say + `/reply` TTS  
- `hotpipe/mg-still-fleet.js` — MG laptop helper  
