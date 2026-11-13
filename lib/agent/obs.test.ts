import { test } from "node:test";
import assert from "node:assert/strict";
import { clip, geoFromHeaders, hashIp, isShareLive, isShareToken, isUuid, newShareToken, redactPII, safeInt, shareExpiry, toMessageRow } from "./obs.ts";

test("isUuid accepts canonical uuids only", () => {
  assert.ok(isUuid("123e4567-e89b-12d3-a456-426614174000"));
  assert.ok(!isUuid("123e4567-e89b-12d3-a456-42661417400"));
  assert.ok(!isUuid("'; drop table agent_sessions;--"));
  assert.ok(!isUuid(undefined));
});

test("share tokens are 22 url-safe chars and unique", () => {
  const a = newShareToken();
  assert.equal(a.length, 22);
  assert.ok(isShareToken(a));
  assert.notEqual(a, newShareToken());
  assert.ok(!isShareToken("short"));
  assert.ok(!isShareToken("a".repeat(21) + "/"));
});

test("share expiry is 30 days out and isShareLive respects it", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(shareExpiry(now), "2026-01-31T00:00:00.000Z");
  assert.ok(isShareLive("2026-01-31T00:00:00.000Z", now));
  assert.ok(!isShareLive("2025-12-31T00:00:00.000Z", now));
  assert.ok(!isShareLive(null, now));
});

test("hashIp is salted and null without a salt", () => {
  assert.equal(hashIp("1.2.3.4", undefined), null);
  assert.equal(hashIp("1.2.3.4", "s")?.length, 64);
  assert.notEqual(hashIp("1.2.3.4", "a"), hashIp("1.2.3.4", "b"));
  assert.equal(hashIp("1.2.3.4", "a"), hashIp("1.2.3.4", "a"));
});

test("geoFromHeaders decodes the city and tolerates absence", () => {
  const h = new Headers({ "x-vercel-ip-country": "US", "x-vercel-ip-city": "San%20Francisco" });
  assert.deepEqual(geoFromHeaders(h), { country: "US", region: null, city: "San Francisco" });
  assert.equal(geoFromHeaders(new Headers({ "x-vercel-ip-city": "%E0%A4%A" })).city, "%E0%A4%A");
  assert.deepEqual(geoFromHeaders(new Headers()), { country: null, region: null, city: null });
});

test("redactPII removes emails and phones but keeps dates and short numbers", () => {
  const s = "Mail jo.e+x@corp.example.com or call +1 (415) 555-0132 / 415.555.0132. Started 2024-01-15, 120 ms, v2.5.";
  const r = redactPII(s);
  assert.ok(!r.includes("corp.example"));
  assert.ok(!r.includes("555"));
  assert.ok(r.includes("2024-01-15") && r.includes("120 ms") && r.includes("v2.5"));
  assert.equal((r.match(/\[phone removed\]/g) ?? []).length, 2);
});

test("clip and safeInt sanitise", () => {
  assert.equal(clip("  hi  ", 5), "hi");
  assert.equal(clip("abcdef", 3), "abc");
  assert.equal(clip("   ", 3), null);
  assert.equal(clip(5, 3), null);
  assert.equal(safeInt(12.6), 13);
  assert.equal(safeInt(-1), null);
  assert.equal(safeInt(NaN), null);
  assert.equal(safeInt("3"), null);
});

test("toMessageRow clamps content and defaults", () => {
  const row = toMessageRow("id", { role: "assistant", content: "x".repeat(30_000), tokensIn: 5, ttfbMs: NaN });
  assert.equal(row.content.length, 20_000);
  assert.equal(row.tokens_in, 5);
  assert.equal(row.ttfb_ms, null);
  assert.equal(row.cached, false);
  assert.equal(row.tools, null);
});
