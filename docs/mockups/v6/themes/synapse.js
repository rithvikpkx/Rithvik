/* Synapse: rithvik.ai as a connectome. The home is a wired graph with the portrait as its hub;
   every project, role, school and skill is a glyph node on solid (built), dashed (in progress) or
   dotted (uses) edges. A faint EEG field runs underneath. Below it, the same record as a plain,
   linear read for anyone scanning. Contract: CONTRACT.md. */
(() => {
  const PAPER = "#F4F3EE", INK = "#161616", OR = "#FF5A1F", CY = "#00B8C9";

  /* ───────── Glyphs: ◆ project ▲ research ⬢ role ■ school ● skill ○ learning ───────── */
  const GLY = {
    project: '<path class="f" d="M0 -6.4 6.4 0 0 6.4 -6.4 0Z"/>',
    research: '<path class="s" d="M0 -6.2 6.6 5.2 -6.6 5.2Z"/><circle class="f" cy="1.8" r="1.5"/>',
    role: '<path class="s" d="M0 -6.6 5.7 -3.3 5.7 3.3 0 6.6 -5.7 3.3 -5.7 -3.3Z"/>',
    school: '<rect class="s" x="-5.4" y="-5.4" width="10.8" height="10.8"/><circle class="f" r="1.6"/>',
    skill: '<circle class="f" r="3.4"/>',
    learning: '<circle class="s d" r="5.6"/><circle class="f o" r="1.8"/>',
    toy: '<circle class="s" r="5.8"/><path class="f o2" d="M-1.9 -3.1 3.4 0 -1.9 3.1Z"/>',
  };
  const glyph = (t) => `<svg class="sy-gl sy-gl-${t}" viewBox="-8 -8 16 16" aria-hidden="true">${GLY[t]}</svg>`;
  // inline glyph for running text (font fallbacks draw ⬢ and ◆ inconsistently)
  const gi = (t) => glyph(t).replace('class="sy-gl ', 'class="sy-gi sy-gl ');
  const TYPE = { project: "Project", research: "Research", role: "Role", school: "School", skill: "Skill", learning: "Learning", play: "Play", toy: "Toy" };

  /* ───────── The graph. Precomputed layout: d = desktop box 1000×1000, m = phone box 1000×1250 ───────── */
  // hub: photo centre + portrait width (viewBox units) per layout
  const HUB = { d: { x: 500, y: 450, w: 330 }, m: { x: 500, y: 560, w: 470 } };
  const NODES = [
    { id: "eeg", t: "project", ref: "eeg-thought-prediction", label: "Left/Right Thought Prediction", short: "Thought Prediction", d: [300, 150], m: [210, 130] },
    { id: "arm", t: "project", ref: "mind-controlled-arm", label: "Mind-Controlled Robotic Arm", short: "Robotic Arm", d: [150, 370], m: [130, 400] },
    { id: "boilerframe", t: "project", ref: "boilerframe", label: "BoilerFrame", short: "BoilerFrame", d: [860, 350], m: [870, 400] },
    { id: "qrify", t: "project", ref: "qrify", label: "QRIfy", short: "QRIfy", d: [840, 610], m: [880, 690] },
    { id: "happiness", t: "project", ref: "citizen-happiness", label: "Predicting Citizen Happiness", short: "Citizen Happiness", d: [130, 735], m: [180, 960] },
    { id: "habitat", t: "project", ref: "habitat-humanity-ecomm", label: "Habitat for Humanity E-Commerce", short: "Habitat E-Commerce", d: [240, 935], m: [190, 1150] },
    { id: "tinyml", t: "research", ref: "tinyml-research", label: "TinyML research", short: "TinyML research", d: [650, 130], m: [560, 90] },
    { id: "htf", t: "role", ref: "hack-the-future", label: "Hack The Future", short: "Hack The Future", d: [880, 800], m: [830, 960] },
    { id: "cnir", t: "role", ref: "code-ninjas-ir", label: "Investor Relations Chair", short: "IR Chair", d: [650, 975], m: [450, 1190] },
    { id: "sensei", t: "role", ref: "code-ninjas-sensei", label: "Code Sensei", short: "Code Sensei", d: [790, 880], m: [720, 1150] },
    { id: "purdue", t: "school", ref: "purdue", label: "Purdue University", short: "Purdue", d: [150, 590], m: [130, 690] },
    { id: "learn", t: "learning", ref: "learning", label: "Energy-harvesting sensors", short: "Energy harvesting", d: [880, 175], m: [860, 160] },
    { id: "s-eeg", t: "skill", ref: "EEG", label: "EEG", d: [90, 205], m: null },
    { id: "s-tf", t: "skill", ref: "TensorFlow", label: "TensorFlow", d: [440, 40], m: null },
    { id: "s-ard", t: "skill", ref: "Arduino", label: "Arduino", d: [50, 470], m: null },
    { id: "s-ei", t: "skill", ref: "Edge Impulse", label: "Edge Impulse", d: [760, 40], m: null },
    { id: "s-aws", t: "skill", ref: "AWS", label: "AWS", d: [965, 480], m: null },
    { id: "s-react", t: "skill", ref: "React", label: "React", d: [965, 715], m: null },
    { id: "s-rag", t: "skill", ref: "RAG", label: "RAG", d: [970, 900], m: null },
    { id: "s-sk", t: "skill", ref: "scikit-learn", label: "scikit-learn", d: [45, 860], m: null },
    { id: "s-teach", t: "skill", ref: "Teaching", label: "Teaching", d: [880, 965], m: null },
    // the play cluster: an island of its own, wired after everything else
    { id: "play", t: "play", ref: "play", label: "Play", d: [490, 805], m: [500, 965] },
    { id: "p-records", t: "toy", ref: "records", label: "Records", d: [391, 769], m: null, lp: "l" },
    { id: "p-artboard", t: "toy", ref: "artboard", label: "Artboard", d: [391, 841], m: null, lp: "l" },
    { id: "p-typeracer", t: "toy", ref: "typeracer", label: "Type Racer", d: [589, 769], m: null, lp: "r" },
    { id: "p-angle", t: "toy", ref: "angle", label: "Angle", d: [589, 841], m: null, lp: "r" },
    { id: "p-dots", t: "toy", ref: "dots", label: "Dots", d: [446, 902], m: null, lp: "l" },
    { id: "p-center", t: "toy", ref: "center", label: "Center", d: [534, 902], m: null, lp: "r" },
  ];
  const NODE = Object.fromEntries(NODES.map((n) => [n.id, n]));
  // [from, to, kind]  s = built, d = in progress / learning, u = uses. "hub" is the portrait.
  const EDGES = [
    ["hub", "eeg", "d"], ["hub", "arm", "s"], ["hub", "boilerframe", "s"], ["hub", "qrify", "s"], ["hub", "happiness", "s"], ["hub", "habitat", "s"],
    ["hub", "tinyml", "d"], ["hub", "htf", "s"], ["hub", "sensei", "s"], ["hub", "purdue", "s"], ["hub", "learn", "d"],
    ["tinyml", "learn", "d"], ["sensei", "cnir", "s"],
    ["s-eeg", "eeg", "u"], ["s-eeg", "arm", "u"], ["s-tf", "eeg", "u"], ["s-ard", "arm", "u"], ["s-ei", "tinyml", "u"], ["s-aws", "boilerframe", "u"], ["s-aws", "qrify", "u"],
    ["s-react", "boilerframe", "u"], ["s-react", "htf", "u"], ["s-rag", "htf", "u"], ["s-sk", "happiness", "u"], ["s-teach", "sensei", "u"],
    ["play", "p-records", "p"], ["play", "p-artboard", "p"], ["play", "p-typeracer", "p"], ["play", "p-angle", "p"], ["play", "p-dots", "p"], ["play", "p-center", "p"],
  ];
  // ports: where a hub edge leaves the photo (deg, y down); the bottom arc belongs to the contact beams
  const PORT = { d: { htf: 14, sensei: 24, habitat: 160, happiness: 168, purdue: 172 }, m: { htf: 20, sensei: 30, habitat: 150, happiness: 160 } };

  const f1 = (v) => Math.round(v * 10) / 10;
  /** Edge geometry: hub edges leave the photo radially and bend into the node; others run straight. */
  function edgePath(a, b, L) {
    const hub = HUB[L], B = NODE[b][L];
    if (a === "hub") {
      const r = hub.w * 0.375 + 6, raw = (Math.atan2(B[1] - hub.y, B[0] - hub.x) * 180) / Math.PI;
      let deg = PORT[L][b] ?? raw;
      if (deg > 38 && deg < 142) deg = deg < 90 ? 38 : 142; // never through the beams
      const th = (deg * Math.PI) / 180, dist = Math.hypot(B[0] - hub.x, B[1] - hub.y);
      const s = [hub.x + r * Math.cos(th), hub.y + r * Math.sin(th)], k = r + dist * 0.42;
      const c = [hub.x + k * Math.cos(th), hub.y + k * Math.sin(th)];
      const dx = B[0] - c[0], dy = B[1] - c[1], dl = Math.hypot(dx, dy) || 1, e = [B[0] - (dx / dl) * 13, B[1] - (dy / dl) * 13];
      return `M${f1(s[0])} ${f1(s[1])}Q${f1(c[0])} ${f1(c[1])} ${f1(e[0])} ${f1(e[1])}`;
    }
    const A = NODE[a][L], dx = B[0] - A[0], dy = B[1] - A[1], dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    return `M${f1(A[0] + ux * 11)} ${f1(A[1] + uy * 11)}L${f1(B[0] - ux * 13)} ${f1(B[1] - uy * 13)}`;
  }

  /* ───────── Deterministic waveforms (seeded) for the halo and the record traces ───────── */
  const seedOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  const rng = (seed) => { let s = seed % 2147483647; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  /** An EEG-like polyline across w×h: three bands plus a few spikes. */
  function trace(seed, w, h, spikes = 3) {
    const r = rng(seed), ph = [r() * 6, r() * 6, r() * 6], sp = Array.from({ length: spikes }, () => 0.08 + r() * 0.84);
    let d = "";
    for (let x = 0; x <= w; x += 3) {
      const u = x / w;
      let y = Math.sin(u * 19 + ph[0]) * 0.22 + Math.sin(u * 47 + ph[1]) * 0.12 + Math.sin(u * 131 + ph[2]) * 0.06;
      sp.forEach((s) => { const q = (u - s) * 160; y += Math.exp(-q * q) * 1.4 - Math.exp(-(q - 1.6) * (q - 1.6)) * 0.6; });
      d += (x ? "L" : "M") + x + " " + f1(h / 2 - y * h * 0.32);
    }
    return d;
  }
  /** Polar EEG arc over the top of the photo, plus a tick ring (halo viewBox -100..100). */
  function halo() {
    const r = rng(41); let arc = "";
    for (let i = 0; i <= 220; i++) {
      const a = Math.PI * (1.12 + (i / 220) * 0.76), ph = i / 220;
      let v = Math.sin(ph * 40) * 1.2 + Math.sin(ph * 97 + 1) * 0.7;
      [0.21, 0.5, 0.77].forEach((s) => { const q = (ph - s) * 90; v += Math.exp(-q * q) * 7 - Math.exp(-(q - 1.5) * (q - 1.5)) * 3; });
      const rad = 64 + v;
      arc += (i ? "L" : "M") + f1(Math.cos(a) * rad) + " " + f1(Math.sin(a) * rad);
    }
    let ticks = "";
    for (let i = 0; i < 144; i++) {
      const a = (i / 144) * Math.PI * 2, l = i % 12 === 0 ? 6 : i % 3 === 0 ? 3.2 : 1.6, r0 = 96;
      ticks += `M${f1(Math.cos(a) * r0)} ${f1(Math.sin(a) * r0)}L${f1(Math.cos(a) * (r0 - l))} ${f1(Math.sin(a) * (r0 - l))}`;
    }
    void r;
    return `<svg class="sy-halo-arc" viewBox="-100 -100 200 200" aria-hidden="true"><path class="sy-arc" d="${arc}"/><path class="sy-arc-hot" d="${arc}" pathLength="1"/></svg>
      <div class="sy-ring"><svg viewBox="-100 -100 200 200" aria-hidden="true"><path d="${ticks}"/><circle r="99.4"/></svg></div>`;
  }

  /* ───────── Node facts, all read from C ───────── */
  function info(n, C, H) {
    const { esc, chip, icon } = H;
    if (n.t === "project") {
      const p = H.P(n.ref), i = C.projects.indexOf(p) + 1;
      const links = Object.entries(p.links).map(([k, v]) => `<a class="sy-btn" href="${v}" target="_blank" rel="noopener">${esc(k)} ${icon("arrow-up-right")}</a>`).join("");
      return { k: `${gi("project")} ${String(i).padStart(2, "0")} · ${esc(p.kind)}`, h: esc(p.title), lede: esc(p.headline), list: p.desc, tags: p.tags.map(chip).join(""),
        acts: `<button type="button" class="sy-btn pri" data-case="${p.slug}">Open case sheet ${icon("arrow-right")}</button>${links}` };
    }
    if (n.t === "research" || n.t === "role") {
      const x = C.experience.find((e) => e.slug === n.ref);
      return { k: `${gi(n.t)} ${esc(x.when)} · ${esc(x.where)}`, h: esc(x.role), lede: esc(x.org), list: x.desc, tags: x.tags.map(chip).join(""), acts: "" };
    }
    if (n.t === "school") {
      const e = C.education;
      return { k: `${gi("school")} School`, h: esc(e.school), lede: `${esc(e.degree)}<br><span class="sy-mute">${esc(e.focus)} · ${esc(e.grad)}</span>`, list: [], tags: "", acts: "", logo: e.logo };
    }
    if (n.t === "learning") {
      const x = C.experience.find((e) => e.slug === "tinyml-research");
      return { k: `${gi("learning")} Learning now`, h: esc(C.now.learning), lede: `Researching ${esc(C.now.researching)}.`, list: [x.desc[1]], tags: "", acts: "" };
    }
    if (n.t === "play") return { k: `${gi("toy")} Play`, h: "Play", lede: "", list: [], tags: "",
      acts: `<div class="sy-dtoys">${(H.PLAY || []).map((p) => `<button type="button" data-play="${p.id}">${H.icon(p.icon)}<b>${H.esc(p.name)}</b><span>${H.esc(p.desc)}</span></button>`).join("")}</div>` };
    const used = [...C.projects.filter((p) => p.tags.includes(n.ref)).map((p) => p.title), ...C.experience.filter((e) => e.tags.includes(n.ref)).map((e) => `${e.role}, ${e.org}`)];
    const group = Object.entries(C.stack).find(([, v]) => v.includes(n.ref));
    return { k: `${gi("skill")} Skill${group ? " · " + esc(group[0]) : ""}`, h: esc(n.ref), lede: used.length ? "Used in" : "", list: used, tags: "", acts: "" };
  }
  const neighbours = (id) => EDGES.filter((e) => e[0] === id || e[1] === id).map((e) => (e[0] === id ? e[1] : e[0]));

  /* ───────── Markup ───────── */
  function graphHTML(L, C, H) {
    const hub = HUB[L], W = 1000, Ht = L === "d" ? 1000 : 1250, vis = (id) => id === "hub" || !!NODE[id][L];
    const live = EDGES.filter((e) => vis(e[0]) && vis(e[1]));
    // arrival: axons grow out of the hub in distance order, then on to the skills; nodes fire as they're reached
    const arr = { hub: 0, play: 1.9 }, go = {}, GROW = 0.8;
    live.filter((e) => e[0] === "hub").forEach(([, b]) => { const B = NODE[b][L]; go[b] = 0.25 + Math.hypot(B[0] - hub.x, B[1] - hub.y) / 1000; arr[b] = go[b] + GROW; });
    for (let pass = 0; pass < 2; pass++) live.forEach(([a, b]) => {
      const key = a + ">" + b; if (a === "hub" || go[key] !== undefined) return;
      if (arr[a] !== undefined) { go[key] = arr[a] + 0.05; arr[b] ??= go[key] + GROW; }
      else if (arr[b] !== undefined) { go[key] = -(arr[b] + 0.05); arr[a] ??= -go[key] + GROW; }
    });
    const r = rng(9);
    const paths = live.map(([a, b, k], i) => {
      const d = edgePath(a, b, L), spike = k !== "u" || i % 2 === 0, g = a === "hub" ? go[b] : go[a + ">" + b] ?? 0.5;
      const dur = (2.6 + r() * 3.2).toFixed(2), del = (Math.abs(g) + 1.2 + r() * 3).toFixed(2);
      return `<g class="sy-e sy-e-${k}" data-a="${a}" data-b="${b}" style="--g:${Math.abs(g).toFixed(2)}s"><path class="sy-ep" d="${d}"/><path class="sy-gr${g < 0 ? " rev" : ""}" d="${d}" pathLength="1"/>${spike ? `<path class="sy-sp" d="${d}" pathLength="1" style="animation-duration:${dur}s;animation-delay:${del}s"/>` : ""}</g>`;
    }).join("");
    const ord = {};
    const toys = new Set((H.PLAY || []).map((p) => p.id));
    const nodes = NODES.filter((n) => n[L] && (n.t !== "toy" || toys.has(n.ref))).map((n) => {
      const [x, y] = n[L], t = n.t;
      ord[t] = (ord[t] || 0) + 1;
      let sub = "";
      if (t === "project") { const p = H.P(n.ref); sub = `${String(C.projects.indexOf(p) + 1).padStart(2, "0")} · ${H.esc(p.kind)}`; }
      else if (t === "research" || t === "role") { const e = C.experience.find((x2) => x2.slug === n.ref); sub = `${H.esc(e.when)}${t === "role" && e.org.startsWith("Code") ? " · Code Ninjas" : t === "research" ? " · Snowball Lab" : ""}`; }
      else if (t === "school") sub = "CS + Math";
      else if (t === "learning") sub = "learning now";
      else if (t === "play") sub = `${(H.PLAY || []).length} toys`;
      const lp = n.lp ? " lp-" + n.lp : x > 860 && t === "skill" ? " lp-l" : x < 120 && t === "skill" ? " lp-r" : "";
      const extra = t === "toy" ? ` data-play="${n.ref}"` : "";
      return `<button type="button" class="sy-n sy-n-${t}${lp}" data-node="${n.id}"${extra} style="left:${(x / W) * 100}%;top:${(y / Ht) * 100}%;--a:${(arr[n.id] ?? 1).toFixed(2)}s" aria-label="${TYPE[t]}: ${H.esc(n.label)}">
        <span class="sy-ng">${t === "play" ? H.mark() : glyph(t)}</span><span class="sy-nl"><b>${H.esc(L === "m" ? n.short || n.label : n.label)}</b>${sub ? `<i>${sub}</i>` : ""}</span></button>`;
    }).join("");
    const pw = (hub.w / W) * 100;
    return `<svg class="sy-edges" viewBox="0 0 ${W} ${Ht}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>
      <div class="sy-hub" style="left:${(hub.x / W) * 100}%;top:${(hub.y / Ht) * 100}%;width:${pw}%">
        <div class="sy-halo">${halo()}<i class="sy-ap"></i><i class="sy-ap b"></i></div>
        ${H.portrait({ id: "synapse" })}
      </div>
      ${nodes}
      <p class="sy-hint" aria-hidden="true">click empty space to fire a neuron</p>`;
  }

  function dockIndex(C, H) {
    const groups = [["project", "Projects"], ["research", "Research"], ["role", "Roles"], ["school", "School"], ["skill", "Skills"], ["toy", "Play"]];
    return `<div class="sy-dh"><span class="sy-burst" aria-hidden="true"></span><b>Index</b><span class="sy-dh-n">${NODES.length} nodes · ${EDGES.length} edges</span></div>
      <p class="sy-dabout">${H.esc(C.about[0])}</p>
      <div class="sy-acc">${groups.map(([t, name]) => {
        const list = NODES.filter((n) => n.t === t || (t === "research" && n.t === "learning"));
        return `<button type="button" class="sy-acc-b" aria-expanded="false" aria-controls="sy-acc-${t}" data-acc="${t}">${glyph(t)}<span>${name}</span><em>${String(list.length).padStart(2, "0")}</em><i class="sy-pm" aria-hidden="true"></i></button>
          <ul class="sy-acc-l" id="sy-acc-${t}" hidden>${list.map((n) => `<li><button type="button" ${n.t === "toy" ? `data-play="${n.ref}"` : `data-sy-node="${n.id}"`}>${H.esc(n.label)}</button></li>`).join("")}</ul>`;
      }).join("")}</div>`;
  }
  function dockNode(id, C, H) {
    const n = NODE[id], x = info(n, C, H);
    const nb = neighbours(id).map((m) => (m === "hub" ? `<a class="sy-nb" href="#about"><span class="sy-nbm">${H.mark()}</span>Rithvik</a>` : `<button type="button" class="sy-nb" ${NODE[m].t === "toy" ? `data-play="${NODE[m].ref}"` : `data-sy-node="${m}"`}>${glyph(NODE[m].t)}${H.esc(NODE[m].label)}</button>`)).join("");
    return `<div class="sy-dh"><button type="button" class="sy-back" data-sy-back>${H.icon("arrow-left")} Index</button><span class="sy-dh-n">${TYPE[n.t]}</span></div>
      <p class="sy-dk">${x.k}</p>
      ${x.logo ? `<img class="sy-dlogo" src="${x.logo}" alt="" width="40" height="40">` : ""}
      <h3 class="sy-dt" tabindex="-1">${x.h}</h3>
      ${x.lede ? `<p class="sy-dl">${x.lede}</p>` : ""}
      ${x.list.length ? `<ul class="sy-db">${x.list.map((d) => `<li>${H.esc(d)}</li>`).join("")}</ul>` : ""}
      ${x.tags ? `<div class="chips">${x.tags}</div>` : ""}
      ${x.acts ? `<div class="sy-dacts">${x.acts}</div>` : ""}
      ${nb ? `<div class="sy-dnb"><span>Connected</span><div>${nb}</div></div>` : ""}`;
  }

  /** One small drawing per toy for the #play shelf (viewBox 0 0 200 120). */
  function playArt(id, H) {
    const r = rng(seedOf(id));
    if (id === "records") return `${[50, 44, 38, 32, 26].map((q) => `<circle cx="100" cy="60" r="${q}" class="ln"/>`).join("")}<circle cx="100" cy="60" r="16" class="or"/><circle cx="100" cy="60" r="2" class="ink"/><path class="ln th" d="M168 8 156 30 128 58"/><circle cx="168" cy="8" r="5" class="ink"/>`;
    if (id === "artboard") { let a = "M100 20"; for (let i = 1; i <= 12; i++) a += ` Q${f1(100 - 20 - r() * 60)} ${f1(14 + i * 7)} ${f1(100 - r() * 50)} ${f1(20 + i * 7.5)}`; return `<path class="dash" d="M100 6V114"/><path class="or th" d="${a}"/><path class="or th" d="${a}" transform="matrix(-1 0 0 1 200 0)"/>`; }
    if (id === "typeracer") return `${[0, 1, 2].map((row) => { let x = 22, out = ""; while (x < 172) { const w = 8 + r() * 26; if (x + w > 178) break; out += `<rect x="${f1(x)}" y="${34 + row * 20}" width="${f1(w)}" height="7" class="${row === 0 && x < 90 ? "fo" : "fi"}"/>`; x += w + 6; } return out; }).join("")}<rect x="92" y="31" width="2.4" height="13" class="ink sy-caret"/>`;
    if (id === "angle") return `<path class="ln th" d="M40 96H176M40 96 150 22"/><path class="or th" d="M86 96A46 46 0 0 0 78 70"/><text x="96" y="86" class="tx">?°</text>`;
    if (id === "dots") return Array.from({ length: 34 }, () => `<circle cx="${f1(26 + r() * 148)}" cy="${f1(18 + r() * 84)}" r="${f1(2 + r() * 2.4)}" class="${r() > 0.82 ? "or" : "ink"}"/>`).join("");
    return `<rect x="30" y="16" width="140" height="88" class="dash"/><path class="ln" d="M100 10V110M24 60H176"/><rect x="${f1(84 + 9)}" y="${f1(46 - 6)}" width="32" height="28" class="orf"/>`;
  }

  const secHead = (n, id, title, meta) => `<header class="sy-sh"><span class="sy-ch">CH ${n}</span><h2 id="${id}-h">${title}</h2><span class="sy-cnt">${meta}</span><svg class="sy-sh-tr" viewBox="0 0 600 28" preserveAspectRatio="none" aria-hidden="true"><path d="${trace(seedOf(id), 600, 28, 2)}"/></svg></header>`;

  V6.theme({
    id: "synapse", name: "Synapse", mood: "a mind wiring itself", dark: false,
    keywords: ["synapse", "graph", "brain", "neuron", "neural", "eeg", "network", "connectome", "signal", "node", "wires"],
    fonts: "family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700&family=Geist+Mono:wght@400..600",
    swatch: [PAPER, INK, OR, CY],
    cardFont: '"Instrument Sans", sans-serif',
    colors: [PAPER, INK, OR, CY],
    shaderScale: 0.5,
    shader: `
// sig(x): one EEG channel = alpha + beta + gamma bands, plus a travelling spike train (returned in .y)
vec2 sig(float x, float h, float t, float amp){
  float a = sin(x * 2.4 + t * (1.0 + h * .6) + h * 6.283) * .19;
  float b = sin(x * 6.3 - t * (1.7 + h * .8) + h * 17.) * .07;
  float g = sin(x * 16.1 + t * (3.3 + h) + h * 29.) * .028;
  float per = 2.4 + h * 2.6;
  float s = mod(x * .7 - t * (.30 + h * .28) + h * 11., per) - per * .5;
  float sp = exp(-s * s * 1300.) * .8 - exp(-(s - .045) * (s - .045) * 900.) * .34;
  return vec2((a + b + g) * amp, sp * (.55 + amp * .35));
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = u_time;
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float near = exp(-dot(p - m, p - m) * 9.);
  float arrive = 1.3 * exp(-t * .55);
  float calm = 1. - .35 * smoothstep(.0, .2, u_scroll);
  // flow lines: channels bent by one slow noise field
  float n = snoise(p * vec2(.8, 1.3) + vec2(t * .02, u_scroll * 2.4 - t * .015));
  float y = p.y + n * .075 + .02 * sin(p.x * 1.6 + t * .12);
  float N = 12.;
  float yc = y * N;
  float x = p.x * 7.;
  float line = 0., hot = 0.;
  for (int k = -2; k <= 2; k++) {
    float ch = floor(yc) + float(k);
    float h = hash21(vec2(ch, 7.3));
    float amp = (.45 + .5 * (.5 + .5 * sin(t * .23 + h * 20.)) + 1.1 * near + arrive) * calm;
    vec2 s0 = sig(x, h, t, amp), s1 = sig(x + .015, h, t, amp);
    float v0 = s0.x + s0.y, v1 = s1.x + s1.y;
    float slope = (v1 - v0) * .85 / .015 * 7. / N;
    float d = abs(yc - (ch + .5 + v0 * .85)) * u_res.y / N / sqrt(1. + slope * slope);
    float w = smoothstep(1.25, .15, d);
    line += w * (.35 + .65 * h);
    hot += w * smoothstep(.12, .5, abs(s0.y)) * (.6 + .4 * h);
  }
  // alpha x beta interference: two plane waves, washed through one soft fbm cloud
  float wave = sin(dot(p, vec2(.8, .6)) * 8. - t * .7) * sin(dot(p, vec2(-.5, .86)) * 13. + t * 1.05);
  float cloud = fbm(p * 1.05 + vec2(t * .018, -t * .012));
  vec3 col = u_c0;
  col = mix(col, u_c3, (.1 + .06 * near) * smoothstep(-.15, .6, cloud) * (.55 + .45 * wave));
  col = mix(col, u_c2, (.075 + .06 * near) * smoothstep(.05, .7, -cloud) * (.55 - .45 * wave));
  col = mix(col, u_c1, clamp(line, 0., 1.) * .15 * calm);
  col = mix(col, u_c2, clamp(hot, 0., 1.) * .5 * calm);
  col += (hash21(gl_FragCoord.xy + fract(t * 7.) * 91.) - .5) * .028;
  gl_FragColor = vec4(col, 1.);
}`,

    render(C, H) {
      const { esc, icon, logo, chip } = H;
      const L = innerWidth < 640 ? "m" : "d";
      const tick = [25, 50, 75].flatMap((x, i) => [33.333, 66.666].map((y, j) => `<i style="left:${x}%;top:${y}%"><b>${"ABC"[i]}${j + 1}</b></i>`)).join("");
      const bands = [["α", "alpha", "8–13 Hz", 9], ["β", "beta", "13–30 Hz", 22], ["γ", "gamma", "30–80 Hz", 54]].map(([g, nm, hz, f], i) => {
        let d = ""; for (let x = 0; x <= 240; x += 2) d += (x ? "L" : "M") + x + " " + f1(9 - Math.sin((x / 120) * Math.PI * (f / 9) * 2) * (6 - i * 1.4));
        return `<div class="sy-band sy-band-${i}"><b>${g}</b><span>${nm}<br>${hz}</span><div class="sy-bw"><div><svg viewBox="0 0 240 18" preserveAspectRatio="none"><path d="${d}"/></svg><svg viewBox="0 0 240 18" preserveAspectRatio="none"><path d="${d}"/></svg></div></div><i class="sy-meter"><u></u></i></div>`;
      }).join("");
      const work = C.projects.map((p, i) => `<li class="sy-pr">
          <span class="sy-pr-i">${gi("project")} ${String(i + 1).padStart(2, "0")}</span>
          <div class="sy-pr-t"><h3><button type="button" class="sy-pr-open" data-case="${p.slug}">${esc(p.title)}</button></h3><p>${esc(p.headline)}</p></div>
          <p class="sy-pr-k"><span>${esc(p.kind)}</span></p>
          <div class="sy-pr-x"><div class="chips">${p.tags.slice(0, 3).map(chip).join("")}</div>
            ${Object.keys(p.links).length ? `<div class="sy-pr-links">${Object.entries(p.links).map(([k, v]) => `<a href="${v}" target="_blank" rel="noopener">${esc(k)} ${icon("arrow-up-right")}</a>`).join("")}</div>` : ""}</div>
          <span class="sy-pr-go" aria-hidden="true">${icon("arrow-right")}</span>
          <svg class="sy-pr-tr" viewBox="0 0 600 30" preserveAspectRatio="none" aria-hidden="true"><path d="${trace(seedOf(p.slug), 600, 30, 2 + (i % 3))}"/><path class="hot" d="${trace(seedOf(p.slug), 600, 30, 2 + (i % 3))}" pathLength="1"/></svg>
        </li>`).join("");
      const xp = C.experience.map((x, i) => `<li class="sy-x" id="experience-${x.slug}">
          <span class="sy-x-g">${glyph(i === 0 ? "research" : "role")}</span>
          <p class="sy-x-when">${esc(x.when)}<span>${esc(x.where)}</span></p>
          <div class="sy-x-b"><h3>${esc(x.role)}</h3><p class="sy-x-org">${esc(x.org)}</p><p class="sy-x-d">${esc(x.desc[0])}</p><div class="chips">${x.tags.slice(0, 4).map(chip).join("")}</div></div>
        </li>`).join("");
      const places = C.places.map((p) => `<li><span>${esc(p.key)}</span><b>${esc(p.city)}</b><time data-clock="${p.tz}"></time></li>`).join("");
      const nums = C.numbers.map(([n, l]) => `<div class="sy-num"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("");
      const stack = Object.entries(C.stack).map(([g, v]) => `<div class="sy-stk"><h3>${glyph("skill")}${esc(g)}</h3><div class="chips">${v.map(chip).join("")}</div></div>`).join("");
      const faq = C.faq.map(([q, a]) => `<details class="sy-faq-i"><summary>${esc(q)}<i class="sy-pm" aria-hidden="true"></i></summary><p>${esc(a)}</p></details>`).join("");
      const toys = (H.PLAY || []).map((p, i) => `<li><button type="button" class="sy-toy" data-play="${p.id}">
          <span class="sy-toy-n">P${i + 1}</span><svg class="sy-toy-art" viewBox="0 0 200 120" aria-hidden="true">${playArt(p.id, H)}</svg>
          <b>${esc(p.name)}</b><span class="sy-toy-d">${esc(p.desc)}</span><span class="sy-toy-go" aria-hidden="true">${icon("arrow-up-right")}</span></button></li>`).join("");
      const log = C.log.map(([d, k, m]) => `<li><time>${esc(d)}</time><span class="k-${esc(k)}">${esc(k)}</span>${esc(m)}</li>`).join("");

      return `<div class="sy" data-layout="${L}">
      <header class="sy-top">
        <a class="sy-brand" href="#top" aria-label="Rithvik Praveen Kumar, top"><span class="sy-logo" aria-hidden="true">${H.mark()}</span><b>RPK</b><span>Synapse</span></a>
        <nav class="sy-nav" aria-label="Sections"><a href="#top"><i>01</i>Graph</a><a href="#work"><i>02</i>Work</a><a href="#experience"><i>03</i>Experience</a><a href="#about"><i>04</i>About</a><a href="#play"><i>05</i>Play</a><a href="#contact"><i>06</i>Contact</a></nav>
        <p class="sy-meta"><span class="sy-xy" aria-hidden="true">X <b id="sy-x">0000</b> Y <b id="sy-y">0000</b></span><span>SF <b data-clock="${C.now.tz}"></b></span></p>
      </header>

      <section class="sy-hero" id="top" aria-labelledby="sy-name">
        <div class="sy-grid" aria-hidden="true">${tick}</div>
        <div class="sy-intro">
          <p class="sy-kick"><span class="sy-rec" aria-hidden="true"></span>RPK-001 · recording</p>
          <h1 class="sy-name" id="sy-name"><span>Rithvik</span><span>Praveen</span><span>Kumar</span></h1>
          <p class="sy-role">${esc(C.role)}</p>
          <p class="sy-line">${esc(C.line)}</p>
          <ol class="sy-thesis">${C.thesis.map((t, i) => `<li><span>CH${i + 1}</span>${esc(t)}</li>`).join("")}</ol>
          <p class="sy-status"><span class="sy-live" aria-hidden="true"></span>${esc(C.status)}</p>
          <div class="sy-acts">
            <button type="button" class="sy-btn pri" data-resume>${icon("file-text")}Resume</button>
            <button type="button" class="sy-btn" data-compose>${icon("mail")}Email</button>
            <button type="button" class="sy-btn" data-agent><span class="sy-pr-mark" aria-hidden="true">❯</span>Ask the agent</button>
          </div>
        </div>
        <div class="sy-graphwrap"><div class="sy-graph" id="sy-graph" data-l="${L}">${graphHTML(L, C, H)}</div></div>
        <aside class="sy-side" aria-label="Graph index">
          <div class="sy-dock" id="sy-dock">${dockIndex(C, H)}</div>
          <div class="sy-legend" aria-label="Legend">
            <p>${glyph("project")}Project</p><p>${glyph("research")}Research</p><p>${glyph("role")}Role</p><p>${glyph("school")}School</p><p>${glyph("skill")}Skill</p><p>${glyph("learning")}Learning</p><p>${glyph("toy")}Toy</p><p class="mk">${H.mark()}Play</p>
            <p class="ln"><i class="e-s"></i>built</p><p class="ln"><i class="e-d"></i>in progress</p><p class="ln"><i class="e-u"></i>uses</p>
          </div>
          <div class="sy-bands" aria-hidden="true">${bands}</div>
        </aside>
      </section>

      <section class="sy-sec" id="work" aria-labelledby="work-h">
        ${secHead("02", "work", "Work", `${gi("project")} ${String(C.projects.length).padStart(2, "0")} projects`)}
        <ol class="sy-work">${work}</ol>
      </section>

      <section class="sy-sec" id="experience" aria-labelledby="experience-h">
        ${secHead("03", "experience", "Experience", `${gi("research")} 01 research · ${gi("role")} 03 roles · ${gi("school")} 01 school`)}
        <ol class="sy-xp">${xp}</ol>
        <div class="sy-edu" id="education">
          <span class="sy-x-g">${glyph("school")}</span>
          <img src="${C.education.logo}" alt="Purdue University" width="56" height="56">
          <div><h3>${esc(C.education.school)}</h3><p>${esc(C.education.degree)}</p><p class="sy-mute">${esc(C.education.focus)}</p></div>
          <p class="sy-edu-g">${esc(C.education.grad)}</p>
        </div>
      </section>

      <section class="sy-sec" id="about" aria-labelledby="about-h">
        ${secHead("04", "about", "About", `${gi("learning")} now · places · numbers`)}
        <div class="sy-about">
          <div class="sy-ab-t">${C.about.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
          <aside class="sy-now" aria-label="Now">
            <dl><div><dt>Building</dt><dd>${esc(C.now.building)}</dd></div><div><dt>Researching</dt><dd>${esc(C.now.researching)}</dd></div><div class="lrn"><dt>Learning</dt><dd>${esc(C.now.learning)}</dd></div></dl>
            <ul class="sy-places">${places}</ul>
          </aside>
        </div>
        <div class="sy-nums">${nums}</div>
      </section>

      <section class="sy-sec sy-tools" aria-label="Stack and questions">
        <div class="sy-stack">${stack}</div>
        <div class="sy-faq"><h3 class="sy-faq-h">Asked often</h3>${faq}</div>
      </section>

      <section class="sy-sec" id="play" aria-labelledby="play-h">
        ${secHead("05", "play", "Play", `${gi("toy")} ${String((H.PLAY || []).length).padStart(2, "0")} toys · no install`)}
        <div class="sy-play-intro"><span class="sy-play-mark" aria-hidden="true">${H.mark("hatch")}</span><p>Small things to poke at between tabs. Each one opens in its own window.</p></div>
        <ol class="sy-toys">${toys}</ol>
      </section>

      <section class="sy-sec sy-contact" id="contact" aria-labelledby="contact-h">
        ${secHead("06", "contact", "Contact", `<span class="sy-live" aria-hidden="true"></span> open to SWE and AI internships`)}
        <div class="sy-tx" aria-hidden="true"><svg viewBox="-100 -100 200 200">${[18, 36, 54, 72, 90].map((r, i) => `<circle r="${r}"${i % 2 ? ' class="dd"' : ""}/>`).join("")}<path d="M-98 0H98M0-98V98"/>${Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * Math.PI * 2, l = i % 6 ? 2 : 5; return `<path d="M${f1(Math.cos(a) * 90)} ${f1(Math.sin(a) * 90)}L${f1(Math.cos(a) * (90 + l))} ${f1(Math.sin(a) * (90 + l))}"/>`; }).join("")}<path class="sp" d="${trace(77, 180, 40, 2).replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (m0, x, y) => `${f1(+x - 90)} ${f1(+y - 20)}`)}"/></svg><span class="sy-tx-mark">${H.mark()}</span><i></i><i></i><i></i><span class="t0">TX</span><span class="t1">${esc(C.now.city)} <time data-clock="${C.now.tz}"></time></span></div>
        <p class="sy-big">Send a signal.</p>
        <div class="sy-mail"><button type="button" class="sy-mail-b" data-compose>${esc(C.links.email)}<span>${icon("arrow-up-right")}</span></button><button type="button" class="sy-ic" data-copy="${esc(C.links.email)}" aria-label="Copy email address">${icon("copy")}</button></div>
        <div class="sy-cacts">
          <button type="button" class="sy-btn pri" data-compose>${icon("mail")}Write a message</button>
          <a class="sy-btn" href="${C.links.github}" target="_blank" rel="noopener">${logo("github")}GitHub</a>
          <a class="sy-btn" href="${C.links.linkedin}" target="_blank" rel="noopener">${logo("linkedin")}LinkedIn</a>
          <button type="button" class="sy-btn" data-resume>${icon("file-text")}Resume</button>
        </div>
      </section>

      <footer class="sy-foot">
        <div><h3>Recent commits</h3><ol class="sy-log">${log}</ol></div>
        <div class="sy-colo"><p>${esc(C.name)}</p><p class="sy-mute">Set in Instrument Sans and Geist Mono. The field behind this page is one fragment shader: three bands and a spike train per channel.</p></div>
      </footer>
      </div>`;
    },

    mount(root, H) {
      const C = H.C, ac = new AbortController(), on = { signal: ac.signal };
      const sy = root.querySelector(".sy"), dock = root.querySelector("#sy-dock"), hero = root.querySelector(".sy-hero");
      let graph = root.querySelector("#sy-graph"), sel = null, hot = null;

      /** Light a node and everything wired to it. */
      function light(id) {
        if (hot === id) return; hot = id;
        graph.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
        sy.classList.toggle("is-hot", !!id);
        if (!id) return;
        graph.querySelector(`[data-node="${id}"]`)?.classList.add("on");
        graph.querySelectorAll(`.sy-e[data-a="${id}"], .sy-e[data-b="${id}"]`).forEach((e) => e.classList.add("on"));
        neighbours(id).forEach((m) => graph.querySelector(`[data-node="${m}"]`)?.classList.add("on"));
      }
      /** Open a node in the docked index card. */
      function select(id, focus) {
        sel = id;
        graph.querySelectorAll(".sel").forEach((el) => el.classList.remove("sel"));
        if (id) graph.querySelector(`[data-node="${id}"]`)?.classList.add("sel");
        dock.innerHTML = id ? dockNode(id, C, H) : dockIndex(C, H);
        dock.scrollTop = 0;
        if (focus) dock.querySelector(id ? ".sy-dt" : ".sy-acc-b")?.focus({ preventScroll: true });
        const r = dock.getBoundingClientRect();
        if (r.top > innerHeight - 120 || r.bottom < 60) dock.scrollIntoView({ behavior: H.reduceMotion() ? "auto" : "smooth", block: "nearest" });
      }
      const bindGraph = () => {
        graph.addEventListener("pointerover", (e) => { const n = e.target.closest(".sy-n"); if (n) light(n.dataset.node); }, on);
        graph.addEventListener("pointerout", (e) => { const n = e.target.closest(".sy-n"); if (n && !n.contains(e.relatedTarget)) light(null); }, on);
        graph.addEventListener("focusin", (e) => { const n = e.target.closest(".sy-n"); if (n) light(n.dataset.node); }, on);
        graph.addEventListener("focusout", () => light(null), on);
        graph.addEventListener("click", (e) => {
          const n = e.target.closest(".sy-n");
          if (n) { if (!n.dataset.play) select(n.dataset.node, e.detail === 0); return; }
          if (e.target.closest(".pt")) return;
          fire(e.clientX, e.clientY);
        }, on);
      };
      /** A light-hearted one: clicking empty space fires a neuron; the nearest node answers. */
      function fire(cx, cy) {
        const b = graph.getBoundingClientRect(), z = document.createElement("i");
        z.className = "sy-zap"; z.style.left = cx - b.left + "px"; z.style.top = cy - b.top + "px";
        graph.appendChild(z); setTimeout(() => z.remove(), 1200);
        let best = null, bd = 1e9;
        graph.querySelectorAll(".sy-n").forEach((n) => { const r = n.getBoundingClientRect(), d = Math.hypot(r.left - cx, r.top - cy); if (d < bd) { bd = d; best = n; } });
        if (best && bd < 220) { best.classList.remove("zap"); void best.offsetWidth; best.classList.add("zap"); setTimeout(() => best.classList.remove("zap"), 900); }
      }
      bindGraph();
      dock.addEventListener("click", (e) => {
        const n = e.target.closest("[data-sy-node]"); if (n) { select(n.dataset.syNode, true); light(null); return; }
        if (e.target.closest("[data-sy-back]")) { select(null, true); return; }
        const a = e.target.closest("[data-acc]");
        if (a) { const open = a.getAttribute("aria-expanded") !== "true"; a.setAttribute("aria-expanded", String(open)); dock.querySelector("#" + a.getAttribute("aria-controls")).hidden = !open; }
      }, on);
      dock.addEventListener("pointerover", (e) => { const n = e.target.closest("[data-sy-node]"); light(n ? n.dataset.syNode : null); }, on);
      dock.addEventListener("pointerleave", () => light(null), on);
      addEventListener("keydown", (e) => { if (e.key === "Escape" && sel && (dock.contains(document.activeElement) || graph.contains(document.activeElement))) { const id = sel; select(null); graph.querySelector(`[data-node="${id}"]`)?.focus(); } }, on);

      // live cursor meta, written at most once per frame
      const xEl = root.querySelector("#sy-x"), yEl = root.querySelector("#sy-y"); let raf = 0, px = 0, py = 0;
      addEventListener("pointermove", (e) => { px = e.pageX; py = e.pageY; if (!raf) raf = requestAnimationFrame(() => { raf = 0; xEl.textContent = String(Math.round(px)).padStart(4, "0"); yEl.textContent = String(Math.round(py)).padStart(4, "0"); }); }, { passive: true, signal: ac.signal });

      // ambient loops rest while their block is off-screen
      const io = new IntersectionObserver((en) => en.forEach((x) => x.target.classList.toggle("sy-rest", !x.isIntersecting)), { rootMargin: "80px" });
      [hero, root.querySelector(".sy-tx")].forEach((el) => el && io.observe(el));

      // clocks stay current
      const clk = setInterval(() => root.querySelectorAll("[data-clock]").forEach((el) => (el.textContent = H.clock(el.dataset.clock))), 20000);

      // phone and desktop use different precomputed layouts
      let L = graph.dataset.l;
      const ro = () => {
        const nl = innerWidth < 640 ? "m" : "d"; if (nl === L) return; L = nl;
        const fresh = graph.cloneNode(false); fresh.dataset.l = L; fresh.innerHTML = graphHTML(L, C, H); graph.replaceWith(fresh); graph = fresh;
        sy.dataset.layout = L; H.hydrate(graph); bindGraph(); hot = null; if (sel && !NODE[sel][L]) select(null); else if (sel) graph.querySelector(`[data-node="${sel}"]`)?.classList.add("sel");
      };
      addEventListener("resize", ro, on);

      return () => { ac.abort(); io.disconnect(); clearInterval(clk); cancelAnimationFrame(raf); };
    },
  });
})();
