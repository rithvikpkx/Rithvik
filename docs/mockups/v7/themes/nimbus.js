/* nimbus: a bright, airy sky world. The hero is a pixel-dithered cloud field (fbm quantised to coarse
   blocks, Bayer-dithered into four sky tones) that parts around the pointer, with a pixel sun or moon
   riding the visitor's own hour. Every other surface borrows the same pixel clouds: stepped section
   edges, sky tiles behind each project, postage stamps on the Play shelf, a forecast card for "now",
   and the ouroboros as mascot from the nav pill to a giant hatched mark in the footer.
   Where each effect lives (v7: calm structure, wild in one place):
   - Shader clouds at full intensity only in the hero (the first screen), behind a white clearing so the
     headline sits on solid ground; nowhere behind reading text.
   - Pixel clouds elsewhere are static decoration; they move only on interaction (card hover drift, band
     clouds that flee the pointer, stamp hover) or as a slow drift in the Play band while it is on screen.
   - The constellation map (#graph) is calm: pale panel, pixel nodes, it lights up on hover/click.
   - Cursor trail: tiny, fine pointers only. Performance mode (html.lite) and reduced motion stop the
     trail, the drifts, the footer turn and drop-shadow filters; the page stays a designed still. */
(function () {
  "use strict";

  /* ───────── Shader: pixel clouds, Bayer 4×4 ordered dither, sun/moon on the visitor's hour ───────── */
  const SHADER = `
#define SUN vec2(__SX__, __SY__)
#define NIGHT __NIGHT__
float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
void main(){
  // integer canvas pixels per dither cell keeps every block crisp; 4×4 cells make one cloud block
  float fine = max(1., floor(u_res.y / 190. + .5));
  vec2 f = floor(gl_FragCoord.xy / fine);
  vec2 blk = floor(f / 4.);
  float asp = u_res.x / u_res.y;
  vec2 uv = (blk * 4. + 2.) * fine / u_res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float t = u_time;
  vec2 d = p - m; float r2 = dot(d, d);
  // clouds slide away from the pointer, then a little hole of open sky follows it
  vec2 q = p + d * exp(-r2 * 8.) * .5;
  q = q * 1.2 + vec2(t * .016, u_scroll * .9);
  float n = fbm(q);
  float n2 = fbm(q * 2.4 + vec2(3.7, t * .012));
  float w = .44 + .72 * n + .2 * n2;
  // a clearing for the headline, sized to the screen's shape
  float rx = mix(.52, .36, smoothstep(.7, 1.5, asp));
  float tall = 1. - smoothstep(.7, 1.2, asp);
  vec2 e = (uv - vec2(.5, .48)) / vec2(rx, mix(.27, .36, tall));
  w += (1. - smoothstep(.62, 1.2, length(e))) * 1.2;
  w -= exp(-r2 * 30.) * .85;
  // on tall screens the sun climbs above the headline and shrinks a little
  vec2 sp = vec2(SUN.x * asp, mix(SUN.y, .855, tall));
  float sd = length(p - sp) / mix(1., .62, tall);
  w -= exp(-sd * sd * 50.) * .4;
  // dissolve into the white page below
  w += smoothstep(.2, .02, uv.y) * 1.4;
  w = clamp(w, 0., .999);
  // four tones; each block picks a pair and an ordered-dither ratio (solid, sparse, checker)
  float x = w * 3.; float lo = floor(x); float fr = x - lo;
  fr = fr < .3 ? 0. : (fr < .48 ? .25 : (fr < .72 ? .5 : 1.));
  float tone = lo + step(bayer4(f) + .001, fr);
  vec3 c = tone < .5 ? u_c3 : (tone < 1.5 ? u_c2 : (tone < 2.5 ? u_c1 : u_c0));
  float sky = step(tone, 1.5);
  float core = step(sd, .058);
  float halo = step(sd, .098) * (1. - core) * step(bayer4(f), .45);
  if (NIGHT > .5) {
    float moon = step(sd, .058);
    float shade = step(length(p - sp - vec2(.03, .012) * mix(1., .62, tall)) / mix(1., .62, tall), .05) * step(bayer4(f), .62);
    c = mix(c, vec3(.62, .68, .93), halo * sky * .6);
    c = mix(c, mix(vec3(1., .965, .86), vec3(.78, .8, .93), shade), moon * sky);
    float h = hash21(blk);
    vec2 cell = mod(f, 4.);
    float star = step(.972, h) * step(abs(cell.x - 1.), .1) * step(abs(cell.y - 2.), .1) * step(tone, .5);
    star *= step(-.2, sin(t * 1.6 + h * 60.));
    c = mix(c, vec3(1.), star);
  } else {
    c = mix(c, vec3(1., .905, .64), halo * sky);
    c = mix(c, vec3(1., .79, .235), core * sky);
  }
  gl_FragColor = vec4(c, 1.);
}`;

  /* ───────── The visitor's sky: four palettes keyed to their local hour ───────── */
  const SKIES = {
    dawn: { label: "Dawn", c: ["#FFFFFF", "#FFE3D2", "#9ED0FF", "#4AACFF"] },
    day: { label: "Daylight", c: ["#FFFFFF", "#C4E6FF", "#6CC4FF", "#0A9BFF"] },
    dusk: { label: "Golden hour", c: ["#FFF9F1", "#FFD8BC", "#F5A5AA", "#6E7FE4"] },
    night: { label: "Night sky", c: ["#F1F4FF", "#BFC9F5", "#6E7ED5", "#38479C"] },
  };
  const visitorHour = () => {
    let q = null; try { q = new URLSearchParams(location.search).get("hour"); } catch (e) {}
    const d = new Date();
    return q !== null && q !== "" && !isNaN(+q) ? ((+q % 24) + 24) % 24 : d.getHours() + d.getMinutes() / 60;
  };
  const skyOf = (h) => (h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night");
  const hourIn = (tz) => { const p = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()); return parseInt(p, 10) % 24; };
  const isDay = (h) => h >= 6 && h < 19;

  /* ───────── Pixel art: tiny raster helpers, rendered as merged SVG runs (1 unit = 1 pixel) ───────── */
  const grid = (w, h) => ({ w, h, c: new Array(w * h).fill("") });
  const put = (g, x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.c[y * g.w + x] = v; };
  const line = (g, x0, y0, x1, y1, v) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) put(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, v); };
  const poly = (g, pts, v) => { for (let i = 1; i < pts.length; i++) line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], v); };
  const disc = (g, cx, cy, r, v) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Math.hypot(x - cx, y - cy) <= r + 0.15) put(g, x, y, v); };
  const ring = (g, cx, cy, r, v) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (Math.abs(Math.hypot(x - cx, y - cy) - r) < 0.5) put(g, x, y, v); };
  const rectF = (g, x, y, w, h, v) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, v); };
  const rectO = (g, x, y, w, h, v) => { line(g, x, y, x + w - 1, y, v); line(g, x, y + h - 1, x + w - 1, y + h - 1, v); line(g, x, y, x, y + h - 1, v); line(g, x + w - 1, y, x + w - 1, y + h - 1, v); };
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
  /** Merge same-valued horizontal runs into rects; map turns semantic values into classes. */
  function runs(g, map = {}) {
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
  const svg = (g, map, cls = "", extra = "") => `<svg class="nb-px ${cls}" viewBox="0 0 ${g.w} ${g.h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${extra}${runs(g, map)}</svg>`;

  // periodic value noise so drifting cloud strips can loop seamlessly
  function noise(seed, period) {
    const H = (x, y) => { x = ((x % period) + period) % period; let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = H(xi, yi) + (H(xi + 1, yi) - H(xi, yi)) * u, b = H(xi, yi + 1) + (H(xi + 1, yi + 1) - H(xi, yi + 1)) * u; return a + (b - a) * v; };
  }
  function fbm1(seed, period) { const o = [noise(seed, period), noise(seed + 7, period * 2), noise(seed + 13, period * 4)]; return (x, y) => o[0](x, y) * 0.55 + o[1](x * 2, y * 2) * 0.3 + o[2](x * 4, y * 4) * 0.15; }
  // value 0..1 → sky(0) mid(1) pale(2) white(3), with checker blocks between neighbours
  const TONE = ["s", "m", "p", "w"];
  function tone(v) { const x = Math.max(0, Math.min(0.999, v)) * 3, lo = Math.floor(x), fr = x - lo; return fr < 0.34 ? TONE[lo] : fr < 0.66 ? "k" + lo + (lo + 1) : TONE[lo + 1]; }
  /** A tile of pixel sky (w×h cells) whose clouds repeat every `period` cells horizontally. */
  function skyTile(seed, w, h, period, bias = 0, grad = 0) {
    const g = grid(w, h), N = fbm1(seed, period / 8);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(g, x, y, tone((N(x / 8, y / 8) - 0.42) * 2.1 + bias + grad * (y / h - 0.5)));
    return g;
  }
  /** A stepped pixel-cloud edge: white page on top melting into sky below (flip for the reverse). */
  function edge(seed, flip) {
    const W = 192, R = 8, g = grid(W, R), N = fbm1(seed, 24);
    for (let y = 0; y < R; y++) for (let x = 0; x < W; x++) {
      const yy = flip ? R - 1 - y : y;
      put(g, x, y, tone(1.25 - (yy / (R - 1)) * 1.5 + (N(x / 6, y / 3) - 0.5) * 1.15));
    }
    return `<div class="nb-edge${flip ? " nb-edge-b" : ""}" aria-hidden="true"><svg class="nb-px" viewBox="0 0 ${W} ${R}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" focusable="false">${runs(g, MAPSKY)}</svg></div>`;
  }
  const MAPSKY = { s: "p0", m: "p1", p: "p2", w: "p3", k01: "k01", k12: "k12", k23: "k23" };
  const DEFS = `<svg class="nb-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    ${[["k01", "p0", "p1"], ["k12", "p1", "p2"], ["k23", "p2", "p3"]].map(([id, a, b]) => `<pattern id="nb-${id}" width=".5" height=".5" patternUnits="userSpaceOnUse"><rect width=".5" height=".5" class="${a}"/><rect width=".25" height=".25" class="${b}"/><rect x=".25" y=".25" width=".25" height=".25" class="${b}"/></pattern>`).join("")}
  </defs></svg>`;

  /** A loose pixel cloud sprite (white body, pale underside, dithered rim). */
  function cloud(seed, w = 22, h = 9) {
    const g = grid(w, h), r = rng(seed), big = h * (0.5 + r() * 0.08);
    rectF(g, 1, h - 3, w - 2, 3, "w");
    disc(g, w * (0.5 + (r() - 0.5) * 0.16), h - 1 - big, big, "w");
    disc(g, w * (0.24 + r() * 0.06), h - 1 - big * 0.62, big * 0.62, "w");
    disc(g, w * (0.76 - r() * 0.06), h - 1 - big * 0.5, big * 0.5, "w");
    for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) { if (g.c[y * w + x] === "w") { if (y === h - 1 || (y === h - 2 && (x + y) % 2)) g.c[y * w + x] = "p"; break; } }
    return g;
  }

  /* ───────── Pixel icons: one per project and per toy (16×12) ───────── */
  const ICONS = {
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
  const icon16 = (key, map, cls) => { const g = grid(16, 12); (ICONS[key] || (() => {}))(g); return svg(g, map, cls); };

  /** Tiny 9×9 weather glyphs for the forecast card. */
  function glyph(kind) {
    const g = grid(9, 9);
    if (kind === "sun") { disc(g, 4, 4, 2.1, "y"); [[4, 0], [4, 8], [0, 4], [8, 4], [1, 1], [7, 1], [1, 7], [7, 7]].forEach(([x, y]) => put(g, x, y, "y")); }
    if (kind === "moon") { disc(g, 4, 4, 3.2, "m"); disc(g, 5.6, 3, 2.6, ""); put(g, 7, 7, "y"); put(g, 8, 1, "y"); }
    if (kind === "part") { disc(g, 5.5, 3, 2, "y"); disc(g, 2.6, 6, 1.7, "c"); disc(g, 5, 5.6, 2.1, "c"); rectF(g, 1, 7, 7, 1, "c"); }
    if (kind === "bolt") { poly(g, [[5, 0], [2, 4], [5, 4], [3, 8]], "y"); put(g, 4, 4, "y"); }
    return svg(g, { y: "ps", m: "pm", c: "pc" }, "nb-glyph");
  }

  let DEF = null;

  /* ───────── render: the whole site ───────── */
  function render(C, H) {
    const { esc, icon, logo, portrait, mark } = H;
    // bake the visitor's hour into the sky before the core compiles the shader
    const hr = visitorHour(), sky = skyOf(hr), night = sky === "night";
    const fr = night ? (((hr - 18 + 24) % 24) / 12) : Math.min(1, Math.max(0, (hr - 6) / 12));
    const sx = 0.14 + 0.72 * Math.min(1, Math.max(0, fr)), sy = 0.6 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, fr)));
    DEF.colors = SKIES[sky].c.slice();
    DEF.shader = SHADER.replace("__SX__", sx.toFixed(3)).replace("__SY__", sy.toFixed(3)).replace("__NIGHT__", night ? "1." : "0.");

    const pad = (i) => String(i + 1).padStart(2, "0");
    const sfDay = isDay(hourIn(C.now.tz));
    const placeLabel = { home: "Home", school: "School", now: "Now" };
    const ON_SKY = { a: "p3", b: "p2", y: "ps" }, ON_PALE = { a: "p0", b: "p1", y: "ps" }, ON_SUN = { a: "pi", b: "p3", y: "p3" };

    const card = (p, i) => {
      const tile = skyTile(11 + i * 17, 64, 20, 32, -0.34 - (i % 3) * 0.04, 0.55);
      return `<a class="nb-card" href="#work" data-case="${p.slug}" aria-label="${esc(p.title)}: ${esc(p.headline)}. Open the case">
        <span class="nb-card-sky">
          <span class="nb-drift">${svg(tile, MAPSKY, "nb-tile")}</span>
          <span class="nb-card-ic">${icon16(p.slug, ON_SKY)}</span>
          <span class="nb-card-n">${pad(i)}</span>
          <span class="nb-card-kind">${icon(p.icon)}${esc(p.kind)}</span>
          <span class="nb-card-go" aria-hidden="true">${icon("arrow-up-right")}</span>
        </span>
        <span class="nb-card-tags">${p.tags.slice(0, 3).map((t) => `<span>${esc(t)}</span>`).join("")}</span>
        <span class="nb-card-t">${esc(p.title)}</span>
        <span class="nb-card-h">${esc(p.headline)}</span>
      </a>`;
    };

    const stampBg = ["sky", "sun", "pale", "sky", "pale", "sun"];
    const stamp = (t, i) => {
      const bg = stampBg[i % stampBg.length], map = bg === "sky" ? ON_SKY : bg === "sun" ? ON_SUN : ON_PALE;
      const c = cloud(31 + i * 5, 14, 6);
      return `<li class="nb-stamp-li" style="--tilt:${[-2.5, 2, -1.5, 2.5, -2, 1.5][i % 6]}deg">
        <button type="button" class="nb-stamp" data-play="${t.id}" aria-label="Play ${esc(t.name)}: ${esc(t.desc)}">
          <span class="nb-stamp-in">
            <span class="nb-stamp-art nb-bg-${bg}">
              <span class="nb-stamp-cloud">${svg(c, { w: bg === "pale" ? "p3" : "p3", p: bg === "sun" ? "p3" : "p2" })}</span>
              ${icon16(t.id, map, "nb-stamp-ic")}
              ${i % 3 === 1 ? `<span class="nb-postmark" aria-hidden="true">${mark()}</span>` : ""}
            </span>
            <span class="nb-stamp-meta"><span class="nb-stamp-n">${pad(i)}</span><span class="nb-stamp-v">${esc(t.desc)}</span></span>
            <span class="nb-stamp-t">${esc(t.name)}</span>
          </span>
        </button>
      </li>`;
    };

    const bandClouds = [[64, 6, 1], [86, 24, 0.65], [1, 50, 0.8], [46, 46, 0.55], [88, 70, 0.85], [22, 90, 0.6]]
      .map(([x, y, s], i) => `<span class="nb-bc" style="left:${x}%;top:${y}%;--s:${s};--d:${18 + i * 5}s"><span class="nb-bc-in">${svg(cloud(101 + i * 3), { w: "p3", p: "p2" })}</span></span>`).join("");

    const heroTile = skyTile(5, 32, 8, 16, -0.05, 0.4);

    return `<div class="nb" data-sky="${sky}">
${DEFS}
<header class="nb-nav" aria-label="Site">
  <nav class="nb-pill">
    <a class="nb-logo" href="#top" aria-label="Rithvik Praveen Kumar, back to top">${mark()}</a>
    <a href="#work">Work</a><a href="#about">About</a><a href="#play">Play</a>
  </nav>
  <div class="nb-nav-r">
    <a class="nb-btn nb-ink nb-px-c" href="#" data-resume>Resume</a>
    <button type="button" class="nb-round nb-ink" data-compose="Internship opportunity" aria-label="Email Rithvik">${icon("mail")}</button>
  </div>
</header>

<section class="nb-hero" id="top" aria-labelledby="nb-h1">
  <div class="nb-sky" id="nb-sky" aria-hidden="true"></div>
  <div class="nb-hero-in">
    <p class="nb-eyebrow"><span class="nb-eyebrow-m">${mark()}</span>${esc(C.name)}</p>
    <h1 id="nb-h1" class="nb-h1"><span class="nb-l1">Head in the clouds,<span class="nb-tile" aria-hidden="true"><span class="nb-tile-sky">${svg(heroTile, MAPSKY)}</span><span class="nb-tile-m">${mark()}</span></span></span> <span class="nb-l2">hands on the hardware.</span></h1>
    <p class="nb-lede"><b>${esc(C.role)}.</b> ${esc(C.line)}</p>
    <p class="nb-status"><span class="nb-sun-dot" aria-hidden="true"></span>${esc(C.status)}</p>
    <div class="nb-acts">
      <a class="nb-btn nb-ink nb-px-c" href="#" data-resume>Resume<span class="nb-btn-ar">${icon("arrow-up-right")}</span></a>
      <button type="button" class="nb-btn nb-white nb-px-c" data-compose="Internship opportunity">${icon("mail")}Email me</button>
      <button type="button" class="nb-btn nb-ghost nb-px-c" data-agent><span class="nb-prompt" aria-hidden="true">❯</span>Ask my agent</button>
    </div>
  </div>
  <p class="nb-yoursky"><span class="nb-yoursky-g">${glyph(night ? "moon" : sky === "day" ? "sun" : "part")}</span><span>Your sky · ${SKIES[sky].label} · <span data-nb-local>${esc(H.clock(undefined))}</span></span></p>
</section>

<section class="nb-sec nb-about" id="about" aria-labelledby="nb-h-about">
  <div class="nb-about-grid">
    <div class="nb-pt-wrap">
      <span class="nb-pt-cloud nb-pt-c1" aria-hidden="true">${svg(cloud(9, 26, 10), { w: "p2", p: "p1" })}</span>
      <span class="nb-pt-cloud nb-pt-c2" aria-hidden="true">${svg(cloud(23, 18, 8), { w: "p2", p: "p1" })}</span>
      ${portrait({ id: "nimbus", cls: "nb-pt" })}
    </div>
    <div class="nb-about-txt">
      <p class="nb-kicker">About</p>
      <h2 id="nb-h-about" class="nb-h2">Hi, I'm ${esc(C.first)}.</h2>
      ${C.about.map((a) => `<p class="nb-p">${esc(a)}</p>`).join("")}
      <ul class="nb-thesis">${C.thesis.map((t) => `<li><span class="nb-bullet" aria-hidden="true">${mark()}</span>${esc(t)}</li>`).join("")}</ul>
    </div>
  </div>

  <div class="nb-now" id="now">
    <p class="nb-kicker">Now</p>
    <h2 class="nb-h2 nb-c">Today's forecast</h2>
    <article class="nb-wx" aria-label="Rithvik right now">
      <div class="nb-wx-top nb-wx-${sfDay ? "day" : "night"}" data-nb-sf>
        <span class="nb-wx-bg" aria-hidden="true">${svg(skyTile(77, 48, 14, 48, sfDay ? -0.25 : -0.4, 1.1), MAPSKY)}</span>
        <span class="nb-wx-city">${icon("map-pin")}${esc(C.now.city)}</span>
        <span class="nb-wx-time" data-clock="${esc(C.now.tz)}">${esc(H.clock(C.now.tz))}</span>
        <span class="nb-wx-cond" data-nb-cond>${sfDay ? "Daylight" : "After dark"}</span>
        <span class="nb-wx-orb" data-nb-orb aria-hidden="true">${glyph(sfDay ? "sun" : "moon")}</span>
      </div>
      <ul class="nb-wx-rows">
        <li>${glyph("sun")}<span>Building</span><b>${esc(C.now.building)}</b></li>
        <li>${glyph("part")}<span>Researching</span><b>${esc(C.now.researching)}</b></li>
        <li>${glyph("bolt")}<span>Learning</span><b>${esc(C.now.learning)}</b></li>
      </ul>
      <ol class="nb-wx-places" aria-label="Places">
        ${C.places.map((pl) => `<li class="${pl.key === "now" ? "is-now" : ""}"><span class="nb-wx-k">${placeLabel[pl.key] || esc(pl.key)}</span><b>${esc(pl.city)}</b><span class="nb-wx-c"><span data-nb-orb-tz="${esc(pl.tz)}">${glyph(isDay(hourIn(pl.tz)) ? "sun" : "moon")}</span><span data-clock="${esc(pl.tz)}">${esc(H.clock(pl.tz))}</span></span></li>`).join("")}
      </ol>
    </article>
    <dl class="nb-nums">${C.numbers.map(([n, l]) => `<div><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join("")}</dl>
  </div>
