import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBusy, fromWall, toWall, mergeIntervals, isValidTz } from "./ics.ts";

const NY = "America/New_York";
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16) + "Z";
const lines = (...l: string[]) => l.join("\r\n");
const ev = (...l: string[]) => lines("BEGIN:VEVENT", "UID:a@x", ...l, "END:VEVENT");
const cal = (...events: string[]) => lines("BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR");
const FROM = Date.parse("2026-11-01T00:00:00Z");
const TO = Date.parse("2026-12-01T00:00:00Z");
/** ISO start of every busy block (blocks in these tests never touch, so merging never hides one). */
const starts = (ics: string, tz = NY, from = FROM, to = TO) => parseBusy(ics, from, to, tz).busy.map((b) => iso(b.start));
const YEAR: [number, number] = [Date.parse("2026-01-01T00:00:00Z"), Date.parse("2027-01-01T00:00:00Z")];
const A = ["DTSTART:20261102T150000Z", "DTEND:20261102T160000Z"]; // Mon Nov 2, 1h

test("tz helpers: wall <-> instant across DST", () => {
  assert.equal(iso(fromWall(Date.UTC(2026, 6, 1, 9), NY)), "2026-07-01T13:00Z"); // EDT
  assert.equal(iso(fromWall(Date.UTC(2026, 10, 2, 9), NY)), "2026-11-02T14:00Z"); // EST
  assert.equal(toWall(Date.parse("2026-11-02T14:00:00Z"), NY), Date.UTC(2026, 10, 2, 9));
  assert.equal(toWall(Date.parse("2026-11-02T00:00:00Z"), "Asia/Kolkata"), Date.UTC(2026, 10, 2, 5, 30));
  assert.ok(isValidTz("Europe/Paris") && !isValidTz("Mars/Base") && !isValidTz(""));
});

test("UTC and TZID single events", () => {
  assert.deepEqual(starts(cal(ev("DTSTART:20261110T150000Z", "DTEND:20261110T160000Z"))), ["2026-11-10T15:00Z"]);
  const r = parseBusy(cal(ev("DTSTART;TZID=America/Los_Angeles:20261110T090000", "DTEND;TZID=America/Los_Angeles:20261110T093000")), FROM, TO, NY);
  assert.deepEqual([iso(r.busy[0].start), iso(r.busy[0].end)], ["2026-11-10T17:00Z", "2026-11-10T17:30Z"]);
});

test("floating time and unknown TZID use the calendar tz", () => {
  assert.deepEqual(starts(cal(ev("DTSTART:20261110T090000", "DTEND:20261110T100000"))), ["2026-11-10T14:00Z"]);
  assert.deepEqual(starts(cal(ev("DTSTART;TZID=Eastern Standard Time:20261110T090000", "DTEND;TZID=Eastern Standard Time:20261110T100000"))), ["2026-11-10T14:00Z"]);
});

test("DURATION instead of DTEND; zero-length events are not busy", () => {
  const r = parseBusy(cal(ev("DTSTART:20261110T150000Z", "DURATION:PT1H30M")), FROM, TO, NY);
  assert.equal(r.busy[0].end - r.busy[0].start, 90 * 60_000);
  assert.equal(parseBusy(cal(ev("DTSTART:20261110T150000Z")), FROM, TO, NY).busy.length, 0);
});

test("all-day events are busy for the day in the calendar tz; transparent ones are free", () => {
  const r = parseBusy(cal(ev("DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261111")), FROM, TO, NY);
  assert.deepEqual([iso(r.busy[0].start), iso(r.busy[0].end)], ["2026-11-10T05:00Z", "2026-11-11T05:00Z"]);
  assert.equal(parseBusy(cal(ev("DTSTART;VALUE=DATE:20261110", "TRANSP:TRANSPARENT")), FROM, TO, NY).busy.length, 0);
  const noEnd = parseBusy(cal(ev("DTSTART;VALUE=DATE:20261110")), FROM, TO, NY); // no DTEND = one day
  assert.equal(noEnd.busy[0].end - noEnd.busy[0].start, 86_400_000);
});

test("multi-day all-day event", () => {
  const r = parseBusy(cal(ev("DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261113")), FROM, TO, NY);
  assert.equal((r.busy[0].end - r.busy[0].start) / 3_600_000, 72);
});

test("transparent and cancelled events are free", () => {
  assert.equal(starts(cal(ev(...A, "TRANSP:TRANSPARENT"))).length, 0);
  assert.equal(starts(cal(ev(...A, "STATUS:CANCELLED"))).length, 0);
  assert.equal(starts(cal(ev(...A, "TRANSP:OPAQUE", "STATUS:CONFIRMED"))).length, 1);
});

