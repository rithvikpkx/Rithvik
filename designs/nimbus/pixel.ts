// Nimbus pixel art + the visitor's sky, ported 1:1 from docs/mockups/v7/themes/nimbus.js. Every helper
// returns an SVG string built from our own constants (never user input), rendered via innerHTML so the
// thousands of 1-unit rects stay out of React's tree.
import type { ShaderSpec } from "@/lib/designs/types";

type Grid = { w: number; h: number; c: string[] };
type Map = Record<string, string>;

/* ───────── the visitor's sky: four palettes keyed to their local hour ───────── */
export type SkyKey = "dawn" | "day" | "dusk" | "night";
export const SKIES: Record<SkyKey, { label: string; c: [string, string, string, string] }> = {
  dawn: { label: "Dawn", c: ["#FFFFFF", "#FFE3D2", "#9ED0FF", "#4AACFF"] },
  day: { label: "Daylight", c: ["#FFFFFF", "#C4E6FF", "#6CC4FF", "#0A9BFF"] },
  dusk: { label: "Golden hour", c: ["#FFF9F1", "#FFD8BC", "#F5A5AA", "#6E7FE4"] },
  night: { label: "Night sky", c: ["#F1F4FF", "#BFC9F5", "#6E7ED5", "#38479C"] },
};

/** Sky band for a local hour (0..24). */
export const skyOf = (h: number): SkyKey => (h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night");
/** Daytime test used by the forecast card and place clocks. */
export const isDay = (h: number) => h >= 6 && h < 19;
/** Current hour (0..23) in an IANA zone. */
export const hourIn = (tz: string) => parseInt(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()), 10) % 24;

/** The visitor's hour, or `?hour=` for screenshots/QA. */
export function visitorHour(search: string, now = new Date()): number {
  const q = new URLSearchParams(search).get("hour");
  return q !== null && q !== "" && !isNaN(+q) ? ((+q % 24) + 24) % 24 : now.getHours() + now.getMinutes() / 60;
}

/** The registry's shader with the sun/moon baked onto the visitor's hour and their sky's palette. */
export function skyShader(base: ShaderSpec, hr: number): ShaderSpec {
  const sky = skyOf(hr), night = sky === "night";
  const fr = Math.min(1, Math.max(0, night ? ((hr - 18 + 24) % 24) / 12 : (hr - 6) / 12));
  const sx = 0.14 + 0.72 * fr, sy = 0.6 + 0.28 * Math.sin(Math.PI * fr);
  const source = base.source
    .replace(/#define SUN vec2\([^)]*\)/, `#define SUN vec2(${sx.toFixed(3)}, ${sy.toFixed(3)})`)
    .replace(/#define NIGHT [\d.]+/, `#define NIGHT ${night ? "1." : "0."}`);
  return { ...base, source, colors: [...SKIES[sky].c] };
}

/* ───────── raster helpers (1 unit = 1 pixel) ───────── */
const grid = (w: number, h: number): Grid => ({ w, h, c: new Array(w * h).fill("") });
const put = (g: Grid, x: number, y: number, v: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.c[y * g.w + x] = v; };
const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, v: string) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) put(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, v); };
const poly = (g: Grid, pts: number[][], v: string) => { for (let i = 1; i < pts.length; i++) line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], v); };
const disc = (g: Grid, cx: number, cy: number, r: number, v: string) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Math.hypot(x - cx, y - cy) <= r + 0.15) put(g, x, y, v); };
const ring = (g: Grid, cx: number, cy: number, r: number, v: string) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.5) put(g, x, y, v); };
const rectF = (g: Grid, x: number, y: number, w: number, h: number, v: string) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, v); };
const rectO = (g: Grid, x: number, y: number, w: number, h: number, v: string) => { line(g, x, y, x + w - 1, y, v); line(g, x, y + h - 1, x + w - 1, y + h - 1, v); line(g, x, y, x, y + h - 1, v); line(g, x + w - 1, y, x + w - 1, y + h - 1, v); };
const rng = (seed: number) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

