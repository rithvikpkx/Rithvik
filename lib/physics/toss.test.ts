import test from "node:test";
import assert from "node:assert/strict";
import { asleep, bodyFor, halfW, offsetOf, settle, sleeper, step, type Body } from "./toss.ts";

test("wide capsules stack on the floor without overlapping and stay inside the walls", () => {
  const w = { w: 600, h: 300 };
  const bodies: Body[] = Array.from({ length: 10 }, (_, i) => ({ x: 90 + (i % 4) * 130, y: 20 + i * 14, vx: 0, vy: 0, r: 15, a: 20 + (i % 3) * 25 }));
  settle(bodies, w, 1500);
  for (const b of bodies) { assert.ok(b.x - halfW(b) >= -0.01 && b.x + halfW(b) <= w.w + 0.01); assert.ok(b.y + b.r <= w.h + 0.01); }
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    const xOverlap = Math.min(a.x + (a.a ?? 0), b.x + (b.a ?? 0)) - Math.max(a.x - (a.a ?? 0), b.x - (b.a ?? 0));
    if (xOverlap > 3) assert.ok(Math.abs(a.y - b.y) >= a.r + b.r - 3, `pills ${i}/${j} overlap`);
  }
});

test("frozen layout -> physics -> tidy: bodies start on their elements, fall, and tidy returns every offset to zero", () => {
  const rects = [{ x: 10, y: 40, w: 52, h: 52 }, { x: 70, y: 40, w: 52, h: 52 }, { x: 10, y: 100, w: 110, h: 30 }];
  const bodies = rects.map(bodyFor);
  assert.equal(bodies[0].a, 0); // a square is a circle
  assert.ok(bodies[2].a! > 0); // a wide box is a capsule
  assert.deepEqual(bodies.map((b, i) => offsetOf(b, rects[i])), [[0, 0], [0, 0], [0, 0]]); // frozen: no offset
  settle(bodies, { w: 200, h: 260 }, 900);
  assert.ok(bodies.every((b, i) => offsetOf(b, rects[i])[1] > 0), "physics: everything dropped");
  const tidy = rects.map(bodyFor); // tidy = rebuild the bodies from the frozen layout
  assert.ok(tidy.every((b, i) => offsetOf(b, rects[i]).every((v) => v === 0)));
});

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
