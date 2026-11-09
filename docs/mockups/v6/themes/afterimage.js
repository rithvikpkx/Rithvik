/* Afterimage: the portfolio as a long exposure at dusk. A vertical film in six scenes under a
   timecode bar; a projector beam sweeps the fog as you scroll and the display type leaves
   coloured afterimages behind it. One pinned beat (the line), stills for work, credits for contact. */
(function () {
  "use strict";
  const SCENES = [["top", "Opening"], ["line", "The line"], ["work", "Stills"], ["experience", "Roles"], ["about", "Notes"], ["play", "Intermission"], ["contact", "Credits"]];
  const NAV = { play: "Play" };
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  /** Frames (24 fps) to SMPTE-style timecode. */
  const tc = (f) => { const s = Math.floor(f / 24); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % 24)}`; };
  /** Display type with three outline ghosts behind it; the ghosts trail on scroll velocity. */
  const echo = (t) => `<span class="ai-echo" data-echo><span class="ai-echo-base">${t}</span>${[1, 2, 3].map((i) => `<span class="ai-ghost" style="--i:${i}" aria-hidden="true">${t}</span>`).join("")}</span>`;
  const slate = (n, name) => `<p class="ai-slate"><span>SC ${pad(n)}</span><i aria-hidden="true"></i><span>${name}</span></p>`;
  // deterministic pseudo-random for the composed stills
  const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const wave = (y0, amp, seed, burst) => { let d = ""; for (let x = 0; x <= 300; x += 3) { const b = burst ? Math.exp(-Math.pow((x - burst) / 26, 2)) * 3.2 + 1 : 1; const y = y0 + (Math.sin(x * 0.11 + seed) * 0.6 + Math.sin(x * 0.37 + seed * 2) * 0.4 + (rnd(x + seed * 50) - 0.5) * 0.9) * amp * b; d += `${x ? "L" : "M"}${x} ${y.toFixed(1)}`; } return d; };

  /** Each project becomes a still composed from colour, type and SVG: no photographs. */
  const ART = {
    "mind-controlled-arm": () => `${[0, 1, 2, 3].map((i) => `<path d="${wave(34 + i * 13, 3.2, i * 1.7, 168)}" class="s-ln" style="opacity:${0.95 - i * 0.18}"/>`).join("")}
      <path d="M168 92 C168 104 180 104 178 116" class="s-dash"/>
      <rect x="34" y="176" width="54" height="8" class="s-solid"/><path d="M61 176 L92 122 L168 116 L206 142" class="s-arm"/>
      <circle cx="92" cy="122" r="6" class="s-joint"/><circle cx="168" cy="116" r="6" class="s-joint"/><path d="M206 142 L224 134 M206 142 L220 156" class="s-arm"/>`,
    boilerframe: () => { let g = ""; for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const x = 24 + c * 52, y = 22 + r * 38, hit = r === 1 && c === 2; g += `<rect x="${x}" y="${y}" width="46" height="30" class="${hit ? "s-hit" : "s-cell"}"/>`; } let tk = ""; for (let x = 24; x <= 276; x += 6) tk += `M${x} 160 V${x % 30 === 0 ? 152 : 156}`;
      return `${g}<path d="M122 56 h-6 v6 M164 56 h6 v6 M122 90 h-6 v-6 M164 90 h6 v-6" class="s-brk"/><circle cx="140" cy="73" r="8" class="s-face"/><path d="M140 61 V85 M128 73 H152" class="s-ln thin"/>
      <path d="M24 160 H276 ${tk}" class="s-ln thin"/>${[70, 140, 236].map((x) => `<path d="M${x - 5} 172 L${x} 163 L${x + 5} 172 Z" class="s-tri"/>`).join("")}<text x="24" y="190" class="s-tx">MATCH</text>`; },
    "eeg-thought-prediction": () => `${Array.from({ length: 16 }, (_, i) => `<path d="${wave(18 + i * 7.4, 1.6, i * 0.9)}" class="s-ln thin" style="opacity:${(0.35 + rnd(i) * 0.6).toFixed(2)}"/>`).join("")}
      ${[["L", 26], ["N", 14], ["R", 52]].map(([k, h], i) => `<rect x="${170 + i * 40}" y="${190 - h}" width="26" height="${h}" class="${i === 2 ? "s-hit-f" : "s-bar"}"/><text x="${183 + i * 40}" y="${183 - h}" class="s-tx c">${k}</text>`).join("")}<text x="24" y="190" class="s-tx">CH 16</text>`,
    "citizen-happiness": () => `<path d="M30 170 H280 M30 170 V22" class="s-ln thin"/>${Array.from({ length: 30 }, (_, i) => { const x = 40 + rnd(i) * 230, y = 160 - (x - 40) * 0.5 + (rnd(i + 40) - 0.5) * 50; return `<circle cx="${x.toFixed(1)}" cy="${Math.max(26, y).toFixed(1)}" r="${(2 + rnd(i + 9) * 2.4).toFixed(1)}" class="${i % 4 ? "s-dot" : "s-dot b"}"/>`; }).join("")}
      <path d="M34 162 L276 48" class="s-reg"/><path d="M150 70 C120 72 118 118 160 122 C204 126 216 84 196 72 C184 64 166 68 150 70 Z" class="s-dash"/><text x="38" y="190" class="s-tx">LASSO</text>`,
    qrify: () => { let q = ""; const N = 21, S = 6, ox = 150, oy = 34; const fin = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (fin(r, c)) continue; if (rnd(r * 31 + c * 7) > 0.52) q += `M${ox + c * S} ${oy + r * S}h${S}v${S}h-${S}z`; }
      const F = (x, y) => `<rect x="${x + 3}" y="${y + 3}" width="36" height="36" class="s-qf"/><rect x="${x + 12}" y="${y + 12}" width="18" height="18" class="s-qd"/>`;
      return `<path d="${q}" class="s-qd"/>${F(ox - 3, oy - 3)}${F(ox + (N - 7) * S - 3, oy - 3)}${F(ox - 3, oy + (N - 7) * S - 3)}<text x="30" y="104" class="s-big">Aa</text><path d="M104 96 H136 M128 90 L136 96 L128 102" class="s-arw"/><rect x="30" y="118" width="80" height="2" class="s-qd"/>`; },
    "habitat-humanity-ecomm": () => `<path d="M40 150 V100 L80 70 L120 100 V150 Z M70 150 V124 H90 V150" class="s-arm thin"/><path d="M124 108 C168 108 168 64 206 64 M124 118 C168 118 168 142 206 142" class="s-dash"/>
      ${[[206, 44, "Marketplace"], [206, 122, "eBay"]].map(([x, y, l]) => `<rect x="${x}" y="${y}" width="74" height="40" class="s-card"/><rect x="${x + 8}" y="${y + 8}" width="20" height="20" class="s-hit-f"/><path d="M${x + 34} ${y + 12} h32 M${x + 34} ${y + 20} h22" class="s-ln thin"/><text x="${x}" y="${y + 54}" class="s-tx">${l}</text>`).join("")}`,
  };

  V6.theme({
    id: "afterimage", name: "Afterimage", mood: "long exposure at dusk", dark: true,
    keywords: ["film", "cinema", "cinematic", "movie", "dusk", "projector", "credits", "beam", "exposure", "nostalgia"],
    fonts: "family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400",
    swatch: ["#0D0B1E", "#F2EDE4", "#FF6A3D", "#7B5CFF"],
    cardFont: "Archivo, sans-serif", // unquoted: the core writes it into a double-quoted style attribute
    colors: ["#FF6A3D", "#FFB8E0", "#7B5CFF", "#F2EDE4"],
    shaderScale: 0.5,
    shader: `
const vec3 NIGHT = vec3(.051, .043, .118);
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = u_time, sc = u_scroll;
  // dusk: night above, a violet floor and an ember horizon that never quite goes out
  vec3 col = mix(NIGHT, vec3(.11, .06, .2), smoothstep(.75, 0., uv.y) * .7);
  float hz = exp(-pow((uv.y - .01) * 4.2, 2.));
  col += u_c0 * .13 * hz + u_c1 * .035 * hz;
  float haze = fbm(p * 1.3 + vec2(t * .012, -t * .008)) * .5 + .5;
  col += u_c2 * .07 * haze * (1. - uv.y * .5);

  // the projector: its source slides along the top edge as the film plays, aimed at a drifting target
  float s2 = smoothstep(.1, .92, sc);
  vec2 O = vec2(asp * mix(-.03, 1.03, s2), .972 - .012 * sin(sc * 3.1416));
  O += (u_mouse - .5) * vec2(.05, .02);
  vec2 T = vec2(asp * mix(.72, .26, s2) + .05 * sin(t * .09), .45 + .13 * sin(sc * 9.42 + .5));
  vec2 dir = normalize(T - O);
  vec2 d = p - O;
  float along = dot(d, dir);
  float perp = dir.x * d.y - dir.y * d.x;
  float w = along * .23 + .014;
  float inside = smoothstep(w, w * .15, abs(perp)) * smoothstep(-.02, .12, along);
  float fall = 1. / (1. + along * along * .45);
  // volumetric density in beam space: fog rolls away from the lens
  vec2 bq = vec2(along * 1.4 - t * .07, perp / (along + .3) * 2.4);
  float dens = fbm(bq * 1.6 + vec2(0., t * .025)) * .5 + .5;
  float streak = vnoise(vec2(perp / (along + .1) * 20., t * .12 + sc * 2.));
  float core = exp(-pow(perp / (w * .42 + .001), 2.));
  float beam = inside * fall * (.3 + 1.05 * dens * dens) * (.62 + .6 * streak) * (.55 + .55 * core);
  float edge = clamp(abs(perp) / (w + .001), 0., 1.);
  vec3 bc = mix(u_c3, u_c0, smoothstep(.05, 1.2, along));
  bc = mix(bc, u_c1, smoothstep(.25, .75, edge) * .55);
  bc = mix(bc, u_c2 * 1.35, smoothstep(.55, 1., edge) * .75);
  col += bc * beam * .6;
  // wide scatter skirt around the cone, so the beam sits in air rather than on it
  col += mix(u_c2, u_c1, .35) * smoothstep(w * 2.6, w * .6, abs(perp)) * smoothstep(0., .2, along) * fall * (.35 + .65 * dens) * .085;

  // dust: fine motes and soft out-of-focus discs, lit only where the beam passes
  float lit = inside * fall;
  vec2 dq = p * 36. + vec2(t * .22, t * .5);
  vec2 ci = floor(dq), cf = fract(dq);
  float h = hash21(ci);
  vec2 pt = .25 + .5 * vec2(hash21(ci + 3.7), hash21(ci + 9.1)) + .14 * vec2(sin(t * .7 + h * 30.), cos(t * .6 + h * 20.));
  float mote = smoothstep(.17, 0., length(cf - pt)) * step(.7, h) * (.5 + .5 * sin(t * 1.6 + h * 60.));
  col += mix(u_c3, u_c1, h) * mote * lit * 1.5;
  vec2 kq = p * 8. + vec2(-t * .04, t * .1);
  vec2 ki = floor(kq), kf = fract(kq);
  float h2 = hash21(ki + 11.);
  float kd = length(kf - (.3 + .4 * vec2(hash21(ki + 1.3), hash21(ki + 5.9))));
  float bok = (smoothstep(.2, .15, kd) * .55 + smoothstep(.2, .18, kd) * smoothstep(.14, .18, kd) * .6) * step(.78, h2);
  col += mix(u_c1, u_c0, h2) * bok * lit * .2;

  // lens flare at the source: hot core, ember halo, anamorphic streak, ghosts mirrored through the centre
  vec2 fo = p - O; float r = length(fo);
  col += u_c3 * exp(-r * r * 240.) * 1.1 + mix(u_c0, u_c1, .3) * exp(-r * 6.5) * .3;
  col += mix(u_c1, u_c2, .55) * exp(-abs(fo.y) * 110.) * exp(-abs(fo.x) * 1.2) * .5;
  vec2 ctr = vec2(asp * .5, .5);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 g = O + (ctr - O) * (1.3 + fi * .4);
    float rad = .03 + fi * .035, gd = length(p - g);
    vec3 gc = i == 0 ? u_c2 : (i == 1 ? u_c0 : u_c1);
    col += gc * (smoothstep(rad, rad * .6, gd) * .035 + smoothstep(rad * 1.04, rad, gd) * smoothstep(rad * .9, rad, gd) * .06);
  }

  // print: vignette, a breath of projector flicker, then grain so the low resolution reads as film
  col *= 1. - .5 * pow(length((uv - .5) * vec2(1., .9)) * 1.25, 2.4);
  col *= .988 + .012 * hash21(vec2(floor(t * 12.), 3.));
  col += (hash21(gl_FragCoord.xy + fract(t * 13.7) * vec2(173., 91.)) - .5) * .06;
  gl_FragColor = vec4(col, 1.);
}`,

    render(C, H) {
      const e = H.esc;
      const lineWords = C.line.split(" ").map((w, i) => `<span class="ai-w" style="--d:${i}">${e(w)}</span>`).join(" ");
      const orgs = [...new Set(C.experience.map((x) => x.org))];
      const places = C.places.map((p) => `<li class="ai-loc"><span class="ai-loc-k">${e(p.key)}</span><b>${e(p.city)}</b><span class="ai-coord">${Math.abs(p.lat).toFixed(2)}° ${p.lat >= 0 ? "N" : "S"} · ${Math.abs(p.lng).toFixed(2)}° ${p.lng >= 0 ? "E" : "W"}</span><time data-clock="${p.tz}"></time></li>`).join("");
      const stills = C.projects.map((p, i) => `
        <li class="ai-still s${i + 1}">
          <button type="button" class="ai-frame" data-case="${p.slug}" aria-label="Open ${e(p.title)}">
            <span class="ai-art" aria-hidden="true"><svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">${ART[p.slug] ? ART[p.slug]() : ""}</svg><span class="ai-fnum">${pad(i + 1)}</span></span>
            <span class="ai-edge" aria-hidden="true"><span>RPK ${pad(i + 1)}A</span><span>▸ ${tc((i + 1) * 1447)}</span></span>
          </button>
          <div class="ai-cap">
            <p class="ai-cap-k">${e(p.title)} <b aria-hidden="true">×</b> <span>${e(p.kind)}</span></p>
            <h3>${e(p.headline)}</h3>
            <p class="ai-ctx">${e(p.ctx)}</p>
          </div>
        </li>`).join("");
      const roles = C.experience.map((x, i) => `
        <li class="ai-role" id="experience-${x.slug}">
          <span class="ai-role-n" aria-hidden="true">4${"ABCD"[i]}</span>
          <div class="ai-role-b">
            <p class="ai-sl"><span>${e(x.org)}</span><i aria-hidden="true"></i><span>${e(x.when)}</span></p>
            <h3>${e(x.role)}</h3>
            <p class="ai-where">${e(x.where)}</p>
            <ul class="ai-act">${x.desc.map((d) => `<li>${e(d)}</li>`).join("")}</ul>
          </div>
        </li>`).join("");
      const ed = C.education;
      const credit = (k, v) => `<div class="ai-cr-row"><dt>${e(k)}</dt><dd>${v}</dd></div>`;
      return `
