import { test } from "node:test";
import assert from "node:assert/strict";
import { coord, dims, mm, sheetFor } from "./drafting.ts";

test("pixels read as whole millimetres at 96 dpi", () => {
  assert.equal(mm(96), "25");
  assert.equal(mm(0), "0");
  assert.equal(mm(-40), "0");
  assert.equal(dims(378, 189), "100 × 50");
});

test("coordinates are four padded digits, clamped", () => {
  assert.equal(coord(42.4), "0042");
  assert.equal(coord(-3), "0000");
  assert.equal(coord(123456), "9999");
});

test("each sheet carries its own title block", () => {
  assert.deepEqual(sheetFor(0, 6), { dwg: "BP-01", scale: "1:1", rev: "A", sheet: "1 OF 6" });
  assert.equal(sheetFor(5, 6).sheet, "6 OF 6");
  assert.equal(sheetFor(2, 6).rev, "C");
});
