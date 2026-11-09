/* rithvik.ai v5 mockup: behaviour.
   One long page; the nav scroll-spies. Design engine (12 systems + 16 palettes, datamosh switch), the generated
   ouroboros mark, portrait orbit + contact beams, pinned globe, endless play field with FLIP expansion, case sheet,
   draggable windows, records player (Web Audio scratch), games, a Claude Code-style agent. One rAF policy: pause off-screen/hidden. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches || html.classList.contains("lite");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");

  /* ───────── Assets: Lucide icons, Simple Icons logos, Natural Earth dots, FIGlet, spinners ───────── */
  const AS = window.ASSETS || { icons: {}, logos: {}, land: [], spinners: {}, banner: null, commits: [] };
  const ICONS = AS.icons;
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const logo = (slug) => {
    const L = AS.logos[slug]; if (!L) return "";
    return L.svg16 ? `<svg class="logo" viewBox="0 0 16 16" fill="currentColor" style="--brand:#${L.hex}" aria-hidden="true">${L.svg16}</svg>`
      : `<svg class="logo" viewBox="0 0 24 24" fill="currentColor" style="--brand:#${L.hex}" aria-hidden="true"><path d="${L.d}"/></svg>`;
  };
  const hydrate = (root = document) => {
    $$("[data-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });
    $$("[data-logo-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = logo(el.dataset.logoIcon); });
  };

  /* ───────── The mark: a geometric ouroboros. One generated path; every render reuses it ───────── */
  const MARK_V = { fine: { W: 11, R: 34, taper: 92, mouth: 32, eyeR: 0.16, eyeOff: 0.08 }, ring: {}, bold: { W: 24, R: 30, mouth: 36, taper: 58, eyeR: 0.09 } };
  let markVariant = MARK_V[store.get("rv5-mark", "ring")] ? store.get("rv5-mark", "ring") : "ring";
  /** Outline of the mark: an even ring, a rounded snout with a wedge mouth, and a tail that tapers into it. */
  function ouroPath(o = {}) {
    const P = Object.assign({ R: 32, W: 18, head: -64, mouth: 34, mouthDepth: 0.16, taper: 70, taperPow: 0.85, tipGap: 3, eyeBack: 5, eyeOff: 0.2, eyeR: 0.11, step: 2 }, o);
    const rad = (d) => (d * Math.PI) / 180, h = rad(P.head), n = [Math.cos(h), Math.sin(h)], t = [-Math.sin(h), Math.cos(h)];
    const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k], c = [P.R * n[0], P.R * n[1]], hw = P.W / 2, S = 360 - P.tipGap;
    // eased taper so the inner edge has no kink where the tail starts thinning
    const width = (s) => { const x = (S - s) / P.taper; return x >= 1 ? P.W : P.W * Math.pow(1 - (1 - x) * (1 - x), P.taperPow); };
    const pt = (r, deg) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
    const outer = [], inner = [];
    for (let s = 0; s <= S; s += P.step) { const w = width(s), a = P.head - s; outer.push(pt(P.R + w / 2, a)); inner.push(pt(P.R - w / 2, a)); }
    const cap = (phi) => add(c, add([n[0] * Math.cos(rad(phi)), n[1] * Math.cos(rad(phi))], t, Math.sin(rad(phi))), hw);
    const capO = [], capI = [];
    for (let phi = 90 - P.mouth; phi > 0; phi -= 6) capO.push(cap(phi));
    for (let phi = 180; phi > 90 + P.mouth; phi -= 6) capI.push(cap(phi));
    const f = (p) => p[0].toFixed(2) + " " + p[1].toFixed(2);
    const ring = [add(c, t, -P.W * P.mouthDepth), cap(90 - P.mouth), ...capO, ...outer, ...inner.reverse(), ...capI, cap(90 + P.mouth)];
    const e = add(add(c, t, -P.eyeBack), n, P.W * P.eyeOff);
    return { d: "M" + ring.map(f).join(" L") + " Z", eye: [+e[0].toFixed(2), +e[1].toFixed(2), +(P.W * P.eyeR).toFixed(2)], R: P.R, W: P.W, head: P.head };
  }
  let MG = ouroPath(MARK_V[markVariant]), markN = 0;
  const BLINKS = ["nav", "giant", "agent", "ask", "spec"];
  /** One mark as SVG. The body is masked by a reveal stroke (draw-on) and an eye hole; "giant" is hatched with a pupil. */
  function markSVG(kind = "") {
    const id = "mk" + ++markN, g = MG, R = g.R, a0 = ((g.head + 18) * Math.PI) / 180;
    const sx = (R * Math.cos(a0)).toFixed(2), sy = (R * Math.sin(a0)).toFixed(2), ex = (-R * Math.cos(a0)).toFixed(2), ey = (-R * Math.sin(a0)).toFixed(2);
    const rev = `M${sx} ${sy} A${R} ${R} 0 1 0 ${ex} ${ey} A${R} ${R} 0 1 0 ${sx} ${sy}`; // counter-clockwise: snout first, tail last
    const hatch = kind === "giant" || kind === "plate" || kind === "card";
    const [cx, cy, er] = g.eye;
    return `<svg class="mark mk-${kind || "plain"}" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><defs>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120"><path class="mk-reveal" d="${rev}" pathLength="1" stroke-width="${g.W + 14}"/><circle class="mk-eye" cx="${cx}" cy="${cy}" r="${er}" fill="#000"/></mask>
      ${hatch ? `<pattern id="${id}h" width="${kind === "giant" ? 0.62 : 1.4}" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="${kind === "giant" ? 0.24 : 0.5}" height="4" fill="currentColor"/></pattern>` : ""}
      </defs><g class="mk-spin"><path class="mk-body" d="${g.d}" fill="${hatch ? `url(#${id}h)` : "currentColor"}" mask="url(#${id}m)"/>${kind === "giant" ? `<circle class="mk-pupil" cx="${cx}" cy="${cy}" r="${(er * 0.5).toFixed(2)}" fill="currentColor"/>` : ""}</g></svg>`;
  }
  /** Fill every .mark-slot (or those under root) with a fresh mark. */
  function renderMarks(root = document) {
    $$(".mark-slot", root).forEach((s) => { s.innerHTML = markSVG(s.dataset.mark); if (BLINKS.includes(s.dataset.mark)) s.firstElementChild.classList.add("blinks"); });
  }
  /** Draw a mark on (stroke reveal), e.g. the nav mark on entrance. */
  const drawOn = (slot) => { const m = slot?.firstElementChild; if (!m || reduceMotion()) return; m.classList.remove("draw"); void m.getBoundingClientRect(); m.classList.add("draw"); };
  renderMarks();
  let brandTurns = 0;
  $(".brand").addEventListener("pointerenter", () => { if (reduceMotion()) return; brandTurns += 360; const s = $(".brand .mk-spin"); if (s) s.style.transform = `rotate(${brandTurns}deg)`; });
  $$("[data-mark-v]").forEach((b) => b.addEventListener("click", () => {
    markVariant = b.dataset.markV; store.set("rv5-mark", markVariant); MG = ouroPath(MARK_V[markVariant]);
    $$("[data-mark-v]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderMarks(); brandTurns = 0; setFavicon(); kick(); drawOn($(".brand .mark-slot"));
  }));
  $$("[data-mark-v]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.markV === markVariant)));
  /** Favicon = the mark in the current text colour. */
  function setFavicon() {
    const col = getComputedStyle(html).getPropertyValue("--fg").trim() || "#1f2328", [cx, cy, er] = MG.eye;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><mask id="e"><rect x="-50" y="-50" width="100" height="100" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${er}"/></mask><path d="${MG.d}" fill="${col}" mask="url(#e)"/></svg>`;
    let l = document.head.querySelector("link[rel=icon]"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
    l.href = "data:image/svg+xml," + encodeURIComponent(svg);
  }


  /* ───────── Design systems + palettes ───────── */
  const GF = "https://fonts.googleapis.com/css2?";
  const SYSTEMS = [
    { id: "pane", name: "Pane", tag: "tui", fonts: "family=IBM+Plex+Mono:wght@400;600", sw: { bg: "#11111b", fg: "#cdd6f4", font: '"IBM Plex Mono",monospace', w: 600, fs: 13, r: "0", border: "1px solid #89b4fa" } },
    { id: "lab", name: "Lab", tag: "vision", fonts: "family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=JetBrains+Mono:wght@400;600", sw: { bg: "#0e1116", fg: "#9cff6b", font: '"Bricolage Grotesque",sans-serif', w: 600, border: "1px solid #9cff6b", r: "2px" } },
    { id: "ledger", name: "Ledger", tag: "paper", fonts: "family=Doto:ROND,wght@0..100,100..900&family=IBM+Plex+Mono:wght@400;600&family=Libre+Barcode+39+Text", sw: { bg: "#f4f1ea", fg: "#2b2a28", font: '"Doto",monospace', w: 800, fs: 15, r: "3px", shadow: "2px 2px 4px rgba(0,0,0,.2), -2px -2px 4px #fff" } },
    { id: "riso", name: "Riso", tag: "print", fonts: "family=Syne:wght@400..800&family=Instrument+Serif:ital@0;1&family=Space+Mono:wght@400;700", sw: { bg: "#f3efe6", fg: "#0078bf", font: '"Syne",sans-serif', w: 800, shadow: "2px 1px 0 #ff48b0" } },
    { id: "spectrum", name: "Spectrum", tag: "infrared", fonts: "family=Unica+One&family=Geist+Mono:wght@400;600", sw: { bg: "#1b0b2e", fg: "#ff4fa3", font: '"Unica One",sans-serif', w: 400, fs: 16 } },
    { id: "glass", name: "Liquid Glass", tag: "sleek", fonts: null, sw: { bg: "linear-gradient(135deg,#3b2a8f,#c2418f 60%,#ff9a52)", fg: "#fff", font: '-apple-system,"SF Pro Display","Geist",sans-serif', w: 600 } },
    { id: "comic", name: "Comic Pop", tag: "loud", fonts: "family=Bangers&family=Geist:wght@400;600;700", sw: { bg: "#ffd93d", fg: "#111", font: '"Bangers",Impact,sans-serif', w: 400, ls: ".06em", fs: 15, border: "2px solid #111", shadow: "3px 3px 0 #ff6b6b" } },
    { id: "brutal", name: "Neo-Brutalist", tag: "loud", fonts: "family=Archivo+Black&family=Archivo:wdth,wght@62..125,100..900", sw: { bg: "#c6ff00", fg: "#0a0a0a", font: '"Archivo Black",sans-serif', w: 400, tt: "uppercase", fs: 11, border: "2px solid #000", shadow: "3px 3px 0 #000", r: "0" } },
    { id: "neon", name: "Neon Arcade", tag: "retro", fonts: "family=Audiowide&family=Chakra+Petch:wght@400;600;700", sw: { bg: "linear-gradient(180deg,#2b0b3f,#0a0418)", fg: "#9ff3ff", font: '"Audiowide",sans-serif', w: 400, fs: 12, border: "1px solid #ff3cac" } },
    { id: "crt", name: "CRT", tag: "retro", fonts: "family=VT323&family=JetBrains+Mono:wght@400..700", sw: { bg: "#050505", fg: "#33ff00", font: '"VT323",monospace', w: 400, fs: 18, r: "0", border: "1px solid #33ff00" } },
    { id: "win98", name: "Desktop 98", tag: "retro", fonts: "family=VT323", sw: { bg: "#c0c0c0", fg: "#000", font: "Tahoma,Verdana,sans-serif", w: 700, fs: 12, r: "0", shadow: "inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080, inset 2px 2px #dfdfdf" } },
    { id: "paper", name: "Paper Sketch", tag: "story", fonts: "family=Caveat:wght@400..700&family=Kalam:wght@400;700", sw: { bg: "#fbf8ef", fg: "#1f2a44", font: '"Caveat",cursive', w: 700, fs: 19, border: "1.5px solid #1f2a44", r: "255px 15px 225px 15px/15px 225px 15px 255px" } },
  ];
  const SYS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
  const PALETTES = [
    { slug: "github-light", name: "GitHub Light", t: ["#ffffff", "#f6f8fa", "#1f2328", "#59636e", "#0969da", "#1a7f37"], pair: "github-dark" },
    { slug: "rithvik-light", name: "Rithvik Light", t: ["#fafaf7", "#f3f1ed", "#0e0b0a", "#6a655f", "#c2305e", "#16a34a"], pair: "rithvik-dark" },
    { slug: "high-contrast-light", name: "High Contrast Light", t: ["#ffffff", "#f0f0f0", "#000000", "#545454", "#0f4a85", "#0a7d00"], pair: "high-contrast-dark" },
    { slug: "rithvik-dark", name: "Rithvik Dark", t: ["#08080e", "#0f0f17", "#eeeef6", "#9a9ab2", "#e04a78", "#4ade80"], pair: "rithvik-light", dark: 1 },
    { slug: "rithvik-terminal", name: "Rithvik Terminal", t: ["#001a00", "#002a00", "#00ff41", "#33c25a", "#39ff14", "#39ff14"], dark: 1, mono: 1 },
    { slug: "one-dark-pro", name: "One Dark Pro", t: ["#282c34", "#21252b", "#abb2bf", "#8b93a1", "#61afef", "#98c379"], dark: 1 },
    { slug: "dracula", name: "Dracula", t: ["#282a36", "#21222c", "#f8f8f2", "#a3acd1", "#bd93f9", "#50fa7b"], dark: 1 },
    { slug: "github-dark", name: "GitHub Dark", t: ["#0d1117", "#161b22", "#c9d1d9", "#8b949e", "#58a6ff", "#3fb950"], pair: "github-light", dark: 1 },
    { slug: "tokyo-night", name: "Tokyo Night", t: ["#1a1b26", "#16161e", "#c0caf5", "#8a93c4", "#7aa2f7", "#9ece6a"], dark: 1 },
    { slug: "night-owl", name: "Night Owl", t: ["#011627", "#01111d", "#d6deeb", "#8aa2b8", "#82aaff", "#addb67"], dark: 1 },
    { slug: "catppuccin-mocha", name: "Catppuccin Mocha", t: ["#1e1e2e", "#181825", "#cdd6f4", "#9399b2", "#cba6f7", "#a6e3a1"], dark: 1 },
    { slug: "synthwave-84", name: "SynthWave '84", t: ["#262335", "#241b2f", "#ffffff", "#a3a8d6", "#ff7edb", "#72f1b8"], dark: 1 },
    { slug: "ayu-mirage", name: "Ayu Mirage", t: ["#1f2430", "#191e2a", "#cbccc6", "#98a1b3", "#ffcc66", "#87d96c"], dark: 1 },
    { slug: "monokai-pro", name: "Monokai Pro", t: ["#282a3a", "#222431", "#eaf2f1", "#9ca0aa", "#ff657a", "#bad761"], dark: 1 },
    { slug: "high-contrast-dark", name: "High Contrast Dark", t: ["#000000", "#0d0d0d", "#ffffff", "#a6a6a6", "#1aebff", "#3ff23f"], pair: "high-contrast-light", dark: 1 },
    { slug: "tokyo-night-horizon", name: "Tokyo Night Horizon", t: ["#1c1e26", "#16161c", "#d5d8da", "#9a9cba", "#e95678", "#29d398"], dark: 1 },
  ];
  const PAL = Object.fromEntries(PALETTES.map((p) => [p.slug, p]));
  (function injectPalettes() {
    const css = PALETTES.map((p) => {
      const [bg, soft, fg, muted, acc, ok] = p.t;
      return `:root[data-system="classic"][data-palette="${p.slug}"]{--bg:${bg};--bg-soft:${soft};--fg:${fg};--muted:${muted};--accent:${acc};--ok:${ok};--accent-fg:${p.dark ? bg : "#fff"};${p.dark ? "--shadow-float:0 1px 2px rgba(0,0,0,.4),0 14px 36px rgba(0,0,0,.5);--rec-pill-bg:#f4f4f5;--rec-pill-fg:#111214;--rec-pill-muted:#52525b;" : ""}${p.mono ? '--font-b:"Geist Mono",monospace;--font-t:"Geist Mono",monospace;' : ""}}`;
    }).join("\n");
    const el = document.createElement("style"); el.textContent = css; document.head.appendChild(el);
  })();

  const state = { system: SYS[html.dataset.system] ? html.dataset.system : "classic", palette: PAL[html.dataset.palette] ? html.dataset.palette : "github-light", mode: html.dataset.mode === "dark" ? "dark" : "light" };
  html.dataset.system = state.system;
  let lastState = null;
  const listeners = [];
  const onChange = (fn) => listeners.push(fn);
  function ensureFonts(id) {
    const s = SYS[id];
    if (!s || !s.fonts || document.head.querySelector(`link[data-font="${id}"]`)) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = GF + s.fonts + "&display=swap"; l.dataset.font = id; document.head.appendChild(l);
  }
  const currentName = () => (state.system === "classic" ? PAL[state.palette].name : SYS[state.system].name);
  function commit() {
    html.dataset.system = state.system; html.dataset.palette = state.palette; html.dataset.mode = state.mode;
    store.set("rv5-system", state.system); store.set("rv5-palette", state.palette); store.set("rv5-mode", state.mode);
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  }
  /** Apply a design or palette. Design switches get the datamosh burst; palettes flip instantly. */
  function apply(next, opts = {}) {
    const prev = { ...state };
    const sysChange = (next.system ?? state.system) !== state.system;
    Object.assign(state, next);
    if (state.system !== "classic") ensureFonts(state.system);
    if (prev.system === state.system && prev.palette === state.palette && prev.mode === state.mode) return;
    lastState = prev;
    if (sysChange && document.startViewTransition && !reduceMotion()) {
      html.classList.add("mosh");
      const t = document.startViewTransition(commit);
      t.finished.finally(() => html.classList.remove("mosh"));
    } else commit();
    if (!opts.silent) toast(`<span>Now viewing <b>${esc(currentName())}</b></span>`, [{ label: "Undo", run: () => lastState && apply(lastState, { silent: true }) }]);
  }
  const pickSystem = (id, opts) => apply({ system: id }, opts);
  const pickPalette = (slug, opts) => apply({ system: "classic", palette: slug, mode: PAL[slug].dark ? "dark" : "light" }, opts);
  const randomSystem = () => { const pool = SYSTEMS.filter((s) => s.id !== state.system); pickSystem(pool[(Math.random() * pool.length) | 0].id); };
  const nextSystem = (dir = 1) => { const i = SYSTEMS.findIndex((s) => s.id === state.system); return SYSTEMS[(i + dir + SYSTEMS.length) % SYSTEMS.length]; };
  function toggleMode() {
    if (state.system === "classic") { const pair = PAL[state.palette].pair; if (pair) pickPalette(pair, { silent: true }); return; }
    apply({ mode: state.mode === "dark" ? "light" : "dark" }, { silent: true });
  }

  /* ───────── Toast ───────── */
  const toastEl = $("#toast"); let toastT = 0;
  function toast(h, actions = [], ms = 3600) {
    toastEl.innerHTML = h;
    actions.forEach((a) => { const b = document.createElement("button"); b.type = "button"; b.textContent = a.label; if (a.primary) b.className = "primary"; b.addEventListener("click", () => { a.run(); toastEl.hidden = true; }); toastEl.appendChild(b); });
    toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  /* ───────── Dial (two groups on one fan) ───────── */
  const dial = $("#dial"), fan = $("#dial-fan"), groupLabel = $("#dial-group");
  const ITEMS = [...SYSTEMS.map((s) => ({ kind: "system", id: s.id, name: s.name, s })), { kind: "divider", name: "Palettes" }, ...PALETTES.map((p) => ({ kind: "palette", id: p.slug, name: p.name, p }))];
  let focusIdx = 0;
  const pillEls = ITEMS.map((it, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "pill" + (it.kind === "divider" ? " divider" : "");
    b.innerHTML = `<span class="pn">${esc(it.name)}</span>`;
    if (it.kind === "divider") { b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); return b; }
    b.setAttribute("role", "radio"); b.tabIndex = -1;
    if (it.kind === "system") {
      const w = it.s.sw;
      Object.assign(b.style, { background: w.bg, color: w.fg, fontFamily: w.font, fontWeight: w.w, letterSpacing: w.ls || "0", textTransform: w.tt || "none", fontSize: (w.fs || 14) + "px", borderRadius: w.r ?? "999px", border: w.border || "", boxShadow: w.shadow || "" });
      b.insertAdjacentHTML("beforeend", `<span class="pk" style="font-family:-apple-system,Geist,sans-serif">${it.s.tag}</span>`);
      b.setAttribute("aria-label", `Switch to the ${it.name} design`);
    } else {
      Object.assign(b.style, { background: it.p.t[0], color: it.p.t[2], fontFamily: '"Geist Mono",ui-monospace,monospace', fontSize: "12px", fontWeight: 600 });
      b.insertAdjacentHTML("beforeend", `<span class="pk" style="display:flex;gap:3px"><i style="width:6px;height:6px;border-radius:50%;background:${it.p.t[0]};box-shadow:inset 0 0 0 1px ${it.p.t[2]}"></i><i style="width:6px;height:6px;border-radius:50%;background:${it.p.t[4]}"></i></span>`);
      b.setAttribute("aria-label", `Switch to the ${it.name} palette`);
    }
    b.addEventListener("click", () => { focusIdx = i; it.kind === "system" ? pickSystem(it.id) : pickPalette(it.id); });
    return b;
  });
  pillEls.forEach((b) => fan.appendChild(b));
  const activeIdx = () => ITEMS.findIndex((it) => (state.system === "classic" ? it.kind === "palette" && it.id === state.palette : it.kind === "system" && it.id === state.system));
  function layoutFan() {
    pillEls.forEach((b, i) => {
      const d = i - focusIdx;
      b.style.transform = `translate(0, calc(-50% + ${d * 44}px)) rotate(${d * 15}deg)`;
      b.style.opacity = Math.abs(d) > 3 ? "0" : String(1 - Math.abs(d) * 0.16);
      b.style.pointerEvents = Math.abs(d) > 3 ? "none" : "";
      const act = i === activeIdx(); b.classList.toggle("is-active", act);
      if (ITEMS[i].kind !== "divider") b.setAttribute("aria-checked", String(act));
      b.tabIndex = i === focusIdx ? 0 : -1;
    });
    const it = ITEMS[focusIdx];
    groupLabel.innerHTML = it.kind === "system" ? `<b>Designs</b> · ${SYSTEMS.length}` : `<b>Palettes</b> · ${PALETTES.length}`;
    $("#dt-mode-ic").innerHTML = icon(state.mode === "dark" ? "sun" : "moon");
    $("#dt-mode").disabled = state.system === "classic" && !PAL[state.palette].pair;
  }
  function moveFocus(dir) { let i = focusIdx + dir; if (ITEMS[i]?.kind === "divider") i += dir; focusIdx = Math.max(0, Math.min(ITEMS.length - 1, i)); layoutFan(); }
  dial.addEventListener("wheel", (e) => { e.preventDefault(); moveFocus(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  fan.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); moveFocus(1); pillEls[focusIdx].focus(); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); moveFocus(-1); pillEls[focusIdx].focus(); }
    if (e.key === "Escape") { dial.classList.remove("is-open"); pillEls[focusIdx].blur(); }
  });
  $("#dial-shell").addEventListener("click", (e) => { if (!fine.matches && !dial.classList.contains("is-open")) { dial.classList.add("is-open"); e.stopPropagation(); } });
  document.addEventListener("click", (e) => { if (!dial.contains(e.target) && !e.target.closest("#nav-design")) dial.classList.remove("is-open"); });
  $("#dt-mode").addEventListener("click", toggleMode);
  $("#dt-dice").addEventListener("click", randomSystem);
  $("#dt-lite").addEventListener("click", () => { const on = html.classList.toggle("lite"); $("#dt-lite").setAttribute("aria-pressed", String(on)); store.set("rv5-lite", on ? "1" : "0"); listeners.forEach((fn) => fn()); });
  $("#dt-lite").setAttribute("aria-pressed", String(html.classList.contains("lite")));
  $("#nav-design").addEventListener("click", (e) => { e.stopPropagation(); dial.classList.add("is-open"); pillEls[focusIdx]?.focus({ preventScroll: true }); });
  onChange(() => { focusIdx = Math.max(0, activeIdx()); layoutFan(); $("#nd-name").textContent = currentName(); });


  /* ───────── Sections: the nav scroll-spies; hashes scroll, or open a case study ───────── */
  const spyEl = $("#nav-spy"), navLinks = $(".nav-links");
  const SPY_MAP = { top: null, work: "work", experience: "work", about: "about", play: "play", faq: null, contact: "contact" };
  let spyCur;
  function setSpy(id) {
    if (id === spyCur) return; spyCur = id;
    $$(".nav-links a").forEach((a) => (a.dataset.spy === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    const a = id && $(`.nav-links a[data-spy="${id}"]`);
    if (!a || !a.offsetParent) { spyEl.classList.remove("on"); return; }
    spyEl.style.width = a.offsetWidth + "px"; spyEl.style.transform = `translateX(${a.offsetLeft + navLinks.offsetLeft}px)`; spyEl.classList.add("on");
  }
  const spyIO = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) setSpy(SPY_MAP[e.target.id]); }), { rootMargin: "-45% 0px -54% 0px" });
  Object.keys(SPY_MAP).forEach((id) => { const el = document.getElementById(id); if (el) spyIO.observe(el); });
  addEventListener("resize", () => { const c = spyCur; spyCur = undefined; setSpy(c); });
  function openFromHash() { const h = decodeURIComponent(location.hash.slice(1)); if (h.startsWith("work-") && P(h.slice(5))) openCase(h.slice(5), false); }



  /* ───────── Nav: character roll, hide on scroll down ───────── */
  $$(".roll").forEach((a) => {
    const t = a.textContent; a.setAttribute("aria-label", t);
    a.innerHTML = [...t].map((c, i) => `<span class="rc" aria-hidden="true" style="--i:${Math.abs(i - (t.length - 1) / 2)}"><span>${esc(c)}</span><span>${esc(c)}</span></span>`).join("");
  });
  let lastY = scrollY, navTick = false;
  addEventListener("scroll", () => {
    if (navTick) return; navTick = true;
    requestAnimationFrame(() => {
      navTick = false;
      const y = scrollY, dy = y - lastY;
      if (y > 140 && dy > 6) $("#nav-wrap").classList.add("away");
      else if (dy < -6 || y < 140) $("#nav-wrap").classList.remove("away");
      if (Math.abs(dy) > 6) lastY = y;
    });
  }, { passive: true });

  /* ───────── Hero: kinetic name, pointer highlight, magnetic CTAs ───────── */
  const kinetic = $(".kinetic");
  $$(".k-line", kinetic).forEach((line) => { line.innerHTML = [...line.dataset.text].map((c) => (c === " " ? '<span class="ch sp" aria-hidden="true"> </span>' : `<span class="ch" aria-hidden="true">${esc(c)}</span>`)).join(""); });
  const chars = $$(".ch", kinetic);
  let centers = [], kRaf = 0, kPt = null;
  const measureChars = () => { centers = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  function kFrame() {
    kRaf = 0;
    chars.forEach((c, i) => {
      if (!kPt) { c.style.setProperty("--k", "0"); return; }
      const [cx, cy] = centers[i] || [0, 0];
      const k = Math.max(0, 1 - Math.hypot(kPt[0] - cx, (kPt[1] - cy) * 1.4) / 170);
      c.style.setProperty("--k", (k * k * (3 - 2 * k)).toFixed(3));
    });
  }
  kinetic.addEventListener("pointerenter", measureChars);
  kinetic.addEventListener("pointermove", (e) => { kPt = [e.clientX, e.clientY]; if (!kRaf) kRaf = requestAnimationFrame(kFrame); });
  kinetic.addEventListener("pointerleave", () => { kPt = null; if (!kRaf) kRaf = requestAnimationFrame(kFrame); });

  // Pointer highlight around the key phrase (adapted from Aceternity's Pointer Highlight).
  const ph = $("#ph");
  function drawHighlight() {
    $(".ph-box", ph)?.remove(); $(".ph-cursor", ph)?.remove();
    const r = ph.getBoundingClientRect(), w = r.width + 16, h = r.height + 8, len = 2 * (w + h);
    ph.insertAdjacentHTML("beforeend", `<svg class="ph-box" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="--len:${len}" aria-hidden="true"><rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="4"/></svg><span class="ph-cursor" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS["mouse-pointer-2"] || ""}</svg></span>`);
    requestAnimationFrame(() => ph.classList.add("on"));
  }

  // Magnetic buttons (adapted from Aceternity's Magnetic Button): drift ≤ 6px toward the cursor.
  $$(".magnetic").forEach((b) => {
    b.addEventListener("pointermove", (e) => { if (!fine.matches || reduceMotion()) return; const r = b.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); b.style.transform = `translate(${Math.max(-6, Math.min(6, dx * 0.18))}px, ${Math.max(-5, Math.min(5, dy * 0.3))}px)`; });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  });

  // Live clocks
  const clockFmt = {};
  function ticks() {
    const now = new Date();
    $$("[data-clock]").forEach((el) => { const tz = el.dataset.clock; clockFmt[tz] ||= new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }); el.textContent = clockFmt[tz].format(now); });
    $("#tb-clock").textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
  }
  ticks(); setInterval(ticks, 15000);

  /* ───────── Content ───────── */
  const PROJECTS = [
    { slug: "mind-controlled-arm", title: "Mind-Controlled Robotic Arm", headline: "A robotic arm driven by thought alone", badge: "BCI / Hardware", ctx: "NeuroSky EEG headset and an Arduino", media: "assets/arm-demo.jpg", mediaAlt: "Rithvik at his bench with the EEG headset, breadboard and robotic hand", desc: ["Drives a robotic arm from thought alone with a NeuroSky EEG headset and an Arduino.", "Built as a foundation for translating intent into sign-language gestures for differently-abled users."], tags: ["NeuroSky", "Arduino", "C++", "Python", "EEG"], links: { Demo: "https://www.youtube.com/watch?v=W8EzUuWgi4o" } },
    { slug: "boilerframe", title: "BoilerFrame", headline: "Finds every frame a person appears in a video", badge: "Computer vision", ctx: "Full-stack MERN app on AWS Rekognition", media: "assets/og-boilerframe.png", mediaAlt: "GitHub preview of the BoilerFrame repository", desc: ["Ingests reference images and footage, then runs a facial-recognition pipeline.", "Returns every timestamp the person appears.", "Built on the MERN stack with AWS Rekognition."], tags: ["React", "Express", "Node.js", "MongoDB", "AWS"], links: { GitHub: "https://github.com/rithvikpkx/BoilerFrame" } },
    { slug: "citizen-happiness", title: "Predicting Citizen Happiness", headline: "Modeled how public spending tracks happiness", badge: "ML research", ctx: "Columbia University SHAPE, team of four", media: "assets/shape-demo.jpg", mediaAlt: "Rithvik presenting the project at Columbia University's SHAPE program", desc: ["Lasso model correlating national spending on military, education and health with reported happiness.", "Built by a four-person team during Columbia University's SHAPE program in New York."], tags: ["Python", "Pandas", "scikit-learn"], links: { GitHub: "https://github.com/rithvikpkx/HappinessProjectSHAPE", Demo: "https://www.youtube.com/watch?v=eBzE83IjDZM" } },
    { slug: "eeg-thought-prediction", title: "Left/Right Thought Prediction", headline: "Classifies left, right and neutral thoughts from EEG", badge: "BCI", ctx: "16-channel OpenBCI headset", media: null, desc: ["Classifies left, right and neutral thoughts from 16-channel EEG captured with an OpenBCI headset.", "Pairs a stimulus-display program with TensorFlow models; ongoing work is dataset collection and accuracy."], tags: ["Python", "OpenBCI", "TensorFlow", "Keras", "EEG"], links: { GitHub: "https://github.com/rithvikpkx/OpenBCI-Project" } },
    { slug: "qrify", title: "QRIfy", headline: "Turns any text into a downloadable QR code", badge: "Web app", ctx: "Python and Segno on AWS EC2", media: "assets/og-qrify.png", mediaAlt: "GitHub preview of the QRIfy repository", desc: ["Turns user text into a downloadable QR code.", "Python and Segno backend, hand-rolled frontend, deployed on an AWS EC2 instance."], tags: ["Python", "JavaScript", "AWS"], links: { GitHub: "https://github.com/rithvikpkx/QRCode_Project" } },
    { slug: "habitat-humanity-ecomm", title: "Habitat for Humanity E-Commerce", headline: "One-click listings to Marketplace and eBay", badge: "Volunteer", ctx: "Google Apps Script tool for a non-profit", media: null, desc: ["Inventory tool that posts items to Facebook Marketplace and eBay from one interface.", "Wrote the training materials and onboarded staff to the new workflow."], tags: ["Google Apps Script", "JavaScript"], links: {} },
  ];
  const EXPERIENCE = [
    { slug: "tinyml-research", role: "Undergraduate Researcher, TinyML", org: "Snowball Lab, Purdue University", when: "2026 – now", where: "West Lafayette, IN", desc: ["Optimizing and deploying small ML models onto low-power embedded hardware with Edge Impulse, under Prof. Qiuyue \"Shirley\" Xue.", "Investigating piezoelectric microphones that act as both sensors and energy sources for on-device models."], tags: ["TinyML", "Edge Impulse", "Python", "C++"] },
    { slug: "hack-the-future", role: "Software Developer", org: "Hack The Future @ Purdue", when: "2025 – 2026", where: "West Lafayette, IN", desc: ["Built a full-stack, AI-powered RAG learning platform for a non-profit serving 500+ underserved learners.", "Wired the LLM workflow and vector retrieval; added AI-generated quizzes and assignments."], tags: ["React", "Node.js", "Express", "MongoDB", "Ollama", "RAG"] },
    { slug: "code-ninjas-ir", role: "Investor Relations Chair", org: "Code Ninjas", when: "2025", where: "Northborough, MA", desc: ["Analyzed revenue, costs and margins to surface trends; delivered quarterly reports."], tags: ["Financial analysis", "Reporting"] },
    { slug: "code-ninjas-sensei", role: "Code Sensei", org: "Code Ninjas", when: "2023 – 2025", where: "Northborough, MA", desc: ["Taught programming through game development to 40 students aged 5 to 12.", "Organized hackathons and built personalized skill paths with parents."], tags: ["JavaScript", "C#", "Teaching"] },
  ];
  const FAQ = [
    ["When can you start?", "I'm open to SWE and AI internships for {{season and dates}}."],
    ["Where are you based?", "West Lafayette, Indiana during the school year. I'm in San Francisco right now."],
    ["What kind of role fits best?", "Software engineering or ML work, especially close to hardware: brain-computer interfaces, computer vision and TinyML."],
    ["Can I see code?", "Most projects link to their repositories; the rest are on GitHub at github.com/rithvikpkx."],
    ["Work authorization?", "{{owner to confirm}}"],
  ];
  const STACK = {
    Languages: ["Python", "JavaScript", "TypeScript", "C++", "C#", "SQL"],
    Frameworks: ["React", "Next.js", "Node.js", "Express", "TensorFlow", "Keras", "scikit-learn", "Pandas"],
    "Infra and data": ["AWS", "MongoDB", "Supabase", "Vercel", "Cloudflare", "Google Apps Script"],
    "AI and hardware": ["RAG", "Ollama", "Edge Impulse", "TinyML", "OpenBCI", "NeuroSky", "Arduino", "EEG"],
  };
  const TOOL_LOGO = { Python: "python", JavaScript: "javascript", TypeScript: "typescript", "C++": "cplusplus", React: "react", "Next.js": "nextdotjs", "Node.js": "nodedotjs", Express: "express", TensorFlow: "tensorflow", Keras: "keras", "scikit-learn": "scikitlearn", Pandas: "pandas", MongoDB: "mongodb", Supabase: "supabase", Vercel: "vercel", Cloudflare: "cloudflare", "Google Apps Script": "googleappsscript", Arduino: "arduino", Ollama: "ollama" };
  const chip = (t) => `<span class="chip">${TOOL_LOGO[t] ? logo(TOOL_LOGO[t]) : ""}${esc(t)}</span>`;
  const P = (slug) => PROJECTS.find((p) => p.slug === slug);
  const PX = { "mind-controlled-arm": "cpu", boilerframe: "crosshair", "citizen-happiness": "trending-up", "eeg-thought-prediction": "activity", qrify: "grip", "habitat-humanity-ecomm": "users" };
  /** A type-led work card: icon, label, outcome headline, context, tags. No media, so every card matches. */
  function wcard(p, i) {
    const cls = i === 0 ? " feat" : i < 3 ? " side" : "";
    return `<button type="button" class="wcard panel${cls}" data-case="${p.slug}" id="project-${p.slug}" data-label="${esc(p.badge.toUpperCase())}" data-title="${p.slug}.exe" data-fig="${i + 1}">
      <span class="wc-ring" style="--rot:${i * 67 - 20}deg" aria-hidden="true"><span class="mark-slot" data-mark="card"></span></span>
      <span class="wc-top"><span class="wc-ic">${icon(PX[p.slug])}</span><span class="wc-meta">${esc(p.badge)}</span></span>
      <span class="wc-view" aria-hidden="true">View ${icon("arrow-up-right")}</span>
      <span class="wc-bottom"><span class="wc-title">${esc(p.headline)}</span><span class="wc-ctx">${esc(p.title)} · ${esc(p.ctx)}</span><span class="chips wc-tags">${p.tags.slice(0, 4).map(chip).join("")}</span></span>
    </button>`;
  }
  $("#work-grid").innerHTML = PROJECTS.map(wcard).join("");
  renderMarks($("#work-grid"));

  /* Case study sheet: the project slides up over the page; the mark in its corner fills as you read */
  const sheet = $("#sheet"), sheetBody = $("#sheet-body");
  let lastFocus = null;
  $(".sheet-progress").insertAdjacentHTML("afterbegin", `<span class="mark-slot ghost" data-mark="ghost"></span>`);
  function openCase(slug, push = true) {
    const p = P(slug); if (!p) return;
    const i = PROJECTS.indexOf(p), next = PROJECTS[(i + 1) % PROJECTS.length];
    $("#case").innerHTML = `<div class="case-col">
        <h1 id="case-h">${esc(p.headline)}</h1>
        <p class="case-lede">${esc(p.desc[0])}</p>
        <div class="chips">${p.tags.map(chip).join("")}</div>
        <dl class="case-meta"><div><dt>Project</dt><dd>${esc(p.title)}</dd></div><div><dt>Type</dt><dd>${esc(p.badge)}</dd></div><div><dt>Context</dt><dd>${esc(p.ctx)}</dd></div></dl>
      </div>
      <div class="case-plate" aria-hidden="true"><span class="mark-slot" data-mark="plate"></span><span class="cp-ic">${icon(PX[slug])}</span></div>
      <div class="case-col">
        <h2>What it does</h2><ul class="bullets">${p.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
        ${Object.keys(p.links).length ? `<h2>Links</h2><div class="case-links">${Object.entries(p.links).map(([k, v]) => `<a class="btn ghost sm" href="${v}" target="_blank" rel="noopener">${k} ${icon("arrow-up-right")}</a>`).join("")}</div>` : ""}
        <button type="button" class="case-next" data-case="${next.slug}"><span class="label">Next project</span><b>${esc(next.title)}</b></button>
      </div>`;
    renderMarks($("#case"));
    if (sheet.hidden) { lastFocus = document.activeElement; sheet.hidden = false; html.classList.add("locked"); renderMarks($(".sheet-progress")); }
    sheetBody.scrollTop = 0; sheetBody.focus({ preventScroll: true });
    if (push) history.replaceState(null, "", "#work-" + slug);
    document.title = `${p.title} · Rithvik Praveen Kumar`;
    syncSheetProgress();
  }
  function closeCase() {
    if (sheet.hidden || sheet.classList.contains("closing")) return;
    sheet.classList.add("closing");
    setTimeout(() => { sheet.hidden = true; sheet.classList.remove("closing"); html.classList.remove("locked"); }, reduceMotion() ? 0 : 280);
    history.replaceState(null, "", "#work"); document.title = "Rithvik Praveen Kumar";
    lastFocus?.focus?.({ preventScroll: true });
  }
  function syncSheetProgress() {
    const r = $(".sheet-progress .mk-progress .mk-reveal"); if (!r) return;
    const max = sheetBody.scrollHeight - sheetBody.clientHeight, p = max > 0 ? sheetBody.scrollTop / max : 1;
    r.style.strokeDashoffset = (1 - Math.max(0.03, p)).toFixed(3);
  }
  let sheetTick = 0;
  sheetBody.addEventListener("scroll", () => { if (!sheetTick) sheetTick = requestAnimationFrame(() => { sheetTick = 0; syncSheetProgress(); }); }, { passive: true });
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-case]"); if (c) { openCase(c.dataset.case); return; }
    if (e.target.closest("[data-close-sheet]")) closeCase();
  });


  $("#ledger").innerHTML = EXPERIENCE.map((x, i) => `<li class="lrow panel" data-label="${esc(x.org.toUpperCase())}" data-title="${x.slug}.log" data-fig="E${i + 1}" id="experience-${x.slug}">
    <button class="lr-head" type="button" aria-expanded="false" aria-controls="lr-${i}"><span class="lr-when">${esc(x.when)}</span><span class="lr-role">${esc(x.role)}<span class="lr-org">${esc(x.org)}</span></span><span class="lr-where">${esc(x.where)}</span><span class="lr-plus" aria-hidden="true"></span></button>
    <div class="lr-body" id="lr-${i}"><div class="lr-inner"><div><ul class="bullets">${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul><div class="chips">${x.tags.map(chip).join("")}</div></div></div></div></li>`).join("");
  $("#ledger").addEventListener("click", (e) => { const b = e.target.closest(".lr-head"); if (!b) return; const row = b.parentElement, open = !row.classList.contains("open"); row.classList.toggle("open", open); b.setAttribute("aria-expanded", String(open)); });
  $$(".lrow")[0].classList.add("open"); $$(".lr-head")[0].setAttribute("aria-expanded", "true");

  $("#faq-list").innerHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p class="ans">${esc(a)}</p></details>`).join("");
  const LOG = [["Aug 14", "feat", "lightweight agentic actions in the chat"], ["Aug 14", "fix", "make the favicon acceptable to Google search results"], ["Aug 14", "feat", "semantic repeat detection + runtime temperature knob"], ["Aug 14", "feat", "follow-up suggestions + transcript export"], ["Aug 11", "fix", "rate-limit /api/chat, close contact relay, fix OG images"], ["Aug 11", "fix", "close public write path to site content"]];

  /* ───────── Portrait orbit: measured ring + text path, and beams that pulse from each contact into the photo ───────── */
  (function buildBeams() {
    // nodes sit on an outer circle under the photo; each beam bends inward and lands on the photo's lower rim
    const K = 0.53 * 400, PR = 140, deg = (d) => (d * Math.PI) / 180;
    let b = `<defs><linearGradient id="bm-grad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--accent)" stop-opacity="0"/><stop offset=".5" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--ok)"/></linearGradient></defs>`;
    $$(".orb-node").forEach((n) => {
      const a = parseFloat(n.style.getPropertyValue("--a")), e = deg(90 + (a - 90) * 0.42), c = deg(90 + (a - 90) * 0.12), s = deg(a);
      const x0 = 200 + (K - 24) * Math.cos(s), y0 = 200 + (K - 24) * Math.sin(s), x1 = 200 + PR * Math.cos(e), y1 = 200 + PR * Math.sin(e);
      const cx = 200 + 172 * Math.cos(c), cy = 200 + 172 * Math.sin(c), d = `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      b += `<path class="bm-base" d="${d}"/><path class="bm-pulse" d="${d}" pathLength="1"/>`;
    });
    $("#beams").innerHTML = b;
  })();

  /* ───────── Shared helpers for canvases ───────── */
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true }); probe.canvas.width = probe.canvas.height = 1;
  const token = (n) => getComputedStyle(html).getPropertyValue(n).trim();
  function rgb(c) { probe.fillStyle = "#000"; probe.fillStyle = c || "#000"; probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; }
  const cssColor = (n, a = 1) => { const [r, g, b, al] = rgb(token(n)); return `rgba(${r},${g},${b},${al * a})`; };
  /** Run `draw` at `fps` only while `el` is on-screen, the tab is visible and `enabled()` holds. */
  const loops = [];
  function loop(el, fps, draw, enabled = () => true) {
    let visible = false, raf = 0, last = 0;
    const running = () => visible && !document.hidden && enabled() && !reduceMotion() && (el === document.body || el.getClientRects().length > 0);
    const tick = (t) => { raf = 0; if (!running()) return; if (t - last >= 1000 / fps) { last = t; draw(t); } raf = requestAnimationFrame(tick); };
    const sync = () => { if (running()) { if (!raf) raf = requestAnimationFrame(tick); } else draw(performance.now(), true); };
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; sync(); }, { rootMargin: "60px" }).observe(el);
    document.addEventListener("visibilitychange", sync);
    loops.push(sync); onChange(sync);
    return sync;
  }
  const syncLoops = () => loops.forEach((f) => f());

  /* ───────── About band: a pinned globe scrubbed by scroll; the mark travels Boston → West Lafayette → San Francisco ───────── */
  const globe = $("#globe"), gctx = globe.getContext("2d"), gMark = $("#g-mark"), gChips = $$("#g-chips li"), bandTrack = $("#band-track"), bandEl = $("#about");
  const STOPS = [{ lat: 42.36, lng: -71.06 }, { lat: 40.43, lng: -86.91 }, { lat: 37.77, lng: -122.42 }];
  let gCols = {}, gP = -1, gPs = 0;
  const bandTok = (n, a = 1) => { const [r, g, b, al] = rgb(getComputedStyle(bandEl).getPropertyValue(n).trim()); return `rgba(${r},${g},${b},${al * a})`; };
  const readGlobe = () => { gCols = { land: bandTok("--band-fg", 0.92), back: bandTok("--band-fg", 0.12), ring: bandTok("--band-fg", 0.35), arc: bandTok("--band-fg", 0.9) }; gP = -1; };
  const toRad = (d) => (d * Math.PI) / 180;
  /** Spherical interpolation between two lat/lng stops (degrees). */
  function slerp(a, b, t) {
    const v = (p) => [Math.cos(toRad(p.lat)) * Math.cos(toRad(p.lng)), Math.cos(toRad(p.lat)) * Math.sin(toRad(p.lng)), Math.sin(toRad(p.lat))];
    const A = v(a), B = v(b), dot = Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]), w = Math.acos(dot) || 1e-6, s = Math.sin(w);
    const k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s, x = k1 * A[0] + k2 * B[0], y = k1 * A[1] + k2 * B[1], z = k1 * A[2] + k2 * B[2];
    return { lat: (Math.asin(z) * 180) / Math.PI, lng: (Math.atan2(y, x) * 180) / Math.PI };
  }
  const along = (p) => { const s = Math.min(1.999, p * 2), i = Math.floor(s); return slerp(STOPS[i], STOPS[i + 1], s - i); };
  function bandProgress() {
    const r = bandTrack.getBoundingClientRect(), span = r.height - innerHeight;
    return span > 40 ? Math.max(0, Math.min(1, -r.top / span)) : Math.max(0, Math.min(1, (innerHeight - r.top) / (r.height + innerHeight)));
  }
  loop(globe, 60, (t, still) => {
    const target = bandProgress(); gPs = still || reduceMotion() ? target : gPs + (target - gPs) * 0.14;
    if (Math.abs(gPs - gP) < 0.0004 && gP >= 0) return; gP = gPs;
    const dpr = Math.min(devicePixelRatio || 1, 1.5), s = globe.clientWidth || 400;
    if (globe.width !== Math.round(s * dpr)) globe.width = globe.height = Math.round(s * dpr);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0); gctx.clearRect(0, 0, s, s);
    const view = along(gP), lam = -toRad(view.lng + 8), tilt = toRad(view.lat * 0.85), R = s * 0.46, cx = s / 2, cy = s / 2;
    const proj = (lat, lng) => { const la = toRad(lat), lo = toRad(lng) + lam, x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo); return [cx + x * R, cy - (y * Math.cos(tilt) - z * Math.sin(tilt)) * R, y * Math.sin(tilt) + z * Math.cos(tilt)]; };
    gctx.strokeStyle = gCols.ring; gctx.lineWidth = 1; gctx.beginPath(); gctx.arc(cx, cy, R, 0, Math.PI * 2); gctx.stroke();
    const px = Math.max(2, s / 190);
    for (const [la, lo] of AS.land) { const [x, y, z] = proj(la, lo); if (z > 0) { gctx.fillStyle = gCols.land; gctx.fillRect(x - px / 2, y - px / 2, px, px); } }
    // travelled path so far (solid) and the rest (dotted)
    const pts = []; for (let i = 0; i <= 80; i++) pts.push(proj(...Object.values(along(i / 80))));
    const cut = Math.round(gP * 80);
    gctx.lineWidth = 2; gctx.strokeStyle = gCols.arc; gctx.setLineDash([]); gctx.beginPath();
    pts.slice(0, cut + 1).forEach((p, i) => (p[2] > 0 ? (i ? gctx.lineTo(p[0], p[1]) : gctx.moveTo(p[0], p[1])) : gctx.moveTo(p[0], p[1]))); gctx.stroke();
    gctx.lineWidth = 1.5; gctx.setLineDash([2, 5]); gctx.beginPath();
    pts.slice(cut).forEach((p, i) => (p[2] > 0 ? (i ? gctx.lineTo(p[0], p[1]) : gctx.moveTo(p[0], p[1])) : gctx.moveTo(p[0], p[1]))); gctx.stroke(); gctx.setLineDash([]);
    STOPS.forEach((st, i) => {
      const [x, y, z] = proj(st.lat, st.lng), on = z > 0.05;
      if (on) { gctx.fillStyle = gCols.arc; gctx.beginPath(); gctx.arc(x, y, 4, 0, Math.PI * 2); gctx.fill(); }
      const chip = gChips[i]; chip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; chip.classList.toggle("on", on && Math.abs(gP * 2 - i) < 0.6);
    });
    const me = proj(...Object.values(along(gP)));
    gMark.style.transform = `translate(${me[0].toFixed(1)}px, ${me[1].toFixed(1)}px) rotate(${(gP * 540).toFixed(1)}deg)`;
  });
  onChange(() => requestAnimationFrame(readGlobe)); readGlobe();
  /** Pixel-stepped band edges (two tones), seeded so they never change between renders. */
  function pixelEdge(svg) {
    const W = 1920, H = 48, S = 12; let seed = 7, out = "";
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < W; x += S) {
      const n = (Math.sin(x * 0.006) + Math.sin(x * 0.019 + 1.3) * 0.7 + 1.7) / 3.4, h = Math.max(1, Math.round(n * 3 + rnd() * 1.2)) * S;
      out += `<rect x="${x}" y="${H - h}" width="${S}" height="${h}"/>`;
      if (rnd() > 0.45) out += `<rect class="soft" x="${x}" y="${Math.max(0, H - h - S)}" width="${S}" height="${S}"/>`;
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = out;
  }
  pixelEdge($("#edge-top")); pixelEdge($("#edge-bottom"));


  /* ───────── CRT: FIGlet banner, portrait in characters, character rain ───────── */
  const isCrt = () => state.system === "crt";
  const asciiName = $("#ascii-name"), asciiPortrait = $("#ascii-portrait"), portraitImg = $("#portrait-img");
  const RAMP = " .:-=+*#%@";
  function charBox(pre) { const cs = getComputedStyle(pre); probe.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return { w: probe.measureText("M").width || parseFloat(cs.fontSize) * 0.6, h: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) }; }
  let figLines = null, namePt = null, nameT = 0;
  function buildFiglet() {
    if (!isCrt() || !AS.banner) return;
    const B = AS.banner, avail = asciiName.clientWidth || 600, widest = (set) => Math.max(...set.flat().map((l) => l.length));
    const set = avail / widest(B.wide) >= 4.6 ? B.wide : B.narrow;
    asciiName.style.fontSize = Math.min(12, Math.max(4, avail / widest(set) / 0.62)).toFixed(2) + "px"; asciiName.style.lineHeight = "1.02";
    figLines = []; set.forEach((g, i) => { figLines.push(...g); if (i < set.length - 1) figLines.push(""); });
    drawFiglet();
  }
  function drawFiglet() {
    nameT = 0; if (!figLines) return;
    const { w, h } = charBox(asciiName), rect = asciiName.getBoundingClientRect(), GL = "█▓▒░";
    asciiName.textContent = figLines.map((row, ry) => [...row].map((c, rx) => {
      if (c === " " || !namePt) return c;
      const k = Math.max(0, 1 - Math.hypot(namePt[0] - (rect.left + rx * w), (namePt[1] - (rect.top + ry * h)) * 1.6) / 80);
      return k > 0.2 && Math.random() < k ? GL[(Math.random() * GL.length) | 0] : c;
    }).join("")).join("\n");
    if (namePt) nameT = setTimeout(() => requestAnimationFrame(drawFiglet), 60);
  }
  asciiName.addEventListener("pointermove", (e) => { namePt = [e.clientX, e.clientY]; if (!nameT) drawFiglet(); });
  asciiName.addEventListener("pointerleave", () => { namePt = null; clearTimeout(nameT); nameT = 0; drawFiglet(); });
  function buildPortrait() {
    if (!isCrt() || !portraitImg.complete) return;
    const { w, h } = charBox(asciiPortrait), size = asciiPortrait.clientWidth || 220;
    const cols = Math.max(24, Math.min(70, Math.floor(size / w))), rows = Math.round(cols * (w / h));
    const c = document.createElement("canvas"); c.width = cols; c.height = rows; const g = c.getContext("2d");
    try {
      g.drawImage(portraitImg, 0, 0, cols, rows); const d = g.getImageData(0, 0, cols, rows).data; let out = "";
      for (let y = 0; y < rows; y++) { for (let x = 0; x < cols; x++) { const i = (y * cols + x) * 4, dx = (x - cols / 2) / (cols / 2), dy = (y - rows / 2) / (rows / 2); if (dx * dx + dy * dy > 1) { out += " "; continue; } const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; if (L > 0.86) { out += " "; continue; } out += RAMP[Math.min(9, Math.round(Math.min(1, Math.pow((0.9 - L) / 0.9, 0.8) * 1.15) * 9))]; } out += "\n"; }
      asciiPortrait.textContent = out;
    } catch (e) { asciiPortrait.textContent = ""; }
  }
  portraitImg.addEventListener("load", buildPortrait);
  const rainCv = $("#rain"), rctx = rainCv.getContext("2d"); let rainCols = [], rw = 0, rh = 0, rfs = 14;
  const GLYPHS = "アイウエオカキクケコ01ZXV<>/\\|#$%*+=".split("");
  function sizeRain() { const dpr = Math.min(devicePixelRatio || 1, 1.5); rw = rainCv.width = Math.max(1, innerWidth * dpr); rh = rainCv.height = Math.max(1, innerHeight * dpr); rfs = Math.max(12, Math.round(rw / 64)); rainCols = Array.from({ length: Math.ceil(rw / rfs) }, () => Math.random() * -40); }
  loop(document.body, 15, (t, still) => {
    if (still) return; if (!rw) sizeRain();
    rctx.fillStyle = "rgba(5,5,5,.22)"; rctx.fillRect(0, 0, rw, rh);
    rctx.fillStyle = state.mode === "dark" ? "#ffb000" : "#33ff00"; rctx.font = `${rfs}px "JetBrains Mono", monospace`;
    for (let i = 0; i < rainCols.length; i++) { const y = rainCols[i] * rfs; if (y > 0) rctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * rfs, y); rainCols[i] = y > rh && Math.random() > 0.96 ? 0 : rainCols[i] + 1; }
  }, isCrt);

  /* ───────── Lab: blob tracking that acquires what you point at ───────── */
  const isLab = () => state.system === "lab";
  const blobCv = $("#blobs"), bctx = blobCv.getContext("2d");
  let cursor = [innerWidth / 2, innerHeight / 2], cur = [innerWidth / 2, innerHeight / 2], trail = [];
  addEventListener("pointermove", (e) => { cursor = [e.clientX, e.clientY]; }, { passive: true });
  function labTargets() {
    const sel = [["#orbit .portrait", "FACE"], [".hero-name", "NAME"], [".hero-ctas .btn", "CTA"], ["#rec-disc", "DISC"], [".wcard", "MEDIA"]];
    const out = [];
    sel.forEach(([s, label]) => $$(s).forEach((el) => { if (!el.offsetParent) return; const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; out.push({ r, label }); }));
    return out.slice(0, 7);
  }
  loop(document.body, 24, (t, still) => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    if (blobCv.width !== Math.round(innerWidth * dpr)) { blobCv.width = Math.round(innerWidth * dpr); blobCv.height = Math.round(innerHeight * dpr); }
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.clearRect(0, 0, innerWidth, innerHeight);
    const green = cssColor("--accent"), dim = cssColor("--muted", 0.8);
    bctx.font = '10px "JetBrains Mono", monospace'; bctx.lineWidth = 1;
    const tick = (x, y, w, h, c) => { const k = Math.min(10, w / 4, h / 4); bctx.strokeStyle = c; bctx.beginPath(); [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, sx, sy]) => { bctx.moveTo(px, py + sy * k); bctx.lineTo(px, py); bctx.lineTo(px + sx * k, py); }); bctx.stroke(); };
    labTargets().forEach(({ r, label }, i) => {
      const hot = cursor[0] > r.left && cursor[0] < r.right && cursor[1] > r.top && cursor[1] < r.bottom;
      const j = still ? 0 : (Math.random() - 0.5) * 1.2;
      tick(r.left - 6 + j, r.top - 6 + j, r.width + 12, r.height + 12, hot ? green : dim);
      bctx.fillStyle = hot ? green : dim;
      if (innerWidth >= 700) bctx.fillText(`ID ${String(i + 1).padStart(2, "0")} ${label}  x ${Math.round(r.left)} y ${Math.round(r.top)}  conf .${hot ? 97 : 80 + ((i * 7) % 15)}`, r.left - 6, r.top - 12);
    });
    if (!still) { cur[0] += (cursor[0] - cur[0]) * 0.25; cur[1] += (cursor[1] - cur[1]) * 0.25; trail.push([cur[0], cur[1]]); if (trail.length > 12) trail.shift(); }
    trail.forEach(([x, y], i) => { bctx.fillStyle = cssColor("--accent", (i + 1) / trail.length * 0.5); bctx.fillRect(x - 1, y - 1, 2, 2); });
    tick(cur[0] - 20, cur[1] - 20, 40, 40, green);
    bctx.strokeStyle = green; bctx.beginPath(); bctx.moveTo(cur[0] - 5, cur[1]); bctx.lineTo(cur[0] + 5, cur[1]); bctx.moveTo(cur[0], cur[1] - 5); bctx.lineTo(cur[0], cur[1] + 5); bctx.stroke();
    bctx.fillStyle = green; bctx.fillText(`TRK ${Math.round(cur[0])},${Math.round(cur[1])}`, cur[0] + 24, cur[1] + 4);
  }, isLab);

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


  /* ───────── Play field: an endless 2D grid; drag, flick, or trackpad to pan; a card grows into its full UI ───────── */
  const ART = {
    typeracer: `<svg viewBox="0 0 160 90"><text class="a-text" x="0" y="40" font-size="15">model.fit(X, y)</text><rect class="a-acc" x="122" y="27" width="2" height="17"/><rect class="a-muted" x="0" y="58" width="96" height="4" rx="2"/><rect class="a-acc" x="0" y="58" width="58" height="4" rx="2"/></svg>`,
    angle: `<svg viewBox="0 0 160 90"><path class="a-stroke" d="M30 80 L140 80 M30 80 L118 18"/><path class="a-acc-s" d="M70 80 A40 40 0 0 0 63 57"/><text class="a-text" x="78" y="66" font-size="14">?°</text></svg>`,
    dots: `<svg viewBox="0 0 160 90">${[[22, 20], [48, 34], [70, 14], [96, 40], [122, 22], [140, 52], [30, 58], [60, 70], [88, 64], [114, 76], [134, 12], [16, 80], [78, 36], [104, 10]].map(([x, y]) => `<circle class="a-acc" cx="${x}" cy="${y}" r="4"/>`).join("")}</svg>`,
    center: `<svg viewBox="0 0 160 90"><rect x="2" y="2" width="156" height="86" rx="8" fill="none" stroke="currentColor" stroke-dasharray="4 4" opacity=".5"/><rect x="38" y="24" width="46" height="28" rx="5" fill="currentColor"/><path class="a-acc-s" d="M80 39 h0 M74 45 h12 M80 39 v12"/></svg>`,
    bigo: `<svg viewBox="0 0 160 90"><text class="a-text" x="80" y="56" text-anchor="middle" font-size="24">O(n log n)</text></svg>`,
    hexeye: `<svg viewBox="0 0 160 90"><rect x="10" y="12" width="60" height="66" rx="10" fill="#e8743b"/><rect x="90" y="12" width="60" height="66" rx="10" fill="#d9773f"/></svg>`,
    reaction: `<svg viewBox="0 0 160 90"><circle class="a-acc" cx="80" cy="45" r="16"/><circle cx="80" cy="45" r="28" fill="none" stroke="var(--accent)" opacity=".4"/><circle cx="80" cy="45" r="40" fill="none" stroke="var(--accent)" opacity=".15"/></svg>`,
    prime: `<svg viewBox="0 0 160 90"><text class="a-text" x="80" y="62" text-anchor="middle" font-size="44">97</text></svg>`,
  };
  const MORE = [
    { id: "records", name: "Records", sub: "Chili Pepper · 1927" },
    { id: "mark", name: "The mark", sub: "One path, every size" },
    { id: "stack", name: "Stack", sub: "What I build with" },
    { id: "colophon", name: "Colophon", sub: "How this site works" },
  ];
  const TILES = [
    ...GAMES.map((g) => ({ kind: "game", id: g.id, name: g.name, sub: g.play ? `Rithvik · ${g.base} ${g.unit}` : "Coming soon", soon: !g.play })),
    ...MORE.map((m) => ({ kind: "more", ...m })),
    ...SYSTEMS.map((s) => ({ kind: "design", id: s.id, name: s.name, sub: s.tag })),
  ];
  // interleave kinds so neighbours differ
  const byKind = (k) => TILES.filter((t) => t.kind === k);
  let ORDER = [];
  (function interleave() { const g = byKind("game"), d = byKind("design"), m = byKind("more"); for (let i = 0; ORDER.length < TILES.length; i++) { if (g[i]) ORDER.push(g[i]); if (d[i]) ORDER.push(d[i]); if (i % 2 === 0 && m[i / 2]) ORDER.push(m[i / 2]); if (d[i + 8]) ORDER.push(d[i + 8]); } ORDER = [...new Set(ORDER)]; })();
  function tileHTML(t, first) {
    const attrs = `data-kind="${t.kind}" data-id="${t.id}" ${first ? "" : 'tabindex="-1" aria-hidden="true"'}`;
    if (t.kind === "design") return `<button type="button" class="tile mini" data-system="${t.id}" ${attrs} aria-label="Restyle the site as ${esc(t.name)}"><span class="mini-name">${esc(t.name)}</span><span class="t-sub">${esc(t.sub)}</span><span class="mini-row"><span class="mini-card"></span><span class="mini-btn">Use</span></span></button>`;
    let art = "";
    if (t.kind === "game") art = ART[t.id];
    else if (t.id === "records") art = `<img src="assets/record.jpg" alt="" width="132" height="132" draggable="false">`;
    else if (t.id === "mark") art = `<span class="mark-slot" data-mark="tile" style="width:96px"></span>`;
    else if (t.id === "stack") art = `<span class="t-logos">${["python", "react", "tensorflow", "nextdotjs", "arduino", "supabase"].map((l) => logo(l)).join("")}</span>`;
    else if (t.id === "colophon") art = `<span class="t-log">${LOG.slice(0, 4).map(([, ty, s]) => `<span><b>${ty}:</b> ${esc(s)}</span>`).join("")}</span>`;
    return `<button type="button" class="tile${t.id === "records" ? " rec-tile" : ""}" ${attrs}>${t.soon ? '<span class="t-badge">Soon</span>' : ""}<span class="t-art">${art}</span><span><span class="t-name">${esc(t.name)}</span><span class="t-sub">${esc(t.sub)}</span></span></button>`;
  }
  const field = $("#field"), ftrack = $("#field-track");
  let fCols = 0, fRows = 0, cellPx = 300, cardPx = 256, off = [0, 0], vel = [0, 0], fNodes = [], fRaf = 0, fFilter = "all", fBuilt = false;
  function layoutField(force) {
    const cs = getComputedStyle(field); cellPx = parseFloat(cs.getPropertyValue("--cell")) || 300; cardPx = parseFloat(cs.getPropertyValue("--card")) || 256;
    const cols = Math.max(5, Math.ceil(field.clientWidth / cellPx) + 2), rows = Math.max(3, Math.ceil(field.clientHeight / cellPx) + 2);
    if (force || cols !== fCols || rows !== fRows) { fCols = cols; fRows = rows; buildField(); }
    placeField();
  }
  function buildField() {
    const seen = new Set(); let h = "";
    fNodes = [];
    for (let r = 0; r < fRows; r++) for (let c = 0; c < fCols; c++) {
      const t = ORDER[(r * fCols + c + r * 3) % ORDER.length], key = t.kind + t.id;
      h += tileHTML(t, !seen.has(key)); seen.add(key); fNodes.push({ r, c });
    }
    ftrack.innerHTML = h;
    $$(".tile", ftrack).forEach((el, i) => { fNodes[i].el = el; });
    renderMarks(ftrack); applyFilter();
    if (!fBuilt) { off = [(field.clientWidth - fCols * cellPx) / 2 + cellPx / 2, (field.clientHeight - fRows * cellPx) / 2 + cellPx / 2]; fBuilt = true; }
  }
  function placeField() {
    const W = fCols * cellPx, H = fRows * cellPx, pad = (cellPx - cardPx) / 2;
    for (const n of fNodes) {
      const x = ((((n.c * cellPx + off[0]) % W) + W) % W) - cellPx + pad, y = ((((n.r * cellPx + off[1]) % H) + H) % H) - cellPx + pad;
      n.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }
  function glide() {
    vel[0] *= 0.94; vel[1] *= 0.94; off[0] += vel[0]; off[1] += vel[1]; placeField();
    fRaf = Math.hypot(vel[0], vel[1]) > 0.15 ? requestAnimationFrame(glide) : 0;
  }
  let fDrag = null, fMoved = 0, fSamples = [];
  field.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".field-ui")) return;
    fDrag = { x: e.clientX, y: e.clientY, id: e.pointerId, cap: false }; fMoved = 0; vel = [0, 0]; fSamples = [[e.clientX, e.clientY, performance.now()]];
    if (fRaf) { cancelAnimationFrame(fRaf); fRaf = 0; }
  });
  field.addEventListener("pointermove", (e) => {
    if (!fDrag || e.pointerId !== fDrag.id) return;
    const dx = e.clientX - fDrag.x, dy = e.clientY - fDrag.y;
    if (!fDrag.cap) { if (Math.hypot(dx, dy) < 6) return; fDrag.cap = true; field.setPointerCapture(e.pointerId); field.classList.add("dragging"); }
    fMoved += Math.abs(dx) + Math.abs(dy); fDrag.x = e.clientX; fDrag.y = e.clientY; off[0] += dx; off[1] += dy;
    fSamples.push([e.clientX, e.clientY, performance.now()]); if (fSamples.length > 5) fSamples.shift();
    placeField();
  });
  const fEnd = () => {
    if (!fDrag) return; field.classList.remove("dragging");
    if (fDrag.cap && fSamples.length > 1) { const a = fSamples[0], b = fSamples[fSamples.length - 1], dt = Math.max(16, b[2] - a[2]); vel = [((b[0] - a[0]) / dt) * 16, ((b[1] - a[1]) / dt) * 16]; if (!reduceMotion() && performance.now() - b[2] < 80) fRaf = requestAnimationFrame(glide); }
    fDrag = null;
  };
  field.addEventListener("pointerup", fEnd); field.addEventListener("pointercancel", fEnd);
  field.addEventListener("click", (e) => {
    if (fMoved > 6) { e.preventDefault(); e.stopPropagation(); fMoved = 0; return; }
    const t = e.target.closest(".tile"); if (t) openTile(t);
  }, true);
  // horizontal wheel/trackpad pans; plain vertical scroll stays with the page
  field.addEventListener("wheel", (e) => { const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0); if (!dx) return; e.preventDefault(); off[0] -= dx; placeField(); }, { passive: false });
  field.addEventListener("keydown", (e) => {
    const m = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (m && e.target === field) { e.preventDefault(); vel = [m[0] * 14, m[1] * 14]; if (!fRaf) fRaf = requestAnimationFrame(glide); }
  });
  field.addEventListener("focusin", (e) => {
    const t = e.target.closest(".tile"); if (!t) return;
    const fr = field.getBoundingClientRect(), r = t.getBoundingClientRect();
    if (r.left < fr.left + 40 || r.right > fr.right - 40 || r.top < fr.top + 40 || r.bottom > fr.bottom - 80) { off[0] += fr.left + fr.width / 2 - (r.left + r.width / 2); off[1] += fr.top + fr.height / 2 - (r.top + r.height / 2); placeField(); }
  });
  // focus or find-in-page can scroll the clipped field; turn that into a pan and keep the container at 0,0
  field.addEventListener("scroll", () => { if (!field.scrollLeft && !field.scrollTop) return; off[0] -= field.scrollLeft; off[1] -= field.scrollTop; field.scrollLeft = field.scrollTop = 0; placeField(); });
  function applyFilter() { $$(".tile", ftrack).forEach((el) => el.classList.toggle("dim", fFilter !== "all" && el.dataset.kind !== fFilter)); }
  const seg = $("#field-seg"), segThumb = $(".seg-thumb", seg);
  function syncSeg() { const b = $('[aria-checked="true"]', seg); segThumb.style.width = b.offsetWidth + "px"; segThumb.style.transform = `translateX(${b.offsetLeft}px)`; }
  seg.addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; $$("[data-f]", seg).forEach((x) => x.setAttribute("aria-checked", String(x === b))); fFilter = b.dataset.f; applyFilter(); syncSeg(); });
  $("#field-shuffle").addEventListener("click", () => { for (let i = ORDER.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [ORDER[i], ORDER[j]] = [ORDER[j], ORDER[i]]; } buildField(); placeField(); });
  new IntersectionObserver((en, io) => { if (en[0].isIntersecting) { SYSTEMS.forEach((s) => ensureFonts(s.id)); io.disconnect(); } }, { rootMargin: "400px" }).observe(field);
  new ResizeObserver(() => { layoutField(); syncSeg(); }).observe(field);
  onChange(() => { $$(".tile.mini", ftrack).forEach((m) => m.setAttribute("aria-current", String(m.dataset.id === state.system))); requestAnimationFrame(() => { layoutField(); syncSeg(); }); });

  /* Expansion: the tile's rect grows into the centred panel (FLIP), content fades in after */
  const xp = $("#xp"), xpPanel = $("#xp-panel");
  let xpFrom = null;
  function openTile(t) {
    const { kind, id } = t.dataset;
    if (kind === "design") { pickSystem(id); return; }
    if (kind === "game" && !GM[id].play) { toast(`<span><b>${esc(GM[id].name)}</b> is coming to ${id}.rithvik.si</span>`); return; }
    $$(".xp-slot").forEach((s) => (s.hidden = true));
    const more = $("#slot-mark");
    if (kind === "game") { $("#slot-game").hidden = false; $("#xp-title").textContent = GM[id].name; $("#xp-url").textContent = `${id}.rithvik.si`; openGame(id); }
    else if (id === "records") { $("#slot-records").hidden = false; $("#xp-title").textContent = "Records"; $("#xp-url").textContent = "Side A · 78 rpm"; }
    else if (id === "mark") { more.hidden = false; $("#xp-title").textContent = "The mark"; $("#xp-url").textContent = "ouroboros · one path"; more.innerHTML = `<div class="specimen"><div class="sp-hero"><span class="mark-slot" data-mark="spec"></span></div><div class="sp-grid">${[["", "Solid"], ["inv", "Inverse"], ["acc", "Accent"], ["", "Hatch", "plate"], ["tiny", "16 px"], ["", "Spinner", "spin"]].map(([c, l, k]) => `<div class="sp-cell ${c}"><span class="mark-slot" data-mark="${k || "cell"}"></span>${l}</div>`).join("")}<p class="sp-note">A ring that thickens into a rounded snout, opens a wedge mouth, and swallows its own tapering tail. Built from circles and one wedge, so it holds at 16 px, hatches cleanly, and animates by rotation, draw-on and a blink. Weight: switch Fine, Ring or Bold in the mockup bar.</p></div></div>`; renderMarks(more); $$('.mark-slot[data-mark="spin"] .mark', more).forEach((m) => m.classList.add("spinning")); drawOn($(".sp-hero .mark-slot", more)); }
    else if (id === "stack") { more.hidden = false; $("#xp-title").textContent = "Stack"; $("#xp-url").textContent = "tools"; more.innerHTML = `<div class="stack">${Object.entries(STACK).map(([g, tools]) => `<dl class="st-row"><dt>${esc(g)}</dt><dd class="chips">${tools.map(chip).join("")}</dd></dl>`).join("")}</div>`; }
    else if (id === "colophon") { more.hidden = false; $("#xp-title").textContent = "Colophon"; $("#xp-url").textContent = "how this site works"; more.innerHTML = `<div class="colophon"><ol class="steps"><li><b>Ask</b> A question goes to the agent</li><li><b>Rewrite</b> Follow-ups become standalone questions</li><li><b>Retrieve</b> Full profile plus pgvector search</li><li><b>Answer</b> Streams with cited sources</li><li><b>Act</b> Opens a project, the resume, or the composer</li></ol><ul class="log">${LOG.map(([d, ty, s]) => `<li><time>${d}</time><span><span class="type">${ty}:</span> ${esc(s)}</span></li>`).join("")}</ul></div>`; }
    xpFrom = t; lastFocus = document.activeElement;
    xp.hidden = false; xp.classList.add("pre"); html.classList.add("locked");
    const to = xpPanel.getBoundingClientRect(), from = t.getBoundingClientRect();
    if (!reduceMotion()) {
      xpPanel.style.transition = "none";
      xpPanel.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
      void xpPanel.offsetWidth; xpPanel.style.transition = "";
    }
    requestAnimationFrame(() => { xp.classList.remove("pre"); xpPanel.style.transform = ""; });
    setTimeout(() => $("[data-close-xp]", xpPanel).focus({ preventScroll: true }), 60);
  }
  function collapse() {
    if (xp.hidden || xp.classList.contains("closing")) return;
    if (rec.isOn()) rec.toggle();
    const from = xpFrom && xpFrom.isConnected ? xpFrom.getBoundingClientRect() : null;
    xp.classList.add("closing");
    if (from && from.width && !reduceMotion()) { const to = xpPanel.getBoundingClientRect(); xpPanel.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`; }
    setTimeout(() => { xp.hidden = true; xp.classList.remove("closing"); xpPanel.style.transition = "none"; xpPanel.style.transform = ""; void xpPanel.offsetWidth; xpPanel.style.transition = ""; html.classList.remove("locked"); lastFocus?.focus?.({ preventScroll: true }); }, reduceMotion() ? 0 : 400);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close-xp]")) collapse(); });
  function openGame(id) { ({ typeracer: gameType, angle: gameAngle, dots: gameDots, center: gameCenter })[id](GM[id]); }


  /* ───────── Scroll + pointer choreography: one rAF, transforms only ───────── */
  const depthEls = $$(".orb-depth"), giant = $("#ft-giant");
  let ptr = [0, 0], ptrS = [0, 0], fxRaf = 0, gptr = null;
  addEventListener("pointermove", (e) => { if (!fine.matches) return; ptr = [e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5]; gptr = [e.clientX, e.clientY]; kick(); }, { passive: true });
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", kick);
  function kick() { if (!fxRaf) fxRaf = requestAnimationFrame(fx); }
  function fx() {
    fxRaf = 0;
    const y = scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight), p = Math.min(1, y / max);
    $(".brand-progress circle").style.strokeDashoffset = (1 - p).toFixed(4);
    const nm = $(".brand .mark-slot"); if (nm) nm.style.transform = reduceMotion() ? "" : `rotate(${(y * 0.09).toFixed(1)}deg)`;
    // footer: the giant mark draws itself as the footer arrives; its pupil watches the pointer
    const gr = giant.getBoundingClientRect();
    if (gr.top < innerHeight && gr.bottom > 0) {
      const q = Math.max(0, Math.min(1, (innerHeight - gr.top) / (gr.height + 120))), e = 1 - Math.pow(1 - q, 3);
      const rv = $(".mk-giant .mk-reveal", giant); if (rv) rv.style.strokeDashoffset = reduceMotion() ? "0" : (1 - e).toFixed(4);
      const spin = $(".mk-giant .mk-spin", giant); if (spin && !reduceMotion()) spin.style.transform = `rotate(${((1 - e) * -50).toFixed(2)}deg)`;
      const pu = $(".mk-pupil", giant), svg = $(".mk-giant", giant);
      if (pu && svg && gptr) {
        const b = svg.getBoundingClientRect(), [ex, ey, er] = MG.eye, sc = b.width / 100, ang = (((1 - e) * -50) * Math.PI) / 180;
        const wx = ex * Math.cos(ang) - ey * Math.sin(ang), wy = ex * Math.sin(ang) + ey * Math.cos(ang);
        const dx = gptr[0] - (b.left + (wx + 50) * sc), dy = gptr[1] - (b.top + (wy + 50) * sc), L = Math.hypot(dx, dy) || 1, m = Math.min(er * 0.42, L / 60);
        const lx = (dx / L) * m, ly = (dy / L) * m; // rotate back into the mark's frame
        pu.setAttribute("cx", (ex + lx * Math.cos(-ang) - ly * Math.sin(-ang)).toFixed(2)); pu.setAttribute("cy", (ey + lx * Math.sin(-ang) + ly * Math.cos(-ang)).toFixed(2));
      }
    }
    if (reduceMotion() || y > innerHeight * 1.3) return;
    ptrS[0] += (ptr[0] - ptrS[0]) * 0.1; ptrS[1] += (ptr[1] - ptrS[1]) * 0.1;
    const h = Math.min(1, y / (innerHeight * 0.9));
    depthEls.forEach((el) => { const d = +el.dataset.depth; el.style.transform = `translate3d(${(ptrS[0] * d * -1.4).toFixed(2)}px, ${(ptrS[1] * d * -1.4 + h * d * 5).toFixed(2)}px, 0) scale(${(1 + h * d * 0.011).toFixed(4)})`; el.style.opacity = d > 12 ? (1 - h * 0.8).toFixed(3) : ""; });
    if (Math.abs(ptr[0] - ptrS[0]) > 0.0008 || Math.abs(ptr[1] - ptrS[1]) > 0.0008) kick();
  }
  function tzExtras() {
    const now = new Date();
    $$("[data-tz]").forEach((el) => { const part = new Intl.DateTimeFormat("en-US", { timeZone: el.dataset.tz, timeZoneName: "shortOffset" }).formatToParts(now).find((x) => x.type === "timeZoneName"); el.textContent = part ? part.value : ""; });
    $$("[data-sun]").forEach((el) => { const h = +new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: el.dataset.sun }).format(now); el.innerHTML = icon(h >= 7 && h < 19 ? "sun" : "moon"); });
  }
  tzExtras(); setInterval(tzExtras, 60000);



  /* ───────── Agent: a Claude Code-style terminal agent ───────── */
  const agentEl = $("#agent"), panel = $("#agent-panel"), logEl = $("#agent-log"), input = $("#agent-input"), statusEl = $("#agent-status"), palette = $("#agent-palette"), sendBtn = $("#ab-send");
  const A = { open: false, busy: null, history: JSON.parse(store.get("rv5-hist", "[]")), hIdx: -1, turns: [], always: new Set(), pending: null, banner: false };
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
  $$("[data-agent]").forEach((b) => b.addEventListener("click", () => openAgent()));
  $("#agent-close").addEventListener("click", closeAgent);
  $("#agent-full").addEventListener("click", toggleFull);
  input.addEventListener("focus", () => openAgent());
  function banner() {
    A.banner = true;
    const W = 44, pad = (t) => t + " ".repeat(Math.max(0, W - [...t].length));
    const rows = ["✻ rithvik.ai agent", "  grounded in 23 records + resume", "  /help for commands · esc to interrupt"];
    const box = `╭${"─".repeat(W + 2)}╮\n${rows.map((r) => `│ ${pad(r)} │`).join("\n")}\n╰${"─".repeat(W + 2)}╯`;
    logEl.insertAdjacentHTML("beforeend", `<pre class="agent-banner">${esc(box).replace("✻", '<span class="acc">✻</span>').replace("/help", '<span class="acc">/help</span>')}</pre>
      <p class="t-tips">Try "what has he built?", /resume or /theme comic</p>
      <div class="t-starters">${["What has he built?", "What stack did BoilerFrame use?", "Is he open to internships?", "/theme comic"].map((t) => `<button type="button" class="t-chip" data-q="${esc(t)}">${esc(t)}</button>`).join("")}</div>`);
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
    const el = document.getElementById({ colophon: "play", now: "about" }[target] || target);
    if (el) el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
    if (innerWidth < 640 && !html.classList.contains("agent-full")) closeAgent();
  }

  // Grounded answers (simulated; production streams from /api/chat with the same grammar)
  const SYS_WORDS = { comic: "comic", crt: "crt", terminal: "pane", tui: "pane", pane: "pane", glass: "glass", neon: "neon", synthwave: "neon", paper: "paper", sketch: "paper", brutal: "brutal", lab: "lab", vision: "lab", ledger: "ledger", receipt: "ledger", riso: "riso", risograph: "riso", spectrum: "spectrum", infrared: "spectrum", "night vision": "spectrum", "98": "win98", desktop: "win98", windows: "win98" };
  let lastTopic = null;
  function answer(q) {
    const s = q.toLowerCase();
    if (/(style|theme|design|look|show me|as an?|make it|switch|turn)/.test(s)) {
      const hit = Object.keys(SYS_WORDS).find((w) => s.includes(w));
      if (hit) return { theme: SYS_WORDS[hit], text: `Switched to **${SYS[SYS_WORDS[hit]].name}**. Same content, different materials. Twelve designs and sixteen palettes live in the dial, or press **T** to cycle.` };
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
    if (/(game|play|arcade|typing)/.test(sq)) return { text: "Eight small games live in Play, each scored against his own baseline. Type Racer is a good start.", confirm: { q: "Open Play?", run: () => goTarget("play"), key: "navigate" } };
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
    if (!regen) { A.history = [q, ...A.history.filter((x) => x !== q)].slice(0, 50); store.set("rv5-hist", JSON.stringify(A.history)); }
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
    if (a.theme) steps.push(() => { pickSystem(a.theme, { silent: true }); toolLine("SwitchDesign", a.theme, `Applied ${esc(SYS[a.theme].name)} <button type="button" class="t-key" data-key="undo">u Undo</button>`); });
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
    if (k === "undo") { if (lastState) apply(lastState, { silent: true }); return; }
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
        const id = arg === "random" ? SYSTEMS.filter((s) => s.id !== state.system)[(Math.random() * 11) | 0].id : (SYS[arg] ? arg : SYS_WORDS[arg]);
        if (!id) { out("SwitchDesign", arg, `Unknown design. Try /theme list`); break; }
        pickSystem(id, { silent: true }); out("SwitchDesign", id, `Applied ${esc(SYS[id].name)} <button type="button" class="t-key" data-key="undo">u Undo</button>`); break;
      }
      case "/now": { const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date()); out("LocalTime", "San Francisco", `${t} PT · building rithvik.ai v5`); break; }
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

  /* ───────── Global keys ───────── */
  addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); A.open && document.activeElement === input ? closeAgent() : openAgent(); return; }
    if (e.key === "Escape") {
      if (A.busy) { interrupt(); return; }
      if (!palette.hidden) { palette.hidden = true; return; }
      if (!xp.hidden) { collapse(); return; }
      if (!sheet.hidden) { closeCase(); return; }
      if (!WIN.composer.hidden) { closeComposer(); return; }
      if (!WIN.resume.hidden) { closeWin(WIN.resume); return; }
      if (A.open) { closeAgent(); input.blur(); return; }
    }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); openAgent(); input.value = "/"; renderPalette(); return; }
    if ((e.key === "t" || e.key === "T") && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); state.system === "classic" ? pickSystem(SYSTEMS[0].id) : pickSystem(nextSystem(e.shiftKey ? -1 : 1).id); }
  });

  /* ───────── Windows: resume + composer. Draggable, non-modal, layered over the page ───────── */
  const WIN = { resume: $("#resume-win"), composer: $("#composer-win") };
  function front(w) { Object.values(WIN).forEach((x) => x.classList.toggle("front", x === w)); }
  function openWin(name, opts = {}) {
    const w = WIN[name]; if (!w) return;
    w.hidden = false; front(w);
    if (!w.dataset.placed && innerWidth > 640) {
      // offset sizes ignore the opening scale animation, so placement uses the real size
      const ww = w.offsetWidth, wh = w.offsetHeight;
      const x = name === "resume" ? (innerWidth - ww) / 2 : innerWidth - ww - 32, y = name === "resume" ? (innerHeight - wh) / 2 + 20 : innerHeight - wh - 104;
      w.style.left = Math.max(8, Math.min(innerWidth - ww - 8, x)) + "px"; w.style.top = Math.max(76, Math.min(innerHeight - wh - 8, y)) + "px"; w.dataset.placed = "1";
    }
    if (name === "composer") { if (opts.subj) $("#cmp-subj").value = opts.subj; setTimeout(() => $("#cmp-from").focus(), 40); }
  }
  const closeWin = (w) => { if (w) w.hidden = true; };
  const openComposer = (subj) => openWin("composer", { subj });
  const closeComposer = () => closeWin(WIN.composer);
  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]"); if (o) { e.preventDefault(); openWin(o.dataset.open); }
    const c = e.target.closest("[data-close-win]"); if (c) closeWin(c.closest(".win"));
  });
  Object.values(WIN).forEach((w) => {
    w.addEventListener("pointerdown", () => front(w));
    const bar = $("[data-drag]", w); let d = null;
    bar.addEventListener("pointerdown", (e) => { if (e.target.closest("button") || innerWidth <= 640) return; d = [e.clientX - w.offsetLeft, e.clientY - w.offsetTop]; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener("pointermove", (e) => { if (!d) return; w.style.left = Math.max(80 - w.offsetWidth, Math.min(innerWidth - 80, e.clientX - d[0])) + "px"; w.style.top = Math.max(8, Math.min(innerHeight - 48, e.clientY - d[1])) + "px"; });
    const up = () => { d = null; }; bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
  });
  $("#faq-ask").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#faq-q").value.trim(); if (!q) return; $("#faq-q").value = ""; submit(q); });

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
    <h2>Experience</h2>${EXPERIENCE.map((x) => `<div class="pr"><span>${esc(x.org)}</span><span>${esc(x.where)}</span></div><div class="pi"><span>${esc(x.role)}</span><span>${esc(x.when)}</span></div><ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`).join("")}
    <h2>Projects</h2>${PROJECTS.slice(0, 4).map((p) => `<div class="pr"><span>${esc(p.title)}</span><span>${esc(p.tags.slice(0, 4).join(", "))}</span></div><ul><li>${esc(p.desc[0])}</li></ul>`).join("")}
    <h2>Skills</h2><p><b>Languages:</b> ${STACK.Languages.join(", ")} · <b>Frameworks:</b> ${STACK.Frameworks.join(", ")}</p>`;
  $("#rs-sync").addEventListener("click", () => toast("<span>Pulled the latest PDF from Google Docs</span>"));
  $("#rs-upload").addEventListener("click", () => toast("<span>Upload a PDF to override the synced copy until the next sync</span>"));
  $("#mb-admin").addEventListener("click", () => { const on = html.classList.toggle("admin"); $("#mb-admin").setAttribute("aria-pressed", String(on)); toast(on ? "<span><b>Admin</b>: the resume gains Sync now and Upload override. In production, edit mode also opens the agent's /embed and /docs commands.</span>" : "<span>Admin off</span>"); });
  $("#buffett-link").addEventListener("click", (e) => { e.preventDefault(); toast("<span>On the live site this opens <b>/buffett</b>, the plain-HTML edition</span>"); });

  /* ───────── Entrance, refraction, boot ───────── */
  function entrance() {
    if (reduceMotion()) { drawHighlight(); return; }
    html.classList.add("entering"); drawOn($(".brand .mark-slot")); drawOn($(".ft-giant .mark-slot"));
    setTimeout(() => { html.classList.remove("entering"); }, 1300);
    setTimeout(drawHighlight, 700);
  }
  $("#mb-replay").addEventListener("click", () => { scrollTo({ top: 0 }); ph.classList.remove("on"); requestAnimationFrame(entrance); });
  if (/Chrom(e|ium)\//.test(navigator.userAgent) && CSS.supports("backdrop-filter", "url(#lg-refract)")) {
    const N = 128, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d"), map = x.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const u = ((i + 0.5) / N) * 2 - 1, v = ((j + 0.5) / N) * 2 - 1, edge = 1 - Math.max(Math.abs(u), Math.abs(v)), m = Math.pow(Math.max(0, 1 - edge / 0.22), 2), k = (i + j * N) * 4; map.data[k] = 128 - u * 127 * m; map.data[k + 1] = 128 - v * 127 * m; map.data[k + 2] = 128; map.data[k + 3] = 255; }
    x.putImageData(map, 0, 0); $("#lg-map").setAttribute("href", c.toDataURL()); html.classList.add("refract");
  }
  onChange(() => {
    if (isCrt()) { sizeRain(); const go = () => requestAnimationFrame(() => { buildFiglet(); buildPortrait(); }); document.fonts?.load?.('12px "JetBrains Mono"').then(go, go) || go(); }
    measureChars();
    requestAnimationFrame(() => { if (ph.classList.contains("on")) drawHighlight(); });
  });
  addEventListener("resize", () => { if (isCrt()) { sizeRain(); buildFiglet(); buildPortrait(); } if (ph.classList.contains("on")) drawHighlight(); });
  hydrate();
  if (state.system !== "classic") ensureFonts(state.system);
  commit();
  openFromHash(); setFavicon(); onChange(setFavicon); kick();
  document.fonts?.ready?.then(() => { measureChars(); if (isCrt()) buildFiglet(); });
  entrance();
})();