// Smoke test against the real calendar feed. Prints aggregate counts only: never titles, places, people or the URL.
// Usage: node --env-file=.env.local scripts/calendar-check.mjs   (CALENDAR_TZ overrides his timezone; default: the content fixture's)
import { parseBusy } from "../lib/calendar/ics.ts";
import { fetchBusyUncached } from "../lib/calendar/availability.ts";
import { freeSlots, formatAt } from "../lib/calendar/slots.ts";
import { fixture } from "../lib/content/fixture.ts";

const DAY = 86_400_000;
const tz = process.env.CALENDAR_TZ || fixture.now.tz;
const now = Date.now();
const from = Math.floor(now / DAY) * DAY - DAY;
const to = from + 23 * DAY;

try {
  const busy = await fetchBusyUncached(process.env.CALENDAR_ICS_URL, from, to, tz);
  // Second pass over the raw feed only for the event count; fetchBusyUncached already proved the feed downloads and parses.
  const res = await fetch(process.env.CALENDAR_ICS_URL.trim().replace(/^webcal:/i, "https:"));
  const events = parseBusy(await res.text(), from, to, tz).events;
  const week = busy.filter((b) => b.end > now && b.start < now + 7 * DAY);
  const slots = freeSlots(busy, { from: now, now, days: 7, durMin: 30, count: 3, tz });
  console.log(`timezone: ${tz}`);
  console.log(`events parsed: ${events}`);
  console.log(`busy blocks in window (-1d..+22d): ${busy.length}`);
  console.log(`busy blocks in next 7 days: ${week.length}`);
  console.log(`first free 30-min slots (${slots.length}):`);
  for (const s of slots) console.log(`  ${formatAt(s, tz)}`);
} catch (err) {
  console.error(`calendar check failed: ${err instanceof Error ? err.name + ": " + err.message : "unknown"}`);
  process.exit(1);
}
