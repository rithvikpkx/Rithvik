import test from "node:test";
import assert from "node:assert/strict";
import { parseCount } from "./count.ts";

test("parses prefix, number and suffix", () => {
  assert.deepEqual(parseCount("500+"), { pre: "", n: 500, post: "+" });
  assert.deepEqual(parseCount("$1,200 saved"), { pre: "$", n: 1200, post: " saved" });
  assert.deepEqual(parseCount("6"), { pre: "", n: 6, post: "" });
});

test("no leading number means no count-up", () => {
  assert.equal(parseCount("many"), null);
  assert.equal(parseCount(""), null);
});
