/** Pure DB-rows → v7 `Content` mapping. No server-only imports so node:test can load it. */
import type { Content, ContentProject, ContentRole } from "./types";
import { fixture } from "./fixture.ts"; // explicit .ts: node's strip-types loader needs it

// New v7 columns are optional/nullable: a partially applied migration must not crash the page.
export type ProjectRow = { slug: string; title?: string | null; badge?: string | null; description?: string | null; tags?: string[] | null;
  links?: Record<string, string> | null; headline?: string | null; kind?: string | null; icon?: string | null; ctx?: string | null; v7_order?: number | null };
export type ExperienceRow = { slug: string; role?: string | null; org?: string | null; date_range?: string | null; period?: string | null;
  location?: string | null; description?: string | null; tags?: string[] | null };
export type EducationRow = { school?: string | null; degree?: string | null; concentrations?: string[] | null; logo_path?: string | null; focus?: string | null; grad?: string | null };
export type Rows = { projects: ProjectRow[]; experience: ExperienceRow[]; education: EducationRow[]; site: Record<string, string> };

const bullets = (s?: string | null) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
/** Returns `v` unless it is null or an empty array, else the fallback. */
const arr = (v: string[] | null | undefined, fb: string[]) => (v && v.length ? v : fb);

/** Parses a JSON site_content value; returns the fallback on missing/invalid JSON or wrong top-level type. */
function json<T>(raw: string | undefined, fb: T): T {
  if (raw == null) return fb;
  try {
    const v: unknown = JSON.parse(raw);
    return typeof v === "object" && v !== null && Array.isArray(v) === Array.isArray(fb) ? (v as T) : fb;
  } catch { return fb; }
}

/** DB link keys are lowercase ("github"); the v7 UI wants labels ("GitHub"). */
const LABELS: Record<string, string> = { github: "GitHub", demo: "Demo", live: "Live", linkedin: "LinkedIn" };
const labelLinks = (l: Record<string, string>) => Object.fromEntries(Object.entries(l).map(([k, v]) => [LABELS[k.toLowerCase()] ?? k, v]));

/** Maps raw rows to `Content`, taking each missing/empty field from the fixture. */
export function toContent({ projects, experience, education, site }: Rows): Content {
  const fx = fixture;

  const proj: ContentProject[] = [...projects]
    .sort((a, b) => (a.v7_order ?? 99) - (b.v7_order ?? 99)) // stable: ties keep the sort_order query order
    .map((r) => {
      const f = fx.projects.find((p) => p.slug === r.slug);
      const hasLinks = Object.keys(r.links ?? {}).length > 0;
      return {
        slug: r.slug,
        title: r.title || f?.title || r.slug,
        headline: r.headline || f?.headline || "",
        kind: r.kind || f?.kind || r.badge || "",
        icon: r.icon || f?.icon || "cpu",
        ctx: r.ctx || f?.ctx || "",
        desc: arr(bullets(r.description), f?.desc ?? []),
        tags: arr(r.tags, f?.tags ?? []),
        links: hasLinks ? labelLinks(r.links!) : f?.links ?? {},
      };
    });

  const exp: ContentRole[] = experience.map((r) => {
    const f = fx.experience.find((e) => e.slug === r.slug);
    return {
      slug: r.slug,
      role: r.role || f?.role || "",
      org: r.org || f?.org || "",
      when: r.period || f?.when || r.date_range || "",
      where: r.location || f?.where || "",
      desc: arr(bullets(r.description), f?.desc ?? []),
      tags: arr(r.tags, f?.tags ?? []),
    };
  });

  const ed = education[0];
  const first = site["hero.name.line1"] || fx.first;
  const last = site["hero.name.line2"] || fx.last;
  const mail = (site["contact.link.email"] ?? "").replace(/^mailto:/, "");

  return {
    name: `${first} ${last}`,
    first,
    last,
    initials: (first.slice(0, 1) + last.split(" ").map((w) => w.slice(0, 1)).join("")).toUpperCase(),
    role: site["v7.role"] || fx.role,
    status: site["v7.status"] || fx.status,
    line: site["v7.line"] || fx.line,
    thesis: json(site["v7.thesis"], fx.thesis),
    about: json(site["v7.about"], fx.about),
    now: { ...fx.now, ...json<Partial<Content["now"]>>(site["v7.now"], {}) },
    places: json(site["v7.places"], fx.places),
    links: {
      email: mail || fx.links.email,
      github: site["contact.link.github"] || fx.links.github,
      linkedin: site["contact.link.linkedin"] || fx.links.linkedin,
    },
    projects: proj.length ? proj : fx.projects,
    experience: exp.length ? exp : fx.experience,
    education: {
      school: ed?.school || fx.education.school,
      degree: ed?.degree || fx.education.degree,
      focus: ed?.focus || ed?.concentrations?.join(" · ") || fx.education.focus,
      grad: ed?.grad ?? "", // empty = not shown; never fall back to a placeholder
      logo: ed?.logo_path?.split("/").pop() || fx.education.logo,
    },
    stack: json(site["v7.stack"], fx.stack),
    faq: json(site["v7.faq"], fx.faq),
    workAuth: site["profile.work_authorization"] || fx.workAuth,
    numbers: json(site["v7.numbers"], fx.numbers),
    log: fx.log, // shortcut: static commit feed; wire to a git/GitHub source later
  };
}
