/** Pure types and filter parsing for the /admin/chats pages (no server imports, so node:test can load it). */

export type SessionRow = {
  id: string;
  created_at: string;
  last_at: string;
  country: string | null;
  region: string | null;
  city: string | null;
  user_agent: string | null;
  referrer: string | null;
  first_design: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_company: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  follow_up: boolean;
  notes: string | null;
};

export type MessageRow = {
  id: number;
  created_at: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tools: unknown;
  sources: unknown;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  ttfb_ms: number | null;
  total_ms: number | null;
  status: number | null;
  error: string | null;
  cached: boolean;
};

export type Filters = { q: string; email: boolean; followUp: boolean; from: string | null; to: string | null };

type Params = Record<string, string | string[] | undefined>;

/** A YYYY-MM-DD string that is a real calendar date, else null. */
export function dateOrNull(v: string | null): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}

/** Reads the filter form's query string; anything malformed falls back to "no filter". */
export function parseFilters(sp: Params): Filters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? null;
  return {
    q: (one("q") ?? "").trim().slice(0, 100),
    email: one("email") === "1",
    followUp: one("follow") === "1",
    from: dateOrNull(one("from")),
    to: dateOrNull(one("to")),
  };
}

/** Escapes LIKE wildcards so a search for "100%" matches literally (the value itself is parameterised). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** The day after a YYYY-MM-DD date, as an exclusive upper bound for `created_at`. */
export function dayAfter(ymd: string): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString();
}

/** "City, Region, CC" from whatever geo parts exist, or an em dash. */
export function placeLabel(s: Pick<SessionRow, "city" | "region" | "country">): string {
  return [s.city, s.region, s.country].filter(Boolean).join(", ") || "—";
}