</section>

<section class="nb-sec nb-work" id="work" aria-labelledby="nb-h-work">
  <header class="nb-sec-h"><p class="nb-kicker">Work</p><h2 id="nb-h-work" class="nb-h2">Things I've built</h2><p class="nb-sub">Six projects, from headsets to the cloud. Each one opens.</p></header>
  <div class="nb-cards">${C.projects.map(card).join("")}</div>
</section>

<section class="nb-sec nb-exp" id="experience" aria-labelledby="nb-h-exp">
  <header class="nb-sec-h"><p class="nb-kicker">Experience</p><h2 id="nb-h-exp" class="nb-h2">Where I've been</h2></header>
  <ol class="nb-roles">
    ${C.experience.map((x) => `<li class="nb-role" id="experience-${x.slug}">
      <p class="nb-when">${esc(x.when)}<span>${esc(x.where)}</span></p>
      <div class="nb-role-b">
        <h3>${esc(x.role)}</h3>
        <p class="nb-org">${esc(x.org)}</p>
        <ul>${x.desc.map((d) => `<li><span class="nb-bullet" aria-hidden="true">${mark()}</span>${esc(d)}</li>`).join("")}</ul>
        <p class="nb-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>
      </div>
    </li>`).join("")}
  </ol>
  <div class="nb-edu" id="education">
    <span class="nb-edu-sky" aria-hidden="true">${svg(skyTile(41, 48, 12, 24, 0.15, 0.7), MAPSKY)}</span>
    <img src="${esc(C.education.logo)}" alt="Purdue University" width="64" height="64" loading="lazy">
    <div>
      <p class="nb-kicker">Education</p>
      <h3>${esc(C.education.school)}</h3>
      <p>${esc(C.education.degree)}</p>
      <p class="nb-edu-m">${esc(C.education.focus)} · ${esc(C.education.grad)}</p>
    </div>
  </div>
