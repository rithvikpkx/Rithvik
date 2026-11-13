import test from "node:test";
import assert from "node:assert/strict";
import { CAP_W, PITCH, VISIBLE, centerScroll, edgeVelocity, nearestIndex, revealScroll, step, stripLayout, stripeScale, thumb } from "./strip.ts";

test("stripLayout: stripes ordered on half pixels, a gap between the groups", () => {
  const L = stripLayout(25, 9);
  assert.equal(L.xs.length, 25);
  L.xs.forEach((x) => assert.equal(x % 1, 0.5));
  assert.ok(L.xs[9] - L.xs[8] > PITCH + 10); // the group gap
  assert.equal(L.xs[1] - L.xs[0], PITCH);
  assert.ok(L.xs[24] < L.contentW);
});

test("stripLayout: the window shows at most VISIBLE looks, the rest scrolls", () => {
  const big = stripLayout(40, 9);
  assert.ok(big.vw < big.contentW && big.max > 0);
  assert.ok(big.vw <= VISIBLE * PITCH + 14 + 24);
  assert.equal(big.capW, big.vw + 2 * CAP_W);
  assert.equal(big.max, big.contentW - big.vw);
  const small = stripLayout(12, 4);
  assert.equal(small.max, 0); // fits: no scrolling, capsule shrinks to it
  assert.equal(small.vw, small.contentW);
});

test("stripLayout: a narrow screen shrinks the window instead of overflowing it", () => {
  const L = stripLayout(25, 9, 300);
  assert.ok(L.capW <= 300);
  assert.ok(L.max > 0);
});

test("nearestIndex: picks the closest centre, clamps at the ends", () => {
  const { xs } = stripLayout(25, 9);
  xs.forEach((x, i) => assert.equal(nearestIndex(xs, x + 1.2), i));
  assert.equal(nearestIndex(xs, -50), 0);
  assert.equal(nearestIndex(xs, 5000), 24);
  const mid = (xs[8] + xs[9]) / 2; // across the group gap, the nearer one wins
  assert.equal(nearestIndex(xs, mid - 1), 8);
  assert.equal(nearestIndex(xs, mid + 1), 9);
});

test("centerScroll / revealScroll: keep a look in view, never out of range", () => {
  assert.equal(centerScroll(10, 280, 130), 0);
  assert.equal(centerScroll(400, 280, 130), 130);
  assert.equal(centerScroll(200, 280, 130), 60);
  assert.equal(revealScroll(0, 100, 280, 20, 130), 0); // already inside
  assert.equal(revealScroll(0, 275, 280, 20, 130), 15); // too close to the right edge
  assert.equal(revealScroll(100, 110, 280, 20, 130), 90); // too close to the left edge
  assert.equal(revealScroll(0, 4000, 280, 20, 130), 130);
});

test("edgeVelocity: only near an end that can still scroll, faster the closer", () => {
  assert.equal(edgeVelocity(140, 280, 30, 400, 50, 130), 0);
  assert.ok(edgeVelocity(10, 280, 30, 400, 50, 130) < 0);
  assert.ok(edgeVelocity(270, 280, 30, 400, 50, 130) > 0);
  assert.ok(edgeVelocity(270, 280, 30, 400, 50, 130) > edgeVelocity(255, 280, 30, 400, 50, 130));
  assert.equal(edgeVelocity(5, 280, 30, 400, 0, 130), 0); // already at the start
  assert.equal(edgeVelocity(275, 280, 30, 400, 130, 130), 0); // already at the end
});

test("thumb: spans the track at both ends of the scroll", () => {
  const a = thumb(0, 280, 410), b = thumb(130, 280, 410);
  assert.equal(a.left, 0);
  assert.ok(Math.abs(b.left + b.width - 280) < 1e-9);
  assert.ok(a.width < 280 && a.width > 14);
  assert.deepEqual(thumb(0, 280, 280), { left: 0, width: 280 });
});

test("stripeScale: tall under the lens, short far away, short when closed", () => {
  assert.equal(stripeScale(0, 1), 1);
  assert.ok(stripeScale(60, 1) < 0.47);
  assert.equal(stripeScale(0, 0), 0.46);
});

test("step: settles on its target, a dropped frame is clamped", () => {
  const s = { x: 0, v: 0 };
  let t = 0, peak = 0;
  while (!step(s, 100, 150, 16, 0.016) && t < 4) { t += 0.016; peak = Math.max(peak, s.x); }
  assert.ok(t < 2, `settled in ${t}s`);
  assert.ok(peak > 100, "a little overshoot");
  assert.deepEqual(s, { x: 100, v: 0 });
  const w = { x: 0, v: 0 };
  step(w, 100, 150, 16, 5);
  assert.ok(w.x < 30);
});
