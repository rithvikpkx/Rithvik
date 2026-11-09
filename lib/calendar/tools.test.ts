import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { calendarTools, runCalendarTool, calendarContext } from "./tools.ts";

const NOW = Date.parse("2026-12-07T18:00:00Z"); // Mon 10:00 PST; a week no other test file uses
const ICS = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:1", "SUMMARY:SECRET", "DTSTART:20261208T200000Z", "DTEND:20261208T210000Z", "END:VEVENT", "END:VCALENDAR"].join("\r\n");

beforeEach(() => {
  process.env.CALENDAR_ICS_URL = "https://calendar.example/private/TOKEN.ics";
  globalThis.fetch = (async () => new Response(ICS)) as typeof fetch;
});

test("schemas: two function tools with the documented names and required fields", () => {
  assert.deepEqual(calendarTools.map((t) => t.function.name), ["check_availability", "suggest_times"]);
  assert.deepEqual(calendarTools[0].function.parameters.required, ["startISO"]);
  for (const t of calendarTools) assert.equal(t.type, "function");
});

test("check_availability: summary rows for each outcome", async () => {
  const run = (startISO: string, extra = {}) => runCalendarTool("check_availability", { startISO, ...extra }, NOW);
  const free = await run("2026-12-08T10:00:00-08:00", { visitorTz: "America/New_York" });
  assert.equal(free.summary, "Free · Tue Dec 8, 10:00 AM PT (1:00 PM ET)");
  assert.equal(free.result.free, true);
  assert.equal((await run("2026-12-08T12:00:00-08:00")).summary, "Busy · Tue Dec 8, 12:00 PM PT");
  assert.equal((await run("2026-12-08T07:00:00-08:00")).summary, "Outside hours · Tue Dec 8, 7:00 AM PT");
  assert.equal((await run("2026-12-01T10:00:00-08:00")).summary, "In the past · Tue Dec 1, 10:00 AM PT");
  assert.match((await run("2027-02-02T10:00:00-08:00")).summary, /^Too far ahead/);
});

test("check_availability: arguments may arrive as a JSON string", async () => {
  const r = await runCalendarTool("check_availability", JSON.stringify({ startISO: "2026-12-08T10:00:00-08:00" }), NOW);
  assert.equal(r.result.free, true);
});

test("suggest_times: compact slots and a summary line", async () => {
  const r = await runCalendarTool("suggest_times", { count: 2, visitorTz: "Europe/London" }, NOW);
  const slots = r.result.slots as { startISO: string; localStart: string; visitorStart: string }[];
  assert.equal(slots.length, 2);
  assert.match(r.summary, /^2 free · Mon Dec 7, 10:00 AM PT · Tue Dec 8, 10:00 AM PT$/);
  assert.deepEqual(Object.keys(slots[0]).sort(), ["localStart", "startISO", "visitorStart"]);
  assert.doesNotMatch(JSON.stringify(r), /SECRET/);
});

test("errors come back as data, never thrown", async () => {
  const bad = await runCalendarTool("check_availability", { startISO: "next tuesday" }, NOW);
  assert.match(String(bad.result.error), /ISO 8601/);
  assert.equal(bad.summary, "Calendar: invalid request");
  assert.equal((await runCalendarTool("check_availability", "not json", NOW)).summary, "Calendar: invalid request");
  assert.equal((await runCalendarTool("nope", {}, NOW)).summary, "Unknown calendar tool");
  globalThis.fetch = (async () => new Response("x", { status: 500 })) as typeof fetch;
  const origErr = console.error;
  console.error = () => {};
  try {
    const down = await runCalendarTool("suggest_times", { days: 20 }, NOW + 14 * 86_400_000);
    assert.deepEqual(down, { result: { error: "calendar_unavailable" }, summary: "Calendar unavailable" });
  } finally { console.error = origErr; }
});

test("calendarContext: now in his zone, 14 dated weekdays, the hours rule", () => {
  const c = calendarContext("America/Los_Angeles", NOW);
  assert.match(c, /Current time: Mon Dec 7, 10:00 AM PT \(America\/Los_Angeles, ISO 2026-12-07T18:00:00.000Z\)/);
  assert.match(c, /Mon Dec 7 \(today\); Tue Dec 8; Wed Dec 9;/);
  assert.match(c, /Sun Dec 20\./);
  assert.match(c, /10:00 AM-5:00 PM/);
  // Late evening UTC is still "today" in PT, and the next-day boundary follows his zone.
  assert.match(calendarContext("America/Los_Angeles", Date.parse("2026-12-08T07:30:00Z")), /Mon Dec 7 \(today\)/);
});
