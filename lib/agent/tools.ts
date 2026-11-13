/** The agent's tools: OpenAI function definitions plus server-side validation of every call.
 *  The model only ever names things (a slug, a section id, a game id); each name is checked
 *  against content/registry here and anything unknown is dropped. No tool takes or returns a
 *  URL. Pure (no "@/" imports) so node:test can load it. */
import type { ToolCall, ToolDef } from "../openai.ts";
import { calendarTools, runCalendarTool } from "../calendar/tools.ts";
import { validateMeeting } from "./meeting.ts";
import { ARTIFACT_TYPES, MAX_COLS, MAX_POINTS, MAX_ROWS, MAX_SERIES, MAX_TEXT, parseArtifact, type ArtifactSpec } from "./artifacts.ts";

/** Whole-page sections every design carries (plus project-<slug> / experience-<slug>). */
export const SECTION_IDS = ["top", "work", "experience", "about", "play", "questions", "contact"];
/** At most this many model steps (completion → tools → completion …) per turn. */
export const MAX_STEPS = 3;
/** At most this many side-effect tools per step; extras are dropped. */
export const MAX_SIDE_EFFECTS = 2;
/** Read-only calendar tools: the server runs them inside the step loop; the visitor is never asked. */
const CALENDAR = new Set(["check_availability", "suggest_times"]);
const CALENDAR_KEYS = new Set(["startISO", "fromISO", "days", "durationMin", "count", "visitorTz"]);
/** At most this many artifacts per step; extras are rejected. */
const MAX_ARTIFACTS = 1;
/** At most this many calendar lookups per step; extras are rejected. */
const MAX_CALENDAR = 4;
const SIDE_EFFECTS = new Set(["open_project", "show_section", "open_resume", "start_game", "switch_design", "draft_email", "request_meeting"]);
/** Stands in for the real session id when validating a meeting request's fields; the id is checked again at send time. */
const NO_SESSION = "00000000-0000-4000-8000-000000000000";

/** What tool arguments may name, built from the published content + registry for this turn. */
export type Allowed = {
  projects: { slug: string; title: string }[];
  roles: string[]; // experience slugs
  games: { id: string; name: string }[];
  looks: { id: string; name: string }[]; // design ids + palette slugs
  places: { key: string; city: string; tz: string }[];
};

/** `artifact` is set only for render_artifact: the rebuilt spec the route sends as an `artifact` frame (no tool row). */
export type ValidCall = { id: string; name: string; args: Record<string, string>; result?: string; artifact?: ArtifactSpec };

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
    fn("render_artifact", `Show the visitor a small chart or table of facts that are in the Profile or Records, drawn by the site from your data. Use only when a visual genuinely beats prose: a timeline of roles, a comparison of projects, skills by area, a few headline stats. Never invent numbers or dates; if the facts aren't there, answer in text. It renders at once and nothing needs confirming. Limits: up to ${MAX_POINTS} points, ${MAX_SERIES} series, ${MAX_ROWS} rows x ${MAX_COLS} columns, text up to ${MAX_TEXT} chars, finite numbers, no links or markup. data shape by type: bar|line|area {labels:[..], series:[{name, values:[numbers, one per label]}]}; donut {slices:[{label, value}]} (up to 8); timeline {items:[{label, start:"2024" or "2024-06", end?:"2025-01" or "present", note?}]}; table {columns:[..], rows:[[cells..]]}; stats {items:[{label, value, note?}]} (up to 8); graph {nodes:[{id,label,group?}], edges:[{from,to}]}.`, {
      type: enumOf([...ARTIFACT_TYPES], "Chart form"),
      title: { type: "string", description: "A few words naming what is shown" },
      unit: { type: "string", description: "Optional unit for numbers, like % or ms" },
      data: { type: "object", description: "Shape depends on type (see tool description)" },
    }, ["type", "title", "data"]),
    ...(calendarTools as unknown as ToolDef[]),
    fn("request_meeting", "Prepare a meeting or interview request to Rithvik from what the visitor told you. It is NOT sent: the visitor sees a button listing the details and sends it by clicking.", {
      name: { type: "string", description: "Visitor's name" },
      email: { type: "string", description: "Visitor's email, exactly as they gave it" },
      company: { type: "string", description: "Visitor's company or school" },
      role: { type: "string", description: "Visitor's role or the role being discussed" },
      times: { type: "array", items: { type: "string" }, maxItems: 5, description: "1-5 proposed times, each with a date and time, ideally checked free" },
      notes: { type: "string", description: "Anything else the visitor wants Rithvik to know" },
    }, ["name", "email", "times"]),
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