test("line folding and VALARM bodies are handled; only start/end ever leave the parser", () => {
  const ics = cal(lines(
    "BEGIN:VEVENT", "UID:a@x", "SUMMARY:Secret", " meeting title", "DTSTART:20261110T150000Z", "DTEND:20261110T160000Z",
    "BEGIN:VALARM", "TRIGGER:-PT10M", "DTSTART:19990101T000000Z", "END:VALARM", "END:VEVENT",
  ));
  const r = parseBusy(ics, FROM, TO, NY);
  assert.equal(r.events, 1);
  assert.deepEqual(Object.keys(r.busy[0]), ["start", "end"]);
  assert.deepEqual(r.busy.map((b) => iso(b.start)), ["2026-11-10T15:00Z"]);
});

test("malformed events are skipped, not fatal", () => {
  assert.equal(parseBusy(cal(ev("DTSTART:garbage"), ev("SUMMARY:no start")), FROM, TO, NY).busy.length, 0);
  assert.equal(parseBusy("", FROM, TO, NY).busy.length, 0);
});

test("events outside the window are excluded; ones straddling its edge are kept", () => {
  assert.equal(starts(cal(ev("DTSTART:20261001T150000Z", "DTEND:20261001T160000Z"))).length, 0);
  assert.equal(starts(cal(ev("DTSTART:20261201T150000Z", "DTEND:20261201T160000Z"))).length, 0);
  assert.equal(starts(cal(ev("DTSTART:20261031T230000Z", "DTEND:20261101T010000Z"))).length, 1);
});

test("overlapping and touching intervals merge", () => {
  assert.deepEqual(mergeIntervals([{ start: 5, end: 8 }, { start: 1, end: 3 }, { start: 3, end: 4 }, { start: 7, end: 10 }]),
    [{ start: 1, end: 4 }, { start: 5, end: 10 }]);
});

test("DAILY with COUNT and INTERVAL", () => {
  const e = (rule: string) => cal(ev(...A, `RRULE:${rule}`));
  assert.deepEqual(starts(e("FREQ=DAILY;COUNT=3")), ["2026-11-02T15:00Z", "2026-11-03T15:00Z", "2026-11-04T15:00Z"]);
  assert.deepEqual(starts(e("FREQ=DAILY;INTERVAL=3;COUNT=3")), ["2026-11-02T15:00Z", "2026-11-05T15:00Z", "2026-11-08T15:00Z"]);
});

test("DAILY with BYDAY (weekdays only)", () => {
  const ics = cal(ev("DTSTART:20261106T150000Z", "DTEND:20261106T160000Z", "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=3"));
  assert.deepEqual(starts(ics), ["2026-11-06T15:00Z", "2026-11-09T15:00Z", "2026-11-10T15:00Z"]); // Fri, then Mon, Tue
});

test("COUNT counts instances before the window opens", () => {
  const ics = cal(ev(...A, "RRULE:FREQ=DAILY;COUNT=5"));
  assert.deepEqual(starts(ics, NY, Date.parse("2026-11-05T00:00:00Z")), ["2026-11-05T15:00Z", "2026-11-06T15:00Z"]);
});

test("WEEKLY keeps local time across the DST change (TZID)", () => {
  const ics = cal(ev(`DTSTART;TZID=${NY}:20261026T090000`, `DTEND;TZID=${NY}:20261026T093000`, "RRULE:FREQ=WEEKLY;COUNT=3"));
  // Oct 26 is EDT (13:00Z); Nov 2 and Nov 9 are after the Nov 1 fall-back (14:00Z).
  assert.deepEqual(starts(ics, NY, Date.parse("2026-10-01T00:00:00Z")), ["2026-10-26T13:00Z", "2026-11-02T14:00Z", "2026-11-09T14:00Z"]);
});

test("WEEKLY BYDAY and INTERVAL", () => {
  const mwf = cal(ev(...A, "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=5"));
  assert.deepEqual(starts(mwf), ["2026-11-02T15:00Z", "2026-11-04T15:00Z", "2026-11-06T15:00Z", "2026-11-09T15:00Z", "2026-11-11T15:00Z"]);
  const biweekly = cal(ev(...A, "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=4"));
  assert.deepEqual(starts(biweekly), ["2026-11-02T15:00Z", "2026-11-05T15:00Z", "2026-11-16T15:00Z", "2026-11-19T15:00Z"]);
});