</section>

<section class="nb-sec nb-graph" id="graph" aria-labelledby="nb-h-graph">
  <header class="nb-sec-h"><p class="nb-kicker">Map</p><h2 id="nb-h-graph" class="nb-h2">Constellations</h2><p class="nb-sub">Everything on record, as one sky. Hover a point to trace it; click to open.</p></header>
  <div class="nb-graph-sky">${H.graph({ id: "nimbus" })}</div>
</section>

<section class="nb-band" id="play" aria-labelledby="nb-h-play">
  ${edge(3, false)}
  <div class="nb-band-in">
    <div class="nb-bcs" aria-hidden="true">${bandClouds}</div>
    <header class="nb-sec-h nb-band-h"><p class="nb-kicker">Play</p><h2 id="nb-h-play" class="nb-h2">Recess</h2><p class="nb-sub">Six small toys for a slow afternoon. The games keep my score next to yours.</p></header>
    <ul class="nb-stamps">${H.PLAY.map(stamp).join("")}</ul>
  </div>
  ${edge(8, true)}
</section>

<section class="nb-sec nb-faq" id="faq" aria-labelledby="nb-h-faq">
  <div class="nb-faq-l">
    <p class="nb-kicker">Questions</p>
    <h2 id="nb-h-faq" class="nb-h2">Short answers</h2>
    <p class="nb-sub">Anything else, ask my agent. It only answers from what's on record.</p>
    <form class="nb-ask" id="nb-ask" autocomplete="off">
      <label for="nb-ask-in" class="sr-only">Ask the agent</label>
      <span class="nb-prompt" aria-hidden="true">❯</span>
      <input id="nb-ask-in" type="text" maxlength="500" placeholder="What stack did BoilerFrame use?">
      <button type="submit" class="nb-round nb-ink" aria-label="Ask">${icon("arrow-up")}</button>
    </form>
  </div>
  <div class="nb-qs">
    ${C.faq.map(([q, a]) => `<details class="nb-q"><summary>${esc(q)}<span class="nb-plus" aria-hidden="true"></span></summary><p>${esc(a)}</p></details>`).join("")}
  </div>
