/* stipple: a hand-printed pamphlet that breathes. One centred column on peach stock; a cloud of
   ink dots (domain-warped fbm thresholded by interleaved-gradient noise) drifts behind the type and
   shies away from the pointer. Projects are numbered dispatches, experience an errata slip, contact
   a vermilion seal. A square lens reveals the crisp plate under the stippled print.
   Where each effect lives, and why:
   - Shader cloud: full density on the cover (the arrival moment), thinning per chapter via u_scroll and
     knocked out behind every reading block by feathered paper plates, so text always sits on clean stock.
   - Square lens: the cover name (idle drift, pointer-driven on fine pointers) and the dispatch plates
     (hover only), because revealing the crisp plate is the one "magic trick" and should stay rare.
   - SVG stipple filter: display type only (name, chapter numerals, dispatch plates, colophon mark); static,
     rasterised once. Body text is never filtered.
   - Performance mode (html.lite): shader is frozen by the core; here the lens, drift, seal spin, pulse and
     every SVG filter switch off, leaving a crisp two-ink letterpress still. */
(function () {
  "use strict";

  const SHADER = `
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  float t = u_time;
  // the cloud parts around the pointer: push the domain outward, then clear a soft hollow
  vec2 dm = p - m; float r2 = dot(dm, dm);
  p += dm * exp(-r2 * 6.) * .7;
  float hollow = exp(-r2 * 34.);
  float breath = .5 + .5 * sin(t * .42);
  vec2 sp = p * 1.05 + vec2(0., -u_scroll * 2.6);
  vec2 q = vec2(fbm(sp + vec2(0., t * .035)), fbm(sp + vec2(5.2, 1.3) + vec2(t * .028, 0.)));
  float n = fbm(sp * 1.35 + 1.8 * q + vec2(1.7, 9.2) - vec2(t * .012, t * .018));
  // ink density follows the chapters: heavy on the cover, thinning and returning as you read
  float chap = .5 + .5 * cos(u_scroll * 6.2832 * 2.5);
  float d = smoothstep(-.02, .78, n + .16 * breath - .1 + .16 * chap);
  d = d * d * (.5 + .5 * chap) * .8;
  float col = (1. - smoothstep(.15, .34, abs(uv.x - .5))) * smoothstep(1.05, 1.45, asp);
  d *= 1. - .4 * col;
  d *= 1. - .92 * hollow;
  float th = ign(fc);
  float ink = step(th, d * .86);
  // second plate: vermilion, sparse, misregistered from the ink so it reads like a riso overprint
  float dv = smoothstep(.05, .7, q.y + .45 * n - .1) * smoothstep(.02, .35, d);
  float ver = step(ign(fc + vec2(23., 7.)), dv * (.16 + .16 * breath) * (1. - hollow));
  // a faint ring of blue dots where the pointer breathes on the glass
  float rr = sqrt(r2);
  float ring = exp(-pow((rr - .085 - .01 * breath) * 60., 2.)) * .12;
  float blu = step(ign(fc + vec2(61., 113.)), ring);
  // paper: warm fibres and a fixed grain so the low-res canvas reads as stock, not blur
  float fib = vnoise(fc * vec2(.7, .06) + 3.1);
  vec3 c = u_c0 * (1. + .028 * (fib - .5)) + (hash21(fc) - .5) * .022;
  c = mix(c, u_c3, blu * .85);
  c = mix(c, u_c2, ver * .92);
  c = mix(c, u_c1, ink * .92);
  gl_FragColor = vec4(c, 1.);
}`;

  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  // coupon fine print, one per toy
  const GOOD = { records: "Good for one scratch", artboard: "Good for one doodle", typeracer: "Good for one sprint", angle: "Good for one guess", dots: "Good for one squint", center: "Good for one div" };
  const SCISSORS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/></svg>`;

  // Small abstract plates per dispatch, drawn once and stippled by the shared SVG filter.
  const ART = {
    "mind-controlled-arm": `<circle cx="104" cy="92" r="50"/><path d="M150 118 L214 84 L266 134" fill="none" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/><circle cx="274" cy="142" r="18"/>`,
    boilerframe: `<rect x="62" y="34" width="196" height="122" fill="none" stroke-width="22"/><circle cx="160" cy="92" r="30"/><rect x="62" y="170" width="18" height="12"/><rect x="104" y="170" width="18" height="12"/><rect x="146" y="170" width="18" height="12"/><rect x="230" y="170" width="28" height="12"/>`,
    "eeg-thought-prediction": `<path d="M14 104 C 48 18, 82 190, 116 104 S 184 18, 218 104 S 280 170, 306 92" fill="none" stroke-width="24" stroke-linecap="round"/><circle cx="62" cy="168" r="13"/><circle cx="258" cy="36" r="13"/>`,
    "citizen-happiness": `<rect x="64" y="104" width="34" height="70"/><rect x="122" y="70" width="34" height="104"/><rect x="180" y="40" width="34" height="134"/><path d="M40 140 Q 160 150 280 30" fill="none" stroke-width="16" stroke-linecap="round"/>`,
    qrify: `<rect x="58" y="28" width="58" height="58" fill="none" stroke-width="16"/><rect x="77" y="47" width="20" height="20"/><rect x="204" y="28" width="58" height="58" fill="none" stroke-width="16"/><rect x="223" y="47" width="20" height="20"/><rect x="58" y="114" width="58" height="58" fill="none" stroke-width="16"/><rect x="77" y="133" width="20" height="20"/><rect x="140" y="40" width="20" height="20"/><rect x="140" y="96" width="38" height="20"/><rect x="204" y="118" width="20" height="54"/><rect x="242" y="140" width="20" height="20"/><rect x="152" y="140" width="20" height="32"/>`,
    "habitat-humanity-ecomm": `<path d="M78 104 L160 36 L242 104 Z"/><path d="M98 104 H222 V174 H174 V128 H146 V174 H98 Z"/><circle cx="262" cy="56" r="12"/>`,
  };

  const readSecs = (p) => Math.max(6, Math.round(([p.headline, p.ctx, ...p.desc].join(" ").split(/\s+/).length / 230) * 60));

  function render(C, H) {
    const { esc, icon, logo, portrait } = H;
    const pad = (i) => String(i + 1).padStart(2, "0");
    const nameInner = `<span class="st-n1">${esc(C.first)}</span><span class="st-n2"><i>Praveen</i> Kumar</span>`;
    const toc = [["Foreword", "about"], ["Dispatches", "work"], ["Errata", "experience"], ["The map", "graph"], ["Correspondence", "faq"], ["Supplement", "play"], ["The seal", "contact"]];
    const placeKey = { home: "home", school: "school", now: "here now" };

    const dispatch = (p, i) => `
      <a class="st-dsp st-dsp-${i + 1}" href="#work" data-case="${p.slug}" aria-label="Dispatch No. ${pad(i)}: ${esc(p.title)}. Read the dispatch">
        <span class="st-stamp"><span>No. ${pad(i)}</span><span>${readSecs(p)} sec read</span></span>
        <span class="st-art" data-lens aria-hidden="true">
          <svg class="st-art-base" viewBox="0 0 320 200"><g filter="url(#st-fz-art)" fill="#17110E" stroke="#17110E">${ART[p.slug] || ""}</g></svg>
          <svg class="st-art-crisp" viewBox="0 0 320 200"><g fill="#FF3B1F" stroke="#FF3B1F">${ART[p.slug] || ""}</g></svg>
          <span class="st-lens-frame"><i></i></span>
        </span>
        <span class="st-kind">${icon(p.icon)}${esc(p.kind)}</span>
        <span class="st-dsp-t">${esc(p.title)}</span>
        <span class="st-dsp-h">${esc(p.headline)}</span>
        ${i === 0 ? `<span class="st-dsp-c">${esc(p.ctx)}</span><span class="st-dsp-d">${p.desc.map(esc).join(" ")}</span><span class="st-dsp-tags">${p.tags.map(esc).join(" · ")}</span>` : ""}
        <span class="st-more">Read the dispatch <span aria-hidden="true">→</span></span>
      </a>`;

    return `<div class="st">
  <svg class="st-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
    <filter id="st-fz" x="-15%" y="-25%" width="130%" height="150%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="1" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="na"/>
      <feComposite in="b" in2="na" operator="arithmetic" k2="1.14" k3="-1" k4=".02" result="d"/>
      <feComponentTransfer in="d" result="t"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
      <feFlood flood-color="#17110E"/><feComposite in2="t" operator="in"/>
    </filter>
    <filter id="st-fz-s" x="-10%" y="-30%" width="120%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.3" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="na"/>
      <feComposite in="b" in2="na" operator="arithmetic" k2="1.3" k3="-1" k4=".04" result="d"/>
      <feComponentTransfer in="d" result="t"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
      <feFlood flood-color="#17110E"/><feComposite in2="t" operator="in"/>
    </filter>
    <filter id="st-fz-m" x="-15%" y="-20%" width="130%" height="140%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency="1" numOctaves="1" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="na"/>
      <feComposite in="b" in2="na" operator="arithmetic" k2="1.3" k3="-1" k4=".03" result="d"/>
      <feComponentTransfer in="d" result="t"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
      <feFlood flood-color="#17110E"/><feComposite in2="t" operator="in"/>
    </filter>
    <filter id="st-fz-xs" x="-10%" y="-30%" width="120%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation=".6" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="5" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="na"/>
      <feComposite in="b" in2="na" operator="arithmetic" k2="1.75" k3="-1" k4=".02" result="d"/>
      <feComponentTransfer in="d" result="t"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
      <feFlood flood-color="#17110E"/><feComposite in2="t" operator="in"/>
    </filter>
    <filter id="st-fz-art" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="5.5" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="11" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="na"/>
      <feComposite in="b" in2="na" operator="arithmetic" k2="1.2" k3="-1" k4=".04" result="d"/>
      <feComponentTransfer in="d" result="t"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer>
      <feFlood flood-color="#17110E"/><feComposite in2="t" operator="in"/>
    </filter>
    <filter id="st-seal" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="5" result="w"/>
      <feDisplacementMap in="SourceGraphic" in2="w" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs></svg>

  <header class="st-mast" aria-label="Masthead">
    <span class="st-mast-l">Issue No. 06 <span class="st-sep">·</span> price: one email</span>
    <a class="st-mast-c" href="#top" aria-label="rithvik.ai, back to the cover"><span class="st-mark" aria-hidden="true">${H.mark("hatch")}</span><span>rithvik.ai</span></a>
    <span class="st-mast-r"><span data-clock="${C.now.tz}"></span> <span class="st-sep">·</span> ${esc(C.now.city)}</span>
  </header>

  <section id="top" class="st-cover" aria-labelledby="st-name-h">
    <span class="st-reg st-reg-tl" aria-hidden="true"></span><span class="st-reg st-reg-tr" aria-hidden="true"></span>
    <p class="st-kick">A pamphlet in six dispatches</p>
    <div class="st-head">
    <div class="st-name" data-lens data-lens-idle>
      <h1 class="st-name-base" id="st-name-h" aria-label="${esc(C.name)}">${nameInner}</h1>
      <div class="st-name-crisp" aria-hidden="true">${nameInner}</div>
      <span class="st-lens-frame" aria-hidden="true"><i></i><b class="st-lens-xy">x 000 · y 000</b></span>
    </div>
    <p class="st-status"><span class="st-pulse" aria-hidden="true"></span><span>${esc(C.status)}</span></p>
    </div>
    <p class="st-thesis">${C.thesis.map(esc).join('<span aria-hidden="true"> ⁂ </span>')}</p>

    <div class="st-cover-row">
      <div class="st-cover-l">
        <p class="st-role"><i>${esc(C.role)}</i></p>
        <p class="st-line">${esc(C.line)}</p>
        <nav class="st-acts" aria-label="Act">
          <a href="#" class="st-a st-a-solid" data-resume>${icon("file-text")}<span>Read the resume</span></a>
          <span class="st-acts-2"><a href="#" class="st-a" data-compose>${icon("mail")}<span>Write to me</span></a>
          <a href="#" class="st-a" data-agent>${icon("terminal")}<span>Ask the agent</span></a></span>
        </nav>
      </div>
      <div class="st-front">
        <div class="st-pt">${portrait({ id: "stipple" })}</div>
        <p class="st-cap"><span>Plate I</span> A photograph, left unstippled</p>
      </div>
    </div>
    <span class="st-reg st-reg-bl" aria-hidden="true"></span><span class="st-reg st-reg-br" aria-hidden="true"></span>
  </section>

  <nav class="st-contents st-plate" aria-label="Contents">
    <span class="st-device" aria-hidden="true">${H.mark()}</span>
    <p class="st-toc-h">In this issue</p>
    <ol class="st-toc">${toc.map(([l, id], i) => `<li><a href="#${id}"><span class="st-dl">${l}</span><span class="st-lead" aria-hidden="true"></span><span class="st-rn">${ROMAN[i]}</span></a></li>`).join("")}</ol>
    <p class="st-toc-note">Press <kbd>T</kbd> for a different pamphlet entirely.</p>
  </nav>

  <section id="about" class="st-ch st-plate" aria-labelledby="st-h-about">
    <header class="st-chh"><span class="st-rom" aria-hidden="true">I</span><h2 id="st-h-about">Foreword</h2><span class="st-folio">— 2 —</span></header>
    <div class="st-prose">
      <p class="st-drop">${esc(C.about[0])}</p>
      <p>${esc(C.about[1])}<span class="st-endmark" aria-hidden="true">${H.mark()}</span></p>
    </div>
    <div class="st-now" id="now">
      <p class="st-label">On the press this season</p>
      <dl>
        <div><dt>Building</dt><dd>${esc(C.now.building)}</dd></div>
        <div><dt>Researching</dt><dd>${esc(C.now.researching)}</dd></div>
        <div><dt>Learning</dt><dd>${esc(C.now.learning)}</dd></div>
      </dl>
      <ul class="st-places" aria-label="Places">
        ${C.places.map((p) => `<li class="st-place st-place-${p.key}"><span class="st-pk">${placeKey[p.key] || p.key}</span><b>${esc(p.city)}</b><span class="st-clk" data-clock="${p.tz}"></span></li>`).join("")}
      </ul>
    </div>
  </section>

  <section class="st-ch st-figs-sec" aria-label="Figures">
    <ol class="st-figs">
      ${C.numbers.map(([v, l], i) => `<li class="st-plate-sm"><span class="st-fig-n">Fig. ${i + 1}</span><b>${esc(v)}</b><span>${esc(l)}</span></li>`).join("")}
    </ol>
  </section>

  <section id="work" class="st-ch st-wide" aria-labelledby="st-h-work">
    <header class="st-chh st-plate-sm"><span class="st-rom" aria-hidden="true">II</span><h2 id="st-h-work">Dispatches</h2><span class="st-folio">— 3 —</span></header>
    <p class="st-dek st-plate-sm">Six reports from the bench, from headsets to the cloud.</p>
    <div class="st-issue">${C.projects.map(dispatch).join("")}</div>
  </section>

  <section id="experience" class="st-ch" aria-labelledby="st-h-exp">
    <header class="st-chh st-plate-sm"><span class="st-rom" aria-hidden="true">III</span><h2 id="st-h-exp">Errata</h2><span class="st-folio">— 4 —</span></header>
    <div class="st-slip">
      <p class="st-slip-h"><span>Errata and appointments</span><span>insert, p. 4</span></p>
      <ol class="st-errata">
        ${C.experience.map((x) => `<li id="experience-${x.slug}">
          <p class="st-er-top"><span>${esc(x.when)}</span><span class="st-lead" aria-hidden="true"></span><span>${esc(x.where)}</span></p>
          <h3>${esc(x.role)}</h3>
          <p class="st-er-org">${esc(x.org)}</p>
          <ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        </li>`).join("")}
      </ol>
      <div class="st-edu" id="education">
        <img src="${C.education.logo}" alt="Purdue University" width="56" height="56" loading="lazy">
        <div>
          <p class="st-label">Schooling</p>
          <h3>${esc(C.education.school)}</h3>
          <p>${esc(C.education.degree)}</p>
          <p class="st-er-tags">${esc(C.education.focus)} · ${esc(C.education.grad)}</p>
        </div>
      </div>
    </div>
  </section>

  <section id="graph" class="st-ch st-wide st-map-sec" aria-labelledby="st-h-map">
    <header class="st-chh st-plate-sm"><span class="st-rom" aria-hidden="true">IV</span><h2 id="st-h-map">The map</h2><span class="st-folio">— 5 —</span></header>
    <p class="st-dek st-plate-sm">Everything above, folded into one sheet. Press a point to read it.</p>
    <div class="st-foldout">
      <p class="st-fold-h"><span>Fold-out map</span><span>not to scale</span></p>
      ${H.graph({ id: "stipple" })}
    </div>
  </section>

  <section id="faq" class="st-ch st-plate" aria-labelledby="st-h-faq">
    <header class="st-chh"><span class="st-rom" aria-hidden="true">V</span><h2 id="st-h-faq">Correspondence</h2><span class="st-folio">— 6 —</span></header>
    <div class="st-letters">
      ${C.faq.map(([q, a]) => `<details class="st-letter"><summary><span class="st-q">${esc(q)}</span><span class="st-plus" aria-hidden="true"></span></summary><p>${esc(a)}</p></details>`).join("")}
    </div>
  </section>

  <section id="play" class="st-ch st-wide" aria-labelledby="st-h-play">
    <header class="st-chh st-plate-sm"><span class="st-rom" aria-hidden="true">VI</span><h2 id="st-h-play">Supplement</h2><span class="st-folio">— 7 —</span></header>
    <p class="st-dek st-plate-sm">Cut along the dotted line. Every coupon is redeemable.</p>
    <div class="st-coupons">${(H.PLAY || []).map((p, i) => `
      <button type="button" class="st-cp" data-play="${p.id}" aria-label="${esc(p.name)}: ${esc(p.desc)}">
        <span class="st-cp-track" aria-hidden="true"><span class="st-cp-scis">${SCISSORS}</span></span>
        <span class="st-cp-main">
          <span class="st-cp-top"><b>Coupon ${pad(i)}</b><span>${GOOD[p.id] || "Good for one go"}</span></span>
          <span class="st-cp-t">${esc(p.name)}</span>
          <span class="st-cp-d">${esc(p.desc)}</span>
        </span>
        <span class="st-cp-stub"><span class="st-cp-ic">${icon(p.icon)}</span><span>Redeem</span></span>
      </button>`).join("")}
    </div>
    <p class="st-fine st-plate-sm">No cash value. Void where boring. One per visitor, or as many as you like.</p>
  </section>

  <section id="contact" class="st-ch st-seal-sec" aria-labelledby="st-h-contact">
    <header class="st-chh st-plate-sm"><span class="st-rom" aria-hidden="true">VII</span><h2 id="st-h-contact">The seal</h2><span class="st-folio">— 8 —</span></header>
    <p class="st-write st-plate-sm">Write back.</p>
    <button type="button" class="st-seal" data-compose="Internship opportunity" aria-label="Write to Rithvik">
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <defs><path id="st-ring" d="M150 150 m-104 0 a104 104 0 1 1 208 0 a104 104 0 1 1 -208 0"/></defs>
        <g filter="url(#st-seal)"><circle cx="150" cy="150" r="138" fill="#FF3B1F"/></g>
        <circle cx="150" cy="150" r="122" fill="none" stroke="#F9CDB0" stroke-width="1.5" stroke-dasharray="1 5" stroke-linecap="round"/>
        <circle cx="150" cy="150" r="84" fill="none" stroke="#F9CDB0" stroke-width="1.2"/>
        <g class="st-seal-spin"><text font-size="14" fill="#F9CDB0"><textPath href="#st-ring" textLength="646" lengthAdjust="spacing">WRITE TO RITHVIK · ${esc(C.links.email.toUpperCase())} · SEALED BY HAND ·</textPath></text></g>
        ${H.mark().replace("<svg ", '<svg x="104" y="104" width="92" height="92" style="color:#F9CDB0" ')}
      </svg>
    </button>
    <p class="st-seal-note st-plate-sm">Press the seal. It goes straight to my inbox.</p>
    <ul class="st-links st-plate-sm">
      <li><a href="#" data-copy="${esc(C.links.email)}">${icon("mail")}<span>${esc(C.links.email)}</span></a></li>
      <li><a href="${C.links.github}" target="_blank" rel="noopener">${logo("github")}<span>GitHub</span></a></li>
      <li><a href="${C.links.linkedin}" target="_blank" rel="noopener">${logo("linkedin")}<span>LinkedIn</span></a></li>
      <li><a href="#" data-resume>${icon("file-text")}<span>Resume</span></a></li>
    </ul>
  </section>

  <footer class="st-colo st-plate" id="colophon" aria-labelledby="st-h-colo">
    <span class="st-colo-mark" aria-hidden="true">${H.mark()}</span>
    <h2 id="st-h-colo">Colophon</h2>
    <p>Set in Instrument Serif and Martian Mono. Two inks on peach stock, with a trace of blue where your pointer breathes. The cloud is one fragment shader stippling noise in real time; the photograph is never touched.</p>
    <div class="st-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <p class="st-label">Printing history</p>
    <ol class="st-log">${C.log.map(([d, k, m]) => `<li><span>${esc(d)}</span><span class="st-log-k">${esc(k)}</span><span>${esc(m)}</span></li>`).join("")}</ol>
    <p class="st-imprint">${esc(C.name)} <span class="st-sep">·</span> the ink may still be wet <span class="st-sep">·</span> <a href="#top">back to the cover</a></p>
  </footer>
</div>`;
  }

  function mount(root, H) {
    const offs = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };

    // Square lens: a crisp duplicate plate revealed through a clip-path window that follows the pointer.
    if (H.fine.matches) {
      root.querySelectorAll("[data-lens]").forEach((el) => {
        const xy = el.querySelector(".st-lens-xy");
        let raf = 0, x = 0, y = 0;
        const paint = () => { raf = 0; el.style.setProperty("--lx", x + "px"); el.style.setProperty("--ly", y + "px"); if (xy) xy.textContent = `x ${String(Math.round(x)).padStart(3, "0")} · y ${String(Math.round(y)).padStart(3, "0")}`; };
        on(el.closest(".st-dsp") || el, "pointermove", (e) => {
          if (document.documentElement.classList.contains("lite")) return;
          const r = el.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top;
          el.classList.add("st-on"); if (!raf) raf = requestAnimationFrame(paint);
        }, { passive: true });
        on(el.closest(".st-dsp") || el, "pointerleave", () => { el.classList.remove("st-on"); cancelAnimationFrame(raf); raf = 0; });
      });
    }

    // Ambient loops (lens drift, seal rotation, status pulse) only run while their section is on screen.
    const io = new IntersectionObserver((en) => en.forEach((e) => e.target.classList.toggle("st-live", e.isIntersecting)), { rootMargin: "80px" });
    root.querySelectorAll(".st-cover, .st-seal-sec").forEach((s) => io.observe(s));

    // Opening one letter closes the others, like a reader turning one envelope at a time.
    const letters = Array.from(root.querySelectorAll(".st-letter"));
    letters.forEach((d) => on(d, "toggle", () => { if (d.open) letters.forEach((o) => { if (o !== d) o.open = false; }); }));

    // Clocks in the masthead and places keep time while the pamphlet is open.
    const clocks = Array.from(root.querySelectorAll("[data-clock]"));
    const tick = setInterval(() => clocks.forEach((c) => (c.textContent = H.clock(c.dataset.clock))), 20000);

    return () => { offs.forEach((f) => f()); io.disconnect(); clearInterval(tick); };
  }

  V6.theme({
    id: "stipple", name: "Stipple", mood: "breath on cold glass", dark: false,
    keywords: ["stipple", "pamphlet", "print", "printed", "paper", "peach", "dots", "ink", "riso", "zine", "tender"],
    fonts: "family=Instrument+Serif:ital@0;1&family=Martian+Mono:wght@300..700",
    swatch: ["#F9CDB0", "#17110E", "#FF3B1F", "#2B44B8"],
    cardFont: '"Instrument Serif", Georgia, serif',
    colors: ["#F9CDB0", "#17110E", "#FF3B1F", "#2B44B8"],
    shaderScale: 0.5,
    shader: SHADER,
    render,
    mount,
  });
})();
