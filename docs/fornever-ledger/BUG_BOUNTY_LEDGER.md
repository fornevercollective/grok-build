# Bug Bounty / Breakage Ledger

**Purpose:** Durable list of things that break, cause issues, or are bounty-shaped (product reliability + security + fork hygiene).  
**Policy:** Notate · reproduce · fix or escalate. **Do not delete evidence or repos.**  
**Owners:** Fornever / Memory Glass / grok-build agents.  
**Last updated:** 2026-07-18

Severity: **S0** ship-blocker · **S1** high · **S2** medium · **S3** polish · **INFO** research

---

## Memory Glass (native browser)

| ID | Sev | Title | Symptom | Root / hypothesis | Mitigation / fix | Status |
|----|-----|-------|---------|-------------------|------------------|--------|
| MG-001 | S0 | Code Signature Invalid SIGKILL | Launch dies ~60ms; taskgated | Binary/Resources edit without re-sign; BUILD_STAMP in MacOS/ | `scripts/resign-app.sh`; no stamp in MacOS; post-install codesign in build-mac-app | **Mitigated** · monitor |
| MG-002 | S1 | Glass reassert AppKit crash | Freeze/crash on zoom / FS / 2nd monitor | Reassert storm + MainEventsCleared heartbeat | 400ms debounce; no reassert every zoom; no heartbeat | **Mitigated** |
| MG-003 | S1 | Synthetic click / drag crash | Nil NSApp.currentEvent | Async IPC + set_outer_position flood | Rate-limit clicks; safe drag path | **Mitigated** |
| MG-004 | S1 | Camera multi-grab thrash | LED thrash · auth flaps · spool stall | Multiple capture-stream / snap-loop | Single writer rule; mg-stop-cams; defer cam on webgrid | **Open** ops discipline |
| MG-005 | S2 | WebGrid 12 vs 30 surprise | Dense vs big cells | Viewport breakpoints + WK pageZoom ≠ Safari | mg_scale=small; viewport spoof; layout once | **Partial** |
| MG-006 | S2 | Score scrape pollution | False 10.39 / 40×40 in agent logs | Marketing copy in body text | Prefer sidebar regex only; filter phase=playing | **Open** |
| MG-007 | S2 | Agent missGuess inflation | Soft-misses while waiting for blue move | Tight wait loops count as miss | Pace advisor; separate soft-wait from real miss | **Open** |
| MG-008 | S2 | Hotpipe edit invalidates seal | App won't launch after JS copy | Sealed Resources hash | Always resign; future: post-copy hook | **Open** automation |
| MG-009 | S3 | MediaPipe CDN blocked | Hands degrade | Network / CSP | Heuristic H1 fallback | **Mitigated** |
| MG-010 | S3 | Cinema + transparent WK | Opaque toggle crash | Platform limit | CSS-only cinema | **Mitigated** |
| MG-011 | S2 | Ollama brief timeout | morning-brief fails cold start | Large model load >120s | Timeout 300s; model fallback chain | **Mitigated** |
| MG-012 | S3 | Pace advisor misreads grid | N=40 from marketing | Same as MG-006 | Fix scrape before LLM digest | **Open** |
| MG-013 | INFO | BPS mouse ≠ BCI | Inflated agent BPS | Synthetic pointer channel | Label demos; never claim implant parity | **Policy** |
| MG-014 | S2 | Spaces fullscreen glass black | Vertical 2nd screen | Layer / scale | Reassert + fill CSS; may need simple FS | **Partial** |
| MG-015 | S3 | Dock icon stale | After rebuild | LaunchServices cache | lsregister; killall Dock tip | **Known** |

### Reproduce pack (MG-001)
```bash
# DO NOT leave unsigned:
cp target/release/memory-glass "$HOME/Applications/Memory Glass.app/Contents/MacOS/"
# codesign --verify --deep --strict  → fail
# open app → SIGKILL
bash experiments/memory-glass/scripts/resign-app.sh
```

