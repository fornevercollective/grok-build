# Research pack · Company vision training pipeline

_xAI · Grok · Tesla robot · SpaceX — not perception-only_

## Train loop (Memory Glass)

```
still-pipe / page browse
  → capture (⌥⌘R / PIPE CAP)
  → ego batch optional (EGO REC) + hand taxonomy
  → research pack EXPORT
  → Grok summarize + next_urls JSON
  → GROK← enqueue
  → NEXT / CHURN
  → repeat  (Mini unattended)
```

## Clusters

| Cluster | Seed tab | Focus |
|---------|----------|--------|
| **CORP** | PIPE → CORP | x.ai, Grok, Tesla AI/Optimus, SpaceX stack |
| **ROBOT** | PIPE → ROBOT | VLA / humanoid / ego manipulation data |
| **SPACEX** | PIPE → SPACEX | Starship / ops visual / cool-test reading |
| **PERCEPT** | PIPE → PERCEPT | Perceptron hands, GenCaption, SuperMap, TrackNet |

## Pack fields for training flywheel

- `sources[]` — web/docs captures  
- `ego_events[]` — atomic hand actions (local taxonomy)  
- `ego_batch` — still-pipe frame dirs under `~/.panda/vision/ego/`  
- `open_questions[]` / `next_urls[]` — Grok-driven curriculum  

## Grok prompt (paste with EXPORT)

> You are training-data curator for a company vision stack (xAI Grok agents + Tesla-class robot ego + SpaceX ops reading).  
> Using only the pack: (1) summarize what we can label/train from sources+ego_events, (2) gaps vs Optimus/FSD/Grok multimodal, (3) return JSON only:  
> `{"next_urls":[],"open_questions":[],"notes":"","train_slice":"ego|web|ops"}`
