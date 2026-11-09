/** Server-side calendar availability: fetches the secret iCal feed, reduces it to busy intervals and answers
 *  "is this time free" / "when is he free". Only times and free/busy ever leave this module (the parser never reads titles,
 *  places or people), and the feed URL is never logged or put in an error message. Imports of next/* are lazy so
 *  scripts/calendar-check.mjs can run the same code outside Next. */

import { isValidTz, parseBusy, fromWall, type Interval } from "./ics.ts";
import { blockedReason, formatAt, freeSlots, MAX_DAYS, type Reason } from "./slots.ts";

const DAY = 86_400_000;
const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 5 * 1024 * 1024;
const CACHE_S = 300;
const FALLBACK_TZ = "America/Los_Angeles";

/** Bad tool input (a date or zone the caller got wrong); safe to show the model. */
export class CalendarInputError extends Error {}
/** Feed missing, slow, oversized or unparseable; the message is generic by design. */
export class CalendarUnavailableError extends Error {}

export type Availability = { free: boolean; reason?: Reason; localStart: string; visitorStart?: string };
export type Suggestion = { startISO: string; localStart: string; visitorStart?: string };

// ---- feed ----

/** Downloads the feed (https only, 6s timeout, 5 MB cap) and returns busy intervals overlapping [from, to). */
export async function fetchBusyUncached(url: string | undefined, from: number, to: number, tz: string): Promise<Interval[]> {
  if (!url) throw new CalendarUnavailableError("calendar not configured");
  const target = url.trim().replace(/^webcal:/i, "https:");
  if (!/^https:\/\//i.test(target)) throw new CalendarUnavailableError("calendar not configured");
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(`status ${res.status}`);
    if (Number(res.headers.get("content-length")) > MAX_BYTES) throw new Error("too large");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("too large"); }
      chunks.push(value);
    }
    return parseBusy(new TextDecoder().decode(Buffer.concat(chunks)), from, to, tz).busy;
  } catch (err) {
    // Log the error class only: fetch errors can embed the URL, which is a secret.
    console.error("[calendar] feed fetch failed:", err instanceof Error ? err.name : "unknown");
    throw new CalendarUnavailableError("calendar unavailable");
  }
}

let memo: { key: string; at: number; busy: Interval[] } | null = null;

/** Busy intervals for today-1d .. today+22d: 5-minute in-process memo over Next's `unstable_cache` (shared across lambdas). */
async function loadBusy(now: number, tz: string): Promise<Interval[]> {
  const from = Math.floor(now / DAY) * DAY - DAY;
  const to = from + (MAX_DAYS + 2) * DAY;
  const key = `${from}:${tz}`;
  if (memo && memo.key === key && now - memo.at < CACHE_S * 1000) return memo.busy;
  let ran = false;
  const load = async () => { ran = true; return fetchBusyUncached(process.env.CALENDAR_ICS_URL, from, to, tz); };
  let busy: Interval[];
  try {
    const { unstable_cache } = await import("next/cache");
    busy = await unstable_cache(load, ["calendar-busy", key], { revalidate: CACHE_S })();
  } catch (err) {
    if (ran) throw err; // the feed itself failed; do not fetch twice
    busy = await load(); // no Next request scope (script/test): fetch directly
  }
  memo = { key, at: now, busy };
  return busy;
}

/** His current timezone from site content, falling back to a fixed default if the content read fails. */
export async function ownerTz(): Promise<string> {
  try {
    const { getContent } = await import("@/lib/content");
    const tz = (await getContent()).now.tz;
    if (isValidTz(tz)) return tz;
  } catch { /* fall through */ }
  return FALLBACK_TZ;
}

// ---- input ----

/** ISO date-time to epoch ms. Offset-less values are wall time in `wallTz`. Throws CalendarInputError. */
export function parseInstant(iso: unknown, wallTz: string): number {
  const m = typeof iso === "string" && /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(iso.trim());
  if (!m) throw new CalendarInputError("startISO must be an ISO 8601 date-time like 2026-11-10T09:00:00-05:00");
  const base = `${m[1]}T${m[2]}${m[3] ?? ":00"}`;
  const naive = Date.parse(`${base}Z`);
  if (Number.isNaN(naive) || new Date(naive).toISOString().slice(0, 10) !== m[1]) throw new CalendarInputError("startISO is not a real date"); // Feb 30 rolls over silently
  const off = m[5]?.toUpperCase();
  const ms = off ? Date.parse(`${base}${m[4] ?? ""}${off.length === 5 ? off.slice(0, 3) + ":" + off.slice(3) : off}`) : fromWall(naive, wallTz);
  if (Number.isNaN(ms)) throw new CalendarInputError("startISO is not a real date");
  return ms;
}

/** Validates an optional visitor timezone. */
function visitorZone(tz: unknown): string | undefined {
  if (tz === undefined || tz === null || tz === "") return undefined;
  if (!isValidTz(tz)) throw new CalendarInputError("visitorTz must be an IANA timezone like America/New_York");
  return tz;
}

/** Validates a duration in minutes (15-120). */
function duration(v: unknown): number {
  const n = v === undefined || v === null ? 30 : Number(v);
  if (!Number.isInteger(n) || n < 15 || n > 120) throw new CalendarInputError("durationMin must be a whole number from 15 to 120");
  return n;
}

// ---- public API ----

/** Is `[startISO, +durationMin)` free? A start without an offset is read in the visitor's zone (else his). */
export async function checkAvailability(startISO: string, durationMin: number = 30, visitorTz?: string, now: number = Date.now()): Promise<Availability> {
  const dur = duration(durationMin);
  const vz = visitorZone(visitorTz);
  const tz = await ownerTz();
  const start = parseInstant(startISO, vz ?? tz);
  // Past / too-far / out-of-hours need no feed, so those answers survive a feed outage.
  const reason = blockedReason([], start, dur, now, tz) ?? blockedReason(await loadBusy(now, tz), start, dur, now, tz);
  const local = formatAt(start, tz);
  return { free: reason === null, ...(reason && { reason }), localStart: local, ...(vz && { visitorStart: formatAt(start, vz, false) }) };
}

/** Up to `count` (default 3, max 10) free slots from `fromISO` (default now) over `days` (default 7, max 21), earliest first, spread across days. */
export async function suggestTimes(o: { fromISO?: string; days?: number; durationMin?: number; visitorTz?: string; count?: number } = {}, now: number = Date.now()): Promise<Suggestion[]> {
  const dur = duration(o.durationMin);
  const days = o.days === undefined ? 7 : Number(o.days);
  const count = o.count === undefined ? 3 : Number(o.count);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new CalendarInputError(`days must be a whole number from 1 to ${MAX_DAYS}`);
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new CalendarInputError("count must be a whole number from 1 to 10");
  const vz = visitorZone(o.visitorTz);
  const tz = await ownerTz();
  const from = o.fromISO ? parseInstant(o.fromISO, vz ?? tz) : now;
  const slots = freeSlots(await loadBusy(now, tz), { from, now, days, durMin: dur, count, tz });
  return slots.map((ms) => ({
    startISO: new Date(ms).toISOString(), localStart: formatAt(ms, tz), ...(vz && { visitorStart: formatAt(ms, vz, false) }),
  }));
}
