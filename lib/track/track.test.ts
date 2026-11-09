import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, clampAt, isBotSignal, isGzip, isPublicIp, parseSeq, parseUa, pickIp, validateBatch, visitorIdFromCookie } from "./schema.ts";
import { normalizeIpinfo } from "./ipinfo.ts";

const vid = "123e4567-e89b-12d3-a456-426614174000";
const NOW = 1_800_000_000_000;

test("cookie: reads the rv_id uuid among other cookies, rejects junk", () => {
  assert.equal(visitorIdFromCookie(`a=1; rv_id=${vid.toUpperCase()}; b=2`), vid);
  assert.equal(visitorIdFromCookie("rv_id=not-a-uuid"), null);
  assert.equal(visitorIdFromCookie(null), null);
});

test("pickIp: x-real-ip first, then first forwarded hop, only real IPs", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  assert.equal(pickIp(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" })), "203.0.113.9");
  assert.equal(pickIp(h({ "x-forwarded-for": " 198.51.100.4 , 10.0.0.1" })), "198.51.100.4");
  assert.equal(pickIp(h({ "x-forwarded-for": "2001:db8::1" })), "2001:db8::1");
  assert.equal(pickIp(h({ "x-forwarded-for": "<script>" })), null);
  assert.equal(pickIp(h({})), null);
});

test("isPublicIp: private, loopback, CGNAT and ULA are not looked up", () => {
  for (const ip of ["10.1.2.3", "127.0.0.1", "192.168.0.5", "172.20.1.1", "100.64.0.1", "169.254.1.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) assert.equal(isPublicIp(ip), false, ip);
  for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) assert.equal(isPublicIp(ip), true, ip);
});

test("bots: known tools, empty UA and the automation flag", () => {
  const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  assert.equal(isBotSignal(chrome, false), false);
  assert.equal(isBotSignal(chrome.replace("Chrome/", "HeadlessChrome/"), false), true);
  assert.equal(isBotSignal("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", false), true);
  assert.equal(isBotSignal(chrome, true), true);
  assert.equal(isBotSignal(null, false), true);
});

test("parseUa: browser, os and device", () => {
  const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  assert.deepEqual(parseUa(safari), { browser: "Safari 18", os: "iOS", device: "mobile" });
  const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
  assert.deepEqual(parseUa(edge), { browser: "Edge 130", os: "Windows", device: "desktop" });
});

test("validateBatch: keeps valid events, drops unknown types and oversized data, clamps time", () => {
  const r = validateBatch({
    vid,
    ctx: { entry: "/", utm: { utm_source: "li", evil: "x" }, webdriver: true },
    e: [
      { t: "click", at: NOW - 5, d: { tag: "a", text: "x".repeat(900) } },
      { t: "nope", at: NOW },
      { t: "scroll", at: 5, d: { pct: 50 } },
      { t: "error", at: NOW, d: { big: Array.from({ length: 20 }, () => "y".repeat(400)) } },
      "junk",
    ],
  }, NOW);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.batch.events.map((e) => e.type), ["click", "scroll"]);
  assert.equal((r.batch.events[0].data.text as string).length, 500);
  assert.equal(r.batch.events[1].at, NOW);
  assert.deepEqual(r.batch.ctx.utm, { utm_source: "li" });
  assert.equal(r.batch.ctx.webdriver, true);
});

test("validateBatch: rejects bad shapes", () => {
  assert.equal(validateBatch(null).ok, false);
  assert.equal(validateBatch({ vid: "x", e: [{ t: "click" }] }).ok, false);
  assert.equal(validateBatch({ vid, e: [] }).ok, false);
  assert.equal(validateBatch({ vid, e: [{ t: "nope" }] }).ok, false);
  assert.equal(validateBatch({ vid, e: Array.from({ length: 101 }, () => ({ t: "click" })) }).ok, false);
});

test("clampAt, parseSeq, isGzip, cleanEmail", () => {
  assert.equal(clampAt(NOW + 3_600_000, NOW), NOW);
  assert.equal(parseSeq("12"), 12);
  assert.equal(parseSeq("1000"), null);
  assert.equal(parseSeq("-1"), null);
  assert.equal(parseSeq(undefined), null);
  assert.equal(isGzip(new Uint8Array(30).fill(0)), false);
  assert.equal(isGzip(Uint8Array.from([0x1f, 0x8b, ...new Array(30).fill(1)])), true);
  assert.equal(cleanEmail(" Ada@Acme.Example "), "ada@acme.example");
  assert.equal(cleanEmail("not an email"), null);
});

test("normalizeIpinfo: free, Lite and paid shapes", () => {
  const free = normalizeIpinfo({ ip: "1.2.3.4", city: "Mountain View", region: "California", country: "US", org: "AS15169 Google LLC", timezone: "America/Los_Angeles" });
  assert.deepEqual([free.asn, free.org, free.ip_type, free.company], ["AS15169", "Google LLC", "hosting", null]);
  const edu = normalizeIpinfo({ org: "AS17 Purdue University", country: "US" });
  assert.deepEqual([edu.ip_type, edu.company], ["edu", "Purdue University"]);
  const biz = normalizeIpinfo({ org: "AS64500 Acme Robotics Inc" });
  assert.deepEqual([biz.ip_type, biz.company], ["business", "Acme Robotics Inc"]);
  const isp = normalizeIpinfo({ org: "AS7922 Comcast Cable Communications, LLC" });
  assert.deepEqual([isp.ip_type, isp.company], ["isp", null]);
  const lite = normalizeIpinfo({ asn: "AS8075", as_name: "Microsoft Corporation", country_code: "US" });
  assert.deepEqual([lite.asn, lite.org, lite.country], ["AS8075", "Microsoft Corporation", "US"]);
  const paid = normalizeIpinfo({ asn: { asn: "AS1", name: "Net", type: "isp" }, company: { name: "Stripe, Inc.", type: "business" } });
  assert.deepEqual([paid.company, paid.ip_type], ["Stripe, Inc.", "business"]);
  assert.equal(normalizeIpinfo(null).company, null);
});
