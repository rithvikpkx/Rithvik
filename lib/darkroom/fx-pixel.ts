import { type Frame, clamp, hash, lumaAt, newFrame, resize, smooth, upscale } from "./frame.ts";
import { type Effect, P } from "./types.ts";
import { INK, PAPER } from "./fx-print.ts";

type RGB = [number, number, number];
/** Retro palettes (dark to light) shared by the dithers. */
export const PALETTES: { name: string; colors: RGB[] }[] = [
  { name: "Ink", colors: [INK, PAPER] },
  { name: "Phosphor", colors: [[6, 22, 12], [102, 255, 140]] },
  { name: "Amber", colors: [[24, 12, 0], [255, 176, 0]] },
  { name: "Game Boy", colors: [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]] },
  { name: "CGA", colors: [[0, 0, 0], [0, 170, 170], [170, 0, 170], [255, 255, 255]] },
];
const PAL_NAMES = PALETTES.map((p) => p.name);

/** Nearest palette colour index by weighted RGB distance. */
function nearest(pal: RGB[], r: number, g: number, b: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) { const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2], d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = i; } }
  return best;
}

/** Error-diffusion dither at 1/scale resolution, blown back up with hard pixels. `kernel` rows are [dx, dy, weight]. */
function diffuse(src: Frame, pal: RGB[], scale: number, contrast: number, kernel: number[][]): Frame {
  const sw = Math.max(8, Math.round(src.w / scale)), sh = Math.max(8, Math.round(src.h / scale)), small = resize(src, sw, sh);
  const buf = new Float32Array(sw * sh * 3);
  for (let i = 0, j = 0; i < sw * sh * 4; i += 4, j += 3) for (let c = 0; c < 3; c++) buf[j + c] = clamp((small.data[i + c] - 128) * contrast + 128, 0, 255);
  const out = newFrame(sw, sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const j = (y * sw + x) * 3, k = nearest(pal, buf[j], buf[j + 1], buf[j + 2]), col = pal[k], o = (y * sw + x) * 4;
    out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]; out.data[o + 3] = 255;
    for (const [dx, dy, wt] of kernel) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= sw || yy >= sh) continue;
      const t = (yy * sw + xx) * 3;
      for (let c = 0; c < 3; c++) buf[t + c] += (buf[j + c] - col[c]) * wt;
    }
  }
  return upscale(out, src.w, src.h);
}

const dither = (id: string, name: string, desc: string, kernel: number[][]): Effect => ({
  id, name, desc, family: "pixel", tags: ["pixel", "1-bit", "retro", "mono", "digital", "diffusion"],
  params: [P("scale", "Pixel size", 1, 6, 0.5, 2), P("pal", "Palette", 0, 4, 1, 0, PAL_NAMES), P("contrast", "Contrast", 0.6, 2, 0.05, 1.15)],
  apply: (src, p, env) => diffuse(src, PALETTES[p.pal].colors, Math.max(1, p.scale * env.k), p.contrast, kernel),
});

const fs = dither("floyd", "Floyd–Steinberg", "Error diffusion spreads each rounding mistake to its neighbours: fine, organic grain.", [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]);
const atkinson = dither("atkinson", "Atkinson", "The original Macintosh dither: crisp, high-contrast, a quarter of the error thrown away on purpose.", [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]]);

/** Recursive Bayer matrix of order n (2^n square), values 0..1. */
function bayer(n: number): number[] {
  let m = [0, 2, 3, 1], s = 2;
  while (s < 2 ** n) {
    const ns = s * 2, next = new Array(ns * ns);
    for (let y = 0; y < ns; y++) for (let x = 0; x < ns; x++) next[y * ns + x] = 4 * m[(y % s) * s + (x % s)] + [0, 2, 3, 1][(y >= s ? 2 : 0) + (x >= s ? 1 : 0)] * 1;
    m = next; s = ns;
  }
  return m.map((v) => (v + 0.5) / (s * s));
}

