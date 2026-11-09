import { test } from "node:test";
import assert from "node:assert/strict";
import { ipExcluded, isOwnerHeaders, parseExcludeList, safeEqual } from "./owner.ts";

test("exclude list: IPv4, CIDR, IPv6 /64, mapped addresses, bad entries skipped", () => {
  const rules = parseExcludeList("203.0.113.7, 198.51.100.0/24 ,2001:db8:abcd:12::/64, nonsense, 10.0.0.0/40, ::1");
  assert.equal(rules.length, 4);
  assert.equal(ipExcluded("203.0.113.7", rules), true);
  assert.equal(ipExcluded("203.0.113.8", rules), false);
  assert.equal(ipExcluded("198.51.100.200", rules), true);
  assert.equal(ipExcluded("198.51.101.1", rules), false);
  assert.equal(ipExcluded("2001:db8:abcd:12:dead:beef:1:2", rules), true);
  assert.equal(ipExcluded("2001:db8:abcd:13::1", rules), false);
  assert.equal(ipExcluded("::ffff:203.0.113.7", rules), true);
  assert.equal(ipExcluded("::1", rules), true);
  assert.equal(ipExcluded(null, rules), false);
  assert.equal(ipExcluded("garbage", rules), false);
  assert.equal(ipExcluded("1.2.3.4", parseExcludeList(undefined)), false);
  assert.equal(ipExcluded("1.2.3.4", parseExcludeList("0.0.0.0/0")), true);
});

test("safeEqual: equal, different, different length, empty", () => {
  assert.equal(safeEqual("s3cret-key", "s3cret-key"), true);
  assert.equal(safeEqual("s3cret-key", "s3cret-kez"), false);
  assert.equal(safeEqual("s3cret", "s3cret-key"), false);
  assert.equal(safeEqual("", ""), true);
  assert.equal(safeEqual("", "x"), false);
});

test("isOwnerHeaders: device cookie or excluded IP", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  assert.equal(isOwnerHeaders(h({ cookie: "a=1; rv_owner=1" })), true);
  assert.equal(isOwnerHeaders(h({ cookie: "rv_owner=0" })), false);
  assert.equal(isOwnerHeaders(h({ "x-real-ip": "203.0.113.50" })), false);
  process.env.TRACKING_EXCLUDE_IPS = "203.0.113.0/24";
  assert.equal(isOwnerHeaders(h({ "x-forwarded-for": "203.0.113.50, 1.1.1.1" })), true);
  assert.equal(isOwnerHeaders(h({ "x-real-ip": "203.0.114.50" })), false);
  delete process.env.TRACKING_EXCLUDE_IPS;
});