</section>

<section class="nb-sec nb-contact" id="contact" aria-labelledby="nb-h-contact">
  <p class="nb-kicker">Contact</p>
  <h2 id="nb-h-contact" class="nb-h-big">Write to me.</h2>
  <p class="nb-sub nb-c">Open to SWE and AI internships. The message goes straight to my inbox.</p>
  <div class="nb-acts nb-c">
    <button type="button" class="nb-btn nb-ink nb-px-c nb-btn-lg" data-compose="Internship opportunity">${icon("mail")}Write an email</button>
    <button type="button" class="nb-btn nb-white nb-px-c" data-copy="${esc(C.links.email)}">${icon("copy")}${esc(C.links.email)}</button>
  </div>
  <ul class="nb-links">
    <li><a href="${esc(C.links.github)}" target="_blank" rel="noopener">${logo("github")}GitHub</a></li>
    <li><a href="${esc(C.links.linkedin)}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a></li>
    <li><a href="#" data-resume>${icon("file-text")}Resume</a></li>
    <li><a href="#" data-agent>${icon("terminal")}Agent</a></li>
  </ul>
</section>

<footer class="nb-foot" id="colophon">
  <div class="nb-foot-top">
    <p class="nb-foot-name">${esc(C.first)}<br>${esc(C.last)}</p>
    <nav class="nb-foot-nav" aria-label="Footer"><a href="#work">Work</a><a href="#about">About</a><a href="#experience">Experience</a><a href="#graph">Map</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
    <p class="nb-colo">Clouds are one fragment shader, quantised to pixels and dithered by hand. The sky follows your clock. The photo is never touched. Set in Fraunces and Geist.</p>
  </div>
  <button type="button" class="nb-giant" aria-label="Spin the mark"><span class="nb-giant-a">${mark()}</span><span class="nb-giant-b">${mark()}</span></button>
