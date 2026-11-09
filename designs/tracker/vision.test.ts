import { test } from "node:test";
import assert from "node:assert/strict";
import { fmap, hashStr, projLabel } from "./vision.ts";

test("hash and labels are stable", () => {
  assert.equal(hashStr("boilerframe"), hashStr("boilerframe"));
  assert.notEqual(hashStr("a"), hashStr("b"));
  assert.match(projLabel("boilerframe"), /^project 0\.(8[6-9]|9[0-7])$/);
});

test("activation map is deterministic with exactly one hot cell", () => {
  const m = fmap("boilerframe");
  assert.equal(m, fmap("boilerframe"));
  assert.equal(m.match(/class="fh"/g)?.length, 1);
  assert.equal(m.match(/class="fo"/g)?.length, 1);
});
