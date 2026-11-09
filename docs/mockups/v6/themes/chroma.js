/* Chroma: a festival poster come alive. The site is a Bauhaus tile mosaic laid over a live field of
   Truchet tiles; content cards are tiles that flip into place, decor tiles turn under the pointer,
   and the gaps between them are windows onto the shader. */
(() => {
  "use strict";
  /** Tiny seeded generator so every visit composes the same poster. */
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
  /** One decorative shape tile: two flat colours, a quarter-turn orientation. */
  const tile = (shape, a, b, rot = 0, cls = "") => `<i class="ch-s s-${shape}${cls ? " " + cls : ""}" style="--a:var(--${a});--b:var(--${b});--r:${rot}"></i>`;
  const FAM = { "mind-controlled-arm": "brain", "eeg-thought-prediction": "brain", boilerframe: "vision", "citizen-happiness": "vision", qrify: "web", "habitat-humanity-ecomm": "people" };
  const FAMS = [["brain", "Brain signals", "cb"], ["vision", "Vision + ML", "gr"], ["web", "Web", "pk"], ["people", "Community", "or"]];
  const MOTIF = { brain: ["ring", "pk"], vision: ["qc", "cb"], web: ["check", "bk"], people: ["semi", "cb"] };
  const REG = `<svg class="reg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><path d="M12 0v24M0 12h24"/></svg>`;

  V6.theme({
    id: "chroma", name: "Chroma", mood: "colour as a shout", dark: false,
    keywords: ["chroma", "festival", "poster", "bauhaus", "colour", "color", "tiles", "joy", "mosaic", "bright"],
    fonts: "family=Unbounded:wght@400;500;700;800;900&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600",
    swatch: ["#2230FF", "#F4F4EF", "#FF5CF0", "#00F03C"],
    cardFont: '"Unbounded", sans-serif',
    colors: ["#2230FF", "#00F03C", "#FF5CF0", "#FF4A00"],
    shaderScale: 0.5,
    shader: `
#define PI 3.14159265
vec3 pal(float i){
  vec3 c = u_c0;
  c = mix(c, u_c1, step(.5, i)); c = mix(c, u_c2, step(1.5, i)); c = mix(c, u_c3, step(2.5, i));
  c = mix(c, vec3(.827), step(3.5, i)); c = mix(c, vec3(.039), step(4.5, i));
  return c;
}
float fill(float d, float w){ return 1. - smoothstep(-w, w, d); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// coverage of colour A for one motif; P = block space 0..1, p = cell space 0..1, w = AA width in block units
float motif(float t, vec2 P, vec2 p, float w){
  if (t < 1.) return fill(length(P) - 1., w);                              // big quarter circle
  if (t < 2.) return fill(abs(length(P) - .72) - .26, w);                  // quarter ring
  if (t < 3.) return fill(length(P - vec2(.5, 0.)) - .5, w);               // semicircle
  if (t < 4.) { vec2 g = P * 4.; vec2 s = floor(g); vec2 f = fract(g);     // staircase
    float k = s.x + s.y, w4 = w * 4.;
    if (k < 2.5) return 1.; if (k > 4.5) return 0.;
    if (k < 3.5) return min(fill(f.x - 1., w4), fill(f.y - 1., w4));
    return max(fill(f.x, w4), fill(f.y, w4)); }
  if (t < 5.) { vec2 g = abs(fract(P * 2.) - .5) - .25;                    // checkerboard
    vec2 sg = clamp(g / (w * 2.), -1., 1.); return .5 + .5 * sg.x * sg.y; }
  if (t < 6.) { float d = min(abs(length(p) - .5), abs(length(p - 1.) - .5)) - .17; // truchet arcs
    return fill(d, w * 2.); }
  return fill(length(P - .5) - .36, w);                                     // disc
}
void main(){
  float N = u_res.x < u_res.y ? 6. : 5.;
  float px = N / u_res.y;                      // cell units per pixel: crisp edges without fwidth
  vec2 uv = gl_FragCoord.xy * px;
  float drift = u_scroll * 6.;
  uv.y -= drift;
  vec2 cell = floor(uv);
  vec2 q = fract(uv) - .5;

  // a slow travelling wave: each cell flips over as the front passes and lands on a new face
  float ph = u_time * .07 + dot(cell, vec2(-.075, .055)) + hash21(cell) * .1;
  float k = floor(ph), f = fract(ph);
  float fl = smoothstep(0., .16, f);
  float face = k + step(.5, fl);
  float sq = max(abs(cos(PI * fl)), .02);
  float axis = step(.5, hash21(cell + 4.2 + k));

  // the pointer turns nearby tiles a quarter, lifting them as they go
  vec2 m = u_mouse * u_res * px; m.y -= drift;
  float inf = 1. - smoothstep(.55, 2.7, length(cell + .5 - m));
  float lift = 1. - .2 * sin(PI * inf);
  vec2 l = rot(inf * PI * .5) * q / lift;
  if (axis < .5) l.x /= sq; else l.y /= sq;
  float w = px / lift;
  float inside = fill(max(abs(l.x), abs(l.y)) - .5, w / sq);

  // each 2x2 block shares a motif, two colours and an orientation
  vec2 bc = floor(cell * .5);
  vec2 bp = cell - bc * 2.;
  float hb = hash21(bc * 1.37 + face * 11.3), hc = hash21(bc * 2.71 + face * 5.9 + 3.);
  float t = floor(hb * 7.);
  float ci = floor(hc * 6.), cj = mod(ci + 1. + floor(fract(hc * 13.7) * 5.), 6.);
  vec2 p = l + .5;
  vec2 P = (bp + p) * .5 - .5;
  float r = floor(fract(hb * 31.7) * 4.);
  if (r > .5) P = vec2(-P.y, P.x);
  if (r > 1.5) P = vec2(-P.y, P.x);
  if (r > 2.5) P = vec2(-P.y, P.x);
  P += .5;
  vec2 pc = p; if (hash21(cell + face * 3.7) > .5) pc.x = 1. - pc.x;
  float a = motif(t, P, pc, w * .5);
  vec3 col = mix(pal(ci), pal(cj), a);
  col = mix(vec3(.039), col, inside);

  // print grain so the capped resolution reads as paper, not blur
  col += (hash21(gl_FragCoord.xy * .73 + 1.7) - .5) * .05;
  gl_FragColor = vec4(col, 1.);
}`,

    render(C, H) {
      const { esc, icon, logo, portrait } = H;
      const [school, statusRaw] = C.status.split(" · ");
      const status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
      const FX = [["01", "flip"], ["04", "stair"], ["35", "turn"]];
      const words = C.name.split(" ").map((w, i) => `<span class="w-line wl${i + 1}"><span class="w" data-fx="${FX[i][1]}">${[...w].map((ch, j) => `<span class="l" style="--i:${j}">${esc(ch)}</span>`).join("")}<sup class="ix">${FX[i][0]}</sup></span></span>`).join("");
      const mail = C.links.email;

      /* ── portrait cluster: shapes peek around the photo, light ground under the beams ── */
      /* the ouroboros mark is the recurring motif: a tile that turns like every other shape */
      const markTile = (fg, bg, cls = "", kind) => `<i class="ch-s s-mark${cls ? " " + cls : ""}" style="--a:var(--${fg});--b:var(--${bg});--r:0">${H.mark(kind)}</i>`;
      const field = [tile("qc", "pk", "cb", 1, "f1"), tile("semi", "or", "wh", 2, "f3"), tile("stair", "gr", "wh", 0, "f2 still"), tile("check", "bk", "wh", 0, "f5"), markTile("bk", "gy", "f4")].join("");
      const r9 = rng(9), dots = Array.from({ length: 14 }, (_, i) => `<circle cx="${(10 + r9() * 80).toFixed(1)}" cy="${(10 + r9() * 80).toFixed(1)}" r="5.5" style="--dx:${((r9() - .5) * 26).toFixed(1)}px;--dy:${((r9() - .5) * 26).toFixed(1)}px"/>`).join("");
      const ART = {
        records: `<i class="vinyl"><i class="lbl">${H.mark()}</i></i>`,
        artboard: `<svg viewBox="0 0 100 100"><path class="ax" d="M50 6V94"/><g class="sq"><path class="s1" pathLength="1" d="M50 18C26 8 10 30 28 44S20 78 50 84"/><path class="s1 m" pathLength="1" d="M50 18C26 8 10 30 28 44S20 78 50 84"/><circle class="s2" cx="32" cy="28" r="6"/><circle class="s2 m" cx="32" cy="28" r="6"/></g></svg>`,
        typeracer: `<span class="tr-art">Aa<i></i></span>`,
        angle: `<svg viewBox="0 0 100 100"><path class="a1" d="M14 82H92"/><g class="a2"><path d="M14 82L80 26"/></g><path class="arc" d="M44 82A30 30 0 0 0 37 63"/><circle cx="14" cy="82" r="5"/></svg>`,
        dots: `<svg viewBox="0 0 100 100">${dots}</svg>`,
        center: `<svg viewBox="0 0 100 100"><rect class="box" x="6" y="18" width="88" height="64"/><circle class="tg" cx="50" cy="50" r="7"/><rect class="dv" x="62" y="54" width="22" height="14"/></svg>`,
      };
      const ptBg = [
        tile("qc", "pk", "cb", 1, "pa"), tile("ring", "gr", "cb", 2, "pb"), tile("solid", "cb", "cb", 0, "pc still"), tile("solid", "cb", "cb", 0, "pd still"),
        tile("solid", "gy", "gy", 0, "pe still"), tile("solid", "wh", "wh", 0, "pf still"),
      ].join("");

      const fams = Object.fromEntries(FAMS.map((f) => [f[0], f]));
      const card = (p, i) => {
        const fam = FAM[p.slug] || "web", [mshape, mcol] = MOTIF[fam];
        return `<a class="ch-card ch-rv k${i + 1} fam-${fam}" id="work-${p.slug}" href="#work-${p.slug}" data-case="${p.slug}" data-fam="${fam}" style="--d:${i}">
          <span class="cd-in">
            <span class="cd-f">
              <span class="cd-top"><span class="cd-n">${String(i + 1).padStart(2, "0")}</span><span class="cd-kind">${esc(p.kind)}</span><span class="cd-ic">${icon(p.icon)}</span></span>
              <span class="cd-m" aria-hidden="true">${tile(mshape, mcol, "none", i % 4)}</span>
              <span class="cd-title">${esc(p.title)}</span>
              <span class="cd-head">${esc(p.headline)}</span>
            </span>
            <span class="cd-b" aria-hidden="true">
              <span class="cd-ctx">${esc(p.ctx)}</span>
              <span class="cd-desc">${esc(p.desc[0])}</span>
              <span class="cd-tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</span>
              <span class="cd-go">Open the case ${icon("arrow-up-right")}</span>
            </span>
          </span></a>`;
      };

      const exp = C.experience;
      const role = (x, i) => `<article class="ch-role ch-rv x-r${i + 1}" id="experience-${x.slug}" style="--d:${i}">
          <p class="ro-when"><span>${esc(x.when)}</span><span>${esc(x.where)}</span></p>
          <h3>${esc(x.role)}</h3><p class="ro-org">${esc(x.org)}</p>
          <ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
          <p class="ro-tags">${x.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p></article>`;
      const year = (w) => esc(w.split(" ")[0]);

      const nowRows = [["Building", C.now.building, "bk"], ["Researching", C.now.researching, "gr"], ["Learning", C.now.learning, "pk"]];
      const placeName = { home: "Home", school: "School", now: "Now" };
      const lineupCls = ["lu-a", "lu-b", "lu-c", "lu-d"];

      const slug = (n, label, extra) => `<div class="ch-slug" aria-hidden="true">${REG}<span>${n}</span><span>${label}</span><i></i><span>${extra}</span><span class="sw"><b class="cb"></b><b class="gr"></b><b class="pk"></b><b class="or"></b><b class="gy"></b><b class="bk"></b></span>${REG}</div>`;

      return `<div class="ch" id="ch">
  <div class="ch-frame" aria-hidden="true">
    <span class="fr-c tl">${REG}</span><span class="fr-c tr">${REG}</span><span class="fr-c bl">${REG}</span><span class="fr-c br">${REG}</span>
    <span class="fr-bar"><b class="cb"></b><b class="gr"></b><b class="pk"></b><b class="or"></b><b class="gy"></b><b class="bk"></b></span>
    <span class="fr-side">rithvik.ai · v6 chroma · proof 01 · 4 colour + key</span>
  </div>

  <header class="ch-nav">
    <a class="ch-logo" href="#top" aria-label="Back to top">${H.mark()}</a>
    <nav class="ch-links" aria-label="Sections">
      <a href="#work"><sup>02</sup>Work</a><a href="#experience"><sup>03</sup><span class="lg">Experience</span><span class="sm">Roles</span></a><a href="#about"><sup>04</sup>About</a><a href="#play"><sup>05</sup>Play</a><a href="#contact"><sup>06</sup>Contact</a>
    </nav>
    <button type="button" class="ch-navcv" data-resume>Resume</button>
  </header>

  <section id="top" class="ch-sec ch-hero" aria-labelledby="ch-name">
    <div class="h-field" aria-hidden="true">${field}</div>
    <h1 class="h-name" id="ch-name" aria-label="${esc(C.name)}"><span aria-hidden="true">${words}</span></h1>
    <div class="ch-t h-status"><span class="dot" aria-hidden="true"></span><p><b>${esc(status)}</b><span>${esc(school)}</span></p></div>
    <div class="ch-t h-role"><p class="k">${esc(C.role)}</p><p class="line">${esc(C.line)}</p></div>
    <button type="button" class="ch-t ch-act h-resume" data-resume><span class="arr">${icon("arrow-up-right")}</span><b>Resume</b><span class="sub">${icon("file-text")} Open the PDF</span></button>
    <button type="button" class="ch-t ch-act h-email" data-compose><span class="ai">${icon("mail")}</span><span class="tx"><b>Email me</b><span class="sub">${esc(mail)}</span></span></button>
    <button type="button" class="ch-t ch-act h-ask" data-agent><span class="pr" aria-hidden="true">❯</span><span class="tx"><b>Ask my agent</b><span class="sub">projects, stack, availability</span></span><kbd>⌘K</kbd></button>
    <div class="ch-win h-win"><div class="lg" role="group" aria-label="Replay the headline effects"><span class="lg-k">Effects</span>${FX.map(([n, fx]) => `<button type="button" data-fx-go="${fx}">${n} ${fx}</button>`).join("")}<button type="button" class="rp" data-fx-go="all">Replay</button></div></div>
    <div class="h-pt">
      <div class="pt-bg" aria-hidden="true">${ptBg}</div>
      <div class="pt-wrap">${portrait({ id: "chroma" })}</div>
      <p class="h-now"><span class="k">Now</span><span>${esc(C.now.city)}</span><b data-clock="${C.now.tz}"></b></p>
    </div>
  </section>

  ${slug("02", "Work", "6 projects, from headsets to the cloud")}
  <section id="work" class="ch-sec ch-work" aria-labelledby="ch-work-h">
    <div class="ch-t ch-rv w-head" style="--d:0"><h2 id="ch-work-h">Work<sup>02</sup></h2><p>Six projects, from headsets to the cloud.</p></div>
    <div class="ch-t ch-rv w-filter" style="--d:1" role="group" aria-label="Filter projects by colour">
      <span class="fl-k">Filter by colour</span>
      ${FAMS.map(([id, label, c]) => `<button type="button" class="sw-chip" data-fam="${id}" aria-pressed="false" style="--c:var(--${c})"><i></i>${esc(label)}<span>${C.projects.filter((p) => FAM[p.slug] === id).length}</span></button>`).join("")}
      <button type="button" class="sw-chip all" data-fam="all" aria-pressed="true"><i></i>All<span>${C.projects.length}</span></button>
    </div>
    ${C.projects.map(card).join("")}
  </section>

  ${slug("03", "Experience", "4 roles · 1 school")}
  <section id="experience" class="ch-sec ch-exp" aria-labelledby="ch-exp-h">
    <div class="ch-t ch-rv x-head" style="--d:1"><h2 id="ch-exp-h">Experience<sup>03</sup></h2><p>Research, software and teaching, newest first.</p></div>
    ${exp.map(role).join("")}
    <div class="x-st x-st1 ch-rv" aria-hidden="true" style="--d:2"><b>${year(exp[1].when)}</b></div>
    <div class="x-st x-st2 ch-rv" aria-hidden="true" style="--d:3"><b>${year(exp[2].when)}</b></div>
    <div class="x-st x-st3 ch-rv" aria-hidden="true" style="--d:4"><b>${year(exp[3].when)}</b></div>
    <div class="ch-win x-w x-w2" aria-hidden="true"></div><div class="ch-win x-w x-w3" aria-hidden="true"></div>
    <article class="ch-t ch-rv x-edu" id="education" style="--d:5">
      <span class="edu-logo"><img src="${esc(C.education.logo)}" alt="" width="64" height="64"></span>
      <div><p class="edu-k">Education</p><h3>${esc(C.education.school)}</h3><p>${esc(C.education.degree)}</p><p class="edu-m">${esc(C.education.focus)} · ${esc(C.education.grad)}</p></div>
    </article>
    <div class="ch-rv x-z" aria-hidden="true" style="--d:6">${markTile("bk", "pk", "still spin")}</div>
  </section>

  ${slug("04", "About", `${esc(C.now.city)} · ${esc(C.now.researching)}`)}
  <section id="about" class="ch-sec ch-about" aria-labelledby="ch-about-h">
    <div class="ch-t ch-rv a-text" style="--d:0"><h2 id="ch-about-h">About<sup>04</sup></h2>${C.about.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    ${C.numbers.map(([n, l], i) => `<div class="ch-t ch-rv a-n a-n${i + 1}" style="--d:${i + 1}"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}
  </section>

  ${slug("04", "Now", `${esc(C.now.city)} · ${esc(C.now.researching)}`)}
  <section class="ch-sec ch-now" aria-labelledby="ch-now-h">
    <h2 class="sr-only" id="ch-now-h">Now and places</h2>
    ${nowRows.map(([k, v, c], i) => `<div class="ch-t ch-rv a-now a-now${i + 1}" style="--d:${i}"><span class="k">${k}</span><b>${esc(v)}</b></div>`).join("")}
    ${C.places.map((p, i) => `<div class="ch-t ch-rv a-pl a-pl${i + 1}" style="--d:${i}"><span class="sun" aria-hidden="true"></span><span class="k">${placeName[p.key] || esc(p.key)}</span><b data-clock="${p.tz}"></b><span class="city">${esc(p.city)}</span></div>`).join("")}
  </section>

  ${slug("04", "Line-up", "the stack, festival style")}
  <section class="ch-sec ch-stack" aria-labelledby="ch-stack-h">
    <div class="ch-t ch-rv a-lineup" style="--d:0">
      <h2 class="lu-h" id="ch-stack-h"><span>Line-up</span><span>The stack, festival style</span></h2>
      ${Object.entries(C.stack).map(([cat, items], i) => `<p class="lu-row ${lineupCls[i]}"><span class="lu-cat">${esc(cat)}</span>${items.map((t, j) => `<span class="lu-i c${(j + i) % 4}">${esc(t)}</span>`).join('<i aria-hidden="true">/</i>')}</p>`).join("")}
    </div>
  </section>

  ${slug("05", "Play", "six small toys")}
  <section id="play" class="ch-sec ch-play" aria-labelledby="ch-play-h">
    <div class="ch-t ch-rv p-head" style="--d:0"><h2 id="ch-play-h">Play<sup>05</sup></h2><p>Six small toys. Pick one.</p></div>
    ${(H.PLAY || []).map((t, i) => `<button type="button" class="ch-t ch-rv ch-act p-toy p-${t.id}" data-play="${t.id}" style="--d:${i + 1}"><span class="p-n">${String(i + 1).padStart(2, "0")}</span><span class="p-art" aria-hidden="true">${ART[t.id] || ""}</span><span class="p-tx"><b>${esc(t.name)}</b><span class="sub">${esc(t.desc)}</span></span></button>`).join("")}
  </section>

  ${slug("Q", "Questions", "tap a tile to turn it over")}
  <section class="ch-sec ch-faq" aria-labelledby="ch-faq-h">
    <div class="ch-t ch-rv q-head" style="--d:0"><h2 id="ch-faq-h">Questions</h2><p>Tap a tile to turn it over.</p></div>
    ${C.faq.map(([q, a], i) => `<div class="ch-q ch-rv q${i + 1}" style="--d:${i + 1}"><div class="fq-in"><button type="button" class="fq-f" aria-expanded="false" aria-controls="ch-fa-${i}"><span class="fq-n">Q${i + 1}</span><span class="fq-t">${esc(q)}</span><span class="fq-turn">${icon("rotate-ccw")}</span></button><p class="fq-b" id="ch-fa-${i}" aria-hidden="true">${esc(a)}</p></div></div>`).join("")}
    <div class="ch-rv q-z1" aria-hidden="true" style="--d:2">${tile("circle", "gr", "wh", 0, "still")}</div>
    <div class="ch-rv q-z2" aria-hidden="true" style="--d:4">${markTile("wh", "cb", "still spin", "hatch")}</div>
  </section>

  ${slug("06", "Contact", esc(mail))}
  <section id="contact" class="ch-sec ch-contact" aria-labelledby="ch-contact-h">
    <div class="ch-t ch-rv c-big" style="--d:0">
      <h2 id="ch-contact-h">Contact<sup>06</sup></h2>
      <button type="button" class="c-write" data-compose><span class="c-w1">Write to me</span><span class="c-mail">${esc(mail)}</span><span class="arr">${icon("arrow-up-right")}</span></button>
      <button type="button" class="c-copy" data-copy="${esc(mail)}">${icon("copy")} Copy address</button>
    </div>
    <a class="ch-t ch-rv ch-act c-gh" style="--d:1" href="${C.links.github}" target="_blank" rel="noopener">${logo("github")}<b>GitHub</b><span class="sub">rithvikpkx</span></a>
    <a class="ch-t ch-rv ch-act c-li" style="--d:2" href="${C.links.linkedin}" target="_blank" rel="noopener">${logo("linkedin")}<b>LinkedIn</b><span class="sub">Profile</span></a>
    <button type="button" class="ch-t ch-rv ch-act c-cv" style="--d:3" data-resume>${icon("file-text")}<b>Resume</b><span class="sub">PDF</span></button>
    <button type="button" class="ch-t ch-rv ch-act c-ask" style="--d:4" data-agent><span class="pr" aria-hidden="true">❯</span><b>Ask</b><span class="sub">the agent</span></button>
    <div class="ch-t ch-rv c-colo" style="--d:2"><p class="k">Colophon</p><p>Set in Unbounded and Inter Tight. The ground is one shader of Truchet tiles on a travelling wave. Move the pointer to turn them.</p></div>
    <div class="ch-t ch-rv c-log" style="--d:3"><p class="k">Recent commits</p><ul>${C.log.slice(0, 3).map(([d, t, m]) => `<li><span>${esc(d)}</span><b class="t-${t}">${esc(t)}</b>${esc(m)}</li>`).join("")}</ul></div>
  </section>
  <footer class="ch-foot"><span class="f-mark" aria-hidden="true">${H.mark()}</span><span>${esc(C.name)}</span><span>rithvik.ai</span><span class="sw"><b class="cb"></b><b class="gr"></b><b class="pk"></b><b class="or"></b></span></footer>
</div>`;
    },

    mount(root, H) {
      const ch = root.querySelector("#ch");
      const offs = [];
      const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };
      const calm = () => H.reduceMotion();

      /* below-the-fold tiles flap into place as their section arrives (the first screen never waits) */
      const secs = [...ch.querySelectorAll(".ch-sec:not(.ch-hero)")];
      const live = new Set(), timers = [];
      if (!calm() && "IntersectionObserver" in window) {
        secs.forEach((s) => { const r = s.getBoundingClientRect(); if (r.top > innerHeight) s.classList.add("armed"); });
      }
      const io = new IntersectionObserver((en) => en.forEach((e) => {
        if (e.isIntersecting) { const s = e.target; if (s.classList.contains("armed") && !s.classList.contains("on")) { s.classList.add("on"); timers.push(setTimeout(() => s.classList.remove("armed", "on"), 1900)); } live.add(s); s.classList.add("vis"); } else { live.delete(e.target); e.target.classList.remove("vis"); }
      }), { rootMargin: "0px 0px -12% 0px" });
      [ch.querySelector(".ch-hero"), ...secs].forEach((s) => io.observe(s));

      /* nav tags light up for the section in view */
      const links = [...ch.querySelectorAll(".ch-links a")];
      const navIo = new IntersectionObserver((en) => en.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle("cur", a.getAttribute("href") === "#" + e.target.id));
      }), { rootMargin: "-45% 0px -50% 0px" });
      ["work", "experience", "about", "play", "contact"].forEach((id) => { const el = ch.querySelector("#" + id); if (el) navIo.observe(el); });

      /* decor tiles turn a quarter as the pointer crosses them (tap on touch) */
      const turn = (t) => { const r = (parseInt(t.style.getPropertyValue("--r"), 10) || 0) + 1; t.style.setProperty("--r", r); };
      let lastT = null;
      if (H.fine.matches) on(ch, "pointerover", (e) => { const t = e.target.closest(".ch-s"); if (t && t !== lastT && !t.closest(".cd-m") && !t.classList.contains("still")) { lastT = t; turn(t); } });
      on(ch, "click", (e) => { const t = e.target.closest(".h-field .ch-s, .pt-bg .ch-s"); if (t && !t.classList.contains("still")) turn(t); });

      /* ambient: every so often one visible decor tile turns by itself */
      const amb = setInterval(() => {
        if (calm() || document.hidden) return;
        const pool = [];
        live.forEach((s) => s.querySelectorAll(".h-field .ch-s:not(.still), .pt-bg .ch-s:not(.still), .cd-m .ch-s").forEach((t) => pool.push(t)));
        if (pool.length) turn(pool[(Math.random() * pool.length) | 0]);
      }, 1400);

      /* colour-swatch filter: tiles outside the colour collapse into a dot of their colour */
      const chips = [...ch.querySelectorAll(".sw-chip")], cards = [...ch.querySelectorAll(".ch-card")];
      on(ch.querySelector(".w-filter"), "click", (e) => {
        const b = e.target.closest(".sw-chip"); if (!b) return;
        let f = b.dataset.fam;
        if (f !== "all" && b.getAttribute("aria-pressed") === "true") f = "all";
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.fam === f)));
        cards.forEach((c) => { const out = f !== "all" && c.dataset.fam !== f; c.classList.toggle("out", out); out ? c.setAttribute("tabindex", "-1") : c.removeAttribute("tabindex"); c.setAttribute("aria-hidden", String(out)); });
      });

      /* FAQ tiles turn over to show the answer */
      on(ch.querySelector(".ch-faq"), "click", (e) => {
        const q = e.target.closest(".ch-q"); if (!q) return;
        const open = !q.classList.contains("flip");
        q.classList.toggle("flip", open);
        q.querySelector(".fq-f").setAttribute("aria-expanded", String(open));
        q.querySelector(".fq-b").setAttribute("aria-hidden", String(!open));
      });

      /* headline effects: each word has an indexed effect; hover replays it, the legend replays any */
      const playWord = (w) => { w.classList.remove("go"); void w.offsetWidth; w.classList.add("go"); };
      const words = [...ch.querySelectorAll(".h-name .w")];
      on(ch.querySelector(".h-win .lg"), "click", (e) => {
        const b = e.target.closest("[data-fx-go]"); if (!b) return;
        words.filter((w) => b.dataset.fxGo === "all" || w.dataset.fx === b.dataset.fxGo).forEach(playWord);
      });
      if (H.fine.matches) words.forEach((w) => on(w, "pointerenter", () => { if (!w.classList.contains("go") || w.getAnimations({ subtree: true }).length === 0) playWord(w); }));
      if (!calm()) requestAnimationFrame(() => words.forEach(playWord));

      /* arrival: a wave turns the hero tiles over in staircase order, echoing the shader's wave */
      if (!calm()) {
        const hero = ch.querySelector(".ch-hero"), hr = hero.getBoundingClientRect(), u = hr.width / (innerWidth >= 1100 ? 12 : 4) || 100;
        hero.querySelectorAll(".ch-s").forEach((t) => {
          const r = t.getBoundingClientRect(); if (r.top > innerHeight || r.width === 0) return;
          const step = Math.round((r.left - hr.left) / u) + Math.round((r.top - hr.top) / u);
          timers.push(setTimeout(() => turn(t), 380 + step * 85));
        });
      }

      /* clocks tick over without a re-render */
      const tick = setInterval(() => ch.querySelectorAll("[data-clock]").forEach((el) => (el.textContent = H.clock(el.dataset.clock))), 30000);

      return () => { offs.forEach((f) => f()); io.disconnect(); navIo.disconnect(); clearInterval(amb); clearInterval(tick); timers.forEach(clearTimeout); };
    },
  });
})();
