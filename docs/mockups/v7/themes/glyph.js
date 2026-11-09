/* Glyph: a machine dreaming in text. Calm terminal panes, separated by real space, over one wild
   thing: a fluid cortex the fragment shader raymarches and prints as a halftone of square dots that
   crumbles into ASCII at its edges.
   Where each effect lives, and why:
   - Shader sculpture: full intensity on the first screen only (the arrival). In the sections it slides
     half off the right edge and shows only in the gaps between panes; panes are opaque, so it is never
     behind reading text. The mouse parts the dots; under performance mode it is one still frame.
   - Decode (scrambled glyphs resolving): headings and the wordmark, once, on first view. Off when
     reduced motion or performance mode is on.
   - Typing placeholder in the hero prompt: only while the hero is on screen; off in performance mode.
   - Vim quips in the status bar: on unmapped keys only (interaction-triggered). */
(() => {
  // [anchor id, tmux window name, section hue]
  const SECTIONS = [["top", "top", "amber"], ["work", "work", "amber"], ["experience", "log", "blue"], ["about", "man", "blue"], ["graph", "map", "blue"], ["play", "bin", "red"], ["contact", "mail", "red"]];
  const GLY = "#%@*+=-:/\\|<>[]{}_$&?~^";
  const ASKS = ["what has he built?", "is he open to internships?", "tell me about the EEG work", "what stack did BoilerFrame use?", "/theme random"];
  const KEYS = [["j / k", "next / previous pane"], ["g / G", "top / end"], ["1-7", "jump to a window"], [":", "ask the agent"], ["r", "resume"], ["m", "mail"], ["p", "play"], ["t", "another design"]];
  // shown when an unmapped key is pressed: a small vim joke in the status bar
  const QUIPS = ["E492: not an editor command", "E37: no write since last hire", "E21: cannot make changes, modifiable is off", "E348: no string under cursor", "E163: there is only one file to edit"];

  /** Deterministic 7-char hex "commit hash" for a slug, so the git log reads like a real one. */
  const hash7 = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7); };

  const SHADER = `
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float gyr(vec3 p){ return dot(sin(p), cos(p.yzx)); }
mat3 rY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., s, 0., 1., 0., -s, 0., c); }
mat3 rX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, -s, 0., s, c); }
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }

/* cortex: a liquid ellipsoid folded along a gyroid labyrinth (sulci), split by a fissure */
float cortex(vec3 p, float t, out float sul){
  vec3 q = p + .075 * sin(p.yzx * 2.4 + t * .4) + .03 * sin(p.zxy * 5.3 - t * .33);
  q.y *= q.y < 0. ? 1.25 : 1.;
  vec3 r = vec3(.68, .6, .88);
  float k0 = length(q / r), k1 = length(q / (r * r));
  float e = k0 * (k0 - 1.) / k1;
  vec3 cq = q - vec3(0., -.36, .5);
  float cb = (length(cq / vec3(.46, .2, .3)) - 1.) * .2;
  float hh = clamp(.5 + .5 * (cb - e) / .12, 0., 1.);
  e = mix(cb, e, hh) - .12 * hh * (1. - hh);
  float G = gyr(q * 11. + vec3(0., t * .1, t * .06));
  sul = exp(-G * G * 3.);
  float fis = exp(-q.x * q.x * 300.) * smoothstep(-.3, .2, q.y);
  return e + .05 * sul + .09 * fis;
}

/* ASCII for the crumbling edge; g spans x [-.3,.3], y [-.5,.5] */
float glyph(float id, vec2 g, float w){
  float d = 1e3;
  if (id < 1.5) return length(g - vec2(0., -.22)) - .08;
  if (id < 2.5) return min(length(g - vec2(0., -.22)), length(g - vec2(0., .14))) - .08;
  if (id < 3.5) return seg(g, vec2(-.2, 0.), vec2(.2, 0.)) - w;
  if (id < 4.5) return min(seg(g, vec2(-.2, -.11), vec2(.2, -.11)), seg(g, vec2(-.2, .11), vec2(.2, .11))) - w;
  if (id < 5.5) return min(seg(g, vec2(-.2, 0.), vec2(.2, 0.)), seg(g, vec2(0., -.22), vec2(0., .22))) - w;
  if (id < 6.5) { d = seg(g, vec2(0., -.22), vec2(0., .22)); d = min(d, seg(g, vec2(-.19, -.11), vec2(.19, .11))); return min(d, seg(g, vec2(-.19, .11), vec2(.19, -.11))) - w; }
  if (id < 7.5) { d = seg(g, vec2(-.07, -.3), vec2(-.1, .3)); d = min(d, seg(g, vec2(.11, -.3), vec2(.08, .3))); d = min(d, seg(g, vec2(-.22, -.1), vec2(.22, -.1))); return min(d, seg(g, vec2(-.22, .12), vec2(.22, .12))) - w; }
  if (id < 8.5) return seg(g, vec2(-.2, -.36), vec2(.2, .36)) - w;
  return seg(g, vec2(-.2, .36), vec2(.2, -.36)) - w;
}

void main(){
  float t = u_time, s = u_scroll;
  vec2 fc = gl_FragCoord.xy;
  float cs = max(5., floor(u_res.y / 122.));
  vec2 cell = floor(fc / cs);
  vec2 f = (fc - cell * cs) / cs - .5;
  vec2 cc = (cell + .5) * cs;
  vec2 uv = cc / u_res;
  float asp = u_res.x / u_res.y, wide = step(1.05, asp), px = 1. / cs;
  vec2 p = (cc - .5 * u_res) / u_res.y;

  // section hue from scroll: amber (top, work), blue (log, man), red (bin, mail)
  vec3 H1 = mix(mix(u_c1, u_c2, smoothstep(.31, .38, s)), u_c3, smoothstep(.79, .86, s));
  vec3 H2 = mix(mix(u_c2, u_c3, smoothstep(.31, .38, s)), u_c1, smoothstep(.79, .86, s));

  // the mouse parts the dots like a hand through water
  vec2 mo = u_mouse - .5;
  float hasM = step(.0015, length(mo));
  vec2 dv = p - mo * vec2(asp, 1.);
  float md = length(dv);
  p += dv / (md + 1e-4) * hasM * .07 * exp(-md * md * 26.);

  // placement: centre-right in the hero, half off the right edge in the sections, centre for the finale
  float side = smoothstep(.04, .14, s);
  float fin = 0.;
  float calm = mix(mix(.5, .3, side), mix(1., .75, side), wide);
  vec2 ctr = wide > .5 ? vec2(mix(mix(asp * .16 + .04, asp * .5 - .06, side), 0., fin), mix(mix(.07, -.02, side), .02, fin)) : vec2(mix(0., asp * .5 - .02, side), mix(.1, .05, side));
  float fl = wide > .5 ? mix(1.12, 1.6, side) * mix(1., .86, fin) : mix(.86, 1.05, side);
  vec2 q = p - ctr;

  float yaw = 1.15 + t * .07 + s * 4.6 + mo.x * .7;
  float pit = -.32 + mo.y * .35 + .07 * sin(t * .19);
  mat3 R = rY(yaw) * rX(pit);
  vec3 ro = R * vec3(0., 0., -3.), rd = R * normalize(vec3(q, fl));

  float hit = 0., sul = 0.;
  vec3 po = vec3(0.);
  float b = dot(ro, rd), c = dot(ro, ro) - 1.02, h = b * b - c;
  if (h > 0.) {
    float tt = -b - sqrt(h), tmax = -b + sqrt(h);
    for (int i = 0; i < 40; i++) {
      po = ro + rd * tt;
      float d = cortex(po, t, sul);
      if (d < .0025) { hit = 1.; break; }
      tt += d * .78;
      if (tt > tmax) break;
    }
  }

  vec3 col = vec3(.0196);
  float cov = 0.;
  vec3 ink = vec3(0.);

  if (hit > .5) {
    float du; vec2 k = vec2(1., -1.) * .004;
    vec3 n = normalize(k.xyy * cortex(po + k.xyy, t, du) + k.yyx * cortex(po + k.yyx, t, du) + k.yxy * cortex(po + k.yxy, t, du) + k.xxx * cortex(po + k.xxx, t, du));
    vec3 nW = n * R;
    vec3 rdW = normalize(vec3(q, fl));
    float dif = max(dot(nW, normalize(vec3(-.55, .7, -.55))), 0.);
    float fres = 1. - max(dot(nW, -rdW), 0.);
    float pulse = smoothstep(.88, 1., sin(dot(po, vec3(.15, 1., .4)) * 6.5 - t * 1.25)) * (.35 + .65 * sul);
    float lum = clamp(.04 + .95 * pow(dif, 1.2) * (1. - .8 * sul) + .3 * fres * fres + .45 * pulse, 0., 1.);
    // edge crumble: the rim breaks into drifting ASCII and missing pixels
    float cr = smoothstep(.45, .97, fres);
    float rnd = hash21(cell + floor(t * 2.2) * 7.31);
    if (rnd < cr * .42) {
      cov = 0.;
    } else if (rnd < cr * .8) {
      float id = 1. + floor(hash21(cell * 1.3 + floor(t * 3.)) * 8.99);
      cov = 1. - smoothstep(-px, px, glyph(id, f * 1.1, .07));
      ink = mix(H1, vec3(1.), .25) * (.45 + .5 * lum);
    } else {
      float sz = sqrt(lum) * .94;
      if (lum < .22) sz = bayer4(cell) < lum * 4.6 ? .3 : 0.;
      float dd = max(abs(f.x), abs(f.y)) - sz * .5;
      cov = 1. - smoothstep(-px * .5, px * .5, dd);
      ink = mix(vec3(.93), H1, pulse * .85) * (.42 + .62 * lum);
    }
    ink *= calm;
  } else {
    // background: a fluid field swelling a regular grid of tiny square dots
    float nb = fbm(cell * vec2(.03, .03) + vec2(t * .03, -t * .045));
    float fl2 = smoothstep(.05, .8, nb);
    float sz = .12 + .3 * fl2;
    float dd = max(abs(f.x), abs(f.y)) - sz * .5;
    cov = (1. - smoothstep(-px * .5, px * .5, dd)) * step(.5, mod(cell.x + cell.y, 2.) + fl2 * 2.);
    ink = mix(vec3(.6), H1, .2 * fl2) * (.12 + .18 * fl2);

    // a few columns where text falls through the dark
    float hc = hash21(vec2(cell.x, 7.13));
    if (hc < .035 - .02 * side) {
      float rows = u_res.y / cs;
      float head = fract(t * (.02 + hc * .9) + hc * 17.) * (rows + 30.);
      float dist = head - (rows - cell.y);
      if (dist > 0. && dist < 18.) {
        float tr = 1. - dist / 18.;
        float id = 1. + floor(hash21(cell + floor(t * 9.)) * 8.99);
        cov = 1. - smoothstep(-px, px, glyph(id, f * 1.1, .07));
        ink = mix(H1 * .8, vec3(1.), step(dist, 1.)) * (.12 + .5 * tr * tr);
      }
    }
  }

  // orbit: a tilted dotted band of signal; its far half passes behind the cortex
  float tl = .3;
  vec2 rq = mat2(cos(tl), sin(tl), -sin(tl), cos(tl)) * q;
  float K = 3.6, rad = .62 / fl * 1.2;
  float rr = length(rq * vec2(1., K));
  float rdist = abs(rr - rad) * rr / max(length(vec2(rq.x, K * K * rq.y)), 1e-4);
  if (rdist < .55 * cs / u_res.y && (rq.y < 0. || hit < .5)) {
    float an = atan(rq.y * K, rq.x);
    float pk = pow(.5 + .5 * sin(an * 3. - t * 1.1), 10.);
    float sz = .34 + .5 * pk;
    cov = 1. - smoothstep(-px * .5, px * .5, max(abs(f.x), abs(f.y)) - sz * .5);
    ink = mix(H2 * .6, mix(H2, vec3(1.), .35), pk) * (.6 + .5 * pk) * calm;
  }

  // boot: the page assembles from static, top first, behind a luminous front
  float boot = smoothstep(.15, 2.7, t);
  float rv = hash21(cell + 3.1) * .4 + (1. - uv.y) * .6;
  if (rv > boot * 1.04) {
    float on = step(hash21(cell * 1.7 + floor(t * 14.)), .45);
    cov = (1. - smoothstep(-px * .5, px * .5, max(abs(f.x), abs(f.y)) - .16)) * on;
    ink = vec3(.4);
  } else {
    float front = smoothstep(.06, 0., boot * 1.04 - rv) * (1. - boot * .7);
    ink = mix(ink, H1 * 1.1, front);
    cov = max(cov, front * (1. - smoothstep(-px * .5, px * .5, max(abs(f.x), abs(f.y)) - .3)));
  }

  col += ink * cov;
  col *= 1. - .38 * pow(length(uv - .5) * 1.2, 2.2);
  col += (hash21(fc + fract(t * 7.3) * 91.) - .5) * .026;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`;

  V6.theme({
    id: "glyph",
    name: "Glyph",
    mood: "a machine dreaming in text",
    dark: true,
    keywords: ["terminal", "tui", "ascii", "glyph", "mono", "monospace", "vim", "tmux", "hacker", "command line", "cli", "halftone", "dither"],
    fonts: "family=Martian+Mono:wdth,wght@75..112.5,100..800&family=Spline+Sans+Mono:ital,wght@0,300..700;1,300..700",
    swatch: ["#050505", "#EDEDED", "#FFC400", "#3BA4FF"],
    cardFont: '"Martian Mono", ui-monospace, monospace',
    colors: ["#EDEDED", "#FFC400", "#3BA4FF", "#FF2D2D"],
    shaderScale: 0.5,
    shader: SHADER,

    render(C, H) {
      const e = H.esc;
      const mk = (cls) => (H.mark ? H.mark("solid", cls) : "");
      const tagRow = (tags) => `<span class="gl-tags">${tags.map((t) => `<span>${e(t)}</span>`).join("")}</span>`;
      const win = (i) => `${i + 1}:${SECTIONS[i][1]}`;
      /** One tmux pane: a title bar (window, command, a short note) and a body with generous space. */
      const pane = (o) => `<section id="${o.id}" class="gl-sec gl-pane${o.cls ? " " + o.cls : ""}" data-hue="${o.hue}" aria-labelledby="${o.id}-h">
          <header class="gl-tbar"><span class="gl-tw">${e(o.win)}</span><span class="gl-tc"><span class="gl-dim">$</span> ${e(o.cmd)}</span>${o.note ? `<span class="gl-tn">${e(o.note)}</span>` : ""}</header>
          <div class="gl-pb">${o.word ? `<h2 class="gl-h2" id="${o.id}-h"><span class="gl-sl" aria-hidden="true">///</span><span data-scr>${e(o.word)}</span></h2>` : ""}${o.body}</div>
        </section>`;

      // ── top: the one loud screen. A thesis, the sculpture, the prompt, the name ──
      const hero = `<section id="top" class="gl-sec gl-hero" data-hue="amber" aria-labelledby="gl-name">
        <p class="gl-meta"><span><span class="gl-led" aria-hidden="true"></span>open to SWE and AI internships</span><span>${e(C.now.city)} · <time data-clock="${e(C.now.tz)}"></time></span></p>
        <div class="gl-stage">
          <p class="gl-cond">${C.thesis.map((t) => `<span data-scr>${e(t)}</span>`).join("")}</p>
          <div class="gl-card">
            <p class="gl-card-p">${e(C.line)}</p>
            <form class="gl-ask" id="gl-ask" autocomplete="off">
              <span class="gl-ask-p" aria-hidden="true">❯</span>
              <label class="sr-only" for="gl-ask-in">Ask the agent about Rithvik</label>
              <input id="gl-ask-in" class="gl-ask-in" type="text" maxlength="500" placeholder="${e(ASKS[0])}" spellcheck="false">
              <button class="gl-ask-go" type="submit" aria-label="Ask">⏎</button>
            </form>
            <div class="gl-acts">
              <button type="button" class="gl-btn" data-resume><kbd>r</kbd>resume</button>
              <button type="button" class="gl-btn gl-btn-hue" data-compose><kbd>m</kbd>get in touch</button>
            </div>
          </div>
        </div>
        <h1 class="gl-word" id="gl-name" aria-label="${e(C.name)}"><span class="gl-w1" data-scr aria-hidden="true">${e(C.first.toUpperCase())}</span><span class="gl-w2" aria-hidden="true">${e(C.last.toUpperCase())}</span></h1>
      </section>`;

      const who = pane({ id: "whoami", hue: "amber", win: win(0), cmd: "whoami", cls: "gl-who", body: `
          <div class="gl-who-pt">${H.portrait({ id: "glyph" })}</div>
          <div class="gl-who-r">
            <p class="gl-who-h" id="whoami-h"><span data-scr>${e(C.first.toLowerCase())}</span><span class="gl-caret" aria-hidden="true"></span></p>
            <p class="gl-who-s">${e(C.status)}</p>
            <dl class="gl-nums">${C.numbers.map(([n, l]) => `<div><dt>${e(n)}</dt><dd>${e(l)}</dd></div>`).join("")}</dl>
          </div>` });

      // ── work: ls -l with a preview pane ──
      const rows = C.projects.map((p, i) => `<li><button type="button" class="gl-row" data-case="${e(p.slug)}" data-gl-i="${i}"${i === 0 ? ' aria-current="true"' : ""}>
          <span class="c-name"><span data-scr>${e(p.slug)}</span>/</span><span class="c-kind">${e(p.kind.toLowerCase())}</span><span class="c-go" aria-hidden="true">⏎</span>
        </button></li>`).join("");
      const prevs = C.projects.map((p, i) => `<article class="gl-pv"${i === 0 ? "" : " hidden"} data-gl-pv="${i}">
          <h3>${e(p.title)}</h3>
          <p class="gl-pv-head">${e(p.headline)}</p>
          <p class="gl-pv-d">${e(p.ctx)}</p>
          ${tagRow(p.tags)}
          <p class="gl-pv-acts"><button type="button" class="gl-btn gl-btn-hue" data-case="${e(p.slug)}"><kbd>⏎</kbd>open case</button>${Object.entries(p.links).map(([k, v]) => `<a class="gl-btn" href="${e(v)}" target="_blank" rel="noopener">${e(k.toLowerCase())} ↗</a>`).join("")}</p>
        </article>`).join("");
      const work = pane({ id: "work", hue: "amber", win: win(1), cmd: "ls ~/work", note: `${C.projects.length} entries`, word: "WORK", body: `
          <div class="gl-ranger"><ol class="gl-ls">${rows}</ol><div class="gl-prev">${prevs}</div></div>` });

      // ── experience: git log; each commit expands with git show ──
      const X = C.experience;
      const commit = (x, lane, deco, open) => `<li class="gl-c${lane ? " l2" : ""}" id="experience-${e(x.slug)}">
          <span class="gl-node" aria-hidden="true">*</span>
          <details${open ? " open" : ""}>
            <summary>
              <span class="gl-c-h"><span class="gl-hash">${hash7(x.slug)}</span>${deco ? ` <span class="gl-deco">(${deco})</span>` : ""} <span class="gl-dim">${e(x.when)}</span></span>
              <span class="gl-c-s">${e(x.role)}</span>
              <span class="gl-c-o">${e(x.org)}</span>
            </summary>
            <div class="gl-c-body"><ul class="gl-dash">${x.desc.map((d) => `<li>${e(d)}</li>`).join("")}</ul>${tagRow(x.tags)}</div>
          </details>
        </li>`;
      const ed = C.education;
      const log = pane({ id: "experience", hue: "blue", win: win(2), cmd: "git log --graph", note: "click a commit to show it", word: "LOG", body: `
          <ol class="gl-git">
            ${commit(X[0], 0, `<b class="d-head">HEAD</b>, <b class="d-tag">tag: now</b>`, true)}
            ${commit(X[1], 0, "")}
            <li class="gl-fork" aria-hidden="true"></li>
            ${commit(X[2], 1, `<b class="d-br">code-ninjas</b>`)}
            ${commit(X[3], 1, "")}
            <li class="gl-join" aria-hidden="true"></li>
            <li class="gl-c gl-edu" id="education">
              <span class="gl-node" aria-hidden="true">*</span>
              <div class="gl-edu-in">
                <span class="gl-c-h"><span class="gl-hash">${hash7(ed.school)}</span> <span class="gl-deco">(<b class="d-tag">tag: education</b>)</span> <span class="gl-dim">${e(ed.grad)}</span></span>
                <div class="gl-edu-row"><img src="${e(ed.logo)}" alt="" width="36" height="36"><span class="gl-c-s">${e(ed.degree)}</span></div>
                <span class="gl-c-o">${e(ed.school)} · ${e(ed.focus)}</span>
              </div>
            </li>
          </ol>` });

      // ── about: man rithvik, long parts behind --flags ──
      const tree = Object.entries(C.stack).map(([k, v], i, a) => `<li><span class="gl-dim">${i === a.length - 1 ? "└──" : "├──"}</span> <b>${e(k.toLowerCase())}/</b><ul>${v.map((x, j) => `<li><span class="gl-dim">${i === a.length - 1 ? "    " : "│   "}${j === v.length - 1 ? "└──" : "├──"}</span> ${e(x)}</li>`).join("")}</ul></li>`).join("");
      const places = C.places.map((pl) => `<div><dt>~/${e(pl.key)}</dt><dd>${e(pl.city)}</dd><dd class="gl-clk"><time data-clock="${e(pl.tz)}"></time></dd></div>`).join("");
      const man = pane({ id: "about", hue: "blue", win: win(3), cmd: "man rithvik", note: "section 1", word: "MAN", cls: "gl-man", body: `
          <div class="gl-man-cols">
            <div class="gl-man-a">
              <h3 class="gl-mh">NAME</h3>
              <p class="gl-mb"><b>rithvik</b> — ${e(C.role.toLowerCase())}</p>
              <h3 class="gl-mh">DESCRIPTION</h3>
              ${C.about.map((a) => `<p class="gl-mb">${e(a)}</p>`).join("")}
            </div>
            <div class="gl-man-b">
              <h3 class="gl-mh">ENVIRONMENT</h3>
              <dl class="gl-env">
                <div><dt>BUILDING</dt><dd>${e(C.now.building)}</dd></div>
                <div><dt>RESEARCHING</dt><dd>${e(C.now.researching)}</dd></div>
                <div><dt>LEARNING</dt><dd>${e(C.now.learning)}</dd></div>
              </dl>
              <h3 class="gl-mh">FILES</h3>
              <dl class="gl-files">${places}</dl>
              <details class="gl-more"><summary><span class="gl-flag">--stack</span></summary><ul class="gl-tree">${tree}</ul></details>
              <details class="gl-more"><summary><span class="gl-flag">--faq</span></summary><dl class="gl-faq">${C.faq.map(([q, a]) => `<div><dt>${e(q)}</dt><dd>${e(a)}</dd></div>`).join("")}</dl></details>
            </div>
          </div>` });

      // ── graph: everything on record as one explorable map ──
      const map = H.graph ? pane({ id: "graph", hue: "blue", win: win(4), cmd: "rithvik --graph", note: "hover to trace · click to open", word: "MAP", cls: "gl-map", body: H.graph({ id: "glyph" }) }) : "";

      // ── play: ~/bin, programs you can run ──
      const fallback = ["records", "artboard", "typeracer", "angle", "dots", "center"].map((id) => ({ id, name: id, desc: "" }));
      const progs = H.PLAY && H.PLAY.length ? H.PLAY : fallback;
      const play = pane({ id: "play", hue: "red", win: win(5), cmd: "ls ~/bin", note: "for fun", word: "BIN", body: `
          <ol class="gl-bin">${progs.map((p) => `<li><button type="button" class="gl-prog" data-play="${e(p.id)}">
              <span class="gl-prog-x"><span class="gl-dim">./</span>${e(p.id)}</span>
              <span class="gl-prog-d">${e(p.desc || p.name)}</span>
            </button></li>`).join("")}</ol>` });

      // ── contact: commands that run ──
      const em = C.links.email, [eu, ed2] = em.split("@");
      const cmdRow = (attrs, cmd, label) => { const a = attrs.startsWith("href"); return `<li><${a ? "a" : 'button type="button"'} class="gl-cmd" ${attrs}><span class="gl-ps" aria-hidden="true">$</span><code>${cmd}</code><span class="gl-run">${e(label)}</span></${a ? "a" : "button"}></li>`; };
      const contact = pane({ id: "contact", hue: "red", win: win(6), cmd: "mail rpk", note: "inbox open", cls: "gl-mail", body: `
          <h2 class="gl-big" id="contact-h"><button type="button" data-compose class="gl-big-b"><span data-scr>${e(eu)}</span><wbr><span class="gl-at">@</span><span data-scr>${e(ed2)}</span></button></h2>
          <ol class="gl-cmds">
            ${cmdRow('data-compose="Internship opportunity"', `sudo hire rithvik <span class="gl-dim">--role</span> <q>"SWE or AI intern"</q>`, "compose")}
            ${cmdRow(`href="${e(C.links.github)}" target="_blank" rel="noopener"`, `open ${e(C.links.github.replace(/^https?:\/\//, ""))}`, "open")}
            ${cmdRow(`href="${e(C.links.linkedin)}" target="_blank" rel="noopener"`, `open ${e(C.links.linkedin.replace(/^https?:\/\//, "").replace(/\/$/, ""))}`, "open")}
            ${cmdRow("data-resume", "less resume.pdf", "view")}
            ${cmdRow(`data-copy="${e(em)}"`, `pbcopy &lt;&lt;&lt; ${e(em)}`, "copy")}
          </ol>` });

      const foot = `<footer class="gl-foot"><span class="gl-foot-mk" aria-hidden="true">${mk("gl-mk")}</span><p><span class="gl-dim">[process completed]</span> ${e(C.name)}</p></footer>`;

      return `<div class="gl" id="gl">
        <nav class="gl-tmux" aria-label="Sections">
          <a class="gl-sess" href="#top" data-gl-go="0" aria-label="Top">${mk("gl-mk") || "rpk"}</a>
          <ol class="gl-wins">${SECTIONS.map(([id, nm], i) => `<li><a href="#${id}" data-gl-go="${i}"${i === 0 ? ' aria-current="true"' : ""}><b>${i + 1}</b><span>:${nm}</span></a></li>`).join("")}</ol>
          <span class="gl-tfill" aria-hidden="true"></span>
          <span class="gl-msg" id="gl-msg" aria-live="polite"></span>
          <button type="button" class="gl-help" id="gl-help" aria-expanded="false" aria-controls="gl-keys"><kbd>?</kbd><span>keys</span></button>
        </nav>
        <div class="gl-keys" id="gl-keys" role="dialog" aria-label="Keyboard shortcuts" hidden><dl>${KEYS.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></div>
        ${hero}${who}${work}${log}${man}${map}${play}${contact}${foot}
      </div>`;
    },

    mount(root, H) {
      const html = document.documentElement;
      const offs = [], timers = new Set();
      const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      const $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
      const calm = () => H.reduceMotion() || html.classList.contains("lite");
      const secs = SECTIONS.map(([id]) => root.querySelector("#" + id)).map((el, i) => el || root.querySelector("#top"));
      const wins = $$(".gl-wins [data-gl-go]");
      const msg = $("#gl-msg"), help = $("#gl-help"), keys = $("#gl-keys");
      let tops = [], active = -1, raf = 0;

      /** Measure section tops for the active-window tracker. */
      function measure() { tops = secs.map((s) => s.getBoundingClientRect().top + scrollY); tick(); }
      /** Track the active section: tmux window highlight and the chrome hue. */
      function tick() {
        raf = 0;
        const y = scrollY + innerHeight * 0.4;
        let i = 0; tops.forEach((t, k) => { if (y >= t - 2) i = k; });
        if (i === active) return;
        active = i;
        wins.forEach((w, k) => (k === i ? w.setAttribute("aria-current", "true") : w.removeAttribute("aria-current")));
        html.dataset.glHue = SECTIONS[i][2];
      }
      // performance mode holds one still shader frame; re-draw that still once scrolling stops so it matches the page
      let stillT = 0;
      on(window, "scroll", () => { if (!raf) raf = requestAnimationFrame(tick); if (calm()) { clearTimeout(stillT); timers.delete(stillT); stillT = later(() => H.kickShader(), 160); } }, { passive: true });
      const ro = new ResizeObserver(() => measure()); ro.observe(root);

      /* ───── navigation ───── */
      const smooth = () => (calm() ? "auto" : "smooth");
      function go(i) { i = Math.max(0, Math.min(secs.length - 1, i)); if (i === 0) scrollTo({ top: 0, behavior: smooth() }); else secs[i].scrollIntoView({ behavior: smooth(), block: "start" }); }
      function step(dir) {
        const ps = $$(".gl-pane, .gl-hero").map((s) => s.getBoundingClientRect().top + scrollY);
        if (dir > 0) { const n = ps.find((t) => t > scrollY + 60); scrollTo({ top: n !== undefined ? n - 40 : document.documentElement.scrollHeight, behavior: smooth() }); }
        else { const n = ps.filter((t) => t < scrollY - 60).pop(); scrollTo({ top: n !== undefined ? Math.max(0, n - 40) : 0, behavior: smooth() }); }
      }
      $$("[data-gl-go]").forEach((w) => on(w, "click", (ev) => { ev.preventDefault(); go(+w.dataset.glGo); }));
      let msgT = 0, qi = 0;
      function say(t) { msg.textContent = t; msg.classList.add("on"); clearTimeout(msgT); timers.delete(msgT); msgT = later(() => { msg.classList.remove("on"); msg.textContent = ""; }, 2200); }
      const showKeys = (v) => { keys.hidden = !v; help.setAttribute("aria-expanded", String(v)); };
      on(help, "click", () => showKeys(keys.hidden));
      on(document, "click", (ev) => { if (!keys.hidden && !ev.target.closest("#gl-keys, #gl-help")) showKeys(false); });
      on(window, "keydown", (ev) => {
        if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
        const a = document.activeElement;
        if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;
        if (html.classList.contains("locked") || document.getElementById("switcher")?.classList.contains("open")) return;
        const k = ev.key;
        if (k === "Escape") { showKeys(false); return; }
        if (k === "j") step(1);
        else if (k === "k") step(-1);
        else if (k === "g") scrollTo({ top: 0, behavior: smooth() });
        else if (k === "G") scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth() });
        else if (/^[1-7]$/.test(k)) go(+k - 1);
        else if (k === ":") { ev.preventDefault(); H.openAgent(); }
        else if (k === "r") H.openResume();
        else if (k === "m") H.openComposer("");
        else if (k === "p") { if (H.openPlay) H.openPlay("records"); else go(5); }
        else if (k === "?") showKeys(keys.hidden);
        else if (/^[a-z]$/i.test(k) && k !== "t" && k !== "T") say(QUIPS[qi++ % QUIPS.length]);
      });

      /* ───── work: selection follows hover and focus; the preview mirrors it ───── */
      const rowsEl = $$(".gl-row"), pvs = $$("[data-gl-pv]");
      function pick(i) { rowsEl.forEach((r, k) => (k === i ? r.setAttribute("aria-current", "true") : r.removeAttribute("aria-current"))); pvs.forEach((p, k) => (p.hidden = k !== i)); }
      rowsEl.forEach((r) => { on(r, "pointerenter", () => pick(+r.dataset.glI)); on(r, "focus", () => pick(+r.dataset.glI)); });

      /* ───── the hero prompt hands off to the core agent ───── */
      const ask = $("#gl-ask"), askIn = $("#gl-ask-in");
      on(ask, "submit", (ev) => { ev.preventDefault(); const v = askIn.value.trim(); askIn.value = ""; askIn.blur(); H.openAgent(v || undefined); });
      // the placeholder types its own questions while the hero is on screen (never in performance mode)
      let heroOn = true, qn = 0, ci = ASKS[0].length, dir = -1, hold = 40;
      const typeT = setInterval(() => {
        if (calm() || !heroOn || document.activeElement === askIn || askIn.value) { if (calm()) askIn.placeholder = ASKS[0]; return; }
        if (hold > 0) { hold--; return; }
        const q = ASKS[qn]; ci += dir;
        if (ci <= 0) { dir = 1; qn = (qn + 1) % ASKS.length; ci = 0; hold = 4; }
        else if (ci >= ASKS[qn].length) { dir = -1; hold = 46; }
        askIn.placeholder = (dir > 0 ? ASKS[qn] : q).slice(0, Math.max(0, ci)) + "▌";
      }, 55);

      /* ───── decode: headings resolve out of scrambled glyphs once, on first view ───── */
      const jobs = []; let sRaf = 0;
      function scramble(el) {
        if (calm()) return;
        const T = el.dataset.scrT || el.textContent; el.dataset.scrT = T;
        jobs.push({ el, T, t0: performance.now(), d: Math.min(1000, 360 + T.length * 22) });
        if (!sRaf) sRaf = requestAnimationFrame(run);
      }
      function run(now) {
        sRaf = 0;
        for (let j = jobs.length - 1; j >= 0; j--) {
          const { el, T, t0, d } = jobs[j], k = (now - t0) / d;
          if (k >= 1 || calm()) { el.textContent = T; jobs.splice(j, 1); continue; }
          let out = "";
          for (let i = 0; i < T.length; i++) { const c = T[i], at = (i / T.length) * 0.65 + (((i * 7919) % 13) / 13) * 0.3; out += c === " " || k > at ? c : GLY[(Math.random() * GLY.length) | 0]; }
          el.textContent = out;
        }
        if (jobs.length) sRaf = requestAnimationFrame(run);
      }
      const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { io.unobserve(x.target); scramble(x.target); } }), { rootMargin: "0px 0px -8% 0px" });
      $$("[data-scr]").forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) scramble(el); else io.observe(el); });
      const heroIo = new IntersectionObserver((en) => { heroOn = en[0].isIntersecting; });
      heroIo.observe(secs[0]);

      /* ───── clocks ───── */
      const clocks = setInterval(() => $$("[data-clock]").forEach((el) => (el.textContent = H.clock(el.dataset.clock))), 20000);

      // a still shader frame is drawn at load in reduced motion / performance mode; redraw once its boot has settled
      if (calm()) later(() => H.kickShader(), 2900);

      measure();
      later(measure, 600);
      if (document.fonts?.ready) document.fonts.ready.then(() => { if (root.isConnected) measure(); });

      return () => {
        offs.forEach((f) => f()); timers.forEach((id) => clearTimeout(id)); timers.clear();
        clearInterval(typeT); clearInterval(clocks);
        cancelAnimationFrame(raf); cancelAnimationFrame(sRaf);
        ro.disconnect(); io.disconnect(); heroIo.disconnect();
        delete html.dataset.glHue;
      };
    },
  });
})();
