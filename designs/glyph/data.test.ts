import test from "node:test";
import assert from "node:assert/strict";
import { hash7, SECTIONS } from "./data.ts";

test("hash7 is stable, 7 hex chars, and differs per input", () => {
  assert.match(hash7("boilerframe"), /^[0-9a-f]{7}$/);
  assert.equal(hash7("boilerframe"), hash7("boilerframe"));
  assert.notEqual(hash7("boilerframe"), hash7("qrify"));
});

test("seven tmux windows", () => assert.equal(SECTIONS.length, 7));
