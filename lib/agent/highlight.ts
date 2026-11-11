/** Which page element an answer's citations point at. Pure: the route uses anchorFor() to tag sources.
 *  Nothing scrolls on its own: a footnote click is the only thing that moves the page. */

/** The on-page anchor for a retrieved primary record, or undefined (uploaded docs have none). */
export function anchorFor(table: string | undefined, meta: Record<string, unknown> | null | undefined, ok: { projects: string[]; roles: string[] }): string | undefined {
  const m = meta ?? {};
  const slug = typeof m.slug === "string" ? m.slug : "";
  const key = typeof m.key === "string" ? m.key : "";
  if (table === "projects") return ok.projects.includes(slug) ? `project-${slug}` : undefined;
  if (table === "experience") return ok.roles.includes(slug) ? `experience-${slug}` : undefined;
  if (table === "education") return "about";
  if (table === "site_content") {
    if (key.startsWith("contact.")) return "contact";
    if (key === "v7.faq") return "questions";
    if (/^(hero\.|bento\.|v7\.(about|now|line|thesis|role|status))/.test(key)) return "about";
  }
  return undefined;
}

export type Cite = { n: number; anchor?: string };

/** The [n] numbers an answer cites, unique, in order of appearance. */
export function citedNumbers(answer: string): number[] {
  return [...new Set([...answer.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])))];
}
