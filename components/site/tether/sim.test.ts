import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, drop, step, tug, hold, release, pathOf, NODE_X, NODE_Y, NODE_R } from "./sim.ts";

/** Runs the world at 60 Hz until still; returns the frame count (or Infinity). */
function run(w: ReturnType<typeof createWorld>, max = 1200) {
  for (let f = 0; f < max; f++) if (!step(w, 1 / 60)) return f;
  return Infinity;
}

test("a fresh world is at rest and its strings tie the photo to each node", () => {
  const w = createWorld();
  assert.equal(step(w, 1 / 60), false);
  w.strings.forEach((s, i) => {
    const n = s.p.length;
    assert.ok(Math.abs(s.p[n - 2] - NODE_X[i]) < 0.01);
    assert.ok(Math.abs(s.p[n - 1] - (NODE_Y - NODE_R)) < 0.01);
    assert.match(pathOf(s), /^M[\d.]+ [\d.]+Q/);
  });
});

test("the strings sag into a curve (slack), not a straight line", () => {
  const s = createWorld().strings[0], n = s.p.length / 2, mid = Math.floor(n / 2);
  const [ax, ay, bx, by] = [s.p[0], s.p[1], s.p[(n - 1) * 2], s.p[(n - 1) * 2 + 1]];
  const t = mid / (n - 1), lx = ax + (bx - ax) * t, ly = ay + (by - ay) * t;
  assert.ok(Math.hypot(s.p[mid * 2] - lx, s.p[mid * 2 + 1] - ly) > 3);
});

test("the drop bounces (overshoots its rest point) and then settles within a few seconds", () => {
  const w = createWorld();
  drop(w);
  let over = false;
  for (let f = 0; f < 120; f++) { step(w, 1 / 60); if (w.nodes[0].oy > 2) over = true; }
  assert.ok(over, "node 0 should swing past home");
  assert.ok(run(w) < 400);
  w.nodes.forEach((n) => assert.ok(Math.abs(n.ox) < 0.2 && Math.abs(n.oy) < 0.2));
});

test("tug and drag both come home; a held node never settles", () => {
  const w = createWorld();
  tug(w, 2, 1);
  assert.ok(run(w) < 400);
  hold(w, 1, 500, 0);
  assert.ok(w.nodes[1].ox < 200, "drag is clamped to a soft radius");
  assert.equal(step(w, 1 / 60), true);
  release(w, 1);
  assert.ok(run(w) < 400);
});

test("a huge frame is clamped instead of exploding", () => {
  const w = createWorld();
  tug(w, 0);
  step(w, 5);
  assert.ok(Number.isFinite(w.nodes[0].oy) && Math.abs(w.nodes[0].oy) < 100);
});
