import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkAvailability, suggestTimes, parseInstant, CalendarInputError, CalendarUnavailableError } from "./availability.ts";

const NOW = Date.parse("2026-11-09T18:00:00Z"); // Mon 10:00 PST (the tz fallback; content is unreachable under node:test)
const URL_SECRET = "https://calendar.example/private/SECRET-TOKEN/basic.ics";

/** Feed with one event Tue 12:00-13:00 PST, `shift` weeks after Nov 10 2026, titled so a leak would be visible. */
const feed = (shift: number) => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 10 + shift * 7, h)).toISOString().replace(/[-:]|\.\d+/g, "");
  return [
    "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:1", "SUMMARY:TOP-SECRET-TITLE", "LOCATION:SECRET-PLACE", "ATTENDEE:mailto:secret@x.com",
    `DTSTART:${at(20)}`, `DTEND:${at(21)}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
};

let calls = 0;
/** Replaces fetch with a canned response and counts calls. */
function stub(body: string | (() => Response)) {
  calls = 0;
  globalThis.fetch = (async () => { calls++; return typeof body === "string" ? new Response(body) : body(); }) as typeof fetch;
}
// A distinct week per test: `now` moves with it so the module-level memo (keyed by UTC day) never carries over.
let day = 0;
beforeEach(() => { day++; process.env.CALENDAR_ICS_URL = URL_SECRET; stub(feed(day)); });

/** `now` shifted by whole weeks so the memo key (UTC day) differs per test while weekday alignment stays the same. */
const now = () => NOW + day * 7 * 86_400_000;
const week = () => day * 7 * 86_400_000;
const iso = (s: string) => new Date(Date.parse(s) + week()).toISOString();

test("parseInstant: offsets, Z, offset-less wall time in the given zone, rejects junk and impossible dates", () => {
  assert.equal(parseInstant("2026-11-10T09:00:00-08:00", "UTC"), Date.parse("2026-11-10T17:00:00Z"));
  assert.equal(parseInstant("2026-11-10T09:00-0800", "UTC"), Date.parse("2026-11-10T17:00:00Z"));
  assert.equal(parseInstant("2026-11-10T17:00:00z", "UTC"), Date.parse("2026-11-10T17:00:00Z"));
  assert.equal(parseInstant("2026-11-10T09:00:00", "America/New_York"), Date.parse("2026-11-10T14:00:00Z"));
  for (const bad of ["tomorrow", "2026-11-10", "2026-02-30T10:00:00Z", "2026-13-01T10:00:00Z", "2026-11-10T25:00:00Z", 5, null, ""]) {
    assert.throws(() => parseInstant(bad, "UTC"), CalendarInputError, String(bad));
  }
});

test("checkAvailability: free, busy (with buffer), outside_hours, past, too_far", async () => {
  const c = (s: string, dur = 30, vz?: string) => checkAvailability(iso(s), dur, vz, now());
  assert.deepEqual(await c("2026-11-10T19:00:00Z"), { free: true, localStart: `Tue ${fmtDate(iso("2026-11-10T19:00:00Z"))}, 11:00 AM PT` });
  assert.equal((await c("2026-11-10T20:00:00Z")).reason, "busy");
  assert.equal((await c("2026-11-10T19:30:00Z")).reason, "busy"); // ends where the event starts
  assert.equal((await c("2026-11-10T21:15:00Z")).free, true); // clears the 15-min buffer
  assert.equal((await c("2026-11-10T14:00:00Z")).reason, "outside_hours"); // 6:00 PST
  assert.equal((await c("2026-11-08T18:00:00Z")).reason, "past");
  assert.equal((await checkAvailability(new Date(now() + 25 * 86_400_000).toISOString(), 30, undefined, now())).reason, "too_far");
});

/** "Nov 10"-style date of an ISO instant in PT, to keep expectations independent of the week shift. */
function fmtDate(isoStr: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(Date.parse(isoStr));
}

test("checkAvailability: visitor zone is echoed, and offset-less input is read in it", async () => {
  const r = await checkAvailability(iso("2026-11-10T19:00:00Z").slice(0, 16) /* UTC wall */, 30, "UTC", now());
  assert.equal(r.free, true);
  assert.match(r.visitorStart!, /7:00 PM UTC$/);
  assert.match(r.localStart, /11:00 AM PT$/);
});

test("only free/busy and formatted times leave the module", async () => {
  const r = await checkAvailability(iso("2026-11-10T20:00:00Z"), 30, "America/New_York", now());
  const s = JSON.stringify([r, await suggestTimes({ visitorTz: "America/New_York" }, now())]);
  assert.doesNotMatch(s, /SECRET|secret/);
  assert.deepEqual(Object.keys(r).sort(), ["free", "localStart", "reason", "visitorStart"]);
});

test("past/outside_hours/too_far answers do not need the feed", async () => {
  stub(() => { throw new Error("feed down"); });
  assert.equal((await checkAvailability(iso("2026-11-08T18:00:00Z"), 30, undefined, now())).reason, "past");
  assert.equal(calls, 0);
});

test("feed is fetched once across bursts", async () => {
  await checkAvailability(iso("2026-11-10T19:00:00Z"), 30, undefined, now());
  await checkAvailability(iso("2026-11-11T19:00:00Z"), 30, undefined, now());
  await suggestTimes({}, now());
  assert.equal(calls, 1);
});

test("suggestTimes: spread over days, never overlapping the busy block, includes visitor time", async () => {
  const s = await suggestTimes({ days: 5, count: 5, durationMin: 60, visitorTz: "Europe/London" }, now());
  assert.equal(s.length, 5);
  assert.ok(s.every((x) => x.visitorStart && /^\d{4}-\d{2}-\d{2}T/.test(x.startISO)));
  assert.equal(new Set(s.map((x) => x.localStart.slice(0, 10))).size, 5); // one per day
  const busyStart = Date.parse("2026-11-10T20:00:00Z") + week();
  assert.ok(s.every((x) => { const t = Date.parse(x.startISO); return t + 3_600_000 + 900_000 <= busyStart || t >= busyStart + 3_600_000 + 900_000; }));
});

test("input validation", async () => {
  await assert.rejects(checkAvailability("nope", 30), CalendarInputError);
  await assert.rejects(checkAvailability(iso("2026-11-10T19:00:00Z"), 10), CalendarInputError);
  await assert.rejects(checkAvailability(iso("2026-11-10T19:00:00Z"), 121), CalendarInputError);
  await assert.rejects(checkAvailability(iso("2026-11-10T19:00:00Z"), 30.5), CalendarInputError);
  await assert.rejects(checkAvailability(iso("2026-11-10T19:00:00Z"), 30, "Mars/Base"), CalendarInputError);
  await assert.rejects(suggestTimes({ days: 22 }), CalendarInputError);
  await assert.rejects(suggestTimes({ count: 0 }), CalendarInputError);
  await assert.rejects(suggestTimes({ fromISO: "soon" }), CalendarInputError);
  await assert.rejects(suggestTimes({ visitorTz: "x" }), CalendarInputError);
});

test("feed failures surface as a generic error that never contains the URL", async () => {
  const errors: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { errors.push(a); };
  try {
    for (const make of [
      () => { throw new Error(`boom ${URL_SECRET}`); },
      () => new Response("x", { status: 500 }),
      () => new Response("x", { headers: { "content-length": String(6 * 1024 * 1024) } }),
      () => new Response("x".repeat(5 * 1024 * 1024 + 1)), // no content-length: the streaming cap must catch it
    ]) {
      day++;
      stub(make);
      await assert.rejects(suggestTimes({}, now()), (e: Error) => e instanceof CalendarUnavailableError && !e.message.includes("SECRET"));
    }
    delete process.env.CALENDAR_ICS_URL;
    day++;
    await assert.rejects(suggestTimes({}, now()), CalendarUnavailableError);
    process.env.CALENDAR_ICS_URL = "http://insecure.example/x.ics";
    day++;
    await assert.rejects(suggestTimes({}, now()), CalendarUnavailableError);
  } finally { console.error = orig; }
  assert.doesNotMatch(JSON.stringify(errors), /SECRET/);
});
