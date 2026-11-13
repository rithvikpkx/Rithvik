/** Knowledge graph model + radial layout, ported from the v7 mockup (core.js `KG` / `kgLayout`). Pure: no DOM, no React. */
import type { Content } from "../content/types";

export type KGType = "me" | "field" | "project" | "role" | "school" | "place" | "skill";
export type KGAction = { kind: "case"; slug: string } | { kind: "scroll"; target: string };
export type KGNode = { id: string; type: KGType; label: string; short?: string; sub?: string; facts?: string[]; action?: KGAction; tz?: string; deg: number };
export type KGEdge = { a: string; b: string; kind: string };
export type KG = { nodes: KGNode[]; edges: KGEdge[]; byId: Record<string, KGNode> };
export type KGPos = Record<string, [number, number]>;

/** Legend order + labels (the first entry, "me", has no filter chip). */
export const KG_TYPES: [KGType, string][] = [["me", "Rithvik"], ["field", "Fields"], ["project", "Projects"], ["role", "Roles"], ["school", "School"], ["place", "Places"], ["skill", "Skills"]];

/** Editorial grouping that the content model does not carry yet: slug -> field, slug -> short label.
 *  Unknown slugs fall back to the project's `kind` / a generic "Experience" field and the full title. */
export type KGMeta = { fields: Record<string, string>; roleFields: Record<string, string>; short: Record<string, string> };
export const DEFAULT_META: KGMeta = {
  fields: { "mind-controlled-arm": "Brain-computer interfaces", "eeg-thought-prediction": "Brain-computer interfaces", boilerframe: "Computer vision", "citizen-happiness": "Applied ML", qrify: "Web and cloud", "habitat-humanity-ecomm": "Tools for non-profits" },
  roleFields: { "tinyml-research": "TinyML", "hack-the-future": "Applied ML", "code-ninjas-ir": "Teaching and community", "code-ninjas-sensei": "Teaching and community" },
  short: { "mind-controlled-arm": "Robotic arm", boilerframe: "BoilerFrame", "eeg-thought-prediction": "Thought prediction", "citizen-happiness": "Citizen happiness", qrify: "QRIfy", "habitat-humanity-ecomm": "Habitat e-commerce", "tinyml-research": "TinyML researcher", "hack-the-future": "Software developer", "code-ninjas-ir": "Investor relations", "code-ninjas-sensei": "Code sensei" },
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Builds the graph from site content: me, fields, projects, roles, skills (tags), school and places, with degree for node sizing. */
export function buildKG(c: Content, meta: KGMeta = DEFAULT_META): KG {
  const nodes: KGNode[] = [], edges: KGEdge[] = [], byId: Record<string, KGNode> = {};
  const add = (n: Omit<KGNode, "deg">) => { if (!byId[n.id]) { byId[n.id] = { ...n, deg: 0 }; nodes.push(byId[n.id]); } return byId[n.id]; };
  const link = (a: string, b: string, kind: string) => { if (a !== b && !edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) edges.push({ a, b, kind }); };
  const field = (name: string) => { const id = "f-" + slugify(name); add({ id, type: "field", label: name }); link("me", id, "focus"); return id; };

  add({ id: "me", type: "me", label: c.name, sub: c.role, facts: [c.line, c.status] });
  // fields first so they keep a stable order around the ring
  [...new Set([...c.projects.map((p) => meta.fields[p.slug] ?? p.kind), ...c.experience.map((x) => meta.roleFields[x.slug] ?? "Experience")])].forEach(field);
  c.projects.forEach((p) => {
    add({ id: "p-" + p.slug, type: "project", label: p.title, short: meta.short[p.slug], sub: p.headline, facts: p.desc, action: { kind: "case", slug: p.slug } });
    link(field(meta.fields[p.slug] ?? p.kind), "p-" + p.slug, "built");
    p.tags.forEach((t) => { add({ id: "s-" + slugify(t), type: "skill", label: t }); link("p-" + p.slug, "s-" + slugify(t), "uses"); });
  });
  c.experience.forEach((x) => {
    add({ id: "r-" + x.slug, type: "role", label: x.role, short: meta.short[x.slug], sub: `${x.org} · ${x.when}`, facts: x.desc, action: { kind: "scroll", target: "experience" } });
    link("me", "r-" + x.slug, "worked");
    link(field(meta.roleFields[x.slug] ?? "Experience"), "r-" + x.slug, "built");
    x.tags.forEach((t) => { add({ id: "s-" + slugify(t), type: "skill", label: t }); link("r-" + x.slug, "s-" + slugify(t), "uses"); });
    const place = c.places.find((pl) => x.where.startsWith(pl.city));
    if (place) link("r-" + x.slug, "pl-" + place.key, "located");
    if (x.org.includes(c.education.school)) link("r-" + x.slug, "school", "at");
  });
  c.places.forEach((pl) => { add({ id: "pl-" + pl.key, type: "place", label: pl.city, sub: { home: "Home", school: "School", now: "Now" }[pl.key], tz: pl.tz }); });
  add({ id: "school", type: "school", label: c.education.school, short: c.education.school.split(" ")[0], sub: c.education.degree, facts: [c.education.focus, c.education.grad].filter(Boolean) });
  link("me", "school", "studies");
  c.places.forEach((pl) => link("me", "pl-" + pl.key, "lives"));
  const schoolPlace = c.places.find((p) => p.key === "school");
  if (schoolPlace) link("school", "pl-school", "located");
  edges.forEach((e) => { byId[e.a].deg++; byId[e.b].deg++; });
  return { nodes, edges, byId };
}

/** Radial tree in a w x h box: you at the centre, fields on ring 1, their projects/roles in each field's sector on
 *  ring 2 (school and places as their own sector), skills on ring 3 at the mean angle of what uses them, spread apart. */
export function kgLayout(kg: KG, w: number, h: number): KGPos {
  const narrow = w < 560, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.5 - (narrow ? 14 : 30), ax = Math.min(1.5, w / Math.min(w, h)), ay = Math.min(narrow ? 1.9 : 1.25, h / Math.min(w, h));
  const pos: KGPos = { me: [cx, cy] }, ang: Record<string, number> = {};
  const kids: Record<string, string[]> = {};
  kg.edges.forEach((e) => { const A = kg.byId[e.a], B = kg.byId[e.b]; if (A.type === "field" && (B.type === "project" || B.type === "role")) (kids[A.id] ||= []).push(B.id); });
  const sectors: { id: string | null; items: string[] }[] = kg.nodes.filter((n) => n.type === "field").map((f) => ({ id: f.id, items: kids[f.id] || [] }));
  sectors.push({ id: null, items: [...(kg.byId.school ? ["school"] : []), ...kg.nodes.filter((n) => n.type === "place").map((n) => n.id)] });
  const total = sectors.reduce((s, x) => s + Math.max(1, x.items.length), 0), gap = 0.06;
  let a = -Math.PI / 2 + 0.2;
  const span = Math.PI * 2 - gap * sectors.length;
  const put = (id: string, angle: number, r: number) => { ang[id] = angle; pos[id] = [cx + Math.cos(angle) * r * ax, cy + Math.sin(angle) * r * ay]; };
  sectors.forEach((s) => {
    const n = Math.max(1, s.items.length), width = (n / total) * span;
    s.items.forEach((id, k) => { if (!pos[id]) put(id, a + ((k + 0.5) / n) * width, R * (kg.byId[id].type === "place" ? 0.7 : 0.6)); });
    if (s.id) put(s.id, a + width / 2, R * 0.32);
    a += width + gap;
  });
  // keep field nodes apart by relaxing neighbouring angles
  const fields = kg.nodes.filter((n) => n.type === "field").map((n) => ({ id: n.id, t: ang[n.id] })).sort((p, q) => p.t - q.t);
  const fGap = (Math.PI * 2) / (fields.length * 1.25);
  for (let pass = 0; pass < 30; pass++) for (let k = 0; k < fields.length; k++) { const p = fields[k], q = fields[(k + 1) % fields.length], d = ((q.t - p.t + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (d < fGap) { const push = (fGap - d) / 2; p.t -= push; q.t += push; } }
  fields.forEach((f) => put(f.id, f.t, R * 0.3));
  // skills: circular mean of their neighbours' angles, then spread along the outer ring so labels never stack
  const skills = kg.nodes.filter((n) => n.type === "skill").map((n) => {
    let sx = 0, sy = 0;
    kg.edges.forEach((e) => { const o = e.a === n.id ? e.b : e.b === n.id ? e.a : null; if (o && ang[o] !== undefined) { sx += Math.cos(ang[o]); sy += Math.sin(ang[o]); } });
    return { id: n.id, t: Math.atan2(sy, sx) };
  }).sort((p, q) => p.t - q.t);
  const minGap = (Math.PI * 2) / (skills.length * 1.15);
  for (let pass = 0; pass < 40; pass++) for (let k = 0; k < skills.length; k++) { const p = skills[k], q = skills[(k + 1) % skills.length], d = ((q.t - p.t + Math.PI * 3) % (Math.PI * 2)) - Math.PI; if (d < minGap) { const push = (minGap - d) / 2; p.t -= push; q.t += push; } }
  skills.forEach((s, k) => put(s.id, s.t, R * (k % 2 ? 0.93 : 0.99)));
  return pos;
}