/** Merges same-valued horizontal runs into rects; `map` turns semantic values into classes. */
function runs(g: Grid, map: Map = {}): string {
  let out = "";
  for (let y = 0; y < g.h; y++) {
    let x = 0;
    while (x < g.w) {
      const v = g.c[y * g.w + x]; let e = x + 1;
      while (e < g.w && g.c[y * g.w + e] === v) e++;
      if (v) out += `<rect x="${x}" y="${y}" width="${e - x}" height="1" class="${map[v] || v}"/>`;
      x = e;
    }
  }
  return out;
}
const svg = (g: Grid, map: Map, cls = "") => `<svg class="nb-px ${cls}" viewBox="0 0 ${g.w} ${g.h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${runs(g, map)}</svg>`;

/** Periodic value noise so drifting cloud strips loop seamlessly. */
function noise(seed: number, period: number) {
  const H = (x: number, y: number) => { x = ((x % period) + period) % period; let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = H(xi, yi) + (H(xi + 1, yi) - H(xi, yi)) * u, b = H(xi, yi + 1) + (H(xi + 1, yi + 1) - H(xi, yi + 1)) * u; return a + (b - a) * v;
  };
}
/** Three-octave periodic fbm. */
function fbm1(seed: number, period: number) { const o = [noise(seed, period), noise(seed + 7, period * 2), noise(seed + 13, period * 4)]; return (x: number, y: number) => o[0](x, y) * 0.55 + o[1](x * 2, y * 2) * 0.3 + o[2](x * 4, y * 4) * 0.15; }
// value 0..1 → sky(0) mid(1) pale(2) white(3), with checker blocks between neighbours
const TONE = ["s", "m", "p", "w"];
/** Quantises a value into one tone or a checker between two. */
function tone(v: number) { const x = Math.max(0, Math.min(0.999, v)) * 3, lo = Math.floor(x), fr = x - lo; return fr < 0.34 ? TONE[lo] : fr < 0.66 ? "k" + lo + (lo + 1) : TONE[lo + 1]; }
/** A tile of pixel sky (w×h cells) whose clouds repeat every `period` cells horizontally. */
function skyTileGrid(seed: number, w: number, h: number, period: number, bias = 0, grad = 0) {
  const g = grid(w, h), N = fbm1(seed, period / 8);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(g, x, y, tone((N(x / 8, y / 8) - 0.42) * 2.1 + bias + grad * (y / h - 0.5)));
  return g;
}
const MAPSKY: Map = { s: "p0", m: "p1", p: "p2", w: "p3", k01: "k01", k12: "k12", k23: "k23" };
/** A sky tile as SVG. */
export const skyTile = (seed: number, w: number, h: number, period: number, bias = 0, grad = 0, cls = "") => svg(skyTileGrid(seed, w, h, period, bias, grad), MAPSKY, cls);

/** A stepped pixel-cloud edge: white page on top melting into sky below (flip for the reverse). */
export function edgeSvg(seed: number, flip: boolean) {
  const W = 192, R = 8, g = grid(W, R), N = fbm1(seed, 24);
  for (let y = 0; y < R; y++) for (let x = 0; x < W; x++) {
    const yy = flip ? R - 1 - y : y;
    put(g, x, y, tone(1.25 - (yy / (R - 1)) * 1.5 + (N(x / 6, y / 3) - 0.5) * 1.15));
  }
  return `<svg class="nb-px" viewBox="0 0 ${W} ${R}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${runs(g, MAPSKY)}</svg>`;
}

/** The checker patterns the k01/k12/k23 classes fill with. */
export const DEFS = `<defs>${[["k01", "p0", "p1"], ["k12", "p1", "p2"], ["k23", "p2", "p3"]].map(([id, a, b]) => `<pattern id="nb-${id}" width=".5" height=".5" patternUnits="userSpaceOnUse"><rect width=".5" height=".5" class="${a}"/><rect width=".25" height=".25" class="${b}"/><rect x=".25" y=".25" width=".25" height=".25" class="${b}"/></pattern>`).join("")}</defs>`;

