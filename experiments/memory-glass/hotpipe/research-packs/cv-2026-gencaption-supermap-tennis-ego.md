# Research pack · CV / spatial / sport / ego 2026 threads

_Memory Glass R1 · topics for Mini churn · 2026-07-17_

**Topic:** GenCaption/GNM, SuperMap SLAM, Tennis AI (Tracknetics), 3D HPE, Perceptron Egocentric, Sado Tokuyama (@tokufxag)

---

## Why this set matters for Memory Glass

| Thread | MG hook |
|--------|---------|
| **GenCaption + GNM** | Dense spatial captions for inspect packs / page+scene description without Electron VLMs |
| **SuperMap ST-SLAM** | Multi-agent / multi-cam map memory — Mini + phone still-pipe + path contrails as sparse graph |
| **Tennis AI stack** | YOLO + TrackNet + CatBoost + homography = sport-as-instrument parallel to fencing tip / air pointer |
| **3D human pose (Python)** | Lift H1 hands/face from 2D → 3D pose bank; Bharath-style pipelines as hot-pipe ports |
| **Perceptron Egocentric API** | Hand skeletons + atomic events + captions on egocentric/still-pipe video — **closest commercial parallel to H1/H2** |
| **@tokufxag (Sado Tokuyama)** | Creative vision/UX posts — lineage with daito/Rhizomatiks aesthetic; hunt repos for interactive CV |

---

## 1. ECCV 2026 · GenCaption + GNM head

