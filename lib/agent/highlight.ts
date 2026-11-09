/** Which page element an answer's citations point at, and whether to scroll there on its own.
 *  Pure: the route uses anchorFor() to tag sources, the client uses autoScrollTarget() once per answer. */

/** Visitor scrolled or typed within this window: don't fight them. */
export const QUIET_MS = 3000;

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

/**
 * The anchor to scroll to after an answer, or null. Picks the most relevant cited source
 * (lowest n: sources are numbered by retrieval score) whose element exists in this design.
 * Never while the agent is full screen, an overlay covers the page, or the visitor was just active.
 */
export function autoScrollTarget(o: {
  answer: string;
  sources: Cite[];
  exists: (id: string) => boolean;
  full: boolean;
  covered: boolean;
  lastActivity: number;
  now: number;
}): string | null {
  if (o.full || o.covered || o.now - o.lastActivity < QUIET_MS) return null;
  const cited = new Set(citedNumbers(o.answer));
  const best = o.sources
    .filter((s) => cited.has(s.n) && s.anchor && o.exists(s.anchor))
    .sort((a, b) => a.n - b.n)[0];
  return best?.anchor ?? null;
}