<div class="ai" data-sc="0">
  <div class="ai-lb t" aria-hidden="true"></div><div class="ai-lb b" aria-hidden="true"></div>
  <div class="ai-scan" aria-hidden="true"></div>
  <header class="ai-bar">
    <a class="ai-mark" href="#top" aria-label="${e(C.name)}, back to the opening">${H.mark()}<span aria-hidden="true">${e(C.initials)}</span></a>
    <span class="ai-dots" aria-hidden="true"></span>
    <p class="ai-tc-scene"><span>Scene</span> <b data-scn>01</b> <span class="ai-tc-sep" aria-hidden="true">·</span> <span data-scname>Opening</span></p>
    <span class="ai-dots" aria-hidden="true"></span>
    <p class="ai-tc"><span class="sr-only">Timecode </span><span class="ai-rew" aria-hidden="true">REW ◂◂</span><span data-tc>00:00:00:00</span></p>
    <span class="ai-dots ai-dots-n" aria-hidden="true"></span>
    <nav class="ai-nav" aria-label="Scenes">${SCENES.slice(2).map(([id, n]) => `<a href="#${id}" data-go="${id}">${NAV[id] || n}</a>`).join("")}</nav>
    <span class="ai-prog" aria-hidden="true"><i></i></span>
  </header>
  <p class="ai-edgeprint" aria-hidden="true"><span>RPK</span><span>24 FPS</span><span>FR <b data-fr>0000000</b></span><span>Afterimage</span></p>

  <section id="top" class="ai-scene ai-open" data-scene="0" aria-labelledby="ai-name">
    <div class="ai-open-text">
      ${slate(1, "Opening")}
      <h1 class="ai-name" id="ai-name"><span class="ai-n1">${echo(e(C.first))}</span><span class="ai-n2">${echo(e(C.last))}</span></h1>
      <p class="ai-role-line">${e(C.role)}</p>
      <p class="ai-lede">${e(C.line)}</p>
      <p class="ai-status"><i aria-hidden="true"></i>${e(C.status)}</p>
      <div class="ai-acts">
        <button type="button" class="ai-btn pri" data-resume>${H.icon("file-text")}Resume</button>
        <button type="button" class="ai-btn" data-compose>${H.icon("mail")}Email</button>
        <button type="button" class="ai-btn" data-agent>${H.icon("terminal")}Ask the agent</button>
      </div>
    </div>
    <div class="ai-open-pt">
      <svg class="ai-iris" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="96" pathLength="360" class="ai-iris-t"/><circle cx="100" cy="100" r="90" class="ai-iris-r"/></svg>
      ${H.portrait({ id: "afterimage" })}
      <p class="ai-pt-cap"><span>Now</span><span>${e(C.now.city)}</span><time data-clock="${C.now.tz}"></time></p>
    </div>
    <p class="ai-roll-cue" aria-hidden="true"><span>Roll</span><i></i></p>
  </section>

  <section id="line" class="ai-beat" data-scene="1" data-beat="0" aria-labelledby="ai-line-h">
    <div class="ai-pin">
      ${slate(2, "The line")}
      <h2 class="sr-only" id="ai-line-h">What I work on</h2>
      <div class="ai-beats">${C.thesis.map((t, i) => `<p class="ai-bt" data-b="${i}"><span class="ai-bt-n">${pad(i + 1)} / ${pad(C.thesis.length)}</span>${echo(e(t))}</p>`).join("")}</div>
      <p class="ai-sub">${lineWords}</p>
      <p class="ai-meter" aria-hidden="true">${C.thesis.map((_, i) => `<i data-m="${i}"></i>`).join("")}</p>
    </div>
  </section>

  <section id="work" class="ai-scene ai-work" data-scene="2" aria-labelledby="ai-work-h">
    <header class="ai-head">${slate(3, "Stills")}<h2 class="ai-h2" id="ai-work-h">${echo("Stills")}</h2><p class="ai-kick">${e(C.numbers[3][0])} ${e(C.numbers[3][1])}</p></header>
    <ol class="ai-stills">${stills}</ol>
  </section>

  <section id="experience" class="ai-scene ai-roles" data-scene="3" aria-labelledby="ai-roles-h">
    <header class="ai-head">${slate(4, "Roles")}<h2 class="ai-h2" id="ai-roles-h">${echo("Roles")}</h2></header>
    <ol class="ai-sheet">${roles}</ol>
    <div class="ai-edu" id="education">
      <p class="ai-edu-k">Featuring</p>
      <img src="${ed.logo}" alt="" width="96" height="51" loading="lazy">
      <div><h3>${e(ed.school)}</h3><p>${e(ed.degree)}</p><p class="ai-mono">${e(ed.focus)} · ${e(ed.grad)}</p></div>
    </div>
  </section>

  <section id="about" class="ai-scene ai-notes" data-scene="4" aria-labelledby="ai-notes-h">
    <header class="ai-head">${slate(5, "Notes")}<h2 class="ai-h2" id="ai-notes-h">${echo("Notes")}</h2></header>
    <div class="ai-vo"><p class="ai-cue">${e(C.first.toUpperCase())} (V.O.)</p>${C.about.map((a) => `<p>${e(a)}</p>`).join("")}</div>
    <ul class="ai-inserts">${C.numbers.map(([n, l], i) => `<li class="ai-ins i${i}"><b>${e(n)}</b><span>${e(l)}</span></li>`).join("")}</ul>
    <div class="ai-notes-grid">
      <div class="ai-blk"><h3 class="ai-h3">Locations</h3><ul class="ai-locs">${places}</ul></div>
      <div class="ai-blk"><h3 class="ai-h3">In production</h3><dl class="ai-now">
        <div><dt>Building</dt><dd>${e(C.now.building)}</dd></div><div><dt>Researching</dt><dd>${e(C.now.researching)}</dd></div><div><dt>Learning</dt><dd>${e(C.now.learning)}</dd></div></dl></div>
    </div>
  </section>

  <section id="play" class="ai-scene ai-inter" data-scene="5" aria-labelledby="ai-play-h">
    <header class="ai-head">${slate(6, "Intermission")}
      <div class="ai-inter-t"><span class="ai-reel" aria-hidden="true">${H.mark("hatch")}</span><h2 class="ai-h2" id="ai-play-h">${echo("Intermission")}</h2></div>
      <p class="ai-kick">Short programs while the reel changes</p></header>
    <ul class="ai-tix">${H.PLAY.map((p, i) => `<li class="ai-tk t${i}"><button type="button" class="ai-tk-b" data-play="${p.id}">
      <span class="ai-tk-main"><span class="ai-tk-n">Program ${pad(i + 1)}</span><b>${e(p.name)}</b><span class="ai-tk-d">${e(p.desc)}</span></span>
      <span class="ai-tk-stub" aria-hidden="true">${H.icon(p.icon)}<span>Admit one</span></span></button></li>`).join("")}</ul>
  </section>

  <section id="contact" class="ai-scene ai-credits" data-scene="6" aria-labelledby="ai-cr-h">
    <div class="ai-roll">
      ${slate(7, "Credits")}
      <p class="ai-cr-small">A portfolio by</p>
      <h2 class="ai-cr-name" id="ai-cr-h">${echo(e(C.name))}</h2>
      <p class="ai-cr-role">${e(C.role)}</p>
      <dl class="ai-cr">
        ${credit("Starring", C.thesis.map(e).join("<br>"))}
        ${credit("Featuring", [ed.school, ...orgs.filter((o) => !o.startsWith(ed.school) && !o.endsWith(ed.school))].map(e).join("<br>"))}
        ${credit("Languages", C.stack.Languages.map(e).join(" · "))}
        ${credit("Dailies", C.log.slice(0, 2).map(([d, k, m]) => `<span class="ai-daily"><span>${e(d)}</span> <span>${e(k)}</span> ${e(m)}</span>`).join(""))}
      </dl>
      <div class="ai-cr-contact">
        <p class="ai-cr-small">Contact</p>
        <button type="button" class="ai-mail" data-compose>${e(C.links.email)}</button>
        <p class="ai-status c"><i aria-hidden="true"></i>${e(C.status)}</p>
        <div class="ai-acts c">
          <button type="button" class="ai-btn pri" data-compose>${H.icon("send")}Write to me</button>
          <a class="ai-btn" href="${C.links.github}" target="_blank" rel="noopener">${H.logo("github")}GitHub</a>
          <a class="ai-btn" href="${C.links.linkedin}" target="_blank" rel="noopener">${H.logo("linkedin")}LinkedIn</a>
          <button type="button" class="ai-btn" data-resume>${H.icon("file-text")}Resume</button>
        </div>
      </div>
      <div class="ai-endcard"><span class="ai-end-mark" aria-hidden="true">${H.mark()}</span><p class="ai-end">End</p>
        <button type="button" class="ai-btn ai-rewind" data-rewind>${H.icon("skip-back")}Rewind to the opening</button></div>
    </div>
    <footer class="ai-foot"><span>© 2026 ${e(C.name)}</span><span data-tc-end>${tc(0)}</span></footer>
  </section>
