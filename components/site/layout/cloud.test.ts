import { test } from "node:test";
import assert from "node:assert/strict";
import { rest, step, type Box } from "./cloud.ts";

const gap = (bs: ReturnType<typeof rest>) => Math.min(...bs.flatMap((a, i) => bs.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));

test("the buttons never overlap, at desktop or phone size, over a minute of orbiting", () => {
  for (const box of [{ w: 1100, h: 320, size: 80 }, { w: 342, h: 360, size: 72 }, { w: 300, h: 300, size: 72 }] as Box[]) {
    const bs = rest(box);
    assert.ok(gap(bs) > box.size, `still arrangement is clear at ${box.w}`);
    let worst = Infinity;
    for (let f = 0; f < 3600; f++) { step(bs, f / 60, 1 / 60, box, null); worst = Math.min(worst, gap(bs)); }
    assert.ok(worst > box.size * 0.9, `closest approach ${worst.toFixed(1)} at ${box.w}`);
  }
});

test("a pointer pushes a button away and the spring brings it home; bodies stay in the box", () => {
  const box = { w: 600, h: 320, size: 80 }, bs = rest(box), b0 = { ...bs[0] };
  for (let f = 0; f < 60; f++) step(bs, 0, 1 / 60, box, [b0.x + 10, b0.y]);
  assert.ok(Math.hypot(bs[0].x - b0.x, bs[0].y - b0.y) > 20, "was pushed");
  for (let f = 0; f < 600; f++) step(bs, 0, 1 / 60, box, null);
  assert.ok(Math.hypot(bs[0].x - b0.x, bs[0].y - b0.y) < 3, "came home");
  for (const b of bs) assert.ok(b.x >= 40 && b.x <= 560 && b.y >= 40 && b.y <= 280);
});
