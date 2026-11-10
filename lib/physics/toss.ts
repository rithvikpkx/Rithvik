/** A tiny 2D circle world for the About stack playground: gravity, floor and walls, circle-circle collisions,
 *  sleep detection. Pure (no DOM) so node:test can drive it. y grows downward. */

export type Body = { x: number; y: number; vx: number; vy: number; r: number; held?: boolean };
export type World = { w: number; h: number; gravity?: number; bounce?: number; drag?: number };

const SLEEP_SPEED = 48; // px/s: resting contacts jitter at about gravity * dt (~30), so go above that

/** Advances every free body by `dt` seconds (call with dt <= 1/30) and returns the fastest speed afterwards;
 *  below ~48 px/s the world has settled and the caller can stop its frame loop. A held body is moved by the
 *  pointer, not by the step, but it still pushes the others away. */
export function step(bodies: Body[], world: World, dt: number): number {
  const { w, h, gravity = 1800, bounce = 0.42, drag = 0.6 } = world;
  const damp = Math.exp(-drag * dt);
  for (const b of bodies) {
    if (b.held) continue;
    b.vy += gravity * dt;
    b.vx *= damp; b.vy *= damp;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * bounce; }
    else if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * bounce; }
    if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * bounce; b.vx *= Math.exp(-2.2 * dt); if (Math.abs(b.vy) < 40) b.vy = 0; } // floor friction + no endless micro-bounce
    else if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * bounce; }
  }
  // Two relaxation passes keep a pile from sinking into itself without a real solver.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.001;
        if (d2 === 0) { dx = 1; dy = 0; } // identical centres: pick a direction
        const nx = dx / d, ny = dy / d, push = min - d;
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
      b.x = Math.min(Math.max(b.x, b.r), w - b.r);
      b.y = Math.min(Math.max(b.y, b.r), h - b.r);
    }
  }
  let fastest = 0;
  for (const b of bodies) if (!b.held) fastest = Math.max(fastest, Math.hypot(b.vx, b.vy));
  return fastest;
}

/** True when nothing is moving fast enough to need another frame. */
export const asleep = (speed: number) => speed < SLEEP_SPEED;

/** Runs the world until it settles (or `max` steps) without drawing; used for the static arrangement. */
export function settle(bodies: Body[], world: World, max = 900): number {
  let n = 0;
  while (n++ < max && !asleep(step(bodies, world, 1 / 60)));
  rest(bodies);
  return n;
}

/** Zeroes every velocity: called when the loop stops so a settled pile does not creep on the next wake. */
export function rest(bodies: Body[]) {
  for (const b of bodies) { b.vx = 0; b.vy = 0; }
}
