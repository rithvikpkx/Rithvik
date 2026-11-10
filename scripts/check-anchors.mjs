// Checks the anchor ids the agent's show_section relies on and prints a matrix per design.
// The static section anchors (top, work, ...) come from the shared layout, which renders every section in
// lib/designs/skin.ts SECTIONS; the per-item anchors (project-<slug>, experience-<slug>) come from whichever
// body a design uses: its own override in designs/<id>/index.tsx or the shared default. Exits 1 on a gap.
import { readFileSync } from "node:fs";

const DESIGNS = ["classic", "nimbus", "stipple", "glyph", "prism", "mercury", "thermal", "starlight", "tracker", "foil"];
const STATIC = ["top", "work", "experience", "about", "play", "questions", "contact"];
const layout = readFileSync("components/site/layout/SiteLayout.tsx", "utf8");
const skin = readFileSync("lib/designs/skin.ts", "utf8");
// the shared bodies: sections.tsx and the ones in their own files
const defaults = ["layout/sections.tsx", "layout/Experience.tsx", "work/Work.tsx"].map((f) => readFileSync(`components/site/${f}`, "utf8")).join("\n");
const sections = (skin.match(/SECTIONS = \[([^\]]*)\]/)?.[1] ?? "").match(/"([a-z]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
// a design overrides a body when its skin lists `sections: { work: ..., experience: ... }`
const overrides = (src) => new Set((src.match(/sections:\s*\{([^}]*)\}/)?.[1] ?? "").match(/[a-z]+(?=:)/g) ?? []);
const BODY = [["project-<slug>", "work", "project-${"], ["experience-<slug>", "experience", "experience-${"]];

const cols = [...STATIC, ...BODY.map(([n]) => n)];
let bad = 0;
const staticOk = (id) => (id === "top" ? layout.includes('id="top"') : sections.includes(id) && layout.includes("id={id}"));
const rows = DESIGNS.map((d) => {
  const src = readFileSync(`designs/${d}/index.tsx`, "utf8"), own = overrides(src);
  const cells = [
    ...STATIC.map(staticOk),
    ...BODY.map(([, sec, needle]) => (own.has(sec) ? src : defaults).includes(`id={\`${needle}`)),
  ];
  return [d, cells.map((ok) => (ok ? "ok" : (bad++, "MISSING")))];
});

const w = Math.max(...cols.map((c) => c.length)) + 1;
console.log("design".padEnd(10) + cols.map((c) => c.padEnd(w)).join(""));
for (const [d, cells] of rows) console.log(d.padEnd(10) + cells.map((c) => c.padEnd(w)).join(""));
if (bad) { console.error(`\n${bad} anchor(s) missing`); process.exit(1); }