</div>`;
    },

    mount(root, H) {
      const offs = [];
      const on = (t, ev, f, o) => { t.addEventListener(ev, f, o); offs.push(() => t.removeEventListener(ev, f, o)); };
      const $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
      const ai = $(".ai"), tcEl = $("[data-tc]"), tcEnd = $("[data-tc-end]"), frEl = $("[data-fr]"), prog = $(".ai-prog i");
      const scn = $("[data-scn]"), scname = $("[data-scname]"), beat = $(".ai-beat"), words = $$(".ai-w"), nav = $$(".ai-nav a");
      const echoes = $$("[data-echo]"), live = new Set();
      let lastTC = "", lastB = -1, lastLit = -1, ticking = 0;

      /** Scroll-driven state: timecode, progress hairline, the pinned beat and its subtitle. */
      function sync() {
        ticking = 0;
        const y = scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        const r = beat.getBoundingClientRect();
        const s = tc(Math.round(y * 0.8));
        if (s !== lastTC) { tcEl.textContent = s; lastTC = s; }
        prog.style.transform = `scaleX(${Math.min(1, y / max).toFixed(4)})`;
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
        const b = Math.min(2, Math.floor(p * 3));
        if (b !== lastB) { beat.dataset.beat = b; lastB = b; }
        const lit = Math.min(words.length, Math.round(p * 1.25 * words.length));
        if (lit !== lastLit) { words.forEach((w, i) => w.classList.toggle("on", i < lit)); lastLit = lit; }
      }
      const req = () => { if (!ticking) ticking = requestAnimationFrame(sync); };
      // the end is the beginning: rewind runs the timecode backwards to the opening
      on(root, "click", (ev) => { if (ev.target.closest("[data-rewind]")) window.scrollTo({ top: 0, behavior: H.reduceMotion() ? "auto" : "smooth" }); });
      on(window, "scroll", req, { passive: true }); on(window, "resize", req);
      tcEnd.textContent = tc(Math.round(Math.max(0, document.documentElement.scrollHeight - innerHeight) * 0.8));
      sync();

      // which scene is in the gate (the middle band of the viewport)
      const sio = new IntersectionObserver((es) => es.forEach((en) => {
        if (!en.isIntersecting) return;
        const n = +en.target.dataset.scene; ai.dataset.sc = n;
        scn.textContent = pad(n + 1); scname.textContent = SCENES[n][1];
        nav.forEach((a) => (a.dataset.go === SCENES[n][0] ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
      }), { rootMargin: "-48% 0px -50% 0px" });
      $$("[data-scene]").forEach((s) => sio.observe(s));
      // ambient loops pause off-screen; echo work only for type that is on screen
      const vio = new IntersectionObserver((es) => es.forEach((en) => en.target.toggleAttribute("data-off", !en.isIntersecting)));
      $$(".ai-scene, .ai-beat").forEach((s) => vio.observe(s));
      const eio = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) live.add(en.target); else { live.delete(en.target); en.target.style.setProperty("--ev", "0"); } }));
      echoes.forEach((el) => eio.observe(el));

      // the projector runs: echo trails follow scroll velocity and the edge print counts frames
      let raf = 0, lastY = scrollY, ev = 0, shown = 0, n = 0, rm = H.reduceMotion(), rew = false;
      const bar = $(".ai-bar");
      const t0 = performance.now();
      function loop(now) {
        raf = requestAnimationFrame(loop);
        if (++n % 30 === 0) rm = H.reduceMotion();
        const y = scrollY, dy = y - lastY; lastY = y;
        ev = rm ? 0 : ev * 0.88 + Math.max(-90, Math.min(90, dy)) * 0.12;
        if (Math.abs(ev - shown) > 0.04 || (ev === 0 && shown !== 0)) {
          shown = Math.abs(ev) < 0.02 ? 0 : ev;
          const v = shown.toFixed(2), a = Math.min(1, Math.abs(shown) / 30).toFixed(3);
          live.forEach((el) => { el.style.setProperty("--ev", v); el.style.setProperty("--ea", a); });
        }
        // scrolling back up fast reads as a rewind
        if ((ev < -6) !== rew) { rew = ev < -6; bar.classList.toggle("is-rew", rew); }
        if (!rm && n % 2 === 0) frEl.textContent = String(Math.floor(((now - t0) / 1000) * 24)).padStart(7, "0");
      }
      raf = requestAnimationFrame(loop);
      const clocks = setInterval(() => $$("[data-clock]").forEach((el) => (el.textContent = H.clock(el.dataset.clock))), 30000);

      return () => { cancelAnimationFrame(raf); cancelAnimationFrame(ticking); clearInterval(clocks); sio.disconnect(); vio.disconnect(); eio.disconnect(); offs.forEach((f) => f()); };
    },
  });
})();
