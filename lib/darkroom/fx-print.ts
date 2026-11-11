import { bilinear, blurPlane, clamp, hash, lumaPlane, newFrame, resize, smooth, vnoise } from "./frame.ts";
import { type Effect, P } from "./types.ts";

export const PAPER: [number, number, number] = [243, 239, 230];
export const INK: [number, number, number] = [21, 19, 15];

/** Bilinear read of a Float32 plane. */
function sample(pl: Float32Array, w: number, h: number, x: number, y: number): number {
  x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1);
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  return (pl[y0 * w + x0] * (1 - fx) + pl[y0 * w + x1] * fx) * (1 - fy) + (pl[y1 * w + x0] * (1 - fx) + pl[y1 * w + x1] * fx) * fy;
}

/** Ink coverage (0..1) of an amplitude-modulated halftone screen: round dots on a rotated grid, their radius following `ink` (a plane, 0 = no ink). */
export function screen(ink: Float32Array, w: number, h: number, size: number, angle: number, dx = 0, dy = 0): Float32Array {
  const out = new Float32Array(w * h), c = Math.cos(angle), s = Math.sin(angle), soft = blurPlane(ink, w, h, size * 0.35);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x - dx, Y = y - dy, u = (X * c + Y * s) / size, v = (-X * s + Y * c) / size, ci = Math.floor(u), cj = Math.floor(v);
    let best = 0;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      // the dot's centre back in image space, where the tone is read
      const ux = (i + 0.5) * size, uy = (j + 0.5) * size, ix = ux * c - uy * s + dx, iy = ux * s + uy * c + dy;
      const a = sample(soft, w, h, ix, iy);
      if (a <= 0.004) continue;
      const r = Math.sqrt(a) * size * 0.64, d = Math.hypot(u - i - 0.5, v - j - 0.5) * size;
      const cov = clamp(r - d + 0.5);
      if (cov > best) best = cov;
    }
    out[y * w + x] = best;
  }
  return out;
}

const halftone: Effect = {
  id: "halftone", name: "Halftone", family: "print", tags: ["print", "dots", "mono", "analog", "newspaper", "grid"],
  desc: "A newspaper screen: tone becomes round ink dots on a tilted grid.",
  params: [P("size", "Dot pitch", 3, 24, 1, 8), P("angle", "Angle", 0, 90, 1, 45)],
  apply(src, p, env) {
    const { w, h } = src, pl = lumaPlane(src), ink = new Float32Array(pl.length);
    for (let i = 0; i < pl.length; i++) ink[i] = 1 - pl[i];
    const cov = screen(ink, w, h, p.size * env.k, (p.angle * Math.PI) / 180), out = newFrame(w, h);
    for (let i = 0, o = 0; i < cov.length; i++, o += 4) {
      for (let c = 0; c < 3; c++) out.data[o + c] = PAPER[c] + (INK[c] - PAPER[c]) * cov[i];
      out.data[o + 3] = 255;
    }
    return out;
  },
};

const INKS: [number, number, number][] = [[0, 174, 239], [236, 0, 140], [255, 242, 0], [35, 31, 32]];

const cmyk: Effect = {
  id: "cmyk", name: "CMYK Press", family: "print", tags: ["print", "dots", "color", "analog", "magazine", "grid"],
  desc: "Four misregistered ink screens (cyan, magenta, yellow, black) layered like a glossy magazine plate.",
  params: [P("size", "Dot pitch", 4, 20, 1, 8), P("shift", "Misregister", 0, 4, 0.1, 1.2)],
  apply(src, p, env) {
    const { w, h, data } = src, n = w * h, planes = [0, 1, 2, 3].map(() => new Float32Array(n));
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255, k = 1 - Math.max(r, g, b), d = 1 - k || 1;
      planes[0][i] = (1 - r - k) / d; planes[1][i] = (1 - g - k) / d; planes[2][i] = (1 - b - k) / d; planes[3][i] = k;
    }
    const size = p.size * env.k, sh = p.shift * env.k, angles = [15, 75, 0, 45];
    const covs = planes.map((pl, i) => screen(pl, w, h, size, (angles[i] * Math.PI) / 180, Math.cos(i * 1.7) * sh, Math.sin(i * 1.7) * sh));
    const out = newFrame(w, h);
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      let r = PAPER[0], g = PAPER[1], b = PAPER[2];
      for (let j = 0; j < 4; j++) { const cv = covs[j][i], ink = INKS[j]; r *= 1 - cv + (cv * ink[0]) / 255; g *= 1 - cv + (cv * ink[1]) / 255; b *= 1 - cv + (cv * ink[2]) / 255; }
      out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255;
    }
    return out;
  },
};