test("WEEKLY without BYDAY repeats on DTSTART's weekday; WKST moves the week boundary", () => {
  const plain = cal(ev("DTSTART:20261104T150000Z", "DTEND:20261104T160000Z", "RRULE:FREQ=WEEKLY;COUNT=2"));
  assert.deepEqual(starts(plain), ["2026-11-04T15:00Z", "2026-11-11T15:00Z"]);
  // Sun Nov 8 + Mon Nov 9, biweekly. WKST=MO: Sun ends the Nov 2-8 week, so the next one is Nov 16-22 (Mon 16, Sun 22).
  const sun = ["DTSTART:20261108T150000Z", "DTEND:20261108T160000Z"];
  assert.deepEqual(starts(cal(ev(...sun, "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;WKST=MO;COUNT=3"))),
    ["2026-11-08T15:00Z", "2026-11-16T15:00Z", "2026-11-22T15:00Z"]);
  assert.deepEqual(starts(cal(ev(...sun, "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;WKST=SU;COUNT=3"))),
    ["2026-11-08T15:00Z", "2026-11-09T15:00Z", "2026-11-22T15:00Z"]);
});

test("MONTHLY: default day, BYMONTHDAY (incl. negative), ordinal BYDAY, INTERVAL", () => {
  const m = (rule: string, d = "20260115") => cal(ev(`DTSTART:${d}T150000Z`, `DTEND:${d}T160000Z`, `RRULE:${rule}`));
  assert.deepEqual(starts(m("FREQ=MONTHLY;COUNT=3"), NY, ...YEAR), ["2026-01-15T15:00Z", "2026-02-15T15:00Z", "2026-03-15T15:00Z"]);
  assert.deepEqual(starts(m("FREQ=MONTHLY;BYMONTHDAY=1,-1;COUNT=4", "20260101"), NY, ...YEAR),
    ["2026-01-01T15:00Z", "2026-01-31T15:00Z", "2026-02-01T15:00Z", "2026-02-28T15:00Z"]);
  assert.deepEqual(starts(m("FREQ=MONTHLY;BYDAY=2TU;COUNT=3", "20260113"), NY, ...YEAR), ["2026-01-13T15:00Z", "2026-02-10T15:00Z", "2026-03-10T15:00Z"]);
  assert.deepEqual(starts(m("FREQ=MONTHLY;BYDAY=-1FR;COUNT=3", "20260130"), NY, ...YEAR), ["2026-01-30T15:00Z", "2026-02-27T15:00Z", "2026-03-27T15:00Z"]);
  assert.deepEqual(starts(m("FREQ=MONTHLY;INTERVAL=5;COUNT=3"), NY, ...YEAR), ["2026-01-15T15:00Z", "2026-06-15T15:00Z", "2026-11-15T15:00Z"]);
});

test("MONTHLY on the 31st skips months without one", () => {
  const ics = cal(ev("DTSTART:20260131T150000Z", "DTEND:20260131T160000Z", "RRULE:FREQ=MONTHLY;COUNT=4"));
  assert.deepEqual(starts(ics, NY, ...YEAR), ["2026-01-31T15:00Z", "2026-03-31T15:00Z", "2026-05-31T15:00Z", "2026-07-31T15:00Z"]);
});

test("YEARLY: anniversary, BYMONTH, and Feb 29 only in leap years", () => {
  const w: [number, number] = [YEAR[0], Date.parse("2033-01-01T00:00:00Z")];
  const y = (rule: string, d: string) => cal(ev(`DTSTART:${d}T150000Z`, `DTEND:${d}T160000Z`, `RRULE:${rule}`));
  assert.deepEqual(starts(y("FREQ=YEARLY;COUNT=2", "20260310"), NY, ...w), ["2026-03-10T15:00Z", "2027-03-10T15:00Z"]);
  assert.deepEqual(starts(y("FREQ=YEARLY;BYMONTH=3,9;COUNT=3", "20260310"), NY, ...w), ["2026-03-10T15:00Z", "2026-09-10T15:00Z", "2027-03-10T15:00Z"]);
  assert.deepEqual(starts(y("FREQ=YEARLY;COUNT=3", "20240229"), NY, ...w), ["2028-02-29T15:00Z", "2032-02-29T15:00Z"]);
});

test("UNTIL as UTC time (inclusive) and as a date (whole day)", () => {
  const e = (until: string) => cal(ev(...A, `RRULE:FREQ=DAILY;UNTIL=${until}`));
  assert.equal(starts(e("20261104T150000Z")).length, 3);
  assert.equal(starts(e("20261104T145959Z")).length, 2);
  assert.equal(starts(e("20261104")).length, 3);
});

test("EXDATE (UTC, TZID, multi-value, repeated lines) removes only those instances", () => {
  const ics = cal(ev(`DTSTART;TZID=${NY}:20261102T090000`, `DTEND;TZID=${NY}:20261102T100000`, "RRULE:FREQ=DAILY;COUNT=5",
    `EXDATE;TZID=${NY}:20261103T090000,20261104T090000`, "EXDATE:20261105T140000Z"));
  assert.deepEqual(starts(ics), ["2026-11-02T14:00Z", "2026-11-06T14:00Z"]);
});

