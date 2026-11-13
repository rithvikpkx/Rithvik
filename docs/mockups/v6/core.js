/* rithvik.ai v6 core. Every design is a complete website of its own: it renders its own layout from
   window.C and brings one fragment shader. The core owns what every design shares: the theme engine,
   the shader runtime, the portrait with its three beamed contacts, the design switcher, the agent
   (Claude Code-style TUI), the floating email window, the resume window and the case sheet.
   Contract for designs: CONTRACT.md. */
window.V6 = { themes: [], theme(def) { this.themes.push(def); } };

document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const C = window.C;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches || html.classList.contains("lite");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");

  /* ───────── Assets: Lucide icons, Simple Icons logos ───────── */
  const AS = window.ASSETS || { icons: {}, logos: {}, land: [], spinners: {}, banner: null, commits: [] };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AS.icons[n] || ""}</svg>`;
  const logo = (slug) => {
    const L = AS.logos[slug]; if (!L) return "";
    return L.svg16 ? `<svg class="logo" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${L.svg16}</svg>` : `<svg class="logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${L.d}"/></svg>`;
  };
  const TOOL_LOGO = { Python: "python", JavaScript: "javascript", TypeScript: "typescript", "C++": "cplusplus", React: "react", "Next.js": "nextdotjs", "Node.js": "nodedotjs", Express: "express", TensorFlow: "tensorflow", Keras: "keras", "scikit-learn": "scikitlearn", Pandas: "pandas", MongoDB: "mongodb", Supabase: "supabase", Vercel: "vercel", Cloudflare: "cloudflare", "Google Apps Script": "googleappsscript", Arduino: "arduino", Ollama: "ollama" };
  const hydrate = (root = document) => {
    $$("[data-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });
    $$("[data-logo-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = logo(el.dataset.logoIcon); });
  };
  const PROJECTS = C.projects;
  const P = (slug) => PROJECTS.find((p) => p.slug === slug);

  /* ───────── Toast ───────── */
  const toastEl = $("#toast"); let toastT = 0;
  function toast(h, actions = [], ms = 3600) {
    toastEl.innerHTML = h;
    actions.forEach((a) => { const b = document.createElement("button"); b.type = "button"; b.textContent = a.label; b.addEventListener("click", () => { a.run(); toastEl.hidden = true; }); toastEl.appendChild(b); });
    toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  /* ───────── Shader runtime: one WebGL canvas, one fragment shader per design ───────── */
  const GLSL_HEAD = `precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_scroll; uniform float u_dark;
uniform vec3 u_c0; uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3;
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y); }
vec3 _perm(vec3 x){ return mod(((x * 34.) + 1.) * x, 289.); }
float snoise(vec2 v){ const vec4 C = vec4(.211324865405187, .366025403784439, -.577350269189626, .024390243902439);
  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx); vec2 i1 = (x0.x > x0.y) ? vec2(1, 0) : vec2(0, 1);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.);
  vec3 p = _perm(_perm(i.y + vec3(0, i1.y, 1)) + i.x + vec3(0, i1.x, 1));
  vec3 m = max(.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.); m = m * m; m = m * m;
  vec3 x = 2. * fract(p * C.www) - 1.; vec3 h = abs(x) - .5; vec3 ox = floor(x + .5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - .85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130. * dot(m, g); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * snoise(p); p = p * 2.02 + 17.1; a *= .5; } return s; }