const bayerFx: Effect = {
  id: "bayer", name: "Bayer Ordered", family: "pixel", tags: ["pixel", "retro", "digital", "ordered", "grid", "1-bit"],
  desc: "Ordered dithering: a fixed threshold matrix gives the woven crosshatch of early game consoles.",
  params: [P("size", "Matrix", 0, 2, 1, 1, ["2×2", "4×4", "8×8"]), P("scale", "Pixel size", 1, 6, 0.5, 2), P("pal", "Palette", 0, 5, 1, 0, [...PAL_NAMES, "Colour"])],
  apply(src, p, env) {
    const scale = Math.max(1, p.scale * env.k), sw = Math.max(8, Math.round(src.w / scale)), sh = Math.max(8, Math.round(src.h / scale)), small = resize(src, sw, sh), order = p.size + 1, M = bayer(order), m = 2 ** order, out = newFrame(sw, sh);
    const colour = p.pal === 5, pal = PALETTES[Math.min(4, p.pal)].colors, spread = colour ? 255 / 3 : 255 / Math.max(1, pal.length - 1);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const o = (y * sw + x) * 4, t = (M[(y % m) * m + (x % m)] - 0.5) * spread;
      if (colour) { for (let c = 0; c < 3; c++) out.data[o + c] = Math.round(clamp(small.data[o + c] + t, 0, 255) / 85) * 85; out.data[o + 3] = 255; continue; }
      const k = nearest(pal, small.data[o] + t, small.data[o + 1] + t, small.data[o + 2] + t), col = pal[k];
      out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]; out.data[o + 3] = 255;
    }
    return upscale(out, src.w, src.h);
  },
};

const CHARSETS = [" .:-=+*#%@", " ░▒▓█", " .1i0O8@", " `.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@"];

const ascii: Effect = {
  id: "ascii", name: "ASCII", family: "pixel", tags: ["text", "mono", "retro", "digital", "terminal", "grid"],
  desc: "The portrait set in type: every cell is a character chosen by its brightness.",
  params: [P("cell", "Cell size", 5, 16, 1, 8), P("set", "Charset", 0, 3, 1, 0, ["Classic", "Blocks", "Binary", "Fine"]), P("ink", "Ink", 0, 2, 1, 0, ["Light on dark", "Dark on light", "Colour"])],
  apply(src, p, env) {
    const cw = Math.max(3, Math.round(p.cell * env.k)), ch = Math.round(cw * 1.8), chars = CHARSETS[p.set], atlas = env.atlas(chars, cw, ch);
    const cols = Math.ceil(src.w / cw), rows = Math.ceil(src.h / ch), small = resize(src, cols, rows), out = newFrame(src.w, src.h);
    const bg = p.ink === 1 ? PAPER : ([10, 12, 11] as RGB), fg = p.ink === 1 ? INK : ([214, 255, 224] as RGB);
    for (let i = 0; i < out.data.length; i += 4) { out.data[i] = bg[0]; out.data[i + 1] = bg[1]; out.data[i + 2] = bg[2]; out.data[i + 3] = 255; }
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const si = (cy * cols + cx) * 4, L = lumaAt(small.data, si), t = p.ink === 1 ? 1 - L : L, g = Math.min(atlas.n - 1, Math.round(clamp((t - 0.04) * 1.08) ** 0.85 * (atlas.n - 1)));
      if (!g) continue;
      const col: RGB = p.ink === 2 ? [Math.min(255, small.data[si] * 1.25), Math.min(255, small.data[si + 1] * 1.25), Math.min(255, small.data[si + 2] * 1.25)] : fg;
      for (let y = 0; y < ch; y++) { const py = cy * ch + y; if (py >= src.h) break; for (let x = 0; x < cw; x++) {
        const px = cx * cw + x, a = atlas.mask[g * cw * ch + y * cw + x] / 255;
        if (px >= src.w || !a) continue;
        const o = (py * src.w + px) * 4;
        out.data[o] += (col[0] - out.data[o]) * a; out.data[o + 1] += (col[1] - out.data[o + 1]) * a; out.data[o + 2] += (col[2] - out.data[o + 2]) * a;
      } }
    }
    return out;
  },
};

