/** A tiny 2D circle world for the About stack playground: gravity, floor and walls, circle-circle collisions,
 *  sleep detection. Pure (no DOM) so node:test can drive it. y grows downward. */

/** A circle, or with `a` a horizontal capsule (a flat pill: radius r, plus `a` more to each side of the centre). */
export type Body = { x: number; y: number; vx: number; vy: number; r: number; a?: number; held?: boolean };
export type World = { w: number; h: number; gravity?: number; bounce?: number; drag?: number };

/** Half the body's width. */
export const halfW = (b: Body) => b.r + (b.a ?? 0);

const SLEEP_SPEED = 48; // px/s: a body on the floor still twitches by about gravity * dt^2 per frame

/** Advances every free body by `dt` seconds (call with dt <= 1/30) and returns the fastest displacement speed;
 *  below ~48 px/s the world has settled and the caller can stop its frame loop. A held body is moved by the
 *  pointer, not by the step, but it still pushes the others away. */
export function step(bodies: Body[], world: World, dt: number): number {
  const { w, h, gravity = 1800, bounce = 0.42, drag = 0.6 } = world;
  const damp = Math.exp(-drag * dt);
  const from = bodies.map((b) => [b.x, b.y]); // speed is measured by how far a body really moved: a resting stack keeps a gravity-sized velocity that collisions cancel
  for (const b of bodies) {
    if (b.held) continue;
    b.vy += gravity * dt;
    b.vx *= damp; b.vy *= damp;
    b.x += b.vx * dt; b.y += b.vy * dt;
    const hw = halfW(b);
    if (b.x < hw) { b.x = hw; b.vx = Math.abs(b.vx) * bounce; }
    else if (b.x > w - hw) { b.x = w - hw; b.vx = -Math.abs(b.vx) * bounce; }
    if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * bounce; b.vx *= Math.exp(-2.2 * dt); if (Math.abs(b.vy) < 40) b.vy = 0; } // floor friction + no endless micro-bounce
    else if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * bounce; }
  }
  // Two relaxation passes keep a pile from sinking into itself without a real solver.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const ea = a.a ?? 0, eb = b.a ?? 0, min = a.r + b.r;
        // Closest points of the two centre segments: the same x when their spans overlap, else the facing ends (a circle is a zero-length segment).
        const dx = Math.max(a.x - ea, b.x - eb) <= Math.min(a.x + ea, b.x + eb) ? 0 : a.x < b.x ? b.x - eb - (a.x + ea) : b.x + eb - (a.x - ea);
        const dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        const nx = d > 1e-3 ? dx / d : 1, ny = d > 1e-3 ? dy / d : 0, push = min - d; // identical centres: pick a direction
        const wa = a.held ? 0 : b.held ? 1 : 0.5, wb = b.held ? 0 : a.held ? 1 : 0.5;
        a.x -= nx * push * wa; a.y -= ny * push * wa;
        b.x += nx * push * wb; b.y += ny * push * wb;
        // Exchange the velocity along the normal (equal masses), damped by the restitution.
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const j2 = -(1 + bounce) * rel;
          if (!a.held) { a.vx -= nx * j2 * wa; a.vy -= ny * j2 * wa; }
          if (!b.held) { b.vx += nx * j2 * wb; b.vy += ny * j2 * wb; }
        }
      }
    }
    // Pushing out of a collision must not carry a body through a wall.
    for (const b of bodies) {
      b.x = Math.min(Math.max(b.x, halfW(b)), w - halfW(b));
      b.y = Math.min(Math.max(b.y, b.r), h - b.r);
    }
  }
  let fastest = 0;
  bodies.forEach((b, i) => { if (!b.held) fastest = Math.max(fastest, Math.hypot(b.x - from[i][0], b.y - from[i][1]) / dt); });
  return fastest;
}

/** True when nothing is moving fast enough to need another frame. */
export const asleep = (speed: number) => speed < SLEEP_SPEED;

/** A stateful asleep check: true only after `frames` slow frames in a row, because a pile released at rest
 *  gains less than the threshold in its first frame or two but is still about to fall. */
export function sleeper(frames = 12) {
  let n = 0;
  return (speed: number) => (asleep(speed) ? ++n >= frames : ((n = 0), false));
}

/** Runs the world until it settles (or `max` steps) without drawing; used for the static arrangement. */
export function settle(bodies: Body[], world: World, max = 900): number {
  let n = 0;
  const done = sleeper();
  while (n++ < max && !done(step(bodies, world, 1 / 60)));
  rest(bodies);
  return n;
}

/** Zeroes every velocity: called when the loop stops so a settled pile does not creep on the next wake. */
export function rest(bodies: Body[]) {
  for (const b of bodies) { b.vx = 0; b.vy = 0; }
}

/** The body for a laid-out element: its centre, as a circle for a square and a capsule for a wide box. */
export function bodyFor(rect: { x: number; y: number; w: number; h: number }): Body {
  const r = Math.min(rect.w, rect.h) / 2;
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, vx: 0, vy: 0, r, a: Math.max(0, rect.w / 2 - r) };
}

/** How far a body is from where its element sits in the frozen layout: the CSS translate that draws it there. Zero means tidy. */
export const offsetOf = (b: Body, rect: { x: number; y: number; w: number; h: number }): [number, number] => [b.x - (rect.x + rect.w / 2), b.y - (rect.y + rect.h / 2)];
