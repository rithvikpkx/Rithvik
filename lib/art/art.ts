// Procedural project art: read a project's real fields, decide what it is "about", then draw it with one of a few
// generative grammars. Pure and deterministic (seeded by slug), so the server and client draw the same picture and a
// new project gets art the moment it exists. Output is a flat list of SVG nodes (a few hundred at most).

export type ArtProject = { slug: string; title: string; headline: string; kind: string; ctx?: string; tags: string[]; links: Record<string, string> };
/** ground, ink, accent, second. Any CSS colour, including `var(--x)`. */
export type Palette = [string, string, string, string];
/** Per-look knobs: `density` scales element counts, `stroke` scales line weights (both default 1). */
export type ArtParams = { density?: number; stroke?: number; [k: string]: number | undefined };

export const TRAITS = ["hardware", "signal", "ml", "vision", "web", "data", "people", "cloud"] as const;
export type Trait = (typeof TRAITS)[number];
export type Grammar = "circuit" | "signal" | "flow" | "cells" | "blocks" | "strata" | "orbit";
export const GRAMMAR: Record<Trait, Grammar> = {
  hardware: "circuit", signal: "signal", ml: "flow", vision: "cells", web: "blocks", data: "strata", people: "orbit", cloud: "orbit",
};

export type Traits = {
  scores: Record<Trait, number>;
  primary: Trait | null;
  secondary: Trait | null; // drawn faintly underneath when it scores at least half the primary
  complexity: number; // 0..1, from the size of the stack and the headline
  energy: number; // 0..1, newer (earlier in the list) is livelier
  code: boolean; // links to source: the frame gets registration marks
  demo: boolean; // links to a demo: a live dot
};
export type ArtNode = [tag: "path" | "circle" | "ellipse" | "rect", attrs: Record<string, string | number>];
export type Art = { w: number; h: number; grammar: Grammar; echo: Grammar | null; traits: Traits; nodes: ArtNode[] };

export const W = 400, H = 300;

// What words say about a project. Multi-word tags match whole; everything else matches per token.
const LEX: Record<Trait, string[]> = {
  hardware: ["arduino", "robot", "robotic", "arm", "hardware", "embedded", "circuit", "sensor", "sensors", "microcontroller", "raspberry", "firmware", "tinyml", "edge impulse", "c++", "fpga", "pcb", "iot", "drone", "motor", "piezoelectric"],
  signal: ["eeg", "bci", "neurosky", "openbci", "signal", "signals", "audio", "wave", "brain", "thought", "thoughts", "mind", "ecg", "emg", "sound", "radio", "frequency", "microphone", "microphones"],
  ml: ["tensorflow", "keras", "pytorch", "scikit-learn", "ml", "ai", "model", "models", "learning", "classifies", "classifier", "predict", "predicting", "prediction", "neural", "lasso", "regression", "rag", "llm", "ollama", "openai", "transformer"],
  vision: ["vision", "rekognition", "opencv", "image", "images", "video", "frame", "frames", "face", "faces", "facial", "camera", "detection", "yolo", "photo", "photos", "pixel"],
  web: ["react", "next.js", "javascript", "typescript", "html", "css", "web", "app", "frontend", "express", "node.js", "vercel", "site", "website", "browser", "qr", "segno", "mern"],
  data: ["pandas", "sql", "mongodb", "postgres", "supabase", "data", "dataset", "spending", "research", "statistics", "analytics", "numpy", "modeled", "tracks", "survey"],
  people: ["volunteer", "non-profit", "nonprofit", "community", "team", "users", "learners", "students", "social", "humanity", "habitat", "marketplace", "ebay", "e-commerce", "commerce", "listings", "staff", "teaching"],
  cloud: ["aws", "ec2", "cloudflare", "gcp", "azure", "docker", "kubernetes", "server", "serverless", "deployed", "google apps script", "lambda"],
};
const WORD = new Map<string, Trait[]>();
for (const t of TRAITS) for (const w of LEX[t]) WORD.set(w, [...(WORD.get(w) ?? []), t]);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9+.#-]+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, "")).filter(Boolean);

/** Small seeded PRNG (FNV-1a + mixing) so a slug always draws the same picture. */
export function rng(str: string) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

/** The "reasoning" step: weigh what the kind, stack, title, headline and context say, plus stack size, list position
 *  and links. Kind says what it is, so it counts most; the stack counts per tool; prose counts per word. */
