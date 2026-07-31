// Broadcast layout helpers — regions + talent occlusion for Decimen send.
// Isolates TX to lower-third / pillars / bug; occludes talking-head.

export type NormBox = [number, number, number, number]; // x,y,w,h 0..1

export interface Region {
  id: string;
  role: string;
  label?: string;
  box: NormBox;
  priority: number;
  finder_ok: boolean;
}

export interface RegionsDoc {
  schema?: string;
  width: number;
  height: number;
  regions: Region[];
  tx_union?: string[];
  occlude?: string[];
}

export const DEFAULT_REGIONS: Region[] = [
  {
    id: "lower_third",
    role: "tx_primary",
    label: "lower-third",
    box: [0.02, 0.72, 0.96, 0.18],
    priority: 10,
    finder_ok: true,
  },
  {
    id: "ticker",
    role: "tx_secondary",
    label: "ticker",
    box: [0.0, 0.9, 1.0, 0.1],
    priority: 8,
    finder_ok: false,
  },
  {
    id: "left_pillar",
    role: "tx_secondary",
    label: "left pillar",
    box: [0.0, 0.08, 0.1, 0.62],
    priority: 6,
    finder_ok: true,
  },
  {
    id: "right_pillar",
    role: "tx_secondary",
    label: "right pillar",
    box: [0.9, 0.08, 0.1, 0.62],
    priority: 5,
    finder_ok: true,
  },
  {
    id: "bug",
    role: "beacon",
    label: "bug",
    box: [0.72, 0.04, 0.12, 0.14],
    priority: 4,
    finder_ok: true,
  },
  {
    id: "logo_sphere",
    role: "strobe",
    label: "logo strobe bug",
    box: [0.935, 0.035, 0.048, 0.085],
    priority: 12,
    finder_ok: false,
  },
];

export function pixelBox(
  box: NormBox,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.floor(box[0] * w),
    y: Math.floor(box[1] * h),
    w: Math.max(1, Math.floor(box[2] * w)),
    h: Math.max(1, Math.floor(box[3] * h)),
  };
}

export function txRegions(doc: RegionsDoc | null): Region[] {
  const list = doc?.regions?.length ? doc.regions : DEFAULT_REGIONS;
  return list
    .filter((r) => r.role.startsWith("tx") || r.role === "beacon")
    .sort((a, b) => b.priority - a.priority);
}

/** True if (nx,ny) in 0..1 is inside any TX region. */
export function inTxRegion(nx: number, ny: number, regs: Region[]): boolean {
  for (const r of regs) {
    const [x, y, w, h] = r.box;
    if (nx >= x && nx < x + w && ny >= y && ny < y + h) return true;
  }
  return false;
}

export type QrPaintOpts = {
  txStrength: number;
  /** If true, only paint “mark” modules (QR dark cells). */
  onlyDark: boolean;
  /**
   * inverse (default while tuning): mark modules = invert local color for max visibility.
   * match: mark modules shift toward auto-picked region palette (blend with inverse off).
   */
  colorMode?: "inverse" | "match" | "bw";
  /** 0..1 how hard to force mark contrast */
  contrast?: number;
};

