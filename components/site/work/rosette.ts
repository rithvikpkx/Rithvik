// Geometry for the Work rosette: one disc cut into a facet per project. Pure, so the detents are testable.

const f = (n: number) => Math.round(n * 100) / 100;

/** CSS clip-path for facet i of n: an annular wedge centred on angle i·(360/n), 0° = pointing right. */
export function wedgeClip(i: number, n: number, hole: number): string {
  const s = 360 / n, a0 = i * s - s / 2, a1 = i * s + s / 2, steps = Math.max(2, Math.ceil(s / 6));
  const pt = (deg: number, r: number) => { const a = (deg * Math.PI) / 180; return `${f(50 + 50 * r * Math.cos(a))}% ${f(50 + 50 * r * Math.sin(a))}%`; };
  const arc = (r: number, from: number, to: number) => Array.from({ length: steps + 1 }, (_, k) => pt(from + ((to - from) * k) / steps, r));
  return `polygon(${[...arc(1, a0, a1), ...(hole > 0 ? arc(hole, a1, a0) : ["50% 50%"])].join(",")})`;
}

/** Unit vector of facet i's middle, for pushing it out of the disc. */
export const facetDir = (i: number, n: number): [number, number] => {
  const a = ((i * 360) / n) * (Math.PI / 180);
  return [f(Math.cos(a)), f(Math.sin(a))];
};

/** The disc rotation that brings facet i to the reading side (0°), taking the shortest way from `rot`. */
export function rotationFor(i: number, n: number, rot: number): number {
  const base = (-i * 360) / n;
  return base + 360 * Math.round((rot - base) / 360);
}

/** Which facet a spin coming to rest at `rot` lands on (the detent nearest the reading side). */
export function facetAt(rot: number, n: number): number {
  const k = Math.round((-rot * n) / 360);
  return ((k % n) + n) % n;
}
