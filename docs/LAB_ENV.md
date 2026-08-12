# Lab environment · fornevercollective

One plane for **Memory Glass**, **fcs**, **XR glasses**, **/web hygiene**, **suite hands**, **suite voice** (`/mic` · `/chat`), and **upstream pins**.

## Quick doctor

```bash
bash scripts/mg-lab-env.sh doctor
bash scripts/mg-lab-env.sh onboard
```

## Planes

| Plane | Entry | Role |
|-------|--------|------|
| **Browser shell** | Memory Glass.app · hotpipe | Native WKWebView craft |
| **/web + hygiene** | `fcs web` · `mg-web.sh` · `/web` | Multi-browser DevTools · zombie download patch |
| **XR glasses** | `mg-xr-dev.sh auto` · `:8787` | Multi-seat optics · WebXR · agent for-ai |
| **Media wall** | `fcs watch\|cam\|clock\|map\|…` | Live demux suite |
| **Hub** | https://fcs.ugrad.ai/ | Skills · download |
| **Hands** | `fcs hands` · `/hands` | Agent Mac GUI control for lab desks |
| **Voice** | `fcs mic` · `fcs chat` | Mic→whisper→inbox · inbox→Grok→speak |
| **Upstream** | `SOURCE_REV` + path-checkout | Product tree pin (no merge) |

## Install suite tools

```bash
bash scripts/install-hands.sh
bash scripts/install-voice.sh
fcs hands
fcs mic
fcs chat
```

## Field trigger loop

```
random glitch (Safari * download, paste garbage, …)
  → __mgJobHygiene.learn({ kind })
  → rule / mitigation
  → /web learn
  → competitive wedge
```

Job-hygiene rules: reject `*` · prepare TTL · cancel always · paste sanitize · blob/iframe flood limits.

## Upstream product tree

```bash
cat SOURCE_REV
git fetch upstream
./scripts/sync-upstream-path-checkout.sh upstream/main
```

Do **not** `git merge upstream/main`. Policy: `docs/FORK_SYNC.md`.

## Ports (never Soft Path)

| Port | Use |
|------|-----|
| **8787** | MG PWA · XR · glyph arena |
| **8790** | fcs local hub / benches |
| **8765/8766** | Soft Path only — do not bind |

## Upstream pin (last path-checkout)

| | |
|--|--|
| **When** | 2026-08-12 |
| **SOURCE_REV** | `ea094a8c369475f97c85540d01730baec0dce5d6` |
| **upstream/main** | `e5fd4816` |
| **Verify** | `./scripts/verify-upstream-sync.sh` |
| **Pages** | https://fornevercollective.github.io/grok-build/ |

