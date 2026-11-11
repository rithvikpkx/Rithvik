import { bilinear, blurPlane, clamp, fbm, hash, lumaPlane, newFrame, smooth } from "./frame.ts";
import { type Effect, P } from "./types.ts";
import { INK, PAPER } from "./fx-print.ts";

const contour: Effect = {
  id: "contour", name: "Contour Lines", family: "line", tags: ["lines", "mono", "map", "topographic", "analog", "smooth"],
  desc: "A topographic map of the face: iso-lines of brightness, evenly inked.",
  params: [P("levels", "Levels", 4, 28, 1, 12), P("width", "Line width", 0.5, 3, 0.1, 1.2), P("smooth", "Smoothing", 0, 8, 1, 3)],
  apply(src, p, env) {
    const { w, h } = src, L = blurPlane(lumaPlane(src), w, h, p.smooth * env.k), out = newFrame(w, h), lv = p.levels;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = L[i] * lv, gx = (L[y * w + Math.min(w - 1, x + 1)] - L[y * w + Math.max(0, x - 1)]) * 0.5 * lv, gy = (L[Math.min(h - 1, y + 1) * w + x] - L[Math.max(0, y - 1) * w + x]) * 0.5 * lv;
      const f = v - Math.floor(v), d = Math.min(f, 1 - f) / Math.max(Math.hypot(gx, gy), 1e-3), a = 1 - smooth(p.width * env.k * 0.5 - 0.5, p.width * env.k * 0.5 + 0.5, d), o = i * 4;
      const paper = 0.9 + 0.1 * L[i];
      for (let c = 0; c < 3; c++) out.data[o + c] = PAPER[c] * paper + (INK[c] - PAPER[c] * paper) * a;
      out.data[o + 3] = 255;
    }
    return out;
  },
};

const wave: Effect = {
  id: "wavelines", name: "Wave Lines", family: "line", tags: ["lines", "mono", "ridge", "graphic", "analog", "smooth"],
  desc: "Joy Division ridgelines: each scan line rises where the picture is bright.",
  params: [P("lines", "Lines", 20, 100, 1, 54), P("amp", "Amplitude", 0, 3, 0.05, 1.4), P("ink", "Ink", 0, 1, 1, 0, ["Dark on light", "Light on dark"])],
  apply(src, p, env) {
    const { w, h } = src, L = blurPlane(lumaPlane(src), w, h, 1.5 * env.k), out = newFrame(w, h), pitch = h / p.lines, dark = p.ink === 1;
    const bg = dark ? [12, 12, 14] : PAPER, fg = dark ? [236, 236, 240] : INK;
    for (let i = 0; i < out.data.length; i += 4) { out.data[i] = bg[0]; out.data[i + 1] = bg[1]; out.data[i + 2] = bg[2]; out.data[i + 3] = 255; }
    const stamp = (x: number, y: number, a: number) => { if (y < 0 || y >= h) return; const o = (y * w + x) * 4; for (let c = 0; c < 3; c++) out.data[o + c] += (fg[c] - out.data[o + c]) * a; };
    for (let j = 0; j <= p.lines; j++) {
      const base = (j + 0.5) * pitch;
      for (let x = 0; x < w; x++) {
        const l = L[Math.min(h - 1, Math.round(base)) * w + x] ?? 0, lift = (dark ? l : 1 - l) * p.amp * pitch * 1.6, y = base - lift, th = (0.9 + (dark ? l : 1 - l) * 1.3) * env.k;
        // occlude what the ridge hides: paint the background down to the next line before inking this one
        const y0 = Math.floor(y), y1 = Math.min(h - 1, Math.floor(base + pitch * 0.45));
        for (let yy = Math.max(0, y0); yy <= y1; yy++) { const o = (yy * w + x) * 4; out.data[o] = bg[0]; out.data[o + 1] = bg[1]; out.data[o + 2] = bg[2]; }
        for (let yy = Math.floor(y - th); yy <= Math.ceil(y + th); yy++) stamp(x, yy, clamp(th - Math.abs(yy + 0.5 - y) + 0.5));
      }
    }
    return out;
  },
};

