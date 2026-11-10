// Pure pieces of the Tracker vision layer: the classes it knows, stable per-element confidences (ported from docs/mockups/v7/themes/tracker.js).

/** Box colour per detected class. */
export const K: Record<string, string> = { person: "#E0103F", text: "#C24E00", cta: "#1F3BFF", project: "#00875A", role: "#0A6FB0", node: "#7A3CFF", toy: "#B5179E", metric: "#3F4248", logo: "#8A6A00", ouroboros: "#7A3CFF", field: "#C24E00", place: "#E0103F", school: "#8A6A00", skill: "#5A5E66" };
/** Knowledge-graph node type → the class the tracker calls it. */
export const KG_CLS: Record<string, string> = { me: "ouroboros", field: "field", project: "project", role: "role", school: "school", place: "place", skill: "skill" };
export const pad = (i: number, n = 2) => String(i).padStart(n, "0");

/** FNV-1a: a stable hash so every element keeps the same confidence on every visit. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
