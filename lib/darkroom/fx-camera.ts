import { blurPlane, clamp, hash, hsl, lerp, lumaAt, lumaPlane, newFrame, ramp } from "./frame.ts";
import { type Effect, P } from "./types.ts";

const duotone: Effect = {
  id: "duotone", name: "Duotone", family: "camera", tags: ["color", "analog", "film", "mono", "poster", "smooth"],
  desc: "Shadows and highlights each dyed their own hue, like a two-ink screenprint.",
  params: [P("shadow", "Shadow hue", 0, 360, 1, 255), P("light", "Light hue", 0, 360, 1, 28), P("contrast", "Contrast", 0.6, 1.8, 0.05, 1.15)],
  apply(src, p) {
    const out = newFrame(src.w, src.h), a = hsl(p.shadow, 0.62, 0.1), m = hsl((p.shadow + p.light) / 2 + (Math.abs(p.shadow - p.light) > 180 ? 180 : 0), 0.5, 0.48), b = hsl(p.light, 0.9, 0.88);
    for (let i = 0; i < src.data.length; i += 4) {
      const L = clamp((lumaAt(src.data, i) - 0.5) * p.contrast + 0.5), t = L < 0.5 ? L * 2 : (L - 0.5) * 2, f = L < 0.5 ? a : m, g = L < 0.5 ? m : b;
      for (let c = 0; c < 3; c++) out.data[i + c] = lerp(f[c], g[c], t);
      out.data[i + 3] = 255;
    }
    return out;
  },
};

const posterize: Effect = {
  id: "posterize", name: "Posterize", family: "camera", tags: ["color", "poster", "flat", "graphic", "pop", "smooth"],
  desc: "Colour collapsed to a few flat bands, bold as a gig poster.",
  params: [P("levels", "Levels", 2, 8, 1, 4), P("sat", "Saturation", 0, 2, 0.05, 1.3)],
  apply(src, p) {
    const out = newFrame(src.w, src.h), n = p.levels - 1;
    for (let i = 0; i < src.data.length; i += 4) {
      const L = lumaAt(src.data, i) * 255;
      for (let c = 0; c < 3; c++) { const v = clamp(L + (src.data[i + c] - L) * p.sat, 0, 255); out.data[i + c] = (Math.round((v / 255) * n) / n) * 255; }
      out.data[i + 3] = 255;
    }
    return out;
  },
};

const kuwahara: Effect = {
  id: "kuwahara", name: "Oil Paint", family: "camera", tags: ["painterly", "color", "smooth", "organic", "analog", "brush"],
  desc: "Kuwahara smoothing: flat painterly patches with the edges kept sharp, as if brushed in oils.",
  params: [P("radius", "Brush radius", 2, 9, 1, 4), P("sat", "Saturation", 0.6, 1.8, 0.05, 1.15)],
  apply(src, p, env) {
    const { w, h, data } = src, r = Math.max(2, Math.round(p.radius * env.k)), W = w + 1;
    // integral images of R, G, B, luma and luma^2: every window mean/variance is then four lookups
    const I = [0, 1, 2, 3, 4].map(() => new Float64Array(W * (h + 1)));
    for (let y = 0; y < h; y++) {
      const rs = [0, 0, 0, 0, 0];
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, L = lumaAt(data, i) * 255, v = [data[i], data[i + 1], data[i + 2], L, L * L];
        for (let c = 0; c < 5; c++) { rs[c] += v[c]; I[c][(y + 1) * W + x + 1] = I[c][y * W + x + 1] + rs[c]; }
      }
    }
    const box = (c: number, x0: number, y0: number, x1: number, y1: number) => I[c][(y1 + 1) * W + x1 + 1] - I[c][y0 * W + x1 + 1] - I[c][(y1 + 1) * W + x0] + I[c][y0 * W + x0];
    const out = newFrame(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = Infinity, br = 0, bg = 0, bb = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(w - 1, q & 1 ? x + r : x), y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(h - 1, q & 2 ? y + r : y), n = (x1 - x0 + 1) * (y1 - y0 + 1);
        const mL = box(3, x0, y0, x1, y1) / n, vr = box(4, x0, y0, x1, y1) / n - mL * mL;
        if (vr < best) { best = vr; br = box(0, x0, y0, x1, y1) / n; bg = box(1, x0, y0, x1, y1) / n; bb = box(2, x0, y0, x1, y1) / n; }
      }
      const o = (y * w + x) * 4, L = 0.2126 * br + 0.7152 * bg + 0.0722 * bb;
      out.data[o] = L + (br - L) * p.sat; out.data[o + 1] = L + (bg - L) * p.sat; out.data[o + 2] = L + (bb - L) * p.sat; out.data[o + 3] = 255;
    }
    return out;
  },
};

const HEAT = [[0, 6, 0, 36], [0.18, 52, 6, 120], [0.4, 170, 28, 120], [0.62, 250, 110, 8], [0.82, 255, 214, 40], [1, 255, 252, 214]];

const thermal: Effect = {
  id: "thermal", name: "Thermal", family: "camera", tags: ["color", "sensor", "false-colour", "smooth", "scifi", "heat"],
  desc: "Body heat as a false-colour camera sees it: indigo cold to white-hot.",
  params: [P("contrast", "Contrast", 0.6, 2, 0.05, 1.2), P("heat", "Heat offset", -0.3, 0.3, 0.01, 0)],
  apply(src, p, env) {
    const { w, h } = src, pl = blurPlane(lumaPlane(src), w, h, env.k * 1.5), out = newFrame(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = clamp((pl[y * w + x] - 0.5) * p.contrast + 0.5 + p.heat), c = ramp(HEAT, Math.round(v * 24) / 24), o = (y * w + x) * 4;
      out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = 255;
    }
    return out;
  },
};

const night: Effect = {
  id: "nightvision", name: "Night Vision", family: "camera", tags: ["color", "sensor", "mono", "noise", "scifi", "analog"],
  desc: "Light-amplified phosphor green: grain, bloom and a round lens vignette.",
  animated: true,
  params: [P("gain", "Gain", 0.8, 3, 0.05, 1.7), P("noise", "Grain", 0, 1, 0.05, 0.5)],
  apply(src, p, env) {
    const { w, h } = src, pl = lumaPlane(src), glow = blurPlane(pl, w, h, 6 * env.k), out = newFrame(w, h), frame = Math.floor(env.t * 12);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, nx = (x / w - 0.5) * 2, ny = (y / h - 0.5) * 2, vig = 1 - clamp((Math.hypot(nx, ny) - 0.7) / 0.5), n = (hash(x, y, frame) - 0.5) * p.noise * 0.7;
      const scan = 0.94 + 0.06 * Math.sin((y / env.k) * 2.4);
      const v = clamp((Math.pow(pl[i], 0.7) * p.gain + glow[i] * 0.5 + n) * vig * scan), o = i * 4;
      out.data[o] = v * v * 150 + v * 20; out.data[o + 1] = 40 + v * 215; out.data[o + 2] = v * v * 90 + v * 12; out.data[o + 3] = 255;
    }
    return out;
  },
};

export const CAMERA: Effect[] = [duotone, posterize, kuwahara, thermal, night];
