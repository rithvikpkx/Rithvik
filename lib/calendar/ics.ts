/** iCal feed -> merged busy intervals inside a window. Pure: no I/O, and event text (titles, places, people) is never read.
 *
 *  Handles the subset Google emits: UTC / TZID / floating / all-day times, RRULE (DAILY/WEEKLY/MONTHLY/YEARLY with
 *  INTERVAL, COUNT, UNTIL, BYDAY incl. ordinals, BYMONTHDAY, BYMONTH, WKST), EXDATE, RDATE, RECURRENCE-ID overrides,
 *  TRANSP:TRANSPARENT and STATUS:CANCELLED (both free).
 *  shortcut: Windows-style TZIDs fall back to the calendar's own tz; FREQ below DAILY counts only its first instance;
 *  RANGE=THISANDFUTURE and RDATE periods are ignored. Upgrade to a library if the feed source changes from Google. */

export type Interval = { start: number; end: number };

const DAY = 86_400_000;
const MAX_PERIODS = 50_000; // runaway guard for rules with no UNTIL/COUNT that started long ago

// ---- time zones (Intl only, no tz database dependency) ----

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Cached en-US formatter for `tz` that spells every field numerically (h23 so midnight is 0, not 24). */
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** True when `tz` is an IANA zone this runtime knows. */
export function isValidTz(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try { formatter(tz); return true; } catch { return false; }
}

/** The wall clock in `tz` at instant `ms`, encoded as if it were UTC ("wall ms"), so date math is plain arithmetic. */
export function toWall(ms: number, tz: string): number {
  const p: Record<string, number> = {};
  for (const { type, value } of formatter(tz).formatToParts(ms)) if (type !== "literal") p[type] = Number(value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/** Inverse of toWall: the instant at which `tz`'s clock reads `wall` (two passes settle DST; gaps resolve forward). */
export function fromWall(wall: number, tz: string): number {
  if (tz === "UTC") return wall;
  const off = (t: number) => toWall(t, tz) - Math.floor(t / 1000) * 1000;
  return wall - off(wall - off(wall));
}

// ---- line + property parsing ----

type Prop = { params: Record<string, string>; value: string };
type Dt = { ms: number; wall: number; tz: string; allDay: boolean };

const LINE = /^([A-Za-z0-9-]+)((?:;[^:;=]+=(?:"[^"]*"|[^:;]*))*):(.*)$/;

/** Unfolds RFC 5545 continuation lines and returns [NAME, props] pairs. */
function parseLines(ics: string): [string, Prop][] {
  const out: [string, Prop][] = [];
  for (const raw of ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const params: Record<string, string> = {};
    for (const p of m[2].split(";").slice(1)) {
      const i = p.indexOf("=");
      params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, "");
    }
    out.push([m[1].toUpperCase(), { params, value: m[3] }]);
  }
  return out;
}

/** Parses a DATE / DATE-TIME value; floating and all-day values use `fallbackTz`. Null when malformed. */
function parseDt(value: string, params: Record<string, string>, fallbackTz: string): Dt | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0", s = "0"] = m.slice(1, 7);
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (m[4] === undefined) return { wall, ms: fromWall(wall, fallbackTz), tz: fallbackTz, allDay: true };
  if (m[7]) return { wall, ms: wall, tz: "UTC", allDay: false };
  const tz = isValidTz(params.TZID) ? params.TZID : fallbackTz;
  return { wall, ms: fromWall(wall, tz), tz, allDay: false };
}

/** ISO-8601 duration (P1W, P1DT2H30M) to ms; days count as 24h. Null when malformed. */
function parseDuration(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const [w, d, h, mi, s] = m.slice(2).map((x) => Number(x ?? 0));
  const ms = (((w * 7 + d) * 24 + h) * 60 + mi) * 60_000 + s * 1000;
  return m[1] === "-" ? -ms : ms;
}

// ---- recurrence rules ----

type Rule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number; count: number; until: number | null; wkst: number;
  byday: { n: number; dow: number }[]; bymonthday: number[]; bymonth: number[];
};

const DOW = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const nums = (v?: string) => (v ? v.split(",").map(Number).filter((n) => Number.isInteger(n)) : []);

/** RRULE text to a Rule, or null when the FREQ is one we do not expand. `tz` resolves a floating UNTIL. */
function parseRule(text: string, tz: string): Rule | null {
  const kv: Record<string, string> = {};
  for (const part of text.split(";")) { const i = part.indexOf("="); if (i > 0) kv[part.slice(0, i).toUpperCase()] = part.slice(i + 1); }
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(kv.FREQ)) return null;
  const byday = (kv.BYDAY?.split(",") ?? []).flatMap((x) => {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(x.trim());
    return m ? [{ n: Number(m[1] ?? 0), dow: DOW.indexOf(m[2]) }] : [];
  });
  let until: number | null = null;
  if (kv.UNTIL) {
    const u = parseDt(kv.UNTIL, {}, tz);
    if (u) until = u.allDay ? u.ms + DAY - 1 : u.ms; // a date-only UNTIL includes that whole day
  }
  const wk = DOW.indexOf(kv.WKST ?? "MO");
  return {
    freq: kv.FREQ as Rule["freq"], interval: Math.max(1, Number(kv.INTERVAL) || 1), count: Number(kv.COUNT) || 0,
    until, wkst: wk < 0 ? 1 : wk, byday, bymonthday: nums(kv.BYMONTHDAY), bymonth: nums(kv.BYMONTH),
  };
}

