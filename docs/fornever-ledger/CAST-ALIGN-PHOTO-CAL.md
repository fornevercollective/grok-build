# Cast Align · photo calibration (2026-07-30)

Phone snaps of interactive DashCast surface on **TCL Smart TV** (cells 1–32, 8×4).

## Assets

`~/Downloads/IMG_6604.heic` … `IMG_6614.heic`  
Working JPEGs: `~/.panda/vision/align-photos/`

## What the photos prove

| Observation | Implication |
|-------------|-------------|
| Cell numbers **crisp at close-up** (e.g. center crosshair `960,540`) | Glyph **QR codes** on TV are in-range for phone camera decode |
| Pixel labels `233×256`, coords `727,540` readable | Encode envelope matches profile; sub-cell chrome works |
| Green **SAFE 90%** line visible on bezel | Overscan guide is useful in room |
| **Vogue insert** held in frame (scale ref) | Human-scale object for future AR size estimation |
| Books / shelves / plants as depth markers | Multi-view parallax dataset “for free” from walk-around |
| Window glare on glass | Prefer matte / lower brightness for QR sessions; or shoot off-axis slightly |

## Scale reference (magazine / insert / book)

Physical prop in `IMG_6608` (Vogue card ~ postcard / subscription insert) gives:

- Relative size vs cell (~233×256 px on 1920×1080 canvas)
- Later: homography from prop corners → real-world mm-per-pixel at seating distance

Books on lower shelf + figure objects (horn, terrarium) act as **parallax anchors** when the phone moves.

## QR / glyph launch path

```text
TV cell n shows QR(payload)  →  phone scans  →  open tile/feed/glyph action
```

Payload ideas (glyph stack):

- `gy://tile/load?cell=12&src=…`
- `https://LAN:8765/?control=1&select=12`
- Mesh pin / burst deep-link

Font cleanliness in close-ups means we can render **module-dense QR** in a cell (~200–220 px module area) with quiet zone.

## Infinite window · lightfield-style (phone live)

Not full Octane lightfields yet. Practical stack:

```text
Phone (viewer)
  · Continuity / still-pipe  OR  DeviceOrientation / ARKit later
  · stream pose {yaw, pitch, x,y,z} → align-hub /api/state.viewer
        │
        ▼
TV surface (DashCast HTML)
  · multi-layer scene (bg / mid / fg / glass)
  · parallax shift = f(viewer pose)   ≈ lightfield sample
  · “infinite window” through the TCL as portal
```

Octane lightfields ≈ many views × depth. Our v0:

1. **2.5D layered parallax** (CSS/canvas layers) driven by phone gyro  
2. **Homography warp** of a plate using phone walk-around (multi photo → one depth-ish plate)  
3. Later: depth from Continuity + SAM / SuperMap-class spatial memory  

See `scripts/live-demux/cast-align/parallax-surface.html` + hub `viewer` field.

## Photo set use

| Shot type | Files (approx) | Use |
|-----------|----------------|-----|
| Full wall wide | 6604–6607 | Layout / bezel / room context |
| Scale prop | 6608 | Magazine size reference |
| Mid / angle | 6609–6613 | Parallax / glare / VA off-axis |
| Close type | 6610, 6614 | QR feasibility · center mark |

## Next experiments

1. Put a **QR in cell 12** on the live surface; scan with phone.  
2. `parallax-surface` control on phone → TV layers shift.  
3. Capture 5–7 walk-around stills → offline depth plate for window content.  
