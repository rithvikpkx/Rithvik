// Pure geometry + physics for the look-switcher orbs (px, ms). Tested in physics.test.ts.

export type Vec = { x: number; y: number };
/** One orb: position, velocity, scale and scale velocity. */
export type Orb = { x: number; y: number; vx: number; vy: number; s: number; vs: number };
export type Target = Vec & { s: number };

/** Home slot per look: designs on the inner ring, palettes on the outer one, both starting at 12 o'clock and
 *  running clockwise (the palette ring is offset half a step so the two rings interleave). */
export function ringSlots(designs: number, palettes: number, c: Vec, rInner: number, rOuter: number): Vec[] {
  const at = (i: number, n: number, r: number, off: number): Vec => {
    const a = -Math.PI / 2 + off + (i / n) * Math.PI * 2;
    return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
  };
  return [
    ...Array.from({ length: designs }, (_, i) => at(i, designs, rInner, 0)),
    ...Array.from({ length: palettes }, (_, i) => at(i, palettes, rOuter, Math.PI / (palettes || 1))),
  ];
}

const K = 0.00021; // spring stiffness (1/ms²): ~450ms period
const C_POS = 0.0158; // position damping: slightly under-damped, so a little overshoot into the socket
const C_SCALE = 0.0125; // scale rings a touch more: the squash you feel on a snap

/** One integration step (dt ms) of an orb toward its target. Returns true when it has come to rest. */
export function stepOrb(o: Orb, t: Target, dt: number): boolean {
  dt = Math.min(dt, 32); // a dropped frame must not blow the spring up
  o.vx += (-K * (o.x - t.x) - C_POS * o.vx) * dt;
  o.vy += (-K * (o.y - t.y) - C_POS * o.vy) * dt;
  o.vs += (-K * 1.6 * (o.s - t.s) - C_SCALE * o.vs) * dt;
  o.x += o.vx * dt;
  o.y += o.vy * dt;
  o.s += o.vs * dt;
  const rest = atRest(o, t);
  if (rest) { o.x = t.x; o.y = t.y; o.s = t.s; o.vx = o.vy = o.vs = 0; }
  return rest;
}

/** True when an orb is on its target and has (nearly) stopped moving. */
export function atRest(o: Orb, t: Target): boolean {
  return Math.hypot(o.x - t.x, o.y - t.y) < 0.15 && Math.hypot(o.vx, o.vy) < 0.002 && Math.abs(o.s - t.s) < 0.002 && Math.abs(o.vs) < 0.0004;
}

/** Pushes overlapping orbs apart (radius = base × scale + gap). `fixed` orbs never move (the held orb and the
 *  nucleus); the others take the whole correction and keep some outward speed, so a passing orb jostles them. */
export function collide(orbs: Orb[], base: number[], fixed: (i: number) => boolean, gap = 2): void {
  for (let i = 0; i < orbs.length; i++) {
    for (let j = i + 1; j < orbs.length; j++) {
      const fi = fixed(i), fj = fixed(j);
      if (fi && fj) continue;
      const a = orbs[i], b = orbs[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = base[i] * a.s + base[j] * b.s + gap;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
      const push = min - d;
      const wa = fi ? 0 : fj ? 1 : 0.5, wb = fj ? 0 : fi ? 1 : 0.5;
      a.x -= nx * push * wa; a.y -= ny * push * wa;
      b.x += nx * push * wb; b.y += ny * push * wb;
      const kick = Math.min(push * 0.02, 0.25); // a nudge of speed along the normal, capped
      a.vx -= nx * kick * wa; a.vy -= ny * kick * wa;
      b.vx += nx * kick * wb; b.vy += ny * kick * wb;
    }
  }
}

/** A dragged orb's displayed position: within `reach` of the centre it is pulled in, harder the closer it gets. */
export function magnet(p: Vec, c: Vec, reach: number): Vec {
  const d = Math.hypot(p.x - c.x, p.y - c.y);
  if (d >= reach) return p;
  const f = (d / reach) ** 1.6;
  return { x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f };
}

/** Squash and stretch along the direction of travel: a moving orb elongates a little and thins across. */
export function squash(vx: number, vy: number): { rot: number; sx: number; sy: number } {
  const sp = Math.hypot(vx, vy);
  const st = 1 + Math.min(sp * 0.3, 0.28);
  return { rot: sp > 0.02 ? Math.atan2(vy, vx) : 0, sx: st, sy: 1 / st };
}

/** Index of the point nearest p within `max` px (a number, or per index), or -1. */
export function nearestWithin(points: Vec[], p: Vec, max: number | ((i: number) => number)): number {
  let best = -1, bd = Infinity;
  points.forEach((q, i) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= (typeof max === "number" ? max : max(i)) && d < bd) { bd = d; best = i; }
  });
  return best;
}