export function traits(p: ArtProject, rank = 0): Traits {
  const scores = Object.fromEntries(TRAITS.map((t) => [t, 0])) as Record<Trait, number>;
  const add = (words: string[], w: number) => words.forEach((x) => WORD.get(x)?.forEach((t) => (scores[t] += w)));
  p.tags.forEach((tag) => add(WORD.has(tag.toLowerCase()) ? [tag.toLowerCase()] : tokens(tag), 1.5));
  add(tokens(p.kind), 4);
  add(tokens(p.title), 1.5);
  add(tokens(p.headline), 1);
  add(tokens(p.ctx ?? ""), 1);
  // stable order on ties: the TRAITS order
  const ranked = TRAITS.filter((t) => scores[t] > 0).sort((a, b) => scores[b] - scores[a]);
  const primary = ranked[0] ?? null;
  const second = ranked.find((t) => primary && GRAMMAR[t] !== GRAMMAR[primary]) ?? null;
  const links = Object.entries(p.links);
  return {
    scores, primary,
    secondary: second && primary && scores[second] >= scores[primary] / 2 ? second : null,
    complexity: Math.min(1, (p.tags.length + tokens(p.headline).length / 4) / 8),
    energy: 1 - Math.min(1, Math.max(0, rank)),
    code: links.some(([k, u]) => /git|code|repo|source/i.test(k) || /github\.com|gitlab\.com/i.test(u)),
    demo: links.some(([k, u]) => /demo|video|live|play|site/i.test(k) || /youtube\.com|youtu\.be|vimeo\.com/i.test(u)),
  };
}

type Ctx = { r: () => number; c: number; e: number; d: number; sw: number; ink: string; acc: string; sec: string; bg: string; fade: number; out: ArtNode[] };
const f = (n: number) => Math.round(n * 10) / 10;
const line = (pts: [number, number][]) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L");
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);
/** Smooth seeded 2D field in about -1..1: a few crossed sines (cheaper than noise and plenty for a sketch). */
function field(r: () => number) {
  const k = Array.from({ length: 4 }, () => [between(r, 0.006, 0.02), between(r, 0.006, 0.02), r() * 6.28, between(r, 0.4, 1)]);
  const n = k.reduce((s, [, , , a]) => s + a, 0);
  return (x: number, y: number) => k.reduce((s, [fx, fy, ph, a], i) => s + a * Math.sin(fx * x + (i % 2 ? -fy : fy) * y + ph), 0) / n;
}
const stroke = (cx: Ctx, color: string, w: number, op: number, extra: Record<string, string | number> = {}) =>
  ({ fill: "none", stroke: color, strokeWidth: f(w * cx.sw), strokeOpacity: f(op * cx.fade * 100) / 100, strokeLinecap: "round", strokeLinejoin: "round", ...extra });
const fill = (cx: Ctx, color: string, op: number) => ({ fill: color, fillOpacity: f(op * cx.fade * 100) / 100 });

/** Flow field (learning, models): streamlines following one seeded current. */
function flow(cx: Ctx) {
  const { r } = cx, fl = field(r), base = r() * Math.PI * 2, n = Math.round((22 + 26 * cx.c) * cx.d);
  for (let i = 0; i < n; i++) {
    let x = between(r, -20, W + 20), y = between(r, -20, H + 20);
    const pts: [number, number][] = [[x, y]];
    for (let s = 0; s < 30; s++) {
      const a = base + fl(x, y) * Math.PI * 1.3;
      x += Math.cos(a) * 7; y += Math.sin(a) * 7;
      pts.push([x, y]);
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) break;
    }
    const hot = r() < 0.1 + 0.08 * cx.e;
    cx.out.push(["path", { d: line(pts), ...stroke(cx, hot ? cx.acc : cx.ink, hot ? 1.8 : between(r, 0.6, 1.4), hot ? 0.95 : between(r, 0.25, 0.7)) }]);
  }
}

