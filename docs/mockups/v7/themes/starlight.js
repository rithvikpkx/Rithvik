/* starlight: the whole site seen through a Gen III image-intensifier tube at night. Green phosphor light
   out of darkness (or white phosphor, one switch in the HUD), a quiet HUD around the edges, generous dark
   between a few crisp things. The portrait is the one colour object: a separate clear display in the HUD.
   Where each effect lives, and why:
   - Night scene (shader): starfield, airglow, a far ridge and a conifer treeline. Full strength on the first
     screen only; scrolling tilts the view down to a dark field whose contour lines sit at a few percent, so
     reading text has near-black behind it. At the very end the view tilts back up for the contact screen.
   - Scintillation + grain (shader): the fine sparkle of a real tube, everywhere but tiny. It is also the
     dither that turns the half-resolution canvas into texture.
   - Tube vignette + honeycomb fibre bundle (shader): edges only, never under the content column.
   - IR illuminator: a soft cone at the pointer in the shader lights the trees and the field. In the DOM it
     reveals small annotations (waypoints over the treeline, each project's hardware line) and the graph's
     faint edges. A thin beam ring follows the cone on the first screen only.
   - Halation: text-shadow bloom on the headline, section titles and the hot CTA; body copy has none.
   - Auto-gain flare: the view blooms and recovers when something bright appears (tube power-on, the case
     sheet or a window opening, a primary CTA under the pointer); the HUD gain readout dips with it.
   - Performance mode (html.lite): the core freezes the shader to one still frame with static grain; here the
     flare, ring, IR smoothing loop, gain jitter and every animation stop, the annotations are shown plainly
     and halation shrinks to a single sharp glow. */
