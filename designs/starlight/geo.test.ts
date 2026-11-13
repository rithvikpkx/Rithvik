import test from "node:test";
import assert from "node:assert/strict";
import { deg, hyOf, nearestQuad2, quadOf } from "./geo.ts";

test("horizon rises with scroll and returns near the end", () => {
  assert.equal(hyOf(0), 0.2);
  assert.ok(hyOf(0.05) > hyOf(0) && hyOf(0.95) < hyOf(0.5));
  assert.ok(Math.abs(hyOf(1) - 0.34) < 1e-9);
});

test("deg picks the hemisphere letter", () => {
  assert.equal(deg(42.3601, "N", "S"), "42.36°N");
  assert.equal(deg(-71.0589, "E", "W"), "71.06°W");
});

test("quad distance is zero on the curve's samples", () => {
  const q = quadOf("M0 0 Q5 5 10 0");
  assert.deepEqual(q, [0, 0, 5, 5, 10, 0]);
  assert.equal(nearestQuad2(q, 0, 0), 0);
  assert.equal(nearestQuad2(q, 10, 0), 0);
});
