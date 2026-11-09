import { test } from "node:test";
import assert from "node:assert/strict";
import { blockedReason, freeSlots, formatAt } from "./slots.ts";

const PT = "America/Los_Angeles";
const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-11-09T16:00:00Z"); // Mon 8:00 PST
const none: { start: number; end: number }[] = [];
const block = (s: string, e: string) => ({ start: at(s), end: at(e) });
// Tue Nov 10, 12:00-13:00 PST
const noon = [block("2026-11-10T20:00:00Z", "2026-11-10T21:00:00Z")];

test("window: weekdays 10:00-17:00 in his tz, whole slot must fit", () => {
  const r = (iso: string, dur = 30) => blockedReason(none, at(iso), dur, NOW, PT);
  assert.equal(r("2026-11-10T18:00:00Z"), null); // Tue 10:00 PST
  assert.equal(r("2026-11-10T17:30:00Z"), "outside_hours"); // 9:30
  assert.equal(r("2026-11-11T02:00:00Z"), "outside_hours"); // 18:00
});

test("window edges", () => {
  const r = (iso: string, dur: number) => blockedReason(none, at(iso), dur, NOW, PT);
  assert.equal(r("2026-11-11T00:00:00Z", 60), null); // Tue 16:00 + 60 = 17:00 exactly
  assert.equal(r("2026-11-11T00:30:00Z", 60), "outside_hours"); // 16:30 + 60 = 17:30
  assert.equal(r("2026-11-11T00:30:00Z", 30), null); // last half hour
  assert.equal(r("2026-11-14T18:00:00Z", 30), "outside_hours"); // Saturday
  assert.equal(r("2026-11-15T18:00:00Z", 30), "outside_hours"); // Sunday
});

test("window follows his tz, not UTC (a Monday-morning UTC instant that is Sunday night for him)", () => {
  assert.equal(blockedReason(none, at("2026-11-16T05:00:00Z"), 30, NOW, PT), "outside_hours"); // Sun 21:00 PST
  assert.equal(blockedReason(none, at("2026-11-16T18:00:00Z"), 30, NOW, PT), null); // Mon 10:00 PST
  assert.equal(blockedReason(none, at("2026-11-16T18:00:00Z"), 30, NOW, "Asia/Tokyo"), "outside_hours"); // Tue 03:00 JST
});

test("DST: 10:00 local is a valid start on both sides of the change", () => {
  const now = at("2026-03-01T00:00:00Z");
  assert.equal(blockedReason(none, at("2026-03-06T18:00:00Z"), 30, now, PT), null); // Fri 10:00 PST
  assert.equal(blockedReason(none, at("2026-03-09T17:00:00Z"), 30, now, PT), null); // Mon 10:00 PDT
  assert.equal(blockedReason(none, at("2026-03-09T18:00:00Z"), 30, now, PT), null); // 11:00 PDT
  assert.equal(blockedReason(none, at("2026-03-09T16:00:00Z"), 30, now, PT), "outside_hours"); // 9:00 PDT
});

test("past and too_far outrank everything else", () => {
  assert.equal(blockedReason(none, NOW - 1, 30, NOW, PT), "past");
  assert.equal(blockedReason(none, at("2026-11-10T04:00:00Z"), 30, NOW, PT), "outside_hours");
  assert.equal(blockedReason(none, NOW + 22 * 86_400_000, 30, NOW, PT), "too_far");
  assert.equal(blockedReason(none, NOW + 21 * 86_400_000, 30, NOW, PT), "outside_hours"); // exactly 21d is allowed through (and is out of hours at 8:00)
});

