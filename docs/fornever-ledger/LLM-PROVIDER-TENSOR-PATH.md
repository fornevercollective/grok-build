# LLM providers (beyond Ollama) · Tensor iteration path

**Audience:** Memory Glass · ugrad-r0 · SpaceXAI / xAI Grok growth  
**Date:** 2026-07-26

---

## 1. Why not “Ollama only”

Ollama is excellent for **offline + speed + privacy**. It is not the growth path for:

- Flagship reasoning / agentic code (Grok 4.5 class)
- Product features that must match **SpaceXAI / xAI** stack
- Cloud scale, tool-calling, enterprise keys

**Rule (build-with-ai skill):** default product AI → **SpaceXAI** (`XAI_API_KEY` + `https://api.x.ai/v1`).  
Local stays the **fallback / air-gap / low-latency** lane.

---

## 2. Provider map (OpenAI-compatible spine)

Everything that speaks **OpenAI chat completions** is one code path.

| Profile | When | Base | Model (override) | Key |
|---------|------|------|------------------|-----|
| **local_fast** | Teleprompter, status, loops | `http://127.0.0.1:11434` | `llama3.2:1b` | — |
| **local_quality** | Offline briefs | Ollama | `qwen3:8b` | — |
| **local_reason** | Postmortems | Ollama | `deepseek-r1:7b` | — |
| **xai_fast** | Interactive MG / ugrad cloud | `https://api.x.ai/v1` | `grok-4-1-fast-non-reasoning` (or current fast alias) | `XAI_API_KEY` |
| **xai_flagship** | Hard code / agent | `https://api.x.ai/v1` | `grok-4.5` | `XAI_API_KEY` |
| **open_v1** | LM Studio / vLLM / custom | `http://127.0.0.1:1234/v1` | deploy-specific | optional |

**SpaceXAI naming:** product name **SpaceXAI**; real API is **xAI** — use `XAI_API_KEY` and `api.x.ai` verbatim (do not invent `SPACEXAI_*` hosts).

```bash
# Status
python3 experiments/memory-glass/scripts/mg_llm_router.py status

# Offline
python3 …/mg_llm_router.py chat "hello" --provider ollama --fast

# SpaceXAI / Grok (key in env only)
export XAI_API_KEY=…
python3 …/mg_llm_router.py chat "hello" --provider xai --fast
python3 …/mg_llm_router.py chat "design tensor stair" --provider xai
```

Browser: `ug-llm-router.js` + profiles; **never** put API keys in page bundles — use `sessionStorage` inject only for dev, or a same-origin proxy.

---

## 3. Growth path (iterate without rewrites)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Ollama 1b   │ ──► │ Ollama 8b/reason │ ──► │ xAI Grok fast   │
│ air-gap UI  │     │ offline quality  │     │ product default │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │ Grok 4.5 flagship│
                                              │ agents · tools   │
                                              └────────┬────────┘
                                                       │
                              ┌────────────────────────┴──────────┐
                              ▼                                   ▼
                     open_v1 (vLLM custom)              Colossus / cloud train
