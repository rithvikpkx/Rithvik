// Greps every design for the anchor ids the agent's show_section relies on and prints a matrix.
// Exits 1 when a required id is missing (designs without an FAQ are exempt from `questions`).
import { readFileSync } from "node:fs";

const DESIGNS = ["classic", "nimbus", "stipple", "glyph", "prism", "mercury", "thermal", "starlight", "tracker", "foil"];
const STATIC = ["top", "work", "experience", "about", "play", "questions", "contact"];
const DYNAMIC = [["project-<slug>", "project-${"], ["experience-<slug>", "experience-${"]];
const NO_FAQ = new Set(["starlight", "thermal"]);

const cols = [...STATIC, ...DYNAMIC.map(([n]) => n)];
let bad = 0;
const rows = DESIGNS.map((d) => {
  const src = readFileSync(`designs/${d}/index.tsx`, "utf8");
  const cells = [
    ...STATIC.map((id) => src.includes(`id="${id}"`)),
    ...DYNAMIC.map(([, needle]) => src.includes(`id={\`${needle}`)),
  ];
  return [d, cells.map((ok, i) => {
    if (ok) return "ok";
    if (cols[i] === "questions" && NO_FAQ.has(d)) return "n/a";
    bad++;
    return "MISSING";
  })];
});

const w = Math.max(...cols.map((c) => c.length)) + 1;
console.log("design".padEnd(10) + cols.map((c) => c.padEnd(w)).join(""));
for (const [d, cells] of rows) console.log(d.padEnd(10) + cells.map((c) => c.padEnd(w)).join(""));
if (bad) { console.error(`\n${bad} anchor(s) missing`); process.exit(1); }
