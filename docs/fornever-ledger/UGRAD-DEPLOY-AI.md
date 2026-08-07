# μgrad Live 1.0 → ugrad.ai deploy

**Product:** `ugrad.live` · **Version:** `1.0.0` · **Current rung:** **R4** (μformer)  
**R0 is retired.** Canonical page: **`ugrad.html`**. `ugrad-r0.html` redirects only.

## Open now

| Surface | URL |
|---------|-----|
| **Local** | `http://127.0.0.1:8765/ugrad.html` |
| **Hub** | `http://127.0.0.1:8765/ugrad-hub.html` |
| **Deploy target** | `https://ugrad.ai/ugrad.html` |
| **Legacy R0** | `…/ugrad-r0.html` → redirects to Live |

## Identity

| Field | Value |
|-------|-------|
| `UGRAD.R` | **4** |
| `UGRAD.version` | **1.0.0** |
| `UGRAD.product` | **ugrad-live** |
| State keys | `ugrad-live-state` · `ugrad-live-checkpoints` |
| Bridge | `ugrad-bridge-v3-live` |

Staircase R0–R3 remain **foundation history** inside the product; the **product is not R0**.

## Modules

| File | Role |
|------|------|
| `ugrad.html` | Live terminal (canonical) |
| `ugrad-r0.html` | Redirect shim |
| `ugrad-platform.js` | mobile/IoT/XR/pool + WebKit probe |
| `ugrad-tensor-v2.js` | modern tensor model card |
| `ugrad-quantum-live.js` | composer live iteration |
| `ugrad-dojo-bg.js` | MG/DOJO background tool |
| `ugrad-colossus.js` | pack product=`ugrad.live` |

## Deploy checklist

1. Publish `uvspeed/web/` including **`ugrad.html`** (not only r0 shim)
2. Prefer `https://ugrad.ai/ugrad.html` as primary link
3. Keep `ugrad-r0.html` redirect for old bookmarks
4. Smoke: `status` shows **Live · R4 · v1.0.0** · `platform` · `tensor v2` · `qlive once` · `dojo bg`
5. Hotpipe MG bridge v4-live → Resources + ⌘⇧R

## Safety

- Boot auto-train **off** (`?auto=1` to enable)
- No fleet hard-nav thrash
- `qlive` interval ≥ 15s
