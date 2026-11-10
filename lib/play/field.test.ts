import test from "node:test";
import assert from "node:assert/strict";
import { copiesFor, onScreen, place, velocity, wrap } from "./field.ts";

test("wrap is a positive modulo", () => {
  assert.equal(wrap(-1, 10), 9);
  assert.equal(wrap(25, 10), 5);
  assert.equal(wrap(0, 10), 0);
});

// The pool must match the true infinite plane: every on-screen copy of an item (x + off + n*tile for any integer
// n) has exactly one pooled copy at that position.
test("pooled copies cover every on-screen copy of the infinite plane", () => {
  const tile = 1200, size = 260, pad = 300;
  for (const view of [360, 900, 1264, 1900]) {
    const copies = copiesFor(view, tile, pad);
    for (const x of [0, 470, 1100]) {
      for (let off = -5000; off <= 5000; off += 137) {
        const truth: number[] = [];
        for (let n = -10; n <= 10; n++) { const p = x + off + n * tile; if (onScreen(p, size, view)) truth.push(p); }
        const pooled = Array.from({ length: copies }, (_, k) => place(x, off, k, tile, copies, pad)).filter((p) => onScreen(p, size, view));
        assert.deepEqual(pooled.sort((a, b) => a - b), truth.sort((a, b) => a - b), `view ${view} x ${x} off ${off}`);
      }
    }
  }
});

test("a copy moves continuously while on screen (it only jumps out of sight)", () => {
  const tile = 1200, pad = 300, view = 1264, copies = copiesFor(view, tile, pad);
  for (let off = 0; off < 3000; off += 7) {
    const a = place(200, off, 0, tile, copies, pad), b = place(200, off + 7, 0, tile, copies, pad);
    if (b !== a + 7) assert.ok(a + 7 >= view, "the jump happens past the far edge");
  }
});

test("velocity reads only the recent window", () => {
  assert.deepEqual(velocity([]), [0, 0]);
  assert.deepEqual(velocity([[0, 0, 0]]), [0, 0]);
  assert.deepEqual(velocity([[0, 0, 0], [500, 0, 0], [540, 40, -20], [580, 80, -40]]), [1, -0.5]);
});