test("RDATE adds instances; an RDATE-only event keeps DTSTART", () => {
  assert.deepEqual(starts(cal(ev(...A, "RRULE:FREQ=WEEKLY;COUNT=1", "RDATE:20261105T150000Z"))), ["2026-11-02T15:00Z", "2026-11-05T15:00Z"]);
  assert.deepEqual(starts(cal(ev(...A, "RDATE:20261110T150000Z"))), ["2026-11-02T15:00Z", "2026-11-10T15:00Z"]);
});

const override = (...l: string[]) => lines("BEGIN:VEVENT", "UID:a@x", ...l, "END:VEVENT");

test("RECURRENCE-ID override moves one instance", () => {
  const master = ev(...A, "RRULE:FREQ=DAILY;COUNT=3");
  const moved = override("RECURRENCE-ID:20261103T150000Z", "DTSTART:20261103T200000Z", "DTEND:20261103T210000Z");
  assert.deepEqual(starts(cal(master, moved)), ["2026-11-02T15:00Z", "2026-11-03T20:00Z", "2026-11-04T15:00Z"]);
});

test("a cancelled or transparent override frees that instance", () => {
  const master = ev(...A, "RRULE:FREQ=DAILY;COUNT=3");
  const o = (x: string) => override("RECURRENCE-ID:20261103T150000Z", "DTSTART:20261103T150000Z", "DTEND:20261103T160000Z", x);
  assert.deepEqual(starts(cal(master, o("STATUS:CANCELLED"))), ["2026-11-02T15:00Z", "2026-11-04T15:00Z"]);
  assert.deepEqual(starts(cal(master, o("TRANSP:TRANSPARENT"))), ["2026-11-02T15:00Z", "2026-11-04T15:00Z"]);
});

test("an override only affects its own UID", () => {
  const master = ev(...A, "RRULE:FREQ=DAILY;COUNT=2");
  const other = lines("BEGIN:VEVENT", "UID:other@x", "RECURRENCE-ID:20261103T150000Z", "DTSTART:20261103T150000Z", "STATUS:CANCELLED", "END:VEVENT");
  assert.equal(starts(cal(master, other)).length, 2);
});

test("a TZID override matches a TZID recurrence", () => {
  const master = ev(`DTSTART;TZID=${NY}:20261102T090000`, `DTEND;TZID=${NY}:20261102T100000`, "RRULE:FREQ=DAILY;COUNT=2");
  const o = override(`RECURRENCE-ID;TZID=${NY}:20261103T090000`, `DTSTART;TZID=${NY}:20261103T110000`, `DTEND;TZID=${NY}:20261103T120000`);
  assert.deepEqual(starts(cal(master, o)), ["2026-11-02T14:00Z", "2026-11-03T16:00Z"]);
});

test("a cancelled or transparent master frees every instance", () => {
  assert.equal(starts(cal(ev(...A, "RRULE:FREQ=DAILY;COUNT=3", "STATUS:CANCELLED"))).length, 0);
  assert.equal(starts(cal(ev(...A, "RRULE:FREQ=DAILY;COUNT=3", "TRANSP:TRANSPARENT"))).length, 0);
});

test("recurring all-day events expand in the calendar tz", () => {
  const r = parseBusy(cal(ev("DTSTART;VALUE=DATE:20261102", "DTEND;VALUE=DATE:20261103", "RRULE:FREQ=WEEKLY;COUNT=2")), FROM, TO, NY).busy;
  assert.deepEqual([iso(r[0].start), iso(r[1].start)], ["2026-11-02T05:00Z", "2026-11-09T05:00Z"]);
});

test("an open-ended rule from years ago is expanded only inside the window, quickly", () => {
  const ics = cal(ev("DTSTART:20150105T150000Z", "DTEND:20150105T160000Z", "RRULE:FREQ=DAILY"));
  const t = Date.now();
  assert.equal(parseBusy(ics, FROM, Date.parse("2026-11-04T00:00:00Z"), NY).busy.length, 3);
  assert.ok(Date.now() - t < 1000);
});

test("a multi-day instance that began before the window still counts", () => {
  const ics = cal(ev("DTSTART:20261030T120000Z", "DTEND:20261102T120000Z", "RRULE:FREQ=MONTHLY;COUNT=2"));
  assert.deepEqual(starts(ics), ["2026-10-30T12:00Z", "2026-11-30T12:00Z"]);
});

test("unsupported FREQ falls back to the first instance only", () => {
  assert.deepEqual(starts(cal(ev(...A, "RRULE:FREQ=HOURLY;COUNT=5"))), ["2026-11-02T15:00Z"]);
});
