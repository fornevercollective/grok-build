// Sender: dual-layer optical TX (mix + fountain QR)
//
// mix  = live pipe (/watch bloomberg via mix-pipe · webcam · screen)
// TX   = fountain QR at TV fuzz rates
// out  = composite
//
// Default composite **broadcast**: full 16:9 mix, TX only in isolates
// (lower-third · pillars · bug), talent occluded (mask / heuristic oval).
// Finders live in chrome regions — not on faces.

import QRCode from "qrcode";
import { LTEncoder } from "../shared/fountain";
import { HEADER_LEN, fnv1a, packFrame, type FrameHeader } from "../shared/protocol";
import {
  DEFAULT_REGIONS,
  fetchRegions,
  loadMaskImage,
  makeOccludeFromMask,
  paintQrInRect,
  pixelBox,
  txRegions,
  type RegionsDoc,
} from "./broadcast";
import {
  LOGO_SPHERE_BOX,
  drawStrobeSphere,
  type StrobeMode,
  type StrobeOpts,
  type StrobeShape,
} from "./strobe";

const MARGIN = 4;

function lookaheadFor(fps: number): number {
  if (fps >= 50) return 10;
  if (fps >= 29) return 6;
  return 3;
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

const canvas = $("qr") as HTMLCanvasElement;
const mixVideo = $("mix-video") as HTMLVideoElement;
const specs = $("specs") as HTMLElement;
const cfgPayload = $("cfg-payload") as HTMLSelectElement;
const cfgFps = $("cfg-fps") as HTMLSelectElement;
const cfgField = $("cfg-field") as HTMLSelectElement | null;
const cfgBytes = $("cfg-bytes") as HTMLSelectElement;
const cfgEcc = $("cfg-ecc") as HTMLSelectElement;
const cfgSize = $("cfg-size") as HTMLInputElement;
const cfgMix = $("cfg-mix") as HTMLSelectElement | null;
const cfgMixUrl = $("cfg-mixurl") as HTMLInputElement | null;
const cfgComp = $("cfg-comp") as HTMLSelectElement | null;
const cfgMixStr = $("cfg-mixstr") as HTMLInputElement | null;
const cfgTxStr = $("cfg-txstr") as HTMLInputElement | null;
const cfgBleed = $("cfg-bleed") as HTMLInputElement | null;
const mixHint = $("mix-hint") as HTMLElement | null;

const payloadCache = new Map<string, Uint8Array>();
let generation = 0;
let mixStream: MediaStream | null = null;
/** Active mix source for the running stream. */
let mixKind: "none" | "demo" | "camera" | "display" | "watch" = "watch";
/** Latest JPEG from mix-pipe (/watch bloomberg stream). */
const mixPipeImg = new Image();
let mixPipeReady = false;
let mixPipeTimer: number | null = null;
let mixPipeUrl = "http://127.0.0.1:8790/mix.jpg";

type FieldLook = "progressive" | "interlace" | "snow";
type Composite =
  | "broadcast"
  | "underlay"
  | "multiply"
  | "soft"
  | "stack"
  | "pip";

let regionsDoc: RegionsDoc | null = null;
let maskImg: HTMLImageElement | null = null;
let maskPullAt = 0;
/** One-shot quick burst end time (ms). */
let strobeBurstUntil = 0;

function fpsLabel(fps: number): string {
  if (Math.abs(fps - 29.97) < 0.02) return "29.97 NTSC";
  if (Math.abs(fps - 59.94) < 0.02) return "59.94 field";
  return `${fps} FPS`;
}

async function loadPayload(url: string): Promise<Uint8Array | null> {
  const hit = payloadCache.get(url);
  if (hit) return hit;
  // public/ assets are at site root in Vite
  const candidates = [url, url.replace(/^\.\.\//, "/"), "/success.png"];
  for (const u of candidates) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > 0) {
        payloadCache.set(url, bytes);
        return bytes;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function stopMix() {
  try {
    mixStream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  mixStream = null;
  if (mixVideo) {
    mixVideo.srcObject = null;
  }
  if (mixPipeTimer != null) {
    clearInterval(mixPipeTimer);
    mixPipeTimer = null;
  }
  mixPipeReady = false;
}

/** Poll mix-pipe JPEG (same stream as /watch bloomberg → ffplay). */
function startWatchPipeMix(url?: string): void {
  stopMix();
  mixPipeUrl = (url || cfgMixUrl?.value || "http://127.0.0.1:8790/mix.jpg").trim();
  if (cfgMixUrl) cfgMixUrl.value = mixPipeUrl;
  mixKind = "watch";
  if (cfgMix) cfgMix.value = "watch";
  mixPipeImg.crossOrigin = "anonymous";
  const pull = () => {
    // cache-bust so we get the latest frame from mix-pipe
    const u = mixPipeUrl + (mixPipeUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => {
      mixPipeImg.src = probe.src;
      mixPipeReady = true;
      if (mixHint) {
        mixHint.innerHTML =
          `mix-pipe live · <code>${mixPipeUrl}</code> · same stream as /watch popout ffplay`;
      }
    };
    probe.onerror = () => {
      mixPipeReady = false;
      if (mixHint) {
        mixHint.innerHTML =
          `✗ no mix-pipe at <code>${mixPipeUrl}</code> — run: ` +
          `<code>bash scripts/live-demux/optical-transfer/mix-pipe.sh bloomberg</code>`;
      }
    };
    probe.src = u;
  };
  pull();
  mixPipeTimer = window.setInterval(pull, 66); // ~15 fps match mix-pipe
}

async function startCameraMix(): Promise<void> {
  stopMix();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia unavailable (need https / secure context)");
  }
  mixStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  mixVideo.srcObject = mixStream;
  mixVideo.muted = true;
  mixVideo.playsInline = true;
  await mixVideo.play();
  mixKind = "camera";
  if (cfgMix) cfgMix.value = "camera";
}

async function startDisplayMix(): Promise<void> {
  stopMix();
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("getDisplayMedia unavailable");
  }
  mixStream = await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    video: true,
  });
  mixVideo.srcObject = mixStream;
  mixVideo.muted = true;
  mixVideo.playsInline = true;
  await mixVideo.play();
  mixKind = "display";
  if (cfgMix) cfgMix.value = "display";
  mixStream.getVideoTracks()[0]?.addEventListener("ended", () => {
    mixKind = "demo";
    if (cfgMix) cfgMix.value = "demo";
  });
}

/** Bloomberg-ish animated color field (always works — no permissions). */
function paintDemoMix(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0b1520");
  g.addColorStop(0.5, "#153248");
  g.addColorStop(1, "#1a1230");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // lower-third
  ctx.fillStyle = "#c41e3a";
  ctx.fillRect(0, h * 0.76, w, h * 0.09);
  ctx.fillStyle = "#0a3d6b";
  ctx.fillRect(0, h * 0.85, w, h * 0.15);

  // ticker blocks
  const scroll = ((t * 90) % (w + 240)) - 120;
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = i % 2 === 0 ? "#f0c040" : "#2ecc71";
    ctx.fillRect(scroll + i * 95, h * 0.88, 72, h * 0.08);
  }
  ctx.globalAlpha = 1;

  // soft “head” blob with slow hue drift
  const cx = w * 0.3;
  const cy = h * 0.4;
  const hue = (t * 22) % 360;
  const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.24);
  rg.addColorStop(0, `hsla(${hue}, 42%, 64%, 0.95)`);
  rg.addColorStop(0.55, `hsla(${(hue + 50) % 360}, 38%, 32%, 0.65)`);
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // chart bars
  for (let i = 0; i < 9; i++) {
    const bh = h * (0.1 + 0.38 * (0.5 + 0.5 * Math.sin(t * 1.9 + i * 0.7)));
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = i % 2 ? "#3d9eff" : "#ff6b4a";
    ctx.fillRect(w * 0.52 + i * (w * 0.048), h * 0.62 - bh, w * 0.034, bh);
  }
  ctx.globalAlpha = 1;

  // headline plate
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(w * 0.48, h * 0.12, w * 0.46, h * 0.08);
}