/** Signal (brains, sensors, sound): stacked channels that all react to one event. */
function signal(cx: Ctx) {
  const { r } = cx, n = Math.max(4, Math.min(18, Math.round((6 + 10 * cx.c) * cx.d))), gap = H / (n + 1);
  const ex = between(r, 0.32, 0.68) * W, sg = between(r, 22, 46), hot = Math.floor(r() * n);
  cx.out.push(["rect", { x: f(ex - sg * 1.6), y: 0, width: f(sg * 3.2), height: H, ...fill(cx, cx.sec, 0.12) }]);
  for (let i = 0; i < n; i++) {
    const y0 = gap * (i + 1), fr = [between(r, 0.05, 0.12), between(r, 0.15, 0.32), between(r, 0.4, 0.7)], ph = fr.map(() => r() * 6.28);
    const pts: [number, number][] = [];
    for (let x = -4; x <= W + 4; x += 4) {
      const env = 0.18 + (0.6 + 0.4 * cx.e) * Math.exp(-((x - ex) ** 2) / (2 * sg * sg));
      const v = (Math.sin(x * fr[0] + ph[0]) * 0.5 + Math.sin(x * fr[1] + ph[1]) * 0.33 + Math.sin(x * fr[2] + ph[2]) * 0.17) * env;
      pts.push([x, y0 + v * gap * 1.1]);
    }
    cx.out.push(["path", { d: line(pts), ...stroke(cx, i === hot ? cx.acc : cx.ink, i === hot ? 1.8 : 1, i === hot ? 1 : 0.35 + 0.4 * (i % 2)) }]);
  }
  for (let x = 20; x < W; x += 40) cx.out.push(["path", { d: `M${x} ${H - 8}V${H}`, ...stroke(cx, cx.ink, 1, 0.3) }]);
}

/** Circuit (hardware): traces routed out of one chip on a grid, 45° bends, pads at the ends. */
function circuit(cx: Ctx) {
  const { r } = cx, g = 10, cw = 60 + Math.round(cx.c * 3) * 10, ch = 50 + Math.round(cx.c * 2) * 10;
  const x0 = Math.round(between(r, 0.3, 0.55) * W / g) * g, y0 = Math.round(between(r, 0.28, 0.5) * H / g) * g;
  const n = Math.round((16 + 18 * cx.c) * cx.d);
  for (let i = 0; i < n; i++) {
    // pick a side and a pin on it, then walk outward: straight, one 45° jog, straight to an edge or a pad
    const side = Math.floor(r() * 4), along = Math.floor(between(r, 1, (side % 2 ? ch : cw) / g)) * g;
    let x = side === 0 ? x0 + along : side === 1 ? x0 + cw : side === 2 ? x0 + along : x0;
    let y = side === 0 ? y0 : side === 1 ? y0 + along : side === 2 ? y0 + ch : y0 + along;
    const dx = side === 1 ? 1 : side === 3 ? -1 : 0, dy = side === 0 ? -1 : side === 2 ? 1 : 0, jog = r() < 0.5 ? -1 : 1;
    const pts: [number, number][] = [[x, y]];
    const a = Math.round(between(r, 1, 5)) * g; x += dx * a; y += dy * a; pts.push([x, y]);
    const b = Math.round(between(r, 1, 5)) * g; x += (dx || jog) * b; y += (dy || jog) * b; pts.push([x, y]);
    const c = Math.round(between(r, 2, 16)) * g; x += dx * c; y += dy * c; pts.push([x, y]);
    const hot = r() < 0.12 + 0.1 * cx.e, col = hot ? cx.acc : r() < 0.25 ? cx.sec : cx.ink;
    cx.out.push(["path", { d: line(pts), ...stroke(cx, col, hot ? 1.7 : 1.1, hot ? 1 : 0.6) }]);
    if (x > 0 && x < W && y > 0 && y < H) cx.out.push(["circle", { cx: f(x), cy: f(y), r: 2.6, ...stroke(cx, col, 1.1, 0.9), fill: cx.bg }]);
  }
  cx.out.push(["rect", { x: x0, y: y0, width: cw, height: ch, rx: 3, ...stroke(cx, cx.acc, 1.6, 1), fill: cx.bg }]);
  cx.out.push(["rect", { x: x0 + 8, y: y0 + 8, width: cw - 16, height: ch - 16, rx: 1, ...stroke(cx, cx.ink, 0.8, 0.35) }]);
}

