import { test } from "node:test";
import assert from "node:assert/strict";
import { detentAngles, nearest, shaped, step, wrap, SWEEP, type Motion } from "./physics.ts";

test("detents span the sweep, designs wider apart than palettes", () => {
  const a = detentAngles(9, 16);
  assert.equal(a.length, 25);
  assert.equal(a[0], -SWEEP / 2);
  assert.equal(a[24], SWEEP / 2);
  assert.ok(a[1] - a[0] > a[11] - a[10]);
  assert.ok(a[9] - a[8] > a[11] - a[10]); // the group gap
});

test("nearest and shaped stick to detents and stop at the ends", () => {
  const a = detentAngles(9, 16);
  assert.equal(nearest(a, a[5] + 0.1), 5);
  assert.equal(shaped(a, a[5]), a[5]);
  assert.ok(Math.abs(shaped(a, a[5] + 1) - a[5]) < 1); // magnet pulls in
  assert.ok(shaped(a, a[0] - 500) > a[0] - 10); // rubber band hardens
});

test("wrap gives the short way round", () => {
  assert.equal(wrap(350), -10);
  assert.equal(wrap(-190), 170);
});

test("a flick coasts, then springs onto a detent", () => {
  const a = detentAngles(9, 16);
  const m: Motion = { a: a[3], v: 0.6, phase: "coast", target: 3 };
  let done = false;
  for (let i = 0; i < 400 && !done; i++) done = step(m, a, 16);
  assert.ok(done);
  assert.ok(a.includes(m.a));
  assert.ok(m.target > 3);
});
