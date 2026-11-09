import { test } from "node:test";
import assert from "node:assert/strict";
import { ART, readSecs } from "./art.ts";

test("readSecs floors at 6 and scales with words", () => {
  assert.equal(readSecs({ headline: "a", ctx: "b", desc: [] }), 6);
  assert.equal(readSecs({ headline: "", ctx: "", desc: [Array(230).fill("w").join(" ")] }), 60);
});

test("every plate is non-empty markup", () => {
  for (const k of Object.keys(ART)) assert.ok(ART[k].startsWith("<"));
});
