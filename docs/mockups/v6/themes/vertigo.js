/* Vertigo: op-art. The site is one tall painting: a live moiré of two warped line gratings (the
   shader) behind a passe-partout frame, with every word pinned to it in small white cartouches at
   the golden-section points of construction drawings that draw themselves in as you arrive. */
(() => {
  const INK = "#0A0A0A", CANVAS = "#F2F0EA", TEAL = "#12B5B0", ROSE = "#F25C8A", OCHRE = "#E8A33D";
  const CYC = [TEAL, ROSE, OCHRE];
  const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
  const PHI = 1.6180339887;

  /** One small op-art study per project: a black grating and a coloured twin offset against it, so
      the pair beats into moiré (the coloured layer turns on hover). */
  function study(i, col) {
    let b = "", o = "", defs = "";
    const sw = `fill="none" stroke-linecap="round"`;
    if (i === 0) { // concentric rings: brain waves
      for (let r = 5; r < 150; r += 8) { b += `<circle cx="80" cy="100" r="${r}"/>`; o += `<circle cx="93" cy="90" r="${r}"/>`; }
      b = `<g ${sw} stroke="${INK}" stroke-width="3.4">${b}</g>`; o = `<g ${sw} stroke="${col}" stroke-width="3">${o}</g>`;
    } else if (i === 1) { // nested frames: frames of video
      for (let k = 1; k < 15; k++) { const w = k * 11.5, h = k * 14.4; b += `<rect x="${80 - w / 2}" y="${100 - h / 2}" width="${w}" height="${h}"/>`; }
      o = `<g ${sw} stroke="${col}" stroke-width="3" transform="rotate(-6 80 100)">${b}</g>`; b = `<g ${sw} stroke="${INK}" stroke-width="3.4">${b}</g>`;
    } else if (i === 2) { // two EEG traces: left and right
      for (let y = 4; y < 204; y += 8) { b += `<path d="M-10 ${y} q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/>`; o += `<path d="M-10 ${y + 3} q14 -10 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0"/>`; }
      b = `<g ${sw} stroke="${INK}" stroke-width="3.2">${b}</g>`; o = `<g ${sw} stroke="${col}" stroke-width="2.8">${o}</g>`;
    } else if (i === 3) { // sunburst: spending radiating out to happiness
      for (let a = 0; a < 360; a += 4.5) { const r = (a * Math.PI) / 180; b += `<path d="M80 100 L${(80 + 160 * Math.cos(r)).toFixed(1)} ${(100 + 160 * Math.sin(r)).toFixed(1)}"/>`; }
      o = `<g ${sw} stroke="${col}" stroke-width="2.2" transform="translate(10 -8)">${b}</g>`; b = `<g ${sw} stroke="${INK}" stroke-width="2.4">${b}</g>`;
    } else if (i === 4) { // a QR field of modules
      defs = `<pattern id="vg-q${i}" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${INK}"/></pattern><pattern id="vg-q${i}b" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(7 80 100) scale(1.04)"><rect x="2" y="2" width="4.4" height="4.4" fill="${col}"/></pattern>`;
      b = `<rect x="-40" y="-40" width="240" height="280" fill="url(#vg-q${i})"/>`; o = `<rect x="-40" y="-40" width="240" height="280" fill="url(#vg-q${i}b)"/>`;
    } else { // chevrons: rooftops
      for (let y = -8; y < 214; y += 10) { let d = `M-10 ${y}`; for (let x = -10; x < 170; x += 20) d += ` L${x + 10} ${y - 9} L${x + 20} ${y}`; b += `<path d="${d}"/>`; }
      o = `<g ${sw} stroke="${col}" stroke-width="3" stroke-linejoin="round" transform="translate(0 5) rotate(3 80 100)">${b}</g>`; b = `<g ${sw} stroke="${INK}" stroke-width="3.4" stroke-linejoin="round">${b}</g>`;
    }
    return `<svg class="vg-art" viewBox="0 0 160 200" aria-hidden="true" focusable="false">${defs ? `<defs>${defs}</defs>` : ""}<rect width="160" height="200" fill="#fff"/><g class="b">${b}</g><g class="o">${o}</g></svg>`;
  }

  /** A tiny square study for each Play exhibit, drawn in its stripe colour. */
  function toy(id, col) {
    let g = "";
    const s = `fill="none" stroke-linecap="round"`;
    if (id === "records") { for (let r = 6; r < 46; r += 3.2) g += `<circle cx="50" cy="50" r="${r.toFixed(1)}"/>`; g = `<circle cx="50" cy="50" r="47" fill="${INK}"/><g ${s} stroke="#3a3a3a" stroke-width="1">${g}</g><circle cx="50" cy="50" r="13" fill="${col}"/><circle cx="50" cy="50" r="2" fill="#fff"/>`; }
    else if (id === "artboard") g = `<path ${s} stroke="${INK}" stroke-width="5" d="M14 70c10-30 22-46 30-30s-6 34 8 30 14-40 34-44"/><path ${s} stroke="${col}" stroke-width="5" d="M16 30c16 8 26 26 44 22s20-14 26 4"/>`;
    else if (id === "typeracer") { for (let y = 18; y < 90; y += 12) g += `<path d="M14 ${y}h${(20 + ((y * 37) % 60)).toFixed(0)}"/>`; g = `<g ${s} stroke="${INK}" stroke-width="6">${g}</g><rect x="78" y="62" width="5" height="12" fill="${col}"/>`; }
    else if (id === "angle") { for (let a = -70; a <= 0; a += 7) { const r = (a * Math.PI) / 180; g += `<path d="M16 84L${(16 + 74 * Math.cos(r)).toFixed(1)} ${(84 + 74 * Math.sin(r)).toFixed(1)}"/>`; } g = `<g ${s} stroke="${INK}" stroke-width="2.6">${g}</g><path ${s} stroke="${col}" stroke-width="5" d="M40 84A24 24 0 0 0 33 67"/>`; }
    else if (id === "dots") { for (let y = 14; y < 96; y += 12) for (let x = 14; x < 96; x += 12) g += `<circle cx="${x}" cy="${y}" r="${(1.5 + 3.5 * Math.abs(Math.sin(x * 0.07 + y * 0.05))).toFixed(1)}"/>`; g = `<g fill="${INK}">${g}</g><circle cx="62" cy="38" r="5" fill="${col}"/>`; }
    else { for (let k = 1; k < 9; k++) g += `<rect x="${50 - k * 5.5}" y="${50 - k * 5.5}" width="${k * 11}" height="${k * 11}"/>`; g = `<g ${s} stroke="${INK}" stroke-width="2.8">${g}</g><circle cx="50" cy="50" r="4" fill="${col}"/>`; }
    return `<svg viewBox="0 0 100 100" focusable="false"><rect width="100" height="100" fill="#fff"/>${g}</svg>`;
  }

  /** Plate tag: the tiny catalogue number every cartouche carries. */
  const tag = (no, label, col) => `<p class="vg-tag"><i style="background:${col || INK}"></i><b>${no}</b>${label ? `<span>${label}</span>` : ""}</p>`;

  V6.theme({
    id: "vertigo",
    name: "Vertigo",
    mood: "op-art, moiré, gallery",
    dark: false,
    keywords: ["vertigo", "op art", "op-art", "riley", "moire", "moiré", "optical", "stripes"],
    fonts: "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400",
    swatch: [CANVAS, INK, TEAL, ROSE],
    cardFont: '"Bodoni Moda", serif',
    colors: [CANVAS, INK, TEAL, ROSE],
    shaderScale: 0.6,
    shader: `
const vec3 OCHRE = vec3(.910, .639, .239);
float LR;
vec2 lensC;
// Both gratings' phases at a fragment: A = travelling horizontal waves, B = the same family turned a few degrees.
vec2 phases(vec2 fc, out float lensK){
  vec2 p = (fc - .5 * u_res) / u_res.y;
  vec2 d = p - lensC; float r = length(d);
  lensK = smoothstep(LR, 0., r);
  p -= d * lensK * lensK * .58;                       // the lens: barrel magnification toward its centre
  float t = u_time * .055 + u_scroll * 2.4;           // slow on purpose: beats amplify motion
  float a = p.y + .046 * sin(p.x * 3.9 + t * 2.) + .024 * sin(p.x * 9.1 - p.y * 3.2 - t * 1.4) + .010 * sin(p.x * 21. - t * 2.6);
  float th = .085 + .045 * sin(t * .9) + u_scroll * .32;
  float cs = cos(th), sn = sin(th);
  vec2 q = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y);
  float b = q.y + .052 * sin(q.x * 3.2 - t * 1.7 + 1.3) + .021 * sin(q.x * 7.7 + q.y * 4.6 + t);
  float N = mix(64., 50., u_scroll);                  // walking into the painting: the lines grow as you scroll
  return vec2(a, b) * N;
}
// Anti-aliased stripe coverage; past Nyquist it resolves to the mean so moiré is drawn, never aliased.
float ink(float ph, float duty, float fw){
  float s = abs(fract(ph) - .5);
  float w = max(fw, 1e-3) * .7;
  float c = 1. - smoothstep(duty * .5 - w, duty * .5 + w, s);
  return mix(c, duty, smoothstep(.28, .55, fw));
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  float asp = u_res.x / u_res.y;
  bool idle = distance(u_mouse, vec2(.5)) < 1e-4;      // no pointer yet: the lens wanders by itself
  vec2 m = idle ? vec2(.66 + .16 * sin(u_time * .07), .26 + .1 * sin(u_time * .11 + 1.)) : u_mouse;
  lensC = (m - .5) * vec2(asp, 1.);
  LR = .17 + .006 * sin(u_time * .7);
  float k0, k1, k2;
  vec2 ph = phases(fc, k0);
  vec2 px = phases(fc + vec2(1., 0.), k1) - ph;
  vec2 py = phases(fc + vec2(0., 1.), k2) - ph;
  vec2 fw = vec2(length(vec2(px.x, py.x)), length(vec2(px.y, py.y)));
  vec2 p = (fc - .5 * u_res) / u_res.y;
  // one slow noise field swells and thins the stripes, like Riley's Fall
  float f = snoise(p * 1.15 + vec2(u_time * .012, -u_time * .009 + u_scroll * 1.5)) * .5 + .5;
  float dA = mix(.10, .58, smoothstep(.12, .88, f));
  float dB = mix(.08, .44, smoothstep(.15, .9, 1. - f));
  float iA = ink(ph.x, dA, fw.x), iB = ink(ph.y, dB, fw.y);
  float inkAll = max(iA, iB);
  vec3 col = mix(u_c0, u_c1, inkAll);
  // inside the lens the A stripes show their colours, cycling teal, rose, ochre
  float r = length(p - lensC);
  float pxw = 1. / u_res.y;
  float inside = 1. - smoothstep(LR - pxw * 1.2, LR + pxw * 1.2, r);
  float idx = mod(floor(ph.x + .5), 3.);
  vec3 sc = idx < .5 ? u_c2 : (idx < 1.5 ? u_c3 : OCHRE);
  vec3 lensCol = mix(mix(vec3(1.), sc, iA), u_c1, iB * .92);
  col = mix(col, lensCol, inside);
  // the lens rim: a hairline of ink inside a cut of white
  float rim = 1. - smoothstep(pxw * .8, pxw * 2.2, abs(r - LR));
  float cut = 1. - smoothstep(pxw * 2.2, pxw * 4.4, abs(r - LR));
  col = mix(col, vec3(1.), cut * (1. - rim));
  col = mix(col, u_c1, rim);
  // paper tooth: a static grain so the capped resolution reads as texture
  col += (hash21(fc) - .5) * .045;
  gl_FragColor = vec4(col, 1.);
}`,

    render(C, H) {
      const e = H.esc;
      const [school, open] = C.status.split(" · ");
      const nav = [["top", "Portrait"], ["work", "Work"], ["experience", "Chronology"], ["about", "About"], ["play", "Play"], ["contact", "Contact"]];
      // the shared Play window's exhibits; core supplies H.PLAY, this list only stands in until it lands
      const PLAY = (H.PLAY && H.PLAY.length ? H.PLAY : [
        { id: "records", name: "Records", desc: "A vinyl you can scratch" }, { id: "artboard", name: "Artboard", desc: "Draw freely on a blank canvas" },
        { id: "typeracer", name: "Typeracer", desc: "A small typing game" }, { id: "angle", name: "Angle", desc: "A small game of angles" },
        { id: "dots", name: "Dots", desc: "A small game of dots" }, { id: "center", name: "Center", desc: "A small game of centres" },
      ]);
      const play = PLAY.map((x, i) => `<li class="vg-ex" style="--k:${CYC[i % 3]};--j:${i}">
          <button type="button" class="vg-ex-btn" data-play="${e(x.id)}" aria-label="Play ${e(x.name)}">
            <span class="vg-ex-art" aria-hidden="true">${toy(x.id, CYC[i % 3])}</span>
            <span class="vg-c vg-ex-label" style="--j:${i}"><span class="vg-ex-no">V.${i + 1} · interactive</span><b>${e(x.name)}</b><span class="vg-ex-d">${e(x.desc || "")}</span><span class="vg-ex-go">Please touch ${H.icon("arrow-right")}</span></span>
          </button>
        </li>`).join("");
      const deg = (v, pos, neg) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
      const PLACE = { home: "Home", school: "School", now: "Now" };

      const work = C.projects.map((p, i) => {
        const col = CYC[i % 3];
        const links = Object.entries(p.links).map(([k, v]) => `<a href="${e(v)}" target="_blank" rel="noopener">${e(k)} ${H.icon("arrow-up-right")}</a>`).join("");
        return `<article class="vg-piece" style="--k:${col};--j:${i}">
          <button type="button" class="vg-frame-art" data-case="${e(p.slug)}" tabindex="-1" aria-hidden="true">${study(i, col)}</button>
          <div class="vg-c vg-label" style="--j:${i}">
            ${tag(`II.${i + 1}`, e(p.kind), col)}
            <h3><button type="button" data-case="${e(p.slug)}">${e(p.title)}</button></h3>
            <p class="vg-hl">${e(p.headline)}</p>
            <p class="vg-med">${e(p.ctx)}</p>
            <p class="vg-mat">${p.tags.map(e).join(" · ")}</p>
            <p class="vg-links"><button type="button" class="vg-open" data-case="${e(p.slug)}">Read the study ${H.icon("arrow-right")}</button>${links}</p>
          </div>
        </article>`;
      }).join("");

      const roles = C.experience.map((x, i) => `<li class="vg-c vg-role" id="experience-${e(x.slug)}" style="--sh:${CYC[(i + 2) % 3]};--j:${i}">
          ${tag(`III.${i + 1}`, e(x.when), CYC[(i + 2) % 3])}
          <h3>${e(x.role)}</h3>
          <p class="vg-org">${e(x.org)}<span>${e(x.where)}</span></p>
          <ul class="vg-desc">${x.desc.map((d) => `<li>${e(d)}</li>`).join("")}</ul>
          <p class="vg-mat">${x.tags.map(e).join(" · ")}</p>
        </li>`).join("");

      const ed = C.education;
      const places = C.places.map((p, i) => `<li><i style="background:${CYC[i]}"></i><b>${PLACE[p.key] || e(p.key)}</b><span class="c">${e(p.city)}</span><span class="g">${deg(p.lat, "N", "S")}, ${deg(p.lng, "E", "W")}</span><time data-clock="${e(p.tz)}"></time></li>`).join("");
      const numbers = C.numbers.map(([n, l], i) => `<div class="vg-c vg-num" style="--sh:${[TEAL, ROSE, OCHRE, INK][i]};--j:${i + 3}"><b>${e(n)}</b><span>${e(l)}</span></div>`).join("");
      const stack = Object.entries(C.stack).map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${v.map((t) => H.chip(t)).join("")}</dd></div>`).join("");
      const faq = C.faq.map(([q, a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join("");
      const log = C.log.map(([d, k, m]) => `<li><time>${e(d)}</time><b class="k-${e(k)}">${e(k)}</b><span>${e(m)}</span></li>`).join("");
      const key = C.thesis.map((t, i) => `<li><i style="background:${CYC[i]}"></i>${e(t)}</li>`).join("");

      return `<div class="vg" id="vg">
  <div class="vg-mat-frame" aria-hidden="true"><i class="vg-ruler t"></i><i class="vg-ruler l"></i></div>
  <header class="vg-bar">
    <a class="vg-mark" href="#top" aria-label="${e(C.name)}, back to the top">${H.mark ? `<span class="vg-logo" aria-hidden="true">${H.mark()}</span>` : ""}<b>${e(C.initials.split("").join("·"))}</b><span><i>Vertigo</i>, 2026</span></a>
    <nav class="vg-nav" aria-label="Plates">${nav.map(([id, l], i) => `<a href="#${id}"><b>${ROMAN[i]}</b><span>${l}</span></a>`).join("")}</nav>
    <span class="vg-dims" aria-hidden="true"><span data-vg-dims>1440 × 900</span> px</span>
  </header>

  <section class="vg-plate vg-hero" id="top" data-k="${TEAL}" aria-labelledby="vg-name">
    <svg class="vg-con" aria-hidden="true"></svg>
    <div class="vg-c vg-name" style="--j:0">
      ${tag("Pl. I", "Portrait of the engineer", TEAL)}
      <h1 id="vg-name"><span class="a">${e(C.first)}</span><span class="b">${e(C.last)}</span></h1>
      <p class="vg-what">${e(C.role)}</p>
      <p class="vg-line">${e(C.line)}</p>
      <p class="vg-status"><span class="vg-led" aria-hidden="true"></span><span>${e(open.charAt(0).toUpperCase() + open.slice(1))}</span><span class="vg-sch">${e(school)}</span></p>
    </div>
    <div class="vg-c vg-act" style="--j:1;--sh:${ROSE}">
      ${tag("I.a", "Enquiries", ROSE)}
      <div class="vg-btns">
        <button type="button" class="vg-btn ink" data-compose>${H.icon("mail")}Email</button>
        <button type="button" class="vg-btn" data-resume>${H.icon("file-text")}Resume</button>
        <button type="button" class="vg-btn" data-agent>${H.icon("terminal")}Ask the agent</button>
      </div>
    </div>
    <div class="vg-c vg-por" style="--j:2">
      ${H.portrait({ id: "vertigo" })}
      <p class="vg-cap"><b>Fig. 1</b> The artist, with three lines of correspondence</p>
    </div>
    <aside class="vg-c vg-colo" style="--j:3;--sh:${OCHRE}" aria-label="Colophon">
      <p class="vg-colo-t"><b>${e(C.name)}</b><span><i>Vertigo</i>, 2026</span></p>
      <dl>
        <div><dt>Medium</dt><dd>WebGL on glass</dd></div>
        <div><dt>Dimensions</dt><dd><span data-vg-dims>1440 × 900</span> px, variable</dd></div>
        <div><dt>Frame rate</dt><dd><span data-vg-fps>60</span></dd></div>
      </dl>
      <ul class="vg-key" aria-label="Colour key">${key}</ul>
      <p class="vg-warn">Visitors may experience mild vertigo.</p>
    </aside>
  </section>

  <section class="vg-plate vg-work" id="work" data-k="${ROSE}" aria-labelledby="vg-work-h">
    <svg class="vg-con" aria-hidden="true"></svg>
    <div class="vg-c vg-head" style="--sh:${ROSE}">
      ${tag("Pl. II", "Six studies", ROSE)}
      <h2 id="vg-work-h">Work</h2>
      <p>From EEG headsets to the cloud. Each study opens to its notes.</p>
    </div>
    <div class="vg-hang">${work}</div>
  </section>

  <section class="vg-plate vg-chron" id="experience" data-k="${OCHRE}" aria-labelledby="vg-exp-h">
    <svg class="vg-con" aria-hidden="true"></svg>
    <div class="vg-c vg-head" style="--sh:${OCHRE}">
      ${tag("Pl. III", "Chronology", OCHRE)}
      <h2 id="vg-exp-h">Experience</h2>
      <p>Four roles, newest first, and the school behind them.</p>
    </div>
    <div class="vg-c vg-edu" id="education" style="--sh:${TEAL};--j:1">
      ${tag("III.0", "Education", TEAL)}
      <div class="vg-edu-row"><img src="${e(ed.logo)}" alt="" width="56" height="56" loading="lazy"><div><h3>${e(ed.school)}</h3><p>${e(ed.degree)}</p></div></div>
      <p class="vg-mat">${e(ed.focus)} · ${e(ed.grad)}</p>
    </div>
    <ol class="vg-roles">${roles}</ol>
  </section>

  <section class="vg-plate vg-about" id="about" data-k="${TEAL}" aria-labelledby="vg-about-h">
    <svg class="vg-con" aria-hidden="true"></svg>
    <div class="vg-c vg-txt" style="--j:0">
      ${tag("Pl. IV", "About", TEAL)}
      <h2 id="vg-about-h">Close to the hardware</h2>
      ${C.about.map((p) => `<p>${e(p)}</p>`).join("")}
    </div>
    <div class="vg-c vg-now" style="--sh:${ROSE};--j:1">
      ${tag("IV.a", "Now", ROSE)}
      <dl>
        <div><dt>In</dt><dd>${e(C.now.city)} <time data-clock="${e(C.now.tz)}"></time></dd></div>
        <div><dt>Building</dt><dd>${e(C.now.building)}</dd></div>
        <div><dt>Researching</dt><dd>${e(C.now.researching)}</dd></div>
        <div><dt>Learning</dt><dd>${e(C.now.learning)}</dd></div>
      </dl>
    </div>
    <div class="vg-c vg-places" style="--j:2">
      ${tag("IV.b", "Places", INK)}
      <ul>${places}</ul>
    </div>
    <div class="vg-nums">${numbers}</div>
    <div class="vg-c vg-stack" style="--sh:${OCHRE};--j:7">
      ${tag("IV.c", "Materials", OCHRE)}
      <dl>${stack}</dl>
    </div>
  </section>

  <section class="vg-plate vg-play" id="play" data-k="${OCHRE}" aria-labelledby="vg-play-h">
    <svg class="vg-con" aria-hidden="true"></svg>
    <div class="vg-c vg-head" style="--sh:${OCHRE}">
      ${tag("Pl. V", "Interactive room", OCHRE)}
      <h2 id="vg-play-h">Please touch</h2>
      <p>The one room where the guard looks away.</p>
    </div>
    <ul class="vg-exs">${play}</ul>
  </section>

  <section class="vg-plate vg-contact" id="contact" data-k="${ROSE}" aria-labelledby="vg-contact-h">
    <svg class="vg-con" aria-hidden="true"></svg>
    <div class="vg-c vg-write" style="--sh:${ROSE};--j:0">
      ${tag("Pl. VI", "Correspondence", ROSE)}
      <h2 id="vg-contact-h">Write to me</h2>
      <p class="vg-open-to">${e(open.charAt(0).toUpperCase() + open.slice(1))}.</p>
      <div class="vg-btns">
        <button type="button" class="vg-btn ink" data-compose="Internship opportunity">${H.icon("mail")}Write an email</button>
        <button type="button" class="vg-btn" data-copy="${e(C.links.email)}">${H.icon("copy")}${e(C.links.email)}</button>
      </div>
      <ul class="vg-elsewhere">
        <li><a href="${e(C.links.github)}" target="_blank" rel="noopener">${H.logo("github")}GitHub</a></li>
        <li><a href="${e(C.links.linkedin)}" target="_blank" rel="noopener">${H.logo("linkedin")}LinkedIn</a></li>
        <li><button type="button" data-resume>${H.icon("file-text")}Resume</button></li>
        <li><button type="button" data-agent>${H.icon("terminal")}Ask the agent</button></li>
      </ul>
    </div>
    <div class="vg-c vg-faq" style="--j:1">
      ${tag("VI.a", "Questions", INK)}
      ${faq}
    </div>
    <div class="vg-c vg-prov" style="--sh:${TEAL};--j:2">
      ${tag("VI.b", "Provenance", TEAL)}
      <p class="vg-prov-sub">Recent changes to this site</p>
      <ol>${log}</ol>
    </div>
    <footer class="vg-c vg-end" style="--sh:${OCHRE};--j:3">
      <p><b>${e(C.name)}</b> · <i>Vertigo</i>, 2026 · Plates I to VI</p>
      <p>Moiré computed per frame in a fragment shader; two gratings, one lens. Set in Bodoni Moda and DM Mono.</p>
    </footer>
  </section>
</div>`;
    },

    mount(root, H) {
      const vg = root.querySelector("#vg");
      const plates = Array.from(root.querySelectorAll(".vg-plate"));
      const reduce = H.reduceMotion();
      const offs = [];
      const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
      if (!reduce) vg.classList.add("armed"); else vg.classList.add("still");

      /* Construction drawing: a ladder of golden squares along the long side, then a golden spiral in
         what remains, with quarter arcs, the spiral's diagonals, and registration marks tying every
         cartouche to the nearest node. Recomputed from the plate's real size so it re-proportions. */
      function build(plate) {
        const svg = plate.querySelector(":scope > .vg-con"); if (!svg) return;
        const w = plate.clientWidth, h = plate.clientHeight; if (w < 40 || h < 40) return;
        const sq = [], arcs = [], diag = [], nodes = [];
        let x = 0, y = 0, W = w, H2 = h, flip = 0, n = 0;
        const f = (v) => v.toFixed(1);
        const port = H2 > W;
        while (n < 40 && (port ? H2 > W * 1.9 : W > H2 * 1.9)) {
          const s = Math.min(W, H2);
          sq.push([x, y, s]);
          if (port) { arcs.push(flip ? `M${f(x + s)} ${f(y)}A${f(s)} ${f(s)} 0 0 0 ${f(x)} ${f(y + s)}` : `M${f(x)} ${f(y)}A${f(s)} ${f(s)} 0 0 1 ${f(x + s)} ${f(y + s)}`); y += s; H2 -= s; }
          else { arcs.push(flip ? `M${f(x)} ${f(y)}A${f(s)} ${f(s)} 0 0 1 ${f(x + s)} ${f(y + s)}` : `M${f(x)} ${f(y + s)}A${f(s)} ${f(s)} 0 0 1 ${f(x + s)} ${f(y)}`); x += s; W -= s; }
          flip ^= 1; n++;
        }
        const R0 = [x, y, W, H2];
        let dir = W >= H2 ? 0 : 1, last = null;
        for (let k = 0; k < 9; k++) {
          const s = Math.min(W, H2); if (s < 22) break;
          let sx = x, sy = y, a;
          if (dir === 0) { a = `M${f(sx)} ${f(sy + s)}A${f(s)} ${f(s)} 0 0 1 ${f(sx + s)} ${f(sy)}`; x += s; W -= s; }
          else if (dir === 1) { a = `M${f(sx)} ${f(sy)}A${f(s)} ${f(s)} 0 0 1 ${f(sx + s)} ${f(sy + s)}`; y += s; H2 -= s; }
          else if (dir === 2) { sx = x + W - s; a = `M${f(sx + s)} ${f(sy)}A${f(s)} ${f(s)} 0 0 1 ${f(sx)} ${f(sy + s)}`; W -= s; }
          else { sy = y + H2 - s; a = `M${f(sx + s)} ${f(sy + s)}A${f(s)} ${f(s)} 0 0 1 ${f(sx)} ${f(sy)}`; H2 -= s; }
          sq.push([sx, sy, s]); arcs.push(a); last = [sx + s / 2, sy + s / 2, s];
          dir = (dir + 1) % 4;
        }
        const [rx, ry, rw, rh] = R0;
        diag.push(`M${f(rx)} ${f(ry)}L${f(rx + rw)} ${f(ry + rh)}`, `M${f(rx + rw)} ${f(ry)}L${f(rx)} ${f(ry + rh)}`);
        sq.forEach(([a, b, s]) => nodes.push([a, b], [a + s, b], [a, b + s], [a + s, b + s]));
        // cartouches: registration crosses at their corners and a dotted leader to the nearest node
        const pr = plate.getBoundingClientRect();
        const marks = [], leads = [];
        plate.querySelectorAll(".vg-c").forEach((c) => {
          const r = c.getBoundingClientRect(); if (!r.width) return;
          const cx = r.left - pr.left, cy = r.top - pr.top, cx2 = cx + r.width;
          marks.push(`M${f(cx - 14)} ${f(cy - 7)}h10M${f(cx - 9)} ${f(cy - 12)}v10`, `M${f(cx2 + 4)} ${f(cy - 7)}h10M${f(cx2 + 9)} ${f(cy - 12)}v10`);
          let best = null, bd = 1e9;
          nodes.forEach(([nx, ny]) => { const d = Math.hypot(nx - cx, ny - cy); if (d < bd && d > 18) { bd = d; best = [nx, ny]; } });
          if (best && bd < 300) leads.push(`M${f(cx)} ${f(cy)}L${f(best[0])} ${f(best[1])}`);
        });
        let i = 0;
        const path = (d, cls) => `<path class="${cls}" d="${d}" pathLength="1" style="--i:${i++}"/>`;
        const sqd = sq.map(([a, b, s]) => `M${f(a)} ${f(b)}h${f(s)}v${f(s)}h${f(-s)}Z`);
        const drawn = [...sqd.map((d) => [d, "sq"]), ...arcs.map((d) => [d, "arc"]), ...diag.map((d) => [d, "dg"])];
        i = 0; const cut = drawn.map(([d, c]) => path(d, `d cut ${c}`)).join("");
        i = 0; const ink = drawn.map(([d, c]) => path(d, `d ${c}`)).join("");
        const eye = last ? `<circle class="eye" cx="${f(last[0])}" cy="${f(last[1])}" r="7"/><circle class="eye-dot" cx="${f(last[0])}" cy="${f(last[1])}" r="2.5"/>` : "";
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.innerHTML = `<g class="g-cut">${cut}</g><g class="g-ink">${ink}</g><g class="g-pin"><path class="lead-cut" d="${leads.join("")}"/><path class="lead" d="${leads.join("")}"/><path class="mark" d="${marks.join("")}"/>${eye}</g>`;
        plate.dataset.built = String(w) + "x" + String(h);
      }
      const buildAll = () => plates.forEach(build);

      // the hero draws itself in once its lines exist; lower plates wait until they enter view
      buildAll();
      const hero = plates[0];
      let r1 = requestAnimationFrame(() => { r1 = requestAnimationFrame(() => hero.classList.add("is-in")); });
      let io = null;
      if (!reduce && "IntersectionObserver" in window) {
        io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("is-in"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -18% 0px", threshold: 0.02 });
        plates.slice(1).forEach((p) => io.observe(p));
      } else plates.forEach((p) => p.classList.add("is-in"));

      let rT = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(buildAll, 120); });
      plates.forEach((p) => ro.observe(p));
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (vg.isConnected) buildAll(); });

      // live dimensions of the work: the viewport in CSS px
      const dims = () => root.querySelectorAll("[data-vg-dims]").forEach((el) => (el.textContent = `${innerWidth} × ${innerHeight}`));
      dims(); on(window, "resize", dims, { passive: true });

      // a frame-rate readout in the colophon, counted only while it is on screen
      const fpsEl = root.querySelector("[data-vg-fps]");
      let fr = 0, fc = 0, ft = 0, colVis = true;
      const tick = (now) => { fr = 0; if (!ft) ft = now; fc++; if (now - ft >= 1000) { fpsEl.textContent = `${Math.round((fc * 1000) / (now - ft))} fps`; fc = 0; ft = now; } if (colVis && !document.hidden) fr = requestAnimationFrame(tick); };
      let fio = null;
      if (reduce) fpsEl.textContent = "still frame";
      else {
        fpsEl.textContent = "measuring";
        fio = new IntersectionObserver((en) => { colVis = en[0].isIntersecting; if (colVis && !fr) { ft = 0; fc = 0; fr = requestAnimationFrame(tick); } });
        fio.observe(fpsEl);
        on(document, "visibilitychange", () => { if (!document.hidden && colVis && !fr) { ft = 0; fc = 0; fr = requestAnimationFrame(tick); } });
      }

      // clocks keep time
      const clk = setInterval(() => root.querySelectorAll("[data-clock]").forEach((el) => (el.textContent = H.clock(el.dataset.clock))), 30000);

      // the active plate is underlined in the frame's nav
      const links = Array.from(root.querySelectorAll(".vg-nav a"));
      const nio = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) links.forEach((a) => a.toggleAttribute("aria-current", a.hash === "#" + x.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
      plates.forEach((p) => nio.observe(p));

      return () => {
        offs.forEach((f) => f()); cancelAnimationFrame(r1); cancelAnimationFrame(fr); clearTimeout(rT); clearInterval(clk);
        ro.disconnect(); io && io.disconnect(); fio && fio.disconnect(); nio.disconnect();
      };
    },
  });
})();
