// The contact cloud's physics: four buttons that orbit a common centre on slightly different loops, each pulled
// to its moving home by a soft spring, pushed apart so none overlap, and drawn toward the pointer. Pure maths (no DOM),
// so node:test can check it. Units are CSS px inside a W x H box.

export type Body = { x: number; y: number; vx: number; vy: number };
export type Box = { w: number; h: number; size: number }; // size = a button's diameter

const N = 4;
const SPEED = [0.17, 0.13, 0.2, 0.15]; // rad/s: the loops differ, so the formation slowly rearranges itself
const LOOP = [1, 0.78, 0.92, 0.7]; // each button's share of the orbit radius
const PHASE = [0.8, 0.8 + Math.PI / 2, 0.8 + Math.PI, 0.8 + (3 * Math.PI) / 2];
const K = 15, C = 5; // spring and damper: soft, under-damped
const REPEL = 70; // how hard two buttons that touch push apart
const PULL = 11; // how hard the pointer draws a button in (the home spring is K)

/** Where button `i` wants to be at time `t`: an ellipse around the box centre plus a slow bob. t = 0 is the neat still arrangement. */
export function home(i: number, t: number, { w, h, size }: Box): [number, number] {
  const rx = Math.max(0, w / 2 - size * 0.9) * LOOP[i], ry = Math.max(0, h / 2 - size * 0.8) * LOOP[i];
  const a = PHASE[i] + SPEED[i] * t;
  return [w / 2 + rx * Math.cos(a), h / 2 + ry * Math.sin(a) + 7 * Math.sin(t * 0.9 + i * 1.7) * Math.min(1, t)];
}

/** The still arrangement (reduced motion, performance mode, first paint). */
export function rest(box: Box): Body[] {
  return Array.from({ length: N }, (_, i) => { const [x, y] = home(i, 0, box); return { x, y, vx: 0, vy: 0 }; });
}

/** Advances every body by `dt` seconds at time `t`; `pointer` (box coords or null) draws nearby buttons toward it. */
export function step(bs: Body[], t: number, dt: number, box: Box, pointer: [number, number] | null): void {
  const min = box.size * 1.28, r = box.size / 2;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i], [hx, hy] = home(i, t, box);
    let ax = K * (hx - b.x) - C * b.vx, ay = K * (hy - b.y) - C * b.vy;
    for (let j = 0; j < bs.length; j++) {
      if (j === i) continue;
      const dx = b.x - bs[j].x, dy = b.y - bs[j].y, d = Math.hypot(dx, dy) || 0.001;
      if (d < min) { const f = ((min - d) * REPEL) / d; ax += dx * f; ay += dy * f; }
    }
    if (pointer) {
      // a pull that fades with distance and vanishes at the cursor, so a button leans in without jittering under it
      const dx = pointer[0] - b.x, dy = pointer[1] - b.y, d = Math.hypot(dx, dy), reach = box.size * 3.2;
      if (d < reach) { const f = PULL * (1 - d / reach); ax += dx * f; ay += dy * f; }
    }
    b.vx += ax * dt; b.vy += ay * dt;
  }
  for (const b of bs) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.x = Math.min(box.w - r, Math.max(r, b.x)); b.y = Math.min(box.h - r, Math.max(r, b.y)); // never leave the box
  }
}
