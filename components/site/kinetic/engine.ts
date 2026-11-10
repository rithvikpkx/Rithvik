// The kinetic name's physics, kept pure so it can be tested: each letter has an energy `k` (0 calm, 1 fully
// excited) that rises when the pointer is near and fades after it leaves, plus a 2D offset on a damped spring
// that the pointer pushes away and drags along with its velocity.

/** Per-look feel. Distances are in px; rates are per second. */
export type Feel = {
  /** Reach of the pointer, px. */
  radius: number;
  /** Push away from the pointer at full energy, px. */
  push: number;
  /** How much of the pointer's velocity drags letters along (px offset per px/ms). */
  drag: number;
  /** Rise and fall rates of the energy (fast attack, slow release reads as heat). */
  attack: number;
  release: number;
  /** Offset spring stiffness and damping (lower damping = more wobble). */
  stiff: number;
  damp: number;
};

export const FEEL: Feel = { radius: 150, push: 10, drag: 6, attack: 9, release: 2.4, stiff: 170, damp: 13 };

/** One letter: its rest centre (px, page space at measure time) and live state. */
export type Letter = { cx: number; cy: number; k: number; x: number; y: number; vx: number; vy: number };

/** Where the pointer is (null = away) and how fast it moves (px/ms, smoothed). */
export type Pointer = { x: number; y: number; vx: number; vy: number } | null;

export const letter = (cx: number, cy: number): Letter => ({ cx, cy, k: 0, x: 0, y: 0, vx: 0, vy: 0 });

/** Advances every letter by dt seconds; returns true while anything is still moving. */
export function step(ls: Letter[], p: Pointer, dt: number, f: Feel = FEEL): boolean {
  dt = Math.min(dt, 1 / 30); // a dropped frame must not explode the springs
  const speed = p ? Math.min(1, Math.hypot(p.vx, p.vy) / 1.5) : 0;
  let moving = false;
  for (const l of ls) {
    let tk = 0, tx = 0, ty = 0;
    if (p) {
      const dx = l.cx - p.x, dy = l.cy - p.y, d = Math.hypot(dx, dy);
      const near = Math.max(0, 1 - d / f.radius);
      const fall = near * near * (3 - 2 * near); // smoothstep falloff
      tk = fall * (0.7 + 0.3 * speed); // a resting pointer still excites; moving it excites more
      if (d > 0.01) { tx = (dx / d) * f.push * fall; ty = (dy / d) * f.push * fall; }
      tx += p.vx * f.drag * fall; ty += p.vy * f.drag * fall;
    }
    const rate = tk > l.k ? f.attack : f.release;
    l.k += (tk - l.k) * Math.min(1, rate * dt);
    if (l.k < 0.01 && tk === 0) l.k = 0; // below this no look shows anything
    // semi-implicit Euler on a damped spring towards the target offset
    l.vx += ((tx - l.x) * f.stiff - l.vx * f.damp) * dt;
    l.vy += ((ty - l.y) * f.stiff - l.vy * f.damp) * dt;
    l.x += l.vx * dt; l.y += l.vy * dt;
    if (Math.abs(l.x - tx) + Math.abs(l.y - ty) < 0.02 && Math.abs(l.vx) + Math.abs(l.vy) < 0.05) { l.x = tx; l.y = ty; l.vx = l.vy = 0; }
    else moving = true;
    if (l.k > 0) moving = true;
  }
  return moving || !!p;
}
