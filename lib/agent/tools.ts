/** The agent's tools: OpenAI function definitions plus server-side validation of every call.
 *  The model only ever names things (a slug, a section id, a game id); each name is checked
 *  against content/registry here and anything unknown is dropped. No tool takes or returns a
 *  URL. Pure (no "@/" imports) so node:test can load it. */
import type { ToolCall, ToolDef } from "../openai.ts";

/** Whole-page sections every design carries (plus project-<slug> / experience-<slug>). */
export const SECTION_IDS = ["top", "work", "experience", "about", "play", "questions", "contact"];
/** At most this many model steps (completion → tools → completion …) per turn. */
export const MAX_STEPS = 3;
/** At most this many side-effect tools per step; extras are dropped. */
export const MAX_SIDE_EFFECTS = 2;
const SIDE_EFFECTS = new Set(["open_project", "show_section", "open_resume", "start_game", "switch_design", "draft_email"]);

/** What tool arguments may name, built from the published content + registry for this turn. */
export type Allowed = {
  projects: { slug: string; title: string }[];
  roles: string[]; // experience slugs
  games: { id: string; name: string }[];
  looks: { id: string; name: string }[]; // design ids + palette slugs
  places: { key: string; city: string; tz: string }[];
};

export type ValidCall = { id: string; name: string; args: Record<string, string>; result?: string };

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolDef => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
});
const enumOf = (values: string[], description: string) => ({ type: "string", enum: values, description });

/** Function definitions for this turn. Enums carry the valid names so the model rarely guesses. */
export function toolDefs(a: Allowed): ToolDef[] {
  const sections = [...SECTION_IDS, ...a.projects.map((p) => `project-${p.slug}`), ...a.roles.map((r) => `experience-${r}`)];
  return [
    fn("open_project", "Open a project's case sheet on the page.", { slug: enumOf(a.projects.map((p) => p.slug), "Project slug") }, ["slug"]),
    fn("show_section", "Scroll the page to a section.", { id: enumOf(sections, "Section id") }, ["id"]),
    fn("open_resume", "Open Rithvik's resume."),
    fn("start_game", "Open one of the site's mini games.", { id: enumOf(a.games.map((g) => g.id), "Game id") }, ["id"]),
    fn("switch_design", "Switch the site's visual design or colour palette.", { id: enumOf(a.looks.map((l) => l.id), "Design id or palette slug") }, ["id"]),
    fn("draft_email", "Open the email composer to Rithvik, prefilled. It never sends; the visitor reviews and sends.", {
      subject: { type: "string", description: "Short subject line" },
      body: { type: "string", description: "Draft message body, written as the visitor" },
    }, ["subject", "body"]),
    fn("local_time", "Current local time in one of Rithvik's places.", { place: enumOf(a.places.map((p) => p.city), "City") }, ["place"]),
  ];
}

/** Plain text for the composer: control chars and URLs removed (the model never supplies links). */
function plain(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\b(?:https?|javascript|data):\S*/gi, "")
    .trim()
    .slice(0, max);
}

/** "7:42 PM EST" in `tz` at `now`. */
export function localTime(tz: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", weekday: "short", timeZone: tz, timeZoneName: "short" }).format(now);
  } catch {
    return "time unavailable";
  }
}

/** Checks one call's arguments against `a`; null when the tool or any argument is unknown. */
export function validateToolCall(call: ToolCall, a: Allowed, now = new Date()): ValidCall | null {
  let raw: Record<string, unknown>;
  try {
    raw = call.arguments.trim() ? JSON.parse(call.arguments) : {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  } catch {
    return null;
  }
  const s = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim().toLowerCase() : "");
  const id = call.id;
  switch (call.name) {
    case "open_project": {
      const p = a.projects.find((x) => x.slug === s("slug") || x.title.toLowerCase() === s("slug"));
      return p ? { id, name: call.name, args: { slug: p.slug } } : null;
    }
    case "show_section": {
      const v = s("id");
      const ok = SECTION_IDS.includes(v)
        || (v.startsWith("project-") && a.projects.some((p) => `project-${p.slug}` === v))
        || (v.startsWith("experience-") && a.roles.some((r) => `experience-${r}` === v));
      return ok ? { id, name: call.name, args: { id: v } } : null;
    }
    case "open_resume":
      return { id, name: call.name, args: {} };
    case "start_game": {
      const g = a.games.find((x) => x.id === s("id") || x.name.toLowerCase() === s("id"));
      return g ? { id, name: call.name, args: { id: g.id } } : null;
    }
    case "switch_design": {
      const l = a.looks.find((x) => x.id === s("id") || x.name.toLowerCase() === s("id"));
      return l ? { id, name: call.name, args: { id: l.id } } : null;
    }
    case "draft_email": {
      const subject = plain(raw.subject, 200);
      const body = plain(raw.body, 2000);
      return subject || body ? { id, name: call.name, args: { subject, body } } : null;
    }
    case "local_time": {
      const v = s("place");
      const p = a.places.find((x) => x.city.toLowerCase() === v || x.key === v) ?? a.places.find((x) => v && v.startsWith(x.city.toLowerCase()));
      return p ? { id, name: call.name, args: { place: p.city }, result: `${localTime(p.tz, now)} in ${p.city}` } : null;
    }
  }
  return null;
}

/** Validates a step's calls in order and caps side effects. Returns the kept calls and, for every
 *  call (kept or not), the tool message the model sees next step. */
export function screenCalls(calls: ToolCall[], a: Allowed, now = new Date()): { kept: ValidCall[]; replies: { id: string; content: string }[] } {
  const kept: ValidCall[] = [];
  const replies: { id: string; content: string }[] = [];
  let effects = 0;
  for (const c of calls) {
    const v = validateToolCall(c, a, now);
    if (!v) { replies.push({ id: c.id, content: "Rejected: unknown tool or argument. Do not retry it; answer in text." }); continue; }
    if (SIDE_EFFECTS.has(v.name) && ++effects > MAX_SIDE_EFFECTS) { replies.push({ id: c.id, content: "Rejected: too many actions this step." }); continue; }
    kept.push(v);
    replies.push({ id: c.id, content: v.result ?? "Queued: the visitor is asked to confirm on the page. Do not claim it already happened." });
  }
  return { kept, replies };
}