const blockify: Effect = {
  id: "blockify", name: "Blockify", family: "pixel", tags: ["pixel", "color", "grid", "digital", "tile", "flat"],
  desc: "Chunky bevelled blocks, each one the average colour of the patch beneath it.",
  params: [P("block", "Block size", 5, 40, 1, 16), P("bevel", "Bevel", 0, 1, 0.05, 0.45)],
  apply(src, p, env) {
    const b = Math.max(2, Math.round(p.block * env.k)), cols = Math.ceil(src.w / b), rows = Math.ceil(src.h / b), small = resize(src, cols, rows), out = newFrame(src.w, src.h);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const cx = Math.min(cols - 1, (x / b) | 0), cy = Math.min(rows - 1, (y / b) | 0), si = (cy * cols + cx) * 4, lx = (x % b) / b, ly = (y % b) / b;
      // light from the top left: the top/left rims lift, the bottom/right rims sink
      const rim = Math.max(0, 0.16 - Math.min(lx, ly)) + 0 - Math.max(0, 0.16 - Math.min(1 - lx, 1 - ly)) * 1.4, k = 1 + (rim / 0.16) * p.bevel * 0.35, o = (y * src.w + x) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = small.data[si + c] * k;
      out.data[o + 3] = 255;
    }
    return out;
  },
};

const threshold: Effect = {
  id: "threshold", name: "Threshold", family: "pixel", tags: ["pixel", "1-bit", "mono", "graphic", "poster", "flat"],
  desc: "Pure black and white: every pixel decides which side of the line it falls on.",
  params: [P("level", "Level", 0.1, 0.9, 0.01, 0.5), P("soft", "Softness", 0, 0.3, 0.01, 0.02)],
  apply(src, p) {
    const out = newFrame(src.w, src.h);
    for (let i = 0; i < src.data.length; i += 4) {
      const a = smooth(p.level - p.soft - 0.001, p.level + p.soft + 0.001, lumaAt(src.data, i));
      for (let c = 0; c < 3; c++) out.data[i + c] = INK[c] + (PAPER[c] - INK[c]) * a;
      out.data[i + 3] = 255;
    }
    return out;
  },
};

// ---- mozayk-style shape mosaic ------------------------------------------------------------------
type Cover = (u: number, v: number, aa: number) => number;
const edge = (d: number, aa: number) => clamp(0.5 - d / aa);
/** Shape coverage functions in cell-local space u,v in [-1, 1], ordered by how much ink they carry. */
const SHAPES: Cover[] = [
  (u, v, aa) => edge(Math.hypot(u, v) - 0.34, aa), // small dot
  (u, v, aa) => edge(Math.abs(Math.hypot(u, v) - 0.66) - 0.17, aa), // ring
  (u, v, aa) => edge(Math.min(Math.abs(u), Math.abs(v)) - 0.2, aa) * edge(Math.max(Math.abs(u), Math.abs(v)) - 0.9, aa), // plus
  (u, v, aa) => edge(Math.max(-u - 0.9, -v - 0.9, (u + v - 0.9) * 0.7071), aa), // right triangle
  (u, v, aa) => edge((Math.abs(u) + Math.abs(v) - 0.95) * 0.7071, aa), // diamond
  (u, v, aa) => edge(Math.max(Math.hypot(u, v) - 0.9, -v), aa), // half disc
  (u, v, aa) => edge(Math.max(Math.hypot(u + 1, v + 1) - 1.9, Math.abs(u) - 1, Math.abs(v) - 1), aa), // quarter disc from the corner
  (u, v, aa) => edge(Math.hypot(u, v) - 0.92, aa), // disc
  (u, v, aa) => edge(Math.max(Math.abs(u), Math.abs(v)) - 0.94, aa), // square
];
const MOZ: RGB[] = [[255, 90, 30], [58, 52, 210], [140, 60, 200], [220, 40, 70]];

