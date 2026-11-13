import { test } from "node:test";
import assert from "node:assert/strict";
import { chargeStep, rampAt, toCanvas } from "./core.ts";

test("rampAt walks the stops", () => {
  const s: [number, string][] = [[0, "#000000"], [0.5, "#ff0000"], [1, "#ffffff"]];
  assert.equal(rampAt(s, 0), "rgb(0 0 0)");
  assert.equal(rampAt(s, 0.25), "rgb(128 0 0)");
  assert.equal(rampAt(s, 0.75), "rgb(255 128 128)");
  assert.equal(rampAt(s, 2), "rgb(255 255 255)");
});

test("charge gathers fast and bleeds away slowly", () => {
  let c = 0;
  for (let i = 0; i < 30; i++) c = chargeStep(c, 3, 1 / 60); // half a second of a fast pointer
  assert.ok(c > 0.9, `charged ${c}`);
  const up = c;
  for (let i = 0; i < 30; i++) c = chargeStep(c, 0, 1 / 60);
  assert.ok(c < up && c > 0.4, `half a second later still ${c}`);
  for (let i = 0; i < 600; i++) c = chargeStep(c, 0, 1 / 60);
  assert.equal(c, 0);
});

test("charge is clamped and survives a dropped frame", () => {
  assert.ok(chargeStep(0, 1e6, 1) <= 1);
  assert.ok(chargeStep(0.5, -5, 1 / 60) <= 0.5);
});

test("client points map to canvas space, y up", () => {
  const r = { left: 0, top: 100, width: 200, height: 100 };
  assert.deepEqual(toCanvas(0, 200, r), [0, 0]);
  assert.deepEqual(toCanvas(100, 150, r), [0.5, 0.5]);
  assert.deepEqual(toCanvas(500, -20, r), [1, 1]);
});
