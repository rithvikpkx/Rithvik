import test from "node:test";
import assert from "node:assert/strict";
import { asleep, settle, sleeper, step, type Body } from "./toss.ts";

const world = { w: 400, h: 300 };
const pile = (n: number, r = 28): Body[] => Array.from({ length: n }, (_, i) => ({ x: 40 + (i % 6) * 62, y: r + Math.floor(i / 6) * 60, vx: 0, vy: 0, r }));

test("a dropped pile settles inside the box with no overlaps", () => {
  const bodies = pile(14);
  const steps = settle(bodies, world, 1500);
  assert.ok(steps < 1500, "should reach sleep");
  for (const b of bodies) {
    assert.ok(b.x >= b.r - 0.01 && b.x <= world.w - b.r + 0.01, `x in bounds ${b.x}`);
    assert.ok(b.y >= b.r - 0.01 && b.y <= world.h - b.r + 0.01, `y in bounds ${b.y}`);
  }
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const d = Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y);
    assert.ok(d >= bodies[i].r + bodies[j].r - 3, `overlap ${i}/${j}: ${d}`); // small tolerance: two relaxation passes, not an exact solver
  }
});

test("a tossed body bounces off the wall and comes back to rest", () => {
  const b: Body = { x: 100, y: 272, vx: 1400, vy: 0, r: 28 };
  let hitWall = false;
  for (let i = 0; i < 600; i++) { step([b], world, 1 / 60); if (b.vx < 0) hitWall = true; }
  assert.ok(hitWall);
  assert.ok(asleep(step([b], world, 1 / 60)) || Math.hypot(b.vx, b.vy) < 30);
});

test("a held body is not moved by the step but pushes a neighbour away", () => {
  const held: Body = { x: 200, y: 150, vx: 0, vy: 0, r: 30, held: true };
  const other: Body = { x: 215, y: 150, vx: 0, vy: 0, r: 30 };
  step([held, other], { ...world, gravity: 0 }, 1 / 60);
  assert.equal(held.x, 200);
  assert.ok(other.x > 215);
});

test("identical centres do not produce NaN", () => {
  const a: Body = { x: 100, y: 100, vx: 0, vy: 0, r: 20 }, b: Body = { ...a };
  step([a, b], world, 1 / 60);
  assert.ok([a.x, a.y, b.x, b.y].every(Number.isFinite));
});

test("a pile released at rest does not fall asleep before it has had time to fall", () => {
  const bodies = pile(6);
  const done = sleeper(12);
  const speeds: number[] = [];
  for (let i = 0; i < 30; i++) speeds.push(step(bodies, world, 1 / 60));
  assert.ok(asleep(speeds[0]), "the first frame alone looks slow");
  assert.ok(!speeds.slice(0, 12).every((s) => done(s)), "but the sleeper waits for several slow frames in a row");
  assert.ok(bodies.every((b) => b.y > b.r + 5), "and the bodies are on their way down");
});