/** Cells (vision, images): packed circles, one region detected and boxed. */
function cells(cx: Ctx) {
  const { r } = cx, fl = field(r), fx = between(r, 0.3, 0.7) * W, fy = between(r, 0.3, 0.7) * H, fr = 46 + 20 * cx.c;
  const placed: [number, number, number][] = [], max = Math.round((90 + 70 * cx.c) * cx.d);
  for (let k = 0; k < 900 && placed.length < max; k++) {
    const x = r() * W, y = r() * H, rad = 4 + 12 * (0.5 + 0.5 * fl(x, y)) * (Math.hypot(x - fx, y - fy) < fr ? 0.6 : 1);
    if (placed.every(([px, py, pr]) => Math.hypot(px - x, py - y) > pr + rad + 1.5)) placed.push([x, y, rad]);
  }
  for (const [x, y, rad] of placed) {
    const inBox = Math.hypot(x - fx, y - fy) < fr;
    cx.out.push(["circle", { cx: f(x), cy: f(y), r: f(rad), ...stroke(cx, inBox ? cx.acc : cx.ink, 1, inBox ? 0.9 : 0.45), ...(inBox ? fill(cx, cx.acc, 0.3 + 0.5 * r()) : {}) }]);
  }
  const s = fr * 1.05, k = 10;
  cx.out.push(["path", { d: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => `M${f(fx + a * s)} ${f(fy + b * s - b * k)}V${f(fy + b * s)}H${f(fx + a * s - a * k)}`).join(""), ...stroke(cx, cx.acc, 2, 1) }]);
}

/** Blocks (web, apps): a mirrored cellular automaton, like an app glyph grown from one seeded row. */
function blocks(cx: Ctx) {
  const { r } = cx, s = 16, cols = Math.ceil(W / s / 2), rows = Math.ceil(H / s), rule = [30, 45, 73, 90, 105, 110, 150][Math.floor(r() * 7)];
  let row = Array.from({ length: cols }, () => r() < 0.45);
  const keep = Math.min(1, 0.55 * cx.d + 0.2);
  for (let y = 0; y < rows; y++) {
    row.forEach((on, i) => {
      if (!on || r() > keep) return;
      const hot = r() < 0.07 + 0.06 * cx.e;
      for (const x of [i, cols * 2 - 1 - i]) cx.out.push(["rect", { x: x * s + 2, y: y * s + 2, width: s - 4, height: s - 4, rx: 2, ...fill(cx, hot ? cx.acc : cx.ink, hot ? 1 : 0.2 + 0.6 * (y / rows)) }]);
    });
    // the right edge of the half meets its own mirror, so its right neighbour is itself
    row = row.map((on, i) => ((rule >> (((row[i - 1] ?? false) ? 4 : 0) | (on ? 2 : 0) | ((row[i + 1] ?? on) ? 1 : 0))) & 1) === 1);
  }
}

/** Strata (data, research): layered terrain bands with a fitted trend through scattered samples. */
function strata(cx: Ctx) {
  const { r } = cx, fl = field(r), ridge = field(r), n = Math.round((8 + 8 * cx.c) * Math.min(1.4, cx.d)), gap = H / n;
  for (let i = 0; i < n; i++) {
    // one shared ridge that flattens with depth, plus each layer's own wobble
    const pts: [number, number][] = [], lift = 70 * (1 - i / n);
    for (let x = -10; x <= W + 10; x += 10) pts.push([x, gap * (i + 0.5) + ridge(x * 1.8, 0) * lift + fl(x * 2, i * 60) * gap * 0.8]);
    cx.out.push(["path", { d: line(pts) + `L${W + 10} ${H + 10}L-10 ${H + 10}Z`, ...stroke(cx, cx.ink, 0.9, 0.55), ...fill(cx, cx.sec, 0.05 + 0.06 * (i % 3)) }]);
  }
  const slope = between(r, -0.55, -0.2), b = between(r, 0.6, 0.8) * H;
  for (let k = 0; k < 26; k++) {
    const x = between(r, 24, W - 24), y = b + slope * x + (r() - 0.5) * 70;
    cx.out.push(["circle", { cx: f(x), cy: f(y), r: 2.4, fill: cx.ink, fillOpacity: f(0.8 * cx.fade * 100) / 100 }]);
  }
  cx.out.push(["path", { d: line([[10, b + slope * 10], [W - 10, b + slope * (W - 10)]]), ...stroke(cx, cx.acc, 2, 1) }]);
}

