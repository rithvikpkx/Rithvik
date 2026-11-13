import "server-only";
import type { Content } from "@/lib/content";
import type { Theme } from "@/lib/types";
import { DESIGNS } from "@/lib/designs/registry";
import { GAMES } from "@/lib/play/games";
import type { Allowed, ToolCtx } from "./tools";
import { githubUser, linkedRepos, readCode } from "./github";

/** What tool arguments may name this turn, from the published content, the design registry and the palettes. */
export function allowedFor(content: Content, palettes: Theme[]): Allowed {
  return {
    projects: content.projects.map((p) => ({ slug: p.slug, title: p.title })),
    roles: content.experience.map((r) => r.slug),
    games: GAMES.map((g) => ({ id: g.id, name: g.name })),
    looks: [...DESIGNS.map((d) => ({ id: d.id, name: d.name })), ...palettes.map((t) => ({ id: t.slug, name: t.name }))],
    places: content.places.map((p) => ({ key: p.key, city: p.city, tz: p.tz })),
    repos: (() => { const u = githubUser(content.links.github); return u ? linkedRepos(content.projects.flatMap((p) => Object.values(p.links)), u) : []; })(),
  };
}

/** read_code bound to the owner's GitHub account (from the profile link); absent when there is none. */
export function codeReader(content: Content): Pick<ToolCtx, "readCode"> {
  const user = githubUser(content.links.github);
  return user ? { readCode: (repo?: string, path?: string) => readCode(user, repo, path) } : {};
}
