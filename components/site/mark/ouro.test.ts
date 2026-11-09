import test from "node:test";
import assert from "node:assert/strict";
import { ouroPath } from "./ouro.ts";

test("ouroPath is deterministic, closed, and finite", () => {
  const a = ouroPath(), b = ouroPath();
  assert.equal(a.d, b.d);
  assert.match(a.d, /^M[-\d. L]+ Z$/);
  assert.ok(!a.d.includes("NaN"));
  assert.equal(a.eye.length, 3);
});

test("options change the outline", () => {
  assert.notEqual(ouroPath({ W: 11 }).d, ouroPath().d);
});

test("every coordinate sits inside the 100x100 mark viewBox", () => {
  const nums = ouroPath().d.match(/-?\d+\.\d/g)!.map(Number);
  assert.ok(nums.every((n) => Math.abs(n) <= 50));
});
