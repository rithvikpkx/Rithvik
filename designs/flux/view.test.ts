import { test } from "node:test";
import assert from "node:assert/strict";
import { boxToView, spring, strokeKind, toView } from "./view.ts";

const near = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test("toView maps the viewport onto the shader's view units", () => {
  assert.deepEqual(toView(720, 450, 1440, 900), [0, 0]);
  const [x0, y0] = toView(0, 0, 1440, 900);
  near(x0, -1.6); near(y0, 1);
  const [x1, y1] = toView(1440, 900, 1440, 900);
  near(x1, 1.6); near(y1, -1);
});

test("boxToView gives centre and half size", () => {
  const [x, y, hw, hh] = boxToView(620, 350, 200, 200, 1440, 900);
  near(x, 0); near(y, 0); near(hw, 200 / 900); near(hh, 200 / 900);
});

test("spring overshoots a little, then settles on the target", () => {
  let x = 0, v = 0, peak = 0;
  for (let i = 0; i < 600; i++) { [x, v] = spring(x, v, 1, 1 / 60, 26, 6.5); peak = Math.max(peak, x); }
  assert.ok(peak > 1 && peak < 1.25, String(peak));
  assert.ok(Math.abs(x - 1) < 1e-3 && Math.abs(v) < 1e-3);
});

test("strokeKind encodes the stroke angle above 2", () => {
  near(strokeKind(1, 0), 2);
  near(strokeKind(0, 1), 2 + Math.PI / 2);
  near(strokeKind(0, -1), 2 + Math.PI * 1.5);
  assert.ok(strokeKind(-1, -1e-9) < 2 + Math.PI * 2);
});
