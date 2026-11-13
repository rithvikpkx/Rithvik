/* Mercury: a graphite studio with one heavy pool of liquid chrome in it. Bodoni Moda for display,
   Hanken Grotesk for reading, Geist Mono for small labels. Calm and solid everywhere except two places.

   Where the effects live, and why:
   - Hero (#top), full intensity: the shader renders 2D metaballs as a height field with analytic normals,
     reflecting a procedural studio (horizon sweep, soft boxes). The droplets drift slowly, the pointer pushes
     a dent and a ripple into the surface and nudges the droplets away. This is the first impression, so it is
     the only place the metal moves on its own. u_scroll calms the flow and lifts the pool aside as you leave.
   - Contact (#contact), interactive: the same shader switches to a side-on ferrofluid pool along the bottom
     of the screen whose spikes rise toward the pointer, under the chrome ouroboros (custom asset). It is the
     last screen, a small reward for reaching the end.
   - Between them the shader is switched off entirely (its host is display:none while neither section is on
     screen, so the core pauses it). Reading sections are solid graphite with no effects behind text.
   - Section dividers are a chrome meniscus that ripples once as it enters (transform only), and again on hover.
   - Small hover reveals: chrome sheen on project titles, wobbling chrome spheres on the Play shelf.
   Performance mode (html.lite): the shader is a still frame, dividers stay flat, the mark stops floating,
   the ribbon stops drifting, blend modes give way to masks. No backdrop-filter anywhere. */
