/** Pure types and helpers for the /admin/visitors pages (no server imports, so node:test can load them). */
import { dateOrNull } from "../agent/chats.ts";

export type VisitorRow = {
  id: string; first_seen: string; last_seen: string; first_ip: string | null; last_ip: string | null; ips: string[];
  company: string | null; org: string | null; asn: string | null; ip_type: "business" | "isp" | "hosting" | "edu" | null;
  city: string | null; region: string | null; country: string | null; timezone: string | null; languages: string | null;
  user_agent: string | null; browser: string | null; os: string | null; device: string | null; screen: string | null;
  first_referrer: string | null; first_utm: Record<string, string> | null;
  email: string | null; name: string | null; company_given: string | null; visits: number;
  identified_at: string | null; is_bot: boolean;
  role?: string | null; visitor_kind?: string | null; job_posting?: string | null; // what they told the agent
};
export type VisitRow = {
  id: string; visitor_id: string; started_at: string; ended_at: string; ip: string | null; entry_url: string | null; referrer: string | null;
  utm: Record<string, string> | null; design: string | null; viewport: string | null; tz: string | null; lang: string | null; is_bot: boolean;
};
export type EventRow = { id: number; visit_id: string; at: string; type: string; data: Record<string, unknown> | null };
export type ChatLink = { id: string; created_at: string; visit_turns: number; preview: string };

export type VisitorFilters = { identified: boolean; bots: boolean; company: string; country: string; from: string | null; to: string | null };

type Params = Record<string, string | string[] | undefined>;

/** Reads the filter form's query string; anything malformed falls back to "no filter". */
export function parseVisitorFilters(sp: Params): VisitorFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? null;
  const country = (one("country") ?? "").trim().toUpperCase();
  return {
    identified: one("identified") === "1",
    bots: one("bots") === "1",
    company: (one("company") ?? "").trim().slice(0, 80),
    country: /^[A-Z]{2}$/.test(country) ? country : "",
    from: dateOrNull(one("from")),
    to: dateOrNull(one("to")),
  };
}

/** "City, Region, CC" from whatever geo parts exist, or an em dash. */
export function place(v: Pick<VisitorRow, "city" | "region" | "country">): string {
  return [v.city, v.region, v.country].filter(Boolean).join(", ") || "—";
}

/** Who the visitor says they are, else who their network says: the best single label for a list row. */
export function whoLabel(v: Pick<VisitorRow, "name" | "email" | "company" | "company_given" | "org">): string {
  return v.name || v.email || v.company_given || v.company || v.org || "anonymous";
}

/** Milliseconds as "1m 05s" / "12s". */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : NaN);

/** One-line description of an event for the timeline. */
export function describeEvent(e: Pick<EventRow, "type" | "data">): string {
  const d = e.data ?? {};
  switch (e.type) {
    case "pageview": return `${str(d.path)}${str(d.title) ? ` (${str(d.title)})` : ""}`;
    case "design": return `design: ${str(d.design)}${str(d.theme) ? ` / ${str(d.theme)}` : ""}`;
    case "section": return `saw #${str(d.id)}`;
    case "click": return [str(d.hook) ? `[${str(d.hook)}${str(d.val) ? `: ${str(d.val)}` : ""}]` : str(d.tag), str(d.text) && `"${str(d.text)}"`, str(d.href) && `→ ${str(d.href)}`].filter(Boolean).join(" ");
    case "outbound": return `left to ${str(d.host)}${str(d.href) ? ` (${str(d.href)})` : ""}`;
    case "scroll": return `scrolled to ${num(d.pct)}%`;
    case "active": return `active ${duration(num(d.ms) || 0)}`;
    case "overlay": return `opened ${str(d.kind)}${str(d.ref) ? `: ${str(d.ref)}` : ""}`;
    case "resume": return `resume ${str(d.action)}`;
    case "agent_open": return `opened the agent${str(d.question) ? `: ${str(d.question)}` : ""}`;
    case "agent_turn": return `asked the agent${str(d.q) ? `: ${str(d.q)}` : ""}`;
    case "composer_open": return `opened the composer${str(d.subject) ? `: ${str(d.subject)}` : ""}`;
    case "composer_send": return `sent a message${str(d.subject) ? `: ${str(d.subject)}` : ""}`;
    case "error": return `JS error: ${str(d.msg)}${str(d.src) ? ` (${str(d.src)}:${num(d.line) || "?"})` : ""}`;
    case "perf": return `LCP ${num(d.lcp)} ms · INP ${num(d.inp)} ms · CLS ${num(d.cls)}`;
    case "identify": return `identified: ${str(d.email)}`;
    default: return e.type;
  }
}

/** Seconds-offset label "+0:12" of an event from its visit start. */
export function offset(startIso: string, atIso: string): string {
  const s = Math.max(0, Math.round((Date.parse(atIso) - Date.parse(startIso)) / 1000));
  return `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
