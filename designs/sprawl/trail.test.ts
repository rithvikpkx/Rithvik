import { test } from "node:test";
import assert from "node:assert/strict";
import { LIFE_MS, SLOTS, decay, pushPoint, type Pt } from "./trail.ts";

test("nearby samples move the head, distant ones push a new point, capped at SLOTS", () => {
  let t: Pt[] = [];
  t = pushPoint(t, 0.5, 0.5);
  t = pushPoint(t, 0.51, 0.5);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0], [0.51, 0.5, 1]);
  for (let i = 1; i <= 6; i++) t = pushPoint(t, 0.5 + i * 0.1, 0.5);
  assert.equal(t.length, SLOTS);
  assert.ok(Math.abs(t[0][0] - 1.1) < 1e-9);
});

test("points fog back over LIFE_MS and then disappear", () => {
  let t: Pt[] = [[0.2, 0.2, 1], [0.4, 0.4, 0.3]];
  t = decay(t, LIFE_MS / 2);
  assert.equal(t.length, 1);
  assert.ok(Math.abs(t[0][2] - 0.5) < 1e-9);
  assert.equal(decay(t, LIFE_MS).length, 0);
});