/** Days (1-based) of month `mo` (0-based) of year `y` selected by the rule's BYMONTHDAY/BYDAY, else `dflt`. */
function monthDays(y: number, mo: number, r: Rule, dflt: number): number[] {
  const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const dowOf = (d: number) => new Date(Date.UTC(y, mo, d)).getUTCDay();
  let days: number[];
  if (r.bymonthday.length) {
    days = r.bymonthday.map((n) => (n > 0 ? n : dim + 1 + n)).filter((d) => d >= 1 && d <= dim);
    if (r.byday.length) days = days.filter((d) => r.byday.some((b) => b.dow === dowOf(d)));
  } else if (r.byday.length) {
    days = r.byday.flatMap(({ n, dow }) => {
      const all = Array.from({ length: dim }, (_, i) => i + 1).filter((d) => dowOf(d) === dow);
      if (n === 0) return all;
      const hit = all[n > 0 ? n - 1 : all.length + n];
      return hit ? [hit] : [];
    });
  } else days = dflt <= dim ? [dflt] : []; // e.g. the 31st skips short months
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Wall-clock starts of a rule's instances in order, from DTSTART until a period begins past `limit` (COUNT/UNTIL are the caller's). */
function* walls(start: Dt, r: Rule, limit: number): Generator<number> {
  const s = new Date(start.wall);
  const y0 = s.getUTCFullYear(), m0 = s.getUTCMonth(), d0 = s.getUTCDate(), dow0 = s.getUTCDay();
  const startDay = Date.UTC(y0, m0, d0);
  const tod = start.wall - startDay;
  for (let k = 0; k < MAX_PERIODS; k++) {
    let periodStart: number;
    let days: number[]; // day-start wall ms
    if (r.freq === "DAILY") {
      periodStart = startDay + k * r.interval * DAY;
      const d = new Date(periodStart);
      const ok = (!r.byday.length || r.byday.some((b) => b.dow === d.getUTCDay()))
        && (!r.bymonth.length || r.bymonth.includes(d.getUTCMonth() + 1))
        && (!r.bymonthday.length || monthDays(d.getUTCFullYear(), d.getUTCMonth(), r, 0).includes(d.getUTCDate()));
      days = ok ? [periodStart] : [];
    } else if (r.freq === "WEEKLY") {
      periodStart = startDay - ((dow0 - r.wkst + 7) % 7) * DAY + k * r.interval * 7 * DAY;
      const dows = r.byday.length ? r.byday.map((b) => b.dow) : [dow0];
      days = [...new Set(dows)].map((d) => (d - r.wkst + 7) % 7).sort((a, b) => a - b).map((o) => periodStart + o * DAY);
    } else if (r.freq === "MONTHLY") {
      const y = y0 + Math.floor((m0 + k * r.interval) / 12), mo = (m0 + k * r.interval) % 12;
      periodStart = Date.UTC(y, mo, 1);
      days = monthDays(y, mo, r, d0).map((d) => Date.UTC(y, mo, d));
    } else {
      const y = y0 + k * r.interval;
      periodStart = Date.UTC(y, 0, 1);
      days = [...(r.bymonth.length ? r.bymonth : [m0 + 1])].sort((a, b) => a - b)
        .flatMap((mo) => monthDays(y, mo - 1, r, d0).map((d) => Date.UTC(y, mo - 1, d)));
    }
    if (periodStart > limit) return;
    for (const day of days) if (day >= startDay) yield day + tod;
  }
}

