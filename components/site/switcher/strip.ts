// Pure geometry + physics for the Meniscus look picker (px, seconds). Tested in strip.test.ts.

export const PITCH = 10; // distance between neighbouring stripes
export const GAP = 14; // extra space between the designs group and the palettes group
export const PAD = 12; // breathing room inside each end of the strip
export const CAP_W = 38; // each end cap (status lamp left, performance switch right)
export const VISIBLE = 24; // looks shown at once; more than this and the strip scrolls
export const MAX_W = 360; // the capsule's widest size

export type Layout = { xs: number[]; contentW: number; vw: number; max: number; capW: number };

/** Where each stripe's centre sits in the strip's content, the content width, the visible window `vw`
 *  (capped at VISIBLE looks, or what `avail` px of screen allows), the furthest scroll, and the capsule width.
 *  Centres sit on half pixels so a 3px stripe lands on whole pixels. */
export function stripLayout(n: number, nd: number, avail = MAX_W): Layout {
  const gap = nd > 0 && nd < n ? GAP : 0;
  const xs = Array.from({ length: n }, (_, i) => PAD + i * PITCH + PITCH / 2 + (i >= nd ? gap : 0) + 0.5);
  const contentW = n * PITCH + gap + 2 * PAD;
  const vw = Math.min(contentW, VISIBLE * PITCH + GAP + 2 * PAD, Math.max(PITCH * 6, avail - 2 * CAP_W));
  return { xs, contentW, vw, max: Math.max(0, contentW - vw), capW: vw + 2 * CAP_W };
}

/** Index of the stripe whose centre is nearest content-x `x`. */
export function nearestIndex(xs: number[], x: number): number {
  let lo = 0, hi = xs.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m; }
  return lo > 0 && Math.abs(xs[lo - 1] - x) <= Math.abs(xs[lo] - x) ? lo - 1 : lo;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The scroll that puts content-x `x` in the middle of the window (clamped), for opening on the current look. */
export function centerScroll(x: number, vw: number, max: number): number {
  return Math.round(clamp(x - vw / 2, 0, max));
}

/** The smallest scroll change from `sc` that keeps content-x `x` at least `margin` px inside the window. */
export function revealScroll(sc: number, x: number, vw: number, margin: number, max: number): number {
  if (x - sc < margin) return Math.round(clamp(x - margin, 0, max));
  if (x - sc > vw - margin) return Math.round(clamp(x - vw + margin, 0, max));
  return sc;
}

/** Auto-scroll speed (px/s, signed) for a pointer at window-x `px`: nothing outside the `zone`, ramping to `vmax`
 *  at the very edge, and nothing towards an end that cannot scroll further. */
export function edgeVelocity(px: number, vw: number, zone: number, vmax: number, sc: number, max: number): number {
  if (px < zone && sc > 0) return -vmax * Math.min(1, (zone - px) / zone) ** 2;
  if (px > vw - zone && sc < max) return vmax * Math.min(1, (px - (vw - zone)) / zone) ** 2;
  return 0;
}

/** The position indicator's thumb inside a track as wide as the window: its left and width. */
export function thumb(sc: number, vw: number, contentW: number): { left: number; width: number } {
  const width = Math.max(14, (vw * vw) / contentW);
  return { left: contentW > vw ? (sc / (contentW - vw)) * (vw - width) : 0, width };
}

/** How tall a stripe stands (0.46 at rest up to 1 under the lens): a bell around the lens, scaled by how far open it is. */
export function stripeScale(dx: number, open: number): number {
  return 0.46 + 0.54 * Math.exp(-((dx / 15) ** 2)) * clamp(open, 0, 1);
}

/** One spring state: position and velocity. */
export type Spring = { x: number; v: number };

/** Advances a spring toward `to` by dt seconds (stiffness k, damping c; dt is clamped so a dropped frame can't
 *  blow it up). Returns true once it has settled on the target, and snaps there. */
export function step(s: Spring, to: number, k: number, c: number, dt: number): boolean {
  dt = Math.min(dt, 0.032);
  s.v += (k * (to - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
  if (Math.abs(to - s.x) < 0.04 && Math.abs(s.v) < 0.4) { s.x = to; s.v = 0; return true; }
  return false;
}
