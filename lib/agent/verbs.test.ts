import test from "node:test";
import assert from "node:assert/strict";
import { FLAVOUR, VERBS, VERB_MS, verbAt, verbOrder } from "./verbs.ts";

test("verbOrder is a permutation of the base list, plus the look's flavour", () => {
  assert.deepEqual([...verbOrder("", () => 0.3)].sort(), [...VERBS].sort());
  assert.deepEqual([...verbOrder("glyph", () => 0.7)].sort(), [...VERBS, ...FLAVOUR.glyph].sort());
  assert.notDeepEqual(verbOrder("", () => 0), verbOrder("", () => 0.99));
});

test("verbAt changes every VERB_MS and wraps", () => {
  const o = ["a", "b", "c"];
  assert.equal(verbAt(o, 0), "a");
  assert.equal(verbAt(o, VERB_MS - 1), "a");
  assert.equal(verbAt(o, VERB_MS), "b");
  assert.equal(verbAt(o, VERB_MS * 3), "a");
  assert.equal(verbAt(o, -5), "a");
});

test("no verb is empty, duplicated or carries an emoji", () => {
  const all = [...VERBS, ...Object.values(FLAVOUR).flat()];
  assert.equal(new Set(all).size, all.length);
  for (const v of all) assert.match(v, /^[A-Za-z0-9 ,.'-]+$/);
});