// ---- events ----

type Ev = {
  uid: string; start: Dt; durMs: number; rule: Rule | null;
  exdates: Set<number>; rdates: number[]; recurrenceId: number | null; free: boolean;
};

/** Collects VEVENTs (skipping VALARM bodies) into normalized events; unparseable ones are dropped. */
function parseEvents(ics: string, tz: string): Ev[] {
  const events: Ev[] = [];
  let props: Map<string, Prop[]> | null = null;
  let alarm = 0;
  for (const [name, p] of parseLines(ics)) {
    if (name === "BEGIN") {
      if (p.value === "VEVENT") { props = new Map(); alarm = 0; } else if (props) alarm++;
    } else if (name === "END") {
      if (p.value === "VEVENT" && props) { const e = toEvent(props, tz); if (e) events.push(e); props = null; } else if (props) alarm--;
    } else if (props && alarm === 0) {
      const list = props.get(name);
      if (list) list.push(p); else props.set(name, [p]);
    }
  }
  return events;
}

/** One VEVENT's properties to an Ev, or null when it has no usable start. */
function toEvent(props: Map<string, Prop[]>, tz: string): Ev | null {
  const first = (n: string) => props.get(n)?.[0];
  const ds = first("DTSTART");
  const start = ds && parseDt(ds.value, ds.params, tz);
  if (!start) return null;
  const de = first("DTEND");
  const end = de && parseDt(de.value, de.params, tz);
  const dur = first("DURATION") && parseDuration(first("DURATION")!.value);
  const durMs = end ? end.ms - start.ms : dur ?? (start.allDay ? DAY : 0);
  const rr = first("RRULE");
  const dates = (n: string) => (props.get(n) ?? []).flatMap((p) => p.value.split(",").flatMap((v) => {
    const d = parseDt(v, p.params, start.tz);
    return d ? [d.ms] : [];
  }));
  const rid = first("RECURRENCE-ID");
  const ridDt = rid && parseDt(rid.value, rid.params, start.tz);
  const up = (n: string) => first(n)?.value.trim().toUpperCase();
  return {
    uid: first("UID")?.value ?? "", start, durMs,
    rule: rr ? parseRule(rr.value, start.tz) : null,
    exdates: new Set(dates("EXDATE")), rdates: dates("RDATE"), recurrenceId: ridDt ? ridDt.ms : null,
    free: up("TRANSP") === "TRANSPARENT" || up("STATUS") === "CANCELLED",
  };
}

/** Sorts and merges overlapping or touching intervals. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const i of [...list].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Busy intervals (epoch ms, merged) overlapping [from, to), plus how many events the feed held. `tz` places all-day and floating times. */
export function parseBusy(ics: string, from: number, to: number, tz: string): { busy: Interval[]; events: number } {
  const events = parseEvents(ics, tz);
  const overridden = new Map<string, Set<number>>(); // uid -> original starts replaced by an override (even a cancelled one)
  for (const e of events) {
    if (e.recurrenceId === null) continue;
    const set = overridden.get(e.uid) ?? new Set<number>();
    set.add(e.recurrenceId);
    overridden.set(e.uid, set);
  }
  const busy: Interval[] = [];
  const add = (s: number, dur: number) => { if (dur > 0 && s + dur > from && s < to) busy.push({ start: s, end: s + dur }); };
  for (const e of events) {
    if (e.free) continue;
    if (e.recurrenceId !== null || (!e.rule && !e.rdates.length)) { add(e.start.ms, e.durMs); continue; }
    const skip = overridden.get(e.uid);
    const seen = new Set<number>();
    const emit = (s: number) => { if (!e.exdates.has(s) && !skip?.has(s) && !seen.has(s)) { seen.add(s); add(s, e.durMs); } };
    if (e.rule) {
      let n = 0;
      for (const w of walls(e.start, e.rule, to + DAY)) { // +1 day: wall time may lead the instant by up to 14h
        const s = fromWall(w, e.start.tz);
        if (++n > (e.rule.count || Infinity) || s > (e.rule.until ?? Infinity)) break;
        emit(s);
      }
    } else emit(e.start.ms); // RDATE-only event keeps its DTSTART instance
    e.rdates.forEach(emit);
  }
  return { busy: mergeIntervals(busy), events: events.length };
}