function clamp8(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

/** Average RGB in a rect (already drawn mix). */
export function sampleRegionAvg(
  data: Uint8ClampedArray,
  rw: number,
  rh: number,
  step = 4,
): [number, number, number] {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let y = 0; y < rh; y += step) {
    for (let x = 0; x < rw; x += step) {
      const i = (y * rw + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  if (!n) return [128, 128, 128];
  return [(r / n) | 0, (g / n) | 0, (b / n) | 0];
}

/**
 * Paint QR into a destination rect.
 * - Auto-picks color from the local mix area (per-pixel + region average).
 * - Default colorMode **inverse** so marks pop until matching is dialed in.
 * - Skips talent via occlude().
 */
export function paintQrInRect(
  ctx: CanvasRenderingContext2D,
  qrCanvas: HTMLCanvasElement,
  rect: { x: number; y: number; w: number; h: number },
  occlude: ((x: number, y: number) => boolean) | null,
  opts: QrPaintOpts,
): void {
  const { x: rx, y: ry, w: rw, h: rh } = rect;
  if (rw < 4 || rh < 4) return;

  const tw = qrCanvas.width;
  const th = qrCanvas.height;
  const qctx = qrCanvas.getContext("2d")!;
  let qdata: ImageData;
  try {
    qdata = qctx.getImageData(0, 0, tw, th);
  } catch {
    ctx.globalAlpha = opts.txStrength;
    ctx.drawImage(qrCanvas, rx, ry, rw, rh);
    ctx.globalAlpha = 1;
    return;
  }

  const img = ctx.getImageData(rx, ry, rw, rh);
  const d = img.data;
  const qd = qdata.data;
  const [ar, ag, ab] = sampleRegionAvg(d, rw, rh, 3);
  // region palette: mark color = inverse of avg; space color = avg (slightly lifted)
  const invAr = 255 - ar;
  const invAg = 255 - ag;
  const invAb = 255 - ab;
  const mode = opts.colorMode ?? "inverse";
  const contrast = opts.contrast ?? 1;
  const str = Math.max(0, Math.min(1, opts.txStrength));

  for (let py = 0; py < rh; py++) {
    const v = (py + 0.5) / rh;
    const qy = Math.min(th - 1, Math.floor(v * th));
    for (let px = 0; px < rw; px++) {
      const u = (px + 0.5) / rw;
      const qx = Math.min(tw - 1, Math.floor(u * tw));
      const qi = (qy * tw + qx) * 4;
      const isMark = qd[qi]! < 128; // QR dark cell
      if (opts.onlyDark && !isMark) continue;

      const gx = rx + px;
      const gy = ry + py;
      if (occlude && occlude(gx, gy)) continue;

      const di = (py * rw + px) * 4;
      const lr = d[di]!;
      const lg = d[di + 1]!;
      const lb = d[di + 2]!;
      // blend local pixel with region average for stable auto-pick
      const pr = (lr * 0.55 + ar * 0.45) | 0;
      const pg = (lg * 0.55 + ag * 0.45) | 0;
      const pb = (lb * 0.55 + ab * 0.45) | 0;

      let nr: number, ng: number, nb: number;
      if (mode === "inverse") {
        // High-visibility inverse of the area’s color pattern
        if (isMark) {
          // invert local + push toward region inverse for coherence
          nr = clamp8((255 - pr) * 0.65 + invAr * 0.35);
          ng = clamp8((255 - pg) * 0.65 + invAg * 0.35);
          nb = clamp8((255 - pb) * 0.65 + invAb * 0.35);
          // ensure high contrast vs local
          const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
          if (lum > 140) {
            // area is bright → marks go near-black with hue from inverse
            nr = clamp8(nr * 0.25);
            ng = clamp8(ng * 0.25);
            nb = clamp8(nb * 0.25);
          } else {
            // area is dark → marks go near-white with area hue inverted
            nr = clamp8(180 + nr * 0.3);
            ng = clamp8(180 + ng * 0.3);
            nb = clamp8(180 + nb * 0.3);
          }
        } else {
          // space modules: subtle inverse wash so grid is visible while tuning
          nr = clamp8(pr * (1 - 0.35 * contrast) + (255 - pr) * 0.35 * contrast);
          ng = clamp8(pg * (1 - 0.35 * contrast) + (255 - pg) * 0.35 * contrast);
          nb = clamp8(pb * (1 - 0.35 * contrast) + (255 - pb) * 0.35 * contrast);
        }
      } else if (mode === "match") {
        // Future: blend marks into region palette (darker/lighter of local)
        if (isMark) {
          const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
          const target = lum > 128 ? 0.22 : 0.78; // darken light areas, lighten dark
          nr = clamp8(pr * (1 - target) + (lum > 128 ? 20 : 230) * target);
          ng = clamp8(pg * (1 - target) + (lum > 128 ? 20 : 230) * target);
          nb = clamp8(pb * (1 - target) + (lum > 128 ? 20 : 230) * target);
          // keep chroma from area
          nr = clamp8(nr * 0.55 + pr * 0.45);
          ng = clamp8(ng * 0.55 + pg * 0.45);
          nb = clamp8(nb * 0.55 + pb * 0.45);
        } else {
          continue; // show mix
        }
      } else {
        // bw
        if (isMark) {
          nr = 12;
          ng = 12;
          nb = 12;
        } else {
          continue;
        }
      }

      // mix toward computed mark color by strength
      d[di] = clamp8(lr * (1 - str) + nr * str);
      d[di + 1] = clamp8(lg * (1 - str) + ng * str);
      d[di + 2] = clamp8(lb * (1 - str) + nb * str);
    }
  }
  ctx.putImageData(img, rx, ry);
}

/** Build occlude predicate from grayscale mask image (0 = person). */
export function makeOccludeFromMask(
  maskImg: HTMLImageElement | null,
  canvasW: number,
  canvasH: number,
  dilate = 0.02,
): ((x: number, y: number) => boolean) | null {
  if (!maskImg || !maskImg.naturalWidth) {
    // heuristic oval (talking head)
    const cx = canvasW * 0.42;
    const cy = canvasH * 0.38;
    const rx = canvasW * (0.22 + dilate);
    const ry = canvasH * (0.34 + dilate);
    return (x, y) => {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      return nx * nx + ny * ny <= 1;
    };
  }
  const c = document.createElement("canvas");
  c.width = canvasW;
  c.height = canvasH;
  const mctx = c.getContext("2d")!;
  mctx.drawImage(maskImg, 0, 0, canvasW, canvasH);
  let data: ImageData;
  try {
    data = mctx.getImageData(0, 0, canvasW, canvasH);
  } catch {
    return null;
  }
  const px = data.data;
  // optional dilate: check neighborhood
  const r = Math.max(1, Math.floor(Math.min(canvasW, canvasH) * dilate));
  return (x, y) => {
    const x0 = Math.max(0, x - r);
    const x1 = Math.min(canvasW - 1, x + r);
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(canvasH - 1, y + r);
    for (let yy = y0; yy <= y1; yy += Math.max(1, r)) {
      for (let xx = x0; xx <= x1; xx += Math.max(1, r)) {
        const i = (yy * canvasW + xx) * 4;
        if (px[i]! < 128) return true; // dark = person = occlude
      }
    }
    return false;
  };
}

export async function fetchRegions(url: string): Promise<RegionsDoc | null> {
  try {
    let u = url;
    if (!u.includes("regions")) {
      u = u.replace(/\/mix\.jpe?g.*$/i, "") + "/regions.json";
    }
    const r = await fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!r.ok) return null;
    return (await r.json()) as RegionsDoc;
  } catch {
    return null;
  }
}

export function loadMaskImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  });
}
