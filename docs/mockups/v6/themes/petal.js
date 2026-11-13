/* Petal: the default first impression. A living silk bloom fills the first screen (ridged folds, derivative
   normals, fake subsurface red, pollen stamens), the name set huge and quiet beside it. The page unfolds in
   vellum chapters with open apertures between them where the bloom keeps breathing; work lives in a
   filmstrip of thread drawings that open the case sheet. */
(function () {
  "use strict";

  /* ───────── Thread drawings for the filmstrip: one woven motif per project ───────── */
  const FW = 300, FH = 380;
  /** Deterministic noise so every render weaves the same threads. */
  const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  /** Hermite step, the same curve the shader uses. */
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /** Samples y = f(x) across the frame into one SVG path. */
  const trace = (f, step = 6) => { let d = ""; for (let x = -12; x <= FW + 12; x += step) d += (d ? "L" : "M") + x + " " + f(x).toFixed(1); return d; };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  /** One thread element; --i staggers the unweave, --d is how far it slips when the frame is active. */
  const th = (d, i, cls = "") => `<path class="th${cls ? " " + cls : ""}" d="${d}" style="--i:${i};--d:${((rnd(i * 3.1 + d.length) - 0.5) * 34).toFixed(1)}px"/>`;

  const MOTIF = {
    // noisy signal on the left resolves into one lifted bundle: intent becoming motion
    "mind-controlled-arm": () => range(26).map((k) => {
      const y0 = 40 + k * 12;
      return th(trace((x) => {
        const t = ss(60, 205, x), arm = 200 - 120 * Math.pow(Math.max(0, (x - 140) / 160), 1.4);
        const noise = (Math.sin(x * 0.16 + k * 1.7) * 5 + Math.sin(x * 0.41 + k * 2.9) * 2.4) * (1 - ss(10, 180, x));
        return (1 - t) * y0 + t * (arm + (y0 - 190) * 0.07) + noise;
      }, 4), k, k === 13 ? "hi" : "");
    }).join("") + `<circle class="th-dot" cx="292" cy="82" r="3"/>`,
    // threads part around a detection box; the timeline below marks where the face appears
    boilerframe: () => range(30).map((k) => {
      const y0 = 34 + k * 10.5, side = y0 < 180 ? -1 : 1;
      return th(trace((x) => y0 + side * 64 * Math.exp(-(((x - 150) / 62) ** 2)) * Math.exp(-(((y0 - 180) / 80) ** 2))), k);
    }).join("") + `<g class="th-box"><path d="M96 116v-14h14M204 116v-14h-14M96 244v14h14M204 244v14h-14"/><path d="M150 172v16M142 180h16"/></g>`
      + `<g class="th-ticks">${range(30).map((i) => `<rect x="${12 + i * 9.4}" y="350" width="2" height="${[4, 5, 11, 12, 13, 22, 23].includes(i) ? 14 : 6}" class="${[4, 5, 11, 12, 13, 22, 23].includes(i) ? "on" : ""}"/>`).join("")}</g>`,
    // sixteen channels, three regimes: left, neutral, right
    "eeg-thought-prediction": () => range(16).map((k) => {
      const y0 = 78 + k * 16, ph = rnd(k) * 6.28, a = 0.6 + rnd(k + 9) * 0.8;
      return th(trace((x) => {
        const l = 1 - ss(88, 112, x), r = ss(188, 212, x), n = 1 - l - r;
        return y0 + a * (l * 6 * Math.sin(x * 0.34 + ph) + n * 2.2 * Math.sin(x * 0.11 + ph) + r * 4.5 * Math.sin(x * 0.62 + ph * 1.3));
      }, 3), k, k === 6 || k === 11 ? "hi" : "");
    }).join("") + `<g class="th-lbl"><text x="50" y="52">L</text><text x="150" y="52">N</text><text x="250" y="52">R</text></g><path class="th-sep" d="M100 64V336M200 64V336"/>`,
    // most threads shrink away (Lasso); three survive and climb the fit
    "citizen-happiness": () => range(24).map((k) => {
      const y0 = 46 + k * 13, keep = k === 5 || k === 12 || k === 19;
      return th(trace((x) => { const t = ss(20, 250, x); return (1 - t) * y0 + t * (300 - x * 0.62 + (y0 - 190) * (keep ? 0.05 : 0.16)); }), k, keep ? "hi" : "ghost");
    }).join("") + range(18).map((i) => { const x = 30 + rnd(i + 40) * 250; return `<circle class="th-pt" cx="${x.toFixed(1)}" cy="${(300 - x * 0.62 + (rnd(i + 70) - 0.5) * 70).toFixed(1)}" r="2"/>`; }).join(""),
    // a code woven out of thread: runs of modules become thick stitches
    qrify: () => {
      const N = 25, M = 8.6, ox = (FW - N * M) / 2, oy = (FH - N * M) / 2;
      const finder = (r, c) => { const f = (R, C) => { const y = r - R, x = c - C; if (x < 0 || y < 0 || x > 6 || y > 6) return null; return x === 0 || y === 0 || x === 6 || y === 6 || (x > 1 && x < 5 && y > 1 && y < 5); };
        return f(0, 0) ?? f(0, N - 7) ?? f(N - 7, 0); };
      return range(N).map((r) => {
        const y = oy + r * M + M / 2; let runs = "";
        let start = -1;
        for (let c = 0; c <= N; c++) {
          const fp = c < N ? finder(r, c) : null, on = c < N && (fp !== null ? fp : r === 6 || c === 6 ? (r + c) % 2 === 0 : rnd(r * 31 + c) > 0.52);
          if (on && start < 0) start = c;
          if (!on && start >= 0) { runs += `M${(ox + start * M + 1).toFixed(1)} ${y.toFixed(1)}H${(ox + c * M - 1).toFixed(1)}`; start = -1; }
        }
        return th(`M-12 ${y.toFixed(1)}H${FW + 12}`, r, "faint") + (runs ? th(runs, r, "q") : "");
      }).join("");
    },
    // one interface forks into two marketplaces
    "habitat-humanity-ecomm": () => range(24).map((k) => {
      const y0 = 40 + k * 13, up = k % 2 === 0;
      return th(trace((x) => {
        const a = ss(0, 110, x), b = ss(140, 260, x);
        const mid = 190 + (y0 - 190) * 0.18, fork = 190 + (up ? -84 : 84) + (y0 - 190) * 0.14;
        return (1 - a) * y0 + a * ((1 - b) * mid + b * fork);
      }), k, k === 0 || k === 1 ? "hi" : "");
    }).join("") + `<path class="th-node" d="M126 184l6 6-6 6-6-6z"/>`,
  };

  /* ───────── The shader: ridged silk folds, derivative normals, fake subsurface, pollen, grain ───────── */
  const SHADER = `
#define TAU 6.2831853
#define PI 3.1415927
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float lobe(float a, float n, float ph){ return pow(.5 + .5 * cos(n * (a - ph)), .6); }
// silk height for one petal layer, in flower space (r = 1 at the outer petals)
float folds(vec2 p, float L, float t, vec2 mp){
  float r = length(p);
  vec2 e = p / max(r, .001);
  // angle embedded on a circle (seam-free) drifting with radius, so creases fan out from the heart
  vec2 q = e * (.95 + .25 * L) + vec2(r * .7 - t, r * .35 + L * 4.3);
  float n1 = 1. - abs(snoise(q));
  float n2 = snoise(q * 1.9 + vec2(L * 7.3, t * .7));
  float n3 = snoise(q * 5.3 + vec2(t, L));
  float h = n1 * n1 * n1 * .9 + n2 * .22 + n3 * .018 + r * r * .6;
  vec2 dm = p - mp;
  return h - .4 * exp(-dot(dm, dm) * 10.);   // the pointer presses a soft dimple into the silk
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * u_res) / u_res.y;
  float asp = u_res.x / u_res.y, T = u_time, t = T * .026, s = u_scroll;
  float k = smoothstep(.7, 1.4, asp);
  // first screen: a flat red hit with a dark heart; it breathes out into silk as the page scrolls
  float z = 1. - smoothstep(0., .09, s);
  vec2 oc = vec2(0., mix(-.2, 0., k));
  float orR = min(.3, .36 * asp);
  vec2 c = mix(vec2(.1, -.31), vec2(.22 * asp, -.08), k);
  float R = mix(.41, .58, k);
  c += vec2(-.46 * k - .04, .16) * smoothstep(0., .55, s) + vec2(.3 * k + .04, -.22) * smoothstep(.5, 1., s);
  R *= (1. + 1.05 * s + 1.5 * smoothstep(.72, 1., s)) * (1. + .022 * sin(T * .42));
  c = mix(c, oc, z); R = mix(R, orR / .27 * (1. + .03 * sin(T * .42)), z);
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  vec2 dm = uv - m;
  uv -= dm * .2 * exp(-dot(dm, dm) * 9.);          // the folds part around the pointer
  mat2 Rm = rot2(.7 * s + T * .004);
  vec2 p = Rm * (uv - c) / R, mp = Rm * (m - c) / R;
  float r = length(p), a = atan(p.y, p.x);
  vec2 e = p / max(r, .001);
  float wob = fbm(e * 1.5 + vec2(t * .7, -t * .5)) * .085;   // torn, living petal edges
  float ph = T * .005;
  float r0 = (.43 + wob * .6) * mix(.6, 1., lobe(a, 5., ph));
  float r1 = (.75 + wob) * mix(.55, 1., lobe(a, 5., ph + PI / 5.));
  float r2 = (1.02 + wob * 1.4) * mix(.4, 1., lobe(a, 3., .9 - ph * .7));
  float L = r < r0 ? 0. : (r < r1 ? 1. : 2.);
  float rL = L < .5 ? r0 : (L < 1.5 ? r1 : r2);
  float rP = L < .5 ? 0. : (L < 1.5 ? r0 : r1);
  float eps = 2.5 / (u_res.y * R), px = 1.7 / (u_res.y * R);
  float h0 = folds(p, L, t, mp), hx = folds(p + vec2(eps, 0.), L, t, mp), hy = folds(p + vec2(0., eps), L, t, mp);
  vec3 n = normalize(vec3((h0 - hx) / eps * .1, (h0 - hy) / eps * .1, 1.));
  vec3 Ld = normalize(vec3(-.5, .62, .62));
  float wrap = clamp((dot(n, Ld) + .45) / 1.45, 0., 1.);
  float crest = smoothstep(.35, 1., h0 - r * r * .6);
  float rim = exp(-max(rL - r, 0.) / .06);                 // thin edges glow: light passing through
  float shade = 1. - .55 * exp(-max(r - rP, 0.) / .09) * step(.5, L);   // the petal above casts a shadow
  vec3 fog = u_c0, crim = u_c1, ox = u_c2, pol = u_c3, red = vec3(1., .02, .03);
  vec3 col = mix(ox * .32, ox, smoothstep(.0, .45, wrap));
  col = mix(col, crim, smoothstep(.32, .82, wrap));
  col = mix(col, vec3(1., .3, .24), clamp(crest * .38 + rim * .45, 0., 1.) * (.3 + .7 * wrap));   // subsurface scarlet
  col = mix(col, vec3(1., .62, .56), rim * rim * .38 * wrap);
  col += pow(abs(sin(a * 58. + h0 * 4.)), 40.) * smoothstep(.15, .7, r) * .07 * vec3(1., .55, .5);   // veins
  col *= shade * (1. - .12 * L);
  col += pow(max(dot(n, normalize(Ld + vec3(0., 0., 1.))), 0.), 28.) * .16 * vec3(1., .86, .84);   // silk sheen
  col = mix(ox * .35, col, smoothstep(0., px * 1.4, rL - r));   // a hairline where one petal ends over the next
  // the red hit: the same silk, pressed almost flat into one saturated field
  vec3 hit = red * (.9 + .12 * wrap) * mix(1., shade, .18);   // silk only whispers under the red
  hit = mix(red * .86, hit, smoothstep(0., px * 2.5, rL - r));
  col = mix(col, hit, z * .97);
  float od = length(uv - oc) / orR;
  col = mix(col, vec3(.018, 0., .006), z * (1. - smoothstep(.45, 1.2, od)));   // the dark heart
  // the heart: a dark well, cream filaments, pollen anthers
  if (r < .28) {
    float cnt = 52., ca = (a / TAU + .5) * cnt, id = floor(ca), fa = fract(ca) - .5;
    float len = .07 + .14 * hash21(vec2(id, 7.));
    float fil = smoothstep(.13, 0., abs(fa)) * step(r, len) * smoothstep(.02, .07, r);
    col = mix(col, mix(vec3(.97, .84, .6) * (.5 + .5 * wrap), vec3(1., .12, .1), z * .6), fil * .7);
    col *= mix(.28, 1., smoothstep(0., .08, r));
    col += pol * .22 * exp(-r * 18.) * (1. - z);
    for (int j = -1; j <= 1; j++) {
      float jd = id + float(j), ln = .07 + .14 * hash21(vec2(mod(jd + cnt, cnt), 7.));
      float an = (jd + .5) / cnt * TAU - PI;
      vec2 dir = vec2(cos(an), sin(an)), lp = p - dir * ln;
      lp = vec2(dot(lp, dir), dot(lp, vec2(-dir.y, dir.x)));   // anther frame: along and across its filament
      float sz = .008 + .006 * hash21(vec2(jd, 3.));
      float d = length(lp * vec2(.55, 1.15));                   // elongated, like real anthers
      float anth = smoothstep(sz, sz * .4, d);
      vec3 pc = mix(pol * vec3(.62, .4, .1), pol * 1.06, smoothstep(sz, -sz * .4, length(lp * vec2(.55, 1.15) - vec2(.002, .003))));
      col = mix(col, pc, anth);
    }
  }
  float inside = 1. - smoothstep(r2 - px, r2 + px, r);
  vec3 bg = fog * (1. - .045 * dot(uv, uv));
  bg *= 1. - .16 * exp(-max(r - r2, 0.) * 4.) * (1. - inside);   // the bloom's shadow on the fog
  vec2 g = uv * 11. + vec2(sin(T * .07) * .4, -T * .045);       // a little pollen adrift in the air
  vec2 gi = floor(g), gf = fract(g) - .5;
  float hh = hash21(gi);
  float speck = step(.955, hh) * smoothstep(.06, .015, length(gf - (vec2(hash21(gi + 3.), hash21(gi + 5.)) - .5) * .6));
  bg = mix(bg, mix(pol, crim, step(.985, hh)), speck * .6);
  bg = mix(bg, red * .8, z);
  col = mix(bg, col, inside);
  // a dot grid on the red, like a field of tiny pins
  vec2 gd = (uv - oc) * 7.5, gq = fract(gd) - .5;
  float dots = smoothstep(.03, .014, length(gq)) * smoothstep(.85, 1.25, od);
  col = mix(col, vec3(.05, 0., .01), dots * z * .8);
  float gr = hash21(gl_FragCoord.xy + floor(T * 24.) * 1.731) - .5;   // dithered grain: texture, not blur
  col += gr * .05;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

  V6.theme({
    id: "petal", name: "Petal", mood: "a red hit, then silk", dark: false,
    keywords: ["petal", "flower", "bloom", "silk", "red", "rose", "crimson", "ethereal", "organic"],
    fonts: "family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=Geist+Mono:wght@400;500;600",
    swatch: ["#FF0A0A", "#0E0205", "#E8E6E3", "#F5C400"],
    cardFont: '"Cormorant Garamond", serif',
    colors: ["#E8E6E3", "#D7061C", "#5A0010", "#F5C400"],
    shaderScale: 0.5,
    shader: SHADER,

    render(C, H) {
      const e = H.esc, pad = (n) => String(n).padStart(2, "0");
      const [kAbout0, kAbout1] = C.about;
      const placeLabel = { home: "Home", school: "School", now: "Now" };
      const frames = C.projects.map((p, i) => `
        <li class="pe-frame${i === 0 ? " is-active" : ""}" data-i="${i}">
          <p class="pe-cap" aria-hidden="true"><b>${e(p.title)}</b> <span>${e(p.kind)}</span></p>
          <i class="pe-caret" aria-hidden="true">◆</i>
          <button type="button" class="pe-art" data-case="${p.slug}" aria-label="Open ${e(p.title)}">
            <svg viewBox="0 0 ${FW} ${FH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${MOTIF[p.slug] ? MOTIF[p.slug]() : ""}</svg>
            <span class="pe-art-n">${pad(i + 1)}</span><span class="pe-art-ic">${H.icon(p.icon)}</span>
          </button>
          <h3 class="pe-ft"><button type="button" data-case="${p.slug}">${e(p.title)}</button></h3>
          <p class="pe-fh">${e(p.headline)}</p>
        </li>`).join("");
      const roles = C.experience.map((x, i) => `
        <li class="pe-role" id="experience-${x.slug}">
          <p class="pe-when"><b>${e(x.when)}</b><span>${e(x.where)}</span></p>
          <div class="pe-role-main">
            <h3><span class="pe-role-r">${e(x.role)}</span> <span class="pe-role-o">${e(x.org)}</span></h3>
            <ul>${x.desc.map((d) => `<li>${e(d)}</li>`).join("")}</ul>
            <p class="pe-fx">${x.tags.map(e).join(" · ")}</p>
          </div>
          <span class="pe-role-n" aria-hidden="true">${pad(i + 1)}</span>
        </li>`).join("");
      const ed = C.education;
      const faq = C.faq.map(([q, a]) => `<details class="pe-faq"><summary><span>${e(q)}</span><i aria-hidden="true">+</i></summary><p>${e(a)}</p></details>`).join("");
      /** Pinned tabs with thread leaders into the bloom; P rows are [labelX, labelY, dotX, dotY, side] in % of the aperture. */
      const pins = (items, P) => `<svg class="pe-leads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${P.map((q) => `<path d="M${q[0]} ${q[1]} L${q[2]} ${q[3]}"/>`).join("")}</svg>`
        + P.map((q) => `<i class="pe-dot" style="left:${q[2]}%;top:${q[3]}%" aria-hidden="true"></i>`).join("")
        + `<ol class="pe-pins">${items.map((h, i) => `<li class="pe-pin ${P[i][4]}" style="left:${P[i][0]}%;top:${P[i][1]}%">${h}</li>`).join("")}</ol>`;
      const thesis = pins(C.thesis.map((t, i) => `<b>${pad(i + 1)}</b><span>${e(t)}</span>`), [[30, 26, 46, 40, "l"], [64, 48, 54, 58, "r"], [32, 74, 47, 66, "l"]]);
      // toys from the shared Play window; names come from the core when it lists them
      const toys = (H.PLAY && H.PLAY.length ? H.PLAY : ["records", "artboard", "typeracer", "angle", "dots", "center"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) })));
      const play = pins(toys.map((t, i) => `<button type="button" data-play="${e(t.id)}"${t.desc ? ` title="${e(t.desc)}"` : ""}><b>${pad(i + 1)}</b><span>${e(t.name)}</span><i aria-hidden="true">↗</i></button>`),
        [[28, 18, 40, 28, "l"], [72, 20, 60, 30, "r"], [20, 46, 34, 46, "l"], [80, 48, 66, 48, "r"], [28, 76, 40, 66, "l"], [72, 78, 60, 68, "r"]].slice(0, toys.length));
      const nums = pins(C.numbers.map(([n, l]) => `<b>${e(n)}</b><span>${e(l)}</span>`), [[30, 22, 44, 34, "l"], [68, 30, 57, 42, "r"], [28, 70, 42, 60, "l"], [70, 76, 59, 64, "r"]]);

      return `<div class="pe" id="pe">
  <nav class="pe-tab" aria-label="Sections">
    <a href="#top" class="pe-tab-mark" aria-label="Top">${H.mark ? H.mark() : ""}<span>RPK</span></a><a href="#work">Work</a><a href="#experience">Record</a><a href="#play">Play</a><a href="#contact">Contact</a>
  </nav>
  <p class="pe-clock" aria-label="Local time in ${e(C.now.city)}"><i class="pe-live" aria-hidden="true"></i><span>${e(C.now.city)}</span> <b data-pe-hm>--:--</b><span class="pe-sec" data-pe-s></span> <span data-pe-ap></span></p>
  <div class="pe-rail" aria-hidden="true"><i class="pe-rail-mark">◆</i></div>

  <header id="top" class="pe-hero">
    <span class="pe-crop c1" aria-hidden="true"></span><span class="pe-crop c2" aria-hidden="true"></span><span class="pe-crop c3" aria-hidden="true"></span><span class="pe-crop c4" aria-hidden="true"></span>
    <h1 class="pe-name"><span class="w1">${e(C.first)}</span> <span class="w2">${e(C.last.split(" ")[0])}</span> <span class="w3">${e(C.last.split(" ").slice(1).join(" "))}</span></h1>
    <p class="pe-bigtime" aria-label="Local time in ${e(C.now.city)}"><b data-pe-bt>--:--</b><span><span data-pe-bap></span> in ${e(C.now.city)}</span></p>
    <div class="pe-hero-in">
      <p class="pe-kicker"><b>${e(C.role)}</b></p>
      <p class="pe-line">${e(C.line)}</p>
      <p class="pe-status"><i class="pe-live" aria-hidden="true"></i>${e(C.status)}</p>
      <div class="pe-acts">
        <button type="button" class="pe-btn" data-resume>${H.icon("file-text")}<span>Resume</span></button>
        <button type="button" class="pe-btn" data-compose>${H.icon("mail")}<span>Email</span></button>
        <button type="button" class="pe-btn ghost" data-agent><span class="pe-pr" aria-hidden="true">❯</span><span>Ask the agent</span></button>
      </div>
    </div>
    <p class="pe-readout" aria-hidden="true"><span>u_time <b data-ro-t>0.00</b></span><span>u_mouse <b data-ro-m>.50 .50</b></span></p>
    <a class="pe-cue" href="#about"><span>Unfold</span><i aria-hidden="true"></i></a>
  </header>

  <section id="about" class="pe-sheet pe-about" aria-labelledby="pe-about-h">
    <header class="pe-ch"><span class="pe-ch-n">I</span><h2 id="pe-about-h">About</h2><p class="pe-ch-m"><b>Close</b> <span>who, where, now</span></p></header>
    <div class="pe-about-g">
      <div class="pe-pt">${H.portrait({ id: "petal" })}<p class="pe-pt-cap"><b>${e(C.name)}</b><span>GitHub · LinkedIn · Email</span></p></div>
      <p class="pe-lede">${e(kAbout0)}</p>
    </div>
    <div class="pe-about-2">
      <p class="pe-body">${e(kAbout1)}</p>
      <div>
        <dl class="pe-now">
          <div><dt>Building</dt><dd>${e(C.now.building)}</dd></div>
          <div><dt>Researching</dt><dd>${e(C.now.researching)}</dd></div>
          <div><dt>Learning</dt><dd>${e(C.now.learning)}</dd></div>
        </dl>
        <ul class="pe-places" aria-label="Places">${C.places.map((p) => `<li><span class="pe-pk">${placeLabel[p.key] || e(p.key)}</span><span class="pe-pc">${e(p.city)}</span><span class="pe-pl"></span><span class="pe-pt-time" data-clock="${p.tz}"></span></li>`).join("")}</ul>
      </div>
    </div>
  </section>

  <div class="pe-ap pe-ap1" aria-label="What I work on">
    ${thesis}
    <p class="pe-apcap"><b>Fig. 2</b><span>Three threads</span></p>
  </div>

  <section id="work" class="pe-sheet pe-work" aria-labelledby="pe-work-h">
    <header class="pe-ch"><span class="pe-ch-n">II</span><h2 id="pe-work-h">Work</h2><p class="pe-ch-m"><b>Six frames</b> <span>select one to open it</span></p></header>
    <div class="pe-strip-w">
      <ol class="pe-strip" id="pe-strip" aria-label="Projects" tabindex="0">${frames}</ol>
    </div>
    <div class="pe-strip-ctl">
      <button type="button" class="pe-ic" data-pe-step="-1" aria-label="Previous project">${H.icon("arrow-left")}</button>
      <p class="pe-count" aria-live="polite"><b data-pe-cur>01</b><span>/ ${pad(C.projects.length)}</span></p>
      <span class="pe-prog" aria-hidden="true"><i data-pe-prog></i></span>
      <button type="button" class="pe-ic" data-pe-step="1" aria-label="Next project">${H.icon("arrow-right")}</button>
    </div>
  </section>

  <div class="pe-ap pe-ap2" aria-label="In numbers">
    ${nums}
    <p class="pe-apcap"><b>Fig. 3</b><span>By the numbers</span></p>
  </div>

  <section id="experience" class="pe-sheet pe-exp" aria-labelledby="pe-exp-h">
    <header class="pe-ch"><span class="pe-ch-n">III</span><h2 id="pe-exp-h">Record</h2><p class="pe-ch-m"><b>Experience</b> <span>and education</span></p></header>
    <ol class="pe-roles">${roles}</ol>
    <div class="pe-edu" id="education">
      <img src="${e(ed.logo)}" alt="" width="56" height="56" loading="lazy">
      <div><p class="pe-edu-s">${e(ed.school)}</p><p class="pe-edu-d">${e(ed.degree)}</p></div>
      <p class="pe-when"><b>${e(ed.grad)}</b><span>${e(ed.focus)}</span></p>
    </div>
  </section>

  <section id="play" class="pe-ap pe-ap3" aria-labelledby="pe-play-h">
    ${play}
    <h2 class="pe-apcap" id="pe-play-h"><b>Fig. 4</b><span>Play. Pick a toy</span></h2>
  </section>

  <section id="contact" class="pe-sheet pe-contact" aria-labelledby="pe-contact-h">
    <header class="pe-ch"><span class="pe-ch-n">IV</span><h2 id="pe-contact-h">Write</h2><p class="pe-ch-m"><b>Contact</b> <span>it is <span data-clock="${C.now.tz}"></span> in ${e(C.now.city)}</span></p></header>
    <button type="button" class="pe-mail" data-compose><span>${e(C.links.email)}</span>${H.icon("arrow-up-right")}</button>
    <ul class="pe-links">
      <li><a href="${e(C.links.github)}" target="_blank" rel="noopener">${H.logo("github")}<span>GitHub</span></a></li>
      <li><a href="${e(C.links.linkedin)}" target="_blank" rel="noopener">${H.logo("linkedin")}<span>LinkedIn</span></a></li>
      <li><button type="button" data-resume>${H.icon("file-text")}<span>Resume</span></button></li>
      <li><button type="button" data-copy="${e(C.links.email)}">${H.icon("copy")}<span>Copy address</span></button></li>
      <li><button type="button" data-agent><span class="pe-pr" aria-hidden="true">❯</span><span>Ask the agent</span></button></li>
    </ul>
    <div class="pe-faqs"><h3 class="pe-faq-h">Before you ask</h3>${faq}</div>
  </section>

  <footer class="pe-foot">
    <p class="pe-colo"><b>${H.mark ? H.mark() : ""}RPK</b><span>rithvik.ai</span><span>Set in Cormorant Garamond and Geist Mono</span><span>The flower is a fragment shader, drawn live</span></p>
    <p class="pe-colo pe-colo2"><span>Software and AI engineer</span><a href="#top">Back to the bloom ↑</a></p>
  </footer>
</div>`;
    },

    mount(root, H) {
      const offs = [], timers = [], C = H.C;
      const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
      const $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));

      /* the quiet live clock: minutes in ink, seconds in a fainter hand */
      const hm = $("[data-pe-hm]"), sec = $("[data-pe-s]"), ap = $("[data-pe-ap]"), bt = $("[data-pe-bt]"), bap = $("[data-pe-bap]");
      const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: C.now.tz });
      const tick = () => {
        const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
        hm.textContent = `${parts.hour}:${parts.minute}`; sec.textContent = `:${parts.second}`; ap.textContent = parts.dayPeriod || ""; bt.textContent = hm.textContent; bap.textContent = ap.textContent;
      };
      tick(); timers.push(setInterval(tick, 1000));
      timers.push(setInterval(() => $$("[data-clock]").forEach((el) => (el.textContent = H.clock(el.dataset.clock))), 20000));

      /* the hero's live readout of the shader uniforms, only while the hero is on screen */
      const hero = $(".pe-hero"), roT = $("[data-ro-t]"), roM = $("[data-ro-m]"), t0 = performance.now();
      let mouse = [0.5, 0.5], heroOn = true, roTimer = 0;
      on(window, "pointermove", (ev) => { mouse = [ev.clientX / innerWidth, 1 - ev.clientY / innerHeight]; }, { passive: true });
      const readout = () => { roT.textContent = ((performance.now() - t0) / 1000).toFixed(2); roM.textContent = mouse.map((v) => v.toFixed(2).replace(/^0/, "")).join(" "); };
      const startRo = () => { clearInterval(roTimer); if (heroOn && !H.reduceMotion()) roTimer = setInterval(readout, 120); };
      const io = new IntersectionObserver((en) => { heroOn = en[0].isIntersecting; hero.classList.toggle("pe-off", !heroOn); root.querySelector(".pe").classList.toggle("is-top", heroOn); startRo(); });
      io.observe(hero); readout(); startRo();
      offs.push(() => { io.disconnect(); clearInterval(roTimer); });

      /* the right-edge thread: a ◆ that travels with the page */
      const mark = $(".pe-rail-mark"); let rafS = 0;
      const place = () => { rafS = 0; if (H.reduceMotion()) H.kickShader(); /* a still frame still follows the page */ const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); mark.style.transform = `translateY(${(Math.min(1, scrollY / max) * 100).toFixed(2)}cqh)`; };
      on(window, "scroll", () => { if (!rafS) rafS = requestAnimationFrame(place); }, { passive: true });
      place(); offs.push(() => cancelAnimationFrame(rafS));

      /* filmstrip: one active frame carries the caption and the ◆ caret */
      const strip = $("#pe-strip"), items = $$(".pe-frame"), cur = $("[data-pe-cur]"), prog = $("[data-pe-prog]");
      let active = 0;
      const setActive = (i, scroll) => {
        active = (i + items.length) % items.length;
        items.forEach((f, k) => f.classList.toggle("is-active", k === active));
        cur.textContent = String(active + 1).padStart(2, "0");
        if (scroll) {
          const f = items[active], target = f.offsetLeft - (strip.clientWidth - f.offsetWidth) / 2;
          strip.scrollTo({ left: target, behavior: H.reduceMotion() ? "auto" : "smooth" });
        }
      };
      items.forEach((f, k) => { on(f, "pointerenter", () => setActive(k)); on(f, "focusin", () => setActive(k)); });
      $$("[data-pe-step]").forEach((b) => on(b, "click", () => setActive(active + Number(b.dataset.peStep), true)));
      on(strip, "keydown", (ev) => {
        if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
        ev.preventDefault(); setActive(active + (ev.key === "ArrowRight" ? 1 : -1), true);
        items[active].querySelector(".pe-art").focus({ preventScroll: true });
      });
      let rafP = 0;
      const progress = () => { rafP = 0; const max = Math.max(1, strip.scrollWidth - strip.clientWidth); prog.style.transform = `scaleX(${(0.08 + 0.92 * (strip.scrollLeft / max)).toFixed(3)})`; };
      on(strip, "scroll", () => { if (!rafP) rafP = requestAnimationFrame(progress); }, { passive: true });
      progress(); offs.push(() => cancelAnimationFrame(rafP));
      // drag the strip with a mouse; a drag never opens a case
      let drag = null, moved = false;
      on(strip, "pointerdown", (ev) => { if (ev.pointerType !== "mouse" || ev.button !== 0) return; drag = [ev.clientX, strip.scrollLeft]; moved = false; });
      on(window, "pointermove", (ev) => { if (!drag) return; const dx = ev.clientX - drag[0]; if (Math.abs(dx) > 6) { moved = true; strip.classList.add("is-drag"); } if (moved) strip.scrollLeft = drag[1] - dx; });
      on(window, "pointerup", () => { drag = null; strip.classList.remove("is-drag"); });
      on(strip, "click", (ev) => { if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; } }, true);

      return () => { offs.forEach((f) => f()); timers.forEach(clearInterval); };
    },
  });
})();
