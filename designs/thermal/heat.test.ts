import { test } from "node:test";
import assert from "node:assert/strict";
import { bmp, heatGrid, palIndex, ramp, rankByTools, stripGrid } from "./heat.ts";

test("ramp hits the end stops of each palette", () => {
  assert.deepEqual(ramp(0, "iron"), [4, 6, 12]);
  assert.deepEqual(ramp(1, "iron"), [255, 250, 219]);
  assert.deepEqual(ramp(1, "white"), [247, 249, 255]);
});

test("heatGrid is deterministic per slug and warmer with more tools", () => {
  const a = heatGrid("qrify", 3), b = heatGrid("qrify", 3);
  assert.deepEqual(a.at, b.at);
  assert.ok(heatGrid("qrify", 5).peak > a.peak);
});

test("bmp is a 24-bit BMP of the grid size", () => {
  const u = bmp(heatGrid("x", 2), "rainbow", 0), bytes = Buffer.from(u.split(",")[1], "base64");
  assert.equal(bytes.length, 54 + 32 * 3 * 24);
  assert.equal(bytes.toString("latin1", 0, 2), "BM");
  assert.equal(bmp(stripGrid(), "iron", 0.2).startsWith("data:image/bmp;base64,"), true);
});

test("palIndex follows the u_pv encoding and ranking is stable", () => {
  assert.deepEqual((["iron", "rainbow", "white"] as const).map(palIndex), [0, 1, 2]);
  const r = rankByTools([{ tags: ["a"], n: 1 }, { tags: ["a", "b"], n: 2 }, { tags: ["a"], n: 3 }]);
  assert.deepEqual(r.map((x) => x.n), [2, 1, 3]);
});
