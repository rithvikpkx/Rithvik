/* Slit: a festival poster that plays. Full-bleed bands, each one enormous word (SENSE, SEE, SHRINK,
   BUILD, TOUR, NOW, LINEUP, HIRE), snapping colour as they arrive; BUILD slides sideways with the page
   (sticky + transform, never scroll-jacked). Shader: a slit-scan wave field of dashed, sliced strips that
   carries procedural block glyphs along a ribbon, stepping one strip per beat at 128 BPM. */
(() => {
  const BANDS = [["top", "Open"], ["sense", "Sense"], ["see", "See"], ["shrink", "Shrink"], ["work", "Build"], ["experience", "Tour"], ["about", "Now"], ["stack", "Lineup"], ["play", "Play"], ["contact", "Hire"]];
  const pad = (n) => String(n).padStart(2, "0");
  const TOTAL = pad(BANDS.length - 1);
  const BPM = 128;

  /** A word drawn as n horizontal clip-path slices over a real (screen-readable) base copy. */
  const sliced = (word, n, mode) => {
    let s = "";
    for (let i = 0; i < n; i++) s += `<span class="sl-s" style="--i:${i};--x:${(i % 2 ? 1 : -1) * (3 + ((i * 5) % 7))}" aria-hidden="true">${word}</span>`;
    return `<span class="sl sl-${mode}" style="--n:${n}"><span class="sl-base">${word}</span>${s}</span>`;
  };
  const strips = (n = 12) => `<div class="b-fill" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>`;
  const idx = (i) => `<p class="b-idx"><b>${pad(i)}</b><span>/${TOTAL}</span></p>`;

  /** Sixteen deterministic EEG-like traces, each drawn twice wide so it can loop by translation. */
  function eeg() {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rows = [];
    for (let c = 0; c < 16; c++) {
      const y0 = 6 + c * 12, pts = []; let v = 0;
      const half = []; for (let x = 0; x <= 300; x += 5) { v = v * 0.55 + (rnd() - 0.5) * (c % 5 === 2 ? 14 : 7); half.push(v); }
      half[half.length - 1] = half[0];   // seamless: the loop point matches the start
      for (let k = 0; k < 2; k++) half.forEach((h, j) => pts.push(`${(k * 300 + j * 5).toFixed(0)},${(y0 + h * 0.5).toFixed(1)}`));
      rows.push(`<polyline points="${pts.join(" ")}"/>`);
    }
    return `<svg class="eeg-svg" viewBox="0 0 600 196" preserveAspectRatio="none" aria-hidden="true">${rows.join("")}</svg>`;
  }

  V6.theme({
    id: "slit", name: "Slit", mood: "kinetic festival rhythm", dark: true,
    keywords: ["festival", "rhythm", "tempo", "bands", "kinetic", "music", "poster", "loud"],
    fonts: "family=Big+Shoulders+Display:wght@600;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400",
    swatch: ["#050505", "#D4FF3A", "#FF4FD8", "#2B3BFF"],
    cardFont: '"Big Shoulders Display", Impact, sans-serif',
    colors: ["#050505", "#D4FF3A", "#FF4FD8", "#2B3BFF"],
    shaderScale: 0.5,
    shader: `
#define BPM ${BPM.toFixed(1)}
float rib(float x, float t, float ph){ return .55 + .19 * sin(x * 1.7 + t * .29 + ph) + .07 * sin(x * 4.3 - t * .43 + ph * 1.7); }
float glyph(float id, float lc, float row){
  float k = floor(hash21(vec2(id, 7.13)) * 6.);
  float e0 = step(lc, .5), e4 = step(3.5, lc), l2 = step(1.5, lc) * step(lc, 2.5);
  float r0 = step(row, .5), r4 = step(3.5, row), r2 = step(1.5, row) * step(row, 2.5);
  if (row < 0. || row > 4.) return 0.;
  if (k < 1.) return max(max(e0, e4), r2);
  if (k < 2.) return max(max(e0, e4), max(r0, r4));
  if (k < 3.) return max(e0, max(r0, max(r2, r4)));
  if (k < 4.) return max(l2, max(r0, r4));
  if (k < 5.) return max(e0, r0);
  return max(max(e0, e4), max(r4, r2));
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y, t = u_time;
  float beat = t * BPM / 60., kick = exp(-fract(beat) * 5.);
  float x = uv.x * asp;
  float mx = u_mouse.x * asp;
  float pull = exp(-pow((x - mx) * 1.5, 2.));
  float N = asp < 1. ? 30. : 44.;
  vec3 col = u_c0 + u_c3 * .16 * exp(-length((uv - vec2(.1, -.05)) * vec2(asp, 1.)) * 2.2);
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float ph = fl * 2.6 + u_scroll * 5.;
    float c = rib(x, t, ph);
    float sl = (rib(x + .02, t, ph) - rib(x - .02, t, ph)) / .04;
    c = mix(c, u_mouse.y, pull * .32);
    float v = uv.y - c;
    float s = (x + v * sl * .85) * N + fl * .5;
    float id = floor(s), fx = fract(s);
    float h = hash21(vec2(id, fl + 3.));
    float off = .04 * sin(t * 1.2 + id * .37 + fl * 1.3) + .03 * (vnoise(vec2(id * .23, t * .45 + fl * 9.)) - .5) + kick * .018 * (h - .5);
    float vy = v + off;
    float w = (L == 1 ? .17 : .11) * (1. + .22 * sin(id * .13 + t * .4 + fl));
    float ab = abs(vy), inR = step(ab, w);
    float gi = id + floor(beat) * (L == 1 ? 1. : -1.);
    float lc = mod(gi, 6.), row = floor((vy + w) / (2. * w) * 5.);
    float g = lc > 4.5 ? 0. : glyph(floor(gi / 6.) + fl * 31., lc, row) * inR;
    float dz = vy * (L == 1 ? 64. : 86.) + h * 10.;
    float dash = step(fract(dz), g > .5 ? .84 : .42);
    float gap = step(fx, g > .5 ? .8 : .3);
    float ray = step(.52, h) * (1. - smoothstep(w, w + .2 + .16 * h, ab)) * step(fx, .2) * step(fract(dz * .45), .55);
    float ink = max(g * dash * gap, ray * mix(.9, .45, inR) * (1. - g));
    vec3 ic = L == 1 ? u_c1 : u_c2;
    ic = mix(ic, u_c3, step(.94, h) * fl);
    col = mix(col, ic, ink * (L == 1 ? 1. : .9));
  }
  col += (hash21(gl_FragCoord.xy + fract(t * 7.) * 91.) - .5) * .06;
  gl_FragColor = vec4(col, 1.);
}`,

    render(C, H) {
      const { esc, icon, logo } = H;
      const P = H.P, num = (i) => C.numbers[i];
      const arm = P("mind-controlled-arm"), eegP = P("eeg-thought-prediction"), bf = P("boilerframe"), tiny = C.experience[0];
      const mini = (p, label) => `<button type="button" class="b-mini" data-case="${p.slug}">${esc(label || p.title)}${icon("arrow-up-right")}</button>`;
      const PLAY = H.PLAY || [];
      const CARD_TONES = ["y", "k", "p", "b", "y", "k"];
      const cards = C.projects.map((p, i) => `
        <li class="bd-card t-${CARD_TONES[i]}" id="work-${p.slug}">
          <p class="bd-top"><span>Track ${pad(i + 1)}</span><span>${esc(p.kind)}</span></p>
          <span class="bd-ic" aria-hidden="true">${icon(p.icon)}</span>
          <h3 class="bd-title">${esc(p.title)}</h3>
          <p class="bd-hl">${esc(p.headline)}</p>
          <p class="bd-ctx">${esc(p.ctx)}</p>
          <ul class="bd-tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <div class="bd-foot">
            <button type="button" class="bd-open" data-case="${p.slug}">Open case ${icon("arrow-right")}</button>
            ${Object.entries(p.links).map(([k, v]) => `<a class="bd-link" href="${esc(v)}" target="_blank" rel="noopener">${esc(k)} ${icon("arrow-up-right")}</a>`).join("")}
          </div>
        </li>`).join("");
      const tour = C.experience.map((x, i) => `
        <li class="tr-row" id="experience-${x.slug}">
          <p class="tr-when">${esc(x.when)}</p>
          <div class="tr-what"><h3 class="tr-role">${sliced(esc(x.role), 5, "hover")}</h3><p class="tr-org">${esc(x.org)}</p></div>
          <p class="tr-where">${esc(x.where)}</p>
          <p class="tr-desc">${esc(x.desc[0])}</p>
          <span class="tr-n" aria-hidden="true">${pad(i + 1)}</span>
        </li>`).join("");
      const E = C.education;
      const days = Object.entries(C.stack).map(([k, list], i) => `
        <div class="ln-day ln-${i}"><p class="ln-label"><span>Day ${pad(i + 1)}</span><span>${esc(k)}</span></p>
        <p class="ln-acts">${list.map((t) => `<span>${esc(t)}</span>`).join(' <i aria-hidden="true">/</i> ')}</p></div>`).join("");
      const placeName = { home: "Home", school: "School", now: "Now" };
      const ticker = [C.status.replace(" · ", " / "), ...C.thesis, C.role].map((t) => `<span>${esc(t)}</span><i aria-hidden="true">${H.mark()}</i>`).join("");

      return `
<header class="sl-hud">
  <a class="hud-mark" href="#top" aria-label="Rithvik Praveen Kumar, back to top"><span class="hud-mk" aria-hidden="true">${H.mark()}</span><span aria-hidden="true">RPK</span><i class="sl-caret" aria-hidden="true"></i></a>
  <nav class="hud-nav" aria-label="Bands">${BANDS.slice(1).map(([id, n], i) => `<a href="#${id}"><b>${pad(i + 1)}</b>${n}</a>`).join("")}</nav>
  <p class="hud-now" aria-hidden="true"><b class="hud-i">00</b>/${TOTAL}<span class="hud-n">Open</span></p>
  <p class="hud-tempo" title="Scroll faster, the tempo rises"><span class="beats" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b class="hud-bpm">${BPM}</b><span>BPM</span></p>
</header>

<section class="band b-open" id="top" data-band="0" aria-label="Introduction">
  <div class="top-head">
    <p class="top-kick"><span>${esc(C.role)}</span><span class="dash" aria-hidden="true"></span><span>${esc(C.now.city)} <time data-clock="${C.now.tz}"></time></span></p>
    <h1 class="top-h1"><span class="sr-only">${esc(C.name)}</span><span class="top-first" data-fit data-fit-cap="630" aria-hidden="true">${sliced("RITHVIK", 9, "live")}</span></h1>
    <span class="top-mk" aria-hidden="true">${H.mark("hatch")}</span>
    <p class="top-marks" aria-hidden="true"><span style="--l:3%">01</span><span style="--l:31%">02</span><span style="--l:58%">03</span><span style="--l:86%">04</span></p>
  </div>
  <div class="top-grid">
    <div class="top-info">
      <p class="top-last">Praveen Kumar</p>
      <p class="top-line">${esc(C.line)}</p>
      <p class="top-status"><span class="live-dot" aria-hidden="true"></span>${esc(C.status)}<i class="sl-caret" aria-hidden="true"></i></p>
      <div class="top-cta">
        <button type="button" class="cta c-y" data-resume>${icon("file-text")}Resume</button>
        <button type="button" class="cta c-p" data-compose>${icon("mail")}Email</button>
        <button type="button" class="cta c-b" data-agent>${icon("terminal")}Ask the agent</button>
      </div>
    </div>
    <div class="top-pt">${H.portrait({ id: "slit" })}<p class="pt-cap"><span>Fig. 01</span><span>${esc(C.first)}, in ${esc(C.now.city)}</span></p></div>
  </div>
</section>

<div class="sl-ticker" aria-hidden="true"><div class="tk-run">${ticker}${ticker}</div></div>

<section class="band b-sense tone-y" id="sense" data-band="1" aria-labelledby="h-sense">
  ${strips()}
  <div class="b-in">
    <div class="b-top">${idx(1)}<p class="b-tag">${esc(C.thesis[0])}</p><p class="b-tag r">BCI / EEG</p></div>
    <h2 class="b-word" id="h-sense"><span data-fit>${sliced("SENSE", 7, "band")}</span></h2>
    <div class="b-duo">
      <div class="eeg" aria-hidden="true"><div class="eeg-run">${eeg()}</div><p class="eeg-axis"><span>ch 01</span><span>ch 16</span></p></div>
      <div class="b-cap"><p class="b-num"><b>${esc(num(2)[0])}</b><span>${esc(num(2)[1])}</span></p><p class="b-links">${mini(arm)}${mini(eegP)}</p></div>
    </div>
  </div>
</section>

<section class="band b-see tone-b" id="see" data-band="2" aria-labelledby="h-see">
  ${strips()}
  <div class="b-in">
    <div class="b-top">${idx(2)}<p class="b-tag">${esc(C.thesis[1])}</p><p class="b-tag r">Computer vision</p></div>
    <div class="see-row">
      <h2 class="b-word see-word" id="h-see"><span data-fit>${sliced("SEE", 7, "band")}</span></h2>
      <div class="film" aria-hidden="true">
        <div class="film-strip">${Array.from({ length: 12 }, (_, i) => `<span class="fr${[2, 7, 9].includes(i) ? " hit" : ""}"><em>F${pad(i + 1)}</em></span>`).join("")}</div>
        <span class="film-scan"></span>
      </div>
    </div>
    <div class="b-duo see-duo"><p class="b-lede">${esc(bf.headline)}.</p><p class="b-links">${mini(bf, bf.title + ", " + bf.ctx)}</p></div>
  </div>
</section>

<section class="band b-shrink tone-p" id="shrink" data-band="3" aria-labelledby="h-shrink">
  ${strips()}
  <div class="b-in">
    <div class="b-top">${idx(3)}<p class="b-tag">${esc(C.thesis[2])}</p><p class="b-tag r">TinyML</p></div>
    <h2 class="b-word" id="h-shrink"><span data-fit>${sliced("SHRINK", 7, "band")}</span></h2>
    <div class="b-duo">
      <div class="shrink-viz" aria-hidden="true">${[100, 74, 52, 34, 20, 10].map((w, i) => `<i style="--w:${w / 100};--i:${i}"></i>`).join("")}<span>model</span><span>microcontroller</span></div>
      <div class="b-role"><p class="b-kicker">${esc(tiny.when)} / ${esc(tiny.org)}</p><h3>${esc(tiny.role)}</h3><p class="b-links"><a class="b-mini" href="#experience-${tiny.slug}">On tour ${icon("arrow-right")}</a></p></div>
    </div>
  </div>
</section>

<section class="band b-build" id="work" data-band="4" aria-labelledby="h-build">
  <div class="bd-pin">
    <div class="bd-word" aria-hidden="true">${sliced("BUILD", 11, "band")}</div>
    <div class="b-top bd-head">${idx(4)}<h2 class="bd-h" id="h-build">Build <span>${esc(num(3)[0])} ${esc(num(3)[1])}</span></h2><p class="b-tag r bd-count"><b class="bd-at">01</b>/06</p></div>
    <ol class="bd-track">${cards}</ol>
    <div class="bd-bar" aria-hidden="true"><i class="bd-fill"></i></div>
  </div>
</section>

<section class="band b-tour" id="experience" data-band="5" aria-labelledby="h-tour">
  <div class="b-in">
    <div class="b-top">${idx(5)}<p class="b-tag">Experience, 2023 to now</p><p class="b-tag r">4 roles / 1 school</p></div>
    <h2 class="b-word tour-word" id="h-tour"><span data-fit>${sliced("TOUR", 7, "band")}</span></h2>
    <ol class="tr-list">${tour}</ol>
    <div class="tr-edu" id="education">
      <p class="tr-when">Residency</p>
      <div class="tr-what"><h3 class="tr-role">${esc(E.school)}</h3><p class="tr-org">${esc(E.degree)}</p></div>
      <p class="tr-where">${esc(E.focus)}<br>${esc(E.grad)}</p>
      <img class="tr-logo" src="${esc(E.logo)}" alt="Purdue University" width="64" height="64" loading="lazy">
    </div>
  </div>
</section>

<section class="band b-now tone-b" id="about" data-band="6" aria-labelledby="h-now">
  ${strips()}
  <div class="b-in">
    <div class="b-top">${idx(6)}<p class="b-tag">About</p><p class="b-tag r">${esc(C.places.map((p) => p.city).join(" / "))}</p></div>
    <div class="now-row">
      <h2 class="b-word now-word" id="h-now"><span data-fit>${sliced("NOW", 7, "band")}</span></h2>
      <dl class="now-list">
        <div><dt>Building</dt><dd>${esc(C.now.building)}</dd></div>
        <div><dt>Researching</dt><dd>${esc(C.now.researching)}</dd></div>
        <div><dt>Learning</dt><dd>${esc(C.now.learning)}</dd></div>
      </dl>
    </div>
    <div class="now-grid">
      <div class="now-about">${C.about.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      <ol class="plcs">${C.places.map((p, i) => `<li class="plc s-${p.key}"><span class="st-k">Stage ${String.fromCharCode(65 + i)} / ${placeName[p.key] || esc(p.key)}</span><b>${esc(p.city)}</b><time data-clock="${p.tz}"></time></li>`).join("")}</ol>
    </div>
  </div>
</section>

<section class="band b-lineup tone-y" id="stack" data-band="7" aria-labelledby="h-lineup">
  ${strips()}
  <div class="b-in">
    <div class="b-top">${idx(7)}<p class="b-tag">Stack</p><p class="b-tag r">Four days, one stage</p></div>
    <h2 class="ln-h" id="h-lineup">Lineup</h2>
    <div class="ln-poster">${days}</div>
  </div>
</section>

<section class="band b-play tone-p" id="play" data-band="8" aria-labelledby="h-play">
  ${strips()}
  <div class="b-in">
    <div class="b-top">${idx(8)}<p class="b-tag">Play</p><p class="b-tag r">Side stages, no ticket needed</p></div>
    <div class="pl-row">
      <h2 class="b-word play-word" id="h-play"><span>${sliced("PLAY", 7, "band")}</span></h2>
      <p class="pl-note">${PLAY.length} small toys between sets. Scratch a record, draw something, or try to beat Rithvik at his own games.</p>
    </div>
    <ol class="pl-grid">${PLAY.map((t, i) => `<li><button type="button" class="pl-tile pk-${i % 3}" data-play="${esc(t.id)}"><span class="pl-n">Stage ${pad(i + 1)}</span><span class="pl-ic" aria-hidden="true">${t.id === "records" ? `<span class="pl-disc">${H.mark()}</span>` : icon(t.icon)}</span><b>${esc(t.name)}</b><span class="pl-d">${esc(t.desc)}</span>${icon("arrow-up-right")}</button></li>`).join("")}</ol>
  </div>
</section>

<section class="band b-hire" id="contact" data-band="9" aria-labelledby="h-hire">
  <div class="b-in">
    <div class="b-top">${idx(9)}<p class="b-tag">Contact</p><p class="b-tag r">${esc(C.status.split(" · ")[1] || C.status)}</p></div>
    <h2 class="hire-h" id="h-hire"><span data-fit>${sliced("HIRE", 9, "live")}</span></h2>
    <div class="hire-grid">
      <div class="ticket">
        <p class="tk-top"><span>Admit one</span><span>SWE / AI internship</span></p>
        <button type="button" class="tk-mail" data-compose="Internship opportunity"><span>Write to</span><b>${esc(C.links.email)}</b>${icon("arrow-up-right")}</button>
        <div class="tk-row">
          <a href="${esc(C.links.github)}" target="_blank" rel="noopener">${logo("github")}GitHub</a>
          <a href="${esc(C.links.linkedin)}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a>
          <button type="button" data-resume>${icon("file-text")}Resume</button>
          <button type="button" data-copy="${esc(C.links.email)}">${icon("copy")}Copy address</button>
        </div>
        <p class="tk-stub" aria-hidden="true"><span class="tk-mk">${H.mark()}</span><span>No. ${pad(C.projects.length)}${pad(C.experience.length)}</span></p>
      </div>
      <p class="hire-note">Say hello.<br>It goes straight to his inbox.</p>
    </div>
    <dl class="faq">${C.faq.map(([q, a]) => `<div><dt>${esc(q)}</dt><dd>${esc(a)}</dd></div>`).join("")}</dl>
    <footer class="sl-foot">
      <div class="setlist"><p class="b-kicker">Setlist / recent commits</p><ol>${C.log.map(([d, k, m]) => `<li><span>${esc(d)}</span><b>${esc(k)}</b><em>${esc(m)}</em></li>`).join("")}</ol></div>
      <p class="colophon"><span>Set in Big Shoulders Display and Space Mono.</span><span>One shader: a slit-scan wave field at ${BPM} BPM.</span><span>${esc(C.name)}</span></p>
    </footer>
  </div>
</section>`;
    },

    mount(root, H) {
      const $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
      const off = [], on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); off.push(() => el.removeEventListener(ev, fn, o)); };
      const desk = matchMedia("(min-width: 900px)");
      let raf = 0, alive = true;

      /* Fit each giant word to its container width (measured once fonts land, again on resize). */
      function fit() {
        $$("[data-fit]").forEach((el) => {
          const base = el.querySelector(".sl-base"); if (!base) return;
          el.style.fontSize = "";
          const w = base.getBoundingClientRect().width, target = el.parentElement.clientWidth;
          if (!(w > 0 && target > 0)) return;
          let fs = parseFloat(getComputedStyle(el).fontSize) * target / w * 0.995;
          // the opening name also yields to the fold on wide-but-short screens, so the actions stay above it
          if (el.dataset.fitCap && desk.matches) fs = Math.min(fs, Math.max(150, (innerHeight - +el.dataset.fitCap) / 0.78));
          el.style.fontSize = fs.toFixed(2) + "px";
        });
        // the hatched mark takes whatever room the height-capped name leaves on the right
        const mk = $(".top-mk"), h1 = $(".top-h1"), nb = $(".top-first .sl-base");
        if (mk && h1 && nb) {
          const nameW = nb.getBoundingClientRect().width, avail = h1.clientWidth - nameW, size = Math.min(avail - 48, h1.offsetHeight * 0.92);
          mk.style.display = size > 120 ? "block" : "none";
          if (size > 120) { mk.style.width = size + "px"; mk.style.left = (h1.offsetLeft + nameW + (avail - size) / 2) + "px"; mk.style.top = (h1.offsetTop + (h1.offsetHeight - size) / 2) + "px"; }
        }
      }
      fit();
      document.fonts?.ready.then(() => { if (alive) { fit(); measure(); onScroll(); } });

      /* Bands below the fold arm their colour strips, then snap them in as they arrive. */
      const bands = $$(".band");
      if (!H.reduceMotion()) bands.forEach((b) => { if (b.getBoundingClientRect().top > innerHeight * 0.9) b.classList.add("armed"); });
      const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) e.target.classList.add("on"); }), { rootMargin: "0px 0px -12% 0px" });
      bands.forEach((b) => io.observe(b));

      /* HUD: which band crosses the middle of the screen. */
      const hudI = $(".hud-i"), hudN = $(".hud-n");
      const mid = new IntersectionObserver((en) => en.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = +e.target.dataset.band; hudI.textContent = pad(i); hudN.textContent = BANDS[i][1];
        root.querySelector(".sl-hud").dataset.tone = e.target.className.match(/tone-(\w)/)?.[1] || "k";
      }), { rootMargin: "-50% 0px -50% 0px" });
      bands.forEach((b) => mid.observe(b));

      /* Ambient loops (sliced name, ticker, EEG, film scan) pause off-screen. */
      const amb = new IntersectionObserver((en) => en.forEach((e) => e.target.classList.toggle("paused", !e.isIntersecting)));
      $$(".sl-live, .sl-ticker, .eeg, .film, .top-mk, .pl-disc").forEach((el) => amb.observe(el));

      /* BUILD: a sticky band whose track slides sideways with vertical scroll (desktop only). */
      const build = $(".b-build"), track = $(".bd-track"), word = $(".bd-word"), fill = $(".bd-fill"), at = $(".bd-at");
      let overflow = 0, bTop = 0, bLen = 1, lastAt = -1;
      function measure() {
        if (!desk.matches) { build.style.height = ""; track.style.transform = ""; word.style.transform = ""; overflow = 0; return; }
        overflow = Math.max(0, track.scrollWidth - track.parentElement.clientWidth + 48);
        build.style.height = (innerHeight + overflow) + "px";
        bTop = build.getBoundingClientRect().top + scrollY; bLen = Math.max(1, overflow);
      }
      function placeTrack() {
        const p = desk.matches ? Math.min(1, Math.max(0, (scrollY - bTop) / bLen)) : 0;
        if (desk.matches) { track.style.transform = `translate3d(${(-p * overflow).toFixed(1)}px,0,0)`; word.style.transform = `translate3d(${(-p * overflow * 0.3).toFixed(1)}px,0,0)`; }
        fill.style.transform = `scaleX(${desk.matches ? p.toFixed(4) : 1})`;
        const k = Math.min(5, Math.round(p * 5)); if (k !== lastAt) { lastAt = k; at.textContent = pad(k + 1); }
      }

      /* Tempo: scroll speed raises the BPM readout, which settles back to 128 at rest. */
      const bpmEl = $(".hud-bpm"), hudMk = $(".hud-mk"); let lastY = scrollY, vel = 0, shown = BPM, spin = 0;
      function tick() {
        raf = 0;
        const sdy = scrollY - lastY, dy = Math.abs(sdy); lastY = scrollY;
        // the logo turns like a record under the scroll: down plays forward, up scratches back
        if (sdy && !H.reduceMotion()) { spin = (spin + sdy * 0.5) % 360; hudMk.style.transform = `rotate(${spin.toFixed(1)}deg)`; }
        vel += (dy - vel) * 0.18;
        const bpm = Math.round(BPM + Math.min(72, vel * 1.6));
        if (bpm !== shown) { shown = bpm; bpmEl.textContent = bpm; }
        placeTrack();
        if (vel > 0.4 || shown !== BPM) raf = requestAnimationFrame(tick);
      }
      function onScroll() { if (!raf) raf = requestAnimationFrame(tick); }
      on(window, "scroll", onScroll, { passive: true });

      // keyboard focus inside the sliding track: move the page so the focused card is in view
      on(track, "focusin", (e) => {
        if (!desk.matches) return;
        track.parentElement.scrollLeft = 0;
        const li = e.target.closest(".bd-card"); if (!li) return;
        const x = li.offsetLeft - 48, p = Math.min(1, Math.max(0, x / bLen));
        window.scrollTo({ top: bTop + p * bLen, behavior: "auto" });
      });

      let rt = 0;
      on(window, "resize", () => { clearTimeout(rt); rt = setTimeout(() => { fit(); measure(); placeTrack(); }, 120); });
      on(desk, "change", () => { measure(); placeTrack(); });
      measure(); placeTrack();

      return () => {
        alive = false; cancelAnimationFrame(raf); clearTimeout(rt);
        io.disconnect(); mid.disconnect(); amb.disconnect(); off.forEach((f) => f());
      };
    },
  });
})();
