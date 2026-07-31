// Logo strobe — small network-bug size (≈ Bloomberg logo), top-right.
// Not a big rounded glass orb: flat bug plate + optional tiny /lens-style core.
// Modes: slow glow · burst · strobe · jawta-ish patterns.

export type StrobeMode =
  | "off"
  | "glow"
  | "burst"
  | "heartbeat"
  | "strobe"
  | "double"
  | "morse";

export type StrobeShape = "bug" | "lens";

export interface StrobeOpts {
  mode: StrobeMode;
  /** 0..1 intensity */
  intensity: number;
  /** glow period seconds (slow pulse) */
  glowPeriod: number;
  /** burst rate Hz for strobe/burst modes */
  burstHz: number;
  /** hue base (bloomberg amber ~38) */
  hue: number;
  /** force a one-shot burst end (ms) */
  burstUntil?: number;
  /** bug = flat network plate (default); lens = tiny optic-star core */
  shape?: StrobeShape;
}

/**
 * Normalized box for Bloomberg-scale logo bug (16:9).
 * ~4.5% width — matches network bug, not a large sphere.
 * Slightly inset from the true corner so it sits *next to* the B logo.
 */
export const LOGO_SPHERE_BOX: [number, number, number, number] = [
  0.935, 0.035, 0.048, 0.085,
];

