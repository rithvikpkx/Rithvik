/* Tracker: a calm, light lab UI watched by a small vision model. The page itself is quiet (paper-grey
   ground, white panes, hairlines, crisp Inter Tight + JetBrains Mono); the vision system is the layer
   that comes alive. Where each effect lives, and why:
   - Depth map + segmentation (the shader): only inside the hero "cam0" feed. False-colour plasma bands,
     dithered at their edges, with contour lines ringing the subject (the real, untouched photo) and a
     slow lidar sweep. The one place at full intensity, because it is the first thing you see.
   - Blob tracking (DOM): a pool of at most 6 boxes (edges + corner brackets + a label, all transforms)
     that acquire real page elements: the portrait as "person", the name, buttons, projects, graph
     nodes, toys. Boxes ease toward their targets with lag like a real tracker, hand over between hovered
     targets, and now and then lose one (brief datamosh slices) and reacquire it under a new ID. The rAF
     loop runs only while something moves; at rest the boxes simply sit there.
   - Optical-flow vectors: a sparse arrow field that fades in only while the visitor scrolls fast.
   - HUD (nav): live fps, frame counter, objects in view, model name. Pure decoration with real numbers.
   Performance mode (html.lite): no loop, no flow, no glitch; the core freezes the shader and the
   tracker becomes a few static CSS annotations (face box, name, primary action, project rows). */
