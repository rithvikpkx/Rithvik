import test from "node:test";
import assert from "node:assert/strict";
import { capOffers } from "./offers.ts";

test("capOffers keeps the first of each key and caps the count", () => {
  const o = [{ key: "case:a", n: 1 }, { key: "compose", n: 2 }, { key: "case:a", n: 3 }, { key: "link:x", n: 4 }, { key: "resume", n: 5 }, { key: "game:z", n: 6 }];
  assert.deepEqual(capOffers(o).map((x) => x.n), [1, 2, 4, 5]);
  assert.deepEqual(capOffers(o, 2).map((x) => x.n), [1, 2]);
  assert.deepEqual(capOffers([]), []);
});