</footer>
<div class="nb-trail" aria-hidden="true"></div>
</div>`;
  }

  /* ───────── mount: clocks, the pointer-shy band clouds, the cursor trail, the turning footer mark ───────── */
  function mount(root, H) {
    const offs = [], $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
    const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const rm = () => H.reduceMotion();

    // live clocks; the SF forecast card and each place flip between sun and moon with the local hour
    const tick = () => {
      $$("[data-clock]").forEach((c) => (c.textContent = H.clock(c.dataset.clock)));
      const loc = $("[data-nb-local]"); if (loc) loc.textContent = H.clock(undefined);
      const sfDay = isDay(hourIn(H.C.now.tz)), top = $("[data-nb-sf]");
      if (top && top.classList.contains("nb-wx-day") !== sfDay) { top.classList.toggle("nb-wx-day", sfDay); top.classList.toggle("nb-wx-night", !sfDay); $("[data-nb-cond]").textContent = sfDay ? "Daylight" : "After dark"; $("[data-nb-orb]").innerHTML = glyph(sfDay ? "sun" : "moon"); }
      $$("[data-nb-orb-tz]").forEach((el) => { const k = isDay(hourIn(el.dataset.nbOrbTz)) ? "sun" : "moon"; if (el.dataset.k !== k) { el.dataset.k = k; el.innerHTML = glyph(k); } });
    };
    tick(); const clockT = setInterval(tick, 15000);

    // ambient loops (tile drift, band clouds) only run while their section is on screen
    const io = new IntersectionObserver((en) => en.forEach((e) => e.target.classList.toggle("nb-live", e.isIntersecting)), { rootMargin: "60px" });
    $$(".nb-hero, .nb-band, .nb-foot").forEach((s) => io.observe(s));

    // the band's clouds drift away from the pointer and spring back
    const band = $(".nb-band"), bcs = $$(".nb-bc-in"), st = bcs.map(() => ({ x: 0, y: 0, tx: 0, ty: 0 }));
    let braf = 0, bp = null;
    const bstep = () => {
      braf = 0; let moving = false;
      bcs.forEach((el, i) => {
        const s = st[i]; s.tx = 0; s.ty = 0;
        if (bp) { const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = cx - bp[0], dy = cy - bp[1], d = Math.hypot(dx, dy) || 1, R = 220;
          if (d < R) { const k = (1 - d / R) ** 2 * 90; s.tx = (dx / d) * k - s.x * 0 ; s.ty = (dy / d) * k * 0.6; } }
        s.x += (s.tx - s.x) * 0.12; s.y += (s.ty - s.y) * 0.12;
        if (Math.abs(s.tx - s.x) > 0.3 || Math.abs(s.ty - s.y) > 0.3) moving = true;
        el.style.transform = `translate3d(${Math.round(s.x / 4) * 4}px, ${Math.round(s.y / 4) * 4}px, 0)`;
      });
      if (moving || bp) braf = requestAnimationFrame(bstep);
    };
    if (H.fine.matches && band) {
      on(band, "pointermove", (e) => { if (rm()) return; bp = [e.clientX, e.clientY]; if (!braf) braf = requestAnimationFrame(bstep); }, { passive: true });
      on(band, "pointerleave", () => { bp = null; if (!braf) braf = requestAnimationFrame(bstep); });
    }

    // a light trail of pixel puffs behind the pointer (fine pointers only, never under reduced motion)
    const trail = $(".nb-trail"), pool = [];
    let lastT = 0, lx = -99, ly = -99, pi = 0;
    if (H.fine.matches && trail) {
      for (let i = 0; i < 14; i++) { const s = document.createElement("i"); trail.appendChild(s); pool.push(s); }
      on(window, "pointermove", (e) => {
        if (rm() || e.pointerType !== "mouse") return;
        const now = performance.now(); if (now - lastT < 40 || Math.hypot(e.clientX - lx, e.clientY - ly) < 22) return;
        lastT = now; lx = e.clientX; ly = e.clientY;
        const el = pool[pi++ % pool.length], x = Math.round(e.clientX / 4) * 4 + 8, y = Math.round(e.clientY / 4) * 4 + 10;
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([{ transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 0.95 }, { transform: `translate(${x + 6}px, ${y - 22}px) scale(.4)`, opacity: 0 }], { duration: 720, easing: "steps(6, end)", fill: "forwards" });
      }, { passive: true });
    }

    // the giant mark turns as the footer scrolls into view; a click makes it chase its tail once
    const giant = $(".nb-giant"), foot = $(".nb-foot"); let sraf = 0;
    const turn = () => { sraf = 0; if (!foot.classList.contains("nb-live")) return; const r = foot.getBoundingClientRect(), p = 1 - Math.min(1, Math.max(0, r.top / innerHeight)); giant.style.setProperty("--turn", ((p - 1) * 120).toFixed(1) + "deg"); };
    on(window, "scroll", () => { if (!sraf && !rm()) sraf = requestAnimationFrame(turn); }, { passive: true });
    on(giant, "click", () => { if (rm()) return; giant.querySelectorAll(".mark").forEach((g) => g.animate([{ rotate: "0deg" }, { rotate: "-360deg" }], { duration: 1100, easing: "cubic-bezier(.77,0,.175,1)" })); });

    // the ask box hands the question to the agent
    on($("#nb-ask"), "submit", (e) => { e.preventDefault(); const inp = $("#nb-ask-in"), q = inp.value.trim(); H.openAgent(q || undefined); inp.value = ""; });

    // one answer open at a time
    const qs = $$(".nb-q");
    qs.forEach((d) => on(d, "toggle", () => { if (d.open) qs.forEach((o) => { if (o !== d) o.open = false; }); }));

    return () => { offs.forEach((f) => f()); io.disconnect(); clearInterval(clockT); cancelAnimationFrame(braf); cancelAnimationFrame(sraf); };
  }

  DEF = {
    id: "nimbus", name: "Nimbus", mood: "pixel clouds, your sky", dark: false,
    keywords: ["nimbus", "cloud", "clouds", "sky", "pixel", "pixels", "blue", "weather", "airy", "light", "sunny", "playful"],
    fonts: "family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..600,100;1,9..144,300..600,100",
    swatch: ["#E6F4FF", "#0E1B2B", "#0A9BFF", "#FFC93C"],
    cardFont: '"Fraunces", Georgia, serif',
    colors: SKIES.day.c.slice(),
    shaderScale: 0.35,
    shaderHost: "#nb-sky",
    shader: SHADER.replace("__SX__", ".5").replace("__SY__", ".8").replace("__NIGHT__", "0."),
    render,
    mount,
  };
  V6.theme(DEF);
})();
