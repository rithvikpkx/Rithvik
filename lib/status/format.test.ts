import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketLabel, fmtInt, fmtMs, fmtRate, fmtStamp, fmtUptime, fmtUsd, healthState } from "./format.ts";
import { statusFixture } from "./fixture.ts";

test("uptime is truncated, never rounded up", () => {
  assert.equal(fmtUptime(99.996), "99.99%");
  assert.equal(fmtUptime(99.9), "99.9%");
  assert.equal(fmtUptime(100), "100%");
  assert.equal(fmtUptime(99.31), "99.31%");
  assert.equal(fmtUptime(null), "–");
  assert.equal(fmtUptime(140), "100%");
});

test("rates, durations, money, counts", () => {
  assert.deepEqual([0, 0.0004, 0.025, 0.2, 1].map(fmtRate), ["0%", "<0.1%", "2.5%", "20%", "100%"]);
  assert.equal(fmtRate(null), "–");
  assert.deepEqual([420, 1830, 12400, null].map(fmtMs), ["420 ms", "1.8 s", "12 s", "–"]);
  assert.deepEqual([0, 0.004, 0.42, null].map(fmtUsd), ["~$0.00", "<$0.01", "~$0.42", "–"]);
  assert.equal(fmtInt(1284), "1,284");
  assert.equal(fmtInt(null), "–");
});

test("timestamps are UTC and accept epoch ms or ISO strings", () => {
  const t = Date.UTC(2026, 10, 9, 14, 5);
  assert.equal(fmtStamp(t), "Nov 9, 14:05 UTC");
  assert.equal(fmtStamp("2026-11-09T14:05:00Z"), "Nov 9, 14:05 UTC");
  assert.equal(fmtStamp("garbage"), "");
  assert.equal(bucketLabel(t, "24h"), "14:05");
  assert.equal(bucketLabel(t, "7d"), "Mon 14:05");
});

test("healthState reads the newest check", () => {
  assert.equal(healthState([]).tone, "none");
  assert.equal(healthState([{ t: 1, ok: false, ms: null }, { t: 2, ok: true, ms: 90 }]).tone, "good");
  assert.equal(healthState([{ t: 1, ok: true, ms: 90 }, { t: 2, ok: false, ms: null }]).tone, "bad");
});

test("the fixture has the agreed shape", () => {
  const f = statusFixture();
  assert.deepEqual(Object.keys(f).sort(), ["build", "generatedAt", "uptime", "windows"]);
  assert.deepEqual(Object.keys(f.windows).sort(), ["24h", "7d"]);
  assert.deepEqual(Object.keys(f.windows["24h"]).sort(), ["cacheHitRate", "cacheHits", "errorRate", "errors", "estCostUsd", "models", "requests", "series", "tokens", "totalMs", "ttfbMs"]);
  assert.deepEqual(Object.keys(f.windows["24h"].series[0]).sort(), ["cached", "errors", "p50TtfbMs", "requests", "t"]);
  assert.deepEqual(Object.keys(f.uptime).sort(), ["24h", "30d", "7d", "recent"]);
  assert.deepEqual(Object.keys(f.uptime.recent[0]).sort(), ["ms", "ok", "t"]);
  assert.deepEqual(Object.keys(f.build).sort(), ["auxModel", "commit", "model"]);
  assert.deepEqual(statusFixture(5), statusFixture(5)); // deterministic
});
