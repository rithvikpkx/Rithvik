import test from "node:test";
import assert from "node:assert/strict";
import { hexToVec3, createScaleController, createFpsAverager, createSlowDetector, MIN_SCALE } from "./helpers.ts";

test("hexToVec3 parses with and without #, falls back to black", () => {
  assert.deepEqual(hexToVec3("#ff0000"), [1, 0, 0]);
  assert.deepEqual(hexToVec3("00FF80"), [0, 1, 128 / 255]);
  assert.deepEqual(hexToVec3("nope"), [0, 0, 0]);
  assert.deepEqual(hexToVec3(undefined as unknown as string), [0, 0, 0]);
});

test("scale controller drops on sustained slow frames, never below the floor", () => {
  const c = createScaleController(0.5);
  for (let i = 0; i < 10; i++) c.push(16);
  assert.equal(c.scale, 0.5);
  for (let i = 0; i < 25; i++) c.push(40);
  assert.ok(Math.abs(c.scale - 0.4) < 1e-9);
  for (let i = 0; i < 2000; i++) c.push(40);
  assert.equal(c.scale, MIN_SCALE);
});

test("scale controller recovers slowly, stopping short of the scale that hurt", () => {
  const c = createScaleController(0.5);
  for (let i = 0; i < 25; i++) c.push(40); // 0.5 -> 0.4, ceiling 0.5
  for (let i = 0; i < 299; i++) c.push(10);
  assert.ok(Math.abs(c.scale - 0.4) < 1e-9); // not yet
  c.push(10);
  assert.ok(c.scale > 0.4 && c.scale <= 0.45 + 1e-9);
  for (let i = 0; i < 5000; i++) c.push(10);
  assert.ok(c.scale <= 0.45 + 1e-9);
});

test("alternating fast and slow frames never drop", () => {
  const c = createScaleController(0.6);
  for (let i = 0; i < 100; i++) c.push(i % 2 ? 30 : 10);
  assert.equal(c.scale, 0.6);
});

test("fps averager is a rolling window", () => {
  const a = createFpsAverager(4);
  assert.equal(a.fps, 0);
  [20, 20, 20, 20].forEach((d) => a.push(d));
  assert.equal(a.fps, 50);
  [10, 10, 10, 10].forEach((d) => a.push(d)); // old samples fall out
  assert.equal(a.fps, 100);
  assert.equal(a.size, 4);
});

test("slow detector needs consecutive slow windows", () => {
  const d = createSlowDetector(32, 2);
  assert.equal(d.push(20), false);
  assert.equal(d.push(60), false);
  assert.equal(d.push(20), false);
  assert.equal(d.push(25), true);
});