`;
  const shader = (function () {
    const cv = document.createElement("canvas"); cv.className = "gl"; cv.setAttribute("aria-hidden", "true");
    const gl = cv.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) { html.classList.add("no-gl"); return { use() {}, kick() {} }; }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }";
    let prog = null, U = {}, host = null, visible = true, raf = 0, t0 = performance.now(), cols = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], dark = 0;
    let scale = 0.5, baseScale = 0.5, slow = 0, last = 0, mouse = [0.5, 0.5], mouseS = [0.5, 0.5];
    const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; kick(); });
    function compile(src) {
      const mk = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn("[v6 shader]", gl.getShaderInfoLog(sh)); return null; } return sh; };
      const v = mk(gl.VERTEX_SHADER, VS), f = mk(gl.FRAGMENT_SHADER, GLSL_HEAD + src); if (!v || !f) return null;
      const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn("[v6 shader] link", gl.getProgramInfoLog(p)); return null; }
      return p;
    }
    const hex = (h) => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h || "#000000"); return m ? [1, 2, 3].map((i) => parseInt(m[i], 16) / 255) : [0, 0, 0]; };
    function size() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(r.width * dpr * scale)), h = Math.max(2, Math.round(r.height * dpr * scale));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    }
    function draw(now) {
      if (!prog) return;
      size(); gl.useProgram(prog);
      mouseS[0] += (mouse[0] - mouseS[0]) * 0.06; mouseS[1] += (mouse[1] - mouseS[1]) * 0.06;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      gl.uniform2f(U.u_res, cv.width, cv.height); gl.uniform1f(U.u_time, (now - t0) / 1000); gl.uniform2f(U.u_mouse, mouseS[0], mouseS[1]);
      gl.uniform1f(U.u_scroll, Math.min(1, scrollY / max)); gl.uniform1f(U.u_dark, dark);
      ["u_c0", "u_c1", "u_c2", "u_c3"].forEach((k, i) => gl.uniform3fv(U[k], cols[i]));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frame(now) {
      raf = 0;
      if (!prog || !visible || document.hidden) return;
      // adaptive resolution: if frames run long, render fewer pixels (never below 30% of CSS size)
      if (last) { const dt = now - last; slow = dt > 22 ? slow + 1 : Math.max(0, slow - 1); if (slow > 24 && scale > 0.3) { scale = Math.max(0.3, scale * 0.8); slow = 0; } }
      last = now; draw(now);
      if (!reduceMotion()) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && prog) { last = 0; raf = requestAnimationFrame(frame); } }
    addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); if (!r.width) return; mouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; }, { passive: true });
    document.addEventListener("visibilitychange", kick);
    addEventListener("resize", () => { if (reduceMotion()) requestAnimationFrame(draw); });
    /** Switch to a design's shader. hostEl: where the canvas lives (null = fixed full-screen background). */
    function use(def, hostEl) {
      cancelAnimationFrame(raf); raf = 0; io.disconnect();
      if (prog) { gl.deleteProgram(prog); prog = null; }
      if (!def || !def.shader) { cv.remove(); return; }
      prog = compile(def.shader);
      if (!prog) { cv.remove(); return; }
      U = {}; ["u_res", "u_time", "u_mouse", "u_scroll", "u_dark", "u_c0", "u_c1", "u_c2", "u_c3"].forEach((k) => (U[k] = gl.getUniformLocation(prog, k)));
      const loc = gl.getAttribLocation(prog, "p"); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      cols = (def.colors || []).concat(["#000000", "#000000", "#000000", "#000000"]).slice(0, 4).map(hex);
      dark = def.dark ? 1 : 0; baseScale = scale = def.shaderScale || 0.5; slow = 0;
      host = hostEl || $("#gl-host"); cv.classList.toggle("gl-fixed", !hostEl); host.appendChild(cv);
      visible = true; io.observe(cv);
      requestAnimationFrame((n) => { draw(n); kick(); });
    }
    return { use, kick, canvas: cv };
  })();

  /* ───────── Portrait: the plain photo, three contacts centred under it on an outer circle, beams curving up into it ───────── */
  // Geometry lives in a 400×470 box: photo centre (200,200) r=150; nodes on r=228 at 126°/90°/54°.
  const PT_NODES = [
    { k: "github", a: 126, label: "GitHub", href: C.links.github, inner: () => logo("github") },
    { k: "linkedin", a: 90, label: "LinkedIn", href: C.links.linkedin, inner: () => logo("linkedin") },
    { k: "email", a: 54, label: "Email", href: null, inner: () => icon("mail") },
  ];
  const PT_BEAMS = (() => {
    const d2r = (d) => (d * Math.PI) / 180;
    return PT_NODES.map((n) => {
      const s = d2r(n.a), e = d2r(90 + (n.a - 90) * 0.42), c = d2r(90 + (n.a - 90) * 0.1);
      const x0 = 200 + 202 * Math.cos(s), y0 = 200 + 202 * Math.sin(s), x1 = 200 + 150 * Math.cos(e), y1 = 200 + 150 * Math.sin(e);
      const cx = 200 + 188 * Math.cos(c), cy = 200 + 188 * Math.sin(c);
      return `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    });
  })();
  /** Portrait markup. Designs place and size it (width of .pt); they may restyle chrome but never filter the photo. */
  function portrait(opts = {}) {
    const nodes = PT_NODES.map((n, i) => {
      const x = (200 + 228 * Math.cos((n.a * Math.PI) / 180)) / 4, y = ((200 + 228 * Math.sin((n.a * Math.PI) / 180)) / 470) * 100;
      const attrs = n.href ? `href="${n.href}" target="_blank" rel="noopener"` : `href="#" data-compose`;
      return `<a class="pt-node pt-${n.k}" ${attrs} style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" aria-label="${n.label}" data-tip="${n.label}">${n.inner()}</a>`;
    }).join("");
    const beams = PT_BEAMS.map((d, i) => `<path class="pt-beam" d="${d}"/><path class="pt-pulse" d="${d}" pathLength="1" style="animation-delay:${(i * 0.14).toFixed(2)}s"/>`).join("");
    return `<figure class="pt${opts.cls ? " " + opts.cls : ""}" aria-label="Rithvik Praveen Kumar and where to reach him">
      <svg class="pt-beams" viewBox="0 0 400 470" aria-hidden="true"><defs><linearGradient id="pt-grad-${opts.id || "a"}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--pt-pulse-a)" stop-opacity="0"/><stop offset=".45" stop-color="var(--pt-pulse-a)"/><stop offset="1" stop-color="var(--pt-pulse-b)"/></linearGradient></defs>${beams.replace(/class="pt-pulse"/g, `class="pt-pulse" stroke="url(#pt-grad-${opts.id || "a"})"`)}</svg>
      <div class="pt-photo"><img src="rithvik.jpeg" alt="Rithvik Praveen Kumar" width="540" height="540" decoding="async"></div>
      ${nodes}</figure>`;
  }
  document.addEventListener("click", (e) => { const c = e.target.closest("[data-compose]"); if (c) { e.preventDefault(); openComposer(c.dataset.compose || ""); } });

  /* ───────── Case sheet (any design may use it, or present projects its own way) ───────── */
  const sheet = $("#sheet"), sheetBody = $("#sheet-body");
  let lastFocus = null;
  const chip = (t) => `<span class="chip">${TOOL_LOGO[t] ? logo(TOOL_LOGO[t]) : ""}${esc(t)}</span>`;
  function openCase(slug) {
    const p = P(slug); if (!p) return;
    const i = PROJECTS.indexOf(p), next = PROJECTS[(i + 1) % PROJECTS.length];
    $("#case").innerHTML = `<p class="case-kind">${icon(p.icon)} ${esc(p.kind)}</p><h1 id="case-h">${esc(p.headline)}</h1><p class="case-lede">${esc(p.desc[0])}</p>
      <div class="chips">${p.tags.map(chip).join("")}</div>
      <dl class="case-meta"><div><dt>Project</dt><dd>${esc(p.title)}</dd></div><div><dt>Context</dt><dd>${esc(p.ctx)}</dd></div></dl>
      <h2>What it does</h2><ul class="case-bullets">${p.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      ${Object.keys(p.links).length ? `<div class="case-links">${Object.entries(p.links).map(([k, v]) => `<a class="ui-btn" href="${v}" target="_blank" rel="noopener">${k} ${icon("arrow-up-right")}</a>`).join("")}</div>` : ""}
      <button type="button" class="case-next" data-case="${next.slug}"><span>Next</span><b>${esc(next.title)}</b></button>`;
    if (sheet.hidden) { lastFocus = document.activeElement; sheet.hidden = false; html.classList.add("locked"); }
    sheetBody.scrollTop = 0; sheetBody.focus({ preventScroll: true });
  }
  function closeCase() {
    if (sheet.hidden || sheet.classList.contains("closing")) return;
    sheet.classList.add("closing");
    setTimeout(() => { sheet.hidden = true; sheet.classList.remove("closing"); html.classList.remove("locked"); }, reduceMotion() ? 0 : 280);
    lastFocus?.focus?.({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-case]"); if (c) { e.preventDefault(); openCase(c.dataset.case); return; }
    if (e.target.closest("[data-close-sheet]")) closeCase();
  });

  /* ───────── Theme engine: each design renders a whole site into #stage ───────── */
  const THEMES = window.V6.themes;
  const TH = Object.fromEntries(THEMES.map((t) => [t.id, t]));
  const stage = $("#stage");
  const GF = "https://fonts.googleapis.com/css2?";
  let current = null, cleanup = null, lastTheme = null;
  function ensureFonts(t) {
    if (!t?.fonts || document.head.querySelector(`link[data-font="${t.id}"]`)) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = GF + t.fonts + "&display=swap"; l.dataset.font = t.id; document.head.appendChild(l);
  }
  /** Shared helpers handed to every design's render() and mount(). */
  const H = { C, esc, icon, logo, chip, portrait, hydrate, reduceMotion, fine, P, toast, store,
    openCase, openComposer: (s) => openComposer(s), openResume: () => openWin("resume"), openAgent: (q) => { openAgent(); if (q) submit(q); },
    clock: (tz, opts = {}) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, ...opts }).format(new Date()),
    kickShader: () => shader.kick() };
  function render(t) {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    html.dataset.theme = t.id; html.style.colorScheme = t.dark ? "dark" : "light";
    stage.innerHTML = t.render(C, H);
    hydrate(stage);
    $$("[data-clock]", stage).forEach((el) => (el.textContent = H.clock(el.dataset.clock)));
    window.scrollTo(0, 0);
    shader.use(t, t.shaderHost ? $(t.shaderHost, stage) : null);
    try { cleanup = t.mount ? t.mount(stage, H) || null : null; } catch (e) { console.error(e); }
    document.title = `${C.name} · ${t.name}`;
    setFavicon(t.swatch[2] || t.swatch[1]);
    $("#sw-name").textContent = t.name;
    $("#sw-dot").style.background = `conic-gradient(${t.swatch.map((c, i, a) => `${c} ${(i / a.length) * 100}% ${((i + 1) / a.length) * 100}%`).join(",")})`;
    $$(".sw-card").forEach((c) => c.setAttribute("aria-current", String(c.dataset.id === t.id)));
  }
  /** Switch design. Supported browsers get a circular reveal from the point the visitor clicked. */
  function apply(id, opts = {}) {
    const t = TH[id] || THEMES[0]; if (current === t.id && !opts.force) return;
    lastTheme = current; current = t.id; store.set("rv6-theme", t.id); ensureFonts(t);
    const go = () => render(t);
    if (document.startViewTransition && !reduceMotion() && !opts.instant) {
      const [x, y] = opts.from || [innerWidth / 2, innerHeight / 2];
      html.style.setProperty("--vt-x", x + "px"); html.style.setProperty("--vt-y", y + "px");
      html.classList.add("vt-reveal");
      const vt = document.startViewTransition(go); vt.finished.finally(() => html.classList.remove("vt-reveal"));
    } else go();
    if (!opts.silent) toast(`<span>Now viewing <b>${esc(t.name)}</b></span>`, lastTheme ? [{ label: "Undo", run: () => apply(lastTheme, { silent: true }) }] : []);
  }
  const cycle = (dir = 1) => { const i = THEMES.findIndex((t) => t.id === current); return THEMES[(i + dir + THEMES.length) % THEMES.length].id; };

  /* ───────── Design switcher: a floating pill that opens a deck of whole-site cards ───────── */
  const sw = $("#switcher"), swDeck = $("#sw-deck");
  swDeck.innerHTML = THEMES.map((t, i) => `<button type="button" class="sw-card" data-id="${t.id}" style="--s0:${t.swatch[0]};--s1:${t.swatch[1]};--s2:${t.swatch[2] || t.swatch[1]};--s3:${t.swatch[3] || t.swatch[0]};--sf:${esc(t.cardFont || "inherit")}" aria-label="Switch to ${esc(t.name)}">
      <span class="sw-art" aria-hidden="true"><i></i><i></i><i></i></span><span class="sw-n">${String(i + 1).padStart(2, "0")}</span><b>${esc(t.name)}</b><span class="sw-mood">${esc(t.mood)}</span></button>`).join("");
  const openDeck = (on) => { sw.classList.toggle("open", on); $("#sw-toggle").setAttribute("aria-expanded", String(on)); if (on) { THEMES.forEach(ensureFonts); $(".sw-card[aria-current=true]", swDeck)?.focus({ preventScroll: true }); } };
  $("#sw-toggle").addEventListener("click", (e) => { e.stopPropagation(); openDeck(!sw.classList.contains("open")); });
  swDeck.addEventListener("click", (e) => { const c = e.target.closest(".sw-card"); if (!c) return; const r = c.getBoundingClientRect(); openDeck(false); apply(c.dataset.id, { from: [r.left + r.width / 2, r.top + r.height / 2] }); });
  document.addEventListener("click", (e) => { if (!sw.contains(e.target)) openDeck(false); });
  $("#sw-shuffle").addEventListener("click", (e) => { const pool = THEMES.filter((t) => t.id !== current); apply(pool[(Math.random() * pool.length) | 0].id, { from: [e.clientX, e.clientY] }); });
  $("#sw-lite").addEventListener("click", () => { const on = html.classList.toggle("lite"); $("#sw-lite").setAttribute("aria-pressed", String(on)); store.set("rv6-lite", on ? "1" : "0"); shader.kick(); });
  $("#sw-lite").setAttribute("aria-pressed", String(html.classList.contains("lite")));
  document.addEventListener("click", (e) => { const s = e.target.closest("[data-theme-go]"); if (s) { e.preventDefault(); apply(s.dataset.themeGo, { from: [e.clientX, e.clientY] }); } });
  document.addEventListener("click", (e) => { if (e.target.closest("[data-agent]")) { e.preventDefault(); openAgent(); } if (e.target.closest("[data-resume]")) { e.preventDefault(); openWin("resume"); } });

  /* ───────── Agent: a Claude Code-style terminal agent ───────── */
  const agentEl = $("#agent"), panel = $("#agent-panel"), logEl = $("#agent-log"), input = $("#agent-input"), statusEl = $("#agent-status"), palette = $("#agent-palette"), sendBtn = $("#ab-send");
  const A = { open: false, busy: null, history: JSON.parse(store.get("rv6-hist", "[]")), hIdx: -1, turns: [], always: new Set(), pending: null, banner: false };
  const COMMANDS = [
    ["/help", "Show commands and shortcuts"], ["/resume", "Open the resume"], ["/projects", "List projects, or /projects <name>"], ["/experience", "Show experience"],
    ["/contact", "Draft an email to Rithvik"], ["/theme", "Switch design: /theme <name|random|list>"], ["/now", "Where Rithvik is right now"], ["/clear", "Clear the conversation"],
    ["/export", "Copy the transcript as Markdown"], ["/history", "Show recent prompts"], ["/fullscreen", "Toggle full screen"], ["/quit", "Close the agent"],
  ];
  const SPIN = (AS.spinners.dots && AS.spinners.dots.frames) || ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const VERBS = ["Retrieving", "Reading", "Grounding", "Drafting", "Verifying"];
  let spinT = 0;
  function idleStatus() { clearInterval(spinT); statusEl.innerHTML = `<span>● ready</span><span>23 records + resume</span><span>ctx 4.1k</span><span>${A.turns.length} turn${A.turns.length === 1 ? "" : "s"}</span><span>? for shortcuts</span>`; }
  function busyStatus() { clearInterval(spinT); let i = 0; const t0 = performance.now(); spinT = setInterval(() => { statusEl.innerHTML = `<span class="spin">${SPIN[i % SPIN.length]}</span><span>${VERBS[Math.floor((performance.now() - t0) / 1200) % VERBS.length]}…</span><span>${((performance.now() - t0) / 1000).toFixed(1)}s</span><span>esc to interrupt</span>`; i++; }, 80); }
  function openAgent(full) {
    if (!A.open) { panel.hidden = false; A.open = true; agentEl.dataset.open = "true"; if (!A.banner) banner(); idleStatus(); }
    if (full) html.classList.add("agent-full");
    input.focus({ preventScroll: true });
  }
  function closeAgent(fromRoute) { panel.hidden = true; A.open = false; agentEl.dataset.open = "false"; palette.hidden = true; if (html.classList.contains("agent-full")) { html.classList.remove("agent-full"); } }
  function toggleFull() { if (html.classList.contains("agent-full")) html.classList.remove("agent-full"); else openAgent(true); }
  $("#agent-close").addEventListener("click", closeAgent);
  $("#agent-full").addEventListener("click", toggleFull);
  input.addEventListener("focus", () => openAgent());
  function banner() {
    A.banner = true;
    const W = 44, pad = (t) => t + " ".repeat(Math.max(0, W - [...t].length));
    const rows = ["✻ rithvik.ai agent", "  grounded in 23 records + resume", "  /help for commands · esc to interrupt"];
    const box = `╭${"─".repeat(W + 2)}╮\n${rows.map((r) => `│ ${pad(r)} │`).join("\n")}\n╰${"─".repeat(W + 2)}╯`;
    logEl.insertAdjacentHTML("beforeend", `<pre class="agent-banner">${esc(box).replace("✻", '<span class="acc">✻</span>').replace("/help", '<span class="acc">/help</span>')}</pre>
      <p class="t-tips">Try "what has he built?", /resume or /theme random</p>
      <div class="t-starters">${["What has he built?", "What stack did BoilerFrame use?", "Is he open to internships?", "/theme random"].map((t) => `<button type="button" class="t-chip" data-q="${esc(t)}">${esc(t)}</button>`).join("")}</div>`);
  }
  logEl.addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]"); if (q) { submit(q.dataset.q); return; }
    const f = e.target.closest("[data-fill]"); if (f) { input.value = f.dataset.fill; input.focus(); return; }
    const s = e.target.closest("[data-src]"); if (s) { goTarget(s.dataset.src); return; }
    const k = e.target.closest("[data-key]"); if (k) { answerConfirm(k.dataset.key); return; }
    const c = e.target.closest("[data-copy-turn]"); if (c) { copy(A.turns[+c.dataset.copyTurn]?.a || "", "Answer copied"); return; }
    const r = e.target.closest("[data-regen]"); if (r) { const t = A.turns[+r.dataset.regen]; if (t) submit(t.q, true); }
  });
  function scrollLog() { logEl.scrollTop = logEl.scrollHeight; }
  function addLine(h) { logEl.insertAdjacentHTML("beforeend", h); scrollLog(); return logEl.lastElementChild; }
  const toolLine = (name, args, res) => addLine(`<div class="t-line"><span class="t-dot" aria-hidden="true">⏺</span><span class="t-tool"><b>${esc(name)}</b><span class="args">(${esc(args)})</span></span>${res ? `<span class="t-res">${res}</span>` : ""}</div>`);
  function goTarget(target) {
    if (target === "resume") { openWin("resume"); return; }
    if (target === "chat") { openAgent(true); return; }
    if (target.startsWith("work-") && P(target.slice(5))) { openCase(target.slice(5)); return; }
    // designs name their own sections; fall back through the shared anchors they all provide
    const el = [target, { colophon: "contact", now: "about", play: "about", education: "experience" }[target], target.replace(/^experience-.*/, "experience"), "top"].map((id) => id && document.getElementById(id)).find(Boolean);
    if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    if (innerWidth < 640 && !html.classList.contains("agent-full")) closeAgent();
  }

  // Grounded answers (simulated; production streams from /api/chat with the same grammar)
  const SYS = TH, SYSTEMS = THEMES, SYS_WORDS = {};
  THEMES.forEach((t) => [t.id, ...t.name.toLowerCase().split(/\s+/), ...(t.keywords || [])].forEach((w) => { if (w.length > 2) SYS_WORDS[w] = t.id; }));
  let lastTopic = null;
  function answer(q) {
    const s = q.toLowerCase();
    if (/(style|theme|design|look|show me|as an?|make it|switch|turn)/.test(s)) {
      const hit = Object.keys(SYS_WORDS).find((w) => s.includes(w));
      if (hit) return { theme: SYS_WORDS[hit], text: `Switched to **${SYS[SYS_WORDS[hit]].name}**. Same person, a different website. ${THEMES.length} designs live in the switcher, or press **T** to cycle.` };
    }
    let rewrite = null;
    if (/\b(it|its|that|this one)\b/.test(s) && lastTopic && !/boilerframe|eeg|arm|qr|happiness|habitat/.test(s)) rewrite = /stack|built with|tech/.test(s) ? `What stack did ${lastTopic.title} use?` : q.replace(/\bit\b|\bthat\b/i, lastTopic.title);
    const sq = (rewrite || q).toLowerCase();
    const proj = (slug) => ({ label: `projects/${slug}`, target: "work-" + slug });
    if (/boilerframe/.test(sq) && /(stack|tech|built|use)/.test(sq)) { lastTopic = P("boilerframe"); return { rewrite, search: "BoilerFrame stack", hits: "3 records · projects/boilerframe .81 · experience/hack-the-future .44", text: "BoilerFrame is a **MERN** app: **React** on the front end, **Express** and **Node.js** on the server, **MongoDB** for storage, and **AWS Rekognition** for the face pipeline that finds a person across video frames.", sources: [proj("boilerframe")], confirm: { q: 'Open project "BoilerFrame"?', run: () => goTarget("work-boilerframe"), key: "open-project" }, suggest: ["Has he used React anywhere else?"] }; }
    if (/boilerframe/.test(sq)) { lastTopic = P("boilerframe"); return { search: "BoilerFrame", hits: "2 records · projects/boilerframe .88", text: "**BoilerFrame** finds every appearance of a target person in a video. You give it reference photos and footage; it runs facial recognition on AWS Rekognition and returns the timestamps.", sources: [proj("boilerframe")], confirm: { q: 'Open project "BoilerFrame"?', run: () => goTarget("work-boilerframe"), key: "open-project" }, suggest: ["What stack did it use?"] }; }
    if (/react/.test(sq) && /(else|other|anywhere)/.test(sq)) return { search: "React usage", hits: "2 records · projects/boilerframe .62 · experience/hack-the-future .59", text: "Yes. Besides BoilerFrame he used **React** at **Hack The Future @ Purdue** for the lesson UI of a RAG platform serving 500+ learners.", sources: [proj("boilerframe"), { label: "experience/hack-the-future", target: "experience-hack-the-future" }] };
    if (/(eeg|brain|bci|mind|thought|robotic|arm)/.test(sq)) { lastTopic = P("mind-controlled-arm"); return { rewrite, search: "brain-computer interface projects", hits: "2 records · projects/mind-controlled-arm .84 · projects/eeg-thought-prediction .79", text: "Two brain-computer interface projects:\n- **Mind-Controlled Robotic Arm**: a NeuroSky headset and an Arduino drive a robotic arm from thought alone.\n- **Left/Right Thought Prediction**: classifies left, right and neutral thoughts from 16-channel OpenBCI data with TensorFlow.", sources: [proj("mind-controlled-arm"), proj("eeg-thought-prediction")], confirm: { q: 'Open project "Mind-Controlled Robotic Arm"?', run: () => goTarget("work-mind-controlled-arm"), key: "open-project" }, suggest: ["What stack did it use?"] }; }
    if (/(built|projects|portfolio|made|work on|strongest)/.test(sq)) return { search: "all projects", hits: "6 records · projects/*", text: "Six projects on record:\n- **Mind-Controlled Robotic Arm**: EEG headset + Arduino\n- **BoilerFrame**: finds a person across video with AWS Rekognition\n- **Predicting Citizen Happiness**: Lasso regression at Columbia SHAPE\n- **Left/Right Thought Prediction**: EEG classification with TensorFlow\n- **QRIfy**: text-to-QR web app on AWS EC2\n- **Habitat for Humanity E-Commerce**: one-click listings for a non-profit", sources: PROJECTS.slice(0, 3).map((p) => proj(p.slug)), confirm: { q: "Open Work?", run: () => goTarget("work"), key: "navigate" }, suggest: ["What stack did BoilerFrame use?", "Tell me about the EEG work"] };
    if (/(research|tinyml|edge|snowball|lab\b)/.test(sq)) return { search: "research", hits: "1 record · experience/tinyml-research .86", text: "He's an undergraduate researcher in **TinyML** at Purdue's Snowball Lab, under Prof. Qiuyue \"Shirley\" Xue: fitting ML models onto low-power hardware with Edge Impulse, and testing piezoelectric microphones that double as sensor and power source.", sources: [{ label: "experience/tinyml-research", target: "experience-tinyml-research" }] };
    if (/(experience|worked|job|roles?|career)/.test(sq)) return { search: "experience", hits: "4 records · experience/*", text: "- **Undergraduate Researcher, TinyML**: Snowball Lab, Purdue (2026 – now)\n- **Software Developer**: Hack The Future @ Purdue (2025 – 2026)\n- **Investor Relations Chair**: Code Ninjas (2025)\n- **Code Sensei**: Code Ninjas (2023 – 2025)", sources: [{ label: "experience/*", target: "experience" }], confirm: { q: "Open the resume?", run: () => goTarget("resume"), key: "navigate" } };
    if (/(resume|cv)/.test(sq)) return { text: "His resume syncs from the Google Doc he edits, so it's always current.", confirm: { q: "Open the resume?", run: () => goTarget("resume"), key: "navigate" } };
    if (/(intern|open to|available|hiring|hire|looking for)/.test(sq)) return { search: "availability", hits: "2 records · site/hero.status .77 · faq/start .71", text: "Yes, he's open to **software engineering and AI internships**. Dates aren't on record yet, so the quickest way to pin them down is to ask him.", confirm: { q: "Draft an email to Rithvik?", run: () => openComposer("Internship opportunity"), key: "compose" }, suggest: ["What has he built?", "Where is he based?"] };
    if (/(graduat|gpa|class of|year)/.test(sq)) return { search: "education", hits: "1 record · education/purdue .83", text: "**B.S. in Computer Science + Mathematics** at Purdue, with Software Engineering and AI/ML concentrations. The graduation date isn't on the site yet, so I won't guess.", sources: [{ label: "education/purdue", target: "education" }], confirm: { q: "Draft an email to ask?", run: () => openComposer("Graduation timeline"), key: "compose" } };
    if (/(contact|email|reach|talk|message)/.test(sq)) return { text: "The message window goes straight to his inbox. His address is **rithvikpkx@gmail.com**.", confirm: { q: "Draft an email to Rithvik?", run: () => openComposer(""), key: "compose" } };
    if (/(where|time|located|location|based)/.test(sq)) { const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date()); return { tool: ["LocalTime", "San Francisco", `${t} PT`], text: `He's in **San Francisco** right now, where it's **${t}**. Home is Boston; school is West Lafayette, Indiana.` }; }
    if (/(how|what).*(site|this|built|work)/.test(sq)) return { text: "Next.js on Vercel with Supabase. I rewrite follow-ups into standalone questions, read his full profile plus uploaded documents, stream an answer with sources, and ask before I act.", confirm: { q: "Open the colophon?", run: () => goTarget("colophon"), key: "navigate" } };
    return { search: q.slice(0, 40), hits: "0 strong matches", text: "That isn't on record, so I won't guess. Ask about his **projects**, **experience**, **research**, or how this site works, or write to him directly.", suggest: ["What has he built?", "Is he open to internships?"] };
  }
  function md(t) {
    const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const out = []; let list = null;
    t.split("\n").forEach((ln) => { if (ln.startsWith("- ")) { (list ||= []).push(`<li>${inline(ln.slice(2))}</li>`); return; } if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; } if (ln.trim()) out.push(`<p>${inline(ln)}</p>`); });
    if (list) out.push(`<ul>${list.join("")}</ul>`);
    return out.join("");
  }
  function submit(raw, regen) {
    const q = raw.trim(); if (!q) return;
    openAgent(); palette.hidden = true;
    if (A.busy) interrupt();
    if (!regen) { A.history = [q, ...A.history.filter((x) => x !== q)].slice(0, 50); store.set("rv6-hist", JSON.stringify(A.history)); }
    A.hIdx = -1; input.value = "";
    logEl.querySelector(".t-starters")?.remove();
    addLine(`<p class="t-user"><b>${esc(q)}</b></p>`);
    if (q.startsWith("/")) return command(q);
    run(q);
  }
  function run(q) {
    const a = answer(q), turn = { q, a: a.text.replace(/\*\*/g, "") }, ti = A.turns.push(turn) - 1;
    const steps = [];
    if (a.rewrite) steps.push(() => toolLine("Rewrite", "follow-up", `"${esc(a.rewrite)}"`));
    if (a.search) steps.push(() => toolLine("Search", `site, "${a.search}"`, esc(a.hits)));
    if (a.tool) steps.push(() => toolLine(a.tool[0], a.tool[1], esc(a.tool[2])));
    if (a.theme) steps.push(() => { apply(a.theme, { silent: true }); toolLine("SwitchDesign", a.theme, `Applied ${esc(SYS[a.theme].name)} <button type="button" class="t-key" data-key="undo">u Undo</button>`); });
    busy(true);
    let i = 0;
    const next = () => {
      if (!A.busy) return;
      if (i < steps.length) { steps[i++](); A.busy.t = setTimeout(next, 420); return; }
      const line = addLine(`<div class="t-line"><span class="t-dot live" aria-hidden="true">⏺</span><div class="t-body"><p class="stream caret"></p></div></div>`);
      const p = $(".stream", line), words = a.text.replace(/\*\*/g, "").split(/(\s+)/); let w = 0;
      A.busy.line = line; A.busy.turn = ti;
      const step = () => {
        if (!A.busy) return;
        const chunk = words.slice(w, w + 3).join(""); w += 3;
        p.appendChild(document.createTextNode(chunk));   // append, never re-render while streaming
        scrollLog();
        if (w < words.length) { A.busy.t = setTimeout(step, 30); return; }
        finish(line, a, ti);
      };
      A.busy.t = setTimeout(step, 260);
    };
    A.busy.t = setTimeout(next, 300);
  }
  function finish(line, a, ti) {
    $(".t-dot", line).classList.remove("live");
    $(".t-body", line).innerHTML = md(a.text);
    line.insertAdjacentHTML("beforeend", `${a.sources ? `<div class="t-src">${a.sources.map((s, k) => `<button type="button" data-src="${esc(s.target)}">[${k + 1}] ${esc(s.label)}</button>`).join("")}</div>` : ""}
      <div class="t-acts"><button type="button" data-copy-turn="${ti}" aria-label="Copy answer" title="Copy">${icon("copy")}</button><button type="button" data-regen="${ti}" aria-label="Regenerate" title="Regenerate">${icon("rotate-ccw")}</button></div>
      ${a.suggest ? `<div class="t-sugg">${a.suggest.map((s) => `<button type="button" class="t-chip sugg" data-fill="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}`);
    busy(false);
    if (a.confirm) ask(a.confirm);
    scrollLog();
  }
  function ask(c) {
    if (A.always.has(c.key)) { toolLine("Action", c.q.replace("?", ""), "Allowed for this session"); c.run(); return; }
    A.pending = c;
    addLine(`<div class="t-line t-ask"><span class="t-dot" aria-hidden="true">⏺</span><span class="t-tool"><b>${esc(c.q)}</b></span><div class="t-confirm"><button type="button" class="t-key primary" data-key="yes">⏎ Yes</button><button type="button" class="t-key" data-key="no">n No</button><button type="button" class="t-key" data-key="always">a Always this session</button></div></div>`);
  }
  function answerConfirm(k) {
    if (k === "undo") { if (lastTheme) apply(lastTheme, { silent: true }); return; }
    const c = A.pending; if (!c) return; A.pending = null;
    $$(".t-ask .t-key", logEl).forEach((b) => (b.disabled = true));
    if (k === "no") { addLine(`<p class="t-interrupted">Skipped</p>`); return; }
    if (k === "always") A.always.add(c.key);
    c.run();
  }
  function busy(on) {
    if (on) { A.busy = { t: 0 }; busyStatus(); sendBtn.classList.add("busy"); sendBtn.innerHTML = icon("square"); sendBtn.setAttribute("aria-label", "Interrupt"); }
    else { A.busy = null; idleStatus(); sendBtn.classList.remove("busy"); sendBtn.innerHTML = icon("arrow-up"); sendBtn.setAttribute("aria-label", "Send"); }
  }
  function interrupt() {
    if (!A.busy) return;
    clearTimeout(A.busy.t);
    const line = A.busy.line;
    if (line) { $(".t-dot", line).classList.remove("live"); $(".stream", line)?.classList.remove("caret"); }
    addLine(`<p class="t-interrupted">Interrupted</p>`);
    busy(false);
  }
  function command(q) {
    const [cmd, ...rest] = q.split(/\s+/), arg = rest.join(" ");
    const out = (name, args, res) => toolLine(name, args, res);
    switch (cmd) {
      case "/help": addLine(`<div class="t-line"><span class="t-dot">⏺</span><div class="t-body"><p>${COMMANDS.map(([c, d]) => `<code>${c}</code> ${esc(d)}`).join("<br>")}</p><p class="t-tips">⌘K or / to summon · ↑ previous prompt · esc interrupts, then closes · ⌘⏎ full screen</p></div></div>`); break;
      case "/resume": out("Navigate", "/resume", "Opening resume"); goTarget("resume"); break;
      case "/projects": { const p = arg && PROJECTS.find((x) => x.title.toLowerCase().includes(arg.toLowerCase()) || x.slug.includes(arg.toLowerCase())); if (p) { out("Navigate", `/work/${p.slug}`, esc(p.title)); goTarget("work-" + p.slug); } else out("ListProjects", "all", PROJECTS.map((x) => esc(x.title)).join(" · ")); break; }
      case "/experience": out("Navigate", "#experience", "4 roles"); goTarget("experience"); break;
      case "/contact": ask({ q: `Draft an email${arg ? ` about "${arg}"` : ""} to Rithvik?`, run: () => openComposer(arg), key: "compose" }); break;
      case "/theme": {
        if (!arg || arg === "list") { out("ListDesigns", "", SYSTEMS.map((s) => s.id).join(" · ")); break; }
        const id = arg === "random" ? (() => { const pool = THEMES.filter((t) => t.id !== current); return pool[(Math.random() * pool.length) | 0].id; })() : (SYS[arg] ? arg : SYS_WORDS[arg]);
        if (!id) { out("SwitchDesign", arg, `Unknown design. Try /theme list`); break; }
        apply(id, { silent: true }); out("SwitchDesign", id, `Applied ${esc(SYS[id].name)} <button type="button" class="t-key" data-key="undo">u Undo</button>`); break;
      }
      case "/now": { const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date()); out("LocalTime", "San Francisco", `${t} PT · building rithvik.ai v6`); break; }
      case "/clear": logEl.innerHTML = ""; A.turns = []; A.banner = false; banner(); idleStatus(); break;
      case "/export": copy(A.turns.map((t) => `> ${t.q}\n\n${t.a}`).join("\n\n"), "Transcript copied as Markdown"); out("Export", "markdown", `${A.turns.length} turns copied`); break;
      case "/history": out("History", "recent", A.history.slice(0, 6).map(esc).join(" · ") || "No prompts yet"); break;
      case "/fullscreen": toggleFull(); break;
      case "/quit": closeAgent(); break;
      default: out("Command", cmd, `Unknown command. /help lists them`);
    }
  }
  // Palette for slash commands
  let palIdx = 0;
  function renderPalette() {
    const v = input.value; if (!v.startsWith("/") || v.includes(" ")) { palette.hidden = true; return; }
    const list = COMMANDS.filter(([c]) => c.startsWith(v)); if (!list.length) { palette.hidden = true; return; }
    palIdx = Math.min(palIdx, list.length - 1);
    palette.innerHTML = list.map(([c, d], i) => `<button type="button" role="option" aria-selected="${i === palIdx}" data-cmd="${c}">${c}<span>${esc(d)}</span></button>`).join("");
    palette.hidden = false;
  }
  palette.addEventListener("click", (e) => { const b = e.target.closest("[data-cmd]"); if (b) { input.value = b.dataset.cmd + " "; palette.hidden = true; input.focus(); } });
  input.addEventListener("input", () => { palIdx = 0; renderPalette(); });
  input.addEventListener("keydown", (e) => {
    if (!palette.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); palIdx += e.key === "ArrowDown" ? 1 : -1; palIdx = Math.max(0, palIdx); renderPalette(); return; }
    if (!palette.hidden && (e.key === "Tab" || (e.key === "Enter" && !input.value.includes(" ")))) { const b = $$("button", palette)[palIdx]; if (b) { e.preventDefault(); const c = b.dataset.cmd; palette.hidden = true; if (["/help", "/resume", "/experience", "/now", "/clear", "/export", "/history", "/fullscreen", "/quit"].includes(c) && e.key === "Enter") submit(c); else input.value = c + " "; } return; }
    if (e.key === "ArrowUp" && !input.value && A.history.length) { e.preventDefault(); A.hIdx = Math.min(A.history.length - 1, A.hIdx + 1); input.value = A.history[A.hIdx]; return; }
    if (e.key === "ArrowDown" && A.hIdx >= 0) { e.preventDefault(); A.hIdx--; input.value = A.hIdx >= 0 ? A.history[A.hIdx] : ""; return; }
    if (A.pending && !input.value && ["Enter", "n", "a"].includes(e.key)) { e.preventDefault(); answerConfirm({ Enter: "yes", n: "no", a: "always" }[e.key]); return; }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); toggleFull(); return; }
    if (e.key === "l" && e.ctrlKey) { e.preventDefault(); command("/clear"); return; }
    if (e.key === "u" && e.ctrlKey) { e.preventDefault(); input.value = ""; return; }
    if (e.key === "?" && !input.value) { e.preventDefault(); submit("/help"); }
  });
  $("#agent-bar").addEventListener("submit", (e) => { e.preventDefault(); if (A.busy && !input.value.trim()) { interrupt(); return; } submit(input.value); });
  idleStatus();


  /* ───────── Windows: resume + composer. Draggable, non-modal, layered over the page ───────── */
  const WIN = { resume: $("#resume-win"), composer: $("#composer-win"), play: $("#play-win") };
  function front(w) { Object.values(WIN).forEach((x) => x.classList.toggle("front", x === w)); }
  function openWin(name, opts = {}) {
    const w = WIN[name]; if (!w) return;
    w.hidden = false; front(w);
    if (!w.dataset.placed && innerWidth > 640) {
      // offset sizes ignore the opening scale animation, so placement uses the real size
      const ww = w.offsetWidth, wh = w.offsetHeight;
      const mid = name !== "composer", x = mid ? (innerWidth - ww) / 2 : innerWidth - ww - 32, y = mid ? (innerHeight - wh) / 2 : innerHeight - wh - 104;
      w.style.left = Math.max(8, Math.min(innerWidth - ww - 8, x)) + "px"; w.style.top = Math.max(76, Math.min(innerHeight - wh - 8, y)) + "px"; w.dataset.placed = "1";
    }
    if (name === "composer") { if (opts.subj) $("#cmp-subj").value = opts.subj; setTimeout(() => $("#cmp-from").focus(), 40); }
  }
  const closeWin = (w) => { if (w) w.hidden = true; };
  const openComposer = (subj) => openWin("composer", { subj });
  const closeComposer = () => closeWin(WIN.composer);
  document.addEventListener("click", (e) => {
    const o = e.target.closest("button[data-open], a[data-open]"); if (o) { e.preventDefault(); openWin(o.dataset.open); }
    const c = e.target.closest("[data-close-win]"); if (c) closeWin(c.closest(".win"));
  });
  Object.values(WIN).forEach((w) => {
    w.addEventListener("pointerdown", () => front(w));
    const bar = $("[data-drag]", w); let d = null;
    bar.addEventListener("pointerdown", (e) => { if (e.target.closest("button") || innerWidth <= 640) return; d = [e.clientX - w.offsetLeft, e.clientY - w.offsetTop]; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener("pointermove", (e) => { if (!d) return; w.style.left = Math.max(80 - w.offsetWidth, Math.min(innerWidth - 80, e.clientX - d[0])) + "px"; w.style.top = Math.max(8, Math.min(innerHeight - 48, e.clientY - d[1])) + "px"; });
    const up = () => { d = null; }; bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
  });

  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const from = $("#cmp-from").value.trim(), body = $("#cmp-body").value.trim(), badF = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from), badB = !body;
    $("#err-from").hidden = !badF; $("#err-body").hidden = !badB;
    $("#cmp-from").setAttribute("aria-invalid", String(badF)); $("#cmp-body").setAttribute("aria-invalid", String(badB));
    if (badF) { $("#cmp-from").focus(); return; } if (badB) { $("#cmp-body").focus(); return; }
    e.target.reset(); closeComposer(); toast("<span><b>Sent.</b> Simulated in the mockup.</span>");
  });
  function copy(text, msg = "Copied") {
    const ok = () => toast(`<span>${esc(msg)}</span>`, [], 1800);
    try { navigator.clipboard.writeText(text).then(ok, () => fb()); } catch (e) { fb(); }
    function fb() { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) { toast(`<span>Select and copy: <b>${esc(text)}</b></span>`); } ta.remove(); }
  }
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-copy]"); if (c) copy(c.dataset.copy, "Email address copied");
    if (e.target.closest("[data-download]")) toast("<span>On the live site this downloads <b>Rithvik-Praveen-Kumar-Resume.pdf</b></span>");
  });
  $("#pdf-page").innerHTML = `<h1>RITHVIK PRAVEEN KUMAR</h1><p class="pc">rithvikpkx@gmail.com · github.com/rithvikpkx · rithvik.ai</p>
    <h2>Education</h2><div class="pr"><span>Purdue University</span><span>West Lafayette, IN</span></div><div class="pi"><span>B.S. Computer Science + Mathematics · Software Engineering, AI/ML</span><span>Expected {{graduation}}</span></div>
    <h2>Experience</h2>${C.experience.map((x) => `<div class="pr"><span>${esc(x.org)}</span><span>${esc(x.where)}</span></div><div class="pi"><span>${esc(x.role)}</span><span>${esc(x.when)}</span></div><ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`).join("")}
    <h2>Projects</h2>${PROJECTS.slice(0, 4).map((p) => `<div class="pr"><span>${esc(p.title)}</span><span>${esc(p.tags.slice(0, 4).join(", "))}</span></div><ul><li>${esc(p.desc[0])}</li></ul>`).join("")}
    <h2>Skills</h2><p><b>Languages:</b> ${C.stack.Languages.join(", ")} · <b>Frameworks:</b> ${C.stack.Frameworks.join(", ")}</p>`;
  $("#rs-sync").addEventListener("click", () => toast("<span>Pulled the latest PDF from Google Docs</span>"));


  /* ───────── The mark: a clean, minimal ouroboros (one generated path). H.mark() renders it anywhere ───────── */
  const MARK = (function () {
    const P = { R: 32, W: 18, head: -64, mouth: 34, mouthDepth: 0.16, taper: 70, taperPow: 0.85, tipGap: 3, eyeBack: 5, eyeOff: 0.2, eyeR: 0.11, step: 3 };
    const rad = (d) => (d * Math.PI) / 180, h = rad(P.head), n = [Math.cos(h), Math.sin(h)], t = [-Math.sin(h), Math.cos(h)];
    const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k], c = [P.R * n[0], P.R * n[1]], hw = P.W / 2, S = 360 - P.tipGap;
    const width = (s) => { const x = (S - s) / P.taper; return x >= 1 ? P.W : P.W * Math.pow(1 - (1 - x) * (1 - x), P.taperPow); };
    const pt = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
    const outer = [], inner = [];
    for (let s = 0; s <= S; s += P.step) { const w = width(s), a = P.head - s; outer.push(pt(P.R + w / 2, a)); inner.push(pt(P.R - w / 2, a)); }
    const cap = (phi) => add(c, add([n[0] * Math.cos(rad(phi)), n[1] * Math.cos(rad(phi))], t, Math.sin(rad(phi))), hw);
    const capO = [], capI = [];
    for (let phi = 90 - P.mouth; phi > 0; phi -= 6) capO.push(cap(phi));
    for (let phi = 180; phi > 90 + P.mouth; phi -= 6) capI.push(cap(phi));
    const f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);
    const ring = [add(c, t, -P.W * P.mouthDepth), cap(90 - P.mouth), ...capO, ...outer, ...inner.reverse(), ...capI, cap(90 + P.mouth)];
    const e = add(add(c, t, -P.eyeBack), n, P.W * P.eyeOff);
    return { d: "M" + ring.map(f).join(" L") + " Z", eye: [e[0].toFixed(1), e[1].toFixed(1), (P.W * P.eyeR).toFixed(2)] };
  })();
  let markN = 0;
  /** The logo as inline SVG (currentColor). kind: "solid" (default) or "hatch"; cls adds classes. */
  function mark(kind = "solid", cls = "") {
    const id = "mk" + ++markN, [ex, ey, er] = MARK.eye, hatch = kind === "hatch";
    return `<svg class="mark${cls ? " " + cls : ""}" viewBox="-50 -50 100 100" role="img" aria-label="Rithvik Praveen Kumar"><defs><mask id="${id}m"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle class="mk-eye" cx="${ex}" cy="${ey}" r="${er}" fill="#000"/></mask>${hatch ? `<pattern id="${id}h" width="1.6" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width=".6" height="4" fill="currentColor"/></pattern>` : ""}</defs><g class="mk-spin"><path d="${MARK.d}" fill="${hatch ? `url(#${id}h)` : "currentColor"}" mask="url(#${id}m)"/></g></svg>`;
  }
  function setFavicon(col) {
    const [ex, ey, er] = MARK.eye;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><mask id="e"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle cx="${ex}" cy="${ey}" r="${er}"/></mask><path d="${MARK.d}" fill="${col}" mask="url(#e)"/></svg>`;
    let l = document.head.querySelector("link[rel=icon]"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
    l.href = "data:image/svg+xml," + encodeURIComponent(svg);
  }
  H.mark = mark;
  $("#rl-mark").innerHTML = mark();

  /* ───────── Play: a vinyl to scratch, a drawing artboard, and four small games, in one window ───────── */
  // games read colours from the play window, which maps the design's --ui-* tokens onto the names they expect
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true }); probe.canvas.width = probe.canvas.height = 1;
  const token = (n) => getComputedStyle($("#play-win")).getPropertyValue(n).trim();
  const rgb = (col) => { probe.fillStyle = "#000"; probe.fillStyle = col || "#000"; probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const cssColor = (n, a = 1) => { const [r, g, b, al] = rgb(token(n)); return `rgba(${r},${g},${b},${al * a})`; };
  /* ───────── Records: photographic disc + fluid pill player (Web Audio, scratchable) ───────── */
  const rec = (function () {
    const wrap = $("#records"), disc = $("#rec-disc"), spin = $("#rec-spin"), playBtn = $("#rec-play");
    const DEG_PER_SEC = 78 * 6, SEC_PER_DEG = 1 / DEG_PER_SEC;
    const d = { ctx: null, out: null, buf: null, rev: null, src: null, srcGain: null, loading: null, on: false, drag: false, angle: 0, vel: 0, pos: 0, lastA: 0, moves: [], grainT: 0, raf: 0, last: 0, textT: 0 };
    const dur = () => (d.buf ? d.buf.duration : 72);
    const wrapT = (t) => ((t % dur()) + dur()) % dur();
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    function load() {
      if (d.loading) return d.loading;
      d.loading = (async () => {
        const AC = window.AudioContext || window.webkitAudioContext; d.ctx = new AC();
        d.out = d.ctx.createGain(); d.out.gain.value = 0.9; d.out.connect(d.ctx.destination);
        d.buf = await d.ctx.decodeAudioData(await (await fetch("assets/chili-pepper.mp3")).arrayBuffer());
        const n = d.buf.length, rv = d.ctx.createBuffer(1, n, d.buf.sampleRate), o = rv.getChannelData(0), L = d.buf.getChannelData(0), R = d.buf.numberOfChannels > 1 ? d.buf.getChannelData(1) : L;
        for (let i = 0; i < n; i++) o[i] = (L[n - 1 - i] + R[n - 1 - i]) * 0.5;
        d.rev = rv; $("#rp-dur").textContent = fmt(dur());
      })();
      return d.loading;
    }
    function startMain(fromRate) {
      stopMain(false);
      const t = d.ctx.currentTime, s = d.ctx.createBufferSource(), g = d.ctx.createGain();
      s.buffer = d.buf; s.loop = true; s.connect(g); g.connect(d.out);
      s.playbackRate.setValueAtTime(Math.max(0.01, fromRate), t); s.playbackRate.linearRampToValueAtTime(1, t + 0.55);
      s.start(t, wrapT(d.pos)); d.src = s; d.srcGain = g;
    }
    function stopMain(spinDown) {
      const s = d.src; if (!s) return; d.src = null; const t = d.ctx.currentTime;
      if (spinDown) { s.playbackRate.cancelScheduledValues(t); s.playbackRate.setValueAtTime(s.playbackRate.value, t); s.playbackRate.exponentialRampToValueAtTime(0.02, t + 0.9); d.srcGain.gain.setTargetAtTime(0, t + 0.6, 0.12); s.stop(t + 1.1); }
      else { d.srcGain.gain.setTargetAtTime(0, t, 0.008); s.stop(t + 0.05); }
    }
    function grain(rate) {
      if (!d.buf) return;
      const t = d.ctx.currentTime, fwd = rate >= 0, s = d.ctx.createBufferSource(), g = d.ctx.createGain();
      s.buffer = fwd ? d.buf : d.rev; s.playbackRate.value = Math.min(3.5, Math.max(0.12, Math.abs(rate)));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.95, t + 0.005); g.gain.setTargetAtTime(0, t + 0.045, 0.014);
      s.connect(g); g.connect(d.out); s.start(t, fwd ? wrapT(d.pos) : wrapT(dur() - d.pos), 0.12);
    }
    function paint(force) {
      spin.style.transform = `rotate(${(d.angle % 360).toFixed(2)}deg)`;
      const now = performance.now();
      if (force || now - d.textT > 250) {   // text + aria at ~4 Hz, not per frame
        d.textT = now; const pr = d.pos / dur();
        $("#rp-pos").textContent = fmt(d.pos); $("#rp-prog").style.transform = `scaleX(${pr.toFixed(4)})`;
        wrap.style.setProperty("--prog", pr.toFixed(3));
        disc.setAttribute("aria-valuenow", d.pos.toFixed(0)); disc.setAttribute("aria-valuetext", fmt(d.pos));
      }
    }
    function frame(now) {
      d.raf = 0; const dt = d.last ? Math.min(0.05, (now - d.last) / 1000) : 0; d.last = now;
      if (!d.drag) {
        const target = d.on ? DEG_PER_SEC : 0;
        d.vel += (target - d.vel) * Math.min(1, dt * (d.on ? 4.2 : 2.4));
        if (!d.on && Math.abs(d.vel) < 2) d.vel = 0;
        d.angle += d.vel * dt; d.pos = wrapT(d.pos + d.vel * dt * SEC_PER_DEG);
      }
      paint(false);
      if (d.on || d.vel !== 0 || d.drag) d.raf = requestAnimationFrame(frame); else { d.last = 0; paint(true); }
    }
    const kick = () => { if (!d.raf) { d.last = 0; d.raf = requestAnimationFrame(frame); } };
    async function toggle() {
      try { await load(); if (d.ctx.state === "suspended") await d.ctx.resume(); } catch (e) { d.loading = null; if (!d.buf) toast("<span>Audio couldn't load here; the deck still spins</span>"); }
      d.on = !d.on; playBtn.setAttribute("aria-pressed", String(d.on)); playBtn.setAttribute("aria-label", d.on ? "Pause" : "Play");
      wrap.classList.toggle("is-on", d.on);
      if (d.buf) { if (d.on) startMain(d.vel / DEG_PER_SEC); else stopMain(true); }
      kick();
    }
    playBtn.addEventListener("click", toggle);
    const angleAt = (e) => { const r = disc.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
    disc.addEventListener("pointerdown", (e) => {
      if (d.drag) return;
      e.preventDefault(); disc.setPointerCapture(e.pointerId);
      d.drag = true; d.vel = 0; d.lastA = angleAt(e); d.moves = [[performance.now(), 0]];
      wrap.classList.add("is-scratching");
      load().then(() => { if (d.ctx.state === "suspended") d.ctx.resume(); if (d.drag) stopMain(false); }).catch(() => { d.loading = null; });
      if (d.src) stopMain(false);
      kick();
    });
    disc.addEventListener("pointermove", (e) => {
      if (!d.drag) return;
      const a = angleAt(e), now = performance.now(); let da = a - d.lastA; if (da > 180) da -= 360; if (da < -180) da += 360;
      d.angle += da; d.pos = wrapT(d.pos + da * SEC_PER_DEG); d.lastA = a;
      d.moves.push([now, da]); if (d.moves.length > 5) d.moves.shift();
      const span = Math.max(8, now - d.moves[0][0]) / 1000, sum = d.moves.slice(1).reduce((s, m) => s + m[1], 0);
      d.vel = sum / span;   // release velocity from the last few moves
      if (now - d.grainT > 26 && Math.abs(da) > 0.25) { d.grainT = now; grain(d.vel / DEG_PER_SEC); }
    });
    const release = () => { if (!d.drag) return; d.drag = false; wrap.classList.remove("is-scratching"); if (d.on && d.buf) startMain(Math.min(1, Math.abs(d.vel) / DEG_PER_SEC)); kick(); };
    disc.addEventListener("pointerup", release); disc.addEventListener("pointercancel", release);
    disc.addEventListener("keydown", async (e) => { const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!dir) return; e.preventDefault(); try { await load(); if (d.ctx.state === "suspended") d.ctx.resume(); } catch (err) { d.loading = null; } d.angle += dir * 36; d.pos = wrapT(d.pos + dir * 36 * SEC_PER_DEG); grain(dir * 1.3); paint(true); });
    $("#rp-bar").addEventListener("click", (e) => { const r = e.currentTarget.getBoundingClientRect(); d.pos = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur(); if (d.on && d.buf) startMain(1); paint(true); });
    return { toggle, isOn: () => d.on };
  })();

  /* ───────── Games (embedded from rithvik.si in production) ───────── */
  const GAMES = [
    { id: "typeracer", name: "Type Racer", desc: "Type a real line from my projects", unit: "WPM", base: 96, hi: true, play: true, ic: "keyboard" },
    { id: "angle", name: "Angle Approximator", desc: "Guess the angle in degrees", unit: "° off", base: 4.2, hi: false, play: true, ic: "drafting-compass" },
    { id: "dots", name: "Count the Dots", desc: "Dots flash for under a second", unit: "% off", base: 8, hi: false, play: true, ic: "grip" },
    { id: "center", name: "Center the Div", desc: "Drag the box to the exact centre", unit: "px off", base: 3, hi: false, play: true, ic: "crosshair" },
    { id: "bigo", name: "Big-O or Bust", desc: "Name the time complexity", unit: "/10", base: 9, hi: true, ic: "braces" },
    { id: "hexeye", name: "Hex Eye", desc: "Recreate a colour with sliders", unit: "ΔE", base: 6.1, hi: false, ic: "palette" },
    { id: "reaction", name: "Reaction Lab", desc: "Click on the flash", unit: "ms", base: 212, hi: false, ic: "timer" },
    { id: "prime", name: "Prime Time", desc: "Prime or not, for 30 seconds", unit: "correct", base: 31, hi: true, ic: "hash" },
  ];
  const GM = Object.fromEntries(GAMES.map((g) => [g.id, g]));
  const gfBody = $("#gf-body");
  function result(g, you, extra = "") {
    const better = g.hi ? you >= g.base : you <= g.base, max = Math.max(you, g.base) * 1.15 || 1;
    return `<div class="result"><p class="rc-verdict">${better ? "You beat Rithvik" : "Rithvik wins this round"}</p>
      <div class="rc-row me"><span>You</span><span class="rc-bar"><i style="--w:${(you / max).toFixed(3)}"></i></span><b>${you} ${esc(g.unit)}</b></div>
      <div class="rc-row"><span>Rithvik</span><span class="rc-bar"><i style="--w:${(g.base / max).toFixed(3)}"></i></span><b>${g.base} ${esc(g.unit)}</b></div>
      <p class="note">${extra}</p><div class="g-row"><button type="button" class="btn sm" data-again="${g.id}">Play again</button></div></div>`;
  }
  const bars = (root) => requestAnimationFrame(() => $$(".rc-bar i", root).forEach((i) => { i.style.transform = `scaleX(${i.style.getPropertyValue("--w")})`; }));
  gfBody.addEventListener("click", (e) => { const a = e.target.closest("[data-again]"); if (a) openGame(a.dataset.again); });
  const shell = (g, help, stage) => { gfBody.innerHTML = `<div class="g-wrap"><div class="g-stage"><h3 class="g-title">${esc(g.name)}</h3><p class="g-help">${help}</p>${stage}</div><div class="g-side" id="g-side"><p class="label">Rithvik's baseline</p><p class="g-stat">${g.base} <small>${esc(g.unit)}</small></p></div></div>`; };
  const done = (g, v, extra) => { $("#g-side").innerHTML = result(g, v, extra); bars($("#g-side")); };
  function gameType(g) {
    const LINES = ["const faces = await rekognition.searchFacesByImage(params).promise();", "model.fit(X_train, y_train, epochs=30, validation_split=0.2)", "for (const row of rows) await upsertEmbedding(row.slug, row.text);"];
    const text = LINES[(Math.random() * LINES.length) | 0];
    shell(g, "Type the line exactly. The timer starts on your first key.", `<div class="tr-text" id="tr-text"></div><input class="field" id="tr-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type the line shown above"><p class="label" id="tr-live">0 WPM · 100%</p>`);
    const tt = $("#tr-text"), inp = $("#tr-in"); let t0 = 0, errs = 0, fin = false;
    const render = (v) => { tt.innerHTML = [...text].map((c, i) => `<span class="${i < v.length ? (v[i] === c ? "ok" : "bad") : i === v.length ? "cur" : ""}">${esc(c)}</span>`).join(""); };
    render(""); inp.focus({ preventScroll: true });
    inp.addEventListener("input", () => {
      if (fin) return; const v = inp.value; if (!t0) t0 = performance.now(); if (v.length && v[v.length - 1] !== text[v.length - 1]) errs++;
      render(v); const wpm = Math.round((v.length / 5) / Math.max((performance.now() - t0) / 60000, 1 / 600)), acc = Math.max(0, Math.round(100 * (1 - errs / Math.max(1, v.length))));
      $("#tr-live").textContent = `${wpm} WPM · ${acc}%`; if (v === text) { fin = true; done(g, wpm, `Accuracy ${acc}%`); }
    });
  }
  function gameAngle(g) {
    shell(g, "Estimate the angle between the rays. Five rounds.", `<div class="g-canvas-box"><canvas id="ang-cv" width="420" height="315"></canvas></div><div class="g-row"><input type="range" id="ang-r" min="0" max="180" value="90" aria-label="Your guess in degrees" style="flex:1"><b class="g-stat" id="ang-v" style="font-size:1.4rem">90°</b><button class="btn sm" type="button" id="ang-go">Lock in</button></div><p class="label" id="ang-round">Round 1 of 5</p>`);
    const cv = $("#ang-cv"), c = cv.getContext("2d"); let round = 0, sum = 0, target = 0, base = 0;
    const draw = (reveal) => { const W = cv.width, H = cv.height, ox = W / 2, oy = H * 0.72, L = H * 0.55; c.clearRect(0, 0, W, H); c.lineCap = "round"; c.strokeStyle = cssColor("--fg"); c.lineWidth = 4; [base, base + target * Math.PI / 180].forEach((a) => { c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(a) * L, oy - Math.sin(a) * L); c.stroke(); }); c.fillStyle = cssColor("--accent"); c.beginPath(); c.arc(ox, oy, 6, 0, 7); c.fill(); if (reveal) { c.font = `600 22px ${token("--font-l")}`; c.fillText(`${target}°`, ox + 14, oy + 30); } };
    const next = () => { target = 15 + ((Math.random() * 150) | 0); base = Math.random() * 0.6 - 0.1; draw(false); $("#ang-round").textContent = `Round ${round + 1} of 5`; };
    $("#ang-r").addEventListener("input", (e) => { $("#ang-v").textContent = e.target.value + "°"; });
    $("#ang-go").addEventListener("click", () => { sum += Math.abs(+$("#ang-r").value - target); round++; draw(true); if (round >= 5) { done(g, +(sum / 5).toFixed(1)); $("#ang-go").disabled = true; return; } setTimeout(next, 900); });
    next();
  }
  function gameDots(g) {
    shell(g, "Dots flash for 0.8 seconds. How many? Three rounds.", `<div class="g-canvas-box"><canvas id="dot-cv" width="420" height="315"></canvas></div><div class="g-row"><button class="btn sm" type="button" id="dot-show">Flash dots</button><input class="field" id="dot-in" type="number" inputmode="numeric" min="0" placeholder="How many?" aria-label="Your count" style="width:130px"><button class="btn ghost sm" type="button" id="dot-go" disabled>Submit</button></div><p class="label" id="dot-round">Round 1 of 3</p>`);
    const cv = $("#dot-cv"), c = cv.getContext("2d"); let n = 0, round = 0, sum = 0, tm = 0;
    $("#dot-show").addEventListener("click", () => { n = 18 + ((Math.random() * 70) | 0); c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = cssColor("--accent"); for (let i = 0; i < n; i++) { c.beginPath(); c.arc(20 + Math.random() * (cv.width - 40), 20 + Math.random() * (cv.height - 40), 5, 0, 7); c.fill(); } $("#dot-show").disabled = true; clearTimeout(tm); tm = setTimeout(() => { c.clearRect(0, 0, cv.width, cv.height); $("#dot-go").disabled = false; $("#dot-in").focus({ preventScroll: true }); }, 800); });
    const submit = () => { if ($("#dot-go").disabled) return; sum += Math.abs(+$("#dot-in").value - n) / n * 100; round++; c.fillStyle = cssColor("--fg"); c.font = `600 20px ${token("--font-l")}`; c.fillText(`There were ${n}`, 20, 40); $("#dot-go").disabled = true; $("#dot-in").value = ""; if (round >= 3) { done(g, +(sum / 3).toFixed(1)); return; } $("#dot-show").disabled = false; $("#dot-round").textContent = `Round ${round + 1} of 3`; };
    $("#dot-go").addEventListener("click", submit); $("#dot-in").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }
  function gameCenter(g) {
    shell(g, "Drag the box until it's dead centre, then submit. Three rounds; arrow keys nudge.", `<div class="cd-box" id="cd-box"><i class="cd-target" id="cd-t"></i><div class="cd-div" id="cd-div" role="slider" aria-label="Draggable box" tabindex="0">div</div></div><div class="g-row"><button class="btn sm" type="button" id="cd-go">Submit</button><span class="label" id="cd-round">Round 1 of 3</span></div>`);
    const box = $("#cd-box"), dv = $("#cd-div"), tg = $("#cd-t"); let round = 0, sum = 0, pos = [0, 0], drag = null;
    const place = () => { dv.style.left = pos[0] + "px"; dv.style.top = pos[1] + "px"; };
    const reset = () => { box.style.aspectRatio = ["16 / 10", "4 / 3", "21 / 9"][round % 3]; requestAnimationFrame(() => { const r = box.getBoundingClientRect(); pos = [r.width * (0.15 + Math.random() * 0.2), r.height * (0.2 + Math.random() * 0.6)]; place(); tg.classList.remove("show"); }); };
    dv.addEventListener("pointerdown", (e) => { drag = [e.clientX - pos[0], e.clientY - pos[1]]; dv.setPointerCapture(e.pointerId); });
    dv.addEventListener("pointermove", (e) => { if (!drag) return; const r = box.getBoundingClientRect(); pos = [Math.max(0, Math.min(r.width, e.clientX - drag[0])), Math.max(0, Math.min(r.height, e.clientY - drag[1]))]; place(); });
    dv.addEventListener("pointerup", () => { drag = null; });
    dv.addEventListener("keydown", (e) => { const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (m) { e.preventDefault(); pos = [pos[0] + m[0], pos[1] + m[1]]; place(); } });
    $("#cd-go").addEventListener("click", () => { const r = box.getBoundingClientRect(), err = Math.hypot(pos[0] - r.width / 2, pos[1] - r.height / 2); tg.style.left = r.width / 2 + "px"; tg.style.top = r.height / 2 + "px"; tg.classList.add("show"); sum += err; round++; if (round >= 3) { done(g, +(sum / 3).toFixed(1)); $("#cd-go").disabled = true; return; } $("#cd-round").textContent = `Round ${round + 1} of 3 · last ${err.toFixed(1)}px off`; setTimeout(reset, 900); });
    reset();
  }


  /** Artboard: free drawing with smoothing, a few pens, mirror symmetry, undo and clear. */
  const artboard = (function () {
    const cv = $("#ab-canvas"), g = cv.getContext("2d"), INK = ["#111111", "#ff3b1f", "#2230ff", "#00b86b", "#ffb000", "#ff5cf0"];
    let size = 6, color = INK[0], erase = false, mirror = false, strokes = [], cur = null;
    $("#ab-inks").innerHTML = INK.map((c, i) => `<button type="button" class="ab-ink" style="--ink:${c}" data-ink="${c}" aria-label="Ink ${i + 1}" aria-pressed="${i === 0}"></button>`).join("");
    function fit() { const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); if (!r.width) return; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); redraw(); }
    function path(s, flip) {
      const w = cv.getBoundingClientRect().width, pts = flip ? s.pts.map(([x, y]) => [w - x, y]) : s.pts;
      g.globalCompositeOperation = s.erase ? "destination-out" : "source-over"; g.strokeStyle = s.color; g.lineWidth = s.size; g.lineCap = g.lineJoin = "round";
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
      const l = pts[pts.length - 1]; g.lineTo(l[0], l[1]); g.stroke();
    }
    function draw(s) { path(s, false); if (s.mirror) path(s, true); }
    function redraw() { const r = cv.getBoundingClientRect(); g.clearRect(0, 0, r.width, r.height); strokes.forEach(draw); }
    const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); cur = { pts: [at(e), at(e)], size, color, erase, mirror }; strokes.push(cur); draw(cur); });
    cv.addEventListener("pointermove", (e) => { if (!cur) return; cur.pts.push(at(e)); redraw(); });
    const end = () => { cur = null; }; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    $("#ab-tools").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.ink) { color = b.dataset.ink; erase = false; $$("[data-ink]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); $("#ab-erase").setAttribute("aria-pressed", "false"); }
      if (b.dataset.size) { size = +b.dataset.size; $$("[data-size]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
      if (b.id === "ab-erase") { erase = !erase; b.setAttribute("aria-pressed", String(erase)); }
      if (b.id === "ab-mirror") { mirror = !mirror; b.setAttribute("aria-pressed", String(mirror)); $("#ab-axis").hidden = !mirror; }
      if (b.id === "ab-undo") { strokes.pop(); redraw(); }
      if (b.id === "ab-clear") { strokes = []; redraw(); }
    });
    const prompts = ["Draw a brain wave", "Draw the robotic arm", "Draw your dream internship", "Draw a QR code from memory", "Draw a snake eating its tail"];
    $("#ab-cue").addEventListener("click", (e) => { e.currentTarget.textContent = prompts[(prompts.indexOf(e.currentTarget.textContent) + 1) % prompts.length]; });
    new ResizeObserver(fit).observe(cv);
    return { fit };
  })();

  const PLAY = [
    { id: "records", name: "Records", desc: "Scratch a 1927 78", icon: "music" },
    { id: "artboard", name: "Artboard", desc: "Draw something, mirrored if you like", icon: "palette" },
    ...GAMES.filter((g) => g.play).map((g) => ({ id: g.id, name: g.name, desc: g.desc, icon: g.ic })),
  ];
  H.PLAY = PLAY;
  $("#play-tabs").innerHTML = PLAY.map((p) => `<button type="button" role="tab" data-play="${p.id}" aria-selected="false">${icon(p.icon)}<span>${esc(p.name)}</span></button>`).join("");
  function openPlay(id) {
    const p = PLAY.find((x) => x.id === id) || PLAY[0];
    openWin("play");
    $$(".play-pane").forEach((el) => (el.hidden = el.dataset.pane !== (p.id === "records" || p.id === "artboard" ? p.id : "game")));
    $$("#play-tabs [data-play]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.play === p.id)));
    if (p.id !== "records" && rec.isOn()) rec.toggle();
    if (p.id === "artboard") requestAnimationFrame(artboard.fit);
    else if (p.id !== "records") openGame(p.id);
  }
  function openGame(id) { ({ typeracer: gameType, angle: gameAngle, dots: gameDots, center: gameCenter })[id](GM[id]); }
  H.openPlay = openPlay;
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-play]"); if (b) { e.preventDefault(); openPlay(b.dataset.play); } });
  $("#play-win").addEventListener("click", (e) => { if (e.target.closest("[data-close-win]") && rec.isOn()) rec.toggle(); });

  /* ───────── Global keys ───────── */
  addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); A.open && document.activeElement === input ? closeAgent() : openAgent(); return; }
    if (e.key === "Escape") {
      if (A.busy) { interrupt(); return; }
      if (!palette.hidden) { palette.hidden = true; return; }
      if (sw.classList.contains("open")) { openDeck(false); return; }
      if (!sheet.hidden) { closeCase(); return; }
      if (!WIN.composer.hidden) { closeComposer(); return; }
      if (!WIN.resume.hidden) { closeWin(WIN.resume); return; }
      if (!WIN.play.hidden) { if (rec.isOn()) rec.toggle(); closeWin(WIN.play); return; }
      if (A.open) { closeAgent(); input.blur(); return; }
    }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); openAgent(); input.value = "/"; renderPalette(); return; }
    if ((e.key === "t" || e.key === "T") && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); apply(cycle(e.shiftKey ? -1 : 1)); }
  });

  /* ───────── Boot ───────── */
  hydrate();
  if (store.get("rv6-lite", "0") === "1") html.classList.add("lite");
  const first = new URLSearchParams(location.search).get("theme") || store.get("rv6-theme", THEMES[0] && THEMES[0].id);
  apply(TH[first] ? first : THEMES[0].id, { silent: true, instant: true, force: true });
  window.V6.apply = apply; window.V6.H = H;
});
