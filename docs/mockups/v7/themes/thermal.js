/* Thermal: an infrared camera reading the warmth of his work. A cool, dark instrument (deep blue-black,
   mono readouts, thin brackets) where heat is the only colour event.

   Where each effect lives, and why:
   - False-colour heat field (the shader). Hosted inside #top only, so it runs at full intensity on the
     first screen and stops rendering the moment the hero scrolls away; every reading area below is
     calm, flat blue-black. The pointer is a heat source; the core's smoothed u_mouse lags behind it,
     which reads as a warm trail cooling off. The field cools behind the copy and fades to the page
     colour at the hero's lower edge.
   - Palette switcher (hero): iron / rainbow / white hot. One click re-maps the shader, the scale bar,
     the six hot-spot frames, the map and the hot accents together. The shader reads the choice from
     an extra uniform (u_pv) this design sets on the core's own GL program; if that is unavailable it
     falls back to a CSS approximation on the canvas. A switch runs a calibration sweep (a camera's
     shutter NUC); the first load runs one too.
   - Spot meter (hero): a crosshair and a °C readout follow a fine pointer, text at sensor rate
     (~9 Hz), with a marker riding the scale bar. Over the portrait it reads "visible light": the
     photo is never mapped. Temperatures are a visual scale, labelled as such, never a claim.
   - Hot spots (#work): each project is a 32×24 sensor frame drawn from its own toolchain (more tools,
     more heat). Hover warms the frame and raises heat haze over it, and only there.
   - Contact: the warmest spot on the page, a still glow; haze only while hovered.
   Performance mode (html.lite): one still heat frame, no haze, no trail, no meter smoothing loop. */