const mosaic: Effect = {
  id: "mosaic", name: "Shape Mosaic", family: "pixel", tags: ["geometric", "color", "grid", "graphic", "tile", "random"],
  desc: "A grid of abstract glyphs (dots, rings, quarters, crosses), each cell's shape chosen by tone and spun at random. Reroll the seed for a new print.",
  params: [P("cells", "Cells across", 8, 44, 1, 20), P("seed", "Seed", 0, 99, 1, 3), P("pal", "Palette", 0, 2, 1, 0, ["Mozayk", "Paper", "Image"])],
  apply(src, p) {
    const n = p.cells, cs = src.w / n, rows = Math.ceil(src.h / cs), small = resize(src, n, rows), out = newFrame(src.w, src.h), aa = 2 / cs * 1.2;
    const bg: RGB = p.pal === 1 ? PAPER : [10, 9, 14], inks: RGB[] = p.pal === 1 ? [INK, [210, 60, 40], [40, 60, 150], [30, 120, 90]] : MOZ;
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const gx = Math.min(n - 1, (x / cs) | 0), gy = Math.min(rows - 1, (y / cs) | 0), si = (gy * n + gx) * 4, o = (y * src.w + x) * 4;
      let u = ((x / cs) - gx) * 2 - 1, v = ((y / cs) - gy) * 2 - 1;
      const tone = p.pal === 1 ? 1 - lumaAt(small.data, si) : lumaAt(small.data, si), hr = hash(gx, gy, p.seed), rot = Math.floor(hash(gx, gy, p.seed + 31) * 4);
      let idx = Math.floor(clamp(tone * 1.05 - 0.02) * (SHAPES.length - 0.01));
      if (hash(gx, gy, p.seed + 57) < 0.55) idx = clamp(idx + Math.floor(hash(gx, gy, p.seed + 91) * 5) - 2, 0, SHAPES.length - 1);
      for (let r = 0; r < rot; r++) { const t = u; u = -v; v = t; }
      const cov = SHAPES[idx](u, v, aa), ink = p.pal === 2 ? ([Math.min(255, small.data[si] * 1.15 + 14), Math.min(255, small.data[si + 1] * 1.15 + 14), Math.min(255, small.data[si + 2] * 1.15 + 14)] as RGB) : inks[Math.floor((hr * 0.6 + tone * 0.4) * inks.length) % inks.length];
      for (let c = 0; c < 3; c++) out.data[o + c] = bg[c] + (ink[c] - bg[c]) * cov;
      out.data[o + 3] = 255;
    }
    return out;
  },
};

const dots: Effect = {
  id: "dots", name: "Dot Grid", family: "pixel", tags: ["dots", "color", "grid", "led", "digital", "scifi"],
  desc: "An LED wall: a grid of glowing dots in the source colours, swelling with brightness.",
  params: [P("size", "Pitch", 5, 24, 1, 10), P("gap", "Gap", 0, 0.6, 0.02, 0.18)],
  apply(src, p, env) {
    const s = Math.max(3, p.size * env.k), cols = Math.ceil(src.w / s), rows = Math.ceil(src.h / s), small = resize(src, cols, rows), out = newFrame(src.w, src.h);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const gx = Math.min(cols - 1, (x / s) | 0), gy = Math.min(rows - 1, (y / s) | 0), si = (gy * cols + gx) * 4, L = lumaAt(small.data, si);
      const r = (0.18 + 0.82 * Math.sqrt(L)) * 0.5 * (1 - p.gap) * s, d = Math.hypot(x + 0.5 - (gx + 0.5) * s, y + 0.5 - (gy + 0.5) * s), a = clamp(r - d + 0.5), o = (y * src.w + x) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = 9 + Math.min(255, small.data[si + c] * 1.2) * a;
      out.data[o + 3] = 255;
    }
    return out;
  },
};

export const PIXEL: Effect[] = [ascii, fs, atkinson, bayerFx, blockify, mosaic, dots, threshold];
