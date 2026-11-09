// Pure pieces of the Tracker vision layer: the classes it knows, stable per-element confidences and the
// per-project activation maps (ported from docs/mockups/v7/themes/tracker.js).

/** Box colour per detected class. */
export const K: Record<string, string> = { person: "#E0103F", text: "#C24E00", cta: "#1F3BFF", project: "#00875A", role: "#0A6FB0", node: "#7A3CFF", toy: "#B5179E", metric: "#3F4248", logo: "#8A6A00", ouroboros: "#7A3CFF", field: "#C24E00", place: "#E0103F", school: "#8A6A00", skill: "#5A5E66" };
/** Knowledge-graph node type → the class the tracker calls it. */
export const KG_CLS: Record<string, string> = { me: "ouroboros", field: "field", project: "project", role: "role", school: "school", place: "place", skill: "skill" };
/** What the model "sees" in each toy. */
export const TOY_LBL: Record<string, string> = { records: "vinyl", artboard: "canvas", typeracer: "keyboard", angle: "protractor", dots: "dots", center: "div" };

export const pad = (i: number, n = 2) => String(i).padStart(n, "0");

/** FNV-1a: a stable hash so every element keeps the same confidence on every visit. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The static performance-mode label for a project row ("project 0.93"). */
export const projLabel = (slug: string) => `project ${(0.86 + (hashStr(slug) % 12) / 100).toFixed(2)}`;

/** An 8×5 activation map per project: a soft blob of attention quantised to four levels, one hot cell. */
export function fmap(slug: string): string {
  let s = hashStr(slug) || 1;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const cx = 1.5 + r() * 5, cy = 1 + r() * 3, v: number[] = [];
  let cells = "", best = -1, bx = 0, by = 0;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) {
    const a = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 4.5) + r() * 0.28;
    v.push(a);
    if (a > best) { best = a; bx = x; by = y; }
  }
  v.forEach((a, i) => {
    const x = i % 8, y = (i / 8) | 0;
    const l = x === bx && y === by ? "h" : a > 0.75 ? "3" : a > 0.5 ? "2" : a > 0.28 ? "1" : "";
    if (l) cells += `<rect x="${x}" y="${y}" width="1" height="1" class="f${l}"/>`;
  });
  return `<rect width="8" height="5" class="f0"/>${cells}<rect x="${bx}" y="${by}" width="1" height="1" class="fo"/>`;
}