```

**Swap cost:** change `MG_LLM_PROVIDER` / profile name — same `chat()` API.

**Future hooks (already OpenAI-shaped):**

- Streaming (`stream: true`) for prompter typewriter  
- Tool calling for MG dispatch / letter-grid MCP  
- Embeddings: Ollama `nomic-embed-text` now; xAI embeddings when needed  
- Batch: uvspeed `telemetry.js` xAI batch path  

---

## 4. Tensor revamp — how to iterate further

### Today (R0–R4 on ugrad)

| Level | Capability | Command / module |
|-------|------------|------------------|
| R0 | Scalar autograd Value/MLP | `train` / `evolve` |
| R1 | Float32Array Tensor · matmul · TMLP | `tensor` bench |
| R2 | Adam · xent | MiniGPT train path |
| R3 | Embedding · LayerNorm | attention-ready |
| R4 | Transformer · MiniGPT | `gpt train` / `gpt gen` |
| Bus | `__ugradTensorLast` · `tensorIntegrate` | MG `__mgUgradTerm` |

### Stair U0→U6 (μgrad ladder) — next iterations

| Step | Goal | Concrete work |
|------|------|----------------|
| **T1** | Instrumented tensor | Persist last bench: ms_value, ms_tensor, speedup, arch, dataset → `localStorage` + export JSON |
| **T2** | Train in tensor space | Option `train tensor` — use TMLP+Adam on current dataset (not only forward bench) |
| **T3** | WASM / SIMD path | Load existing WASM matmul when present; report 3-way Value/Tensor/WASM |
| **T4** | WebGPU optional | Feature-detect; matmul on GPU for N≥256; fallback CPU |
| **T5** | MG stack fusion | `tensorIntegrate` → `__mgQbitStack` trajectory + DATA bench strip + WebGrid BPS side-by-side |
| **T6** | Steno + tensor | After train, auto `steno` weights; utilization in panel |
| **T7** | LLM-on-tensor | Offline/xAI: “explain this speedup” from `__ugradTensorLast` via router |
| **T8** | Colossus export | `export tensor` → Float32 weights + meta for Dojo/Colossus pipe |

### Suggested command surface (add incrementally)

```
tensor                 # bench (done)
tensor train [epochs]  # T2
tensor wasm            # T3
tensor gpu             # T4
tensor integrate       # T5 (MG)
tensor explain         # T7 llm router
export tensor          # T8
```

### Metrics that force non-stagnant loops

Each iteration must move **one** of:

1. Speedup number (Value vs Tensor vs WASM)  
2. Accuracy / loss on fixed dataset seed  
3. Latency p50 of `llm` path (local vs xai_fast)  
4. End-to-end MG: open R0 → tensor → prompt llm → export  

Record in `~/.panda/dispatch/LEARNINGS.md` (loop-iterate skill).

---

## 5. Architecture: one router, two runtimes

```
                    ┌──────────────────────────┐
   ugrad terminal   │  UG_LLM / UgLlmRouter     │
   MG prompt llm    │  profiles · no secrets    │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
         Ollama HTTP        same-origin         (optional)
         :11434             MG proxy :8766      inject key
                                 │
                                 ▼
                    ┌──────────────────────────┐
   Python / soak    │  mg_llm_router.py         │
   dispatch / γ     │  auto: xai → open → ollama│
                    └──────────────────────────┘
```

**Security:** browser never ships long-lived `XAI_API_KEY`. Prefer:

1. Local Ollama for on-page `llm` / `prompt llm`  
2. Python/MG scripts for Grok when cloud needed  
3. Future: tiny authenticated proxy on localhost  

---

## 6. Immediate next actions

| # | Action | Owner lane |
|---|--------|------------|
| 1 | Wire `ug-llm-router.js` into ugrad-r0 after `UG_LLM` | uvspeed |
| 2 | `llm profile xai_fast` only when key via session inject | uvspeed |
| 3 | Implement `tensor train` (T2) | ugrad R1+ |
| 4 | MG drawer: show last tensor speedup + llm provider | hotpipe |
| 5 | Deploy ugrad-r0 to mueee after local green | ops |
| 6 | Dispatch: `mg_llm_router.py ping --provider auto` in γ | panda |

---

## 7. References

- SpaceXAI / xAI API: https://docs.x.ai · https://api.x.ai/v1  
- Models: https://docs.x.ai/developers/models (re-fetch; names change)  
- Skill: `build-with-ai` (default SpaceXAI)  
- Local: `mg_local_llm.py` · `mg_llm_router.py` · `ug-llm-router.js`  
- Tensor: ugrad-r0 R1 `Tensor`/`TMLP` · `tensorIntegrate` · PERSONA_TENSOR_PATH.md  
