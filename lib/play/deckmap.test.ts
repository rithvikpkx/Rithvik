import { test } from "node:test";
import assert from "node:assert/strict";
import { delayParams, fmtTime, semitones, snap, speedRate, toneFilter, toneLabel, volumeGain } from "./deckmap.ts";

test("speed is exactly 1x at the detent and monotonic", () => {
  assert.equal(speedRate(0.5), 1);
  assert.ok(speedRate(0) < 0.7 && speedRate(1) > 1.4);
  assert.ok(speedRate(0.4) < speedRate(0.6));
  assert.ok(Math.abs(semitones(2) - 12) < 1e-9);
});

test("tone is flat at the centre, low-pass left, high-pass right", () => {
  assert.deepEqual(toneFilter(0.5), { lp: 20000, hp: 20 });
  assert.ok(Math.abs(toneFilter(0).lp - 300) < 1e-6 && toneFilter(0).hp === 20);
  assert.ok(Math.abs(toneFilter(1).hp - 3000) < 1e-6 && toneFilter(1).lp === 20000);
  assert.equal(toneLabel(0.5), "FLAT");
  assert.match(toneLabel(0.1), /^LP /);
  assert.match(toneLabel(0.9), /^HP /);
});

test("delay is dry at zero and feedback never reaches runaway", () => {
  assert.deepEqual(delayParams(0), { wet: 0, feedback: 0 });
  assert.ok(delayParams(1).feedback <= 0.7 && delayParams(1).wet > 0.5);
});

test("snap, volume and time helpers", () => {
  assert.equal(snap(0.51), 0.5);
  assert.equal(snap(0.6), 0.6);
  assert.equal(volumeGain(0.5), 0.25);
  assert.equal(volumeGain(2), 1);
  assert.equal(fmtTime(72), "1:12");
});