### Evidence roots
- `~/Library/Logs/MemoryGlass/launch.log`
- `~/Library/Logs/DiagnosticReports/memory-glass*`
- `~/.panda/mg-soak/run-*/soak.jsonl`
- `~/.panda/mg-soak/watch/play.jsonl`

---

## grok-build fork (xai-org upstream)

| ID | Sev | Title | Notes | Status |
|----|-----|-------|-------|--------|
| GB-001 | S2 | Fork drift from upstream | Local experiments under `experiments/`; merge carefully | **Ongoing** |
| GB-002 | S3 | Skill duplication | User / bundled / crates / lab-ship overlap | Catalogued · consolidate later |
| GB-003 | INFO | YOLO not required for MG | Always-approve only for approval spam | **Policy** |
| GB-004 | S3 | Plugin path fragility | lab-ship symlink into docs/architecture-lab | Document in ECOSYSTEM_MAP |

**Upstream:** https://github.com/xai-org/grok-build  
**Origin:** https://github.com/fornevercollective/grok-build  

---

## Still-pipe / panda / voice

| ID | Sev | Title | Notes | Status |
|----|-----|-------|-------|--------|
| PD-001 | S1 | Multiple camera writers | Only one continuous capture-stream | **Open** ops |
| PD-002 | S2 | SPOOL_STALL | Inspect meter; still-server lag | Monitor soak |
| PD-003 | S3 | Voice mute races | Prefer mute while typing | Documented |
| PD-004 | INFO | Phone still-pipe LAN | MG_STILL_BIND=0.0.0.0 on Mini | Bringup docs |

---

## Offline models (Ollama)

| ID | Sev | Title | Notes | Status |
|----|-----|-------|-------|--------|
| LLM-001 | S3 | Manifest-only tags (0 B) | Skip until pulled | Inventory |
| LLM-002 | S2 | Cold-load timeout 8B+ | Warm model before soak | Mitigated timeout/fallback |
| LLM-003 | INFO | Small model ignores scrape rules | Prefer qwen3 for brief; fix scrape | Open |

---

## Cross-project year themes (portfolio)

These are **patterns** across ~year of fornevercollective work—not accusations:

1. **Native + hot reload** — seals, codesign, inject races (MG, voice packs)  
2. **Camera exclusivity** — AVFoundation single consumer  
3. **Synthetic vs trusted input** — WebGrid pointer, game solvers  
4. **CDN / offline** — MediaPipe, models, phone vision  
5. **Fork vs product** — grok-build experiments must not break upstream mergeability  
6. **Evidence culture** — soak JSONL > vibes (competitive browser claims)

---

## Bounty-shaped work queue (for agents)

When filing a new row:

1. **ID** = PREFIX-###  
2. Minimal **repro** (commands only)  
3. **Evidence path** (log / jsonl / crash report)  
4. **Mitigation** if known  
5. Never delete repos or soak runs while investigating  

```bash
# append-only note
echo "$(date -u +%Y-%m-%d) MG-0XX title — repro: …" >> \
  docs/fornever-ledger/BUG_BOUNTY_NOTES.jsonl
```

---

## Priority for next engineering (from this ledger)

1. **MG-006 + MG-012** — score scrape truth (unblocks honest WebGrid + LLM pace)  
2. **MG-008** — auto resign on hotpipe deploy  
3. **MG-004 / PD-001** — camera single-writer guard in launch  
4. **MG-014** — glass FS second monitor soak case  
5. **GB-001** — periodic upstream merge dry-run  

---

## Related docs

- `docs/fornever-ledger/ECOSYSTEM_MAP.md`  
- `experiments/memory-glass/hotpipe/plans/OVERNIGHT_BROWSER.md`  
- `experiments/memory-glass/hotpipe/SESSION_HANDOFF.md`  
- `experiments/memory-glass/hotpipe/plans/COMPETITIVE_HARD_TRUTH.md`  