function smooth01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** Instantaneous brightness 0..1 for mode at time t (seconds). */
export function strobeLevel(t: number, opts: StrobeOpts, nowMs: number): number {
  if (opts.burstUntil != null && nowMs < opts.burstUntil) {
    const left = (opts.burstUntil - nowMs) / 1000;
    const phase = (1 - left) * 24;
    return (Math.sin(phase * Math.PI * 2) > 0.2 ? 1 : 0.08) * opts.intensity;
  }

  switch (opts.mode) {
    case "off":
      return 0;
    case "glow": {
      const p = Math.max(0.4, opts.glowPeriod);
      const s = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / p);
      return (0.28 + 0.72 * smooth01(s)) * opts.intensity;
    }
    case "burst": {
      const cycle = 1.8;
      const u = (t % cycle) / cycle;
      if (u < 0.08) return opts.intensity;
      if (u < 0.14) return opts.intensity * 0.35;
      if (u < 0.2) return opts.intensity * 0.9;
      return 0.06 * opts.intensity;
    }
    case "strobe": {
      const hz = Math.max(2, opts.burstHz);
      return (Math.sin(t * hz * Math.PI * 2) > 0 ? 1 : 0.05) * opts.intensity;
    }
    case "double": {
      const cycle = 1.2;
      const u = (t % cycle) / cycle;
      if (u < 0.06 || (u > 0.12 && u < 0.18)) return opts.intensity;
      return 0.05 * opts.intensity;
    }
    case "heartbeat": {
      const cycle = 0.85;
      const u = (t % cycle) / cycle;
      if (u < 0.08) return opts.intensity * smooth01(1 - u / 0.08);
      if (u > 0.14 && u < 0.22)
        return opts.intensity * 0.75 * smooth01(1 - (u - 0.14) / 0.08);
      return 0.08 * opts.intensity;
    }
    case "morse": {
      const dit = 0.12;
      const pattern = [
        1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0,
      ];
      const i = Math.floor(t / dit) % pattern.length;
      return (pattern[i] ? 1 : 0.06) * opts.intensity;
    }
    default:
      return 0;
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Draw small logo-scale strobe.
 * Default shape = flat network **bug** (rounded square), not a big glass ball.
 * Optional shape=lens uses a tiny optic-star diamond core (fc-lens / /cam star vibe).
 */
export function drawStrobeSphere(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  t: number,
  opts: StrobeOpts,
  nowMs: number,
  box: [number, number, number, number] = LOGO_SPHERE_BOX,
): void {
  const level = strobeLevel(t, opts, nowMs);
  if (
    level < 0.01 &&
    opts.mode === "off" &&
    !(opts.burstUntil && nowMs < opts.burstUntil)
  ) {
    return;
  }

  const shape: StrobeShape = opts.shape || "bug";
  const bx = box[0] * canvasW;
  const by = box[1] * canvasH;
  const bw = box[2] * canvasW;
  const bh = box[3] * canvasH;
  // hard cap — never larger than ~5.5% of frame width
  const maxSide = canvasW * 0.055;
  const side = Math.min(bw, bh, maxSide);
  const x = bx + (bw - side) * 0.5;
  const y = by + (bh - side) * 0.35; // sit high like logo bug
  const cx = x + side * 0.5;
  const cy = y + side * 0.5;
  const hue = opts.hue;
  const a = Math.max(0, Math.min(1, level));

  // tight outer glow (logo-scale, not stadium bloom)
  const bloomR = side * (0.9 + 0.5 * a);
  const g0 = ctx.createRadialGradient(cx, cy, side * 0.1, cx, cy, bloomR);
  g0.addColorStop(0, `hsla(${hue}, 95%, 68%, ${0.45 * a})`);
  g0.addColorStop(0.55, `hsla(${hue}, 90%, 50%, ${0.18 * a})`);
  g0.addColorStop(1, `hsla(${hue}, 80%, 40%, 0)`);
  ctx.fillStyle = g0;
  ctx.beginPath();
  ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
  ctx.fill();

  if (shape === "lens") {
    drawLensStarCore(ctx, cx, cy, side * 0.42, hue, a, t);
    return;
  }

  // ── network bug plate (rounded square, like on-air logo chip) ──
  const pad = side * 0.06;
  const plate = side - pad * 2;
  const px = x + pad;
  const py = y + pad;
  const radius = plate * 0.18; // mild corner — not a circle

  // dark plate base (reads as graphic bug, not floating orb)
  ctx.fillStyle = `rgba(8, 12, 18, ${0.72 + 0.2 * a})`;
  roundRectPath(ctx, px, py, plate, plate, radius);
  ctx.fill();

  // inner fill — pulses with level
  const g1 = ctx.createLinearGradient(px, py, px + plate, py + plate);
  g1.addColorStop(0, `hsla(${hue}, 70%, ${48 + 22 * a}%, ${0.55 + 0.35 * a})`);
  g1.addColorStop(1, `hsla(${hue + 8}, 80%, ${28 + 12 * a}%, ${0.65 + 0.25 * a})`);
  ctx.fillStyle = g1;
  roundRectPath(ctx, px + plate * 0.1, py + plate * 0.1, plate * 0.8, plate * 0.8, radius * 0.7);
  ctx.fill();

  // thin rim
  ctx.strokeStyle = `hsla(${hue}, 90%, 75%, ${0.55 + 0.4 * a})`;
  ctx.lineWidth = Math.max(1, side * 0.04);
  roundRectPath(ctx, px, py, plate, plate, radius);
  ctx.stroke();

  // micro lens core (tiny — optional optic reference inside the bug)
  const coreR = plate * 0.16;
  const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  g2.addColorStop(0, `hsla(${hue}, 40%, 98%, ${0.9 * a})`);
  g2.addColorStop(0.6, `hsla(${hue}, 90%, 60%, ${0.7 * a})`);
  g2.addColorStop(1, `hsla(${hue}, 90%, 40%, 0)`);
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
  ctx.fill();

  // peak flash — hard square edge, not soft ball
  if (a > 0.82) {
    ctx.strokeStyle = `hsla(${hue}, 100%, 92%, ${(a - 0.82) * 4})`;
    ctx.lineWidth = 1;
    roundRectPath(
      ctx,
      px - side * 0.06,
      py - side * 0.06,
      plate + side * 0.12,
      plate + side * 0.12,
      radius,
    );
    ctx.stroke();
  }
}

/** Tiny optic-star / crystal diamond — /lens · /cam star scale, not full orb. */
function drawLensStarCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  hue: number,
  a: number,
  t: number,
): void {
  const rot = t * 0.35;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // diamond plate
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.72, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.72, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, `hsla(${hue}, 50%, 95%, ${0.95 * a})`);
  g.addColorStop(0.45, `hsla(${hue}, 85%, 58%, ${0.85 * a})`);
  g.addColorStop(1, `hsla(${hue + 20}, 90%, 40%, ${0.7 * a})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = `hsla(${hue}, 90%, 80%, ${0.75 * a})`;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();

  // cross sparkle
  ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.55);
  ctx.lineTo(0, r * 0.55);
  ctx.moveTo(-r * 0.4, 0);
  ctx.lineTo(r * 0.4, 0);
  ctx.stroke();
  ctx.restore();
}
