// The tether physics: four contact nodes hanging from the portrait on strings. Pure maths, no DOM, so the
// server can render the settled strings and node:test can check it. Units are the 400x500 viewBox.

export const VIEW = { w: 400, h: 500 };
export const PHOTO = { cx: 200, cy: 150, r: 130 };
export const NODE_Y = 440;
export const NODE_R = 26; // half the node's box; strings tie on to its top edge
export const NODE_X = [56, 152, 248, 344];

const SEGS = 8; // points per string = SEGS + 1; enough for a smooth curve, cheap to relax
const SLACK = 1.035; // rope length over the straight distance: the sag that gives the old rounded curve
const GRAVITY = 900;
const DAMP = 0.978; // verlet velocity kept per substep
const K = 170, C = 8.5; // node spring and damper: under-damped, so a drop bounces two or three times
const H = 1 / 120; // fixed substep: the same motion at 60 Hz and 120 Hz
const ITER = 6;

export type TNode = { rx: number; ry: number; ox: number; oy: number; vx: number; vy: number; held: boolean; wait: number };
export type TString = { ax: number; ay: number; seg: number; p: Float64Array; q: Float64Array }; // p = now, q = previous
export type World = { nodes: TNode[]; strings: TString[]; acc: number };

/** Where string `i` leaves the photo: on the rim, squeezed toward the bottom so the strings gather like the old hero. */
function anchor(i: number): [number, number] {
  const a = Math.atan2(NODE_Y - PHOTO.cy, NODE_X[i] - PHOTO.cx);
  const t = Math.PI / 2 + (a - Math.PI / 2) * 0.6;
  return [PHOTO.cx + PHOTO.r * Math.cos(t), PHOTO.cy + PHOTO.r * Math.sin(t)];
}

/** A fresh world with every node at rest and every string hanging still. */
export function createWorld(): World {
  const nodes = NODE_X.map((x) => ({ rx: x, ry: NODE_Y, ox: 0, oy: 0, vx: 0, vy: 0, held: false, wait: 0 }));
  const strings = NODE_X.map((x, i) => {
    const [ax, ay] = anchor(i), bx = x, by = NODE_Y - NODE_R;
    const p = new Float64Array((SEGS + 1) * 2);
    for (let j = 0; j <= SEGS; j++) { p[j * 2] = ax + ((bx - ax) * j) / SEGS; p[j * 2 + 1] = ay + ((by - ay) * j) / SEGS; }
    return { ax, ay, seg: (Math.hypot(bx - ax, by - ay) * SLACK) / SEGS, p, q: p.slice() };
  });
  const w = { nodes, strings, acc: 0 };
  settle(w);
  return w;
}

/** One fixed substep: node springs, then rope points (verlet + one-sided length constraints). Returns the largest
 *  movement this substep, so the caller can tell when everything is at rest. */
function substep(w: World): number {
  let moved = 0;
  for (const n of w.nodes) {
    if (n.held) continue;
    if (n.wait > 0) { n.wait -= H; continue; }
    n.vx += (-K * n.ox - C * n.vx) * H; n.vy += (-K * n.oy - C * n.vy) * H;
    n.ox += n.vx * H; n.oy += n.vy * H;
    if (Math.abs(n.ox) + Math.abs(n.oy) > 0.1) moved = Math.max(moved, 0.01); // still away from home
    moved = Math.max(moved, Math.abs(n.vx * H), Math.abs(n.vy * H));
  }
  w.strings.forEach((s, i) => {
    const n = w.nodes[i], { p, q } = s, last = SEGS * 2;
    for (let j = 2; j < last; j += 2) {
      const x = p[j], y = p[j + 1];
      const nx = x + (x - q[j]) * DAMP, ny = y + (y - q[j + 1]) * DAMP + GRAVITY * H * H;
      q[j] = x; q[j + 1] = y; p[j] = nx; p[j + 1] = ny;
    }
    p[0] = s.ax; p[1] = s.ay; p[last] = n.rx + n.ox; p[last + 1] = n.ry - NODE_R + n.oy;
    for (let it = 0; it < ITER; it++) {
      for (let j = 0; j < last; j += 2) {
        const dx = p[j + 2] - p[j], dy = p[j + 3] - p[j + 1], d = Math.hypot(dx, dy);
        if (d <= s.seg) continue; // a rope only resists stretching; slack is free to droop
        const f = (d - s.seg) / d;
        const fa = j === 0 ? 0 : j + 2 === last ? 1 : 0.5, fb = j + 2 === last ? 0 : j === 0 ? 1 : 0.5; // pinned ends never move
        p[j] += dx * f * fa; p[j + 1] += dy * f * fa;
        p[j + 2] -= dx * f * fb; p[j + 3] -= dy * f * fb;
      }
    }
    // measured after the constraints: gravity alone nudges a resting rope every substep
    for (let j = 2; j < last; j += 2) moved = Math.max(moved, Math.abs(p[j] - q[j]), Math.abs(p[j + 1] - q[j + 1]));
  });
  return moved;
}

