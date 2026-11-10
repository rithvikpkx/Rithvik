import { test } from "node:test";
import assert from "node:assert/strict";
import { letter, step } from "./engine.ts";

test("a letter under the pointer excites and is pushed away; a far one stays calm", () => {
  const near = letter(100, 100), far = letter(900, 100);
  for (let i = 0; i < 30; i++) step([near, far], { x: 90, y: 100, vx: 0, vy: 0 }, 1 / 60);
  assert.ok(near.k > 0.5, `near k ${near.k}`);
  assert.ok(near.x > 0, "pushed away from the pointer (to the right)");
  assert.equal(far.k, 0);
  assert.equal(far.x, 0);
});

test("after the pointer leaves everything settles and the loop can stop", () => {
  const l = letter(100, 100);
  for (let i = 0; i < 30; i++) step([l], { x: 100, y: 120, vx: 1, vy: 0 }, 1 / 60);
  let f = 0;
  while (step([l], null, 1 / 60) && f < 2000) f++;
  assert.ok(f < 2000, "comes to rest");
  assert.equal(l.k, 0);
  assert.equal(l.x, 0);
  assert.equal(l.y, 0);
});

test("a long frame is clamped instead of exploding the spring", () => {
  const l = letter(0, 0);
  step([l], { x: 5, y: 0, vx: 0, vy: 0 }, 5);
  assert.ok(Number.isFinite(l.x) && Math.abs(l.x) < 50);
});