/** A loose pixel cloud sprite (white body, pale underside, dithered rim). */
export function cloud(seed: number, w = 22, h = 9, map: Map = { w: "p3", p: "p2" }) {
  const g = grid(w, h), r = rng(seed), big = h * (0.5 + r() * 0.08);
  rectF(g, 1, h - 3, w - 2, 3, "w");
  disc(g, w * (0.5 + (r() - 0.5) * 0.16), h - 1 - big, big, "w");
  disc(g, w * (0.24 + r() * 0.06), h - 1 - big * 0.62, big * 0.62, "w");
  disc(g, w * (0.76 - r() * 0.06), h - 1 - big * 0.5, big * 0.5, "w");
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) { if (g.c[y * w + x] === "w") { if (y === h - 1 || (y === h - 2 && (x + y) % 2)) g.c[y * w + x] = "p"; break; } }
  return svg(g, map);
}

/* ───────── pixel icons: one per project and per toy (16×12) ───────── */
const ICONS: Record<string, (g: Grid) => void> = {
  "mind-controlled-arm": (g) => { rectF(g, 1, 10, 8, 2, "a"); rectF(g, 3, 9, 4, 1, "b"); rectF(g, 4, 4, 2, 5, "a"); disc(g, 4.5, 3.5, 1.2, "y"); line(g, 5, 3, 10, 3, "a"); line(g, 5, 4, 10, 4, "a"); disc(g, 10.5, 3.5, 1, "y"); line(g, 11, 2, 13, 0, "a"); line(g, 12, 2, 14, 1, "a"); line(g, 11, 5, 13, 7, "a"); line(g, 12, 5, 14, 6, "a"); },
  boilerframe: (g) => { rectO(g, 0, 0, 16, 12, "a"); for (let x = 2; x < 15; x += 3) { put(g, x, 1, "b"); put(g, x, 10, "b"); } disc(g, 7.5, 5.5, 2.1, "y"); [[4, 3], [11, 3], [4, 8], [11, 8]].forEach(([x, y]) => { put(g, x, y, "a"); put(g, x + (x < 8 ? 1 : -1), y, "a"); put(g, x, y + (y < 6 ? 1 : -1), "a"); }); },
  "eeg-thought-prediction": (g) => { let py = 6; for (let x = 0; x < 16; x++) { const y = Math.round(6 - 4 * Math.sin(x * 0.85) * (x % 5 === 2 ? 1.1 : 0.8)); line(g, x - 1 < 0 ? 0 : x - 1, py, x, y, "a"); py = y; } line(g, 0, 11, 15, 11, "b"); put(g, 2, 9, "y"); put(g, 1, 10, "y"); put(g, 3, 10, "y"); put(g, 13, 9, "y"); put(g, 12, 10, "y"); put(g, 14, 10, "y"); },
  "citizen-happiness": (g) => { rectF(g, 2, 8, 2, 4, "b"); rectF(g, 6, 6, 2, 6, "b"); rectF(g, 10, 4, 2, 8, "b"); line(g, 0, 9, 13, 2, "a"); disc(g, 14, 1.5, 1.2, "y"); },
  qrify: (g) => { const r = rng(7); for (let y = 0; y < 12; y++) for (let x = 2; x < 14; x++) if (r() > 0.55) put(g, x, y, "b"); [[2, 0], [9, 0], [2, 7]].forEach(([x, y]) => { rectF(g, x, y, 5, 5, ""); rectO(g, x, y, 5, 5, "a"); put(g, x + 2, y + 2, "a"); }); put(g, 11, 9, "y"); put(g, 12, 9, "y"); put(g, 11, 10, "y"); },
  "habitat-humanity-ecomm": (g) => { line(g, 1, 6, 7, 0, "a"); line(g, 8, 0, 14, 6, "a"); rectO(g, 3, 6, 10, 6, "a"); rectF(g, 7, 8, 2, 4, "y"); put(g, 5, 8, "b"); put(g, 10, 8, "b"); put(g, 13, 1, "a"); put(g, 13, 2, "a"); },
  records: (g) => { disc(g, 7.5, 5.5, 5.6, "a"); ring(g, 7.5, 5.5, 4, "b"); disc(g, 7.5, 5.5, 1.6, "y"); put(g, 7, 5, "b"); put(g, 8, 6, "b"); put(g, 15, 0, "a"); line(g, 15, 0, 12, 5, "a"); },
  artboard: (g) => { poly(g, [[1, 9], [3, 4], [5, 8], [7, 3]], "a"); poly(g, [[14, 9], [12, 4], [10, 8], [8, 3]], "a"); for (let y = 0; y < 12; y += 2) { put(g, 7.5, y, "b"); } put(g, 7, 3, "y"); put(g, 8, 3, "y"); },
  typeracer: (g) => { rectO(g, 0, 2, 16, 9, "a"); for (let y = 4; y <= 6; y += 2) for (let x = 2; x < 14; x += 2) put(g, x + (y === 6 ? 1 : 0), y, "b"); line(g, 4, 8, 11, 8, "a"); put(g, 13, 4, "y"); },
  angle: (g) => { line(g, 1, 10, 15, 10, "a"); line(g, 1, 10, 10, 1, "a"); for (let a = 0; a <= 45; a += 6) put(g, 1 + 6 * Math.cos((a * Math.PI) / 180), 10 - 6 * Math.sin((a * Math.PI) / 180), "y"); },
  dots: (g) => { const r = rng(3); for (let i = 0; i < 14; i++) put(g, 1 + r() * 14, 1 + r() * 10, i % 4 ? "a" : "y"); },
  center: (g) => { for (let x = 0; x < 16; x += 2) { put(g, x, 0, "b"); put(g, x, 11, "b"); } for (let y = 0; y < 12; y += 2) { put(g, 0, y, "b"); put(g, 15, y, "b"); } rectF(g, 5, 3, 6, 6, "a"); put(g, 7, 5, "y"); put(g, 8, 6, "y"); put(g, 8, 5, "y"); put(g, 7, 6, "y"); },
};
export const ON_SKY: Map = { a: "p3", b: "p2", y: "ps" }, ON_PALE: Map = { a: "p0", b: "p1", y: "ps" }, ON_SUN: Map = { a: "pi", b: "p3", y: "p3" };
/** A project's or toy's 16×12 icon (blank for an unknown key, e.g. a newly added project). */
export const icon16 = (key: string, map: Map, cls = "") => { const g = grid(16, 12); ICONS[key]?.(g); return svg(g, map, cls); };

export type GlyphKind = "sun" | "moon" | "part" | "bolt";
/** Tiny 9×9 weather glyphs for the forecast card. */
export function glyph(kind: GlyphKind) {
  const g = grid(9, 9);
  if (kind === "sun") { disc(g, 4, 4, 2.1, "y"); [[4, 0], [4, 8], [0, 4], [8, 4], [1, 1], [7, 1], [1, 7], [7, 7]].forEach(([x, y]) => put(g, x, y, "y")); }
  if (kind === "moon") { disc(g, 4, 4, 3.2, "m"); disc(g, 5.6, 3, 2.6, ""); put(g, 7, 7, "y"); put(g, 8, 1, "y"); }
  if (kind === "part") { disc(g, 5.5, 3, 2, "y"); disc(g, 2.6, 6, 1.7, "c"); disc(g, 5, 5.6, 2.1, "c"); rectF(g, 1, 7, 7, 1, "c"); }
  if (kind === "bolt") { poly(g, [[5, 0], [2, 4], [5, 4], [3, 8]], "y"); put(g, 4, 4, "y"); }
  return svg(g, { y: "ps", m: "pm", c: "pc" }, "nb-glyph");
}
