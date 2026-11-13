import { test } from "node:test";
import assert from "node:assert/strict";
import { hashStr } from "./vision.ts";

test("hash is stable", () => {
  assert.equal(hashStr("boilerframe"), hashStr("boilerframe"));
  assert.notEqual(hashStr("a"), hashStr("b"));
});