function drawMixCover(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
): void {
  if (mixKind === "none") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // /watch bloomberg stream via mix-pipe (ffplay sibling)
  if (mixKind === "watch") {
    if (mixPipeReady && mixPipeImg.naturalWidth > 0) {
      const vw = mixPipeImg.naturalWidth;
      const vh = mixPipeImg.naturalHeight;
      const s = Math.max(w / vw, h / vh);
      const dw = vw * s;
      const dh = vh * s;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      try {
        ctx.drawImage(mixPipeImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      } catch {
        paintDemoMix(ctx, w, h, t);
      }
      // slight color variation wash
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = `hsla(${(t * 35) % 360}, 70%, 50%, 1)`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      return;
    }
    // waiting for mix-pipe — still show demo so TX keeps moving
    paintDemoMix(ctx, w, h, t);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, h * 0.42, w, h * 0.16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffb257";
    ctx.font = `${Math.max(12, (w / 28) | 0)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("waiting for mix-pipe bloomberg…", w / 2, h * 0.5);
    ctx.fillStyle = "#9a8f76";
    ctx.font = `${Math.max(10, (w / 36) | 0)}px monospace`;
    ctx.fillText("bash mix-pipe.sh bloomberg", w / 2, h * 0.56);
    return;
  }

  const live =
    (mixKind === "camera" || mixKind === "display") &&
    mixVideo &&
    mixVideo.readyState >= 2 &&
    mixVideo.videoWidth > 0;

  if (live) {
    const vw = mixVideo.videoWidth;
    const vh = mixVideo.videoHeight;
    const s = Math.max(w / vw, h / vh);
    const dw = vw * s;
    const dh = vh * s;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(mixVideo, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = `hsla(${(t * 40) % 360}, 80%, 55%, 1)`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    return;
  }
  paintDemoMix(ctx, w, h, t);
}

async function main() {
  if (!canvas || !specs) {
    console.error("[decimen] missing #qr or #specs");
    return;
  }

  const onRestart = () => void startStream();
  for (const el of [cfgPayload, cfgFps, cfgField, cfgBytes, cfgEcc, cfgSize, cfgComp]) {
    el?.addEventListener("change", onRestart);
  }

  $("btn-watch")?.addEventListener("click", () => {
    startWatchPipeMix();
    // try to kick shell if user has agent — just show hint
    if (mixHint) {
      mixHint.innerHTML =
        `starting watch pipe… if empty run: ` +
        `<code>bash scripts/live-demux/optical-transfer/mix-pipe.sh bloomberg</code>`;
    }
    onRestart();
  });
  $("btn-burst")?.addEventListener("click", () => {
    strobeBurstUntil = performance.now() + 900; // ~0.9s rapid train
  });
  // keyboard: B = quick burst, G = glow mode, S = strobe mode
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "b" || e.key === "B") {
      strobeBurstUntil = performance.now() + 900;
    }
    if (e.key === "g" || e.key === "G") {
      const el = $("cfg-strobe") as HTMLSelectElement | null;
      if (el) el.value = "glow";
    }
    if (e.key === "f" || e.key === "F") {
      const el = $("cfg-strobe") as HTMLSelectElement | null;
      if (el) el.value = "strobe";
    }
  });
  $("btn-pipe")?.addEventListener("click", () => {
    void startDisplayMix()
      .then(onRestart)
      .catch((e) => {
        specs.textContent = `✗ screen mix: ${e instanceof Error ? e.message : e}`;
      });
  });
  $("btn-cam")?.addEventListener("click", () => {
    void startCameraMix()
      .then(onRestart)
      .catch((e) => {
        specs.textContent = `✗ camera mix: ${e instanceof Error ? e.message : e}`;
      });
  });

  cfgMix?.addEventListener("change", () => {
    const v = cfgMix.value;
    if (v === "watch") {
      startWatchPipeMix();
      onRestart();
      return;
    }
    if (v === "display") {
      void startDisplayMix()
        .then(onRestart)
        .catch((e) => {
          specs.textContent = `✗ ${e instanceof Error ? e.message : e} — using demo mix`;
          cfgMix.value = "demo";
          mixKind = "demo";
          onRestart();
        });
      return;
    }
    if (v === "camera") {
      void startCameraMix()
        .then(onRestart)
        .catch((e) => {
          specs.textContent = `✗ ${e instanceof Error ? e.message : e} — using demo mix`;
          cfgMix.value = "demo";
          mixKind = "demo";
          onRestart();
        });
      return;
    }
    stopMix();
    mixKind = v === "none" ? "none" : "demo";
    onRestart();
  });
  cfgMixUrl?.addEventListener("change", () => {
    if (mixKind === "watch" || cfgMix?.value === "watch") {
      startWatchPipeMix(cfgMixUrl.value);
      onRestart();
    }
  });

  const q = new URLSearchParams(location.search);
  if (q.get("fps") && cfgFps?.querySelector(`option[value="${q.get("fps")}"]`)) {
    cfgFps.value = q.get("fps")!;
  }
  if (q.get("mix") && cfgMix) cfgMix.value = q.get("mix")!;
  if (q.get("comp") && cfgComp) cfgComp.value = q.get("comp")!;
  if (q.get("mixurl") && cfgMixUrl) cfgMixUrl.value = q.get("mixurl")!;

  const wantRaw = (cfgMix?.value || "watch").toLowerCase();
  if (wantRaw === "watch" || wantRaw === "bloomberg") {
    startWatchPipeMix();
  } else if (wantRaw === "camera" || wantRaw === "display") {
    // Don't auto-prompt permissions on load.
    mixKind = "demo";
    if (cfgMix) cfgMix.value = "demo";
  } else {
    mixKind = wantRaw === "none" ? "none" : "demo";
  }

  try {
    await startStream();
  } catch (e) {
    specs.textContent = `✗ start failed: ${e instanceof Error ? e.message : e}`;
    console.error(e);
  }
  try {
    await (
      navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<unknown> } }
    ).wakeLock?.request("screen");
  } catch {
    /* ok */
  }
}

async function startStream() {
  const gen = ++generation;
  specs.textContent = "loading payload…";

  const payload = await loadPayload(cfgPayload?.value || "/success.png");
  if (!payload) {
    specs.textContent = "✗ payload missing — open via Vite (decimen.sh dev), need /success.png";
    return;
  }
  if (gen !== generation) return;

  const txFps = Number(cfgFps?.value) || 29.97;
  const fieldLook = (cfgField?.value as FieldLook) || "progressive";
  const frameBytes = Number(cfgBytes?.value) || 1465;
  const ecc = (cfgEcc?.value as "L" | "M" | "Q" | "H") || "L";
  const displayPx = Number(cfgSize?.value) || 960;
  const lookAhead = lookaheadFor(txFps);
  let comp = (cfgComp?.value as Composite) || "broadcast";

  document.body.classList.toggle("tv-interlace", fieldLook === "interlace");
  document.body.classList.toggle("tv-snow", fieldLook === "snow");
  document.body.classList.toggle("has-mix", mixKind !== "none");
  document.body.classList.toggle("broadcast-mode", comp === "broadcast");

  // Pull regions + talent mask from mix-pipe (same host as mix.jpg)
  const mixBase = (cfgMixUrl?.value || "http://127.0.0.1:8790/mix.jpg").replace(
    /\/mix\.jpe?g.*$/i,
    "",
  );
  void fetchRegions(mixBase + "/regions.json").then((d) => {
    regionsDoc = d;
  });
  void loadMaskImage(mixBase + "/mask.png").then((im) => {
    maskImg = im;
  });

  const sessionId = (Math.floor(Math.random() * 0xffff) + 1) & 0xffff;
  const blockLen = Math.max(1, frameBytes - HEADER_LEN);
  const encoder = new LTEncoder(payload, blockLen, sessionId);
  const header: FrameHeader = {
    sessionId,
    seq: 0,
    k: encoder.k,
    blockLen,
    totalLen: payload.length,
    payloadFnv: fnv1a(payload),
  };

  let version: number | undefined;
  let scale = 1;
  const staging = document.createElement("canvas"); // QR modules (1px per module)
  const queue: ImageData[] = []; // store raw QR ImageData (B/W modules)
  let nextSeq = 0;
  let fieldParity = 0;
  const t0 = performance.now();

  /** 16:9 broadcast canvas (not square QR board). */
  const layoutOutput = () => {
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(
      0.92 * window.innerWidth,
      displayPx,
      0.92 * window.innerHeight * (16 / 9),
    );
    const cssH = cssW * (9 / 16);
    const pxW = Math.max(320, Math.floor(cssW * dpr));
    const pxH = Math.max(180, Math.floor(cssH * dpr));
    // even dims
    canvas.width = pxW & ~1;
    canvas.height = pxH & ~1;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    scale = Math.max(1, Math.floor(pxW / 120));
  };

  const makeFrame = (): ImageData => {
    const bytes = packFrame({ ...header, seq: nextSeq }, encoder.encode(nextSeq));
    nextSeq++;
    const qr = QRCode.create([{ data: bytes, mode: "byte" } as unknown as QRCode.QRCodeSegment], {
      errorCorrectionLevel: ecc,
      version,
      maskPattern: 4,
    });
    if (version === undefined) {
      version = qr.version;
      layoutOutput();
      specs.textContent =
        `${fpsLabel(txFps)} · mix=${mixKind} · ${comp} · V${version} · ` +
        `${Math.round(payload.length / 1024)} KB · K=${encoder.k} · isolates · ready`;
    }
    const size = qr.modules.size;
    const data = qr.modules.data;
    const total = size + 2 * MARGIN;
    const img = new ImageData(total, total);
    const px = new Uint32Array(img.data.buffer);
    px.fill(0xffffffff);
    for (let y = 0; y < size; y++) {
      const row = (y + MARGIN) * total + MARGIN;
      const src = y * size;
      for (let x = 0; x < size; x++) {
        if (data[src + x]) px[row + x] = 0xff000000;
      }
    }
    if (fieldLook === "snow") {
      for (let y = 0; y < total; y++) {
        for (let x = 0; x < total; x++) {
          const inCore =
            x >= MARGIN && x < MARGIN + size && y >= MARGIN && y < MARGIN + size;
          if (!inCore && ((nextSeq * 1103515245 + x * 131 + y * 17) >>> 0) % 5 === 0) {
            px[y * total + x] = 0xff000000;
          }
        }
      }
    }
    return img;
  };

  const pump = () => {
    if (gen !== generation) return;
    try {
      while (queue.length < lookAhead) queue.push(makeFrame());
    } catch (err) {
      specs.textContent = `✗ QR: ${err instanceof Error ? err.message : String(err)}`;
      console.error(err);
      return;
    }
    setTimeout(pump, 0);
  };
  pump();

  const interval = 1000 / txFps;
  let nextAt = performance.now();

  const tick = (now: number) => {
    if (gen !== generation) return;
    requestAnimationFrame(tick);
    if (now < nextAt) return;

    // live-read sliders
    const mixStr = Math.max(0, Math.min(1, Number(cfgMixStr?.value ?? 72) / 100));
    const txStr = Math.max(0.2, Math.min(1, Number(cfgTxStr?.value ?? 88) / 100));
    const bleed = Math.max(0, Math.min(1, Number(cfgBleed?.value ?? 28) / 100));
    comp = (cfgComp?.value as Composite) || comp;

    const t = (now - t0) / 1000;
    const w = canvas.width;
    const h = canvas.height;
    if (w < 8 || h < 8) {
      nextAt = now + interval;
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = false;

    const img = queue.shift();
    if (!img) {
      // still show mix so user sees the pipe layer while QR queues
      drawMixCover(ctx, w, h, t);
      nextAt = now + interval;
      return;
    }

    // Module-resolution B/W QR → staging
    if (staging.width !== img.width || staging.height !== img.height) {
      staging.width = img.width;
      staging.height = img.height;
    }
    staging.getContext("2d")!.putImageData(img, 0, 0);

    // refresh mask/regions ~2 Hz
    if (now - maskPullAt > 500) {
      maskPullAt = now;
      void loadMaskImage(mixBase + "/mask.png").then((im) => {
        if (im) maskImg = im;
      });
      void fetchRegions(mixBase + "/regions.json").then((d) => {
        if (d) regionsDoc = d;
      });
    }

    // ── BROADCAST: mix full frame · TX isolates · logo strobe sphere ─
    if (comp === "broadcast") {
      // Layer 1 — live pipe (always full 16:9)
      drawMixCover(ctx, w, h, t);

      const regs = txRegions(regionsDoc);
      const occlude = makeOccludeFromMask(maskImg, w, h, 0.025);

      // Primary: lower_third gets the full fountain QR (finders stay in plate)
      const primary =
        regs.find((r) => r.id === "lower_third") ||
        regs[0] ||
        DEFAULT_REGIONS[0]!;
      const pbox = pixelBox(primary.box, w, h);
      // Auto color from region (inverse while tuning — high visibility)
      const colorModeEl = $("cfg-qr-color") as HTMLSelectElement | null;
      const colorMode =
        (colorModeEl?.value as "inverse" | "match" | "bw") || "inverse";
      paintQrInRect(ctx, staging, pbox, occlude, {
        txStrength: Math.min(1, txStr * 1.05),
        onlyDark: false, // paint spaces too in inverse so grid is obvious
        colorMode,
        contrast: 1,
      });

      // Secondary isolates — each samples its own area color
      for (const r of regs) {
        if (r.id === primary.id) continue;
        if (r.id === "logo_sphere" || r.role === "strobe") continue;
        if (r.role === "beacon" || r.role === "tx_secondary") {
          const box = pixelBox(r.box, w, h);
          const side = Math.min(box.w, box.h);
          if (side < 24) continue;
          const sq = {
            x: box.x + Math.floor((box.w - side) / 2),
            y: box.y + Math.floor((box.h - side) / 2),
            w: side,
            h: side,
          };
          paintQrInRect(ctx, staging, sq, occlude, {
            txStrength: Math.min(1, txStr * 1.05),
            onlyDark: false,
            colorMode,
            contrast: 1,
          });
        }
      }

      // Logo-scale strobe bug — top-right, ≈ Bloomberg logo size (not large orb)
      const strobeEl = $("cfg-strobe") as HTMLSelectElement | null;
      const shapeEl = $("cfg-strobe-shape") as HTMLSelectElement | null;
      const strobeMode = (strobeEl?.value as StrobeMode) || "glow";
      const strobeShape = (shapeEl?.value as StrobeShape) || "bug";
      const strobeInt = Number(($("cfg-strobe-int") as HTMLInputElement | null)?.value ?? 78) / 100;
      const glowPeriod =
        Number(($("cfg-strobe-period") as HTMLInputElement | null)?.value ?? 28) / 10;
      const burstHz = Number(($("cfg-strobe-hz") as HTMLInputElement | null)?.value ?? 8);
      const sphereReg =
        regionsDoc?.regions?.find((r) => r.id === "logo_sphere") ||
        ({ box: LOGO_SPHERE_BOX } as { box: [number, number, number, number] });
      // Prefer client logo-scale box if server still has oversized legacy coords
      let sbox = sphereReg.box as [number, number, number, number];
      if (sbox[2] > 0.07 || sbox[3] > 0.12) sbox = LOGO_SPHERE_BOX;
      const sopts: StrobeOpts = {
        mode: strobeMode,
        intensity: strobeInt,
        glowPeriod,
        burstHz,
        hue: 32, // bloomberg amber
        burstUntil: strobeBurstUntil || undefined,
        shape: strobeShape,
      };
      drawStrobeSphere(ctx, w, h, t, sopts, now, sbox);

      // debug outlines when ?debug=1
      if (new URLSearchParams(location.search).get("debug") === "1") {
        ctx.strokeStyle = "rgba(255,178,87,0.7)";
        ctx.lineWidth = 2;
        for (const r of regs) {
          const b = pixelBox(r.box, w, h);
          ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        }
        const sb = pixelBox(sphereReg.box as [number, number, number, number], w, h);
        ctx.strokeStyle = "rgba(255,100,60,0.9)";
        ctx.strokeRect(sb.x, sb.y, sb.w, sb.h);
      }

      nextAt += interval;
      if (now - nextAt > 3 * interval) nextAt = now + interval;
      return;
    }

    // ── PIP: full mix + TX corner ──────────────────────────────────────
    if (comp === "pip" && mixKind !== "none") {
      drawMixCover(ctx, w, h, t);
      const side = Math.floor(Math.min(w, h) * 0.36);
      const pad = Math.max(4, Math.floor(side * 0.05));
      const x0 = w - side - pad;
      const y0 = h - side - pad;
      ctx.fillStyle = `rgba(255,255,255,${0.85 + 0.1 * txStr})`;
      ctx.fillRect(x0 - pad * 0.3, y0 - pad * 0.3, side + pad * 0.6, side + pad * 0.6);
      const occlude = makeOccludeFromMask(maskImg, w, h, 0.02);
      paintQrInRect(
        ctx,
        staging,
        { x: x0, y: y0, w: side, h: side },
        occlude,
        { txStrength: txStr, onlyDark: true },
      );
      nextAt += interval;
      if (now - nextAt > 3 * interval) nextAt = now + interval;
      return;
    }

    // ── underlay / multiply / soft / stack (legacy full-frame) ────────
    if (mixKind === "none") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = mixStr;
      drawMixCover(ctx, w, h, t);
      ctx.globalAlpha = 1;
    }

    if (comp === "underlay" || comp === "multiply") {
      ctx.globalAlpha = txStr;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(staging, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (bleed > 0.01 && mixKind !== "none") {
        ctx.save();
        ctx.globalAlpha = bleed * 0.35;
        ctx.globalCompositeOperation = "soft-light";
        drawMixCover(ctx, w, h, t);
        ctx.restore();
      }
    } else if (comp === "soft") {
      ctx.globalAlpha = txStr * 0.85;
      ctx.drawImage(staging, 0, 0, w, h);
      ctx.globalAlpha = 1;
      if (mixKind !== "none") {
        ctx.globalAlpha = 0.25 + bleed * 0.35;
        ctx.globalCompositeOperation = "soft-light";
        drawMixCover(ctx, w, h, t);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    } else if (comp === "stack") {
      ctx.globalAlpha = 0.55 * txStr;
      ctx.drawImage(staging, 0, 0, w, h);
      ctx.globalAlpha = 1;
      if (mixKind !== "none") {
        ctx.globalAlpha = 0.4 * mixStr;
        ctx.globalCompositeOperation = "overlay";
        drawMixCover(ctx, w, h, t);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.drawImage(staging, 0, 0, w, h);
    }

    // interlace field look
    if (fieldLook === "interlace") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const step = Math.max(1, Math.round(scale));
      for (let y = fieldParity * step; y < h; y += step * 2) {
        ctx.fillRect(0, y, w, step);
      }
      fieldParity ^= 1;
    }

    nextAt += interval;
    if (now - nextAt > 3 * interval) nextAt = now + interval;
  };
  requestAnimationFrame(tick);
}

void main();
