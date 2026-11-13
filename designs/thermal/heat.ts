// Thermal's pure helpers, ported 1:1 from docs/mockups/v7/themes/thermal.js: the palette stops, the contact
// strip's heat grid and the BMP encoder that turns a heat grid into a data URI (no canvas, so SSR can render it).
export type PalId = "iron" | "rainbow" | "white";
export const PALS: [PalId, string][] = [["iron", "Iron"], ["rainbow", "Rainbow"], ["white", "White hot"]];
// colour stops shared by the shader (registry), the CSS ramps and the sensor frames (keep in sync with thermal.css)
export const STOPS: Record<PalId, [number, string][]> = {
  iron: [[0, "#04060C"], [0.2, "#1A0852"], [0.4, "#800A85"], [0.56, "#DB294D"], [0.72, "#FC780F"], [0.87, "#FFD138"], [1, "#FFFADB"]],
  rainbow: [[0, "#04060C"], [0.15, "#0D0F59"], [0.3, "#1A59F2"], [0.44, "#1AD9E6"], [0.58, "#59E64D"], [0.72, "#FFE626"], [0.87, "#FF401A"], [1, "#FFE6D9"]],
  white: [[0, "#04060C"], [1, "#F7F9FF"]],
};
export const T_MIN = 18, T_MAX = 40; // the visual scale, in °C (decorative)

export type Grid = { g: Float32Array; max: number; w: number; h: number; at?: [number, number]; peak: number };

const hex3 = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const sstep = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/** Index of a palette in the shader's `u_pv` encoding (0 iron, 1 rainbow, 2 white hot). */
export const palIndex = (p: PalId) => PALS.findIndex(([id]) => id === p);

/** Colour of a palette at heat t (0..1); white hot eases its ramp like the shader does. */
export function ramp(t: number, name: PalId): number[] {
  const s = STOPS[name];
  t = Math.min(1, Math.max(0, name === "white" ? sstep(0, 1, t) * 0.35 + t * 0.65 : t));
  let c = hex3(s[0][1]);
  for (let i = 1; i < s.length; i++) { const k = sstep(s[i - 1][0], s[i][0], t), d = hex3(s[i][1]); c = c.map((v, j) => v + (d[j] - v) * k); }
  return c.map((v) => Math.round(v));
}



/** The contact strip: a 64x6 band of heat with its hottest point a little left of centre. */
export function stripGrid(): Grid {
  const w = 64, h = 6, g = new Float32Array(w * h); let max = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - 26) / 64, dy = (y - 2.5) / 6;
    const v = 0.06 + Math.exp(-dx * dx * 18 - dy * dy * 3) * 0.9 + Math.exp(-((x - 44) ** 2) / 30 - dy * dy * 4) * 0.25 + 0.03 * Math.sin(x * 0.8 + y);
    g[y * w + x] = v; max = Math.max(max, v);
  }
  return { g, max, w, h, peak: 0.8 };
}

/** A 24-bit BMP data URI of the grid in a palette; `warm` raises the peak (the hover frame). Widths are multiples of 4, so rows need no padding. */
export function bmp(grid: Grid, pal: PalId, warm: number): string {
  const w = grid.w, h = grid.h, row = w * 3, size = 54 + row * h, b = new Uint8Array(size), dv = new DataView(b.buffer);
  b[0] = 66; b[1] = 77; dv.setUint32(2, size, true); dv.setUint32(10, 54, true); dv.setUint32(14, 40, true);
  dv.setInt32(18, w, true); dv.setInt32(22, h, true); dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, row * h, true);
  let o = 54; const peak = Math.min(1, grid.peak + warm);
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) {
    const [R, G, B] = ramp((grid.g[y * w + x] / grid.max) * peak, pal); b[o++] = B; b[o++] = G; b[o++] = R;
  }
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return "data:image/bmp;base64," + btoa(s);
}