/** Orbit (people, services): bodies on tilted ellipses around one bright centre, in a field of small dots. */
function orbit(cx: Ctx) {
  const { r } = cx, ox = between(r, 0.35, 0.65) * W, oy = between(r, 0.4, 0.6) * H, tilt = between(r, 0.32, 0.55), rot = between(r, -25, 25);
  const k = 3 + Math.round(cx.c * 3), dots = Math.round(60 * cx.d);
  for (let i = 0; i < dots; i++) cx.out.push(["circle", { cx: f(r() * W), cy: f(r() * H), r: f(between(r, 0.6, 1.6)), fill: cx.ink, fillOpacity: f(between(r, 0.15, 0.5) * cx.fade * 100) / 100 }]);
  const t = `rotate(${f(rot)} ${f(ox)} ${f(oy)})`, cos = Math.cos(rot * Math.PI / 180), sin = Math.sin(rot * Math.PI / 180);
  for (let i = 0; i < k; i++) {
    const rx = 40 + i * (150 / k) + r() * 10, ry = rx * tilt;
    cx.out.push(["ellipse", { cx: f(ox), cy: f(oy), rx: f(rx), ry: f(ry), transform: t, ...stroke(cx, cx.ink, 1, 0.45) }]);
    const bodies = 1 + Math.floor(r() * 3);
    for (let j = 0; j < bodies; j++) {
      const a = r() * Math.PI * 2, ex = rx * Math.cos(a), ey = ry * Math.sin(a), big = i === k - 2 && j === 0;
      // a short trail behind the body, along its orbit
      const trail: [number, number][] = Array.from({ length: 8 }, (_, s) => { const b = a - s * 0.06; return [ox + rx * Math.cos(b) * cos - ry * Math.sin(b) * sin, oy + rx * Math.cos(b) * sin + ry * Math.sin(b) * cos]; });
      cx.out.push(["path", { d: line(trail), ...stroke(cx, big ? cx.acc : cx.ink, big ? 3 : 2, 0.5) }]);
      cx.out.push(["circle", { cx: f(ox + ex * cos - ey * sin), cy: f(oy + ex * sin + ey * cos), r: big ? 7 : f(between(r, 2.5, 5)), fill: big ? cx.acc : r() < 0.4 ? cx.sec : cx.ink, fillOpacity: cx.fade }]);
    }
  }
  cx.out.push(["circle", { cx: f(ox), cy: f(oy), r: 16 + 6 * cx.e, ...fill(cx, cx.acc, 0.2) }]);
  cx.out.push(["circle", { cx: f(ox), cy: f(oy), r: 9, fill: cx.acc, fillOpacity: cx.fade }]);
}

const DRAW: Record<Grammar, (cx: Ctx) => void> = { flow, signal, circuit, cells, blocks, strata, orbit };
const ALL = Object.keys(DRAW) as Grammar[];

/** The art for one project: ground, the secondary grammar as a faint underlayer, the primary grammar, then the
 *  frame marks its links earn. `rank` is its place in the list, 0 (newest) to 1. */
export function projectArt(p: ArtProject, palette: Palette, params: ArtParams = {}, rank = 0): Art {
  const t = traits(p, rank), r = rng(p.slug);
  const grammar = t.primary ? GRAMMAR[t.primary] : ALL[Math.floor(r() * ALL.length)];
  const echo = t.secondary ? GRAMMAR[t.secondary] : null;
  const [bg, ink, acc, sec] = palette, out: ArtNode[] = [["rect", { x: 0, y: 0, width: W, height: H, fill: bg }]];
  const base = { r, c: t.complexity, e: t.energy, sw: params.stroke ?? 1, bg, out };
  // the echo reuses the seed stream, so it is stable too; drawn in the second colour only
  if (echo) DRAW[echo]({ ...base, d: (params.density ?? 1) * 0.35, ink: sec, acc: sec, sec, fade: 0.5 });
  DRAW[grammar]({ ...base, d: params.density ?? 1, ink, acc, sec, fade: 1 });
  if (t.code) {
    const m = 12, k = 9, cx = { ...base, d: 1, ink, acc, sec, fade: 1 } as Ctx;
    out.push(["path", { d: [[m, m, 1, 1], [W - m, m, -1, 1], [W - m, H - m, -1, -1], [m, H - m, 1, -1]].map(([x, y, a, b]) => `M${x} ${y + b * k}V${y}H${x + a * k}`).join(""), ...stroke(cx, ink, 1.2, 0.7) }]);
  }
  if (t.demo) out.push(["circle", { cx: W - 24, cy: 24, r: 4.5, fill: acc }]);
  return { w: W, h: H, grammar, echo, traits: t, nodes: out };
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/** The art as a standalone SVG string (tests, data URIs). */
export function artToSvg(a: Art): string {
  const body = a.nodes.map(([tag, at]) => `<${tag} ${Object.entries(at).filter(([, v]) => v !== undefined).map(([k, v]) => `${kebab(k)}="${esc(v)}"`).join(" ")}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.w} ${a.h}">${body}</svg>`;
}
