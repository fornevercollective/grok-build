# Face track + scene rebuild · lineage map

Memory Glass inspect tracking is **not** a rehost of these C++/Python stacks — it ports their *roles* into WKWebView + still-pipe (no secure `mediaDevices` on the inspect `with_html` surface).

| Repo / work | Role in the lineage | MG implementation |
|-------------|---------------------|-------------------|
| [daito.ws](https://daito.ws) / Rhizomatiks face lab | Face as instrument · mesh · light | Inspect HUD aesthetic · LOCK badges · pose |
| [ofxFaceTracker](https://github.com/daitomanabe/ofxFaceTracker) / [ofxFaceTracker2](https://github.com/daitomanabe/ofxFaceTracker2) | CLM mesh · polylines · pose · gestures | Feature polylines (jaw/brows/eyes/nose/mouth) · EMA pose · expression scalars |
| [DBFace](https://github.com/daitomanabe/DBFace) | Fast face detect | `FaceDetector` box → lattice (or center prior) |
| [face-alignment](https://github.com/daitomanabe/face-alignment) | Dense landmarks | 468 MediaPipe topology (or reconstructed lattice) |
| [DepthNets](https://github.com/daitomanabe/DepthNets) | Monocular depth | Face-ellipsoid z + voxel column + depth heat |
| [FaceSubstitution](https://github.com/daitomanabe/FaceSubstitution) / [faceswap](https://github.com/daitomanabe/faceswap) | Warp / substitute mesh | Mean-face wire + substitution outline (identity hold) |
| [face_classification](https://github.com/daitomanabe/face_classification) | Expression classes | Smile / brow / jaw open heuristics from landmark ratios |
| [facegen](https://github.com/daitomanabe/facegen) | Generative face params | Pose + expression → gsplat scale/color |
| [roboflow--trackers](https://github.com/daitomanabe/roboflow--trackers) | Multi-object track | Single-face track ID + box EMA (ByteTrack-style smooth) |
| [roboflow--rf-detr](https://github.com/daitomanabe/roboflow--rf-detr) | Detector backbone | Optional future: ONNX DETR head; today FaceDetector |
| [Meta SAM](https://github.com/facebookresearch/segment-anything) | Promptable segment | Soft face matte from box + depth (SAM-style mask, not ViT) |
| MediaPipe Face Mesh | 468 + relative z | Preferred when CDN/WASM loads; else lattice |
| Daito / Rhizomatiks motion · fencing tip trails | Movement estimation · path contrails · velocity | Nose/gaze/brow tip paths · speed-colored ribbon · 3D spatial path in gsplat |

## Pipeline (inspect)

```
still-pipe live.jpg
  → multi FaceDetector (max 4)
  → IoU track IDs (roboflow trackers-role)
  → persona assign (name/age/role: self·partner·child·guest)
  → landmarks (face-alignment / ofx mesh topology)
  → occlusion sort (far→near by face scale)
  → SAM-role matte per person
  → ofx polylines + multi gsplat
  → IPC track_people + track_pose
  → main FOV pixel-bend / body filter / layer masks
```

## Personas

| Role | Default | FOV / bend |
|------|---------|------------|
| self | You | fov 1.0 · bend 0.12 |
| partner | Partner | fov 1.05 · bend 0.16 · hue pink |
| child | Child | fov 1.18 · bend 0.22 · hue green (size heuristic) |
| guest | Guest | fov 1.08 |

- **Auto:** smaller face → child; sticky `localStorage mg.personaAssign.v1`
- **Manual:** select persona chip → click face; double-click chip to set **name/age**
- **Not** biometric ID — relative scale + sticky track ID (no cloud face recognize)

## What still needs native/heavy

- Real RF-DETR / DBFace ONNX in-process
- True SAM ViT weights
- Full FaceSubstitution texture warp (needs GL + identity bank)
- MediaPipe WASM offline bundle inside `.app` (CDN often blocked)

Until then, **hot-pipe `live.js`** owns the visual rebuild; rust only for window/IPC/cam auth.

## Goals / hurdles (product, not just lineage)

See **`GOALS.md`**. Short map:

| Hurdle | Lineage link |
|--------|----------------|
| **H0 baseline** | Face instrument + path contrails (ofx / Daito tip trails) — **shipped** |
| **H1 next** | Hands / air pointer without thrash — gesture path, not body thrash |
| **H2** | Pen / object tip — fencing tip as path source |
| **H3+** | WebGPU/Metal GSPLAT, true SAM/DETR, XR depth — native/heavy |
