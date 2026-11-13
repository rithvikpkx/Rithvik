import { test } from "node:test";
import assert from "node:assert/strict";
import { ipBucket, rateHeaders, windowInfo } from "./rate-limit.ts";

test("windowInfo: remaining, clamped at zero, and the reset is when the oldest hit ages out", () => {
  const t0 = Date.UTC(2026, 10, 9, 12, 0, 0);
  assert.deepEqual(windowInfo(60, 19, t0, 3600), { limit: 60, used: 19, remaining: 41, reset: t0 / 1000 + 3600 });
  assert.equal(windowInfo(60, 75, t0).remaining, 0);
  assert.equal(windowInfo(60, 0, null).reset, null);
});

test("rateHeaders: limit, remaining, reset (epoch seconds); none when unknown; no reset for an empty window", () => {
  assert.deepEqual(rateHeaders({ limit: 60, used: 19, remaining: 41, reset: 1790000000 }), {
    "X-RateLimit-Limit": "60", "X-RateLimit-Remaining": "41", "X-RateLimit-Reset": "1790000000",
  });
  assert.deepEqual(rateHeaders(null), {});
  assert.equal("X-RateLimit-Reset" in rateHeaders(windowInfo(60, 0, null)), false);
});

test("IPv4 passes through", () => {
  assert.equal(ipBucket(" 203.0.113.7 "), "203.0.113.7");
});

test("IPv6 is bucketed to its /64 regardless of notation", () => {
  const want = "2001:db8:abcd:12::/64";
  assert.equal(ipBucket("2001:db8:abcd:12::1"), want);
  assert.equal(ipBucket("2001:0DB8:abcd:0012:dead:beef:0:1"), want);
  assert.equal(ipBucket("[2001:db8:abcd:12:ffff::9]:443"), want);
  assert.equal(ipBucket("2001:db8:abcd:12::1%eth0"), want);
  assert.equal(ipBucket("::1"), "0:0:0:0::/64");
  assert.equal(ipBucket("2001:db8::"), "2001:db8:0:0::/64");
});

test("IPv4-mapped IPv6 collapses to IPv4", () => {
  assert.equal(ipBucket("::ffff:198.51.100.4"), "198.51.100.4");
  assert.equal(ipBucket("::FFFF:c633:6404"), "198.51.100.4");
});

test("garbage is returned as is, never throws", () => {
  assert.equal(ipBucket(""), "");
  assert.equal(ipBucket("unknown"), "unknown");
  assert.equal(ipBucket("1:2:3:4:5:6:7:8:9"), "1:2:3:4:5:6:7:8:9");
  assert.equal(ipBucket("1::2::3"), "1::2::3");
  assert.equal(ipBucket("zz::1"), "zz::1");
});
