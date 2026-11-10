/** Pure shaping for the dashboard's visual lists: the day ring, a conversation's glyph strip, a visitor's activity.
 *  No server imports, so node:test loads it. */

const DAY = 86_400_000;

/** Counts timestamps by UTC hour of day: 24 values, index = hour. Bad dates are skipped. */
export function hourRhythm(times: string[]): number[] {
  const out = Array<number>(24).fill(0);
  for (const t of times) {
    const ms = Date.parse(t);
    if (Number.isFinite(ms)) out[new Date(ms).getUTCHours()] += 1;
  }
  return out;
}

export type StripKind = "u" | "t" | "a" | "e";
export type StripMark = { o: number; k: StripKind; c?: boolean };
export type Strip = { marks: StripMark[]; ms: number; tokens: number };
export type StripRow = {
  created_at: string; role: string; status: number | null; error: string | null; cached: boolean | null;
  tokens_in: number | null; tokens_out: number | null;
};

/** One conversation as glyphs on 0..1 of its own duration: u = question, t = tool call, a = answer (c = from
 *  cache), e = failed answer. Rows must be one session's, in order. */
export function sessionStrip(rows: StripRow[]): Strip {
  const ts = rows.map((r) => Date.parse(r.created_at)).filter(Number.isFinite);
  const t0 = ts.length ? Math.min(...ts) : 0, span = ts.length ? Math.max(...ts) - t0 : 0;
  let tokens = 0;
  const marks = rows.map((r): StripMark => {
    tokens += (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
    const t = Date.parse(r.created_at);
    const o = span > 0 && Number.isFinite(t) ? (t - t0) / span : 0;
    const bad = r.role === "assistant" && (!!r.error || (r.status !== null && r.status >= 400));
    return { o, k: r.role === "user" ? "u" : r.role === "tool" ? "t" : bad ? "e" : "a", ...(r.cached ? { c: true } : {}) };
  });
  return { marks, ms: span, tokens };
}

export type Activity = { days: number[]; keys: Record<string, number> };

/** Per visitor: visits per day over the last `n` days (oldest first, today last, UTC) and counts of key events. */
export function visitorActivity(
  visits: { id: string; visitor_id: string; started_at: string }[], events: { visit_id: string; type: string }[], now: number, n = 30,
): Record<string, Activity> {
  const out: Record<string, Activity> = {};
  const owner = new Map<string, string>();
  const today = Math.floor(now / DAY);
  for (const v of visits) {
    owner.set(v.id, v.visitor_id);
    const a = (out[v.visitor_id] ??= { days: Array<number>(n).fill(0), keys: {} });
    const i = n - 1 - (today - Math.floor(Date.parse(v.started_at) / DAY));
    if (i >= 0 && i < n) a.days[i] += 1;
  }
  for (const e of events) {
    const id = owner.get(e.visit_id);
    if (id) out[id].keys[e.type] = (out[id].keys[e.type] ?? 0) + 1;
  }
  return out;
}

/** A stable 32-bit hash of a string (FNV-1a): seeds identicons so the same visitor always gets the same glyph. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