(function () {
  "use strict";

  /* ───────── Shader: depth field → plasma bands (dithered) + contours + lidar sweep + grain ───────── */
  const SHADER = `
#define SUBJ vec2(.5, .55)
float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
vec3 pal(float x){
  x = clamp(x, 0., 1.);
  vec3 c = mix(u_c0, u_c1, smoothstep(.06, .32, x));
  c = mix(c, u_c2, smoothstep(.32, .56, x));
  c = mix(c, u_c3, smoothstep(.56, .78, x));
  return mix(c, vec3(.97, .96, .66), smoothstep(.78, .98, x));
}
float field(vec2 uv, float asp, float t){
  vec2 p = (uv - .5) * vec2(asp, 1.);
  // the floor plane: near at the bottom of the frame, far at the top
  float d = .08 + .26 * (1. - uv.y);
  // the subject: a head and shoulders, nearest thing in the room
  vec2 s = p - (SUBJ - .5) * vec2(asp, 1.);
  float head = exp(-dot(s, s) * 7.5);
  vec2 sb = s + vec2(0., .5);
  float body = exp(-(sb.x * sb.x * 3.2 + sb.y * sb.y * 5.));
  d += .58 * max(head, body * .82);
  // three slow objects drifting through the scene
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * (.07 + fi * .03) + fi * 2.1) * .62 * asp, cos(t * (.05 + fi * .02) + fi * 1.7) * .36);
    vec2 q = p - c;
    d += .26 * exp(-dot(q, q) * (9. + fi * 5.));
  }
  // the visitor's pointer is a hand held up to the camera
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  vec2 mq = p - m;
  d += .36 * exp(-dot(mq, mq) * 26.);
  d += .1 * fbm(p * 2.3 + vec2(t * .025, -t * .018));
  return d;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y, t = u_time;
  float e = 1.5;
  float d = field(uv, asp, t);
  float dx = field(uv + vec2(e / u_res.x, 0.), asp, t) - d;
  float dy = field(uv + vec2(0., e / u_res.y), asp, t) - d;
  float g = length(vec2(dx, dy)) / e;
  float N = 12.;
  float dd = clamp(d, 0., 1.);
  // segmentation: depth posterised into bands, band edges ordered-dithered so low resolution reads as texture
  float b = bayer4(gl_FragCoord.xy);
  float band = (floor(dd * N + (b - .5) * .42) + .5) / N;
  vec3 col = pal(band);
  // contour lines at every band edge, a constant pixel width whatever the slope
  float f = fract(dd * N);
  float dist = min(f, 1. - f) / max(g * N, 1e-4);
  col = mix(col, vec3(1.), (1. - smoothstep(.5, 1.25, dist)) * .5);
  // a lidar sweep climbs the frame; just behind it the scene shows as a point grid
  float sw = fract(t * .07) * 1.3 - .15;
  float sy = uv.y - sw;
  float lineS = exp(-sy * sy * 3000.);
  vec2 cell = mod(gl_FragCoord.xy, 4.);
  float pts = step(cell.x, .9) * step(cell.y, .9) * smoothstep(-.12, 0., sy) * step(sy, 0.);
  col = mix(col, vec3(1.), lineS * .55 + pts * .38);
  // lens vignette, then grain
  col *= .8 + .2 * smoothstep(1.15, .25, length((uv - .5) * vec2(asp * .85, 1.)));
  col += (hash21(gl_FragCoord.xy + fract(t * 7.) * 41.) - .5) * .045;
  gl_FragColor = vec4(col, 1.);
}`;

  /* ───────── Classes the model knows, and their box colours ───────── */
  const K = { person: "#E0103F", text: "#C24E00", cta: "#1F3BFF", project: "#00875A", role: "#0A6FB0", node: "#7A3CFF", toy: "#B5179E", metric: "#3F4248", logo: "#8A6A00", ouroboros: "#7A3CFF", field: "#C24E00", place: "#E0103F", school: "#8A6A00", skill: "#5A5E66" };
  const KG_CLS = { me: "ouroboros", field: "field", project: "project", role: "role", school: "school", place: "place", skill: "skill" };
  const TOY_LBL = { records: "vinyl", artboard: "canvas", typeracer: "keyboard", angle: "protractor", dots: "dots", center: "div" };
  const pad = (i, n = 2) => String(i).padStart(n, "0");
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /** An 8×5 activation map per project: a soft blob of attention quantised to four levels, one hot cell. */
  function fmap(slug) {
    let s = hashStr(slug) || 1; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    const cx = 1.5 + r() * 5, cy = 1 + r() * 3; let cells = "", best = -1, bx = 0, by = 0;
    const v = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { const a = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 4.5) + r() * 0.28; v.push(a); if (a > best) { best = a; bx = x; by = y; } }
    v.forEach((a, i) => { const x = i % 8, y = (i / 8) | 0; const l = x === bx && y === by ? "h" : a > 0.75 ? "3" : a > 0.5 ? "2" : a > 0.28 ? "1" : ""; if (l) cells += `<rect x="${x}" y="${y}" width="1" height="1" class="f${l}"/>`; });
    return `<svg class="tk-fm" viewBox="0 0 8 5" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect width="8" height="5" class="f0"/>${cells}<rect x="${bx}" y="${by}" width="1" height="1" class="fo"/></svg>`;
  }

  /* ───────── render: the whole site ───────── */
  function render(C, H) {
    const { esc, icon, logo, portrait, mark } = H;
    const placeLabel = { home: "Home", school: "School", now: "Now" };
    const sh = (n, k, title, sub, id) => `<header class="tk-sh"><p class="tk-k"><span>${pad(n)}</span>${k}</p><h2 class="tk-h2" id="${id}" data-tk="text" data-tk-label="heading">${title}</h2>${sub ? `<p class="tk-sub">${sub}</p>` : ""}</header>`;

    const proj = (p, i) => `<li><button type="button" class="tk-proj" data-case="${p.slug}" data-tk="project" data-tk-static="project ${(0.86 + (hashStr(p.slug) % 12) / 100).toFixed(2)}" aria-label="${esc(p.title)}: ${esc(p.headline)}. Open the case">
        <span class="tk-pn">${pad(i + 1)}</span>
        <span class="tk-pb"><b class="tk-pt-t">${esc(p.title)}</b><span class="tk-ph">${esc(p.headline)}</span><span class="tk-ptags">${p.tags.slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join("")}</span></span>
        <span class="tk-pk">${icon(p.icon)}${esc(p.kind)}</span>
        ${fmap(p.slug)}
        <span class="tk-go" aria-hidden="true">${icon("arrow-up-right")}</span>
      </button></li>`;

    const role = (x) => `<li class="tk-role" id="experience-${x.slug}" data-tk="role">
        <p class="tk-when"><b>${esc(x.when)}</b><span>${esc(x.where)}</span></p>
        <div class="tk-rb"><h3>${esc(x.role)}</h3><p class="tk-org">${esc(x.org)}</p>
          <ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
          <p class="tk-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p></div>
      </li>`;

    const toy = (t, i) => `<li><button type="button" class="tk-toy" data-play="${t.id}" data-tk="toy" data-tk-label="${TOY_LBL[t.id] || "toy"}" aria-label="Play ${esc(t.name)}: ${esc(t.desc)}">
        <span class="tk-toy-img" aria-hidden="true"><span class="tk-toy-ic">${icon(t.icon)}</span><span class="tk-toy-f">sample_${pad(i + 1, 3)}.png</span></span>
        <span class="tk-toy-t"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></span>
      </button></li>`;

    return `<div class="tk">
<header class="tk-nav">
  <a class="tk-logo" href="#top" aria-label="Rithvik Praveen Kumar, back to top">${mark()}<span>rithvik.ai</span></a>
  <nav class="tk-links" aria-label="Sections">
    <a href="#work"><i>02</i>Work</a><a href="#graph"><i>03</i>Graph</a><a href="#experience"><i>04</i>Experience</a><a href="#about"><i>05</i>About</a><a href="#play"><i>06</i>Play</a><a href="#contact"><i>07</i>Contact</a>
  </nav>
  <div class="tk-hud" aria-hidden="true">
    <span class="tk-hud-st"><i></i><b data-tk-state>tracking</b></span>
    <span class="tk-hud-x"><b data-tk-fps>60.0</b> fps</span>
    <span class="tk-hud-x">f <b data-tk-frame>000000</b></span>
    <span>obj <b data-tk-obj>0</b></span>
    <span class="tk-hud-m">rvk-track v0.7</span>
  </div>
  <a class="tk-btn tk-btn-ink tk-nav-cta" href="#" data-resume>${icon("file-text")}Resume</a>
</header>

<section class="tk-hero" id="top" aria-labelledby="tk-h1">
  <div class="tk-hero-txt">
    <p class="tk-k"><span>01</span>${esc(C.role)}</p>
    <h1 class="tk-name" id="tk-h1" data-tk="text" data-tk-label="name" data-tk-static="name 0.99">${esc(C.first)}<br><span>${esc(C.last)}</span></h1>
    <p class="tk-lede">${esc(C.line)}</p>
    <p class="tk-status"><i class="tk-dot" aria-hidden="true"></i>${esc(C.status)}</p>
    <div class="tk-acts">
      <a class="tk-btn tk-btn-ink" href="#" data-resume data-tk="cta" data-tk-static="cta 0.94">${icon("file-text")}Resume</a>
      <button type="button" class="tk-btn" data-compose="Internship opportunity" data-tk="cta">${icon("mail")}Email me</button>
      <button type="button" class="tk-btn tk-btn-ghost" data-agent data-tk="cta"><span class="tk-prompt" aria-hidden="true">❯</span>Ask my agent</button>
    </div>
  </div>
  <figure class="tk-feed">
    <figcaption class="tk-feed-bar"><span><i class="tk-rec" aria-hidden="true"></i>cam0</span><span>depth + segmentation</span><span class="tk-feed-r">subjects 1</span></figcaption>
    <div class="tk-view">
      <div class="tk-gl" id="tk-gl" aria-hidden="true"></div>
      <span class="tk-tick tl" aria-hidden="true"></span><span class="tk-tick tr" aria-hidden="true"></span><span class="tk-tick bl" aria-hidden="true"></span><span class="tk-tick br" aria-hidden="true"></span>
      <span class="tk-cross" aria-hidden="true"></span>
      <div class="tk-subject">
        ${portrait({ id: "tracker", cls: "tk-pt" })}
        <i class="tk-face" data-tk-static="person 0.97" aria-hidden="true"></i>
      </div>
    </div>
    <div class="tk-feed-foot" aria-hidden="true"><span>near</span><i class="tk-ramp"></i><span>far</span></div>
  </figure>
</section>

<section class="tk-readout" aria-label="In numbers">
  <dl class="tk-nums">${C.numbers.map(([n, l]) => `<div data-tk="metric"><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join("")}</dl>
</section>

<section class="tk-sec" id="work" aria-labelledby="tk-h-work">
  ${sh(2, "Work", "Six things I've built", "From EEG headsets to the cloud. Each one opens.", "tk-h-work")}
  <ol class="tk-projects">${C.projects.map(proj).join("")}</ol>
</section>

<section class="tk-sec" id="graph" aria-labelledby="tk-h-graph">
  ${sh(3, "Scene graph", "Everything on record, connected", "Projects, roles, skills and places as one graph. Hover a node to trace it; click to open it.", "tk-h-graph")}
  <div class="tk-pane tk-graph">${H.graph({ id: "tracker" })}</div>
</section>

<section class="tk-sec" id="experience" aria-labelledby="tk-h-exp">
  ${sh(4, "Experience", "Where I've worked", "", "tk-h-exp")}
  <ol class="tk-roles">${C.experience.map(role).join("")}</ol>
  <div class="tk-edu" id="education" data-tk="school">
    <img src="${esc(C.education.logo)}" alt="Purdue University" width="56" height="56" loading="lazy" decoding="async">
    <div><p class="tk-k tk-k-s">Education</p><h3>${esc(C.education.school)}</h3><p>${esc(C.education.degree)}</p><p class="tk-edu-m">${esc(C.education.focus)} · ${esc(C.education.grad)}</p></div>
  </div>
</section>

<section class="tk-sec" id="about" aria-labelledby="tk-h-about">
  ${sh(5, "About", `Hi, I'm ${esc(C.first)}.`, "", "tk-h-about")}
  <div class="tk-about">
    <div class="tk-about-txt">${C.about.map((a) => `<p>${esc(a)}</p>`).join("")}
      <ul class="tk-thesis">${C.thesis.map((t, i) => `<li><span>${pad(i + 1)}</span>${esc(t)}</li>`).join("")}</ul>
    </div>
    <aside class="tk-pane tk-now" id="now" aria-label="Right now">
      <p class="tk-pane-h"><span>now</span><span data-clock="${esc(C.now.tz)}">${esc(H.clock(C.now.tz))}</span></p>
      <dl class="tk-kv">
        <div><dt>Building</dt><dd>${esc(C.now.building)}</dd></div>
        <div><dt>Researching</dt><dd>${esc(C.now.researching)}</dd></div>
        <div><dt>Learning</dt><dd>${esc(C.now.learning)}</dd></div>
      </dl>
      <p class="tk-pane-h tk-pane-h2"><span>places</span></p>
      <ol class="tk-places">${C.places.map((pl) => `<li class="${pl.key === "now" ? "is-now" : ""}"><span class="tk-pl-k">${placeLabel[pl.key] || esc(pl.key)}</span><b>${esc(pl.city)}</b><span data-clock="${esc(pl.tz)}">${esc(H.clock(pl.tz))}</span></li>`).join("")}</ol>
    </aside>
  </div>
  <div class="tk-stack" aria-label="Stack">
    ${Object.entries(C.stack).map(([k, v]) => `<div class="tk-stack-row"><p>${esc(k)}</p><p class="tk-tags">${v.map((t) => `<span>${esc(t)}</span>`).join("")}</p></div>`).join("")}
  </div>
</section>

<section class="tk-sec" id="play" aria-labelledby="tk-h-play">
  ${sh(6, "Play", "The test set", "Six small toys. The games keep my score next to yours. The model has opinions about each one.", "tk-h-play")}
  <ul class="tk-toys">${H.PLAY.map(toy).join("")}</ul>
</section>

<section class="tk-sec tk-contact" id="contact" aria-labelledby="tk-h-contact">
  <p class="tk-k"><span>07</span>Contact</p>
  <h2 class="tk-big" id="tk-h-contact" data-tk="text" data-tk-label="greeting">Say hello.</h2>
  <p class="tk-sub">Open to SWE and AI internships. The message goes straight to my inbox.</p>
  <div class="tk-acts">
    <button type="button" class="tk-btn tk-btn-ink tk-btn-lg" data-compose="Internship opportunity" data-tk="cta">${icon("mail")}Write an email</button>
    <button type="button" class="tk-btn" data-copy="${esc(C.links.email)}" data-tk="cta" data-tk-label="address">${icon("copy")}${esc(C.links.email)}</button>
  </div>
  <ul class="tk-links2">
    <li><a href="${esc(C.links.github)}" target="_blank" rel="noopener">${logo("github")}GitHub</a></li>
    <li><a href="${esc(C.links.linkedin)}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a></li>
    <li><a href="#" data-resume>${icon("file-text")}Resume</a></li>
    <li><a href="#" data-agent>${icon("terminal")}Agent</a></li>
  </ul>
</section>

<footer class="tk-foot" id="colophon">
  <span class="tk-foot-mark" data-tk="ouroboros" data-tk-label="ouroboros">${mark()}</span>
  <p class="tk-foot-n">${esc(C.name)}</p>
  <p class="tk-colo">The depth map is one fragment shader. The boxes are plain DOM, eased with a little lag like a real tracker. The photo is never touched. Set in Inter Tight and JetBrains Mono.</p>
</footer>

<div class="tk-ov" aria-hidden="true"></div>
<svg class="tk-flow" aria-hidden="true" focusable="false"><path/></svg>
</div>`;
  }

  /* ───────── mount: the tracker, the flow field, the HUD, clocks ───────── */
  function mount(root, H) {
    const offs = [], html = document.documentElement;
    const on = (el, ev, fn, o) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
    const $ = (s) => root.querySelector(s);
    const lite = () => html.classList.contains("lite");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = H.fine.matches;
    const tkRoot = $(".tk") || root;
    const ov = $(".tk-ov"), flow = $(".tk-flow"), flowPath = flow && flow.firstElementChild;
    const hud = { st: $("[data-tk-state]"), fps: $("[data-tk-fps]"), fr: $("[data-tk-frame]"), obj: $("[data-tk-obj]") };
    const photo = $(".pt-photo"); if (photo) { photo.dataset.tk = "person"; photo.dataset.tkLabel = "person"; }
    const SEL = "[data-tk], .kg-node[data-type]";
    const MAX = 6, AMBIENT = innerWidth < 700 ? 1 : 2;

    // live clocks
    const clocks = () => root.querySelectorAll("[data-clock]").forEach((c) => (c.textContent = H.clock(c.dataset.clock)));
    const clockT = setInterval(clocks, 20000);

    /* box pool: four hairline edges scaled along their length, four corner brackets, one label; transforms only */
    const boxes = [];
    for (let i = 0; i < MAX; i++) {
      const el = document.createElement("div"); el.className = "tk-box";
      el.innerHTML = `<i class="tk-e"></i><i class="tk-e"></i><i class="tk-e tk-ev"></i><i class="tk-e tk-ev"></i><i class="tk-c tk-c1"></i><i class="tk-c tk-c2"></i><i class="tk-c tk-c3"></i><i class="tk-c tk-c4"></i><span class="tk-lbl"><b></b><span></span></span>`;
      ov.appendChild(el);
      const q = el.children;
      boxes.push({ el, e: [q[0], q[1], q[2], q[3]], c: [q[4], q[5], q[6], q[7]], lbl: q[8], lid: q[8].firstChild, ltx: q[8].lastChild, t: null, role: null, x: 0, y: 0, w: 0, h: 0, a: 0, ta: 0, born: 0, conf: 0, base: 0, txt: "", id: 0, lost: 0 });
    }
    // glitch slices for lost targets
    const slices = [];
    for (let i = 0; i < 7; i++) { const s = document.createElement("i"); s.className = "tk-slice"; s.style.setProperty("--k", ["#E0103F", "#1F3BFF", "#F0F921", "#7E03A8", "#00875A", "#E0457B", "#0C0D0F"][i]); ov.appendChild(s); slices.push(s); }

    let nextId = 1; const cool = new WeakMap();
    const clsOf = (el) => (el.classList.contains("kg-node") ? KG_CLS[el.dataset.type] || "node" : el.dataset.tk);
    const labelOf = (el) => (el.classList.contains("kg-node") ? KG_CLS[el.dataset.type] || "node" : el.dataset.tkLabel || el.dataset.tk);
    const FIXED = { person: 0.97, name: 0.99, ouroboros: 0.99 };
    const baseConf = (el) => (FIXED[labelOf(el)] || 0.81 + (hashStr((el.textContent || el.dataset.id || "") + labelOf(el)) % 170) / 1000);
    const padOf = (b) => (b.role === "person" ? 10 : b.t && b.t.classList.contains("kg-node") ? 7 : 6);

    function assign(b, el, role, now, handover) {
      const fresh = !b.t || !handover;
      b.t = el; b.role = role; b.id = nextId++; b.base = baseConf(el); b.conf = 0.32; b.born = now; b.ta = 1; b.lost = 0;
      b.el.style.setProperty("--k", K[clsOf(el)] || "#1F3BFF");
      b.el.classList.toggle("is-lock", role === "pointer");
      if (fresh) { const r = el.getBoundingClientRect(), p = 22; b.x = r.left - p; b.y = r.top - p; b.w = r.width + p * 2; b.h = r.height + p * 2; b.a = 0; }
      b.lid.textContent = "#" + pad(b.id); b.txt = ""; setText(b, "acquiring");
    }
    function release(b) { b.t = null; b.role = null; b.ta = 0; }
    function setText(b, s) { if (b.txt !== s) { b.txt = s; b.ltx.textContent = s; } }
    const tracked = (el) => boxes.some((b) => b.t === el && !b.lost);

    // pointer: whatever candidate is under the finger becomes the locked target; the box hands over between them
    let pointerEl = null, pointerT = 0;
    on(root, "pointerover", (e) => {
      if (e.pointerType !== "mouse" || lite()) return;
      const el = e.target.closest(SEL); if (!el || !root.contains(el)) return;
      if (el.dataset.tk === "person") return;
      pointerEl = el; pointerT = performance.now(); wake();
    });
    // a click hands the element to the visitor (a case, a graph card); the tracker steps back
    on(root, "click", (e) => { if (e.target.closest(".kg, [data-case], [data-play]")) { pointerEl = null; pointerT = 0; wake(); } });
    on(root, "pointerout", (e) => { if (e.pointerType !== "mouse") return; const el = e.target.closest(SEL); if (el && el === pointerEl && !el.contains(e.relatedTarget)) { pointerEl = null; pointerT = performance.now(); wake(); } });

    // scroll velocity feeds the flow field and wakes the tracker
    let lastY = scrollY, lastS = performance.now(), vel = 0, flowA = 0, lastScrollT = 0;
    on(window, "scroll", () => {
      const now = performance.now(), dt = Math.max(8, now - lastS), v = (scrollY - lastY) / dt;
      vel = vel * 0.55 + v * 0.45; lastY = scrollY; lastS = now; lastScrollT = now; wake();
    }, { passive: true });
    on(window, "resize", () => wake(), { passive: true });

    /** Choose targets: the person while visible, the pointer target, and up to two ambient ones near mid-screen. */
    function choose(now) {
      const vh = innerHeight, vw = innerWidth;
      const want = [];
      if (photo) { const r = photo.getBoundingClientRect(); if (r.bottom > 40 && r.top < vh - 40) want.push([photo, "person"]); }
      const pointerLive = pointerEl && pointerEl.isConnected;
      if (pointerLive) want.push([pointerEl, "pointer"]);
      // ambient: keep current ones while they stay comfortably on screen, fill the rest by distance to mid-screen,
      // never right next to another tracked thing (adjacent boxes read as clutter)
      const taken = want.map(([el]) => el.getBoundingClientRect());
      const clear = (r) => taken.every((q) => r.right + 40 < q.left || q.right + 40 < r.left || r.bottom + 48 < q.top || q.bottom + 48 < r.top);
      const amb = [];
      boxes.forEach((b) => {
        if (b.role !== "ambient" || !b.t || b.lost || b.t === pointerEl || amb.length >= AMBIENT) return;
        const r = b.t.getBoundingClientRect();
        if (r.bottom > vh * 0.08 && r.top < vh * 0.9 && r.height < vh * 0.8 && clear(r)) { amb.push(b.t); taken.push(r); }
      });
      if (amb.length < AMBIENT) {
        const cands = [];
        root.querySelectorAll("[data-tk]").forEach((el) => {
          if (el === photo || el === pointerEl || amb.includes(el) || (cool.get(el) || 0) > now) return;
          const r = el.getBoundingClientRect();
          if (r.height < 8 || r.height > vh * 0.62 || r.width > vw * 0.98 || r.top < vh * 0.16 || r.bottom > vh * 0.86) return;
          cands.push([Math.abs(r.top + r.height / 2 - vh * 0.5) + (r.width > vw * 0.7 ? vh * 0.12 : 0), el, r]);
        });
        cands.sort((a, b) => a[0] - b[0]);
        for (const [, el, r] of cands) { if (amb.length >= AMBIENT) break; if (!clear(r)) continue; amb.push(el); taken.push(r); }
      }
      amb.forEach((el) => want.push([el, "ambient"]));
      want.splice(MAX);
      // release boxes whose target is no longer wanted (the pointer box lingers a moment, like a tracker's memory)
      linger = false;
      boxes.forEach((b) => {
        if (!b.t || b.lost) return;
        const w = want.find(([el]) => el === b.t);
        if (w) { if (w[1] !== b.role) { b.role = w[1]; b.el.classList.toggle("is-lock", w[1] === "pointer"); } return; }
        if (b.role === "pointer" && now - pointerT < 700 && b.t.isConnected) { linger = true; return; }
        release(b);
      });
      // assign the rest; the pointer box is reused so it slides from the last hovered thing to the next
      want.forEach(([el, r]) => {
        if (boxes.some((b) => b.t === el && !b.lost)) return;
        let b = r === "pointer" ? boxes.find((x) => x.role === "pointer" && x.t && !x.lost) : null;
        const hand = !!b;
        if (!b) b = boxes.find((x) => !x.t && x.a < 0.05) || boxes.find((x) => !x.t);
        if (b) assign(b, el, r, now, hand && !reduce.matches);
      });
    }
    let linger = false;

    /** Lose one ambient target: datamosh slices over its box, a new ID when it comes back. */
    function lose(now) {
      if (lite() || reduce.matches || document.hidden) return;
      const b = boxes.find((x) => x.role === "ambient" && x.t && !x.lost && now - x.born > 2200);
      if (!b) return;
      b.lost = now; setText(b, "lost"); b.el.classList.add("is-lost"); cool.set(b.t, now + 1500);
      slices.forEach((s, i) => {
        const y = b.y + Math.random() * b.h, x = b.x - 10 + Math.random() * 30, w = b.w * (0.3 + Math.random() * 0.8), h = 2 + Math.random() * (i % 3 ? 6 : 14);
        s.animate([
          { transform: `translate(${x}px, ${y}px) scale(${w / 100}, ${h / 10})`, opacity: 0.9 },
          { transform: `translate(${x + (Math.random() - 0.5) * 60}px, ${y}px) scale(${w / 100}, ${h / 10})`, opacity: 0.75, offset: 0.4 },
          { transform: `translate(${x + (Math.random() - 0.5) * 120}px, ${y + (Math.random() - 0.5) * 12}px) scale(${(w * 0.6) / 100}, ${h / 10})`, opacity: 0 },
        ], { duration: 260 + i * 30, easing: "steps(5, end)", delay: i * 12 });
      });
      wake();
    }
    let loseT = 0;
    const scheduleLose = () => { loseT = setTimeout(() => { lose(performance.now()); scheduleLose(); }, 7000 + Math.random() * 6000); };
    scheduleLose();

    /* flow field: a sparse grid of arrows, one SVG path, drawn only while scrolling fast */
    function drawFlow(now) {
      if (!flowPath) return;
      const fast = Math.abs(vel) > 1.1 && now - lastScrollT < 120 && !reduce.matches;
      flowA += ((fast ? 1 : 0) - flowA) * (fast ? 0.35 : 0.16);
      if (flowA < 0.02) { if (flow.style.opacity !== "0") { flow.style.opacity = "0"; flowPath.setAttribute("d", ""); } return false; }
      const vw = innerWidth, vh = innerHeight, gap = vw < 700 ? 64 : 92, mag = Math.min(26, Math.abs(vel) * 7), dir = vel > 0 ? -1 : 1, t = now / 1000;
      let d = "";
      for (let y = gap * 0.75; y < vh; y += gap) for (let x = gap / 2; x < vw; x += gap) {
        const n = Math.sin(x * 0.013 + t * 1.7) * Math.cos(y * 0.011 - t * 1.3), ang = n * 0.42, m = mag * (0.55 + 0.45 * Math.abs(Math.sin(x * 0.02 + y * 0.017)));
        if (m < 3) continue;
        const dx = Math.sin(ang) * m, dy = dir * Math.cos(ang) * m, ex = x + dx, ey = y + dy, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, hs = Math.min(5, m * 0.35);
        d += `M${x.toFixed(1)} ${y.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}M${(ex - ux * hs - uy * hs * 0.6).toFixed(1)} ${(ey - uy * hs + ux * hs * 0.6).toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}L${(ex - ux * hs + uy * hs * 0.6).toFixed(1)} ${(ey - uy * hs - ux * hs * 0.6).toFixed(1)}`;
      }
      flowPath.setAttribute("d", d); flow.style.opacity = (flowA * 0.62).toFixed(3);
      return true;
    }

    /* the loop: only while something is moving */
    let raf = 0, frame = 0, fps = 60, lastF = 0, wakeT = 0;
    function wake() { if (lite() || document.hidden) return; wakeT = performance.now(); if (!raf) { lastF = 0; raf = requestAnimationFrame(step); } }
    function step(now) {
      raf = 0;
      if (lite()) { boxes.forEach((b) => { release(b); b.a = 0; b.el.style.opacity = "0"; }); return; }
      if (lastF) { const dt = now - lastF; if (dt > 0 && dt < 250) fps += (1000 / dt - fps) * 0.08; }
      lastF = now; frame++;
      if (frame % 4 === 1) choose(now);
      const snap = reduce.matches, k = snap ? 1 : 0.2;
      let busy = false, n = 0;
      for (const b of boxes) {
        if (b.t && !b.t.isConnected) release(b);
        if (b.lost && now - b.lost > 420) { b.el.classList.remove("is-lost"); b.lost = 0; release(b); }
        if (b.t) {
          const r = b.t.getBoundingClientRect(), p = padOf(b), jit = b.lost ? 4 : 0;
          const tx = r.left - p + (Math.random() - 0.5) * jit, ty = r.top - p + (Math.random() - 0.5) * jit, tw = r.width + p * 2, th = r.height + p * 2;
          b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.w += (tw - b.w) * k; b.h += (th - b.h) * k;
          if (Math.abs(tx - b.x) + Math.abs(ty - b.y) + Math.abs(tw - b.w) + Math.abs(th - b.h) > 0.6) busy = true;
          if (b.y + b.h > 0 && b.y < innerHeight) n++;
          // confidence climbs while it locks on, then breathes a little
          const age = now - b.born;
          if (!b.lost) { if (age < 240 && !snap) setText(b, "acquiring"); else { if (age < 700) busy = true; b.conf += (b.base - b.conf) * (snap ? 1 : 0.18); if (frame % 14 === 0) b.conf = b.base + (Math.random() - 0.5) * 0.02; setText(b, `${labelOf(b.t)} ${Math.min(0.99, b.conf).toFixed(2)}`); } }
        }
        const ta = b.t ? (b.lost ? 0.45 : 1) : 0; b.a += (ta - b.a) * (snap ? 1 : 0.22); if (Math.abs(ta - b.a) > 0.02) busy = true; else b.a = ta;
        if (b.a <= 0.001 && !b.t) { if (b.el.style.opacity !== "0") b.el.style.opacity = "0"; continue; }
        b.el.style.opacity = b.a.toFixed(3);
        const x = b.x, y = b.y, w = Math.max(2, b.w), h = Math.max(2, b.h);
        b.e[0].style.transform = `translate(${x}px, ${y}px) scaleX(${w / 100})`;
        b.e[1].style.transform = `translate(${x}px, ${y + h - 1}px) scaleX(${w / 100})`;
        b.e[2].style.transform = `translate(${x}px, ${y}px) scaleY(${h / 100})`;
        b.e[3].style.transform = `translate(${x + w - 1}px, ${y}px) scaleY(${h / 100})`;
        b.c[0].style.transform = `translate(${x - 1}px, ${y - 1}px)`;
        b.c[1].style.transform = `translate(${x + w - 11}px, ${y - 1}px)`;
        b.c[2].style.transform = `translate(${x - 1}px, ${y + h - 11}px)`;
        b.c[3].style.transform = `translate(${x + w - 11}px, ${y + h - 11}px)`;
        // the label sits outside the top-left corner, or tucks inside when the box touches the top
        b.lbl.style.transform = `translate(${Math.max(4, Math.min(x - 1, innerWidth - 150))}px, ${y < 82 ? y + 3 : y - 19}px)`;
      }
      const flowing = drawFlow(now);
      if (frame % 6 === 0 || !busy) {
        if (hud.fps) hud.fps.textContent = Math.min(120, fps).toFixed(1);
        if (hud.fr) hud.fr.textContent = pad(frame % 1e6, 6);
        if (hud.obj) hud.obj.textContent = String(n);
        if (hud.st) hud.st.textContent = boxes.some((b) => b.lost) ? "lost 1" : "tracking";
      }
      if (busy || flowing || linger || now - wakeT < 650) raf = requestAnimationFrame(step);
      else if (hud.st) { hud.st.textContent = "idle"; tkRoot.classList.remove("tk-busy"); }
      if (raf) tkRoot.classList.add("tk-busy");
    }

    // follow performance mode as it is toggled; the CSS swaps boxes for static annotations
    const still = () => { if (hud.st) hud.st.textContent = "static"; if (hud.obj) hud.obj.textContent = "4"; tkRoot.classList.remove("tk-busy"); };
    if (lite()) still();
    let wasLite = lite();
    const mo = new MutationObserver(() => { if (lite() === wasLite) return; wasLite = lite(); if (wasLite) { still(); cancelAnimationFrame(raf); raf = 0; boxes.forEach((b) => { release(b); b.a = 0; b.el.style.opacity = "0"; }); if (flow) flow.style.opacity = "0"; } else wake(); });
    mo.observe(html, { attributes: true, attributeFilter: ["class"] });
    on(document, "visibilitychange", () => { if (!document.hidden) wake(); });

    // first frame: lock onto the person and the name
    requestAnimationFrame(() => wake());

    return () => { offs.forEach((f) => f()); cancelAnimationFrame(raf); clearInterval(clockT); clearTimeout(loseT); mo.disconnect(); tkRoot.classList.remove("tk-busy"); };
  }

  V6.theme({
    id: "tracker", name: "Tracker", mood: "a vision model watching", dark: false,
    keywords: ["tracker", "tracking", "vision", "computer vision", "cv", "boxes", "bounding", "detect", "detection", "depth", "lab", "yolo", "camera"],
    fonts: "family=Inter+Tight:wght@300..700&family=JetBrains+Mono:wght@400..700",
    swatch: ["#F2F2EE", "#0C0D0F", "#E0103F", "#7E03A8"],
    cardFont: '"Inter Tight", "Geist", sans-serif',
    colors: ["#0B0A3E", "#6E0BA8", "#E0457B", "#FBA93A"],
    shaderScale: 0.5,
    shaderHost: "#tk-gl",
    shader: SHADER,
    render,
    mount,
  });
})();
