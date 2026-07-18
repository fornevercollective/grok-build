# μgrad + WebGrid + games · training curves

## Cold launch → full ugrad

| Stage | Entry | Outcome |
|-------|-------|---------|
| **Cold** | Open Memory Glass + inspect UGRAD tab | Registry + R0 link |
| **Warm** | [μgrad R0](https://mueee.qbitos.ai/ugrad-r0.html) train one gen | loss curve · generation history |
| **Fit** | curriculum easy→hard · background worker | mastery on datasets |
| **Tensor** | R1 tensor bench | Value vs Tensor speedup |
| **Former** | gpt train (R4) | MiniGPT char path |
| **Cortical** | R5 planned + ironline + WebGrid BPS | 24ms loop language |
| **Organoid** | R6 planned | DNA parenthood scaffold only |

Local twin: `/Volumes/qbitOS/00.dev/mu.eee/web/ugrad-r0.html`  
Public: `https://mueee.qbitos.ai/ugrad-r0.html`

## WebGrid (Neuralink measurement language)

- Official: [neuralink.com/webgrid](https://neuralink.com/webgrid/)  
- Score: **bits per second (BPS)** from net correct targets / grid size  
- μgrad twin: `webgrid-ugrad.html` · games registry id `webgrid`  
- **MG H9 scaffold:** pointer BPS meter in inspect (training curve for air pointer / pen / mouse)

Use WebGrid as:

1. Baseline human / BCI-shaped control bandwidth  
2. Calibration for H1 hands / H2 pen gain  
3. Competitive fitness vs other MG seats (collab leaderboard later)

## Games hub (learning paths)

Hub: `https://mueee.qbitos.ai/games` (and local `mu.eee/web/*-ugrad.html`)

Registry: `concepts/ugrad-game-registry.js` → strategy / arcade / cards / training / core lanes.

| Lane | Examples | Tensor? |
|------|----------|---------|
| core | ugrad-r0, pad, model, contrail | yes |
| strategy | go, chess, webgrid, mahjong | some |
| training | memory, flashcards, math, language, typing | no |
| arcade | snake, pong, visualspeed, cupstack | no |

## Runtime API (`ugrad-ladder.js`)

```js
window.__mgUgrad = {
  level: 0..6,              // U0–U6
  openR0(),                 // tab to ugrad-r0
  openWebGrid(),            // neuralink + ugrad twin
  openGames(),              // hub
  bps: { ntpm, grid, bps }, // live training meter
  report(),
};
```

## Integration rules

- Open external/local URLs in **new MG tabs** (IPC) when possible; fallback `window.open`.  
- Never pull full μgrad training into the main PAGE event loop.  
- Still-pipe ego batch remains the on-device vision training path.  
