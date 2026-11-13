/** Renders the published profile (getContent()) compactly for the system prompt, and scrubs
 *  facts the agent must never repeat. Pure so node:test can load it. */
import type { Content } from "../content/types.ts";

/** Drops placeholders ({{…}}) and bare-origin links (e.g. a LinkedIn root that isn't his page). */
function keepLink(url: string): boolean {
  if (!url || url.includes("{{")) return false;
  try { return new URL(url).pathname.replace(/\/$/, "") !== ""; } catch { return false; }
}
const clean = (s: string) => (s.includes("{{") ? "" : s.trim());
const join = (xs: string[], sep = " ") => xs.map(clean).filter(Boolean).join(sep);

/** Phone numbers and graduation dates are never repeated, even when an uploaded doc carries them. */
export function scrubPrivate(text: string): string {
  return text
    .replace(/(?:\+?\d{1,2}[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone withheld]")
    .replace(/\b(?:expected\s+)?(?:graduat\w*|grad\.?|class of)\b[^.\n]{0,40}?\b(?:19|20)\d{2}\b/gi, "[graduation date withheld]")
    .replace(/\bexpected\s+(?:[a-z]{3,9}\.?\s+)?(?:19|20)\d{2}\b/gi, "[graduation date withheld]");
}

/** One compact block, ~1.5k tokens: everything a visitor can read on the site. Graduation date is
 *  deliberately absent. Slugs are shown so tool calls can name records. */
export function renderProfile(c: Content): string {
  const links = Object.entries({ Email: `mailto:${c.links.email}`, GitHub: c.links.github, LinkedIn: c.links.linkedin })
    .filter(([, u]) => keepLink(u) || u.startsWith("mailto:"))
    .map(([k, u]) => `${k}: ${u.replace(/^mailto:/, "")}`);
  const lines = [
    `Name: ${c.name}. ${clean(c.role)}. ${clean(c.status)}`,
    `In one line: ${clean(c.line)}`,
    `About: ${join(c.about)}`,
    `Now: in ${c.now.city}; building ${clean(c.now.building)}; researching ${clean(c.now.researching)}; learning ${clean(c.now.learning)}`,
    `Places: ${c.places.map((p) => `${p.key} = ${p.city}`).join("; ")}`,
    `Work authorization: ${clean(c.workAuth)}`,
    `Links: ${links.join("; ")}`,
    `Education: ${c.education.school}, ${c.education.degree}${c.education.focus ? ` (focus: ${c.education.focus})` : ""}`,
    "Projects:",
    ...c.projects.map((p) => {
      const l = Object.entries(p.links).filter(([, u]) => keepLink(u)).map(([k, u]) => `${k} ${u}`);
      return `- [${p.slug}] ${p.title} (${p.kind}): ${clean(p.headline)}. ${clean(p.ctx)}. ${join(p.desc)} Tags: ${p.tags.join(", ")}.${l.length ? ` Links: ${l.join(", ")}` : ""}`;
    }),
    "Roles:",
    ...c.experience.map((r) => `- [${r.slug}] ${r.role}, ${r.org} (${r.when}, ${r.where}): ${join(r.desc)} Tags: ${r.tags.join(", ")}.`),
    `Stack: ${Object.entries(c.stack).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ")}`,
    `Numbers: ${c.numbers.map(([v, l]) => `${v} ${l}`).join("; ")}`,
    "FAQ:",
    ...c.faq.filter(([q, a]) => clean(q) && clean(a)).map(([q, a]) => `- Q: ${q} A: ${a}`),
  ];
  return scrubPrivate(lines.join("\n"));
}
