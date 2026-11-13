// Sprawl's pure helper: the wipe trail the pointer leaves on the fogged glass. Up to four points (hero uv x, y and a
// life 0..1) that the shader clears around; new points push the oldest out, and every point fogs back over LIFE_MS.
export type Pt = [number, number, number];
export const SLOTS = 4;
export const LIFE_MS = 2200;

/** Adds a pointer sample: within `gap` of the newest point it just moves that point (and refreshes it), otherwise
 *  it becomes the new head and the oldest falls off. Returns a new array. */
export function pushPoint(trail: Pt[], x: number, y: number, gap = 0.035): Pt[] {
  const h = trail[0];
  if (h && Math.hypot(x - h[0], y - h[1]) < gap) return [[x, y, 1], ...trail.slice(1)];
  return [[x, y, 1] as Pt, ...trail].slice(0, SLOTS);
}

/** Ages every point by `dt` ms and drops the ones that have fogged over completely. Returns a new array. */
export function decay(trail: Pt[], dt: number, life = LIFE_MS): Pt[] {
  return trail.map(([x, y, l]) => [x, y, Math.max(0, l - dt / life)] as Pt).filter((p) => p[2] > 0);
}
