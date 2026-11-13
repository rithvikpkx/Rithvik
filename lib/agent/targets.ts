/** Resolves a server action target (a record name, never a URL) to something the site can do.
 *  The server emits `project-<slug>`, `experience-<slug>`, `education`, `bento`, `about`; the v7
 *  designs each name their own sections, so scroll targets fall back through shared anchors. */

export type Resolved = { kind: "case"; slug: string } | { kind: "scroll"; ids: string[] };

/** A project target opens its case sheet; anything else becomes an ordered list of element ids to try. */
export function resolveTarget(target: string): Resolved {
  if (target.startsWith("project-")) return { kind: "case", slug: target.slice(8) };
  const alias: Record<string, string> = { bento: "about", education: "experience" };
  const ids = [target, target.startsWith("experience-") ? "experience" : "", alias[target] ?? "", "top"];
  return { kind: "scroll", ids: ids.filter(Boolean) };
}

export type Pickable = { id: string; name: string; words: string[] };

/** `/theme <x>`: matches a design by id, then by name or keyword (case-insensitive substring of the name). */
export function findEntry<T extends Pickable>(list: T[], arg: string): T | undefined {
  const a = arg.trim().toLowerCase();
  if (!a) return undefined;
  return (
    list.find((e) => e.id === a) ??
    list.find((e) => e.name.toLowerCase().includes(a) || e.words.some((w) => w.toLowerCase() === a))
  );
}
