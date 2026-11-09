import { test } from "node:test";
import assert from "node:assert/strict";
import { areaPath, arcPath, barPath, compact, describeSeries, donutAngles, labelStride, labelsFit, linePath, niceScale, timelineLayout, withUnit, yearValue } from "./scale.ts";

test("niceScale covers the data on 1/2/5 steps", () => {
  assert.deepEqual(niceScale(0, 97), { min: 0, max: 100, ticks: [0, 50, 100] });
  assert.deepEqual(niceScale(0.1, 0.35).ticks, [0.1, 0.2, 0.3, 0.4]);
  assert.equal(niceScale(3, 3).ticks.length > 1, true); // a flat series still gets an axis
  assert.equal(niceScale(-5, 12).min <= -5, true);
  assert.deepEqual(niceScale(NaN, 1), { min: 0, max: 1, ticks: [0, 1] });
});

test("compact and withUnit", () => {
  assert.deepEqual([0, 12, 340, 1234, 15000, 2_500_000].map(compact), ["0", "12", "340", "1.2k", "15k", "2.5M"]);
  assert.equal(withUnit(42, "%"), "42%");
  assert.equal(withUnit(3, "$"), "$3");
  assert.equal(withUnit(380, "ms"), "380 ms");
});

test("linePath lifts the pen at gaps; areaPath closes each run", () => {
  const pts = [{ x: 0, y: 10 }, { x: 10, y: 5 }, null, { x: 30, y: 8 }, { x: 40, y: 2 }];
  assert.equal(linePath(pts), "M0 10L10 5M30 8L40 2");
  assert.equal((areaPath(pts, 20).match(/Z/g) ?? []).length, 2);
  assert.equal(areaPath([{ x: 0, y: 1 }], 20), ""); // a lone point has no area
});

test("barPath is empty for zero height and rounds only the data end", () => {
  assert.equal(barPath(0, 50, 10, 50), "");
  assert.equal(barPath(0, 10, 10, 50), "M0 50V14Q0 10 4 10H6Q10 10 10 14V50Z");
  assert.match(barPath(0, 90, 10, 50), /^M0 50V86/); // a negative bar rounds at the bottom
});

test("donutAngles sum to a full turn and ignore negatives", () => {
  const a = donutAngles([1, 1, 2]);
  assert.equal(Math.abs(a[2].a1 - Math.PI * 2) < 1e-9, true);
  assert.deepEqual(a.map((x) => x.share), [0.25, 0.25, 0.5]);
  assert.equal(donutAngles([0, 0])[0].share, 0);
  assert.equal((arcPath(50, 50, 40, 20, 0, Math.PI * 2).match(/Z/g) ?? []).length, 2); // a full circle becomes two sectors
});

test("yearValue and timelineLayout", () => {
  const now = new Date(Date.UTC(2026, 10, 9));
  assert.equal(yearValue("2024", now), 2024);
  assert.equal(yearValue("2024-07", now), 2024 + 6 / 12);
  assert.equal(yearValue("Present", now), 2026 + 10 / 12);
  assert.equal(yearValue("last summer", now), null);
  assert.equal(yearValue("2024-13", now), null);
  const l = timelineLayout([{ start: "2023", end: "2024" }, { start: "2024", end: "present" }, { start: "??" }], now);
  assert.equal(l.rows[2], null);
  assert.equal(l.rows[0]!.left, 0);
  assert.equal(l.rows[1]!.left > l.rows[0]!.left, true);
  assert.equal(l.ticks[0].year, 2023);
  assert.equal(timelineLayout([{ start: "x" }], now).ticks.length, 0);
});

test("labelsFit and labelStride", () => {
  assert.equal(labelsFit([10, 30, 50]), true);
  assert.equal(labelsFit([10, 14]), false);
  assert.equal(labelStride(24, 600), 3);
  assert.equal(labelStride(5, 600), 1);
});

test("describeSeries reads out ranges and the latest value", () => {
  const s = describeSeries("Line", "TTFB", ["Mon", "Tue", "Wed"], [{ name: "p50", values: [100, null, 300] }], "ms");
  assert.equal(s, "Line chart: TTFB. 3 points from Mon to Wed. p50: from 100 ms to 300 ms, latest 300 ms.");
  assert.match(describeSeries("Bar", "", ["a"], [{ name: "x", values: [null] }]), /x: no data/);
});