| Item | Notes |
|------|--------|
| **ECCV 2026** | Conference cycle (submissions ~Mar 2026, decisions ~Jun 2026). Main program: [eccv.ecva.net](https://eccv.ecva.net/) |
| **GenCaption** | User shorthand — likely **generative / grounded captioning** track (image→dense captions, often with localization). Confirm exact title when proceedings drop or arXiv preprint surfaces. |
| **GNM head** | Often **Global Navigation Map** / goal-conditioned nav map heads in embodied papers, or a **caption decoder head** named GNM in a specific preprint. Treat as: *learned head that maps visual features → structured language or map tokens*. |

**MG action:** Watch OpenReview ECCV 2026 + arXiv `cs.CV` for “GenCaption” / “GNM”. When found: extract method table → `research.js` pack → decide if offline caption head can run on Mini (ONNX) vs API.

**Next URLs:**
- https://eccv.ecva.net/Conferences/2026/CallForPapers
- https://openreview.net/group?id=thecvf.com/ECCV/2026/Conference
- arXiv search: `GenCaption GNM caption`

---

## 2. RSS 2026 · SuperMap spatio-temporal SLAM

| Item | Notes |
|------|--------|
| **Venue** | Robotics: Science and Systems (RSS) 2026 |
| **SuperMap** | User: *adopted spatio-temporal SLAM “SuperMap”* — multi-session / temporal map fusion class of systems (not classic single-session ORB-SLAM only). |

**MG hook:** Memory Glass already has path contrails + multi-subject zones. SuperMap-style ideas = **persistent spatial memory** across sessions (IndexedDB H4 + page tracks + face/hand paths as sparse landmarks).

**Next URLs:**
- https://roboticsconference.org/ (RSS home — confirm 2026 site)
- Search: `SuperMap spatio-temporal SLAM RSS 2026`
- Related lineage: ORB-SLAM3, DROID-SLAM, Gaussian SLAM / 3DGS mapping papers

---

## 3. Tennis AI · Shah Faisal · Tracknetics · YOLO · CatBoost · map projection · CNN homography

| Piece | Role |
|-------|------|
| **TrackNet / Tracknetics** | Ball trajectory on broadcast/court video |
| **YOLO** | Player / ball / racket detect |
| **CatBoost** | Tabular / sequence features → shot class, bounce, rally state |
| **CNN homography** | Court map projection (image → top-down) |
| **Shah Faisal** | Practitioner / author thread to follow (name match may be multi-person — verify handles) |

**MG hook:** Same *instrument* pattern as fencing tip paths: detect tip/ball → velocity ribbon → project into a canonical plane (court ≡ PAGE spatial lock). Homography = depth/page-axis cousin.

**Next URLs:**
- TrackNet papers / GitHub (original TrackNet, TrackNetV2/V3 forks)
- Search: `tennis ball tracking YOLO homography CatBoost`
- Search: `Shah Faisal tennis AI Tracknetics`

---

## 4. Bharath Kumar · Python 3D human pose estimation

| Item | Notes |
|------|--------|
| **Theme** | Practical Python 3D HPE stacks (often MediaPipe / BlazePose / VideoPose3D / MMPose tutorials and repos) |
| **Author** | Common educator name — pin exact GitHub/blog when churning Mini |

**MG hook:** Direct upgrade path for **H1 hands + face**: 2D still-pipe → 3D joints → better air pointer + pen tip depth. Prefer **offline** models on Mini (arm64).

**Next URLs:**
- Search: `Bharath Kumar 3D human pose estimation python`
- MediaPipe Pose / Holistic (already in MG face path)
- VideoPose3D, MMPose demos

---

## 5. Perceptron Egocentric API ⭐ high priority

| Item | Detail |
|------|--------|
| **What** | Turns robot / **egocentric video** → atomic manipulation events, subtask labels, **dense per-hand grounding** |
| **Hands** | Per-frame boxes, **21-keypoint skeletons**, L/R identity, hand captions (16-action taxonomy) |
| **Blog** | https://www.perceptron.inc/blog/introducing-perceptron-egocentric-api (2026-07-09) |
| **SDK** | https://github.com/perceptron-ai-inc/perceptron |
| **Site** | https://www.perceptron.inc/ · docs: https://docs.perceptron.inc |

**MG hook (strongest commercial parallel):**
- Still-pipe / phone ego-ish frames → structured hand events (vs our heuristic + MediaPipe Hands)
- Event segmentation for research packs + agent tools
- **Do not** block thrash-safe H1 on API — use as optional **heavy path** / Mini batch offline

**Next:** early access request · SDK smoke on laptop · compare 21-kpt stream vs `live-v18` hands

---

## 6. Sado Tokuyama · @tokufxag

| Item | Notes |
|------|--------|
| **Handle** | @tokufxag (X) — creative / FX / interactive vision posts |
| **GitHub hunt** | No definitive public match locked in this pass (`tokuyama-sg` is a different account). Collect post → repo links manually from X. |
| **Why** | Rhizomatiks / daito-adjacent aesthetic; interactive installations; likely WebGL / tracking experiments |

**MG action:**
```text
X: from:tokufxag filter:links
→ research.js enqueue each repo URL
→ capture README pages with ⌥⌘R
```

**Next URLs:**
- https://x.com/tokufxag
- Search GitHub: `tokufxag`, `Sado Tokuyama`, related demo reels

---

## Pack schema (for Mini)

```json
{
  "topic": "cv-2026-gencaption-supermap-tennis-ego-tokufxag",
  "sources": [],
  "quotes": [],
  "open_questions": [
    "Exact arXiv title for GenCaption + GNM head?",
    "SuperMap RSS 2026 paper PDF / code?",
    "Shah Faisal Tracknetics public repo?",
    "Perceptron Egocentric rate limits / arm64 edge?",
    "tokufxag pinned repos?"
  ],
  "next_urls": [
    "https://www.perceptron.inc/blog/introducing-perceptron-egocentric-api",
    "https://github.com/perceptron-ai-inc/perceptron",
    "https://eccv.ecva.net/",
    "https://x.com/tokufxag",
    "https://roboticsconference.org/"
  ]
}
```

---

## Suggested Mini churn order (R1)

1. **Perceptron Egocentric** blog + SDK README — capture with ⌥⌘R  
2. **TrackNet / tennis homography** classic paper + best GitHub fork  
3. **3D HPE Python** practical repo (MediaPipe Holistic lift)  
4. **X @tokufxag** — last 20 posts with links → queue  
5. **ECCV/RSS 2026** — when SuperMap / GenCaption PDFs appear, enqueue  

Spatial HUD stays optional; this pack is **research throughput**, not H1 soak.

---

## Grok follow-up prompt

> Using only sources in this pack, (1) map each thread to Memory Glass H1 hands / path contrails / still-pipe / research queue, (2) rank by implementability on Mac Mini arm64 offline vs API, (3) propose 5 concrete next_urls and 3 open experiments for hot-pipe.