/** Advances the world by `dt` seconds of wall time. Returns true while anything is still moving. */
export function step(w: World, dt: number): boolean {
  w.acc += Math.min(dt, 1 / 20); // a long frame (tab switch) is clamped instead of exploding the springs
  let moved = 0;
  while (w.acc >= H) { moved = Math.max(moved, substep(w)); w.acc -= H; }
  return moved > 0.005 || w.nodes.some((n) => n.held || n.wait > 0);
}

/** Runs the world until it is still (bounded, so a bad state can never hang). */
export function settle(w: World): void {
  for (let i = 0; i < 4000; i++) if (substep(w) < 0.0005 && i > 60) break;
  w.nodes.forEach((n) => { n.ox = n.oy = n.vx = n.vy = 0; });
}

/** The opening: every node starts up against the photo and drops, one after another. */
export function drop(w: World): void {
  w.nodes.forEach((n, i) => {
    const s = w.strings[i];
    n.ox = (s.ax - n.rx) * 0.75; n.oy = (s.ay + 24 - n.ry) * 0.9;
    n.vx = n.vy = 0; n.wait = 0.18 + i * 0.08;
  });
}

/** A tug on node `i` (hover or tap): a downward kick with a little sideways sway. */
export function tug(w: World, i: number, side = 0): void {
  const n = w.nodes[i];
  if (n.held) return;
  n.vy += 150; n.vx += side * 60;
}

/** Holds node `i` at an offset from its rest point (drag), clamped to a soft radius so it never leaves the page. */
export function hold(w: World, i: number, ox: number, oy: number): void {
  const n = w.nodes[i], r = Math.hypot(ox, oy), max = 90;
  const k = r > max ? (max + (r - max) * 0.2) / r : 1; // past the radius it gets heavy instead of stopping dead
  const nx = ox * k, ny = oy * k;
  n.vx = (nx - n.ox) / H / 8; n.vy = (ny - n.oy) / H / 8; // a gentle fling on release
  n.ox = nx; n.oy = ny; n.held = true;
}

/** Lets go of node `i`; its spring takes it home. */
export function release(w: World, i: number): void { w.nodes[i].held = false; }

/** The string as an SVG path: quadratic segments through the midpoints, so the curve stays smooth. */
export function pathOf(s: TString): string {
  const p = s.p, n = p.length / 2, f = (v: number) => v.toFixed(1);
  let d = `M${f(p[0])} ${f(p[1])}`;
  for (let j = 1; j < n - 1; j++) {
    const mx = (p[j * 2] + p[j * 2 + 2]) / 2, my = (p[j * 2 + 1] + p[j * 2 + 3]) / 2;
    d += `Q${f(p[j * 2])} ${f(p[j * 2 + 1])} ${f(mx)} ${f(my)}`;
  }
  return d + `L${f(p[(n - 1) * 2])} ${f(p[(n - 1) * 2 + 1])}`;
}
