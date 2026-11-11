/** Pure helpers for Flux's motion: no DOM, unit-tested in view.test.ts. "View units" match the shader: y runs -1
 *  (bottom) to 1 (top) over the viewport height, x runs -aspect..aspect, the centre is 0. */

export type Vec2 = [number, number];

/** A viewport point (CSS px, y down) in view units. */
export function toView(x: number, y: number, w: number, h: number): Vec2 {
  return [(x / w * 2 - 1) * (w / h), 1 - (y / h) * 2];
}

/** A viewport box (CSS px) as its centre and half size in view units. */
export function boxToView(left: number, top: number, width: number, height: number, w: number, h: number): [number, number, number, number] {
  const [x, y] = toView(left + width / 2, top + height / 2, w, h);
  return [x, y, width / h, height / h];
}

/** One semi-implicit Euler step of a damped spring toward `target` (stiffness `k`, damping `c`); returns [x, v]. */
export function spring(x: number, v: number, target: number, dt: number, k: number, c: number): Vec2 {
  const nv = v + ((target - x) * k - v * c) * dt;
  return [x + nv * dt, nv];
}

/** A stroke gust's `kind`: 2 + the stroke's angle in [0, 2π) (the shader reads kinds 0 and 1 as burst / implosion). */
export function strokeKind(dx: number, dy: number): number {
  const a = Math.atan2(dy, dx);
  return 2 + (a < 0 ? a + Math.PI * 2 : a);
}

