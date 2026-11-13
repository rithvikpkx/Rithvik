import { test } from "node:test";
import assert from "node:assert/strict";
import { dayAfter, escapeLike, parseFilters, placeLabel } from "./chats.ts";

test("parseFilters reads valid values and drops malformed ones", () => {
  assert.deepEqual(
    parseFilters({ q: "  rag ", email: "1", follow: "1", from: "2026-02-03", to: "2026-02-30" }),
    { q: "rag", email: true, followUp: true, from: "2026-02-03", to: null },
  );
  assert.deepEqual(parseFilters({}), { q: "", email: false, followUp: false, from: null, to: null });
  assert.equal(parseFilters({ q: ["a", "b"] }).q, "a");
  assert.equal(parseFilters({ q: "x".repeat(500) }).q.length, 100);
  assert.equal(parseFilters({ from: "2026-1-1" }).from, null);
});

test("escapeLike neutralises wildcards", () => {
  assert.equal(escapeLike("100%_a\\b"), "100\\%\\_a\\\\b");
});

test("dayAfter rolls over month ends", () => {
  assert.equal(dayAfter("2026-01-31"), "2026-02-01T00:00:00.000Z");
});

test("placeLabel joins what exists", () => {
  assert.equal(placeLabel({ city: "Boston", region: "MA", country: "US" }), "Boston, MA, US");
  assert.equal(placeLabel({ city: null, region: null, country: "US" }), "US");
  assert.equal(placeLabel({ city: null, region: null, country: null }), "—");
});