(() => {
  const PALS = [["iron", "Iron"], ["rainbow", "Rainbow"], ["white", "White hot"]];
  // colour stops shared by the shader, the CSS ramps and the sensor frames (keep in sync with thermal.css)
  const STOPS = {
    iron: [[0, "#04060C"], [0.2, "#1A0852"], [0.4, "#800A85"], [0.56, "#DB294D"], [0.72, "#FC780F"], [0.87, "#FFD138"], [1, "#FFFADB"]],
    rainbow: [[0, "#04060C"], [0.15, "#0D0F59"], [0.3, "#1A59F2"], [0.44, "#1AD9E6"], [0.58, "#59E64D"], [0.72, "#FFE626"], [0.87, "#FF401A"], [1, "#FFE6D9"]],
    white: [[0, "#04060C"], [1, "#F7F9FF"]],
  };
  const T_MIN = 18, T_MAX = 40; // the visual scale, in °C (decorative)

  /* ───────── Shader: domain-warped heat field + drifting warm bodies + the pointer's heat, in false colour ───────── */
  const glslRamp = (name) => {
    const s = STOPS[name], v = (h) => { const n = parseInt(h.slice(1), 16); return `vec3(${(((n >> 16) & 255) / 255).toFixed(3)},${(((n >> 8) & 255) / 255).toFixed(3)},${((n & 255) / 255).toFixed(3)})`; };
    let src = `vec3 ${name}P(float t){ vec3 c = ${v(s[0][1])};`;
    for (let i = 1; i < s.length; i++) src += ` c = mix(c, ${v(s[i][1])}, smoothstep(${s[i - 1][0].toFixed(3)}, ${s[i][0].toFixed(3)}, t));`;
    return src + " return c; }\n";
  };
  const SHADER = `
uniform vec3 u_pv; // palette: x from, y to, z sweep progress 0..1 (0,0,0 = iron at rest)
${glslRamp("iron")}${glslRamp("rainbow")}${glslRamp("white")}
vec3 pal(float t, float id){ t = clamp(t, 0., 1.); return id < .5 ? ironP(t) : id < 1.5 ? rainbowP(t) : whiteP(t * t * (3. - 2. * t) * .35 + t * .65); }

void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, wide = step(1.15, asp), t = u_time;
  vec2 p = (fc - .5 * u_res) / u_res.y;

  // ambient heat: two fbm warp the third, so warmth pools and creeps like air over a surface
  vec2 q = vec2(fbm(p * 1.25 + vec2(0., t * .045)), fbm(p * 1.25 + vec2(5.2, 1.3) - vec2(t * .035, 0.)));
  float n = fbm(p * 1.55 + 1.8 * q + vec2(t * .018, -t * .014));

  // warm bodies drifting on slow paths around the portrait side
  vec2 home = wide > .5 ? vec2(asp * .2, .02) : vec2(0., -.16);
  float b = 0.;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = home + vec2(sin(t * (.07 + fi * .013) + fi * 2.1) * mix(.26, .4, wide), cos(t * (.06 + fi * .017) + fi * 1.7) * .25);
    vec2 d = p - c + .14 * q;
    b += exp(-dot(d, d) * (10. + fi * 5.)) * (.5 - fi * .07);
  }

  // the visitor's hand: a tight hot core and a wide diffused halo around the smoothed pointer
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  float act = step(.0015, length(u_mouse - .5));
  vec2 dm = p - m + .05 * q;
  float r2 = dot(dm, dm);
  float hand = (exp(-r2 * 60.) * .5 + exp(-r2 * 8.) * .24) * act;

  // cool the reading column and the hero's lower edge, so copy sits on calm dark and the page takes over
  float cool = wide > .5 ? mix(.38, 1., smoothstep(.36, .64, uv.x)) : mix(.42, 1., smoothstep(.56, .3, uv.y));
  float h = (.12 + .17 * n + .6 * b) * cool + hand * mix(.55, 1., cool);
  h *= smoothstep(0., .3, uv.y) * mix(1., .55, smoothstep(0., .12, u_scroll));

  // calibration sweep: the new palette wipes down behind a thin bright scan line
  float line = 1. - uv.y, edge = u_pv.z * 1.12 - .06;
  float k = 1. - smoothstep(edge - .004, edge + .004, line);
  vec3 col = mix(pal(h, u_pv.x), pal(h, u_pv.y), k);
  float sweeping = step(.001, u_pv.z) * step(u_pv.z, .999);
  col += vec3(.8, .85, 1.) * exp(-pow((line - edge) * u_res.y * .35, 2.)) * sweeping * .55;

  // sensor finish: faint row banding and grain so the capped resolution reads as texture
  col *= 1. - .035 * step(.5, fract(fc.y * .5));
  col += (hash21(fc + fract(t * 7.1) * 97.) - .5) * .032;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`;

  /* ───────── Sensor frames: a tiny 32×24 heat image per project, encoded as a BMP (no canvas) ───────── */
  const hex3 = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  function ramp(t, name) {
    const s = STOPS[name]; t = Math.min(1, Math.max(0, name === "white" ? sstep(0, 1, t) * 0.35 + t * 0.65 : t));
    let c = hex3(s[0][1]);
    for (let i = 1; i < s.length; i++) { const k = sstep(s[i - 1][0], s[i][0], t), d = hex3(s[i][1]); c = c.map((v, j) => v + (d[j] - v) * k); }
    return c.map((v) => Math.round(v));
  }
  const seed = (str) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
  const W = 32, HH = 24;
  /** Heat grid for a project: one warm body per tool, peak heat scaled by the toolchain size. */
  function heatGrid(p) {
    const r = seed(p.slug), tools = p.tags.length, bodies = [];
    for (let i = 0; i < tools; i++) bodies.push({ x: 4 + r() * 24, y: 3.5 + r() * 17, s: 1.5 + r() * 2.6, a: i === 0 ? 1 : 0.4 + r() * 0.5 });
    const g = new Float32Array(W * HH); let max = 0, mi = 0;
    for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) {
      // a faint ambient gradient with ripple, so cold areas still read as a surface
      let v = 0.08 + 0.06 * (y / HH) + 0.025 * Math.sin(x * 0.9 + y * 0.35) * Math.cos(y * 0.7 - x * 0.2);
      bodies.forEach((b) => { const dx = x - b.x, dy = y - b.y; v += b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s)); });
      g[y * W + x] = v; if (v > max) { max = v; mi = y * W + x; }
    }
    return { g, max, w: W, h: HH, at: [((mi % W) + 0.5) / W, (Math.floor(mi / W) + 0.5) / HH], peak: 0.42 + 0.46 * (tools / 5) };
  }
  /** The contact strip: a 64×6 band of heat with its hottest point a little left of centre. */
  function stripGrid() {
    const w = 64, h = 6, g = new Float32Array(w * h); let max = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x - 26) / 64, dy = (y - 2.5) / 6;
      const v = 0.06 + Math.exp(-dx * dx * 18 - dy * dy * 3) * 0.9 + Math.exp(-((x - 44) ** 2) / 30 - dy * dy * 4) * 0.25 + 0.03 * Math.sin(x * 0.8 + y);
      g[y * w + x] = v; max = Math.max(max, v);
    }
    return { g, max, w, h, peak: 0.8 };
  }
  // widths are multiples of 4, so BMP rows need no padding
  function bmp(grid, palName, warm) {
    const w = grid.w, h = grid.h, row = w * 3, size = 54 + row * h, b = new Uint8Array(size), dv = new DataView(b.buffer);
    b[0] = 66; b[1] = 77; dv.setUint32(2, size, true); dv.setUint32(10, 54, true); dv.setUint32(14, 40, true);
    dv.setInt32(18, w, true); dv.setInt32(22, h, true); dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, row * h, true);
    let o = 54; const peak = Math.min(1, grid.peak + warm);
    for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) {
      const [R, G, B] = ramp((grid.g[y * w + x] / grid.max) * peak, palName); b[o++] = B; b[o++] = G; b[o++] = R;
    }
    let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return "data:image/bmp;base64," + btoa(s);
  }

  const getPal = (H) => { const v = H.store.get("rv7-thermal-pal", "iron"); return STOPS[v] ? v : "iron"; };
  // projects ranked by the size of their toolchain (stable, so equal counts keep the content order)
  const ranked = (C) => C.projects.map((p, i) => ({ p, i })).sort((a, b) => b.p.tags.length - a.p.tags.length || a.i - b.i).map((x) => x.p);
  const grids = {};
  const gridFor = (p) => (grids[p.slug] ||= heatGrid(p));
  const gridOf = (key, H) => (key === "@strip" ? (grids[key] ||= stripGrid()) : H.P(key) ? gridFor(H.P(key)) : null);

  V6.theme({
    id: "thermal",
    name: "Thermal",
    mood: "seeing the heat of the work",
    dark: true,
    keywords: ["thermal", "infrared", "ir", "heat", "flir", "ironbow", "camera", "temperature", "warm", "hot"],
    fonts: "family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400..600",
    swatch: ["#05070D", "#E8EDF5", "#FC780F", "#800A85"],
    cardFont: '"Space Grotesk", system-ui, sans-serif',
    colors: ["#04060C", "#800A85", "#FC780F", "#FFD138"],
    shaderScale: 0.5,
    shaderHost: "#th-ir",
    shader: SHADER,

    render(C, H) {
      const e = H.esc, pal = getPal(H);
      const now = C.places.find((p) => p.key === "now");
      const idx = (n, label) => `<p class="th-idx"><span class="th-idx-n">${n}</span><span>${e(label)}</span></p>`;

      const palCtl = `<div class="th-pal" role="group" aria-label="Thermal palette">
          <span class="th-pal-l" aria-hidden="true">Palette</span>
          ${PALS.map(([id, nm]) => `<button type="button" class="th-pal-b" data-th-pal="${id}" aria-pressed="${id === pal}"><i class="th-ramp" data-ramp="${id}" aria-hidden="true"></i>${e(nm)}</button>`).join("")}
        </div>`;

      const hero = `<section id="top" class="th-hero" aria-labelledby="th-name">
        <div class="th-ir" id="th-ir" aria-hidden="true"></div>
        <div class="th-vf" aria-hidden="true"><i></i><i></i><i></i><i></i>
          <span class="th-vf-tl"><b class="th-rec"></b>IR · live</span>
          <span class="th-vf-tr"><span data-clock="${e(C.now.tz)}"></span> ${e(now ? now.city : C.now.city)}</span>
          <span class="th-vf-bl" id="th-nuc">e 0.95 · 9 Hz</span>
        </div>
        <div class="th-copy">
          <p class="th-status"><span class="th-dot" aria-hidden="true"></span>${e(C.status)}</p>
          <h1 class="th-name" id="th-name"><span>${e(C.first)}</span> <span>${e(C.last)}</span></h1>
          <p class="th-role">${e(C.role)}</p>
          <p class="th-line">${e(C.line)}</p>
          <div class="th-acts">
            <button type="button" class="th-btn th-btn-hot" data-compose>${H.icon("mail")}Email me</button>
            <button type="button" class="th-btn" data-resume>${H.icon("file-text")}Resume</button>
            <button type="button" class="th-btn th-btn-q" data-agent>${H.icon("terminal")}Ask the agent</button>
          </div>
          ${palCtl}
        </div>
        <div class="th-ptw">
          <div class="th-pt-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><span class="th-pt-l">Visible light · unfiltered</span></div>
          ${H.portrait({ id: "thermal" })}
        </div>
        <div class="th-scale" aria-hidden="true">
          <span class="th-scale-v">${T_MAX.toFixed(1)}</span>
          <div class="th-scale-bar"><i class="th-ramp th-ramp-v" data-ramp="live"></i><b class="th-scale-mk" id="th-mk"></b></div>
          <span class="th-scale-v">${T_MIN.toFixed(1)}</span>
          <span class="th-scale-u">°C · visual scale</span>
        </div>
        <div class="th-meter" id="th-meter" aria-hidden="true"><i class="th-cross"></i><span class="th-meter-r"><b id="th-mv">31.4</b><span id="th-mu">°C</span></span></div>
      </section>`;

      // ── work: six hot spots ──
      const spots = ranked(C).map((p, i) => {
        const g = gridFor(p), [mx, my] = g.at;
        return `<li class="th-spot">
          <button type="button" class="th-spot-b" data-case="${e(p.slug)}" aria-label="${e(p.title)}: ${e(p.headline)}. Open the case">
            <span class="th-frame">
              <span class="th-haze"><span class="th-haze-in">
                <img class="th-f th-f-cool" data-f="${e(p.slug)}" data-w="0" src="${bmp(g, pal, 0)}" alt="" width="${W}" height="${HH}" decoding="async">
                <img class="th-f th-f-warm" data-f="${e(p.slug)}" data-w="1" src="${bmp(g, pal, 0.2)}" alt="" width="${W}" height="${HH}" decoding="async">
              </span></span>
              <span class="th-f-tl">SP${i + 1}</span>
              <span class="th-f-tr">${p.tags.length} tools</span>
              <i class="th-max" style="left:${(mx * 100).toFixed(1)}%;top:${(my * 100).toFixed(1)}%"></i>
              <span class="th-pip"><img src="assets/projects/${e(p.slug)}.webp" alt="" width="1280" height="960" loading="lazy" decoding="async" onerror="this.parentNode.remove()"><b>VIS</b></span>
            </span>
            <span class="th-spot-m">
              <span class="th-spot-k">${H.icon(p.icon)}${e(p.kind)}</span>
              <span class="th-spot-t">${e(p.title)}</span>
              <span class="th-spot-h">${e(p.headline)}</span>
              <span class="th-spot-go">Open the case ${H.icon("arrow-up-right")}</span>
            </span>
          </button>
        </li>`;
      }).join("");
      const work = `<section id="work" class="th-sec" aria-labelledby="th-work-h">
        <header class="th-head">${idx("01", "Hot spots")}<h2 class="th-h2" id="th-work-h">Six builds, warmest first.</h2>
          <p class="th-sub">Each frame is drawn from a project's toolchain: more tools, more heat. A visual scale, not a measurement.</p></header>
        <ol class="th-spots">${spots}</ol>
      </section>`;

      // ── experience: a record, warmer is more recent ──
      const ed = C.education;
      const roles = C.experience.map((x, i) => `<li class="th-role-i" id="experience-${e(x.slug)}" style="--heat:var(--rh${i})">
          <details${i === 0 ? " open" : ""}>
            <summary>
              <span class="th-heat" aria-hidden="true"></span>
              <span class="th-when">${e(x.when)}</span>
              <span class="th-what"><b>${e(x.role)}</b><span>${e(x.org)}</span></span>
              <span class="th-where">${e(x.where)}</span>
              <span class="th-plus" aria-hidden="true"></span>
            </summary>
            <div class="th-role-b"><ul class="th-list">${x.desc.map((d) => `<li>${e(d)}</li>`).join("")}</ul><div class="chips">${x.tags.map(H.chip).join("")}</div></div>
          </details>
        </li>`).join("");
      const exp = `<section id="experience" class="th-sec" aria-labelledby="th-exp-h">
        <header class="th-head">${idx("02", "Record")}<h2 class="th-h2" id="th-exp-h">Where the work happened.</h2>
          <p class="th-sub">Four roles and a degree. Warmer is more recent.</p></header>
        <ol class="th-roles">${roles}</ol>
        <div class="th-edu" id="education">
          <span class="th-edu-logo"><img src="${e(ed.logo)}" alt="" width="56" height="56" loading="lazy" decoding="async"></span>
          <div class="th-edu-t"><p class="th-edu-k">Education</p><h3>${e(ed.school)}</h3><p>${e(ed.degree)}</p></div>
          <dl class="th-edu-d"><div><dt>Focus</dt><dd>${e(ed.focus)}</dd></div><div><dt>Graduation</dt><dd>${e(ed.grad)}</dd></div></dl>
        </div>
      </section>`;

      // ── map: the knowledge graph ──
      const map = `<section id="graph" class="th-sec" aria-labelledby="th-map-h">
        <header class="th-head">${idx("03", "Map")}<h2 class="th-h2" id="th-map-h">Everything on record, connected.</h2>
          <p class="th-sub">Hover a node to trace what it touches. Click for the details.</p></header>
        <div class="th-kgw"><i class="th-kgw-c" aria-hidden="true"></i>${H.graph({ id: "thermal" })}</div>
      </section>`;

      // ── play: the bench ──
      const toys = (H.PLAY || []).map((t, i) => `<li><button type="button" class="th-toy" data-play="${e(t.id)}">
          <span class="th-toy-n">CH ${String(i + 1).padStart(2, "0")}</span>
          <span class="th-toy-i" aria-hidden="true">${H.icon(t.icon)}</span>
          <span class="th-toy-t">${e(t.name)}</span>
          <span class="th-toy-d">${e(t.desc)}</span>
          <span class="th-toy-go">Run ${H.icon("arrow-right")}</span>
        </button></li>`).join("");
      const play = `<section id="play" class="th-sec" aria-labelledby="th-play-h">
        <header class="th-head">${idx("04", "Bench")}<h2 class="th-h2" id="th-play-h">Things to touch.</h2>
          <p class="th-sub">A record to scratch, a board to draw on, four quick games.</p></header>
        <ol class="th-toys">${toys}</ol>
      </section>`;

      // ── about: the person, then the readings ──
      const nowRows = [["Building", C.now.building], ["Researching", C.now.researching], ["Learning", C.now.learning]];
      const places = C.places.map((pl) => `<li><span class="th-pl-k">${e({ home: "Home", school: "School", now: "Now" }[pl.key] || pl.key)}</span><span class="th-pl-c">${e(pl.city)}</span><span class="th-pl-t" data-clock="${e(pl.tz)}"></span></li>`).join("");
      const about = `<section id="about" class="th-sec" aria-labelledby="th-about-h">
        <header class="th-head">${idx("05", "About")}<h2 class="th-h2" id="th-about-h">Close to the hardware.</h2></header>
        <div class="th-about">
          <div class="th-about-t">${C.about.map((a) => `<p>${e(a)}</p>`).join("")}</div>
          <aside class="th-now" aria-label="Now">
            <p class="th-panel-k">Now</p>
            <dl>${nowRows.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl>
            <p class="th-panel-k">Places</p>
            <ul class="th-places">${places}</ul>
          </aside>
        </div>
        <ul class="th-reads" aria-label="In numbers">${C.numbers.map(([n, l], i) => `<li style="--heat:var(--rh${i})"><b>${e(n)}</b><span>${e(l)}</span></li>`).join("")}</ul>
      </section>`;

      // ── contact: the warmest spot on the page ──
      const em = C.links.email;
      const contact = `<section id="contact" class="th-sec th-contact" aria-labelledby="th-contact-h">
        <header class="th-head">${idx("06", "Contact")}<h2 class="th-h2" id="th-contact-h">The warmest lead is email.</h2>
          <p class="th-sub">Open to SWE and AI internships. Write, and it goes straight to my inbox.</p></header>
        <div class="th-mail">
          <button type="button" class="th-mail-b" data-compose="Internship opportunity"><span class="th-mail-k">Compose</span><span class="th-mail-a">${e(em)}</span>
            <span class="th-strip" aria-hidden="true"><span class="th-haze"><span class="th-haze-in">
              <img class="th-f th-f-cool" data-f="@strip" data-w="0" src="${bmp(gridOf("@strip", H), pal, 0)}" alt="" width="64" height="6" decoding="async">
              <img class="th-f th-f-warm" data-f="@strip" data-w="1" src="${bmp(gridOf("@strip", H), pal, 0.2)}" alt="" width="64" height="6" decoding="async">
            </span></span></span>
            <span class="th-strip-l" aria-hidden="true"><span>SP0 · warmest point on the page</span><span>visual scale</span></span>
          </button>
        </div>
        <ul class="th-links">
          <li><a class="th-btn" href="${e(C.links.github)}" target="_blank" rel="noopener">${H.logo("github")}GitHub</a></li>
          <li><a class="th-btn" href="${e(C.links.linkedin)}" target="_blank" rel="noopener">${H.logo("linkedin")}LinkedIn</a></li>
          <li><button type="button" class="th-btn" data-resume>${H.icon("file-text")}Resume</button></li>
          <li><button type="button" class="th-btn" data-copy="${e(em)}">${H.icon("copy")}Copy address</button></li>
        </ul>
        <footer class="th-foot">
          <span class="th-foot-mk" aria-hidden="true">${H.mark()}</span>
          <p>${e(C.name)} · <span data-clock="${e(C.now.tz)}"></span> in ${e(C.now.city)}</p>
          <p class="th-foot-s">Set in Space Grotesk and JetBrains Mono. The heat is one fragment shader; the photograph is never mapped.</p>
        </footer>
      </section>`;

      const nav = `<nav class="th-nav" aria-label="Sections">
        <a class="th-brand" href="#top" data-th-go="top"><span class="th-brand-mk" aria-hidden="true">${H.mark()}</span><span>${e(C.name)}</span></a>
        <ol class="th-navl">${[["work", "Work"], ["experience", "Record"], ["graph", "Map"], ["play", "Bench"], ["about", "About"], ["contact", "Contact"]].map(([id, l], i) => `<li><a href="#${id}" data-th-go="${id}"><span>0${i + 1}</span>${l}</a></li>`).join("")}</ol>
        <div class="th-nav-r"><button type="button" class="th-nb" data-resume>Resume</button><button type="button" class="th-nb th-nb-hot" data-compose>${H.icon("mail")}<span>Email</span></button></div>
      </nav>`;

      const defs = `<svg class="th-defs" width="0" height="0" aria-hidden="true" focusable="false"><filter id="th-haze-f" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency=".014 .07" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;

      return `<div class="th" id="th">${defs}${nav}${hero}${work}${exp}${map}${play}${about}${contact}</div>`;
    },

    mount(root, H) {
      const html = document.documentElement;
      const offs = [], timers = new Set();
      const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
      const $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      const lite = () => H.reduceMotion();
      let pal = getPal(H);
      html.dataset.thPal = pal;

      /* ───── palette → shader: set u_pv on the core's program through its own GL context ───── */
      let glc = null;
      function glLoc() {
        const cv = $("canvas.gl"); if (!cv) return null;
        const gl = cv.getContext("webgl"); if (!gl) return null;
        const prog = gl.getParameter(gl.CURRENT_PROGRAM); if (!prog || !gl.isProgram(prog)) return null;
        if (glc && glc.prog === prog) return glc;
        const loc = gl.getUniformLocation(prog, "u_pv"); if (!loc) return null;
        return (glc = { gl, prog, loc });
      }
      const pid = (n) => PALS.findIndex(([id]) => id === n);
      function pv(a, b, k) { const g = glLoc(); if (!g) { html.dataset.thGl = "css"; return false; } g.gl.useProgram(g.prog); g.gl.uniform3f(g.loc, a, b, k); delete html.dataset.thGl; return true; }
      let sweepRaf = 0;
      /** Calibration sweep from one palette to another (instant in performance mode). */
      function sweep(from, to, ms = 760) {
        cancelAnimationFrame(sweepRaf);
        const nuc = $("#th-nuc");
        if (lite()) { pv(to, to, 1); H.kickShader(); return; }
        const t0 = performance.now();
        if (nuc) { nuc.textContent = "NUC · calibrating"; nuc.classList.add("on"); }
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          if (!pv(from, to, k < 1 ? k : 1)) return;
          if (k < 1) sweepRaf = requestAnimationFrame(step);
          else if (nuc) { nuc.textContent = "e 0.95 · 9 Hz"; nuc.classList.remove("on"); }
        };
        sweepRaf = requestAnimationFrame(step);
      }
      // the core draws its first frame on the next animation frame; set the palette (and run the boot sweep) after it
      let bootRaf = requestAnimationFrame(() => { bootRaf = requestAnimationFrame(() => { const i = pid(pal); if (lite()) { pv(i, i, 1); H.kickShader(); } else sweep(i, i, 1100); }); });

      function setPal(next) {
        if (!STOPS[next] || next === pal) return;
        const from = pid(pal); pal = next; H.store.set("rv7-thermal-pal", next); html.dataset.thPal = next;
        $$("[data-th-pal]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.thPal === next)));
        $$("img[data-f]").forEach((img) => { const g = gridOf(img.dataset.f, H); if (g) img.src = bmp(g, next, img.dataset.w === "1" ? 0.2 : 0); });
        sweep(from, pid(next));
      }
      $$("[data-th-pal]").forEach((b) => on(b, "click", () => setPal(b.dataset.thPal)));

      /* ───── spot meter: crosshair + readout follow a fine pointer across the hero ───── */
      const hero = $("#top"), meter = $("#th-meter"), mv = $("#th-mv"), mu = $("#th-mu"), mk = $("#th-mk"), bar = $(".th-scale-bar"), ptl = $(".th-pt-l");
      let px = 0, py = 0, sx = null, sy = 0, mRaf = 0, lastTxt = 0, vis = false, heroOn = true;
      function readout(now) {
        const hh = hero.clientHeight || 1, d = Math.hypot(px - sx, py - sy) / hh;
        // mirrors the shader: the hot core sits on the smoothed pointer, so moving fast reads cooler than resting
        const hand = Math.exp(-d * d * 60) * 0.5 + Math.exp(-d * d * 8) * 0.24;
        const coolX = innerWidth > hh * 1.15 ? 0.38 + 0.62 * sstep(0.36, 0.64, px / hero.clientWidth) : 1;
        const h = (0.24 + 0.05 * Math.sin(now / 1900)) * coolX + hand * (0.55 + 0.45 * coolX);
        return T_MIN + (T_MAX - T_MIN) * Math.min(1, h);
      }
      function tick(now) {
        mRaf = 0; if (sx === null) { sx = px; sy = py; }
        const k = lite() ? 1 : 0.06; // the core smooths u_mouse at 0.06 per frame; follow it so the reading trails the same way
        sx += (px - sx) * k; sy += (py - sy) * k;
        meter.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
        if (now - lastTxt > 110) { // sensor rate, not frame rate
          lastTxt = now;
          if (vis) { mk.style.opacity = "0"; }
          else { const T = readout(now); mv.textContent = T.toFixed(1); mu.textContent = "°C"; mk.style.opacity = "1"; mk.style.transform = `translateY(${((1 - (T - T_MIN) / (T_MAX - T_MIN)) * bar.clientHeight).toFixed(1)}px)`; }
        }
        if (!lite() && heroOn && Math.hypot(px - sx, py - sy) > 0.6) mRaf = requestAnimationFrame(tick);
      }
      if (H.fine.matches) {
        on(hero, "pointermove", (ev) => {
          if (ev.pointerType === "touch") return;
          const r = hero.getBoundingClientRect(); px = ev.clientX - r.left; py = ev.clientY - r.top;
          vis = !!ev.target.closest?.(".pt-photo");
          hero.classList.add("is-metering"); meter.classList.toggle("is-vis", vis); ptl?.classList.toggle("on", vis);
          if (!mRaf) mRaf = requestAnimationFrame(tick);
        }, { passive: true });
        on(hero, "pointerleave", () => { hero.classList.remove("is-metering"); ptl?.classList.remove("on"); });
      }
      const heroIo = new IntersectionObserver((en) => { heroOn = en[0].isIntersecting; });
      heroIo.observe(hero);

      /* ───── nav: smooth jumps and the section you're reading ───── */
      $$("[data-th-go]").forEach((a) => on(a, "click", (ev) => {
        const el = document.getElementById(a.dataset.thGo); if (!el) return;
        ev.preventDefault(); el.scrollIntoView({ behavior: lite() ? "auto" : "smooth", block: "start" });
      }));
      const links = $$(".th-navl a");
      const secIo = new IntersectionObserver((en) => en.forEach((x) => {
        if (!x.isIntersecting) return;
        links.forEach((l) => (l.dataset.thGo === x.target.id ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current")));
      }), { rootMargin: "-45% 0px -50% 0px" });
      $$(".th-sec, #top").forEach((s) => secIo.observe(s));
      const nav = $(".th-nav");
      on(window, "scroll", () => nav.classList.toggle("is-past", scrollY > 40), { passive: true });

      /* ───── clocks ───── */
      const clocks = setInterval(() => $$("[data-clock]").forEach((el) => (el.textContent = H.clock(el.dataset.clock))), 20000);

      return () => {
        offs.forEach((f) => f()); timers.forEach((id) => clearTimeout(id)); timers.clear();
        cancelAnimationFrame(mRaf); cancelAnimationFrame(sweepRaf); cancelAnimationFrame(bootRaf);
        clearInterval(clocks); heroIo.disconnect(); secIo.disconnect();
        delete html.dataset.thPal; delete html.dataset.thGl;
      };
    },
  });
})();
