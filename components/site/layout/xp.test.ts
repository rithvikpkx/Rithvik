import { test } from "node:test";
import assert from "node:assert/strict";
import { fillFor, orgMark, springStep } from "./xp.ts";

test("orgMark takes the first two meaningful words", () => {
  assert.equal(orgMark("Snowball Lab, Purdue University"), "SL");
  assert.equal(orgMark("Hack The Future @ Purdue"), "HF");
  assert.equal(orgMark("The Data Mine-Purdue University"), "DM");
  assert.equal(orgMark("Vertically Integrated Projects (VIP) at Purdue"), "VI");
  assert.equal(orgMark("Code Ninjas"), "CN");
  assert.equal(orgMark("Google"), "GO");
  assert.equal(orgMark(""), "·");
});

test("fillFor clamps to 0–1 and handles a zero-height box", () => {
  assert.equal(fillFor(100, 200, 50), 0);
  assert.equal(fillFor(100, 200, 200), 0.5);
  assert.equal(fillFor(100, 200, 900), 1);
  assert.equal(fillFor(100, 0, 100), 1);
  assert.equal(fillFor(100, 0, 99), 0);
});

test("springStep settles on the target and overshoots on the way", () => {
  let x = 0, v = 0, peak = 0;
  for (let i = 0; i < 240; i++) { [x, v] = springStep(x, v, 1, 1 / 60); peak = Math.max(peak, x); }
  assert.ok(Math.abs(x - 1) < 0.01);
  assert.ok(peak > 1.02); // underdamped: it wobbles past the target before it settles
});
