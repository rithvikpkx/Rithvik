import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTO_SPIN, IDLE_RPM, MAX_RPM, coast, deltaText, fitDistance, gearFor, lapClock, lapTimer, revLights, rpmFor, viewOffset } from "./telemetry.ts";

test("rpm idles on the turntable and approaches the limiter when spun hard", () => {
  assert.equal(rpmFor(AUTO_SPIN), IDLE_RPM);
  assert.equal(rpmFor(-AUTO_SPIN), IDLE_RPM);
  assert.ok(rpmFor(3) > 7000 && rpmFor(30) <= MAX_RPM);
  assert.ok(rpmFor(2) > rpmFor(1));
});

test("gears run 1..7", () => {
  assert.equal(gearFor(0), 1);
  assert.equal(gearFor(AUTO_SPIN + 1), 2);
  assert.equal(gearFor(99), 7);
});

test("rev lights are dark at idle and full at the redline", () => {
  assert.equal(revLights(IDLE_RPM), 0);
  assert.equal(revLights(8500), 15);
  assert.equal(revLights(MAX_RPM), 15);
});

test("coast decays a flick back to the resting speed, keeping its direction", () => {
  let v = 6;
  for (let i = 0; i < 600; i++) v = coast(v, 1 / 60);
  assert.ok(Math.abs(v - AUTO_SPIN) < 0.01);
  let w = -6;
  for (let i = 0; i < 600; i++) w = coast(w, 1 / 60);
  assert.ok(Math.abs(w + AUTO_SPIN) < 0.01);
});

test("framing: a wider view or a bigger fraction brings the camera closer", () => {
  assert.ok(fitDistance(4.7, 26, 2, 0.6) < fitDistance(4.7, 26, 1, 0.6));
  assert.ok(fitDistance(4.7, 26, 1.6, 0.8) < fitDistance(4.7, 26, 1.6, 0.5));
  assert.deepEqual(viewOffset(100, 50, 0.5, 0.5), [0, 0]);
  assert.deepEqual(viewOffset(100, 50, 0.6, 0.7).map(Math.round), [-10, -10]);
});

test("lap clock and delta format", () => {
  assert.equal(lapClock(72.408), "1:12.408");
  assert.equal(lapClock(5.5), "0:05.500");
  assert.equal(deltaText(-0.214), "−0.214");
  assert.equal(deltaText(1.03), "+1.030");
});

test("lap timer: a full turn is a lap; a quicker one is a new best with a negative delta", () => {
  const lap = lapTimer();
  assert.equal(lap(1, 10).n, 0);
  const a = lap(Math.PI * 2, 40);
  assert.equal(a.n, 1); assert.equal(a.last, 40); assert.ok(a.fast);
  const b = lap(Math.PI * 4, 60);
  assert.equal(b.n, 2); assert.equal(b.last, 20); assert.equal(b.delta, -20); assert.ok(b.fast);
  const c = lap(Math.PI * 6, 90);
  assert.equal(c.delta, 10); assert.ok(!c.fast);
});
