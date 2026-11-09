/** Availability rules over a list of busy intervals. Pure (time is passed in), so it is tested without a feed. */

import { fromWall, toWall, type Interval } from "./ics.ts";

export const OPEN_MIN = 10 * 60; // weekdays 10:00-17:00 in his timezone
export const CLOSE_MIN = 17 * 60;
export const SLOT_MIN = 30;
export const BUFFER_MS = 15 * 60_000; // breathing room around every busy event
export const MAX_DAYS = 21;
const DAY = 86_400_000;

export type Reason = "busy" | "outside_hours" | "past" | "too_far";

/** Why `[startMs, startMs + durMin)` cannot be booked at `now`, or null when it is free. */
export function blockedReason(busy: Interval[], startMs: number, durMin: number, now: number, tz: string): Reason | null {
  if (startMs < now) return "past";
  if (startMs > now + MAX_DAYS * DAY) return "too_far";
  const wall = new Date(toWall(startMs, tz));
  const min = wall.getUTCHours() * 60 + wall.getUTCMinutes();
  const dow = wall.getUTCDay();
  if (dow === 0 || dow === 6 || min < OPEN_MIN || min + durMin > CLOSE_MIN) return "outside_hours";
  const end = startMs + durMin * 60_000;
  return busy.some((b) => b.start - BUFFER_MS < end && b.end + BUFFER_MS > startMs) ? "busy" : null;
}

/** Up to `count` free slot starts (epoch ms), earliest first, spread across days: one per day, then a second pass, and so on. */
export function freeSlots(busy: Interval[], o: { from: number; now: number; days: number; durMin: number; count: number; tz: string }): number[] {
  const begin = Math.max(o.from, o.now);
  const first = new Date(toWall(begin, o.tz));
  const day0 = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
  const perDay: number[][] = [];
  for (let i = 0; i < o.days; i++) {
    const day = day0 + i * DAY; // wall-ms of the date; stepping 24h in wall time never skips a date
    const slots: number[] = [];
    for (let m = OPEN_MIN; m + o.durMin <= CLOSE_MIN; m += SLOT_MIN) {
      const ms = fromWall(day + m * 60_000, o.tz);
      if (ms >= begin && blockedReason(busy, ms, o.durMin, o.now, o.tz) === null) slots.push(ms);
    }
    if (slots.length) perDay.push(slots);
  }
  const picked: number[] = [];
  for (let round = 0; picked.length < o.count && perDay.some((d) => d[round] !== undefined); round++) {
    for (const d of perDay) if (picked.length < o.count && d[round] !== undefined) picked.push(d[round]);
  }
  return picked.sort((a, b) => a - b);
}

/** "Tue Nov 10, 10:00 AM PT" (date omitted when `date` is false). Generic tz names (PT, ET) where Intl has them. */
export function formatAt(ms: number, tz: string, date = true): string {
  const parts = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).formatToParts(ms);
  const get = (ps: Intl.DateTimeFormatPart[], t: string) => ps.find((p) => p.type === t)?.value ?? "";
  const d = parts({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "shortGeneric" });
  let zone = get(d, "timeZoneName");
  if (/\s/.test(zone) || zone.length > 5) zone = get(parts({ timeZoneName: "short" }), "timeZoneName"); // "Germany Time" -> "GMT+1"
  if (tz === "UTC") zone = "UTC";
  const time = `${get(d, "hour")}:${get(d, "minute")} ${get(d, "dayPeriod")}`;
  return `${get(d, "weekday")}${date ? ` ${get(d, "month")} ${get(d, "day")},` : ""} ${time} ${zone}`;
}
