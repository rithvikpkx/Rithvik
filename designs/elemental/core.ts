// Pure helpers behind the elemental family's motion (designs/elemental/motion.ts): the charge the pointer builds up
// and the strike's shockwave clock. Kept DOM-free so node:test can check them.

/** How long a strike's shockwave lives, seconds (the shader's ring has faded out well before this). */
export const STRIKE_S = 1.6;
/** The shader's "no strike" age: far past the ring's life, so nothing draws. */
export const IDLE_AGE = 99;

/** One step of the charge: it rises fast toward the pointer's speed (px/ms) and bleeds away slowly, like power
 *  gathering in the hands and fading once they stop. Returns the new charge, 0..1. */
export function chargeStep(c: number, speed: number, dt: number): number {
  const target = Math.min(1, Math.max(0, speed) / 1.6);
  const rate = target > c ? 6 : 0.9; // gather in a breath, release over a second or so
  const k = 1 - Math.exp(-rate * Math.min(dt, 0.1));
  const next = c + (target - c) * k;
  return next < 0.002 ? 0 : next;
}

/** A client point as the shader's 0..1 canvas coordinates (y up), clamped to the canvas. */
export function toCanvas(x: number, y: number, r: { left: number; top: number; width: number; height: number }): [number, number] {
  const u = (x - r.left) / (r.width || 1), v = 1 - (y - r.top) / (r.height || 1);
  return [Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))];
}

/** A colour stop: position 0..1 and a #rrggbb colour. */
export type Stop = [number, string];
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** The colour at t along piecewise-linear stops (sorted by position), as an `rgb()` string for a CSS variable.
 *  The names use it for their per-letter ramps (fire cooling through char, water deepening, charge crackling). */
export function rampAt(stops: Stop[], t: number): string {
  t = Math.min(1, Math.max(0, t));
  let i = 1;
  while (i < stops.length - 1 && t > stops[i][0]) i++;
  const [a, ca] = stops[i - 1], [b, cb] = stops[i], k = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 1;
  const x = rgb(ca), y = rgb(cb);
  return `rgb(${x.map((v, j) => Math.round(v + (y[j] - v) * k)).join(" ")})`;
}