/** Runs the same checks the send path uses (meeting.ts) over model-supplied fields; notes lose URLs like draft_email's. */
function checkMeeting(raw: Record<string, unknown>): ReturnType<typeof validateMeeting> {
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const times = Array.isArray(raw.times) ? raw.times.filter((t): t is string => typeof t === "string") : [];
  // The card is read by a person: each time states its own zone, so ISO strings are bounced back to the model.
  if (times.some((t) => /^\d{4}-\d\d-\d\dT/.test(t.trim()))) return { ok: false, error: 'Write each time as readable text with its zone, like "Tue Nov 10, 10:00 AM PT", not an ISO string.' };
  return validateMeeting({
    name: s(raw.name) ?? "", email: s(raw.email) ?? "", company: s(raw.company), role: s(raw.role), times,
    notes: plain(raw.notes, 2000) || undefined,
    sessionId: NO_SESSION,
  });
}

/** Why a request_meeting call was refused, worded for the model to relay; "" for any other cause. */
function meetingError(args: string): string {
  try {
    const raw = JSON.parse(args || "{}");
    const m = checkMeeting(raw && typeof raw === "object" ? raw : {});
    return m.ok ? "" : m.error;
  } catch {
    return "";
  }
}

/** Why a render_artifact call was refused, worded for the model to fix and retry; "" when it parses. */
function artifactError(args: string): string {
  const p = parseArtifact(args.trim() ? args : "{}");
  return p.ok ? "" : p.error;
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
    case "render_artifact": {
      const p = parseArtifact(raw);
      return p.ok ? { id, name: call.name, args: { type: p.spec.type, title: p.spec.title }, artifact: p.spec } : null;
    }
    case "check_availability":
    case "suggest_times": {
      // Values are range-checked by runCalendarTool; here only the known keys survive, as strings for the tool row.
      const args = Object.fromEntries(Object.entries(raw).filter(([k, v]) => CALENDAR_KEYS.has(k) && (typeof v === "string" || typeof v === "number")).map(([k, v]) => [k, String(v)]));
      return { id, name: call.name, args };
    }
    case "request_meeting": {
      const m = checkMeeting(raw);
      if (!m.ok) return null;
      const v = m.value;
      // times travel as one newline-joined string (each was collapsed to a single line); undefined fields are dropped
      const args = Object.fromEntries(Object.entries({ name: v.name, email: v.email, company: v.company, role: v.role, times: v.times.join("\n"), notes: v.notes }).filter(([, x]) => x));
      return { id, name: call.name, args: args as Record<string, string> };
    }
    case "local_time": {
      const v = s("place");
      const p = a.places.find((x) => x.city.toLowerCase() === v || x.key === v) ?? a.places.find((x) => v && v.startsWith(x.city.toLowerCase()));
      return p ? { id, name: call.name, args: { place: p.city }, result: `${localTime(p.tz, now)} in ${p.city}` } : null;
    }
  }
  return null;
}

/** Validates a step's calls in order, caps side effects, and runs calendar lookups (`visitorTz` is the server-checked
 *  zone and overrides whatever the model passed). Returns the kept calls and, for every call (kept or not), the
 *  tool message the model sees next step. */
export async function screenCalls(calls: ToolCall[], a: Allowed, now = new Date(), visitorTz?: string): Promise<{ kept: ValidCall[]; replies: { id: string; content: string }[] }> {
  const kept: ValidCall[] = [];
  const replies: { id: string; content: string }[] = [];
  let effects = 0;
  let lookups = 0;
  let artifacts = 0;
  for (const c of calls) {
    const v = validateToolCall(c, a, now);
    if (!v) {
      const why = c.name === "request_meeting" ? meetingError(c.arguments) : "";
      const bad = c.name === "render_artifact" ? artifactError(c.arguments) : "";
      replies.push({ id: c.id, content: why ? `Rejected: ${why} Ask the visitor to fix it, then call request_meeting again.` : bad ? `Rejected: ${bad} Fix the data and call render_artifact once more, or answer in text.` : "Rejected: unknown tool or argument. Do not retry it; answer in text." });
      continue;
    }
    if (v.artifact) {
      if (++artifacts > MAX_ARTIFACTS) { replies.push({ id: c.id, content: "Rejected: one artifact per answer." }); continue; }
      kept.push(v);
      replies.push({ id: c.id, content: "Rendered for the visitor. Do not repeat its data in text; add at most one sentence of takeaway." });
      continue;
    }
    if (CALENDAR.has(v.name)) {
      if (++lookups > MAX_CALENDAR) { replies.push({ id: c.id, content: "Rejected: too many calendar lookups this step." }); continue; }
      const out = await runCalendarTool(v.name, { ...JSON.parse(c.arguments || "{}"), ...(visitorTz ? { visitorTz } : {}) }, now.getTime());
      kept.push({ ...v, result: out.summary });
      replies.push({ id: c.id, content: JSON.stringify(out.result) });
      continue;
    }
    if (SIDE_EFFECTS.has(v.name) && ++effects > MAX_SIDE_EFFECTS) { replies.push({ id: c.id, content: "Rejected: too many actions this step." }); continue; }
    kept.push(v);
    replies.push({ id: c.id, content: v.result ?? "Offered as a button the visitor may click. Do not claim it already happened." });
  }
  return { kept, replies };
}