const pointillism: Effect = {
  id: "pointillism", name: "Pointillism", family: "print", tags: ["painterly", "dots", "color", "analog", "organic", "noise"],
  desc: "Thousands of loose paint dabs, each carrying the colour beneath it.",
  params: [P("dot", "Dab size", 3, 14, 1, 6), P("density", "Density", 0.6, 3, 0.1, 1.6), P("seed", "Seed", 0, 99, 1, 11)],
  apply(src, p, env) {
    const { w, h } = src, r0 = p.dot * env.k, out = newFrame(w, h), data = out.data;
    const wash = resize(resize(src, 24, 24), w, h); // underpainting: a blurred, slightly deepened copy so gaps read as canvas
    for (let i = 0; i < data.length; i += 4) { data[i] = wash.data[i] * 0.86; data[i + 1] = wash.data[i + 1] * 0.86; data[i + 2] = wash.data[i + 2] * 0.86; data[i + 3] = 255; }
    const count = Math.round((p.density * w * h) / (Math.PI * r0 * r0 * 0.55));
    for (let n = 0; n < count; n++) {
      const x = hash(n, 1, p.seed) * w, y = hash(n, 2, p.seed) * h, r = r0 * (0.55 + hash(n, 3, p.seed) * 0.9);
      let cr = bilinear(src, x, y, 0), cg = bilinear(src, x, y, 1), cb = bilinear(src, x, y, 2);
      const m = (cr + cg + cb) / 3, jit = (hash(n, 4, p.seed) - 0.5) * 46;
      cr = clamp(m + (cr - m) * 1.35 + jit, 0, 255); cg = clamp(m + (cg - m) * 1.35 + jit * 0.5, 0, 255); cb = clamp(m + (cb - m) * 1.35 - jit * 0.4, 0, 255);
      const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(w - 1, Math.ceil(x + r + 1)), y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(h - 1, Math.ceil(y + r + 1));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const a = clamp(r - Math.hypot(xx + 0.5 - x, yy + 0.5 - y) + 0.5);
        if (a <= 0) continue;
        const o = (yy * w + xx) * 4;
        data[o] += (cr - data[o]) * a; data[o + 1] += (cg - data[o + 1]) * a; data[o + 2] += (cb - data[o + 2]) * a;
      }
    }
    return out;
  },
};

const crosshatch: Effect = {
  id: "crosshatch", name: "Crosshatch", family: "print", tags: ["print", "lines", "mono", "analog", "drawing", "engraving"],
  desc: "Pen-and-ink shading: darker tones earn more layers of hatching.",
  params: [P("pitch", "Line gap", 3, 14, 0.5, 6), P("angle", "Angle", 0, 90, 1, 40), P("wobble", "Hand wobble", 0, 1, 0.05, 0.4)],
  apply(src, p, env) {
    const { w, h } = src, pl = blurPlane(lumaPlane(src), w, h, 1), out = newFrame(w, h), s = p.pitch * env.k;
    const layers = [[0, 0.78], [90, 0.56], [45, 0.38], [-45, 0.2]]; // [angle offset, tone below which this layer is drawn]
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const L = pl[y * w + x], wob = (vnoise(x / (30 * env.k), y / (30 * env.k), 5) - 0.5) * p.wobble * s * 1.6;
      let ink = 0;
      for (let j = 0; j < 4; j++) {
        const a = ((p.angle + layers[j][0]) * Math.PI) / 180, d = (x * Math.cos(a) + y * Math.sin(a) + wob) / (j === 3 ? s * 0.7 : s);
        const dist = Math.abs(d - Math.round(d)) * s, wd = 0.45 * env.k + (layers[j][1] - L) * s * 0.35;
        const line = clamp(wd - dist + 0.5) * smooth(0, 0.08, layers[j][1] - L);
        ink = Math.max(ink, line);
      }
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = PAPER[c] + (INK[c] - PAPER[c]) * ink;
      out.data[o + 3] = 255;
    }
    return out;
  },
};

export const PRINT: Effect[] = [halftone, cmyk, pointillism, crosshatch];
