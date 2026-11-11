import { bilinear, blurPlane, clamp, cloneFrame, hash, hsl, lumaAt, lumaPlane, newFrame, resize } from "./frame.ts";
import { type Effect, P } from "./types.ts";

const pixelsort: Effect = {
  id: "pixelsort", name: "Pixel Sort", family: "glitch", tags: ["glitch", "digital", "color", "streak", "motion", "sort"],
  desc: "Runs of pixels sorted by brightness into molten streaks: the datamosh classic.",
  params: [P("lo", "From", 0, 1, 0.01, 0.22), P("hi", "To", 0, 1, 0.01, 0.82), P("dir", "Direction", 0, 1, 1, 1, ["Across", "Down"])],
  apply(src, p) {
    const out = cloneFrame(src), { w, h } = src, u32 = new Uint32Array(out.data.buffer), vert = p.dir === 1, lines = vert ? w : h, len = vert ? h : w;
    const at = (l: number, i: number) => (vert ? i * w + l : l * w + i);
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) lum[i] = lumaAt(src.data, i * 4);
    for (let l = 0; l < lines; l++) {
      let i = 0;
      while (i < len) {
        while (i < len && (lum[at(l, i)] < p.lo || lum[at(l, i)] > p.hi)) i++;
        const start = i;
        while (i < len && lum[at(l, i)] >= p.lo && lum[at(l, i)] <= p.hi) i++;
        if (i - start < 3) continue;
        const idx: number[] = [];
        for (let k = start; k < i; k++) idx.push(at(l, k));
        const px = idx.map((j) => u32[j]), key = idx.map((j) => lum[j]), order = px.map((_, k) => k).sort((a, b) => key[a] - key[b]);
        for (let k = 0; k < idx.length; k++) u32[idx[k]] = px[order[k]];
      }
    }
    return out;
  },
};

const vhs: Effect = {
  id: "vhs", name: "VHS", family: "glitch", tags: ["glitch", "analog", "color", "noise", "retro", "motion", "tape"],
  desc: "A well-worn tape: smeared chroma, tracking bands, head-switch wobble and snow.",
  animated: true,
  params: [P("bleed", "Chroma bleed", 0, 14, 0.5, 6), P("track", "Tracking", 0, 1, 0.05, 0.55), P("snow", "Snow", 0, 1, 0.05, 0.35)],
  apply(src, p, env) {
    const { w, h } = src, k = env.k, t = env.t, f = Math.floor(t * 15), out = newFrame(w, h);
    // split into luma (kept sharp) and chroma planes, then smear chroma sideways like a weak colour-under signal
    const Y = new Float32Array(w * h), Cb = new Float32Array(w * h), Cr = new Float32Array(w * h);
    for (let i = 0, o = 0; i < Y.length; i++, o += 4) {
      const r = src.data[o], g = src.data[o + 1], b = src.data[o + 2];
      Y[i] = 0.299 * r + 0.587 * g + 0.114 * b; Cb[i] = -0.1687 * r - 0.3313 * g + 0.5 * b; Cr[i] = 0.5 * r - 0.4187 * g - 0.0813 * b;
    }
    const r = Math.round(p.bleed * k), cbs = Cb, crs = Cr;
    const sm = (pl: Float32Array, y: number, x: number, rr: number) => { let s = 0, n = 0; for (let i = -rr; i <= rr; i += Math.max(1, rr >> 2)) { s += pl[y * w + clamp(x + i, 0, w - 1)]; n++; } return s / n; };
    const band = ((t * 0.09) % 1) * h * 1.3 - h * 0.15, bandH = h * 0.08 * (0.4 + p.track);
    for (let y = 0; y < h; y++) {
      const wob = (hash(y >> 1, f, 3) - 0.5) * 3 * k * p.track + (y > h * 0.92 ? (y - h * 0.92) * 0.6 * k * (hash(f, 9, 1) + 0.5) : 0);
      const inBand = Math.abs(y - band) < bandH ? 1 - Math.abs(y - band) / bandH : 0, shift = Math.round(wob + inBand * 34 * k * p.track * (hash(y, f, 5) - 0.3));
      for (let x = 0; x < w; x++) {
        const xx = clamp(x + shift, 0, w - 1), o = (y * w + x) * 4, y0 = Y[y * w + xx] * (1 - 0.18 * inBand) + 18 * inBand;
        const cb = r ? sm(cbs, y, xx - r, r) : cbs[y * w + xx], cr = r ? sm(crs, y, xx - r, r) : crs[y * w + xx];
        const n = (hash(x, y, f) - 0.5) * 90 * p.snow * (0.4 + inBand * 2) + (hash(y, f, 8) > 0.996 ? 90 * p.snow : 0);
        const Yy = y0 + n;
        out.data[o] = Yy + 1.402 * cr; out.data[o + 1] = Yy - 0.3441 * cb - 0.7141 * cr; out.data[o + 2] = Yy + 1.772 * cb; out.data[o + 3] = 255;
        // faint scan structure and a slight magenta lift in the darks, as tape does
        if (y % 2) { out.data[o] *= 0.93; out.data[o + 1] *= 0.93; out.data[o + 2] *= 0.93; }
        out.data[o] += 6; out.data[o + 2] += 8;
      }
    }
    return out;
  },
};

const KANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789Z:.=*+-<>";

const matrix: Effect = {
  id: "matrix", name: "Matrix Rain", family: "glitch", tags: ["glitch", "digital", "text", "mono", "scifi", "motion", "terminal"],
  desc: "Falling green code that only lights up where the portrait is bright.",
  animated: true,
  params: [P("cell", "Cell size", 8, 20, 1, 12), P("trail", "Trail", 0.2, 1, 0.05, 0.6), P("hue", "Hue", 0, 360, 1, 135)],
  apply(src, p, env) {
    const cw = Math.max(5, Math.round(p.cell * env.k)), ch = Math.round(cw * 1.5), atlas = env.atlas(KANA, cw, ch), { w, h } = src, cols = Math.ceil(w / cw), rows = Math.ceil(h / ch);
    const small = resize(src, cols, rows), out = newFrame(w, h), t = env.t, trailLen = 6 + p.trail * rows * 0.7, tint = hsl(p.hue, 0.9, 0.55), bright = hsl(p.hue, 0.7, 0.9);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const speed = 5 + hash(cx, 1, 2) * 9, head = (t * speed + hash(cx, 2, 3) * (rows + trailLen)) % (rows + trailLen), age = head - cy; // rows since the head passed this cell
      const rain = age >= 0 && age < trailLen ? 1 - age / trailLen : 0, L = lumaAt(small.data, (cy * cols + cx) * 4);
      const lit = Math.min(1, rain * (0.25 + 1.1 * L) + 0.12 * L), isHead = age >= 0 && age < 1.2 ? 1 : 0;
      const g = Math.floor(hash(cx, cy, 5 + Math.floor(t * 6 * (0.3 + hash(cx, cy, 6)))) * atlas.n);
      for (let y = 0; y < ch; y++) { const py = cy * ch + y; if (py >= h) break; for (let x = 0; x < cw; x++) {
        const px = cx * cw + x; if (px >= w) break;
        const a = (atlas.mask[g * cw * ch + y * cw + x] / 255) * lit, o = (py * w + px) * 4, base = 7 + L * 14;
        for (let c = 0; c < 3; c++) out.data[o + c] = base + ((isHead ? bright[c] : tint[c]) - base) * a;
        out.data[o + 3] = 255;
      } }
    }
    return out;
  },
};

const glitch: Effect = {
  id: "glitch", name: "Glitch Slices", family: "glitch", tags: ["glitch", "digital", "color", "noise", "motion", "broken"],
  desc: "A corrupted frame: sliced rows thrown sideways, channels torn apart, blocks duplicated.",
  animated: true,
  params: [P("amount", "Damage", 0, 1, 0.05, 0.55), P("seed", "Seed", 0, 99, 1, 7), P("split", "RGB split", 0, 24, 1, 8)],
  apply(src, p, env) {
    const { w, h } = src, k = env.k, out = cloneFrame(src), step = Math.floor(env.t * 8), s = p.seed + step * 101, nSlices = Math.round(4 + p.amount * 26);
    const split = Math.round(p.split * k * (0.5 + p.amount));
    // channel tear: red and blue slide opposite ways over the whole frame
    if (split) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; out.data[o] = src.data[(y * w + Math.max(0, x - split)) * 4]; out.data[o + 2] = src.data[(y * w + Math.min(w - 1, x + split)) * 4 + 2]; }
    for (let n = 0; n < nSlices; n++) {
      const y0 = Math.floor(hash(n, 1, s) * h), sh = Math.max(2, Math.floor((0.004 + hash(n, 2, s) ** 3 * 0.13) * h)), dx = Math.round((hash(n, 3, s) - 0.5) * 2 * p.amount * 0.35 * w * hash(n, 4, s));
      const mode = hash(n, 5, s), copy = out.data.slice(0);
      for (let y = y0; y < Math.min(h, y0 + sh); y++) for (let x = 0; x < w; x++) {
        const sx = ((x - dx) % w + w) % w, o = (y * w + x) * 4, so = (y * w + sx) * 4;
        if (mode < 0.2) { out.data[o] = copy[so]; out.data[o + 1] = copy[so + 1]; out.data[o + 2] = copy[so + 2]; } // plain shift
        else if (mode < 0.4) { out.data[o] = copy[so + 1]; out.data[o + 1] = copy[so + 2]; out.data[o + 2] = copy[so]; } // channels rotated
        else if (mode < 0.6) { const v = 255 - lumaAt(copy, so) * 255; out.data[o] = v; out.data[o + 1] = v * 0.3; out.data[o + 2] = 255 - v * 0.2; } // inverted magenta wash
        else { out.data[o] = copy[so]; out.data[o + 1] = copy[so + 1]; out.data[o + 2] = copy[so + 2]; }
      }
    }
    // datamosh blocks: rectangles re-read from elsewhere
    const blocks = Math.round(p.amount * 7);
    for (let n = 0; n < blocks; n++) {
      const bw = Math.floor((0.05 + hash(n, 11, s) * 0.2) * w), bh = Math.floor((0.02 + hash(n, 12, s) * 0.1) * h), bx = Math.floor(hash(n, 13, s) * (w - bw)), by = Math.floor(hash(n, 14, s) * (h - bh)), fx = Math.floor(hash(n, 15, s) * (w - bw)), fy = Math.floor(hash(n, 16, s) * (h - bh));
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const o = ((by + y) * w + bx + x) * 4, so = ((fy + y) * w + fx + x) * 4; out.data[o] = src.data[so]; out.data[o + 1] = src.data[so + 1]; out.data[o + 2] = src.data[so + 2]; }
    }
    return out;
  },
};

