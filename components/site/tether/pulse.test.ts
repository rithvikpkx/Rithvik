import test from "node:test";
import assert from "node:assert/strict";
import { CHARGE, LAUNCH, PERIOD, TRAVEL, beat, travelEase } from "./pulse.ts";

test("the glow peaks at the end of the charge and is fully dim when the pulse launches", () => {
  const at = (tau: number) => beat(tau + 0, 0).glow; // node 0 is slot 0: tau == t
  assert.ok(at(CHARGE) > 0.999);
  assert.equal(at(LAUNCH + 1e-6), 0);
  assert.ok(at(CHARGE / 2) > 0.3 && at(CHARGE / 2) < 0.7);
});

test("a pulse travels the whole cable once per cycle, node to portrait", () => {
  assert.equal(beat(LAUNCH - 0.01, 0).run, -1);
  assert.ok(beat(LAUNCH + 0.01, 0).run < 0.05);
  assert.ok(beat(LAUNCH + TRAVEL - 0.01, 0).run > 0.95);
  assert.equal(beat(LAUNCH + TRAVEL + 0.01, 0).run, -1);
});

test("the four nodes never launch together", () => {
  for (let t = 0; t < PERIOD * 3; t += 0.01) {
    const launching = [0, 1, 2, 3].filter((i) => { const b = beat(t, i); return b.run >= 0 && b.run < 0.3; });
    assert.ok(launching.length <= 1, `t=${t.toFixed(2)}`);
  }
});

test("travel easing is monotonic and pinned at both ends", () => {
  let prev = -1;
  for (let u = 0; u <= 1.0001; u += 0.01) { const e = travelEase(Math.min(u, 1)); assert.ok(e >= prev); prev = e; }
  assert.equal(travelEase(0), 0);
  assert.equal(travelEase(1), 1);
});
