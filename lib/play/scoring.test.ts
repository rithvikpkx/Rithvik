import test from "node:test";
import assert from "node:assert/strict";
import { accuracy, addsError, angleRound, barFractions, beats, centerError, dotCount, dotsError, isBest, meanOf, pickLine, wpm, LINES } from "./scoring.ts";

test("wpm: 50 chars in 10s is 60 wpm; instant input stays finite", () => {
  assert.equal(wpm(50, 10000), 60);
  assert.ok(Number.isFinite(wpm(5, 0)));
});

test("accuracy and error counting", () => {
  assert.equal(accuracy(0, 0), 100);
  assert.equal(accuracy(1, 4), 75);
  assert.equal(accuracy(9, 4), 0);
  assert.equal(addsError("ab", "abx", "abc"), true);
  assert.equal(addsError("ab", "abc", "abc"), false);
  assert.equal(addsError("abx", "ab", "abc"), false); // backspace is not a new error
});

test("beats and isBest respect direction", () => {
  assert.equal(beats({ hi: true, base: 96 }, 100), true);
  assert.equal(beats({ hi: false, base: 3 }, 4), false);
  assert.equal(isBest(true, 80, null), true);
  assert.equal(isBest(true, 80, 90), false);
  assert.equal(isBest(false, 2, 3), true);
});

test("barFractions share one scale and survive zeros", () => {
  const [a, b] = barFractions(50, 100);
  assert.ok(b > a && b < 1);
  assert.deepEqual(barFractions(0, 0), [0, 0]);
});

test("round generators stay in range", () => {
  assert.equal(pickLine(0.999), LINES[LINES.length - 1]);
  const lo = angleRound(0, 0), hi = angleRound(0.9999, 0.9999);
  assert.equal(lo.target, 15);
  assert.ok(hi.target <= 164);
  assert.ok(lo.base >= -0.1 && hi.base < 0.5);
  assert.equal(dotCount(0), 18);
  assert.equal(dotCount(0.9999), 87);
});

test("error helpers", () => {
  assert.equal(dotsError(45, 50), 10);
  assert.equal(centerError([50, 30], 100, 60), 0);
  assert.equal(centerError([53, 34], 100, 60), 5);
  assert.equal(meanOf(10, 3), 3.3);
});