(function () {
  "use strict";

  /* ───────── Shader: night scene through the tube ───────── */
  // keep HY in sync with hyOf() below: the horizon height (0..1 of the view) for a page scroll s
  const SHADER = `
#define HY(s) min(.2 + 7. * (s), .34 + 7. * (1. - (s)))
// a well-mixed per-pixel hash (the shared one leaves a lattice at screen-size inputs)
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hexd(vec2 p){
  const vec2 s = vec2(1., 1.7320508);
  vec2 a = mod(p, s) - s * .5, b = mod(p - s * .5, s) - s * .5;
  vec2 g = abs(dot(a, a) < dot(b, b) ? a : b);
  return max(dot(g, vec2(.5, .8660254)), g.x);
}
float star(vec2 q, float cell, float prob, float px){
  vec2 c = q * cell, id = floor(c), f = fract(c) - .5;
  if (h12(id + 71.3) < 1. - prob) return 0.;
  vec2 o = vec2(h12(id + 7.13), h12(id + 3.31)) - .5;
  vec2 d = f - o * .6;
  float b = h12(id + 11.7); b = b * b * b * b;
  float r = px * cell, d2 = dot(d, d) / (r * r);
  // a sharp core plus a wide faint halo on the bright ones: halation in the tube
  return exp(-d2 * 1.1) * (.16 + 1.25 * b) + exp(-d2 * .035) * .2 * b * b;
}
float conifers(float x, float k, float seed){
  float c = floor(x * k), f = fract(x * k);
  float h = h12(vec2(c, seed));
  float w = .3 + .45 * h12(vec2(c, seed + 4.));
  float tri = max(0., 1. - abs(f - .5) * 2. / w);
  return step(.12, h) * tri * (.016 + .05 * h);
}
float fbm3(vec2 p){ return .55 * snoise(p) + .28 * snoise(p * 2.03 + 7.1) + .14 * snoise(p * 4.07 + 3.3); }
// the field: a receding plane (horizon at hg), scrolled forward by s
vec2 ground(vec2 uv, float asp, float hg, float s){
  float depth = .1 / max(hg - uv.y, .004);
  return vec2((uv.x - .5) * asp * depth * 2.2, depth * 1.4 + s * 7.);
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  float px = 1. / u_res.y;
  float s = u_scroll, t = u_time;
  float hy = HY(s);
  vec2 p = vec2((uv.x - .5) * asp, uv.y);
  vec2 m = vec2((u_mouse.x - .5) * asp, u_mouse.y);
  vec2 dm = p - m;
  float cone = exp(-dot(dm, dm) / .042);
  float L = 0.;
  float x = p.x;
  float ridge = hy + .02 * snoise(vec2(x * 1.1, 4.2)) + .01 * snoise(vec2(x * 3.4, 9.1));
  float top = ridge + max(conifers(x, 38., 1.), conifers(x + .011, 61., 7.) * .7);
  float skyM = smoothstep(top - px, top + px, uv.y);
  if (uv.y > hy - .02) {
    // sky: airglow toward the horizon, sparse stars, a faint milky way, a hazy far ridge
    vec2 q = vec2(x + t * .0015, uv.y - hy);
    float up = max(0., uv.y - hy);
    float sky = .03 + .2 * exp(-up * 7.) + .05 * exp(-up * 2.);
    float band = exp(-pow((q.y - .55 - q.x * .3) * 3.2, 2.));
    float mw = band > .03 ? fbm(q * 2.4 + 5.) : 0.;
    sky += band * (.02 + .045 * max(mw + .2, 0.));
    sky += star(q, 26., .2, px) + star(q + 3.7, 64., .1 + band * .25, px) * .45;
    float far = hy + .055 + .018 * snoise(vec2(x * .8 + 3., 2.)) + .006 * snoise(vec2(x * 5., 1.));
    sky = mix(sky, .1 + .018 * vnoise(p * 60.), smoothstep(far + px, far - px, uv.y) * .75);
    sky += cone * .015;
    // trees: black against the glow; the IR cone picks out the foliage
    float tree = .006 + cone * (.05 + .08 * vnoise(p * vec2(170., 95.)));
    L = mix(tree, sky, skyM);
  }
  if (uv.y < top + px) {
    // the field: faint 1px contour lines (width from the local gradient, so they stay crisp at any distance);
    // the IR cone lights the near ground and brings the lines up
    float hg = min(hy, 1.3);
    vec2 g0 = ground(uv, asp, hg, s);
    float h = fbm3(g0 * .5);
    float hx = fbm3(ground(uv + vec2(px / asp, 0.), asp, hg, s) * .5);
    float hv = fbm3(ground(uv + vec2(0., px), asp, hg, s) * .5);
    float N = 7., gr = N * length(vec2(hx - h, hv - h)) + 1e-4;
    float dl = abs(fract(h * N + .5) - .5) / gr;
    float line = (1. - smoothstep(.45, 1.3, dl)) * (1. - smoothstep(.12, .4, gr));
    float field = .012 + .006 * (h + .5) + line * (.03 + .2 * cone) + cone * .04;
    L = uv.y > hy - .02 ? mix(field, L, skyM) : field;
  }
  // shot noise and scintillation: frame-to-frame sparkle (a single still frame in performance mode)
  float fr = floor(t * 24.);
  L += (h12(fc + fr * 17.31) - .5) * (.032 + .06 * L);
  L += step(.99965, h12(fc * 1.37 + fr * 41.7)) * .45;
  // the tube: brighter centre, honeycomb fibre bundle at the rim, circular vignette
  vec2 vc = (uv - .5) * vec2(asp, 1.);
  float rr = length(vc) / (.5 * sqrt(asp * asp + 1.));
  L *= mix(.7, 1.06, 1. - smoothstep(0., .95, rr));
  float hc = smoothstep(.32, .5, hexd(fc / (u_res.y / 140.)));
  L += hc * .03 * smoothstep(.45, .8, rr) * (1. - smoothstep(.8, 1., rr));
  L *= 1. - hc * .6 * smoothstep(.5, .92, rr);
  L *= 1. - smoothstep(.66, 1.03, rr);
  L = max(L, 0.);
  vec3 c = mix(u_c0, u_c1, smoothstep(0., .3, L));
  c = mix(c, u_c2, smoothstep(.26, .85, L));
  c = mix(c, u_c3, smoothstep(.85, 1.4, L));
  gl_FragColor = vec4(c, 1.);
}`;
  const hyOf = (s) => Math.min(0.2 + 7 * s, 0.34 + 7 * (1 - s));

  const pad = (i) => String(i + 1).padStart(2, "0");
  const deg = (v, pos, neg) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  const PLACE = { home: "Home", school: "School", now: "Now" };
  const ABBR = { home: "BOS", school: "LAF", now: "SFO" };

  /* ───────── render: the whole site ───────── */
  function render(C, H) {
    const { esc, icon, logo, portrait, mark } = H;

    const target = (p, i) => `<li>
      <button type="button" class="sl-tg" data-case="${esc(p.slug)}" aria-label="${esc(p.title)}: ${esc(p.headline)}. Open the case">
        <span class="sl-tg-n">T-${pad(i)}</span>
        <span class="sl-tg-b">
          <span class="sl-tg-t">${esc(p.title)}</span>
          <span class="sl-tg-h">${esc(p.headline)}</span>
          <span class="sl-tg-ir sl-ir" data-ir>${icon("crosshair")}${esc(p.ctx)}</span>
        </span>
        <span class="sl-tg-k">${esc(p.kind)}</span>
        <span class="sl-tg-go" aria-hidden="true">${icon("arrow-up-right")}</span>
        <i class="sl-lock" aria-hidden="true"><i></i><i></i><i></i><i></i></i>
      </button>
    </li>`;

    const role = (x) => `<li class="sl-role" id="experience-${esc(x.slug)}">
      <p class="sl-when"><time>${esc(x.when)}</time><span>${esc(x.where)}</span></p>
      <div class="sl-role-b">
        <h3>${esc(x.role)}</h3>
        <p class="sl-org">${esc(x.org)}</p>
        <ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        <p class="sl-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>
      </div>
    </li>`;

    const toy = (t, i) => `<li><button type="button" class="sl-toy" data-play="${esc(t.id)}" aria-label="Play ${esc(t.name)}: ${esc(t.desc)}">
      <span class="sl-toy-ch">CH ${pad(i)}</span>
      <span class="sl-toy-ic">${icon(t.icon)}</span>
      <span class="sl-toy-t">${esc(t.name)}</span>
      <span class="sl-toy-d">${esc(t.desc)}</span>
    </button></li>`;

    const wp = C.places.map((pl, i) => `<span class="sl-wp sl-ir" data-ir style="left:${[13, 33, 52][i]}%">
        <b>${esc(pl.city)}</b><span>${deg(pl.lat, "N", "S")} ${deg(pl.lng, "E", "W")} · ${PLACE[pl.key] || esc(pl.key)}</span><i></i></span>`).join("");

    return `<div class="sl">
<div class="sl-flare" aria-hidden="true"></div>
<div class="sl-wps" aria-hidden="true">${wp}</div>

<header class="sl-top" aria-label="Site">
  <a class="sl-logo" href="#top" aria-label="Rithvik Praveen Kumar, back to top">${mark()}<span>RPK</span></a>
  <nav class="sl-nav" aria-label="Sections"><a href="#work">Work</a><a href="#graph">Chart</a><a href="#experience">Log</a><a href="#about">Notes</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
  <p class="sl-read" aria-hidden="true"><span>GAIN <b data-sl-gain>0.82</b></span><span class="sl-bat">BAT <i class="sl-cells" data-sl-cells data-lv="4"><i></i><i></i><i></i><i></i></i><b data-sl-bat>EXT</b></span><span><b data-sl-ts>--:--:--</b></span></p>
  <button type="button" class="sl-phos" data-sl-phos aria-pressed="false" title="Switch phosphor"><i aria-hidden="true"></i><span data-sl-phos-l>P43 Green</span></button>
  <a class="sl-btn sl-top-cv" href="#" data-resume>${icon("file-text")}<span>Resume</span></a>
</header>

<aside class="sl-coords" aria-hidden="true">${C.places.map((pl) => `<p><b>${ABBR[pl.key] || ""}</b><span>${deg(pl.lat, "N", "S")}</span><span>${deg(pl.lng, "E", "W")}</span><span data-clock="${esc(pl.tz)}">${esc(H.clock(pl.tz))}</span></p>`).join("")}</aside>
<aside class="sl-ruler" aria-hidden="true"><i class="sl-ruler-s"></i><span class="sl-ruler-m" data-sl-el>EL +09°</span></aside>
<div class="sl-ring" aria-hidden="true"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92"/><path d="M100 2v12M100 186v12M2 100h12M186 100h12"/><path class="sl-ring-arc" d="M30 54A92 92 0 0 1 54 30"/></svg><span data-sl-ring>IR · AZ 270° · EL +09°</span></div>

<section class="sl-hero" id="top" aria-labelledby="sl-h1">
  <div class="sl-hero-txt">
    <p class="sl-k"><i class="sl-dot" aria-hidden="true"></i>CH 1 · Night vision<span class="sl-k-x"> · Starlight only</span></p>
    <h1 id="sl-h1" class="sl-h1"><span>${esc(C.first)}</span><span>${esc(C.last)}</span></h1>
    <p class="sl-role-l">${esc(C.role)}</p>
    <p class="sl-lede">${esc(C.line)}</p>
    <p class="sl-status">${esc(C.status)}</p>
    <div class="sl-acts">
      <a class="sl-btn sl-hot sl-cta" href="#" data-resume>${icon("file-text")}Resume</a>
      <button type="button" class="sl-btn sl-cta" data-compose="Internship opportunity">${icon("mail")}Email me</button>
      <button type="button" class="sl-btn sl-ghost" data-agent><span class="sl-pr" aria-hidden="true">❯</span>Ask my agent</button>
    </div>
    <p class="sl-hint">Your pointer is an IR light. Sweep it across the treeline.</p>
  </div>
  <div class="sl-disp">
    <p class="sl-disp-bar" aria-hidden="true"><span><i></i>CH 2 · Colour</span><span>Visible light</span></p>
    <div class="sl-disp-in">${portrait({ id: "starlight", cls: "sl-pt" })}</div>
    <p class="sl-disp-foot" aria-hidden="true"><span>GitHub</span><span>LinkedIn</span><span>Email</span></p>
  </div>
</section>

<section class="sl-sec sl-work" id="work" aria-labelledby="sl-h-work">
  <header class="sl-sh"><p class="sl-k">02 · Sightings</p><h2 id="sl-h-work" class="sl-h2">Six things I built</h2><p class="sl-sub">From EEG headsets to the cloud. Each one opens.</p></header>
  <ol class="sl-targets">${C.projects.map(target).join("")}</ol>
</section>

<section class="sl-sec sl-chart" id="graph" aria-labelledby="sl-h-graph">
  <header class="sl-sh"><p class="sl-k">03 · Sky chart</p><h2 id="sl-h-graph" class="sl-h2">Everything, connected</h2><p class="sl-sub">Me at the centre, then fields, work, skills and places. The light traces the faint lines; any star opens.</p></header>
  ${H.graph({ id: "starlight" })}
</section>

<section class="sl-sec sl-exp" id="experience" aria-labelledby="sl-h-exp">
  <header class="sl-sh"><p class="sl-k">04 · Log</p><h2 id="sl-h-exp" class="sl-h2">Where I've worked</h2></header>
  <ol class="sl-log">${C.experience.map(role).join("")}</ol>
  <div class="sl-edu" id="education">
    <span class="sl-edu-plate"><img src="${esc(C.education.logo)}" alt="Purdue University" width="56" height="56" loading="lazy" decoding="async"></span>
    <div>
      <p class="sl-k">Education</p>
      <h3>${esc(C.education.school)}</h3>
      <p>${esc(C.education.degree)}</p>
      <p class="sl-edu-m">${esc(C.education.focus)} · ${esc(C.education.grad)}</p>
    </div>
  </div>
</section>

<section class="sl-sec sl-about" id="about" aria-labelledby="sl-h-about">
  <div class="sl-about-g">
    <header class="sl-sh"><p class="sl-k">05 · Field notes</p><h2 id="sl-h-about" class="sl-h2">Hi, I'm ${esc(C.first)}.</h2></header>
    <div class="sl-about-t">${C.about.map((a) => `<p>${esc(a)}</p>`).join("")}</div>
  </div>
  <div class="sl-now" id="now">
    <dl class="sl-now-l">
      <div><dt>Building</dt><dd>${esc(C.now.building)}</dd></div>
      <div><dt>Researching</dt><dd>${esc(C.now.researching)}</dd></div>
      <div><dt>Learning</dt><dd>${esc(C.now.learning)}</dd></div>
    </dl>
    <ol class="sl-places" aria-label="Places">${C.places.map((pl) => `<li class="${pl.key === "now" ? "is-now" : ""}"><span class="sl-pk">${PLACE[pl.key] || esc(pl.key)}</span><b>${esc(pl.city)}</b><span class="sl-pc">${deg(pl.lat, "N", "S")} · ${deg(pl.lng, "E", "W")}</span><span class="sl-pt-t" data-clock="${esc(pl.tz)}">${esc(H.clock(pl.tz))}</span></li>`).join("")}</ol>
  </div>
  <dl class="sl-nums">${C.numbers.map(([n, l]) => `<div><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join("")}</dl>
</section>

<section class="sl-sec sl-play" id="play" aria-labelledby="sl-h-play">
  <header class="sl-sh"><p class="sl-k">06 · Night games</p><h2 id="sl-h-play" class="sl-h2">Six small toys</h2><p class="sl-sub">Scratch a 1927 record, draw with a mirror, or test your eye in the dark.</p></header>
  <ul class="sl-toys">${H.PLAY.map(toy).join("")}</ul>
</section>

<section class="sl-sec sl-contact" id="contact" aria-labelledby="sl-h-contact">
  <p class="sl-k">07 · Signal</p>
  <h2 id="sl-h-contact" class="sl-h-big">Send a signal.</h2>
  <p class="sl-sub">Open to SWE and AI internships. Messages go straight to my inbox.</p>
  <div class="sl-acts">
    <button type="button" class="sl-btn sl-hot sl-cta sl-btn-lg" data-compose="Internship opportunity">${icon("mail")}Write an email</button>
    <button type="button" class="sl-btn sl-ghost" data-copy="${esc(C.links.email)}">${icon("copy")}${esc(C.links.email)}</button>
  </div>
  <ul class="sl-links">
    <li><a href="${esc(C.links.github)}" target="_blank" rel="noopener">${logo("github")}GitHub</a></li>
    <li><a href="${esc(C.links.linkedin)}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a></li>
    <li><a href="#" data-resume>${icon("file-text")}Resume</a></li>
    <li><a href="#" data-agent>${icon("terminal")}Agent</a></li>
  </ul>
  <footer class="sl-foot" id="colophon">
    <span class="sl-foot-m" aria-hidden="true">${mark()}</span>
    <p>One fragment shader: starlight, a treeline, an intensifier tube. The photo on channel two is never touched. Set in Saira and IBM Plex Mono.</p>
  </footer>
</section>
</div>`;
  }

  /* ───────── mount: HUD readouts, phosphor switch, IR reveals, beam ring, auto-gain flare ───────── */
  function mount(root, H) {
    const offs = [], timers = [], html = document.documentElement;
    const $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
    const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const still = () => H.reduceMotion();
    const fine = H.fine.matches;

    // phosphor: P43 green or white; the canvas is recoloured by a CSS colour matrix, the DOM by tokens
    const phBtn = $("[data-sl-phos]"), phL = $("[data-sl-phos-l]");
    const setPh = (w) => { html.dataset.slPh = w ? "white" : "green"; phBtn.setAttribute("aria-pressed", String(w)); phL.textContent = w ? "P45 White" : "P43 Green"; };
    setPh(H.store.get("sl-ph", "green") === "white");
    on(phBtn, "click", () => { const w = html.dataset.slPh !== "white"; setPh(w); H.store.set("sl-ph", w ? "white" : "green"); flare(innerWidth - 120, 30, 0.5); });

    // HUD: local timestamp, place clocks, battery, gain with automatic gain control
    const ts = $("[data-sl-ts]"), gainEl = $("[data-sl-gain]");
    const two = (n) => String(n).padStart(2, "0");
    const tick = () => { const d = new Date(); ts.textContent = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; };
    tick(); timers.push(setInterval(tick, 1000));
    const clocks = () => $$("[data-clock]").forEach((c) => (c.textContent = H.clock(c.dataset.clock)));
    timers.push(setInterval(clocks, 15000));
    let battery = null;
    const batUp = () => { if (!battery) return; const lv = Math.max(1, Math.ceil(battery.level * 4)); $("[data-sl-cells]").dataset.lv = lv; $("[data-sl-bat]").textContent = battery.charging ? "EXT" : Math.round(battery.level * 100) + "%"; };
    if (navigator.getBattery) navigator.getBattery().then((b) => { if (!root.isConnected) return; battery = b; batUp(); b.addEventListener("levelchange", batUp); b.addEventListener("chargingchange", batUp); }).catch(() => {});
    let dip = 0, base = 0.82;
    const gainTick = () => { if (still()) { gainEl.textContent = base.toFixed(2); return; } dip *= 0.82; gainEl.textContent = Math.max(0.2, base - dip * 0.6 + (Math.random() - 0.5) * 0.012).toFixed(2); };
    timers.push(setInterval(gainTick, 180));

    // auto-gain flare: the scene behind the content blooms, then the tube pulls the gain back down
    const flareEl = $(".sl-flare"); let lastFlare = 0;
    function flare(x, y, k) {
      if (still()) return;
      const now = performance.now(); if (k < 0.5 && now - lastFlare < 1400) return; lastFlare = now;
      flareEl.style.setProperty("--fx", Math.round(x) + "px"); flareEl.style.setProperty("--fy", Math.round(y) + "px");
      flareEl.getAnimations().forEach((a) => a.cancel());
      flareEl.animate([{ opacity: 0 }, { opacity: k, offset: 0.14 }, { opacity: k * 0.25, offset: 0.45 }, { opacity: 0 }], { duration: 1300, easing: "cubic-bezier(.2,.7,.25,1)" });
      dip = Math.max(dip, k);
    }
    $$(".sl-cta").forEach((b) => on(b, "pointerenter", (e) => { if (e.pointerType !== "mouse") return; const r = b.getBoundingClientRect(); flare(r.left + r.width / 2, r.top + r.height / 2, 0.28); }));
    // something bright appears: the case sheet or a window opens, and blooms on its own surface too
    const bright = [["#sheet", ".sheet-body"], ["#composer-win"], ["#resume-win"], ["#play-win"]].map(([s, inner]) => ({ el: document.querySelector(s), inner }));
    const mo = new MutationObserver((recs) => recs.forEach((r) => {
      const t = r.target; if (t.hidden || r.oldValue === null) return;
      const b = bright.find((x) => x.el === t); if (!b || still()) return;
      const surf = b.inner ? t.querySelector(b.inner) : t; if (!surf) return;
      surf.classList.remove("sl-bloom"); void surf.offsetWidth; surf.classList.add("sl-bloom");
      timers.push(setTimeout(() => surf.classList.remove("sl-bloom"), 1100));
      flare(innerWidth / 2, innerHeight / 2, 0.55);
    }));
    bright.forEach((b) => b.el && mo.observe(b.el, { attributes: true, attributeFilter: ["hidden"], attributeOldValue: true }));
    // the tube powers on
    timers.push(setTimeout(() => flare(innerWidth * 0.3, innerHeight * 0.45, 0.42), 220));

    // scroll: elevation ruler and the waypoints riding the horizon (same formula as the shader)
    const elM = $("[data-sl-el]"), wps = $(".sl-wps"), ruler = $(".sl-ruler");
    let sraf = 0, elev = 9;
    const scrollStep = () => {
      sraf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), s = Math.min(1, scrollY / max), hy = hyOf(s);
      elev = Math.max(-40, (0.5 - Math.min(hy, 1.8)) * 30);
      elM.textContent = `EL ${elev >= 0 ? "+" : "-"}${two(Math.round(Math.abs(elev)))}°`;
      elM.style.transform = `translateY(${((20 - elev) / 60) * (ruler.clientHeight - 18)}px)`;
      const y = (1 - (hy + 0.022)) * innerHeight;
      wps.style.transform = `translate3d(0, ${Math.round(y)}px, 0)`;
      wps.classList.toggle("is-off", y < -40 || y > innerHeight);
    };
    // in performance mode the core paints one still frame; repaint a single new still once scrolling settles,
    // so reading text still sits over the dark field rather than the first screen's sky
    let kt = 0;
    on(window, "scroll", () => { if (!sraf) sraf = requestAnimationFrame(scrollStep); if (still()) { clearTimeout(kt); kt = setTimeout(H.kickShader, 140); } }, { passive: true });
    on(window, "resize", () => { if (!sraf) sraf = requestAnimationFrame(scrollStep); });
    scrollStep();

    // IR illuminator in the DOM: reveal annotations and graph edges near the pointer; the ring tracks the cone
    const hero = $(".sl-hero"), ring = $(".sl-ring"), ringL = $("[data-sl-ring]"), graph = $(".kg");
    const ptr = { x: innerWidth / 2, y: innerHeight / 2, in: false }, fast = { x: ptr.x, y: ptr.y }, cone = { x: ptr.x, y: ptr.y };
    let iraf = 0, edges = null, ePrev = new WeakMap();
    const geo = new WeakMap();
    const quad = (el) => { let g = geo.get(el); if (!g) { const n = (el.getAttribute("d") || "").match(/-?[\d.]+/g).map(Number); g = n; geo.set(el, g); } return g; };
    const near = (r, x, y) => { const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom); return dx * dx + dy * dy; };
    let heroOn = true, graphOn = false;
    const vis = new IntersectionObserver((en) => en.forEach((e) => { if (e.target === hero) { heroOn = e.isIntersecting; hero.classList.toggle("sl-live", heroOn); } if (e.target === graph) graphOn = e.isIntersecting; }));
    vis.observe(hero); if (graph) vis.observe(graph);
    function irStep() {
      iraf = 0; if (still()) return;
      fast.x += (ptr.x - fast.x) * 0.2; fast.y += (ptr.y - fast.y) * 0.2;
      cone.x += (ptr.x - cone.x) * 0.06; cone.y += (ptr.y - cone.y) * 0.06; // the core smooths u_mouse at the same rate
      const R2 = 150 * 150;
      $$("[data-ir]").forEach((el) => {
        const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
        const v = Math.exp(-near(r, fast.x, fast.y) / R2);
        el.style.setProperty("--ir", v.toFixed(3));
      });
      if (graph && graphOn) {
        const svg = graph.querySelector(".kg-svg");
        if (!edges || !edges.length || !edges[0].isConnected) edges = Array.from(svg.querySelectorAll(".kg-edge"));
        const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = vb && vb.width ? r.width / vb.width : 1;
        const lx = (fast.x - r.left) / k, ly = (fast.y - r.top) / k, ER = (130 / k) ** 2;
        edges.forEach((p) => {
          const [x1, y1, cx, cy, x2, y2] = quad(p); let best = 1e9;
          for (let i = 0; i <= 4; i++) { const t = i / 4, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t, px = a * x1 + b * cx + c * x2, py = a * y1 + b * cy + c * y2, d = (px - lx) ** 2 + (py - ly) ** 2; if (d < best) best = d; }
          const v = Math.exp(-best / ER), pv = ePrev.get(p) || 0;
          if (Math.abs(v - pv) > 0.02 || (v < 0.02 && pv > 0)) { const q = v < 0.02 ? 0 : v; ePrev.set(p, q); p.style.setProperty("--ir", q.toFixed(2)); }
        });
      }
      if (ring) {
        const show = heroOn && ptr.in && !ptr.ui && ptr.y < hero.getBoundingClientRect().bottom;
        ring.classList.toggle("is-on", show);
        ring.style.transform = `translate3d(${cone.x.toFixed(1)}px, ${cone.y.toFixed(1)}px, 0)`;
        const az = 270 + (cone.x / innerWidth - 0.5) * 60, el = elev + (0.5 - cone.y / innerHeight) * 24;
        ringL.textContent = `IR · AZ ${Math.round(az)}° · EL ${el >= 0 ? "+" : "-"}${two(Math.round(Math.abs(el)))}°`;
      }
      if (Math.abs(ptr.x - cone.x) + Math.abs(ptr.y - cone.y) > 0.6) iraf = requestAnimationFrame(irStep);
    }
    if (fine) {
      on(window, "pointermove", (e) => { if (e.pointerType !== "mouse") return; ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true; ptr.ui = !!(e.target.closest && e.target.closest(".sl-top, .sl-disp, #switcher, #agent, .win, .sheet")); if (!iraf && !still()) iraf = requestAnimationFrame(irStep); }, { passive: true });
      on(document, "pointerleave", () => { ptr.in = false; ring && ring.classList.remove("is-on"); });
      on(window, "scroll", () => { if (ptr.in && !iraf && !still()) iraf = requestAnimationFrame(irStep); }, { passive: true });
    } else root.querySelector(".sl").classList.add("sl-touch");

    return () => {
      offs.forEach((f) => f()); timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
      mo.disconnect(); vis.disconnect(); clearTimeout(kt); cancelAnimationFrame(sraf); cancelAnimationFrame(iraf);
      if (battery) { battery.removeEventListener("levelchange", batUp); battery.removeEventListener("chargingchange", batUp); }
      document.querySelectorAll(".sl-bloom").forEach((el) => el.classList.remove("sl-bloom"));
      delete html.dataset.slPh;
    };
  }

  V6.theme({
    id: "starlight", name: "Starlight", mood: "night vision, phosphor", dark: true,
    keywords: ["starlight", "night", "vision", "nightvision", "nvg", "green", "phosphor", "stars", "dark", "military", "tactical", "infrared", "ir"],
    fonts: "family=Saira+Condensed:wght@400;500;600;700&family=Saira+Semi+Condensed:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500",
    swatch: ["#030803", "#A8FF7A", "#5FD43A", "#EAFFDC"],
    cardFont: '"Saira Condensed", "Arial Narrow", sans-serif',
    colors: ["#010401", "#1E4D16", "#93EE6C", "#F0FFE6"],
    shaderScale: 0.5,
    shader: SHADER,
    render,
    mount,
  });
})();
