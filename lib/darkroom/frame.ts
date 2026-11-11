/** Pixel plumbing shared by every Darkroom effect: a plain RGBA frame (no canvas, so it runs in a worker and under node) and a few small kernels. */

export type Frame = { w: number; h: number; data: Uint8ClampedArray };

/** Per-run context: `k` scales pixel sizes to the frame width (1 at 512px), `t` is seconds for animated effects. */
export type Env = { k: number; t: number; atlas: (chars: string, cw: number, ch: number) => Atlas };
/** Glyph coverage masks: glyph i occupies `cw*ch` bytes at i*cw*ch (0..255). */
export type Atlas = { cw: number; ch: number; n: number; mask: Uint8Array };

export const newFrame = (w: number, h: number): Frame => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });
export const cloneFrame = (f: Frame): Frame => ({ w: f.w, h: f.h, data: new Uint8ClampedArray(f.data) });

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Rec. 709 luma, 0..1, of the pixel starting at byte index i. */
export const lumaAt = (d: Uint8ClampedArray, i: number) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

/** Luma plane of a frame, Float32 0..1. */
export function lumaPlane(f: Frame): Float32Array {
  const out = new Float32Array(f.w * f.h);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) out[p] = lumaAt(f.data, i);
  return out;
}

/** Deterministic 32-bit integer hash to 0..1 (two integer inputs and a seed). */
export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise (bilinear on hashed lattice), 0..1. */
export function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
}

/** Fractal value noise, 3 octaves, 0..1. */
export const fbm = (x: number, y: number, s = 0) => (vnoise(x, y, s) * 0.55 + vnoise(x * 2, y * 2, s + 7) * 0.3 + vnoise(x * 4, y * 4, s + 13) * 0.15);

/** Clamped nearest read of a frame's channel at integer coordinates. */
export const px = (f: Frame, x: number, y: number, c: number) => f.data[((clamp(y, 0, f.h - 1) | 0) * f.w + (clamp(x, 0, f.w - 1) | 0)) * 4 + c];

/** Bilinear sample of channel c at float coordinates. */
export function bilinear(f: Frame, x: number, y: number, c: number): number {
  x = clamp(x, 0, f.w - 1); y = clamp(y, 0, f.h - 1);
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(f.w - 1, x0 + 1), y1 = Math.min(f.h - 1, y0 + 1), fx = x - x0, fy = y - y0, d = f.data, w = f.w;
  const a = d[(y0 * w + x0) * 4 + c], b = d[(y0 * w + x1) * 4 + c], e = d[(y1 * w + x0) * 4 + c], g = d[(y1 * w + x1) * 4 + c];
  return lerp(lerp(a, b, fx), lerp(e, g, fx), fy);
}

/** Box-averaged downscale to (w, h) (or bilinear if upscaling); used by pixel-grid effects. */
export function resize(f: Frame, w: number, h: number): Frame {
  const out = newFrame(w, h), sx = f.w / w, sy = f.h / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (sx <= 1 && sy <= 1) { for (let c = 0; c < 3; c++) out.data[o + c] = bilinear(f, (x + 0.5) * sx - 0.5, (y + 0.5) * sy - 0.5, c); out.data[o + 3] = 255; continue; }
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = y0; yy < y1 && yy < f.h; yy++) for (let xx = x0; xx < x1 && xx < f.w; xx++) { const i = (yy * f.w + xx) * 4; r += f.data[i]; g += f.data[i + 1]; b += f.data[i + 2]; n++; }
    out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
  }
  return out;
}

/** Nearest-neighbour upscale to (w, h): the blocky final step of every low-resolution look. */
export function upscale(f: Frame, w: number, h: number): Frame {
  const out = newFrame(w, h);
  for (let y = 0; y < h; y++) { const sy = Math.min(f.h - 1, Math.floor((y * f.h) / h)); for (let x = 0; x < w; x++) {
    const i = (sy * f.w + Math.min(f.w - 1, Math.floor((x * f.w) / w))) * 4, o = (y * w + x) * 4;
    out.data[o] = f.data[i]; out.data[o + 1] = f.data[i + 1]; out.data[o + 2] = f.data[i + 2]; out.data[o + 3] = 255;
  } }
  return out;
}

/** Separable box blur of a Float32 plane, radius r (two passes read as a soft tent). */
export function blurPlane(src: Float32Array, w: number, h: number, r: number): Float32Array {
  r = Math.max(0, Math.round(r));
  if (!r) return src;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0; const row = y * w;
    for (let x = -r; x <= r; x++) s += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[row + x] = s / n; s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = s / n; s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return out;
}

/** Writes an opaque colour into the frame at pixel (x, y). */
export function put(f: Frame, x: number, y: number, r: number, g: number, b: number) {
  const o = (y * f.w + x) * 4;
  f.data[o] = r; f.data[o + 1] = g; f.data[o + 2] = b; f.data[o + 3] = 255;
}

/** Hex "#rrggbb" to [r,g,b]. */
export const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** HSL (h 0..360, s,l 0..1) to [r,g,b] 0..255. */
export function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Piecewise-linear colour ramp lookup: stops are [position 0..1, r, g, b]. */
export function ramp(stops: number[][], v: number): [number, number, number] {
  v = clamp(v);
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const a = stops[i - 1], b = stops[i], t = (v - a[0]) / (b[0] - a[0] || 1);
    return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
  }
  const l = stops[stops.length - 1];
  return [l[1], l[2], l[3]];
}