(function () {
  "use strict";

  const SHADER = `
#define PI 3.14159265
float box2(vec2 q, vec2 h, float s){ vec2 d = abs(q) - h; return smoothstep(s, 0., max(d.x, d.y)); }
float wrapA(float a){ return mod(a + PI, 2. * PI) - PI; }
// the studio the metal reflects: dark room, warm floor bounce, a bright horizon sweep, a cool key softbox,
// a warm strip light, an overhead panel and a fill behind the camera (which the centre of a droplet sees)
vec3 env(vec3 r, float spin){
  float ph = atan(r.x, -r.z) + spin; float y = clamp(r.y, -1., 1.);
  vec3 c = mix(u_c0 * 1.2, mix(vec3(.2, .195, .19), vec3(.07, .068, .066), smoothstep(-.25, -.9, y)), smoothstep(.04, -.2, y));
  float fr = cos(ph * .5); fr *= fr;
  c += mix(u_c1, u_c2, .5) * .95 * exp(-y * y * 260.) * (.35 + .65 * fr);
  c += u_c1 * 1.75 * box2(vec2(wrapA(ph + 1.05), y - .32), vec2(.42, .2), .035);
  c += u_c2 * 1.2 * box2(vec2(wrapA(ph - 1.3), y - .08), vec2(.07, .5), .05);
  c += u_c1 * .85 * smoothstep(.8, .85, y);
  c += u_c1 * .9 * box2(vec2(wrapA(ph - 2.65), y - .32), vec2(.36, .14), .05);
  // the lit room behind the camera, which the face of a droplet mirrors back as soft grey
  c += vec3(.16, .165, .18) * smoothstep(-.2, .9, r.z) * smoothstep(-.7, .2, y);
  return c;
}
// hero: metaballs as a height field, normals from the analytic field gradient
vec3 hero(vec2 p, vec2 m, float t, float asp, float tall, float sc, float px){
  float calm = smoothstep(0., .09, sc);
  vec2 c0 = vec2(mix(asp * .25, 0., tall) + sc * 1.6 * (1. - tall), mix(-.01, .3, tall) + sc * 2.2);
  float R = mix(.165, .092, tall);
  // silky flow: a slow, shallow domain warp
  vec2 w = vec2(snoise(p * 1.4 + vec2(0., t * .05)), snoise(p * 1.4 + vec2(5.2, -t * .045)));
  vec2 q = p + w * R * .09 * (1. - calm * .7);
  float F = 0.; vec2 G = vec2(0.);
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float a = t * (.1 + fi * .021) + fi * 1.7;
    float orb = fi < .5 ? 0. : (1.2 + .45 * sin(t * .09 + fi * 2.1)) * R * mix(1., .78, tall) * (1. - calm * .75);
    vec2 c = c0 + (fi < .5 ? vec2(sin(t * .11), cos(t * .08)) * R * .12 : vec2(cos(a), sin(a * 1.3 + fi)) * orb * vec2(1., .82));
    vec2 dm = c - m; float dd = dot(dm, dm);
    c += dm / sqrt(dd + 1e-4) * R * .3 * exp(-dd / (R * R * 1.3)); // the pointer nudges droplets away
    float r = R * (fi < .5 ? 1. : .44 + .1 * sin(fi * 3.1));
    vec2 d = q - c; float d2 = dot(d, d) + 1e-5;
    float k = r * r / d2; F += k; G -= 2. * k / d2 * d;
  }
  float g = F - 1.;
  float K = 1.15, A = R * .95;
  float e = exp(-max(g, 0.) * K), s = sqrt(max(1. - e, 1e-4));
  vec2 dH = A * K * e / (2. * s) * G;
  // the pointer pushes a dent and a ring of ripples into the surface
  vec2 dq = q - m; float r2 = dot(dq, dq), rr = sqrt(r2 + 1e-6), rd = R * .5;
  float D = exp(-r2 / (rd * rd)) * (1. - calm);
  dH += A * .4 * D * 2. * dq / (rd * rd);
  float env2 = exp(-rr / (R * .7)) * (1. - calm);
  dH += A * .022 * 60. * cos(rr * 60. - t * 2.2) * env2 * dq / rr;
  vec3 n = normalize(vec3(-dH, 1.));
  float cov = clamp(g / (length(G) * px * 1.3) + .5, 0., 1.);
  vec3 v = normalize(vec3((p - c0) * .18, -1.));
  vec3 r = reflect(v, n);
  float spin = t * .035 + m.x * .35;
  float f = pow(1. - n.z, 4.);
  vec3 metal = env(r, spin) * mix(vec3(.8, .82, .86), vec3(1.), f);
  metal += (.5 + .5 * cos(6.2832 * (vec3(0., .33, .67) + (1. - n.z) * 1.4 + t * .015))) * u_c3 * pow(1. - n.z, 7.) * .12;
  // the studio behind the pool: a soft sweep of light, a contact shadow at the rim
  vec2 dc = (p - c0) / vec2(1., .8);
  vec3 bg = u_c0 + vec3(.04, .041, .047) * exp(-dot(dc, dc) * 3.2) * (1. - calm * .5);
  bg *= 1. - .5 * exp(min(g, 0.) * 7.) * (1. - cov);
  return mix(bg, metal, cov);
}
// contact: a side-on ferrofluid pool along the bottom; spikes (solids of revolution) rise toward the pointer
vec3 ferro(vec2 p, vec2 m, float t, float asp, float tall, float px){
  float yb = -.5 + mix(.19, .25, tall);
  float prox = smoothstep(.85, .05, m.y - yb) * step(-.5, m.y);
  float gx = exp(-pow((p.x - m.x) / .22, 2.));
  float base = yb + .05 * gx * prox;
  float sp = mix(.05, .046, tall);
  float ci = floor(p.x / sp), xc = (ci + .5) * sp;
  float gxc = exp(-pow((xc - m.x) / .2, 2.));
  float A = .013 + .006 * sin(t * 1.1 + ci * 1.7) + mix(.13, .085, tall) * gxc * prox;
  float hy = p.y - base, hn = clamp(hy / A, 0., 1.);
  float lean = clamp((m.x - xc) * .1, -.01, .01) * hn * prox;
  float dx = p.x - xc - lean, hw = sp * .5, P = 2.4;
  float rho = hw * (1. - pow(hn, 1. / P));
  float sCov = clamp((rho - abs(dx)) / (px * 1.3) + .5, 0., 1.) * step(0., hy) * step(hn, .999);
  float pCov = clamp(-hy / (px * 1.3) + .5, 0., 1.);
  float k = A * P * pow(max(hn, 1e-3), (P - 1.) / P) / hw;
  float u = clamp(dx / max(rho, 1e-4), -.9, .9);
  vec3 nS = normalize(vec3(u * k, 1., sqrt(max(0., 1. - u * u)) * k));
  float ang = clamp(-hy / .12, 0., 1.) * PI * .42;
  vec3 nP = normalize(vec3(.14 * snoise(vec2(p.x * 3.5, p.y * 5. + t * .08)), cos(ang), sin(ang) + .05));
  vec3 n = sCov > pCov ? nS : nP;
  float cov = max(sCov, pCov);
  vec3 v = normalize(vec3(p.x * .12, -.22, -1.));
  vec3 r = reflect(v, n);
  float f = pow(1. - abs(n.z), 3.);
  vec3 metal = env(r, t * .02 + m.x * .3) * mix(vec3(.34, .35, .38), vec3(1.), f);
  vec3 bg = u_c0 + vec3(.05, .052, .06) * exp(-max(p.y - yb, 0.) * 4.5) * (.55 + .45 * gx * prox + .25);
  return mix(bg, metal, cov);
}
void main(){
  float asp = u_res.x / u_res.y;
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  float tall = 1. - smoothstep(.75, 1.2, asp);
  float px = 1. / u_res.y;
  vec3 c = u_scroll < .5 ? hero(p, m, u_time, asp, tall, u_scroll, px) : ferro(p, m, u_time, asp, tall, px);
  // dither so the capped resolution reads as fine grain, never as banding
  c += (hash21(gl_FragCoord.xy + fract(u_time * 7.) * 91.) - .5) * (2.2 / 255.);
  gl_FragColor = vec4(c, 1.);
}`;

  /* A chrome meniscus: convex ends (mercury's meniscus bulges) and a wave that rings once on entry. */
  const WAVE = (() => {
    let d = "";
    for (let x = 70; x <= 1130; x += 5) { const e = Math.exp(-(((x - 600) / 250) ** 2)), y = 20 - 10 * Math.cos((x - 600) / 34) * e; d += (x === 70 ? "M" : "L") + x + " " + y.toFixed(2); }
    return d;
  })();
  const divider = () => `<div class="mc-div" aria-hidden="true"><svg viewBox="0 0 1200 40" preserveAspectRatio="none" focusable="false"><path class="mc-men" d="M0 36 C10 26 32 20 70 20 H260"/><path class="mc-men" d="M940 20 H1130 C1168 20 1190 26 1200 36"/><path class="mc-wave" d="${WAVE}"/></svg></div>`;

  function render(C, H) {
    const { esc, icon, logo, portrait, mark } = H;
    const pad = (i) => String(i + 1).padStart(2, "0");
    const placeLabel = { home: "Home", school: "School", now: "Now" };
    return `<div class="mc">
<svg class="mc-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs><linearGradient id="mc-steel" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1200" y2="0"><stop offset="0" stop-color="#4d5058"/><stop offset=".3" stop-color="#b9bcc4"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".7" stop-color="#b9bcc4"/><stop offset="1" stop-color="#4d5058"/></linearGradient></defs></svg>
<div class="mc-gl" id="mc-gl" aria-hidden="true"></div>

<header class="mc-nav" aria-label="Site">
  <a class="mc-logo" href="#top" aria-label="Rithvik Praveen Kumar, back to top">${mark()}<span>${esc(C.name)}</span></a>
  <nav class="mc-links" aria-label="Sections"><a href="#work">Work</a><a href="#experience">Experience</a><a href="#graph">Alloy</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
  <a class="mc-pill" href="#" data-resume>Resume</a>
</header>

<section class="mc-hero" id="top" aria-labelledby="mc-h1">
  <div class="mc-hero-in">
    <p class="mc-eyebrow">${esc(C.role)}</p>
    <h1 class="mc-h1" id="mc-h1"><span class="mc-chrome-t">${esc(C.first)}</span> <em>${esc(C.last)}</em></h1>
    <p class="mc-lede">${esc(C.line)}</p>
    <p class="mc-status"><i class="mc-dot" aria-hidden="true"></i>${esc(C.status)}</p>
    <div class="mc-acts">
      <a class="mc-btn mc-solid" href="#" data-resume>Resume${icon("arrow-up-right")}</a>
      <button type="button" class="mc-btn" data-compose="Internship opportunity">${icon("mail")}Email me</button>
      <button type="button" class="mc-btn mc-ghost" data-agent><span class="mc-prompt" aria-hidden="true">❯</span>Ask my agent</button>
    </div>
  </div>
  <p class="mc-hint" aria-hidden="true"><span></span>Touch the surface</p>
</section>

<section class="mc-sec mc-about" id="about" aria-labelledby="mc-h-about">
  ${divider()}
  <div class="mc-about-grid">
    <div class="mc-pt"><i class="mc-bezel" aria-hidden="true"></i>${portrait({ id: "mercury" })}</div>
    <div class="mc-about-txt">
      <p class="mc-kicker">About</p>
      <h2 class="mc-h2" id="mc-h-about">Hi, I'm ${esc(C.first)}.</h2>
      ${C.about.map((a) => `<p class="mc-p">${esc(a)}</p>`).join("")}
      <ul class="mc-thesis">${C.thesis.map((t) => `<li><span class="mc-bul" aria-hidden="true">${mark()}</span>${esc(t)}</li>`).join("")}</ul>
    </div>
  </div>
  <dl class="mc-nums">${C.numbers.map(([n, l]) => `<div><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join("")}</dl>
  <div class="mc-now" id="now">
    <div class="mc-now-a">
      <p class="mc-kicker">Now</p>
      <ul class="mc-now-list">
        <li><span>Building</span><b>${esc(C.now.building)}</b></li>
        <li><span>Researching</span><b>${esc(C.now.researching)}</b></li>
        <li><span>Learning</span><b>${esc(C.now.learning)}</b></li>
      </ul>
    </div>
    <ol class="mc-places" aria-label="Places">${C.places.map((pl) => `<li class="${pl.key === "now" ? "is-now" : ""}"><span class="mc-pk">${placeLabel[pl.key] || esc(pl.key)}</span><b>${esc(pl.city)}</b><span class="mc-pt-clock" data-clock="${esc(pl.tz)}">${esc(H.clock(pl.tz))}</span></li>`).join("")}</ol>
  </div>
</section>

<section class="mc-sec" id="work" aria-labelledby="mc-h-work">
  ${divider()}
  <header class="mc-head"><p class="mc-kicker">Work</p><h2 class="mc-h2" id="mc-h-work">Six things I've built.</h2><p class="mc-sub">From headsets to the cloud. Each one opens.</p></header>
  <ol class="mc-work">${C.projects.map((p, i) => `<li><button type="button" class="mc-row" data-case="${p.slug}" aria-label="${esc(p.title)}: ${esc(p.headline)}. Open the case">
    <span class="mc-n">${pad(i)}</span><span class="mc-t">${esc(p.title)}</span><span class="mc-k">${icon(p.icon)}${esc(p.kind)}</span><span class="mc-hl">${esc(p.headline)}</span><span class="mc-go">${icon("arrow-up-right")}</span></button></li>`).join("")}</ol>
</section>

<section class="mc-sec" id="experience" aria-labelledby="mc-h-exp">
  ${divider()}
  <header class="mc-head"><p class="mc-kicker">Experience</p><h2 class="mc-h2" id="mc-h-exp">Where I've worked.</h2></header>
  <ol class="mc-roles">${C.experience.map((x) => `<li class="mc-role" id="experience-${x.slug}">
    <p class="mc-when">${esc(x.when)}<span>${esc(x.where)}</span></p>
    <div class="mc-role-b"><h3>${esc(x.role)}</h3><p class="mc-org">${esc(x.org)}</p>
      <ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      <p class="mc-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p></div>
  </li>`).join("")}</ol>
  <div class="mc-edu" id="education">
    <img src="${esc(C.education.logo)}" alt="Purdue University" width="56" height="56" loading="lazy" decoding="async">
    <div><p class="mc-kicker">Education</p><h3>${esc(C.education.school)}</h3><p>${esc(C.education.degree)}</p><p class="mc-edu-m">${esc(C.education.focus)} · ${esc(C.education.grad)}</p></div>
  </div>
</section>

<section class="mc-sec" id="graph" aria-labelledby="mc-h-graph">
  ${divider()}
  <header class="mc-head"><p class="mc-kicker">Map</p><h2 class="mc-h2" id="mc-h-graph">Alloy.</h2><p class="mc-sub">Everything on record, melted into one map. Hover to trace a thread, click to open it.</p></header>
  <div class="mc-kg">${H.graph({ id: "mercury" })}</div>
</section>

<section class="mc-sec mc-play" id="play" aria-labelledby="mc-h-play">
  ${divider()}
  <figure class="mc-ribbon" aria-hidden="true"><img src="assets/mercury/chrome-ribbon-1200.webp" srcset="assets/mercury/chrome-ribbon-1200.webp 1200w, assets/mercury/chrome-ribbon-2400.webp 2400w" sizes="(max-width: 700px) 160vw, 100vw" width="2400" height="1340" alt="" loading="lazy" decoding="async" onerror="this.parentNode.hidden=true"></figure>
  <header class="mc-head mc-c"><p class="mc-kicker">Play</p><h2 class="mc-h2" id="mc-h-play">Six small toys.</h2><p class="mc-sub">Scratch a record, draw something, or try to beat my scores.</p></header>
  <ul class="mc-toys">${H.PLAY.map((t, i) => `<li><button type="button" class="mc-toy" data-play="${t.id}" aria-label="Play ${esc(t.name)}: ${esc(t.desc)}" style="--tilt:${[-14, 9, -6, 16, -10, 5][i % 6]}deg">
    <span class="mc-sphere" aria-hidden="true"><i></i></span><span class="mc-toy-n">${icon(t.icon)}${esc(t.name)}</span><span class="mc-toy-d">${esc(t.desc)}</span></button></li>`).join("")}</ul>
</section>

<section class="mc-sec" id="faq" aria-labelledby="mc-h-faq">
  ${divider()}
  <div class="mc-faq">
    <div class="mc-faq-l">
      <p class="mc-kicker">Questions</p>
      <h2 class="mc-h2" id="mc-h-faq">Short answers.</h2>
      <p class="mc-sub">Anything else, ask my agent. It answers only from what's on record.</p>
      <form class="mc-ask" id="mc-ask" autocomplete="off">
        <label for="mc-ask-in" class="sr-only">Ask the agent</label>
        <span class="mc-prompt" aria-hidden="true">❯</span>
        <input id="mc-ask-in" type="text" maxlength="500" placeholder="What stack did BoilerFrame use?">
        <button type="submit" aria-label="Ask">${icon("arrow-up")}</button>
      </form>
    </div>
    <div class="mc-qs">${C.faq.map(([q, a]) => `<details class="mc-q"><summary>${esc(q)}<span class="mc-plus" aria-hidden="true"></span></summary><p>${esc(a)}</p></details>`).join("")}</div>
  </div>
</section>

<section class="mc-contact" id="contact" aria-labelledby="mc-h-contact">
  <div class="mc-contact-in">
    <div class="mc-contact-txt">
      <p class="mc-kicker">Contact</p>
      <h2 class="mc-big" id="mc-h-contact"><span class="mc-chrome-t">Write</span> <em>to me.</em></h2>
      <p class="mc-sub">Open to SWE and AI internships. It goes straight to my inbox.</p>
      <div class="mc-acts">
        <button type="button" class="mc-btn mc-solid" data-compose="Internship opportunity">${icon("mail")}Write an email</button>
        <button type="button" class="mc-btn" data-copy="${esc(C.links.email)}">${icon("copy")}${esc(C.links.email)}</button>
      </div>
      <ul class="mc-out">
        <li><a href="${esc(C.links.github)}" target="_blank" rel="noopener">${logo("github")}GitHub</a></li>
        <li><a href="${esc(C.links.linkedin)}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a></li>
        <li><a href="#" data-resume>${icon("file-text")}Resume</a></li>
      </ul>
      <p class="mc-colo">The metal is one fragment shader; bring the pointer down and it reaches for you. The photo is never touched. Set in Bodoni Moda and Hanken Grotesk.</p>
    </div>
    <figure class="mc-mark-art" aria-hidden="true"><img src="assets/mercury/chrome-mark-800.webp" srcset="assets/mercury/chrome-mark-800.webp 800w, assets/mercury/chrome-mark-1600.webp 1600w" sizes="(max-width: 700px) 44vw, 34vw" width="800" height="800" alt="" loading="lazy" decoding="async" onerror="this.parentNode.hidden=true"></figure>
  </div>
</section>
</div>`;
  }

  /* mount: shader only while hero or contact is on screen, meniscus ripples, clocks, the ribbon drift, the ask box */
  function mount(root, H) {
    const offs = [], $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
    const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const rm = () => H.reduceMotion();
    const host = $("#mc-gl"), nav = $(".mc-nav");

    // the fixed shader host is hidden while only solid reading sections are on screen; the core then pauses the loop
    const seen = new Set();
    const gio = new IntersectionObserver((en) => {
      en.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
      host.style.display = seen.size ? "" : "none";
      nav.classList.toggle("mc-solidnav", !seen.has("top"));
      $(".mc-contact").classList.toggle("mc-live", seen.has("contact"));
    }, { threshold: 0 });
    ["#top", "#contact"].forEach((s) => gio.observe($(s)));

    // a meniscus rings once as it enters, and again when the pointer touches it
    const ring = (svg) => {
      const w = svg.querySelector(".mc-wave"); if (!w || rm() || w.dataset.on) return;
      w.dataset.on = "1";
      const a = w.animate([
        { transform: "translateX(0) scaleY(0)" }, { transform: "translateX(-14px) scaleY(1)", offset: 0.1 },
        { transform: "translateX(10px) scaleY(-.62)", offset: 0.3 }, { transform: "translateX(-6px) scaleY(.36)", offset: 0.5 },
        { transform: "translateX(3px) scaleY(-.18)", offset: 0.7 }, { transform: "translateX(0) scaleY(.06)", offset: 0.86 }, { transform: "translateX(0) scaleY(0)" },
      ], { duration: 2000, easing: "cubic-bezier(.37,0,.63,1)" });
      a.onfinish = a.oncancel = () => { delete w.dataset.on; };
    };
    const dio = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) ring(e.target); }), { rootMargin: "0px 0px -18% 0px" });
    $$(".mc-div svg").forEach((s) => { dio.observe(s); if (H.fine.matches) on(s.parentNode, "pointerenter", () => ring(s)); });

    // live clocks
    const tick = () => $$("[data-clock]").forEach((c) => (c.textContent = H.clock(c.dataset.clock)));
    const clockT = setInterval(tick, 15000);

    // the ribbon drifts sideways with scroll while the Play section is on screen
    const play = $(".mc-play"), rib = $(".mc-ribbon img"); let pin = false, sraf = 0;
    const pio = new IntersectionObserver((en) => { pin = en[0].isIntersecting; }, { rootMargin: "80px" });
    if (play) pio.observe(play);
    const drift = () => { sraf = 0; if (!rib) return; const r = play.getBoundingClientRect(), k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; rib.style.transform = `translate3d(${(k * -5).toFixed(2)}%, 0, 0)`; };
    on(window, "scroll", () => { if (pin && !rm() && !sraf) sraf = requestAnimationFrame(drift); }, { passive: true });

    // the ask box hands the question to the agent
    on($("#mc-ask"), "submit", (e) => { e.preventDefault(); const inp = $("#mc-ask-in"), q = inp.value.trim(); H.openAgent(q || undefined); inp.value = ""; });
    // one answer open at a time
    const qs = $$(".mc-q");
    qs.forEach((d) => on(d, "toggle", () => { if (d.open) qs.forEach((o) => { if (o !== d) o.open = false; }); }));

    return () => { offs.forEach((f) => f()); gio.disconnect(); dio.disconnect(); pio.disconnect(); clearInterval(clockT); cancelAnimationFrame(sraf); host.style.display = ""; };
  }

  V6.theme({
    id: "mercury", name: "Mercury", mood: "liquid chrome, slow and heavy", dark: true,
    keywords: ["mercury", "chrome", "metal", "liquid", "quicksilver", "silver", "ferrofluid", "luxury", "dark", "mirror", "reflective"],
    fonts: "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800&family=Hanken+Grotesk:wght@300..700",
    swatch: ["#0A0A0B", "#EDEDEF", "#B9BCC4", "#B9C8FF"],
    cardFont: '"Bodoni Moda", Didot, Georgia, serif',
    colors: ["#0A0A0B", "#E8EEFF", "#FFE6D2", "#B9C8FF"],
    shaderScale: 0.75,
    shaderHost: "#mc-gl",
    shader: SHADER,
    render,
    mount,
  });
})();
