import { test } from "node:test";
import assert from "node:assert/strict";
import { describeEvent, duration, offset, parseVisitorFilters, place, whoLabel } from "./views.ts";

test("parseVisitorFilters: valid values kept, junk dropped", () => {
  const f = parseVisitorFilters({ identified: "1", company: "  Acme ", country: "us", from: "2026-11-01", to: "2026-13-45" });
  assert.deepEqual(f, { identified: true, bots: false, company: "Acme", country: "US", from: "2026-11-01", to: null });
  assert.equal(parseVisitorFilters({ country: "USA" }).country, "");
  assert.equal(parseVisitorFilters({}).identified, false);
});

test("describeEvent: the common types read as one line", () => {
  assert.equal(describeEvent({ type: "click", data: { tag: "a", text: "Resume", hook: "resume", val: "", href: "/resume.pdf" } }), '[resume] "Resume" → /resume.pdf');
  assert.equal(describeEvent({ type: "section", data: { id: "work" } }), "saw #work");
  assert.equal(describeEvent({ type: "scroll", data: { pct: 75 } }), "scrolled to 75%");
  assert.equal(describeEvent({ type: "active", data: { ms: 65_000 } }), "active 1m 05s");
  assert.equal(describeEvent({ type: "perf", data: { lcp: 1200, inp: 80, cls: 0.01 } }), "LCP 1200 ms · INP 80 ms · CLS 0.01");
  assert.equal(describeEvent({ type: "weird", data: null }), "weird");
});

test("labels and offsets", () => {
  assert.equal(place({ city: "Boston", region: "MA", country: "US" }), "Boston, MA, US");
  assert.equal(place({ city: null, region: null, country: null }), "—");
  assert.equal(whoLabel({ name: null, email: null, company: "Acme", company_given: null, org: "AS1 Acme" }), "Acme");
  assert.equal(whoLabel({ name: null, email: null, company: null, company_given: null, org: null }), "anonymous");
  assert.equal(duration(12_400), "12s");
  assert.equal(offset("2026-11-09T10:00:00Z", "2026-11-09T10:01:05Z"), "+1:05");
});
