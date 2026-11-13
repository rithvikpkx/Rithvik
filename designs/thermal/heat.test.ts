import { test } from "node:test";
import assert from "node:assert/strict";
import { bmp, palIndex, ramp, stripGrid } from "./heat.ts";

test("ramp hits the end stops of each palette", () => {
  assert.deepEqual(ramp(0, "iron"), [4, 6, 12]);
  assert.deepEqual(ramp(1, "iron"), [255, 250, 219]);
  assert.deepEqual(ramp(1, "white"), [247, 249, 255]);
});


test("bmp is a 24-bit BMP of the grid size", () => {
  const u = bmp(stripGrid(), "rainbow", 0), bytes = Buffer.from(u.split(",")[1], "base64");
  assert.equal(bytes.length, 54 + 64 * 3 * 6);
  assert.equal(bytes.toString("latin1", 0, 2), "BM");
  assert.equal(bmp(stripGrid(), "iron", 0.2).startsWith("data:image/bmp;base64,"), true);
});

test("palIndex follows the u_pv encoding", () => {
  assert.deepEqual((["iron", "rainbow", "white"] as const).map(palIndex), [0, 1, 2]);
});
