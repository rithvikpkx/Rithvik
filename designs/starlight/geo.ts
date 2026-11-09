/** Horizon height (0..1 of the view) for a page scroll s. Must match `HY(s)` in the shader. */
export const hyOf = (s: number) => Math.min(0.2 + 7 * s, 0.34 + 7 * (1 - s));

/** "42.36°N" style coordinate; `pos`/`neg` are the hemisphere letters. */
export const deg = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;

/** Parses a graph edge's quadratic path ("M x y Q cx cy x y") into its six numbers. */
export const quadOf = (d: string): number[] => (d.match(/-?[\d.]+/g) ?? []).map(Number);

/** Squared distance from (lx, ly) to the nearest of five samples along a quadratic curve. */
export function nearestQuad2(q: number[], lx: number, ly: number): number {
  const [x1, y1, cx, cy, x2, y2] = q;
  let best = Infinity;
  for (let i = 0; i <= 4; i++) {
    const t = i / 4, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    const d = (a * x1 + b * cx + c * x2 - lx) ** 2 + (a * y1 + b * cy + c * y2 - ly) ** 2;
    if (d < best) best = d;
  }
  return best;
}
