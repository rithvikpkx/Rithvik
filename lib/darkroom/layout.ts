import { EFFECTS } from "./registry.ts";
import type { Effect } from "./types.ts";

/** The constellation: effects placed in 2D by how alike their tags are. Everything here is deterministic and runs once at load. */

const VOCAB = [...new Set(EFFECTS.flatMap((e) => e.tags))].sort();
const FAMILY_W = 2.2; // extra weight on the family so clusters stay legible

/** Tag vector of an effect: one slot per vocabulary tag, then one per family. */
function vector(e: Effect): number[] {
  const fams = ["print", "pixel", "line", "glitch", "camera"];
  return [...VOCAB.map((t) => (e.tags.includes(t) ? 1 : 0)), ...fams.map((f) => (e.family === f ? FAMILY_W : 0))];
}
const VECS = EFFECTS.map(vector);

const cosine = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
};

/** The `k` effects most alike `id` (cosine over tag vectors, ties broken by catalogue order). */
export function neighbours(id: string, k = 4): Effect[] {
  const i = EFFECTS.findIndex((e) => e.id === id);
  if (i < 0) return [];
  return EFFECTS.map((e, j) => ({ e, s: j === i ? -1 : cosine(VECS[i], VECS[j]) })).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.e);
}

/** Top-2 eigenvectors of a symmetric matrix by power iteration with deflation, from a fixed start so the layout never changes. */
function topTwo(B: number[][]): [number[], number][] {
  const n = B.length, found: [number[], number][] = [];
  for (let c = 0; c < 2; c++) {
    let v = Array.from({ length: n }, (_, i) => Math.sin((i + 1) * (c + 1.3)) + 0.5), lambda = 0;
    for (let it = 0; it < 300; it++) {
      for (const [u] of found) { const d = v.reduce((s, x, i) => s + x * u[i], 0); v = v.map((x, i) => x - d * u[i]); }
      const w = B.map((row) => row.reduce((s, x, j) => s + x * v[j], 0)), norm = Math.hypot(...w) || 1;
      lambda = norm; v = w.map((x) => x / norm);
    }
    found.push([v, lambda]);
  }
  return found;
}

/** Positions in [0.07, 0.93]² (classical MDS of 1 - cosine, pulled toward family centres, then pushed apart so no two dots touch). */
function layout(): { id: string; x: number; y: number }[] {
  const n = EFFECTS.length, D2 = VECS.map((a) => VECS.map((b) => (1 - cosine(a, b)) ** 2));
  const rowMean = D2.map((r) => r.reduce((s, x) => s + x, 0) / n), grand = rowMean.reduce((s, x) => s + x, 0) / n;
  const B = D2.map((r, i) => r.map((x, j) => -0.5 * (x - rowMean[i] - rowMean[j] + grand)));
  const [[v1, l1], [v2, l2]] = topTwo(B);
  let pts = EFFECTS.map((_, i) => [v1[i] * Math.sqrt(l1), v2[i] * Math.sqrt(l2)]);
  const norm = () => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), s = Math.max(x1 - x0, y1 - y0) || 1;
    // one uniform scale keeps distances honest; centre on the leftover axis
    pts = pts.map((p) => [0.07 + ((p[0] - x0) / s) * 0.86 + (0.86 - (x1 - x0) / s) / 2, 0.07 + ((p[1] - y0) / s) * 0.86 + (0.86 - (y1 - y0) / s) / 2]);
  };
  norm();
  const fams = [...new Set(EFFECTS.map((e) => e.family))];
  const centre = (f: string) => { const m = EFFECTS.map((e, i) => (e.family === f ? i : -1)).filter((i) => i >= 0); return [m.reduce((s, i) => s + pts[i][0], 0) / m.length, m.reduce((s, i) => s + pts[i][1], 0) / m.length]; };
  const cs = Object.fromEntries(fams.map((f) => [f, centre(f)]));
  pts = pts.map((p, i) => { const c = cs[EFFECTS[i].family]; return [p[0] + (c[0] - p[0]) * 0.3, p[1] + (c[1] - p[1]) * 0.3]; });
  const MIN = 0.085;
  for (let it = 0; it < 160; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1], d = Math.hypot(dx, dy) || 1e-4;
      if (d >= MIN) continue;
      const push = ((MIN - d) / 2) * 0.6, ux = dx / d || Math.cos(i), uy = dy / d || Math.sin(i);
      pts[i][0] -= ux * push; pts[i][1] -= uy * push; pts[j][0] += ux * push; pts[j][1] += uy * push;
    }
    for (const p of pts) { p[0] = Math.min(0.94, Math.max(0.06, p[0])); p[1] = Math.min(0.94, Math.max(0.06, p[1])); }
  }
  return EFFECTS.map((e, i) => ({ id: e.id, x: pts[i][0], y: pts[i][1] }));
}

export const POSITIONS = layout();
export const POS = new Map(POSITIONS.map((p) => [p.id, p]));

/** Search the catalogue: name hits outrank tag hits outrank description hits. Empty query = everything (score 1). Returns id -> score for matches. */
export function search(query: string): Map<string, number> {
  const toks = query.toLowerCase().split(/[^a-z0-9\-]+/).filter(Boolean), out = new Map<string, number>();
  for (const e of EFFECTS) {
    if (!toks.length) { out.set(e.id, 1); continue; }
    let s = 0;
    for (const t of toks) {
      const name = e.name.toLowerCase();
      if (name.startsWith(t)) s += 5; else if (name.includes(t)) s += 4;
      if (e.tags.some((g) => g === t)) s += 3; else if (e.tags.some((g) => g.startsWith(t) && t.length > 2)) s += 2;
      if (e.family === t) s += 2;
      if (e.desc.toLowerCase().includes(t) && t.length > 2) s += 1;
    }
    if (s > 0) out.set(e.id, s);
  }
  return out;
}
