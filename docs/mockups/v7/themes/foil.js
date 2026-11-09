/* foil: a holographic trading card under a desk lamp. A calm, deep ink site with crisp pearl type;
   the iridescence lives only where it delights.

   Where each effect appears, and why:
   - Thin-film shader (full strength): only on the hero card face. It is the one wild moment, so it is
     the only WebGL surface; the pointer is the light, the card tilts toward it, and a sparse glitter
     catches as the light sweeps. Everything else on the page stays still and legible.
   - Lenticular flip: one strip on the hero card. Tilting the card right flips the name to the role,
     like a lenticular sticker; left or level reads the name.
   - 3D tilt: the hero card always (it is the toy); project cards only while hovered, a few degrees.
   - Holo foil + glitter (CSS): the art window of a project card and the Play stickers, on hover only.
     The nav mark is foil-stamped and its sheen turns with the pointer.
   - Pixel-sort / datamosh: used once, as the transition when a case opens (streaks smear out of the
     clicked card, then the sheet rises over them).
   - Performance mode (html.lite): the shader is a still frame; no tilt, no intro sweep, no glare, no
     blend modes, no datamosh, static foil gradients. The lenticular flips on hover with no animation. */
(function () {
  "use strict";

  /* ───────── Shader: thin-film interference over a crinkled-foil height map, lit by the pointer ───────── */
  const SHADER = `
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2((uv.x - .5) * asp, uv.y - .5);
  float t = u_time;
  // the light: the pointer is the lamp, with a slow drift so the foil breathes when nobody touches it
  vec2 m = clamp(u_mouse - .5, -1.1, 1.1) + .05 * vec2(sin(t * .37), cos(t * .29));
  vec3 L = normalize(vec3(m * 1.9, 1.));
  vec3 Hv = normalize(L + vec3(0., 0., 1.));
  // height map: broad, soft crinkles in the foil; three fbm taps give the surface normal
  vec2 q = p * 1.05 + vec2(t * .01, -t * .007);
  float e = .05;
  float h0 = fbm(q), hx = fbm(q + vec2(e, 0.)), hy = fbm(q + vec2(0., e));
  vec3 N = normalize(vec3((h0 - hx) / e * .11, (h0 - hy) / e * .11, 1.));
  float ndl = max(dot(N, L), 0.), ndh = max(dot(N, Hv), 0.);
  // thin film: phase from film thickness (height map), a diagonal grating, and the light angle (the tilt)
  float grat = dot(p, vec2(.8, .6));
  float ph = .32 * h0 + .5 * grat + .75 * dot(m, vec2(.9, .55)) + .3 * (1. - ndh);
  // a pastel interference ramp (mint, sky, lilac, rose, champagne) rather than a loud rainbow
  vec3 film = .76 + .24 * cos(6.2831853 * (ph + vec3(.0, .33, .67)));
  vec3 silver = mix(u_c0, u_c1, .35 + .5 * ndl);
  vec3 col = mix(silver, film * (.74 + .34 * ndl), .8);
  // a broad sheen band that slides with the light, plus a tight specular
  vec2 sd = p - m * vec2(asp, 1.) * .7;
  float band = exp(-pow(dot(sd, normalize(vec2(1., .72))) * 3., 2.));
  col += band * .16 + pow(ndh, 140.) * .4;
  // embossed foil tooth (value noise at the pixel scale, not fbm)
  col *= .965 + .06 * vnoise(gl_FragCoord.xy * .5);
  // glitter: sparse cells glint as the light passes over them
  vec2 cell = floor(gl_FragCoord.xy / 2.);
  float r = hash21(cell);
  float tw = step(.986, r) * pow(max(0., sin(r * 97. + dot(m, vec2(15., 10.)) + t * .7)), 14.);
  col += tw * mix(vec3(1.), u_c2, .35) * 1.15;
  // settle toward deep ink at the rim so the frame reads as a printed card
  float vig = smoothstep(.95, .2, length(p / vec2(asp, 1.) * vec2(1.25, 1.)));
  col = mix(u_c3, col, .82 + .18 * vig);
  // grain/dither so the capped resolution reads as foil tooth, not blur
  col += (hash21(gl_FragCoord.xy + fract(t * 3.1) * 91.) - .5) * .03;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

  const FOIL = ["#8BF0D3", "#94D4FF", "#B9A8FF", "#FFB3DA", "#FFD79E"];
  const pad = (i) => String(i + 1).padStart(2, "0");

  /* ───────── render: the whole site ───────── */
  function render(C, H) {
    const { esc, icon, logo, portrait, mark } = H;
    const placeLabel = { home: "Home", school: "School", now: "Now" };

    // the foil-stamped mark: the exact mark silhouette as a CSS mask over the foil texture (an inner layer slides with the pointer)
    const mk = mark(), d = (mk.match(/<path d="([^"]+)"/) || [])[1] || "", eye = mk.match(/<circle class="mk-eye" cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/) || [0, 0, 0, 0];
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><mask id="e"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle cx="${eye[1]}" cy="${eye[2]}" r="${eye[3]}" fill="#000"/></mask><path d="${d}" fill="#000" mask="url(#e)"/></svg>`;
    const maskUrl = `url(&quot;data:image/svg+xml,${encodeURIComponent(maskSvg)}&quot;)`;
    const fm = (cls = "") => `<span class="fo-fm${cls ? " " + cls : ""}" role="img" aria-label="Rithvik Praveen Kumar"><i></i></span>`;

    const kick = (n, label) => `<p class="fo-kick"><span class="fo-kick-n">${n}</span>${esc(label)}</p>`;

    const projectCard = (p, i) => `<li class="fo-pc-li">
      <a class="fo-pc" href="#work" data-fo-case="${esc(p.slug)}" style="--h:${(i * 57) % 360}deg;--hp:${((i * 57) % 360) / 3.6}%" aria-label="${esc(p.title)}: ${esc(p.headline)}. Open the case">
        <span class="fo-pc-top"><span class="fo-pc-n">No. ${pad(i)}<i>/06</i></span><span class="fo-pc-kind">${esc(p.kind)}</span></span>
        <span class="fo-pc-art" aria-hidden="true">
          <span class="fo-pc-holo"><i></i></span>
          <span class="fo-pc-glit"><i></i></span>
          <span class="fo-pc-ic"><span class="fo-pc-ic-hi">${icon(p.icon)}</span><span class="fo-pc-ic-ink">${icon(p.icon)}</span></span>
          <img class="fo-pc-img" src="assets/projects/${esc(p.slug)}.webp" alt="" width="1280" height="960" loading="lazy" decoding="async" onerror="this.remove()">
          <span class="fo-pc-wm">${mark()}</span>
        </span>
        <span class="fo-pc-t">${esc(p.title)}</span>
        <span class="fo-pc-h">${esc(p.headline)}</span>
        <span class="fo-pc-stats">
          <span><b>Stack</b>${p.tags.map(esc).join(" · ")}</span>
          <span><b>Context</b>${esc(p.ctx)}</span>
        </span>
        <span class="fo-pc-go">Open the case ${icon("arrow-up-right")}</span>
      </a>
    </li>`;

    const sticker = (t, i) => `<li><button type="button" class="fo-st" data-play="${esc(t.id)}" style="--h:${(i * 61) % 360}deg" aria-label="Play ${esc(t.name)}: ${esc(t.desc)}">
      <span class="fo-st-disc" aria-hidden="true"><i class="fo-st-foil"></i><i class="fo-st-glit"></i><span class="fo-st-ic">${icon(t.icon)}</span></span>
      <span class="fo-st-t">${esc(t.name)}</span><span class="fo-st-d">${esc(t.desc)}</span>
    </button></li>`;

    return `<div class="fo" style="--fo-mk:${maskUrl}">
<svg class="fo-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="fo-foil" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(0 .5 .5)">
    ${FOIL.concat(FOIL[0]).map((c, i, a) => `<stop offset="${(i / (a.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join("")}
  </linearGradient>
</defs></svg>

<header class="fo-nav" aria-label="Site">
  <a class="fo-logo" href="#top" aria-label="Rithvik Praveen Kumar, back to top">${fm()}<span aria-hidden="true">RPK</span></a>
  <nav class="fo-links" aria-label="Sections"><a href="#work">Work</a><a href="#experience">Path</a><a href="#graph">Map</a><a href="#play">Play</a><a href="#contact">Contact</a></nav>
  <div class="fo-nav-r">
    <a class="fo-btn fo-btn-s" href="#" data-resume>Resume</a>
    <button type="button" class="fo-ic" data-compose="Internship opportunity" aria-label="Email Rithvik">${icon("mail")}</button>
  </div>
</header>

<section class="fo-hero" id="top" aria-labelledby="fo-h1">
  <div class="fo-hero-in">
    <div class="fo-hero-txt">
      <p class="fo-eyebrow"><span class="fo-dot" aria-hidden="true"></span>${esc(C.role)}</p>
      <h1 id="fo-h1" class="fo-h1"><span>${esc(C.first)}</span><span>${esc(C.last)}</span></h1>
      <p class="fo-lede">${esc(C.line)}</p>
      <p class="fo-status"><span class="fo-pulse" aria-hidden="true"></span>${esc(C.status)}</p>
      <div class="fo-acts">
        <a class="fo-btn fo-btn-foil" href="#" data-resume>Resume ${icon("arrow-up-right")}</a>
        <button type="button" class="fo-btn" data-compose="Internship opportunity">${icon("mail")}Email me</button>
        <button type="button" class="fo-btn fo-btn-ghost" data-agent><span class="fo-prompt" aria-hidden="true">❯</span>Ask my agent</button>
      </div>
    </div>
    <div class="fo-hero-card">
      <div class="fo-tilt" id="fo-tilt">
        <article class="fo-card" aria-label="Rithvik's card">
          <div class="fo-card-gl" id="fo-gl" aria-hidden="true"></div>
          <div class="fo-card-top"><span class="fo-card-mk" aria-hidden="true">${fm()}</span><b>${esc(C.initials)}</b><span>Holo · 1 of 1</span></div>
          <button type="button" class="fo-card-art" aria-label="Spin the mark"><span class="fo-deboss"><span class="fo-deboss-hi">${mark()}</span><span class="fo-deboss-ink">${mark()}</span></span></button>
          <div class="fo-card-plate">
            <p class="fo-lent" id="fo-lent"><span class="fo-lent-a">${esc(C.name)}</span><span class="fo-lent-b" aria-hidden="true">${esc(C.role)}</span><i class="fo-lent-r" aria-hidden="true"></i></p>
            <dl class="fo-stats">${C.numbers.slice(0, 3).map(([n, l]) => `<div><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join("")}</dl>
          </div>
          <i class="fo-card-glare" aria-hidden="true"></i>
        </article>
      </div>
      <p class="fo-hint" aria-hidden="true"><span class="fo-hint-f">Move to tilt the card</span><span class="fo-hint-c">Drag across the card to tilt it</span></p>
    </div>
  </div>
</section>

<section class="fo-sec fo-about" id="about" aria-labelledby="fo-h-about">
  <div class="fo-about-grid">
    <div class="fo-sleeve">${portrait({ id: "foil", cls: "fo-pt" })}</div>
    <div class="fo-about-txt">
      ${kick("01", "About")}
      <h2 id="fo-h-about" class="fo-h2">Hi, I'm ${esc(C.first)}.</h2>
      ${C.about.map((a) => `<p class="fo-p">${esc(a)}</p>`).join("")}
      <ul class="fo-thesis">${C.thesis.map((t) => `<li><i aria-hidden="true"></i>${esc(t)}</li>`).join("")}</ul>
    </div>
  </div>
  <div class="fo-now" id="now" aria-label="Right now">
    <dl class="fo-now-l">
      <div><dt>Building</dt><dd>${esc(C.now.building)}</dd></div>
      <div><dt>Researching</dt><dd>${esc(C.now.researching)}</dd></div>
      <div><dt>Learning</dt><dd>${esc(C.now.learning)}</dd></div>
    </dl>
    <ul class="fo-places" aria-label="Places">${C.places.map((pl) => `<li class="${pl.key === "now" ? "is-now" : ""}"><span>${placeLabel[pl.key] || esc(pl.key)}</span><b>${esc(pl.city)}</b><time data-clock="${esc(pl.tz)}">${esc(H.clock(pl.tz))}</time></li>`).join("")}</ul>
  </div>
</section>

<section class="fo-sec fo-work" id="work" aria-labelledby="fo-h-work">
  <header class="fo-sec-h">${kick("02", "Work")}<h2 id="fo-h-work" class="fo-h2">The set</h2><p class="fo-sub">Six projects, from headsets to the cloud. Every card opens.</p></header>
  <ul class="fo-set" id="fo-set">${C.projects.map(projectCard).join("")}</ul>
</section>

<section class="fo-sec fo-exp" id="experience" aria-labelledby="fo-h-exp">
  <header class="fo-sec-h">${kick("03", "Path")}<h2 id="fo-h-exp" class="fo-h2">Where I've worked</h2></header>
  <ol class="fo-roles">
    ${C.experience.map((x) => `<li class="fo-role" id="experience-${esc(x.slug)}">
      <p class="fo-when">${esc(x.when)}<span>${esc(x.where)}</span></p>
      <div class="fo-role-h"><h3>${esc(x.role)}</h3><p>${esc(x.org)}</p></div>
      <div class="fo-role-b"><ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul><p class="fo-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p></div>
    </li>`).join("")}
  </ol>
  <article class="fo-edu" id="education" aria-label="Education">
    <span class="fo-edu-badge"><img src="${esc(C.education.logo)}" alt="Purdue University" width="56" height="56" loading="lazy" decoding="async"></span>
    <div><p class="fo-edu-k">Education</p><h3>${esc(C.education.school)}</h3><p>${esc(C.education.degree)}</p></div>
    <p class="fo-edu-m">${esc(C.education.focus)}<br>${esc(C.education.grad)}</p>
  </article>
</section>

<section class="fo-sec fo-map" id="graph" aria-labelledby="fo-h-map">
  <header class="fo-sec-h">${kick("04", "Map")}<h2 id="fo-h-map" class="fo-h2">Everything, connected</h2><p class="fo-sub">Fields, projects, roles and skills on one map. Hover to trace a thread; click to open it.</p></header>
  ${H.graph({ id: "foil" })}
</section>

<section class="fo-sec fo-play" id="play" aria-labelledby="fo-h-play">
  <header class="fo-sec-h">${kick("05", "Play")}<h2 id="fo-h-play" class="fo-h2">Stickers</h2><p class="fo-sub">Six small toys. The games keep my score next to yours.</p></header>
  <ul class="fo-stickers">${H.PLAY.map(sticker).join("")}</ul>
</section>

<section class="fo-sec fo-faq" id="faq" aria-labelledby="fo-h-faq">
  <div class="fo-faq-l">${kick("06", "Questions")}<h2 id="fo-h-faq" class="fo-h2">Short answers</h2><p class="fo-sub">Anything else, <button type="button" class="fo-inl" data-agent>ask my agent</button>. It only answers from what's on record.</p></div>
  <div class="fo-qs">${C.faq.map(([q, a]) => `<details class="fo-q"><summary>${esc(q)}<i aria-hidden="true"></i></summary><p>${esc(a)}</p></details>`).join("")}</div>
</section>

<section class="fo-sec fo-contact" id="contact" aria-labelledby="fo-h-contact">
  ${kick("07", "Contact")}
  <span class="fo-seal" aria-hidden="true">${fm("fo-fm-l")}</span>
  <h2 id="fo-h-contact" class="fo-big">Write to me.</h2>
  <p class="fo-sub fo-c">Open to SWE and AI internships. The message goes straight to my inbox.</p>
  <div class="fo-acts fo-c">
    <button type="button" class="fo-btn fo-btn-foil fo-btn-l" data-compose="Internship opportunity">${icon("mail")}Write an email</button>
    <button type="button" class="fo-btn" data-copy="${esc(C.links.email)}">${icon("copy")}${esc(C.links.email)}</button>
  </div>
  <ul class="fo-out">
    <li><a href="${esc(C.links.github)}" target="_blank" rel="noopener">${logo("github")}GitHub</a></li>
    <li><a href="${esc(C.links.linkedin)}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a></li>
    <li><a href="#" data-resume>${icon("file-text")}Resume</a></li>
    <li><a href="#" data-agent>${icon("terminal")}Agent</a></li>
  </ul>
</section>

<footer class="fo-foot" id="colophon">
  <span class="fo-foot-mk" aria-hidden="true">${fm()}</span>
  <p>${esc(C.name)} · ${esc(C.status)}</p>
  <p class="fo-colo">The card is one fragment shader: thin-film interference over a noise height map, lit by your pointer. The photo is never touched. Set in Unbounded and Geist.</p>
</footer>
<div class="fo-mosh" aria-hidden="true" hidden></div>
</div>`;
  }

  /* ───────── mount: hero tilt + lenticular + light, card hover tilt, datamosh into cases, clocks ───────── */
  function mount(root, H) {
    const offs = [], $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
    const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const html = document.documentElement;
    const lite = () => html.classList.contains("lite");
    const prm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rm = () => H.reduceMotion();
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

    // live clocks
    const tick = () => $$("[data-clock]").forEach((c) => (c.textContent = H.clock(c.dataset.clock)));
    const clockT = setInterval(tick, 30000);

    /* hero card: springs toward the pointer; the same pose drives the glare and the lenticular strip */
    const hero = $(".fo-hero"), wrap = $(".fo-hero-card"), tilt = $("#fo-tilt"), lent = $("#fo-lent");
    const S = { x: 0, y: 0, tx: 0, ty: 0, k: 0, kt: 0, raf: 0, intro: 0, heroOn: true };
    const reset = () => { tilt.style.transform = ""; tilt.style.removeProperty("--gx"); tilt.style.removeProperty("--gy"); lent.style.removeProperty("--k"); };
    function pose() {
      const amp = prm() ? 0.3 : 1;
      tilt.style.transform = `rotateX(${(-S.y * 9 * amp).toFixed(2)}deg) rotateY(${(S.x * 13 * amp).toFixed(2)}deg)`;
      tilt.style.setProperty("--gx", (50 + S.x * 46).toFixed(1) + "%");
      tilt.style.setProperty("--gy", (40 + S.y * 46).toFixed(1) + "%");
      lent.style.setProperty("--k", sstep(0, 1, S.k).toFixed(3));
    }
    function step() {
      S.raf = 0;
      S.x += (S.tx - S.x) * 0.12; S.y += (S.ty - S.y) * 0.12;
      flip(); S.k += (S.kt - S.k) * 0.2; if (Math.abs(S.kt - S.k) < 0.004) S.k = S.kt;
      pose();
      if (Math.abs(S.tx - S.x) > 0.002 || Math.abs(S.ty - S.y) > 0.002 || S.k !== S.kt) S.raf = requestAnimationFrame(step);
    }
    // a lenticular flips at an angle: past ~a third of the way right it shows the role (with a little hysteresis)
    const flip = () => { if (S.kt === 0 && S.x > 0.34) S.kt = 1; else if (S.kt === 1 && S.x < 0.24) S.kt = 0; };
    const kickTilt = () => { if (!S.raf) S.raf = requestAnimationFrame(step); };
    const aim = (cx, cy) => {
      const r = wrap.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
      S.tx = clamp((cx - ox) / (r.width * 0.9), -1, 1); S.ty = clamp((cy - oy) / (r.height * 0.75), -1, 1);
    };
    // the hero's ambient work only runs while it is on screen
    const io = new IntersectionObserver((en) => { S.heroOn = en[0].isIntersecting; }, { rootMargin: "80px" });
    io.observe(hero);

    // the foil texture loads after first paint; until then the foil areas use a gradient
    const fo = $(".fo"), img = new Image();
    img.decoding = "async"; img.onload = () => fo.classList.add("has-foil");
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300)), idleId = idle(() => { img.src = "assets/foil/foil-1024.webp"; });

    let gRaf = 0, gx = 0.5, gy = 0.5;
    const grad = root.querySelector("#fo-foil"), fms = $$(".fo-fm");
    on(window, "pointermove", (e) => {
      if (!e.isTrusted) return;
      if (lite()) { if (tilt.style.transform) reset(); return; }
      // the foil-stamped nav mark turns its sheen with the pointer
      gx = e.clientX / Math.max(1, innerWidth); gy = e.clientY / Math.max(1, innerHeight);
      if (!gRaf) gRaf = requestAnimationFrame(() => {
        gRaf = 0;
        grad.setAttribute("gradientTransform", `rotate(${Math.round(gx * 160 - 40)} .5 .5)`);
        fms.forEach((m) => { m.style.setProperty("--fx", (gx - 0.5).toFixed(3)); m.style.setProperty("--fy", (gy - 0.5).toFixed(3)); });
      });
      if (!S.heroOn) return;
      if (e.pointerType !== "mouse" && !e.target.closest?.(".fo-tilt")) return;
      stopIntro();
      aim(e.clientX, e.clientY); kickTilt();
    }, { passive: true });
    const settle = () => { if (lite()) return; S.tx = 0; S.ty = 0; kickTilt(); };
    on(document.documentElement, "pointerleave", settle);
    on(tilt, "pointerup", (e) => { if (e.pointerType !== "mouse") settle(); });
    on(tilt, "pointercancel", settle);

    // first visit to the hero: one slow sweep so everyone sees the foil shift and the strip flip
    function stopIntro() { if (S.intro) { cancelAnimationFrame(S.intro); S.intro = 0; } }
    function intro() {
      if (rm()) return;
      const t0 = performance.now(), D = 2800;
      const f = (now) => {
        const u = Math.min(1, (now - t0) / D), env = Math.sin(Math.PI * u);
        S.tx = S.x = 0.95 * Math.sin(2 * Math.PI * u * 0.95) * env;
        S.ty = S.y = -0.35 * Math.sin(Math.PI * u * 2) * env;
        flip(); S.k += (S.kt - S.k) * 0.2;
        pose();
        // steer the shader's light along the same path (the core reads pointer position from window)
        const r = wrap.getBoundingClientRect();
        window.dispatchEvent(new PointerEvent("pointermove", { clientX: r.left + r.width / 2 + S.x * r.width * 0.55, clientY: r.top + r.height / 2 + S.y * r.height * 0.5 }));
        if (u < 1) S.intro = requestAnimationFrame(f); else { S.intro = 0; S.tx = S.ty = 0; kickTilt(); }
      };
      S.intro = requestAnimationFrame(f);
    }
    const introT = setTimeout(intro, 700);

    // the mark on the card chases its tail once when clicked
    on($(".fo-card-art"), "click", () => {
      if (rm()) return;
      $$(".fo-deboss .mark").forEach((m) => m.animate([{ rotate: "0deg" }, { rotate: "-360deg" }], { duration: 1200, easing: "cubic-bezier(.77,0,.175,1)" }));
    });

    /* project cards: a few degrees of tilt and a sliding holo layer while hovered (fine pointers only) */
    const set = $("#fo-set");
    let cRaf = 0, cEv = null;
    const cardMove = () => {
      cRaf = 0; const e = cEv; if (!e) return;
      const c = e.target.closest?.(".fo-pc"); if (!c) return;
      const r = c.parentElement.getBoundingClientRect();
      c.style.setProperty("--dx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      c.style.setProperty("--dy", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    on(set, "pointermove", (e) => { if (rm() || !H.fine.matches) return; cEv = e; if (!cRaf) cRaf = requestAnimationFrame(cardMove); }, { passive: true });
    on(set, "pointerout", (e) => { const c = e.target.closest(".fo-pc"); if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty("--dx"); c.style.removeProperty("--dy"); } });

    /* datamosh: streaks pixel-sort out of the clicked card, then the case sheet rises over them */
    const mosh = $(".fo-mosh");
    let moshT = [];
    function openWithMosh(card, slug) {
      if (rm() || !mosh) { H.openCase(slug); return; }
      moshT.forEach(clearTimeout); moshT = [];
      const r = card.getBoundingClientRect(), W = innerWidth, n = 24, frag = document.createDocumentFragment();
      mosh.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const el = document.createElement("i"), h = 2 + Math.random() ** 2 * 34, top = r.top + Math.random() * r.height - h / 2;
        const right = Math.random() > 0.3, a = FOIL[(Math.random() * FOIL.length) | 0], b = FOIL[(Math.random() * FOIL.length) | 0];
        el.style.cssText = `top:${top.toFixed(1)}px;left:${r.left.toFixed(1)}px;width:${r.width.toFixed(1)}px;height:${h.toFixed(1)}px;transform-origin:${right ? "0" : "100%"} 50%;background:linear-gradient(${right ? 90 : 270}deg, ${a}, ${b} 38%, rgba(10,10,16,.0))`;
        const dist = right ? (W - r.right) * (0.4 + Math.random() * 0.7) : -(r.left) * (0.4 + Math.random() * 0.7);
        el.animate([
          { transform: "translateX(0) scaleX(.2)", opacity: 0 },
          { transform: `translateX(${(dist * 0.35).toFixed(0)}px) scaleX(${(1 + Math.random()).toFixed(2)})`, opacity: 1, offset: 0.25 },
          { transform: `translateX(${dist.toFixed(0)}px) scaleX(${(1.4 + Math.random() * 2.2).toFixed(2)})`, opacity: 0.9, offset: 0.7 },
          { transform: `translateX(${(dist * 1.1).toFixed(0)}px) scaleX(2.6)`, opacity: 0 },
        ], { duration: 760, delay: Math.random() * 110, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" });
        frag.appendChild(el);
      }
      mosh.appendChild(frag); mosh.hidden = false; card.classList.add("is-mosh");
      moshT.push(setTimeout(() => H.openCase(slug), 320));
      moshT.push(setTimeout(() => { mosh.hidden = true; mosh.innerHTML = ""; card.classList.remove("is-mosh"); }, 980));
    }
    on(root, "click", (e) => { const c = e.target.closest("[data-fo-case]"); if (!c) return; e.preventDefault(); openWithMosh(c, c.dataset.foCase); });

    // one answer open at a time
    const qs = $$(".fo-q");
    qs.forEach((d) => on(d, "toggle", () => { if (d.open) qs.forEach((o) => { if (o !== d) o.open = false; }); }));

    return () => {
      offs.forEach((f) => f()); io.disconnect(); img.onload = null; (window.cancelIdleCallback || clearTimeout)(idleId); clearInterval(clockT); clearTimeout(introT); stopIntro();
      cancelAnimationFrame(S.raf); cancelAnimationFrame(gRaf); cancelAnimationFrame(cRaf); moshT.forEach(clearTimeout);
    };
  }

  V6.theme({
    id: "foil", name: "Foil", mood: "holo card, tilted light", dark: true,
    keywords: ["foil", "holo", "holographic", "iridescent", "iridescence", "card", "trading", "pearl", "y2k", "chrome", "shiny", "rainbow"],
    fonts: "family=Unbounded:wght@300..700",
    swatch: ["#0A0A10", "#EEEAF6", "#B9A8FF", "#8BF0D3"],
    cardFont: '"Unbounded", "Geist", sans-serif',
    colors: ["#2A2838", "#E9E4F5", "#B9A8FF", "#0A0A10"],
    shaderScale: 0.75,
    shaderHost: "#fo-gl",
    shader: SHADER,
    render,
    mount,
  });
})();
