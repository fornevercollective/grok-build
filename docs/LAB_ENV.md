# Lab environment · grok-build + experiments + external tools

One plane for **Memory Glass**, **fcs**, **XR glasses**, **/web hygiene**, **desktop-harness**, **Quill**, and **xAI upstream pins**.

## Quick doctor

```bash
bash scripts/mg-lab-env.sh doctor
bash scripts/mg-lab-env.sh onboard
```

## Planes

| Plane | Entry | Role |
|-------|--------|------|
| **Browser shell** | Memory Glass.app · hotpipe | Native WKWebView craft |
| **/web + hygiene** | `fcs web` · `mg-web.sh` · `/web` | Multi-browser DevTools · Safari zombie patch |
| **XR glasses** | `mg-xr-dev.sh auto` · `:8787` | Multi-seat optics · WebXR · agent for-ai |
| **Media wall** | `fcs watch|cam|clock|map|…` | Live demux suite |
| **Hub** | https://fcs.ugrad.ai/ | Skills · download · lang bridges |
| **Hands** | `desktop-harness` ([xfreeze2](https://github.com/xfreeze2/desktop-harness)) | AX-first Mac GUI control for agents |
| **Voice** | Quill ([xfreeze2](https://github.com/xfreeze2/quill)) | Dictation into any field via Grok STT |
| **Upstream** | `SOURCE_REV` + path-checkout | xai-org/grok-build product tree (no merge) |

## Install external tools

```bash
bash scripts/install-desktop-harness.sh
bash scripts/install-quill.sh
desktop-harness --doctor
desktop-harness daemon start --bg
open -a Quill
```

## Field trigger loop (competitive)

```
random glitch (Safari * download, paste garbage, …)
  → __mgJobHygiene.learn({ kind })
  → rule / mitigation
  → /web learn
  → COMPETITIVE_BROWSERS wedge
```

Shipped rules (job-hygiene **v2**):

| Safari / field class | MG rule |
|----------------------|---------|
| `*` / empty filename | Reject |
| Preparing forever | 8s TTL |
| Cancel dead | Cancel always |
| Terminal paste garbage | Sanitize + reject star |
| Multi-line paste + buried URL | Prefer URL |
| Blob download storms | Rate-limit spool |
| Reload mid-download | Fail open jobs |
| iframe download flood | Rate-limit |

## Upstream xAI (forks / updates)

GitHub “N commits behind” is **normal** (unrelated histories). Trust pin:

```bash
cat SOURCE_REV
git fetch upstream
./scripts/sync-upstream-path-checkout.sh upstream/main
# review, commit, push origin
```

Do **not** `git merge upstream/main`. Policy: `docs/FORK_SYNC.md`.

## Agent / multi-CLI

| Agent | Path |
|-------|------|
| Any terminal | `fcs web` · `fcs hygiene` · `fcs install agents` |
| Grok MG term | `/web` · `/hygiene` · `/xr` patterns |
| Dispatch | `mgd web` · `mgd hygiene` · `mgd xr` |
| Claude | `/fc-web` · media suite packs |
| Lab snapshot | `~/.panda/lab-env/LATEST.json` |

## Ports (never Soft Path)

| Port | Use |
|------|-----|
| **8787** | MG PWA · XR · glyph arena |
| **8790** | fcs local hub / benches |
| **8765/8766** | Soft Path only — do not bind |
