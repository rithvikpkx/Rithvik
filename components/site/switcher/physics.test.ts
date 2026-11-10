import test from "node:test";
import assert from "node:assert/strict";
import { collide, magnet, nearestWithin, ringSlots, squash, stepOrb, type Orb } from "./physics.ts";

const orb = (x: number, y: number, s = 1): Orb => ({ x, y, vx: 0, vy: 0, s, vs: 0 });

test("ringSlots: designs inner, palettes outer, nothing overlaps", () => {
  const c = { x: 100, y: 100 };
  const slots = ringSlots(9, 16, c, 70, 100);
  assert.equal(slots.length, 25);
  slots.slice(0, 9).forEach((p) => assert.ok(Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - 70) < 1e-6));
  slots.slice(9).forEach((p) => assert.ok(Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - 100) < 1e-6));
  assert.ok(Math.abs(slots[0].x - c.x) < 1e-6 && slots[0].y < c.y); // first design at 12 o'clock
  let min = Infinity;
  for (let i = 0; i < 25; i++) for (let j = i + 1; j < 25; j++) min = Math.min(min, Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y));
  assert.ok(min > 14, `closest pair ${min}`);
});

test("stepOrb: settles on its target with a small overshoot", () => {
  const o = orb(0, 0, 0);
  const t = { x: 100, y: 0, s: 1 };
  let peak = 0, ms = 0;
  while (!stepOrb(o, t, 16) && ms < 4000) { ms += 16; peak = Math.max(peak, o.x); }
  assert.ok(ms < 1500, `settled in ${ms}ms`);
  assert.ok(peak > 100 && peak < 115, `overshoot to ${peak}`);
  assert.deepEqual([o.x, o.y, o.s], [100, 0, 1]);
});

test("stepOrb: a dropped frame is clamped", () => {
  const o = orb(0, 0);
  stepOrb(o, { x: 1000, y: 0, s: 1 }, 5000);
  assert.ok(Number.isFinite(o.x) && o.x < 1000);
});

test("collide: separates overlapping orbs; fixed ones stay put", () => {
  const orbs = [orb(0, 0), orb(10, 0)];
  collide(orbs, [10, 10], () => false);
  assert.ok(orbs[1].x - orbs[0].x >= 22 - 1e-9);
  const held = [orb(0, 0), orb(10, 0)];
  collide(held, [10, 10], (i) => i === 0);
  assert.equal(held[0].x, 0);
  assert.ok(held[1].x >= 22 - 1e-9);
  assert.ok(held[1].vx > 0);
});

test("collide: exactly stacked orbs still separate", () => {
  const orbs = [orb(5, 5), orb(5, 5)];
  collide(orbs, [10, 10], () => false);
  assert.ok(Math.hypot(orbs[1].x - orbs[0].x, orbs[1].y - orbs[0].y) >= 22 - 1e-9);
});

test("collide: collapsed (scale 0) orbs stacked at one point do not fly apart", () => {
  const orbs = [orb(5, 5, 0), orb(5, 5, 0)];
  collide(orbs, [28, 28], () => false, 0);
  assert.deepEqual([orbs[0].x, orbs[1].x], [5, 5]);
});

test("magnet: untouched outside reach, centred at the middle, monotone between", () => {
  const c = { x: 0, y: 0 };
  assert.deepEqual(magnet({ x: 80, y: 0 }, c, 56), { x: 80, y: 0 });
  assert.equal(magnet({ x: 0, y: 0 }, c, 56).x, 0);
  assert.ok(magnet({ x: 30, y: 0 }, c, 56).x < 30);
  assert.ok(magnet({ x: 20, y: 0 }, c, 56).x < magnet({ x: 40, y: 0 }, c, 56).x);
});

test("squash: identity at rest, elongates along travel, volume kept", () => {
  assert.deepEqual(squash(0, 0), { rot: 0, sx: 1, sy: 1 });
  const q = squash(0, 2);
  assert.ok(q.sx > 1 && q.sy < 1 && Math.abs(q.sx * q.sy - 1) < 1e-9);
  assert.ok(Math.abs(q.rot - Math.PI / 2) < 1e-9);
});

test("nearestWithin: closest in reach, else -1", () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  assert.equal(nearestWithin(pts, { x: 8, y: 0 }, 5), 1);
  assert.equal(nearestWithin(pts, { x: 100, y: 0 }, 5), -1);
});
