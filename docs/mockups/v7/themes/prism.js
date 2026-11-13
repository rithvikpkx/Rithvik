/* Prism: light splitting through glass. A crisp, quiet white optics catalogue in precise black type; the
   trippiness is optical and lives in a few places only.
   Where each effect appears, and why:
   - Spectral dispersion (shader, first screen): a glass prism takes a thin white beam and throws a
     spectrum that turns toward the pointer. Full intensity here because it is the one big moment; it
     fades out over the first screen (u_scroll) so reading areas stay calm.
   - Caustics (shader, behind the Map only): a faint rainbow caustic net, like light through a glass on a
     table. The canvas is fixed behind the page and every reading section is opaque white, so the light
     only shows through the hero and the Map; the canvas is switched off entirely when neither is on screen.
   - Chromatic aberration (DOM): the hero name splits into red and cyan as the page loads and settles;
     section headings split briefly along the scroll direction with scroll speed; project titles split on
     hover. Never on body text, never at rest.
   - Anaglyph (DOM, once): the Play heading is printed red/cyan with depth that follows the pointer.
   - The dark room (contact): the only black surface on the site, where the prism glows in the dark.
   Performance mode (html.lite): the core freezes the shader to one designed still (prism and spectrum),
   re-drawn when a lit section enters; no RGB splits, no anaglyph tracking, no blend modes, no blur. */
