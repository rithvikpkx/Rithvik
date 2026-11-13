/* rithvik.ai v3 mockup: behaviour.
   Simulates the finished site: design-system engine, dial, discovery patterns, kinetic + ASCII name,
   canvases (globe, torus, rain, ouroboros), Arcade games, chat assistant, resume/Buffett/admin modals. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches || html.classList.contains("lite");
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  /* Smooth scroll: Lenis by darkroom.engineering (pinned 1.3.26); native scrolling under reduced motion */
  let lenis = null;
  if (window.Lenis && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    lenis = new window.Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: -88 }, allowNestedScroll: true });
  }
  /** Scroll to an element through Lenis when it is running, natively otherwise. */
  function scrollToEl(el, block = "start") {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: block === "center" ? -Math.max(0, (innerHeight - el.offsetHeight) / 2) : -88, duration: 1.1 });
    else el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block });
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ───────────────────────── Line icons (lucide paths, 1.5 stroke) for the unslopped version ───────────────────────── */
  const AS = window.ASSETS || { icons: {}, logos: {}, land: [], spinners: {}, banner: null, commits: [] };
  const ICONS = Object.assign({}, AS.icons, { gamepad: AS.icons["gamepad-2"], angle: AS.icons["drafting-compass"] });
  /** Real brand mark from Simple Icons (or Bootstrap Icons for LinkedIn), coloured via --brand. */
  const logo = (slug) => {
    const L = AS.logos[slug]; if (!L) return "";
    return L.svg16 ? `<svg class="logo" viewBox="0 0 16 16" fill="currentColor" style="--brand:#${L.hex}" aria-hidden="true">${L.svg16}</svg>`
      : `<svg class="logo" viewBox="0 0 24 24" fill="currentColor" style="--brand:#${L.hex}" aria-hidden="true"><path d="${L.d}"/></svg>`;
  };
  const TOOL_LOGO = { Python: "python", JavaScript: "javascript", TypeScript: "typescript", "C++": "cplusplus", React: "react", "Next.js": "nextdotjs", "Node.js": "nodedotjs", Express: "express", TensorFlow: "tensorflow", Keras: "keras", "scikit-learn": "scikitlearn", Pandas: "pandas", MongoDB: "mongodb", Supabase: "supabase", Vercel: "vercel", Cloudflare: "cloudflare", "Google Apps Script": "googleappsscript", Arduino: "arduino", Ollama: "ollama" };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
  const dual = (o, u) => `<span class="v-orig">${o}</span><span class="v-un">${u}</span>`;
  const hydrateIcons = (root = document) => $$("[data-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });
  const unslopped = () => html.classList.contains("unslop");

  /* ───────────────────────── Design systems + palettes ───────────────────────── */
  const GF = "https://fonts.googleapis.com/css2?";
  const SYSTEMS = [
    { id: "glass", name: "Liquid Glass", tag: "sleek", fonts: null, sw: { bg: "linear-gradient(135deg,#3b2a8f,#c2418f 60%,#ff9a52)", fg: "#fff", font: '-apple-system,"SF Pro Display","Geist",sans-serif', w: 600 } },
    { id: "comic", name: "Comic Pop", tag: "loud", fonts: "family=Bangers&family=Geist:wght@400;600;700", sw: { bg: "#ffd93d", fg: "#111", font: '"Bangers",Impact,sans-serif', w: 400, ls: ".06em", fs: 15, border: "2px solid #111", shadow: "3px 3px 0 #ff6b6b" } },
    { id: "brutal", name: "Neo-Brutalist", tag: "loud", fonts: "family=Archivo+Black&family=Archivo:wdth,wght@62..125,100..900", sw: { bg: "#c6ff00", fg: "#0a0a0a", font: '"Archivo Black",sans-serif', w: 400, tt: "uppercase", fs: 11, border: "2px solid #000", shadow: "3px 3px 0 #000", r: "0" } },
    { id: "tide", name: "Tide Pool", tag: "loud", fonts: "family=Luckiest+Guy&family=Archivo:wdth,wght@62..125,100..900", sw: { bg: "linear-gradient(180deg,#5fd3ff,#1fb6ff)", fg: "#ffd23f", font: '"Luckiest Guy",sans-serif', w: 400, ls: ".04em", border: "2px solid #062a4d", stroke: true } },
    { id: "clay", name: "Claymation", tag: "soft", fonts: "family=Fredoka:wdth,wght@75..125,300..700", sw: { bg: "#ffe5d9", fg: "#4a3f55", font: '"Fredoka",sans-serif', w: 600, shadow: "inset -2px -2px 4px rgba(0,0,0,.15), inset 2px 2px 4px rgba(255,255,255,.7)" } },
    { id: "ascii", name: "ASCII Terminal", tag: "retro", fonts: "family=VT323&family=JetBrains+Mono:wght@100..800", sw: { bg: "#050505", fg: "#33ff00", font: '"VT323",monospace', w: 400, fs: 17, r: "0", border: "1px solid #33ff00" } },
    { id: "win98", name: "Desktop 98", tag: "retro", fonts: "family=VT323", sw: { bg: "#c0c0c0", fg: "#000", font: 'Tahoma,Verdana,sans-serif', w: 700, fs: 12, r: "0", shadow: "inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080, inset 2px 2px #dfdfdf" } },
    { id: "neon", name: "Neon Arcade", tag: "retro", fonts: "family=Audiowide&family=Chakra+Petch:wght@400;600;700", sw: { bg: "linear-gradient(180deg,#2b0b3f,#0a0418)", fg: "#9ff3ff", font: '"Audiowide",sans-serif', w: 400, fs: 12, shadow: "0 0 10px rgba(255,60,172,.6)", border: "1px solid #ff3cac" } },
    { id: "pixel", name: "Pixel Retro", tag: "retro", fonts: "family=Press+Start+2P&family=Pixelify+Sans:wght@400..700", sw: { bg: "#29adff", fg: "#fff1e8", font: '"Press Start 2P",monospace', w: 400, fs: 8.5, r: "0", shadow: "0 3px 0 #1d2b53" } },
    { id: "paper", name: "Paper Sketch", tag: "story", fonts: "family=Caveat:wght@400..700&family=Kalam:wght@400;700", sw: { bg: "#fbf8ef", fg: "#1f2a44", font: '"Caveat",cursive', w: 700, fs: 19, border: "1.5px solid #1f2a44", r: "255px 15px 225px 15px/15px 225px 15px 255px" } },
    { id: "sakura", name: "Sakura", tag: "calm", fonts: "family=Shippori+Mincho:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500", sw: { bg: "#f6f1e7", fg: "#1d1d1f", font: '"Shippori Mincho",serif', w: 600, ls: ".08em", border: "1px solid #c8102e" } },
    { id: "blueprint", name: "Blueprint", tag: "calm", fonts: "family=Share+Tech+Mono&family=Architects+Daughter", sw: { bg: "#174a8b", fg: "#eaf2ff", font: '"Share Tech Mono",monospace', w: 400, tt: "uppercase", ls: ".06em", fs: 12, r: "0", border: "1px solid #eaf2ff" } },
  ];
  const SYS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
  const PICKER_FONTS = GF + "family=Bangers&family=Archivo+Black&family=Luckiest+Guy&family=Fredoka:wght@600&family=VT323&family=Audiowide&family=Press+Start+2P&family=Caveat:wght@700&family=Shippori+Mincho:wght@600&family=Share+Tech+Mono&display=swap&text=" + encodeURIComponent("LiquidGlassComicPopNeo-BrutalistTidePoolClaymationASCIITerminalDesktop98NeonArcadePixelRetroPaperSketchSakuraBlueprint ");

  const PALETTES = [
    { slug: "github-light", name: "GitHub Light", t: ["#ffffff", "#f6f8fa", "#1f2328", "#656d76", "#0969da", "#1a7f37"], pair: "github-dark" },
    { slug: "rithvik-light", name: "Rithvik Light", t: ["#fafaf7", "#f3f1ed", "#0e0b0a", "#6a655f", "#c2305e", "#16a34a"], pair: "rithvik-dark" },
    { slug: "high-contrast-light", name: "High Contrast Light", t: ["#ffffff", "#f0f0f0", "#000000", "#545454", "#0f4a85", "#0a7d00"], pair: "high-contrast-dark" },
    { slug: "rithvik-dark", name: "Rithvik Dark", t: ["#08080e", "#0d0d16", "#eeeef6", "#9a9ab2", "#e04a78", "#4ade80"], pair: "rithvik-light", dark: 1 },
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

  // Inject classic palette rules (mirrors ThemeStyleInjector: one rule per DB row).
  (function injectPalettes() {
    const css = PALETTES.map((p) => {
      const [bg, soft, fg, muted, acc, ok] = p.t;
      return `:root[data-system="classic"][data-palette="${p.slug}"]{--bg:${bg};--bg-soft:${soft};--fg:${fg};--muted:${muted};--accent:${acc};--ok:${ok};--accent-fg:${p.dark ? bg : "#fff"};--accent-2:${ok};${p.dark ? "--shadow:0 1px 2px rgba(0,0,0,.3),0 12px 34px -18px rgba(0,0,0,.7);--shadow-hover:0 1px 2px rgba(0,0,0,.3),0 20px 44px -20px rgba(0,0,0,.8);--panel:color-mix(in srgb,var(--fg) 4.5%,var(--bg));" : ""}${p.mono ? '--font-d:"Geist Mono",monospace;--font-b:"Geist Mono",monospace;--d-track:-.02em;' : ""}}`;
    }).join("\n");
    const el = document.createElement("style");
    el.id = "palette-tokens";
    el.textContent = css;
    document.head.appendChild(el);
  })();

  /* ───────────────────────── State + switching ───────────────────────── */
  const state = {
    system: SYS[html.dataset.system] ? html.dataset.system : "classic",
    palette: PAL[html.dataset.palette] ? html.dataset.palette : "github-light",
    mode: html.dataset.mode === "dark" ? "dark" : "light",
  };
  let lastState = null;
  const listeners = [];
  const onChange = (fn) => listeners.push(fn);

  function ensureFonts(id) {
    const s = SYS[id];
    if (!s || !s.fonts || document.head.querySelector(`link[data-font="${id}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = GF + s.fonts + "&display=swap";
    l.dataset.font = id;
    document.head.appendChild(l);
  }
  function currentName() { return state.system === "classic" ? PAL[state.palette].name : SYS[state.system].name; }

  function commit() {
    html.dataset.system = state.system;
    html.dataset.palette = state.palette;
    html.dataset.mode = state.mode;
    store.set("rv-system", state.system);
    store.set("rv-palette", state.palette);
    store.set("rv-mode", state.mode);
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  }

  /** Apply a design/palette, with a circle reveal for design-system switches (instant for palettes). */
  function apply(next, from, opts = {}) {
    const prev = { ...state };
    const changedSystem = (next.system ?? state.system) !== state.system;
    Object.assign(state, next);
    if (state.system !== "classic") ensureFonts(state.system);
    if (prev.system === state.system && prev.palette === state.palette && prev.mode === state.mode) return;
    lastState = prev;
    const run = () => commit();
    if (changedSystem && document.startViewTransition && !reduceMotion()) {
      const x = from?.x ?? innerWidth / 2, y = from?.y ?? innerHeight / 2;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const t = document.startViewTransition(run);
      t.ready.then(() => html.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 560, easing: "cubic-bezier(.22,1,.36,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
    } else run();
    if (!opts.silent) switchToast();
  }
  const pickSystem = (id, from, opts) => apply({ system: id }, from, opts);
  const pickPalette = (slug, from, opts) => apply({ system: "classic", palette: slug, mode: PAL[slug].dark ? "dark" : "light" }, from, opts);
  function randomSystem(from) {
    const pool = SYSTEMS.filter((s) => s.id !== state.system);
    pickSystem(pool[(Math.random() * pool.length) | 0].id, from);
  }
  function nextSystem(dir = 1) {
    const i = SYSTEMS.findIndex((s) => s.id === state.system);
    return SYSTEMS[(i + dir + SYSTEMS.length) % SYSTEMS.length];
  }
  function toggleMode() {
    if (state.system === "classic") {
      const pair = PAL[state.palette].pair;
      if (pair) pickPalette(pair, null, { silent: true });
      return;
    }
    apply({ mode: state.mode === "dark" ? "light" : "dark" }, null, { silent: true });
  }

  /* ───────────────────────── Toast (discovery D) ───────────────────────── */
  const toastEl = $("#toast");
  let toastT = 0;
  function toast(htmlStr, actions = [], ms = 4200) {
    toastEl.innerHTML = htmlStr;
    actions.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = a.label;
      if (a.primary) b.className = "primary";
      b.addEventListener("click", () => { a.run(); hideToast(); });
      toastEl.appendChild(b);
    });
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(hideToast, ms);
  }
  function hideToast() { toastEl.hidden = true; }
  function switchToast() {
    const nx = state.system === "classic" ? SYSTEMS[0] : nextSystem(1);
    const prev = lastState;
    toast(`<span>Now viewing <b>${esc(currentName())}</b></span>`, [
      { label: "Undo", run: () => prev && apply(prev, null, { silent: true }) },
      { label: `Next: ${nx.name} →`, primary: true, run: () => pickSystem(nx.id) },
    ]);
  }

  /* ───────────────────────── Dial ───────────────────────── */
  const dial = $("#dial"), fan = $("#dial-fan"), groupLabel = $("#dial-group");
  const ITEMS = [
    ...SYSTEMS.map((s) => ({ kind: "system", id: s.id, name: s.name, s })),
    { kind: "divider", name: "Palettes" },
    ...PALETTES.map((p) => ({ kind: "palette", id: p.slug, name: p.name, p })),
    { kind: "buffett", id: "buffett", name: "Berkshire '99" },
  ];
  let focusIdx = 0;
  const pillEls = ITEMS.map((it, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pill" + (it.kind === "divider" ? " divider" : "");
    b.innerHTML = `<span class="pn">${esc(it.name)}</span>`;
    if (it.kind === "divider") { b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); return b; }
    b.setAttribute("role", "radio");
    b.tabIndex = -1;
    if (it.kind === "system") {
      const w = it.s.sw;
      Object.assign(b.style, { background: w.bg, color: w.fg, fontFamily: w.font, fontWeight: w.w, letterSpacing: w.ls || "0", textTransform: w.tt || "none", fontSize: (w.fs || 14) + "px", borderRadius: w.r ?? "999px", border: w.border || "", boxShadow: w.shadow || "" });
      if (w.stroke) b.style.webkitTextStroke = "1px #062a4d";
      b.insertAdjacentHTML("beforeend", `<span class="pk" style="font-family:-apple-system,Geist,sans-serif;letter-spacing:.08em;text-transform:uppercase;-webkit-text-stroke:0">${it.s.tag}</span>`);
      b.setAttribute("aria-label", `Switch to the ${it.name} design`);
    } else if (it.kind === "palette") {
      Object.assign(b.style, { background: it.p.t[0], color: it.p.t[2], fontFamily: '"Geist Mono",ui-monospace,monospace', fontSize: "12px", fontWeight: 600 });
      b.insertAdjacentHTML("beforeend", `<span class="pk" style="display:flex;gap:3px"><i style="width:6px;height:6px;border-radius:50%;background:${it.p.t[0]};box-shadow:inset 0 0 0 1px ${it.p.t[2]}"></i><i style="width:6px;height:6px;border-radius:50%;background:${it.p.t[4]}"></i><i style="width:6px;height:6px;border-radius:50%;background:${it.p.t[2]}"></i></span>`);
      b.setAttribute("aria-label", `Switch to the ${it.name} palette`);
    } else {
      Object.assign(b.style, { background: "#fff", color: "#00e", fontFamily: '"Times New Roman",Times,serif', fontSize: "14px", borderRadius: "0", border: "1px solid #999" });
      b.insertAdjacentHTML("beforeend", `<span class="pk" style="font-family:-apple-system,Geist,sans-serif;color:#555">plain html</span>`);
      b.setAttribute("aria-label", "Open the Warren Buffett edition, plain HTML");
    }
    b.addEventListener("click", (e) => { focusIdx = i; activate(it, { x: e.clientX, y: e.clientY }); });
    return b;
  });
  pillEls.forEach((b) => fan.appendChild(b));
  function activeIdx() {
    return ITEMS.findIndex((it) => (state.system === "classic" ? it.kind === "palette" && it.id === state.palette : it.kind === "system" && it.id === state.system));
  }
  function activate(it, from) {
    if (it.kind === "system") pickSystem(it.id, from);
    else if (it.kind === "palette") pickPalette(it.id, from);
    else if (it.kind === "buffett") openModal("buffett");
  }
  function layoutFan() {
    const STEP = 15, SPACING = 44;
    pillEls.forEach((b, i) => {
      const d = i - focusIdx;
      b.style.transform = `translate(0, calc(-50% + ${d * SPACING}px)) rotate(${d * STEP}deg)`;
      b.style.opacity = Math.abs(d) > 3 ? "0" : String(1 - Math.abs(d) * 0.16);
      b.style.pointerEvents = Math.abs(d) > 3 ? "none" : "";
      const act = i === activeIdx();
      b.classList.toggle("is-active", act);
      if (ITEMS[i].kind !== "divider") b.setAttribute("aria-checked", String(act));
      b.tabIndex = i === focusIdx ? 0 : -1;
    });
    const it = ITEMS[focusIdx];
    const sysCount = SYSTEMS.length, palCount = PALETTES.length;
    groupLabel.innerHTML = it.kind === "system" ? `<b>Designs</b> · ${sysCount}` : it.kind === "buffett" ? `<b>Plain HTML</b>` : `<b>Palettes</b> · ${palCount}`;
    $("#dt-mode-ic").innerHTML = state.mode === "dark" ? dual("☀", icon("sun")) : dual("☾", icon("moon"));
    $("#dt-mode").disabled = state.system === "classic" && !PAL[state.palette].pair;
  }
  function moveFocus(dir) {
    let i = focusIdx + dir;
    if (ITEMS[i] && ITEMS[i].kind === "divider") i += dir;
    focusIdx = Math.max(0, Math.min(ITEMS.length - 1, i));
    layoutFan();
  }
  dial.addEventListener("wheel", (e) => {
    if (!dial.matches(":hover") && !dial.classList.contains("is-open")) return;
    e.preventDefault();
    moveFocus(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  fan.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); moveFocus(1); pillEls[focusIdx].focus(); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); moveFocus(-1); pillEls[focusIdx].focus(); }
    if (e.key === "Escape") { dial.classList.remove("is-open"); pillEls[focusIdx].blur(); }
  });
  let dragY = null;
  fan.addEventListener("pointerdown", (e) => { dragY = e.clientY; });
  addEventListener("pointermove", (e) => {
    if (dragY === null) return;
    const dy = e.clientY - dragY;
    if (Math.abs(dy) > 30) { moveFocus(dy > 0 ? -1 : 1); dragY = e.clientY; }
  });
  addEventListener("pointerup", () => { dragY = null; });
  $("#dial-shell").addEventListener("click", (e) => {
    if (!matchMedia("(hover: hover)").matches && !dial.classList.contains("is-open")) { dial.classList.add("is-open"); e.stopPropagation(); }
  });
  document.addEventListener("click", (e) => { if (!dial.contains(e.target)) dial.classList.remove("is-open"); });
  dial.addEventListener("mouseenter", () => { ensurePickerFonts(); dial.classList.remove("wiggle", "glow"); });
  let pickerFontsLoaded = false;
  function ensurePickerFonts() {
    if (pickerFontsLoaded) return; pickerFontsLoaded = true;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = PICKER_FONTS; document.head.appendChild(l);
  }
  $("#dt-mode").addEventListener("click", toggleMode);
  $("#dt-dice").addEventListener("click", (e) => randomSystem({ x: e.clientX, y: e.clientY }));
  $("#dt-lite").addEventListener("click", () => {
    const on = !html.classList.contains("lite");
    html.classList.toggle("lite", on);
    $("#dt-lite").setAttribute("aria-pressed", String(on));
    store.set("rv-lite", on ? "1" : "0");
    toast(on ? "<span><b>Reduced effects</b>: ambient motion and blur are off.</span>" : "<span>Effects back on.</span>");
    listeners.forEach((fn) => fn());
  });
  $("#dt-lite").setAttribute("aria-pressed", String(html.classList.contains("lite")));
  onChange(() => { focusIdx = Math.max(0, activeIdx()); layoutFan(); });

  /* ───────────────────────── Discovery B/C/A + T shortcut ───────────────────────── */
  const TRY_SETS = [["comic", "ascii", "glass"], ["brutal", "neon", "paper"], ["pixel", "sakura", "win98"], ["tide", "clay", "blueprint"]];
  let tryIdx = 0;
  function renderTry() {
    const set = TRY_SETS[tryIdx % TRY_SETS.length].filter((id) => id !== state.system);
    $("#sc-try").innerHTML = "Try " + set.slice(0, 2).map((id) => `<button type="button" data-sys="${id}">${esc(SYS[id].name)}</button>`).join("");
    $("#sc-name").textContent = currentName();
    $("#nd-name").textContent = currentName();
  }
  $("#sc-try").addEventListener("click", (e) => { const b = e.target.closest("[data-sys]"); if (b) pickSystem(b.dataset.sys, { x: e.clientX, y: e.clientY }); });
  $("#sc-dice").addEventListener("click", (e) => randomSystem({ x: e.clientX, y: e.clientY }));
  setInterval(() => { if (!document.hidden) { tryIdx++; renderTry(); } }, 6000);
  onChange(renderTry);

  const ways = $("#ways");
  ways.innerHTML = SYSTEMS.map((s) => `<button type="button" class="mini" role="listitem" data-system="${s.id}" data-pick="${s.id}" aria-label="Restyle the site as ${esc(s.name)}"><span class="mini-name">${esc(s.name)}</span><span class="mini-row"><span class="mini-card"></span><span class="mini-btn">Go</span></span></button>`).join("");
  ways.addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) pickSystem(b.dataset.pick, { x: e.clientX, y: e.clientY }); });
  ways.addEventListener("pointerenter", () => SYSTEMS.forEach((s) => ensureFonts(s.id)), { once: true });
  // Load preview fonts lazily when the strip scrolls into view.
  new IntersectionObserver((en, io) => { if (en[0].isIntersecting) { SYSTEMS.forEach((s) => ensureFonts(s.id)); io.disconnect(); } }).observe(ways);
  onChange(() => $$(".mini", ways).forEach((m) => m.setAttribute("aria-current", String(m.dataset.pick === state.system))));

  const coach = $("#coach");
  function showCoach() {
    coach.hidden = false;
    dial.classList.add("wiggle", "glow");
    setTimeout(() => dial.classList.remove("wiggle"), 2000);
  }
  function hideCoach() { coach.hidden = true; dial.classList.remove("glow"); store.set("rv-coach", "1"); }
  $("#coach-x").addEventListener("click", hideCoach);
  $("#coach-try").addEventListener("click", (e) => { hideCoach(); randomSystem({ x: e.clientX, y: e.clientY }); });
  if (!store.get("rv-coach")) setTimeout(showCoach, 2200);
  $("#mb-coach").addEventListener("click", () => { store.del("rv-coach"); lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(showCoach, 500); });

  addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing) return;
    if ((e.key === "t" || e.key === "T") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (state.system === "classic") pickSystem(SYSTEMS[0].id);
      else pickSystem(nextSystem(e.shiftKey ? -1 : 1).id);
    }
    if (e.key === "/") { e.preventDefault(); chatInput.focus(); }
  });

  /* ───────────────────────── Kinetic name ───────────────────────── */
  const kinetic = $(".kinetic");
  $$(".k-line", kinetic).forEach((line) => {
    line.innerHTML = [...line.dataset.text].map((c) => c === " " ? '<span class="ch sp" aria-hidden="true"> </span>' : `<span class="ch" aria-hidden="true">${esc(c)}</span>`).join("");
  });
  const chars = $$(".ch", kinetic);
  let centers = [], kRaf = 0, kPt = null;
  function measureChars() { centers = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); }
  function kFrame() {
    kRaf = 0;
    if (!kPt) { chars.forEach((c) => c.style.setProperty("--k", "0")); return; }
    const R = 160;
    chars.forEach((c, i) => {
      const [cx, cy] = centers[i] || [0, 0];
      const d = Math.hypot(kPt[0] - cx, (kPt[1] - cy) * 1.4);
      const k = Math.max(0, 1 - d / R);
      c.style.setProperty("--k", (k * k * (3 - 2 * k)).toFixed(3));
    });
  }
  kinetic.addEventListener("pointerenter", measureChars);
  kinetic.addEventListener("pointermove", (e) => { kPt = [e.clientX, e.clientY]; if (!kRaf) kRaf = requestAnimationFrame(kFrame); });
  kinetic.addEventListener("pointerleave", () => { kPt = null; if (!kRaf) kRaf = requestAnimationFrame(kFrame); });
  addEventListener("scroll", () => { if (kPt) measureChars(); }, { passive: true });

  /* ───────────────────────── Shared helpers: tokens, visibility-gated loops ───────────────────────── */
  function token(name, el = html) { return getComputedStyle(el).getPropertyValue(name).trim(); }
  const probe = document.createElement("canvas").getContext("2d");
  function rgb(color) { probe.fillStyle = "#000"; probe.fillStyle = color || "#000"; probe.fillRect(0, 0, 1, 1); const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; }
  function cssColor(name, alpha = 1) { const [r, g, b, a] = rgb(token(name)); return `rgba(${r},${g},${b},${a * alpha})`; }
  probe.canvas.width = probe.canvas.height = 1;

  /** Run `draw` at `fps` only while `el` is on-screen, the tab is visible and `enabled()` holds. */
  function loop(el, fps, draw, enabled = () => true) {
    let visible = false, timer = 0, last = 0;
    const tick = (t) => {
      timer = 0;
      if (!running()) return;
      if (t - last >= 1000 / fps) { last = t; draw(t); }
      timer = requestAnimationFrame(tick);
    };
    const running = () => visible && !document.hidden && enabled() && !reduceMotion();
    const sync = () => { if (running() && !timer) timer = requestAnimationFrame(tick); if (!running()) draw(performance.now(), true); };
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; sync(); }, { rootMargin: "80px" }).observe(el);
    document.addEventListener("visibilitychange", sync);
    onChange(sync);
    return sync;
  }
  const isAscii = () => state.system === "ascii";

  /* ───────────────────────── ASCII renderers ───────────────────────── */
  const RAMP = " .:-=+*#%@";
  const SCRAMBLE = "!<>-_\\/[]{}=+*^?#$%&@01";
  function charBox(pre) {
    const cs = getComputedStyle(pre);
    probe.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = probe.measureText("M").width || parseFloat(cs.fontSize) * 0.6;
    const h = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize);
    return { w, h };
  }
  /** Rasterise text into a luminance grid of cols×rows. */
  function textGrid(text, cols, aspect) {
    const c = document.createElement("canvas");
    const fs = 120;
    const g = c.getContext("2d");
    g.font = `900 ${fs}px Geist, Arial Black, sans-serif`;
    const tw = Math.ceil(g.measureText(text).width) + 8;
    c.width = tw; c.height = Math.ceil(fs * 1.05);
    g.font = `900 ${fs}px Geist, Arial Black, sans-serif`;
    g.fillStyle = "#fff"; g.textBaseline = "middle";
    g.fillText(text, 4, c.height / 2 + fs * 0.04);
    const rows = Math.max(3, Math.round((cols * c.height / tw) / aspect));
    const sc = document.createElement("canvas"); sc.width = cols; sc.height = rows;
    const sg = sc.getContext("2d");
    sg.drawImage(c, 0, 0, cols, rows);
    const d = sg.getImageData(0, 0, cols, rows).data;
    const out = [];
    for (let y = 0; y < rows; y++) { const row = []; for (let x = 0; x < cols; x++) row.push(d[(y * cols + x) * 4] / 255); out.push(row); }
    return out;
  }
  // Name banner with scramble-on-hover (the asciified kinetic text).
  const asciiName = $("#ascii-name");
  let nameGrids = null, namePt = null, nameRaf = 0;
  let figLines = null;
  /** Lay out the real FIGlet (ANSI Shadow) banner, scaling the font so the widest line fits. */
  function buildFiglet() {
    const B = AS.banner, avail = asciiName.clientWidth || 600;
    const widest = (set) => Math.max(...set.flat().map((l) => l.length));
    const set = avail / widest(B.wide) >= 4.6 ? B.wide : B.narrow;
    const fs = Math.min(12, Math.max(4, avail / widest(set) / 0.62));
    asciiName.style.fontSize = fs.toFixed(2) + "px"; asciiName.style.lineHeight = "1.02";
    figLines = []; set.forEach((g, i) => { figLines.push(...g); if (i < set.length - 1) figLines.push(""); });
    drawFiglet();
  }
  /** Draw the banner; cells near the pointer flicker through shade blocks (the asciified kinetic hover). */
  function drawFiglet() {
    nameRaf = 0;
    const { w, h } = charBox(asciiName), rect = asciiName.getBoundingClientRect(), GL = "\u2588\u2593\u2592\u2591";
    asciiName.textContent = figLines.map((row, ry) => [...row].map((c, rx) => {
      if (c === " " || !namePt) return c;
      const k = Math.max(0, 1 - Math.hypot(namePt[0] - (rect.left + rx * w), (namePt[1] - (rect.top + ry * h)) * 1.6) / 80);
      return k > 0.2 && Math.random() < k ? GL[(Math.random() * GL.length) | 0] : c;
    }).join("")).join("\n");
    if (namePt) nameRaf = setTimeout(() => requestAnimationFrame(drawFiglet), 60);
  }
  function buildName() {
    if (!isAscii()) return;
    if (unslopped() && AS.banner) return buildFiglet();
    figLines = null; asciiName.style.fontSize = ""; asciiName.style.lineHeight = "";
    const { w, h } = charBox(asciiName);
    const cols = Math.max(40, Math.min(150, Math.floor(asciiName.clientWidth / w)));
    nameGrids = ["Rithvik", "Praveen Kumar"].map((t) => textGrid(t, Math.round(cols * (t.length / 13) * 1.02), h / w));
    drawName();
  }
  function drawName() {
    if (unslopped() && figLines) return drawFiglet();
    nameRaf = 0;
    if (!nameGrids) return;
    const { w, h } = charBox(asciiName);
    const rect = asciiName.getBoundingClientRect();
    let y0 = 0, lines = [];
    nameGrids.forEach((g, gi) => {
      g.forEach((row, ry) => {
        let s = "";
        row.forEach((v, rx) => {
          let k = 0;
          if (namePt) {
            const px = rect.left + rx * w, py = rect.top + (y0 + ry) * h;
            k = Math.max(0, 1 - Math.hypot(namePt[0] - px, (namePt[1] - py) * 1.6) / 90);
          }
          if (v < 0.08 && k < 0.6) { s += " "; return; }
          if (k > 0.25 && Math.random() < k) { s += SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0]; return; }
          const lv = Math.min(1, v + k * 0.6);
          s += RAMP[Math.min(RAMP.length - 1, Math.round(lv * (RAMP.length - 1)))];
        });
        lines.push(s.replace(/\s+$/, ""));
      });
      y0 += g.length;
      if (gi === 0) { lines.push(""); y0 += 1; }
    });
    asciiName.textContent = lines.join("\n");
    if (namePt) nameRaf = setTimeout(() => requestAnimationFrame(drawName), 50);
  }
  asciiName.addEventListener("pointermove", (e) => { namePt = [e.clientX, e.clientY]; if (!nameRaf) drawName(); });
  asciiName.addEventListener("pointerleave", () => { namePt = null; clearTimeout(nameRaf); nameRaf = 0; drawName(); });
  asciiName.setAttribute("aria-hidden", "true");

  // Portrait rebuilt from characters.
  const portraitImg = $("#portrait-img"), asciiPortrait = $("#ascii-portrait");
  function buildPortrait() {
    if (!isAscii() || !portraitImg.complete) return;
    const { w, h } = charBox(asciiPortrait);
    const size = asciiPortrait.clientWidth || 220;
    const cols = Math.max(24, Math.min(70, Math.floor(size / w)));
    const rows = Math.round(cols * (w / h));
    const c = document.createElement("canvas"); c.width = cols; c.height = rows;
    const g = c.getContext("2d");
    try {
      g.drawImage(portraitImg, 0, 0, cols, rows);
      const d = g.getImageData(0, 0, cols, rows).data;
      let out = "";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const dx = (x - cols / 2) / (cols / 2), dy = (y - rows / 2) / (rows / 2);
          if (dx * dx + dy * dy > 1) { out += " "; continue; }
          const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
          // White studio backdrop becomes empty space; darker areas (hair, suit, features) get denser glyphs.
          if (L > 0.86) { out += " "; continue; }
          const v = Math.min(1, Math.pow((0.9 - L) / 0.9, 0.8) * 1.15);
          out += RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))];
        }
        out += "\n";
      }
      asciiPortrait.textContent = out;
    } catch (e) { asciiPortrait.textContent = ""; }
  }
  portraitImg.addEventListener("load", buildPortrait);

  // ASCII ouroboros: a ring of scales chasing its own tail.
  const asciiOuro = $("#ascii-ouro");
  let ouroPhase = 0;
  function drawOuro() {
    const cols = 46, rows = 23, cx = cols / 2, cy = rows / 2, rx = 21, ry = 10.6;
    const grid = Array.from({ length: rows }, () => Array(cols).fill(" "));
    const N = 120, SCALES = "oO0Oo";
    for (let i = 0; i < N; i++) {
      const t = i / N;
      if (t > 0.94) continue;
      const a = (t + ouroPhase) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      if (y < 0 || y >= rows || x < 0 || x >= cols) continue;
      let ch = t < 0.06 ? "@" : t > 0.86 ? "." : t > 0.76 ? "o" : SCALES[(i + Math.floor(ouroPhase * 40)) % SCALES.length];
      grid[y][x] = ch;
    }
    const ha = ouroPhase * Math.PI * 2 - 0.12;
    const hx = Math.round(cx + Math.cos(ha) * rx), hy = Math.round(cy + Math.sin(ha) * ry);
    if (grid[hy] && grid[hy][hx] !== undefined) grid[hy][hx] = "<";
    asciiOuro.textContent = grid.map((r) => r.join("")).join("\n");
  }
  loop($(".portrait-wrap"), 12, (t, still) => { if (!isAscii()) return; if (!still) ouroPhase = (ouroPhase + 0.006) % 1; drawOuro(); }, isAscii);

  // Torus (donut maths), drawn as dots on canvas or as characters in ASCII.
  const torusCv = $("#torus"), torusPre = $("#ascii-torus");
  const tctx = torusCv.getContext("2d");
  let A = 1, B = 1;
  function torusFrame(still) {
    if (!still) { A += 0.05; B += 0.025; }
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    if (isAscii()) {
      const W = 60, H = 24, out = Array(W * H).fill(" "), zb = Array(W * H).fill(0);
      for (let j = 0; j < 6.28; j += 0.09) {
        const ct = Math.cos(j), st = Math.sin(j);
        for (let i = 0; i < 6.28; i += 0.03) {
          const sp = Math.sin(i), cp = Math.cos(i), h = ct + 2, D = 1 / (sp * h * sA + st * cA + 5), t = sp * h * cA - st * sA;
          const x = (W / 2 + 26 * D * (cp * h * cB - t * sB)) | 0, y = (H / 2 + 12 * D * (cp * h * sB + t * cB)) | 0, o = x + W * y;
          const N = (8 * ((st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB)) | 0;
          if (y > 0 && y < H && x > 0 && x < W && D > zb[o]) { zb[o] = D; out[o] = ".,-~:;=!*#$@"[N > 0 ? N : 0]; }
        }
      }
      let s = ""; for (let k = 0; k < W * H; k++) s += k % W === W - 1 ? "\n" : out[k];
      torusPre.textContent = s;
      return;
    }
    const dpr = Math.min(devicePixelRatio || 1, 2), cw = torusCv.clientWidth || 300, ch = cw * 220 / 300;
    if (torusCv.width !== Math.round(cw * dpr)) { torusCv.width = Math.round(cw * dpr); torusCv.height = Math.round(ch * dpr); }
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, cw, ch);
    const col = rgb(token("--accent"));
    for (let j = 0; j < 6.28; j += 0.22) {
      const ct = Math.cos(j), st = Math.sin(j);
      for (let i = 0; i < 6.28; i += 0.09) {
        const sp = Math.sin(i), cp = Math.cos(i), h = ct + 2, D = 1 / (sp * h * sA + st * cA + 5), t = sp * h * cA - st * sA;
        const x = cw / 2 + cw * 0.42 * D * (cp * h * cB - t * sB) * 1.0, y = ch / 2 + ch * 0.55 * D * (cp * h * sB + t * cB);
        const L = (st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB;
        const a = Math.max(0.08, Math.min(1, (L + 0.4) * 0.8));
        tctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
        tctx.fillRect(x, y, 1.6 + D * 3, 1.6 + D * 3);
      }
    }
  }
  loop(torusCv.parentElement, 24, (t, still) => torusFrame(still));

  // ASCII rain (15 fps, DPR ≤ 1.5, ASCII design only).
  const rainCv = $("#rain"), rctx = rainCv.getContext("2d");
  let rainCols = [], rw = 0, rh = 0, rfs = 14;
  function sizeRain() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    rw = rainCv.width = Math.max(1, innerWidth * dpr); rh = rainCv.height = Math.max(1, innerHeight * dpr);
    rfs = Math.max(12, Math.round(rw / 64));
    rainCols = Array.from({ length: Math.ceil(rw / rfs) }, () => Math.random() * -40);
  }
  const GLYPHS = "アイウエオカキクケコ01ZXV<>/\\|#$%*+=".split("");
  let rainColor = "#33ff00";
  function rainFrame(t, still) {
    if (still) return;
    if (!rw) sizeRain();
    rctx.fillStyle = "rgba(5,5,5,.22)"; rctx.fillRect(0, 0, rw, rh);
    rctx.fillStyle = rainColor; rctx.font = `${rfs}px "JetBrains Mono", monospace`;
    for (let i = 0; i < rainCols.length; i++) {
      const y = rainCols[i] * rfs;
      if (y > 0) rctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * rfs, y);
      rainCols[i] = y > rh && Math.random() > 0.96 ? 0 : rainCols[i] + 1;
    }
  }
  addEventListener("resize", () => { if (isAscii()) sizeRain(); });
  loop(document.body, 15, rainFrame, isAscii);

  /* ───────────────────────── Globe ───────────────────────── */
  const globe = $("#globe"), gctx = globe.getContext("2d");
  const MARKERS = [
    { k: "home", lat: 42.36, lng: -71.06 },
    { k: "school", lat: 40.43, lng: -86.91 },
    { k: "now", lat: 37.77, lng: -122.42 },
  ];
  const DOTS = [];
  (function seedDots() {
    // Fibonacci sphere, filtered to rough land masks so the globe reads as Earth.
    const N = 1400;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      const lat = Math.asin(y) * 180 / Math.PI, lng = ((th * 180 / Math.PI) % 360) - 180;
      if (isLand(lat, lng)) DOTS.push([lat, lng]);
    }
    function isLand(la, lo) {
      const box = (a, b, c, d) => la > a && la < b && lo > c && lo < d;
      return box(15, 70, -168, -52) || box(-56, 12, -82, -34) || box(36, 70, -10, 40) || box(-35, 36, -18, 51) || box(5, 75, 40, 150) || box(-40, -10, 112, 154) || box(60, 83, -55, -20) || box(8, 30, 70, 90);
    }
  })();
  let phi = 1.25;
  let gCols = {};
  function readGlobeTokens() { gCols = { dot: cssColor("--globe-dot"), home: cssColor("--globe-home"), school: cssColor("--globe-school"), now: cssColor("--globe-now"), line: cssColor("--line-strong") }; }
  function proj(lat, lng, R, cx, cy) {
    const la = lat * Math.PI / 180, lo = lng * Math.PI / 180 + phi, tilt = 0.32;
    let x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    return [cx + x * R, cy - y2 * R, z2];
  }
  function globeFrame(t, still) {
    if (!still) phi += 0.006;
    const dpr = Math.min(devicePixelRatio || 1, 2), s = globe.clientWidth || 260;
    if (globe.width !== Math.round(s * dpr)) { globe.width = globe.height = Math.round(s * dpr); }
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.clearRect(0, 0, s, s);
    const R = s * 0.44, cx = s / 2, cy = s / 2;
    gctx.strokeStyle = gCols.line; gctx.lineWidth = 1;
    gctx.beginPath(); gctx.arc(cx, cy, R, 0, Math.PI * 2); gctx.stroke();
    gctx.fillStyle = gCols.dot;
    for (const [la, lo] of (unslopped() && AS.land.length ? AS.land : DOTS)) { const [x, y, z] = proj(la, lo, R, cx, cy); if (z > 0) gctx.fillRect(x - 1, y - 1, 1.8, 1.8); }
    const pts = MARKERS.map((m) => ({ m, p: proj(m.lat, m.lng, R, cx, cy) }));
    // travel arcs Boston → West Lafayette → SF
    gctx.strokeStyle = gCols.home; gctx.lineWidth = 1.4; gctx.setLineDash([3, 4]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].p, b = pts[i + 1].p;
      if (a[2] <= 0 || b[2] <= 0) continue;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 26;
      gctx.beginPath(); gctx.moveTo(a[0], a[1]); gctx.quadraticCurveTo(mx, my, b[0], b[1]); gctx.stroke();
    }
    gctx.setLineDash([]);
    for (const { m, p } of pts) {
      if (p[2] <= 0) continue;
      gctx.fillStyle = gCols[m.k];
      gctx.beginPath(); gctx.arc(p[0], p[1], 5, 0, Math.PI * 2); gctx.fill();
      if (m.k === "now") { gctx.strokeStyle = gCols.now; gctx.lineWidth = 2; gctx.beginPath(); gctx.arc(p[0], p[1], 9 + Math.sin(t / 300) * 2, 0, Math.PI * 2); gctx.stroke(); }
    }
  }
  const syncGlobe = loop(globe, 24, globeFrame);
  onChange(() => { readGlobeTokens(); syncGlobe(); });

  /* ───────────────────────── Now: live time + taskbar clock ───────────────────────── */
  function tick() {
    const now = new Date();
    const f = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
    const h = +new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }).format(now);
    $("#now-time").textContent = f.format(now);
    $("#now-dn").textContent = h >= 6 && h < 19 ? "daytime" : "night";
    $("#tb-clock").textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now);
  }
  tick(); setInterval(tick, 30000);

  /* ───────────────────────── Content ───────────────────────── */
  const PROJECTS = [
    { slug: "boilerframe", title: "BoilerFrame", badge: "AI / Vision", featured: true, desc: ["Full-stack web app that pinpoints every appearance of a target person in a video.", "Ingests reference images and footage, then runs a facial-recognition pipeline.", "Built on the MERN stack with AWS Rekognition."], tags: ["React", "Express", "Node.js", "MongoDB", "AWS"], links: { GitHub: "https://github.com/rithvikpkx/BoilerFrame" } },
    { slug: "eeg-thought-prediction", title: "Left/Right Thought Prediction", badge: "BCI", desc: ["Classifies left, right and neutral thoughts from 16-channel EEG captured with an OpenBCI headset.", "Pairs a stimulus-display program with TensorFlow models."], tags: ["Python", "OpenBCI", "TensorFlow", "Keras", "EEG"], links: { GitHub: "https://github.com/rithvikpkx/OpenBCI-Project" } },
    { slug: "mind-controlled-arm", title: "Mind-Controlled Robotic Arm", badge: "BCI / Hardware", media: "assets/arm-demo.jpg", mediaAlt: "Rithvik at his desk with the EEG headset, breadboard and robotic hand from the demo", desc: ["Drives a robotic arm from thought alone with a NeuroSky EEG headset and an Arduino.", "A foundation for translating intent into sign-language gestures."], tags: ["NeuroSky", "Arduino", "C++", "Python", "EEG"], links: { Demo: "https://www.youtube.com/watch?v=W8EzUuWgi4o" } },
    { slug: "citizen-happiness", title: "Predicting Citizen Happiness", badge: "ML Research", media: "assets/shape-demo.jpg", mediaAlt: "Rithvik presenting the project at Columbia University's SHAPE program", desc: ["Lasso model correlating national spending on military, education and health with reported happiness.", "4-person team at Columbia University's SHAPE program in NYC."], tags: ["Python", "Pandas", "scikit-learn"], links: { GitHub: "https://github.com/rithvikpkx/HappinessProjectSHAPE", Demo: "https://www.youtube.com/watch?v=eBzE83IjDZM" } },
    { slug: "qrify", title: "QRIfy", badge: "Web App", desc: ["Turns user text into a downloadable QR code.", "Python + Segno backend, hand-rolled frontend, hosted on AWS EC2."], tags: ["Python", "JavaScript", "AWS"], links: { GitHub: "https://github.com/rithvikpkx/QRCode_Project" } },
    { slug: "habitat-humanity-ecomm", title: "Habitat for Humanity E-Commerce", badge: "Volunteer", desc: ["Inventory tool that posts items to Facebook Marketplace and eBay from one interface.", "Wrote the training materials and onboarded staff."], tags: ["Google Apps Script", "JavaScript"], links: {} },
  ];
  const EXPERIENCE = [
    { slug: "tinyml-research", role: "Undergraduate Researcher, TinyML", org: "Snowball Lab, Purdue University", when: "Spring 2026 – Present", where: "West Lafayette, IN", desc: ["Optimizing and deploying small ML models onto low-power embedded hardware via Edge Impulse, under Prof. Qiuyue \"Shirley\" Xue.", "Investigating piezoelectric microphones that act as both sensors and energy sources for on-device models."], tags: ["TinyML", "Edge Impulse", "Python", "C++"] },
    { slug: "hack-the-future", role: "Software Developer", org: "Hack The Future @ Purdue", when: "Fall 2025 – Spring 2026", where: "West Lafayette, IN", desc: ["Built a full-stack, AI-powered RAG learning platform for a non-profit serving 500+ underserved learners.", "Wired the LLM workflow and vector retrieval; added AI-generated quizzes and assignments."], tags: ["React", "Node.js", "Express", "MongoDB", "Ollama", "RAG", "Vercel", "Cloudflare"] },
    { slug: "code-ninjas-ir", role: "Investor Relations Chair", org: "Code Ninjas", when: "Jan 2025 – Aug 2025", where: "Northborough, MA", desc: ["Analyzed revenue, costs and margins to surface trends; delivered quarterly reports."], tags: ["Financial Analysis", "Reporting"] },
    { slug: "code-ninjas-sensei", role: "Code Sensei", org: "Code Ninjas", when: "May 2023 – Aug 2025", where: "Northborough, MA", desc: ["Taught programming through game development to 40 students aged 5–12.", "Organized hackathons and built personalized skill paths with parents."], tags: ["JavaScript", "C#", "Teaching"] },
  ];
  const STACK = {
    Languages: ["Python", "JavaScript", "TypeScript", "C++", "C#", "SQL"],
    Frameworks: ["React", "Next.js", "Node.js", "Express", "TensorFlow", "Keras", "scikit-learn", "Pandas"],
    "Infra & data": ["AWS", "MongoDB", "Supabase", "Vercel", "Cloudflare", "Google Apps Script"],
    "AI & hardware": ["RAG", "Ollama", "Edge Impulse", "TinyML", "OpenBCI", "NeuroSky", "Arduino", "EEG"],
  };
  const SITE_ONLY = { TypeScript: 1, "Next.js": 1, Supabase: 1, SQL: 1, RAG: 1, Vercel: 1 };

  // Projects
  const grid = $("#proj-grid");
  grid.innerHTML = PROJECTS.map((p) => `
    <article class="panel project${p.featured ? " is-featured" : ""}" id="project-${p.slug}" data-tags="${esc(p.tags.join("|"))}" data-label="${esc(p.badge.toUpperCase())}" data-title="${esc(p.slug)}.exe" data-fig="${PROJECTS.indexOf(p) + 3}">
      ${p.media ? `<a class="p-media u-only" href="${p.links.Demo}" target="_blank" rel="noopener" aria-label="Watch the ${esc(p.title)} demo"><img src="${p.media}" alt="${esc(p.mediaAlt)}" width="800" height="450" loading="lazy"><span class="p-play">${icon("play")}</span></a>` : ""}
      <div class="p-top"><span class="p-badge">${esc(p.badge)}</span>${p.featured ? '<span class="chip featured-chip">Featured</span>' : ""}</div>
      <h3 class="p-title">${esc(p.title)}</h3>
      <ul class="p-desc">${p.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      <div class="p-foot">
        <ul class="chips">${p.tags.map((t) => `<li class="chip">${esc(t)}</li>`).join("")}</ul>
        <div class="p-links">${Object.entries(p.links).map(([k, v]) => `<a class="btn ghost sm" href="${v}" target="_blank" rel="noopener">${k} ↗</a>`).join("")}<button class="btn ghost sm u-hide" type="button" data-ask="Tell me more about ${esc(p.title)}">Ask AI</button></div>
      </div>
    </article>`).join("");

  // Stack map
  const used = (tool) => ({ p: PROJECTS.filter((p) => p.tags.includes(tool)), e: EXPERIENCE.filter((e) => e.tags.includes(tool)) });
  $("#stackmap").innerHTML = Object.entries(STACK).map(([g, tools]) => `
    <div class="sm-group"><h4>${esc(g)}</h4><ul class="chips">${tools.map((t) => { const u = used(t); const n = u.p.length + u.e.length + (SITE_ONLY[t] ? 1 : 0); return `<li><button type="button" class="chip" data-tool="${esc(t)}" aria-pressed="false">${TOOL_LOGO[t] ? `<span class="v-un">${logo(TOOL_LOGO[t])}</span>` : ""}${esc(t)} <span class="n">${n}</span></button></li>`; }).join("")}</ul></div>`).join("");
  let activeTool = null;
  $("#stackmap").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tool]"); if (!b) return;
    activeTool = activeTool === b.dataset.tool ? null : b.dataset.tool;
    renderFilter();
  });
  $("#sm-clear").addEventListener("click", () => { activeTool = null; renderFilter(); });
  function renderFilter() {
    $$("[data-tool]").forEach((b) => { const on = b.dataset.tool === activeTool; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    $$(".project").forEach((c) => c.classList.toggle("is-dim", !!activeTool && !c.dataset.tags.split("|").includes(activeTool)));
    $("#sm-clear").hidden = !activeTool;
    if (!activeTool) { $("#sm-hint").textContent = "Pick a tool to see where I've used it."; return; }
    const u = used(activeTool);
    const parts = [];
    if (u.p.length) parts.push(`${u.p.length} project${u.p.length > 1 ? "s" : ""}`);
    if (u.e.length) parts.push(u.e.map((x) => x.org.split(",")[0]).filter((v, i, a) => a.indexOf(v) === i).join(", "));
    if (SITE_ONLY[activeTool]) parts.push("this site");
    $("#sm-hint").innerHTML = `<b>${esc(activeTool)}</b>: used in ${esc(parts.join(" · ") || "—")}`;
  }

  // Timeline
  $("#timeline").innerHTML = `
    <li class="tl-item is-new"><span class="tl-dot" aria-hidden="true"></span><article class="panel tl-card" data-label="NEW ROLE" data-title="new_role.txt" data-fig="—">
      <h3 class="tl-role" data-edit>Your newest role goes here</h3><p class="tl-org">Updated experience: content from Rithvik</p>
      <p class="tl-when">2026</p><p class="tl-where">—</p>
      <ul class="p-desc"><li>Placeholder for the updated Experience content the plan calls for. Edited inline in admin mode.</li></ul>
    </article></li>` + EXPERIENCE.map((x) => `
    <li class="tl-item" id="experience-${x.slug}"><span class="tl-dot" aria-hidden="true"></span><article class="panel tl-card" data-label="${esc(x.org.toUpperCase())}" data-title="${esc(x.slug)}.txt" data-fig="E${EXPERIENCE.indexOf(x) + 1}">
      <h3 class="tl-role">${esc(x.role)}</h3><p class="tl-org">${esc(x.org)}</p>
      <p class="tl-when">${esc(x.when)}</p><p class="tl-where">${esc(x.where)}</p>
      <ul class="p-desc">${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      <ul class="chips">${x.tags.map((t) => `<li class="chip">${esc(t)}</li>`).join("")}</ul>
    </article></li>`).join("");

  // Field notes
  const NOTES = [
    { i: "◎", ic: "activity", t: "Brain-computer interfaces", take: "Two EEG builds so far: a robotic arm driven by thought, and a left/right thought classifier on 16 channels.", art: "OpenBCI · NeuroSky · TensorFlow" },
    { i: "⚡", ic: "cpu", t: "Tiny models, tiny power", take: "TinyML that fits on a microcontroller, ideally powered by the very sensor it listens to.", art: "Snowball Lab · Edge Impulse" },
    { i: "✎", ic: "book-open", t: "Teaching", take: "Taught 40 kids aged 5–12 to code through game dev. The best debugging practice there is.", art: "Code Ninjas · 2+ years" },
    { i: "▲", ic: "trending-up", t: "Reading the numbers", take: "Ran investor relations at Code Ninjas: revenue, margins and quarterly reports for the team.", art: "Quarterly reports" },
    { i: "◇", ic: "users", t: "Software for non-profits", take: "A listing tool for Habitat for Humanity and a RAG learning platform for 500+ learners.", art: "2 non-profits" },
    { i: "▶", ic: "gamepad", t: "Small games", take: "I build tiny games on rithvik.si. The Arcade above is the sampler.", art: "rithvik.si ↗" },
  ];
  $("#notes-grid").innerHTML = NOTES.map((n, k) => `<article class="panel note-card" data-label="NOTE ${k + 1}" data-title="note_${k + 1}.txt" data-fig="N${k + 1}"><span class="nc-icon" aria-hidden="true">${dual(n.i, icon(n.ic))}</span><h3 class="nc-title">${esc(n.t)}</h3><p class="nc-take">${esc(n.take)}</p><p class="nc-art">${esc(n.art)}</p></article>`).join("");

  // Changelog (real recent commits) + contribution graph (sample)
  const LOG = [
    ["Aug 14", "feat", "lightweight agentic actions in the chat"],
    ["Aug 14", "fix", "make the favicon acceptable to Google search results"],
    ["Aug 14", "feat", "semantic repeat detection + runtime temperature knob"],
    ["Aug 14", "fix", "verify suggestions are answerable; swap chips on pick"],
    ["Aug 14", "feat", "follow-up suggestions + transcript export"],
    ["Aug 11", "fix", "rate-limit /api/chat, close contact relay, fix OG images"],
    ["Aug 11", "fix", "close public write path to site content"],
  ];
  $("#log").innerHTML = LOG.map(([d, t, s]) => `<li><time>${d}</time><span><span class="type">${t}:</span> ${esc(s)}</span></li>`).join("");
  /** Contribution grid: real daily commits to this site's repo when unslopped, sample noise in the original. */
  function renderContrib() {
    if (unslopped() && AS.commits.length) {
      const max = Math.max(...AS.commits.map((d) => d[1]));
      $("#contrib").innerHTML = AS.commits.map(([d, n]) => `<i style="--v:${n ? (0.3 + 0.7 * Math.log1p(n) / Math.log1p(max)).toFixed(2) : 0}" title="${d}: ${n} commit${n === 1 ? "" : "s"}"></i>`).join("");
      $("#commit-total").textContent = `${AS.commits.reduce((t, d) => t + d[1], 0)} since May 2026`;
    } else $("#contrib").innerHTML = sampleContrib;
  }
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sampleContrib = Array.from({ length: 7 * 40 }, (_, i) => { const w = Math.floor(i / 7); const base = w > 30 ? 0.55 : w > 20 ? 0.35 : 0.2; const v = rnd() < base ? Math.min(1, rnd() * 0.9 + 0.15) : 0; return `<i style="--v:${v.toFixed(2)}"></i>`; }).join("");

  /* ───────────────────────── Arcade ───────────────────────── */
  const GAMES = [
    { id: "typeracer", name: "Type Racer", desc: "Type a real line from my projects. Speed and accuracy.", unit: "WPM", base: 96, hi: true, play: true, art: "⌨", ic: "keyboard" },
    { id: "angle", name: "Angle Approximator", desc: "Guess the angle in degrees. Five rounds.", unit: "° off", base: 4.2, hi: false, play: true, art: "∠", ic: "angle" },
    { id: "dots", name: "Count the Dots", desc: "A cloud of dots flashes for under a second. How many?", unit: "% off", base: 8, hi: false, play: true, art: "⁘", ic: "grip" },
    { id: "center", name: "Center the Div", desc: "Drag the box to the exact centre. The CSS classic.", unit: "px off", base: 3, hi: false, play: true, art: "⊡", ic: "crosshair" },
    { id: "bigo", name: "Big-O or Bust", desc: "Name the time complexity before the timer runs out.", unit: "/10", base: 9, hi: true, art: "𝒪", ic: "braces" },
    { id: "hexeye", name: "Hex Eye", desc: "Recreate a colour with HSL sliders. Scored by ΔE.", unit: "ΔE", base: 6.1, hi: false, art: "◐", ic: "palette" },
    { id: "reaction", name: "Reaction Lab", desc: "Click on the flash. Don't jump the gun.", unit: "ms", base: 212, hi: false, art: "⚡", ic: "timer" },
    { id: "prime", name: "Prime Time", desc: "Prime or not? As many as you can in 30 seconds.", unit: "correct", base: 31, hi: true, art: "ℙ", ic: "hash" },
  ];
  const GM = Object.fromEntries(GAMES.map((g) => [g.id, g]));
  $("#arcade-grid").innerHTML = GAMES.map((g) => `
    <button type="button" class="panel game-card" data-game="${g.id}" data-label="${esc(g.name.toUpperCase())}" data-title="${g.id}.rithvik.si" data-fig="G">
      ${g.play ? "" : `<span class="gc-soon">${dual("Soon", "Coming soon")}</span>`}
      <span class="gc-art" aria-hidden="true">${dual(g.art, icon(g.ic))}</span>
      ${g.id === "typeracer" ? `<span class="gc-preview u-only" aria-hidden="true"><span class="ok">const faces = await rek</span><span class="cur">o</span>gnition.searchFacesByImage(params).promise();</span>` : ""}
      <span class="gc-name">${esc(g.name)}</span>
      <span class="gc-desc">${esc(g.desc)}</span>
      <span class="gc-base"><span>Rithvik: <b>${g.base} ${esc(g.unit)}</b></span><span>${g.play ? dual("Play →", `Play ${esc(g.name)}`) : dual("rithvik.si", "On rithvik.si soon")}</span></span>
    </button>`).join("");
  const frame = $("#game-frame"), gfBody = $("#gf-body");
  let stopGame = () => {};
  $("#arcade-grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-game]"); if (!b) return;
    const g = GM[b.dataset.game];
    if (!g.play) { toast(`<span><b>${esc(g.name)}</b> is coming to ${g.id}.rithvik.si. The mockup plays the first four.</span>`); return; }
    openGame(g.id);
  });
  $("#gf-close").addEventListener("click", () => { stopGame(); frame.hidden = true; $$(".game-card").forEach((c) => c.classList.remove("is-playing")); });
  function openGame(id) {
    const g = GM[id];
    stopGame();
    frame.hidden = false;
    $$(".game-card").forEach((c) => c.classList.toggle("is-playing", c.dataset.game === id));
    $("#gf-url").textContent = `${id}.rithvik.si`;
    $("#gf-open").href = "https://rithvik.si";
    frame.dataset.title = `${g.name} · ${id}.rithvik.si`;
    ({ typeracer: gameType, angle: gameAngle, dots: gameDots, center: gameCenter })[id](g);
    scrollToEl(frame, "center");
  }
  function resultCard(g, you, extra = "") {
    const better = g.hi ? you >= g.base : you <= g.base;
    const max = Math.max(you, g.base) * 1.15 || 1;
    const pct = g.hi ? Math.min(99, Math.max(3, Math.round(50 + (you - g.base) / g.base * 120))) : Math.min(99, Math.max(3, Math.round(50 + (g.base - you) / Math.max(g.base, 1) * 60)));
    const shareText = `I scored ${you} ${g.unit} on ${g.name} at rithvik.ai. Rithvik: ${g.base} ${g.unit}.`;
    return `<div class="panel result-card" data-label="RESULT" data-title="Results" data-fig="R">
      <p class="rc-verdict">${better ? "You beat Rithvik." : "Rithvik wins this round."}</p>
      <div class="rc-row me"><span>You</span><span class="rc-bar"><i style="--w:${(you / max * 100).toFixed(1)}%"></i></span><b>${you} ${esc(g.unit)}</b></div>
      <div class="rc-row"><span>Rithvik</span><span class="rc-bar"><i style="--w:${(g.base / max * 100).toFixed(1)}%"></i></span><b>${g.base} ${esc(g.unit)}</b></div>
      <p class="card-note">Better than ${pct}% of 1,204 plays (sample data). ${extra}</p>
      <div class="g-row"><button type="button" class="btn sm" data-again="${g.id}">Play again</button><button type="button" class="btn ghost sm" data-copy="${esc(shareText)}">Copy result</button></div>
    </div>`;
  }
  function animateBars(root) { requestAnimationFrame(() => $$(".rc-bar i", root).forEach((i) => { i.style.width = i.style.getPropertyValue("--w"); })); }
  gfBody.addEventListener("click", (e) => { const a = e.target.closest("[data-again]"); if (a) openGame(a.dataset.again); });
  function shell(g, help, stage) {
    gfBody.innerHTML = `<div class="g-wrap"><div class="g-stage"><h3 class="g-title">${esc(g.name)}</h3><p class="g-help">${help}</p>${stage}</div><div class="g-side" id="g-side"><div class="panel result-card" data-label="BASELINE" data-title="Baseline" data-fig="R"><p class="mini-label">Rithvik's baseline</p><p class="g-stat">${g.base} <span style="font-size:.5em">${esc(g.unit)}</span></p><p class="card-note">Your score posts here when you finish. In production this card listens for a <code>score</code> message from the iframe.</p></div></div></div>`;
  }
  // Type Racer
  function gameType(g) {
    const LINES = ["const faces = await rekognition.searchFacesByImage(params).promise();", "model.fit(X_train, y_train, epochs=30, validation_split=0.2)", "for (const row of rows) await upsertEmbedding(row.slug, row.text);"];
    const text = LINES[(Math.random() * LINES.length) | 0];
    shell(g, "Type the line exactly. The timer starts on your first key.", `<div class="tr-text" id="tr-text"></div><input class="field" id="tr-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type the line shown above"><div class="g-row"><span class="mini-label" id="tr-live">0 WPM · 100%</span></div>`);
    const tt = $("#tr-text"), inp = $("#tr-in");
    let t0 = 0, errs = 0, done = false;
    const render = (v) => { tt.innerHTML = [...text].map((c, i) => { const cls = i < v.length ? (v[i] === c ? "ok" : "bad") : i === v.length ? "cur" : ""; return `<span class="${cls}">${esc(c)}</span>`; }).join(""); };
    render("");
    inp.focus({ preventScroll: true });
    inp.addEventListener("input", () => {
      if (done) return;
      const v = inp.value;
      if (!t0) t0 = performance.now();
      if (v.length && v[v.length - 1] !== text[v.length - 1]) errs++;
      render(v);
      const min = (performance.now() - t0) / 60000;
      const wpm = Math.round((v.length / 5) / Math.max(min, 1 / 600));
      const acc = Math.max(0, Math.round(100 * (1 - errs / Math.max(1, v.length))));
      $("#tr-live").textContent = `${wpm} WPM · ${acc}%`;
      if (v === text) { done = true; $("#g-side").innerHTML = resultCard(g, wpm, `Accuracy ${acc}%.`); animateBars($("#g-side")); }
    });
    stopGame = () => {};
  }
  // Angle Approximator
  function gameAngle(g) {
    shell(g, "Estimate the angle between the two rays. Five rounds; your score is the average error.", `<div class="g-canvas-box"><canvas id="ang-cv" width="420" height="315"></canvas></div><div class="g-row"><input type="range" id="ang-r" min="0" max="180" value="90" aria-label="Your angle guess in degrees" style="flex:1;accent-color:var(--accent)"><b class="g-stat" id="ang-v" style="font-size:1.4rem;min-width:3.2ch">90°</b><button class="btn sm" type="button" id="ang-go">Lock in</button></div><p class="mini-label" id="ang-round">Round 1 of 5</p>`);
    const cv = $("#ang-cv"), c = cv.getContext("2d");
    let round = 0, errsum = 0, target = 0, base = 0;
    const draw = (reveal) => {
      const W = cv.width, H = cv.height, ox = W / 2, oy = H * 0.72, L = Math.min(W, H) * 0.55;
      c.clearRect(0, 0, W, H);
      c.lineCap = "round";
      c.strokeStyle = cssColor("--field-fg"); c.lineWidth = 4;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(base) * L, oy - Math.sin(base) * L); c.stroke();
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(base + target * Math.PI / 180) * L, oy - Math.sin(base + target * Math.PI / 180) * L); c.stroke();
      c.fillStyle = cssColor("--accent"); c.beginPath(); c.arc(ox, oy, 6, 0, Math.PI * 2); c.fill();
      if (reveal) { c.fillStyle = cssColor("--accent"); c.font = `600 22px ${token("--font-l")}`; c.fillText(`${target}°`, ox + 14, oy + 30); }
    };
    const next = () => { target = 15 + ((Math.random() * 150) | 0); base = (Math.random() * 0.6) - 0.1; draw(false); $("#ang-round").textContent = `Round ${round + 1} of 5`; };
    $("#ang-r").addEventListener("input", (e) => { $("#ang-v").textContent = e.target.value + "°"; });
    $("#ang-go").addEventListener("click", () => {
      const guess = +$("#ang-r").value;
      errsum += Math.abs(guess - target); round++;
      draw(true);
      if (round >= 5) { const avg = +(errsum / 5).toFixed(1); $("#g-side").innerHTML = resultCard(g, avg); animateBars($("#g-side")); $("#ang-go").disabled = true; return; }
      setTimeout(next, 900);
    });
    next();
    stopGame = () => {};
  }
  // Count the Dots
  function gameDots(g) {
    shell(g, "Dots flash for 0.8 seconds. Enter how many you saw. Three rounds.", `<div class="g-canvas-box"><canvas id="dot-cv" width="420" height="315"></canvas></div><div class="g-row dots-input"><button class="btn sm" type="button" id="dot-show">Flash dots</button><input class="field" id="dot-in" type="number" inputmode="numeric" min="0" placeholder="How many?" aria-label="Your dot count"><button class="btn ghost sm" type="button" id="dot-go" disabled>Submit</button></div><p class="mini-label" id="dot-round">Round 1 of 3</p>`);
    const cv = $("#dot-cv"), c = cv.getContext("2d");
    let n = 0, round = 0, errsum = 0, tm = 0;
    const clear = () => c.clearRect(0, 0, cv.width, cv.height);
    $("#dot-show").addEventListener("click", () => {
      n = 18 + ((Math.random() * 70) | 0);
      clear(); c.fillStyle = cssColor("--accent");
      for (let i = 0; i < n; i++) { c.beginPath(); c.arc(20 + Math.random() * (cv.width - 40), 20 + Math.random() * (cv.height - 40), 5, 0, Math.PI * 2); c.fill(); }
      $("#dot-show").disabled = true;
      clearTimeout(tm); tm = setTimeout(() => { clear(); $("#dot-go").disabled = false; $("#dot-in").focus({ preventScroll: true }); }, 800);
    });
    const submit = () => {
      const guess = +$("#dot-in").value; if (!n || $("#dot-go").disabled) return;
      errsum += Math.abs(guess - n) / n * 100; round++;
      c.fillStyle = cssColor("--field-fg"); c.font = `600 22px ${token("--font-l")}`; c.fillText(`There were ${n}.`, 20, 40);
      $("#dot-go").disabled = true; $("#dot-in").value = "";
      if (round >= 3) { const avg = +(errsum / 3).toFixed(1); $("#g-side").innerHTML = resultCard(g, avg); animateBars($("#g-side")); return; }
      $("#dot-show").disabled = false; $("#dot-round").textContent = `Round ${round + 1} of 3`;
    };
    $("#dot-go").addEventListener("click", submit);
    $("#dot-in").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    stopGame = () => clearTimeout(tm);
  }
  // Center the Div
  function gameCenter(g) {
    shell(g, "Drag the box until it's dead centre in the dashed container, then submit. Three rounds.", `<div class="cd-box" id="cd-box"><i class="cd-target" id="cd-t"></i><div class="cd-div" id="cd-div" role="slider" aria-label="Draggable box" tabindex="0">div</div></div><div class="g-row"><button class="btn sm" type="button" id="cd-go">Submit</button><span class="mini-label" id="cd-round">Round 1 of 3 · arrow keys nudge 1px</span></div>`);
    const box = $("#cd-box"), div = $("#cd-div"), tgt = $("#cd-t");
    let round = 0, errsum = 0, pos = [0, 0], drag = null;
    const place = () => { div.style.left = pos[0] + "px"; div.style.top = pos[1] + "px"; };
    const reset = () => {
      box.style.aspectRatio = ["16 / 10", "4 / 3", "21 / 9"][round % 3];
      box.style.maxWidth = [460, 380, 520][round % 3] + "px";
      requestAnimationFrame(() => { const r = box.getBoundingClientRect(); pos = [r.width * (0.15 + Math.random() * 0.2), r.height * (0.2 + Math.random() * 0.6)]; place(); tgt.classList.remove("show"); });
    };
    div.addEventListener("pointerdown", (e) => { drag = [e.clientX - pos[0], e.clientY - pos[1]]; div.setPointerCapture(e.pointerId); });
    div.addEventListener("pointermove", (e) => { if (!drag) return; const r = box.getBoundingClientRect(); pos = [Math.max(0, Math.min(r.width, e.clientX - drag[0])), Math.max(0, Math.min(r.height, e.clientY - drag[1]))]; place(); });
    div.addEventListener("pointerup", () => { drag = null; });
    div.addEventListener("keydown", (e) => { const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (m) { e.preventDefault(); pos = [pos[0] + m[0] * (e.shiftKey ? 10 : 1), pos[1] + m[1] * (e.shiftKey ? 10 : 1)]; place(); } });
    $("#cd-go").addEventListener("click", () => {
      const r = box.getBoundingClientRect();
      const err = Math.hypot(pos[0] - r.width / 2, pos[1] - r.height / 2);
      tgt.style.left = r.width / 2 + "px"; tgt.style.top = r.height / 2 + "px"; tgt.classList.add("show");
      errsum += err; round++;
      if (round >= 3) { const avg = +(errsum / 3).toFixed(1); $("#g-side").innerHTML = resultCard(g, avg); animateBars($("#g-side")); $("#cd-go").disabled = true; return; }
      $("#cd-round").textContent = `Round ${round + 1} of 3 · last: ${err.toFixed(1)}px off`;
      setTimeout(reset, 900);
    });
    reset();
    stopGame = () => {};
  }

  /* ───────────────────────── Chat assistant (simulated) ───────────────────────── */
  const dock = $("#chat-dock"), panel = $("#chat-panel"), log = $("#chat-log"), chatInput = $("#chat-input"), sendBtn = $("#cb-send"), starters = $("#chat-starters"), status = $("#chat-status");
  let msgs = [], streaming = null, lastTopic = null, intent = null, history = [];
  const STARTERS = ["Show me this site as a comic", "What has he built?", "What stack did BoilerFrame use?", "Is he open to internships?"];
  function renderStarters(show) {
    starters.innerHTML = show ? STARTERS.map((s) => `<button type="button" class="starter" data-q="${esc(s)}">${esc(s)}</button>`).join("") : "";
  }
  chatInput.addEventListener("focus", () => { if (panel.hidden) renderStarters(true); });
  chatInput.addEventListener("blur", () => setTimeout(() => { if (!starters.contains(document.activeElement)) renderStarters(false); }, 150));
  starters.addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { renderStarters(false); ask(b.dataset.q); } });
  $$("[data-focus-chat]").forEach((b) => b.addEventListener("click", () => { openChat(); chatInput.focus(); }));
  function openChat() {
    if (!panel.hidden) return;
    panel.hidden = false; renderStarters(false);
    if (!msgs.length) renderWelcome();
  }
  function closeChat() { panel.hidden = true; $("#chat-history").hidden = true; }
  $("#ch-close").addEventListener("click", closeChat);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (streaming) { stopStream(); return; }
      const m = $$(".modal").find((x) => !x.hidden); if (m) { closeModal(m); return; }
      if (!panel.hidden) { closeChat(); chatInput.blur(); }
    }
    if (e.key === "ArrowUp" && document.activeElement === chatInput && !chatInput.value) { e.preventDefault(); editLast(); }
  });
  function renderWelcome() {
    log.innerHTML = `<div class="welcome"><p class="welcome-h">${dual("Hi. I'm Rithvik's assistant.", "Ask about Rithvik's work")}</p><p>I answer from his projects, experience, education and resume, and I'll say so when something isn't on record. I can also open things for you: a project, the resume, a game, or a whole new design for this site.</p>
      <div class="intent-row">I'm here as a <span class="intent">${["Recruiter", "Engineer", "Just browsing"].map((x) => `<button type="button" class="starter" data-intent="${x}" aria-pressed="${intent === x}">${x}</button>`).join("")}</span></div>
      <div class="starters">${STARTERS.map((s) => `<button type="button" class="starter" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
    setStatus("idle");
  }
  log.addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]"); if (q) { ask(q.dataset.q); return; }
    const it = e.target.closest("[data-intent]"); if (it) { intent = it.dataset.intent; $$("[data-intent]", log).forEach((b) => b.setAttribute("aria-pressed", String(b === it))); return; }
    const sg = e.target.closest("[data-fill]"); if (sg) { chatInput.value = sg.dataset.fill; chatInput.focus(); sg.remove(); return; }
  });
  $("#chat-bar").addEventListener("submit", (e) => {
    e.preventDefault();
    if (streaming) { stopStream(); return; }
    const v = chatInput.value.trim(); if (!v) return;
    chatInput.value = ""; ask(v);
  });
  $$("[data-ask]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.ask)));
  $("#ch-new").addEventListener("click", () => { saveHistory(); msgs = []; lastTopic = null; renderWelcome(); });
  $("#ch-history").addEventListener("click", () => {
    const h = $("#chat-history");
    h.hidden = !h.hidden;
    h.innerHTML = `<p class="h-title">Recent</p>` + (history.length ? history.map((x, i) => `<button type="button" data-h="${i}">${esc(x.title)}</button>`).join("") : `<p class="card-note" style="padding:4px 10px">Chats you start appear here. Saved in this browser only.</p>`);
  });
  $("#chat-history").addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (!b) return; saveHistory(); msgs = history[+b.dataset.h].msgs.slice(); renderAll(); $("#chat-history").hidden = true; });
  $("#ch-export").addEventListener("click", () => copy(msgs.map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.text}`).join("\n\n"), "Transcript copied"));
  function saveHistory() { if (msgs.length) history.unshift({ title: msgs[0].text.slice(0, 48), msgs: msgs.slice() }); history = history.slice(0, 8); }

  const SYS_WORDS = { comic: "comic", ascii: "ascii", terminal: "ascii", glass: "glass", neon: "neon", synthwave: "neon", pixel: "pixel", "8-bit": "pixel", paper: "paper", sketch: "paper", sakura: "sakura", japanese: "sakura", blueprint: "blueprint", brutal: "brutal", "neo-brutalist": "brutal", tide: "tide", ocean: "tide", underwater: "tide", clay: "clay", "98": "win98", desktop: "win98", windows: "win98", retro: "win98" };
  const P = (slug) => PROJECTS.find((p) => p.slug === slug);
  function answer(q) {
    const s = q.toLowerCase();
    const src = (arr) => arr.map((x) => ({ label: x.title || x.role || x.label, target: x.slug ? (x.title ? "project-" + x.slug : "experience-" + x.slug) : x.target }));
    // Style switching (tool: switch_style, auto-run, undoable)
    if (/(style|theme|design|look|show me|as an?|make it|switch|turn)/.test(s)) {
      const hit = Object.keys(SYS_WORDS).find((w) => s.includes(w));
      if (hit) {
        const id = SYS_WORDS[hit];
        return { tools: [{ name: "switch_style", arg: id }], run: () => pickSystem(id, null, { silent: true }), text: `Done. This is **${SYS[id].name}**. Same content and layout, different materials. There are 12 designs and 16 palettes in the dial on the left, or press **T** to cycle through them.`, actions: [{ label: "Undo", run: () => lastState && apply(lastState, null, { silent: true }) }, { label: `Try ${nextSystem(1).name}`, run: () => pickSystem(nextSystem(1).id, null, { silent: true }) }], suggest: ["Show me this site in ASCII", "What has he built?"] };
      }
      if (/(theme|style|design)/.test(s)) return { text: "This site ships 12 complete designs (Liquid Glass, Comic Pop, Neo-Brutalist, Tide Pool, Claymation, ASCII Terminal, Desktop 98, Neon Arcade, Pixel Retro, Paper Sketch, Sakura and Blueprint) plus 16 classic palettes. Pick one and I'll switch the whole site.", actions: [{ label: "Surprise me", run: () => randomSystem() }], suggest: ["Show me this site as a comic", "Make it look like Desktop 98"] };
    }
    // Follow-up rewrite demo
    let rewrite = null;
    if (/\b(it|its|that|this one|the project)\b/.test(s) && lastTopic && !/boilerframe|eeg|arm|qr|happiness|habitat/.test(s)) {
      rewrite = s.includes("stack") || s.includes("built with") || s.includes("tech") ? `What stack did ${lastTopic.title} use?` : `${q.replace(/\bit\b|\bthat\b/i, lastTopic.title)}`;
    }
    const sq = (rewrite || q).toLowerCase();
    if (/boilerframe/.test(sq) && /(stack|tech|built with|use)/.test(sq)) {
      lastTopic = P("boilerframe");
      return { rewrite, text: "BoilerFrame is a **MERN** app: **React** on the front end, **Express** and **Node.js** on the server, **MongoDB** for storage, and **AWS Rekognition** for the facial-recognition pipeline that finds a person across video frames.", sources: src([P("boilerframe")]), actions: [{ label: "Show BoilerFrame", run: () => showTarget("project-boilerframe") }], suggest: ["Has he used React anywhere else?", "What's his strongest ML project?"] };
    }
    if (/boilerframe/.test(sq)) { lastTopic = P("boilerframe"); return { text: "**BoilerFrame** pinpoints every appearance of a target person in a video. You give it reference photos and footage; it runs a facial-recognition pipeline on AWS Rekognition and returns the timestamps. Built on the MERN stack.", sources: src([P("boilerframe")]), actions: [{ label: "Show BoilerFrame", run: () => showTarget("project-boilerframe") }], suggest: ["What stack did it use?"] }; }
    if (/react/.test(sq) && /(else|other|anywhere)/.test(sq)) return { text: "Yes. Besides BoilerFrame, he used **React** at **Hack The Future @ Purdue**, where he built the lesson-delivery UI for a RAG learning platform serving 500+ learners. This site is React too (Next.js).", sources: [{ label: "BoilerFrame", target: "project-boilerframe" }, { label: "Hack The Future", target: "experience-hack-the-future" }], suggest: ["Tell me about the RAG platform"] };
    if (/(eeg|brain|bci|mind|thought|robotic)/.test(sq)) { lastTopic = P("eeg-thought-prediction"); return { text: "Two brain-computer interface projects:\n- **Mind-Controlled Robotic Arm**: a NeuroSky EEG headset and an Arduino drive a robotic arm from thought alone.\n- **Left/Right Thought Prediction**: classifies left, right and neutral thoughts from 16-channel OpenBCI data with TensorFlow models.", sources: src([P("mind-controlled-arm"), P("eeg-thought-prediction")]), actions: [{ label: "Watch the arm demo", run: () => window.open("https://www.youtube.com/watch?v=W8EzUuWgi4o", "_blank", "noopener") }], suggest: ["What stack did it use?", "What research is he doing now?"] }; }
    if (/(built|projects|portfolio|made|work on|strongest)/.test(sq)) { return { text: "Here's everything on record, newest focus first:\n- **BoilerFrame**: finds a person across video with AWS Rekognition (MERN).\n- **Left/Right Thought Prediction**: EEG thought classification with TensorFlow.\n- **Mind-Controlled Robotic Arm**: EEG + Arduino.\n- **Predicting Citizen Happiness**: Lasso regression at Columbia's SHAPE program.\n- **QRIfy**: text-to-QR web app on AWS EC2.\n- **Habitat for Humanity E-Commerce**: one-click listings to Marketplace and eBay.", sources: src(PROJECTS), actions: [{ label: "Open Projects", run: () => showTarget("projects") }], suggest: ["What stack did BoilerFrame use?", "Tell me about the EEG work"] }; }
    if (/(research|tinyml|edge|snowball|lab)/.test(sq)) return { text: "He's an undergraduate researcher in **TinyML** at Purdue's Snowball Lab (Spring 2026 to now), under Prof. Qiuyue \"Shirley\" Xue. The work: squeezing ML models onto low-power embedded hardware with Edge Impulse, and testing piezoelectric microphones that double as the sensor and the power source.", sources: [{ label: "TinyML research", target: "experience-tinyml-research" }], suggest: ["What did he build at Hack The Future?"] };
    if (/(rag platform|hack the future|non-?profit)/.test(sq)) return { text: "At **Hack The Future @ Purdue** he built a full-stack, AI-powered RAG learning platform for a non-profit serving **500+ underserved learners** studying personal finance: the LLM workflow, vector retrieval that grounds answers in lesson content, AI-generated quizzes, and the lesson UI. Stack: React, Node.js, Express, MongoDB, Ollama, Vercel and Cloudflare.", sources: [{ label: "Hack The Future", target: "experience-hack-the-future" }] };
    if (/(experience|worked|job|roles?|career)/.test(sq)) return { text: (intent === "Recruiter" ? "The short version for a recruiter:\n" : "") + "- **Undergraduate Researcher, TinyML**: Snowball Lab, Purdue (Spring 2026 – now)\n- **Software Developer**: Hack The Future @ Purdue (Fall 2025 – Spring 2026)\n- **Investor Relations Chair**: Code Ninjas (Jan – Aug 2025)\n- **Code Sensei**: Code Ninjas (May 2023 – Aug 2025)", sources: src(EXPERIENCE), actions: [{ label: "Open Experience", run: () => showTarget("experience") }, { label: "Open resume", run: () => openModal("resume") }], suggest: ["What research is he doing now?"] };
    if (/(resume|cv)/.test(sq)) return { tools: [{ name: "open_resume", arg: "" }], text: "Here's his resume. It syncs automatically from the Google Doc he edits, so it's always the current version.", actions: [{ label: "Open resume", run: () => openModal("resume") }] };
    if (/(intern|open to|available|hiring|hire|looking for)/.test(sq)) return { text: "Yes. He's open to **software engineering and AI internships**. I don't have specific dates or locations on record, so the quickest way to pin those down is to ask him directly.", actions: [{ label: "Write to Rithvik", run: () => draftEmail("Internship opportunity") }, { label: "Open resume", run: () => openModal("resume") }], suggest: ["What has he built?", "When does he graduate?"] };
    if (/(graduat|gpa|class of|year)/.test(sq)) return { text: "He's doing a **B.S. in Computer Science + Mathematics** at Purdue, with Software Engineering and AI/ML concentrations. His expected graduation date isn't on the site yet, so I won't guess. He can tell you directly.", sources: [{ label: "Education", target: "education" }], actions: [{ label: "Ask Rithvik", run: () => draftEmail("Question about graduation timeline") }] };
    if (/(game|play|arcade|typing|wpm)/.test(sq)) return { tools: [{ name: "start_game", arg: "typeracer" }], text: "The Arcade has eight small games from rithvik.si, each scored against Rithvik's own baseline. Type Racer is a good start: you type a real line from his code.", actions: [{ label: "Play Type Racer", run: () => { showTarget("arcade"); setTimeout(() => openGame("typeracer"), 400); } }, { label: "Open Arcade", run: () => showTarget("arcade") }] };
    if (/(contact|email|reach|talk|message)/.test(sq)) return { tools: [{ name: "draft_email", arg: "" }], text: "The fastest route is the message form on this page; it goes straight to his inbox. His address is **rithvikpkx@gmail.com** if you'd rather use your own mail app.", actions: [{ label: "Write to Rithvik", run: () => draftEmail("") }, { label: "Copy email", run: () => copy("rithvikpkx@gmail.com", "Email copied") }] };
    if (/(where|time|located|location|live)/.test(sq)) { const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date()); return { tools: [{ name: "local_time", arg: "San Francisco" }], text: `He's in **San Francisco** right now, where it's **${t}**. Home is Boston and school is West Lafayette, Indiana.`, actions: [{ label: "Show Now", run: () => showTarget("now") }] }; }
    if (/(how|what).*(site|this|built|work)/.test(sq)) return { text: "This site is Next.js on Vercel with Supabase. I'm a RAG assistant: I rewrite follow-ups into standalone questions, read his full profile plus any uploaded documents, stream an answer with sources, and can take small actions. The 12 designs are one attribute on the page root plus about 40 CSS variables each, so switching never re-renders anything.", actions: [{ label: "Open Under the Hood", run: () => showTarget("hood") }] };
    return { text: "That one isn't on record, so I'd rather not guess. I can tell you about his **projects**, **experience**, **TinyML research**, his **stack**, or how this site works. Or ask him directly.", actions: [{ label: "Write to Rithvik", run: () => draftEmail("") }], suggest: ["What has he built?", "What research is he doing now?"] };
  }
  function md(t) {
    const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const out = []; let list = null;
    t.split("\n").forEach((ln) => {
      if (ln.startsWith("- ")) { if (!list) { list = []; } list.push(`<li>${inline(ln.slice(2))}</li>`); return; }
      if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
      if (ln.trim()) out.push(`<p>${inline(ln)}</p>`);
    });
    if (list) out.push(`<ul>${list.join("")}</ul>`);
    return out.join("");
  }
  function ask(q, opts = {}) {
    openChat();
    if (log.querySelector(".welcome")) log.innerHTML = "";
    if (!opts.regen) msgs.push({ role: "user", text: q });
    const a = answer(q);
    const m = { role: "bot", text: a.text, a, q, done: false };
    msgs.push(m);
    renderAll();
    stream(m);
  }
  function renderAll() {
    log.innerHTML = "";
    msgs.forEach((m, i) => log.appendChild(renderMsg(m, i)));
    log.scrollTop = log.scrollHeight;
  }
  function renderMsg(m, i) {
    const el = document.createElement("div");
    el.className = "msg " + m.role;
    if (m.role === "user") { el.innerHTML = `<div class="bubble">${esc(m.text)}</div>`; return el; }
    const a = m.a;
    el.innerHTML = `${a.rewrite ? `<p class="rewrite">Read as: "${esc(a.rewrite)}"</p>` : ""}
      ${a.tools ? `<div class="msg-tools">${a.tools.map((t) => `<span class="tool-call">⚙ <b>${t.name}</b>(${esc(t.arg)})</span>`).join("")}</div>` : ""}
      <div class="bubble">${m.done ? md(m.text) : `<span class="thinking">Retrieving from 23 records…</span>`}</div>
      <div class="msg-after" ${m.done ? "" : "hidden"}>
        ${a.actions ? `<div class="msg-tools">${a.actions.map((x, k) => `<button type="button" class="action-btn" data-act="${k}">${esc(x.label)}</button>`).join("")}</div>` : ""}
        ${a.sources ? `<details class="sources"><summary>${a.sources.length} source${a.sources.length > 1 ? "s" : ""}</summary><ul>${a.sources.map((x) => `<li><button type="button" data-src="${esc(x.target)}">${esc(x.label)}</button></li>`).join("")}</ul></details>` : ""}
        <div class="msg-actions">
          <button type="button" data-copy-msg aria-label="Copy answer" title="Copy">${dual("⧉", icon("copy"))}</button>
          <button type="button" data-regen aria-label="Regenerate answer" title="Regenerate">${dual("↻", icon("rotate-ccw"))}</button>
          <button type="button" data-up aria-pressed="false" aria-label="Good answer" title="Good answer">${dual("👍", icon("thumbs-up"))}</button>
          <button type="button" data-down aria-pressed="false" aria-label="Bad answer" title="Bad answer">${dual("👎", icon("thumbs-down"))}</button>
        </div>
        ${a.suggest ? `<div class="msg-suggest">${a.suggest.map((s) => `<button type="button" class="suggest-chip" data-fill="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
      </div>`;
    el.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]"); if (act) { a.actions[+act.dataset.act].run(); return; }
      const sr = e.target.closest("[data-src]"); if (sr) { showTarget(sr.dataset.src); return; }
      if (e.target.closest("[data-copy-msg]")) copy(m.text.replace(/\*\*/g, ""), "Answer copied");
      if (e.target.closest("[data-regen]")) { msgs.splice(msgs.indexOf(m), 1); ask(m.q, { regen: true }); }
      const ud = e.target.closest("[data-up],[data-down]");
      if (ud) { $$("[data-up],[data-down]", el).forEach((b) => b.setAttribute("aria-pressed", String(b === ud))); toast("<span>Thanks. Feedback helps tune the assistant.</span>", [], 2200); }
    });
    return el;
  }
  const SPIN = ["·", "✢", "✳", "✶", "✻", "✽"], VERBS = ["Rewriting", "Retrieving", "Reading profile", "Drafting"];
  let spinT = 0;
  function setStatus(mode, extra = "") {
    clearInterval(spinT);
    if (mode === "idle") { status.textContent = `● ready · grounded in 23 records + resume · ctx 4.1k · / to focus · ↑ to edit`; return; }
    let i = 0, t0 = performance.now();
    const F = unslopped() && AS.spinners.dots ? AS.spinners.dots.frames : SPIN;
    spinT = setInterval(() => { status.textContent = `${F[i % F.length]} ${VERBS[Math.min(VERBS.length - 1, Math.floor(i / 6))]}… (${((performance.now() - t0) / 1000).toFixed(1)}s · esc to interrupt)${extra}`; i++; }, 90);
  }
  function stream(m) {
    const el = log.lastElementChild;
    const bubble = $(".bubble", el);
    sendBtn.classList.add("is-stop"); $("#cb-send-ic").innerHTML = dual("■", icon("square")); sendBtn.setAttribute("aria-label", "Stop generating");
    setStatus("busy");
    if (m.a.run) setTimeout(m.a.run, 380);
    const words = m.text.split(/(\s+)/);
    let i = 0;
    const startDelay = 420;
    streaming = { m, timer: 0 };
    const stepFn = () => {
      i = Math.min(words.length, i + 2);
      bubble.innerHTML = md(words.slice(0, i).join("")).replace(/<\/(p|li)>(?![\s\S]*<\/(p|li)>)/, '<span class="caret"></span></$1>');
      if (log.scrollHeight - log.scrollTop - log.clientHeight < 120) log.scrollTop = log.scrollHeight;
      if (i >= words.length) return finish(m, el, false);
      streaming.timer = setTimeout(stepFn, 28);
    };
    streaming.timer = setTimeout(stepFn, startDelay);
  }
  function finish(m, el, stopped) {
    clearTimeout(streaming?.timer);
    streaming = null;
    m.done = true;
    if (stopped) m.text = m.text.split(/\s+/).slice(0, Math.max(3, Math.floor(m.text.split(/\s+/).length / 3))).join(" ") + " …";
    $(".bubble", el).innerHTML = md(m.text) + (stopped ? '<p class="card-note">Stopped.</p>' : "");
    $(".msg-after", el).hidden = false;
    sendBtn.classList.remove("is-stop"); $("#cb-send-ic").innerHTML = dual("↑", icon("arrow-up")); sendBtn.setAttribute("aria-label", "Send");
    setStatus("idle");
    log.scrollTop = log.scrollHeight;
  }
  function stopStream() { if (!streaming) return; finish(streaming.m, log.lastElementChild, true); }
  function editLast() {
    const idx = msgs.map((m) => m.role).lastIndexOf("user"); if (idx < 0) return;
    chatInput.value = msgs[idx].text; msgs = msgs.slice(0, idx); renderAll(); if (!msgs.length) renderWelcome();
  }
  log.addEventListener("scroll", () => { $("#to-latest").hidden = log.scrollHeight - log.scrollTop - log.clientHeight < 80; });
  $("#to-latest").addEventListener("click", () => { log.scrollTop = log.scrollHeight; });
  function showTarget(id) {
    const t = document.getElementById(id); if (!t) return;
    if (innerWidth < 640) closeChat();
    scrollToEl(t, "start");
    t.animate?.([{ outline: "3px solid var(--accent)", outlineOffset: "6px" }, { outline: "3px solid transparent", outlineOffset: "12px" }], { duration: 1600, easing: "ease-out" });
  }
  function draftEmail(subj) {
    showTarget("contact");
    if (subj) $("#cmp-subj").value = subj;
    setTimeout(() => $("#cmp-from").focus({ preventScroll: true }), 500);
  }
  setStatus("idle");

  /* ───────────────────────── Modals ───────────────────────── */
  let lastFocus = null;
  function openModal(name) {
    const m = $("#modal-" + name); if (!m) return;
    lastFocus = document.activeElement;
    if (name === "resume") renderResume();
    if (name === "admin") renderAdmin("overview");
    m.hidden = false;
    lenis?.stop();
    $("[data-close]", m)?.focus();
  }
  function closeModal(m) { m.hidden = true; lenis?.start(); lastFocus?.focus?.(); }
  $$("[data-open]").forEach((b) => b.addEventListener("click", () => openModal(b.dataset.open)));
  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close]")) closeModal(m); });
  });
  function renderResume() {
    $("#pdf-page").innerHTML = `<h1>RITHVIK PRAVEEN KUMAR</h1><p class="pc">rithvikpkx@gmail.com · github.com/rithvikpkx · linkedin.com/in/… · rithvik.ai</p>
      <h2>Education</h2><div class="pr"><span>Purdue University</span><span>West Lafayette, IN</span></div><div class="pi"><span>B.S. Computer Science + Mathematics · Software Engineering, AI/ML</span><span>Expected 20XX</span></div>
      <h2>Experience</h2>${EXPERIENCE.map((x) => `<div class="pr"><span>${esc(x.org)}</span><span>${esc(x.where)}</span></div><div class="pi"><span>${esc(x.role)}</span><span>${esc(x.when)}</span></div><ul>${x.desc.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`).join("")}
      <h2>Projects</h2>${PROJECTS.slice(0, 4).map((p) => `<div class="pr"><span>${esc(p.title)}</span><span>${esc(p.tags.slice(0, 4).join(", "))}</span></div><ul><li>${esc(p.desc[0])}</li></ul>`).join("")}
      <h2>Skills</h2><p><b>Languages:</b> ${STACK.Languages.join(", ")} · <b>Frameworks:</b> ${STACK.Frameworks.join(", ")} · <b>Tools:</b> ${STACK["Infra & data"].join(", ")}</p>`;
  }
  $("#rs-download").addEventListener("click", () => toast("<span>On the live site this downloads <b>Rithvik-Praveen-Kumar-Resume.pdf</b>.</span>"));
  $("#rs-sync").addEventListener("click", () => toast("<span>Pulled the latest PDF from Google Docs. <b>Up to date.</b></span>"));
  $("#rs-upload").addEventListener("click", () => toast("<span>Upload override: pick a PDF to replace the synced copy until the next sync.</span>"));

  function renderAdmin(tab) {
    $$(".tab").forEach((t) => { const on = t.dataset.tab === tab; t.classList.toggle("is-on", on); t.setAttribute("aria-selected", String(on)); });
    const body = $("#admin-body");
    if (tab === "overview") {
      body.innerHTML = `<div class="kpis"><div class="kpi"><b>412</b><span>Visitors</span> <em>${dual("+18%", "+18% vs last week")}</em></div><div class="kpi"><b>23</b><span>Companies identified</span></div><div class="kpi"><b>61</b><span>Chat conversations</span></div><div class="kpi"><b>38</b><span>Resume opens</span></div></div>
        <div class="admin-cols"><div><p class="h3a">Companies (from IP, sample)</p><div style="overflow-x:auto"><table class="a-table"><thead><tr><th>Company</th><th>Visits</th><th>Looked at</th><th>Signal</th></tr></thead><tbody>
          <tr><td>Northwind AI</td><td>4</td><td>Projects, Resume, Chat</td><td><span class="tag hot">Recruiter-like</span></td></tr>
          <tr><td>Acme Robotics</td><td>3</td><td>EEG projects, Experience</td><td><span class="tag hot">Engineer</span></td></tr>
          <tr><td>Globex Labs</td><td>2</td><td>Resume</td><td><span class="tag">Resume only</span></td></tr>
          <tr><td>Initech</td><td>1</td><td>Arcade</td><td><span class="tag">Casual</span></td></tr>
          <tr><td>Purdue University</td><td>9</td><td>Everything</td><td><span class="tag">Campus</span></td></tr>
        </tbody></table></div></div>
        <div><p class="h3a">Sections reached</p><div class="bars">${[["Projects", 82], ["Experience", 64], ["Resume", 38], ["Arcade", 41], ["Chat", 29], ["Contact", 18]].map(([k, v]) => `<div><span>${k}</span><i style="width:${v}%"></i><span>${v}%</span></div>`).join("")}</div>
        <p class="h3a" style="margin-top:16px">Top chat questions</p><ul class="log"><li><time>14×</time><span>What stack did BoilerFrame use?</span></li><li><time>9×</time><span>Is he open to internships?</span></li><li><time>7×</time><span>When does he graduate?</span></li></ul></div></div>`;
    } else {
      body.innerHTML = `<p class="card-note">Only visitors who gave an email (chat, contact form or resume download) can be contacted. Company-level visits show in Overview without contact details. Nothing sends without your approval.</p>
        <div class="outreach">${[
          ["Jordan Lee", "Northwind AI", "Gave email in chat · asked about internships", "Hi Jordan,\nThanks for stopping by and asking about internships. I'm open to SWE and AI roles for summer. Happy to share more about BoilerFrame or my TinyML research. Would a short call next week work?\n— Rithvik"],
          ["Sam Ortiz", "Acme Robotics", "Downloaded resume · read both EEG projects", "Hi Sam,\nI noticed you spent time on my EEG work. If Acme is exploring BCI or embedded ML, I'd love to compare notes.\n— Rithvik"],
          ["Priya N.", "Unknown company", "Contact form · 'loved the Arcade'", "Hi Priya,\nThanks for the kind note about the Arcade! There are more games on rithvik.si.\n— Rithvik"],
        ].map(([n, c, why, d], i) => `<div class="or-item" id="or-${i}"><div class="or-meta"><span><b>${n}</b> · ${c}</span><span>${why}</span></div><p class="or-draft">${esc(d)}</p><div class="or-actions"><button class="btn sm" type="button" data-or="send" data-i="${i}">Approve &amp; send</button><button class="btn ghost sm" type="button" data-or="edit" data-i="${i}">Edit</button><button class="btn ghost sm" type="button" data-or="skip" data-i="${i}">Skip</button></div></div>`).join("")}</div>`;
    }
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => renderAdmin(t.dataset.tab)));
  $("#admin-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-or]"); if (!b) return;
    const item = $("#or-" + b.dataset.i);
    if (b.dataset.or === "edit") { const d = $(".or-draft", item); d.contentEditable = "true"; d.focus(); return; }
    item.classList.add("is-done");
    $$("button", item).forEach((x) => (x.disabled = true));
    toast(b.dataset.or === "send" ? "<span>Sent from <b>hello@rithvik.ai</b> (simulated), with an unsubscribe link.</span>" : "<span>Skipped.</span>", [], 2600);
  });

  /* ───────────────────────── Mockup bar ───────────────────────── */
  const mbNotes = $("#mb-notes"), mbAdmin = $("#mb-admin");
  mbNotes.addEventListener("click", () => { const on = html.classList.toggle("notes"); mbNotes.setAttribute("aria-pressed", String(on)); });
  mbAdmin.addEventListener("click", () => {
    const on = html.classList.toggle("admin");
    mbAdmin.setAttribute("aria-pressed", String(on));
    if (on) { openModal("admin"); toast("<span><b>Admin mode</b>: dashed outlines mark inline-editable text. The resume modal gains Sync now / Upload.</span>", [{ label: "Open dashboard", run: () => openModal("admin") }]); }
  });


  /* ───────────────────────── Base setup (the unslopped version is the site) ───────────────────────── */
  function setVersion() {
    html.classList.add("unslop");
    chatInput.placeholder = "Ask about Rithvik";
    requestAnimationFrame(() => { measureChars(); if (isAscii()) buildName(); });
    renderContrib();
    syncGlobe();
  }
  $("#nav-design").addEventListener("click", (e) => {
    e.stopPropagation();
    ensurePickerFonts();
    dial.classList.add("is-open");
    pillEls[focusIdx]?.focus({ preventScroll: true });
  });
  $("#cb-send-ic").innerHTML = dual("↑", icon("arrow-up"));
  // Unicode arrows standing in for icons become real Lucide arrows in the unslopped version.
  $$("a, button").forEach((el) => {
    if (el.closest(".dial, .mock-bar, .coach, .toast, .buffett-page") || !/[↗→]/.test(el.innerHTML)) return;
    el.innerHTML = el.innerHTML.replace(/\s?↗/g, dual(" ↗", icon("arrow-up-right"))).replace(/\s?→/g, dual(" →", icon("arrow-right")));
  });
  // Real brand marks for the hero social buttons (the originals were hand-drawn look-alikes).
  $$(".socials .icon-btn").forEach((b, i) => { b.querySelector("svg")?.classList.add("v-orig"); b.insertAdjacentHTML("beforeend", `<span class="v-un">${[logo("github"), logo("linkedin"), icon("mail")][i] || ""}</span>`); });
  hydrateIcons();
  setVersion();


  /* ───────────────────────── Logo: an ouroboros on a lemniscate ───────────────────────── */
  // A snake travels an infinity loop and chases its own tail: four tapering strokes share one head position,
  // driven by SMIL so the body (dash offset) and head (animateMotion) stay on one clock.
  const LEM = "M46.00 0.00 L45.89 2.07 L45.58 4.11 L45.06 6.09 L44.35 7.98 L43.46 9.75 L42.42 11.39 L41.23 12.87 L39.94 14.19 L38.54 15.34 L37.07 16.31 L35.54 17.11 L33.98 17.74 L32.40 18.21 L30.81 18.51 L29.23 18.67 L27.66 18.70 L26.12 18.59 L24.60 18.37 L23.12 18.05 L21.68 17.63 L20.29 17.13 L18.93 16.55 L17.61 15.91 L16.34 15.20 L15.11 14.45 L13.92 13.65 L12.76 12.80 L11.64 11.93 L10.55 11.02 L9.50 10.09 L8.47 9.14 L7.46 8.16 L6.48 7.17 L5.52 6.17 L4.57 5.16 L3.64 4.14 L2.72 3.11 L1.81 2.08 L0.90 1.04 L0.00 0.00 L-0.90 -1.04 L-1.81 -2.08 L-2.72 -3.11 L-3.64 -4.14 L-4.57 -5.16 L-5.52 -6.17 L-6.48 -7.17 L-7.46 -8.16 L-8.47 -9.14 L-9.50 -10.09 L-10.55 -11.02 L-11.64 -11.93 L-12.76 -12.80 L-13.92 -13.65 L-15.11 -14.45 L-16.34 -15.20 L-17.61 -15.91 L-18.93 -16.55 L-20.29 -17.13 L-21.68 -17.63 L-23.12 -18.05 L-24.60 -18.37 L-26.12 -18.59 L-27.66 -18.70 L-29.23 -18.67 L-30.81 -18.51 L-32.40 -18.21 L-33.98 -17.74 L-35.54 -17.11 L-37.07 -16.31 L-38.54 -15.34 L-39.94 -14.19 L-41.23 -12.87 L-42.42 -11.39 L-43.46 -9.75 L-44.35 -7.98 L-45.06 -6.09 L-45.58 -4.11 L-45.89 -2.07 L-46.00 -0.00 L-45.89 2.07 L-45.58 4.11 L-45.06 6.09 L-44.35 7.98 L-43.46 9.75 L-42.42 11.39 L-41.23 12.87 L-39.94 14.19 L-38.54 15.34 L-37.07 16.31 L-35.54 17.11 L-33.98 17.74 L-32.40 18.21 L-30.81 18.51 L-29.23 18.67 L-27.66 18.70 L-26.12 18.59 L-24.60 18.37 L-23.12 18.05 L-21.68 17.63 L-20.29 17.13 L-18.93 16.55 L-17.61 15.91 L-16.34 15.20 L-15.11 14.45 L-13.92 13.65 L-12.76 12.80 L-11.64 11.93 L-10.55 11.02 L-9.50 10.09 L-8.47 9.14 L-7.46 8.16 L-6.48 7.17 L-5.52 6.17 L-4.57 5.16 L-3.64 4.14 L-2.72 3.11 L-1.81 2.08 L-0.90 1.04 L-0.00 0.00 L0.90 -1.04 L1.81 -2.08 L2.72 -3.11 L3.64 -4.14 L4.57 -5.16 L5.52 -6.17 L6.48 -7.17 L7.46 -8.16 L8.47 -9.14 L9.50 -10.09 L10.55 -11.02 L11.64 -11.93 L12.76 -12.80 L13.92 -13.65 L15.11 -14.45 L16.34 -15.20 L17.61 -15.91 L18.93 -16.55 L20.29 -17.13 L21.68 -17.63 L23.12 -18.05 L24.60 -18.37 L26.12 -18.59 L27.66 -18.70 L29.23 -18.67 L30.81 -18.51 L32.40 -18.21 L33.98 -17.74 L35.54 -17.11 L37.07 -16.31 L38.54 -15.34 L39.94 -14.19 L41.23 -12.87 L42.42 -11.39 L43.46 -9.75 L44.35 -7.98 L45.06 -6.09 L45.58 -4.11 L45.89 -2.07 Z";
  let logoN = 0;
  function logoSVG() {
    const id = "lem" + (++logoN), D = 9;
    const seg = (len, w, op) => `<path d="${LEM}" pathLength="1000" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${len} ${1000 - len}" stroke-dashoffset="${len}" opacity="${op}"><animate attributeName="stroke-dashoffset" values="${len};${len - 1000}" dur="${D}s" repeatCount="indefinite"/></path>`;
    return `<svg class="ouro-mark" viewBox="-56 -32 112 64" aria-hidden="true" focusable="false"><path id="${id}" d="${LEM}" fill="none" stroke="currentColor" stroke-width="1" opacity=".14"/>${seg(930, 1.4, 0.4)}${seg(720, 2.6, 0.7)}${seg(470, 4, 1)}${seg(220, 5.6, 1)}<g class="om-head"><path d="M-4 -4.6 C2.5 -5.6 8.6 -3 10.4 0 C8.6 3 2.5 5.6 -4 4.6 Z" style="fill:var(--accent)"/><circle cx="4.6" cy="-1.7" r="1.15" style="fill:var(--bg)"/><animateMotion dur="${D}s" repeatCount="indefinite" rotate="auto"><mpath href="#${id}"/></animateMotion></g></svg>`;
  }
  $$(".logo-slot").forEach((slot) => { slot.innerHTML = logoSVG(); });
  if (reduceMotion()) $$(".ouro-mark").forEach((svg) => svg.pauseAnimations?.());

  /* ───────────────────────── Records: a scratchable turntable (Web Audio) ───────────────────────── */
  const vinyl = $("#vinyl"), disc = $("#vinyl-disc"), deckEl = $("#deck"), powerBtn = $("#deck-power");
  const DEG_PER_SEC = 78 * 6;                 // a 1927 shellac spins at 78 rpm
  const SEC_PER_DEG = 1 / DEG_PER_SEC;
  const deck = { ctx: null, out: null, buf: null, rev: null, src: null, srcGain: null, loading: null, on: false, dragging: false, angle: 0, vel: 0, pos: 0, lastA: 0, lastT: 0, grainT: 0, raf: 0, last: 0, visible: true };
  const durS = () => (deck.buf ? deck.buf.duration : 72);
  const wrapS = (t) => ((t % durS()) + durS()) % durS();
  const fmtS = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  /** Decode the record once on first use, plus a reversed mono copy for backward scratches. */
  function loadAudio() {
    if (deck.loading) return deck.loading;
    deck.loading = (async () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      deck.ctx = new AC();
      deck.out = deck.ctx.createGain(); deck.out.gain.value = 0.9; deck.out.connect(deck.ctx.destination);
      const res = await fetch("assets/chili-pepper.mp3");
      deck.buf = await deck.ctx.decodeAudioData(await res.arrayBuffer());
      const n = deck.buf.length, rev = deck.ctx.createBuffer(1, n, deck.buf.sampleRate), o = rev.getChannelData(0);
      const L = deck.buf.getChannelData(0), R = deck.buf.numberOfChannels > 1 ? deck.buf.getChannelData(1) : L;
      for (let i = 0; i < n; i++) o[i] = (L[n - 1 - i] + R[n - 1 - i]) * 0.5;
      deck.rev = rev;
      $("#deck-dur").textContent = fmtS(durS());
    })();
    return deck.loading;
  }
  /** Main playback from the needle's position; ramps from the platter's current speed (spin-up). */
  function startMain(fromRate) {
    stopMain(false);
    const ctx = deck.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = deck.buf; s.loop = true; s.connect(g); g.connect(deck.out);
    s.playbackRate.setValueAtTime(Math.max(0.01, fromRate), t);
    s.playbackRate.linearRampToValueAtTime(1, t + 0.55);
    s.start(t, wrapS(deck.pos));
    deck.src = s; deck.srcGain = g;
  }
  /** Stop playback: a pitch-dropping spin-down when powered off, a quick cut when a hand grabs the record. */
  function stopMain(spinDown) {
    const s = deck.src; if (!s) return; deck.src = null;
    const t = deck.ctx.currentTime;
    if (spinDown) { s.playbackRate.cancelScheduledValues(t); s.playbackRate.setValueAtTime(s.playbackRate.value, t); s.playbackRate.exponentialRampToValueAtTime(0.02, t + 0.9); deck.srcGain.gain.setTargetAtTime(0, t + 0.6, 0.12); s.stop(t + 1.1); }
    else { deck.srcGain.gain.setTargetAtTime(0, t, 0.008); s.stop(t + 0.05); }
  }
  /** One scratch grain: ~70 ms of audio at the needle, forwards or backwards, pitched by hand speed. */
  function grain(rate) {
    if (!deck.buf) return;
    const ctx = deck.ctx, t = ctx.currentTime, fwd = rate >= 0, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = fwd ? deck.buf : deck.rev;
    s.playbackRate.value = Math.min(3.5, Math.max(0.12, Math.abs(rate)));
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.95, t + 0.005); g.gain.setTargetAtTime(0, t + 0.045, 0.014);
    s.connect(g); g.connect(deck.out);
    s.start(t, fwd ? wrapS(deck.pos) : wrapS(durS() - deck.pos), 0.12);
  }
  function paintDeck() {
    disc.style.transform = `rotate(${(deck.angle % 360).toFixed(2)}deg)`;
    const pr = deck.pos / durS();
    $("#deck-pos").textContent = fmtS(deck.pos);
    $("#deck-prog").style.transform = `scaleX(${pr.toFixed(4)})`;
    deckEl.style.setProperty("--prog", pr.toFixed(3));
    vinyl.setAttribute("aria-valuenow", deck.pos.toFixed(0));
    vinyl.setAttribute("aria-valuetext", fmtS(deck.pos));
  }
  /** Platter physics: eases toward 78 rpm when on, coasts to a stop when off; idles when nothing moves. */
  function deckFrame(now) {
    deck.raf = 0;
    const dt = deck.last ? Math.min(0.05, (now - deck.last) / 1000) : 0; deck.last = now;
    if (!deck.dragging) {
      const target = deck.on ? DEG_PER_SEC : 0;
      deck.vel += (target - deck.vel) * Math.min(1, dt * (deck.on ? 4.2 : 2.4));
      if (!deck.on && Math.abs(deck.vel) < 2) deck.vel = 0;
      deck.angle += deck.vel * dt;
      deck.pos = wrapS(deck.pos + deck.vel * dt * SEC_PER_DEG);
    }
    if (deck.visible) paintDeck();
    if (deck.on || deck.vel !== 0 || deck.dragging) deck.raf = requestAnimationFrame(deckFrame); else deck.last = 0;
  }
  const kickDeck = () => { if (!deck.raf) { deck.last = 0; deck.raf = requestAnimationFrame(deckFrame); } };
  new IntersectionObserver((en) => { deck.visible = en[0].isIntersecting; }).observe(deckEl);
  powerBtn.addEventListener("click", async () => {
    const label = $("#deck-power-label");
    if (!deck.buf) label.textContent = "Loading";
    await loadAudio();
    if (deck.ctx.state === "suspended") await deck.ctx.resume();
    deck.on = !deck.on;
    powerBtn.setAttribute("aria-pressed", String(deck.on));
    label.textContent = deck.on ? "Stop" : "Play";
    deckEl.classList.toggle("is-on", deck.on);
    if (deck.on) startMain(deck.vel / DEG_PER_SEC); else stopMain(true);
    kickDeck();
  });
  const angleAt = (e) => { const r = vinyl.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  vinyl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    vinyl.setPointerCapture(e.pointerId);
    deck.dragging = true; deck.vel = 0; deck.lastA = angleAt(e); deck.lastT = performance.now();
    deckEl.classList.add("is-scratching");
    loadAudio().then(() => { if (deck.ctx.state === "suspended") deck.ctx.resume(); if (deck.dragging) stopMain(false); });
    if (deck.src) stopMain(false);
    kickDeck();
  });
  vinyl.addEventListener("pointermove", (e) => {
    if (!deck.dragging) return;
    const a = angleAt(e), now = performance.now();
    let d = a - deck.lastA; if (d > 180) d -= 360; if (d < -180) d += 360;
    const v = d / (Math.max(4, now - deck.lastT) / 1000);
    deck.vel = deck.vel * 0.45 + v * 0.55;
    deck.angle += d; deck.pos = wrapS(deck.pos + d * SEC_PER_DEG);
    deck.lastA = a; deck.lastT = now;
    if (now - deck.grainT > 26 && Math.abs(d) > 0.25) { deck.grainT = now; grain(deck.vel / DEG_PER_SEC); }
  });
  const releaseDeck = () => {
    if (!deck.dragging) return;
    deck.dragging = false;
    deckEl.classList.remove("is-scratching");
    if (deck.on && deck.buf) startMain(Math.min(1, Math.abs(deck.vel) / DEG_PER_SEC));
    kickDeck();
  };
  vinyl.addEventListener("pointerup", releaseDeck);
  vinyl.addEventListener("pointercancel", releaseDeck);
  vinyl.addEventListener("keydown", async (e) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    await loadAudio();
    if (deck.ctx.state === "suspended") deck.ctx.resume();
    deck.angle += dir * 36; deck.pos = wrapS(deck.pos + dir * 36 * SEC_PER_DEG);
    grain(dir * 1.3); paintDeck();
  });

  /* ───────────────────────── Misc: copy, composer, nav, refraction ───────────────────────── */
  function copy(text, msg = "Copied") {
    const ok = () => toast(`<span>${esc(msg)}</span>`, [], 1800);
    try { navigator.clipboard.writeText(text).then(ok, () => fallbackCopy(text, ok)); } catch (e) { fallbackCopy(text, ok); }
  }
  function fallbackCopy(text, ok) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); ok(); } catch (e) { toast(`<span>Select and copy: <b>${esc(text)}</b></span>`); }
    ta.remove();
  }
  document.addEventListener("click", (e) => { const c = e.target.closest("[data-copy]"); if (c) copy(c.dataset.copy, c.dataset.copy.includes("@") && c.dataset.copy.length < 40 ? "Email address copied" : "Copied"); });
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const from = $("#cmp-from").value.trim(), body = $("#cmp-body").value.trim();
    const badFrom = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from), badBody = !body;
    $("#err-from").hidden = !(unslopped() && badFrom); $("#err-body").hidden = !(unslopped() && badBody);
    $("#cmp-from").setAttribute("aria-invalid", String(badFrom)); $("#cmp-body").setAttribute("aria-invalid", String(badBody));
    if (badFrom) { if (!unslopped()) toast("<span>Add your email so Rithvik can reply.</span>"); $("#cmp-from").focus(); return; }
    if (badBody) { if (!unslopped()) toast("<span>Write a message first.</span>"); $("#cmp-body").focus(); return; }
    e.target.reset();
    toast("<span><b>Sent.</b> (Simulated in the mockup.) Rithvik replies from his own inbox.</span>");
  });
  const navLinks = $$(".nav-links a");
  const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + x.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
  ["projects", "experience", "education", "contact", "beyond", "now", "arcade", "hood", "notes"].forEach((id) => io.observe(document.getElementById(id)));

  if (/Chrom(e|ium)\//.test(navigator.userAgent) && CSS.supports("backdrop-filter", "url(#lg-refract)")) {
    const N = 128, c = document.createElement("canvas"); c.width = c.height = N;
    const x = c.getContext("2d"), map = x.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = ((i + 0.5) / N) * 2 - 1, v = ((j + 0.5) / N) * 2 - 1, edge = 1 - Math.max(Math.abs(u), Math.abs(v)), m = Math.pow(Math.max(0, 1 - edge / 0.22), 2), k = (i + j * N) * 4;
      map.data[k] = 128 - u * 127 * m; map.data[k + 1] = 128 - v * 127 * m; map.data[k + 2] = 128; map.data[k + 3] = 255;
    }
    x.putImageData(map, 0, 0);
    $("#lg-map").setAttribute("href", c.toDataURL());
    html.classList.add("refract");
  }

  /* ───────────────────────── React to design changes ───────────────────────── */
  onChange(() => {
    rainColor = state.mode === "dark" ? "#ffb000" : "#33ff00";
    if (isAscii()) {
      sizeRain();
      const go = () => requestAnimationFrame(() => { buildName(); buildPortrait(); drawOuro(); torusFrame(true); });
      document.fonts?.load?.('8px "JetBrains Mono"').then(go, go) || go();
    }
    measureChars();
  });
  addEventListener("resize", () => { if (isAscii()) { buildName(); buildPortrait(); } });
  if (state.system !== "classic") ensureFonts(state.system);
  document.fonts?.ready?.then(() => { measureChars(); if (isAscii()) buildName(); });
  commit();
})();