const edges: Effect = {
  id: "edges", name: "Edge Detection", family: "line", tags: ["lines", "edge", "digital", "scifi", "graphic", "outline"],
  desc: "Sobel outlines only: the picture reduced to where it changes.",
  params: [P("strength", "Strength", 0.5, 5, 0.1, 2.2), P("thin", "Cutoff", 0, 0.5, 0.01, 0.06), P("mode", "Style", 0, 2, 1, 0, ["Neon", "Ink", "Blueprint"])],
  apply(src, p, env) {
    const { w, h } = src, L = blurPlane(lumaPlane(src), w, h, 0.8 * env.k), out = newFrame(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(w - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(h - 1, y + 1), g = (xx: number, yy: number) => L[yy * w + xx];
      const gx = -g(xm, ym) - 2 * g(xm, y) - g(xm, yp) + g(xp, ym) + 2 * g(xp, y) + g(xp, yp), gy = -g(xm, ym) - 2 * g(x, ym) - g(xp, ym) + g(xm, yp) + 2 * g(x, yp) + g(xp, yp);
      const e = smooth(p.thin, p.thin + 0.25, Math.hypot(gx, gy) * 0.5 * p.strength), o = (y * w + x) * 4, si = o;
      if (p.mode === 0) { for (let c = 0; c < 3; c++) out.data[o + c] = 8 + e * Math.min(255, 90 + src.data[si + c] * 1.2); }
      else if (p.mode === 1) { for (let c = 0; c < 3; c++) out.data[o + c] = PAPER[c] + (INK[c] - PAPER[c]) * e; }
      else { out.data[o] = 14 + e * 190; out.data[o + 1] = 52 + e * 190; out.data[o + 2] = 140 + e * 115; }
      out.data[o + 3] = 255;
    }
    return out;
  },
};

const emboss: Effect = {
  id: "emboss", name: "Emboss", family: "line", tags: ["relief", "mono", "analog", "smooth", "lines", "metal"],
  desc: "Pressed into brushed metal: the portrait as a raised relief lit from one side.",
  params: [P("angle", "Light angle", 0, 360, 5, 135), P("strength", "Depth", 0.5, 5, 0.1, 2), P("tint", "Colour", 0, 1, 0.05, 0.25)],
  apply(src, p, env) {
    const { w, h } = src, L = blurPlane(lumaPlane(src), w, h, 0.6 * env.k), out = newFrame(w, h), a = (p.angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = L[y * w + Math.min(w - 1, x + 1)] - L[y * w + Math.max(0, x - 1)], gy = L[Math.min(h - 1, y + 1) * w + x] - L[Math.max(0, y - 1) * w + x], v = clamp(0.5 + (gx * ca + gy * sa) * p.strength * 2.5), o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = (v * (1 - p.tint) + (src.data[o + c] / 255) * p.tint * v * 1.6) * 255;
      out.data[o + 3] = 255;
    }
    return out;
  },
};

const voronoi: Effect = {
  id: "voronoi", name: "Voronoi Cells", family: "line", tags: ["geometric", "color", "organic", "cells", "tile", "lines"],
  desc: "Stained glass: the picture shattered into cells, each flooded with one colour.",
  params: [P("cells", "Cells across", 16, 120, 1, 56), P("edge", "Edge", 0, 3, 0.1, 1.2), P("jitter", "Irregularity", 0, 1, 0.05, 0.9)],
  apply(src, p, env) {
    const { w, h } = src, cs = w / p.cells, gw = Math.ceil(w / cs) + 2, gh = Math.ceil(h / cs) + 2, sx = new Float32Array(gw * gh), sy = new Float32Array(gw * gh), col = new Float32Array(gw * gh * 3);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i, x = (i - 1 + 0.5 + (hash(i, j, 1) - 0.5) * p.jitter) * cs, y = (j - 1 + 0.5 + (hash(i, j, 2) - 0.5) * p.jitter) * cs;
      sx[k] = x; sy[k] = y;
      for (let c = 0; c < 3; c++) col[k * 3 + c] = bilinear(src, x, y, c);
    }
    const out = newFrame(w, h), ew = p.edge * env.k;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ci = Math.floor(x / cs) + 1, cj = Math.floor(y / cs) + 1;
      let d1 = Infinity, d2 = Infinity, b = 0;
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        const k = Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i)), d = Math.hypot(x - sx[k], y - sy[k]);
        if (d < d1) { d2 = d1; d1 = d; b = k; } else if (d < d2) d2 = d;
      }
      const e = ew > 0 ? 1 - smooth(ew * 0.5 - 0.5, ew * 0.5 + 0.8, (d2 - d1) * 0.5) : 0, o = (y * w + x) * 4, shade = 1 - 0.12 * (d1 / cs);
      for (let c = 0; c < 3; c++) out.data[o + c] = col[b * 3 + c] * shade * (1 - e) + 10 * e;
      out.data[o + 3] = 255;
    }
    return out;
  },
};

const noisefield: Effect = {
  id: "noisefield", name: "Noise Field", family: "line", tags: ["noise", "organic", "color", "smooth", "flow", "motion"],
  desc: "The portrait caught in a drifting current: pixels dragged along a noise flow field.",
  animated: true,
  params: [P("scale", "Scale", 1, 12, 0.5, 4), P("push", "Push", 0, 90, 1, 16), P("grain", "Streaks", 0, 1, 0.05, 0.5)],
  apply(src, p, env) {
    const { w, h } = src, out = newFrame(w, h), sc = p.scale / w, push = p.push * env.k, t = env.t * 0.25;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = fbm(x * sc + t, y * sc, 3) * Math.PI * 4, b = fbm(x * sc * 1.7 - t, y * sc * 1.7 + 9, 8) - 0.5;
      const dx = Math.cos(a) * push * (0.5 + b), dy = Math.sin(a) * push * (0.5 + b), o = (y * w + x) * 4;
      // average three taps along the flow so the warp smears into streaks instead of tearing
      for (let c = 0; c < 3; c++) {
        const s0 = bilinear(src, x + dx, y + dy, c), s1 = bilinear(src, x + dx * (1 - p.grain * 0.6), y + dy * (1 - p.grain * 0.6), c), s2 = bilinear(src, x + dx * (1 + p.grain * 0.6), y + dy * (1 + p.grain * 0.6), c);
        out.data[o + c] = (s0 + s1 + s2) / 3;
      }
      out.data[o + 3] = 255;
    }
    return out;
  },
};

export const LINE: Effect[] = [contour, wave, edges, emboss, voronoi, noisefield];
