# House vantage calibration · multi-user

Measured **2026-07-30** (living room TCL wall).

## Fixed geometry

| Measure | Inches | cm | Notes |
|---------|--------|-----|--------|
| Floor → **seated horizon** (your eye line) | **62"** | **157.5** | Primary adult seat |
| Floor → **TV center mark** | **60.5"** | **153.7** | Crosshair / center cell |
| Eye above center (seated) | **+1.5"** | **+3.8** | Slight look-down to hit center |
| Couch distance | **??** | default **~274 cm (9 ft)** | Multi-seat / roam — refine later |

Horizon line on panel is derived from eye height vs center mark + ~81 cm panel height class.

## Users / phones

| Profile | Posture bias | Gain | Smooth | Intent |
|---------|--------------|------|--------|--------|
| **You** | seat / stand / floor / crouch / chair | 1.4 | 0.25 | Full track, Zero + gyro |
| **Partner** | seat default | **1.05** | **0.55 calm** | Short valuable sessions — less glitch |
| **Kid (10)** | play / floor / roll | **1.65** | 0.15 | Second phone; PiP/games friendly |
| **Dog** | pet / low eye ~40 cm | 1.2 | 0.2 | Field-shift / pet content later |

## Phone control (each handset)

1. Open QR → `http://LAN:8765/box`  
2. Tap **You / Partner / Kid / Dog** (cycles user)  
3. Tap posture: **Floor · Crouch · Seat · Chair · Stand · Play**  
4. Face center mark → **Zero vantage** (locks yaw0/pitch0)  
5. Optional **Phone gyro** — height assist + motion class (still / shift / roam / play)  
6. **Recast TV** if wall is stale  

Daughter’s phone: set user **Kid**, Zero when she settles for a show; roam uses higher gain.  
Partner: set **Partner** before shared content — calm smoothing, lower gain.

## Couch distance (still open)

When you can measure floor tape couch → TV:

```bash
# then set via control or:
curl -s -X POST http://127.0.0.1:8765/api/state \
  -H 'Content-Type: application/json' \
  -d '{"vantage":{"seat_distance_cm": XXX, "house":{"couch_distance_cm": XXX}}}'
```

Or walk Zero → mark two seats and we can store multi-seat presets later.

## Pet / kid content (later)

- **Pet mode**: lower horizon, optional content layer (calm fields, not flash)  
- **Kid mode**: wider parallax, second controller, PiP-safe gains  
- **Partner mode**: prefer stable program bus, no idle thrash  

Whitespace glyph / binary payload stays mesh-side — QR only launches phone control.
