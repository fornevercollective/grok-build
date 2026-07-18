# Competitive browser plan · Memory Glass

**Stance:** compete on *speed + glass + spatial/cognitive training*, not feature-parity with full browsers.

## Peer map

| Browser | Engine | Strength | Our response |
|---------|--------|----------|--------------|
| **Safari** | WebKit | OS integration, efficiency, privacy | **Same engine** (WKWebView) · add droplet glass + spatial HUD Safari lacks |
| **Chrome** | Blink | ecosystem, DevTools, speed of iteration on web | Hot-pipe 1s inject · no Chromium process tax · native shell |
| **Firefox** | Gecko + Rust pieces | privacy, multiproc | Learn multiproc isolation (H7 path) · keep WK for macOS |
| **Ladybird** | from-scratch | purity, modern browser building | Inspiration for clean architecture; we stay WK-hosted for ship speed |
| **Servo** | Rust layout | research engine | Watch for embeddable layout; not near-term swap |
| **Electron apps** | Chromium + Node | ship web UIs fast | **Anti-goal** — heavier than us by design |
| **Orion / Arc / Dia** | WebKit/Chromium shells | UX chrome | Compete on glass aperture + training loops |

## Wedges (what we win on)

1. **Transparent droplet shell** — Drop/Glow soft lip, cinema/page/depth modes.  
2. **Inspect dual-window spatial instrument** — face/hands/pen/GSPLAT without PAGE thrash.  
3. **Hot-pipe** — live.js reload without cargo rebuild.  
4. **Training curves** — WebGrid BPS, μgrad R0→R6, games hub as *browser fitness*.  
5. **Ironline budgets** — explicit L0–L7 latency contracts (browsers hide this).  
6. **Collab mesh** — multi-agent packs + conversation + still-pipe snapshots.

## What we refuse (for now)

- Full extension store  
- Multiprocess site isolation product claim (H7 is scaffold)  
- Cross-platform Windows/Linux parity before macOS excellence  
- Replacing WebKit with Servo/Ladybird in product path  

## Milestones

| Phase | Outcome |
|-------|---------|
| **Now** | Soft glass + inspect + phone + H0–H9 scaffold + ironline/ugrad hooks |
| **P1** | Documented BPS/HUD budget dashboard in inspect strip |
| **P2** | Collab mesh multi-seat research sessions |
| **P3** | Optional multiproc track isolation (true H7) |
| **P4** | Evaluate Servo/Ladybird components only if WK blocks a hard requirement |

## Metrics (competitive scoreboard)

| Metric | Target | Measure |
|--------|--------|---------|
| Shell process count | 1 primary + optional inspect | Activity Monitor |
| Hot-pipe inject latency | &lt;1s after save | mtime inject |
| HUD frame path | EMA ≤16ms | H6 strip |
| WebGrid training | improving BPS session-over-session | H9 / ugrad-ladder |
| Cold launch to first paint | competitive with Safari simple page | stamp logs |
