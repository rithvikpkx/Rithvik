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
const rectF = (g: Grid, x: number, y: number, w: number, h: number, v: string) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, v); };
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