test("busy: overlap and 15-minute buffer on both sides", () => {
  const r = (iso: string, dur = 30) => blockedReason(noon, at(iso), dur, NOW, PT);
  assert.equal(r("2026-11-10T20:00:00Z"), "busy"); // 12:00 itself
  assert.equal(r("2026-11-10T19:00:00Z"), null); // 11:00-11:30, ends 30 min before
  assert.equal(r("2026-11-10T19:30:00Z"), "busy"); // 11:30-12:00 touches
  assert.equal(r("2026-11-10T19:15:00Z"), null); // 11:15-11:45 ends exactly at the 15 min buffer
  assert.equal(r("2026-11-10T19:16:00Z"), "busy"); // one minute into the buffer
  assert.equal(r("2026-11-10T21:00:00Z"), "busy"); // 13:00 touches the end
  assert.equal(r("2026-11-10T21:15:00Z"), null); // 13:15 clears the buffer
  assert.equal(r("2026-11-10T19:00:00Z", 60), "busy"); // 11:00-12:00 hits
});

test("a long event fully containing the slot blocks it", () => {
  assert.equal(blockedReason([block("2026-11-10T17:00:00Z", "2026-11-11T01:00:00Z")], at("2026-11-10T20:00:00Z"), 30, NOW, PT), "busy");
});

test("freeSlots: earliest first, 30-min grid, spread across days", () => {
  const s = freeSlots(none, { from: NOW, now: NOW, days: 7, durMin: 30, count: 3, tz: PT });
  // Mon 10:00 PST, Tue 10:00 PST, Wed 10:00 PST
  assert.deepEqual(s.map((x) => new Date(x).toISOString()), ["2026-11-09T18:00:00.000Z", "2026-11-10T18:00:00.000Z", "2026-11-11T18:00:00.000Z"]);
});

test("freeSlots: skips busy time, weekends, and times before `from`", () => {
  const monAll = [block("2026-11-09T18:00:00Z", "2026-11-10T01:00:00Z")]; // Mon 10:00-17:00 PST
  const s = freeSlots(monAll, { from: NOW, now: NOW, days: 7, durMin: 30, count: 10, tz: PT });
  assert.ok(s.every((x) => x >= at("2026-11-10T00:00:00Z")));
  assert.equal(s.length, 10);
  const fri = freeSlots(none, { from: at("2026-11-13T23:00:00Z"), now: NOW, days: 5, durMin: 30, count: 2, tz: PT }); // Fri 15:00 PST onward
  assert.deepEqual(fri.map((x) => new Date(x).toISOString()), ["2026-11-13T23:00:00.000Z", "2026-11-16T18:00:00.000Z"]); // then Monday, never the weekend
});

test("freeSlots: a second pass fills in when there are fewer days than count", () => {
  const s = freeSlots(none, { from: NOW, now: NOW, days: 1, durMin: 30, count: 3, tz: PT });
  assert.deepEqual(s.map((x) => formatAt(x, PT, false)), ["Mon 10:00 AM PT", "Mon 10:30 AM PT", "Mon 11:00 AM PT"]);
});

test("freeSlots: duration shrinks the last start of the day; busy days contribute nothing", () => {
  const tue = [block("2026-11-10T17:00:00Z", "2026-11-11T02:00:00Z")]; // all of Tue
  const s = freeSlots(tue, { from: NOW, now: NOW, days: 3, durMin: 120, count: 100, tz: PT });
  assert.ok(s.every((x) => formatAt(x, PT).startsWith("Mon") || formatAt(x, PT).startsWith("Wed")));
  assert.equal(formatAt(s[s.length - 1], PT, false), "Wed 3:00 PM PT"); // 15:00 + 120 = 17:00
});

test("freeSlots honours the 21-day horizon and empty results", () => {
  assert.deepEqual(freeSlots(none, { from: NOW + 40 * 86_400_000, now: NOW, days: 7, durMin: 30, count: 3, tz: PT }), []);
});

test("formatAt: generic tz names, date optional", () => {
  assert.equal(formatAt(at("2026-11-10T18:00:00Z"), PT), "Tue Nov 10, 10:00 AM PT");
  assert.equal(formatAt(at("2026-11-10T18:00:00Z"), "America/New_York", false), "Tue 1:00 PM ET");
  assert.equal(formatAt(at("2026-11-10T18:00:00Z"), "Asia/Kolkata", false), "Tue 11:30 PM GMT+5:30");
});