(function () {
  "use strict";

  /* ───────── Shader: glass prism, dispersed beam, chromatic caustics, grain ───────── */
  const SHADER = `
#define TAU 6.2831853
vec3 hue(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
// visible spectrum: 0 = red, 1 = violet, softened so it reads like light falling on paper
vec3 spec(float x){ vec3 c = hue(x * .79); return mix(c, vec3(1.), .08); }
// iterated-trig caustic net (cheap, no noise)
float caust(vec2 p, float t){
  vec2 i = p; float c = 1.;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1. - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + tt) / .005), p.y / (cos(i.y + tt) / .005)));
  }
  c = 1.17 - pow(c / 4., 1.4);
  return clamp(pow(abs(c), 8.), 0., 1.);
}
float sdTri(vec2 p, float r){ const float k = 1.7320508; p.x = abs(p.x) - r; p.y = p.y + r / k;
  if (p.x + k * p.y > 0.) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.; p.x -= clamp(p.x, -2. * r, 0.); return -length(p) * sign(p.y); }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float segd(vec2 p, vec2 a, vec2 b, out float h){ vec2 pa = p - a, ba = b - a; h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float px = 1. / u_res.y;
  float t = u_time;
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float tall = 1. - smoothstep(.75, 1.2, asp);
  // the prism is the first screen; it is gone by the time the first section has slid over it
  float F = 1. - smoothstep(.02, .14, u_scroll);

  // paper: white, with a cool breath of mist where the prism stands
  vec3 col = u_c0;
  vec2 C = mix(vec2(asp * .69, .5), vec2(asp * .5, .215), tall);
  float R = mix(.2, .145, tall);
  float vign = exp(-dot(p - C, p - C) * mix(1.6, 3.2, tall));
  col = mix(col, u_c2, F * (.42 + .58 * vign));

  // caustics: three channels sampled a little apart, so the net breaks into a faint rainbow
  float w = fbm(p * .85 + vec2(t * .018, -u_scroll * 1.6));
  float patchy = smoothstep(-.3, .55, w);
  vec2 cp = p * 5.5 + vec2(-250., -250. + u_scroll * 6.);
  float ct = t * .3 + 40.;
  vec2 dk = vec2(.11, .05);
  vec3 cv = vec3(caust(cp + dk, ct), caust(cp, ct), caust(cp - dk, ct));
  float avg = (cv.r + cv.g + cv.b) / 3.;
  // on white paper light can only show as colour: the channels that run ahead tint the line, a whisper of shade around it
  float amt = mix(.4, .14, F) * patchy;
  col = clamp(col + (cv - avg) * amt * 1.6 - (1. - avg) * amt * .045, 0., 1.);

  // prism, local frame: apex up, a slow sway, a nudge from the pointer and the scroll
  float a0 = .05 * sin(t * .23) + (u_mouse.x - .5) * .08 + u_scroll * 1.6;
  vec2 q = rot(p - C, -a0);
  float d = sdTri(q, R);
  vec2 T = vec2(0., 2. * R / 1.7320508), BL = vec2(-R, -R / 1.7320508), BR = vec2(R, -R / 1.7320508);
  vec2 A = C + rot(mix(BL, T, .56), a0), E = C + rot(mix(T, BR, .5), a0);
  float inside = 1. - smoothstep(-px, px, d);

  // incident beam: a hairline of white light falling from the top
  vec2 vIn = normalize(mix(vec2(.62, -1.), vec2(.42, -1.), tall));
  vec2 wa = p - A;
  float along = dot(wa, -vIn), perp = abs(wa.x * vIn.y - wa.y * vIn.x);
  float beam = step(0., along) * (1. - inside) * (exp(-pow(perp / (1.25 * px), 2.)) + .32 * exp(-perp / (16. * px)));
  col = mix(col, vec3(1.), clamp(beam, 0., 1.) * F);
  // the faint reflection off the first face
  vec2 vR = normalize(vec2(-1., .2));
  float alR = dot(wa, vR), peR = abs(wa.x * vR.y - wa.y * vR.x);
  col = mix(col, vec3(1.), step(0., alR) * exp(-alR * 7.) * exp(-pow(peR / (1.1 * px), 2.)) * .4 * F * (1. - inside));

  // dispersion fan: rays leave the far face, red bent least, aimed toward the pointer
  vec2 e = p - E; float r = length(e);
  vec2 tm = m - E;
  float target = clamp(atan(tm.y, max(tm.x, .3)), -1.0, .42);
  float phi = mix(mix(-.3, target, .8), -.62, tall);
  float spread = .42 + .05 * sin(t * .4);
  float ang = atan(e.y, e.x);
  float x = (ang - phi) / spread + .5;
  float lam = 1. - x;
  float edgeF = smoothstep(0., .07, x) * smoothstep(1., .93, x);
  float streak = .8 + .2 * vnoise(vec2(x * 70., r * 5. - t * .3));
  float fall = smoothstep(0., 10. * px, r) * (.6 + .4 * exp(-r * 1.1));
  float fan = edgeF * fall * streak * step(0., d) * F;
  col = mix(col, col * spec(clamp(lam, 0., 1.)), fan * .9);
  col = mix(col, vec3(1.), fan * exp(-r * 9.) * .25);

  // glass: a cool, slightly brighter body; refracted caustics; the beam inside widening as it splits
  vec3 glass = mix(col, vec3(.985, .99, 1.), .55);
  float h; float sd = segd(p, A, E, h);
  float wid = mix(1.3, 7., h) * px;
  vec2 sn = normalize(vec2(A.y - E.y, E.x - A.x));
  vec3 inner = mix(vec3(1.), spec(clamp(.5 - .5 * dot(p - mix(A, E, h), sn) / wid, 0., 1.)), smoothstep(.35, 1., h) * .7);
  glass = mix(glass, inner, exp(-pow(sd / wid, 2.)) * .9);
  glass *= 1. - .035 * smoothstep(-R * .9, 0., d);
  col = mix(col, glass, inside * F);
  // edges: a graphite hairline, a white inner highlight, a dispersed fringe just outside
  float edge = 1. - smoothstep(.0, 1.15 * px, abs(d));
  float hl = exp(-pow((d + 3. * px) / (1.1 * px), 2.));
  float fr = exp(-pow((d - 2. * px) / (1.1 * px), 2.));
  vec3 fringe = spec(fract(atan(q.y, q.x) / TAU + t * .02));
  col = mix(col, col * fringe, fr * .22 * F);
  col = mix(col, vec3(1.), hl * .85 * F);
  col = mix(col, u_c1, edge * .62 * F);
  // a second, inner reflection of the faces
  float d2 = sdTri(q, R * .9);
  col = mix(col, vec3(1.), (1. - smoothstep(0., 1.1 * px, abs(d2))) * .5 * F);

  // grain: the capped resolution reads as fine texture, never as blur
  col += (hash21(fc + fract(t * 7.3) * 91.) - .5) * (2.2 / 255.);
  gl_FragColor = vec4(col, 1.);
}`;

  // six projects, six bands of the visible spectrum (red bends least, violet most)
  const BANDS = [["#FF2D3D", "650"], ["#FF7A00", "600"], ["#E8B800", "580"], ["#12B76A", "530"], ["#1E6BFF", "470"], ["#7A3CFF", "420"]];
  const PLACE = { home: "Home", school: "School", now: "Now" };
  const pad = (i) => String(i + 1).padStart(2, "0");

  /* ───────── render: the whole site ───────── */
  function render(C, H) {
    const { esc, icon, logo, portrait, mark } = H;
    const ca = (txt, cls = "") => `<span class="pr-ca${cls ? " " + cls : ""}" data-text="${esc(txt)}">${esc(txt)}</span>`;

    const proj = (p, i) => `<li class="pr-pj-li">
      <a class="pr-pj" href="#work" data-case="${p.slug}" style="--band:${BANDS[i][0]}" aria-label="${esc(p.title)}: ${esc(p.headline)}. Open the case">
        <span class="pr-pj-band" aria-hidden="true"></span>
        <span class="pr-pj-n"><b>${pad(i)}</b><span>${BANDS[i][1]} nm</span></span>
        <span class="pr-pj-main">
          <span class="pr-pj-t">${ca(p.title)}</span>
          <span class="pr-pj-h">${esc(p.headline)}</span>
        </span>
        <span class="pr-pj-k">${icon(p.icon)}${esc(p.kind)}</span>
        <span class="pr-pj-go" aria-hidden="true">${icon("arrow-up-right")}</span>
      </a>
    </li>`;

    const toy = (t, i) => `<li><button type="button" class="pr-toy" data-play="${t.id}" style="--band:${BANDS[i % 6][0]}" aria-label="Play ${esc(t.name)}: ${esc(t.desc)}">
      <span class="pr-toy-n">${pad(i)}</span>
      <span class="pr-toy-ic" aria-hidden="true">${icon(t.icon)}</span>
      <span class="pr-toy-t">${esc(t.name)}</span>
      <span class="pr-toy-d">${esc(t.desc)}</span>
      <span class="pr-toy-bar" aria-hidden="true"></span>
    </button></li>`;

    // the dark room's prism: the photographed render, with a crisp SVG fallback if the file is missing
    const fanStops = BANDS.map(([c], i) => `<stop offset="${(i / 5).toFixed(2)}" stop-color="${c}"/>`).join("");
    const darkArt = `<svg class="pr-dk-svg" viewBox="0 0 600 360" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pr-fan" x1="0" y1="0" x2="0" y2="1">${fanStops}</linearGradient>
        <linearGradient id="pr-fan-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient>
        <mask id="pr-fan-m"><rect width="600" height="360" fill="url(#pr-fan-fade)"/></mask>
      </defs>
      <path class="pr-dk-ray" d="M0 214 L246 168"/>
      <path class="pr-dk-in" d="M246 168 L330 176"/>
      <path class="pr-dk-fan" d="M330 176 L600 118 L600 330 Z" fill="url(#pr-fan)" mask="url(#pr-fan-m)"/>
      <path class="pr-dk-glass" d="M300 70 L380 214 L220 214 Z"/>
      <path class="pr-dk-hl" d="M300 84 L370 208"/>
    </svg>`;

    return `<div class="pr" id="pr">
<div class="pr-gl" id="pr-gl" aria-hidden="true"></div>

<header class="pr-nav" id="pr-nav">
  <a class="pr-logo" href="#top" aria-label="Rithvik Praveen Kumar, back to top"><span class="pr-logo-m">${mark()}</span><span class="pr-logo-t">${esc(C.name)}</span></a>
  <nav class="pr-links" aria-label="Sections"><a href="#work">Work</a><a href="#graph">Map</a><a href="#experience">Experience</a><a href="#about">About</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
  <a class="pr-btn pr-btn-ink pr-btn-sm" href="#" data-resume>Resume</a>
</header>

<section class="pr-hero pr-lit" id="top" aria-labelledby="pr-h1">
  <div class="pr-hero-in">
    <p class="pr-kicker"><i class="pr-spec-dot" aria-hidden="true"></i>${esc(C.role)}</p>
    <h1 class="pr-name" id="pr-h1">${ca(C.first, "pr-name-1")}${ca(C.last, "pr-name-2")}</h1>
    <p class="pr-lede">${esc(C.line)}</p>
    <p class="pr-status"><i class="pr-led" aria-hidden="true"></i>${esc(C.status)}</p>
    <div class="pr-acts">
      <a class="pr-btn pr-btn-ink" href="#" data-resume>${icon("file-text")}Resume</a>
      <button type="button" class="pr-btn pr-btn-line" data-compose="Internship opportunity">${icon("mail")}Email me</button>
      <button type="button" class="pr-btn pr-btn-ghost" data-agent><span class="pr-prompt" aria-hidden="true">❯</span>Ask my agent</button>
    </div>
  </div>
  <p class="pr-fig" aria-hidden="true"><span>Fig. 1</span>White light, split<span class="pr-fig-hint"> · move the pointer to steer it</span></p>
</section>

<section class="pr-sec pr-about" id="about" aria-labelledby="pr-h-about">
  <div class="pr-about-grid">
    <div class="pr-pt">${portrait({ id: "prism", cls: "pr-portrait" })}</div>
    <div class="pr-about-txt">
      <p class="pr-kicker"><span class="pr-k-n">01</span>About</p>
      <h2 class="pr-h2" id="pr-h-about">${ca("Hi, I'm " + C.first + ".")}</h2>
      ${C.about.map((a) => `<p class="pr-p">${esc(a)}</p>`).join("")}
      <ul class="pr-thesis">${C.thesis.map((t, i) => `<li style="--band:${BANDS[i * 2 + 1][0]}">${esc(t)}</li>`).join("")}</ul>
    </div>
  </div>
  <div class="pr-now" id="now">
    <div class="pr-now-h"><p class="pr-kicker"><span class="pr-k-n">01.1</span>Now</p><p class="pr-now-city">${icon("map-pin")}${esc(C.now.city)} · <span data-clock="${esc(C.now.tz)}">${esc(H.clock(C.now.tz))}</span></p></div>
    <dl class="pr-now-list">
      <div><dt>Building</dt><dd>${esc(C.now.building)}</dd></div>
      <div><dt>Researching</dt><dd>${esc(C.now.researching)}</dd></div>
      <div><dt>Learning</dt><dd>${esc(C.now.learning)}</dd></div>
    </dl>
    <ol class="pr-places" aria-label="Places">${C.places.map((pl) => `<li class="${pl.key === "now" ? "is-now" : ""}"><span>${PLACE[pl.key] || esc(pl.key)}</span><b>${esc(pl.city)}</b><time data-clock="${esc(pl.tz)}">${esc(H.clock(pl.tz))}</time></li>`).join("")}</ol>
  </div>
</section>

<section class="pr-sec pr-nums" aria-label="In numbers">
  <dl>${C.numbers.map(([n, l], i) => `<div style="--band:${BANDS[[0, 2, 4, 5][i]][0]}"><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join("")}</dl>
</section>

<section class="pr-sec pr-work" id="work" aria-labelledby="pr-h-work">
  <header class="pr-sec-h">
    <p class="pr-kicker"><span class="pr-k-n">02</span>Work</p>
    <h2 class="pr-h2" id="pr-h-work">${ca("Six projects, one spectrum.")}</h2>
    <p class="pr-sub">From EEG headsets to the cloud. Each one opens.</p>
  </header>
  <ol class="pr-pjs">${C.projects.map(proj).join("")}</ol>
</section>

<section class="pr-sec pr-graph pr-lit" id="graph" aria-labelledby="pr-h-graph">
  <header class="pr-sec-h">
    <p class="pr-kicker"><span class="pr-k-n">03</span>Map</p>
    <h2 class="pr-h2" id="pr-h-graph">${ca("How it all connects.")}</h2>
    <p class="pr-sub">Fields, projects, roles, places and the skills between them. Hover to trace a path, click for the details.</p>
  </header>
  <div class="pr-kg">${H.graph({ id: "prism" })}</div>
</section>

<section class="pr-sec pr-exp" id="experience" aria-labelledby="pr-h-exp">
  <header class="pr-sec-h">
    <p class="pr-kicker"><span class="pr-k-n">04</span>Experience</p>
    <h2 class="pr-h2" id="pr-h-exp">${ca("Where I've worked.")}</h2>
  </header>
  <ol class="pr-roles">${C.experience.map((x, i) => `<li class="pr-role" id="experience-${x.slug}">
    <p class="pr-when"><b>${esc(x.when)}</b><span>${esc(x.where)}</span></p>
    <div class="pr-role-b">
      <h3>${esc(x.role)}</h3>
      <p class="pr-org">${esc(x.org)}</p>
      <ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      <p class="pr-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>
    </div>
  </li>`).join("")}</ol>
  <div class="pr-edu" id="education">
    <img src="${esc(C.education.logo)}" alt="Purdue University" width="72" height="72" loading="lazy" decoding="async">
    <div>
      <p class="pr-kicker">Education</p>
      <h3>${esc(C.education.school)}</h3>
      <p class="pr-edu-d">${esc(C.education.degree)}</p>
      <p class="pr-edu-m">${esc(C.education.focus)} · ${esc(C.education.grad)}</p>
    </div>
  </div>
</section>

<section class="pr-sec pr-play" id="play" aria-labelledby="pr-h-play">
  <header class="pr-play-h">
    <p class="pr-kicker"><span class="pr-k-n">05</span>Play</p>
    <h2 class="pr-ana" id="pr-h-play" aria-label="Play"><span class="pr-ana-c" aria-hidden="true">Play</span><span class="pr-ana-r" aria-hidden="true">Play</span></h2>
    <p class="pr-sub">Six small toys. Red-cyan glasses optional.</p>
  </header>
  <ul class="pr-toys">${H.PLAY.map(toy).join("")}</ul>
</section>

<section class="pr-sec pr-contact" id="contact" aria-labelledby="pr-h-contact">
  <div class="pr-dark">
    <div class="pr-dk-art" aria-hidden="true"><img class="pr-dk-img" src="assets/prism/prism-1376.webp" alt="" width="1376" height="768" loading="lazy" decoding="async" onerror="this.remove()">${darkArt}</div>
    <div class="pr-dk-in">
      <p class="pr-kicker"><span class="pr-k-n">06</span>Contact</p>
      <h2 class="pr-dk-h" id="pr-h-contact">Write to me.</h2>
      <p class="pr-dk-p">Open to SWE and AI internships. The message goes straight to my inbox.</p>
      <div class="pr-acts">
        <button type="button" class="pr-btn pr-btn-white" data-compose="Internship opportunity">${icon("mail")}Write an email</button>
        <button type="button" class="pr-btn pr-btn-dkline" data-copy="${esc(C.links.email)}">${icon("copy")}${esc(C.links.email)}</button>
      </div>
      <ul class="pr-dk-links">
        <li><a href="${esc(C.links.github)}" target="_blank" rel="noopener">${logo("github")}GitHub</a></li>
        <li><a href="${esc(C.links.linkedin)}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a></li>
        <li><a href="#" data-resume>${icon("file-text")}Resume</a></li>
        <li><a href="#" data-agent>${icon("terminal")}Agent</a></li>
      </ul>
    </div>
  </div>
</section>

<footer class="pr-foot">
  <a class="pr-foot-m" href="#top" aria-label="Back to top">${mark()}</a>
  <nav class="pr-foot-nav" aria-label="Footer"><a href="#work">Work</a><a href="#graph">Map</a><a href="#experience">Experience</a><a href="#about">About</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
  <p class="pr-colo">The light is one fragment shader: a glass prism, its spectrum, and the caustics it throws on the Map. The photo is never touched. Set in Instrument Sans and IBM Plex Mono.</p>
</footer>
</div>`;
  }

  /* ───────── mount: lit sections switch the light on, scroll-speed splits, anaglyph depth, nav, clocks ───────── */
  function mount(root, H) {
    const offs = [], $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
    const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const rm = () => H.reduceMotion();

    // the canvas only renders while a lit section (hero, Map) is on screen: off-screen it is display:none,
    // which stops the core's loop; in performance mode each entry repaints the one still frame
    const gl = $("#pr-gl"), lit = new Set();
    const litIO = new IntersectionObserver((en) => {
      en.forEach((e) => (e.isIntersecting ? lit.add(e.target) : lit.delete(e.target)));
      gl.classList.toggle("is-off", lit.size === 0);
      if (lit.size) requestAnimationFrame(() => H.kickShader());
    });
    $$(".pr-lit").forEach((s) => litIO.observe(s));

    // nav: transparent over the light, a white rule once the page moves
    const nav = $("#pr-nav");
    const navState = () => nav.classList.toggle("is-scrolled", scrollY > 12);
    navState();

    // chromatic aberration along the scroll: visible headings split vertically with scroll speed, then settle
    const heads = new Set();
    const hIO = new IntersectionObserver((en) => en.forEach((e) => (e.isIntersecting ? heads.add(e.target) : (heads.delete(e.target), e.target.style.removeProperty("--cay"), e.target.style.removeProperty("--cao")))));
    $$(".pr-h2 .pr-ca").forEach((h) => hIO.observe(h));
    let lastY = scrollY, lastT = performance.now(), vel = 0, craf = 0;
    const caStep = () => {
      craf = 0;
      vel *= 0.86;
      const off = Math.max(-9, Math.min(9, vel * 5));
      const op = Math.min(1, Math.abs(off) / 3);
      heads.forEach((h) => { h.style.setProperty("--cay", off.toFixed(2) + "px"); h.style.setProperty("--cao", op.toFixed(3)); });
      if (Math.abs(off) > 0.05) craf = requestAnimationFrame(caStep);
      else heads.forEach((h) => { h.style.removeProperty("--cay"); h.style.removeProperty("--cao"); });
    };
    on(window, "scroll", () => {
      navState();
      const now = performance.now(), dt = Math.max(8, now - lastT), dy = scrollY - lastY;
      lastY = scrollY; lastT = now;
      if (rm()) return;
      // px per ms, smoothed; the split follows the direction of travel
      vel = vel * 0.6 + (dy / dt) * 0.4;
      if (!craf) craf = requestAnimationFrame(caStep);
    }, { passive: true });

    // anaglyph depth: the red and cyan plates part with the pointer, like leaning toward a 3D print
    const ana = $(".pr-ana"), play = $("#play");
    let araf = 0, ap = [0.5, 0.5];
    const anaStep = () => { araf = 0; ana.style.setProperty("--ax", ((ap[0] - 0.5) * 18).toFixed(2) + "px"); ana.style.setProperty("--ay", ((ap[1] - 0.5) * 6).toFixed(2) + "px"); };
    if (H.fine.matches && ana) {
      on(play, "pointermove", (e) => { if (rm()) return; const r = play.getBoundingClientRect(); ap = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; if (!araf) araf = requestAnimationFrame(anaStep); }, { passive: true });
      on(play, "pointerleave", () => { ap = [0.5, 0.5]; if (!araf) araf = requestAnimationFrame(anaStep); });
    }

    // live clocks
    const tick = () => $$("[data-clock]").forEach((c) => (c.textContent = H.clock(c.dataset.clock)));
    const clockT = setInterval(tick, 20000);

    return () => { offs.forEach((f) => f()); litIO.disconnect(); hIO.disconnect(); clearInterval(clockT); cancelAnimationFrame(craf); cancelAnimationFrame(araf); };
  }

  V6.theme({
    id: "prism", name: "Prism", mood: "light, split", dark: false,
    keywords: ["prism", "light", "spectrum", "rainbow", "glass", "optics", "optical", "refraction", "crystal", "caustics", "white", "clean", "ethereal"],
    fonts: "family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700&family=IBM+Plex+Mono:wght@400;500",
    swatch: ["#F4F5F8", "#0B0B0F", "#FF3B5C", "#00B4FF"],
    cardFont: '"Instrument Sans", system-ui, sans-serif',
    colors: ["#FFFFFF", "#0B0B0F", "#E8EBF1", "#5B3CFF"],
    shaderScale: 0.6,
    shaderHost: "#pr-gl",
    shader: SHADER,
    render,
    mount,
  });
})();