const chroma: Effect = {
  id: "chroma", name: "Chromatic Aberration", family: "glitch", tags: ["glitch", "lens", "color", "optical", "analog", "smooth"],
  desc: "A cheap lens: red and blue fringes drift apart toward the edges of the frame.",
  params: [P("amount", "Amount", 0, 30, 1, 11), P("mode", "Mode", 0, 1, 1, 0, ["Radial", "Sideways"])],
  apply(src, p, env) {
    const { w, h } = src, out = newFrame(w, h), amt = p.amount * env.k, cx = w / 2, cy = h / 2, maxR = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) / maxR, f = p.mode === 0 ? (amt * r * r * 1.5) / (Math.hypot(dx, dy) || 1) : 0, o = (y * w + x) * 4;
      const ox = p.mode === 0 ? dx * f : amt * 0.5, oy = p.mode === 0 ? dy * f : 0;
      out.data[o] = bilinear(src, x - ox, y - oy, 0); out.data[o + 1] = src.data[o + 1]; out.data[o + 2] = bilinear(src, x + ox, y + oy, 2); out.data[o + 3] = 255;
    }
    return out;
  },
};

const scanlines: Effect = {
  id: "scanlines", name: "CRT", family: "glitch", tags: ["glitch", "analog", "retro", "color", "scifi", "tube"],
  desc: "A curved tube TV: scanlines, a phosphor mask, bloom and a darkened rim.",
  params: [P("pitch", "Line pitch", 2, 8, 1, 3), P("mask", "Phosphor mask", 0, 1, 0.05, 0.5), P("curve", "Curvature", 0, 1, 0.05, 0.35)],
  apply(src, p, env) {
    const { w, h } = src, out = newFrame(w, h), pitch = Math.max(2, Math.round(p.pitch * env.k)), glow = blurPlane(lumaPlane(src), w, h, 3 * env.k);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let u = (x / w - 0.5) * 2, v = (y / h - 0.5) * 2;
      const r2 = u * u + v * v; u *= 1 + p.curve * 0.12 * r2; v *= 1 + p.curve * 0.12 * r2;
      const sx = (u / 2 + 0.5) * w, sy = (v / 2 + 0.5) * h, o = (y * w + x) * 4;
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) { out.data[o] = out.data[o + 1] = out.data[o + 2] = 4; out.data[o + 3] = 255; continue; }
      const line = 0.62 + 0.38 * Math.cos(((y % pitch) / pitch) * Math.PI * 2), m = x % 3, vig = 1 - 0.55 * Math.pow(Math.max(Math.abs(u), Math.abs(v)), 4) - 0.2 * r2 * p.curve, gl = glow[Math.min(h - 1, sy | 0) * w + Math.min(w - 1, sx | 0)] * 38;
      for (let c = 0; c < 3; c++) {
        const mk = 1 - p.mask * (m === c ? 0 : 0.5);
        out.data[o + c] = (bilinear(src, sx, sy, c) * line * mk * 1.3 + gl) * vig;
      }
      out.data[o + 3] = 255;
    }
    return out;
  },
};

export const GLITCH: Effect[] = [pixelsort, vhs, matrix, glitch, chroma, scanlines];
