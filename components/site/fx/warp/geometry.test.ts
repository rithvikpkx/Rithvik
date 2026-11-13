import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCtrl, dentTargets, stepSprings, warpPath, type Radii } from "./geometry.ts";

const R: Radii = [24, 24, 24, 6];
const nums = (s: string) => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

test("control points sit on the straight edges, with the corners left as fixed anchors", () => {
  const c = buildCtrl(300, 200, R);
  assert.ok(c.length > 20);
  for (const p of c) {
    assert.ok(p.x >= 0 && p.x <= 300 && p.y >= 0 && p.y <= 200);
    assert.ok(p.a > 0, "never exactly at a corner join");
  }
  assert.deepEqual([...new Set(c.map((p) => p.edge))], [0, 1, 2, 3]);
});

test("at rest the path is the rounded rectangle: closed, inside its box, one arc per rounded corner", () => {
  const c = buildCtrl(300, 200, R), d = new Float32Array(c.length);
  const p = warpPath(300, 200, R, c, d);
  assert.ok(p.startsWith("M24 0") && p.endsWith("Z"));
  assert.equal((p.match(/A/g) ?? []).length, 4);
  assert.equal((p.match(/C/g) ?? []).length, c.length + 4);
  for (const n of nums(p)) assert.ok(n >= 0 && n <= 300);
});

test("a square corner (radius 0) emits no arc", () => {
  const r: Radii = [0, 0, 0, 0], c = buildCtrl(120, 120, r);
  assert.equal((warpPath(120, 120, r, c, new Float32Array(c.length)).match(/A/g) ?? []).length, 0);
});

test("the dent peaks at the control point nearest the pointer, fades with distance, and is gentler when scaled", () => {
  const c = buildCtrl(300, 200, R), t = new Float32Array(c.length), g = new Float32Array(c.length);
  dentTargets(c, 150, -20, 16, 80, 1, t); // pointer just above the middle of the top edge
  const peak = t.indexOf(Math.max(...t));
  assert.equal(c[peak].edge, 0);
  assert.ok(Math.abs(c[peak].x - 150) < 15);
  assert.ok(t[peak] > 10 && t[peak] <= 16);
  assert.ok(t[c.findIndex((p) => p.edge === 2)] < 0.5, "the far bottom edge stays put");
  dentTargets(c, 150, -20, 16, 80, 0.4, g);
  assert.ok(Math.abs(g[peak] - t[peak] * 0.4) < 1e-4);
});

test("a dented path pushes the top edge inward (down) and keeps everything inside the box", () => {
  const c = buildCtrl(300, 200, R), d = new Float32Array(c.length);
  dentTargets(c, 150, -10, 16, 80, 1, d);
  const ys = nums(warpPath(300, 200, R, c, d));
  assert.ok(ys.some((n) => n > 10 && n < 18), "some coordinate sits ~dent below the top edge");
  for (const n of ys) assert.ok(n >= 0 && n <= 300);
});

test("springs overshoot (they wobble), then settle on the target", () => {
  const x = new Float32Array(1), v = new Float32Array(1), t = [10];
  let max = 0, rest = 1;
  for (let i = 0; i < 600 && rest > 0.02; i++) { rest = stepSprings(x, v, t, 1 / 60); max = Math.max(max, x[0]); }
  assert.ok(max > 10.2, `overshoot ${max}`);
  assert.ok(rest <= 0.02, "settled");
  assert.ok(Math.abs(x[0] - 10) < 0.05);
});

test("a long frame is substepped, so a stall cannot blow the spring up", () => {
  const x = new Float32Array(1), v = new Float32Array(1);
  stepSprings(x, v, [10], 0.1);
  assert.ok(Number.isFinite(x[0]) && Math.abs(x[0]) < 40);
});
