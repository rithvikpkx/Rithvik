// Pure geometry + physics for the look-switcher knob (angles in degrees, time in ms). Tested in physics.test.ts.

export const SWEEP = 270; // the knob turns from -135° (first look) to +135° (last)
const DESIGN_GAP = 1.7; // design detents sit wider apart than palette detents (bigger jewels)
const GROUP_GAP = 1.6; // extra space between the last design and the first palette

/** Detent angle for each entry: designs first, a gap, then palettes, spread over SWEEP. */
export function detentAngles(designs: number, palettes: number): number[] {
  const units: number[] = [];
  let u = 0;
  for (let i = 0; i < designs + palettes; i++) {
    if (i > 0) u += i <= designs - 1 ? DESIGN_GAP : i === designs ? GROUP_GAP : 1;
    units.push(u);
  }
  const span = u || 1;
  return units.map((x) => -SWEEP / 2 + (x / span) * SWEEP);
}

/** Index of the detent nearest an angle. */
export function nearest(angles: number[], a: number): number {
  let best = 0;
  for (let i = 1; i < angles.length; i++) if (Math.abs(angles[i] - a) < Math.abs(angles[best] - a)) best = i;
  return best;
}

/** The angle the knob shows for a raw (finger) angle: pulled toward the nearest detent so it feels notchy,
 *  and rubber-banded past the end stops. */
export function shaped(angles: number[], raw: number): number {
  const lo = angles[0], hi = angles[angles.length - 1];
  if (raw < lo) return lo - band(lo - raw);
  if (raw > hi) return hi + band(raw - hi);
  const k = nearest(angles, raw);
  const d = raw - angles[k];
  const half = Math.abs((angles[k + Math.sign(d)] ?? angles[k]) - angles[k]) / 2;
  if (!half) return angles[k];
  return angles[k] + Math.sign(d) * half * (Math.abs(d) / half) ** 2.2; // magnet: sticks near a detent, flips at the midpoint
}

/** Rubber band past an end stop: gives way a few degrees, then hardens. */
const band = (x: number) => 9 * (1 - Math.exp(-x / 18));

/** Shortest signed difference between two angles, in (-180, 180]. */
export function wrap(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

export type Motion = { a: number; v: number; phase: "coast" | "snap"; target: number };

/** One integration step (dt ms): coast with friction until slow, then spring onto a detent. Returns true when settled. */
export function step(m: Motion, angles: number[], dt: number): boolean {
  dt = Math.min(dt, 32); // a dropped frame must not blow the spring up
  const lo = angles[0], hi = angles[angles.length - 1];
  if (m.phase === "coast") {
    m.v *= Math.exp(-dt / 170);
    m.a += m.v * dt;
    if (m.a < lo || m.a > hi || Math.abs(m.v) < 0.08) { m.phase = "snap"; m.target = nearest(angles, m.a); }
    return false;
  }
  const t = angles[m.target];
  m.v += (-0.0007 * (m.a - t) - 0.042 * m.v) * dt; // stiff, slightly under-damped: a small overshoot into the notch
  m.a += m.v * dt;
  if (Math.abs(m.a - t) < 0.05 && Math.abs(m.v) < 0.003) { m.a = t; m.v = 0; return true; }
  return false;
}
