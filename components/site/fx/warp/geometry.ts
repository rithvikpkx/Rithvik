/* Pure geometry for the cursor warp: a rounded rectangle whose straight edges are splines through control points
   that each carry a spring, so the silhouette dents away from the pointer and wobbles back. No DOM in here. */

/** Corner radii, clockwise from the top-left: tl, tr, br, bl. */
export type Radii = [number, number, number, number];

/** One control point on a straight edge: its rest position, the inward normal, and how far it is from the edge's ends. */
export interface Ctrl { x: number; y: number; nx: number; ny: number; edge: number; a: number }

interface Edge { ax: number; ay: number; bx: number; by: number; nx: number; ny: number }

const f = (n: number) => (Math.round(n * 10) / 10).toString();
const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** Radii clamped so adjacent corners never overlap. */
export function clampRadii(r: Radii, w: number, h: number): Radii {
  const m = Math.min(w, h) / 2;
  return r.map((v) => Math.max(0, Math.min(v || 0, m))) as Radii;
}

/** The four straight edges (top, right, bottom, left, clockwise) between the corner arcs, each with its inward normal. */
export function edges(w: number, h: number, radii: Radii): Edge[] {
  const [tl, tr, br, bl] = clampRadii(radii, w, h);
  return [
    { ax: tl, ay: 0, bx: w - tr, by: 0, nx: 0, ny: 1 },
    { ax: w, ay: tr, bx: w, by: h - br, nx: -1, ny: 0 },
    { ax: w - br, ay: h, bx: bl, by: h, nx: 0, ny: -1 },
    { ax: 0, ay: h - bl, bx: 0, by: tl, nx: 1, ny: 0 },
  ];
}

/** Control points along every edge, roughly `spacing` px apart; the edge ends (the corner joins) are fixed anchors, not control points. */
export function buildCtrl(w: number, h: number, radii: Radii, spacing = 22): Ctrl[] {
  const out: Ctrl[] = [];
  edges(w, h, radii).forEach((e, edge) => {
    const len = Math.hypot(e.bx - e.ax, e.by - e.ay);
    const m = Math.max(0, Math.round(len / spacing) - 1);
    for (let i = 1; i <= m; i++) {
      const t = i / (m + 1);
      out.push({ x: e.ax + (e.bx - e.ax) * t, y: e.ay + (e.by - e.ay) * t, nx: e.nx, ny: e.ny, edge, a: Math.min(t, 1 - t) * len });
    }
  });
  return out;
}

/** The dent each control point is pulled toward: a Gaussian of its distance to the pointer, eased to zero near the corners.
 *  `scale` lowers it (pointer already over the card, or a touch press). Writes into `out` (one value per control point). */
export function dentTargets(ctrl: Ctrl[], px: number, py: number, depth: number, sigma: number, scale: number, out: Float32Array | number[]): void {
  for (let i = 0; i < ctrl.length; i++) {
    const c = ctrl[i], d = Math.hypot(c.x - px, c.y - py) / sigma;
    out[i] = depth * scale * Math.exp(-d * d) * smooth(c.a / 40);
  }
}

/** Advances every spring (x = displacement, v = velocity) toward `target` with semi-implicit Euler in fixed substeps; returns the largest remaining |error| or |velocity| so callers can tell when it has settled. */
export function stepSprings(x: Float32Array, v: Float32Array, target: ArrayLike<number>, dt: number, k = 190, c = 13): number {
  const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
  let rest = 0;
  for (let i = 0; i < x.length; i++) {
    for (let s = 0; s < n; s++) { v[i] += (k * (target[i] - x[i]) - c * v[i]) * h; x[i] += v[i] * h; }
    rest = Math.max(rest, Math.abs(x[i] - target[i]), Math.abs(v[i]));
  }
  return rest;
}

/** The SVG path (valid for `clip-path: path()`) of the rounded rect with each control point pushed `d[i]` px inward along its normal.
 *  Each edge is a Hermite spline whose end tangents run along the edge, so it joins the anchored corner arcs without a kink. */
export function warpPath(w: number, h: number, radii: Radii, ctrl: Ctrl[], d: ArrayLike<number>): string {
  const es = edges(w, h, radii), rr = clampRadii(radii, w, h);
  const arc = [rr[1], rr[2], rr[3], rr[0]]; // the corner after each edge: tr, br, bl, tl
  let out = `M${f(es[0].ax)} ${f(es[0].ay)}`, k = 0;
  es.forEach((e, ei) => {
    const pts: number[][] = [[e.ax, e.ay]];
    for (; k < ctrl.length && ctrl[k].edge === ei; k++) pts.push([ctrl[k].x + ctrl[k].nx * d[k], ctrl[k].y + ctrl[k].ny * d[k]]);
    pts.push([e.bx, e.by]);
    const len = Math.hypot(e.bx - e.ax, e.by - e.ay) || 1, ux = (e.bx - e.ax) / len, uy = (e.by - e.ay) / len;
    const tan = pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) { const o = pts[i === 0 ? 1 : i - 1], m = Math.hypot(o[0] - p[0], o[1] - p[1]); return [ux * m, uy * m]; }
      return [(pts[i + 1][0] - pts[i - 1][0]) / 2, (pts[i + 1][1] - pts[i - 1][1]) / 2];
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], a = tan[i], b = tan[i + 1];
      out += `C${f(p[0] + a[0] / 3)} ${f(p[1] + a[1] / 3)} ${f(q[0] - b[0] / 3)} ${f(q[1] - b[1] / 3)} ${f(q[0])} ${f(q[1])}`;
    }
    const next = es[(ei + 1) % 4];
    out += arc[ei] > 0 ? `A${f(arc[ei])} ${f(arc[ei])} 0 0 1 ${f(next.ax)} ${f(next.ay)}` : "";
  });
  return `${out}Z`;
}
