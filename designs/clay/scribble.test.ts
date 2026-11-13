import { test } from "node:test";
import assert from "node:assert/strict";
import { scribble } from "./scribble.ts";

test("scribble is deterministic per seed and differs between seeds", () => {
  assert.equal(scribble(3), scribble(3));
  assert.notEqual(scribble(3), scribble(4));
});

test("scribble stays inside its box", () => {
  const w = 240, h = 24;
  const nums = scribble(7, w, h).match(/-?\d+(\.\d+)?/g)!.map(Number);
  assert.match(scribble(7, w, h), /^M/);
  nums.forEach((v, i) => assert.ok(v >= 0 && v <= (i % 2 ? h : w), `${v} out of box`));
});
